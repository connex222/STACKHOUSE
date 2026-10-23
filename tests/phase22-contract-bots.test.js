import test from 'node:test';
import assert from 'node:assert/strict';
import {createContractGame,currentMission,contractHandPotential,chooseContractBotDraw,chooseContractBotDiscard,runContractBot} from '../src/engine/contracts.js';
const c=(id,value,colour='teal',wild=false)=>({id,value,colour,wild});

test('Contract bot skill levels prefer different discards and keep potential wilds for Expert',()=>{
 const mission={groups:[['set',3]]};
 const hand=[c('wild',0,'wild',true),c('six-a',6),c('six-b',6,'gold'),c('orphan',13,'coral')];
 assert.equal(chooseContractBotDiscard(hand,mission,'phase-quest','easy'),0);
 assert.equal(chooseContractBotDiscard(hand,mission,'phase-quest','expert'),3);
 assert.equal(contractHandPotential(hand,mission)>contractHandPotential([hand[1]],mission),true);
});
test('A promising visible discard is used at higher difficulty without deck peeking',()=>{
 const mission={groups:[['set',3]]};
 const hand=[c('one',6),c('two',6,'gold'),c('other',1)];
 const card=c('offer',6,'violet');
 for(const level of ['easy','standard','expert'])assert.equal(chooseContractBotDraw(hand,card,mission,level),'discard');
 const unhelpful=c('bad',13,'violet');
 assert.equal(chooseContractBotDraw(hand,unhelpful,mission,'easy'),'deck');
 assert.equal(chooseContractBotDraw(hand,unhelpful,mission,'expert'),'deck');
});
test('All four contract solo bots act at all levels without mutating input or leaking hidden information',()=>{
 for(const mode of ['phase-quest','contract-club','crown-circuit','shanghai-nights']){
  for(const level of ['easy','standard','expert']){
   const state=createContractGame({mode,seed:92});state.active=1;
   const pristine=structuredClone(state);
   const changed=runContractBot(state,level);
   assert.deepEqual(state,pristine,`${mode} ${level} mutated state`);
   assert.equal(changed.active===0||changed.roundWinner!==null,true,`${mode} ${level} did not finish the turn`);
   assert.equal(changed.players.length,2);
   assert.equal(changed.players[1].hand.length<=11,true);
   const secret=structuredClone(state);secret.players[0].hand=secret.players[0].hand.map((card,i)=>({...card,value:((i+1)%12)+1}));
   assert.deepEqual(runContractBot(secret,level).players[1],changed.players[1],`${mode} ${level} read opponent hidden values`);
  }
 }
});
test('Sound tools are tucked into an accessible settings disclosure and help is reachable before starting games',async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/<details class="audio-settings"/);
 assert.match(src,/<summary aria-label="Audio settings">/);
 assert.match(src,/data-action="test-sound"/);
 assert.match(src,/data-action="test-tone"/);
 assert.match(src,/data-action="rules" data-family="\$\{family.id\}"/);
 assert.match(src,/runContractBot\(ui.game,ui.botDifficulty\)/);
});
