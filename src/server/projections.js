import { canPassSequenceTurn, canReplenishSequenceHand } from '../engine/sequence.js';

const copyPile = (cards, showTop) => cards.length ? [...Array(cards.length-1).fill(null),showTop?cards.at(-1):null]:[];

/** Project one seat's view. No opponent hand, hidden stock or draw card identities are sent. */
export function projectGame(game, seat) {
  if(!game) return null;
  const order=[seat,...game.players.map((_,i)=>i).filter(i=>i!==seat)];
  const relative=index=>index===null||index===undefined||index===-1?index:order.indexOf(index);
  const adapt = (player, owned) => game.kind==='tiles' ? ({name:player.name,rack:owned?player.rack:Array(player.rack.length).fill(null)})
    : game.kind==='low' ? ({name:player.name,score:player.score,grid:player.grid.map(c=>c.revealed||c.cleared?{id:c.id,value:c.cleared?null:c.value,revealed:true,cleared:c.cleared}:{id:null,value:null,revealed:false,cleared:false})})
    : game.kind==='eights' ? ({name:player.name,hand:owned?player.hand:Array(player.hand.length).fill(null)})
    : game.kind==='rack' ? ({name:player.name,rack:owned?player.rack:Array(player.rack.length).fill(null)}) : game.kind==='sequence' ? ({
    name:player.name,
    stock:copyPile(player.stock,owned),
    hand:owned ? player.hand : Array(player.hand.length).fill(null),
    discards:player.discards.map(p=>copyPile(p,true))
  }) : ({name:player.name, mission:player.mission,score:player.score,laidDown:Boolean(player.laidDown),
    hand:owned ? player.hand : Array(player.hand.length).fill(null)});
  const shared = {kind:game.kind,mode:game.mode,active:relative(game.active),
    winner:relative(game.winner),
    roundWinner:relative(game.roundWinner),
    players:order.map(i=>adapt(game.players[i],i===seat)),
    log:game.log.slice(0,12)};
  if(game.kind==='tiles')return {...shared,groups:game.groups,turn:game.turn,turnLimit:game.turnLimit??null,playedThisTurn:game.playedThisTurn,draw:{length:game.draw.length},finalRackPoints:game.winner===null?null:game.finalRackPoints?order.map(i=>game.finalRackPoints[i]):null};
  if(game.kind==='low')return {...shared,round:game.round,step:game.step,held:game.active===seat?game.held:null,drawnFrom:game.active===seat?game.drawnFrom:null,closingSeat:game.closingSeat===null?null:(game.closingSeat===seat?0:1),draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='eights')return {...shared,turn:game.turn,drew:game.drew,activeSuit:game.activeSuit,draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='sequence') return {...shared, rules:game.rules,turn:game.turn,builds:game.builds,stalemate:Boolean(game.stalemate),canPass:canPassSequenceTurn(game,seat),canRefill:canReplenishSequenceHand(game,seat)};
  if(game.kind==='rack') return {...shared,step:game.step,turn:game.turn,held:game.active===seat?game.held:null,
    draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  return {...shared,round:game.round,step:game.step,matchLength:game.matchLength??'full',targetRounds:game.targetRounds??null,dealTurns:game.dealTurns??0,dealTurnLimit:game.dealTurnLimit??null,
    canBuy:game.mode==='shanghai-nights'&&game.buyWindow===true&&game.active!==seat&&!game.buyUsed?.[seat]&&game.roundWinner===null&&game.winner===null,
    draw:{length:game.draw.length},discard:game.discard,laid:game.laid,melds:game.mode==='contract-club'?(game.melds??[]).map(m=>({...m,owner:relative(m.owner)})):[]};
}

