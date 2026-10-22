import test from 'node:test';
import assert from 'node:assert/strict';
import {createContractGame,drawContractCard,discardContractCard,buyShanghaiDiscard,layContract,nextContractRound,buildContractDeck} from '../src/engine/contracts.js';
import {createTileGame,tileEndTurn} from '../src/engine/tiles.js';
import {RoomStore,projectGame} from '../src/server/rooms.js';
import {runContractBot} from '../src/engine/contracts.js';

const synthetic=(id,value=4,colour='coral')=>({id,value,colour,wild:false});
const zones=s=>[...s.draw,...s.discard,...s.laid,...s.players.flatMap(p=>p.hand)];

test('Quick Match is a bounded match and uses contract count before penalty score',()=>{
 const s=createContractGame({mode:'phase-quest',playerCount:3,matchLength:'quick'});
 assert.equal(s.targetRounds,6);assert.equal(s.matchLength,'quick');
 s.round=6;s.active=0;s.step='play';
 s.players[0].mission=1;s.players[0].score=45;
 s.players[1].mission=2;s.players[1].score=150;
 s.players[2].mission=2;s.players[2].score=80;
 s.players[0].hand=[synthetic('a',4),synthetic('b',4),synthetic('c',4),synthetic('d',7),synthetic('e',7),synthetic('f',7)];
 const result=layContract(s);
 assert.equal(result.error,undefined);
 assert.equal(result.state.roundWinner,0);
 assert.equal(result.state.players[0].mission,2);
 assert.equal(result.state.winner,0,'zero penalties for completing player give them the win');
 assert.match(result.state.log[0],/wins Quick Match/);
});

test('Quick Match tie yields a genuine draw and cannot move to another deal',()=>{
 const s=createContractGame({mode:'contract-club',playerCount:2,matchLength:'quick'});
 s.round=4;s.active=0;s.step='play';s.players[0].mission=0;s.players[1].mission=1;s.players[1].hand=[];
 s.players[0].score=15;s.players[1].score=15;
 s.players[0].hand=[synthetic('a'),synthetic('b'),synthetic('c')];
 const r=layContract(s);
 assert.equal(r.state.winner,-1);
 assert.match(r.state.log[0],/Quick Match drawn/);
 assert.match(nextContractRound(r.state).error,/Cannot start/);
});

test('Full journey stays backwards compatible; invalid match length is rejected',()=>{
 const a=createContractGame({mode:'phase-quest'});
 assert.equal(a.targetRounds,null);assert.equal(a.matchLength,'full');
 assert.throws(()=>createContractGame({matchLength:'infinite'}),/full or quick/);
});

test('Shanghai buying is one guarded off-turn opportunity with a penalty card',()=>{
 let s=createContractGame({mode:'shanghai-nights',playerCount:3,seed:99});
 const oldLen=s.players[1].hand.length;
 const count=zones(s).length;
 assert.match(buyShanghaiDiscard(s,1).error,/not available/);
 s=drawContractCard(s,'deck').state;
 assert.equal(s.buyWindow,true);
 assert.match(buyShanghaiDiscard(s,0).error,/waiting rival/);
 const bought=buyShanghaiDiscard(s,1);
 assert.equal(bought.error,undefined);
 s=bought.state;
 assert.equal(s.players[1].hand.length,oldLen+2);
 assert.equal(s.active,0);assert.equal(s.step,'play');assert.equal(s.buyWindow,false);
 assert.equal(zones(s).length,count);
 assert.match(buyShanghaiDiscard(s,2).error,/not available/);
 s=discardContractCard(s,0).state;
 assert.equal(s.active,1);
 s=drawContractCard(s,'deck').state;
 assert.equal(s.buyWindow,true);
 assert.match(buyShanghaiDiscard(s,1).error,/waiting rival/);
 assert.equal(buyShanghaiDiscard(s,0).error,undefined,'another rival may purchase on a later discard');
 s=discardContractCard(s,0).state;
 assert.equal(s.buyWindow,false);
 s=drawContractCard(s,'deck').state;
 assert.match(buyShanghaiDiscard(s,1).error,/already bought/,'first buyer is limited to one purchase per deal');
});

