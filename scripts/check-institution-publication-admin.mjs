// DOM event/HTTP-boundary simulation only. Synthetic institution data; no browser or real service.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {randomUUID} from 'node:crypto'

let assertions=0
const check=(value,message)=>{assert.ok(value,message);assertions++}
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++}
const clone=value=>JSON.parse(JSON.stringify(value))
class Node {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.handlers={};this.dataset={};this.attributes={};this._value='';this._text='';this.className='';this.checked=false;this.disabled=false;this.hidden=false;this.files=[]}
  get classList(){return {contains:value=>this.className.split(/\s+/).includes(value),add:value=>{this.className+=' '+value}}}
  set textContent(value){this._text=String(value);this.children=[]}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('')}
  set value(value){this._value=String(value)}
  get value(){if(this.tagName==='SELECT'&&!this._value)return this.options[0]?.value||'';return this._value}
  get options(){return this.children.filter(child=>child.tagName==='OPTION')}
  get selectedOptions(){return this.options.filter(option=>option.value===this.value)}
  get elements(){return Object.fromEntries(this.querySelectorAll('input,textarea,select,button').filter(node=>node.name).map(node=>[node.name,node]))}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child)}}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...children)}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null}
  setAttribute(name,value){this.attributes[name]=String(value)}
  addEventListener(type,handler){(this.handlers[type]||=[]).push(handler)}
  async fire(type,target=this){const event={type,target,currentTarget:this,preventDefault(){this.defaultPrevented=true}};for(const handler of this.handlers[type]||[])await handler(event);if(['input','change'].includes(type)&&this.parentNode)await this.parentNode.fire(type,target)}
  matches(selector){
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1))
    const attribute=selector.match(/^\[(name|value)=["']?([^"'\]]+)["']?\]$/)
    if(attribute)return this[attribute[1]]===attribute[2]
    return this.tagName===selector.toUpperCase()
  }
  querySelectorAll(selector){const selectors=selector.split(',').map(value=>value.trim()),result=[];const visit=node=>{for(const child of node.children){if(selectors.some(value=>child.matches(value)))result.push(child);visit(child)}};visit(this);return result}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  focus(){}
  reset(){for(const input of this.querySelectorAll('input,textarea,select')){input.value='';input.checked=false;input.files=[]}}
}
const body=new Node('body'),ids=new Map()
const add=(tag,id,parent=body)=>{const node=new Node(tag);if(id)ids.set(id,node);parent.append(node);return node}
const control=(form,tag,name,type)=>{const node=add(tag,null,form);node.name=name;if(type)node.type=type;return node}
for(const [tag,id] of [['p','institutionMessage'],['div','institutionList'],['section','institutionEditor'],['button','refreshInstitutions'],['p','message']])add(tag,id)
const newForm=add('form','newInstitutionForm');control(newForm,'input','institutionId');add('button',null,newForm)
const importForm=add('form','baselineImportForm');control(importForm,'input','catalogFile','file');control(importForm,'textarea','catalog');control(importForm,'input','sourceReference');control(importForm,'input','preserveExistingFacts','checkbox');add('button',null,importForm);add('p',null,importForm).className='operation-feedback'
const historySelect=add('select','historySelect');historySelect.className='institution-options';let option=add('option',null,historySelect);option.value='';option.textContent='全部机构'
const activeSelect=add('select','activeSelect');activeSelect.className='institution-active-options';option=add('option',null,activeSelect);option.value='';option.textContent='请选择机构'
const document={createElement:tag=>new Node(tag),getElementById:id=>ids.get(id),querySelectorAll:selector=>body.querySelectorAll(selector),body}
const window={handlers:{},addEventListener(type,handler){(this.handlers[type]||=[]).push(handler)},confirm:()=>true}
const id='synthetic-publication-admin',record={contractVersion:'institution-contract-v1.2.1',institutionId:id,recordRevision:1,recordStatus:'draft',identity:{name:{availability:'unknown',value:null,verification:{status:'unverified',evidenceIds:[]}}},evidence:[],capabilities:{specialCare:{status:'unknown'}}}
const pub='institution-publications-v1',old='p1-service-request-v1'
const wrap=value=>({contractVersion:pub,dataEnvironment:'SYNTHETIC_TEST_ONLY',...value})
const serviceRows=[{institutionId:id,institutionName:'合成资料机构',enabled:true,accessRevision:1,recordRevision:1},{institutionId:'synthetic-closed-campus',institutionName:'合成停用院区',enabled:false,accessRevision:2,recordRevision:1}]
let stored=null,failPublish='',failAccess=false,failImport=false,failSave=false,publicationOff=false,deferredSave=null,holdSave=false
const calls=[]
const failure=(status,code)=>Object.assign(Error('synthetic '+code),{httpStatus:status,code})
async function backend(path,options={},expected=old){
  const input=options.body?JSON.parse(options.body):null;calls.push({path,method:options.method||'GET',input,expected,csrf:options.headers?.['X-P1-CSRF']})
  if(path==='/service-institutions'){equal(expected,old);return {contractVersion:old,serviceInstitutions:clone(serviceRows)}}
  equal(expected,pub)
  if(path==='/institutions'){if(publicationOff)throw failure(503,'PUBLICATION_UNAVAILABLE');if(options.method==='POST'){check(input.record.identity.name.verification.status==='unverified','Name input never creates a verified fact');stored={institutionId:id,draftRevision:1,baseRecordRevision:null,currentRecordRevision:null,status:'DRAFT',record:input.record,publicProfile:input.publicProfile,confirmation:null,publishedRecordRevision:null,serviceAccess:{enabled:false,accessRevision:0}};return wrap({item:clone(stored)})}return wrap({items:stored?[{institutionId:id,name:stored.record.identity.name.value,draftRevision:stored.draftRevision,currentRecordRevision:stored.currentRecordRevision,status:stored.status}]:[]})}
  if(path.startsWith('/institutions/template?'))return wrap({record:clone(record),publicProfile:null})
  if(path.endsWith('/draft')){
    if(options.method==='PUT'){
      if(failSave)throw failure(409,'STALE_DRAFT_REVISION')
      const perform=()=>{stored={...stored,record:input.record,publicProfile:input.publicProfile,draftRevision:stored.draftRevision+1,status:'DRAFT',confirmation:null};return wrap({item:clone(stored)})}
      if(holdSave)return new Promise(resolve=>{deferredSave=()=>resolve(perform())})
      return perform()
    }
    return wrap({item:clone(stored)})
  }
  if(path.endsWith('/confirm')){stored={...stored,draftRevision:stored.draftRevision+1,status:'CONFIRMED',confirmation:{...input,confirmedAt:'2026-10-28T05:00:00Z'}};return wrap({item:clone(stored)})}
  if(path.endsWith('/publish')){
    if(failPublish==='before'){failPublish='';throw Error('synthetic timeout')}
    stored={...stored,status:'PUBLISHED',currentRecordRevision:(stored.currentRecordRevision||0)+1,publishedRecordRevision:(stored.currentRecordRevision||0)+1};stored.record.recordRevision=stored.publishedRecordRevision;stored.record.recordStatus='published'
    if(failPublish==='after'){failPublish='';throw Error('synthetic timeout after write')}
    return wrap({item:clone(stored),publication:{institutionId:id,recordRevision:stored.publishedRecordRevision,status:'PUBLISHED',publishedAt:'2026-10-28T05:00:00Z'}})
  }
  if(path.endsWith('/service-access')){if(failAccess){failAccess=false;throw Error('synthetic timeout')};stored.serviceAccess={enabled:input.enabled,accessRevision:input.expectedAccessRevision+1};return wrap({access:{institutionId:id,...stored.serviceAccess}})}
  if(path==='/institutions/import-baseline'){if(failImport){failImport=false;throw Error('synthetic timeout')};return wrap({imported:1,replayed:false})}
  throw Error('Unexpected route '+path)
}
const app=fs.readFileSync('admin-web/app.js','utf8'),operations=fs.readFileSync('admin-web/operations.js','utf8')
const context=vm.createContext({document,window,crypto:{randomUUID},URLSearchParams,console,backend,JSON,Intl,Date,Object,Number})
vm.runInContext(app.slice(0,app.indexOf('function signedOut()')),context)
vm.runInContext('async function api(path,options,expected){return backend(path,options,expected)}; csrf="synthetic-csrf"; epoch=1;',context)
vm.runInContext(operations.slice(operations.indexOf('function field('),operations.indexOf('function formSection(')),context)
vm.runInContext(fs.readFileSync('admin-web/publications.js','utf8'),context)
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve()}
const editor=ids.get('institutionEditor')
const editorForms=()=>editor.querySelectorAll('form')
const clickText=async text=>{const button=editor.querySelectorAll('button').find(node=>node.textContent===text);check(button,'Button exists: '+text);await button.fire('click');await flush();return button}
const fill=async(input,value)=>{input.value=value;await input.fire('input')}
const last=(suffix)=>calls.filter(call=>call.path.endsWith(suffix)).at(-1)
await flush()
check(historySelect.options.some(option=>option.value==='synthetic-closed-campus'&&option.textContent.includes('已停用')),'History filters retain disabled institution choices')
check(!activeSelect.options.some(option=>option.value==='synthetic-closed-campus'),'New operations use the active service list')
equal(historySelect.options.map(option=>option.value),['',id,'synthetic-closed-campus'])
newForm.elements.institutionId.value=id;await newForm.fire('submit');await flush()
check(editorForms().length===3,'A template opens independent draft, confirmation and access forms')
let [draft,confirmation,access]=editorForms()
equal(confirmation.elements.confirmedBy.value,'','Confirmation actor is never auto-filled')
equal(confirmation.elements.confirmedOn.value,'','Confirmation date is never auto-filled')
await fill(draft.elements.name,'合成资料机构')
check(JSON.parse(draft.elements.record.value).capabilities.specialCare.status==='unknown','Name editing does not infer care capability')
await draft.fire('submit');await flush();equal(stored,null,'An unknown region is not silently invented for the new institution')
await fill(draft.elements.regionCode,'420103');await fill(draft.elements.regionDisplayName,'江汉区')
equal(JSON.parse(draft.elements.record.value).identity.regionCode.verification.status,'unverified','Explicit region entry does not grant verification')
await draft.fire('submit');await flush()
check(stored.status==='DRAFT'&&stored.publicProfile===null,'Saving a template creates only a draft')
check(calls.find(call=>call.path==='/institutions'&&call.method==='POST').csrf==='synthetic-csrf','Mutations carry the existing CSRF token')
;[draft,confirmation,access]=editorForms()
confirmation.elements.sourceReference.value='SYNTHETIC_TEST_ONLY 来源';confirmation.elements.confirmedBy.value='synthetic-reviewer';confirmation.elements.confirmedOn.value='2026-10-27'
await confirmation.fire('submit');await flush()
equal(stored.confirmation.confirmedOn,'2026-10-27')
failPublish='before';await clickText('发布已确认版本')
const firstPublish=clone(last('/publish').input)
check(editorForms()[0].elements.name.disabled,'Unknown publish results freeze the original draft')
await clickText('使用原操作重试发布')
equal(last('/publish').input,firstPublish,'Publish retries preserve operation ID and original expected draft revision')
check(stored.currentRecordRevision===1&&stored.serviceAccess.enabled===false,'Publication does not enable service access')
;[draft,confirmation,access]=editorForms()
await fill(draft.elements.name,'本地尚未保存的名称')
check(confirmation.querySelector('button').disabled,'Local edits invalidate the confirm/publish UI immediately')
failSave=true;await draft.fire('submit');await flush()
equal(editorForms()[0].elements.name.value,'本地尚未保存的名称','Conflicts preserve local content')
check(editorForms()[0].querySelectorAll('button').find(button=>button.type==='submit').disabled,'Conflict requires an explicit refresh')
await fill(editorForms()[0].elements.name,'继续保留的本地名称')
check(editorForms()[0].querySelectorAll('button').find(button=>button.type==='submit').disabled,'Editing does not bypass a stale-revision conflict')
const beforeRefresh=calls.length;window.confirm=()=>false;await clickText('查询服务器草稿 / 发布状态')
equal(calls.length,beforeRefresh,'Cancelling refresh keeps local input and makes no request')
window.confirm=()=>true;failSave=false;await clickText('查询服务器草稿 / 发布状态')
equal(editorForms()[0].elements.name.value,'合成资料机构','Explicit refresh replaces local content with actual server state')
;[draft,confirmation,access]=editorForms()
await fill(draft.elements.name,'合成第二版名称');await draft.fire('submit');await flush()
;[draft,confirmation,access]=editorForms();check(confirmation.elements.confirmedBy.value==='','Newly saved edits require a fresh confirmation')
confirmation.elements.sourceReference.value='SYNTHETIC_TEST_ONLY 第二版来源';confirmation.elements.confirmedBy.value='synthetic-reviewer';confirmation.elements.confirmedOn.value='2026-10-27';await confirmation.fire('submit');await flush()
failPublish='after';await clickText('发布已确认版本');const publishCount=calls.filter(call=>call.path.endsWith('/publish')).length
await clickText('查询服务器草稿 / 发布状态')
equal(calls.filter(call=>call.path.endsWith('/publish')).length,publishCount,'Readback reconciles an already-published version without another write')
check(editor.textContent.includes('当前发布 2'),'Readback accepts the server-bound published revision')
;[draft,confirmation,access]=editorForms();access.elements.enabled.checked=true;access.elements.sourceReference.value='SYNTHETIC_TEST_ONLY 独立服务决定';failAccess=true;await access.fire('submit');await flush()
const originalAccess=clone(last('/service-access').input)
check(access.elements.sourceReference.disabled,'Unknown access results freeze original decision input')
await access.fire('submit');await flush();equal(last('/service-access').input,originalAccess,'Service access uses a stable retry operation')
check(stored.serviceAccess.enabled,'Service access changes only after the separate action')
importForm.elements.catalog.value=JSON.stringify({datasetMode:'PRODUCTION',records:[]});importForm.elements.sourceReference.value='SYNTHETIC_TEST_ONLY baseline'
let importCount=calls.filter(call=>call.path.endsWith('/import-baseline')).length;await importForm.fire('submit');await flush()
equal(calls.filter(call=>call.path.endsWith('/import-baseline')).length,importCount,'Baseline import needs explicit preserve-facts acknowledgement')
importForm.elements.preserveExistingFacts.checked=true;failImport=true;await importForm.fire('submit');await flush();const originalImport=clone(last('/import-baseline').input)
check(importForm.elements.catalog.disabled,'Unknown baseline import keeps original content locked')
await importForm.fire('submit');await flush();equal(last('/import-baseline').input,originalImport,'Baseline retries retain original operation and snapshot')
check(!importForm.elements.catalog.disabled,'A confirmed import releases its input lock')
const exportedCatalog={datasetMode:'PRODUCTION',records:[{institutionId:'synthetic-current',recordRevision:2}]},exportedHistory=[{institutionId:'synthetic-current',recordRevision:1}]
importForm.elements.catalog.value=JSON.stringify({catalog:exportedCatalog,historicalRecords:exportedHistory})
await importForm.fire('submit');await flush()
equal(last('/import-baseline').input.catalog,exportedCatalog,'Export envelope keeps the current catalog independent')
equal(last('/import-baseline').input.historicalRecords,exportedHistory,'Historical records are preserved outside the current pool')
;[draft]=editorForms();await fill(draft.elements.name,'合成登出期间保存');holdSave=true;const write=draft.fire('submit');await flush();check(typeof deferredSave==='function','A real async save is pending')
vm.runInContext('epoch++;csrf="";window.clearInstitutionWorkspace()',context);deferredSave();await write;await flush()
holdSave=false
check(!editor.querySelector('form'),'Late save response after logout cannot restore an editor')
check(!newForm.querySelector('button').disabled,'Logout releases new-template controls')
vm.runInContext('epoch++;csrf="synthetic-csrf"',context);publicationOff=true;window.loadInstitutionWorkspace();await flush()
check(ids.get('institutionMessage').textContent.includes('暂未开通'),'Publication-disabled state is visible')
check(activeSelect.options.some(option=>option.value===id),'P1 service choices load independently of publication availability')
check(!fs.readFileSync('admin-web/index.html','utf8').includes('ningyue-yiyang-center'),'Static institution IDs are removed from HTML filters')
check(!operations.includes('ningyue-yiyang-center')&&!operations.includes('synthetic-reception-b'),'Operational institution choices are entirely server supplied')
check(app.includes('error.code=body.code')&&app.includes('clearInstitutionWorkspace'),'Shared API preserves error codes and clears publication state at signout')
publicationOff=false;window.loadInstitutionWorkspace();await flush()
await ids.get('institutionList').querySelector('button').fire('click');await flush()
;[draft,confirmation,access]=editorForms();draft.elements.hasProfile.checked=true;await draft.elements.hasProfile.fire('change')
for(const [key,value] of Object.entries({source:'SYNTHETIC_TEST_ONLY 公示表',room:'合成双人间',address:'合成地址待确认',nature:'性质待核对',tags:'医养结合\n术后康养',tagNote:'标签仅作合成展示，不证明护理能力',otherFees:'其他费用待确认',priceNote:'元/月，合成公示总价，档位需机构另行评估',historyNote:'合成新版，旧版保留'}))draft.elements[key].value=value
await clickText('增加一行公示价')
const row=editor.querySelector('.publication-price-row')
for(const [key,value] of Object.entries({level:'合成公示档位',bed:'1800',care:'900',food:'900',total:'3500'}))row.querySelector(`[name=${key}]`).value=value
let beforeSave=calls.filter(call=>call.method==='PUT').length;await draft.fire('submit');await flush()
equal(calls.filter(call=>call.method==='PUT').length,beforeSave,'An inconsistent displayed price is rejected before any write')
equal(row.querySelector('[name=total]').value,'3500','Price validation preserves source input for correction')
row.querySelector('[name=total]').value='3600';await draft.fire('submit');await flush()
const savedProfile=last('/draft').input.publicProfile
equal(savedProfile.prices,[{level:'合成公示档位',bed:1800,care:900,food:900,total:3600}],'Published profile uses the explicit source amounts and exact total')
equal(savedProfile.tags,['医养结合','术后康养'])
check(stored.record.capabilities.specialCare.status==='unknown','Display tags do not write capability evidence')
;[draft,confirmation,access]=editorForms();const originalRecord=draft.elements.record.value;await fill(draft.elements.record,'{');beforeSave=calls.filter(call=>call.method==='PUT').length;await draft.fire('submit');await flush()
equal(calls.filter(call=>call.method==='PUT').length,beforeSave,'Incomplete advanced JSON does not write or discard other fields')
equal(draft.elements.record.value,'{')
await fill(draft.elements.record,originalRecord);await fill(draft.elements.name,'未保存且需保留的公开名称')
access.elements.enabled.checked=false;access.elements.sourceReference.value='SYNTHETIC_TEST_ONLY 停用决定';failAccess=true;await access.fire('submit');await flush()
stored.serviceAccess={enabled:false,accessRevision:stored.serviceAccess.accessRevision+1}
await clickText('查询服务器草稿 / 发布状态')
equal(editorForms()[0].elements.name.value,'未保存且需保留的公开名称','Reconciling access cannot discard an unsaved public-profile edit')
check(!editorForms()[0].elements.name.disabled,'Known access state releases draft controls')
fs.mkdirSync('output/institution-publication-v1-20261028',{recursive:true})
fs.writeFileSync('output/institution-publication-v1-20261028/admin-runtime.json',JSON.stringify({kind:'SYNTHETIC_DOM_EVENT_TEST',assertions,status:'PASS',realNetwork:false,realBrowser:false},null,2)+'\n')
console.log(`INSTITUTION_PUBLICATION_ADMIN: ${assertions} assertions PASS; synthetic DOM events/API boundaries, no browser or production claim`)
