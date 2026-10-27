/** Controlled current-working-tree snapshot. Missing AppID creates preparation, never an enabled test app. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const slash=value=>value.split(path.sep).join('/')
const forbidden=/(?:^|\/)(?:\.git|node_modules|miniprogram_npm|\.agents|\.codex|\.secrets|secrets|output|tmp|target|build|dist)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|.*(?:secret|credential|private\.config|\.key|\.pem|\.p12|\.jks|\.log|\.map))$/i
const sensitiveLiteral=/(?:app[_-]?secret|api[_-]?key|mysql[_-]?password|db[_-]?password)\s*[:=]\s*["']([^"'\r\n]{8,})["']/i
const allowedMini=new Set(['.ts','.js','.wxml','.wxss','.less','.json','.png','.jpg','.jpeg','.svg','.webp','.gif','.woff','.woff2','.ttf'])
const approvedFixtures=['test-only-answers.json','test-only-server-recommendation-catalog-v1.json']
export const inside=(root,target)=>{const relative=path.relative(root,target);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative)}
const regular=file=>{const s=fs.lstatSync(file);if(s.isSymbolicLink()||!s.isFile())throw Error('Non-regular source refused');return s}
const readSafe=file=>{regular(file);const bytes=fs.readFileSync(file);if(['.ts','.js','.mjs','.json','.yml','.yaml','.java','.xml'].includes(path.extname(file))&&sensitiveLiteral.test(bytes.toString('utf8')))throw Error('Literal secret-like input refused; review source locally');return bytes}
export const collectTree=(directory,accept)=>{
  const entries=[]
  const visit=(dir,prefix='')=>{
    if(fs.lstatSync(dir).isSymbolicLink())throw Error('Linked source directory refused')
    for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const rel=prefix?prefix+'/'+item.name:item.name,file=path.join(dir,item.name)
      if(item.isSymbolicLink())throw Error('Linked source entry refused')
      if(forbidden.test(rel))continue
      if(item.isDirectory())visit(file,rel)
      else if(item.isFile()&&accept(rel))entries.push({relative:rel,file})
    }
  }
  visit(directory);return entries
}
export const freshDestination=(source,destination)=>{
  source=fs.realpathSync(source);destination=path.resolve(destination)
  if(!inside(path.join(source,'output'),destination))throw Error('Test project must stay under the source repository output directory')
  if(fs.existsSync(destination))throw Error('Destination exists; preserve it and choose a new directory under output')
  let parent=path.dirname(destination)
  while(!fs.existsSync(parent))parent=path.dirname(parent)
  if(!fs.statSync(parent).isDirectory()||fs.realpathSync(parent)!==parent)throw Error('Linked or non-directory destination parent refused')
  return destination
}
export const safeTestAppId=(appid,formal)=>{
  if(appid===undefined||appid===null)return null
  if(typeof appid!=='string'||!/^wx[0-9a-f]{16}$/.test(appid)||appid===formal)throw Error('Explicit distinct Owner-supplied Test AppID required')
  return appid
}
const writeNew=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'})}
const jsonNew=(file,value)=>writeNew(file,JSON.stringify(value,null,2)+'\n')
const snapshotId=entries=>hash(JSON.stringify(entries.map(({path,sha256,size})=>({path,sha256,size})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)))
const effectiveConfig=(common,privateConfig)=>({
  description:'TEST_ONLY History environment; not approved for device submission',compileType:'miniprogram',
  miniprogramRoot:'miniprogram/',srcMiniprogramRoot:'miniprogram/',
  libVersion:privateConfig.libVersion||common.libVersion,
  setting:{useCompilerPlugins:['typescript','less'],es6:false,enhance:false,compileHotReLoad:false,urlCheck:true,
    minified:false,ignoreUploadUnusedFiles:true,babelSetting:{ignore:[],disablePlugins:[],outputPath:''}},
})
export const verifyPreparation=prepared=>{
  const root=fs.realpathSync(prepared),file=path.join(root,'PREPARATION_MANIFEST.json');regular(file)
  const m=JSON.parse(fs.readFileSync(file,'utf8'))
  if(m.kind!=='history_environment_source_preparation_v1'||!Array.isArray(m.files)||m.files.length===0||m.files.length>20000)throw Error('Invalid preparation manifest')
  const paths=new Set()
  for(const item of m.files){
    if(typeof item.path!=='string'||item.path.includes('\\')||item.path.split('/').includes('..')||path.isAbsolute(item.path)||paths.has(item.path))throw Error('Unsafe manifest path')
    const file=path.resolve(root,'source',item.path)
    if(!inside(path.join(root,'source'),file))throw Error('Manifest escapes source')
    paths.add(item.path);const bytes=readSafe(file)
    if(hash(bytes)!==item.sha256||bytes.length!==item.size)throw Error('Prepared source hash mismatch')
  }
  if(snapshotId(m.files)!==m.sourceSnapshotId)throw Error('Source snapshot identifier mismatch')
  // Compiler outputs in this snapshot may exist; they are not source or copied input.
  const actual=[]
  const verifyTree=(dir,prefix='')=>{
    for(const item of fs.readdirSync(dir,{withFileTypes:true})){
      const name=prefix?prefix+'/'+item.name:item.name
      if(item.isSymbolicLink())throw Error('Linked prepared entry refused')
      if(name==='server/target'&&item.isDirectory())continue
      if(item.isDirectory())verifyTree(path.join(dir,item.name),name)
      else if(item.isFile())actual.push(name)
      else throw Error('Unsupported prepared entry')
    }
  }
  verifyTree(path.join(root,'source'))
  if(actual.length!==paths.size||actual.some(p=>!paths.has(p)))throw Error('Unexpected source file in prepared snapshot')
  return m
}
export const prepareProject=({source=repository,destination,testAppId,approvalReference}={})=>{
  const realSource=fs.realpathSync(source)
  const task=new Date().toISOString().replace(/[:.]/g,'-')
  const dest=freshDestination(realSource,destination||path.join(realSource,'output','history-test',task,'generated-project'))
  const commonBytes=readSafe(path.join(realSource,'project.config.json')),common=JSON.parse(commonBytes),privateFile=path.join(realSource,'project.private.config.json')
  const privateBytes=fs.existsSync(privateFile)?fs.readFileSync(privateFile):null,privateConfig=privateBytes?JSON.parse(privateBytes):{}
  if(common.miniprogramRoot!=='miniprogram/'||common.srcMiniprogramRoot&&common.srcMiniprogramRoot!=='miniprogram/'||common.compileType!=='miniprogram'
    ||privateConfig.appid&&privateConfig.appid!==common.appid||privateConfig.miniprogramRoot&&privateConfig.miniprogramRoot!==common.miniprogramRoot
    ||privateConfig.srcMiniprogramRoot&&privateConfig.srcMiniprogramRoot!=='miniprogram/'||privateConfig.compileType&&privateConfig.compileType!=='miniprogram')throw Error('Source configuration needs explicit review')
  const appid=safeTestAppId(testAppId,common.appid)
  if(appid&&(!approvalReference||typeof approvalReference!=='string'||!/^[-A-Za-z0-9_.:]{3,96}$/.test(approvalReference)))throw Error('Short non-sensitive Owner approval reference required; not platform verification')
  const sourceInputs=collectTree(path.join(realSource,'miniprogram'),p=>allowedMini.has(path.extname(p))).map(x=>({...x,relative:'miniprogram/'+x.relative}))
  for(const subtree of ['server/src/main','server/tools']){
    if(!fs.existsSync(path.join(realSource,subtree)))throw Error(`Historical TEST_ONLY preparation requires ${subtree}; this frontend-only checkout cannot prepare a History backend`)
    sourceInputs.push(...collectTree(path.join(realSource,subtree),p=>['.java','.sql','.yml','.yaml','.mjs'].includes(path.extname(p))).map(x=>({...x,relative:subtree+'/'+x.relative})))
  }
  for(const rel of ['server/pom.xml','server/src/test/java/com/wuhan/eldercare/visit/assessment/HistoryIsolatedEnvironmentServer.java',...approvedFixtures.map(n=>'server/src/test/resources/assessment-history/'+n)]){
    const file=path.join(realSource,rel);if(!fs.existsSync(file))throw Error('Required isolated harness input missing');sourceInputs.push({file,relative:rel})
  }
  sourceInputs.sort((a,b)=>a.relative.localeCompare(b.relative))
  // Validate all inputs before creating the destination; no private config or credential files copied.
  const inputs=sourceInputs.map(x=>({...x,bytes:readSafe(x.file)})),head=execFileSync('git',['-C',realSource,'rev-parse','HEAD'],{encoding:'utf8'}).trim()
  fs.mkdirSync(path.dirname(dest),{recursive:true})
  fs.mkdirSync(dest)
  const files=[]
  for(const item of inputs){writeNew(path.join(dest,'source',item.relative),item.bytes);files.push({path:item.relative,size:item.bytes.length,sha256:hash(item.bytes)})}
  const config=effectiveConfig(common,privateConfig),templateBytes=Buffer.from(JSON.stringify(config,null,2)+'\n')
  writeNew(path.join(dest,'source/project.config.template.json'),templateBytes)
  files.push({path:'project.config.template.json',size:templateBytes.length,sha256:hash(templateBytes)})
  for(const item of inputs)if(hash(readSafe(item.file))!==hash(item.bytes))throw Error('Source changed during capture; preserve failed batch and create a new snapshot')
  if(hash(fs.readFileSync(path.join(realSource,'project.config.json')))!==hash(commonBytes)||privateBytes&&hash(fs.readFileSync(privateFile))!==hash(privateBytes))throw Error('Configuration changed during capture')
  const manifest={kind:'history_environment_source_preparation_v1',createdAt:new Date().toISOString(),sourceRoot:realSource,sourceHead:head,
    generatorSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    includesCurrentUncommittedSources:true,sourceSnapshotId:snapshotId(files),files,
    sourceConfigSha256:hash(commonBytes),sourcePrivateConfigSha256:privateBytes?hash(privateBytes):null,
    testAppIdStatus:appid?'OWNER_SUPPLIED_NOT_PLATFORM_VERIFIED':'WAITING_FOR_OWNER',
    independentTestAppId:'NOT_AVAILABLE',buildProvenance:'NOT_VERIFIED',backendIdentityBinding:'NOT_VERIFIED',httpsEndpoint:'NOT_READY',
    devtoolsFullSave:'NOT_RUN',android17ManualGate:'NOT_RUN',productionWrite:false,
    copyMechanism:'BUFFERED_INDEPENDENT_FILES_NO_HARDLINKS',privateConfigCopied:false,formalAppIdCopiedIntoTestProject:false,
    gate:'PREPARATION_ONLY_NO_ENABLED_SAVE_BUILD'}
  if(appid){
    fs.mkdirSync(path.join(dest,'project'))
    for(const item of inputs.filter(x=>x.relative.startsWith('miniprogram/')))writeNew(path.join(dest,'project',item.relative),item.bytes)
    jsonNew(path.join(dest,'project/project.config.json'),{...config,appid,projectname:'TEST_ONLY CompletedAssessment isolated project'})
    jsonNew(path.join(dest,'project/project.private.config.json'),{projectname:'TEST_ONLY History',libVersion:config.libVersion,setting:{urlCheck:true,compileHotReLoad:false}})
    manifest.configuredProject=path.join(dest,'project');manifest.ownerApprovalReferenceSha256=hash(approvalReference)
    manifest.configuredAppIdSha256=hash(appid)
    // Default source build returns null. AppID formatting/Owner reference never authorizes UI writes.
    manifest.controlledSaveEnabled=false
  }
  jsonNew(path.join(dest,'PREPARATION_MANIFEST.json'),manifest)
  writeNew(path.join(dest,'TEST_ONLY_PREPARATION.txt'),'No usable independent test application exists without Owner AppID/permission, verified server identity relationship, isolated resources and HTTPS. Never upload this preparation. No production write capability has been enabled.\n')
  return {directory:dest,manifest:path.join(dest,'PREPARATION_MANIFEST.json'),sourceSnapshotId:manifest.sourceSnapshotId,
    testAppIdStatus:manifest.testAppIdStatus,buildProvenance:manifest.buildProvenance,controlledSaveEnabled:false}
}

export const freezeBackendArtifact=({prepared,destination,classpathFile})=>{
  const m=verifyPreparation(prepared),source=path.join(fs.realpathSync(prepared),'source'),dest=path.resolve(destination)
  if(fs.existsSync(dest)||inside(source,dest)||dest===source)throw Error('Fresh artifact destination outside source snapshot required')
  if(fs.realpathSync(path.dirname(dest))!==path.dirname(dest))throw Error('Linked artifact parent refused')
  const classes=path.join(source,'server/target/classes'),testClasses=path.join(source,'server/target/test-classes')
  const entries=collectTree(classes,()=>true).map(x=>({...x,relative:'classes/'+x.relative}))
  entries.push(...collectTree(testClasses,p=>/^com\/wuhan\/eldercare\/visit\/assessment\/HistoryIsolatedEnvironmentServer(?:\$[^/]+)?\.class$/.test(p)||approvedFixtures.some(n=>p==='assessment-history/'+n)).map(x=>({...x,relative:'test-classes/'+x.relative})))
  if(!entries.some(x=>x.relative.endsWith('/HistoryIsolatedEnvironmentServer.class')))throw Error('Isolated harness not compiled')
  const cp=fs.readFileSync(classpathFile,'utf8').trim().split(path.delimiter)
  if(!cp.length||cp.some(p=>!p.endsWith('.jar')))throw Error('Dependency classpath must contain only JAR files')
  const names=new Set();for(const file of cp){regular(file);const name=path.basename(file);if(names.has(name))throw Error('Duplicate dependency name');names.add(name);entries.push({file,relative:'lib/'+name})}
  const sourceLatest=Math.max(...m.files.filter(x=>x.path.endsWith('.java')).map(x=>fs.statSync(path.join(source,x.path)).mtimeMs))
  if(fs.statSync(path.join(testClasses,'com/wuhan/eldercare/visit/assessment/HistoryIsolatedEnvironmentServer.class')).mtimeMs+2000<sourceLatest)throw Error('Stale compiled harness')
  fs.mkdirSync(dest);const frozen=[]
  for(const item of entries){regular(item.file);const bytes=fs.readFileSync(item.file);writeNew(path.join(dest,item.relative),bytes);frozen.push({path:item.relative,size:bytes.length,sha256:hash(bytes)})}
  verifyPreparation(prepared)
  const artifact={kind:'history_environment_frozen_backend_artifact_v1',createdAt:new Date().toISOString(),sourceSnapshotId:m.sourceSnapshotId,sourceHead:m.sourceHead,
    files:frozen.sort((a,b)=>a.path.localeCompare(b.path)),artifactId:snapshotId(frozen),nodeVersion:process.version,nodeExecutableSha256:hash(fs.readFileSync(process.execPath)),
    liveTargetClasspath:false,testAppIdGate:'WAITING_FOR_OWNER',buildProvenance:'NOT_VERIFIED',productionWrite:false}
  jsonNew(path.join(dest,'ARTIFACT_MANIFEST.json'),artifact)
  return {artifactRoot:dest,artifactId:artifact.artifactId,files:frozen.length,buildProvenance:'NOT_VERIFIED'}
}
const parse=args=>{const out={};for(let i=0;i<args.length;i+=2){if(!/^--[a-z-]+$/.test(args[i])||args[i+1]===undefined)throw Error('Expected named option/value pairs');if(out[args[i]])throw Error('Duplicate option');out[args[i]]=args[i+1]}return out}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const options=parse(process.argv.slice(2)),mode=options['--mode']||'prepare'
    const allowed=new Set(['--mode','--source','--destination','--test-appid','--approval-reference','--prepared','--classpath-file'])
    if(Object.keys(options).some(k=>!allowed.has(k)))throw Error('Unknown option')
    const result=mode==='prepare'?prepareProject({source:options['--source'],destination:options['--destination'],testAppId:options['--test-appid'],approvalReference:options['--approval-reference']})
      :mode==='verify'?{sourceSnapshotId:verifyPreparation(options['--prepared']).sourceSnapshotId,sourceHashes:'PASS',buildProvenance:'NOT_VERIFIED'}
      :mode==='artifact'?freezeBackendArtifact({prepared:options['--prepared'],destination:options['--destination'],classpathFile:options['--classpath-file']})
      :(()=>{throw Error('Unknown mode')})()
    console.log(JSON.stringify(result))
  }catch(error){console.error('TEST_ONLY preparation refused: '+error.message);process.exitCode=1}
}
