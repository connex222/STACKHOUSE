/** Reusable rules-engine adapter boundary for private tables, bot play and TV projections.
 * RoomStore remains responsible for authentication, action idempotency, persistence,
 * cryptographic dealing and host permissions. Engine code never receives credentials. */
import {projectGame} from './projections.js';
import { createSequenceGame, playSequenceCard, discardSequenceCard, passSequenceTurn, replenishSequenceHand, runSequenceBot } from '../engine/sequence.js';
import { createContractGame, drawContractCard, discardContractCard, layContract, nextContractRound, buyShanghaiDiscard, layOffContract, runContractBot } from '../engine/contracts.js';
import { createRackGame, rackDraw, rackReplace, rackDiscard, runRackBot } from '../engine/rack.js';
import { createTileGame, tileLay, tileEndTurn, runTileBot } from '../engine/tiles.js';
import { createLowGame, lowDraw, lowReplace, lowFlip, lowNextRound, runLowBot } from '../engine/lowcard.js';
import { createEightGame, eightPlay, eightDraw, eightPass, runEightBot } from '../engine/eights.js';

const restrictedIndex=(value,max=999)=>Number.isInteger(value)&&value>=0&&value<=max;
const ACTION_TYPES={
 sequence:['sequence-play','sequence-discard','sequence-refill','sequence-pass'],
 contract:['contract-draw','contract-buy','contract-discard','contract-lay','contract-layoff','next-round'],
 rack:['rack-draw','rack-replace','rack-discard'],
 tiles:['tile-lay','tile-end'],
 low:['low-draw','low-replace','low-flip','next-round'],
 eights:['eight-play','eight-draw','eight-pass']
};
const modeKind={
 'stack-run':'sequence','malice-duel':'sequence',
 'phase-quest':'contract','contract-club':'contract','shanghai-nights':'contract','crown-circuit':'contract',
 'number-ladder':'rack','tile-royale':'tiles','low-glow':'low','eight-shift':'eights'
};
const factories={
 sequence:({mode,seed,playerCount})=>createSequenceGame({mode,seed,playerCount}),
 contract:({mode,seed,playerCount,matchLength})=>createContractGame({mode,seed,playerCount,matchLength}),
 rack:({mode,seed})=>createRackGame({mode,seed}),
 tiles:({mode,seed,playerCount})=>createTileGame({mode,seed,playerCount}),
 low:({mode,seed})=>createLowGame({mode,seed}),
 eights:({mode,seed,playerCount})=>createEightGame({mode,seed,playerCount})
};
const botEngines={
 sequence:(game,level,seat,shuffle)=>runSequenceBot(game,level,seat,shuffle),
 contract:(game,level,seat,shuffle)=>runContractBot(game,level,seat,shuffle),
 rack:(game,level,seat,shuffle)=>runRackBot(game,level,shuffle),
 tiles:(game,level,seat)=>runTileBot(game,level,seat),
 low:(game,level,seat,shuffle)=>runLowBot(game,level,shuffle),
 eights:(game,level,seat,shuffle)=>runEightBot(game,level,seat,shuffle)
};
function publicTVBoard(game) {
 return {
  kind:game.kind,active:game.active,winner:game.winner,roundWinner:game.roundWinner??null,
  round:game.round??null,turn:game.turn??null,step:game.step??null,
  activeSuit:game.activeSuit??null,drawCount:game.draw?.length??0,
  discardTop:game.discard?.at(-1)??null,
  builds:game.kind==='sequence'?game.builds:null,
  groups:game.kind==='tiles'?game.groups:null,
  melds:game.kind==='contract'&&game.mode==='contract-club'?(game.melds??[]):null,
  finalRackPoints:game.winner!==null&&game.kind==='tiles'?(game.finalRackPoints??null):null
 };
}
const modules=Object.fromEntries(Object.entries(factories).map(([kind,create])=>[kind,Object.freeze({
 kind,create,
 viewForSeat:(game,seat)=>projectGame(game,seat),
 viewForTV:publicTVBoard,
 // Candidate action types only. The authoritative apply step checks exact legality.
 listLegalActions:(game,seat)=>{
  if(game.winner!==null)return [];
  if(game.active===seat)return [...ACTION_TYPES[kind]];
  return kind==='contract'&&game.mode==='shanghai-nights'&&game.buyWindow===true
    &&!game.buyUsed?.[seat]?['contract-buy']:[];
 },
 applyAction:(game,action,context)=>applyGameAction(game,action,context),
 botMove:(game,level,seat,shuffle)=>botEngines[kind](game,level,seat,shuffle),
 isFinished:game=>game.winner!==null,
 scores:game=>game.finalRackPoints??game.players.map(p=>p.score??null)
})]));
export const GAME_MODULES=Object.freeze(modules);
export function getGameModule(mode) {
 const kind=modeKind[mode];
 if(!kind)throw Error('Unknown game mode.');
 return modules[kind];
}

