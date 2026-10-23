import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const modes=['Stack Run','Malice Duel','Phase Quest','Contract Club','Crown Circuit',
  'Shanghai Nights','Number Ladder','Tile Royale','Low Glow','Eight Shift'];

export function inspectOfflineHtml(html){
  const failures=[];
  if(!/^<!doctype html>/i.test(html))failures.push('Not a standalone HTML document.');
  if(!html.includes('data:image/webp;base64,'))failures.push('Image assets are missing.');
  if(!html.includes('data:audio/mpeg;base64,'))failures.push('Sound assets are missing.');
  if(/https?:\/\//i.test(html))failures.push('External URL found in offline edition.');
  if(/(?:src|href)\s*=\s*["']\s*\//i.test(html))failures.push('Server asset reference found.');
  if(/@import\s|url\(\s*["']?\//i.test(html))failures.push('External CSS resource found.');
  if(/<script\b[^>]+\bsrc\s*=/i.test(html)||/<link\b[^>]+\bhref\s*=/i.test(html))
    failures.push('External script or linked resource found.');
  for(const mode of modes)if(!html.includes(mode))failures.push('Missing '+mode+'.');
  return {pass:failures.length===0,failures,sizeBytes:Buffer.byteLength(html)};
}

export function assessLiveHealth(health,status){
  const healthy=status===200&&health?.ok===true&&health?.service==='stackhouse-social'&&health?.multiplayer===true;
  const durable=healthy&&health.storage==='postgres'&&health.durableStorage===true&&health.databaseConnected===true;
  const failures=[];
  if(!healthy)failures.push('STACKHOUSE live health check failed.');
  if(!durable)failures.push('Room storage is not confirmed durable after a restart.');
  return {healthy,durable,storage:health?.storage??'unknown',failures};
}

export function parseArgs(args){
  const result={url:null,requireDurable:false,json:false};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--url'&&args[i+1])result.url=args[++i];
    else if(args[i]==='--require-durable')result.requireDurable=true;
    else if(args[i]==='--json')result.json=true;
    else throw Error('Unknown or incomplete option: '+args[i]);
  }
  if(result.requireDurable&&!result.url)throw Error('--require-durable requires --url.');
  if(result.url){
    const parsed=new URL(result.url);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')
      throw Error('--url must be an HTTP(S) origin without credentials, path or query.');
    result.url=parsed.origin;
  }
  return result;
}

export async function preflight({url=null,requireDurable=false}={}){
  const result={codeReady:false,releaseReady:false,offline:null,live:null,
    outstanding:['Physical iPhone, Android and TV checks require hardware.',
      'Native screen-reader and human bot-balancing checks require human trials.']};
  try{
    result.offline=inspectOfflineHtml(await readFile(resolve(root,'PLAY-OFFLINE.html'),'utf8'));
    result.codeReady=result.offline.pass;
  }catch(err){result.offline={pass:false,failures:['Cannot read offline build: '+err.message]};}
  if(url){
    try{
      const response=await fetch(url+'/health',{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
      result.live=assessLiveHealth(await response.json(),response.status);
    }catch(err){result.live={healthy:false,durable:false,storage:'unknown',failures:['Live check failed: '+err.message]};}
    if(!result.live.durable)result.outstanding.unshift('Durable room storage is not verified.');
  }else result.outstanding.unshift('Live storage not checked; supply --url.');
  result.passed=result.codeReady&&(!url||result.live.healthy)&&(!requireDurable||result.live?.durable===true);
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const options=parseArgs(process.argv.slice(2));
    const result=await preflight(options);
    if(options.json)console.log(JSON.stringify(result,null,2));
    else{
      console.log('Offline build: '+(result.codeReady?'PASS':'FAIL'));
      for(const failure of result.offline.failures)console.log('- '+failure);
      if(result.live){
        console.log('Live service: '+(result.live.healthy?'HEALTHY':'UNHEALTHY'));
        console.log('Storage: '+(result.live.durable?'DURABLE':'NOT DURABLE CONFIRMED')+' ('+result.live.storage+')');
        for(const failure of result.live.failures)console.log('- '+failure);
      }
      console.log('Real-device release acceptance: NOT SIGNED OFF');
      console.log(result.passed?'Preflight checks passed.':'Preflight checks failed.');
    }
    if(!result.passed)process.exitCode=1;
  }catch(err){console.error(err.message);process.exitCode=1;}
}
