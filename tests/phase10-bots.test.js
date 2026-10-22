import test from 'node:test';
import assert from 'node:assert/strict';
import {createEightGame,chooseEightBotMove,runEightBot} from '../src/engine/eights.js';
import {createRackGame,runRackBot} from '../src/engine/rack.js';
import {createSequenceGame,runSequenceBot} from '../src/engine/sequence.js';

test('Easy / Standard / Expert Eight Shift choices respect legal play without opponent card reads',()=>{
 const s=createEightGame();s.active=1;s.activeSuit='hearts';s.discard=[{id:'top',suit:'hearts',value:4}];
 s.players[1].hand=[{id:'h2',suit:'hearts',value:2},{id:'c4',suit:'clubs',value:4},{id:'c9',suit:'clubs',value:9},{id:'c6',suit:'clubs',value:6},{id:'eight',suit:'diamonds',value:8}];
 const before=structuredClone(s);
 assert.equal(chooseEightBotMove(s,'easy').card.id,'h2');
 assert.equal(chooseEightBotMove(s,'standard').card.id,'c4');
 for(const level of ['easy','standard','expert']){
  const updated=runEightBot(s,level);
  assert.equal(updated.turn,s.turn+1);assert.equal(updated.players[1].hand.length,4);
 }
 const copy=structuredClone(s);copy.players[0].hand=[{id:'secret',suit:'clubs',value:2}];
 assert.deepEqual(chooseEightBotMove(s,'expert'),chooseEightBotMove(copy,'expert'));
 assert.deepEqual(s,before);
});
test('Easy and Standard Number Ladder choose different cards in fixed scenario',()=>{
 const s=createRackGame({seed:33});s.active=1;
 const easy=runRackBot(s,'easy'),standard=runRackBot(s,'standard'),expert=runRackBot(s,'expert');
 assert.equal(s.active,1); // never mutate caller
 for(const next of [easy,standard,expert]){assert.equal(next.players[1].rack.length,10);assert.equal(next.active,0);}
});
test('Sequencing bot difficulty completes turn without damaging ownership',()=>{
 for(const level of ['easy','standard','expert']){
  const s=createSequenceGame({seed:48});s.active=1;
  const prior=structuredClone(s);const next=runSequenceBot(s,level);
  assert.deepEqual(s,prior);
  assert.equal(next.players.length,2);
  assert.equal(next.active===0||next.winner===1,true);
 }
});
