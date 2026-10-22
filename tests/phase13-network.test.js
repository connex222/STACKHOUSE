import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const n=s.address().port;await new Promise(r=>s.close(r));return n;}
async function fixture(){const port=await freePort(),child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ROOM_DATA_FILE:'',DATABASE_URL:''},stdio:'pipe'}),base=`http://127.0.0.1:${port}`;for(let i=0;i<90;i++){if(child.exitCode!==null)throw Error('Server crashed');try{if((await fetch(base+'/health')).ok)return {base,close:async()=>{child.kill();await once(child,'exit');}};}catch{}await delay(25);}child.kill();throw Error('Service did not start.');}
async function api(base,method,path,body,token){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
test('HTTP/SSE four-phone group: joining, host start, cards, turns, rejects and reconnection',{timeout:12000},async()=>{
 const {base,close}=await fixture();
 try{
  const host=await api(base,'POST','/api/rooms',{mode:'eight-shift',maxPlayers:5,name:'Host',avatar:1});
  assert.equal(host.status,201);
  const {code}=host.body,clients=[host.body];
  for(let i=1;i<4;i++){
   const joined=await api(base,'POST',`/api/rooms/${code}/join`,{name:`Guest ${i}`,avatar:i+1});
   assert.equal(joined.status,200);clients.push(joined.body);
   assert.equal(joined.body.view.status,'waiting');
  }
  const unauth=await api(base,'POST',`/api/rooms/${code}/start`,null);
  assert.equal(unauth.status,401);
  const denied=await api(base,'POST',`/api/rooms/${code}/start`,null,clients[1].token);
  assert.equal(denied.status,400);
  const controller=new AbortController();
  const sse=await fetch(`${base}/api/rooms/${code}/events`,{headers:{authorization:`Bearer ${clients[2].token}`},signal:controller.signal});
  assert.equal(sse.status,200);assert.match(sse.headers.get('content-type'),/event-stream/);
  const started=await api(base,'POST',`/api/rooms/${code}/start`,null,clients[0].token);
  assert.equal(started.status,200);assert.equal(started.body.status,'playing');assert.equal(started.body.game.players.length,4);
  for(let i=0;i<clients.length;i++){
   const state=await api(base,'GET',`/api/rooms/${code}/state`,null,clients[i].token);
   assert.equal(state.status,200);assert.equal(state.body.game.players.length,4);
   assert.ok(state.body.game.players.slice(1).every(p=>p.hand.every(c=>c===null)));
  }
  const moved=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'eight-draw',revision:started.body.revision,actionId:'test-fourphones-draw-a'},clients[0].token);
  assert.equal(moved.status,200);
  const replay=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'eight-draw',revision:started.body.revision,actionId:'test-fourphones-draw-a'},clients[0].token);
  assert.equal(replay.status,200);assert.equal(replay.body.revision,moved.body.revision);
  const passed=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'eight-pass',revision:moved.body.revision},clients[0].token);
  assert.equal(passed.status,200);
  const guest=await api(base,'GET',`/api/rooms/${code}/state`,null,clients[1].token);
  assert.equal(guest.body.game.active,0);
  const incorrect=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'eight-draw',revision:passed.body.revision},clients[3].token);
  assert.equal(incorrect.status,400);
  const guestDraw=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'eight-draw',revision:passed.body.revision},clients[1].token);
  assert.equal(guestDraw.status,200);
  controller.abort();
 }finally{await close();}
});
