import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {RoomStore} from '../src/server/rooms.js';

async function seats(store,mode='phase-quest'){
 const host=await store.create({mode,name:'Harper',avatar:1});
 const guest=await store.join(host.code,{name:'Rowan',avatar:2});
 return {host,guest};
}
const id=n=>`phase7-action-${n}-unique`;

test('lost move acknowledgement: same action ID cannot draw twice',async()=>{
 const store=new RoomStore(),{host,guest}=await seats(store);
 const before=store.view(host.code,host.token);
 const action={type:'contract-draw',from:'deck',revision:before.revision,actionId:id('once')};
 const first=await store.move(host.code,host.token,action);
 const second=await store.move(host.code,host.token,action);
 assert.equal(second.revision,first.revision);
 assert.deepEqual(second.game,first.game);
 assert.equal(store.rooms.get(host.code).recentActions.length,1);
 assert.equal(store.view(host.code,guest.token).game.players[1].hand.every(c=>c===null),true);
 await assert.rejects(store.move(host.code,host.token,{...action,from:'discard'}),/already used/);
 await assert.rejects(store.move(host.code,host.token,{...action,actionId:id('new')}),/table changed/);
});

test('simultaneous duplicate submissions apply one action and same ID is seat-scoped',async()=>{
 const store=new RoomStore(),{host,guest}=await seats(store);
 const revision=store.view(host.code,host.token).revision;
 const request={type:'contract-draw',from:'deck',revision,actionId:id('race')};
 const results=await Promise.all([store.move(host.code,host.token,request),store.move(host.code,host.token,request)]);
 assert.equal(results[0].revision,revision+1);
 assert.equal(results[1].revision,revision+1);
 await assert.rejects(store.move(host.code,guest.token,request),/table changed/);
});

test('rematch takes both players consent, supports cancellation and preserves profiles',async()=>{
 const store=new RoomStore(),{host,guest}=await seats(store,'eight-shift');
 let room=store.rooms.get(host.code);
 await assert.rejects(store.move(host.code,host.token,{type:'rematch-request',revision:room.revision}),/Finish the match/);
 // Simulate a completed match; engine tests independently verify winner transitions.
 room.game.winner=0;
 const before=room.revision,original=room.game;
 const vote=await store.move(host.code,guest.token,{type:'rematch-request',revision:before,actionId:id('guest-vote')});
 assert.deepEqual(vote.rematchVotes,[false,true]);
 assert.equal(room.game,original,'First vote must not reset match');
 const undo=await store.move(host.code,guest.token,{type:'rematch-cancel',revision:vote.revision,actionId:id('cancel')});
 assert.deepEqual(undo.rematchVotes,[false,false]);
 const voteAgain=await store.move(host.code,guest.token,{type:'rematch-request',revision:undo.revision,actionId:id('again')});
 const newGame=await store.move(host.code,host.token,{type:'rematch-request',revision:voteAgain.revision,actionId:id('host-vote')});
 assert.equal(newGame.game.winner,null);
 assert.deepEqual(newGame.rematchVotes,[false,false]);
 assert.deepEqual(newGame.players.map(p=>p.name),['Harper','Rowan']);
 assert.notEqual(room.game,original);
 const retried=await store.move(host.code,host.token,{type:'rematch-request',revision:voteAgain.revision,actionId:id('host-vote')});
 assert.equal(retried.revision,newGame.revision);
 await assert.rejects(store.move(host.code,guest.token,{type:'restart',revision:newGame.revision}),/Both players must agree/);
});

test('action acknowledgements and rematch votes survive persistence/restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'stackhouse-phase7-'));
 try{
  const storageFile=path.join(dir,'rooms.json');
  const first=new RoomStore({storageFile});const {host,guest}=await seats(first);
  const revision=first.view(host.code,host.token).revision;
  const action={type:'contract-draw',from:'deck',revision,actionId:id('persist')};
  const made=await first.move(host.code,host.token,action);
  const second=new RoomStore({storageFile});await second.load();
  const duplicate=await second.move(host.code,host.token,action);
  assert.equal(duplicate.revision,made.revision);
  second.rooms.get(host.code).game.winner=0;
  const vote=await second.move(host.code,guest.token,{type:'rematch-request',revision:duplicate.revision,actionId:id('guest-after-restart')});
  const third=new RoomStore({storageFile});await third.load();
  assert.deepEqual(third.view(host.code,host.token).rematchVotes,[false,true]);
  assert.equal((await readFile(storageFile,'utf8')).includes(host.token),false);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('invalid id cannot mutate game or revision',async()=>{
 const store=new RoomStore(),{host}=await seats(store);
 const initial=store.view(host.code,host.token);
 for(const actionId of ['x','!?',123])await assert.rejects(store.move(host.code,host.token,{type:'contract-draw',from:'deck',revision:initial.revision,actionId}),/Invalid action ID/);
 assert.equal(store.view(host.code,host.token).revision,initial.revision);
});
