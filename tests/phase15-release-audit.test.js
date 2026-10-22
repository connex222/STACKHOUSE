import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {RoomStore, MAX_STREAMS_PER_SEAT} from '../src/server/rooms.js';

async function fixture() {
  const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,['server.js'],{
    cwd:process.cwd(),env:{...process.env,PORT:String(port),DATABASE_URL:'',ROOM_DATA_FILE:''},stdio:'pipe'
  });
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<90;i++){
    if(child.exitCode!==null)throw Error('Web process exited during startup');
    try {if((await fetch(`${base}/health`)).ok) return {base,stop:async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');}}; } catch {}
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  child.kill();throw Error('Server did not become healthy');
}
const post=async(base,path,body,token)=>fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:typeof body==='string'?body:JSON.stringify(body)});

test('Release: UTF-8 byte limits and malformed room requests are handled without crashing',{timeout:12000},async()=>{
  const {base,stop}=await fixture();
  try {
    const oversized=await post(base,'/api/rooms',JSON.stringify({mode:'eight-shift',name:'É'.repeat(4300),avatar:1}));
    assert.equal(oversized.status,400);
    assert.match((await oversized.json()).error,/too large/i);
    const nullBody=await post(base,'/api/rooms','null');
    assert.equal(nullBody.status,400);
    assert.match((await nullBody.json()).error,/room settings/i);
    const arrayBody=await post(base,'/api/rooms','[]');
    assert.equal(arrayBody.status,400);
    const valid=await post(base,'/api/rooms',{mode:'eight-shift',name:'Release Host',avatar:1});
    assert.equal(valid.status,201,'Server must accept a valid request after rejects');
    const code=(await valid.json()).code;
    const badJoin=await post(base,`/api/rooms/${code}/join`,'null');
    assert.equal(badJoin.status,400);
    assert.match((await badJoin.json()).error,/name and avatar/i);
  } finally {await stop();}
});

test('Release: private modules blocked and safe security headers sent',{timeout:12000},async()=>{
  const {base,stop}=await fixture();
  try {
    const home=await fetch(base);
    assert.equal(home.status,200);
    assert.equal(home.headers.get('x-frame-options'),'DENY');
    assert.match(home.headers.get('content-security-policy'),/connect-src 'self'/);
    assert.match(home.headers.get('permissions-policy'),/camera=\(\)/);
    const forbidden=await fetch(`${base}/src/server/rooms.js`);
    assert.equal(forbidden.status,403);
    const api=await fetch(`${base}/api/rooms/AAAAAA/state`);
    assert.equal(api.status,404); // Unknown rooms are not readable.
    assert.equal(api.headers.get('cache-control'),'no-store');
    const forbiddenMethod=await fetch(`${base}/health`,{method:'POST'});
    assert.equal(forbiddenMethod.status,405);
    const healthy=await (await fetch(`${base}/health`)).json();
    assert.equal(healthy.durableStorage,false);
  } finally {await stop();}
});

test('Release: seat streaming cap releases capacity on unsubscribe',{timeout:12000},async()=>{
 const store=new RoomStore();
 const created=await store.create({mode:'eight-shift',name:'Alice',avatar:1});
 const second=await store.join(created.code,{name:'Bob',avatar:2});
 const unsub=[];
 try{
   for(let i=0;i<MAX_STREAMS_PER_SEAT;i++)unsub.push(store.subscribe(created.code,()=>{},0));
   assert.equal(store.canSubscribe(created.code,0),false);
   assert.equal(store.canSubscribe(created.code,1),true,'Other players are unaffected');
   assert.throws(()=>store.subscribe(created.code,()=>{},0),/Too many open/);
   unsub.pop()();
   assert.equal(store.canSubscribe(created.code,0),true);
   const guestUnsub=store.subscribe(created.code,()=>{},1);
   assert.equal(store.view(created.code,second.token).players[0].connected,true);
   guestUnsub();
 }finally{for(const close of unsub)close();}
});

test('Release: stream limit enforced via public HTTP endpoint',{timeout:14000},async()=>{
 const {base,stop}=await fixture();
 const controllers=[];
 try{
   const create=await post(base,'/api/rooms',{mode:'phase-quest',name:'Alice',avatar:1});
   const room=await create.json();
   for(let i=0;i<MAX_STREAMS_PER_SEAT;i++){
     const controller=new AbortController();controllers.push(controller);
     const response=await fetch(`${base}/api/rooms/${room.code}/events`,{headers:{authorization:`Bearer ${room.token}`},signal:controller.signal});
     assert.equal(response.status,200);
     // Hold the connection until this test completes.
   }
   const extra=await fetch(`${base}/api/rooms/${room.code}/events`,{headers:{authorization:`Bearer ${room.token}`}});
   assert.equal(extra.status,429);
   assert.equal(extra.headers.get('cache-control'),'no-store');
 }finally{for(const controller of controllers)controller.abort();await stop();}
});
