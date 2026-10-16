import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(root,'.'+relative);if(!target.startsWith(root)){res.writeHead(403);res.end();return;}if((await stat(target)).isDirectory())target=path.join(target,'index.html');const body=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
server.listen(4178,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4178/motion-vol01/'));
