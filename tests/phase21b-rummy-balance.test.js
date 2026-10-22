import test from 'node:test';
import assert from 'node:assert/strict';
import {createContractGame,drawContractCard,discardContractCard,layContract,layOffContract,canLayOffContract,nextContractRound,crownCardPenalty,contractCardPenalty,runContractBot} from '../src/engine/contracts.js';
import {createTileGame,tileEndTurn} from '../src/engine/tiles.js';
import {RoomStore,projectGame} from '../src/server/rooms.js';
const card=(id,value,colour='teal',wild=false)=>({id,value,colour,wild});
function club(){const s=createContractGame({mode:'contract-club',seed:27,playerCount:3});s.active=0;s.step='play';return s;}
test('Contract Club: laying a contract exposes a public meld but does not end the deal',()=>{
 const s=club();s.players[0].hand=[card('a',5),card('b',5,'gold'),card('c',5,'coral'),card('d',9)];
 const after=layContract(s);
 assert.ifError(after.error);
 assert.equal(after.state.roundWinner,null);
 assert.equal(after.state.active,0);
 assert.equal(after.state.step,'play');
 assert.equal(after.state.players[0].mission,1);
 assert.equal(after.state.players[0].laidDown,true);
 assert.deepEqual(after.state.players.slice(1).map(p=>p.score),[0,0]);
 assert.deepEqual(after.state.melds.map(m=>({kind:m.kind,owner:m.owner,len:m.cards.length})),[{kind:'set',owner:0,len:3}]);
 assert.equal(after.state.laid.length,3);
 assert.equal(after.state.players[0].hand.length,1);
 assert.equal(s.players[0].laidDown,false,'actions must not mutate input');
});
test('Contract Club: player can extend another player’s group only after laying their own contract',()=>{
 let s=club();s.melds=[{owner:1,kind:'run',cards:[card('x',3,'teal'),card('y',4,'gold'),card('z',5,'coral')]}];
 s.players[0].hand=[card('a',8),card('b',8),card('c',8),card('d',6)];
 assert.match(layOffContract(s,3,0).error,/Lay your own contract/);
 s=layContract(s).state;
 assert.equal(canLayOffContract(s.players[0].hand[0],s.melds[0]),true);
 const result=layOffContract(s,0,0);
 assert.ifError(result.error);
 assert.equal(result.state.roundWinner,0,'the last card goes out');
 assert.equal(result.state.melds[0].cards.length,4);
 assert.equal(result.state.laid.length,4,'table flat pile contains each played card exactly once');
 assert.equal(result.state.players[1].score>0,true);
 assert.equal(result.state.players[0].score,0);
});
test('Contract Club: illegal melds, invalid indices and other modes cannot be laid off',()=>{
 let s=club();s.players[0].laidDown=true;s.players[0].hand=[card('a',3)];
 s.melds=[{owner:1,kind:'set',cards:[card('x',9),card('y',9),card('z',9)]}];
 assert.match(layOffContract(s,0,0).error,/does not extend/);
 for(const [hi,mi] of [[-1,0],[0,1],[1,0],[0,1.3]])assert.ok(layOffContract(s,hi,mi).error);
 const other=createContractGame({mode:'phase-quest'});assert.match(layOffContract(other,0,0).error,/only available/);
});
test('Contract Club: laying early and discarding does not award opponents penalty points prematurely',()=>{
 let s=club();s.players[0].hand=[card('a',5),card('b',5),card('c',5),card('d',2),card('e',9)];
 s=layContract(s).state;
 s=discardContractCard(s,0).state;
 assert.equal(s.roundWinner,null);
 assert.equal(s.active,1);
 assert.equal(s.players[0].score,0);
 assert.equal(s.players[1].score,0);
});
test('Contract Club: 10 turns each enforces a finite Closing Time deal, applies all penalties, and starts next deal',()=>{
 let s=club();s.players[0].hand=[card('a',6),card('b',9)];s.players[1].hand=[card('c',1)];s.players[2].hand=[card('d',2),card('e',3)];
 s.dealTurns=s.dealTurnLimit-1;
 const end=discardContractCard(s,0);assert.ifError(end.error);
 assert.equal(end.state.roundWinner,1,'fewest unplayed points wins at closing time');
 assert.equal(end.state.dealTurns,30);
 assert.deepEqual(end.state.players.map(p=>p.score),[9,1,5]);
 const next=nextContractRound(end.state);assert.ifError(next.error);
 assert.equal(next.state.dealTurns,0);assert.equal(next.state.roundWinner,null);
});
test('Contract Club: ending on tied hand points marks a drawn deal',()=>{
 let s=club();s.dealTurns=s.dealTurnLimit-1;
 s.players.forEach((p,i)=>p.hand=i===0?[card('z0',4),card('spare',4)]:[card(`z${i}`,4)]);
 const after=discardContractCard(s,0).state;
 assert.equal(after.roundWinner,-1);
 assert.equal(after.winner,null);
});
test('Crown Circuit: court cards and wilds have meaningful distinct penalty weights',()=>{
 assert.equal(crownCardPenalty(card('a',11)),15);
 assert.equal(crownCardPenalty(card('b',13)),15);
 assert.equal(crownCardPenalty(card('c',3)),3);
 assert.equal(crownCardPenalty(card('w',3,'teal',true)),25);
 assert.equal(contractCardPenalty(card('w',0,'wild',true),'phase-quest'),20);
});
test('Tile Royale: five- and six-player Points Sprint gives each player precisely eight turns',()=>{
 for(const n of [5,6]){
  let s=createTileGame({seed:n,playerCount:n});
  assert.equal(s.turnLimit,n*8);
  assert.equal(s.players.every(p=>p.rack.length===14),true);
  assert.equal(s.draw.length,106-n*14);
  s.turn=s.turnLimit;s.active=n-1;
  const result=tileEndTurn(s,true);assert.ifError(result.error);
  assert.ok(result.state.winner!==null);
  assert.equal(result.state.finalRackPoints.length,n);
  assert.equal(result.state.turn,n*8+1);
 }
 assert.equal(createTileGame({playerCount:4}).turnLimit,null);
});
test('Contract Club: multiplayer projection publishes melds while never leaking rival hands',async()=>{
 const store=new RoomStore();const h=await store.create({mode:'contract-club',name:'Host Hero',avatar:1,maxPlayers:3});
 const a=await store.join(h.code,{name:'Guest One',avatar:2});
 const b=await store.join(h.code,{name:'Guest Two',avatar:3});
 const game=store.rooms.get(h.code).game;
 game.active=0;game.step='play';game.players[0].hand=[card('a',5),card('b',5),card('c',5),card('d',7)];
 let view=store.view(h.code,a.token);
 assert.equal(view.game.players[1].hand.every(c=>c===null),true);
 const after=await store.move(h.code,h.token,{type:'contract-lay',revision:view.revision});
 assert.equal(after.game.melds.length,1);
 view=store.view(h.code,b.token);
 assert.equal(view.game.melds[0].cards.length,3);
 assert.equal(view.game.players[1].hand.every(c=>c===null),true);
 await assert.rejects(store.move(h.code,a.token,{type:'contract-layoff',handIndex:0,meldIndex:0,revision:view.revision}),/opponent/);
 assert.equal(projectGame(store.rooms.get(h.code).game,0).players[1].hand.every(c=>c===null),true);
});
test('Contract Club: bot preserves the deal rather than awarding instant round on a partial contract',()=>{
 const s=createContractGame({mode:'contract-club'});s.active=1;s.step='draw';
 s.players[1].hand=[card('a',9),card('b',9),card('c',9),card('d',1),card('e',2)];
 const r=runContractBot(s);
 assert.equal(r.players[1].mission,1);
 assert.equal(r.roundWinner,null);
 assert.equal(r.active,0);
 assert.equal(r.melds.length,1);
});
