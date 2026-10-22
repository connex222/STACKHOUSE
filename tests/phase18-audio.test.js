import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio,SOUND_ASSETS,SOUND_MAP} from '../src/audio.js';
test('all events map to a packaged sound asset',()=>{for(const sound of Object.values(SOUND_MAP))assert.ok(SOUND_ASSETS[sound]);});
test('mute and throttling are enforced without crashing',()=>{
 let time=1000,plays=0;class MockAudio{constructor(path){this.path=path;this.paused=true;this.ended=false;}pause(){this.paused=true;}play(){plays++;this.paused=false;return Promise.resolve();}}
 const engine=createGameAudio({Audio:MockAudio,clock:()=>time});
 assert.equal(engine.play('card'),false);engine.setEnabled(true);
 assert.equal(engine.play('card'),true);assert.equal(engine.play('card'),false);time+=100;
 assert.equal(engine.play('card'),true);assert.equal(plays,2);engine.setEnabled(false);assert.equal(engine.play('card'),false);
});
