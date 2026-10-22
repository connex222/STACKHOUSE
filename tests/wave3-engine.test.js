import test from 'node:test';
import assert from 'node:assert/strict';
import {createTileGame,tileDeck,tileMeld,tileLay,tileEndTurn,runTileBot} from '../src/engine/tiles.js';
import {createLowGame,lowDeck,lowDraw,lowReplace,lowFlip,lowNextRound,runLowBot,lowScore} from '../src/engine/lowcard.js';
import {createEightGame,eightCanPlay,eightPlay,eightDraw,eightPass,runEightBot} from '../src/engine/eights.js';

const card=(n,c='teal',id='x')=>({id,colour:c,value:n,wild:false});
test('Tile Royale: 106 unique tiles, deterministic dealing and shuffled jokers',()=>{
 const cards=tileDeck(123);assert.equal(cards.length,106);assert.equal(new Set(cards.map(c=>c.id)).size,106);
 assert.deepEqual(cards,tileDeck(123));assert.equal(cards.filter(x=>x.wild).length,2);
 const s=createTileGame({seed:123});assert.equal(s.draw.length,78);assert.equal(s.players[0].rack.length,14);assert.equal(s.winner,null);
});
test('Tile Royale: set/run validation, duplicate colours and wilds',()=>{
 assert.equal(tileMeld([card(4,'teal','a'),card(4,'gold','b'),card(4,'coral','c')]),'set');
 assert.equal(tileMeld([card(4,'teal','a'),card(4,'teal','b'),card(4,'coral','c')]),null);
 assert.equal(tileMeld([card(3,'teal','a'),card(5,'teal','b'),{id:'w',wild:true,value:0,colour:'wild'}]),'run');
 assert.equal(tileMeld([card(11,'teal','a'),card(13,'teal','b'),card(1,'teal','c')]),null);
 assert.equal(tileMeld([card(4,'teal','a'),card(4,'gold','b')]),null);
});
test('Tile Royale: lay, extend, draw, turn validation and victory',()=>{
 let s=createTileGame();s.players[0].rack=[card(5,'teal','a'),card(5,'gold','b'),card(5,'coral','c'),card(5,'violet','d')];
 assert.match(tileLay(s,[0,0,1]).error,/distinct/);
 assert.match(tileEndTurn(s,false).error,/Play a group/);
 const r=tileLay(s,[0,1,2]);assert.equal(r.state.groups[0].type,'set');assert.equal(r.state.players[0].rack.length,1);assert.equal(s.players[0].rack.length,4);
 s=r.state;const extended=tileLay(s,[0],0);assert.equal(extended.state.winner,0);assert.equal(extended.state.groups[0].tiles.length,4);
 const game=createTileGame();const after=tileEndTurn(game,true);assert.equal(after.state.active,1);
 assert.equal(after.state.players[0].rack.length,15);
});
test('Tile Royale: bot always returns turn or completes its rack',()=>{
 for(let seed=1;seed<=15;seed++){let s=createTileGame({seed});s.active=1;const b=runTileBot(s);assert.ok(b.active===0||b.winner!==null);}
});
test('Low Glow: 150-card deck, two visible starting cards and deterministic distribution',()=>{
 const d=lowDeck(12);assert.equal(d.length,150);assert.equal(new Set(d.map(c=>c.id)).size,150);
 assert.deepEqual(d,lowDeck(12));const s=createLowGame({seed:12});assert.equal(s.draw.length,125);assert.equal(s.discard.length,1);
 assert.equal(s.players[0].grid.filter(c=>c.revealed).length,2);
});
test('Low Glow: drawing and replacing, flip is deck-only, discard is public',()=>{
 let s=createLowGame();assert.match(lowReplace(s,1).error,/Draw/);
 let r=lowDraw(s,'discard');assert.equal(r.state.step,'place');assert.match(lowFlip(r.state,1).error,/deck draw/);
 r=lowReplace(r.state,1);assert.equal(r.state.players[0].grid[1].revealed,true);assert.equal(r.state.active,1);
 s=createLowGame();r=lowDraw(s,'deck');assert.equal(lowFlip(r.state,1).state.players[0].grid[1].revealed,true);
 assert.match(lowFlip(r.state,0).error,/hidden card/);
});
test('Low Glow: triple matching column clears and round totals are scored',()=>{
 let s=createLowGame();const g=s.players[0].grid;for(const i of [0,4,8])g[i]={id:'c'+i,value:2,revealed:true,cleared:false};
 let r=lowDraw(s,'deck');r=lowReplace(r.state,1);assert.deepEqual([0,4,8].map(i=>r.state.players[0].grid[i].cleared),[true,true,true]);
 s=createLowGame();s.players[0].grid.forEach(c=>c.revealed=true);r=lowDraw(s,'deck');r=lowReplace(r.state,0);assert.equal(r.state.closingSeat,0);assert.equal(r.state.active,1);
 s=r.state;r=lowDraw(s,'deck');r=lowReplace(r.state,1);assert.equal(r.state.roundWinner!==null,true);assert.equal(r.state.players.every(p=>Number.isFinite(p.score)),true);
 const next=lowNextRound(r.state);assert.equal(next.state.round,2);assert.equal(next.state.players[0].grid.length,12);
});
test('Low Glow: a full game finishes after four rounds',()=>{
 let s=createLowGame({seed:43});for(let round=1;round<=4;round++){
  for(const p of s.players)p.grid.forEach(c=>c.revealed=true);
  for(let n=0;n<2;n++){const result=lowDraw(s,'deck');assert.ok(result.state);s=lowReplace(result.state,0).state;}
  assert.notEqual(s.roundWinner,null);
  if(round<4)s=lowNextRound(s).state;
 }
 assert.notEqual(s.winner,null);assert.equal(s.round,4);
});
test('Low Glow: bot moves safely and scores ignore cleared columns',()=>{
 let s=createLowGame();s.active=1;assert.equal(runLowBot(s).active,0);
 assert.equal(lowScore([{value:10,cleared:true},{value:-2,cleared:false}]),-2);
});
test('Eight Shift: 52 unique cards, suit/rank/wild validation',()=>{
 const s=createEightGame({seed:9});assert.equal(s.draw.length,37);assert.equal(new Set([...s.draw,...s.discard,...s.players.flatMap(p=>p.hand)].map(c=>c.id)).size,52);
 assert.equal(eightCanPlay({value:8,suit:'hearts'},s),true);
 assert.equal(eightCanPlay({value:4,suit:s.activeSuit},s),true);
});
test('Eight Shift: wild suit declaration, one draw, pass and victory',()=>{
 let s=createEightGame();s.players[0].hand=[{id:'wild',value:8,suit:'clubs'}];
 assert.match(eightPlay(s,0).error,/Choose a suit/);
 assert.match(eightPlay(s,0,'not-a-suit').error,/Choose a suit/);
 const r=eightPlay(s,0,'hearts');assert.equal(r.state.winner,0);assert.equal(r.state.activeSuit,'hearts');
 s=createEightGame();const draw=eightDraw(s);assert.equal(draw.state.drew,true);assert.match(eightDraw(draw.state).error,/only draw one/);
 const pass=eightPass(draw.state);assert.equal(pass.state.active,1);
});
test('Eight Shift: bot either passes or plays a valid card',()=>{
 for(let seed=1;seed<=20;seed++){let s=createEightGame({seed});s.active=1;const b=runEightBot(s);assert.ok(b.active===0||b.winner!==null);}
});
