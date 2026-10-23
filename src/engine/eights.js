import {chooseExpertEightMove} from './eight-planner.js';
import {mulberry32,shuffle} from '../rng.js';
const clone=structuredClone;
export const SUITS=['hearts','diamonds','clubs','spades'];
export function eightDeck(seed=42){let n=0;return shuffle(SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({id:`e${++n}`,suit,value:i+2}))),mulberry32(seed));}
export function createEightGame({mode='eight-shift',seed=42,playerCount=2}={}){if(!Number.isInteger(playerCount)||playerCount<2||playerCount>6)throw Error('Eight Shift supports 2–6 players.');const draw=eightDeck(seed),players=Array.from({length:playerCount},(_,i)=>({name:i===0?'You':i===1?'House Bot':`Player ${i+1}`,hand:draw.splice(0,7)})),discard=[draw.pop()];return {kind:'eights',mode,draw,discard,players,active:0,activeSuit:discard[0].suit,drew:false,stalledTurns:0,winner:null,turn:1,log:['Match the active suit or rank. Eights change the suit. Empty your hand to win.']};}
export function eightCanPlay(card,game){return Boolean(card)&&(card.value===8||card.suit===game.activeSuit||card.value===game.discard.at(-1)?.value);}
export function eightPlay(input,index,newSuit=null){const s=clone(input);if(s.winner!==null)return {error:'Match finished.'};const hand=s.players[s.active].hand;if(!Number.isInteger(index)||index<0||index>=hand.length)return {error:'Choose a valid card.'};const card=hand[index];if(!eightCanPlay(card,s))return {error:'Match the suit or rank, or play an eight.'};if(card.value===8&&!SUITS.includes(newSuit))return {error:'Choose a suit for your eight.'};hand.splice(index,1);s.stalledTurns=0;s.discard.push(card);s.activeSuit=card.value===8?newSuit:card.suit;s.log.unshift(`${s.players[s.active].name} played ${card.value===8?'a wild eight':card.value} (${s.activeSuit}).`);if(!hand.length){s.winner=s.active;s.log.unshift(`${s.players[s.active].name} played their last card!`);}else{s.active=(s.active+1)%s.players.length;s.drew=false;s.turn++;}return {state:s};}
export function eightDraw(input,reshuffle=null){const s=clone(input);if(s.winner!==null||s.drew)return {error:'You may only draw one card per turn.'};if(!s.draw.length&&s.discard.length>1){const top=s.discard.pop();s.draw=reshuffle?reshuffle(s.discard):shuffle(s.discard,mulberry32(s.turn^s.players.reduce((n,p)=>n^p.hand.length,0)));s.discard=[top];}if(!s.draw.length)return {error:'There are no cards to draw.'};s.players[s.active].hand.push(s.draw.pop());s.drew=true;s.log.unshift(`${s.players[s.active].name} drew one card.`);return {state:s};}
export function eightPass(input){
 const s=clone(input);
 const stuck=!s.draw.length&&s.discard.length<=1&&!s.players[s.active].hand.some(card=>eightCanPlay(card,s));
 if(s.winner!==null||(!s.drew&&!stuck))return {error:'Draw once before passing, unless the deck is empty and you have no playable card.'};
 const previous=s.active;
 s.stalledTurns=stuck?(s.stalledTurns??0)+1:0;
 if(s.stalledTurns>=s.players.length){
  const scores=s.players.map(p=>p.hand.reduce((n,c)=>n+(c.value===8?20:c.value),0));
  const least=Math.min(...scores);
  s.winner=scores.filter(n=>n===least).length===1?scores.indexOf(least):-1;
  s.log.unshift(s.winner===-1?'No playable cards remain: tied hand points.':`${s.players[s.winner].name} wins on hand points as all players are blocked.`);
 }
 else{s.active=(s.active+1)%s.players.length;s.drew=false;s.turn++;}
 s.log.unshift(`${s.players[previous].name} passed.`);
 return {state:s};
}
// Choose a playable card without inspecting the human player's hidden hand.
// Keep wild eights until needed, then favour a suit represented in our hand.
export function chooseEightBotMove(state,difficulty='standard',seat=1){
 const hand=state.players[seat].hand;
 const choices=hand.map((card,i)=>({card,i})).filter(x=>eightCanPlay(x.card,state));
 if(!choices.length)return null;
 if(difficulty==='easy'){const first=choices[0];return {...first,suit:first.card.value===8?'hearts':null};}
 if(difficulty==='expert')return chooseExpertEightMove(hand,choices,state.discard,[]);
 const natural=choices.filter(x=>x.card.value!==8);
 const pool=natural.length?natural:choices;
 if(difficulty==='expert'&&hand.length===1){const last=choices[0];return {...last,suit:last.card.value===8?'hearts':null};}
 const ranked=pool.map(option=>{
  const remaining=hand.filter((_,i)=>i!==option.i);
  const preferred=option.card.value===8?
   SUITS.map(suit=>({suit,n:remaining.filter(c=>c.suit===suit).length})).sort((a,b)=>b.n-a.n||SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit))[0].suit:null;
  const playedSuit=preferred??option.card.suit;
  const follow=remaining.filter(c=>c.suit===playedSuit).length;
  const highCard=option.card.value===8?0:option.card.value;
  return {...option,suit:preferred,score:follow*20+highCard+(difficulty==='expert'?remaining.filter(c=>c.value===option.card.value).length*7:0)};
 });
 ranked.sort((a,b)=>b.score-a.score||a.i-b.i);
 return ranked[0];
}
export function runEightBot(input,difficulty='standard',seat=1,reshuffle=null){
 let s=clone(input);if(s.active!==seat||s.winner!==null)return s;
 let pick=chooseEightBotMove(s,difficulty,seat);
 if(!pick){const r=eightDraw(s,reshuffle);if(!r.error)s=r.state;pick=chooseEightBotMove(s,difficulty,seat);}
 if(pick){const result=eightPlay(s,pick.i,pick.suit);return result.error?s:result.state;}
 const result=eightPass(s);return result.error?s:result.state;
}
