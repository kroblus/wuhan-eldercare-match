import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'admin-web/dist');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'.vite/manifest.json'),'utf8'));
const entry=Object.values(manifest).find(v=>v.isEntry);assert.ok(entry,'Vite entry required');
const initial=new Set(),seen=new Set();
function visit(chunk){if(seen.has(chunk.file))return;seen.add(chunk.file);initial.add(chunk.file);for(const css of chunk.css||[])initial.add(css);for(const key of chunk.imports||[])visit(manifest[key]);}
visit(entry);
for(const chunk of Object.values(manifest)){assert.ok(chunk.file.startsWith('assets/'));assert.ok(fs.existsSync(path.join(dist,chunk.file)));for(const file of chunk.css||[])assert.ok(fs.existsSync(path.join(dist,file)));}
for(const page of ['Dashboard','Requests','Visits','Institutions','Reports'])assert.ok(Object.keys(manifest).some(key=>key.endsWith('/'+page+'.tsx')),'lazy page '+page);
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');assert.match(html,/\/p1-admin\/assets\//);assert.doesNotMatch(html,/https?:\/\/|app\.js|operations\.js|publications\.js/);
const sourceRoot=path.join(root,'admin-web/src');
function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory()){if(entry.name!=='test')scan(file);}else if(/\.(ts|tsx)$/.test(file)&&!file.includes('.test.')){const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/dangerouslySetInnerHTML|\.innerHTML|\blocalStorage\b|\bsessionStorage\b|\bsetInterval\b/,file);assert.doesNotMatch(text,/https:\/\/.*(?:cdn|fonts\.google)/,file);}}}
scan(sourceRoot);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).devDependencies.typescript,'4.1.2');
const files=[...initial].map(file=>{const buffer=fs.readFileSync(path.join(dist,file));return {file,bytes:buffer.length,gzipBytes:gzipSync(buffer).length};});
const total=extension=>files.filter(f=>f.file.endsWith(extension)).reduce((sum,f)=>({bytes:sum.bytes+f.bytes,gzipBytes:sum.gzipBytes+f.gzipBytes}),{bytes:0,gzipBytes:0});
const result={schemaVersion:'admin-web-assets-v1',base:'/p1-admin/',initialJavaScript:total('.js'),initialCss:total('.css'),initialFiles:files,lazyRoutes:Object.keys(manifest).filter(k=>/\/pages\//.test(k)),note:'Build artifact bytes; gzip calculated locally, not a claim that the server enables compression.'};
const output=process.argv.indexOf('--output');if(output>=0){const target=path.resolve(process.argv[output+1]);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:'PASS',initialJavaScript:result.initialJavaScript,initialCss:result.initialCss,lazyRoutes:result.lazyRoutes.length}));
