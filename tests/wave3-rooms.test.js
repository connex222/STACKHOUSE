import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore,projectGame} from '../src/server/rooms.js';
import {createLowGame,lowDraw} from '../src/engine/lowcard.js';
for(const mode of ['tile-royale','low-glow','eight-shift']){
 test(`Phase 4 ${mode}: joins, redaction, validation and authorised turns`,async()=>{
  const store=new RoomStore(),h=await store.create({mode,name:'Host',avatar:1}),j=await store.join(h.code,{name:'Guest',avatar:9});
  const host=store.view(h.code,h.token),guest=store.view(h.code,j.token);
  assert.equal(host.game.kind,mode==='tile-royale'?'tiles':mode==='low-glow'?'low':'eights');
  assert.equal(guest.game.players[0].name,'Guest');
  assert.doesNotMatch(JSON.stringify(host),/tokenHash|"seed":|"draw":\[\{"/);
  assert.doesNotMatch(JSON.stringify(guest),/tokenHash|"seed":/);
  if(mode==='tile-royale'){assert.equal(host.game.players[1].rack.every(x=>x===null),true);assert.equal(guest.game.players[1].rack.every(x=>x===null),true);}
  if(mode==='eight-shift'){assert.equal(host.game.players[1].hand.every(x=>x===null),true);assert.equal(guest.game.players[1].hand.every(x=>x===null),true);}
  if(mode==='low-glow'){
   const g=host.game.players[0].grid;assert.equal(g.filter(c=>c.value!==null).length,2);assert.equal(host.game.players[1].grid.filter(c=>c.value!==null).length,2);
   assert.equal(g.filter(c=>c.value===null).every(c=>c.id===null),true);
  }
  const command=mode==='tile-royale'?{type:'tile-end',draw:true}:mode==='low-glow'?{type:'low-draw',from:'deck'}:{type:'eight-draw'};
  await assert.rejects(store.move(h.code,j.token,{...command,revision:host.revision}),/opponent’s turn/);
  const next=await store.move(h.code,h.token,{...command,revision:host.revision});assert.equal(next.revision,host.revision+1);
  await assert.rejects(store.move(h.code,h.token,{...command,revision:host.revision}),/changed/);
  if(mode==='low-glow'){
   assert.equal(next.game.held?.value!==undefined,true);
   assert.equal(store.view(h.code,j.token).game.held,null);
   const grid=store.view(h.code,h.token).game.players[0].grid;
   assert.equal(grid.filter(c=>c.revealed===false).every(c=>c.value===null),true);
   await store.move(h.code,h.token,{type:'low-replace',index:1,revision:next.revision});
  }
  if(mode==='eight-shift')await store.move(h.code,h.token,{type:'eight-pass',revision:next.revision});
 });
}
test('Low Glow public view preserves ties and never exposes unrevealed values',()=>{
 const s=createLowGame();s.winner=-1;s.roundWinner=-1;const p=projectGame(s,0);assert.equal(p.winner,-1);assert.equal(p.roundWinner,-1);
 for(const player of p.players)for(const c of player.grid)if(!c.revealed)assert.equal(c.value,null);
});
