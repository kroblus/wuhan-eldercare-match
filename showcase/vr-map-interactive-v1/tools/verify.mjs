// Bounded offline verification; never starts the formal app or changes project settings.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {loadWechatTypeScript} from '../../../scripts/support/load-wechat-ts-runtime.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repository=path.resolve(root,'../..'),out=path.join(repository,'output/v1-2-showcase-vr-map-interactive-demo-v1-20261016','verification-'+Date.now())
fs.mkdirSync(out,{recursive:true});const {ts}=loadWechatTypeScript();if(ts.version!=='4.1.2')throw Error('UNKNOWN_TYPESCRIPT')
const results=[]
function run(name,command,args,cwd=repository){const r=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,timeout:90000}),log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,name+'.log'),log);results.push({name,exit:r.status,error:r.error?.message});console.log(name+' = '+r.status);return r}
run('isolated-runtime',process.execPath,['showcase/vr-map-interactive-v1/tests/check-runtime.mjs'])
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)])
let sourceCount=0;const emitted=[]
for(const f of walk(path.join(root,'miniprogram')).filter(f=>f.endsWith('.js'))){const code=fs.readFileSync(f,'utf8'),parsed=ts.createSourceFile(f,code,ts.ScriptTarget.ES2017,true,ts.ScriptKind.JS);if(parsed.parseDiagnostics.length)throw Error('SOURCE_SYNTAX '+f);const emit=ts.transpileModule(code,{fileName:f,compilerOptions:{allowJs:true,target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});if(emit.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('EMIT_SYNTAX '+f);const p=ts.createSourceFile(f,emit.outputText,ts.ScriptTarget.ES2017,true,ts.ScriptKind.JS);if(p.parseDiagnostics.length)throw Error('EMITTED_SYNTAX '+f);let bad=false;function visit(n){if(ts.isPropertyDeclaration(n))bad=true;ts.forEachChild(n,visit)}visit(p);if(bad)throw Error('CLASS_FIELD '+f);const target=path.join(out,'portable-js',path.relative(path.join(root,'miniprogram'),f));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,emit.outputText);sourceCount++;emitted.push(path.relative(out,target))}
fs.writeFileSync(path.join(out,'typescript-compat.json'),JSON.stringify({parser:ts.version,sourceFiles:sourceCount,emitted,pass:true,evidenceLevel:'LOCAL_COMPILER_ARTIFACT_NOT_DEVTOOLS_GENERATED',note:'Plain JS production inputs, TS4.1.2 parse + ES2017 emit + no class fields; no fresh DevTools app compile'},null,2)+'\n')
const compiler='D:/DailyAPP/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec/'
run('wxml-offline-compiler',path.join(compiler,'wcc.exe'),['-o',path.join(out,'wxml-generated.js'),'pages/index/index.wxml','pages/panorama/index.wxml','pages/map/index.wxml'],path.join(root,'miniprogram'))
run('wxss-offline-compiler',path.join(compiler,'wcsc.exe'),['-lc','-o',path.join(out,'wxss-generated.js'),'app.wxss'],path.join(root,'miniprogram'))
if(!process.argv.includes('--local-only'))for(const script of ['check-institution-detail-v1-2-1-interactions.mjs','check-institution-detail-v1-2-1-ui-runtime.mjs','check-recommendation-v2-runtime.mjs','check-recommendation-result-save-runtime.mjs','check-appointment-create-runtime.mjs','check-consultant-b3-runtime.mjs','check-doc-governance.mjs'])run(script,process.execPath,[path.join('scripts',script)])
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({evidenceLevel:'OFFLINE_TEST_AND_VENDOR_COMPILER',typescript:'4.1.2',sourceCount,results},null,2)+'\n')
console.log('EVIDENCE_DIRECTORY '+out);if(results.some(r=>r.exit!==0))process.exitCode=1
