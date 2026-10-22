import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../src/server/rooms.js';

for(const mode of ['crown-circuit','number-ladder','shanghai-nights']){
 test(`Wave 2 ${mode}: private rooms, redacted opponent cards and authenticated actions`,async()=>{
  const rooms=new RoomStore();
  const host=await rooms.create({mode,name:'Host',avatar:2});
  const guest=await rooms.join(host.code,{name:'Guest',avatar:6});
  const h=rooms.view(host.code,host.token),g=rooms.view(host.code,guest.token);
  assert.equal(h.mode,mode);
  assert.equal(h.status,'playing');
  assert.equal(h.game.players[0].name,'Host');
  assert.equal(g.game.players[0].name,'Guest');
  assert.equal(h.game.players[1][mode==='number-ladder'?'rack':'hand'].every(x=>x===null),true);
  assert.equal(g.game.players[1][mode==='number-ladder'?'rack':'hand'].every(x=>x===null),true);
  assert.equal(JSON.stringify(h).includes('seed'),false);
  assert.equal(JSON.stringify(h).includes('tokenHash'),false);
  const action=mode==='number-ladder'?{type:'rack-draw',from:'deck'}:{type:'contract-draw',from:'deck'};
  await assert.rejects(rooms.move(host.code,guest.token,{...action,revision:h.revision}),/opponent’s turn/);
  const moved=await rooms.move(host.code,host.token,{...action,revision:h.revision});
  assert.equal(moved.game.step,mode==='number-ladder'?'replace':'play');
  assert.equal(moved.revision,h.revision+1);
  await assert.rejects(rooms.move(host.code,host.token,{...action,revision:h.revision}),/table changed/);
  const complete=mode==='number-ladder'?{type:'rack-replace',index:2}:{type:'contract-discard',handIndex:0};
  const finished=await rooms.move(host.code,host.token,{...complete,revision:moved.revision});
  assert.equal(finished.game.active,1);
  assert.equal(rooms.view(host.code,guest.token).game.active,0);
  if(mode==='number-ladder') {
   assert.equal(finished.game.held,null);
   assert.equal(finished.game.discard.length,1);
   const publicJSON=JSON.stringify(finished.game);
   assert.equal(publicJSON.includes('"rack":['),true);
  }
 });
}

test('Number Ladder can reveal a drawn card only to the current player',async()=>{
 const rooms=new RoomStore();
 const host=await rooms.create({mode:'number-ladder',name:'Host',avatar:2});
 const guest=await rooms.join(host.code,{name:'Guest',avatar:6});
 const hostInitial=rooms.view(host.code,host.token);
 await rooms.move(host.code,host.token,{type:'rack-draw',from:'deck',revision:hostInitial.revision});
 const hostNext=rooms.view(host.code,host.token).game;
 const guestNext=rooms.view(host.code,guest.token).game;
 assert.equal(typeof hostNext.held.value,'number');
 assert.equal(guestNext.held,null);
 assert.equal(guestNext.players[1].rack.every(x=>x===null),true);
});
