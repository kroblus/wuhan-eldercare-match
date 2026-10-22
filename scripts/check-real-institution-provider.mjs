import assert from 'node:assert/strict'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const {ts}=loadWechatTypeScript()
let page, navigations=[], calls=[]
const runtime=createWechatTsRuntime(ts,{Page(v){page=v},Component(){},getCurrentPages:()=>[],wx:{
  getStorageSync(){},nextTick(fn){fn()},
  navigateTo(o){navigations.push(o.url);if(o.success)o.success();if(o.complete)o.complete()},
  request(){throw Error('Unexpected production request')},login(){throw Error('Unexpected login')},
  openLocation(){throw Error('Unknown coordinates must not open a map')},
  makePhoneCall(o){calls.push(o.phoneNumber);if(o.complete)o.complete()},
}})
const load=f=>runtime.load(path.join('dist/production/miniprogram',f+'.js'))
const catalog=load('services/institution-catalog-v1-2-1')
const result=await catalog.institutionCatalogServiceV121.loadCatalog()
assert.equal(result.ok,true)
assert.equal(result.value.datasetMode,'PRODUCTION')
assert.equal(result.value.records.length,1)
const r=result.value.records[0],identity={institutionId:r.institutionId,recordRevision:r.recordRevision}
assert.equal(r.identity.name.value,'武汉市社会福利院')
assert.equal(r.recordProvenance,'PRODUCTION_CANDIDATE')
assert.ok(r.evidence.every(e=>e.sourceType==='official_document'&&/^https:\/\/(mzj|zrzyhcxjs)\.wuhan\.gov\.cn\//.test(e.sourceReference)&&e.verifiedAt==='2026-10-22T00:00:00.000Z'))
assert.equal(r.evidence.find(e=>e.fieldPath==='identity.regionCode').sourceReference,'https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/')
for(const group of Object.values(r.capabilities))for(const fact of Object.values(group))assert.equal(fact.status,'unknown')
assert.equal(r.price.referenceMonthlyPrice.availability,'unknown')
assert.equal(r.operations.bedAvailability.status,'unknown')
assert.equal(r.publicLocation.geo.availability,'unknown')
assert.equal(r.vr.status,'unknown')
const service=load('services/institution-list-detail-page')
const direct=await service.buildInstitutionDetailPageSnapshot({identity,source:'direct',sourceContextRef:null})
assert.equal(direct.ok,true)
const vm=load('pages/institution/detail-view-model').createInstitutionDetailPageViewModel(direct.value)
assert.equal(vm.location.address,'湖北省武汉市江汉区发展大道198号')
assert.equal(vm.location.addressState,'ready')
assert.equal(vm.location.mapAction.available,false)
assert.equal(vm.media.canOpenVr,false)
assert.equal(vm.officialContact.phones[0].callAction.available,true)
assert.equal(vm.officialContact.phones[0].callAction.dialValue,'02785872325')
const expired=await service.institutionDetailApplicationV12.build({identity,source:'direct',sourceContextRef:null,evaluationAsOf:'2027-01-21T00:00:00.000Z'})
assert.equal(expired.ok,true)
const expiredVm=load('pages/institution/detail-view-model').createInstitutionDetailPageViewModel(expired.value)
assert.equal(expiredVm.location.addressState,'address_expired')
assert.equal(expiredVm.officialContact.phones[0].callAction.available,false)
assert.equal(expiredVm.officialContact.phones[0].displayValue,'')
const altered=JSON.parse(JSON.stringify(result.value));altered.records[0].publicLocation.address.value.district.code='420102'
assert.equal(catalog.validateInstitutionCatalogPayloadV121(altered).ok,false)
altered.records[0].publicLocation.address.value.district.code='420103';altered.records[0].identity.name.value='unsupported replacement'
assert.equal(catalog.validateInstitutionCatalogPayloadV121(altered).ok,false)
const host=d=>({...d,data:JSON.parse(JSON.stringify(d.data)),setData(p){Object.assign(this.data,p)}})
const flush=()=>new Promise(resolve=>setTimeout(resolve,0))
load('pages/institution/index');const list=host(page);list.onLoad({});await flush()
assert.equal(list.data.pageState,'ready');assert.equal(list.data.visibleItems.length,1)
list.onSearchInput({detail:{value:'社会福利院'}});assert.equal(list.data.visibleItems.length,1)
list.onSearchInput({detail:{value:'不存在的示例'}});assert.equal(list.data.visibleItems.length,0)
list.clearSearch();list.onCardTap({currentTarget:{dataset:{itemKey:list.data.visibleItems[0].key}}})
assert.equal(navigations.length,1);assert.ok(navigations[0].includes('institutionId='+identity.institutionId))
load('pages/institution/detail');const detail=host(page)
detail.onLoad({institutionId:identity.institutionId,recordRevision:'1',source:'direct_list'});await flush()
assert.equal(detail.data.pageState,'ready');assert.equal(detail.data.canRequestService,false)
detail.onAppointmentTap();detail.onVrTap();detail.onMapTap();assert.equal(navigations.length,1)
detail.onOfficialPhoneTap({currentTarget:{dataset:{phoneKey:detail.data.viewModel.officialContact.phones[0].key}}})
assert.deepEqual(calls,['02785872325'])
load('pages/appointment/create');const booking=host(page);booking.onLoad({institutionId:identity.institutionId,recordRevision:'1'})
assert.equal(booking.data.pageState,'institution_unavailable')
console.log('PASS: reviewed real identity/address/landline, canonical list-detail search and navigation, unknown capabilities/price/beds/geo/VR, expiry masking, strict division/evidence rejection, read-only booking policy and no real API calls')
