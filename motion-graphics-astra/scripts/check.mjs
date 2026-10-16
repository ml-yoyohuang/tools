import {readdir,readFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let count=0,errors=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(/\.(js|mjs|cjs)$/.test(p)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)errors.push(r.stderr);count++;}else if(p.endsWith('.html')){const html=await readFile(p,'utf8');for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){if(/^(https?:|data:)/.test(m[1]))continue;try{await stat(path.resolve(path.dirname(p),m[1]));}catch{errors.push(`${p}: missing ${m[1]}`);}}count++;}}}
await walk(root);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS: ${count} JavaScript modules / HTML pages, syntax and all local page references. Static project: no compilation required.`);
