import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequenceGame, sequenceSources, sequencePileTargets, playSequenceCard, discardSequenceCard, runSequenceBot } from '../src/engine/sequence.js';
const card=(id,value,wild=false)=>({id,value,wild});
const allCards=(s)=>[
 ...s.draw,...s.recycled,...s.builds.flat(),...s.players.flatMap(p=>[...p.stock,...p.hand,...p.discards.flat()])
];
test('seeded shuffle is reproducible, player stock and hand setup is correct',()=>{
 const a=createSequenceGame({seed:11}),b=createSequenceGame({seed:11});
 assert.deepEqual(a,b);assert.equal(a.players[0].stock.length,12);assert.equal(a.players[1].stock.length,12);
 assert.equal(a.players[0].hand.length,5);assert.equal(a.active,0);assert.equal(a.builds.length,4);
});
test('a new round retains every unique card',()=>{
 for(const mode of ['stack-run','malice-duel']){
  const state=createSequenceGame({seed:123,mode});
  const cards=allCards(state);
  assert.equal(cards.length,new Set(cards.map(x=>x.id)).size);
  assert.equal(cards.length,mode==='stack-run'?132:128);
 }
});
test('valid building move advances, invalid move leaves state untouched',()=>{
 const s=createSequenceGame();s.players[0].stock=[card('test1',1)];
 const invalid=playSequenceCard(s,'stock',0,100);
 assert.ok(invalid.error);assert.equal(s.players[0].stock.length,1);
 const good=playSequenceCard(s,'stock',0,0);
 assert.equal(good.state.winner,0);assert.equal(good.state.builds[0][0].playedValue,1);
 assert.equal(s.winner,null);
});
test('wild can represent the next value, a stack clears at 12',()=>{
 const s=createSequenceGame();
 s.players[0].hand=[card('w',0,true),card('f',5)];
 s.builds[0]=Array.from({length:11},(_,i)=>({...card(`x${i}`,i+1),playedValue:i+1}));
 assert.deepEqual(sequencePileTargets(s,s.players[0].hand[0]),[0,1,2,3]);
 const done=playSequenceCard(s,'hand',0,0);
 assert.equal(done.state.builds[0].length,0);
 assert.equal(done.state.recycled.length,12);
 assert.ok(done.state.log.some(s=>s.includes('completed')));
});
test('discard ends the turn and draws for the opponent',()=>{
 const s=createSequenceGame({seed:6});
 const result=discardSequenceCard(s,0,2);
 assert.equal(result.state.active,1);assert.equal(result.state.players[0].discards[2].length,1);
 assert.equal(result.state.players[1].hand.length,5);
 assert.equal(result.state.players[0].hand.length,4);
 assert.equal(s.players[0].discards[2].length,0);
});
test('illegal discard and illegal sequence source are rejected',()=>{
 const s=createSequenceGame();
 assert.ok(discardSequenceCard(s,100,0).error);
 assert.ok(discardSequenceCard(s,0,5).error);
 assert.ok(playSequenceCard(s,'discard',10,0).error);
 assert.ok(playSequenceCard(s,'unrecognised',0,0).error);
});
test('bot finishes its turn without discarding illegal card or getting stuck',()=>{
 const initial=discardSequenceCard(createSequenceGame({seed:23}),0,0).state;
 const result=runSequenceBot(initial);
 assert.equal(result.active,0);
 assert.equal(result.players[1].discards.flat().length,1);
 assert.equal(allCards(result).length,132);
 assert.equal(allCards(result).length,new Set(allCards(result).map(c=>c.id)).size);
});
test('displayable sources include available discard-top cards',()=>{
 const s=createSequenceGame();
 s.players[0].discards[2]=[card('lo',4),card('top',7)];
 const fromPile=sequenceSources(s).find(x=>x.type==='discard');
 assert.equal(fromPile.index,2);assert.equal(fromPile.card.id,'top');
});
