// Read-only loopback asset server. Not a business server; no POST, proxy or external connections.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
  let pathname
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch{res.writeHead(400);res.end();return}
  const relative=pathname==='/'?'web/index.html':pathname.slice(1),file=path.resolve(root,relative)
  if(!file.startsWith(root+path.sep)||!/^((web\/(index\.html|boot\.js|style\.css))|(miniprogram\/lib\/[a-z-]+\.js)|(miniprogram\/assets\/teaching-room-360\.png))$/.test(relative)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'");res.setHeader('X-Content-Type-Options','nosniff');res.writeHead(200);if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res)
})
server.listen(0,'127.0.0.1',()=>console.log('BROWSER_RENDER_ONLY '+JSON.stringify({url:'http://127.0.0.1:'+server.address().port,project:root,pid:process.pid})))
