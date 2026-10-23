import {createSequenceScreen} from './ui/screens/sequence.js';
import {createContractScreen} from './ui/screens/contract.js';
import {createRackScreen} from './ui/screens/rack.js';
import {createTileScreen} from './ui/screens/tile.js';
import {createLowScreen} from './ui/screens/low.js';
import {createEightScreen} from './ui/screens/eight.js';
import {renderMobileActionBar} from './ui/mobile-actions.js';
import {renderRulesMarkup} from './ui/game-instructions.js';
import {avatars, GROUP_GAME_IDS, games, gameFamilies} from './ui/game-catalogue.js';
import {createGameAudio} from './audio.js';
import {renderHostControls} from './ui/host-controls.js';
import {botPersona} from './bot-personalities.js';
import {classifyRoomRecovery} from './room-recovery.js';
import { sessionSeed } from './rng.js';
import {handTokens,reconcileHandOrder,moveHandToken,sortHandOrder} from './hand-order.js';
import {SOLO_SAVE_KEY,encodeSoloSave,decodeSoloSave} from './solo-save.js';
import {SOLO_RESULTS_KEY,decodeSoloResults,registerSoloResult,soloTotals} from './solo-records.js';
import {nextMovePrompt,readGameBeat,visibleHandSignature} from './game-feel.js';
import { createSequenceGame, sequencePileTargets, playSequenceCard, discardSequenceCard, passSequenceTurn, canPassSequenceTurn, replenishSequenceHand, canReplenishSequenceHand, runSequenceBot } from './engine/sequence.js';
import { createRackGame, rackDraw, rackReplace, rackDiscard, runRackBot } from './engine/rack.js';
import { createContractGame, currentMission, missionDescription, findContract, drawContractCard, discardContractCard, layContract, layOffContract, canLayOffContract, nextContractRound, runContractBot, MISSION_SETS } from './engine/contracts.js';
import {createTileGame,tileLay,tileEndTurn,runTileBot,tileMeld} from './engine/tiles.js';
import {createLowGame,lowDraw,lowReplace,lowFlip,lowNextRound,runLowBot} from './engine/lowcard.js';
import {createEightGame,eightCanPlay,eightPlay,eightDraw,eightPass,runEightBot,SUITS} from './engine/eights.js';

function chosenFamilyMode(family, root=document) {
 const descriptor=gameFamilies.find(item=>item.id===family);
 const chosen=root.getElementById(`family-${family}`)?.value;
 return descriptor?.variants.includes(chosen)?chosen:descriptor?.variants[0]??family;
}
function familyTile(family, index, soloRecords) {
 const g=games.find(item=>item.id===family.id),count=family.variants.length;
 const variantSelector=count>1?`<label class="family-selector-label" for="family-${family.id}">RULE SET</label>
 <select class="family-variant" id="family-${family.id}" aria-label="${family.title} rule set">${family.variants.map(mode=>{
 const option=games.find(item=>item.id===mode);
 return `<option value="${mode}">${option.title==='Stack Run'?'Classic':option.title==='Malice Duel'?'Malice':option.title}</option>`;
 }).join('')}</select>`:'';
 return `<article class="game-tile family-tile art-${g.art}"><div class="tile-art"><span class="art-icon" aria-hidden="true">${g.icon}</span><span class="art-sequence" aria-hidden="true">${count>1?`${count} RULE SETS`:g.kicker}</span></div>
 <div class="tile-body"><span class="tile-type">${escapeHtml(g.category)}</span><h3>${family.title}</h3><p>${family.description??g.description}</p>${variantSelector}
 <div class="tile-tags"><span>${count>1?`${count} complete rule sets`:g.tag}</span></div>
 <div class="tile-buttons"><button class="tile-play" data-action="start" data-family="${family.id}">Play the bot ${icon('arrow')}</button>
 <button class="tile-play tile-online" data-action="room-open" data-family="${family.id}">Private table ${icon('people',16)}</button>
 <button class="tile-rules" data-action="rules" data-family="${family.id}" aria-label="How to play ${family.title}">${icon('info',15)} How to play</button></div></div></article>`;
}
const savedAvatar=Number(localStorage.getItem('stackhouse.avatar')||'1');
const allowedBotLevels=['easy','standard','expert'];
const storedBotLevel=localStorage.getItem('stackhouse.botDifficulty');
const storedSoundVolume=Number(localStorage.getItem('stackhouse.soundVolume') ?? 85);
const initialSoundVolume=Number.isFinite(storedSoundVolume)?Math.max(0,Math.min(100,storedSoundVolume)):85;
const ui={screen:'home',drawerOpen:false,soloBotCount:1,mode:null,game:null,online:null,roomMode:'stack-run',roomFormat:'single',roomCapacity:2,roomMatchLength:'full',soloContractLength:'full',botDifficulty:allowedBotLevels.includes(storedBotLevel)?storedBotLevel:'standard',roomCode:'',roomName:localStorage.getItem('stackhouse.nickname')||'',netStatus:'',roomRecovery:null,avatarId:avatars.some(a=>a.id===savedAvatar)?savedAvatar:1,
  soundOn:localStorage.getItem('stackhouse.sound')!=='false',soundVolume:initialSoundVolume,soundStatus:'Press Test to check audio.',soundTestPending:false,audioSettingsOpen:false,ambienceOn:localStorage.getItem('stackhouse.ambience')==='true',moment:null,momentTimer:null,lowAction:'replace',modal:null,selected:null,toast:null,toastTimer:null,handOrders:{},arranging:false,arrangeFrom:null,orderMessage:'',orderUndo:[],matchId:null};
