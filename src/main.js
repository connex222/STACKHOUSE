import { sessionSeed } from './rng.js';
import {handTokens,reconcileHandOrder,moveHandToken,sortHandOrder} from './hand-order.js';
import {SOLO_SAVE_KEY,encodeSoloSave,decodeSoloSave} from './solo-save.js';
import { createSequenceGame, sequencePileTargets, playSequenceCard, discardSequenceCard, runSequenceBot } from './engine/sequence.js';
import { createRackGame, rackDraw, rackReplace, rackDiscard, runRackBot } from './engine/rack.js';
import { createContractGame, currentMission, missionDescription, findContract, drawContractCard, discardContractCard, layContract, nextContractRound, runContractBot, MISSION_SETS } from './engine/contracts.js';
import {createTileGame,tileLay,tileEndTurn,runTileBot,tileMeld} from './engine/tiles.js';
import {createLowGame,lowDraw,lowReplace,lowFlip,lowNextRound,runLowBot} from './engine/lowcard.js';
import {createEightGame,eightCanPlay,eightPlay,eightDraw,eightPass,runEightBot,SUITS} from './engine/eights.js';

const avatars = [
 'The Host','The Strategist','The Sunshine','The Gentleman','The Rebel','The Captain','The Star','The Professor',
 'The Drifter','The Ace','The Maverick','The Gamer','The Duchess','The Joker','The Ranger','The Trendsetter'
].map((name,i)=>({id:i+1,name,image:`/assets/avatar-${String(i+1).padStart(2,'0')}.webp`}));
const games = [
 { id:'stack-run', title:'Stack Run', category:'Sequencing / strategy', kicker:'BUILD. STACK. OUTPLAY.',description:'Climb from 1 to 12 across shared stacks. Your stockpile is the real race.',players:'2 players + bot demo', icon:'↗', art:'run',kind:'sequence',tag:'Most like Skip-Bo' },
 { id:'phase-quest', title:'Phase Quest', category:'Contracts / strategy', kicker:'TEN MISSIONS. ONE WINNER.',description:'Build sets, runs and colour groups. Every successful contract moves you forward.',players:'2 players + bot demo',icon:'✦',art:'phase',kind:'contract',tag:'Most like Phase 10' },
 { id:'malice-duel', title:'Malice Duel', category:'Competitive sequencing',kicker:'MAKE EVERY CARD COUNT.',description:'Three shared stacks, a deeper stockpile and just enough room for revenge.',players:'2 players + bot demo',icon:'♠',art:'malice',kind:'sequence',tag:'Spite & Malice inspired' },
 { id:'contract-club', title:'Contract Club', category:'Classic rummy contracts', kicker:'READ THE ROOM. MAKE THE MELD.',description:'Seven rising contracts, tactical discards and a race to lay the right combination.',players:'2 players + bot demo',icon:'♣',art:'contract',kind:'contract',tag:'Contract Rummy inspired' },
 { id:'crown-circuit',title:'Crown Circuit',category:'Five-suit wild-card rummy',kicker:'THE WILD RANK NEVER STAYS STILL.',description:'Eleven rising contracts, five suits, changing wild ranks, and a final royal challenge.',players:'2 players + bot demo',icon:'♛',art:'crown',kind:'contract',tag:'Five Crowns-style variant' },
 { id:'number-ladder',title:'Number Ladder',category:'Number ordering / strategy',kicker:'TEN SLOTS. ONE PERFECT ORDER.',description:'Swap one card at a time to build an ascending ladder from 1 to 60.',players:'2 players + bot demo',icon:'↟',art:'ladder',kind:'rack',tag:'Rack-O-style ordering' },
 { id:'shanghai-nights',title:'Shanghai Nights',category:'Progressive contract rummy',kicker:'SEVEN DEALS. SEVEN CHALLENGES.',description:'Seven escalating meld missions in a tactical Shanghai-inspired house variant.',players:'2 players + bot demo',icon:'✴',art:'shanghai',kind:'contract',tag:'Shanghai-style contracts' },
 {id:'tile-royale',title:'Tile Royale',category:'Tile sets and colour runs',kicker:'MAKE YOUR MARK ON THE TABLE.',description:'Form colourful sets and consecutive runs, extend table groups, and clear your rack.',players:'2 players + bot demo',icon:'▦',art:'tile',kind:'tiles',tag:'Number-tile rummy variant'},
 {id:'low-glow',title:'Low Glow',category:'Memory / low-score cards',kicker:'THE LOWEST SCORE WINS.',description:'Flip, swap and clear matching columns across four fast rounds.',players:'2 players + bot demo',icon:'⬡',art:'low',kind:'low',tag:'Skyjo-style house game'},
 {id:'eight-shift',title:'Eight Shift',category:'Fast card matching',kicker:'MATCH. SWITCH. GET OUT.',description:'Match suits or ranks, and play a wild eight to change the active suit.',players:'2 players + bot demo',icon:'8',art:'eight',kind:'eights',tag:'Crazy Eights-style variant'}
];
const savedAvatar=Number(localStorage.getItem('stackhouse.avatar')||'1');
const ui={screen:'home',mode:null,game:null,online:null,roomMode:'stack-run',roomCode:'',roomName:localStorage.getItem('stackhouse.nickname')||'',netStatus:'',avatarId:avatars.some(a=>a.id===savedAvatar)?savedAvatar:1,
  soundOn:localStorage.getItem('stackhouse.sound')==='true',lowAction:'replace',modal:null,selected:null,toast:null,toastTimer:null,handOrders:{},arranging:false,arrangeFrom:null,orderMessage:'',orderUndo:[]};