export function applyGameAction(game,action,{seat,reshuffle,secureDeal}) {
 const kind=action.type;
 const cryptoShuffle=reshuffle;
 const securelyDeal=secureDeal;
 let outcome;
 switch(kind) {
  case 'tile-lay':
    if(game.kind!=='tiles'||!Array.isArray(action.indices)||action.indices.length>13||!action.indices.every(x=>restrictedIndex(x,99))||(action.target!==null&&action.target!==undefined&&!restrictedIndex(action.target,999)))throw Error('Invalid tile selection.');
    outcome=tileLay(game,action.indices,action.target??null);break;
  case 'tile-end':
    if(game.kind!=='tiles'||typeof action.draw!=='boolean')throw Error('Invalid tile turn action.');
    outcome=tileEndTurn(game,action.draw);break;
  case 'low-draw':
    if(game.kind!=='low'||!['deck','discard'].includes(action.from))throw Error('Invalid low-card draw.');
    if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1){const shuffled=structuredClone(game),top=shuffled.discard.pop();shuffled.draw=cryptoShuffle(shuffled.discard);shuffled.discard=[top];outcome=lowDraw(shuffled,'deck');}else outcome=lowDraw(game,action.from);break;
  case 'low-replace':
    if(game.kind!=='low'||!restrictedIndex(action.index,11))throw Error('Invalid grid position.');
    outcome=lowReplace(game,action.index);break;
  case 'low-flip':
    if(game.kind!=='low'||!restrictedIndex(action.index,11))throw Error('Invalid grid position.');
    outcome=lowFlip(game,action.index);break;
  case 'eight-play':
    if(game.kind!=='eights'||!restrictedIndex(action.index,60)||(action.suit!==null&&action.suit!==undefined&&!['hearts','diamonds','clubs','spades'].includes(action.suit)))throw Error('Invalid eight-card play.');
    outcome=eightPlay(game,action.index,action.suit??null);break;
  case 'eight-draw':
    if(game.kind!=='eights')throw Error('Invalid game action.');
    if(!game.draw.length&&game.discard.length>1){const shuffled=structuredClone(game),top=shuffled.discard.pop();shuffled.draw=cryptoShuffle(shuffled.discard);shuffled.discard=[top];outcome=eightDraw(shuffled);}else outcome=eightDraw(game);break;
  case 'eight-pass':
    if(game.kind!=='eights')throw Error('Invalid game action.');outcome=eightPass(game);break;
  case 'sequence-play':
    if(game.kind!=='sequence'||!['stock','hand','discard'].includes(action.sourceType)||!restrictedIndex(action.sourceIndex,100)||!restrictedIndex(action.pileIndex,3))throw Error('Invalid card action.');
    outcome=playSequenceCard(game,action.sourceType,action.sourceIndex,action.pileIndex,cryptoShuffle);break;
  case 'sequence-refill':
    if(game.kind!=='sequence')throw Error('Invalid sequence turn action.');
    outcome=replenishSequenceHand(game,cryptoShuffle);break;
  case 'sequence-pass':
    if(game.kind!=='sequence')throw Error('Invalid sequence turn action.');
    outcome=passSequenceTurn(game,cryptoShuffle);break;
  case 'sequence-discard':
    if(game.kind!=='sequence'||!restrictedIndex(action.handIndex,100)||!restrictedIndex(action.discardIndex,3))throw Error('Invalid discard action.');
    outcome=discardSequenceCard(game,action.handIndex,action.discardIndex,cryptoShuffle);break;
  case 'rack-draw':
    if(game.kind!=='rack'||!['deck','discard'].includes(action.from))throw Error('Invalid rack draw.');
    if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1) {
      const shuffled=structuredClone(game);
      const top=shuffled.discard.pop();
      shuffled.draw=cryptoShuffle(shuffled.discard);
      shuffled.discard=[top];
      outcome=rackDraw(shuffled,action.from);
    } else outcome=rackDraw(game,action.from);
    break;
  case 'rack-replace':
    if(game.kind!=='rack'||!restrictedIndex(action.index,9))throw Error('Invalid rack position.');
    outcome=rackReplace(game,action.index);break;
  case 'rack-discard':
    if(game.kind!=='rack')throw Error('Invalid rack discard.');
    outcome=rackDiscard(game);break;
  case 'contract-draw':
    if(game.kind!=='contract'||!['deck','discard'].includes(action.from))throw Error('Invalid draw action.');
    if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1) {
      const shuffled=structuredClone(game);
      const top=shuffled.discard.pop();
      shuffled.draw=cryptoShuffle(shuffled.discard);
      shuffled.discard=[top];
      outcome=drawContractCard(shuffled,action.from);
    } else outcome=drawContractCard(game,action.from);
    break;
  case 'contract-buy':
    if(game.kind!=='contract')throw Error('Invalid Shanghai buying action.');
    outcome=buyShanghaiDiscard(game,seat);break;
  case 'contract-discard':
    if(game.kind!=='contract'||!restrictedIndex(action.handIndex,100))throw Error('Invalid discard action.');
    outcome=discardContractCard(game,action.handIndex);break;
  case 'contract-lay':
    if(game.kind!=='contract')throw Error('Invalid contract action.');
    outcome=layContract(game);break;
  case 'contract-layoff':
    if(game.kind!=='contract'||!restrictedIndex(action.handIndex,100)||!restrictedIndex(action.meldIndex,99))throw Error('Invalid meld extension.');
    outcome=layOffContract(game,action.handIndex,action.meldIndex);break;
  case 'next-round':outcome=game.kind==='low'?lowNextRound(game):nextContractRound(game);
    if(outcome.state)outcome.state=securelyDeal(outcome.state);break;
  default:throw Error('Unknown game action.');
}
 return outcome;
}
