import { cp,mkdir,rm } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const dist=new URL('../dist/',import.meta.url);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for (const name of ['index.html','styles.css','assets','src']) {
  await cp(new URL(name,root),new URL(name,dist),{recursive:true});
}
console.log('Static deployment created in dist/');
