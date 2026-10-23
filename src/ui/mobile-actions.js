/* Single-handed mobile toolbar, independent from app/network side effects. */
export function renderMobileActionBar({screen,game,selected,drawerOpen}, {sequencePileTargets,canReplenishSequenceHand,canPassSequenceTurn}) {
 if(screen!=='game'||!game)return '';
 const state=game,canMove=state.active===0&&state.winner===null&&state.roundWinner==null;
 let button='<span class="mobile-action-hint">Tap a card to play</span>';
 if(canMove){
  if(state.kind==='eights')button=state.drew?'<button data-action="eight-pass">Pass turn</button>':'<button data-action="eight-draw">Draw a card</button>';
  else if(state.kind==='contract')button=state.step==='draw'?'<button data-action="contract-draw" data-from="deck">Draw a card</button>':
    selected?.type==='contract-hand'?'<button data-action="contract-discard">Discard selected</button>':'<span class="mobile-action-hint">Lay or discard a card</span>';
  else if(state.kind==='rack')button=state.step==='draw'?'<button data-action="rack-draw" data-from="deck">Draw a card</button>':
    '<button data-action="rack-discard">Discard drawn card</button>';
  else if(state.kind==='low')button=state.step==='draw'?'<button data-action="low-draw" data-from="deck">Draw a card</button>':
    '<span class="mobile-action-hint">Choose a grid position</span>';
  else if(state.kind==='tiles')button=selected?.type==='tiles'&&selected.indices.length>=3?
    '<button data-action="tile-lay">Lay selected tiles</button>':
    `<button data-action="tile-end" data-draw="${!state.playedThisTurn&&state.draw.length>0}">${state.playedThisTurn?'End turn':'Draw / end turn'}</button>`;
  else if(state.kind==='sequence'){
    const source=selected?.type==='stock'?state.players[0].stock.at(-1):
      selected?.type==='hand'?state.players[0].hand[selected.index]:
      selected?.type==='discard'?state.players[0].discards[selected.index]?.at(-1):null;
    const targets=source?sequencePileTargets(state,source):[];
    button=targets.length?`<button data-action="build" data-index="${targets[0]}">Play on stack ${targets[0]+1}</button>`:
      state.canRefill||canReplenishSequenceHand(state)?'<button data-action="seq-refill">Refill hand</button>':
      state.canPass||canPassSequenceTurn(state)?'<button data-action="seq-pass">Pass turn</button>':
      '<span class="mobile-action-hint">Select a card</span>';
  }
 }
 return `<nav class="mobile-action-bar" aria-label="Game actions">${button}<button class="mobile-details-button" data-action="toggle-table-drawer" aria-controls="mobile-table-drawer" aria-expanded="${drawerOpen}">${drawerOpen?'Close details':'Details & log'}</button></nav>`;
}
