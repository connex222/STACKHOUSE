import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from './src/server/rooms.js';
import { connectPostgresSnapshot } from './src/server/postgres-storage.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['.html','.css','.js','.webp','.png','.json','.svg','.ico','.txt','.mp3','.m4a']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const port=Number(process.env.PORT||4173);
if(process.env.DATABASE_URL && process.env.ROOM_DATA_FILE)throw Error('Use DATABASE_URL or ROOM_DATA_FILE, not both.');
const snapshotStore=process.env.DATABASE_URL?await connectPostgresSnapshot(process.env.DATABASE_URL):null;
const store=new RoomStore({storageFile:process.env.ROOM_DATA_FILE||null,snapshotStore});
await store.load();
const commonHeaders={'x-content-type-options':'nosniff','x-frame-options':'DENY',
  'referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()'};
const json=(res,status,body)=>{
  res.writeHead(status,{...commonHeaders,'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(body));
};
function auth(req) {
  const header=req.headers.authorization||'';
  return /^Bearer [A-Za-z0-9_-]{30,100}$/.test(header) ? header.slice(7) : '';
}
async function readJson(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('Send JSON requests.');
  // Limit actual bytes, not JavaScript characters (multibyte UTF-8 can defeat a character cap).
  let totalBytes=0;const chunks=[];
  for await(const chunk of req) {
    totalBytes+=chunk.length;
    if(totalBytes>8192)throw Error('Request is too large.');
    chunks.push(chunk);
  }
  const text=Buffer.concat(chunks,totalBytes).toString('utf8');
  if(!text)throw Error('Request body is empty.');
  try{return JSON.parse(text);}catch {throw Error('Invalid JSON.');}
}
const rate=new Map();
function limited(req) {
  const key=req.socket.remoteAddress??'unknown';
  const t=Date.now();const entry=rate.get(key)??{start:t,count:0};
  if(t-entry.start>60000) {entry.start=t;entry.count=0;}
  entry.count++;rate.set(key,entry);
  if(rate.size>5000)for(const [k,v] of rate)if(t-v.start>60000)rate.delete(k);
  return entry.count>180;
}
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    if(pathname==='/health') {
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
      const databaseConnected=snapshotStore ? await snapshotStore.ping() : null;
      const ok=databaseConnected!==false;
      return json(res,ok?200:503,{
        ok,service:'stackhouse-social',multiplayer:true,
        storage:store.storageKind,
        // A filesystem snapshot is not automatically durable on a cloud host.
        durableStorage:store.storageKind==='postgres' && databaseConnected===true,
        databaseConnected
      });
    }
    if(pathname.startsWith('/api/')) {
      if(limited(req))return json(res,429,{error:'Too many requests. Please try again shortly.'});
      if(req.method==='POST'&&pathname==='/api/rooms')return json(res,201,await store.create(await readJson(req)));
      const match=pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|start|state|actions|events))?$/);
      if(!match)return json(res,404,{error:'Unknown API route.'});
      const [,code,route='state']=match;
      if(route==='join'&&req.method==='POST')return json(res,200,await store.join(code,await readJson(req)));
      if(route==='start'&&req.method==='POST')return json(res,200,await store.start(code,auth(req)));
      if(route==='actions'&&req.method==='POST')return json(res,200,await store.move(code,auth(req),await readJson(req)));
      if(route==='state'&&req.method==='GET')return json(res,200,store.view(code,auth(req)));
      if(route==='events'&&req.method==='GET') {
        const credential=auth(req);const initialView=store.view(code,credential);
        // SSE over authenticated fetch (never expose player tokens in URLs).
        // Cap simultaneous streams for each authenticated seat to avoid idle-connection floods.
        if(!store.canSubscribe(code,initialView.seat))return json(res,429,{error:'Too many open table connections. Close unused tabs.'});
        res.writeHead(200,{...commonHeaders,'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform',
          'connection':'keep-alive','x-accel-buffering':'no'});
        let closed=false;
        const deliver=()=>{if(!closed)res.write(`event: state\ndata: ${JSON.stringify(store.view(code,credential))}\n\n`);};
        const unsubscribe=store.subscribe(code,deliver,initialView.seat);
        deliver();
        const ping=setInterval(()=>{if(!closed)res.write(': ping\n\n');},20000);
        res.on('close',()=>{closed=true;unsubscribe();clearInterval(ping);});
        return;
      }
      return json(res,405,{error:'Method not allowed.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||!allowed.has(path.extname(file))||
      (pathname.startsWith('/src/server/'))||
      !['index.html','styles.css','PLAY-OFFLINE.html','assets','src'].some(a=>file===path.join(root,a)||file.startsWith(path.join(root,a)+path.sep))){
      res.writeHead(403);res.end('Forbidden');return;
    }
    await stat(file);
    const data=await readFile(file);
    res.writeHead(200,{...commonHeaders,'content-type':mime[path.extname(file)],'cache-control':'no-cache',
      'content-security-policy':pathname==='/PLAY-OFFLINE.html'?"default-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; script-src 'self' 'unsafe-inline'":"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; script-src 'self'"});
    if(req.method==='HEAD')return res.end();
    res.end(data);
  } catch(err) {
    if(res.headersSent){res.end();return;}
    const status=/snapshot conflict|database has not been loaded|temporarily unavailable/i.test(err.message)?503
      :/access denied|session does not belong/i.test(err.message)?401
      :/room not found/i.test(err.message)?404
      :/table changed|already used/i.test(err.message)?409:400;
    if(status===503)console.error('Room persistence failure:',err.message);
    json(res,status,{error:status===503?'The saved table is temporarily unavailable. Please try again shortly.':err.message||'Request failed.'});
  }
});
server.listen(port,'0.0.0.0',()=>console.log(`Stackhouse Social multiplayer running on port ${port}`));
