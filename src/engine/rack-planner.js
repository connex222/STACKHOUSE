// Expert Number Ladder strategy. Uses only the acting player's rack and the
// face-up discard, never the opponent rack, the hidden deck or the RNG seed.
import {RACK_MAX,RACK_SIZE,isSortedRack} from './rack.js';

export function rackPositionCost(cards){
  let cost=0;
  for(let i=0;i<cards.length;i++){
    for(let j=i+1;j<cards.length;j++)if(cards[i].value>=cards[j].value)cost+=40;
    const ideal=(i+.5)*RACK_MAX/RACK_SIZE;
    cost+=Math.abs(cards[i].value-ideal)*.8;
    if(i>0&&cards[i].value-cards[i-1].value>15)
      cost+=(cards[i].value-cards[i-1].value-15)*1.5;
  }
  return cost;
}

const cardAt=(value)=>({value});
const changed=(rack,card,index)=>rack.map((old,i)=>i===index?card:old);

export function bestRackReplacement(rack,card){
  if(!card||rack.length!==RACK_SIZE)return null;
  const before=rackPositionCost(rack);
  let best=null;
  for(let index=0;index<RACK_SIZE;index++){
    const after=changed(rack,card,index);
    const winning=isSortedRack(after);
    const cost=winning?-1e6:rackPositionCost(after);
    if(cost<before-0.0001 && (!best || cost<best.cost))best={index,cost,winning};
  }
  return best;
}

// A hypothetical *uniform* next draw is used for planning, not a peek at
// actual hidden cards. Publicly seen cards are excluded from that model.
export function expectedRackFollowUp(rack,publicDiscard=[]){
  const known=new Set([...rack,...publicDiscard].filter(Boolean).map(c=>c.value));
  const baseline=rackPositionCost(rack);
  let sum=0,n=0;
  for(let value=1;value<=RACK_MAX;value++){
    if(known.has(value))continue;
    const replacement=bestRackReplacement(rack,cardAt(value));
    sum+=replacement?Math.max(-1000,replacement.cost):baseline;
    n++;
  }
  return n?sum/n:baseline;
}

export function chooseRackExpertDraw(rack,faceUpDiscard){
  const existing=rackPositionCost(rack);
  const discardMove=bestRackReplacement(rack,faceUpDiscard);
  if(!discardMove)return 'deck';
  if(discardMove.winning)return 'discard';
  const nextDrawExpectation=expectedRackFollowUp(rack,faceUpDiscard?[faceUpDiscard]:[]);
  // Public guaranteed improvement beats the expected unknown draw, with a
  // modest allowance for taking a useful discard now rather than gambling.
  return discardMove.cost<=Math.min(existing-1.5,nextDrawExpectation+1.5)?'discard':'deck';
}

// Before using the held card, compare its immediate effect with the expected
// shape of the rack after another draw. This is one-ply lookahead: legal
// actions only, no invented game state or access to hidden cards.
export function chooseRackExpertReplace(rack,held,publicDiscard=[]){
  const baseline=rackPositionCost(rack);
  let choice=null;
  for(let index=0;index<rack.length;index++){
    const candidate=changed(rack,held,index);
    if(isSortedRack(candidate))return index;
    const immediate=rackPositionCost(candidate);
    if(immediate>=baseline-0.0001)continue;
    const next=expectedRackFollowUp(candidate,publicDiscard);
    const weighted=.75*immediate+.25*next;
    if(!choice||weighted<choice.score)choice={index,score:weighted};
  }
  return choice?.index??null;
}
