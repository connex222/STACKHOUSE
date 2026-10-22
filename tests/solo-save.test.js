import test from 'node:test';
import assert from 'node:assert/strict';
import {SOLO_SAVE_KEY, encodeSoloSave, decodeSoloSave} from '../src/solo-save.js';
import {createSequenceGame} from '../src/engine/sequence.js';
import {createLowGame} from '../src/engine/lowcard.js';

test('solo saving: restores state, round and player order without changing the game',()=>{
 const game=createSequenceGame({mode:'stack-run',seed:123});
 const before=structuredClone(game),orders={sequence:['card:1','card:2']};
 const json=encodeSoloSave({mode:'stack-run',game,handOrders:orders});
 const result=decodeSoloSave(json);
 assert.equal(SOLO_SAVE_KEY,'stackhouse.solo.v1');
 assert.deepEqual(result,{mode:'stack-run',game:before,handOrders:orders});
 assert.deepEqual(game,before);
});
test('solo saving: supports fixed-grid games without imposing hand order',()=>{
 const game=createLowGame({mode:'low-glow',seed:3});
 assert.deepEqual(decodeSoloSave(encodeSoloSave({mode:'low-glow',game})),{mode:'low-glow',game,handOrders:{}});
});
test('solo saving: fails closed on invalid, old or damaged records',()=>{
 const game=createSequenceGame({mode:'stack-run',seed:4});
 const baseline=JSON.parse(encodeSoloSave({mode:'stack-run',game}));
 for(const bad of [null,'','{bad','x'.repeat(250001),JSON.stringify({...baseline,version:3}),
 JSON.stringify({...baseline,mode:'phase-quest'}),JSON.stringify({...baseline,handOrders:{sequence:Array(101).fill('x')}}),
 JSON.stringify({...baseline,game:{...game,players:[game.players[0]]}})]) {
  // A malformed hand-order list is sanitised rather than rejecting a valid match.
  if(typeof bad==='string'&&bad.includes('"sequence"')&&bad.includes('"x"')){
    assert.deepEqual(decodeSoloSave(bad)?.handOrders,{});
  }else assert.equal(decodeSoloSave(bad),null);
 }
 assert.throws(()=>encodeSoloSave({mode:'phase-quest',game}),/invalid solo/);
});
