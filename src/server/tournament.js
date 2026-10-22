/** One private room, ten different tables. A first-to-three series stays server owned. */
export const TOUR_ROTATION=Object.freeze([
  'eight-shift','stack-run','number-ladder','tile-royale','low-glow',
  'malice-duel','phase-quest','contract-club','shanghai-nights','crown-circuit'
]);
export function nextTournamentMode(startMode,completedMatches=0){
  if(!TOUR_ROTATION.includes(startMode)||!Number.isSafeInteger(completedMatches)||completedMatches<0)throw Error('Invalid tournament schedule.');
  return TOUR_ROTATION[(TOUR_ROTATION.indexOf(startMode)+completedMatches)%TOUR_ROTATION.length];
}
export function tournamentFormat(value){
  if(value!==undefined&&value!=='single'&&value!=='mixed')throw Error('Choose single-game or games-night mix.');
  return value??'single';
}
