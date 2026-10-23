import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const {ts}=loadWechatTypeScript(), flush=()=>new Promise(r=>setTimeout(r,0))
let page,component,pendingPhone
const navigations=[],calls=[]
const runtime=createWechatTsRuntime(ts,{Page(v){page=v},Component(v){component=v},getCurrentPages:()=>[],wx:{
 getStorageSync(){},nextTick(fn){fn()},
 navigateTo(o){navigations.push(o.url);if(o.success)o.success();if(o.complete)o.complete()},
 request(){throw Error('Unexpected request')},login(){throw Error('Unexpected login')},
 openLocation(){throw Error('Unverified coordinates must not open a map')},
 makePhoneCall(o){calls.push(o.phoneNumber);pendingPhone=o},
}})
const load=f=>runtime.load(path.join('dist/production/miniprogram',f+'.js'))
const catalog=load('services/institution-catalog-v1-2-1'), service=load('services/institution-list-detail-page')
const result=await catalog.institutionCatalogServiceV121.loadCatalog()
assert.equal(result.ok,true);assert.equal(result.value.datasetMode,'PRODUCTION');assert.equal(result.value.records.length,11)
const records=result.value.records, first=records.find(r=>r.institutionId==='wh-social-welfare-institute')
assert.equal(createHash('sha256').update(JSON.stringify(first)).digest('hex'),'89092b27cec4dc41833d6baff6667890dd87d24a604f30c582532ba70e707c6e','V1.7 revision 1 must remain byte-for-byte unchanged as a record')
assert.equal(new Set(records.map(r=>r.institutionId)).size,records.length)
assert.equal(new Set(records.map(r=>r.identity.name.value+'|'+r.publicLocation.address.value.district.code+'|'+r.publicLocation.address.value.addressLine)).size,records.length)
const {publicSources}=load('production/sources'), {publicDirectoryEntries}=load('production/directory-data')
const {buildPublicDirectoryEntry,isCurrentPublicField}=load('production/record-builder')
const metadata=load('runtime/directory-metadata').readDirectoryMetadata()
assert.equal(new Set(metadata.map(r=>r.district)).size,8)
assert.equal(metadata.filter(r=>r.nature==='public').length,4)
assert.equal(metadata.filter(r=>r.nature==='private').length,2)
assert.equal(metadata.filter(r=>r.nature==='unknown').length,5)
for(const source of Object.values(publicSources)){
 assert.match(source.url,/^https:\/\/(?:[a-z0-9-]+\.)*(?:gov\.cn)\//)
 assert.ok(source.publisher&&source.title);assert.equal(source.reviewedOn,'2026-10-22')
 assert.ok(source.publishedOn===null||/^\d{4}-\d{2}-\d{2}$/.test(source.publishedOn))
 assert.equal(source.reviewState,'available');assert.ok(Date.parse(source.validUntil)>Date.parse(source.reviewedOn))
}
const host=d=>({...d,...d.methods,data:JSON.parse(JSON.stringify(d.data)),setData(p){Object.assign(this.data,p)}})
load('pages/institution/detail');const detailDefinition=page
load('pages/appointment/create');const bookingDefinition=page
let phoneInstitutions=0
for(const record of records){
 const identity={institutionId:record.institutionId,recordRevision:record.recordRevision}
 assert.equal(record.recordProvenance,'PRODUCTION_CANDIDATE')
 assert.ok(record.evidence.every(e=>e.sourceType==='official_document'&&Object.values(publicSources).some(s=>s.url===e.sourceReference)&&e.verifiedAt==='2026-10-22T00:00:00.000Z'))
 for(const group of Object.values(record.capabilities))for(const fact of Object.values(group))assert.equal(fact.status,'unknown')
 for(const fact of [record.price.referenceMonthlyPrice,record.identity.bedCapacity,record.publicLocation.geo,record.typeProfile.supportedTypes,record.operations.acceptingNewResidents])assert.equal(fact.availability,'unknown')
 assert.equal(record.operations.bedAvailability.status,'unknown');assert.equal(record.vr.status,'unknown');assert.equal(record.media.length,0)
 const direct=await service.buildInstitutionDetailPageSnapshot({identity,source:'direct',sourceContextRef:null})
 assert.equal(direct.ok,true)
 const view=load('pages/institution/detail-view-model').createInstitutionDetailPageViewModel(direct.value)
 assert.equal(view.location.addressState,'ready');assert.ok(view.location.address.includes(record.publicLocation.address.value.addressLine))
 assert.equal(view.location.mapAction.available,false);assert.equal(view.media.canOpenVr,false)
 const expired=await service.institutionDetailApplicationV12.build({identity,source:'direct',sourceContextRef:null,evaluationAsOf:'2027-01-21T00:00:00.000Z'})
 assert.equal(expired.ok,true)
 const expiredView=load('pages/institution/detail-view-model').createInstitutionDetailPageViewModel(expired.value)
 assert.equal(expiredView.location.addressState,'address_expired')
 assert.ok(expiredView.officialContact.phones.every(phone=>!phone.callAction.available&&!phone.displayValue))
 const notes=load('runtime/institution-source-notes').readInstitutionSourceNotes(identity.institutionId,identity.recordRevision)
 assert.ok(notes.length>0&&notes.every(note=>note.publisher&&note.verifiedOn==='2026-10-22'))
 assert.equal(load('runtime/institution-source-notes').readInstitutionSourceNotes(identity.institutionId,999).length,0)
 const detail=host(detailDefinition)
 detail.onLoad({institutionId:identity.institutionId,recordRevision:String(identity.recordRevision),source:'direct_list'});await flush()
 assert.equal(detail.data.pageState,'ready');assert.equal(detail.data.canRequestService,false)
 const beforeNav=navigations.length
 detail.onAppointmentTap();detail.onVrTap();detail.onMapTap();assert.equal(navigations.length,beforeNav)
 detail.onConsultationToggle();assert.equal(detail.data.consultationExpanded,true);detail.onConsultationToggle();assert.equal(detail.data.consultationExpanded,false)
 const beforeCalls=calls.length
 detail.onOfficialPhoneTap({currentTarget:{dataset:{phoneKey:'invalid'}}});assert.equal(calls.length,beforeCalls)
 const phone=detail.data.viewModel.officialContact.phones[0]
 if(phone){
  phoneInstitutions++;assert.equal(phone.callAction.available,true);assert.match(phone.callAction.dialValue,/^027[2-9]\d{7}$/)
  const tap=()=>detail.onOfficialPhoneTap({currentTarget:{dataset:{phoneKey:phone.key}}})
  tap();tap();assert.equal(calls.length,beforeCalls+1,'rapid taps must not duplicate a pending dial')
  assert.equal(calls.at(-1),phone.callAction.dialValue)
  pendingPhone.fail();pendingPhone.complete();assert.equal(detail.data.actionErrorKey,'phone')
  tap();assert.equal(calls.length,beforeCalls+2,'a failed dial must be retryable');pendingPhone.complete()
  detail.data.viewModel=expiredView;tap();assert.equal(calls.length,beforeCalls+2)
 }else assert.equal(view.officialContact.hasPhones,false)
 const booking=host(bookingDefinition);booking.onLoad({institutionId:identity.institutionId,recordRevision:String(identity.recordRevision)})
 assert.equal(booking.data.pageState,'institution_unavailable')
}
assert.equal(phoneInstitutions,7)
// Source outage/conflict, expiry and broken sidecar evidence cannot enable fields or filters.
const entry=publicDirectoryEntries.find(e=>e.institutionId==='wh-taibao-hanyang')
for(const state of ['unavailable','conflicting']){
 const sources=JSON.parse(JSON.stringify(publicSources));sources.metropolitan2026.reviewState=state
 const blocked=buildPublicDirectoryEntry(entry,sources)
 assert.equal(blocked.record.identity.name.availability,'unknown');assert.equal(blocked.record.publicLocation.address.availability,'unknown');assert.equal(blocked.record.officialContact.officialPhones.length,0)
 const outage=load('production/catalog').buildProductionCatalog(publicDirectoryEntries,sources)
 assert.equal(outage.records.some(row=>row.institutionId===entry.institutionId),false,'unverifiable core identity/address must be omitted from the current directory')
 assert.ok(outage.records.some(row=>row.institutionId==='wh-social-welfare-institute'))
 assert.equal(catalog.validateInstitutionCatalogPayloadV121(outage).ok,true,'one unavailable source must not invalidate other well-formed records')
}
const supplement=buildPublicDirectoryEntry(entry)
assert.equal(isCurrentPublicField(entry.institutionId,1,'directory.nature',supplement.nature,supplement.natureEvidence),true)
assert.equal(isCurrentPublicField(entry.institutionId,2,'directory.nature',supplement.nature,supplement.natureEvidence),false)
assert.equal(isCurrentPublicField(entry.institutionId,1,'directory.nature',supplement.nature,[]),false)
assert.equal(isCurrentPublicField(entry.institutionId,1,'directory.nature',supplement.nature,supplement.natureEvidence,Date.parse('2027-01-21')),false)
const altered=JSON.parse(JSON.stringify(result.value));altered.records[0].publicLocation.address.value.district.code='420118'
assert.equal(catalog.validateInstitutionCatalogPayloadV121(altered).ok,false)
const mismatch=JSON.parse(JSON.stringify(result.value));mismatch.records[0].identity.name.value='unsupported replacement'
assert.equal(catalog.validateInstitutionCatalogPayloadV121(mismatch).ok,false)
// Shared Home: fixed expectations independent of the predicate implementation.
load('pages/home/index');const home=host(component);component.lifetimes.attached.call(home);await flush()
assert.equal(home.data.institutions.length,2);assert.equal(home.data.resultCount,11)
const input=value=>home.onSearchInput({detail:{value}}), pick=(name,value)=>home[name]({detail:{value:String(value)}})
pick('onDistrictChange',4);assert.equal(home.data.institutions.length,3)
pick('onNatureChange',3);assert.equal(home.data.institutions.length,2)
input('太保');assert.equal(home.data.institutions.length,1);assert.equal(home.data.institutions[0].institutionId,'wh-taibao-hanyang')
input('并不存在');assert.equal(home.data.institutions.length,0);home.clearKeyword();assert.equal(home.data.institutions.length,2)
home.clearSearch();assert.equal(home.data.institutions.length,2);assert.equal(home.data.resultCount,11)
pick('onDistrictChange',8);pick('onNatureChange',1);assert.equal(home.data.institutions.length,2)
pick('onNatureChange',3);assert.equal(home.data.institutions.length,0)
home.clearSearch();pick('onNatureChange',4);assert.equal(home.data.institutions.length,5)
home.clearSearch();home.toggleDirectory()
assert.equal(home.data.institutions.length,11)
for(const row of home.data.institutions){
 component.pageLifetimes.show.call(home)
 home.onCardTap({currentTarget:{dataset:{itemKey:row.key}}})
 assert.ok(navigations.at(-1).includes('institutionId='+row.institutionId))
 await flush()
}
console.log('PASS: 11 real institutions / 8 districts / 7 public landlines; original revision preserved; per-field evidence, source outage/conflict, expiry, nature sidecar, compound search, canonical details, guarded dial retry, unknown capability/price/bed/geo/VR and no booking')
