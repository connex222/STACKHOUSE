import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequenceGame, sequenceSources, sequencePileTargets, playSequenceCard, discardSequenceCard, runSequenceBot } from '../src/engine/sequence.js';
import { createContractGame, findContract, currentMission, drawContractCard, layContract, discardContractCard, nextContractRound, runContractBot } from '../src/engine/contracts.js';
const inventory = s => s.kind==='sequence'
  ? [...s.draw,...s.recycled,...s.builds.flat(),...s.players.flatMap(p=>[...p.stock,...p.hand,...p.discards.flat()])]
  : [...s.draw,...s.discard,...s.laid,...s.players.flatMap(p=>p.hand)];
function assertUniqueCards(state) {
 const ids=inventory(state).map(c=>c.id);
 assert.equal(new Set(ids).size,ids.length,'Physical card appeared twice in one game state');
}
for(const mode of ['stack-run','malice-duel']) {
 test(`${mode}: 20 seeded full matches finish without losing cards or stalling`,()=>{
  for(let seed=1;seed<=20;seed++) {
   let state=createSequenceGame({mode,seed});
   for(let turn=0;turn<350&&state.winner===null;turn++) {
    assertUniqueCards(state);
    if(state.active===1){state=runSequenceBot(state);continue;}
    for(let i=0;i<65;i++){
     const legal=sequenceSources(state).flatMap(source=>sequencePileTargets(state,source.card).map(dest=>({source,dest})));
     if(!legal.length)break;
     const move=legal.find(x=>x.source.type==='stock')||legal.find(x=>x.source.type==='discard')||legal[0];
     state=playSequenceCard(state,move.source.type,move.source.index,move.dest).state;
     if(state.winner!==null)break;
    }
    if(state.winner!==null)break;
    assert.ok(state.players[0].hand.length,'Human should still have a legal end-turn discard');
    state=discardSequenceCard(state,0,0).state;
   }
   assert.notEqual(state.winner,null,`Seed ${seed} did not finish`);
   assertUniqueCards(state);
  }
 });
}
for(const mode of ['phase-quest','contract-club']){
 test(`${mode}: 20 seeded full matches finish with correct card inventory`,()=>{
  for(let seed=1;seed<=20;seed++) {
   let state=createContractGame({mode,seed});
   for(let turn=0;turn<1200;turn++){
    assertUniqueCards(state);
    if(state.winner!==null)break;
    if(state.roundWinner!==null){state=nextContractRound(state).state;continue;}
    if(state.active===1){state=runContractBot(state);continue;}
    if(state.step==='draw'){
     const top=state.discard.at(-1);
     const source=top&&findContract([...state.players[0].hand,top],currentMission(state))?'discard':'deck';
     const result=drawContractCard(state,source);
     assert.ok(!result.error,`Seed ${seed}: ${result.error}`);
     state=result.state;
    }
    const completed=layContract(state);
    if(!completed.error){state=completed.state;continue;}
    const index=state.players[0].hand.findIndex(c=>!c.wild);
    state=discardContractCard(state,index>=0?index:0).state;
   }
   assert.notEqual(state.winner,null,`Seed ${seed} did not finish`);
   assertUniqueCards(state);
  }
 });
}
