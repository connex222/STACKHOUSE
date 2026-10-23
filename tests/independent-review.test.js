import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getGameModule,GAME_MODULES} from '../src/server/game-modules.js';
import {RoomStore} from '../src/server/rooms.js';

const modes=['stack-run','malice-duel','phase-quest','contract-club','shanghai-nights',
  'crown-circuit','number-ladder','tile-royale','low-glow','eight-shift'];

test('all ten variants resolve to six reusable game modules',()=>{
 assert.equal(Object.keys(GAME_MODULES).length,6);
 for(const mode of modes){
  const api=getGameModule(mode);
  for(const entry of ['create','viewForSeat','viewForTV','listLegalActions','applyAction',
    'botMove','isFinished','scores'])assert.equal(typeof api[entry],'function');
  const game=api.create({mode,seed:123,playerCount:2,matchLength:'full'});
  assert.equal(api.viewForSeat(game,0).players.length,2);
  assert.ok(Array.isArray(api.listLegalActions(game,0)));
  assert.equal(api.isFinished(game),false);
  assert.ok(!JSON.stringify(api.viewForTV(game)).includes('seed'));
 }
});

test('spectator module projection never contains draw pile or secret seed',()=>{
 const game=getGameModule('stack-run').create({mode:'stack-run',seed:13579,playerCount:6});
 const tv=getGameModule('stack-run').viewForTV(game);
 assert.ok(!('draw' in tv));assert.ok(!('seed' in tv));
 const seat=getGameModule('stack-run').viewForSeat(game,0);
 assert.ok(seat.players.slice(1).every(p=>p.hand.every(c=>c===null)));
});

test('module action candidate types do not authorize a non-active opponent',()=>{
 const game=getGameModule('stack-run').create({mode:'stack-run',seed:42,playerCount:2});
 assert.deepEqual(getGameModule('stack-run').listLegalActions(game,1),[]);
 assert.ok(getGameModule('stack-run').listLegalActions(game,0).includes('sequence-play'));
});

test('offline edition has no HTTP stylesheet, font or asset resource URLs',async()=>{
 const html=await readFile(new URL('../PLAY-OFFLINE.html',import.meta.url),'utf8');
 for(const forbidden of [/https?:\/\//i,/fonts\.googleapis\.com/i,/fonts\.gstatic\.com/i,
   /<link[^>]+href\s*=\s*["']https?:/i,/@import\s+url\s*\(\s*["']?https?:/i])
  assert.doesNotMatch(html,forbidden);
});

test('host sees storage durability notice for memory-only rooms',async()=>{
 const store=new RoomStore();const {view}=await store.create({mode:'stack-run',name:'Tester',avatar:1});
 assert.equal(view.storage,'memory-only');
});
