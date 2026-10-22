import test from 'node:test';
import assert from 'node:assert/strict';
import { createContractGame, buildContractDeck, validGroup, findContract, currentMission, drawContractCard, discardContractCard, layContract, nextContractRound, runContractBot, MISSION_SETS } from '../src/engine/contracts.js';
const card=(i,value,colour='teal',wild=false)=>({id:`test${i}`,value,colour,wild});
const allCards=s=>[...s.draw,...s.discard,...s.laid,...s.players.flatMap(p=>p.hand)];
test('seeded contract deck has correct composition and original IDs',()=>{
 assert.deepEqual(buildContractDeck(12),buildContractDeck(12));
 const deck=buildContractDeck(13);
 assert.equal(deck.length,108);assert.equal(new Set(deck.map(c=>c.id)).size,108);
 assert.equal(deck.filter(c=>c.wild).length,12);
});
test('runs require consecutive unique values and may use wilds',()=>{
 assert.equal(validGroup([card(1,2),card(2,4),card(3,0,'wild',true)],'run',3),true);
 assert.equal(validGroup([card(1,2),card(2,2),card(3,0,'wild',true)],'run',3),false);
 assert.equal(validGroup([card(1,1),card(2,12)],'run',2),false);
 assert.equal(validGroup([card(1,10),card(2,11),card(3,12)],'run',3),true);
});
test('set and colour groups validate non-wild cards',()=>{
 assert.equal(validGroup([card(1,6,'coral'),card(2,6,'teal'),card(3,0,'wild',true)],'set',3),true);
 assert.equal(validGroup([card(1,6,'coral'),card(2,7,'teal'),card(3,0,'wild',true)],'set',3),false);
 assert.equal(validGroup([card(1,6,'coral'),card(2,7,'coral'),card(3,0,'wild',true)],'colour',3),true);
 assert.equal(validGroup([card(1,6,'coral'),card(2,7,'teal'),card(3,0,'wild',true)],'colour',3),false);
});
test('compound contracts do not reuse a card across two groups',()=>{
 const mission={groups:[['set',3],['run',3]]};
 const hand=[card(1,4),card(2,4,'coral'),card(3,4,'gold'),card(4,1),card(5,2),card(6,3)];
 const found=findContract(hand,mission);
 assert.deepEqual(found.map(x=>x.length),[3,3]);
 assert.equal(new Set(found.flat().map(c=>c.id)).size,6);
 assert.equal(findContract(hand.slice(0,5),mission),null);
});
test('fresh game is human-first with 10 card hands',()=>{
 const s=createContractGame({mode:'phase-quest',seed:5});
 assert.equal(s.active,0);assert.equal(s.players[0].hand.length,10);
 assert.equal(s.players[1].hand.length,10);assert.equal(s.discard.length,1);
 assert.equal(allCards(s).length,108);
});
test('draw once, lay legal phase, advances only the round winner',()=>{
 const s=createContractGame({mode:'phase-quest',seed:4});
 const result=drawContractCard(s,'deck');
 assert.equal(result.state.step,'play');assert.equal(result.state.players[0].hand.length,11);
 assert.ok(drawContractCard(result.state,'deck').error);
 const hand=[card(1,4),card(2,4,'coral'),card(3,4,'violet'),card(4,6),card(5,7),card(6,8),card(7,2),card(8,3),card(9,9),card(10,10),card(11,11)];
 result.state.players[0].hand=hand;
 const laid=layContract(result.state);
 assert.equal(laid.state.roundWinner,0);assert.equal(laid.state.players[0].mission,1);
 assert.equal(laid.state.players[1].mission,0);
 assert.ok(laid.state.players[1].score>0);
 assert.equal(laid.state.players[0].hand.length,5);
});
test('discard passes turn and the bot can act',()=>{
 const a=drawContractCard(createContractGame({mode:'contract-club',seed:9})).state;
 const b=discardContractCard(a,0).state;
 assert.equal(b.active,1);
 assert.equal(b.players[0].hand.length,10);
 const bot=runContractBot(b);
 assert.ok(bot.active===0||bot.roundWinner===1);
 assert.equal(allCards(bot).length,108);
});
test('next round rotates starting player and preserves progression',()=>{
 const s=createContractGame({mode:'contract-club',seed:8});
 s.roundWinner=0;s.players[0].mission=1;
 const next=nextContractRound(s).state;
 assert.equal(next.round,2);assert.equal(next.active,1);
 assert.equal(next.players[0].mission,1);
 assert.equal(next.players[0].hand.length,10);
 assert.equal(next.roundWinner,null);
});
test('each mission has possible card count within a full drawn hand',()=>{
 for(const entries of Object.values(MISSION_SETS)) {
  for(const mission of entries) {
   assert.ok(mission.groups.reduce((total,g)=>total+g[1],0)<=11);
  }
 }
});
