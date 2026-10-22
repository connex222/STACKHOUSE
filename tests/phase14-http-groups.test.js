import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(){
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ROOM_DATA_FILE:'',DATABASE_URL:''},stdio:'pipe'});
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<95;i++){if(child.exitCode!==null)throw Error('Server terminated');try{if((await fetch(base+'/health')).ok)return {base,close:async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');}};}catch{}await delay(25);}
 child.kill();throw Error('Server failed to start');
}
async function api(base,method,path,body,token){
 const response=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
}
for(const mode of ['phase-quest','contract-club','crown-circuit','shanghai-nights']){
 test(`${mode}: six authenticated phones join, take clockwise turns and keep cards secret`,{timeout:16000},async()=>{
  const {base,close}=await fixture();
  try{
   const create=await api(base,'POST','/api/rooms',{mode,maxPlayers:6,name:'Player A',avatar:1});
   assert.equal(create.status,201);
   const players=[create.body],code=create.body.code;
   for(let i=1;i<6;i++){
    const joining=await api(base,'POST',`/api/rooms/${code}/join`,{name:`Player ${i+1}`,avatar:i+1});
    assert.equal(joining.status,200);players.push(joining.body);
   }
   assert.equal(players.at(-1).view.status,'playing');
   for(let i=0;i<6;i++){
    const state=await api(base,'GET',`/api/rooms/${code}/state`,null,players[i].token);
    assert.equal(state.status,200);
    assert.equal(state.body.game.players.length,6);
    assert.equal(state.body.game.players[0].hand.length,10);
    assert.ok(state.body.game.players.slice(1).every(p=>p.hand.every(c=>c===null)));
    assert.equal(state.body.series.wins.length,6);
    const deny=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'contract-draw',from:'deck',revision:state.body.revision},players[(i+1)%6].token);
    assert.equal(deny.status,400);
    const draw=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'contract-draw',from:'deck',revision:state.body.revision,actionId:`phase14-draw-seat-${i}`},players[i].token);
    assert.equal(draw.status,200);
    assert.equal(draw.body.game.players[0].hand.length,11);
    const replay=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'contract-draw',from:'deck',revision:state.body.revision,actionId:`phase14-draw-seat-${i}`},players[i].token);
    assert.equal(replay.status,200);assert.equal(replay.body.revision,draw.body.revision);
    const disc=await api(base,'POST',`/api/rooms/${code}/actions`,{type:'contract-discard',handIndex:0,revision:draw.body.revision},players[i].token);
    assert.equal(disc.status,200);assert.equal(disc.body.game.players[0].hand.length,10);
   }
   const state=await api(base,'GET',`/api/rooms/${code}/state`,null,players[0].token);
   assert.equal(state.body.game.active,0);
  }finally{await close();}
 });
}
