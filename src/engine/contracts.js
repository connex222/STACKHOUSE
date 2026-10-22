import { mulberry32, shuffle } from '../rng.js';

export const MISSION_SETS = {
  'phase-quest': [
    {title:'Opening Gambit', groups:[['set',3],['run',3]]},
    {title:'Double Trouble',groups:[['set',3],['set',3]]},
    {title:'The Long Run',groups:[['run',6]]},
    {title:'Four of a Kind',groups:[['set',4],['colour',2]]},
    {title:'Lucky Seven',groups:[['run',7]]},
    {title:'Colour Theory',groups:[['colour',4],['set',3]]},
    {title:'Two Ways Up',groups:[['run',4],['run',4]]},
    {title:'High Five',groups:[['set',5]]},
    {title:'The Great Eight',groups:[['run',8]]},
    {title:'Final Flourish',groups:[['set',4],['run',5]]}
  ],
  'crown-circuit': [
    {title:'First Crown',groups:[['set',3]]},
    {title:'Royal Run',groups:[['run',3]]},
    {title:'Two Tribes',groups:[['set',3],['set',3]]},
    {title:'Five in Line',groups:[['run',5]]},
    {title:'One Colour',groups:[['colour',6]]},
    {title:'Grand Pairs',groups:[['set',4],['set',3]]},
    {title:'Seven Up',groups:[['run',7]]},
    {title:'Mix and Match',groups:[['set',3],['run',4]]},
    {title:'Eight Is Great',groups:[['run',8]]},
    {title:'Grand Court',groups:[['set',4],['run',5]]},
    {title:'Final Crown',groups:[['set',5],['run',5]]}
  ],
  'shanghai-nights': [
    {title:'Opening Pair',groups:[['set',3],['set',3]]},
    {title:'Three and Four',groups:[['set',3],['run',4]]},
    {title:'Seven Steps',groups:[['run',7]]},
    {title:'Double Colour',groups:[['colour',4],['set',3]]},
    {title:'Eight Steps',groups:[['run',8]]},
    {title:'Five and Four',groups:[['set',4],['run',5]]},
    {title:'Shanghai Finale',groups:[['set',3],['run',7]]}
  ],
  'contract-club': [
    {title:'First Deal',groups:[['set',3]]},
    {title:'Pairs of Three',groups:[['set',3],['set',3]]},
    {title:'On the Run',groups:[['run',5]]},
    {title:'Colour Collective',groups:[['colour',6]]},
    {title:'Triple and Trail',groups:[['set',3],['run',4]]},
    {title:'The Big Run',groups:[['run',7]]},
    {title:'Grand Contract',groups:[['set',4],['run',5]]}
  ]
};
const COLOURS = ['coral','gold','teal','violet'];
const clone = state => structuredClone(state);
const groupName = kind => ({set:'of a kind',run:'card run',colour:'of one colour'})[kind];
export const crownCardPenalty = card => card.wild ? 25 : card.value >= 11 ? 15 : card.value;
export const contractCardPenalty = (card, mode) => mode === 'crown-circuit' ? crownCardPenalty(card) : card.wild ? 20 : card.value;
export function missionDescription(mission) {
  if (!mission) return 'All contracts completed';
  return mission.groups.map(([kind,count])=> `${count} ${groupName(kind)}`).join(' + ');
}
export function buildContractDeck(seed,mode='phase-quest',round=1) {
  let id = 0;
  const cards = [];
  const crown=mode==='crown-circuit';
  const colours=crown?['stars','moons','waves','flames','leaves']:COLOURS;
  for (let copies = 0; copies < 2; copies++) {
    for (const colour of colours) {
      for (let value = crown?3:1; value <= (crown?13:12); value++) cards.push({id:`c${++id}`,value,colour,wild:crown&&value===Math.min(13,round+2)});
    }
  }
  for (let i=0;i<(crown?6:12);i++) cards.push({id:`c${++id}`,value:0,colour:'wild',wild:true});
  return shuffle(cards,mulberry32(seed));
}
export function validGroup(cards, kind, count) {
  if (cards.length !== count || !cards.length) return false;
  const fixed=cards.filter(c=>!c.wild);
  if (kind === 'set') return fixed.every(c => c.value === fixed[0].value);
  if (kind === 'colour') return fixed.every(c=>c.colour===fixed[0].colour);
  if (kind === 'run') {
    const values=fixed.map(c=>c.value);
    if(new Set(values).size!==values.length) return false;
    return Array.from({length:14-count},(_,i)=>i+1).some(start=>values.every(v=>v>=start && v<start+count));
  }
  return false;
}
function choose(cards,count,offset=0,acc=[],out=[]) {
  if(acc.length===count){out.push([...acc]);return out;}
  for(let i=offset;i<=cards.length-(count-acc.length);i++) {
    acc.push(cards[i]);choose(cards,count,i+1,acc,out);acc.pop();
  }
  return out;
}
/** Find the exact cards for a contract without reusing a card across groups. */
export function findContract(hand,mission) {
  if(!mission || mission.groups.reduce((n,g)=>n+g[1],0)>hand.length) return null;
  function match(remaining,groupIndex,chosen) {
    if(groupIndex===mission.groups.length) return chosen;
    const [kind,count]=mission.groups[groupIndex];
    for(const group of choose(remaining,count)) {
      if(!validGroup(group,kind,count)) continue;
      const ids=new Set(group.map(c=>c.id));
      const result=match(remaining.filter(c=>!ids.has(c.id)),groupIndex+1,[...chosen,group]);
      if(result) return result;
    }
    return null;
  }
  return match(hand,0,[]);
}
export function createContractGame({ mode='phase-quest',seed=42,playerCount=2,matchLength='full' }={}) {
  if(!Number.isInteger(playerCount)||playerCount<2||playerCount>6)throw Error('Contract tables support 2–6 players.');
  if(!MISSION_SETS[mode]) throw new Error(`Unknown contract mode: ${mode}`);
  if(!['full','quick'].includes(matchLength)) throw new Error('Choose a full or quick contract match.');
  const state = {
    kind:'contract',mode,seed,round:1,active:0,step:'draw',matchLength,
    targetRounds:matchLength==='quick'?playerCount*2:null,buyWindow:false,buyUsed:[],dealTurns:0,dealTurnLimit:mode==='contract-club'?playerCount*10:null,
    players:Array.from({length:playerCount},(_,i)=>({name:i===0?'You':i===1?'House Bot':`Player ${i+1}`,mission:0,score:0,hand:[],laidDown:false})),
    draw:[],discard:[],laid:[],melds:[],roundWinner:null,winner:null,
    log:[`Welcome to ${mode==='phase-quest'?'Phase Quest':mode==='crown-circuit'?'Crown Circuit':mode==='shanghai-nights'?'Shanghai Nights':'Contract Club'}. Complete your contract before the bot.`]
  };
  return dealRound(state);
}
function dealRound(state) {
  state.draw=buildContractDeck((state.seed+Math.imul(state.round,0x9e3779b9))>>>0,state.mode,state.round);
  state.discard=[];
  state.laid=[];state.melds=[];
  state.buyWindow=false;state.buyUsed=Array(state.players.length).fill(false);state.dealTurns=0;
  for(const player of state.players){player.hand=state.draw.splice(-10);player.laidDown=false;}
  state.discard.push(state.draw.pop());
  state.step='draw';state.roundWinner=null;
  state.active=(state.round-1)%state.players.length;
  return state;
}
export function currentMission(state,playerIndex=state.active) {
  return MISSION_SETS[state.mode][state.players[playerIndex].mission] ?? null;
}
export function drawContractCard(input,from='deck') {
  const state=clone(input);
  if(state.winner!==null || state.roundWinner!==null) return {error:'Finish this round first.'};
  if(state.step!=='draw') return {error:'Discard or lay your contract before drawing again.'};
  if(!['deck','discard'].includes(from)) return {error:'Unknown draw source.'};
  if(from==='deck' && !state.draw.length && state.discard.length>1) {
    const top=state.discard.pop();
    state.draw=shuffle(state.discard,mulberry32(state.seed^state.round^state.players.reduce((sum,p)=>sum+p.score,0)));
    state.discard=[top];
  }
  const picked=from==='deck' ? state.draw.pop() : state.discard.pop();
  if(!picked) return {error:'No cards available from that pile.'};
  state.players[state.active].hand.push(picked);
  state.step='play';
  // Shanghai: choosing the deck gives rivals one chance to buy the top discard.
  state.buyWindow=state.mode==='shanghai-nights'&&from==='deck'&&state.discard.length>0&&state.draw.length>0;
  state.log.unshift(`${state.players[state.active].name} drew from ${from==='deck'?'the deck':'the discard pile'}.`);
  return {state};
}
/** Shanghai Nights: an out-of-turn rival may buy the declined face-up discard.
 * They must also draw a penalty card and cannot buy twice in one deal.
 * The active player's turn and stage do not change. */
