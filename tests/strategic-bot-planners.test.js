import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rackPositionCost,chooseRackExpertDraw,chooseRackExpertReplace,
  bestRackReplacement,expectedRackFollowUp
} from '../src/engine/rack-planner.js';
import {chooseLowExpertDraw,chooseLowExpertAction} from '../src/engine/low-planner.js';
import {createRackGame,runRackBot,rackDraw,rackReplace} from '../src/engine/rack.js';
import {createLowGame,runLowBot,lowDraw,lowReplace,lowFlip,lowNextRound} from '../src/engine/lowcard.js';
const rack=values=>values.map((value,i)=>({id:`r${i}`,value}));
const grid=values=>values.map((value,i)=>({id:`g${i}`,value,revealed:i%2===0,cleared:false}));

test('Expert Number Ladder recognises an immediate winning replacement',()=>{
  const cards=rack([3,8,14,19,26,32,39,45,53,55]);
  cards[4]={id:'r4',value:58};
  assert.equal(bestRackReplacement(cards,{id:'held',value:26})?.winning,true);
  assert.equal(chooseRackExpertReplace(cards,{id:'held',value:26}),4);
});

test('Expert Number Ladder draw and replacement ignore opponents and deck order',()=>{
  const first=createRackGame({seed:44});
  const other=structuredClone(first);
  other.players[0].rack.reverse();
  other.draw.reverse();
  assert.equal(chooseRackExpertDraw(first.players[1].rack,first.discard.at(-1)),
    chooseRackExpertDraw(other.players[1].rack,other.discard.at(-1)));
  assert.equal(chooseRackExpertReplace(first.players[1].rack,{id:'held',value:20},first.discard),
    chooseRackExpertReplace(other.players[1].rack,{id:'held',value:20},other.discard));
  const copy=structuredClone(first.players[1].rack);
  assert.ok(Number.isFinite(rackPositionCost(copy)));
  assert.ok(Number.isFinite(expectedRackFollowUp(copy,first.discard)));
  assert.deepEqual(first.players[1].rack,copy);
});

test('Expert Low Glow clears a visible matching column without inspecting a hidden value',()=>{
  const cards=grid([7,11,4,10,7,6,1,8,12,2,9,3]);
  cards[0].revealed=true; cards[4].revealed=true; cards[8].revealed=false;
  const a=chooseLowExpertAction(cards,{id:'held',value:7},'deck');
  assert.deepEqual(a,{type:'replace',index:8});
  const changed=structuredClone(cards);changed[8].value=-2;
  assert.deepEqual(chooseLowExpertAction(changed,{id:'held',value:7},'deck'),a);
  changed[8].value=12;
  assert.deepEqual(chooseLowExpertDraw(changed,{value:7}),chooseLowExpertDraw(cards,{value:7}));
});

test('Expert Low Glow protects poor held cards by revealing instead of unnecessary replacement',()=>{
  const cards=grid([1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(chooseLowExpertAction(cards,{id:'held',value:12},'deck')?.type,'flip');
  assert.equal(chooseLowExpertAction(cards,{id:'held',value:-2},'deck')?.type,'replace');
  assert.equal(chooseLowExpertAction(cards,{id:'held',value:12},'discard')?.type,'replace');
});

test('Expert bot turn simulations preserve legality and advance without mutating input',()=>{
  for(let seed=1;seed<=35;seed++){
    const rackGame=createRackGame({seed});rackGame.active=1;
    const before=structuredClone(rackGame);
    const after=runRackBot(rackGame,'expert');
    assert.deepEqual(rackGame,before);
    assert.ok(after.turn>rackGame.turn||after.winner!==null);
    assert.equal(after.players[1].rack.length,10);
    const lowGame=createLowGame({seed});lowGame.active=1;
    const old=structuredClone(lowGame);
    const next=runLowBot(lowGame,'expert');
    assert.deepEqual(lowGame,old);
    assert.equal(next.players[1].grid.length,12);
    assert.ok(next.active===0||next.roundWinner!==null);
  }
});
