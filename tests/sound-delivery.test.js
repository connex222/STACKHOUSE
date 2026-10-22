import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {createGameAudio,SOUND_ASSETS} from '../src/audio.js';

async function startWeb(){
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATABASE_URL:'',ROOM_DATA_FILE:''},stdio:'pipe'});
 const base=`http://127.0.0.1:${port}`;
 for(let tries=0;tries<100;tries++){
  if(child.exitCode!==null)throw Error('Server exited before health check');
  try {if((await fetch(`${base}/health`)).ok){return {base,stop:async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');}};}}catch{}
  await new Promise(resolve=>setTimeout(resolve,40));
 }
 child.kill();throw Error('Server failed to start');
}

test('Every game sound is publicly delivered with a playable MIME type, not HTTP 403',{timeout:15000},async()=>{
 const {base,stop}=await startWeb();
 try {
  for(const [cue,uri] of Object.entries(SOUND_ASSETS)){
   const response=await fetch(`${base}${uri}`);
   assert.equal(response.status,200,`${cue} should be served, not denied`);
   assert.equal(response.headers.get('content-type'),'audio/mpeg',`${cue}: browser needs audio MIME`);
   assert.ok((await response.arrayBuffer()).byteLength>400,`${cue} should have actual audio data`);
   assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  }
  assert.equal((await fetch(`${base}/src/server/rooms.js`)).status,403,'Do not loosen private source protections');
 }finally{await stop();}
});

test('A rejected audio.play promise triggers a fallback and suppresses further broken sample attempts',async()=>{
 let calls=0,fallback=0;
 class BrokenAudio{
  constructor(){this.paused=true;this.ended=false;}
  pause(){this.paused=true;}
  play(){calls++;return Promise.reject(Error('Media decoding failed'));}
 }
 const engine=createGameAudio({Audio:BrokenAudio,onPlaybackError:()=>fallback++});
 engine.setEnabled(true);
 assert.equal(engine.play('card'),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fallback,1,'Rejected playback must reach the fallback');
 assert.equal(engine.play('card',{force:true}),false,'Known broken assets should not swallow future fallbacks');
 assert.equal(calls,1);
 engine.setEnabled(false);
 assert.equal(engine.play('win',{force:true}),false);
});

test('Explicit test requests can bypass normal repeat throttling',()=>{
 let now=1000,played=0;
 class GoodAudio{constructor(){this.paused=true;this.ended=false;}pause(){this.paused=true;}play(){played++;return Promise.resolve();}}
 const audio=createGameAudio({Audio:GoodAudio,clock:()=>now});
 audio.setEnabled(true);
 assert.equal(audio.play('win',{force:true}),true);
 assert.equal(audio.play('win',{force:true}),true);
 assert.equal(played,2);
});
