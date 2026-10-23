import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSequenceGame,sequencePileTargets,canPassSequenceTurn,canReplenishSequenceHand} from '../src/engine/sequence.js';
import {createContractGame,MISSION_SETS,currentMission,missionDescription,findContract,canLayOffContract} from '../src/engine/contracts.js';
import {createRackGame} from '../src/engine/rack.js';
import {createTileGame,tileMeld} from '../src/engine/tiles.js';
import {createLowGame} from '../src/engine/lowcard.js';
import {createEightGame,eightCanPlay,SUITS} from '../src/engine/eights.js';
import {createSequenceScreen} from '../src/ui/screens/sequence.js';
import {createContractScreen} from '../src/ui/screens/contract.js';
import {createRackScreen} from '../src/ui/screens/rack.js';
import {createTileScreen} from '../src/ui/screens/tile.js';
import {createLowScreen} from '../src/ui/screens/low.js';
import {createEightScreen} from '../src/ui/screens/eight.js';

function viewContext(game){
  const ui={game,mode:game.mode,avatarId:1,selected:null,lowAction:'replace'};
  return {ui,gameInfo:()=>({title:'Table',kicker:'Play',category:'Cards'}),isOnline:()=>false,
    gameTop:()=>'<header>Game header</header>',actionSidebar:()=>'<aside>Table details</aside>',
    playerBadge:(name)=>`<div>${name}</div>`,opponentName:()=> 'House Bot',opponentImage:()=>'/assets/bot.webp',
    asset:()=>({image:'/assets/avatar.webp'}),escapeHtml:String,icon:()=> '◇',
    handToolbar:()=>'<div>Arrange hand</div>',handItems:(_zone,cards,face)=>cards.map(face).join(''),
    rematchControl:()=>'<button>Rematch</button>',sequencePileTargets,canPassSequenceTurn,
    canReplenishSequenceHand,MISSION_SETS,currentMission,missionDescription,findContract,canLayOffContract,
    tileMeld,eightCanPlay,SUITS};
}
const cases=[
  ['Stack Run',createSequenceScreen,()=>createSequenceGame({mode:'stack-run',seed:730})],
  ['Malice Duel',createSequenceScreen,()=>createSequenceGame({mode:'malice-duel',seed:731})],
  ['Phase Quest',createContractScreen,()=>createContractGame({mode:'phase-quest',seed:732})],
  ['Contract Club',createContractScreen,()=>createContractGame({mode:'contract-club',seed:733})],
  ['Shanghai Nights',createContractScreen,()=>createContractGame({mode:'shanghai-nights',seed:734})],
  ['Crown Circuit',createContractScreen,()=>createContractGame({mode:'crown-circuit',seed:735})],
  ['Number Ladder',createRackScreen,()=>createRackGame({mode:'number-ladder',seed:736})],
  ['Tile Royale',createTileScreen,()=>createTileGame({mode:'tile-royale',seed:737})],
  ['Low Glow',createLowScreen,()=>createLowGame({mode:'low-glow',seed:738})],
  ['Eight Shift',createEightScreen,()=>createEightGame({mode:'eight-shift',seed:739})]
];
for(const [name,screen,create] of cases){
 test(`Modular ${name} view renders a real engine state`,()=>{
  const state=create(),markup=screen(viewContext(state));
  assert.match(markup,/id="main-content"/);
  assert.match(markup,/Table details/);
  assert.match(markup,/House Bot/);
  assert.ok(markup.length>650,`${name} missing play controls`);
 });
}
test('Standalone builder includes all modular screen renderers',()=>{
 const builder=readFileSync(new URL('../scripts/build-offline.js',import.meta.url),'utf8');
 for(const name of ['sequence','contract','rack','tile','low','eight'])assert.ok(builder.includes(`src/ui/screens/${name}.js`));
});
