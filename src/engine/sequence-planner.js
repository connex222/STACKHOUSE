/** Expert's bounded three-card lookahead. Inputs are *only* public build heights
 * and the cards visible to the bot: its hand and top stock/discard cards.
 * No deck, other seat hand, buried stock cards or RNG seed is examined.
 * Simulations never reveal the buried card underneath a played pile.
 */
export function choosePlannedSequenceMove(heights, visibleSources, depth = 3) {
  if (!Array.isArray(heights) || !Array.isArray(visibleSources)) return null;
  const piles = heights.map(n => Number(n) || 0);
  const sources = visibleSources.map(s => ({...s}));
  const maxDepth = Math.max(1, Math.min(3, Math.trunc(depth) || 1));
  const moves = (current, cards) => {
    const found = [];
    for (const card of cards) {
      if (!card.card || !['stock','hand','discard'].includes(card.type)) continue;
      for (let pile=0; pile<current.length; pile++) {
        const needed=current[pile]+1;
        if (card.card.wild || card.card.value===needed) {
          found.push({card,pile,needed});
        }
      }
    }
    return found;
  };
  const reward = move =>
    (move.card.type==='stock'?120:move.card.type==='discard'?13:5)
    - (move.card.card.wild?18:0) + (move.needed===12?2:0);
  function best(current,cards,remaining) {
    if (!remaining) return 0;
    let maximum = 0;
    for (const move of moves(current,cards)) {
      const nextHeights=[...current];nextHeights[move.pile]=move.needed===12?0:move.needed;
      // The only known card at the top of each discard/stock pile is consumed.
      const nextCards=cards.filter(card=>card!==move.card);
      const score=reward(move)+best(nextHeights,nextCards,remaining-1)*.94;
      maximum=Math.max(maximum,score);
    }
    return maximum;
  }
  let selected=null,high=-Infinity;
  for (const move of moves(piles,sources)) {
    const nextHeights=[...piles];nextHeights[move.pile]=move.needed===12?0:move.needed;
    const future=best(nextHeights,sources.filter(card=>card!==move.card),maxDepth-1);
    const score=reward(move)+future*.94;
    if (score>high+1e-9) {
      high=score;selected={type:move.card.type,index:move.card.index,target:move.pile};
    }
  }
  return selected;
}
