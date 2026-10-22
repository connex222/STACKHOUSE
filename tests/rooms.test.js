import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RoomStore, projectGame } from '../src/server/rooms.js';
import { createSequenceGame, sequenceSources, sequencePileTargets } from '../src/engine/sequence.js';
import { createContractGame } from '../src/engine/contracts.js';
const joinTwo = async (store,mode='stack-run')=>{
  const host=await store.create({mode,name:'Host',avatar:1});
  const guest=await store.join(host.code,{name:'Guest',avatar:16});
  return {host,guest};
};

test('room: unique six-character invitation, two seats, unguessable bearer sessions',async()=>{
  const store=new RoomStore();
  const host=await store.create({mode:'stack-run',name:'Host',avatar:1});
  assert.match(host.code,/^[A-Z2-9]{6}$/);
  assert.ok(host.token.length>30);
  assert.equal(store.view(host.code,host.token).status,'waiting');
  assert.throws(()=>store.view(host.code,'fake-token-1234567890123456789012345'),/Access denied/);
  const guest=await store.join(host.code,{name:'Guest',avatar:2});
  assert.equal(store.view(host.code,host.token).status,'playing');
  assert.equal(store.view(host.code,guest.token).seat,1);
  await assert.rejects(store.join(host.code,{name:'Third',avatar:3}),/not accepting players/);
});

test('room: rejects malformed player input, markup and invalid mode',async()=>{
  const store=new RoomStore();
  await assert.rejects(store.create({mode:'not-a-game',name:'Me',avatar:1}),/Choose one/);
  await assert.rejects(store.create({mode:'stack-run',name:'<script>',avatar:1}),/Name/);
  await assert.rejects(store.create({mode:'stack-run',name:'Jane',avatar:19}),/avatars/);
});

test('room: each player receives only their own face-up stock and hand',async()=>{
  const store=new RoomStore();const {host,guest}=await joinTwo(store);
  const real=store.rooms.get(host.code).game;
  const h=store.view(host.code,host.token).game,g=store.view(host.code,guest.token).game;
  assert.deepEqual(h.players[0].hand,real.players[0].hand);
  assert.equal(h.players[1].hand.length,real.players[1].hand.length);
  assert.ok(h.players[1].hand.every(c=>c===null));
  assert.equal(h.players[0].stock.at(-1)?.id,real.players[0].stock.at(-1)?.id);
  assert.equal(h.players[1].stock.at(-1),null);
  assert.ok(h.players[0].stock.slice(0,-1).every(x=>x===null));
  assert.equal(g.players[0].name,'Guest');
  assert.deepEqual(g.players[0].hand,real.players[1].hand);
  assert.equal(g.players[1].stock.at(-1),null);
  assert.equal(g.active,1);
  assert.equal(h.active,0);
  assert.equal(JSON.stringify(h).includes('tokenHash'),false);
  assert.equal(JSON.stringify(h).includes('seed'),false);
  assert.equal(JSON.stringify(h).includes('recycled'),false);
});

test('room: contract hands and deck are hidden from opponent',async()=>{
  const store=new RoomStore();const {host,guest}=await joinTwo(store,'phase-quest');
  const h=store.view(host.code,host.token).game;
  const g=store.view(host.code,guest.token).game;
  const game=store.rooms.get(host.code).game;
  assert.deepEqual(h.players[0].hand,game.players[0].hand);
  assert.ok(h.players[1].hand.every(x=>x===null));
  assert.deepEqual(g.players[0].hand,game.players[1].hand);
  assert.equal(h.draw.length,game.draw.length);
  assert.equal(h.draw[0],undefined);
  assert.equal(JSON.stringify(h).includes('seed'),false);
});

