import test from 'node:test';
import assert from 'node:assert/strict';
import {renderHostControls} from '../src/ui/host-controls.js';
const esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
const table={seat:0,status:'playing',game:{winner:null},players:[{name:'Host',bot:false,connected:true},{name:'Guest',bot:false,connected:false}]};
test('host has a disabled-seat takeover only when an opponent is disconnected',()=>{
 const shown=renderHostControls(table,esc);
 assert.match(shown,/host-bot-takeover/);
 assert.match(shown,/data-seat="1"/);
 assert.match(shown,/cannot be undone/);
 assert.doesNotMatch(renderHostControls({...table,players:[table.players[0],{...table.players[1],connected:true}]},esc),/host-bot-takeover/);
 assert.doesNotMatch(renderHostControls({...table,players:[table.players[0],{...table.players[1],bot:true}]},esc),/host-bot-takeover/);
});
test('spectators and guests get no host controls; finished game does not offer takeover',()=>{
 assert.equal(renderHostControls({...table,seat:1},esc),'');
 assert.equal(renderHostControls({...table,seat:-1},esc),'');
 assert.doesNotMatch(renderHostControls({...table,game:{winner:0}},esc),/host-bot-takeover/);
});
test('host-control text escapes player-controlled names',()=>{
 const html=renderHostControls({...table,players:[table.players[0],{name:'<script>',connected:false}]},esc);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
