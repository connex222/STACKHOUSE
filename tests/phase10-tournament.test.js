import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {TOUR_ROTATION,nextTournamentMode,tournamentFormat} from '../src/server/tournament.js';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';

const host={mode:'eight-shift',format:'mixed',name:'Host',avatar:1};
async function friends(store){
 const a=await store.create(host),b=await store.join(a.code,{name:'Friend',avatar:2});return {a,b};
}
async function finishEight(store,a,b,seat=0){
 const room=store.rooms.get(a.code);
 assert.equal(room.mode,'eight-shift');
 const winner=room.game.players[seat];
 winner.hand=[winner.hand[0]];
 room.game.active=seat;
 room.game.activeSuit=winner.hand[0].suit;
 return store.move(a.code,seat===0?a.token:b.token,{type:'eight-play',index:0,suit:winner.hand[0].value===8?'clubs':null,revision:room.revision,actionId:`tourney-win-unique-${room.gameNumber}-${seat}`});
}
async function forceFinish(store,a,b,seat){
 const room=store.rooms.get(a.code);
 // Explicitly complete an engine state to exercise the existing server-authoritative rematch handoff.
 room.game.winner=seat; room.game.active=seat;
 // Since a move that concludes a game normally calls recordMatchResult, finish via a safe profile update.
 return store.move(a.code,seat===0?a.token:b.token,{type:'profile-avatar',avatar:seat===0?3:4,revision:room.revision,actionId:`tourney-final-${room.gameNumber}-${seat}`});
}
async function vote(store,a,b){
 const before=store.view(a.code,a.token);
 const one=await store.move(a.code,a.token,{type:'rematch-request',revision:before.revision,actionId:`tourney-vote-a-${before.revision}`});
 assert.equal(one.mode,before.mode);
 assert.equal(one.rematchVotes[0],true);
 const two=await store.move(a.code,b.token,{type:'rematch-request',revision:one.revision,actionId:`tourney-vote-b-${one.revision}`});
 assert.deepEqual(two.rematchVotes,[false,false]);
 return two;
}
test('mixed mode rotates to new game after mutual rematch and still hides opponent hand',async()=>{
 const store=new RoomStore(),{a,b}=await friends(store);
 assert.equal(store.view(a.code,b.token).series.format,'mixed');
 assert.equal(store.view(a.code,b.token).series.nextMode,'stack-run');
 const done=await finishEight(store,a,b,0);
 assert.deepEqual(done.series.wins,[1,0]);
 assert.equal(done.series.nextMode,'stack-run');
 const next=await vote(store,a,b);
 assert.equal(next.mode,'stack-run');
 assert.equal(next.game.kind,'sequence');
 assert.deepEqual(next.series.wins,[1,0]);
 assert.equal(next.series.history[0].mode,'eight-shift');
 const seat0=store.view(a.code,a.token),seat1=store.view(a.code,b.token);
 assert.equal(seat0.game.players[1].hand.every(x=>x===null),true);
 assert.equal(seat1.game.players[1].hand.every(x=>x===null),true);
 assert.equal(seat1.game.active,seat0.game.active===0?1:0);
});
test('tournament persists game selection and scores across room store reload',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'stack-tour-'));
 try{
  const storageFile=path.join(dir,'sessions.json'),first=new RoomStore({storageFile}),{a,b}=await friends(first);
  await finishEight(first,a,b,0);await vote(first,a,b);
  const second=new RoomStore({storageFile});await second.load();
  const view=second.view(a.code,b.token);
  assert.equal(view.mode,'stack-run');assert.equal(view.series.format,'mixed');
  assert.equal(view.series.wins[0],1);assert.equal(view.series.nextMode,'number-ladder');
  const saved=await (await import('node:fs/promises')).readFile(storageFile,'utf8');
  assert.equal(saved.includes(a.token),false);assert.equal(saved.includes(b.token),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('mixed tournament advances through selected starting game and resets after champion',async()=>{
 const store=new RoomStore(),{a,b}=await friends(store);
 let result=await finishEight(store,a,b,0);assert.equal(result.series.nextMode,'stack-run');
 result=await vote(store,a,b);assert.equal(result.mode,'stack-run');
 // Fast-forward completion of two matches while preserving progression (same mechanism as game result).
 for(let i=0;i<2;i++){
  const room=store.rooms.get(a.code);room.game.winner=0;
  // Rematch request backfills historic matches exactly once.
  const one=await store.move(a.code,a.token,{type:'rematch-request',revision:room.revision,actionId:`tourney-score-${i}-a`});
  assert.equal(one.series.wins[0],i+2);
  result=await store.move(a.code,b.token,{type:'rematch-request',revision:one.revision,actionId:`tourney-score-${i}-b`});
 }
 assert.equal(result.series.number,2);assert.deepEqual(result.series.wins,[0,0]);
 assert.equal(result.mode,'eight-shift');
 assert.equal(result.series.format,'mixed');
});
test('validation rejects arbitrary formats and schedules only supported game IDs',async()=>{
 assert.equal(tournamentFormat(),'single');
 assert.throws(()=>tournamentFormat('freeforall'),/single-game/);
 assert.equal(new Set(TOUR_ROTATION).size,10);
 assert.equal(nextTournamentMode('eight-shift',10),'eight-shift');
 const store=new RoomStore();
 await assert.rejects(store.create({...host,format:'fake'}),/games-night mix/);
});
