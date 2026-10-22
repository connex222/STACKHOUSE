/** Presentation-only helpers. Never change the authoritative game or player actions. */
export function nextMovePrompt(game,selected=null,opts={}) {
 if(!game)return null;
 const player=game.players?.[0];
 if(game.winner!==null&&game.winner!==undefined)return {title:game.winner===0?'You finished the match!':game.winner===-1?'It’s a draw!':'Good game!',detail:'Review the result and start another round with your opponent.',tone:'finish'};
 if(game.roundWinner!==null&&game.roundWinner!==undefined)return {title:game.roundWinner===0?'Contract completed!':'Round complete',detail:'Continue to the next round when you are ready.',tone:'finish'};
 if(game.active!==0)return {title:'Your opponent is thinking…',detail:'Your cards are safe. The next move will appear automatically.',tone:'wait'};
 switch(game.kind){
  case 'sequence':return selected?{title:'Card selected',detail:selected.type==='hand'?'Play on a glowing centre stack, or choose your discard pile to end your turn.':'Choose a highlighted centre stack to play this card.',tone:'go'}:{title:'Make your move',detail:`Try to play the top of your stockpile first (${player?.stock?.length??0} cards remaining).`,tone:'go'};
  case 'contract':return game.step==='draw'?{title:'Draw a card',detail:'Choose the face-down deck or the face-up discard pile.',tone:'go'}:opts.canLay?{title:'You have your contract!',detail:'Tap “Lay my contract” to complete this stage.',tone:'celebrate'}:selected?.type==='contract-hand'?{title:'Card selected',detail:'Discard the selected card, or choose another to keep building your contract.',tone:'go'}:{title:'Choose your discard',detail:'Select a card in your hand, then tap “Discard selected card”.',tone:'go'};
  case 'rack':return game.step==='draw'?{title:'Pick a new number',detail:'Draw from either pile, then decide which slot it improves.',tone:'go'}:{title:'Build your ladder',detail:`Place the ${game.held?.value??'drawn'} card in a slot, or discard it. Aim for an ascending sequence.`,tone:'go'};
  case 'tiles':return selected?.type==='tiles'&&selected.indices?.length?opts.validTile?{title:'Valid tile group!',detail:'Lay this group now or extend a compatible table group.',tone:'celebrate'}:{title:`${selected.indices.length} tile${selected.indices.length===1?'':'s'} selected`,detail:'Build three or more matching numbers of different colours, or a run in one colour.',tone:'go'}:game.playedThisTurn?{title:'Nice meld!',detail:'Play another group or tap “End turn”.',tone:'celebrate'}:{title:'Pick your tiles',detail:'Select three or more tiles to make a set or run. If stuck, draw a tile.',tone:'go'};
  case 'low':return game.step==='draw'?{title:'Choose a card',detail:'Draw from the deck or take the face-up discard.',tone:'go'}:{title:'Choose your grid position',detail:'Swap the held card into your grid, or discard a deck draw and flip a hidden card.',tone:'go'};
  case 'eights':return selected?.type==='eight'?{title:'Choose your suit',detail:'Your wild eight can declare any suit.',tone:'go'}:opts.legalCount>0?{title:'You have a playable card!',detail:`${opts.legalCount} legal card${opts.legalCount===1?'':'s'} highlighted. Match the rank or suit to shed your hand.`,tone:'go'}:game.drew?{title:'No match?',detail:'Pass the turn, or play the card you just drew if it matches.',tone:'go'}:{title:'Draw a card',detail:'No matching card in your hand. Draw one and try again.',tone:'go'};
  default:return {title:'Your turn',detail:'Choose your next move.',tone:'go'};
 }
}
export function readGameBeat(previous,next) {
 if(!previous||!next||previous.kind!==next.kind)return null;
 if(previous.winner===null&&next.winner!==null)return next.winner===0?{type:'win',message:'You won! What a finish!'}:next.winner===-1?{type:'round',message:'A dead heat!'}:{type:'lose',message:'Close one. Ready for a rematch?'};
 if(previous.roundWinner==null&&next.roundWinner!=null)return next.roundWinner===0?{type:'round',message:'Contract complete — brilliantly played!'}:{type:'round',message:'Round complete. The next one is yours.'};
 const before=previous.players?.[0],after=next.players?.[0];if(!before||!after)return null;
 if(next.kind==='sequence'&&after.stock?.length<before.stock?.length)return {type:'play',message:`Stockpile shrinking! ${after.stock.length} left.`};
 if(next.kind==='tiles'&&after.rack?.length<before.rack?.length)return {type:'play',message:`Group down! ${after.rack.length} tiles left.`};
 if(next.kind==='eights'&&after.hand?.length<before.hand?.length)return {type:'play',message:`Nice card! ${after.hand.length} left in your hand.`};
 if(next.kind==='low'&&after.grid&&before.grid&&after.grid.filter(c=>c.cleared).length>before.grid.filter(c=>c.cleared).length)return {type:'clear',message:'Column cleared — those cards now score zero!'};
 if(next.kind==='rack'&&after.rack&&before.rack&&JSON.stringify(after.rack)!==JSON.stringify(before.rack))return {type:'play',message:'New number in place. Keep climbing!'};
 return null;
}
/** Only visible personal cards participate in animations; do not fingerprint hidden opponent hands. */
export function visibleHandSignature(game) {
 if(!game)return '';
 const p=game.players?.[0];
 return JSON.stringify([game.kind,p?.hand,p?.rack,p?.grid,game.held,game.active,game.winner,game.roundWinner]);
}
