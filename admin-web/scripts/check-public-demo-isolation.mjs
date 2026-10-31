import { readFileSync,readdirSync,statSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import assert from 'node:assert/strict';
const files = root => readdirSync(root).flatMap(name=>{const p=resolve(root,name);return statSync(p).isDirectory()?files(p):[p];});
const demo=files('dist-pages'),prod=files('dist');
assert(demo.length>4 && prod.length>4,'Both production and public-demo must be built');
for(const file of demo){
  assert(!/\.map$|\.env|private|\.sqlite|\.xlsx|\.sql$|server[\\/]|output[\\/]/i.test(relative('dist-pages',file)), 'Forbidden artifact: '+file);
  const text=readFileSync(file,'utf8');
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/.test(text), 'Credential-shaped artifact content: '+file);
  // Dependencies include URL validators and React Router's inert http://localhost parsing base.
  // Actual destinations are enforced by CSP connect-src none and the browser request audit.
  for(const forbidden of ['/api/v1/','/p1-admin/','127.0.0.1','runtime.private.json','Bearer sk-','https://cdn.','https://unpkg.'])assert(!text.includes(forbidden),`Demo contains ${forbidden} in ${file}`);
}
const html=readFileSync('dist-pages/index.html','utf8');
assert(html.includes('PUBLIC_DEMO') && html.includes("connect-src 'none'"));
assert(!/(?:src|href)="\/assets\//.test(html));
const info=JSON.parse(readFileSync('dist-pages/build-info.json','utf8'));
assert.equal(info.mode,'PUBLIC_DEMO');assert.match(info.sha,/^[a-f0-9]{40}$/);
for(const file of prod){const text=readFileSync(file,'utf8');for(const forbidden of ['PUBLIC_DEMO','p1-admin-public-demo-v1','P1_PUBLIC_DEMO_SYNTHETIC_ONLY','进入演示工作台','before-write','demo-account-'])assert(!text.includes(forbidden),`Production contains demo marker ${forbidden} in ${file}`);}
assert(readFileSync('dist/index.html','utf8').includes('/p1-admin/assets/'));
console.log(JSON.stringify({productionFiles:prod.length,demoFiles:demo.length,mode:info.mode,sha:info.sha,isolation:'PASS'}));
