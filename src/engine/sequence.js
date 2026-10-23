import {choosePlannedSequenceMove} from './sequence-planner.js';
import { mulberry32, shuffle } from '../rng.js';

const SETTINGS = Object.freeze({
  'stack-run': { piles: 4, stock: 12, wilds: 12, title: 'Stack Run' },
  'malice-duel': { piles: 3, stock: 15, wilds: 8, title: 'Malice Duel' }
});
const human = { name: 'You' };
const computer = { name: 'House Bot' };
const clone = state => structuredClone(state);
const top = pile => pile.at(-1) ?? null;

export function createSequenceGame({ mode = 'stack-run', seed = 42, playerCount = 2 } = {}) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) throw Error('Sequencing supports 2–6 players.');
  const rules = SETTINGS[mode];
  if (!rules) throw new Error(`Unknown sequence mode: ${mode}`);
  let nextId = 0;
  const deck = [];
  for (let copies = 0; copies < 10; copies += 1) {
    for (let value = 1; value <= 12; value += 1) deck.push({ id: `s${++nextId}`, value, wild: false });
  }
  for (let i = 0; i < rules.wilds; i += 1) deck.push({ id: `s${++nextId}`, value: 0, wild: true });
  const draw = shuffle(deck, mulberry32(seed));
  const players = Array.from({length:playerCount},(_,i)=>i===0?human:i===1?computer:{name:`Player ${i+1}`}).map(player => ({
    ...player, stock: draw.splice(-rules.stock), hand: [], discards: [[],[],[],[]]
  }));
  const state = {
    kind: 'sequence', mode, seed, recycleCount: 0, rules, draw, recycled: [], builds: Array.from({length: rules.piles},()=>[]),
    players, active: 0, turn: 1, winner: null, passStreak: 0, stalemate: false, log: [`Welcome to ${rules.title}. Clear your stockpile to win.`]
  };
  drawToFive(state);
  return state;
}
/** A server supplies cryptoShuffle; solo sessions use a seeded Fisher–Yates shuffle. */
function drawCard(state, reshuffle = null) {
  if (!state.draw.length && state.recycled.length) {
    const cycle = (state.recycleCount ?? 0) + 1;
    const derivedSeed = ((state.seed ?? 42) ^ Math.imul(state.turn, 0x9e3779b9)
      ^ Math.imul(cycle, 0x85ebca6b)) >>> 0;
    state.draw = reshuffle
      ? reshuffle(state.recycled)
      : shuffle(state.recycled, mulberry32(derivedSeed));
    state.recycled = [];
    state.recycleCount = cycle;
  }
  return state.draw.pop() ?? null;
}
function drawToFive(state, reshuffle = null) {
  const hand = state.players[state.active].hand;
  while (hand.length < 5) {
    const card = drawCard(state, reshuffle);
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
/** Only a completely exhausted, empty-handed seat with no playable stock or
 * discard card can pass. This protects group games without allowing stalling. */
export function canPassSequenceTurn(state, seat=state.active) {
 if (state.winner!==null || seat!==state.active) return false;
 const player=state.players[seat];
 if (!player || player.hand.length || state.draw.length || state.recycled.length) return false;
 return !sequenceSources(state,seat).some(source=>sequencePileTargets(state,source.card).length);
}

/** Recovery when a turn begins empty-handed but the completed build stacks
 * supplied a recyclable deck on a different player's action. */
export function canReplenishSequenceHand(state,seat=state.active) {
 return state.winner===null && seat===state.active && state.players[seat]?.hand.length===0 && Boolean(state.draw.length||state.recycled.length);
}
export function replenishSequenceHand(input, reshuffle = null) {
 if(!canReplenishSequenceHand(input))return {error:'No hand refill is currently available.'};
 const state=clone(input);drawToFive(state, reshuffle);
 state.log.unshift(`${state.players[state.active].name} refilled an empty hand.`);
 state.passStreak=0;
 return {state};
}

export function passSequenceTurn(input, reshuffle = null) {
 if (!canPassSequenceTurn(input)) return {error:'You can only pass when the deck and your hand are empty and no stock or discard card can be played.'};
 const state=clone(input),player=state.players[state.active];
 state.passStreak=(state.passStreak||0)+1;
 state.log.unshift(`${player.name} had no legal move and passed.`);
 if (state.passStreak>=state.players.length) {
   const fewest=Math.min(...state.players.map(p=>p.stock.length));
   const tied=state.players.flatMap((p,i)=>p.stock.length===fewest?[i]:[]);
   state.winner=tied.length===1?tied[0]:-1;
   state.stalemate=true;
   state.log.unshift(tied.length===1?`${state.players[tied[0]].name} wins the exhausted-deck showdown with the fewest stockpile cards.`:'Exhausted-deck showdown tied on remaining stockpile cards. The game is drawn.');
 } else {
   state.active=(state.active+1)%state.players.length;
   state.turn++;
   drawToFive(state, reshuffle);
 }
 return {state};
}

export function playSequenceCard(input, sourceType, sourceIndex, pileIndex, reshuffle = null) {
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
  state.passStreak=0;
  state.log.unshift(`${player.name} played ${card.wild ? `a wild as ${needed}` : needed} from ${sourceType}.`);
  if (needed === 12) {
    state.recycled.push(...pile.splice(0));
    state.log.unshift(`Stack ${pileIndex+1} completed! Cards cleared.`);
  }
  if (!player.stock.length) {
    state.winner = state.active;
    state.log.unshift(`${player.name} cleared their stockpile and won!`);
  } else if (sourceType === 'hand' && !player.hand.length) {
    drawToFive(state, reshuffle);
    state.log.unshift(`${player.name} emptied their hand and drew again.`);
  }
  return { state };
}
export function discardSequenceCard(input, handIndex, discardIndex, reshuffle = null) {
  const state = clone(input);
  const player = state.players[state.active];
  if (state.winner !== null) return { error: 'The game has ended.' };
  if (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= 4) return { error: 'Invalid discard pile.' };
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) return { error: 'Choose a card from your hand.' };
  const [card] = player.hand.splice(handIndex,1);
  player.discards[discardIndex].push(card);
  state.passStreak=0;
  state.log.unshift(`${player.name} discarded ${card.wild ? 'wild' : card.value} and finished their turn.`);
  state.active = (state.active + 1) % state.players.length;
  state.turn += 1;
  drawToFive(state, reshuffle);
  return { state };
}
export function runSequenceBot(input,difficulty='standard',seat=1,reshuffle=null) {
  let state = clone(input);
  if (state.active !== seat || state.winner !== null) return state;
  for (let moves = 0; moves < 65; moves += 1) {
    const playable = sequenceSources(state).flatMap(source =>
      sequencePileTargets(state,source.card).map(target => ({ ...source, target })));
    if (!playable.length) break;
    const selected = (difficulty==='expert'?choosePlannedSequenceMove(state.builds.map(p=>p.length),sequenceSources(state),3):null)
      ?? (difficulty==='easy'?playable.find(move=>move.type==='hand'&&!move.card.wild):null)
      ?? playable.find(move => move.type === 'stock')
      ?? playable.find(move => move.type === 'discard')
      ?? playable.find(move => move.type === 'hand' && !move.card.wild)
      ?? playable[0];
    const result = playSequenceCard(state,selected.type,selected.index,selected.target,reshuffle);
    if (result.error) break;
    state = result.state;
    if (state.winner !== null) return state;
  }
  const hand = state.players[seat].hand;
  if (hand.length) {
    const bestIndex = hand.reduce((best,card,index)=>
      (card.wild ? -1 : card.value) > (hand[best].wild ? -1 : hand[best].value) ? index : best, 0);
    const piles = state.players[seat].discards;
    const shortest = difficulty==='expert' ? piles.findIndex(p=>!p.length) : -1;
    const finalPile=shortest>=0?shortest:piles.map(p=>p.length).indexOf(Math.min(...piles.map(p=>p.length)));
    return discardSequenceCard(state,bestIndex,finalPile,reshuffle).state;
  }
  if (canReplenishSequenceHand(state)) {
    // The solo House Bot has reached its safety move limit. Refill and yield.
    state=replenishSequenceHand(state,reshuffle).state;
    state.active=(seat+1)%state.players.length;
    return state;
  }
  if (canPassSequenceTurn(state)) return passSequenceTurn(state,reshuffle).state;
  // Preserve the solo demo safety turn cap, even if there are more than 65 plays.
  state.active=(seat+1)%state.players.length;
  drawToFive(state,reshuffle);
  return state;
}
