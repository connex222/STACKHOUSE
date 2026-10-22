// Device-only match history. This is not a global leaderboard or shared profile.
export const SOLO_RESULTS_KEY='stackhouse.solo.results.v1';
const GAME_IDS=new Set(['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift']);
export function decodeSoloResults(raw){
 try {
  if(typeof raw!=='string'||raw.length>22000)return {games:{},recent:[]};
  const data=JSON.parse(raw);
  if(!data||!Array.isArray(data.recent)||data.recent.length>80)return {games:{},recent:[]};
  const recent=data.recent.filter(r=>r&&typeof r.id==='string'&&r.id.length<=90&&GAME_IDS.has(r.mode)&&[-1,0,1].includes(r.winner)).slice(0,60);
  const games={};
  for(const id of GAME_IDS) {
   const game=data.games?.[id];
   if(game&&['wins','losses','draws'].every(k=>Number.isSafeInteger(game[k])&&game[k]>=0&&game[k]<=100000))games[id]={wins:game.wins,losses:game.losses,draws:game.draws};
  }
  return {games,recent};
 }catch{return {games:{},recent:[]};}
}
export function registerSoloResult(raw,{id,mode,winner}){
 const current=decodeSoloResults(raw);
 if(typeof id!=='string'||id.length<12||id.length>90||!GAME_IDS.has(mode)||![-1,0,1].includes(winner))return {changed:false,value:current};
 if(current.recent.some(r=>r.id===id))return {changed:false,value:current};
 const row=current.games[mode]||{wins:0,losses:0,draws:0};
 row[winner===0?'wins':winner===1?'losses':'draws']++;
 current.games[mode]=row;
 current.recent.unshift({id,mode,winner});
 current.recent.length=Math.min(current.recent.length,60);
 return {changed:true,value:current};
}
export function soloTotals(data){return Object.values(data.games).reduce((sum,r)=>({wins:sum.wins+r.wins,losses:sum.losses+r.losses,draws:sum.draws+r.draws}),{wins:0,losses:0,draws:0});}
