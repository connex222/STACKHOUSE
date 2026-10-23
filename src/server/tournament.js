/** One private room, ten different tables. A first-to-three series stays server owned. */
export const TOUR_ROTATION=Object.freeze([
  'eight-shift','stack-run','number-ladder','tile-royale','low-glow',
  'malice-duel','phase-quest','contract-club','shanghai-nights','crown-circuit'
]);
export const GROUP_ROTATION=Object.freeze(TOUR_ROTATION.filter(mode=>
  !['number-ladder','low-glow'].includes(mode)));
export function nextTournamentMode(startMode,completedMatches=0,pool=TOUR_ROTATION){
  if(!Array.isArray(pool)||!pool.length||pool.some(mode=>!TOUR_ROTATION.includes(mode))||
      !pool.includes(startMode)||!Number.isSafeInteger(completedMatches)||completedMatches<0)
    throw Error('Invalid tournament schedule.');
  return pool[(pool.indexOf(startMode)+completedMatches)%pool.length];
}
export function tournamentFormat(value){
  if(value!==undefined&&value!=='single'&&value!=='mixed')throw Error('Choose single-game or games-night mix.');
  return value??'single';
}
