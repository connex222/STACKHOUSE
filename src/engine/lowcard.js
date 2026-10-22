import {mulberry32,shuffle} from '../rng.js';
const clone=structuredClone;
export function lowDeck(seed=42){let n=0;return shuffle([[-2,5],[-1,10],[0,15],...Array.from({length:12},(_,i)=>[i+1,10])].flatMap(([value,copies])=>Array.from({length:copies},()=>({id:`l${++n}`,value}))),mulberry32(seed));}
function deal(s){const all=lowDeck((s.seed + Math.imul(s.round,0x9e3779b9))>>>0);s.players.forEach(p=>{p.grid=all.splice(0,12).map((card,i)=>({...card,revealed:i===0||i===11,cleared:false}));});s.draw=all;s.discard=[s.draw.pop()];s.held=null;s.drawnFrom=null;s.step='draw';s.active=(s.round-1)%2;s.roundWinner=null;s.closingSeat=null;s.log.unshift(`Round ${s.round} started.`);return s;}
export function createLowGame({mode='low-glow',seed=42}={}){return deal({kind:'low',mode,seed,round:1,players:[{name:'You',score:0,grid:[]},{name:'House Bot',score:0,grid:[]}],draw:[],discard:[],active:0,step:'draw',held:null,drawnFrom:null,roundWinner:null,winner:null,closingSeat:null,log:[]});}
export function lowScore(grid){return grid.reduce((n,c)=>n+(c.cleared?0:c.value),0);}
function clearColumns(s){const grid=s.players[s.active].grid;for(let col=0;col<4;col++){const cells=[grid[col],grid[col+4],grid[col+8]];if(cells.every(c=>c.revealed&&!c.cleared&&c.value===cells[0].value)){for(const cell of cells)cell.cleared=true;s.log.unshift(`${s.players[s.active].name} cleared a matching column!`);}}}
function afterTurn(s){clearColumns(s);const seat=s.active;
 if(s.closingSeat!==null&&seat!==s.closingSeat){const scores=s.players.map(p=>lowScore(p.grid));s.players.forEach((p,i)=>p.score+=scores[i]);s.roundWinner=scores[0]===scores[1]?-1:scores[0]<scores[1]?0:1;s.log.unshift(`Round ${s.round}: ${scores[0]} vs ${scores[1]} points. Lowest score wins.`);if(s.round>=4){s.winner=s.players[0].score===s.players[1].score?-1:s.players[0].score<s.players[1].score?0:1;}return s;}
 if(s.closingSeat===null&&s.players[seat].grid.every(c=>c.revealed||c.cleared))s.closingSeat=seat;
 s.active=1-seat;s.step='draw';s.drawnFrom=null;s.held=null;return s;
}
export function lowDraw(input,from='deck'){const s=clone(input);if(s.winner!==null||s.roundWinner!==null||s.step!=='draw')return {error:'It is not time to draw.'};if(!['deck','discard'].includes(from))return {error:'Invalid pile.'};
 if(from==='deck'&&!s.draw.length){if(s.discard.length<2)return {error:'No cards available.'};const top=s.discard.pop();s.draw=shuffle(s.discard,mulberry32((s.seed^s.round^s.players[0].score^s.players[1].score)>>>0));s.discard=[top];}
 const card=(from==='deck'?s.draw:s.discard).pop();if(!card)return {error:'No cards available.'};s.held=card;s.drawnFrom=from;s.step='place';s.log.unshift(`${s.players[s.active].name} picked up a card.`);return {state:s};}
export function lowReplace(input,index){const s=clone(input);if(s.step!=='place'||s.winner!==null||s.roundWinner!==null)return {error:'Draw a card first.'};const g=s.players[s.active].grid;if(!Number.isInteger(index)||index<0||index>=12||g[index].cleared)return {error:'Choose an available grid position.'};const previous=g[index];g[index]={...s.held,revealed:true,cleared:false};s.discard.push({id:previous.id,value:previous.value});s.log.unshift(`${s.players[s.active].name} swapped a card.`);return {state:afterTurn(s)};}
export function lowFlip(input,index){const s=clone(input);if(s.step!=='place'||s.drawnFrom!=='deck'||s.winner!==null||s.roundWinner!==null)return {error:'Only a deck draw can be discarded to reveal a card.'};const g=s.players[s.active].grid;if(!Number.isInteger(index)||index<0||index>=12||g[index].revealed||g[index].cleared)return {error:'Choose a hidden card to reveal.'};s.discard.push(s.held);g[index].revealed=true;s.log.unshift(`${s.players[s.active].name} revealed a hidden card.`);return {state:afterTurn(s)};}
export function lowNextRound(input){const s=clone(input);if(s.roundWinner===null||s.winner!==null)return {error:'Round is not finished.'};s.round++;return {state:deal(s)};}
export function runLowBot(input){let s=clone(input);if(s.active!==1||s.winner!==null||s.roundWinner!==null)return s;const g=s.players[1].grid;const visible=g.map((c,i)=>({...c,index:i})).filter(c=>!c.cleared&&c.revealed).sort((a,b)=>b.value-a.value);const top=s.discard.at(-1);
 const useDiscard=top&&(visible[0]?.value>top.value||top.value<=3);let r=lowDraw(s,useDiscard?'discard':'deck');if(r.error)return s;s=r.state;
 const old=s.players[1].grid,highest=old.map((c,i)=>({...c,index:i})).filter(c=>!c.cleared&&c.revealed).sort((a,b)=>b.value-a.value)[0];const hidden=old.findIndex(c=>!c.revealed&&!c.cleared);
 if(highest&&highest.value>s.held.value&&(highest.value-s.held.value>2||hidden===-1))r=lowReplace(s,highest.index);
 else if(hidden!==-1)r=s.drawnFrom==='deck'&&s.held.value>=7?lowFlip(s,hidden):lowReplace(s,hidden);
 else if(highest)r=lowReplace(s,highest.index);
 return r.error?s:r.state;
}
