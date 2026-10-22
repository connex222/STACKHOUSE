import test from 'node:test';import assert from 'node:assert/strict';
import {decodeSoloResults,registerSoloResult,soloTotals} from '../src/solo-records.js';
import {encodeSoloSave,decodeSoloSave} from '../src/solo-save.js';
import {createEightGame} from '../src/engine/eights.js';
test('record wins, losses and draws once per unique match ID',()=>{
 let raw='';
 for(const [id,mode,winner] of [['match-00000001','eight-shift',0],['match-00000002','eight-shift',1],['match-00000003','stack-run',-1]]){
  const r=registerSoloResult(raw,{id,mode,winner});assert.equal(r.changed,true);raw=JSON.stringify(r.value);
 }
 assert.deepEqual(soloTotals(decodeSoloResults(raw)),{wins:1,losses:1,draws:1});
 const duplicate=registerSoloResult(raw,{id:'match-00000001',mode:'stack-run',winner:0});
 assert.equal(duplicate.changed,false);assert.equal(duplicate.value.games['stack-run'].draws,1);
});
test('reject damaged solo statistics and unsafe IDs',()=>{
 assert.deepEqual(decodeSoloResults('{bad'),{games:{},recent:[]});
 assert.equal(registerSoloResult('',{id:'a',mode:'eight-shift',winner:0}).changed,false);
 assert.equal(registerSoloResult('',{id:'a'.repeat(15),mode:'unknown',winner:0}).changed,false);
 assert.equal(registerSoloResult('',{id:'a'.repeat(15),mode:'stack-run',winner:2}).changed,false);
});
test('solo save remains compatible with old snapshot and optional match ID',()=>{
 const game=createEightGame({seed:4});const old=decodeSoloSave(encodeSoloSave({mode:'eight-shift',game}));
 assert.equal(Object.hasOwn(old,'matchId'),false);
 const newSave=decodeSoloSave(encodeSoloSave({mode:'eight-shift',game,matchId:'solo-123456789012'}));
 assert.equal(newSave.matchId,'solo-123456789012');
});
