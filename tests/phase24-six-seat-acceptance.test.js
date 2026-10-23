import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';

async function openPort(){const s=net.createServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function startServer(dataFile){
  const port=await openPort();
  const base=`http://127.0.0.1:${port}`;
  const processRef=spawn(process.execPath,['server.js'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,DATABASE_URL:'',ROOM_DATA_FILE:dataFile,PORT:String(port)},stdio:'ignore'});
  for(let step=0;step<100;step++){
    if(processRef.exitCode!==null)throw Error('Game server exited');
    try{const response=await fetch(base+'/health');if(response.ok)return {base,processRef};}catch{}
    await new Promise(ok=>setTimeout(ok,50));
  }
  processRef.kill('SIGTERM');throw Error('Server startup timeout');
}
async function api(base,path,{token='',method='GET',body=null}={}){
  const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
}

for(const mode of ['eight-shift','stack-run','malice-duel','tile-royale','phase-quest','contract-club','crown-circuit','shanghai-nights']){
  test(`Phase 24: ${mode} accepts six isolated players and does not reveal secret hands to TV`,{timeout:20000},async()=>{
    const dir=await mkdtemp(join(tmpdir(),'stackhouse-acceptance-'));
    const storage=join(dir,'rooms.json');let server;
    try{
      server=await startServer(storage);
      const create=await api(server.base,'/api/rooms',{method:'POST',body:{mode,name:'Host',avatar:1,maxPlayers:6}});
      assert.equal(create.status,201);const {code,token}=create.body;
      const sessions=[token];
      for(let index=2;index<=6;index++){
        const joined=await api(server.base,`/api/rooms/${code}/join`,{method:'POST',body:{name:`Player ${index}`,avatar:index}});
        assert.equal(joined.status,200);sessions.push(joined.body.token);
      }
      const views=await Promise.all(sessions.map(credential=>api(server.base,`/api/rooms/${code}/state`,{token:credential})));
      assert.deepEqual(views.map(v=>v.body.seat),[0,1,2,3,4,5]);
      assert.ok(views.every(v=>v.body.status==='playing'));
      assert.ok(views.every(v=>v.body.players.length===6));
      const tv=await api(server.base,`/api/rooms/${code}/host`,{method:'POST',token,body:{type:'tv-create',revision:views[0].body.revision}});
      assert.equal(tv.status,200);const watchKey=tv.body.watchKey;
      const screen=await api(server.base,`/api/rooms/${code}/spectate`,{token:watchKey});
      assert.equal(screen.status,200);
      const text=JSON.stringify(screen.body);
      for(const key of ['"hand":','"rack":','"stock":','"tokenHash"','"tvTokenHash"'])assert.ok(!text.includes(key),`${mode}: leaked ${key}`);
      for(const credential of sessions)assert.ok(!text.includes(credential),`${mode}: leaked seat credential`);
      const seatAction=await api(server.base,`/api/rooms/${code}/actions`,{method:'POST',token:watchKey,body:{type:'eight-pass',revision:tv.body.view.revision}});
      assert.equal(seatAction.status,401);
      assert.equal((await api(server.base,`/api/rooms/${code}/join`,{method:'POST',body:{name:'Seventh',avatar:7}})).status,400);
      const health=await api(server.base,'/health');
      assert.equal(health.body.storage,'filesystem-only');
      assert.equal(health.body.durableStorage,false,'A local snapshot file is not evidence of cloud durability');
    }finally{server?.processRef.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}
  });
}

test('Phase 24: six-player sessions and TV permission survive controlled local restart using snapshot file',{timeout:20000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'stackhouse-restart-'));
  const file=join(dir,'rooms.json');let server;
  try{
    server=await startServer(file);
    const created=await api(server.base,'/api/rooms',{method:'POST',body:{mode:'eight-shift',name:'Host',avatar:1,maxPlayers:6}});
    assert.equal(created.status,201);const {code,token}=created.body;const users=[token];
    for(let index=2;index<=6;index++){
      const joined=await api(server.base,`/api/rooms/${code}/join`,{method:'POST',body:{name:`Player ${index}`,avatar:index}});
      assert.equal(joined.status,200);users.push(joined.body.token);
    }
    const before=await api(server.base,`/api/rooms/${code}/state`,{token});
    const tv=await api(server.base,`/api/rooms/${code}/host`,{token,method:'POST',body:{type:'tv-create',revision:before.body.revision}});
    assert.equal(tv.status,200);
    await new Promise(ok=>server.processRef.once('exit',ok) && server.processRef.kill('SIGTERM'));
    server=await startServer(file);
    const recovered=await Promise.all(users.map(credential=>api(server.base,`/api/rooms/${code}/state`,{token:credential})));
    assert.ok(recovered.every(view=>view.status===200&&view.body.players.length===6));
    assert.ok(recovered.every(view=>view.body.revision===tv.body.view.revision));
    const watch=await api(server.base,`/api/rooms/${code}/spectate`,{token:tv.body.watchKey});
    assert.equal(watch.status,200);
  }finally{server?.processRef.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}
});
