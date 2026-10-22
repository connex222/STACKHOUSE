/** Peak-normalise shipped game cues without ever modifying provider masters.
 * Requires ffmpeg/ffprobe (available on GitHub-hosted Ubuntu runners).
 * Safe to rerun: a cue already near -5 dBFS is left unchanged.
 */
import {spawnSync} from 'node:child_process';
import {mkdtemp,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','assets','audio');
const cues=['ui-tap','card-place','card-deal','card-shuffle','tile-place','round-complete','victory','lose','error'];
const targetPeak=-5,minimumGain=.7,maxGain=17;
let changes=0;
for(const cue of cues){
 const input=join(root,`${cue}.mp3`);
 const measure=spawnSync('ffmpeg',['-hide_banner','-nostdin','-i',input,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 if(measure.status!==0)throw Error(`Cannot analyse ${cue}: ${measure.stderr}`);
 const peak=Number(measure.stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1]);
 if(!Number.isFinite(peak))throw Error(`No valid audio peak in ${cue}`);
 const requested=targetPeak-peak;
 if(requested<minimumGain){console.log(`${cue}: peak ${peak} dBFS — already healthy`);continue;}
 const gain=Math.min(maxGain,requested);
 const dir=await mkdtemp(join(tmpdir(),'stackhouse-level-'));
 const output=join(dir,`${cue}.mp3`);
 try {
  // Conservative ceiling; separate loudness for playing cards and reward jingles.
  const filter=`volume=${gain.toFixed(2)}dB,alimiter=limit=0.94:level=0`;
  const conversion=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-af',filter,'-codec:a','libmp3lame','-q:a','3',output],{encoding:'utf8'});
  if(conversion.status!==0)throw Error(`Cannot normalise ${cue}: ${conversion.stderr}`);
  const verify=spawnSync('ffmpeg',['-hide_banner','-nostdin','-i',output,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
  const newPeak=Number(verify.stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1]);
  if(verify.status!==0||!Number.isFinite(newPeak)||newPeak>-.3||newPeak<peak+Math.min(1,gain)/2)
   throw Error(`Audio verification failed: ${cue}, ${peak} => ${newPeak} dBFS`);
  await rename(output,input);changes++;
  console.log(`${cue}: ${peak} => ${newPeak} dBFS (boost ${gain.toFixed(1)} dB)`);
 } finally {await rm(dir,{recursive:true,force:true});}
}
console.log(`Levelled ${changes}/${cues.length} playable sounds. Provider masters unchanged.`);
