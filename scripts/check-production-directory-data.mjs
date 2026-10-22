// Portable source-data checks only. Full WeChat builds and projected behavior have separate gates.
import assert from 'node:assert/strict'
import {createWechatTsRuntime,loadWechatTypeScript} from './support/load-wechat-ts-runtime.mjs'
const rt=createWechatTsRuntime(loadWechatTypeScript().ts)
const {publicDirectoryEntries:entries}=rt.load('modes/production/directory-data.ts')
const {publicSources}=rt.load('modes/production/sources.ts')
const {reviewedDistricts,administrativeDivisionResolver:resolver}=rt.load('modes/production/administrative-divisions.ts')
assert.equal(entries.length,10)
const ids=new Set(),identities=new Set()
for(const [key,source] of Object.entries(publicSources)){
 const url=new URL(source.url)
 assert.equal(url.protocol,'https:');assert.match(url.hostname,/(^|\.)gov\.cn$/)
 assert.ok(source.title.trim()&&source.publisher.trim(),key)
 assert.match(source.reviewedOn,/^\d{4}-\d{2}-\d{2}$/)
 assert.ok(source.publishedOn===null||Date.parse(source.publishedOn)<=Date.parse(source.reviewedOn))
 assert.ok(Date.parse(source.validUntil)>Date.parse(source.reviewedOn))
 assert.equal(source.reviewState,'available')
}
for(const entry of entries){
 assert.match(entry.institutionId,/^[a-z][a-z0-9-]+$/);assert.ok(!ids.has(entry.institutionId));ids.add(entry.institutionId)
 assert.equal(entry.recordRevision,1);assert.ok(entry.identityNote.trim())
 const district=reviewedDistricts.find(row=>row.code===entry.districtCode);assert.ok(district)
 for(const field of [entry.name,entry.address,entry.phone,entry.nature].filter(Boolean)){
  assert.ok(field.value.trim()&&field.sources.length)
  for(const key of field.sources)assert.ok(publicSources[key],key)
 }
 if(entry.phone)assert.match(entry.phone.value,/^[2-9]\d{7}$/,'only institution fixed lines, no contact-person mobiles')
 if(entry.nature)assert.ok(['public','private','public_built_private_operated'].includes(entry.nature.value))
 for(const name of [entry.name.value,...entry.aliases||[]]){
  const identity=name.normalize('NFC').replace(/\s/g,'')+'|'+entry.districtCode+'|'+entry.address.value
  assert.ok(!identities.has(identity),'duplicate name/alias at the same address');identities.add(identity)
 }
 const address={countryCode:'CN',province:{code:'420000',displayName:'湖北省'},city:{code:'420100',displayName:'武汉市'},district:{code:district.code,displayName:district.displayName},addressLine:entry.address.value,postalCode:null}
 assert.equal(resolver.isValidHierarchy(address),true)
 assert.equal(resolver.isValidHierarchy({...address,district:{...address.district,displayName:'错误区名'}}),false)
 assert.equal(resolver.isValidHierarchy({...address,district:{code:'420118',displayName:'东湖开发区'}}),false)
 assert.equal(resolver.isValidHierarchy({...address,province:{code:'430000',displayName:'湖南省'}}),false)
}
console.log('PASS: 10 curated additions, unique identities/aliases by address, official source metadata/dates, explicit nature, landline-only imports and reviewed administrative hierarchy')
