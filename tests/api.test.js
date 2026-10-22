import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
async function port() {
  const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');
  const p=s.address().port;s.close();await once(s,'close');return p;
}
async function serverFixture() {
  const p=await port();
  const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(p),ROOM_DATA_FILE:''},stdio:'pipe'});
  const base=`http://127.0.0.1:${p}`;
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null)throw Error('Web server crashed');
    try {const response=await fetch(`${base}/health`);if(response.ok)break;}catch{}
    await new Promise(r=>setTimeout(r,25));
  }
  return {base,child,close:async()=>{child.kill('SIGTERM');await once(child,'exit');}};
}
const post=async(url,body,token)=>{
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  return {status:r.status,data:await r.json()};
};
test('HTTP integration: create, join, authorise, reject invalid turn and reconnect',async()=>{
  const {base,close}=await serverFixture();
  try {
    const created=await post(`${base}/api/rooms`,{mode:'phase-quest',name:'Alice',avatar:3});
    assert.equal(created.status,201);
    const {code,token:hostToken}=created.data;
    assert.equal(created.data.view.status,'waiting');
    const guest=await post(`${base}/api/rooms/${code}/join`,{name:'Bob',avatar:12});
    assert.equal(guest.status,200);
    const denied=await fetch(`${base}/api/rooms/${code}/state`);
    assert.equal(denied.status,401);
    const state=await fetch(`${base}/api/rooms/${code}/state`,{headers:{authorization:`Bearer ${hostToken}`}});
    assert.equal(state.status,200);
    assert.equal((await state.json()).game.players[0].name,'Alice');
    const wrongTurn=await post(`${base}/api/rooms/${code}/actions`,{type:'contract-draw',from:'deck',revision:guest.data.view.revision},guest.data.token);
    assert.equal(wrongTurn.status,400);
    assert.match(wrongTurn.data.error,/opponent’s turn/);
    const valid=await post(`${base}/api/rooms/${code}/actions`,{type:'contract-draw',from:'deck',revision:guest.data.view.revision},hostToken);
    assert.equal(valid.status,200);
    assert.equal(valid.data.game.step,'play');
    assert.equal(valid.data.game.players[1].hand.every(c=>c===null),true);
    const html=await fetch(base);assert.equal(html.status,200);assert.match(await html.text(),/Stackhouse Social/);
  }finally{await close();}
});
test('HTTP integration: authenticated event stream receives updates on both phones',async()=>{
  const {base,close}=await serverFixture();
  try {
    const host=(await post(`${base}/api/rooms`,{mode:'stack-run',name:'Alice',avatar:3})).data;
    const controller=new AbortController();
    const connected=await fetch(`${base}/api/rooms/${host.code}/events`,{headers:{authorization:`Bearer ${host.token}`},signal:controller.signal});
    assert.equal(connected.status,200);
    assert.match(connected.headers.get('content-type'),/event-stream/);
    const reader=connected.body.getReader();
    const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/"status":"waiting"/);
    await post(`${base}/api/rooms/${host.code}/join`,{name:'Bob',avatar:12});
    const next=await reader.read();assert.match(new TextDecoder().decode(next.value),/"status":"playing"/);
    controller.abort();
  }finally{await close();}
});

test('HTTP integration: retry acknowledgement is idempotent and different payload is conflict',async()=>{
 const {base,close}=await serverFixture();
 try {
  const host=(await post(`${base}/api/rooms`,{mode:'phase-quest',name:'Alice',avatar:1})).data;
  await post(`${base}/api/rooms/${host.code}/join`,{name:'Bob',avatar:2});
  const action={type:'contract-draw',from:'deck',revision:2,actionId:'http-test-retry-action-17'};
  const endpoint=`${base}/api/rooms/${host.code}/actions`;
  const result=await post(endpoint,action,host.token);
  assert.equal(result.status,200);
  const retry=await post(endpoint,action,host.token);
  assert.equal(retry.status,200);
  assert.equal(retry.data.revision,result.data.revision);
  const altered=await post(endpoint,{...action,from:'discard'},host.token);
  assert.equal(altered.status,409);
  const stale=await post(endpoint,{...action,actionId:'http-new-stale-action-29'},host.token);
  assert.equal(stale.status,409);
 }finally{await close();}
});
