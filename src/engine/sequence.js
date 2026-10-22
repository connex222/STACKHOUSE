import { mulberry32, shuffle } from '../rng.js';

const SETTINGS = Object.freeze({
  'stack-run': { piles: 4, stock: 12, wilds: 12, title: 'Stack Run' },
  'malice-duel': { piles: 3, stock: 15, wilds: 8, title: 'Malice Duel' }
});
const human = { name: 'You' };
const computer = { name: 'House Bot' };
const clone = state => structuredClone(state);
const top = pile => pile.at(-1) ?? null;

export function createSequenceGame({ mode = 'stack-run', seed = 42 } = {}) {
  const rules = SETTINGS[mode];
  if (!rules) throw new Error(`Unknown sequence mode: ${mode}`);
  let nextId = 0;
  const deck = [];
  for (let copies = 0; copies < 10; copies += 1) {
    for (let value = 1; value <= 12; value += 1) deck.push({ id: `s${++nextId}`, value, wild: false });
  }
  for (let i = 0; i < rules.wilds; i += 1) deck.push({ id: `s${++nextId}`, value: 0, wild: true });
  const draw = shuffle(deck, mulberry32(seed));
  const players = [human, computer].map(player => ({
    ...player, stock: draw.splice(-rules.stock), hand: [], discards: [[],[],[],[]]
  }));
  const state = {
    kind: 'sequence', mode, rules, draw, recycled: [], builds: Array.from({length: rules.piles},()=>[]),
    players, active: 0, turn: 1, winner: null, log: [`Welcome to ${rules.title}. Clear your stockpile to win.`]
  };
  drawToFive(state);
  return state;
}
function drawCard(state) {
  if (!state.draw.length && state.recycled.length) {
    // Recycling is deterministic relative to the current session state.
    state.draw = state.recycled.reverse();
    state.recycled = [];
  }
  return state.draw.pop() ?? null;
}
function drawToFive(state) {
  const hand = state.players[state.active].hand;
  while (hand.length < 5) {
    const card = drawCard(state);
    if (!card) break;
    hand.push(card);
  }
}
export function sequenceSources(state, playerId = state.active) {
  const player = state.players[playerId];
  const sources = [];
  if (top(player.stock)) sources.push({ type: 'stock', index: 0, card: top(player.stock) });
  for (let index = 0; index < player.discards.length; index += 1) {
    const card = top(player.discards[index]);
    if (card) sources.push({ type: 'discard', index, card });
  }
  player.hand.forEach((card,index) => sources.push({ type: 'hand', index, card }));
  return sources;
}
export function sequencePileTargets(state, card) {
  if (!card) return [];
  return state.builds.flatMap((pile,index) => {
    const needed = pile.length ? top(pile).playedValue + 1 : 1;
    return (card.wild || card.value === needed) ? [index] : [];
  });
}
export function playSequenceCard(input, sourceType, sourceIndex, pileIndex) {
  const state = clone(input);
  if (state.winner !== null) return { error: 'The game has ended.' };
  const player = state.players[state.active];
  const pile = state.builds[pileIndex];
  if (!pile) return { error: 'Choose an available building stack.' };
  const sourcePile = sourceType === 'stock' ? player.stock
    : sourceType === 'hand' ? player.hand
    : sourceType === 'discard' ? player.discards[sourceIndex] : undefined;
  if (!sourcePile) return { error: 'Unknown card source.' };
  const card = sourceType === 'hand' ? sourcePile[sourceIndex] : top(sourcePile);
  if (!card) return { error: 'There is no card to play.' };
  if (!sequencePileTargets(state,card).includes(pileIndex)) return { error: 'That card cannot be placed on this stack.' };
  const needed = pile.length ? top(pile).playedValue + 1 : 1;
  if (sourceType === 'hand') sourcePile.splice(sourceIndex,1);
  else sourcePile.pop();
  pile.push({ ...card, playedValue: needed });
  state.log.unshift(`${player.name} played ${card.wild ? `a wild as ${needed}` : needed} from ${sourceType}.`);
  if (needed === 12) {
    state.recycled.push(...pile.splice(0));
    state.log.unshift(`Stack ${pileIndex+1} completed! Cards cleared.`);
  }
  if (!player.stock.length) {
    state.winner = state.active;
    state.log.unshift(`${player.name} cleared their stockpile and won!`);
  } else if (sourceType === 'hand' && !player.hand.length) {
    drawToFive(state);
    state.log.unshift(`${player.name} emptied their hand and drew again.`);
  }
  return { state };
}
export function discardSequenceCard(input, handIndex, discardIndex) {
  const state = clone(input);
  const player = state.players[state.active];
  if (state.winner !== null) return { error: 'The game has ended.' };
  if (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= 4) return { error: 'Invalid discard pile.' };
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) return { error: 'Choose a card from your hand.' };
  const [card] = player.hand.splice(handIndex,1);
  player.discards[discardIndex].push(card);
  state.log.unshift(`${player.name} discarded ${card.wild ? 'wild' : card.value} and finished their turn.`);
  state.active = 1 - state.active;
  state.turn += 1;
  drawToFive(state);
  return { state };
}
export function runSequenceBot(input,difficulty='standard') {
  let state = clone(input);
  if (state.active !== 1 || state.winner !== null) return state;
  for (let moves = 0; moves < 65; moves += 1) {
    const playable = sequenceSources(state).flatMap(source =>
      sequencePileTargets(state,source.card).map(target => ({ ...source, target })));
    if (!playable.length) break;
    const selected = (difficulty==='easy'?playable.find(move=>move.type==='hand'&&!move.card.wild):null)
      ?? playable.find(move => move.type === 'stock')
      ?? playable.find(move => move.type === 'discard')
      ?? playable.find(move => move.type === 'hand' && !move.card.wild)
      ?? playable[0];
    const result = playSequenceCard(state,selected.type,selected.index,selected.target);
    if (result.error) break;
    state = result.state;
    if (state.winner !== null) return state;
  }
  const hand = state.players[1].hand;
  if (hand.length) {
    const bestIndex = hand.reduce((best,card,index)=>
      (card.wild ? -1 : card.value) > (hand[best].wild ? -1 : hand[best].value) ? index : best, 0);
    const piles = state.players[1].discards;
    const shortest = difficulty==='expert' ? piles.findIndex(p=>!p.length) : -1;
    const finalPile=shortest>=0?shortest:piles.map(p=>p.length).indexOf(Math.min(...piles.map(p=>p.length)));
    return discardSequenceCard(state,bestIndex,finalPile).state;
  }
  state.active = 0;
  drawToFive(state);
  return state;
}
