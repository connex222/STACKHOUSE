import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfflineHtml,assessLiveHealth,parseArgs} from '../scripts/release-preflight.js';

const modes=['Stack Run','Malice Duel','Phase Quest','Contract Club','Crown Circuit',
  'Shanghai Nights','Number Ladder','Tile Royale','Low Glow','Eight Shift'];
const offline='<!doctype html><html><body><img src="data:image/webp;base64,YWJj"><script>'+
  "const sound='data:audio/mpeg;base64,YWJj';"+modes.join(';')+'</script></body></html>';

test('offline preflight catches resource leaks',()=>{
  assert.equal(inspectOfflineHtml(offline).pass,true);
  for(const addition of ['<link href="https://fonts.example/font.css">',
    '<img src="/assets/avatar.webp">','<script src="/remote.js"></script>',
    '<style>@import url(//cdn.example/style.css)</style>']){
    assert.equal(inspectOfflineHtml(offline+addition).pass,false,addition);
  }
});
test('durable means a responsive PostgreSQL connection, not merely a configured URL',()=>{
  const base={ok:true,multiplayer:true,service:'stackhouse-social',storage:'memory-only',
    durableStorage:false,databaseConnected:null};
  assert.equal(assessLiveHealth(base,200).healthy,true);
  assert.equal(assessLiveHealth(base,200).durable,false);
  assert.equal(assessLiveHealth({...base,storage:'postgres',durableStorage:true,databaseConnected:false},503).durable,false);
  assert.equal(assessLiveHealth({...base,storage:'postgres',durableStorage:true,databaseConnected:true},200).durable,true);
  assert.equal(assessLiveHealth({...base,service:'unrelated'},200).healthy,false);
});
test('strict preflight requires live origin and refuses URL secrets',()=>{
  assert.throws(()=>parseArgs(['--require-durable']),/requires --url/);
  assert.throws(()=>parseArgs(['--url','file:///private']),/HTTP\(S\)/);
  assert.throws(()=>parseArgs(['--url','https://example.com/?token=secret']),/without credentials/);
  assert.deepEqual(parseArgs(['--url','https://example.com','--require-durable']),
    {url:'https://example.com',requireDurable:true,json:false});
});
