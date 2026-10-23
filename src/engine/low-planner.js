// Public-information planning for Low Glow. The value of a face-down grid
// card must NEVER influence a decision until it has been revealed.
const UNKNOWN_AVERAGE=5.3;

export function chooseLowExpertDraw(grid,discardTop){
  if(!discardTop)return 'deck';
  const visible=grid.filter(c=>c.revealed&&!c.cleared);
  const bestTarget=Math.max(UNKNOWN_AVERAGE,...visible.map(c=>c.value));
  if(discardTop.value<=2 || bestTarget-discardTop.value>=4)return 'discard';
  // A matching visible pair makes the third card valuable, even if it is high.
  for(let column=0;column<4;column++){
    const cells=[grid[column],grid[column+4],grid[column+8]];
    if(cells.filter(c=>c.revealed&&!c.cleared&&c.value===discardTop.value).length===2 &&
       cells.some(c=>!c.revealed&&!c.cleared))return 'discard';
  }
  return 'deck';
}

function columnBonus(grid,index,value){
  const column=index%4;
  const cells=[column,column+4,column+8];
  const other=cells.filter(i=>i!==index).map(i=>grid[i]);
  const matches=other.filter(c=>c.revealed&&!c.cleared&&c.value===value).length;
  if(matches===2)return 15+Math.max(0,value)*3;
  if(matches===1)return Math.max(0,value)*.6+1.5;
  return 0;
}

export function chooseLowExpertAction(grid,held,drawnFrom){
  if(!held)return null;
  let best=null;
  for(let index=0;index<grid.length;index++){
    const old=grid[index];
    if(old.cleared)continue;
    const assumedOld=old.revealed?old.value:UNKNOWN_AVERAGE;
    // Visible pairs are useful; breaking one loses future clearing options.
    const loss=old.revealed?columnBonus(grid,index,old.value)*.45:0;
    const score=assumedOld-held.value+columnBonus(grid,index,held.value)-loss;
    if(!best||score>best.score)best={type:'replace',index,score};
  }
  if(drawnFrom==='deck'){
    for(let index=0;index<grid.length;index++){
      if(grid[index].revealed||grid[index].cleared)continue;
      // Revealing an unknown tile keeps its unknown points but makes that
      // information usable on later turns; its face-down value is ignored.
      const score=1.6+(grid.filter(c=>!c.revealed&&!c.cleared).length<=3?1.2:0);
      if(!best||score>best.score)best={type:'flip',index,score};
    }
  }
  return best&&{type:best.type,index:best.index};
}
