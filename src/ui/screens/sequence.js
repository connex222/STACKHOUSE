/** Sequence tabletop renderer. Pure HTML generation; game actions remain server-authoritative. */
export function createSequenceScreen(context) {
  const {ui, isOnline, gameInfo, gameTop, actionSidebar, playerBadge, opponentName, opponentImage, asset, escapeHtml, icon, handToolbar, handItems, rematchControl, sequencePileTargets, canPassSequenceTurn, canReplenishSequenceHand, MISSION_SETS, currentMission, missionDescription, findContract, canLayOffContract, tileMeld, eightCanPlay, SUITS}=context;
function seqCard(card,action,attributes='',chosen=false) {
  if (!card) return `<div class="card-slot empty-slot"><span>+</span></div>`;
  const top=card.wild?'★':card.value;
  return `<button class="play-card ${card.wild?'wild-card':'number-card'} ${chosen?'selected-card':''}" data-action="${action}" ${attributes} ${action==='seq-source'?`aria-pressed="${chosen}"`:''} aria-label="${card.wild?'Wild card':`Card ${card.value}`}">
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
  const choosing=owner==='human'&&ui.selected?.type==='hand';
  const action=owner!=='human'?'no-op':choosing?'seq-discard-dest':'seq-source';
  return `<button class="mini-pile ${choosing?'pile-available':''}" data-action="${action}" data-type="discard" data-index="${index}" ${!card&&!choosing?'disabled':''} aria-pressed="${ui.selected?.type==='discard'&&ui.selected.index===index}" aria-label="Discard pile ${index+1}: ${choosing?'place selected card':card?'select its top card':'empty'}">
     <span class="mini-label">${index+1}</span><strong>${card?(card.wild?'★':card.value):'+'}</strong><small>${pile.length} card${pile.length===1?'':'s'}</small></button>`;
}

function sequenceScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo();
 const isHuman=s.active===0&&s.winner===null;
 const canPass=isHuman&&(isOnline()?Boolean(s.canPass):canPassSequenceTurn(s));
 const canRefill=isHuman&&(isOnline()?Boolean(s.canRefill):canReplenishSequenceHand(s));
 const selected=ui.selected;
 const side=`<div class="side-panel objectives"><span class="eyebrow">YOUR OBJECTIVE</span><h3>Empty the stockpile.</h3><p>Build the centre stacks upwards from 1 to 12. Play from your stockpile, hand, or the top of your discard stacks.</p>
   <div class="progress-row"><span>Stockpile remaining</span><b>${p.stock.length} / ${s.rules.stock}</b></div><div class="track"><span style="width:${Math.round((s.rules.stock-p.stock.length)/s.rules.stock*100)}%"></span></div>
   <div class="side-tip">${icon('sparkle',16)} Tip: play your stockpile first whenever possible.</div></div>`;
 return `<main id="main-content" tabindex="-1" class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner">
  <div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`${bot.stock.length} cards in stockpile`)}<div class="bot-cards">${Array.from({length:Math.min(5,bot.hand.length)},()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>
  <div class="felt-area"><div class="board-section-label">SHARED BUILDING STACKS</div><div class="build-grid">${s.builds.map((_,i)=>buildPile(s,i)).join('')}</div>
   <div class="board-hint">${s.winner!==null?'The match is over.':canRefill?'Refill your hand from the available deck.':canPass?'No cards or playable moves remain. Pass your turn.': selected?.type==='hand'?'Choose a green stack to play, or a discard pile to finish your turn.': selected?'Choose a highlighted building stack.':'Select a card, then select a building stack.'}</div>
  </div>
  <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`${p.stock.length} cards left in your stockpile`,isHuman)}</div>
  <div class="your-tableau"><div class="hand-heading"><b>YOUR STOCKPILE</b><b>YOUR DISCARD STACKS</b></div><div class="stock-discard-row"><div class="stock-zone">${seqCard(p.stock.at(-1),'seq-source','data-type="stock" data-index="0"',selected?.type==='stock')}</div><div class="four-mini-piles">${p.discards.map((pile,i)=>seqDiscardPile(pile,i)).join('')}</div></div>
  <div class="hand-heading"><b>YOUR HAND <span>(${p.hand.length} cards)</span></b><small>${isHuman?'Select a card to play':'Waiting for turn'}</small></div>
  ${handToolbar('sequence')}<div class="hand-cards reordable-hand">${handItems('sequence',p.hand,(card,i)=>seqCard(card,'seq-source',`data-type="hand" data-index="${i}"`,selected?.type==='hand'&&selected.index===i))}</div>
  ${canPass?'<button class="btn btn-outline" data-action="seq-pass">Pass — no legal moves</button>':''}
  ${canRefill?'<button class="btn btn-primary" data-action="seq-refill">Refill empty hand</button>':''}
  ${selected?.type==='discard'?'<div class="selection-advice">Discard stack selected. Play its top card on a highlighted shared stack.</div>':''}

 </div></div>
 ${s.winner!==null?`<div class="game-banner ${s.winner===0?'win':'lose'}"><strong>${s.winner===-1?'MATCH DRAWN':s.winner===0?'YOU WON THE TABLE!':isOnline()?`${escapeHtml(s.players[s.winner]?.name??'Another player')} WON THE TABLE`:'THE HOUSE BOT WON'}</strong><span>${s.stalemate?'The deck is exhausted. Fewest stockpile cards wins; a tie is a draw.':s.winner===0?'Your stockpile is clear.':isOnline()?'Your opponent cleared their stockpile first.':'The bot cleared its stockpile first.'}</span>${isOnline()?rematchControl():`<button class="btn btn-primary" data-action="restart">Play again ${icon('arrow')}</button>`}</div>`:''}
 </section>${actionSidebar(side)}</div></main>`;
}
  return sequenceScreen();
}
