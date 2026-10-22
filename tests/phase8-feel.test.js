import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMovePrompt,readGameBeat,visibleHandSignature} from '../src/game-feel.js';
const game=(kind,fields={})=>({kind,winner:null,roundWinner:null,active:0,players:[{hand:[],rack:[],stock:[],grid:[]},{hand:[]}],...fields});

test('every game genre offers accurate next-move guidance without mutating state',()=>{
 const cases=[
  [game('sequence'),{},/Make your move/],
  [game('contract',{step:'draw'}),{},/Draw a card/],
  [game('contract',{step:'play'}),{canLay:true},/have your contract/],
  [game('rack',{step:'replace',held:{value:37}}),{},/37/],
  [game('tiles'),{},/Pick your tiles/],
  [game('tiles'),{validTile:true,selected:{type:'tiles',indices:[0,1,2]}},/Valid tile group/],
  [game('low',{step:'place',held:{value:-2}}),{},/grid position/],
  [game('eights',{drew:false}),{legalCount:2},/playable card/]
 ];
 for(const [state,opts,expected] of cases){
  const copy=structuredClone(state);
  const prompt=nextMovePrompt(state,opts.selected,opts);
  assert.match(`${prompt.title} ${prompt.detail}`,expected);
  assert.deepEqual(state,copy);
 }
});
test('waiting, completed match and round override the move guide',()=>{
 assert.match(nextMovePrompt(game('sequence',{active:1})).title,/opponent/);
 assert.match(nextMovePrompt(game('contract',{roundWinner:0})).title,/completed/);
 assert.match(nextMovePrompt(game('low',{winner:0})).title,/finished/);
 assert.match(nextMovePrompt(game('eights',{winner:-1})).title,/draw/);
});
test('game beats celebrate true progress and never claim victory on an invalid move',()=>{
 assert.deepEqual(readGameBeat(game('sequence',{players:[{stock:[1,2,3]}]}),game('sequence',{players:[{stock:[1,2]}]})).type,'play');
 assert.equal(readGameBeat(game('eights',{players:[{hand:[1,2]}]}),game('eights',{players:[{hand:[1,2]}]})),null);
 assert.equal(readGameBeat(game('tiles',{players:[{rack:[1,2,3]}]}),game('tiles',{players:[{rack:[1]}]})).type,'play');
 assert.equal(readGameBeat(game('low',{players:[{grid:[{cleared:false}]}]}),game('low',{players:[{grid:[{cleared:true}]}]})).type,'clear');
 assert.equal(readGameBeat(game('rack',{players:[{rack:[{value:3}]}]}),game('rack',{players:[{rack:[{value:4}]}]})).type,'play');
 assert.equal(readGameBeat(game('contract'),game('contract',{roundWinner:0})).type,'round');
 assert.equal(readGameBeat(game('sequence'),game('sequence',{winner:0})).type,'win');
 assert.equal(readGameBeat(game('sequence'),game('sequence',{winner:1})).type,'lose');
 assert.equal(readGameBeat(game('sequence'),game('contract')),null);
});
test('visible motion signatures include only the current players cards, not the opponents secrets',()=>{
 const before=game('eights',{players:[{hand:[{value:8,suit:'spades'}]}, {hand:['PRIVATE']} ]});
 const changed=structuredClone(before);changed.players[1].hand=['DIFFERENT PRIVATE'];
 assert.equal(visibleHandSignature(before),visibleHandSignature(changed));
 changed.players[0].hand[0].value=7;
 assert.notEqual(visibleHandSignature(before),visibleHandSignature(changed));
});
test('phase eight main UI includes accessible ambience switch and concise guidance',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(html,/aria-label="Your next move"/);
 assert.match(html,/data-action="toggle-ambience"/);
 assert.match(html,/prefers-reduced-motion/);
 assert.match(html,/requestAnimationFrame|\.animate\(/);
});
