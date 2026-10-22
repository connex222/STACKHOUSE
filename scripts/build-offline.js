import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async rel=>readFile(resolve(root,rel),'utf8');
const inline=async rel=>`data:image/webp;base64,${(await readFile(resolve(root,rel))).toString('base64')}`;
const avatars=await Promise.all(Array.from({length:16},(_,i)=>inline(`assets/avatar-${String(i+1).padStart(2,'0')}.webp`)));
const lounge=await inline('assets/lounge.webp');
const logo=await inline('assets/logo.webp');
let css=(await read('styles.css')).replaceAll('/assets/lounge.webp',lounge);
const sources=[];
for(const file of ['src/rng.js','src/hand-order.js','src/solo-save.js','src/solo-records.js','src/game-feel.js','src/engine/sequence.js','src/engine/contracts.js','src/engine/rack.js','src/engine/tiles.js','src/engine/lowcard.js','src/engine/eights.js','src/main.js']) {
 let code=await read(file);
 code=code.replace(/^import\s+[^;]*;\s*$/gm,'');
 if(file.startsWith('src/engine/')) code=code.replace(/\bclone\b/g,file.includes('sequence')?'sequenceClone':file.includes('contracts')?'contractClone':file.includes('rack')?'rackClone':file.includes('tiles')?'tileClone':file.includes('lowcard')?'lowClone':'eightClone');
 code=code.replace(/^export\s+(?=(const|function|class|async))/gm,'');
 if(file==='src/main.js') {
  code=code.replace('`/assets/avatar-${String(i+1).padStart(2,\'0\')}.webp`','OFFLINE_AVATARS[i]');
  code=code.replaceAll('src="/assets/logo.webp"','src="${OFFLINE_LOGO}"');
  code=code.replaceAll('Play with friends</button>','Play with the bot</button>');
  code=code.replaceAll('<button class="btn btn-ghost" data-action="room-open">Play with the bot</button>','');
  code=code.replaceAll('<button class="tile-play tile-online" data-action="room-open" data-mode="${g.id}">Private table ${icon(\'people\',16)}</button>','');
  code=code.replaceAll('Phase 4 · Ten tables','Offline · Ten tables');
  code=code.replaceAll('Solo games + private two-player tables','Play the House Bot offline');
  code=code.replaceAll("restoreRoom();",'');
 }
 sources.push(`// ${file}\n${code}`);
}
const js=`(()=>{\nconst OFFLINE_AVATARS=${JSON.stringify(avatars)};\nconst OFFLINE_LOGO=${JSON.stringify(logo)};\n${sources.join('\n\n')}\n})();`;
const html=`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071d20"><title>Stackhouse Social — Ten games offline</title><style>${css}</style></head><body><div id="app" aria-live="polite"></div><script>${js}</script></body></html>`;
if(html.includes('src="/assets/avatar') || html.includes('src="/assets/logo'))throw Error('Offline assets were not embedded.');
await writeFile(resolve(root,'PLAY-OFFLINE.html'),html);
console.log(`Standalone resumable bot edition built (${Math.round(html.length/1024)} KiB).`);
