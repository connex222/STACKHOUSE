import test from 'node:test';
import assert from 'node:assert/strict';
import {createRackGame,rackDraw,rackReplace,rackDiscard,isSortedRack,runRackBot} from '../src/engine/rack.js';

test('Number Ladder deals distinct cards to two racks, deck and public discard',()=>{
 const s=createRackGame({seed:21});
 const all=[...s.draw,...s.discard,...s.players.flatMap(p=>p.rack)];
 assert.equal(all.length,60);assert.equal(new Set(all.map(c=>c.id)).size,60);
 assert.equal(s.players[0].rack.length,10);
});
test('Number Ladder must draw then replace or discard, advancing the active seat',()=>{
 const s=createRackGame({seed:11});
 assert.match(rackReplace(s,0).error,/Draw/);
 const a=rackDraw(s,'deck');assert.equal(a.state.step,'replace');
 assert.equal(a.state.players[0].rack.length,10);
 assert.match(rackDraw(a.state,'deck').error,/Finish/);
 const replaced=rackReplace(a.state,5);
 assert.equal(replaced.state.active,1);
 assert.equal(replaced.state.discard.length,2);
 assert.deepEqual(s.players[0].rack,createRackGame({seed:11}).players[0].rack);
 const bot=runRackBot(replaced.state);assert.equal(bot.active,0);
});
test('Number Ladder rejects invalid index and empty discard, checks exact ascending order',()=>{
 const s=createRackGame({seed:32});
 assert.equal(isSortedRack(Array.from({length:10},(_,i)=>({value:i+10}))),true);
 assert.equal(isSortedRack(Array.from({length:10},(_,i)=>({value:10-i}))),false);
 const a=rackDraw(s,'discard').state;
 assert.equal(a.discard.length,0);
 assert.match(rackReplace(a,-1).error,/ten slots/);
 assert.equal(rackDiscard(a).state.active,1);
});
test('Number Ladder bot advances during long deterministic play',()=>{
 let s=createRackGame({seed:235});let moves=0;
 while(s.winner===null&&moves++<1000){
  if(s.active===1){s=runRackBot(s);continue;}
  let draw=rackDraw(s,'deck');if(draw.error)draw=rackDraw(s,'discard');
  if(draw.error)break;
  s=rackReplace(draw.state,moves%10).state;
 }
 assert.ok(moves>4);assert.ok([null,0,1].includes(s.winner));
});
