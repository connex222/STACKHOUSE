import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {RoomStore} from '../src/server/rooms.js';
async function setup(store){const h=await store.create({mode:'eight-shift',name:'Jamie',avatar:1});const g=await store.join(h.code,{name:'Quinn',avatar:6});return {h,g};}
async function finish(store,h,seat=0){
 const room=store.rooms.get(h.code);room.game.active=seat;
 const c=room.game.players[seat].hand[0];room.game.players[seat].hand=[c];room.game.activeSuit=c.suit;
 return store.move(h.code,seat===0?h.token:store.__guestToken,{type:'eight-play',index:0,suit:c.value===8?'hearts':null,revision:room.revision,actionId:`test-series-${room.gameNumber}-seat-${seat}`});
}
test('persisted series wins survive reconnection, reload and duplicate acknowledgement',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'stackhouse-series-'));
 try{
  const file=path.join(dir,'rooms.json'),one=new RoomStore({storageFile:file}),{h,g}=await setup(one);
  one.__guestToken=g.token;
  const done=await finish(one,h,0);
  assert.deepEqual(done.series.wins,[1,0]);
  const repeated=await one.move(h.code,h.token,{type:'eight-play',index:0,suit:one.rooms.get(h.code).game.discard.at(-1).value===8?'hearts':null,revision:done.revision-1,actionId:'test-series-1-seat-0'});
  assert.deepEqual(repeated.series.wins,[1,0]);
  const two=new RoomStore({storageFile:file});await two.load();two.__guestToken=g.token;
  assert.deepEqual(two.view(h.code,g.token).series.wins,[1,0]);
  const before=two.view(h.code,h.token);
  await two.move(h.code,h.token,{type:'rematch-request',revision:before.revision});
  let next=await two.move(h.code,g.token,{type:'rematch-request',revision:before.revision+1});
  assert.deepEqual(next.series.wins,[1,0]);
  next=await finish(two,h,1);
  assert.deepEqual(next.series.wins,[1,1]);
  assert.equal(next.series.history[0].winner,1);
  const saved=await readFile(file,'utf8');assert.equal(saved.includes(h.token),false);assert.equal(saved.includes(g.token),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('championship resets only after BOTH players request new series',async()=>{
 const store=new RoomStore(),{h,g}=await setup(store);store.__guestToken=g.token;
 for(let i=0;i<3;i++){
  let result=await finish(store,h,0);assert.equal(result.series.wins[0],i+1);
  if(i<2){result=await store.move(h.code,h.token,{type:'rematch-request',revision:result.revision});await store.move(h.code,g.token,{type:'rematch-request',revision:result.revision});}
 }
 let latest=store.view(h.code,h.token);assert.equal(latest.series.champion,0);assert.equal(latest.series.number,1);
 const one=await store.move(h.code,h.token,{type:'rematch-request',revision:latest.revision});
 assert.equal(one.series.champion,0);assert.equal(one.series.number,1);
 const two=await store.move(h.code,g.token,{type:'rematch-request',revision:one.revision});
 assert.equal(two.series.champion,null);assert.equal(two.series.number,2);assert.deepEqual(two.series.wins,[0,0]);
});
