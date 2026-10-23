import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {createContractGame,drawContractCard,discardContractCard,layContract,nextContractRound,MISSION_SETS,contractCardPenalty} from '../src/engine/contracts.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const modes=['phase-quest','contract-club','crown-circuit','shanghai-nights'];
const player=i=>({name:`Guest ${i+1}`,avatar:i+1});
async function open(mode,n,opts={}){
 const store=new RoomStore(opts);
 const host=await store.create({...player(0),mode,maxPlayers:n});
 const seats=[host];for(let i=1;i<n;i++)seats.push(await store.join(host.code,player(i)));
 return {store,seats,code:host.code};
}
function totalCards(s){return s.draw.length+s.discard.length+s.laid.length+s.players.reduce((sum,p)=>sum+p.hand.length,0);}
for(const mode of modes)for(const n of [3,4,6]){
 test(`${mode} — ${n} players keep hidden hands, clockwise turns and rotating deals`,async()=>{
  const {store,seats,code}=await open(mode,n);
  assert.equal(store.view(code,seats[0].token).status,'playing');
  const game=store.rooms.get(code).game;
  assert.equal(game.players.length,n);
  assert.equal(totalCards(game),mode==='crown-circuit'?116:108);
  assert.equal(game.players.every(p=>p.hand.length===10),true);
  assert.equal(store.view(code,seats[0].token).series.wins.length,n);
  for(let i=0;i<n;i++) {
   const view=store.view(code,seats[i].token);
   assert.equal(view.game.players[0].name,player(i).name);
   assert.equal(view.game.players[0].hand.length,10);
   assert.equal(view.game.active,0);
   for(const opponent of view.game.players.slice(1)){
    assert.equal(opponent.hand.every(card=>card===null),true);
    assert.equal(opponent.mission,0);
   }
   assert.ok(!JSON.stringify(view).includes('tokenHash'));
   assert.ok(!JSON.stringify(view).includes(seats[(i+1)%n].token));
   // A rival cannot issue the current seat's move, even if it knows the revision.
   await assert.rejects(store.move(code,seats[(i+1)%n].token,{revision:view.revision,type:'contract-draw',from:'deck'}),/opponent/);
   const afterDraw=await store.move(code,seats[i].token,{type:'contract-draw',from:'deck',revision:view.revision});
   assert.equal(afterDraw.game.players[0].hand.length,11);
   const afterDiscard=await store.move(code,seats[i].token,{type:'contract-discard',handIndex:0,revision:afterDraw.revision});
   assert.equal(afterDiscard.game.players[0].hand.length,10);
   assert.equal(store.rooms.get(code).game.active,(i+1)%n);
   assert.equal(totalCards(store.rooms.get(code).game),totalCards(game));
  }
  const state=store.rooms.get(code).game;
  state.active=0;state.step='play';
  const me=state.players[0],mission=MISSION_SETS[mode][0];
  // Fabricated suit/value combinations are only for this controlled engine test;
  // the server's public gameplay cannot inject a deck or chosen cards.
  if(mission.groups.length===1){
   const [kind,count]=mission.groups[0];
   me.hand=Array.from({length:count},(_,i)=>({id:`forced${i}`,value:kind==='run'?i+1:5,colour:kind==='colour'?'gold':i%2?'coral':'teal',wild:false}));
  }else{
   const cards=[];
   for(const [kind,count] of mission.groups){for(let j=0;j<count;j++)cards.push({id:`forced${cards.length}`,value:kind==='run'?j+1:kind==='set'?7:2,colour:kind==='colour'?'teal':j%2?'gold':'coral',wild:false});}
   me.hand=cards;
  }
  const rivals=state.players.slice(1).map(p=>p.hand.reduce((sum,c)=>sum+contractCardPenalty(c,mode),0));
  const result=layContract(state);
  assert.ok(!result.error,result.error);
  assert.equal(result.state.roundWinner,0);
  assert.equal(result.state.players[0].mission,1);
  assert.equal(result.state.players[0].score,0);
  assert.deepEqual(result.state.players.slice(1).map(p=>p.mission),Array(n-1).fill(0));
  assert.deepEqual(result.state.players.slice(1).map(p=>p.score),rivals);
  const round=nextContractRound(result.state);
  assert.ok(!round.error);
  assert.equal(round.state.round,2);
  assert.equal(round.state.active,1);
  assert.equal(round.state.players[0].mission,1);
  assert.deepEqual(round.state.players.slice(1).map(p=>p.score),rivals);
  assert.equal(round.state.players.every(p=>p.hand.length===10),true);
 });
}

test('contract game rejects unsafe seat counts and legacy bot stays two-player',()=>{
 for(const count of [0,1,7,-1,2.4,undefined===null?0:'6'])assert.throws(()=>createContractGame({playerCount:count}),/2–6/);
 const bot=createContractGame();assert.equal(bot.players.length,2);
 const drawn=drawContractCard(bot,'deck');assert.equal(drawn.state.players[0].hand.length,11);
 const discarded=discardContractCard(drawn.state,0);assert.equal(discarded.state.active,1);
});

test('contract group series wins require unanimous rematch, and snapshots preserve every seat',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stackhouse-phase14-'));
 try {
  const storageFile=join(dir,'rooms.json');
  const {store,seats,code}=await open('contract-club',4,{storageFile});
  const before=store.rooms.get(code);before.game.winner=2;before.game.roundWinner=2;
  // save and reload a real completed room snapshot
  await store.save();
  const restored=new RoomStore({storageFile});await restored.load();
  assert.equal(restored.view(code,seats[0].token).game.winner,2);
  for(let i=0;i<4;i++){
   const view=restored.view(code,seats[i].token);
   assert.equal(view.game.winner,[i,...Array.from({length:4},(_,j)=>j).filter(j=>j!==i)].indexOf(2));
   const updated=await restored.move(code,seats[i].token,{type:'rematch-request',revision:view.revision});
   if(i<3)assert.equal(updated.game.winner!==null,true);
  }
  const after=restored.view(code,seats[0].token);
  assert.equal(after.game.winner,null);
  assert.equal(after.game.players.length,4);
  assert.deepEqual(after.series.wins,[0,0,1,0]);
  assert.equal(after.series.played,1);
  assert.deepEqual(after.rematchVotes,[false,false,false,false]);
  const next=new RoomStore({storageFile});await next.load();
  assert.deepEqual(next.view(code,seats[2].token),restored.view(code,seats[2].token));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('six-player rooms reject two-player modes but accept group-compatible mixed tournaments',async()=>{
 const s=new RoomStore();
 for(const mode of ['number-ladder','low-glow'])await assert.rejects(s.create({...player(0),mode,maxPlayers:3}),/Group tables/);
 for(const mode of modes)assert.equal((await s.create({...player(0),mode,maxPlayers:6,format:'mixed'})).view.series.format,'mixed');
});
