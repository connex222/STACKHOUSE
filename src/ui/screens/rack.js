/** Rack tabletop renderer. Pure HTML generation; game actions remain server-authoritative. */
export function createRackScreen(context) {
  const {ui, isOnline, gameInfo, gameTop, actionSidebar, playerBadge, opponentName, opponentImage, asset, escapeHtml, icon, handToolbar, handItems, rematchControl, sequencePileTargets, canPassSequenceTurn, canReplenishSequenceHand, MISSION_SETS, currentMission, missionDescription, findContract, canLayOffContract, tileMeld, eightCanPlay, SUITS}=context;
function rackScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo();
 const myTurn=s.active===0&&s.winner===null;
 const replacing=myTurn&&s.step==='replace';
 const side=`<div class="side-panel objectives"><span class="eyebrow">YOUR OBJECTIVE</span><h3>Make a perfect ladder.</h3><p>Arrange all ten cards in strictly ascending order, left to right. Draw, swap a slot or discard, then your opponent takes a turn.</p><div class="side-tip">${icon('sparkle',16)} Aim for smaller numbers on the left and larger numbers on the right.</div></div>`;
 return `<main id="main-content" tabindex="-1" class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner">
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
  return rackScreen();
}
