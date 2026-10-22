import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresSnapshotStore } from '../src/server/postgres-storage.js';

test('Phase 12: database readiness reflects live connectivity, not configuration alone',async()=>{
  const database={available:true,async query(sql){
    if(!this.available)throw Error('Simulated database outage');
    if(sql.startsWith('SELECT generation'))return {rows:[]};
    return {rows:[]};
  }};
  const store=new PostgresSnapshotStore(database);
  assert.equal(await store.ping(),false,'A configured but uninitialised database is not ready');
  assert.equal(await store.load(),null);
  assert.equal(await store.ping(),true,'A queryable database should report connected');
  database.available=false;
  assert.equal(await store.ping(),false,'A dropped database must not report connected');
  database.available=true;
  assert.equal(await store.ping(),true,'Readiness must recover when the database does');
});