test('room: out-of-turn and stale revision actions are rejected',async()=>{
  const store=new RoomStore();const {host,guest}=await joinTwo(store,'phase-quest');
  const initial=store.view(host.code,host.token);
  await assert.rejects(store.move(host.code,guest.token,{type:'contract-draw',from:'deck',revision:initial.revision}),/opponent’s turn/);
  const moved=await store.move(host.code,host.token,{type:'contract-draw',from:'deck',revision:initial.revision});
  assert.equal(moved.game.step,'play');
  assert.equal(moved.revision,initial.revision+1);
  await assert.rejects(store.move(host.code,host.token,{type:'contract-draw',from:'deck',revision:initial.revision}),/table changed/);
  assert.equal(store.view(host.code,host.token).revision,moved.revision);
});

test('room: complete sequence hand actions advance the turn securely',async()=>{
  const store=new RoomStore();const {host,guest}=await joinTwo(store,'stack-run');
  let visible=store.view(host.code,host.token);
  const before=store.rooms.get(host.code).game;
  // Select a legal discard on the host, then verify the guest gets the turn and draws five.
  visible=await store.move(host.code,host.token,{type:'sequence-discard',handIndex:0,discardIndex:0,revision:visible.revision});
  assert.equal(visible.game.active,1);
  assert.equal(store.view(host.code,guest.token).game.active,0);
  assert.equal(before.active,0);
  assert.equal(store.rooms.get(host.code).game.players[1].hand.length,5);
  await assert.rejects(store.move(host.code,host.token,{type:'sequence-discard',handIndex:0,discardIndex:0,revision:visible.revision}),/opponent’s turn/);
});

test('room: validation rejects invalid actions without mutating original state',async()=>{
  const store=new RoomStore();const {host}=await joinTwo(store);
  const first=store.view(host.code,host.token);
  const snapshot=JSON.stringify(store.rooms.get(host.code).game);
  for(const action of [
    {type:'sequence-discard',handIndex:-1,discardIndex:0},
    {type:'sequence-play',sourceType:'stock',sourceIndex:0,pileIndex:500},
    {type:'contract-lay'},
    {type:'totally-invalid'},
  ]) await assert.rejects(store.move(host.code,host.token,{...action,revision:first.revision}));
  assert.equal(JSON.stringify(store.rooms.get(host.code).game),snapshot);
});

test('room: avatar changes propagate and do not consume a card turn',async()=>{
  const store=new RoomStore();const {host,guest}=await joinTwo(store);
  const initial=store.view(host.code,host.token);
  const changed=await store.move(host.code,guest.token,{type:'profile-avatar',avatar:11,revision:initial.revision});
  assert.equal(changed.players[1].avatar,11);
  assert.equal(store.view(host.code,host.token).players[1].avatar,11);
  assert.equal(store.rooms.get(host.code).game.active,0);
});

test('room: restores both player tokens, turn and game state from a disk snapshot',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'stackhouse-test-'));
  try {
    const storageFile=path.join(folder,'rooms.json');
    const first=new RoomStore({storageFile});
    const {host,guest}=await joinTwo(first,'malice-duel');
    const initial=first.view(host.code,host.token);
    const moved=await first.move(host.code,host.token,{type:'sequence-discard',handIndex:0,discardIndex:1,revision:initial.revision});
    const stored=await readFile(storageFile,'utf8');
    assert.ok(!stored.includes(host.token),'Plaintext player token must never be persisted');
    const restarted=new RoomStore({storageFile});await restarted.load();
    assert.deepEqual(restarted.view(host.code,host.token),moved);
    assert.equal(restarted.view(host.code,guest.token).game.active,0);
  } finally {await rm(folder,{recursive:true,force:true});}
});

test('room: notifications reach listeners without revealing credentials',async()=>{
  const store=new RoomStore();const host=await store.create({mode:'stack-run',name:'Alice',avatar:1});
  let delivered=0;const off=store.subscribe(host.code,()=>{delivered++;});
  assert.equal(delivered,1,'Connected presence is announced immediately');
  await store.join(host.code,{name:'Bob',avatar:2});
  assert.equal(delivered,2);off();
  const hostView=store.view(host.code,host.token);
  await store.move(host.code,host.token,{type:'profile-avatar',avatar:2,revision:hostView.revision});
  assert.equal(delivered,2);
});
