import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {createSequenceGame,runSequenceBot} from '../src/engine/sequence.js';
import {createEightGame,runEightBot} from '../src/engine/eights.js';
import {createContractGame,runContractBot} from '../src/engine/contracts.js';
import {createTileGame,runTileBot} from '../src/engine/tiles.js';
import {BOT_PERSONAS} from '../src/bot-personalities.js';

const cases=[
  ['stack-run',createSequenceGame,runSequenceBot,'sequence-discard'],
  ['malice-duel',createSequenceGame,runSequenceBot,'sequence-discard'],
  ['eight-shift',createEightGame,runEightBot,'eight-pass'],
  ['tile-royale',createTileGame,runTileBot,'tile-end'],
  ['phase-quest',createContractGame,runContractBot,'contract-discard'],
  ['contract-club',createContractGame,runContractBot,'contract-discard'],
  ['shanghai-nights',createContractGame,runContractBot,'contract-discard'],
  ['crown-circuit',createContractGame,runContractBot,'contract-discard']
];
for(const [mode,make,act] of cases) {
 test(`${mode}: bot works from seat 3 without reading a rival's hidden cards`,()=>{
  const input=make({mode,seed:104,playerCount:6});
  input.active=3;
  const original=structuredClone(input);
  const after=act(input,'standard',3);
  assert.notDeepEqual(after,original,'bot should make a move');
  assert.deepEqual(input,original,'input should remain unchanged');
  const tampered=structuredClone(input);
  tampered.players[0].hand?.forEach(c=>c.value=99);
  tampered.players[0].stock?.forEach(c=>c.value=99);
  tampered.players[0].rack?.forEach(c=>c.value=99);
  const again=act(tampered,'standard',3);
  assert.deepEqual(after.players[3],again.players[3],'rival hidden cards should not influence bot decisions');
 });
}

test('six-seat private table can fill vacant seats with five uniquely styled bots',async()=>{
 const store=new RoomStore();const host=await store.create({mode:'eight-shift',maxPlayers:6,name:'Host User',avatar:1});
 const action={type:'bot-fill',level:'standard',revision:host.view.revision};
 const result=await store.hostAction(host.code,host.token,action);
 assert.equal(result.view.status,'playing');
 assert.equal(result.view.players.length,6);
 assert.equal(result.view.players.filter(p=>p.bot).length,5);
 assert.ok(result.view.players.slice(1).every(p=>p.connected));
 assert.ok(result.view.players.slice(1).every(p=>p.name!=='House Bot'));
 assert.equal(new Set(result.view.players.map(p=>p.avatar)).size,6);
 assert.equal(BOT_PERSONAS.length,16);
 for(const persona of BOT_PERSONAS){
  assert.ok(persona.taunts.length>=3);
  assert.ok(persona.style);
 }
 const before=store.rooms.get(host.code).game;
 const first=before.players[0].hand[0];
 before.activeSuit=first.suit;
 const turn=await store.move(host.code,host.token,{type:'eight-play',index:0,
   suit:first.value===8?'hearts':null,revision:result.view.revision});
 assert.ok(turn.game.winner!==null||turn.game.active===0,'server advanced all computer opponents');
 assert.equal(turn.game.players.length,6);
 assert.ok(turn.game.players.slice(1).every(p=>p.hand.every(c=>c===null)),'bot hands stay private');
 assert.equal(JSON.stringify(turn).includes('tokenHash'),false);
});

test('only host can add bots, and bot seats cannot authenticate or be added after start',async()=>{
 const store=new RoomStore();const a=await store.create({mode:'stack-run',maxPlayers:4,name:'Host User',avatar:1});
 const b=await store.join(a.code,{name:'Human Guest',avatar:2});
 await assert.rejects(store.hostAction(a.code,b.token,{type:'bot-fill',revision:b.view.revision}),/Only the host/);
 const mid=store.view(a.code,a.token);
 await store.hostAction(a.code,a.token,{type:'bot-fill',revision:mid.revision});
 const view=store.view(a.code,a.token);
 assert.equal(view.players.length,4);
 await assert.rejects(store.hostAction(a.code,a.token,{type:'bot-fill',revision:view.revision}),/before starting/);
 assert.throws(()=>store._auth(a.code,'bot-secret-not-real'),/Access denied/);
});
