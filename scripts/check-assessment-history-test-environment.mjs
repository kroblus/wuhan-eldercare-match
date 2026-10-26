/** Environment helper checks; never platform permission, package or device acceptance. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {collectTree,freshDestination,safeTestAppId,verifyPreparation} from './prepare-assessment-history-test-project.mjs'

const root=path.resolve('server/target','history-environment-check-'+randomUUID());fs.mkdirSync(root)
const source=path.join(root,'fixture-source');fs.mkdirSync(source)
const write=(relative,content)=>{const file=path.join(source,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);return file}
const formal=JSON.parse(fs.readFileSync('project.config.json','utf8')).appid
let cases=0
const check=(name,fn)=>{fn();cases++;console.log('PASS '+name)}
check('missing Test AppID stays absent',()=>assert.equal(safeTestAppId(undefined,formal),null))
check('formal AppID cannot become Test AppID',()=>assert.throws(()=>safeTestAppId(formal,formal)))
check('malformed/blank identities refused without creating fake AppID',()=>{for(const value of ['','placeholder','TEST_ONLY',null,{},123]){if(value===null)assert.equal(safeTestAppId(value,formal),null);else assert.throws(()=>safeTestAppId(value,formal))}})
check('existing destination preserved',()=>assert.throws(()=>freshDestination(source,root)))
check('source and source descendants refused',()=>{assert.throws(()=>freshDestination(source,source));assert.throws(()=>freshDestination(source,path.join(source,'new-test')))})
check('fresh independent destination is a plan only',()=>{const dest=path.join(root,'fresh');assert.equal(freshDestination(source,dest),dest);assert.equal(fs.existsSync(dest),false)})
write('app.ts','export const TEST_ONLY = true\n');write('.env','DO_NOT_COPY=TEST_ONLY_UNIT');write('credential.secret','TEST_ONLY_UNIT');write('node_modules/dependency/index.ts','TEST_ONLY_UNIT');write('nested/code.ts','export const nested = true\n')
check('controlled traversal excludes private/cache files',()=>assert.deepEqual(collectTree(source,p=>p.endsWith('.ts')).map(x=>x.relative).sort(),['app.ts','nested/code.ts']))
const linked=path.join(source,'link.ts');fs.symlinkSync(path.join(source,'app.ts'),linked)
check('linked source refuses instead of sharing original bytes',()=>assert.throws(()=>collectTree(source,()=>true)))
// Test-created links remain as evidence; a separate fixture is used below, no cleanup.
const prepared=path.join(root,'prepared');fs.mkdirSync(path.join(prepared,'source'),{recursive:true})
const code=Buffer.from('export const TEST_ONLY_PREPARATION = true\n'),file=path.join(prepared,'source','app.ts');fs.writeFileSync(file,code)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),files=[{path:'app.ts',size:code.length,sha256:hash(code)}]
const id=hash(JSON.stringify(files.map(({path,sha256,size})=>({path,sha256,size}))))
const manifest={kind:'history_environment_source_preparation_v1',sourceSnapshotId:id,files}
fs.writeFileSync(path.join(prepared,'PREPARATION_MANIFEST.json'),JSON.stringify(manifest))
check('source bytes and content identifier verified',()=>assert.equal(verifyPreparation(prepared).sourceSnapshotId,id))
fs.writeFileSync(file,'TEST_ONLY changed')
check('modified prepared source rejected',()=>assert.throws(()=>verifyPreparation(prepared)))
fs.writeFileSync(file,code);fs.writeFileSync(path.join(prepared,'source','unlisted.ts'),'TEST_ONLY extra')
check('unlisted source rejected',()=>assert.throws(()=>verifyPreparation(prepared)))
manifest.files=[{path:'../outside',size:0,sha256:'0'.repeat(64)}];fs.writeFileSync(path.join(prepared,'PREPARATION_MANIFEST.json'),JSON.stringify(manifest))
check('traversal manifest rejected',()=>assert.throws(()=>verifyPreparation(prepared)))

const args=process.argv.slice(2),preparedIndex=args.indexOf('--prepared')
if(preparedIndex>=0){const actual=verifyPreparation(path.resolve(args[preparedIndex+1]));console.log('PASS actual current-working-tree prepared snapshot: '+actual.files.length+' source files');cases++}
console.log(`HISTORY_ENVIRONMENT_HELPERS = PASS: ${cases}; retained TEST_ONLY evidence ${root}; no AppID/device/build admission`)
