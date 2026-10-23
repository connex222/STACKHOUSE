import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSequenceGame, replenishSequenceHand, discardSequenceCard,
  playSequenceCard, passSequenceTurn
} from '../src/engine/sequence.js';
import {projectGame} from '../src/server/rooms.js';
const card = value => ({id:`recycle-${value}`,value,wild:false});
const original = [1,2,3,4,5,6,7,8,9,10,11,12].map(card);

test('recycled completed stacks are shuffled, not reversed, across reproducible solo seeds', () => {
  for (const mode of ['stack-run','malice-duel']) {
    const orders = [];
    for (const seed of [9, 77, 444, 2026, 9001]) {
      const state = createSequenceGame({mode,seed});
      state.players[0].hand = [];
      state.draw = [];
      state.recycled = structuredClone(original);
      const output = replenishSequenceHand(state);
      assert.ok(output.state);
      const dealt = output.state.players[0].hand.map(item=>item.value);
      assert.notDeepEqual(dealt, [1,2,3,4,5]);
      assert.equal(output.state.recycled.length, 0);
      assert.equal(output.state.draw.length, 7);
      assert.equal(output.state.recycleCount, 1);
      assert.equal(state.recycled.length, 12, 'input remains unchanged');
      assert.deepEqual(replenishSequenceHand(state).state.players[0].hand,output.state.players[0].hand);
      orders.push(dealt.join(','));
      const projected=projectGame(output.state,1);
      assert.equal(JSON.stringify(projected).includes('recycleCount'),false);
      assert.equal(JSON.stringify(projected).includes('seed'),false);
    }
    assert.ok(new Set(orders).size>1,'distinct seeds yield different recycle orders');
  }
});

test('online actions can inject cryptographic shuffle even when a completed stack is made in that action', () => {
  for (const mode of ['stack-run','malice-duel']) {
    let shuffleCalls=0;
    const injected = cards => { shuffleCalls++;return [...cards].reverse(); };
    const s=createSequenceGame({mode,seed:4});
    s.draw=[];
    s.players[0].hand=[card(12)];
    s.players[0].stock=[card(3)];
    s.builds[0]=Array.from({length:11},(_,i)=>({...card(i+1),playedValue:i+1}));
    const result=playSequenceCard(s,'hand',0,0,injected);
    assert.ok(result.state);
    assert.equal(shuffleCalls,1);
    assert.equal(result.state.players[0].hand.length,5);
    assert.equal(result.state.recycled.length,0);
    assert.equal(result.state.recycleCount,1);
  }
});

test('discard, refill and forced-pass flows accept server supplied shuffle',()=>{
  const make=()=>{
    const s=createSequenceGame({seed:32});
    s.draw=[];s.recycled=structuredClone(original);s.players[1].hand=[];
    return s;
  };
  let calls=0;
  const supplied=cards=>{calls++;return [...cards].reverse();};
  let s=make();s.players[0].hand=[card(7)];
  const after=discardSequenceCard(s,0,0,supplied).state;
  assert.equal(after.players[1].hand.length,5);
  assert.equal(calls,1);
  s=make();s.players[0].hand=[];
  const topped=replenishSequenceHand(s,supplied).state;
  assert.equal(topped.players[0].hand.length,5);
  assert.equal(calls,2);
  assert.ok(passSequenceTurn(s).error,'cannot pass while recycled cards are available');
});
