import { mulberry32, shuffle } from '../rng.js';

const clone = state => structuredClone(state);
export const RACK_SIZE = 10;
export const RACK_MAX = 60;
export const isSortedRack = rack => rack.length === RACK_SIZE && rack.every((card,i) => i === 0 || card.value > rack[i-1].value);

export function createRackGame({mode='number-ladder',seed=42}={}) {
  if(mode !== 'number-ladder') throw Error('Unknown ordering game.');
  const draw=shuffle(Array.from({length:RACK_MAX},(_,i)=>({id:`r${i+1}`,value:i+1})),mulberry32(seed));
  const players=[{name:'You',rack:draw.splice(-RACK_SIZE)},{name:'House Bot',rack:draw.splice(-RACK_SIZE)}];
  const state={kind:'rack',mode,seed,players,draw,discard:[],held:null,step:'draw',active:0,turn:1,winner:null,
    log:['Welcome to Number Ladder. Arrange all ten slots in ascending order.']};
  state.discard.push(state.draw.pop());
  if(isSortedRack(players[0].rack))state.winner=0;
  if(isSortedRack(players[1].rack))state.winner=1;
  return state;
}
function recycle(state) {
  if(state.draw.length===0 && state.discard.length>1) {
    const top=state.discard.pop();
    state.draw=shuffle(state.discard,mulberry32((state.seed^state.turn^0x731ab1e)>>>0));
    state.discard=[top];
  }
}
export function rackDraw(input,from='deck') {
  const state=clone(input);
  if(state.winner!==null||state.step!=='draw')return {error:'Finish your current turn first.'};
  if(!['deck','discard'].includes(from))return {error:'Choose a valid draw source.'};
  if(from==='deck')recycle(state);
  const card=from==='deck'?state.draw.pop():state.discard.pop();
  if(!card)return {error:'That pile is empty.'};
  state.held=card;
  state.step='replace';
  state.log.unshift(`${state.players[state.active].name} drew from the ${from==='deck'?'deck':'discard pile'}.`);
  return {state};
}
function advance(state) {
  state.active=1-state.active;
  state.turn++;
  state.held=null;
  state.step='draw';
}
export function rackReplace(input,index) {
  const state=clone(input);
  if(state.winner!==null || state.step!=='replace'||!state.held)return {error:'Draw a card before replacing a slot.'};
  if(!Number.isInteger(index)||index<0||index>=RACK_SIZE)return {error:'Choose one of the ten slots.'};
  const player=state.players[state.active];
  const old=player.rack[index];
  player.rack[index]=state.held;
  state.discard.push(old);
  state.log.unshift(`${player.name} replaced slot ${index+1}.`);
  if(isSortedRack(player.rack)) {
    state.winner=state.active;state.held=null;state.step='done';
    state.log.unshift(`${player.name} completed their ladder and won!`);
  } else advance(state);
  return {state};
}
export function rackDiscard(input) {
  const state=clone(input);
  if(state.winner!==null || state.step!=='replace'||!state.held)return {error:'Draw a card before discarding.'};
  state.discard.push(state.held);
  state.log.unshift(`${state.players[state.active].name} discarded their drawn card.`);
  advance(state);
  return {state};
}

// Compares the ordering of all pairs, then biases each number towards its
// approximate position along a 1–60 ladder. No peeking at the opponent's rack.
function rackCost(cards) {
  let penalty=0;
  for(let i=0;i<cards.length;i++) {
    for(let j=i+1;j<cards.length;j++)if(cards[i].value>=cards[j].value)penalty+=18;
    penalty+=Math.abs(cards[i].value-((i+.5)*RACK_MAX/RACK_SIZE));
  }
  return penalty;
}
function rackExpertCost(cards){
  let penalty=0;
  for(let i=0;i<cards.length;i++){
    for(let j=i+1;j<cards.length;j++)if(cards[i].value>=cards[j].value)penalty+=40;
    const ideal=((i+.5)*RACK_MAX/RACK_SIZE);
    penalty+=Math.abs(cards[i].value-ideal)*.8;
    if(i>0&&cards[i].value-cards[i-1].value>15)penalty+=(cards[i].value-cards[i-1].value-15)*1.5;
  }
  return penalty;
}
export function runRackBot(input,difficulty='standard') {
  let state=clone(input);
  if(state.active!==1||state.winner!==null)return state;
  const me=state.players[1];
  const cost=difficulty==='expert'?rackExpertCost:rackCost;
  const current=cost(me.rack);
  const top=state.discard.at(-1);
  const preview=card=>me.rack.map((old,i)=>cost(me.rack.map((value,j)=>j===i?card:value))).reduce((a,b)=>Math.min(a,b),Infinity);
  let from=top&&preview(top)<current?'discard':'deck';
  if(difficulty==='easy')from='deck';
  if(difficulty==='expert'&&top&&preview(top)<current)from='discard';
  let outcome=rackDraw(state,from);
  if(outcome.error)return state;
  state=outcome.state;
  const costs=me.rack.map((_,i)=>cost(state.players[1].rack.map((card,j)=>j===i?state.held:card)));
  const minimum=Math.min(...costs);
  if(difficulty==='easy'){
    const ideal=state.held?.value??0;const index=Math.max(0,Math.min(9,Math.floor((ideal-1)/6)));
    outcome= Math.abs(state.players[1].rack[index].value-ideal)>5?rackReplace(state,index):rackDiscard(state);
  }else outcome=minimum<current?rackReplace(state,costs.indexOf(minimum)):rackDiscard(state);
  return outcome.error?state:outcome.state;
}
