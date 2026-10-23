import test from 'node:test';
import assert from 'node:assert/strict';
import {choosePlannedSequenceMove} from '../src/engine/sequence-planner.js';
import {chooseExpertEightMove} from '../src/engine/eight-planner.js';
import {createSequenceGame,runSequenceBot} from '../src/engine/sequence.js';
import {createEightGame,chooseEightBotMove} from '../src/engine/eights.js';

const card=(value,suit='hearts')=>({id:`test-${value}-${suit}`,value,suit,wild:false});

test('Expert sequencing looks ahead to unblock stock instead of following a greedy discard',()=>{
 const visible=[{type:'stock',index:0,card:card(3)},
   {type:'discard',index:0,card:card(1)},
   {type:'hand',index:0,card:card(2)}];
 assert.deepEqual(choosePlannedSequenceMove([0,1,0,0],visible),{type:'hand',index:0,target:1});
 assert.deepEqual(choosePlannedSequenceMove([0,1,0,0],visible,1),{type:'discard',index:0,target:0});
});

test('Sequence planner never reads hidden opponents, draw pile, RNG seeds or buried stock',()=>{
 const state=createSequenceGame({seed:739,mode:'malice-duel',playerCount:6});
 state.active=2;
 state.players[2].stock=[card(8),card(3)];
 state.players[2].hand=[card(2)];
 state.players[2].discards=[[card(1)],[],[],[]];
 state.builds=[[],[{playedValue:1}],[]];
 state.draw=[];
 const before=structuredClone(state);
 const a=runSequenceBot(state,'expert',2);
 assert.deepEqual(state,before,'Expert must not mutate the source');
 const altered=structuredClone(state);
 altered.seed=999999;altered.players[1].hand=[card(11),card(12)];
 altered.players[4].hand=[card(7)];altered.players[2].stock[0]=card(11);
 const b=runSequenceBot(altered,'expert',2);
 // Bot's own visible decision should not depend on other players' concealed cards or stock bottom.
 assert.deepEqual(a.players[2].discards,b.players[2].discards);
 assert.deepEqual(a.builds,b.builds);
});

test('Eight Shift Expert uses publicly known cards and hand sizes, not opponents hidden values',()=>{
 const state=createEightGame({seed:123,playerCount:4});state.active=1;
 state.players[1].hand=[card(8),card(9,'diamonds'),card(10,'diamonds'),card(9,'hearts')];
 state.discard=[card(4,'hearts'),card(9,'hearts')];state.activeSuit='hearts';
 const normal=chooseEightBotMove(state,'expert',1);
 assert.ok(normal);
 const alt=structuredClone(state);
 for(const seat of [0,2,3])alt.players[seat].hand=alt.players[seat].hand.map(c=>({...c,value:(c.value%13)+2,suit:'clubs'}));
 assert.deepEqual(chooseEightBotMove(alt,'expert',1),normal);
 const opts=[{i:0,card:card(8)},{i:3,card:card(9,'hearts')}];
 const chosen=chooseExpertEightMove(state.players[1].hand,opts,state.discard,[1,4,3]);
 assert.ok(chosen.i===0||chosen.i===3);
 assert.ok(chosen.suit===null||['hearts','diamonds','clubs','spades'].includes(chosen.suit));
});

