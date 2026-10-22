import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../src/server/rooms.js';
import { PostgresSnapshotStore } from '../src/server/postgres-storage.js';

class MemoryAdapter {
  snapshot=null;
  fail=false;
  async load(){return this.snapshot?structuredClone(this.snapshot):null;}
  async save(data){if(this.fail)throw Error('Simulated database outage');this.snapshot=structuredClone(data);}
}
const createFriends=async(store,mode='phase-quest')=>{
  const host=await store.create({mode,name:'Player One',avatar:1});
  const guest=await store.join(host.code,{name:'Player Two',avatar:2});
  return {host,guest};
};

test('Phase 11: overlapping actions with the same revision never both commit',async()=>{
  const store=new RoomStore();const {host}=await createFriends(store);
  const initial=store.view(host.code,host.token);
  const payload={type:'contract-draw',from:'deck',revision:initial.revision};
  const result=await Promise.allSettled([
    store.move(host.code,host.token,{...payload,actionId:'parallel-draw-00001'}),
    store.move(host.code,host.token,{...payload,actionId:'parallel-draw-00002'})
  ]);
  assert.deepEqual(result.map(x=>x.status).sort(),['fulfilled','rejected']);
  assert.match(result.find(x=>x.status==='rejected').reason.message,/table changed/);
  assert.equal(store.view(host.code,host.token).revision,initial.revision+1);
  assert.equal(store.view(host.code,host.token).game.step,'play');
});

test('Phase 11: saving failure rolls back a move, revision and action-ID receipt',async()=>{
  const database=new MemoryAdapter(),store=new RoomStore({snapshotStore:database});await store.load();
  const {host}=await createFriends(store);
  const before=store.view(host.code,host.token);
  const cardCount=before.game.players[0].hand.length;
  const action={type:'contract-draw',from:'deck',revision:before.revision,actionId:'retry-safe-action-01'};
  database.fail=true;
  await assert.rejects(store.move(host.code,host.token,action),/temporarily unavailable/);
  assert.equal(store.view(host.code,host.token).revision,before.revision);
  assert.equal(store.view(host.code,host.token).game.players[0].hand.length,cardCount);
  database.fail=false;
  const completed=await store.move(host.code,host.token,action);
  assert.equal(completed.revision,before.revision+1);
  assert.equal(completed.game.players[0].hand.length,cardCount+1);
  assert.deepEqual(await store.move(host.code,host.token,action),completed);
});

test('Phase 11: a failed create or join is not advertised as a successful game room',async()=>{
  const database=new MemoryAdapter(),store=new RoomStore({snapshotStore:database});await store.load();
  database.fail=true;
  await assert.rejects(store.create({mode:'stack-run',name:'Host',avatar:1}),/temporarily unavailable/);
  assert.equal(store.rooms.size,0);
  database.fail=false;
  const host=await store.create({mode:'stack-run',name:'Host',avatar:1});
  database.fail=true;
  await assert.rejects(store.join(host.code,{name:'Guest',avatar:2}),/temporarily unavailable/);
  assert.equal(store.view(host.code,host.token).status,'waiting');
  assert.equal(store.view(host.code,host.token).players.length,1);
});

test('Phase 11: room, hidden cards and idempotent action survive a database-backed restart',async()=>{
  const database=new MemoryAdapter(),first=new RoomStore({snapshotStore:database});await first.load();
  const {host,guest}=await createFriends(first);
  const initial=first.view(host.code,host.token);
  const action={type:'contract-draw',from:'deck',revision:initial.revision,actionId:'recover-action-00001'};
  const changed=await first.move(host.code,host.token,action);
  const restored=new RoomStore({snapshotStore:database});await restored.load();
  assert.deepEqual(restored.view(host.code,host.token),changed);
  assert.equal(restored.view(host.code,guest.token).game.players[1].hand.every(c=>c===null),true);
  assert.deepEqual(await restored.move(host.code,host.token,action),changed);
  assert.equal(JSON.stringify(database.snapshot).includes(host.token),false);
  assert.equal(JSON.stringify(database.snapshot).includes(guest.token),false);
});

class FakePool {
  row=null;
  async query(sql,args=[]){
    if(sql.startsWith('CREATE TABLE'))return {rows:[]};
    if(sql.startsWith('SELECT'))return {rows:this.row?[structuredClone(this.row)]:[]};
    if(sql.includes('INSERT')){
      if(this.row)return {rows:[]};
      this.row={generation:1,payload:JSON.parse(args[0])};return {rows:[{generation:1}]};
    }
    if(sql.includes('UPDATE')){
      if(!this.row||this.row.generation!==args[1])return {rows:[]};
      this.row={generation:this.row.generation+1,payload:JSON.parse(args[0])};
      return {rows:[{generation:this.row.generation}]};
    }
    throw Error('Unknown database query');
  }
}
test('Phase 11: PostgreSQL adapter reloads state and blocks stale writers',async()=>{
  const pool=new FakePool();const one=new PostgresSnapshotStore(pool);const two=new PostgresSnapshotStore(pool);
  assert.equal(await one.load(),null);assert.equal(await two.load(),null);
  await one.save({version:3,rooms:[{code:'FIRST1'}]});
  await assert.rejects(two.save({version:3,rooms:[{code:'SECOND'}]}),/snapshot conflict/i);
  const reopened=new PostgresSnapshotStore(pool);
  assert.deepEqual(await reopened.load(),{version:3,rooms:[{code:'FIRST1'}]});
  await reopened.save({version:3,rooms:[{code:'LATEST'}]});
  assert.equal(pool.row.generation,2);
  await assert.rejects(one.save({version:3,rooms:[]}),/snapshot conflict/i);
  assert.deepEqual((await new PostgresSnapshotStore(pool).load()).rooms,[{code:'LATEST'}]);
});

test('Phase 11: all ten games survive a snapshot with both private views intact',async()=>{
  const modes=['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift'];
  for(const mode of modes){
    const db=new MemoryAdapter(),first=new RoomStore({snapshotStore:db});await first.load();
    const {host,guest}=await createFriends(first,mode);
    const pre=first.view(host.code,host.token);
    const reopened=new RoomStore({snapshotStore:db});await reopened.load();
    const visible=reopened.view(host.code,host.token);
    assert.deepEqual(visible.game,pre.game,`Host state lost after restart: ${mode}`);
    assert.equal(reopened.view(host.code,guest.token).seat,1,`Guest seat lost: ${mode}`);
    assert.equal(JSON.stringify(visible).includes('tokenHash'),false);
    assert.equal(JSON.stringify(visible).includes(guest.token),false);
  }
});
