import test from 'node:test';import assert from 'node:assert/strict';
import {createEightGame,chooseEightBotMove,runEightBot} from '../src/engine/eights.js';

test('Eight Shift bot prefers a natural card keeping a strong follow-up suit',()=>{
 const s=createEightGame();
 s.active=1;s.activeSuit='hearts';s.discard=[{id:'top',suit:'hearts',value:4}];
 s.players[1].hand=[{id:'h2',suit:'hearts',value:2},{id:'c4',suit:'clubs',value:4},{id:'c9',suit:'clubs',value:9},{id:'c6',suit:'clubs',value:6},{id:'eight',suit:'diamonds',value:8}];
 const prior=structuredClone(s);
 const choice=chooseEightBotMove(s);assert.equal(choice.card.id,'c4');
 assert.deepEqual(s,prior,'Looking ahead must not mutate game state');
 const move=runEightBot(s);assert.equal(move.discard.at(-1).id,'c4');assert.equal(move.activeSuit,'clubs');
});
test('Eight Shift bot chooses an owned suit for an eight and does not inspect opponent hand',()=>{
 const s=createEightGame();s.active=1;s.activeSuit='spades';s.discard=[{id:'top',suit:'spades',value:5}];
 s.players[1].hand=[{id:'eight',suit:'diamonds',value:8},{id:'c10',suit:'clubs',value:10},{id:'c11',suit:'clubs',value:11},{id:'heart',suit:'hearts',value:3}];
 const choice=chooseEightBotMove(s);assert.equal(choice.card.id,'eight');assert.equal(choice.suit,'clubs');
 s.players[0].hand=[{id:'something-private',suit:'clubs',value:5}];
 assert.equal(chooseEightBotMove(s).suit,'clubs');
});
