/** One-step Expert Eight Shift scorer. It uses the bot's hand, public discard
 * cards and the number of cards each opponent holds. No concealed ranks,
 * suits or draw-pile contents are supplied to this module. */
const EIGHT_PLANNER_SUITS=['hearts','diamonds','clubs','spades'];
export function chooseExpertEightMove(hand, options, publicDiscards, opponentHandCounts) {
  if(!options.length)return null;
  const threatened=opponentHandCounts.some(count=>count<=2);
  const visible=Object.fromEntries(EIGHT_PLANNER_SUITS.map(suit=>[suit,publicDiscards.filter(c=>c.suit===suit).length]));
  let selected=null, best=-Infinity;
  for(const option of options) {
    const remaining=hand.filter((_,i)=>i!==option.i);
    const suitOptions=option.card.value===8?EIGHT_PLANNER_SUITS:[option.card.suit];
    for(const suit of suitOptions) {
      // Cards the bot could play if the chosen suit survives around the table.
      const possible=remaining.filter(c=>c.value===8||c.suit===suit||c.value===option.card.value).length;
      const ownSuit=remaining.filter(c=>c.suit===suit&&c.value!==8).length;
      // The estimate counts only exposed discards and our own cards.
      const copiesNotSeen=Math.max(0,13-visible[suit]-hand.filter(c=>c.suit===suit).length);
      const blocking=threatened?(13-copiesNotSeen)*1.8:0;
      const shed=option.card.value===8?20:option.card.value;
      const preservingWild=option.card.value===8&&remaining.length>0&&!threatened?-16:0;
      const score=possible*8+ownSuit*3+shed*.75+blocking+preservingWild;
      if(score>best+1e-9){best=score;selected={...option,suit:option.card.value===8?suit:null};}
    }
  }
  return selected;
}