test('Shanghai buying never works after taking the discard or in other contract titles',()=>{
 let sh=createContractGame({mode:'shanghai-nights'});
 sh=drawContractCard(sh,'discard').state;
 assert.equal(sh.buyWindow,false);
 assert.match(buyShanghaiDiscard(sh,1).error,/not available/);
 const quest=drawContractCard(createContractGame({mode:'phase-quest'}),'deck').state;
 assert.match(buyShanghaiDiscard(quest,1).error,/only available in Shanghai/);
});

test('server validates buying from the authenticated seat and hides both purchased cards',async()=>{
 const store=new RoomStore();
 const host=await store.create({mode:'shanghai-nights',name:'Host Person',avatar:1,maxPlayers:3,matchLength:'quick'});
 const second=await store.join(host.code,{name:'Second Person',avatar:2});
 const third=await store.join(host.code,{name:'Third Person',avatar:3});
 const before=store.view(host.code,host.token);
 assert.equal(before.game.targetRounds,6);
 assert.equal(before.matchLength,'quick');
 const drawn=await store.move(host.code,host.token,{type:'contract-draw',from:'deck',revision:before.revision});
 assert.equal(drawn.game.canBuy,false);
 const buyPreview=store.view(host.code,second.token);
 assert.equal(buyPreview.game.canBuy,true);
 await assert.rejects(store.move(host.code,host.token,{type:'contract-buy',revision:drawn.revision}),/Only a waiting rival/);
 const prior=store.rooms.get(host.code).game.players[1].hand.length;
 const purchased=await store.move(host.code,second.token,{type:'contract-buy',revision:buyPreview.revision});
 assert.equal(purchased.game.players[0].hand.length,prior+2);
 assert.equal(purchased.game.active,1,'active seat is rotated in this private view');
 assert.equal(store.rooms.get(host.code).game.active,0);
 assert.equal(purchased.game.canBuy,false);
 const thirdView=store.view(host.code,third.token);
 assert.equal(thirdView.game.players[1].hand.length,11);
 assert.equal(thirdView.game.players[2].hand.length,prior+2);
 assert.equal(thirdView.game.players[2].hand.every(card=>card===null),true);
 await assert.rejects(store.move(host.code,third.token,{type:'contract-buy',revision:thirdView.revision}),/not available/);
 const next=await store.move(host.code,host.token,{type:'contract-discard',handIndex:0,revision:thirdView.revision});
 assert.equal(next.game.active,1);
});

test('six-player Tile Royale makes final rack points public only after the game ends',()=>{
 const s=createTileGame({seed:2,playerCount:6});
 assert.equal(s.finalRackPoints,undefined);
 s.draw=[];s.stalledTurns=s.players.length-1;s.active=5;s.playedThisTurn=false;
 const r=tileEndTurn(s,false);
 assert.equal(r.error,undefined);
 assert.ok(r.state.winner!==null);
 assert.equal(r.state.finalRackPoints.length,6);
 assert.ok(r.state.finalRackPoints.every(Number.isInteger));
});


test('Shanghai solo bot may buy a beneficial discarded card off turn',()=>{
  let s=createContractGame({mode:'shanghai-nights',seed:4});
  s.discard=[synthetic('discard',6,'teal')];
  s.players[1].hand=[synthetic('friend',6,'gold')];
  s=drawContractCard(s,'deck').state;
  assert.equal(s.buyWindow,true);
  const after=runContractBot(s);
  assert.equal(after.players[1].hand.length,3);
  assert.equal(after.active,0);
  assert.equal(after.buyWindow,false);
});

test('final Tile Royale points rotate into the private seat order and are hidden before finish',()=>{
 const s=createTileGame({seed:25,playerCount:3});
 s.finalRackPoints=[11,27,8];
 assert.equal(projectGame(s,1).finalRackPoints,null);
 s.winner=2;
 assert.deepEqual(projectGame(s,1).finalRackPoints,[27,11,8]);
 assert.equal(projectGame(s,1).players[1].rack.every(card=>card===null),true);
});
