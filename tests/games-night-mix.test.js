import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {GROUP_ROTATION,nextTournamentMode} from '../src/server/tournament.js';
import {seriesChampion,recordMatchResult,beginNextGame,publicSeries} from '../src/server/series.js';

const options={name:'Host',avatar:1,mode:'eight-shift',format:'mixed',maxPlayers:6,
  gamePool:['eight-shift','stack-run','tile-royale'],roundLimit:5};

test('six-seat Games Night Mix uses host-selected group games and secure views',async()=>{
 const store=new RoomStore();const host=await store.create(options);
 const members=[host];
 for(let i=1;i<6;i++)members.push(await store.join(host.code,{name:`Player ${i+1}`,avatar:i+1}));
 assert.equal(host.view.maxPlayers,6);
 let state=store.view(host.code,members[2].token);
 assert.equal(state.series.roundLimit,5);
 assert.deepEqual(state.series.points,[0,0,0,0,0,0]);
 for(const seat of members){
   const view=store.view(host.code,seat.token);
   assert.ok(view.game.players.slice(1).every(player=>player.hand.every(x=>x===null)));
   assert.equal(JSON.stringify(view).includes('seed'),false);
   assert.equal(JSON.stringify(view).includes('tokenHash'),false);
 }
 for(let round=0;round<5;round++) {
   const raw=store.rooms.get(host.code);
   assert.equal(raw.mode,options.gamePool[round%3]);
   raw.game.winner=round===4?2:round%2;
   assert.equal(recordMatchResult(raw),true);
   assert.equal(recordMatchResult(raw),false,'duplicate report is not counted');
   if(round!==4) {
     beginNextGame(raw);
     raw.game=store.createGame(raw.mode,24,6);
   }
 }
 const final=publicSeries(store.rooms.get(host.code));
 assert.deepEqual(final.points,[15,15,10,5,5,5]);
 assert.equal(final.played,5);
 assert.equal(final.champion,-1);
 assert.deepEqual(final.history.map(row=>row.mode),['stack-run','eight-shift','tile-royale','stack-run','eight-shift']);
});

test('group pool rejects unsupported games, repeated entries and invalid rounds',async()=>{
 const store=new RoomStore();
 for(const gamePool of [[],['low-glow'],['eight-shift','eight-shift'],['unknown']]){
   await assert.rejects(store.create({...options,gamePool}),/game pool|group|selected/i);
 }
 for(const roundLimit of [0,2,13,2.5,'7']){
   await assert.rejects(store.create({...options,roundLimit}),/3–12/);
 }
 assert.equal(GROUP_ROTATION.length,8);
 assert.equal(nextTournamentMode('eight-shift',2,options.gamePool),'tile-royale');
});

test('a tied group Games Night Mix can end with joint champions',()=>{
 const room={format:'mixed',mode:'eight-shift',startMode:'eight-shift',gamePool:['eight-shift'],
   roundLimit:3,gameNumber:3,players:[{},{},{}],game:{winner:-1},
   series:{number:1,wins:[1,1,0],points:[5,5,2],roundLimit:3,draws:0,played:2,history:[],reportedGame:2}};
 recordMatchResult(room);
 assert.equal(seriesChampion(room.series),-1);
 assert.equal(publicSeries(room).champion,-1);
 beginNextGame(room);
 assert.deepEqual(room.series.points,[0,0,0]);
});
