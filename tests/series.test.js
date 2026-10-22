import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {createSeries,recordMatchResult,beginNextGame,publicSeries} from '../src/server/series.js';

const build=()=>({gameNumber:1,game:{winner:null},series:createSeries()});
test('series awards every finished match once and recognises a three-win champion',()=>{
 const room=build();assert.equal(recordMatchResult(room),false);
 room.game.winner=0;assert.equal(recordMatchResult(room),true);
 assert.equal(recordMatchResult(room),false);assert.deepEqual(room.series.wins,[1,0]);
 beginNextGame(room);room.game={winner:-1};assert.equal(recordMatchResult(room),true);
 assert.equal(room.series.draws,1);
 beginNextGame(room);room.game={winner:0};recordMatchResult(room);
 beginNextGame(room);room.game={winner:1};recordMatchResult(room);
 beginNextGame(room);room.game={winner:0};recordMatchResult(room);
 assert.deepEqual(publicSeries(room),{number:1,target:3,wins:[3,1],draws:1,played:5,champion:0,
  history:[{game:5,winner:0},{game:4,winner:1},{game:3,winner:0},{game:2,winner:-1},{game:1,winner:0}]});
 assert.equal(recordMatchResult(room),false);
 beginNextGame(room);assert.equal(room.series.number,2);assert.deepEqual(room.series.wins,[0,0]);
});
test('series view contains public results only, never cards or access credentials',async()=>{
 const store=new RoomStore();const a=await store.create({mode:'eight-shift',name:'Morgan',avatar:2});
 const b=await store.join(a.code,{name:'Taylor',avatar:3});
 const room=store.rooms.get(a.code);
 // Narrow both original hands to a valid finishing play, using actual server move path.
 const card=room.game.players[0].hand[0];room.game.players[0].hand=[card];
 room.game.activeSuit=card.suit;
 const result=await store.move(a.code,a.token,{type:'eight-play',index:0,suit:card.value===8?'hearts':null,revision:store.view(a.code,a.token).revision});
 assert.equal(result.game.winner,0);
 assert.deepEqual(result.series.wins,[1,0]);
 const seen=store.view(a.code,b.token);
 assert.deepEqual(seen.series.wins,[1,0]);assert.equal(seen.series.history[0].winner,0);
 assert.equal(JSON.stringify(seen.series).includes(card.id),false);
 const vote=await store.move(a.code,a.token,{type:'rematch-request',revision:result.revision});
 assert.deepEqual(vote.series.wins,[1,0]);
 const next=await store.move(a.code,b.token,{type:'rematch-request',revision:vote.revision});
 assert.deepEqual(next.series.wins,[1,0]);assert.equal(next.game.winner,null);
 assert.equal(room.gameNumber,2);
});
test('series history is bounded and legacy records have safe defaults',()=>{
 const room={gameNumber:1,game:{winner:null}};assert.equal(publicSeries(room).number,1);
 for(let i=0;i<21;i++){
   room.game.winner=-1;recordMatchResult(room);beginNextGame(room);room.game={winner:null};
 }
 assert.equal(room.series.history.length,12);
 assert.equal(room.series.played,21);
 assert.equal(room.series.draws,21);
});
