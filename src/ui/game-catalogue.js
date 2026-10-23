/* Shared six-family catalogue. Preserve underlying ten mode IDs for saved games. */
export const avatars = [
 'The Host','The Strategist','The Sunshine','The Gentleman','The Rebel','The Captain','The Star','The Professor',
 'The Drifter','The Ace','The Maverick','The Gamer','The Duchess','The Joker','The Ranger','The Trendsetter'
].map((name,i)=>({id:i+1,name,image:`/assets/avatar-${String(i+1).padStart(2,'0')}.webp`}));
export const GROUP_GAME_IDS=new Set(['eight-shift','stack-run','malice-duel','tile-royale','phase-quest','contract-club','crown-circuit','shanghai-nights']);
export const games = [
 { id:'stack-run', title:'Stack Run', category:'Sequencing / strategy', kicker:'BUILD. STACK. OUTPLAY.',description:'Climb from 1 to 12 across shared stacks. Your stockpile is the real race.',players:'2–6 players + bot demo', icon:'↗', art:'run',kind:'sequence',tag:'Most like Skip-Bo' },
 { id:'phase-quest', title:'Phase Quest', category:'Contracts / strategy', kicker:'TEN MISSIONS. ONE WINNER.',description:'Complete sets, runs and colour groups. Laying your full contract immediately ends the round.',players:'2–6 players + bot demo',icon:'✦',art:'phase',kind:'contract',tag:'Most like Phase 10' },
 { id:'malice-duel', title:'Malice Duel', category:'Competitive sequencing',kicker:'MAKE EVERY CARD COUNT.',description:'Three shared stacks, a deeper stockpile and just enough room for revenge.',players:'2–6 players + bot demo',icon:'♠',art:'malice',kind:'sequence',tag:'Spite & Malice inspired' },
 { id:'contract-club', title:'Contract Club', category:'Classic rummy contracts', kicker:'READ THE ROOM. MAKE THE MELD.',description:'Lay your contract, extend shared melds and shed every last card to finish the deal.',players:'2–6 players + bot demo',icon:'♣',art:'contract',kind:'contract',tag:'Contract Rummy inspired' },
 { id:'crown-circuit',title:'Crown Circuit',category:'Five-suit wild-card rummy',kicker:'THE WILD RANK NEVER STAYS STILL.',description:'Eleven five-suit contracts with changing wild ranks. Laying first ends each round.',players:'2–6 players + bot demo',icon:'♛',art:'crown',kind:'contract',tag:'Five Crowns-style variant' },
 { id:'number-ladder',title:'Number Ladder',category:'Number ordering / strategy',kicker:'TEN SLOTS. ONE PERFECT ORDER.',description:'Swap one card at a time to build an ascending ladder from 1 to 60.',players:'2 players + bot demo',icon:'↟',art:'ladder',kind:'rack',tag:'Rack-O-style ordering' },
 { id:'shanghai-nights',title:'Shanghai Nights',category:'Progressive contract rummy',kicker:'SEVEN DEALS. SEVEN CHALLENGES.',description:'Seven progressive contracts. Buy a declined discard out of turn, but draw a penalty card.',players:'2–6 players + bot demo',icon:'✴',art:'shanghai',kind:'contract',tag:'Shanghai-style contracts' },
 {id:'tile-royale',title:'Tile Royale',category:'Tile sets and colour runs',kicker:'MAKE YOUR MARK ON THE TABLE.',description:'Lay tile sets and runs. Clear your rack to win, or keep rack points low if the pool runs dry.',players:'2–6 players + bot demo',icon:'▦',art:'tile',kind:'tiles',tag:'Number-tile rummy variant'},
 {id:'low-glow',title:'Low Glow',category:'Memory / low-score cards',kicker:'THE LOWEST SCORE WINS.',description:'Flip, swap and clear matching columns across four fast rounds.',players:'2 players + bot demo',icon:'⬡',art:'low',kind:'low',tag:'Skyjo-style house game'},
 {id:'eight-shift',title:'Eight Shift',category:'Fast card matching',kicker:'MATCH. SWITCH. GET OUT.',description:'Match suits or ranks, and play a wild eight to change the active suit.',players:'2–6 players + bot demo',icon:'8',art:'eight',kind:'eights',tag:'Crazy Eights-style variant'}
];
/** Six launcher families retain the ten existing engine-mode IDs. This is deliberate:
 * saved local games, links, private room snapshots and the full rule sets stay valid. */
export const gameFamilies = [
 {id:'stack-run',variants:['stack-run','malice-duel'],title:'Stack Run',description:'Choose Classic or Malice sequencing.'},
 {id:'phase-quest',variants:['phase-quest','contract-club','shanghai-nights','crown-circuit'],title:'Contract',description:'Four distinctive contract rule sets.'},
 {id:'number-ladder',variants:['number-ladder'],title:'Number Ladder'},
 {id:'tile-royale',variants:['tile-royale'],title:'Tile Royale'},
 {id:'low-glow',variants:['low-glow'],title:'Low Glow'},
 {id:'eight-shift',variants:['eight-shift'],title:'Eight Shift'}
];
