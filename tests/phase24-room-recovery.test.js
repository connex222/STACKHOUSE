import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyRoomRecovery} from '../src/room-recovery.js';

for (const status of [400,403,409,429,500,502,503,504,undefined]) {
  test(`saved seat survives recoverable ${status ?? 'network'} failure`,()=>{
    const error=status===undefined?new TypeError('Failed to fetch'):Object.assign(Error('Temporary'),{status});
    assert.equal(classifyRoomRecovery(error),'retryable');
  });
}
for(const status of [401,404]){
  test(`saved seat is discarded only on authoritative HTTP ${status}`,()=>{
    assert.equal(classifyRoomRecovery(Object.assign(Error('Expired'),{status})),'invalid-seat');
  });
}
test('client provides an explicit recovery and private-device forget control',()=>{
  const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(app,/data-action="room-retry-seat"/);
  assert.match(app,/data-action="room-forget-seat"/);
  assert.match(app,/classifyRoomRecovery\(error\)/);
  assert.match(app,/The server is not responding/);
});
