import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const {ts}=loadWechatTypeScript()
const flush=()=>new Promise(resolve=>setTimeout(resolve,0))
const event=(name,value)=>({currentTarget:{dataset:{[name]:value}}})
for(const mode of ['production','demo']){
 let component,page,failNavigation=false,failCopy=false
 const navigations=[],effects=[]
 const api={nextTick:fn=>fn(),getAccountInfoSync:()=>({miniProgram:{appId:JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid,envVersion:'develop'}}),cloud:{},
  navigateTo(o){navigations.push(o.url);if(failNavigation){if(o.fail)o.fail()}else if(o.success)o.success();if(o.complete)o.complete()},
  switchTab(o){navigations.push(o.url);if(failNavigation){if(o.fail)o.fail()}else if(o.success)o.success();if(o.complete)o.complete()},
  setClipboardData(o){if(failCopy){if(o.fail)o.fail()}else{effects.push('copy-public-url');if(o.success)o.success()}if(o.complete)o.complete()},
 }
 for(const name of ['login','authorize','request','getStorageSync','setStorageSync','makePhoneCall','openLocation'])api[name]=()=>{effects.push(name);throw Error('Unexpected real API: '+name)}
 const rt=createWechatTsRuntime(ts,{wx:api,App(){},Page(v){page=v},Component(v){component=v},getCurrentPages:()=>[],setTimeout,clearTimeout})
 const load=f=>rt.load(path.join('dist',mode,'miniprogram',f+'.js'))
 const host=d=>({...d,...d.methods,data:JSON.parse(JSON.stringify(d.data)),setData(p){Object.assign(this.data,p)}})
 load('app');load('pages/home/index');const home=host(component)
 component.lifetimes.attached.call(home);await flush()
 if(mode==='demo'){
  assert.equal(home.data.empty,true)
  await load('demo/session').loadDemo();home.retryLoad();await flush()
 }
 const total=mode==='production'?1:12
 assert.equal(home.data.institutions.length,total);assert.equal(home.data.isLoading,false)
 assert.equal(home.data.natureOptions.length,5);assert.equal(home.data.districtOptions.length,15)
 const input=value=>home.onSearchInput({detail:{value}})
 const pick=(method,value)=>home[method]({detail:{value:String(value)}})
 input(mode==='production'?'  社会福利院  ':'春和');assert.equal(home.data.institutions.length,mode==='production'?1:3)
 pick('onDistrictChange',2);assert.equal(home.data.institutions.length,1)
 pick('onNatureChange',1);assert.equal(home.data.institutions.length,0) // No inference of real ownership; synthetic Jianghan example is public-built/private-operated.
 if(mode==='production'){
  pick('onNatureChange',4);assert.equal(home.data.institutions.length,1)
  pick('onDistrictChange',1);assert.equal(home.data.institutions.length,0)
 }else{
  pick('onNatureChange',2);assert.equal(home.data.institutions.length,1)
  pick('onDistrictChange',3);assert.equal(home.data.institutions.length,0)
 }
 home.clearSearch();assert.equal(home.data.institutions.length,total)
 input('不存在的机构');assert.equal(home.data.institutions.length,0)
 home.clearSearch();pick('onDistrictChange','999');pick('onNatureChange','NaN');assert.equal(home.data.institutions.length,total)
 const item=home.data.institutions[0]
 failNavigation=true;home.onCardTap(event('itemKey',item.key));assert.ok(home.data.institutionActionError)
 failNavigation=false;home.onCardTap(event('itemKey',item.key));home.onCardTap(event('itemKey',item.key));assert.equal(navigations.length,2)
 assert.ok(navigations[1].includes('institutionId='+item.institutionId));assert.ok(navigations[1].includes('recordRevision='+item.recordRevision))
 load('pages/institution/detail');const detail=host(page);detail.onLoad({institutionId:item.institutionId,recordRevision:String(item.recordRevision),source:'direct_link'});await flush();assert.equal(detail.data.pageState,'ready')
 load('pages/institution/index');const directory=host(page);directory.onLoad({});await flush();assert.equal(directory.data.visibleItems.length,total)
 directory.onSearchInput({detail:{value:'不存在的机构'}});assert.equal(directory.data.visibleItems.length,0);directory.clearSearch();assert.equal(directory.data.visibleItems.length,total)
 for(const topic of ['policy','education','admission']){
  component.pageLifetimes.show.call(home)
  failNavigation=true;home.openReading(event('topic',topic));assert.ok(home.data.readingActionError)
  failNavigation=false;home.openReading(event('topic',topic));const count=navigations.length;home.openReading(event('topic',topic));assert.equal(navigations.length,count)
  assert.equal(navigations[count-1],'/pages/service/'+topic+'/index')
  load('pages/service/'+topic+'/index');const reading=host(page)
  assert.ok(reading.data.article.sections.length>=4);assert.equal(reading.data.reviewedOn,'2026-10-22')
  assert.ok(reading.data.article.sources.every(s=>s.url.startsWith('https://')))
  reading.onCopySource(event('sourceId','invalid'));assert.equal(reading.data.copyPending,false)
  failCopy=true;reading.onCopySource(event('sourceId',reading.data.article.sources[0].id));assert.ok(reading.data.copyMessage.includes('长按'));assert.equal(reading.data.copyPending,false)
  failCopy=false;reading.onCopySource(event('sourceId',reading.data.article.sources[0].id));assert.equal(reading.data.copyPending,false)
  assert.ok(reading.data.copyMessage.includes(mode==='demo'?'长按':'已复制'))
  failNavigation=true;reading.goHome();assert.ok(reading.data.navigationError)
  failNavigation=false;reading.goHome();const returned=navigations.length;reading.goHome();assert.equal(navigations.length,returned);assert.equal(navigations[returned-1],'/pages/home/index')
 }
 assert.ok(effects.every(name=>name==='copy-public-url'));if(mode==='demo')assert.equal(effects.length,0)
 // Demo reset invalidates the shared directory and a reload restores all records.
 if(mode==='demo'){load('demo/session').resetDemo();home.retryLoad();await flush();assert.equal(home.data.empty,true);await load('demo/session').loadDemo();home.retryLoad();await flush();assert.equal(home.data.institutions.length,12)}
 if(mode==='production'){
  vm.runInContext("Date.now = () => Date.parse('2027-01-21T00:00:00Z')",rt.context)
  home.clearSearch();pick('onDistrictChange',2);assert.equal(home.data.institutions.length,0)
  pick('onDistrictChange',14);assert.equal(home.data.institutions.length,1) // Expired address cannot support a Jianghan filter fact.
 }
 const count=navigations.length;home.openReading(event('topic','../../appointment/create'));assert.equal(navigations.length,count)
 console.log('PASS '+mode+': Home compound search/reset/empty/invalid filters, guarded canonical detail, old directory, three content pages, source-copy failure, Home return, no real business APIs')
}
