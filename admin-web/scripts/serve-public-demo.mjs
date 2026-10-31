import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist-pages'), prefix = '/wuhan-eldercare-match/';
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
createServer(async (req,res) => {
  const url = new URL(req.url,'http://127.0.0.1');
  if(url.pathname === prefix.slice(0,-1)){res.writeHead(301,{Location:prefix});res.end();return;}
  if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
  try {
    const file = resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
    if(!file.startsWith(root+sep) || !(await stat(file)).isFile())throw Error('Not found');
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(file));
  } catch { res.writeHead(404);res.end('Not found'); }
}).listen(Number(process.env.PORT || 5187),'127.0.0.1',()=>console.log('Static Pages preview: http://127.0.0.1:'+(process.env.PORT || 5187)+prefix));
