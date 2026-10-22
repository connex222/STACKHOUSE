import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {SOUND_ASSETS} from '../src/audio.js';

const read=async path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('diagnostic tone and recorded sample are independent controls',async()=>{
 const app=await read('src/main.js');
 for(const token of [
  'data-action="test-tone"','Play diagnostic tone','case \'test-tone\'',
  "case 'test-sound'", "playFallbackSound('win',true)",
  'Browser accepted the recorded sample.'
 ])assert.ok(app.includes(token),`Missing sound diagnostic ${token}`);
 assert.match(app,/diagnostic\?\.14:/,'Diagnostic oscillator must use stronger gain than ambient effects');
});

test('all playable audio cues exist and provider master files are never normalised',async()=>{
 const fs=await import('node:fs/promises');
 const script=await read('scripts/normalise-audio.mjs');
 assert.ok(script.includes("'assets','audio'"));
 assert.doesNotMatch(script,/masters\//,'Never process archived masters');
 for(const uri of Object.values(SOUND_ASSETS)){
  const bytes=await fs.readFile(new URL(`..${uri}`,import.meta.url));
  assert.ok(bytes.byteLength>900,`${uri} must not be empty`);
  assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===0xff,`${uri} is not MP3`);
 }
});

test('packaged fallback cues have safe and usable audio peaks where ffmpeg is present',{timeout:25000},()=>{
 const available=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
 if(available.error)return;
 for(const uri of Object.values(SOUND_ASSETS)){
  const path=new URL(`..${uri}`,import.meta.url).pathname;
  const check=spawnSync('ffmpeg',['-hide_banner','-nostdin','-i',path,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
  assert.equal(check.status,0,uri);
  const peak=Number(check.stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1]);
  const floor=process.env.STACKHOUSE_LEVELLED_AUDIO==='1'?-10:-45;
  assert.ok(peak<=-.3&&peak>=floor,`${uri} peak ${peak} dBFS should be present and unclipped`);
 }
});

test('normalisation is repeatable without boosting already healthy cues',async()=>{
 if(spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).error)return;
 const job=spawnSync(process.execPath,[new URL('../scripts/normalise-audio.mjs',import.meta.url).pathname],{encoding:'utf8'});
 if(job.error?.code==='ENOENT')return;
 assert.equal(job.status,0,job.stderr);
 assert.match(job.stdout,/Levelled 0\/9 playable sounds/);
});
