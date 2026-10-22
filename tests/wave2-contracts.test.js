import test from 'node:test';
import assert from 'node:assert/strict';
import {createContractGame,buildContractDeck,MISSION_SETS,validGroup} from '../src/engine/contracts.js';

test('Crown Circuit includes five suits, 11 stages, 3–13 values and rotating wild ranks',()=>{
 assert.equal(MISSION_SETS['crown-circuit'].length,11);
 for(const round of [1,4,11]){
  const deck=buildContractDeck(round,'crown-circuit',round);
  assert.equal(deck.length,116);
  assert.equal(new Set(deck.filter(x=>x.colour!=='wild').map(x=>x.colour)).size,5);
  assert.equal(deck.filter(x=>x.value===round+2&&x.wild).length,10);
  assert.equal(deck.filter(x=>x.value===round+2&& !x.wild).length,0);
  assert.equal(deck.filter(x=>x.value===0&&x.wild).length,6);
 }
 const s=createContractGame({mode:'crown-circuit',seed:50});
 assert.equal(s.mode,'crown-circuit');assert.equal(s.players[0].hand.length,10);
});
test('Shanghai Nights is a seven-stage contract mode',()=>{
 const game=createContractGame({mode:'shanghai-nights'});
 assert.equal(game.players.length,2);
 assert.equal(MISSION_SETS['shanghai-nights'].length,7);
 assert.equal(game.players[1].hand.length,10);
});
test('Runs of 13 are recognised, duplicates are rejected',()=>{
 const hand=[11,12,13].map((value,i)=>({value,colour:'gold',id:i,wild:false}));
 assert.equal(validGroup(hand,'run',3),true);
 assert.equal(validGroup([hand[0],hand[0],hand[2]],'run',3),false);
});
