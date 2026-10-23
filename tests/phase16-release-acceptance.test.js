import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const groupModes=['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','shanghai-nights','tile-royale','eight-shift'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));return port;
}
async function start({port,storageFile=''}){
 const processHandle=spawn(process.execPath,['server.js'],{
  cwd:root,env:{...process.env,PORT:String(port),ROOM_DATA_FILE:storageFile,DATABASE_URL:''},stdio:['ignore','pipe','pipe']
 });
 let messages='';for(const source of [processHandle.stdout,processHandle.stderr])source.on('data',data=>messages+=data.toString());
 const base=`http://127.0.0.1:${port}`;
 for(let n=0;n<100;n++){
  if(processHandle.exitCode!==null)throw Error(`Server crashed: ${messages}`);
  try{if((await fetch(base+'/health')).status===200)return {base,processHandle};}catch{}
  await sleep(30);
 }
 processHandle.kill();throw Error(`Timed out waiting for server: ${messages}`);
}
async function stop(service){if(!service)return;const processHandle=service.processHandle;if(processHandle.exitCode!==null)return;processHandle.kill('SIGTERM');await Promise.race([once(processHandle,'exit'),sleep(2000)]);if(processHandle.exitCode===null)processHandle.kill('SIGKILL');}
async function api(base,method,endpoint,body,credential){
 const response=await fetch(base+endpoint,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(credential?{authorization:`Bearer ${credential}`}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
}
async function sixSeats(base,mode){
 const host=await api(base,'POST','/api/rooms',{mode,maxPlayers:6,format:'single',name:'Player 1',avatar:1});
 assert.equal(host.status,201,JSON.stringify(host.body));
 const clients=[host.body];
 for(let i=1;i<6;i++){
  const joined=await api(base,'POST',`/api/rooms/${host.body.code}/join`,{name:`Player ${i+1}`,avatar:i+1});
  assert.equal(joined.status,200,JSON.stringify(joined.body));clients.push(joined.body);
 }
 return {code:host.body.code,clients};
}
function checkPrivateCards(state,mode){
 const game=state.game;
 assert.equal(game.players.length,6,`Incorrect player count for ${mode}`);
 for(let seat=1;seat<6;seat++){
  const player=game.players[seat];
  for(const zone of ['hand','rack'])if(Array.isArray(player[zone])){
   assert.ok(player[zone].every(card=>card===null),`${mode} leaked another player's ${zone}`);
  }
  if(Array.isArray(player.stock))assert.ok(player.stock.slice(0,-1).every(card=>card===null),`${mode} leaked a stockpile`);
 }
}

test('Six-player acceptance: each of eight group games isolates hands and survives reconnects',{timeout:45000},async()=>{
 const port=await freePort();let service;
 try{
  service=await start({port});
  for(const mode of groupModes){
   const {code,clients}=await sixSeats(service.base,mode);
   const invalid=await api(service.base,'POST',`/api/rooms/${code}/join`,{name:'Late Guest',avatar:16});
   assert.notEqual(invalid.status,200,`${mode} allowed a seventh player`);
   for(let seat=0;seat<6;seat++){
    const view=await api(service.base,'GET',`/api/rooms/${code}/state`,null,clients[seat].token);
    assert.equal(view.status,200,`${mode}: seat ${seat} could not reconnect`);
    assert.equal(view.body.seat,seat);assert.equal(view.body.status,'playing');
    assert.equal(view.body.series.wins.length,6);
    checkPrivateCards(view.body,mode);
    assert.ok(!JSON.stringify(view.body).includes(clients[(seat+1)%6].token),`${mode} leaked a player token`);
   }
   const first=await api(service.base,'GET',`/api/rooms/${code}/state`,null,clients[0].token);
   const rev=first.body.revision;
   const trial={type:'profile-avatar',revision:rev,actionId:`phase16-simultaneous-${mode.replaceAll('-','')}`};
   const changes=await Promise.all([
    api(service.base,'POST',`/api/rooms/${code}/actions`,{...trial,avatar:16},clients[0].token),
    api(service.base,'POST',`/api/rooms/${code}/actions`,{...trial,avatar:15},clients[1].token)
   ]);
   assert.deepEqual(changes.map(v=>v.status).sort(),[200,409],`${mode} accepted two stale-revision updates`);
   const winner=changes.find(v=>v.status===200);
   const repetition=await api(service.base,'POST',`/api/rooms/${code}/actions`,{...trial,avatar:changes[0].status===200?16:15},changes[0].status===200?clients[0].token:clients[1].token);
   assert.equal(repetition.status,200,`${mode} did not acknowledge a repeated request`);
   assert.equal(repetition.body.revision,winner.body.revision,`${mode} applied duplicate request twice`);
  }
 }finally{await stop(service);}
});

test('Six-player room restart retains all seats and ignores duplicate moves',{timeout:20000},async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'stackhouse-phase16-'));
 const file=path.join(folder,'table.json');const port=await freePort();let service;
 try{
  service=await start({port,storageFile:file});
  const {code,clients}=await sixSeats(service.base,'phase-quest');
  const before=await api(service.base,'GET',`/api/rooms/${code}/state`,null,clients[0].token);
  const payload={type:'contract-draw',from:'deck',revision:before.body.revision,actionId:'phase16-persistent-action-01'};
  const result=await api(service.base,'POST',`/api/rooms/${code}/actions`,payload,clients[0].token);
  assert.equal(result.status,200);
  await stop(service);service=null;
  service=await start({port,storageFile:file});
  for(let seat=0;seat<6;seat++){
   const restored=await api(service.base,'GET',`/api/rooms/${code}/state`,null,clients[seat].token);
   assert.equal(restored.status,200);
   assert.equal(restored.body.revision,result.body.revision);
   assert.equal(restored.body.seat,seat);
   checkPrivateCards(restored.body,'phase-quest');
  }
  const replay=await api(service.base,'POST',`/api/rooms/${code}/actions`,payload,clients[0].token);
  assert.equal(replay.status,200);
  assert.equal(replay.body.revision,result.body.revision);
 }finally{await stop(service);await rm(folder,{recursive:true,force:true});}
});

test('Two-player-only games reject larger tables while compatible mixed tournaments are supported',{timeout:15000},async()=>{
 const port=await freePort();let service;
 try{
  service=await start({port});
  for(const [mode,format] of [['number-ladder','single'],['low-glow','single'],['low-glow','mixed']]){
   const response=await api(service.base,'POST','/api/rooms',{mode,maxPlayers:6,format,name:'Valid User',avatar:1});
   assert.equal(response.status,400,`${mode}/${format} unexpectedly accepted 6 players`);
  }
 }finally{await stop(service);}
});
