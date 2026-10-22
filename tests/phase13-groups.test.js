import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createEightGame,eightDraw,eightPass} from '../src/engine/eights.js';
import {createSequenceGame,discardSequenceCard} from '../src/engine/sequence.js';
import {createTileGame,tileEndTurn} from '../src/engine/tiles.js';

const groups=['eight-shift','stack-run','malice-duel','tile-royale'];
const player=i=>({name:`Player ${i+1}`,avatar:i+1});
async function group(mode,count,capacity=count){
 const store=new RoomStore();
 const host=await store.create({...player(0),mode,maxPlayers:capacity});
 const seats=[host];
 for(let i=1;i<count;i++)seats.push(await store.join(host.code,player(i)));
 return {store,seats,code:host.code};
}

for(const mode of groups)for(const count of [3,4,6]){
 test(`${mode}: ${count} players get private hands and rotate fairly`,async()=>{
  const {store,seats,code}=await group(mode,count);
  assert.equal(store.view(code,seats[0].token).status,'playing');
  const original=store.rooms.get(code).game;
  assert.equal(original.players.length,count);
  assert.equal(store.view(code,seats[0].token).series.wins.length,count);
  const firstPlayers=store.view(code,seats[0].token).game.players;
  for(let i=0;i<count;i++){
   const v=store.view(code,seats[i].token);
   assert.equal(v.game.players.length,count);
   assert.equal(v.game.players[0].name,original.players[i].name);
   assert.equal(v.game.active,i===0?0:1); // viewpoint-specific seat remapping
   assert.deepEqual(v.game.players.slice(1).map(p=>p.name),original.players.filter((_,j)=>j!==i).map(p=>p.name));
   for(const p of v.game.players.slice(1)){
    const hidden=mode==='tile-royale'?p.rack:mode==='eight-shift'?p.hand:p.hand;
    assert.ok(hidden.every(card=>card===null),'Opponent hand must be redacted.');
   }
   assert.equal(JSON.stringify(v).includes('tokenHash'),false);
  }
  if(mode==='eight-shift'){
   // Even when a card cannot be played, a draw and pass passes exactly one seat.
   for(let i=0;i<count;i++){
    const current=store.rooms.get(code),active=current.game.active;
    if(active!==i)throw Error('Turn did not rotate clockwise.');
    const originalS=current.game;
    // Deliberately give active player's hand cards which cannot legally play, forcing a draw/pass.
    const draw=await store.move(code,seats[i].token,{type:'eight-draw',revision:current.revision});
    assert.equal(draw.game.players[0].name,originalS.players[i].name);
    const pass=await store.move(code,seats[i].token,{type:'eight-pass',revision:draw.revision});
    assert.equal(store.rooms.get(code).game.active,(i+1)%count);
    assert.equal(pass.game.active,[i,...Array.from({length:count},(_,j)=>j).filter(j=>j!==i)].indexOf((i+1)%count)); // relative next seat
   }
  }else if(mode==='stack-run'||mode==='malice-duel'){
   for(let i=0;i<count;i++){
    const v=store.view(code,seats[i].token);
    const next=await store.move(code,seats[i].token,{type:'sequence-discard',handIndex:0,discardIndex:0,revision:v.revision});
    assert.equal(store.rooms.get(code).game.active,(i+1)%count);
    assert.equal(next.game.active,[i,...Array.from({length:count},(_,j)=>j).filter(j=>j!==i)].indexOf((i+1)%count));
   }
  }else{
   for(let i=0;i<count;i++){
    const v=store.view(code,seats[i].token);
    const draw=await store.move(code,seats[i].token,{type:'tile-end',draw:true,revision:v.revision});
    assert.equal(store.rooms.get(code).game.active,(i+1)%count);
    assert.equal(draw.game.active,[i,...Array.from({length:count},(_,j)=>j).filter(j=>j!==i)].indexOf((i+1)%count));
   }
  }
  assert.equal(firstPlayers[0].name,'Player 1');
 });
}

