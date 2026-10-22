import test from 'node:test';
import assert from 'node:assert/strict';
import {createSequenceGame,sequenceSources,sequencePileTargets,playSequenceCard,discardSequenceCard,canPassSequenceTurn,passSequenceTurn,canReplenishSequenceHand,replenishSequenceHand,runSequenceBot} from '../src/engine/sequence.js';
import {projectGame,RoomStore} from '../src/server/rooms.js';
const c=(id,value)=>({id,value,wild:false});
const all=s=>[...s.draw,...s.recycled,...s.builds.flat(),...s.players.flatMap(p=>[...p.stock,...p.hand,...p.discards.flat()])];
function blocked({stocks=[5,4,6],build=11}={}){
 const s=createSequenceGame({mode:'malice-duel',seed:8,playerCount:stocks.length});
 s.draw=[];s.recycled=[];s.builds=[Array.from({length:build},(_,i)=>({...c(`b${i}`,i+1),playedValue:i+1})),[],[]];
 s.players.forEach((p,i)=>{p.hand=[];p.stock=Array.from({length:stocks[i]},(_,j)=>c(`p${i}-${j}`,9));p.discards=[[],[],[],[]];});
 // Empty stacks require a 1; stock rank 9 is unplayable.
 return s;
}
test('six-player no-card deadlock can be resolved with a legal forced pass',()=>{
 let s=blocked({stocks:[8,5,4,9,7,6]});
 for(let i=0;i<6;i++){
  assert.equal(canPassSequenceTurn(s),true);
  const previous=structuredClone(s),result=passSequenceTurn(s);
  assert.equal(result.error,undefined);assert.deepEqual(s,previous);
  s=result.state;
  assert.equal(s.passStreak,i+1);
  if(i<5){assert.equal(s.winner,null);assert.equal(s.active,i+1);}else{assert.equal(s.winner,2);assert.equal(s.stalemate,true);}
 }
 assert.match(s.log[0],/fewest stockpile/i);
 assert.ok(passSequenceTurn(s).error);
});
test('equal lowest stock counts yield a draw, without leaking private stock values',()=>{
 let s=blocked({stocks:[4,4,7]});
 for(let i=0;i<3;i++)s=passSequenceTurn(s).state;
 assert.equal(s.winner,-1);
 assert.equal(projectGame(s,1).winner,-1);
 assert.equal(projectGame(s,1).players[0].stock.length,4);
 assert.equal(projectGame(s,1).players[2].stock.every(card=>card===null),true);
});
test('players cannot abuse pass with cards, replenishable deck, or legal discard/stock play',()=>{
 const s=blocked();s.players[0].hand=[c('x',9)];assert.ok(passSequenceTurn(s).error);
 s.players[0].hand=[];s.draw=[c('draw',3)];assert.ok(passSequenceTurn(s).error);
 s.draw=[];s.recycled=[c('recycled',1)];assert.ok(passSequenceTurn(s).error);
 s.recycled=[];s.players[0].stock.push(c('available',1));assert.ok(passSequenceTurn(s).error);
 s.players[0].stock.pop();s.players[0].discards[0].push(c('available2',1));assert.ok(passSequenceTurn(s).error);
});
test('playing a card resets consecutive forced pass counter',()=>{
 let s=blocked({stocks:[4,4,4]});s=passSequenceTurn(s).state;
 assert.equal(s.passStreak,1);
 s.players[1].discards[0].push(c('legal',1));
 s=playSequenceCard(s,'discard',0,1).state;
 assert.equal(s.passStreak,0);
});
test('authenticated online room applies pass on the server, then rotates the private view',async()=>{
 const store=new RoomStore(),seats=[];
 const first=await store.create({name:'Player One',mode:'malice-duel',maxPlayers:3,avatar:1});seats.push(first);
 for(let n=2;n<=3;n++)seats.push(await store.join(first.code,{name:`Player ${n}`,avatar:n}));
 const room=store.rooms.get(first.code),s=blocked({stocks:[6,4,5]});room.game=s;
 let view=store.view(first.code,seats[0].token);
 assert.equal(view.game.canPass,true);
 const result=await store.move(first.code,seats[0].token,{type:'sequence-pass',revision:view.revision});
 assert.equal(result.game.active,1);
 await assert.rejects(store.move(first.code,seats[0].token,{type:'sequence-pass',revision:result.revision}),/opponent|turn/i);
});
test('simulated exhausted games terminate or reach an explicit result (250 6-seat seeds)',()=>{
 let exhausted=0,won=0,drawn=0;
 for(let seed=1;seed<=250;seed++){
  let s=createSequenceGame({mode:'malice-duel',seed,playerCount:6});let steps=0;
  while(s.winner===null&&steps<8000){
   const sources=sequenceSources(s),legal=sources.flatMap(src=>sequencePileTargets(s,src.card).map(target=>({...src,target})));
   let result;
   if(legal.length){const card=legal.find(x=>x.type==='stock')||legal.find(x=>x.type==='discard')||legal[0];result=playSequenceCard(s,card.type,card.index,card.target);}
   else if(s.players[s.active].hand.length)result=discardSequenceCard(s,0,0);
   else if(canReplenishSequenceHand(s)) result=replenishSequenceHand(s);
   else {assert.equal(canPassSequenceTurn(s),true);result=passSequenceTurn(s);exhausted++;}
   assert.ok(result.state,result.error);s=result.state;steps++;
  }
  assert.ok(s.winner!==null,`seed ${seed} did not finish`);
  if(s.winner===-1)drawn++;else won++;
  assert.equal(all(s).length,128,`seed ${seed}: lost a card`);
  assert.equal(new Set(all(s).map(c=>c.id)).size,128,`seed ${seed}: duplicated a card`);
 }
 assert.ok(exhausted>0,'expected to exercise forced passing');
 assert.equal(won+drawn,250);
});
