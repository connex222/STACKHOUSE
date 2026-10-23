import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore, BOT_TAKEOVER_GRACE_MS} from '../src/server/rooms.js';

const hostOptions={mode:'eight-shift',name:'Host',avatar:1,maxPlayers:2};

async function openDuel(store){
  const host=await store.create(hostOptions);
  const guest=await store.join(host.code,{name:'Guest',avatar:2});
  return {host,guest};
}
function action(store,host,details={}){
  return store.hostAction(host.code,host.token,{type:'bot-takeover',seat:1,
    level:'standard',revision:store.view(host.code,host.token).revision,...details});
}

test('host cannot replace a connected player or act before the two-minute grace period',async()=>{
  let t=1000000;
  const store=new RoomStore({now:()=>t});
  const {host,guest}=await openDuel(store);
  const close=store.subscribe(host.code,()=>{},1);
  t+=BOT_TAKEOVER_GRACE_MS+1;
  await assert.rejects(action(store,host),/still active|two minutes/i);
  close();
  await assert.rejects(action(store,host),/two minutes/i);
  t+=BOT_TAKEOVER_GRACE_MS-1;
  await assert.rejects(action(store,host),/two minutes/i);
  // Even without the stream, an authenticated HTTP state request proves activity.
  store.view(guest.code,guest.token);
  t+=1;
  await assert.rejects(action(store,host),/two minutes/i);
  t+=BOT_TAKEOVER_GRACE_MS;
  await action(store,host);
  const room=store.rooms.get(host.code);
  assert.equal(room.players[1].bot,true);
  assert.equal(room.players[1].tokenHash,null);
  assert.match(room.players[1].name,/House Bot/);
  await assert.rejects(Promise.resolve().then(()=>store.view(guest.code,guest.token)),/Access denied/);
  assert.equal(store.view(host.code,host.token).game.players[1].hand.every(card=>card===null),true);
});

test('only the host may replace disconnected player; no self takeover, invalid seats or bot seats',async()=>{
  let t=2000000;
  const store=new RoomStore({now:()=>t});
  const {host,guest}=await openDuel(store);
  t+=BOT_TAKEOVER_GRACE_MS+1;
  await assert.rejects(store.hostAction(host.code,guest.token,{type:'bot-takeover',seat:1,revision:2}),/Only the host/);
  await assert.rejects(action(store,host,{seat:0}),/two minutes/);
  await assert.rejects(action(store,host,{seat:999}),/two minutes/);
  t+=BOT_TAKEOVER_GRACE_MS;
  await assert.rejects(action(store,host,{level:'superhuman'}),/valid bot difficulty/);
  await action(store,host);
  await assert.rejects(action(store,host),/two minutes/);
});

test('bot takeover survives snapshot restoration without exposing a token',async()=>{
  let snapshot;
  let t=3000000;
  const backend={load:async()=>snapshot,save:async state=>{snapshot=structuredClone(state);}};
  const store=new RoomStore({now:()=>t,snapshotStore:backend});
  const {host,guest}=await openDuel(store);
  t+=BOT_TAKEOVER_GRACE_MS;
  await action(store,host);
  const replay=new RoomStore({now:()=>t+1000,snapshotStore:backend});
  await replay.load();
  const state=replay.view(host.code,host.token);
  assert.equal(state.players[1].bot,true);
  assert.equal(state.game.players[1].hand.every(card=>card===null),true);
  assert.throws(()=>replay.view(guest.code,guest.token),/Access denied/);
});

test('a failed durable save rolls back takeover and keeps the former player credential',async()=>{
  let t=4000000;
  let fail=false;
  const backend={load:async()=>null,save:async()=>{if(fail)throw Error('offline');}};
  const store=new RoomStore({now:()=>t,snapshotStore:backend});
  const {host,guest}=await openDuel(store);
  t+=BOT_TAKEOVER_GRACE_MS;
  fail=true;
  await assert.rejects(action(store,host),/storage is temporarily unavailable/);
  assert.equal(store.rooms.get(host.code).players[1].bot,undefined);
  assert.doesNotThrow(()=>store.view(guest.code,guest.token));
});

test('reconnection after server restart starts a fresh takeover grace period',async()=>{
  let t=5000000;
  let snapshot;
  const backend={load:async()=>snapshot,save:async state=>{snapshot=structuredClone(state);}};
  const store=new RoomStore({now:()=>t,snapshotStore:backend});
  const {host}=await openDuel(store);
  t+=1000000;
  const rebooted=new RoomStore({now:()=>t,snapshotStore:backend});
  await rebooted.load();
  await assert.rejects(action(rebooted,host),/two minutes/);
  t+=BOT_TAKEOVER_GRACE_MS;
  await action(rebooted,host);
});

test('replacement bot consents to a new game without blocking the host rematch',async()=>{
  let t=6000000;
  const store=new RoomStore({now:()=>t});
  const {host}=await openDuel(store);
  t+=BOT_TAKEOVER_GRACE_MS;
  await action(store,host);
  store.rooms.get(host.code).game.winner=0;
  const result=await store.move(host.code,host.token,{
    type:'rematch-request',revision:store.view(host.code,host.token).revision
  });
  assert.equal(result.game.winner,null);
  assert.equal(result.players[1].bot,true);
  assert.ok(result.series);
});