test('group lobby: host starts early after third player; guests cannot start; extra joins denied',async()=>{
 const {store,seats,code}=await group('eight-shift',3,6);
 assert.equal(store.view(code,seats[0].token).status,'waiting');
 await assert.rejects(store.start(code,seats[1].token),/Only the host/);
 await assert.rejects(store.move(code,seats[1].token,{type:'eight-draw',revision:3}),/Wait for/);
 const started=await store.start(code,seats[0].token);
 assert.equal(started.status,'playing');assert.equal(started.game.players.length,3);
 assert.equal(started.series.wins.length,3);
 assert.deepEqual(started.rematchVotes,[false,false,false]);
 await assert.rejects(store.join(code,player(3)),/not accepting/);
});

test('group room: rematch requires every seat, remains private and preserves series points',async()=>{
 const {store,seats,code}=await group('eight-shift',4);
 const room=store.rooms.get(code);
 room.game.players[2].hand=[room.game.players[2].hand[0]];
 room.game.active=2;
 room.game.activeSuit=room.game.players[2].hand[0].suit;
 const last=room.game.players[2].hand[0];
 let v=await store.move(code,seats[2].token,{type:'eight-play',index:0,suit:last.value===8?'hearts':null,revision:room.revision});
 assert.equal(v.game.winner,0);assert.deepEqual(v.series.wins,[0,0,1,0]);
 for(let i=0;i<3;i++){
  v=await store.move(code,seats[i].token,{type:'rematch-request',revision:store.view(code,seats[i].token).revision});
  assert.equal(v.game.winner===null,false);
 }
 v=await store.move(code,seats[3].token,{type:'rematch-request',revision:v.revision});
 assert.equal(v.game.winner,null);assert.deepEqual(v.series.wins,[0,0,1,0]);
 assert.equal(v.game.players.length,4);
 assert.deepEqual(v.rematchVotes,[false,false,false,false]);
});

test('group capacity and tournament constraints cannot be bypassed by HTTP payloads',async()=>{
 const store=new RoomStore();
 for(const n of [-1,1,2.5,7,100,'4',null])await assert.rejects(store.create({...player(0),mode:'eight-shift',maxPlayers:n}),/between 2 and 6/);
 for(const mode of ['phase-quest','low-glow','number-ladder','contract-club','crown-circuit','shanghai-nights']){
  await assert.rejects(store.create({...player(0),mode,maxPlayers:3}),/Group tables support/);
 }
 await assert.rejects(store.create({...player(0),mode:'eight-shift',maxPlayers:3,format:'mixed'}),/Group tables support/);
});

test('3-player rooms recover all private seats and ongoing series from durable snapshots',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'stackhouse-group-'));
 try{
  const file=path.join(dir,'rooms.json'),first=new RoomStore({storageFile:file});
  const host=await first.create({...player(0),mode:'stack-run',maxPlayers:5});
  const seats=[host,await first.join(host.code,player(1)),await first.join(host.code,player(2))];
  const waiting=new RoomStore({storageFile:file});await waiting.load();
  assert.equal(waiting.view(host.code,seats[2].token).status,'waiting');
  await waiting.start(host.code,host.token);
  const moved=await waiting.move(host.code,host.token,{type:'sequence-discard',handIndex:0,discardIndex:0,revision:waiting.view(host.code,host.token).revision});
  const rebooted=new RoomStore({storageFile:file});await rebooted.load();
  assert.deepEqual(rebooted.view(host.code,host.token),moved);
  assert.equal(rebooted.view(host.code,seats[2].token).game.active,2); // physical seat 1 is taking a turn
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('legacy two-player engines and solo bots keep their default two seats',()=>{
 for(const factory of [createEightGame,createSequenceGame,createTileGame])assert.equal(factory().players.length,2);
 const initial=createEightGame({playerCount:6});
 const draw=eightDraw(initial);assert.equal(draw.state.players.length,6);
 const pass=eightPass(draw.state);assert.equal(pass.state.active,1);
 const seq=createSequenceGame({playerCount:6});assert.equal(discardSequenceCard(seq,0,0).state.active,1);
 const tile=createTileGame({playerCount:6});assert.equal(tileEndTurn(tile,true).state.active,1);
});
