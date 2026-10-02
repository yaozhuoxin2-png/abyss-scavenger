import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WORLD_BUILD} from '../world-scene.mjs';
import {MAGE_COLLAPSE_BUILD} from '../mage-collapse-state.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2);
if(args.includes('--emit')){
  const vendor=(await readdir(new URL('vendor/',root))).filter(name=>/\.(?:js|txt)$/.test(name)).map(name=>'vendor/'+name);
  const names=[...(await readdir(root)).filter(name=>/\.(?:mjs|css|html|png|webp)$/.test(name)&&!name.includes('candidate')),...vendor,'README.md','ART_SOURCES.md','.nojekyll','tools/audit-release.mjs'].sort();
  const files={};for(const name of names){const bytes=await readFile(new URL(name,root));files[name]={bytes:bytes.length,sha256:hash(bytes)};}
  console.log(JSON.stringify({build:MAGE_COLLAPSE_BUILD,worldBuild:WORLD_BUILD,files},null,2));
}else{
  const manifest=JSON.parse(await readFile(new URL('release.json',root),'utf8'));
  if(manifest.build!==MAGE_COLLAPSE_BUILD||manifest.worldBuild!==WORLD_BUILD)throw Error('Release / component build mismatch');
  const address=args[args.indexOf('--url')+1],remote=args.includes('--url');
  if(remote&&!/^https:\/\//.test(address))throw Error('An HTTPS release address is required');
  let index=0,passed=0;const names=Object.keys(manifest.files),failures=[];
  async function worker(){while(index<names.length){const name=names[index++];try{
    let bytes;if(remote){const u=new URL(name,address.endsWith('/')?address:address+'/');u.searchParams.set('release',manifest.build);const response=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}else bytes=await readFile(new URL(name,root));
    if(hash(bytes)!==manifest.files[name].sha256)throw Error('content hash mismatch');passed++;
  }catch(error){failures.push({file:name,reason:error.message});}}}
  await Promise.all(Array.from({length:remote?6:1},worker));
  console.log(JSON.stringify({build:manifest.build,target:remote?address:fileURLToPath(root),passed,total:names.length,failures},null,2));
  if(failures.length)process.exitCode=1;
}