export function buyShanghaiDiscard(input,buyerIndex) {
  const state=clone(input);
  if(state.mode!=='shanghai-nights')return {error:'Discard buying is only available in Shanghai Nights.'};
  if(state.winner!==null||state.roundWinner!==null||state.step!=='play'||!state.buyWindow)return {error:'The discard is not available to buy now.'};
  if(!Number.isInteger(buyerIndex)||buyerIndex<0||buyerIndex>=state.players.length||buyerIndex===state.active)return {error:'Only a waiting rival may buy.'};
  state.buyUsed??=Array(state.players.length).fill(false);
  if(state.buyUsed[buyerIndex])return {error:'You have already bought a discard this deal.'};
  if(!state.discard.length||!state.draw.length)return {error:'There must be a discard and a penalty card available.'};
  state.players[buyerIndex].hand.push(state.discard.pop(),state.draw.pop());
  state.buyUsed[buyerIndex]=true;state.buyWindow=false;
  state.log.unshift(`${state.players[buyerIndex].name} bought the discard and drew one penalty card.`);
  return {state};
}
export function discardContractCard(input,handIndex) {
  const state=clone(input);
  if(state.winner!==null || state.roundWinner!==null || state.step!=='play') return {error:'Draw a card first.'};
  const player=state.players[state.active];
  if(!Number.isInteger(handIndex) || handIndex<0 || handIndex>=player.hand.length) return {error:'Choose a card to discard.'};
  const [card]=player.hand.splice(handIndex,1);
  state.discard.push(card);
  state.buyWindow=false;
  state.log.unshift(`${player.name} discarded ${card.wild?'a wild':card.value}.`);
  if(state.mode==='contract-club'){
    if(player.laidDown&&!player.hand.length){finishContractClubDeal(state,state.active);return {state};}
    state.dealTurns=(state.dealTurns??0)+1;
    if(state.dealTurns>=state.dealTurnLimit){
      const penalties=state.players.map(p=>p.hand.reduce((sum,c)=>sum+contractCardPenalty(c,state.mode),0));
      const min=Math.min(...penalties),leaders=penalties.map((n,i)=>n===min?i:null).filter(x=>x!==null);
      finishContractClubDeal(state,leaders.length===1?leaders[0]:-1,'Closing time');
      return {state};
    }
  }
  state.active=(state.active+1)%state.players.length;
  state.step='draw';
  return {state};
}
/** Finish Contract Club only when a player sheds their last card, not merely on laying their contract. */
function finishContractClubDeal(state,winnerIndex,reason='Went out') {
  const player=state.players[winnerIndex];
  const penalties=state.players.map((rival,i)=>{
    const penalty=rival.hand.reduce((sum,card)=>sum+contractCardPenalty(card,state.mode),0);
    rival.score+=penalty;
    return {name:rival.name,penalty};
  });
  state.roundWinner=winnerIndex;state.buyWindow=false;
  state.log.unshift(reason==='Closing time'?`${player?.name??'Nobody'} ${player?'wins the deal on lowest unplayed-card points.':'tied on lowest unplayed-card points.'} Closing time after ten turns each.`:`${player.name} went out!`);
  state.log.unshift(`${penalties.map(p=>`${p.name}: +${p.penalty}`).join(' · ')} penalty points.`);
  finishContractMatch(state,winnerIndex);
}
function finishContractMatch(state,winningSeat){
  if(state.matchLength==='quick' && state.round>=state.targetRounds){
    const highest=Math.max(...state.players.map(p=>p.mission));
    const contenders=state.players.map((p,i)=>({index:i,mission:p.mission,score:p.score})).filter(p=>p.mission===highest);
    const lowest=Math.min(...contenders.map(p=>p.score));
    const leaders=contenders.filter(p=>p.score===lowest);
    state.winner=leaders.length===1?leaders[0].index:-1;
    state.log.unshift(state.winner===-1?'Quick Match drawn: tied contracts and penalties.':`${state.players[state.winner].name} wins Quick Match: most contracts, then fewest penalty points.`);
  }else if(state.mode==='contract-club'){
    const finished=state.players.map((p,i)=>({i,p})).filter(({p})=>p.mission>=MISSION_SETS[state.mode].length);
    if(finished.length){
      finished.sort((a,b)=>a.p.score-b.p.score);
      state.winner=finished.length>1&&finished[0].p.score===finished[1].p.score?-1:finished[0].i;
      state.log.unshift(state.winner===-1?'The grand contract ends in a draw.':`${state.players[state.winner].name} won the match!`);
    }
  }else if(state.players[winningSeat]?.mission>=MISSION_SETS[state.mode].length){
    state.winner=winningSeat;state.log.unshift(`${state.players[winningSeat].name} won the match!`);
  }
}
export function layContract(input) {
  const state=clone(input);
  if(state.winner!==null || state.roundWinner!==null || state.step!=='play') return {error:'Draw before laying your contract.'};
  const player=state.players[state.active];
  if(state.mode==='contract-club'&&player.laidDown)return {error:'You have already laid your contract this deal. Lay off cards instead.'};
  const mission=currentMission(state);
  const selected=findContract(player.hand,mission);
  if(!selected) return {error:'Your hand does not yet contain the required sets or runs.'};
  const ids=new Set(selected.flat().map(c=>c.id));
  player.hand=player.hand.filter(c=>!ids.has(c.id));
  state.laid.push(...selected.flat());
  player.mission+=1;
  if(state.mode==='contract-club'){
    player.laidDown=true;
    for(let i=0;i<selected.length;i++)state.melds.push({owner:state.active,kind:mission.groups[i][0],cards:selected[i]});
    state.log.unshift(`${player.name} laid “${mission.title}” — now shed your remaining cards onto the table.`);
    if(!player.hand.length)finishContractClubDeal(state,state.active);
    return {state};
  }
  const penalties=state.players.flatMap((rival,i)=>{
    if(i===state.active)return [];
    const penalty=rival.hand.reduce((sum,c)=>sum+contractCardPenalty(c,state.mode),0);
    rival.score+=penalty;
    return [{name:rival.name,penalty}];
  });
  state.roundWinner=state.active;
  state.buyWindow=false;
  state.log.unshift(`${player.name} completed “${mission.title}”! ${penalties.map(p=>`${p.name}: +${p.penalty}`).join(' · ')} penalty points.`);
  finishContractMatch(state,state.active);
  return {state};
}
/** After laying their own contract, a player may extend ANY public meld, one card at a time. */
export function canLayOffContract(card,meld) {
  return Boolean(card&&meld&&Array.isArray(meld.cards)&&meld.cards.length<13&&validGroup([...meld.cards,card],meld.kind,meld.cards.length+1));
}
export function layOffContract(input,handIndex,meldIndex){
  const state=clone(input);
  if(state.mode!=='contract-club')return {error:'Laying off is only available in Contract Club.'};
  if(state.winner!==null||state.roundWinner!==null||state.step!=='play')return {error:'Draw a card before laying off.'};
  const player=state.players[state.active];
  if(!player.laidDown)return {error:'Lay your own contract before extending a meld.'};
  if(!Number.isInteger(handIndex)||handIndex<0||handIndex>=player.hand.length)return {error:'Choose a valid card from your hand.'};
  if(!Number.isInteger(meldIndex)||meldIndex<0||meldIndex>=state.melds.length)return {error:'Choose a valid table meld.'};
  const card=player.hand[handIndex],meld=state.melds[meldIndex];
  if(!canLayOffContract(card,meld))return {error:'This card does not extend that set or run.'};
  player.hand.splice(handIndex,1);meld.cards.push(card);state.laid.push(card);
  state.log.unshift(`${player.name} laid off a card onto ${state.players[meld.owner].name}’s ${meld.kind}.`);
  if(!player.hand.length)finishContractClubDeal(state,state.active);
  return {state};
}
export function nextContractRound(input) {
  const state=clone(input);
  if(state.roundWinner===null || state.winner!==null) return {error:'Cannot start the next round yet.'};
  state.round+=1;
  state.log.unshift(`Round ${state.round} started.`);
  return {state:dealRound(state)};
}
export function runContractBot(input) {
  let state=clone(input);
  // In the local Shanghai game, the bot can also make an off-turn discard purchase.
  if(state.mode==='shanghai-nights'&&state.active===0&&state.buyWindow&&state.roundWinner===null&&state.winner===null){
    const top=state.discard.at(-1),hand=state.players[1].hand;
    const attractive=top?.wild||hand.some(card=>!card.wild&&(card.value===top?.value||(card.colour===top?.colour&&Math.abs(card.value-top.value)<=2)));
    if(attractive&&!state.buyUsed?.[1])return buyShanghaiDiscard(state,1).state??state;
  }
  if(state.active!==1 || state.roundWinner!==null || state.winner!==null) return state;
  const mission=currentMission(state,1);
  const top=state.discard.at(-1);
  const possibleWithDiscard=top && findContract([...state.players[1].hand,top],mission);
  let result=drawContractCard(state,possibleWithDiscard?'discard':'deck');
  if(result.error) return state;
  state=result.state;
  result=layContract(state);
  if(!result.error){
    state=result.state;
    if(state.mode!=='contract-club'||state.roundWinner!==null)return state;
  }
  if(state.mode==='contract-club'&&state.players[1].laidDown){
    for(let limit=0;limit<20&&state.players[1].hand.length&&state.roundWinner===null;limit++){
      let moved=false;
      for(let i=0;i<state.players[1].hand.length&&!moved;i++)for(let m=0;m<state.melds.length&&!moved;m++){
        if(canLayOffContract(state.players[1].hand[i],state.melds[m])){
          const step=layOffContract(state,i,m);if(!step.error){state=step.state;moved=true;}
        }
      }
      if(!moved)break;
    }
    if(state.roundWinner!==null)return state;
  }
  const hand=state.players[1].hand;
  // Prefer preserving wilds, pairs, and close runs. Ties are deterministic.
  const scores=hand.map(c=> {
    if(c.wild)return 10000;
    const near=hand.filter(x=>!x.wild && x!==c && Math.abs(x.value-c.value)<=2).length;
    const same=hand.filter(x=>!x.wild && x!==c && x.value===c.value).length;
    const colour=hand.filter(x=>!x.wild && x!==c && x.colour===c.colour).length;
    return same*6+near*2+colour+(12-c.value)*0.1;
  });
  const worst=scores.indexOf(Math.min(...scores));
  return discardContractCard(state,worst).state;
}
