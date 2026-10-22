import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

async function port(){const srv=net.createServer();await new Promise(r=>srv.listen(0,'127.0.0.1',r));const p=srv.address().port;await new Promise(r=>srv.close(r));return p;}
async function startServer(){const p=await port();const child=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:String(p),DATABASE_URL:'',ROOM_DATA_FILE:''},stdio:['ignore','pipe','pipe']});const base=`http://127.0.0.1:${p}`;let logs='';child.stderr.on('data',c=>{logs+=String(c)});child.stdout.on('data',c=>{logs+=String(c)});
 for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error(logs||'Server unexpectedly stopped.');try{if((await fetch(`${base}/health`)).ok)return {base,child};}catch{}await new Promise(r=>setTimeout(r,60));}child.kill();throw Error(`Server did not become ready: ${logs}`);}
async function json(base,route,{method='GET',token='',body=undefined}={}){const response=await fetch(base+route,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}

test('HTTP: TV is isolated from player credentials, host pause is enforced, TV link can be revoked', {timeout:30000},async()=>{
 const {base,child}=await startServer();
 try{
  const tv=await fetch(`${base}/tv.html`);assert.equal(tv.status,200);assert.match(await tv.text(),/tv-app/);
  const script=await fetch(`${base}/src/tv.js`);assert.equal(script.status,200);assert.match(await script.text(),/Read-only/);
  const created=await json(base,'/api/rooms',{method:'POST',body:{mode:'tile-royale',name:'Alice',avatar:1,maxPlayers:3}});
  assert.equal(created.status,201);const {code,token}=created.body;
  for(let n=2;n<=3;n++)assert.equal((await json(base,`/api/rooms/${code}/join`,{method:'POST',body:{name:`Guest ${n}`,avatar:n}})).status,200);
  const before=await json(base,`/api/rooms/${code}/spectate`,{token});assert.equal(before.status,401);
  const host=await json(base,`/api/rooms/${code}/host`,{method:'POST',token,body:{type:'tv-create',revision:created.body.view.revision+2}});
  assert.equal(host.status,200);const watch=host.body.watchKey;assert.equal(typeof watch,'string');
  const guestView=await json(base,`/api/rooms/${code}/spectate`,{token:watch});assert.equal(guestView.status,200);
  assert.equal(guestView.body.players.length,3);assert.equal(JSON.stringify(guestView.body).includes('"rack":'),false);
  assert.equal((await json(base,`/api/rooms/${code}/actions`,{method:'POST',token:watch,body:{type:'tile-end',draw:true,revision:host.body.view.revision}})).status,401);
  const paused=await json(base,`/api/rooms/${code}/host`,{method:'POST',token,body:{type:'pause',revision:host.body.view.revision}});
  assert.equal(paused.status,200);assert.equal(paused.body.view.paused,true);
  const blocked=await json(base,`/api/rooms/${code}/actions`,{method:'POST',token,body:{type:'tile-end',draw:true,revision:paused.body.view.revision}});
  assert.equal(blocked.status,400);assert.match(blocked.body.error,/paused/);
  const resumed=await json(base,`/api/rooms/${code}/host`,{method:'POST',token,body:{type:'resume',revision:paused.body.view.revision}});
  assert.equal(resumed.status,200);
  const streamController=new AbortController();
  const stream=await fetch(`${base}/api/rooms/${code}/watch`,{headers:{authorization:`Bearer ${watch}`},signal:streamController.signal});
  assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const read=await stream.body.getReader().read();assert.match(new TextDecoder().decode(read.value),/"rackCount"/);streamController.abort();
  const retired=await json(base,`/api/rooms/${code}/host`,{method:'POST',token,body:{type:'tv-disable',revision:resumed.body.view.revision}});
  assert.equal(retired.status,200);
  assert.equal((await json(base,`/api/rooms/${code}/spectate`,{token:watch})).status,401);
 }finally{child.kill('SIGTERM');}
});
