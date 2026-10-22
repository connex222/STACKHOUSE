import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio,clampVolume} from '../src/audio.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('A temporarily locked phone browser may retry after Test without blacklisting the cue',async()=>{
 let attempts=0,failed=0,success=0;
 class LockedAudio{
  constructor(){this.paused=true;this.ended=false;}
  pause(){this.paused=true;}
  play(){attempts++;return attempts===1?Promise.reject(Object.assign(Error('User gesture required'),{name:'NotAllowedError'})):Promise.resolve();}
 }
 const sounds=createGameAudio({Audio:LockedAudio,onPlaybackError:()=>failed++,onPlaybackSuccess:()=>success++});
 sounds.setEnabled(true);
 assert.equal(sounds.play('win',{force:true}),true);
 await settle();assert.equal(failed,1);
 sounds.resetFailures();assert.equal(sounds.play('win',{force:true}),true);
 await settle();assert.equal(success,1);assert.equal(attempts,2);
});

test('Broken or unsupported media triggers fallback and can be retried with explicit reset',async()=>{
 let attempts=0,failures=0;
 class BrokenAudio{constructor(){this.paused=true;this.ended=false;}pause(){this.paused=true;}play(){attempts++;return Promise.reject(Object.assign(Error('Bad format'),{name:'NotSupportedError'}));}}
 const engine=createGameAudio({Audio:BrokenAudio,onPlaybackError:()=>failures++});
 engine.setEnabled(true);
 engine.play('card');await settle();
 assert.equal(engine.play('card',{force:true}),false);
 assert.equal(attempts,1);
 engine.resetFailures();engine.play('card',{force:true});await settle();
 assert.equal(attempts,2);assert.equal(failures,2);
});

test('Clamped volume is honoured on every cue, and zero does not request playback',()=>{
 let plays=0;
 class SampleAudio{constructor(){this.paused=true;this.ended=false;}pause(){this.paused=true;}play(){plays++;return Promise.resolve();}}
 const sounds=createGameAudio({Audio:SampleAudio,volume:50});
 sounds.setEnabled(true);
 sounds.play('win');
 assert.equal(plays,1);
 sounds.setVolume(0);
 assert.equal(sounds.play('win',{force:true}),false);
 assert.equal(plays,1);
 sounds.setVolume(100);
 assert.equal(sounds.play('win',{force:true}),true);
 assert.equal(plays,2);
 assert.equal(sounds.volume,100);
 assert.deepEqual([-2,0,55.7,150,'garbage'].map(clampVolume),[0,0,56,100,85]);
});

test('Sound settings are exposed to users without autoplay promises',async()=>{
 const fs=await import('node:fs/promises');
 const app=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
 for(const fragment of ['id="sound-volume"','id="sound-status"','case \'test-sound\'','setSoundStatus(',"onPlaybackError(type,error)"])
  assert.ok(app.includes(fragment),`Missing accessible sound feature ${fragment}`);
});
