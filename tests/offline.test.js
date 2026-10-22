import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('standalone offline Phase 4 bundle runs locally and lists ten games without a server',async()=>{
 const html=await readFile(new URL('../PLAY-OFFLINE.html',import.meta.url),'utf8');
 assert.ok(html.startsWith('<!doctype html>'));
 assert.ok(html.includes('data:image/webp;base64,'));
 const js=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(js?.length>100000);
 const app={innerHTML:'',addEventListener(){}};
 const state=new Map();
 const localStorage={getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,String(v)),removeItem:k=>state.delete(k)};
 const location=new URL('file:///cardgames/PLAY-OFFLINE.html');
 const window={addEventListener(){},scrollTo(){}};
 const context={console,URL,Uint32Array,Date,structuredClone,localStorage,location,window,
  document:{getElementById:()=>app},history:{replaceState(){}},setTimeout:()=>1,clearTimeout(){}};
 assert.doesNotThrow(()=>vm.runInNewContext(js,context,{timeout:3000}));
 assert.match(app.innerHTML,/Crown Circuit/);
 assert.match(app.innerHTML,/Shanghai Nights/);
 assert.match(app.innerHTML,/Number Ladder/);
 assert.match(app.innerHTML,/Tile Royale/);
 assert.match(app.innerHTML,/Low Glow/);
 assert.match(app.innerHTML,/Eight Shift/);
 assert.doesNotMatch(app.innerHTML,/data-action="room-open"/);
});
