import test from 'node:test';
import assert from 'node:assert/strict';
import {handTokens,reconcileHandOrder,moveHandToken,sortHandOrder} from '../src/hand-order.js';

test('drag reorder alters presentation only, never the underlying server hand',()=>{
 const hand=[{id:'c1',value:10},{id:'c2',value:2},{id:'c3',value:7}];
 const original=JSON.stringify(hand);
 const moved=moveHandToken(reconcileHandOrder([],hand),0,2);
 assert.deepEqual(moved,['id:c2','id:c3','id:c1']);
 assert.equal(JSON.stringify(hand),original);
 assert.equal(moved.map(x=>hand[handTokens(hand).indexOf(x)].value).join(','),'2,7,10');
});
test('hand order persists across server snapshots and appends newly drawn cards',()=>{
 const hand=[{id:'t1',value:3},{id:'t2',value:4},{id:'t3',value:5}];
 const picked=moveHandToken(reconcileHandOrder([],hand),2,0);
 const snapshot=structuredClone([hand[0],hand[2],{id:'t4',value:6}]);
 assert.deepEqual(reconcileHandOrder(picked,snapshot),['id:t3','id:t1','id:t4']);
});
test('identical card faces remain independently moveable without object ids',()=>{
 const cards=[{value:9,suit:'hearts'},{value:9,suit:'hearts'},{value:2,suit:'spades'}];
 const keys=handTokens(cards);
 assert.equal(new Set(keys).size,3);
 assert.deepEqual(reconcileHandOrder(moveHandToken(keys,2,0),structuredClone(cards)),[keys[2],keys[0],keys[1]]);
});
test('sort by value is stable and move guards reject invalid indices',()=>{
 const cards=[{value:12,colour:'teal'},{value:4,colour:'violet'},{value:4,colour:'gold'}];
 assert.deepEqual(sortHandOrder(cards).map(k=>cards[handTokens(cards).indexOf(k)].colour),['gold','violet','teal']);
 const order=handTokens(cards);assert.deepEqual(moveHandToken(order,-1,2),order);
 assert.deepEqual(moveHandToken(order,0,99),order);
});
test('empty hands and cleared racks do not cause errors',()=>{
 assert.deepEqual(reconcileHandOrder(['id:old'],[]),[]);
 assert.deepEqual(sortHandOrder([]),[]);
});
