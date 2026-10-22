import test from 'node:test';
import assert from 'node:assert/strict';
import {createTileGame,runTileBot,tileMeld,tileEndTurn} from '../src/engine/tiles.js';
import {createLowGame,runLowBot} from '../src/engine/lowcard.js';

test('tile bot: three difficulty levels respect legal moves and cannot see player rack',()=>{
 for(const level of ['easy','standard','expert'])for(const seed of [1,8,23,89,103]){
  const state=createTileGame({seed});state.active=1;
  const view1=runTileBot(state,level);
  assert.equal(state.active,1,'Bot must not mutate caller state');
  assert.equal(view1.players.length,2);
  assert.ok(view1.winner===null||view1.winner===1);
  const swapped=structuredClone(state);
  swapped.players[0].rack.reverse();
  const view2=runTileBot(swapped,level);
  assert.deepEqual(view2.players[1],view1.players[1],`Bot ${level} cannot see opponent rack`);
  assert.deepEqual(view2.groups,view1.groups);
  assert.ok(view1.groups.every(group=>tileMeld(group.tiles)));
 }
});
test('low bot: Easy, Standard and Expert take legal turns without reading hidden cards',()=>{
 for(const level of ['easy','standard','expert'])for(const seed of [2,6,31,75,110]){
  const state=createLowGame({seed});state.active=1;
  const result=runLowBot(state,level);
  assert.equal(result.active,0);
  assert.equal(result.step,'draw');
  const changed=structuredClone(state);changed.players[1].grid.forEach(card=>{if(!card.revealed)card.value=99;});
  const result2=runLowBot(changed,level);
  const visible=result.players[1].grid.map((card,i)=>card.revealed||card.cleared?i:-1).filter(i=>i!==-1);
  const visible2=result2.players[1].grid.map((card,i)=>card.revealed||card.cleared?i:-1).filter(i=>i!==-1);
  assert.deepEqual(visible2,visible,`Bot ${level} must not peek at hidden grid values`);
 }
});
test('Tile Royale drawn-out tie is awarded fairly as a draw',()=>{
 const state=createTileGame({seed:4,playerCount:3});
 state.draw=[];state.stalledTurns=2;state.active=0;
 state.players.forEach(p=>p.rack=[{id:'final',value:5,colour:'gold',wild:false}]);
 const result=tileEndTurn(state,false);
 assert.equal(result.state.winner,-1);
});

test('Eight Shift: an exhausted deck cannot trap a group forever',async()=>{
 const {createEightGame,eightPass}=await import('../src/engine/eights.js');
 let state=createEightGame({seed:9,playerCount:3});
 state.draw=[];state.discard=[{id:'top',value:2,suit:'hearts'}];
 for(let i=0;i<3;i++)state.players[i].hand=[{id:`blocked${i}`,value:5,suit:'clubs'}];
 for(let i=0;i<3;i++){
  const result=eightPass(state);
  assert.ok(result.state);state=result.state;
 }
 assert.equal(state.winner,-1,'Equal hand points should be a draw');
 assert.match(state.log.join(' '),/tied hand points/);
});

test('Eight Shift: lowest remaining hand points win a fully blocked match',async()=>{
 const {createEightGame,eightPass}=await import('../src/engine/eights.js');
 let state=createEightGame({seed:9,playerCount:3});
 state.draw=[];state.discard=[{id:'top',value:2,suit:'hearts'}];
 for(let i=0;i<3;i++)state.players[i].hand=[{id:`blocked${i}`,value:i+3,suit:'clubs'}];
 for(let i=0;i<3;i++)state=eightPass(state).state;
 assert.equal(state.winner,0);
});
