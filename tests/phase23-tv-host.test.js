import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {RoomStore,MAX_TV_STREAMS} from '../src/server/rooms.js';

const player=n=>({name:`Guest ${n}`,avatar:n});
async function table(mode='eight-shift',count=3) {
 const store=new RoomStore();const host=await store.create({...player(1),mode,maxPlayers:count});
 const seats=[host];for(let n=2;n<=count;n++)seats.push(await store.join(host.code,player(n)));
 return {store,code:host.code,seats};
}

test('TV access denied without host-generated credential and to ordinary player tokens',async()=>{
 const {store,code,seats}=await table();
 assert.throws(()=>store.spectatorView(code,seats[0].token),/invalid or has been revoked/);
 await assert.rejects(store.hostAction(code,seats[1].token,{type:'tv-create',revision:store.view(code,seats[1].token).revision}),/Only the host/);
 const {watchKey,view}=await store.hostAction(code,seats[0].token,{type:'tv-create',revision:store.view(code,seats[0].token).revision});
 assert.equal(view.tvEnabled,true);assert.equal(watchKey.length>=30,true);
 assert.throws(()=>store.spectatorView(code,seats[0].token),/invalid or has been revoked/);
 assert.ok(store.spectatorView(code,watchKey).board);
 assert.equal(JSON.stringify(view).includes(watchKey),false);
 const second=await store.hostAction(code,seats[0].token,{type:'tv-create',revision:view.revision});
 assert.throws(()=>store.spectatorView(code,watchKey),/invalid or has been revoked/);
 assert.ok(store.spectatorView(code,second.watchKey).board);
 const disabled=await store.hostAction(code,seats[0].token,{type:'tv-disable',revision:second.view.revision});
 assert.equal(disabled.view.tvEnabled,false);
 assert.throws(()=>store.spectatorView(code,second.watchKey),/invalid or has been revoked/);
});

for(const mode of ['eight-shift','stack-run','malice-duel','tile-royale','phase-quest','contract-club','crown-circuit','shanghai-nights']){
 test(`${mode}: TV projection has no private hand, tile rack, draw deck, stock or token`,async()=>{
  const {store,code,seats}=await table(mode,3);
  const {watchKey}=await store.hostAction(code,seats[0].token,{type:'tv-create',revision:store.view(code,seats[0].token).revision});
  const s=store.spectatorView(code,watchKey),raw=store.rooms.get(code),serialized=JSON.stringify(s);
  assert.equal(s.players.length,3);assert.equal(s.board.kind,raw.game.kind);assert.equal(s.series.wins.length,3);
  for(const prop of ['tokenHash','tvTokenHash','watchKey','"hand":','"rack":','"draw":','"stock":','"held":'])assert.equal(serialized.includes(prop),false,`Leaked ${prop}`);
  for(let i=0;i<seats.length;i++)assert.equal(serialized.includes(seats[i].token),false);
  assert.equal(serialized.includes(watchKey),false);
  const secret=raw.game.players[0].hand?.[0]?.id??raw.game.players[0].rack?.[0]?.id;
  if(secret)assert.equal(serialized.includes(`"id":"${secret}"`),false,`Unexpected private card ID ${secret}`);
 });
}

test('host pause freezes gameplay; only host resumes; TV follows both states',async()=>{
 const {store,code,seats}=await table('eight-shift',3);
 const first=store.view(code,seats[0].token);
 const {watchKey,view}=await store.hostAction(code,seats[0].token,{type:'tv-create',revision:first.revision});
 await assert.rejects(store.hostAction(code,seats[1].token,{type:'pause',revision:view.revision}),/Only the host/);
 const paused=await store.hostAction(code,seats[0].token,{type:'pause',revision:view.revision});
 assert.equal(paused.view.paused,true);assert.equal(store.spectatorView(code,watchKey).paused,true);
 await assert.rejects(store.move(code,seats[0].token,{type:'eight-draw',revision:paused.view.revision}),/paused/);
 await assert.rejects(store.move(code,seats[1].token,{type:'eight-pass',revision:paused.view.revision}),/paused/);
 await assert.rejects(store.hostAction(code,seats[0].token,{type:'resume',revision:view.revision}),/table changed/);
 const resumed=await store.hostAction(code,seats[0].token,{type:'resume',revision:paused.view.revision});
 assert.equal(resumed.view.paused,false);assert.equal(store.spectatorView(code,watchKey).paused,false);
 const moved=await store.move(code,seats[0].token,{type:'eight-draw',revision:resumed.view.revision});
 assert.ok(moved.revision>resumed.view.revision);
});

test('TV token hashes and pause state survive room storage restarts',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'stackhouse-tv-'));
 try{
  const file=path.join(folder,'rooms.json');const store=new RoomStore({storageFile:file});
  const host=await store.create({...player(1),mode:'stack-run',maxPlayers:2});await store.join(host.code,player(2));
  const started=store.view(host.code,host.token);
  const {watchKey,view}=await store.hostAction(host.code,host.token,{type:'tv-create',revision:started.revision});
  await store.hostAction(host.code,host.token,{type:'pause',revision:view.revision});
  const restored=new RoomStore({storageFile:file});await restored.load();
  assert.equal(restored.spectatorView(host.code,watchKey).paused,true);
  assert.equal(restored.spectatorView(host.code,watchKey).players.length,2);
  assert.equal(restored.rooms.get(host.code).tvTokenHash?.includes(watchKey),false);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('TV SSE subscribers are separate from player stream limits',async()=>{
 const {store,code}=await table();const releases=[];
 for(let n=0;n<MAX_TV_STREAMS;n++){assert.equal(store.canSubscribe(code,-1),true);releases.push(store.subscribe(code,()=>{},-1));}
 assert.equal(store.canSubscribe(code,-1),false);
 assert.equal(store.canSubscribe(code,0),true);
 for(const release of releases)release();
 assert.equal(store.canSubscribe(code,-1),true);
});

test('spectator lobby projection does not expose join or player credentials',async()=>{
 const store=new RoomStore();const host=await store.create({...player(1),mode:'eight-shift',maxPlayers:6});
 const {watchKey}=await store.hostAction(host.code,host.token,{type:'tv-create',revision:host.view.revision});
 const screen=store.spectatorView(host.code,watchKey);
 assert.equal(screen.status,'waiting');assert.equal(screen.board,null);assert.equal(screen.players.length,1);
 assert.equal(JSON.stringify(screen).includes('token'),false);
});
