import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modes=['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift'];
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

async function freePort(){
  const socket=createServer();
  socket.listen(0,'127.0.0.1');await once(socket,'listening');
  const port=socket.address().port;await new Promise((resolve,reject)=>socket.close(err=>err?reject(err):resolve()));
  return port;
}
async function startServer(port,snapshot){
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),ROOM_DATA_FILE:snapshot,DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stderr.on('data',chunk=>{logs+=chunk.toString();});
  child.stdout.on('data',chunk=>{logs+=chunk.toString();});
  const base=`http://127.0.0.1:${port}`;
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)throw Error(`Server exited before readiness: ${logs}`);
    try {
      const response=await fetch(`${base}/health`);
      if(response.status===200)return {child,base};
    }catch { /* server still starting */ }
    await sleep(50);
  }
  child.kill('SIGTERM');throw Error(`Server did not start: ${logs}`);
}
async function stopServer(child){
  if(child.exitCode!==null)return;
  child.kill('SIGTERM');
  await Promise.race([once(child,'exit'),sleep(2000).then(()=>{child.kill('SIGKILL');})]);
}
async function api(base,method,route,body,token){
  const response=await fetch(base+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  const payload=await response.json();
  return {status:response.status,payload};
}
async function createPair(base,mode){
  const host=await api(base,'POST','/api/rooms',{mode,name:'Alice',avatar:1});
  assert.equal(host.status,201,JSON.stringify(host.payload));
  const guest=await api(base,'POST',`/api/rooms/${host.payload.code}/join`,{name:'Bob',avatar:2});
  assert.equal(guest.status,200,JSON.stringify(guest.payload));
  return {code:host.payload.code,host:host.payload,guest:guest.payload};
}
async function readSseEvent(reader,match,timeout=3500){
  let pending='';const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const remain=deadline-Date.now();
    const value=await Promise.race([reader.read(),sleep(remain).then(()=>{throw Error('SSE event timed out');})]);
    if(value.done)throw Error('SSE closed unexpectedly');
    pending+=new TextDecoder().decode(value.value);
    for(const block of pending.split('\n\n')){
      const line=block.split('\n').find(part=>part.startsWith('data: '));
      if(line){const event=JSON.parse(line.slice(6));if(match(event))return event;}
    }
  }
  throw Error('SSE event timed out');
}

test('Phase 12: ten-game two-client HTTP/SSE acceptance and file-backed restart', {timeout:45000}, async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'stackhouse-network-'));
  const file=path.join(dir,'rooms.json'),port=await freePort();
  let service,stream;
  try {
    service=await startServer(port,file);
    const status=await api(service.base,'GET','/health');
    assert.equal(status.status,200);
    assert.equal(status.payload.storage,'filesystem-only');
    assert.equal(status.payload.durableStorage,false,'Temporary file must not be advertised as cloud-durable');
    assert.equal(status.payload.databaseConnected,null);
    assert.equal((await fetch(`${service.base}/src/server/rooms.js`)).status,403,'Internal server source must not be served publicly');
    assert.equal((await fetch(`${service.base}/assets/avatars.json`)).status,200);

    let main;
    for(const mode of modes){
      const pair=await createPair(service.base,mode);
      const host=await api(service.base,'GET',`/api/rooms/${pair.code}/state`,null,pair.host.token);
      const guest=await api(service.base,'GET',`/api/rooms/${pair.code}/state`,null,pair.guest.token);
      assert.equal(host.status,200,`Host cannot view ${mode}`);
      assert.equal(guest.status,200,`Guest cannot view ${mode}`);
      assert.equal(host.payload.seat,0);
      assert.equal(guest.payload.seat,1);
      assert.equal(host.payload.game.players[0].name,'Alice');
      assert.equal(host.payload.game.players[1].name,'Bob');
      assert.equal(guest.payload.game.players[0].name,'Bob');
      assert.equal(guest.payload.game.players[1].name,'Alice');
      assert.equal(JSON.stringify(host.payload).includes(pair.guest.token),false,`Guest credential leaked: ${mode}`);
      assert.equal(JSON.stringify(guest.payload).includes(pair.host.token),false,`Host credential leaked: ${mode}`);
      for(const view of [host.payload,guest.payload]){
        const opponent=view.game.players[1];
        for(const field of ['hand','rack'])if(Array.isArray(opponent[field]))assert.ok(opponent[field].every(card=>card===null),`${mode} leaked opponent ${field}`);
        if(Array.isArray(opponent.stock))assert.ok(opponent.stock.slice(0,-1).every(card=>card===null),`${mode} leaked opponent stock`);
      }
      const unauthorised=await api(service.base,'GET',`/api/rooms/${pair.code}/state`);
      assert.equal(unauthorised.status,401);
      if(mode==='phase-quest')main=pair;
    }
    assert.ok(main);
    const initial=await api(service.base,'GET',`/api/rooms/${main.code}/state`,null,main.host.token);
    const action={type:'contract-draw',from:'deck',revision:initial.payload.revision,actionId:'phase12-draw-retry-01'};
    const abort=new AbortController();
    const eventResponse=await fetch(`${service.base}/api/rooms/${main.code}/events`,{headers:{authorization:`Bearer ${main.guest.token}`},signal:abort.signal});
    assert.equal(eventResponse.status,200);
    stream={abort,reader:eventResponse.body.getReader()};
    await readSseEvent(stream.reader,e=>e.revision===initial.payload.revision);
    const moved=await api(service.base,'POST',`/api/rooms/${main.code}/actions`,action,main.host.token);
    assert.equal(moved.status,200,JSON.stringify(moved.payload));
    assert.equal(moved.payload.revision,initial.payload.revision+1);
    const broadcast=await readSseEvent(stream.reader,e=>e.revision===moved.payload.revision);
    assert.equal(broadcast.seat,1);
    assert.ok(broadcast.game.players[1].hand.every(c=>c===null),'SSE leaked private host hand');
    const retried=await api(service.base,'POST',`/api/rooms/${main.code}/actions`,action,main.host.token);
    assert.equal(retried.status,200);
    assert.equal(retried.payload.revision,moved.payload.revision,'Duplicate action was applied twice');
    const stale=await api(service.base,'POST',`/api/rooms/${main.code}/actions`,{...action,actionId:'phase12-stale-retry-02'},main.host.token);
    assert.equal(stale.status,409,'A stale revision should be rejected');
    stream.abort.abort();stream=null;
    await stopServer(service.child);service=null;
    const persisted=JSON.parse(await readFile(file,'utf8'));
    assert.ok(persisted.rooms.length>=10);
    assert.equal(JSON.stringify(persisted).includes(main.host.token),false,'Raw host session token saved');
    service=await startServer(port,file);
    const restored=await api(service.base,'GET',`/api/rooms/${main.code}/state`,null,main.host.token);
    assert.equal(restored.status,200);
    assert.deepEqual(restored.payload.game,moved.payload.game,'Game state changed over server restart');
    assert.equal(restored.payload.revision,moved.payload.revision);
    const guestRestored=await api(service.base,'GET',`/api/rooms/${main.code}/state`,null,main.guest.token);
    assert.equal(guestRestored.status,200);
    assert.equal(guestRestored.payload.seat,1);
    const replay=await api(service.base,'POST',`/api/rooms/${main.code}/actions`,action,main.host.token);
    assert.equal(replay.status,200);
    assert.equal(replay.payload.revision,moved.payload.revision,'A previously confirmed action replayed after restart');
  } finally {
    stream?.abort.abort();
    if(service)await stopServer(service.child);
    await rm(dir,{recursive:true,force:true});
  }
});