const app=document.getElementById('app');
// Browser storage can be disabled (e.g. privacy mode). The games still work.
function savedSolo(){try{return decodeSoloSave(localStorage.getItem(SOLO_SAVE_KEY));}catch{return null;}}
function saveSolo(){
 if(ui.online||!ui.mode||!ui.game)return;
 try {localStorage.setItem(SOLO_SAVE_KEY,encodeSoloSave({mode:ui.mode,game:ui.game,handOrders:ui.handOrders}));}
 catch { /* Storage is optional; never block a card move. */ }
}
function resumeSolo(){
 const save=savedSolo();if(!save)return toast('No saved solo match was found.',true);
 stopOnline();ui.mode=save.mode;ui.game=save.game;ui.handOrders=save.handOrders;
 ui.orderUndo=[];ui.arranging=false;ui.arrangeFrom=null;ui.selected=null;ui.modal=null;
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
const opponentProfile=()=>ui.online?.view?.players?.[1-ui.online.seat];
const opponentName=()=>opponentProfile()?.name||'House Bot';
const opponentImage=()=>asset(opponentProfile()?.avatar||14).image;
const asset=id=>avatars.find(a=>a.id===id)||avatars[0];
const gameInfo=()=>games.find(g=>g.id===ui.mode)||games[0];
const escapeHtml=(s)=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const cls=(...names)=>names.filter(Boolean).join(' ');
let audioContext;
function sound(type='tap') {
  if(!ui.soundOn)return;
  try {
    const AC=window.AudioContext||window.webkitAudioContext;
    audioContext ||=new AC();
    if(audioContext.state==='suspended')audioContext.resume();
    const tones = type==='success'?[523,659,784]:type==='error'?[240,190]:type==='card'?[440,620]:[390];
    tones.forEach((frequency,index)=>{
      const oscillator=audioContext.createOscillator();
      const gain=audioContext.createGain();
      const t=audioContext.currentTime+index*0.08;
      oscillator.type=type==='success'?'sine':'triangle';
      oscillator.frequency.setValueAtTime(frequency,t);
      gain.gain.setValueAtTime(0.0001,t);
      gain.gain.exponentialRampToValueAtTime(0.035,t+0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(t);oscillator.stop(t+0.17);
    });
  }catch{ /* Audio is optional; games always function when muted. */ }
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
    <nav class="top-actions" aria-label="Main navigation"><span class="online-mark"><span></span> ${isOnline()?'Live private match':'Ten tables · Arrange hands'}</span>
      <button data-action="toggle-sound" class="icon-button" aria-label="${ui.soundOn?'Mute':'Enable'} game sounds" title="${ui.soundOn?'Mute':'Enable'} sounds">${icon(ui.soundOn?'sound':'mute',20)}</button>
      <button data-action="avatars" class="account-button"><img src="${ava.image}" alt=""><span>My avatar</span><span class="small-chevron">⌄</span></button>
    </nav></header>`;
}
function homeScreen() {
 const resume=savedSolo();
 return `<main class="home-page"><section class="hero" aria-label="Welcome to Stackhouse Social">
   <div class="hero-content"><div class="eyebrow"><span class="diamond">◆</span> WELCOME TO THE HOUSE</div>
     <h1>Good cards.<br><em>Great company.</em></h1>
     <p>Ten classic-inspired card battles, one spectacular place to play. Pull up a chair, pick your avatar and own the table.</p>
     <div class="hero-buttons"><button class="btn btn-primary" data-action="scroll-games">Choose your game ${icon('arrow')}</button>
       <button class="btn btn-ghost" data-action="room-open">Play with friends</button>${resume?`<button class="btn btn-outline" data-action="solo-resume">Continue ${escapeHtml(games.find(g=>g.id===resume.mode)?.title||'solo match')}</button>`:''}</div>
     <div class="hero-highlights"><div><b>10</b><small>PLAYABLE TABLES</small></div><div><b>16</b><small>CHARACTERS</small></div><div><b>01</b><small>HOUSE TO CALL HOME</small></div></div>
   </div>
 </section>
 <section id="games" class="game-collection"><div class="section-heading"><div><div class="eyebrow">THE GAME COLLECTION</div><h2>Pick your next obsession.</h2><p>Easy to learn. Hard to put down. Each table has its own rules.</p></div><span class="section-pill">WAVES 1–3 · TEN GAMES</span></div>
 <div class="game-grid">${games.map((g,i)=>`<article class="game-tile art-${g.art}"><div class="tile-art"><span class="art-icon" aria-hidden="true">${g.icon}</span><span class="art-sequence" aria-hidden="true">${i===0?'1  2  3  4':i===1?'3 + 3 → 6':i===2?'♠ ♥ ♦ ♣':i===3?'7  8  9':i===4?'3 ★ 4 ★ 5':i===5?'10 → 40 → 60':i===6?'3 + 4 → 7':i===7?'4 4 4':i===8?'−2 0 3':'♥ 8 ♠'}</span></div>
 <div class="tile-body"><span class="tile-type">${escapeHtml(g.category)}</span><h3>${g.title}</h3><p>${g.description}</p><div class="tile-tags"><span>${g.tag}</span></div>
 <div class="tile-buttons"><button class="tile-play" data-action="start" data-mode="${g.id}">Play the bot <span>${icon('arrow')}</span></button><button class="tile-play tile-online" data-action="room-open" data-mode="${g.id}">Private table ${icon('people',16)}</button></div></div></article>`).join('')}</div>
 </section>
 <section class="house-banner"><div><span class="eyebrow">YOUR PEOPLE. YOUR TABLE.</span><h2>Sixteen personalities.<br>One winning look.</h2><p>Pick your player portrait before your first deal. Your choice carries across every table.</p><button class="btn btn-primary" data-action="avatars">Explore the avatars ${icon('arrow')}</button></div><div class="banner-avatars">${[0,4,6,10,12,13].map(n=>`<img src="${avatars[n].image}" alt="${avatars[n].name}" loading="eager">`).join('')}</div></section>
 </main>`;
}
function playerBadge(name,image,meta,active=false) {
  name=escapeHtml(name);meta=escapeHtml(meta);
  return `<div class="player-identity ${active?'player-active':''}"><img src="${image}" alt=""><div><b>${name}</b><small>${meta}</small></div>${active?'<span class="turn-pill">YOUR TURN</span>':''}</div>`;
}
function seqCard(card,action,attributes='',chosen=false) {
  if (!card) return `<div class="card-slot empty-slot"><span>+</span></div>`;
  const top=card.wild?'★':card.value;
  return `<button class="play-card ${card.wild?'wild-card':'number-card'} ${chosen?'selected-card':''}" data-action="${action}" ${attributes} aria-label="${card.wild?'Wild card':`Card ${card.value}`}">
    <span class="corner-value">${top}</span><span class="card-core">${top}</span><span class="corner-suit">${card.wild?'WILD':'◆'}</span></button>`;
}
function buildPile(state,index) {
  const pile=state.builds[index], last=pile.at(-1);
  const selected=ui.selected&&ui.selected.type!=='bot'&&state.active===0;
  const player=state.players[0];
  const source=ui.selected ? (ui.selected.type==='stock'?player.stock.at(-1):ui.selected.type==='hand'?player.hand[ui.selected.index]:player.discards[ui.selected.index]?.at(-1)) : null;
  const valid=selected && sequencePileTargets(state,source).includes(index);
  return `<button class="build-stack ${valid?'valid-target':''}" data-action="build" data-index="${index}" aria-label="Building stack ${index+1}; next ${last?last.playedValue+1:1}">
   <span class="stack-label">STACK ${String(index+1).padStart(2,'0')}</span><span class="stack-number">${last?last.playedValue:'+'}</span><span class="stack-next">${last?`NEXT ${last.playedValue+1}`:'START WITH 1'}</span></button>`;
}
function seqDiscardPile(pile,index,owner='human') {
  const card=pile.at(-1);
  return `<button class="mini-pile ${owner==='human'&&ui.selected?.type==='hand'?'pile-available':''}" data-action="${owner==='human'?'seq-discard-dest':'no-op'}" data-index="${index}" aria-label="Discard pile ${index+1}">
     <span class="mini-label">${index+1}</span><strong>${card?(card.wild?'★':card.value):'+'}</strong><small>${pile.length} card${pile.length===1?'':'s'}</small></button>`;
}
function rematchControl() {
 if(!isOnline() || ui.game?.winner===null)return '';
 const votes=ui.online.view?.rematchVotes??[false,false],requested=Boolean(votes[ui.online.seat]),opponent=Boolean(votes[1-ui.online.seat]);
 return `<div class="rematch-controls" role="status"><span>${requested?(opponent?'Starting the next match…':'Waiting for your friend to agree'):(opponent?'Your friend wants another game.':'Play again with the same opponent?')}</span><button class="btn ${requested?'btn-outline':'btn-primary'}" data-action="${requested?'rematch-cancel':'rematch-request'}">${requested?'Cancel request':'Request rematch'}</button></div>`;
}
function turnNotice(){
 if(!isOnline()||!ui.game)return '';
 const completed=ui.game.winner!==null,playing=ui.game.active===0;
 return `<div class="turn-notice ${completed?'turn-finished':playing?'turn-yours':'turn-theirs'}" role="status" aria-live="polite"><span class="turn-light" aria-hidden="true"></span><strong>${completed?'Match complete':playing?'YOUR TURN':`${escapeHtml(opponentName())}’s turn`}</strong><small>${completed?'Choose whether to play again':playing?'Choose a card or make your move':'The table will update automatically'} · ${escapeHtml(ui.netStatus||'Connecting')}</small></div>`;
}
function gameTop(g) {
 return `<div class="game-back"><button class="back-link" data-action="home">${icon('back')} All games</button><span class="divider-dot">◆</span><span>${g.category}</span></div>
 <div class="game-heading"><div><div class="eyebrow">${isOnline()?`PRIVATE TABLE · ${ui.online.code}`:'NOW PLAYING · THE HOUSE TABLE'}</div><h1>${g.title}</h1><p>${g.kicker}</p></div><div class="game-heading-actions">${isOnline()?`<button class="btn btn-outline" data-action="room-invite">${icon('people',17)} Invite link</button>`:''}<button class="btn btn-outline" data-action="rules">${icon('info',17)} How to play</button></div>${turnNotice()}`;
}
function actionSidebar(extra='') {
 const state=ui.game,g=gameInfo();
 return `<aside class="sidebar"><div class="side-panel side-identity"><div class="eyebrow">TABLE DETAILS</div><div class="side-row"><span>Game</span><strong>${g.title}</strong></div><div class="side-row"><span>Opponents</span><strong>${isOnline()?escapeHtml(opponentName()):'1 House Bot'}</strong></div><div class="side-row"><span>Mode</span><strong>${isOnline()?'Online private · 2 players':'Local solo preview'}</strong></div>${isOnline()?`<div class="side-row"><span>Connection</span><strong>${ui.netStatus||'Connecting'} · ${opponentProfile()?.connected?'Opponent online':'Opponent offline'}</strong></div>`:''}</div>${extra}
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
 saveSolo();sound('card');render();return true;
}
function resetArrangement(){ui.handOrders={};ui.orderUndo=[];ui.arranging=false;ui.arrangeFrom=null;ui.orderMessage='';}

function sequenceScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo();
 const isHuman=s.active===0&&s.winner===null;
 const selected=ui.selected;
 const side=`<div class="side-panel objectives"><span class="eyebrow">YOUR OBJECTIVE</span><h3>Empty the stockpile.</h3><p>Build the centre stacks upwards from 1 to 12. Play from your stockpile, hand, or the top of your discard stacks.</p>
   <div class="progress-row"><span>Stockpile remaining</span><b>${p.stock.length} / ${s.rules.stock}</b></div><div class="track"><span style="width:${Math.round((s.rules.stock-p.stock.length)/s.rules.stock*100)}%"></span></div>
   <div class="side-tip">${icon('sparkle',16)} Tip: play your stockpile first whenever possible.</div></div>`;
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner">
  <div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`${bot.stock.length} cards in stockpile`)}<div class="bot-cards">${Array.from({length:Math.min(5,bot.hand.length)},()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>
  <div class="felt-area"><div class="board-section-label">SHARED BUILDING STACKS</div><div class="build-grid">${s.builds.map((_,i)=>buildPile(s,i)).join('')}</div>
   <div class="board-hint">${s.winner!==null?'The match is over.': selected?.type==='hand'?'Choose a green stack to play, or a discard pile to finish your turn.': selected?'Choose a highlighted building stack.':'Select a card, then select a building stack.'}</div>
  </div>
  <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`${p.stock.length} cards left in your stockpile`,isHuman)}</div>
  <div class="your-tableau"><div class="hand-heading"><b>YOUR STOCKPILE</b><b>YOUR DISCARD STACKS</b></div><div class="stock-discard-row"><div class="stock-zone">${seqCard(p.stock.at(-1),'seq-source','data-type="stock" data-index="0"',selected?.type==='stock')}</div><div class="four-mini-piles">${p.discards.map((pile,i)=>seqDiscardPile(pile,i)).join('')}</div></div>
  <div class="hand-heading"><b>YOUR HAND <span>(${p.hand.length} cards)</span></b><small>${isHuman?'Select a card to play':'Waiting for turn'}</small></div>
  ${handToolbar('sequence')}<div class="hand-cards reordable-hand">${handItems('sequence',p.hand,(card,i)=>seqCard(card,'seq-source',`data-type="hand" data-index="${i}"`,selected?.type==='hand'&&selected.index===i))}</div>
  ${selected?.type==='discard'?'<div class="selection-advice">Discard stack selected. Play its top card on a highlighted shared stack.</div>':''}
  <div class="discard-heading">YOUR TOP DISCARD CARDS <span>Tap one to play it</span></div><div class="discard-choice">${p.discards.map((pile,i)=>`<button class="discard-source ${selected?.type==='discard'&&selected.index===i?'on':''}" data-action="seq-source" data-type="discard" data-index="${i}" ${pile.length?'':'disabled'}>Stack ${i+1}: <b>${pile.at(-1)?.wild?'★':pile.at(-1)?.value??'—'}</b></button>`).join('')}</div>
 </div></div>
 ${s.winner!==null?`<div class="game-banner ${s.winner===0?'win':'lose'}"><strong>${s.winner===0?'YOU WON THE TABLE!':isOnline()?'YOUR OPPONENT WON':'THE HOUSE BOT WON'}</strong><span>${s.winner===0?'Your stockpile is clear.':isOnline()?'Your opponent cleared their stockpile first.':'The bot cleared its stockpile first.'}</span>${isOnline()?rematchControl():`<button class="btn btn-primary" data-action="restart">Play again ${icon('arrow')}</button>`}</div>`:''}
 </section>${actionSidebar(side)}</div></main>`;
}
function contractCard(card,i) {
 const shown=card.wild?'★':card.value;
 return `<button class="play-card contract-card suit-${card.colour} ${card.wild?'wild-card':''} ${ui.selected?.type==='contract-hand'&&ui.selected.index===i?'selected-card':''}"
 data-action="contract-card" data-index="${i}" aria-label="${card.wild?'Wild card':`${card.value}, ${card.colour}`}">
 <span class="corner-value">${shown}</span><span class="card-core">${shown}</span><span class="corner-suit">${card.wild?'WILD':card.colour.toUpperCase()}</span></button>`;
}
function contractScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo(),missions=MISSION_SETS[s.mode],mission=currentMission(s,0);
 const match=findContract(p.hand,mission);
 const canLay=s.active===0&&s.step==='play'&&s.roundWinner===null&&Boolean(match);
 const human=s.active===0&&s.roundWinner===null;
 const drawn=s.step==='play';
 const side=`<div class="side-panel objectives"><span class="eyebrow">CURRENT CONTRACT</span>
 <span class="mission-index">MISSION ${Math.min(p.mission+1,missions.length)} / ${missions.length}</span><h3>${mission?.title||'All missions complete!'}</h3><p>${missionDescription(mission)}</p>
 <div class="track"><span style="width:${Math.round(p.mission/missions.length*100)}%"></span></div><div class="score-box"><span>YOU <b>${p.mission} contracts</b></span><span>${isOnline()?escapeHtml(opponentName()):'BOT'} <b>${bot.mission} contracts</b></span></div>
 <div class="side-tip">${icon('sparkle',16)} Complete the whole contract in one move. Wild cards can stand in for any value or colour.</div></div>`;
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner contract-table">
 <div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`Contract ${Math.min(bot.mission+1,missions.length)} of ${missions.length}`)}<div class="bot-cards">${Array.from({length:Math.min(bot.hand.length,6)},()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>
 <div class="contract-centre"><div class="eyebrow">ROUND ${s.round} <span class="diamond">◆</span> FIRST TO LAY WINS</div>
 <div class="draw-piles"><button class="draw-pile draw-deck" data-action="contract-draw" data-from="deck" ${(!human||drawn)?'disabled':''}>
   <span class="draw-card-logo">◆</span><b>DRAW DECK</b><small>${s.draw.length} cards</small></button>
 <button class="draw-pile draw-discard" data-action="contract-draw" data-from="discard" ${(!human||drawn)?'disabled':''}>
 <span class="discard-rank">${s.discard.at(-1)?.wild?'★':s.discard.at(-1)?.value??'—'}</span><b>TAKE DISCARD</b><small>${s.discard.at(-1)?.colour||'Empty'}</small></button></div>
 <p class="board-hint">${!human?'The round has ended.':drawn?'Now lay your contract, or select one card to discard.':'Draw from the deck or take the top discard card.'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`Contract ${Math.min(p.mission+1,missions.length)} of ${missions.length}`,human)}</div>
 <div class="your-tableau"><div class="hand-heading"><b>YOUR CARDS <span>(${p.hand.length})</span></b><small>${s.step==='draw'?'Draw one card first':'Choose your next move'}</small></div>${handToolbar('contract')}<div class="hand-cards contract-hand reordable-hand">${handItems('contract',p.hand,(card,i)=>contractCard(card,i))}</div>
 <div class="contract-actions"><button class="btn btn-primary" data-action="lay-contract" ${canLay?'':'disabled'}>${icon('check',17)} Lay my contract</button>
 <button class="btn btn-outline" data-action="contract-discard" ${human&&drawn&&ui.selected?.type==='contract-hand'?'':'disabled'}>Discard selected card ${icon('arrow',17)}</button></div>
 ${match&&human&&drawn?'<div class="matched-notice">✨ Your hand contains the full contract. Lay it now!</div>':''}
 </div></div>
 ${s.roundWinner!==null?`<div class="game-banner ${s.roundWinner===0?'win':'lose'}"><strong>${s.roundWinner===0?'CONTRACT COMPLETE!':isOnline()?'YOUR OPPONENT COMPLETED THEIR CONTRACT':'HOUSE BOT COMPLETED ITS CONTRACT'}</strong>
 <span>${s.roundWinner===0?'You advanced to the next contract.':isOnline()?'Your opponent advanced. Your contract carries into the next round.':'The bot advanced. Your contract will carry into the next round.'} ${s.winner!==null?'Match finished!':''}</span>
 ${isOnline()&&s.winner!==null?rematchControl():`<button class="btn btn-primary" data-action="${s.winner!==null?'restart':'next-round'}">${s.winner!==null?'New match':'Next round'} ${icon('arrow')}</button>`}</div>`:''}
 </section>${actionSidebar(side)}</div></main>`;
}
function rackScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo();
 const myTurn=s.active===0&&s.winner===null;
 const replacing=myTurn&&s.step==='replace';
 const side=`<div class="side-panel objectives"><span class="eyebrow">YOUR OBJECTIVE</span><h3>Make a perfect ladder.</h3><p>Arrange all ten cards in strictly ascending order, left to right. Draw, swap a slot or discard, then your opponent takes a turn.</p><div class="side-tip">${icon('sparkle',16)} Aim for smaller numbers on the left and larger numbers on the right.</div></div>`;
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner">
 <div class="opponent-area">${playerBadge(opponentName(),opponentImage(),'Ten hidden ladder cards')}<div class="bot-cards">${bot.rack.map(()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>
 <div class="rack-felt"><div class="board-section-label">NUMBER LADDER · 1 TO 60</div><div class="draw-piles"><button class="draw-pile draw-deck" data-action="rack-draw" data-from="deck" ${myTurn&&s.step==='draw'&&(s.draw.length||s.discard.length>1)?'':'disabled'}><span class="draw-card-logo">◆</span><b>DRAW CARD</b><small>${s.draw.length} left</small></button><button class="draw-pile draw-discard" data-action="rack-draw" data-from="discard" ${myTurn&&s.step==='draw'&&s.discard.length?'':'disabled'}><span class="discard-rank">${s.discard.at(-1)?.value??'—'}</span><b>TAKE DISCARD</b><small>Face up</small></button></div>
 <div class="rack-held">${s.held?`DRAWN CARD <strong>${s.held.value}</strong>`:s.winner!==null?'MATCH ENDED':myTurn?'CHOOSE A PILE TO DRAW':'WAITING FOR OPPONENT'}</div>
 <p class="board-hint">${replacing?'Choose which slot to replace, or discard the drawn card.':s.winner!==null?'The ladder is complete.':'Draw from the deck or take the discard to begin your move.'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,'Your ordering rack',myTurn)}</div>
 <div class="your-tableau"><div class="hand-heading"><b>YOUR TEN SLOTS</b><small>${replacing?'Tap a number to replace it':'Keep the numbers in ascending order'}</small></div><div class="rack-cards">${p.rack.map((card,i)=>`<button class="rack-slot" data-action="rack-replace" data-index="${i}" ${replacing?'':'disabled'} aria-label="Slot ${i+1}, card ${card.value}"><small>SLOT ${i+1}</small><strong>${card.value}</strong><span>${replacing?'SWAP':'◆'}</span></button>`).join('')}</div>
 <div class="contract-actions"><button class="btn btn-outline" data-action="rack-discard" ${replacing?'':'disabled'}>Discard drawn card ${icon('arrow',17)}</button></div></div></div>
 ${s.winner!==null?`<div class="game-banner ${s.winner===0?'win':'lose'}"><strong>${s.winner===0?'PERFECT LADDER!':isOnline()?'YOUR OPPONENT COMPLETED THE LADDER':'THE HOUSE BOT COMPLETED THE LADDER'}</strong><span>${s.winner===0?'All ten numbers are in order.':'The next match is another chance.'}</span>${isOnline()?rematchControl():`<button class="btn btn-primary" data-action="restart">Play again ${icon('arrow')}</button>`}</div>`:''}
 </section>${actionSidebar(side)}</div></main>`;
}
function tileFace(tile,attr='',selected=false){
 if(!tile)return '<span class="tile-back">◆</span>';
 return `<span class="tile-face tile-${tile.colour} ${selected?'tile-selected':''}" ${attr}>${tile.wild?'★':tile.value}<small>${tile.wild?'WILD':tile.colour.toUpperCase()}</small></span>`;
}
function tileScreen(){const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo(),myTurn=s.active===0&&s.winner===null,indices=ui.selected?.type==='tiles'?ui.selected.indices:[];
 const cards=indices.map(i=>p.rack[i]).filter(Boolean),valid=tileMeld(cards);
 const side=`<div class="side-panel objectives"><div class="eyebrow">YOUR OBJECTIVE</div><h3>Empty your tile rack.</h3><p>Select three or more tiles that form a matching-value set (different colours), or a same-colour consecutive run. Tap a table group to extend it.</p><p>After playing, end your turn. If you cannot play, draw one tile instead.</p><div class="side-tip">${icon('sparkle',16)} House rules: existing groups may be extended, but not rearranged.</div></div>`;
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner"><div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`${bot.rack.length} hidden tiles`)}<div class="bot-cards">${Array.from({length:Math.min(8,bot.rack.length)},()=>'<div class="tile-back">◆</div>').join('')}</div></div>
 <div class="tile-board"><div class="board-section-label">TABLE MELDS · TAP TO EXTEND</div><div class="tile-groups">${s.groups.length?s.groups.map((group,i)=>`<button class="tile-meld" data-action="tile-target" data-index="${i}" ${!myTurn||!indices.length?'disabled':''}><small>${group.type.toUpperCase()} ${i+1}</small><span class="tile-group-cards">${group.tiles.map(t=>tileFace(t)).join('')}</span></button>`).join(''):'<p class="board-hint">No groups laid yet. Play the first set or run.</p>'}</div>
 <p class="board-hint">${myTurn?`${indices.length} tile(s) selected${valid?' · Valid '+valid:''}. Choose “Lay new group”, or extend a table group.`:'Waiting for the other player.'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`${p.rack.length} tiles remaining`,myTurn)}</div><div class="your-tableau"><div class="hand-heading"><b>YOUR TILE RACK</b><small>Tap tiles to select several</small></div>${handToolbar('tiles')}<div class="tiles-rack reordable-hand">${handItems('tiles',p.rack,(t,i)=>`<button class="tile-button" data-action="tile-select" data-index="${i}" aria-pressed="${indices.includes(i)}" aria-disabled="${!myTurn}">${tileFace(t,'',indices.includes(i))}</button>`)}</div>
 <div class="contract-actions tile-actions"><button class="btn btn-primary" data-action="tile-lay" ${!myTurn||!valid?'disabled':''}>Lay new group ${icon('check',17)}</button><button class="btn btn-outline" data-action="tile-end" data-draw="false" ${!myTurn||(!s.playedThisTurn&&s.draw.length>0)?'disabled':''}>End turn</button><button class="btn btn-outline" data-action="tile-end" data-draw="true" ${!myTurn||s.playedThisTurn||!s.draw.length?'disabled':''}>Draw a tile (${s.draw.length})</button></div></div></div>
 ${s.winner!==null?`<div class="game-banner ${s.winner===0?'win':'lose'}"><strong>${s.winner===0?'YOU CLEARED YOUR RACK!':'OPPONENT CLEARED THEIR RACK'}</strong>${isOnline()?rematchControl():'<button class="btn btn-primary" data-action="restart">New match</button>'}</div>`:''}</section>${actionSidebar(side)}</div></main>`;
}
function lowCell(c,i,myTurn){const hidden=!c.revealed&&!c.cleared;return `<button class="low-card ${hidden?'low-hidden':c.cleared?'low-cleared':c.value<0?'low-negative':''}" data-action="low-slot" data-index="${i}" ${!myTurn||c.cleared?'disabled':''} aria-label="Grid card ${i+1}, ${hidden?'face down':c.cleared?'cleared':c.value}">${c.cleared?'✧':hidden?'◆':c.value}</button>`;}
function lowScreen(){const s=ui.game,p=s.players[0],opp=s.players[1],g=gameInfo(),turn=s.active===0&&s.roundWinner===null&&s.winner===null;
 const side=`<div class="side-panel objectives"><span class="eyebrow">FOUR ROUND CHALLENGE</span><h3>Keep it low.</h3><p>Draw a card and swap it into your 3 × 4 grid. Alternatively discard a deck draw to reveal a hidden card. Three matching revealed values in a column clear that column.</p><div class="score-box"><span>YOU <b>${p.score} points</b></span><span>${isOnline()?escapeHtml(opponentName()):'BOT'} <b>${opp.score} points</b></span></div><p>Lowest combined score after four rounds wins.</p></div>`;
 const held=s.held&&turn&&s.step==='place';
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner"><div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`Round ${s.round} · ${opp.score} total points`)}<div class="low-grid low-opponent">${opp.grid.map((c,i)=>lowCell(c,i,false)).join('')}</div></div>
 <div class="low-felt"><div class="eyebrow">ROUND ${s.round} / 4 · FEWEST POINTS WINS</div><div class="draw-piles"><button class="draw-pile draw-deck" data-action="low-draw" data-from="deck" ${turn&&s.step==='draw'?'':'disabled'}><span class="draw-card-logo">◆</span><b>DRAW DECK</b><small>${s.draw.length} cards</small></button><button class="draw-pile draw-discard" data-action="low-draw" data-from="discard" ${turn&&s.step==='draw'?'':'disabled'}><span class="discard-rank">${s.discard.at(-1)?.value??'—'}</span><b>TAKE DISCARD</b><small>Face up</small></button></div>
 <p class="rack-held">${held?`HELD CARD <strong>${s.held.value}</strong>`:s.roundWinner!==null?'ROUND COMPLETE':turn?'DRAW TO BEGIN YOUR TURN':'WAITING FOR OPPONENT'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`${p.score} points · current grid`,turn)}</div><div class="your-tableau"><div class="hand-heading"><b>YOUR 3 × 4 GRID</b><small>${held?'Choose where to place your card':'Reveal all cards to finish'}</small></div><div class="low-grid">${p.grid.map((c,i)=>lowCell(c,i,turn&&s.step==='place')).join('')}</div>
 <div class="contract-actions"><button class="btn ${ui.lowAction==='replace'?'btn-primary':'btn-outline'}" data-action="low-mode" data-mode="replace" ${held?'':'disabled'}>Swap into grid</button><button class="btn ${ui.lowAction==='flip'?'btn-primary':'btn-outline'}" data-action="low-mode" data-mode="flip" ${held&&s.drawnFrom==='deck'?'':'disabled'}>Discard & flip</button></div><p class="board-hint">${held?ui.lowAction==='flip'?'Choose a face-down card to reveal.':'Choose a grid position to replace, even one already face up.':'Three equal revealed numbers in one column clear automatically.'}</p></div></div>
 ${s.roundWinner!==null?`<div class="game-banner ${s.winner===-1?'':s.winner===null?'win':s.winner===0?'win':'lose'}"><strong>${s.winner!==null?s.winner===-1?'MATCH TIED':s.winner===0?'LOW-SCORE CHAMPION!':'YOUR OPPONENT WON':`ROUND ${s.round} FINISHED`}</strong><span>Totals: You ${p.score} · ${isOnline()?escapeHtml(opponentName()):'Bot'} ${opp.score} points.</span>${isOnline()&&s.winner!==null?rematchControl():`<button class="btn btn-primary" data-action="${s.winner===null?'next-round':'restart'}">${s.winner===null?'Next round':'New match'}</button>`}</div>`:''}</section>${actionSidebar(side)}</div></main>`;
}
const suitsGlyph={hearts:'♥',diamonds:'♦',clubs:'♣',spades:'♠'};
function eightFace(card,i,turn,s,reorderable=false){const legal=eightCanPlay(card,s);return `<button class="eight-card suit-${card.suit} ${legal&&turn?'eight-legal':''} ${ui.selected?.type==='eight'&&ui.selected.index===i?'selected-card':''}" data-action="eight-card" data-index="${i}" ${!turn&&!reorderable?'disabled':''} aria-disabled="${!turn}" aria-label="${card.value===8?'Wild eight':card.value===14?'Ace':card.value===13?'King':card.value===12?'Queen':card.value===11?'Jack':card.value} of ${card.suit}"><small>${card.value===14?'A':card.value===13?'K':card.value===12?'Q':card.value===11?'J':card.value}</small><b>${suitsGlyph[card.suit]}</b></button>`;}
function eightScreen(){const s=ui.game,p=s.players[0],opp=s.players[1],g=gameInfo(),turn=s.active===0&&s.winner===null,top=s.discard.at(-1);
 const side=`<div class="side-panel objectives"><span class="eyebrow">CARD MATCHING</span><h3>Get rid of every card.</h3><p>Match the discard's suit or rank, or play a wild eight and declare a new suit. Draw once if you need a card; you may then play or pass.</p><div class="side-tip">${icon('sparkle',16)} Play the colour or rank, but save your wild eights for difficult turns.</div></div>`;
 return `<main class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner"><div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`${opp.hand.length} cards remaining`)}<div class="bot-cards">${opp.hand.map(()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>
 <div class="eight-felt"><div class="board-section-label">ACTIVE SUIT: <b>${suitsGlyph[s.activeSuit]} ${s.activeSuit.toUpperCase()}</b></div><div class="eight-middle"><button class="draw-pile draw-deck" data-action="eight-draw" ${turn&&!s.drew?'':'disabled'}><span class="draw-card-logo">◆</span><b>DRAW ONE</b><small>${s.draw.length} remaining</small></button><div class="eight-top">${eightFace(top,-1,false,s)}</div></div><p class="board-hint">${turn?'Choose a highlighted card, or draw once.':'Waiting for the other player.'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`${p.hand.length} cards left`,turn)}</div><div class="your-tableau"><div class="hand-heading"><b>YOUR HAND</b><small>${s.drew?'Drawn this turn · play or pass':'Match rank or suit'}</small></div>${handToolbar('eights')}<div class="eight-hand reordable-hand">${handItems('eights',p.hand,(c,i)=>eightFace(c,i,turn,s,true))}</div>
 ${ui.selected?.type==='eight'&&p.hand[ui.selected.index]?.value===8?`<div class="suit-choice"><b>Choose a new suit:</b>${SUITS.map(suit=>`<button class="btn btn-outline" data-action="eight-suit" data-suit="${suit}">${suitsGlyph[suit]} ${suit}</button>`).join('')}</div>`:''}
 <div class="contract-actions"><button class="btn btn-outline" data-action="eight-pass" ${turn&&s.drew?'':'disabled'}>Pass after drawing ${icon('arrow',17)}</button></div></div></div>
 ${s.winner!==null?`<div class="game-banner ${s.winner===0?'win':'lose'}"><strong>${s.winner===0?'YOU PLAYED YOUR LAST CARD!':'OPPONENT WON THE HAND'}</strong>${isOnline()?rematchControl():'<button class="btn btn-primary" data-action="restart">New match</button>'}</div>`:''}</section>${actionSidebar(side)}</div></main>`;
}
function rulesText() {
 const g=gameInfo(),contract=g.kind==='contract';
 return g.kind==='tiles'?`<p>Each player starts with fourteen numbered tiles. Lay matching-number groups of three or four (each colour different) or same-colour consecutive runs of at least three.</p><ol><li>Select tiles in your rack, then lay a valid group onto the table.</li><li>Or select tiles and tap an existing group to extend it without making the group invalid.</li><li>After laying any tiles, end your turn. If you cannot or choose not to lay any, draw one tile instead.</li><li>First to empty their rack wins.</li></ol><p>House variant: table groups can be extended, not rearranged. Wild tiles act as jokers.</p>`:g.kind==='low'?`<p>Four rounds of card swapping. The player with the lowest accumulated total wins.</p><ol><li>Your 3 × 4 grid starts with two revealed cards.</li><li>Draw from the deck or take the face-up discard.</li><li>Swap your chosen card into any uncleared position. Alternatively, discard a deck draw and reveal one hidden card.</li><li>Three matching face-up values in the same column clear all three cards, scoring zero.</li><li>Once someone reveals their entire grid, the opponent takes one final turn. Hidden cards still score their values.</li><li>Play four rounds; lowest total wins. A tie is possible.</li></ol><p>Original four-round house variation inspired by low-score card games.</p>`:g.kind==='eights'?`<p>Match the top discarded card by suit or rank, or play an eight to declare any suit.</p><ol><li>Play a highlighted legal card from your hand.</li><li>For an eight, choose the suit that must be followed next.</li><li>If you do not play, draw one card. You may play after drawing, or pass.</li><li>The first player to empty their hand wins.</li></ol><p>Original simplified card-matching variant using a standard deck.</p>`:g.kind==='rack'?`<p>Build an ascending rack of ten cards from 1 to 60. Every card must be higher than the one before it.</p><ol><li>Draw the top card from the face-down deck or face-up discard pile.</li><li>Replace any one of your ten slots, or discard the card you picked up.</li><li>The replaced card becomes the new discard.</li><li>First player with all ten cards in strict ascending order wins.</li></ol><p>The other player's rack is always hidden. This is an original number-ordering variant.</p>`:contract?`<p>Take turns drawing one card from the deck or the face-up discard pile. Your goal is to collect the entire combination shown in the Current Contract panel.</p>
 <ol><li>Draw one card.</li><li>If your hand contains the full contract, choose <strong>Lay my contract</strong>.</li><li>Otherwise select a card from your hand and choose <strong>Discard selected card</strong>.</li><li>The first player to lay a complete contract wins that round and advances to their next mission. The other player stays on their existing mission.</li><li>Finish all ${MISSION_SETS[ui.mode].length} contracts to win the match. The unlaid player's cards count as penalty points.</li></ol>
 <p>${ui.mode==='crown-circuit'?'Crown Circuit has five suits, ranks 3–13, and a wild rank that changes with each new round. This is an original contract-based variant, not the exact Five Crowns rules.':ui.mode==='shanghai-nights'?'Shanghai Nights uses seven house contracts; discard buying is not part of this version.':''}</p><p>Wild cards can substitute for any number or colour. For a run, numbers must be consecutive, with no duplicate fixed numbers. Lower penalty scores are preferable as a tie-breaker.</p>`
 :`<p>Race your opponent to clear your personal stockpile. Build shared centre stacks upwards from 1 to 12. A wild card substitutes for whatever number is needed next.</p>
 <ol><li>Select the face-up card from your <strong>stockpile</strong>, hand, or one of your four discard stacks.</li><li>Choose a highlighted shared building stack to play that card. Each stack begins at 1, goes to 12, then clears.</li><li>You may keep playing while you have legal moves. If your hand becomes empty it automatically refills to five.</li><li>To finish your turn, select a card from your hand, then choose a personal discard stack.</li><li>The first player to empty their stockpile wins.</li></ol><p>Only the top card of a personal discard stack can be played. Always prioritise your stockpile — those are the cards that count towards victory.</p>`;
}
function modalContent() {
 if(!ui.modal)return '';
 const avatarModal=ui.modal==='avatars';
 return `<div class="modal-scrim" data-action="dismiss" role="presentation"><section class="modal ${avatarModal?'avatars-modal':'rules-modal'}" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
 <div class="modal-heading"><div><div class="eyebrow">${avatarModal?'THE STACKHOUSE CAST':'TABLE INSTRUCTIONS'}</div><h2 id="modal-heading">${avatarModal?'Choose your character':'How to play '+gameInfo().title}</h2></div><button class="close-btn" data-action="close" aria-label="Close">${icon('close',22)}</button></div>
 ${avatarModal?`<p class="modal-lead">Sixteen distinct personalities. The one you select appears at every table.</p><div class="avatar-grid">${avatars.map(a=>`<button class="avatar-choice ${a.id===ui.avatarId?'picked':''}" data-action="choose-avatar" data-id="${a.id}">
  <img src="${a.image}" alt="${a.name}" loading="eager"><span>${escapeHtml(a.name)}</span>${a.id===ui.avatarId?`<i>${icon('check',13)}</i>`:''}</button>`).join('')}</div>`
 :`<div class="rules-copy">${rulesText()}</div>`}
 <div class="modal-footer"><button class="btn btn-primary" data-action="close">${avatarModal?'Done — take a seat':'Got it'} ${icon('arrow')}</button></div>
 </section></div>`;
}
function render(){
 app.innerHTML=`<div class="site-wrap">${header()}${ui.screen==='home'?homeScreen():ui.screen==='room'?roomScreen():ui.game?.kind==='sequence'?sequenceScreen():ui.game?.kind==='rack'?rackScreen():ui.game?.kind==='tiles'?tileScreen():ui.game?.kind==='low'?lowScreen():ui.game?.kind==='eights'?eightScreen():contractScreen()}
 <footer class="site-footer"><span>STACKHOUSE SOCIAL <span class="diamond">◆</span> SOLO SAVE & HAND CONTROLS</span><span>Original games · UK English · ${isOnline()?'Server-authoritative private multiplayer':'Solo games + private two-player tables'}</span></footer></div>
 ${modalContent()}<span class="sr-only" role="status">${escapeHtml(ui.orderMessage)}</span>${ui.toast?`<div class="toast ${ui.toast.error?'error':''}" role="status">${escapeHtml(ui.toast.message)}</div>`:''}`;
}
function start(mode){
 stopOnline();
 const found=games.find(g=>g.id===mode);
 if(!found)return;
 ui.mode=mode;ui.screen='game';ui.selected=null;ui.modal=null;resetArrangement();
 const seed=sessionSeed();
   ui.game=found.kind==='sequence'?createSequenceGame({mode,seed}):found.kind==='rack'?createRackGame({mode,seed}):found.kind==='tiles'?createTileGame({mode,seed}):found.kind==='low'?createLowGame({mode,seed}):found.kind==='eights'?createEightGame({mode,seed}):createContractGame({mode,seed});
 saveSolo();sound('card');render();window.scrollTo({top:0,behavior:'instant'});
}
function checkBotTurn(){
 if(isOnline())return;
 if(ui.game?.active!==1||ui.game?.winner!==null||ui.game?.roundWinner!=null)return;
 ui.game=ui.game.kind==='sequence'?runSequenceBot(ui.game):ui.game.kind==='rack'?runRackBot(ui.game):ui.game.kind==='tiles'?runTileBot(ui.game):ui.game.kind==='low'?runLowBot(ui.game):ui.game.kind==='eights'?runEightBot(ui.game):runContractBot(ui.game);
 saveSolo();sound('card');render();
}
function runResult(result,botAfter=false){
 if(result.error){toast(result.error,true);return;}
 ui.game=result.state;ui.selected=null;
 saveSolo();sound(ui.game.winner!==null||ui.game.roundWinner!=null?'success':'card');render();
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
    return `<main class="room-page"><section class="room-panel"><div class="eyebrow">PRIVATE TABLE · WAITING FOR A FRIEND</div>
    <h1>Your table is ready.</h1><p>Share the private invite with one friend. Their phone will receive its own cards and turns.</p>
    <div class="room-code" aria-label="Room code ${room.code}">${room.code}</div>
    <div class="room-players">${room.players.map(p=>`<div class="room-player"><img src="${asset(p.avatar).image}" alt=""><b>${escapeHtml(p.name)}</b><span>Ready</span></div>`).join('')}<div class="room-player room-empty">${icon('people',25)}<b>Waiting for player two</b><span>The game starts when they join</span></div></div>
    <button class="btn btn-primary" data-action="room-invite">${icon('people')} Copy invitation link</button><button class="btn btn-outline" data-action="home">Leave lobby</button>
    <p class="room-small">${escapeHtml(ui.netStatus||'Connected')} · Invite codes are private, and only two players can take seats.</p></section></main>`;
  }
  const joining=Boolean(ui.roomCode);
  return `<main class="room-page"><section class="room-panel"><div class="eyebrow">THE PRIVATE LOUNGE</div>
    <h1>${joining?'Join a friend.':'Host a private table.'}</h1><p>Play live from separate phones or homes. Your cards are dealt by the server, and opponents cannot see your hand.</p>
    <label class="room-label" for="room-name">YOUR DISPLAY NAME</label>
    <input id="room-name" class="room-input" maxlength="24" autocomplete="nickname" placeholder="Your name" value="${escapeHtml(ui.roomName)}">
    ${joining?`<label class="room-label" for="room-code">SIX-CHARACTER ROOM CODE</label>
      <input id="room-code" class="room-input room-code-input" maxlength="6" autocomplete="off" spellcheck="false" value="${escapeHtml(ui.roomCode)}">`
      :`<label class="room-label" for="room-game">CHOOSE YOUR GAME</label><select id="room-game" class="room-input">${games.map(g=>`<option value="${g.id}" ${ui.roomMode===g.id?'selected':''}>${g.title}</option>`).join('')}</select>`}
    <div class="room-profile"><img src="${asset(ui.avatarId).image}" alt=""> <span>Playing as <b>${asset(ui.avatarId).name}</b></span><button class="btn btn-outline" data-action="avatars">Change</button></div>
    <button class="btn btn-primary room-submit" data-action="${joining?'room-join':'room-host'}">${joining?'Join private table':'Create private table'} ${icon('arrow')}</button>
    <button class="btn btn-ghost" data-action="room-switch">${joining?'Create a room instead':'I have an invite code'}</button>
    <p class="room-small">Two players per match. Multiplayer requires a running Node server; the offline HTML remains bot-only.</p>
    </section></main>`;
}
async function callRoom(url,{method='GET',body=null,token=null}={}) {
  const response=await fetch(url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  let result;try{result=await response.json();}catch{throw Error('The game server returned an unexpected response.');}
  if(!response.ok)throw Error(result.error||'The game server rejected the request.');
  return result;
}
function syncRoom(view) {
  if(!ui.online||ui.online.code!==view.code)return;
  if(ui.online.view && view.revision<ui.online.view.revision)return; // Never roll back newer state on a slow stream.
  const changed=ui.online.view?.revision!==view.revision;
  ui.online.view=view;
  ui.mode=view.mode;
  ui.avatarId=view.players[view.seat]?.avatar??ui.avatarId;
  localStorage.setItem('stackhouse.avatar',String(ui.avatarId));
  ui.game=view.game;
  ui.screen=view.status==='playing'?'game':'room';
  if(changed){ui.selected=null;ui.lowAction='replace';}
  render();
}
function connectRoom(code,token,view) {
  stopOnline();resetArrangement();ui.online={code,token,seat:view.seat,view:null};ui.netStatus='Connecting';syncRoom(view);
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
      if(!response.ok)throw Error(response.status===401?'Private room session expired.':'Could not connect to the game server.');
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
async function roomButton(action,control) {
  try {
    if(action==='room-open') {
      stopOnline();ui.screen='room';ui.game=null;resetArrangement();ui.roomMode=control.dataset.mode||ui.roomMode;ui.roomCode='';
      render();return;
    }
    if(action==='room-switch'){ui.roomCode=ui.roomCode?'':' ';render();return;}
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
      const result=await callRoom('/api/rooms',{method:'POST',body:{mode,name,avatar}});
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
  if(['room-open','room-switch','room-invite','room-host','room-join'].includes(action)){
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
  else if(action==='build'&&ui.selected)command={type:'sequence-play',sourceType:ui.selected.type,sourceIndex:ui.selected.index,pileIndex:Number(control.dataset.index)};
  else if(action==='seq-discard-dest'&&ui.selected?.type==='hand')command={type:'sequence-discard',handIndex:ui.selected.index,discardIndex:Number(control.dataset.index)};
  else if(action==='rack-draw')command={type:'rack-draw',from:control.dataset.from};
  else if(action==='rack-replace')command={type:'rack-replace',index:Number(control.dataset.index)};
  else if(action==='rack-discard')command={type:'rack-discard'};
  else if(action==='contract-draw')command={type:'contract-draw',from:control.dataset.from};
  else if(action==='contract-discard'&&ui.selected?.type==='contract-hand')command={type:'contract-discard',handIndex:ui.selected.index};
  else if(action==='lay-contract')command={type:'contract-lay'};
  if(command){event.stopImmediatePropagation();withRoomAction(command);}
},true);

// An invite opens the join screen, while your own stored seat reconnects automatically.
async function restoreRoom() {
  const code=new URL(location.href).searchParams.get('room')?.trim()?.toUpperCase();
  if(!code||!/^[A-Z2-9]{6}$/.test(code))return;
  const token=localStorage.getItem(`stackhouse.room.${code}`);
  if(token) {
    try {
      const view=await callRoom(`/api/rooms/${code}/state`,{token});connectRoom(code,token,view);return;
    }catch {localStorage.removeItem(`stackhouse.room.${code}`);}
  }
  ui.roomCode=code;ui.screen='room';render();
}

app.addEventListener('click',event=>{
 const control=event.target.closest('[data-action]');
 if(!control)return;
 const action=control.dataset.action;
 if(action==='dismiss'&&event.target!==control)return;
 if(['home','scroll-games','avatars','toggle-sound','close','dismiss','choose-avatar','start','restart','rules','next-round','solo-resume'].includes(action)) {
   switch(action){
     case 'home':stopOnline();ui.screen='home';ui.game=null;ui.selected=null;ui.modal=null;resetArrangement();render();break;
     case 'scroll-games':document.getElementById('games')?.scrollIntoView({behavior:'smooth'});break;
     case 'avatars':ui.modal='avatars';sound();render();break;
     case 'rules':ui.modal='rules';sound();render();break;
     case 'close':case 'dismiss':ui.modal=null;render();break;
     case 'toggle-sound':ui.soundOn=!ui.soundOn;localStorage.setItem('stackhouse.sound',String(ui.soundOn));sound();render();break;
     case 'choose-avatar':ui.avatarId=Number(control.dataset.id);localStorage.setItem('stackhouse.avatar',String(ui.avatarId));sound('success');render();break;
     case 'start':start(control.dataset.mode);break;
     case 'solo-resume':resumeSolo();break;
     case 'restart':start(ui.mode);break;
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
 }
});
window.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&ui.modal){ui.modal=null;render();}
});
render();
restoreRoom();
