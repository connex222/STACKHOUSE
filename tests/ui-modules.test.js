import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {avatars,games,gameFamilies,GROUP_GAME_IDS} from '../src/ui/game-catalogue.js';
import {renderRulesMarkup} from '../src/ui/game-instructions.js';
import {renderMobileActionBar} from '../src/ui/mobile-actions.js';
import {MISSION_SETS} from '../src/engine/contracts.js';

test('Six-family launcher retains every original game and existing mode ID',()=>{
 assert.equal(gameFamilies.length,6);assert.equal(games.length,10);assert.equal(avatars.length,16);
 assert.deepEqual(new Set(gameFamilies.flatMap(f=>f.variants)),new Set(games.map(g=>g.id)));
 assert.equal(GROUP_GAME_IDS.size,8);
});
test('Rule instructions render every game without the global client or DOM',()=>{
 for(const game of games){
  const html=renderRulesMarkup(game,game.id,MISSION_SETS);
  assert.ok(html.length>150,game.id);
  assert.match(html,/<(p|ol)>/);
 }
});
test('Mobile action presenter is isolated from app state and helps keyboard users',()=>{
 const helper={sequencePileTargets:()=>[],canReplenishSequenceHand:()=>false,canPassSequenceTurn:()=>false};
 const preview=renderMobileActionBar({screen:'game',game:{kind:'eights',active:0,winner:null,drew:false,roundWinner:null},selected:null,drawerOpen:false},helper);
 assert.match(preview,/data-action="eight-draw"/);
 assert.match(preview,/aria-controls="mobile-table-drawer"/);
 assert.equal(renderMobileActionBar({screen:'home',game:null},helper),'');
});
test('Offline builder includes modular UIs and both planners before their consumers',async()=>{
 const source=await readFile(new URL('../scripts/build-offline.js',import.meta.url),'utf8');
 for(const name of ['game-catalogue.js','mobile-actions.js','game-instructions.js','sequence-planner.js','eight-planner.js'])assert.ok(source.includes(name));
 const files=source.slice(source.indexOf("for(const file of ["),source.indexOf("]) {",source.indexOf("for(const file of [")));
 assert.ok(files.indexOf('game-catalogue.js')<files.indexOf("'src/main.js'"));
 assert.ok(files.indexOf('sequence-planner.js')<files.indexOf("'src/engine/sequence.js'"));
});

test('Playing screens insert the mobile action bar exactly once',async()=>{
 const src=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const render=src.slice(src.indexOf('function render(){'),src.indexOf('function start(',src.indexOf('function render(){')));
 assert.match(render,/\$\{mobileActionBar\(\)\}/);
 assert.equal(render.split('${mobileActionBar()}').length-1,1);
});
