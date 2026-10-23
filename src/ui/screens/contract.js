/** Contract tabletop renderer. Pure HTML generation; game actions remain server-authoritative. */
export function createContractScreen(context) {
  const {ui, isOnline, gameInfo, gameTop, actionSidebar, playerBadge, opponentName, opponentImage, asset, escapeHtml, icon, handToolbar, handItems, rematchControl, sequencePileTargets, canPassSequenceTurn, canReplenishSequenceHand, MISSION_SETS, currentMission, missionDescription, findContract, canLayOffContract, tileMeld, eightCanPlay, SUITS}=context;
function contractCard(card,i) {
 const shown=card.wild?'★':card.value;
 return `<button class="play-card contract-card suit-${card.colour} ${card.wild?'wild-card':''} ${ui.selected?.type==='contract-hand'&&ui.selected.index===i?'selected-card':''}"
 data-action="contract-card" data-index="${i}" aria-pressed="${ui.selected?.type==='contract-hand'&&ui.selected.index===i}" aria-label="${card.wild?'Wild card':`${card.value}, ${card.colour}`}">
 <span class="corner-value">${shown}</span><span class="card-core">${shown}</span><span class="corner-suit">${card.wild?'WILD':card.colour.toUpperCase()}</span></button>`;
}
function contractScreen() {
 const s=ui.game,p=s.players[0],bot=s.players[1],g=gameInfo(),missions=MISSION_SETS[s.mode],mission=currentMission(s,0);
 const group=isOnline()&&s.players.length>2,roundWinnerName=s.players[s.roundWinner]?.name||'Another player';
 const quick=s.matchLength==='quick',missionGoal=quick?Math.min(s.targetRounds??missions.length,missions.length):missions.length;
 const club=s.mode==='contract-club';
 const contractRanks=s.players.map((player,i)=>`<div class="contract-score-seat ${i===0?'own-contract':''}"><span>${i===0?'You':escapeHtml(player.name)}</span><strong>${player.mission} / ${missionGoal}</strong><small>${player.score} penalty pts${club&&player.laidDown?' · laid':''}</small></div>`).join('');
 const match=club&&p.laidDown?null:findContract(p.hand,mission);
 const canLay=s.active===0&&s.step==='play'&&s.roundWinner===null&&Boolean(match);
 const human=s.active===0&&s.roundWinner===null;
 const drawn=s.step==='play';
 const side=`<div class="side-panel objectives"><span class="eyebrow">CURRENT CONTRACT</span>
 <span class="mission-index">MISSION ${Math.min(p.mission+1,missions.length)} / ${missions.length} · ${quick?'QUICK MATCH':'FULL JOURNEY'}</span><h3>${club&&p.laidDown?'Contract laid — clear your hand':mission?.title||'All missions complete!'}</h3><p>${club&&p.laidDown?'Extend any shared set or run with matching cards. Empty your hand to end the deal.':missionDescription(mission)}</p>
 <div class="track"><span style="width:${Math.round(p.mission/missionGoal*100)}%"></span></div><div class="contract-progress-grid" aria-label="Every player’s contracts and penalty points">${contractRanks}</div>${club?`<p class="board-hint">Deal turn ${s.dealTurns??0} of ${s.dealTurnLimit??s.players.length*10} maximum · Closing time awards the deal to the lowest unplayed-hand points (ties draw).</p>`:''}
 <div class="side-tip">${icon('sparkle',16)} ${club?'Contract Club: laying a contract does not end the deal. Players lay off cards on public melds until somebody goes out. ':''}${quick?'Quick Match ends after '+s.targetRounds+' deals. Most missions wins; tied missions use fewest penalty points.':club?'Be the first to empty your hand.':'Complete the whole contract in one move.'} Wilds can stand in for any value or colour.</div></div>`;
 return `<main id="main-content" tabindex="-1" class="game-page">${gameTop(g)}<div class="game-layout"><section class="table-panel"><div class="table-inner contract-table">
 ${group?'':`<div class="opponent-area">${playerBadge(opponentName(),opponentImage(),`Contract ${Math.min(bot.mission+1,missions.length)} of ${missions.length}`)}<div class="bot-cards">${Array.from({length:Math.min(bot.hand.length,6)},()=>'<div class="card-back-sm">◆</div>').join('')}</div></div>`}
 <div class="contract-centre"><div class="eyebrow">ROUND ${s.round}${quick?' / '+s.targetRounds:''} <span class="diamond">◆</span> ${club?'LAY · BUILD ON MELDS · GO OUT':'FIRST TO LAY WINS THE DEAL'}</div>
 <div class="draw-piles"><button class="draw-pile draw-deck" data-action="contract-draw" data-from="deck" ${(!human||drawn)?'disabled':''}>
   <span class="draw-card-logo">◆</span><b>DRAW DECK</b><small>${s.draw.length} cards</small></button>
 <button class="draw-pile draw-discard" data-action="contract-draw" data-from="discard" ${(!human||drawn)?'disabled':''}>
 <span class="discard-rank">${s.discard.at(-1)?.wild?'★':s.discard.at(-1)?.value??'—'}</span><b>TAKE DISCARD</b><small>${s.discard.at(-1)?.colour||'Empty'}</small></button></div>
 ${club&&s.melds?.length?`<section class="club-melds" aria-label="Public contract melds"><strong>SHARED MELDS — ${s.melds.length}</strong><p>After laying your own contract, select one card and add it to a matching public meld.</p><div class="club-meld-grid">${s.melds.map((meld,i)=>`<button type="button" class="club-meld" data-action="contract-layoff" data-index="${i}" ${human&&drawn&&p.laidDown&&ui.selected?.type==='contract-hand'&&canLayOffContract(p.hand[ui.selected.index],meld)?'':'disabled'} aria-label="Extend ${escapeHtml(meld.kind)} belonging to ${escapeHtml(s.players[meld.owner]?.name??'player')}"><b>${escapeHtml(s.players[meld.owner]?.name??'Player')} · ${escapeHtml(meld.kind)}</b><span>${meld.cards.map(c=>c.wild?'★':c.value).join(' · ')}</span></button>`).join('')}</div></section>`:''}
 ${s.canBuy?`<div class="buy-discard-callout"><strong>Shanghai buying window</strong><p>The active player declined the discard. Take it, plus one face-down penalty card. Once per deal.</p><button class="btn btn-primary" data-action="contract-buy">Buy discarded card + penalty</button></div>`:''}
 <p class="board-hint">${s.roundWinner!==null?'The round has ended.':!human?'Wait for your turn.':drawn?club&&p.laidDown?'Lay off selected cards on the shared melds, or discard one card.':'Now lay your contract, or select one card to discard.':'Draw from the deck or take the top discard card.'}</p></div>
 <div class="bottom-player">${playerBadge('You',asset(ui.avatarId).image,`Contract ${Math.min(p.mission+1,missions.length)} of ${missions.length}`,human)}</div>
 <div class="your-tableau"><div class="hand-heading"><b>YOUR CARDS <span>(${p.hand.length})</span></b><small>${s.step==='draw'?'Draw one card first':'Choose your next move'}</small></div>${handToolbar('contract')}<div class="hand-cards contract-hand reordable-hand">${handItems('contract',p.hand,(card,i)=>contractCard(card,i))}</div>
 <div class="contract-actions"><button class="btn btn-primary" data-action="lay-contract" ${canLay?'':'disabled'}>${icon('check',17)} ${club&&p.laidDown?'Contract laid':'Lay my contract'}</button>
 <button class="btn btn-outline" data-action="contract-discard" ${human&&drawn&&ui.selected?.type==='contract-hand'?'':'disabled'}>Discard selected card ${icon('arrow',17)}</button></div>
 ${match&&human&&drawn?'<div class="matched-notice">✨ Your hand contains the full contract. Lay it now!</div>':''}
 </div></div>
 ${s.roundWinner!==null?`<div class="game-banner ${s.roundWinner===0?'win':'lose'}"><strong>${s.roundWinner===-1?'DEAL TIED ON POINTS':s.roundWinner===0?club?'YOU WENT OUT!':'CONTRACT COMPLETE!':isOnline()?`${escapeHtml(roundWinnerName).toUpperCase()} ${club?'WENT OUT':'COMPLETED THE CONTRACT'}`:club?'HOUSE BOT WENT OUT':'HOUSE BOT COMPLETED ITS CONTRACT'}</strong>
 <span>${club?'Players who laid their contracts advance. Unplayed cards count as penalty points.':s.roundWinner===0?'You advanced to the next contract.':isOnline()?`${escapeHtml(roundWinnerName)} advanced. Your contract carries into the next round.`:'The bot advanced. Your contract will carry into the next round.'} ${s.winner!==null?quick?(s.winner===-1?'Quick Match tied on missions and points!':`${escapeHtml(s.players[s.winner]?.name??'A player')} wins Quick Match on missions and points.`):'Match finished!':''}</span>
 ${isOnline()&&s.winner!==null?rematchControl():`<button class="btn btn-primary" data-action="${s.winner!==null?'restart':'next-round'}">${s.winner!==null?'New match':'Next round'} ${icon('arrow')}</button>`}</div>`:''}
 </section>${actionSidebar(side)}</div></main>`;
}
  return contractScreen();
}
