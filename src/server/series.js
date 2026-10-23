/** Server-owned games-night series. Three match wins earns the table crown.
 * Drawn matches count as games played but award neither player a win.
 * The ledger is keyed by the room's monotonically increasing game number so
 * reconnects, retries, votes and snapshots cannot award the same result twice.
 */
export const SERIES_TARGET = 3;
import {nextTournamentMode} from './tournament.js';
export function createSeries(number=1,seats=2) {
  return {number,wins:Array(seats).fill(0),draws:0,played:0,history:[],reportedGame:0};
}
export function ensureSeries(room) {
  room.gameNumber=Number.isSafeInteger(room.gameNumber)&&room.gameNumber>0?room.gameNumber:1;
  if(!room.series || !Array.isArray(room.series.wins) || room.series.wins.length!==((room.status==='waiting'?room.maxPlayers??2:room.players?.length??2)))room.series=createSeries(1,(room.status==='waiting'?room.maxPlayers??2:room.players?.length??2));
  if(room.format==='mixed'&&Number.isInteger(room.roundLimit)) {
    room.series.roundLimit=room.roundLimit;
    if(!Array.isArray(room.series.points)||room.series.points.length!==room.series.wins.length)
      room.series.points=Array(room.series.wins.length).fill(0);
  }
  return room.series;
}
export function seriesChampion(series) {
  if(Number.isInteger(series.roundLimit)) {
    if(series.played<series.roundLimit)return null;
    const best=Math.max(...series.points);
    const leaders=series.points.flatMap((points,index)=>points===best?[index]:[]);
    if(leaders.length===1)return leaders[0];
    const mostWins=Math.max(...leaders.map(index=>series.wins[index]));
    const tieBreakers=leaders.filter(index=>series.wins[index]===mostWins);
    return tieBreakers.length===1?tieBreakers[0]:-1;
  }
  const champion=series.wins.findIndex(wins=>wins>=SERIES_TARGET);
  return champion<0?null:champion;
}
export function recordMatchResult(room) {
  const series=ensureSeries(room), winner=room.game?.winner;
  if((!Number.isInteger(winner)||winner<-1||winner>=series.wins.length)||series.reportedGame>=room.gameNumber)return false;
  if(seriesChampion(series)!==null)return false;
  if(winner===-1)series.draws++;else series.wins[winner]++;
  if(Number.isInteger(series.roundLimit)) {
    // Group scoring: winning a game is worth N points; everybody else gains
    // one participation point. A drawn game awards one point to every player.
    series.wins.forEach((_,index)=>{series.points[index] += winner===index?series.wins.length:1;});
  }
  series.played++;
  series.reportedGame=room.gameNumber;
  series.history.unshift(room.format==='mixed'?{game:room.gameNumber,mode:room.mode,winner}:{game:room.gameNumber,winner});
  if(series.history.length>12)series.history.length=12;
  return true;
}
export function beginNextGame(room) {
  const series=ensureSeries(room);
  // A completed series is reset only after BOTH players accept the new match.
  if(seriesChampion(series)!==null) {
    room.series=createSeries(series.number+1,room.players?.length??series.wins.length);
    if(Number.isInteger(series.roundLimit)){
      room.series.roundLimit=series.roundLimit;
      room.series.points=Array(room.series.wins.length).fill(0);
    }
  }
  room.gameNumber++;
  if(room.format==='mixed')room.mode=nextTournamentMode(room.startMode,room.series.played,room.gamePool);
}
export function publicSeries(room) {
  const series=ensureSeries(room);
  const base={number:series.number,target:SERIES_TARGET,wins:[...series.wins],draws:series.draws,played:series.played,
    champion:seriesChampion(series),history:series.history.map(x=>({...x}))};
  if(Number.isInteger(series.roundLimit)) {
    base.points=[...series.points];
    base.roundLimit=series.roundLimit;
  }
  return room.format==='mixed'?{...base,format:'mixed',
    nextMode:nextTournamentMode(room.startMode,
      seriesChampion(series)!==null?0:series.played+(room.game?.winner===null?1:0),room.gamePool)}:base;
}
