import { mulberry32, shuffle } from '../rng.js';
const clone = structuredClone;
const COLORS=['coral','gold','teal','violet'];
export function tileDeck(seed=42){let id=0;const tiles=Array.from({length:2},()=>COLORS.flatMap(colour=>Array.from({length:13},(_,i)=>({id:`t${++id}`,colour,value:i+1,wild:false})))).flat();tiles.push({id:'t105',colour:'wild',value:0,wild:true},{id:'t106',colour:'wild',value:0,wild:true});return shuffle(tiles,mulberry32(seed));}
export function tileMeld(cards){
 if(!Array.isArray(cards)||cards.length<3||cards.length>13)return null;
 if(cards.some(x=>!x||typeof x!=='object'))return null;
 const fixed=cards.filter(x=>!x.wild),wild=cards.length-fixed.length;
 const same=fixed.every(x=>x.value===fixed[0]?.value)&&new Set(fixed.map(x=>x.colour)).size===fixed.length;
 if(same&&cards.length<=4)return 'set';
 const colour=fixed.every(x=>x.colour===fixed[0]?.colour);
 if(colour){const vals=fixed.map(x=>x.value);if(new Set(vals).size===vals.length){const low=fixed.length?Math.min(...vals):1,high=fixed.length?Math.max(...vals):cards.length;
  if(high-low+1<=cards.length&&Math.max(1,high-cards.length+1)<=Math.min(low,14-cards.length))return 'run';}}
 return null;
}
export function createTileGame({mode='tile-royale',seed=42}={}){
 const draw=tileDeck(seed);
 const players=[0,1].map(i=>({name:i?'House Bot':'You',rack:draw.splice(0,14)}));
 return {kind:'tiles',mode,draw,players,groups:[],active:0,playedThisTurn:false,stalledTurns:0,winner:null,turn:1,log:['Build sets or colour runs of at least three tiles. Empty your rack to win.']};
}
function check(s){return s.winner===null?null:{error:'The match is finished.'};}
export function tileLay(input,indices,target=null){const s=clone(input);const err=check(s);if(err)return err;
 if(!Array.isArray(indices)||!indices.length||indices.length>13||!indices.every(i=>Number.isInteger(i)&&i>=0&&i<s.players[s.active].rack.length)||new Set(indices).size!==indices.length)return {error:'Select distinct tiles from your rack.'};
 if(target!==null&&(!Number.isInteger(target)||target<0||target>=s.groups.length))return {error:'Choose a valid table group.'};
 const rack=s.players[s.active].rack,chosen=indices.map(i=>rack[i]);
 const combined=target===null?chosen:[...s.groups[target].tiles,...chosen];
 const meld=tileMeld(combined);if(!meld)return {error:'You need a valid set or a consecutive run of at least three tiles.'};
 if(target===null)s.groups.push({type:meld,tiles:chosen});else s.groups[target]={type:meld,tiles:combined};
 s.players[s.active].rack=rack.filter((_,i)=>!indices.includes(i));s.playedThisTurn=true;s.stalledTurns=0;
 s.log.unshift(`${s.players[s.active].name} laid ${chosen.length} tile${chosen.length===1?'':'s'} in a ${meld}.`);
 if(!s.players[s.active].rack.length){s.winner=s.active;s.log.unshift(`${s.players[s.active].name} cleared their rack!`);}
 return {state:s};
}
export function tileEndTurn(input,drawCard=false){const s=clone(input);const err=check(s);if(err)return err;
 if(!drawCard&&!s.playedThisTurn&&s.draw.length)return {error:'Play a group or draw a tile to end your turn.'};
 if(drawCard){if(s.playedThisTurn)return {error:'You have played tiles. End your turn without drawing.'};if(!s.draw.length)return {error:'No tiles remain to draw.'};s.players[s.active].rack.push(s.draw.pop());s.log.unshift(`${s.players[s.active].name} drew a tile.`);}
 if(!s.playedThisTurn&&!drawCard&&!s.draw.length){s.stalledTurns++;if(s.stalledTurns>=2){const scores=s.players.map(p=>p.rack.reduce((a,t)=>a+(t.wild?20:t.value),0));s.winner=scores[0]<=scores[1]?0:1;s.log.unshift(`No tiles remain. ${s.players[s.winner].name} wins by rack points.`);}}else if(drawCard)s.stalledTurns=0;
 s.active=1-s.active;s.playedThisTurn=false;s.turn++;return {state:s};
}
function combos(n,k){const out=[],rec=(start,a)=>{if(a.length===k){out.push([...a]);return;}for(let i=start;i<=n-(k-a.length);i++){a.push(i);rec(i+1,a);a.pop();}};rec(0,[]);return out;}
export function runTileBot(input){let s=clone(input);if(s.active!==1||s.winner!==null)return s;
 for(let pass=0;pass<8&&s.winner===null;pass++){
  let pick=null,target=null;const rack=s.players[1].rack;
  for(let i=0;i<s.groups.length&&!pick;i++)for(let k=1;k<=Math.min(2,rack.length)&&!pick;k++)for(const group of combos(rack.length,k))if(tileMeld([...s.groups[i].tiles,...group.map(j=>rack[j])])){pick=group;target=i;break;}
  if(!pick)for(let k=5;k>=3&&!pick;k--)if(rack.length>=k)for(const group of combos(rack.length,k))if(tileMeld(group.map(i=>rack[i]))){pick=group;break;}
  if(!pick)break;const result=tileLay(s,pick,target);if(result.error)break;s=result.state;
 }
 if(s.winner===null){const finish=tileEndTurn(s,!s.playedThisTurn&&s.draw.length>0);if(!finish.error)s=finish.state;}
 return s;
}
