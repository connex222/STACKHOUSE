/** Stackhouse sound bank: preloaded tactile samples, with optional procedural fallback.
 * No audio plays before a user enables sound. All sound events are presentation-only.
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
export const AUDIO_VERSION='1';
/** A browser does not own autoplay permission until a user gesture; call warm() from the sound toggle. */
export function createGameAudio({Audio=globalThis.Audio, clock=()=>Date.now()}={}) {
 const pools=new Map(),played=new Map();
 const GAIN={tap:.30,select:.30,card:.36,deal:.28,draw:.32,sort:.25,clear:.38,round:.42,success:.42,win:.52,lose:.33,error:.24};
 const DEBOUNCE={tap:70,select:70,card:50,deal:160,draw:80,sort:200,clear:180,round:800,success:350,win:1600,lose:1600,error:250};
 let enabled=false;
 function warm(){if(!Audio)return;for(const [name,path] of Object.entries(SOUND_ASSETS)){
  if(pools.has(name))continue;
  const voices=[];for(let i=0;i<3;i++){const audio=new Audio(path);audio.preload='auto';voices.push(audio);}pools.set(name,voices);
 }}
 function setEnabled(next){enabled=Boolean(next);if(enabled)warm();else for(const voices of pools.values())for(const voice of voices){voice.pause?.();try{voice.currentTime=0;}catch{}}}
 function play(type='tap'){
  if(!enabled||!Audio)return false;
  const name=SOUND_MAP[type]||'ui-tap', now=clock(),previous=played.get(name)??-Infinity;
  if(now-previous<(DEBOUNCE[type]??75))return false;
  const voices=pools.get(name);if(!voices?.length)return false;
  const voice=voices.find(a=>a.paused||a.ended)||voices[0];
  try{voice.pause();voice.currentTime=0;voice.volume=GAIN[type]??.3;
   const result=voice.play();if(result?.catch)result.catch(()=>{});played.set(name,now);return true;
  }catch{return false;}
 }
 return {play,warm,setEnabled,get enabled(){return enabled;}};
}
