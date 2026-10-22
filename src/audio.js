/** Stackhouse sound bank: tactility first, resilient to mobile browser audio locks.
 * Audio signals are decorative; muted or unavailable sound never blocks gameplay.
 */
export const SOUND_MAP = Object.freeze({
 tap:'ui-tap',select:'ui-tap',card:'card-place',deal:'card-deal',draw:'card-place',
 sort:'card-shuffle',clear:'tile-place',round:'round-complete',success:'round-complete',
 win:'victory',lose:'lose',error:'error'
});
export const SOUND_ASSETS = Object.freeze({
 'ui-tap':'/assets/audio/ui-tap.mp3',
 'card-place':'/assets/audio/card-place.mp3',
 'card-deal':'/assets/audio/card-deal.mp3',
 'card-shuffle':'/assets/audio/card-shuffle.mp3',
 'tile-place':'/assets/audio/tile-place.mp3',
 'round-complete':'/assets/audio/round-complete.mp3',
 'victory':'/assets/audio/victory.mp3',
 'lose':'/assets/audio/lose.mp3',
 'error':'/assets/audio/error.mp3'
});
export const AUDIO_VERSION='3';
export function clampVolume(value){
 const num=Number(value);
 return Number.isFinite(num)?Math.min(100,Math.max(0,Math.round(num))):85;
}
/** Expects a browser Audio constructor; callbacks never change the game state. */
export function createGameAudio({Audio=globalThis.Audio,clock=()=>Date.now(),onPlaybackError=()=>{},onPlaybackSuccess=()=>{},volume=85}={}){
 const pools=new Map(),played=new Map(),failed=new Set();
 const GAIN={tap:.70,select:.70,card:.80,deal:.65,draw:.75,sort:.62,clear:.80,round:.85,success:.85,win:.90,lose:.72,error:.62};
 const DEBOUNCE={tap:70,select:70,card:50,deal:160,draw:80,sort:200,clear:180,round:800,success:350,win:1600,lose:1600,error:250};
 let enabled=false,masterVolume=clampVolume(volume);
 function warm(){if(!Audio)return;for(const [name,path] of Object.entries(SOUND_ASSETS)){
  if(pools.has(name))continue;
  const voices=[];for(let i=0;i<3;i++){
   const audio=new Audio(path);audio.preload='auto';voices.push(audio);
  }pools.set(name,voices);
 }}
 function setEnabled(next){
  enabled=Boolean(next);
  if(enabled)warm();else for(const voices of pools.values())for(const voice of voices){
   voice.pause?.();try{voice.currentTime=0;}catch{}
  }
 }
 function setVolume(value){masterVolume=clampVolume(value);}
 function resetFailures(){failed.clear();}
 function play(type='tap',{force=false}={}){
  if(!enabled||!Audio||masterVolume===0)return false;
  const name=SOUND_MAP[type]||'ui-tap',now=clock(),previous=played.get(name)??-Infinity;
  if(!force&&now-previous<(DEBOUNCE[type]??75))return true;
  if(failed.has(name))return false;
  const voices=pools.get(name);if(!voices?.length)return false;
  const voice=voices.find(a=>a.paused||a.ended)||voices[0];
  try{
   voice.pause();voice.currentTime=0;
   voice.volume=Math.min(1,(GAIN[type]??.7)*(masterVolume/100));
   const result=voice.play();
   if(result?.then)Promise.resolve(result).then(
    ()=>{if(enabled)onPlaybackSuccess(type);},
    error=>{
     if(error?.name==='AbortError')return; // A later sound took this voice.
     // Autoplay permissions are temporary, not a broken media file. A later tap must retry.
     if(error?.name!=='NotAllowedError')failed.add(name);
     onPlaybackError(type,error);
    }
   );
   played.set(name,now);return true;
  }catch(error){
   if(error?.name!=='NotAllowedError')failed.add(name);
   onPlaybackError(type,error);return false;
  }
 }
 return {play,warm,setEnabled,setVolume,resetFailures,get enabled(){return enabled;},get volume(){return masterVolume;}};
}