const app=document.getElementById('app');
// Browser storage can be disabled (e.g. privacy mode). The games still work.
function savedSolo(){try{return decodeSoloSave(localStorage.getItem(SOLO_SAVE_KEY));}catch{return null;}}
function readSoloResults(){try{return decodeSoloResults(localStorage.getItem(SOLO_RESULTS_KEY));}catch{return decodeSoloResults(null);}}
function saveSolo(){
 if(ui.online||!ui.mode||!ui.game)return;
 try {
  if(ui.game.winner!==null&&ui.matchId){
   const completed=registerSoloResult(localStorage.getItem(SOLO_RESULTS_KEY),{id:ui.matchId,mode:ui.mode,winner:ui.game.winner});
   if(completed.changed)localStorage.setItem(SOLO_RESULTS_KEY,JSON.stringify(completed.value));
  }
  localStorage.setItem(SOLO_SAVE_KEY,encodeSoloSave({mode:ui.mode,game:ui.game,handOrders:ui.handOrders,matchId:ui.matchId}));}
 catch { /* Storage is optional; never block a card move. */ }
}
function resumeSolo(){
 const save=savedSolo();if(!save)return toast('No saved solo match was found.',true);
 stopOnline();ui.mode=save.mode;ui.game=save.game;ui.soloBotCount=save.game.players.length-1;ui.handOrders=save.handOrders;ui.matchId=save.matchId??null;
 ui.orderUndo=[];ui.arranging=false;ui.arrangeFrom=null;ui.selected=null;ui.modal=null;ui.moment=null;
 ui.screen='game';ui.lowAction='replace';sound('card');render();
 window.scrollTo({top:0,behavior:'instant'});
}
function pushOrderUndo(zone){
 if(Array.isArray(ui.handOrders[zone])){
  ui.orderUndo.push({zone,order:[...ui.handOrders[zone]]});
  if(ui.orderUndo.length>20)ui.orderUndo.shift();
 }
}
function undoHandOrder(){
 const previous=ui.orderUndo.pop();if(!previous)return;
 const cards=previous.zone==='tiles'?ui.game?.players[0]?.rack:ui.game?.players[0]?.hand;
 if(!cards)return;
 ui.handOrders[previous.zone]=reconcileHandOrder(previous.order,cards);
 ui.arrangeFrom=null;ui.orderMessage='Last hand arrangement undone.';
 saveSolo();sound('card');render();
}
const isOnline=()=>Boolean(ui.online);
const opponentProfile=()=>ui.online?.view?.players?.find((_,i)=>i!==ui.online.seat);
const opponentName=()=>opponentProfile()?.name||'House Bot';
const opponentImage=()=>asset(opponentProfile()?.avatar||14).image;
const roomOpponents=()=>ui.online?.view?.players?.filter((_,i)=>i!==ui.online.seat)??[];
function opponentRail(){
 if(!ui.game||(isOnline()?roomOpponents().length<2:ui.game.players.length<3))return '';
 const seats=isOnline()?ui.online.view.players:ui.game.players.map((player,i)=>({
  name:player.name,avatar:i===0?ui.avatarId:player.avatarId??(i+1),bot:i>0,connected:true
 }));
 const localOrder=isOnline()?[ui.online.seat,...seats.map((_,i)=>i).filter(i=>i!==ui.online.seat)]:seats.map((_,i)=>i);
 const current=ui.game?.active,finished=ui.game?.winner!==null,roundEnd=ui.game?.roundWinner!==null&&ui.game?.roundWinner!==undefined;
 return `<section class="group-opponents" aria-label="Players at the table">${localOrder.map((physical,relative)=>{
  const p=seats[physical],progress=ui.game?.players[relative];
  const isTurn=!finished&&!roundEnd&&current===relative;
  const score=progress?.mission!==undefined?`Contract ${progress.mission+1} · ${progress.score} pts`:progress?.hand?`${progress.hand.length} cards`:progress?.rack?`${progress.rack.length} tiles`:progress?.stock?`${progress.stock.length} in stockpile`:'';
  return `<div class="group-opponent ${isTurn?'seat-on-turn':''} ${relative===0?'seat-yourself':''}"><img src="${asset(p.avatar).image}" alt=""><div class="seat-info"><strong>${escapeHtml(p.name)}${relative===0?' (you)':''}</strong><small>${p.bot?'● House Bot':p.connected?'● Connected':'○ Reconnecting'}${score?` · ${escapeHtml(score)}`:''}</small></div>${isTurn?'<span class="seat-turn" aria-label="Current turn">TURN</span>':''}</div>`;
 }).join('')}</section>`;
}
const asset=id=>avatars.find(a=>a.id===id)||avatars[0];
const gameInfo=()=>games.find(g=>g.id===ui.mode)||games[0];
const escapeHtml=(s)=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const cls=(...names)=>names.filter(Boolean).join(' ');
function setSoundStatus(message){
 ui.soundStatus=message;
 const label=document.getElementById('sound-status');if(label)label.textContent=message;
}
const sampleAudio=createGameAudio({volume:ui.soundVolume,
 onPlaybackSuccess(type){if(type==='win'&&ui.soundTestPending){ui.soundTestPending=false;setSoundStatus('Browser accepted the recorded sample. If silent, press Tone to check your speakers.');}},
 onPlaybackError(type,error){
  const fallback=playFallbackSound(type);
  if(type==='win'&&ui.soundTestPending){
   ui.soundTestPending=false;
   setSoundStatus(error?.name==='NotAllowedError'
    ?'Browser blocked sound. Tap Test once more to unlock playback.'
    :fallback?'Sample unavailable; backup tone attempted.':'Audio unavailable in this browser.');
  }
 }
});
let audioContext;
let ambienceVoices=[];
let ambienceGain=null;
function contextForAudio(){
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)return null;
 audioContext ||=new AC();
 if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
 return audioContext;
}
// Soft procedural table sounds: no downloads, no large sound files or autoplay.
function sound(type='tap',force=false) {
 if(!ui.soundOn)return;
 if(sampleAudio.play(type,{force}))return;
 playFallbackSound(type);
}
function playFallbackSound(type='tap',diagnostic=false) {
 if(!ui.soundOn||ui.soundVolume===0)return false;
 try {
  const ctx=contextForAudio();if(!ctx)return false;
  const notes={tap:[392],select:[523],card:[330,495],deal:[262,392,523],draw:[294,440],
   sort:[440,554],clear:[523,659,880],round:[440,554,659],success:[523,659,784,1047],
   win:[392,523,659,784,1047],lose:[294,262,220],error:[220,175]};
  const frequencies=notes[type]||notes.tap;
  frequencies.forEach((freq,index)=>{
   const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+index*0.075;
   oscillator.type=['win','success','round','clear'].includes(type)?'sine':'triangle';
   oscillator.frequency.setValueAtTime(freq,t);
   if(type==='card'||type==='draw'||type==='deal')oscillator.frequency.exponentialRampToValueAtTime(freq*.91,t+.09);
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime((diagnostic?.14:(type==='win'?.052:.035))*(ui.soundVolume/85),t+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,t+.17);
   oscillator.connect(gain).connect(ctx.destination);oscillator.start(t);oscillator.stop(t+.19);
  });
  return true;
 }catch{return false;}
}
function syncAmbience(){
 const playing=ui.ambienceOn&&ui.screen==='game'&&!(typeof document.hidden==='boolean'&&document.hidden);
 if(!playing){
  if(ambienceGain&&audioContext){try{ambienceGain.gain.setTargetAtTime(.00001,audioContext.currentTime,.06);}catch{}}
  ambienceVoices.forEach(voice=>{try{voice.stop(audioContext?.currentTime+.3);}catch{}});
  ambienceVoices=[];ambienceGain=null;return;
 }
 if(ambienceVoices.length)return;
 try {
  const ctx=contextForAudio();if(!ctx)return;
  const gain=ctx.createGain();gain.gain.setValueAtTime(.00001,ctx.currentTime);
  gain.gain.setTargetAtTime(.005,ctx.currentTime,.55);gain.connect(ctx.destination);
  ambienceGain=gain;
  for(const frequency of [130.813,196.0,261.626]) {
   const voice=ctx.createOscillator();voice.type='sine';voice.frequency.value=frequency;
   voice.connect(gain);voice.start();ambienceVoices.push(voice);
  }
 }catch{ambienceVoices=[];ambienceGain=null;}
}
function showMoment(beat) {
 if(!beat)return;
 ui.moment=beat;
 clearTimeout(ui.momentTimer);
 ui.momentTimer=setTimeout(()=>{ui.moment=null;render();},2600);
 sound(({win:'win',lose:'lose',round:'round',clear:'clear',play:'card'})[beat.type]||'card');
}
function tableGuide(){
 if(!ui.game)return '';
 const game=ui.game;
 const opts={};
 if(game.kind==='contract'&&game.active===0&&game.step==='play')opts.canLay=Boolean(findContract(game.players[0].hand,currentMission(game,0)));
 if(game.kind==='tiles'&&ui.selected?.type==='tiles')opts.validTile=Boolean(tileMeld(ui.selected.indices.map(i=>game.players[0].rack[i]).filter(Boolean)));
 if(game.kind==='eights'&&game.active===0)opts.legalCount=game.players[0].hand.filter(card=>eightCanPlay(card,game)).length;
 const step=nextMovePrompt(game,ui.selected,opts);if(!step)return '';
 const glyph=step.tone==='celebrate'?'✦':step.tone==='wait'?'◌':step.tone==='finish'?'★':'➜';
 return `<section class="next-move-guide tone-${step.tone}" aria-label="Your next move"><span class="next-move-icon" aria-hidden="true">${glyph}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div></section>`;
}
function toast(message,error=false) {
  ui.toast={message,error};
  clearTimeout(ui.toastTimer);
  ui.toastTimer=setTimeout(()=>{ui.toast=null;render();},2800);
  sound(error?'error':'tap');render();
}
const icon=(name,size=18)=>{
  const icons={
    back:'<path d="m15 18-6-6 6-6"/>',sound:'<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    mute:'<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    sparkle:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
    play:'<path d="m8 5 11 7-11 7V5Z"/>',refresh:'<path d="M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16m0 5v-5h5"/>',
    deck:'<rect x="5" y="3" width="13" height="18" rx="2"/><path d="M9 7h5m-5 4h5m-5 4h5"/>',
    arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
    crown:'<path d="m2 8 4.5 4L12 4l5.5 8L22 8l-2 12H4L2 8Z"/>',
    close:'<path d="M18 6 6 18M6 6l12 12"/>'};
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${icons[name]||icons.sparkle}</svg>`;
};
function header() {
  const ava=asset(ui.avatarId);
  return `<header class="site-header"><button class="brand" data-action="home" aria-label="Stackhouse Social home">
    <img src="/assets/logo.webp" alt="" width="54" height="54"><span class="brand-word">STACKHOUSE <small>SOCIAL</small></span></button>
    <nav class="top-actions" aria-label="Main navigation"><span class="online-mark"><span></span> ${isOnline()?'Live private match':'Ten tables · Games Night Mix'}</span>
      <details class="audio-settings" id="audio-settings" ${ui.audioSettingsOpen?'open':''}><summary aria-label="Audio settings">${icon('sound',18)} <span>Audio settings</span></summary>
        <div class="audio-settings-panel" aria-label="Audio controls">
          <div class="audio-settings-toggles">      <button data-action="toggle-ambience" class="icon-button ${ui.ambienceOn?'ambience-on':''}" aria-pressed="${ui.ambienceOn}" aria-label="${ui.ambienceOn?'Turn off':'Turn on'} lounge ambience" title="${ui.ambienceOn?'Turn off':'Turn on'} lounge ambience">♫</button>
      <button data-action="toggle-sound" class="icon-button sound-toggle ${ui.soundOn?'sound-on':'sound-off'}" aria-pressed="${ui.soundOn}" aria-label="${ui.soundOn?'Turn off':'Turn on'} game sounds" title="${ui.soundOn?'Turn off':'Turn on'} game sounds">${icon(ui.soundOn?'sound':'mute',20)}<span class="sound-label">Sound ${ui.soundOn?'on':'off'}</span></button>
</div>
          <label class="sound-volume-control" for="sound-volume">Effects volume <input id="sound-volume" aria-label="Game sound volume" type="range" min="0" max="100" step="5" value="${ui.soundVolume}"></label>
          <div class="audio-settings-tests"><button data-action="test-sound" class="sound-test-btn" aria-label="Play test sound" title="Play a recorded sample">${icon('play',14)} Test recording</button>
          <button data-action="test-tone" class="sound-test-btn sound-tone-btn" aria-label="Play diagnostic tone" title="Check your device with a generated test tone">Test speaker</button></div>
          <output id="sound-status" class="sound-status" role="status" aria-live="polite">${escapeHtml(ui.soundStatus)}</output>
          <p class="audio-help">On phones, use your device media volume. Sound is optional and never affects the game.</p>
        </div>
      </details>
      <button data-action="avatars" class="account-button"><img src="${ava.image}" alt=""><span>My avatar</span><span class="small-chevron">⌄</span></button>
    </nav></header>`;
}
function homeScreen() {
 const resume=savedSolo(),soloRecords=readSoloResults(),soloSummary=soloTotals(soloRecords);
 return `<main id="main-content" tabindex="-1" class="home-page"><section class="hero" aria-label="Welcome to Stackhouse Social">
   <div class="hero-content"><div class="eyebrow"><span class="diamond">◆</span> WELCOME TO THE HOUSE</div>
     <h1>Good cards.<br><em>Great company.</em></h1>
     <p>Six game families with ten original rule sets, one spectacular place to play. Invite up to five friends to eight group tables, or challenge the House Bot.</p>
     <div class="hero-buttons"><button class="btn btn-primary" data-action="scroll-games">Choose your game ${icon('arrow')}</button>
       <button class="btn btn-ghost" data-action="room-open">Play with friends</button>${resume?`<button class="btn btn-outline" data-action="solo-resume">Continue ${escapeHtml(games.find(g=>g.id===resume.mode)?.title||'solo match')}</button>`:''}</div>
     <div class="hero-highlights"><div><b>6</b><small>GAME FAMILIES</small></div><div><b>16</b><small>CHARACTERS</small></div><div><b>${soloSummary.wins}</b><small>SOLO WINS ON THIS DEVICE</small></div></div>
   </div>
 </section>
 <section class="bot-level-section" aria-label="Bot challenge options"><label for="bot-level">House Bot challenge</label><select class="room-input bot-level-select" id="bot-level"><option value="easy" ${ui.botDifficulty==='easy'?'selected':''}>Easy</option><option value="standard" ${ui.botDifficulty==='standard'?'selected':''}>Standard</option><option value="expert" ${ui.botDifficulty==='expert'?'selected':''}>Expert</option></select><p>Easy, Standard and Expert are available in all ten solo games. Expert contract bots prioritise completing missions and avoiding costly discards.</p></section>
 <section class="bot-level-section" aria-label="Solo opponent count"><label for="solo-bot-count">Solo opponents</label>
 <select id="solo-bot-count" class="room-input bot-level-select">${[1,2,3,4,5].map(n=>`<option value="${n}" ${ui.soloBotCount===n?'selected':''}>${n} ${n===1?'House Bot':'House Bots'}</option>`).join('')}</select>
 <p>For eight group-compatible games, choose one to five opponents. Number Ladder and Low Glow remain head-to-head.</p></section>
 <section class="bot-level-section" aria-label="Contract match pace"><label for="solo-contract-length">Contract game match length</label><select class="room-input bot-level-select" id="solo-contract-length"><option value="full">Full journey · all contracts</option><option value="quick">Quick Match · 2 deals per player</option></select><p>Quick Match ranks players by contracts completed, then fewest penalty points. Applies to the four contract games only.</p></section><section id="games" class="game-collection"><div class="section-heading"><div><div class="eyebrow">THE GAME COLLECTION</div><h2>Pick your next obsession.</h2><p>Easy to learn. Hard to put down. Each table has its own rules.</p></div><span class="section-pill">SIX GAMES · TEN RULE SETS</span></div>
 <div class="game-grid family-grid">${gameFamilies.map((family,i)=>familyTile(family,i,soloRecords)).join('')}</div>
 </section>
 <section class="house-banner"><div><span class="eyebrow">YOUR PEOPLE. YOUR TABLE.</span><h2>Sixteen personalities.<br>One winning look.</h2><p>Pick your player portrait before your first deal. Your choice carries across every table.</p><button class="btn btn-primary" data-action="avatars">Explore the avatars ${icon('arrow')}</button></div><div class="banner-avatars">${[0,4,6,10,12,13].map(n=>`<img src="${avatars[n].image}" alt="${avatars[n].name}" loading="eager">`).join('')}</div></section>
 </main>`;
}
function playerBadge(name,image,meta,active=false) {
  name=escapeHtml(name);meta=escapeHtml(meta);
  return `<div class="player-identity ${active?'player-active':''}"><img src="${image}" alt=""><div><b>${name}</b><small>${meta}</small></div>${active?'<span class="turn-pill">YOUR TURN</span>':''}</div>`;
}
function seriesBoard(){
 if(!isOnline()||!ui.online.view?.series)return '';
 const series=ui.online.view.series,seat=ui.online.seat,champion=series.champion;
 const participants=ui.online.view.players;
 const result=champion===null?(series.roundLimit?`Games Night Mix · ${series.played}/${series.roundLimit} rounds`:
   series.format==='mixed'?'Games Night Mix · first to three wins':'First to three wins')
   :champion===-1?'GAMES NIGHT FINISHED · JOINT CHAMPIONS':champion===seat?'★ YOU ARE THE HOUSE CHAMPION':
   `★ ${escapeHtml(participants[champion]?.name??'Player')} IS THE HOUSE CHAMPION`;
 return `<section class="series-board" aria-label="Games night series scoreboard"><div class="series-heading"><span>★ GAMES NIGHT · SERIES ${series.number}</span><strong>${result}</strong></div>
 <div class="series-scores group-series-scores">${series.wins.map((wins,i)=>`<div><small>${i===seat?'You':escapeHtml(participants[i]?.name??`Player ${i+1}`)}</small><strong>${series.points?series.points[i]:wins}</strong><span>${series.points?`${wins} wins · ${series.points[i]} points`:`${'●'.repeat(wins)}${'○'.repeat(Math.max(0,series.target-wins))}`}</span></div>`).join('')}</div>
 <p class="series-foot">${series.played} finished ${series.played===1?'match':'matches'} · ${series.draws} ${series.draws===1?'draw':'draws'}${series.history.length?` · Recent results: ${series.history.slice(0,5).map(row=>`${row.mode?`${games.find(g=>g.id===row.mode)?.title||'Table'}: `:''}${row.winner===-1?'Draw':row.winner===seat?'You':escapeHtml(participants[row.winner]?.name??'Player')}`).join(' · ')}`:''}</p></section>`;
}
function rematchControl() {
 if(!isOnline() || ui.game?.winner===null)return '';
 const votes=ui.online.view?.rematchVotes??[],requested=Boolean(votes[ui.online.seat]);
 const otherVotes=votes.filter((_,seat)=>seat!==ui.online.seat).filter(Boolean).length;
 const others=votes.length-1;
 const series=ui.online.view?.series,seriesFinished=series?.champion!==null&&series?.champion!==undefined,again=seriesFinished?'new series':'rematch';
 const nextTable=series?.format==='mixed'?` Next up: ${escapeHtml(games.find(g=>g.id===series.nextMode)?.title||'next table')}.`:'';
 const message=requested?`Waiting for ${others-otherVotes} more ${others-otherVotes===1?'player':'players'} to agree`:
   (otherVotes?`${otherVotes} of ${others} other ${others===1?'player wants':'players want'} another game.`:`Play another ${again}?${nextTable}`);
 return `<div class="rematch-controls" role="status"><span>${message}</span><button class="btn ${requested?'btn-outline':'btn-primary'}" data-action="${requested?'rematch-cancel':'rematch-request'}">${requested?'Cancel request':`Request ${again}`}</button></div>`;
}
function turnNotice(){
 if(!isOnline()||!ui.game)return '';
 const completed=ui.game.winner!==null,roundOver=ui.game.roundWinner!==null&&ui.game.roundWinner!==undefined,playing=ui.game.active===0;
 const activeName=ui.game.players[ui.game.active]?.name??'Another player';
 const winnerName=ui.game.players[ui.game.roundWinner]?.name??'Another player';
 return `<div class="turn-notice ${completed?'turn-finished':playing?'turn-yours':'turn-theirs'}"><span class="turn-light" aria-hidden="true"></span><strong>${completed?'Match complete':roundOver?`${escapeHtml(winnerName)} won the round`:playing?'YOUR TURN':`${escapeHtml(activeName)}’s turn`}</strong><small>${completed?'Choose whether to play again':roundOver?'Continue to the next deal':playing?'Choose a card or make your move':'The table will update automatically'} · ${escapeHtml(ui.netStatus||'Connecting')}</small></div>`;
}
function activeStorageNotice(){
 if(!isOnline()||!ui.online?.view||ui.online.view.status!=='playing')return '';
 const storage=ui.online.view.storage;
 if(storage==='memory-only')return '<p class="room-small room-storage-warning" role="status">This private table is not protected against server restarts. Your phone can reconnect after a brief signal loss, but a service restart may end the match.</p>';
 if(storage==='filesystem-only')return '<p class="room-small room-storage-warning" role="status">Restart recovery is available only if the host has configured persistent disk storage.</p>';
 return '';
}
function hostTableControls() {
 if(!isOnline()||ui.online.view?.seat!==0)return '';
 return renderHostControls({...ui.online.view,game:ui.game},escapeHtml);
}

function gameTop(g) {
 return `<div class="game-back"><button class="back-link" data-action="home">${icon('back')} All games</button><span class="divider-dot">◆</span><span>${g.category}</span></div>
 <div class="game-heading"><div><div class="eyebrow">${isOnline()?`PRIVATE TABLE · ${ui.online.code}`:'NOW PLAYING · THE HOUSE TABLE'}</div><h1>${g.title}</h1><p>${g.kicker}</p></div><div class="game-heading-actions">${isOnline()?`<button class="btn btn-outline" data-action="room-invite">${icon('people',17)} Invite link</button>`:''}<button class="btn btn-outline" data-action="rules">${icon('info',17)} How to play</button></div>${turnNotice()}</div>${ui.online?.view?.paused?'<div class="table-paused" role="status">⏸ The host has paused this table. Moves are temporarily locked.</div>':''}<div class="desktop-table-extras">${seriesBoard()}${hostTableControls()}${opponentRail()}${activeStorageNotice()}${tableGuide()}</div>`;
}
function actionSidebar(extra='') {
 const state=ui.game,g=gameInfo();
 return `<aside class="sidebar" id="mobile-table-drawer" aria-label="Match details">
 <div class="mobile-drawer-heading"><strong>Table details</strong><button class="btn btn-outline" data-action="toggle-table-drawer" aria-label="Close game details">Close</button></div>
 <div class="mobile-extra-info">${seriesBoard()}${hostTableControls()}${opponentRail()}${activeStorageNotice()}${tableGuide()}</div>
 <div class="side-panel side-identity"><div class="eyebrow">TABLE DETAILS</div><div class="side-row"><span>Game</span><strong>${g.title}</strong></div><div class="side-row"><span>Opponents</span><strong>${isOnline()?roomOpponents().map(p=>escapeHtml(p.name)).join(', '):`${ui.game.players.length-1} House ${ui.game.players.length===2?'Bot':'Bots'}`}</strong></div><div class="side-row"><span>Mode</span><strong>${isOnline()?`Online private · ${ui.online.view.players.length} players`:'Local solo preview'}</strong></div>${isOnline()?`<div class="side-row"><span>Connection</span><strong>${ui.netStatus||'Connecting'} · ${roomOpponents().filter(p=>p.connected).length}/${roomOpponents().length} opponents online</strong></div>`:''}</div>${extra}
 <div class="side-panel log-panel"><h3>Table talk <span class="log-live">● Live</span></h3><ol>${state.log.slice(0,5).map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol></div>
 ${isOnline()?rematchControl():`<button class="reset-btn" data-action="restart">${icon('refresh',15)} Start a fresh match</button>`}
 </aside>`;
}
// Player-controlled presentation order; never mutate server-controlled hand arrays.
function getOrderedHand(zone,cards){
 const keys=handTokens(cards);
 ui.handOrders[zone]=reconcileHandOrder(ui.handOrders[zone]||[],cards);
 return ui.handOrders[zone].map((key,pos)=>({item:cards[keys.indexOf(key)],index:keys.indexOf(key),key,pos}));
}
function handToolbar(zone){
 const cards=zone==='tiles'?ui.game?.players[0]?.rack:ui.game?.players[0]?.hand;
 const hasColour=cards?.some(card=>card&&(card.colour||card.suit));
 return `<div class="hand-organiser" aria-label="Arrange your cards or tiles">
  <span class="hand-organiser-hint">${ui.arranging?'Tap one, then tap where it should go':'Drag to reorder · or use Arrange'}</span>
  <button class="arrange-toggle ${ui.arranging?'active':''}" data-action="hand-arrange" aria-pressed="${ui.arranging}">${ui.arranging?'Done arranging':'↔ Arrange'}</button>
  <button class="arrange-sort" data-action="hand-sort" data-zone="${zone}" data-sort="value">Sort ↑</button>
  ${hasColour?`<button class="arrange-sort" data-action="hand-sort" data-zone="${zone}" data-sort="colour">Sort suit/colour</button>`:''}
  <button class="arrange-sort" data-action="hand-undo" ${ui.orderUndo.length?'':'disabled'} aria-label="Undo last card or tile arrangement">↶ Undo</button>
 </div>`;
}
function handItems(zone,cards,face){
 return getOrderedHand(zone,cards).map(({item,index,key,pos})=>`<div class="hand-piece ${ui.arranging&&ui.arrangeFrom?.zone===zone&&ui.arrangeFrom.pos===pos?'arrange-picked':''}" data-order-zone="${zone}" data-order-position="${pos}" data-order-key="${escapeHtml(key)}" title="Drag to move. Keyboard: Alt + Left or Right arrow.">${face(item,index)}</div>`).join('');
}
function reorderHand(zone,from,to){
 const order=ui.handOrders[zone];
 if(!order||from===to||from<0||to<0||from>=order.length||to>=order.length)return false;
 pushOrderUndo(zone);ui.handOrders[zone]=moveHandToken(order,from,to);
 ui.orderMessage=`Moved item ${from+1} to position ${to+1}.`;
 ui.arrangeFrom=null;
 saveSolo();sound('sort');render();return true;
}
function resetArrangement(){ui.handOrders={};ui.orderUndo=[];ui.arranging=false;ui.arrangeFrom=null;ui.orderMessage='';}

// Each game has a separate presentation module. The shared context contains view helpers
// only; server-authoritative game actions and credentials never enter the templates.
const gameViewContext=()=>({ui,isOnline,gameInfo,gameTop,actionSidebar,playerBadge,
 opponentName,opponentImage,asset,escapeHtml,icon,handToolbar,handItems,rematchControl,
 sequencePileTargets,canPassSequenceTurn,canReplenishSequenceHand,MISSION_SETS,
 currentMission,missionDescription,findContract,canLayOffContract,tileMeld,eightCanPlay,SUITS});
const sequenceScreen=()=>createSequenceScreen(gameViewContext());
const contractScreen=()=>createContractScreen(gameViewContext());
const rackScreen=()=>createRackScreen(gameViewContext());
const tileScreen=()=>createTileScreen(gameViewContext());
const lowScreen=()=>createLowScreen(gameViewContext());
const eightScreen=()=>createEightScreen(gameViewContext());
function rulesText(){return renderRulesMarkup(gameInfo(),ui.mode,MISSION_SETS);}
function modalContent() {
 if(!ui.modal)return '';
 const avatarModal=ui.modal==='avatars';
 return `<div class="modal-scrim" data-action="dismiss" role="presentation"><section class="modal ${avatarModal?'avatars-modal':'rules-modal'}" role="dialog" aria-modal="true" aria-labelledby="modal-heading" tabindex="-1">
 <div class="modal-heading"><div><div class="eyebrow">${avatarModal?'THE STACKHOUSE CAST':'TABLE INSTRUCTIONS'}</div><h2 id="modal-heading">${avatarModal?'Choose your character':'How to play '+gameInfo().title}</h2></div><button class="close-btn" data-action="close" aria-label="Close">${icon('close',22)}</button></div>
 ${avatarModal?`<p class="modal-lead">Sixteen distinct personalities. The one you select appears at every table.</p><div class="avatar-grid">${avatars.map(a=>`<button class="avatar-choice ${a.id===ui.avatarId?'picked':''}" data-action="choose-avatar" data-id="${a.id}">
  <img src="${a.image}" alt="${a.name}" loading="eager"><span>${escapeHtml(a.name)}</span>${a.id===ui.avatarId?`<i>${icon('check',13)}</i>`:''}</button>`).join('')}</div>`
 :`<div class="rules-copy">${rulesText()}</div>`}
 <div class="modal-footer"><button class="btn btn-primary" data-action="close">${avatarModal?'Done — take a seat':'Got it'} ${icon('arrow')}</button></div>
 </section></div>`;
}
let lastMotionSignature='';
function capturePieceRects(){
 const rects=new Map();
 if(typeof app.querySelectorAll!=='function')return rects;
 for(const piece of app.querySelectorAll('.hand-piece[data-order-key]')){
  const r=piece.getBoundingClientRect?.();if(r)rects.set(`${piece.dataset.orderZone}:${piece.dataset.orderKey}`,{left:r.left,top:r.top});
 }
 return rects;
}
function animateTable(rects,handChanged){
 if(typeof app.querySelectorAll!=='function'||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
 let dealt=0;
 for(const piece of app.querySelectorAll('.hand-piece[data-order-key]')){
  const key=`${piece.dataset.orderZone}:${piece.dataset.orderKey}`,previous=rects.get(key),r=piece.getBoundingClientRect?.();
  if(previous&&r&&typeof piece.animate==='function'){
   const dx=previous.left-r.left,dy=previous.top-r.top;
   if(Math.abs(dx)+Math.abs(dy)>3&&Math.abs(dx)<1100&&Math.abs(dy)<600){
    piece.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:260,easing:'cubic-bezier(.2,.9,.3,1)'});
   }
  }else if(handChanged&&dealt<14){
   piece.style?.setProperty('--feel-delay',`${Math.min(dealt++,9)*32}ms`);piece.classList.add('feel-dealt');
  }
 }
}
// Preserve focus across the existing full-page rendering system.
let previousModal=null;
let modalReturnFocus=null;
let previousAnnouncement='';
function focusLocator(element){
 if(!element || element===document.body || !app.contains(element))return null;
 const piece=element.closest?.('.hand-piece[data-order-key]');
 const attributes=['data-action','data-index','data-type','data-mode','data-from','data-id','data-order-zone','data-order-position'];
 const attrs=Object.fromEntries(attributes.filter(name=>element.hasAttribute(name)).map(name=>[name,element.getAttribute(name)]));
 const matching=[...app.querySelectorAll(element.tagName.toLowerCase())].filter(el=>Object.entries(attrs).every(([name,value])=>el.getAttribute(name)===value));
 return {id:element.id||null,tag:element.tagName,attrs,ordinal:matching.indexOf(element),handKey:piece?.dataset.orderKey||null,handZone:piece?.dataset.orderZone||null};
}
function restoreFocus(locator){
 if(!locator)return false;
 let candidates=[...app.querySelectorAll(locator.tag.toLowerCase())];
 if(locator.id){const byId=document.getElementById(locator.id);if(byId)candidates=[byId,...candidates];}
 if(locator.handKey){
   const piece=[...app.querySelectorAll('.hand-piece[data-order-key]')].find(el=>el.dataset.orderKey===locator.handKey && el.dataset.orderZone===locator.handZone);
   if(piece)candidates=[...piece.querySelectorAll(locator.tag.toLowerCase()),...candidates];
 }
 const match=el=>Object.entries(locator.attrs).every(([attr,value])=>el.getAttribute(attr)===value);
 let matching=candidates.filter(el=>!el.disabled&&match(el));
 let target=locator.ordinal>=0?matching[locator.ordinal]||matching[0]:matching[0];
 if(!target && locator.attrs['data-action'])target=candidates.find(el=>!el.disabled&&el.getAttribute('data-action')===locator.attrs['data-action']);
 if(!target && locator.handKey)target=candidates.find(el=>!el.disabled&&el.closest('.hand-piece'));
 if(!target)return false;
 target.focus({preventScroll:true});return document.activeElement===target;
}
function announceStatus(){
 const status=document.getElementById('stackhouse-status');if(!status)return;
 const s=ui.game;
 const message=ui.toast?.message||ui.orderMessage|| (ui.screen==='game'&&s?
 (s.winner!==null?(s.winner===-1?'Match drawn.':s.winner===0?'You won the match.':'Match complete.'):
 (s.active===0?'Your turn.':`${s.players[s.active]?.name||'Opponent'}’s turn.`)):'');
 if(message!==previousAnnouncement){status.textContent=message;previousAnnouncement=message;}
}
function mobileActionBar(){
 return renderMobileActionBar(ui,{sequencePileTargets,canReplenishSequenceHand,canPassSequenceTurn});
}
function render(){
 const currentFocus=focusLocator(document.activeElement);
 if(ui.modal&&!previousModal)modalReturnFocus=currentFocus;
 const beforeRects=capturePieceRects();
 const motionSignature=ui.screen==='game'?visibleHandSignature(ui.game):'';
 const handChanged=motionSignature!==lastMotionSignature;
 app.innerHTML=`<div class="site-wrap"><a class="skip-link" href="#main-content">Skip to main content</a>${header()}${ui.screen==='home'?homeScreen():ui.screen==='room'?roomScreen():ui.game?.kind==='sequence'?sequenceScreen():ui.game?.kind==='rack'?rackScreen():ui.game?.kind==='tiles'?tileScreen():ui.game?.kind==='low'?lowScreen():ui.game?.kind==='eights'?eightScreen():contractScreen()}
 ${mobileActionBar()}
 <footer class="site-footer"><span>STACKHOUSE SOCIAL <span class="diamond">◆</span> TEN TABLES · PHASE 26</span><span>Original games · UK English · ${isOnline()?'Server-authoritative private multiplayer':'Solo games + private group tables'}</span></footer></div>
 ${modalContent()}${ui.toast?`<div class="toast ${ui.toast.error?'error':''}" role="status">${escapeHtml(ui.toast.message)}</div>`:''}${ui.moment?`<div class="moment-toast" role="status">${escapeHtml(ui.moment.message)}</div>`:''}`;
 app.querySelector?.('.game-page')?.classList.toggle('drawer-open',ui.drawerOpen);
 const backdrop=typeof app.querySelector==='function'?app.querySelector('.site-wrap'):null;
 if(backdrop)backdrop.inert=Boolean(ui.modal);
 if(ui.modal){
   const modal=typeof app.querySelector==='function'?app.querySelector('[role="dialog"]'):null;
   if(!previousModal)modal?.querySelector('[data-action="close"]')?.focus({preventScroll:true});
   else if(!restoreFocus(currentFocus))modal?.querySelector('[data-action="close"]')?.focus({preventScroll:true});
 }else if(previousModal){restoreFocus(modalReturnFocus);modalReturnFocus=null;}
 else restoreFocus(currentFocus);
 previousModal=ui.modal;
 announceStatus();
 animateTable(beforeRects,handChanged);
 lastMotionSignature=motionSignature;
 syncAmbience();
}
function start(mode,matchLength=ui.soloContractLength){
 stopOnline();
 const found=games.find(g=>g.id===mode);
 if(!found)return;
 ui.mode=mode;ui.screen='game';ui.drawerOpen=false;ui.selected=null;ui.modal=null;ui.moment=null;ui.matchId=crypto.randomUUID();resetArrangement();
 const seed=sessionSeed(),playerCount=GROUP_GAME_IDS.has(mode)?ui.soloBotCount+1:2;
   ui.game=found.kind==='sequence'?createSequenceGame({mode,seed,playerCount}):found.kind==='rack'?createRackGame({mode,seed}):found.kind==='tiles'?createTileGame({mode,seed,playerCount}):found.kind==='low'?createLowGame({mode,seed}):found.kind==='eights'?createEightGame({mode,seed,playerCount}):createContractGame({mode,seed,matchLength,playerCount});
   for(let seat=1;seat<ui.game.players.length;seat++){
     const avatarId=(ui.avatarId+seat*3-1)%16+1,persona=botPersona(avatarId);
     ui.game.players[seat].name=persona.name;
     ui.game.players[seat].avatarId=avatarId;
   }
 saveSolo();sound('deal');render();window.scrollTo({top:0,behavior:'instant'});
}
function checkBotTurn(){
 if(isOnline()||!ui.game)return;
 const previous=ui.game;
 for(let tick=0;tick<ui.game.players.length*3;tick++) {
   const state=ui.game,seat=state.active;
   if(seat===0||state.winner!==null||state.roundWinner!=null)break;
   const persona=botPersona(state.players[seat].avatarId),selected=ui.botDifficulty;
   const level=selected==='standard'?(persona.style==='reckless'?'easy':persona.style==='planner'?'expert':'standard'):selected;
   const result=state.kind==='sequence'?runSequenceBot(state,level,seat):state.kind==='rack'?runRackBot(state,level):
     state.kind==='tiles'?runTileBot(state,level,seat):state.kind==='low'?runLowBot(state,level):
     state.kind==='eights'?runEightBot(state,level,seat):runContractBot(state,level,seat);
   if(JSON.stringify(result)===JSON.stringify(state))break;
   ui.game=result;
   if(tick%3===0)ui.game.log.unshift(`${state.players[seat].name}: “${persona.taunts[(state.turn??state.round??1)%persona.taunts.length]}”`);
 }
 showMoment(readGameBeat(previous,ui.game));
 saveSolo();render();
}
function runResult(result,botAfter=false){
 if(result.error){toast(result.error,true);return;}
 const previous=ui.game;ui.game=result.state;ui.selected=null;ui.orderMessage='';
 if(!isOnline()&&ui.game.kind==='contract'&&ui.game.mode==='shanghai-nights'&&ui.game.active===0&&ui.game.buyWindow)ui.game=runContractBot(ui.game,ui.botDifficulty);
 const beat=readGameBeat(previous,ui.game);showMoment(beat);
 saveSolo();if(!beat)sound('card');render();
 if(botAfter)checkBotTurn();
}


// Phase 2 private tables. Authenticated fetch-SSE keeps session credentials out of URLs.
let streamAbort=null;
let networkSequence=0;
const invitation=code=>`${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
function stopOnline() {
  networkSequence++;
  streamAbort?.abort();streamAbort=null;ui.online=null;ui.netStatus='';
  const url=new URL(location.href);if(url.searchParams.has('room')){url.searchParams.delete('room');history.replaceState(null,'',url);}
}
function roomScreen() {
  if(ui.online && ui.online.view.status==='waiting') {
    const room=ui.online.view;
    return `<main id="main-content" tabindex="-1" class="room-page"><section class="room-panel"><div class="eyebrow">PRIVATE TABLE · ${room.series?.format==='mixed'?'GAMES NIGHT MIX':'SINGLE GAME'} · WAITING FOR PLAYERS</div>
    <h1>Your table is ready.</h1><p>Share the invitation with your friends. Every player gets a private hand and their own turn. The host can also open a safe read-only display on a TV.</p>
    <div class="room-code" aria-label="Room code ${room.code}">${room.code}</div>
    <div class="room-players">${room.players.map(p=>`<div class="room-player"><img src="${asset(p.avatar).image}" alt=""><b>${escapeHtml(p.name)}</b><span>${p.bot?'Computer opponent':'Ready'}</span></div>`).join('')}${room.players.length<room.maxPlayers?`<div class="room-player room-empty">${icon('people',25)}<b>${room.players.length} of ${room.maxPlayers} seats filled</b><span>Waiting for more friends</span></div>`:''}</div>
    ${room.seat===0&&room.maxPlayers>2&&room.players.length>=3?'<button class="btn btn-primary" data-action="room-start">Start game now</button>':''}${room.seat===0&&room.players.length<room.maxPlayers?'<button class="btn btn-outline" data-action="host-bot-fill">Fill empty seats with House Bots</button>':''}${room.seat===0&&room.players.at(-1)?.bot?'<button class="btn btn-outline" data-action="host-bot-remove">Remove last bot</button>':''}<button class="btn btn-primary" data-action="room-invite">${icon('people')} Copy invitation link</button><button class="btn btn-outline" data-action="home">Leave lobby</button>
    <p class="room-small">${escapeHtml(ui.netStatus||'Connected')} · ${room.maxPlayers} seats available. ${room.maxPlayers>2?'Host can start with 3 or more players.':'Game starts when your friend joins.'}</p>
    ${hostTableControls()}${room.storage==='memory-only'?'<p class="room-small room-storage-warning" role="status">This table is not saved across server restarts. Finish your match before a service update.</p>':room.storage==='filesystem-only'?'<p class="room-small room-storage-warning" role="status">Room recovery depends on the server having persistent disk storage.</p>':''}</section></main>`;
  }
  if(ui.roomRecovery){
    const code=escapeHtml(ui.roomRecovery.code);
    return `<main id="main-content" tabindex="-1" class="room-page"><section class="room-panel" aria-labelledby="recovery-heading">
      <div class="eyebrow">PRIVATE TABLE · RECOVERY</div><h1 id="recovery-heading">Your seat is still saved.</h1>
      <p>We could not reach table <strong>${code}</strong>. It may be a temporary connection or server problem. Your saved player session has <strong>not</strong> been deleted.</p>
      <p class="room-small" role="status">${escapeHtml(ui.roomRecovery.message)}</p>
      <button class="btn btn-primary room-submit" data-action="room-retry-seat">Retry saved seat</button>
      <button class="btn btn-outline" data-action="room-forget-seat">Forget this seat on this device</button>
      <p class="room-small">If you share this phone, use Forget seat once you have finished playing. It removes your saved access from this browser, not the active table.</p>
    </section></main>`;
  }
  const joining=Boolean(ui.roomCode);
  return `<main id="main-content" tabindex="-1" class="room-page"><section class="room-panel"><div class="eyebrow">THE PRIVATE LOUNGE</div>
    <h1>${joining?'Join a friend.':'Host a private table.'}</h1><p>Play live from separate phones or homes. Your cards are dealt by the server, and opponents cannot see your hand.</p>
    <label class="room-label" for="room-name">YOUR DISPLAY NAME</label>
    <input id="room-name" class="room-input" maxlength="24" autocomplete="nickname" placeholder="Your name" value="${escapeHtml(ui.roomName)}">
    ${joining?`<label class="room-label" for="room-code">SIX-CHARACTER ROOM CODE</label>
      <input id="room-code" class="room-input room-code-input" maxlength="6" autocomplete="off" spellcheck="false" value="${escapeHtml(ui.roomCode)}">`
      :`<label class="room-label" for="room-game">CHOOSE YOUR FIRST GAME</label><select id="room-game" class="room-input">${games.map(g=>`<option value="${g.id}" ${ui.roomMode===g.id?'selected':''}>${g.title}</option>`).join('')}</select><label class="room-label" for="room-format">GAMES NIGHT FORMAT</label><select id="room-format" class="room-input"><option value="single" ${ui.roomFormat==='single'?'selected':''}>One game · first to three wins</option><option value="mixed" ${ui.roomFormat==='mixed'?'selected':''}>Games Night Mix · new game each match</option></select><p class="room-small">Games Night Mix supports 2–6 people and rotates between compatible games. Choose your games below; all seats must vote to continue. For larger groups, Number Ladder and Low Glow are excluded.</p><label class="room-label" for="room-length">CONTRACT MATCH LENGTH</label><select id="room-length" class="room-input"><option value="full" ${ui.roomMatchLength==='full'?'selected':''}>Full · all missions</option><option value="quick" ${ui.roomMatchLength==='quick'?'selected':''}>Quick · two deals per player, scores break ties</option></select><p class="room-small">This option only applies to Phase Quest, Contract Club, Crown Circuit and Shanghai Nights in single-game tables.</p><label class="room-label" for="room-rounds">GAMES NIGHT MIX LENGTH</label><select id="room-rounds" class="room-input"><option value="3">3 rounds</option><option value="5" selected>5 rounds</option><option value="7">7 rounds</option><option value="9">9 rounds</option></select>
      <fieldset class="room-game-pool"><legend>GAMES NIGHT MIX · CHOOSE YOUR GAMES</legend>
      ${games.map(g=>`<label class="pool-item"><input type="checkbox" name="room-pool" value="${g.id}" ${g.id!=='low-glow'&&g.id!=='number-ladder'?'checked':''}><span>${escapeHtml(g.title)}</span></label>`).join('')}
      <p class="room-small">These selections apply only to Games Night Mix. Six-player mode is available for the eight group-compatible games.</p></fieldset>
      <label class="room-label" for="room-capacity">PLAYERS AT THE TABLE</label><select id="room-capacity" class="room-input">${[2,3,4,5,6].map(n=>`<option value="${n}" ${ui.roomCapacity===n?'selected':''}>${n} players${n>2?' · eight group games':''}</option>`).join('')}</select>`}
    <div class="room-profile"><img src="${asset(ui.avatarId).image}" alt=""> <span>Playing as <b>${asset(ui.avatarId).name}</b></span><button class="btn btn-outline" data-action="avatars">Change</button></div>
    <button class="btn btn-primary room-submit" data-action="${joining?'room-join':'room-host'}">${joining?'Join private table':'Create private table'} ${icon('arrow')}</button>
    <button class="btn btn-ghost" data-action="room-switch">${joining?'Create a room instead':'I have an invite code'}</button>
    <p class="room-small">2–6 players in eight games, including Phase Quest, Contract Club, Crown Circuit and Shanghai Nights. Number Ladder and Low Glow remain two-player. Games Night Mix supports up to six players with compatible games. Multiplayer requires a running Node server.</p>
    </section></main>`;
}
async function callRoom(url,{method='GET',body=null,token=null}={}) {
  const response=await fetch(url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  let result;try{result=await response.json();}catch{throw Error('The game server returned an unexpected response.');}
  if(!response.ok){const error=Error(result.error||'The game server rejected the request.');error.status=response.status;throw error;}
  return result;
}
function syncRoom(view) {
  if(!ui.online||ui.online.code!==view.code)return;
  if(ui.online.view && view.revision<ui.online.view.revision)return; // Never roll back newer state on a slow stream.
  const changed=ui.online.view?.revision!==view.revision;
  if(changed)ui.orderMessage='';
  ui.online.view=view;
  if(ui.mode!==view.mode)resetArrangement();
  ui.mode=view.mode;
  ui.avatarId=view.players[view.seat]?.avatar??ui.avatarId;
  localStorage.setItem('stackhouse.avatar',String(ui.avatarId));
  const previous=ui.game;ui.game=view.game;
  if(changed)showMoment(readGameBeat(previous,ui.game));
  ui.screen=view.status==='playing'?'game':'room';
  if(changed){ui.selected=null;ui.lowAction='replace';}
  render();
}
function connectRoom(code,token,view) {
  stopOnline();resetArrangement();ui.roomRecovery=null;ui.online={code,token,seat:view.seat,view:null};ui.netStatus='Connecting';syncRoom(view);
  localStorage.setItem(`stackhouse.room.${code}`,token);
  localStorage.setItem('stackhouse.lastRoom',code);
  const uri=new URL(location.href);uri.searchParams.set('room',code);history.replaceState(null,'',uri);
  liveRoomStream(++networkSequence);
}
async function liveRoomStream(epoch) {
  let failures=0;
  while(epoch===networkSequence&&isOnline()) {
    const controller=new AbortController();streamAbort=controller;
    let watchdog=null;
    const keepAlive=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>controller.abort('stalled'),55000);};
    try {
      const current=ui.online;
      const response=await fetch(`/api/rooms/${current.code}/events`,{headers:{authorization:`Bearer ${current.token}`,accept:'text/event-stream'},signal:controller.signal,cache:'no-store'});
      if(response.status===401||response.status===404){
        ui.netStatus=response.status===401?'Session expired':'Table no longer available';
        localStorage.removeItem(`stackhouse.room.${current.code}`);
        render();return;
      }
      if(!response.ok)throw Error('Could not connect to the game server.');
      ui.netStatus='Connected';render();failures=0;keepAlive();
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(epoch===networkSequence) {
        const {done,value}=await reader.read();if(done)break;
        keepAlive();buffer+=decoder.decode(value,{stream:true});
        if(buffer.length>100000)throw Error('Network data too large.');
        let cut;
        while((cut=buffer.indexOf('\n\n'))!==-1) {
          const block=buffer.slice(0,cut).replace(/\r/g,'');buffer=buffer.slice(cut+2);
          const dataLine=block.split('\n').find(line=>line.startsWith('data: '));
          if(dataLine)syncRoom(JSON.parse(dataLine.slice(6)));
        }
      }
    }catch(err){
      if(epoch!==networkSequence||(controller.signal.aborted&&controller.signal.reason!=='stalled'))break;
      ui.netStatus='Reconnecting…';render();failures++;
    }finally{clearTimeout(watchdog);}
    if(epoch!==networkSequence)break;
    await new Promise(resolve=>setTimeout(resolve,Math.min(6000,1200+failures*900)));
  }
}
async function withRoomAction(action) {
  if(!ui.online||ui.online.pending)return;
  const current=ui.online;
  const payload={...action,revision:current.view.revision,actionId:crypto.randomUUID()};
  current.pending=true;
  try {
    for(let attempt=0;attempt<3;attempt++) {
      try {
        // Retrying the SAME identifier protects against double-play if the server
        // applied the move but the phone lost its acknowledgement.
        const view=await callRoom(`/api/rooms/${current.code}/actions`,{method:'POST',token:current.token,body:payload});
        if(ui.online===current){syncRoom(view);sound('card');}
        return;
      } catch(err) {
        if(!(err instanceof TypeError)||attempt===2)throw err;
        ui.netStatus='Reconnecting…';render();
        await new Promise(resolve=>setTimeout(resolve,450*(attempt+1)));
      }
    }
  } catch(err) {
    if(ui.online===current){
      try {const view=await callRoom(`/api/rooms/${current.code}/state`,{token:current.token});syncRoom(view);}catch {ui.netStatus='Reconnecting…';render();}
      toast(err.message,true);
    }
  } finally {current.pending=false;}
}
async function hostTableButton(action,control=null) {
 if(!ui.online||ui.online.view?.seat!==0)return;
 const room=ui.online,types={'host-pause':'pause','host-resume':'resume','host-tv-create':'tv-create','host-tv-disable':'tv-disable','host-bot-fill':'bot-fill','host-bot-remove':'bot-remove','host-bot-takeover':'bot-takeover'};
 if(!types[action]||room.pending)return;
 const seat=action==='host-bot-takeover'?Number(control?.dataset.seat):undefined;
 if(action==='host-bot-takeover') {
   const player=room.view.players[seat];
   if(!Number.isInteger(seat)||seat<=0||!player||player.bot||player.connected)return;
   if(!window.confirm(`Replace ${player.name} with a House Bot? Their saved access will stop working, and this cannot be undone in this match. A player must have been disconnected for two minutes.`))return;
 }
 room.pending=true;
 try {
   const result=await callRoom(`/api/rooms/${room.code}/host`,{method:'POST',token:room.token,body:{type:types[action],revision:room.view.revision,level:ui.botDifficulty,...(action==='host-bot-takeover'?{seat}:{})}});
   if(ui.online!==room)return;
   syncRoom(result.view);
   if(result.watchKey){
     // The credential is in the fragment, not a query parameter or a server log.
     const url=`${location.origin}/tv.html#room=${encodeURIComponent(room.code)}&key=${encodeURIComponent(result.watchKey)}`;
     try{await navigator.clipboard.writeText(url);toast('TV display link copied. Open it on your TV or laptop.');}
     catch{window.prompt('Copy this TV-only spectator link:',url);}
   }else toast(action==='host-pause'?'Table paused.':action==='host-resume'?'Table resumed.':action==='host-bot-takeover'?'The disconnected player was replaced by a House Bot.':'Host action complete.');
 }catch(error){
   try{const view=await callRoom(`/api/rooms/${room.code}/state`,{token:room.token});if(ui.online===room)syncRoom(view);}catch{}
   toast(error.message,true);
 }finally{room.pending=false;}
}
async function roomButton(action,control) {
  try {
    if(action==='room-retry-seat'){
      if(!ui.roomRecovery)return;
      const code=ui.roomRecovery.code;
      const token=localStorage.getItem(`stackhouse.room.${code}`);
      if(token)await recoverRoomSeat(code,token);
      else {ui.roomRecovery=null;ui.roomCode=code;render();}
      return;
    }
    if(action==='room-forget-seat'){
      if(ui.roomRecovery){const code=ui.roomRecovery.code;localStorage.removeItem(`stackhouse.room.${code}`);
        if(localStorage.getItem('stackhouse.lastRoom')===code)localStorage.removeItem('stackhouse.lastRoom');}
      ui.roomRecovery=null;ui.roomCode='';ui.screen='home';render();return;
    }
    if(action==='room-open') {
      stopOnline();ui.screen='room';ui.game=null;resetArrangement();ui.roomMode=control.dataset.family?chosenFamilyMode(control.dataset.family):control.dataset.mode||ui.roomMode;ui.roomCode='';
      render();return;
    }
    if(action==='room-switch'){ui.roomCode=ui.roomCode?'':' ';render();return;}
    if(action==='room-start'){
      if(!ui.online)return;
      const result=await callRoom(`/api/rooms/${ui.online.code}/start`,{method:'POST',token:ui.online.token});
      syncRoom(result);return;
    }
    if(action==='room-invite'){
      if(!ui.online)return;
      try{await navigator.clipboard.writeText(invitation(ui.online.code));toast('Private invitation copied.');}
      catch{window.prompt('Copy this private invitation:',invitation(ui.online.code));}return;
    }
    const name=document.getElementById('room-name')?.value?.trim();
    const avatar=ui.avatarId;
    ui.roomName=name;localStorage.setItem('stackhouse.nickname',name||'');
    if(action==='room-host') {
      const mode=document.getElementById('room-game').value;
      const format=document.getElementById('room-format')?.value||'single';
      const maxPlayers=Number(document.getElementById('room-capacity')?.value||2);
      const matchLength=document.getElementById('room-length')?.value||'full';ui.roomMatchLength=matchLength;
      ui.roomFormat=format;ui.roomCapacity=maxPlayers;
      const selectedPool=[...document.querySelectorAll('input[name="room-pool"]:checked')].map(input=>input.value);
      const roundLimit=format==='mixed'?Number(document.getElementById('room-rounds')?.value||5):null;
      if(format==='mixed'&&!selectedPool.length)throw Error('Choose at least one Games Night Mix game.');
      if(format==='mixed'&&maxPlayers>2&&selectedPool.some(id=>!GROUP_GAME_IDS.has(id)))
        throw Error('For 3–6 players, untick Number Ladder and Low Glow.');
      if(format==='mixed'&&!selectedPool.includes(mode))throw Error('Include the first game in your Games Night Mix selections.');
      const result=await callRoom('/api/rooms',{method:'POST',body:{mode,name,avatar,format,maxPlayers,matchLength,
        ...(format==='mixed'?{gamePool:selectedPool,roundLimit}:{})}});
      connectRoom(result.code,result.token,result.view);
    } else if(action==='room-join') {
      const code=(document.getElementById('room-code')?.value||'').trim().toUpperCase();
      const result=await callRoom(`/api/rooms/${encodeURIComponent(code)}/join`,{method:'POST',body:{name,avatar}});
      connectRoom(result.code,result.token,result.view);
    }
  }catch(err){toast(err.message,true);}
}
// Pointer-based drag for mouse, stylus and touch. A normal tap still plays the card.
let activeDrag=null,swallowDragClick=0;
function clearDrag(){
 if(!activeDrag)return;
 activeDrag.source?.classList.remove('drag-source');
 document.querySelectorAll('.hand-piece.drop-destination').forEach(el=>el.classList.remove('drop-destination'));
 activeDrag.ghost?.remove();activeDrag=null;
}
function pointerTarget(zone,x,y){
 const elements=[...document.querySelectorAll(`.hand-piece[data-order-zone="${zone}"]`)];
 const container=elements[0]?.parentElement;
 if(!container)return null;
 const rect=container.getBoundingClientRect();
 if(x<rect.left-40||x>rect.right+40||y<rect.top-40||y>rect.bottom+40)return null;
 const element=document.elementFromPoint(x,y)?.closest('.hand-piece');
 if(element?.dataset.orderZone===zone)return element;
 return elements.reduce((best,element)=>{
  const r=element.getBoundingClientRect(),dx=x-(r.left+r.width/2),dy=y-(r.top+r.height/2);
  const d=dx*dx+dy*dy;return !best||d<best.distance?{element,distance:d}:best;
 },null)?.element||null;
}
app.addEventListener('pointerdown',event=>{
 if(event.button!==undefined&&event.button!==0)return;
 const piece=event.target.closest('.hand-piece[data-order-zone]');
 if(!piece||!ui.game||ui.modal)return;
 activeDrag={id:event.pointerId,source:piece,zone:piece.dataset.orderZone,from:Number(piece.dataset.orderPosition),x:event.clientX,y:event.clientY,dragged:false,ghost:null,target:null};
});
app.addEventListener('pointermove',event=>{
 const d=activeDrag;if(!d||event.pointerId!==d.id)return;
 if(!d.dragged&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<9)return;
 if(!d.dragged){
  d.dragged=true;try{d.source.setPointerCapture(event.pointerId);}catch{}
  d.source.classList.add('drag-source');
  d.ghost=d.source.cloneNode(true);d.ghost.classList.add('drag-ghost');d.ghost.classList.remove('drag-source');
  d.ghost.removeAttribute('data-order-zone');d.ghost.querySelectorAll('[data-action]').forEach(el=>el.removeAttribute('data-action'));
  document.body.appendChild(d.ghost);
 }
 event.preventDefault();
 d.ghost.style.left=`${event.clientX}px`;d.ghost.style.top=`${event.clientY}px`;
 const target=pointerTarget(d.zone,event.clientX,event.clientY);
 if(d.target!==target){d.target?.classList.remove('drop-destination');d.target=target;target?.classList.add('drop-destination');}
});
function finishDrag(event,cancel=false){
 const d=activeDrag;if(!d||event.pointerId!==d.id)return;
 const moved=d.dragged,from=d.from,to=cancel?null:(d.target?Number(d.target.dataset.orderPosition):null),zone=d.zone;
 clearDrag();
 if(!moved)return;
 swallowDragClick=Date.now()+500;
 if(to!==null)reorderHand(zone,from,to);
}
app.addEventListener('pointerup',event=>finishDrag(event));
app.addEventListener('pointercancel',event=>finishDrag(event,true));
// The organiser's first capture handler runs before private-room gameplay commands.
app.addEventListener('click',event=>{
 if(swallowDragClick>Date.now()&&event.target.closest?.('.hand-piece')){swallowDragClick=0;event.stopImmediatePropagation();event.preventDefault();return;}
 swallowDragClick=0;
 const control=event.target.closest('[data-action]');if(!control)return;
 const action=control.dataset.action;
 if(['hand-arrange','hand-sort','hand-undo'].includes(action)){
  event.stopImmediatePropagation();event.preventDefault();
  if(action==='hand-undo'){undoHandOrder();return;}
  if(action==='hand-arrange'){ui.arranging=!ui.arranging;ui.arrangeFrom=null;}
  else {const zone=control.dataset.zone,cards=zone==='tiles'?ui.game?.players[0]?.rack:ui.game?.players[0]?.hand;
   if(!cards)return;getOrderedHand(zone,cards);pushOrderUndo(zone);ui.handOrders[zone]=sortHandOrder(cards,control.dataset.sort==='colour'?'colour':'value');ui.orderMessage=control.dataset.sort==='colour'?'Hand sorted by suit or colour.':'Hand sorted by number.';ui.arrangeFrom=null;saveSolo();}
  sound();render();return;
 }
 const piece=control.closest?.('.hand-piece[data-order-zone]');
 if(!piece||!ui.arranging)return;
 event.stopImmediatePropagation();event.preventDefault();
 const zone=piece.dataset.orderZone,pos=Number(piece.dataset.orderPosition);
 if(!ui.arrangeFrom||ui.arrangeFrom.zone!==zone){ui.arrangeFrom={zone,pos};ui.orderMessage=`Selected position ${pos+1}. Choose its new position.`;sound();render();}
 else if(ui.arrangeFrom.pos===pos){ui.arrangeFrom=null;render();}
 else reorderHand(zone,ui.arrangeFrom.pos,pos);
},true);
app.addEventListener('keydown',event=>{
 if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 const piece=event.target.closest?.('.hand-piece[data-order-zone]');if(!piece)return;
 const zone=piece.dataset.orderZone,from=Number(piece.dataset.orderPosition),to=from+(event.key==='ArrowRight'?1:-1);
 event.preventDefault();if(reorderHand(zone,from,to))app.querySelector(`.hand-piece[data-order-zone="${zone}"][data-order-position="${to}"] button`)?.focus();
});
// Capture private table moves so they cannot mutate local snapshots or trigger the bot.
app.addEventListener('click',event=>{
  const control=event.target.closest('[data-action]');if(!control)return;
  const action=control.dataset.action;
  if(['host-pause','host-resume','host-tv-create','host-tv-disable','host-bot-fill','host-bot-remove','host-bot-takeover'].includes(action)){event.stopImmediatePropagation();hostTableButton(action,control);return;}
  if(['room-open','room-switch','room-invite','room-start','room-host','room-join','room-retry-seat','room-forget-seat'].includes(action)){
    event.stopImmediatePropagation();roomButton(action,control);return;
  }
  if(!isOnline())return;
  if(action==='choose-avatar') {
    event.stopImmediatePropagation();
    const avatar=Number(control.dataset.id);
    ui.avatarId=avatar;localStorage.setItem('stackhouse.avatar',String(avatar));
    withRoomAction({type:'profile-avatar',avatar});return;
  }
  if(['next-round','restart','rematch-request','rematch-cancel'].includes(action)){
    event.stopImmediatePropagation();withRoomAction({type:action==='restart'?'rematch-request':action});return;
  }
  if(ui.screen!=='game')return;
  let command;
  if(action==='tile-lay'&&ui.selected?.type==='tiles')command={type:'tile-lay',indices:ui.selected.indices,target:null};
  else if(action==='tile-target'&&ui.selected?.type==='tiles')command={type:'tile-lay',indices:ui.selected.indices,target:Number(control.dataset.index)};
  else if(action==='tile-end')command={type:'tile-end',draw:control.dataset.draw==='true'};
  else if(action==='low-draw')command={type:'low-draw',from:control.dataset.from};
  else if(action==='low-slot')command={type:ui.lowAction==='flip'?'low-flip':'low-replace',index:Number(control.dataset.index)};
  else if(action==='eight-draw')command={type:'eight-draw'};
  else if(action==='eight-pass')command={type:'eight-pass'};
  else if(action==='eight-suit'&&ui.selected?.type==='eight')command={type:'eight-play',index:ui.selected.index,suit:control.dataset.suit};
  else if(action==='eight-card'&&ui.game?.players[0].hand[Number(control.dataset.index)]?.value!==8)command={type:'eight-play',index:Number(control.dataset.index)};
  else if(action==='seq-refill')command={type:'sequence-refill'};
  else if(action==='seq-pass')command={type:'sequence-pass'};
  else if(action==='build'&&ui.selected)command={type:'sequence-play',sourceType:ui.selected.type,sourceIndex:ui.selected.index,pileIndex:Number(control.dataset.index)};
  else if(action==='seq-discard-dest'&&ui.selected?.type==='hand')command={type:'sequence-discard',handIndex:ui.selected.index,discardIndex:Number(control.dataset.index)};
  else if(action==='rack-draw')command={type:'rack-draw',from:control.dataset.from};
  else if(action==='rack-replace')command={type:'rack-replace',index:Number(control.dataset.index)};
  else if(action==='rack-discard')command={type:'rack-discard'};
  else if(action==='contract-draw')command={type:'contract-draw',from:control.dataset.from};
  else if(action==='contract-buy')command={type:'contract-buy'};
  else if(action==='contract-discard'&&ui.selected?.type==='contract-hand')command={type:'contract-discard',handIndex:ui.selected.index};
  else if(action==='lay-contract')command={type:'contract-lay'};
  else if(action==='contract-layoff'&&ui.selected?.type==='contract-hand')command={type:'contract-layoff',handIndex:ui.selected.index,meldIndex:Number(control.dataset.index)};
  if(command){event.stopImmediatePropagation();withRoomAction(command);}
},true);

// An invite opens the join screen, while your own stored seat reconnects automatically.
async function recoverRoomSeat(code,token){
  try {
    const view=await callRoom(`/api/rooms/${code}/state`,{token});
    connectRoom(code,token,view);
    return true;
  }catch(error){
    if(classifyRoomRecovery(error)==='invalid-seat'){
      // Only authoritative invalid/expired responses may erase a saved seat.
      localStorage.removeItem(`stackhouse.room.${code}`);
      ui.roomRecovery=null;ui.roomCode=code;ui.screen='room';render();
    }else{
      // Transient 5xx responses, timeouts and network outages must not strand players.
      ui.roomRecovery={code,message:error.message||'The server is not responding.'};
      ui.roomCode=code;ui.screen='room';render();
    }
    return false;
  }
}
async function restoreRoom() {
  const code=new URL(location.href).searchParams.get('room')?.trim()?.toUpperCase();
  if(!code||!/^[A-Z2-9]{6}$/.test(code))return;
  const token=localStorage.getItem(`stackhouse.room.${code}`);
  if(token){await recoverRoomSeat(code,token);return;}
  ui.roomCode=code;ui.screen='room';render();
}

app.addEventListener('click',event=>{
 const control=event.target.closest('[data-action]');
 if(!control)return;
 const action=control.dataset.action;
 if(action==='dismiss'&&event.target!==control)return;
 if(['toggle-table-drawer','home','scroll-games','avatars','toggle-sound','test-sound','test-tone','toggle-ambience','close','dismiss','choose-avatar','start','restart','rules','next-round','solo-resume'].includes(action)) {
   switch(action){
     case 'toggle-table-drawer':ui.drawerOpen=!ui.drawerOpen;render();break;
     case 'home':stopOnline();ui.screen='home';ui.game=null;ui.selected=null;ui.modal=null;ui.moment=null;resetArrangement();render();break;
     case 'scroll-games':document.getElementById('games')?.scrollIntoView({behavior:'smooth'});break;
     case 'avatars':ui.modal='avatars';sound();render();break;
     case 'rules':if(control.dataset.family)ui.mode=chosenFamilyMode(control.dataset.family);else if(control.dataset.mode)ui.mode=control.dataset.mode;ui.modal='rules';sound();render();break;
     case 'close':case 'dismiss':ui.modal=null;render();break;
     case 'toggle-sound':ui.soundOn=!ui.soundOn;localStorage.setItem('stackhouse.sound',String(ui.soundOn));sampleAudio.setEnabled(ui.soundOn);if(ui.soundOn){contextForAudio();ui.soundStatus='Sound enabled. Press Test to check playback.';}else{ui.soundTestPending=false;ui.soundStatus='Sound muted.';}render();break;
     case 'test-sound':if(!ui.soundOn){ui.soundOn=true;localStorage.setItem('stackhouse.sound','true');sampleAudio.setEnabled(true);}contextForAudio();sampleAudio.resetFailures();ui.soundTestPending=true;ui.soundStatus=ui.soundVolume===0?'Volume is zero. Raise the slider to hear sound.':'Testing sound…';if(ui.soundVolume>0){if(!sampleAudio.play('win',{force:true})){ui.soundTestPending=false;ui.soundStatus=playFallbackSound('win')?'Playing backup tone.':'No audio device detected.';}}render();break;
     case 'test-tone':{
       if(!ui.soundOn){ui.soundOn=true;localStorage.setItem('stackhouse.sound','true');sampleAudio.setEnabled(true);}
       if(ui.soundVolume===0){ui.soundStatus='Volume is zero. Raise it before testing the tone.';render();break;}
       const started=playFallbackSound('win',true),ctx=audioContext;
       ui.soundStatus=!started?'Browser does not support the backup audio tone.'
         :ctx?.state==='running'?'Tone sent to audio output. If silent, check device and browser volume.'
         :'Unlocking audio. Tap Tone once more if needed.';
       render();
       if(started&&ctx?.state==='suspended')ctx.resume().then(()=>{
         if(ctx.state==='running')setSoundStatus('Tone sent to audio output. If silent, check device and browser volume.');
       }).catch(()=>setSoundStatus('Browser blocked the tone. Tap Tone again.'));
       break;
     }
     case 'toggle-ambience':ui.ambienceOn=!ui.ambienceOn;localStorage.setItem('stackhouse.ambience',String(ui.ambienceOn));render();break;
     case 'choose-avatar':ui.avatarId=Number(control.dataset.id);localStorage.setItem('stackhouse.avatar',String(ui.avatarId));sound('success');render();break;
     case 'start':start(control.dataset.family?chosenFamilyMode(control.dataset.family):control.dataset.mode);break;
     case 'solo-resume':resumeSolo();break;
     case 'restart':start(ui.mode,ui.game?.matchLength??'full');break;
     case 'next-round':runResult(ui.game.kind==='low'?lowNextRound(ui.game):nextContractRound(ui.game),true);break;
   }
   return;
 }
 if(!ui.game||ui.game.winner!==null||ui.game.roundWinner!=null||ui.game.active!==0)return;
 if(ui.game.kind==='sequence'){
   const p=ui.game.players[0];
   if(action==='seq-source'){
     const type=control.dataset.type,index=Number(control.dataset.index);
     if(type==='hand'?!p.hand[index]:type==='stock'?!p.stock.length:!p.discards[index]?.length)return;
     ui.selected=ui.selected?.type===type&&ui.selected?.index===index?null:{type,index};sound();render();
   } else if(action==='seq-pass'){
     runResult(passSequenceTurn(ui.game),true);
   } else if(action==='seq-refill'){
     runResult(replenishSequenceHand(ui.game));
   } else if(action==='build'){
     if(!ui.selected){toast('Choose a card first.',true);return;}
     runResult(playSequenceCard(ui.game,ui.selected.type,ui.selected.index,Number(control.dataset.index)));
   } else if(action==='seq-discard-dest'){
     if(ui.selected?.type!=='hand'){toast('Select a card from your hand before discarding.',true);return;}
     runResult(discardSequenceCard(ui.game,ui.selected.index,Number(control.dataset.index)),true);
   }
 } else if(ui.game.kind==='tiles') {
   if(action==='tile-select') {const index=Number(control.dataset.index),indices=ui.selected?.type==='tiles'?[...ui.selected.indices]:[];ui.selected={type:'tiles',indices:indices.includes(index)?indices.filter(x=>x!==index):[...indices,index]};sound();render();}
   else if(action==='tile-lay'&&ui.selected?.type==='tiles')runResult(tileLay(ui.game,ui.selected.indices));
   else if(action==='tile-target'&&ui.selected?.type==='tiles')runResult(tileLay(ui.game,ui.selected.indices,Number(control.dataset.index)));
   else if(action==='tile-end')runResult(tileEndTurn(ui.game,control.dataset.draw==='true'),true);
 } else if(ui.game.kind==='low') {
   if(action==='low-mode'){ui.lowAction=control.dataset.mode;render();}
   else if(action==='low-draw'){ui.lowAction='replace';runResult(lowDraw(ui.game,control.dataset.from));}
   else if(action==='low-slot')runResult(ui.lowAction==='flip'?lowFlip(ui.game,Number(control.dataset.index)):lowReplace(ui.game,Number(control.dataset.index)),true);
 } else if(ui.game.kind==='eights') {
   if(action==='eight-card'){const i=Number(control.dataset.index);if(ui.game.players[0].hand[i]?.value===8){ui.selected={type:'eight',index:i};render();}else runResult(eightPlay(ui.game,i),true);}
   else if(action==='eight-suit'&&ui.selected?.type==='eight')runResult(eightPlay(ui.game,ui.selected.index,control.dataset.suit),true);
   else if(action==='eight-draw')runResult(eightDraw(ui.game));
   else if(action==='eight-pass')runResult(eightPass(ui.game),true);
 } else if(ui.game.kind==='rack') {
   if(action==='rack-draw')runResult(rackDraw(ui.game,control.dataset.from));
   else if(action==='rack-replace')runResult(rackReplace(ui.game,Number(control.dataset.index)),true);
   else if(action==='rack-discard')runResult(rackDiscard(ui.game),true);
 } else {
   if(action==='contract-draw')runResult(drawContractCard(ui.game,control.dataset.from));
   else if(action==='contract-card'){
     const index=Number(control.dataset.index);
     ui.selected=ui.selected?.type==='contract-hand'&&ui.selected?.index===index?null:{type:'contract-hand',index};sound();render();
   } else if(action==='contract-discard'){
     if(ui.selected?.type==='contract-hand')runResult(discardContractCard(ui.game,ui.selected.index),true);
   } else if(action==='lay-contract')runResult(layContract(ui.game));
   else if(action==='contract-layoff'&&ui.selected?.type==='contract-hand')runResult(layOffContract(ui.game,ui.selected.index,Number(control.dataset.index)));
 }
});
window.addEventListener('keydown',event=>{
 if(!ui.modal)return;
 if(event.key==='Escape'){event.preventDefault();ui.modal=null;render();return;}
 if(event.key!=='Tab')return;
 const modal=app.querySelector('[role="dialog"]');if(!modal)return;
 const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')]
   .filter(el=>el.getClientRects().length);
 if(!controls.length){event.preventDefault();return;}
 const first=controls[0],last=controls.at(-1);
 if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
},true);
document.addEventListener?.('visibilitychange',syncAmbience);
if(ui.soundOn)sampleAudio.setEnabled(true);
window.addEventListener?.('pagehide',()=>{ambienceVoices.forEach(v=>{try{v.stop();}catch{}});ambienceVoices=[];ambienceGain=null;});
render();
restoreRoom();

app.addEventListener('input',event=>{
 if(event.target?.id!=='sound-volume')return;
 ui.soundVolume=Math.max(0,Math.min(100,Number(event.target.value)||0));
 sampleAudio.setVolume(ui.soundVolume);
 try{localStorage.setItem('stackhouse.soundVolume',String(ui.soundVolume));}catch{}
 setSoundStatus(ui.soundVolume===0?'Volume is zero. Move the slider up and press Test.':`Volume ${ui.soundVolume}%. Press Test to check audio.`);
});
app.addEventListener('change',event=>{
 if(event.target?.id==='solo-bot-count'){const number=Number(event.target.value);if(Number.isInteger(number)&&number>=1&&number<=5)ui.soloBotCount=number;return;}
 if(event.target?.id==='solo-contract-length' &&['quick','full'].includes(event.target.value)){ui.soloContractLength=event.target.value;return;}
 if(event.target?.id==='bot-level' &&allowedBotLevels.includes(event.target.value)){
  ui.botDifficulty=event.target.value;
  try{localStorage.setItem('stackhouse.botDifficulty',ui.botDifficulty);}catch{}
  toast(`House Bot difficulty: ${ui.botDifficulty}. Available on all ten solo tables.`);
 }
});

// Preserve the accessible audio disclosure when the game redraws the header.
app.addEventListener('toggle',event=>{
 if(event.target?.id==='audio-settings')ui.audioSettingsOpen=event.target.open;
},true);
