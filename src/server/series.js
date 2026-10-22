/** Server-owned games-night series. Three match wins earns the table crown.
 * Drawn matches count as games played but award neither player a win.
 * The ledger is keyed by the room's monotonically increasing game number so
 * reconnects, retries, votes and snapshots cannot award the same result twice.
 */
export const SERIES_TARGET = 3;
import {nextTournamentMode} from './tournament.js';
export function createSeries(number=1) {
  return {number,wins:[0,0],draws:0,played:0,history:[],reportedGame:0};
}
export function ensureSeries(room) {
  room.gameNumber=Number.isSafeInteger(room.gameNumber)&&room.gameNumber>0?room.gameNumber:1;
  if(!room.series || !Array.isArray(room.series.wins) || room.series.wins.length!==2)room.series=createSeries();
  return room.series;
}
export function seriesChampion(series) {
  return series.wins[0]>=SERIES_TARGET?0:series.wins[1]>=SERIES_TARGET?1:null;
}
export function recordMatchResult(room) {
  const series=ensureSeries(room), winner=room.game?.winner;
  if(![-1,0,1].includes(winner)||series.reportedGame>=room.gameNumber)return false;
  if(seriesChampion(series)!==null)return false;
  if(winner===-1)series.draws++;else series.wins[winner]++;
  series.played++;
  series.reportedGame=room.gameNumber;
  series.history.unshift(room.format==='mixed'?{game:room.gameNumber,mode:room.mode,winner}:{game:room.gameNumber,winner});
  if(series.history.length>12)series.history.length=12;
  return true;
}
export function beginNextGame(room) {
  const series=ensureSeries(room);
  // A completed series is reset only after BOTH players accept the new match.
  if(seriesChampion(series)!==null)room.series=createSeries(series.number+1);
  room.gameNumber++;
  if(room.format==='mixed')room.mode=nextTournamentMode(room.startMode,room.series.played);
}
export function publicSeries(room) {
  const series=ensureSeries(room);
  const base={number:series.number,target:SERIES_TARGET,wins:[...series.wins],draws:series.draws,played:series.played,
    champion:seriesChampion(series),history:series.history.map(x=>({...x}))};
  return room.format==='mixed'?{...base,format:'mixed',nextMode:nextTournamentMode(room.startMode,seriesChampion(series)!==null?0:series.played+(room.game?.winner===null?1:0))}:base;
}
