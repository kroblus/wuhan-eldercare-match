import directory from './directory.json'
// TEST_ONLY. Independent synthetic directory; never an Institution or Recommendation record.
// Names, nature and district assignments below are fictional test scenarios.
export type SearchCatalogNature = 'public' | 'public_built_private_operated' | 'private' | 'unknown'
export type SearchCatalogDistrict = 'jiangan' | 'jianghan' | 'qiaokou' | 'hanyang' | 'wuchang' | 'qingshan' | 'hongshan' | 'dongxihu' | 'hannan' | 'caidian' | 'jiangxia' | 'huangpi' | 'xinzhou' | 'unknown'

export interface SyntheticSearchCatalogRecord {
 readonly catalogId:string
 readonly displayName:string
 readonly city:'wuhan'
 readonly district:SearchCatalogDistrict
 readonly nature:SearchCatalogNature
 readonly sourceKind:'synthetic'
 readonly verification:'not_applicable_synthetic'
 readonly catalogRevision:number
}
export interface SearchCatalogOption<T> { readonly value:T; readonly label:string }
export interface SearchCatalogValidationIssue { readonly recordIndex:number; readonly code:string }
export type SearchCatalogValidation = {readonly ok:true} | {readonly ok:false;readonly errors:readonly SearchCatalogValidationIssue[]}
export type SearchCatalogReadResult = {readonly ok:true;readonly record:SyntheticSearchCatalogRecord} | {readonly ok:false;readonly code:'INVALID_CATALOG_ID' | 'CATALOG_NOT_FOUND'}

const natureOptions:readonly SearchCatalogOption<SearchCatalogNature>[] = Object.freeze([
 Object.freeze({value:'public' as SearchCatalogNature,label:'公办'}),
 Object.freeze({value:'public_built_private_operated' as SearchCatalogNature,label:'公建民营'}),
 Object.freeze({value:'private' as SearchCatalogNature,label:'民办'}),
 Object.freeze({value:'unknown' as SearchCatalogNature,label:'性质待确认'})
])
// Application enum keys, NOT official administrative codes. Administrative districts only.
const districtOptions:readonly SearchCatalogOption<SearchCatalogDistrict>[] = Object.freeze([
 Object.freeze({value:'jiangan' as SearchCatalogDistrict,label:'江岸区'}),
 Object.freeze({value:'jianghan' as SearchCatalogDistrict,label:'江汉区'}),
 Object.freeze({value:'qiaokou' as SearchCatalogDistrict,label:'硚口区'}),
 Object.freeze({value:'hanyang' as SearchCatalogDistrict,label:'汉阳区'}),
 Object.freeze({value:'wuchang' as SearchCatalogDistrict,label:'武昌区'}),
 Object.freeze({value:'qingshan' as SearchCatalogDistrict,label:'青山区'}),
 Object.freeze({value:'hongshan' as SearchCatalogDistrict,label:'洪山区'}),
 Object.freeze({value:'dongxihu' as SearchCatalogDistrict,label:'东西湖区'}),
 Object.freeze({value:'hannan' as SearchCatalogDistrict,label:'汉南区'}),
 Object.freeze({value:'caidian' as SearchCatalogDistrict,label:'蔡甸区'}),
 Object.freeze({value:'jiangxia' as SearchCatalogDistrict,label:'江夏区'}),
 Object.freeze({value:'huangpi' as SearchCatalogDistrict,label:'黄陂区'}),
 Object.freeze({value:'xinzhou' as SearchCatalogDistrict,label:'新洲区'}),
 Object.freeze({value:'unknown' as SearchCatalogDistrict,label:'区域待确认'})
])
const catalogInfo = Object.freeze({
 schemaVersion:'daqian-synthetic-search-catalog-v1',
 datasetRevision:1,
 city:'wuhan',
 cityLabel:'武汉市',
 sourceKind:'synthetic',
 verification:'not_applicable_synthetic',
 notice:'仅供小程序功能测试，不代表真实武汉养老机构。',
 districtDefinitionVersion:'wuhan-administrative-districts-20261021',
 districtKeyKind:'application_enum_not_administrative_code'
})
const idPattern = /^dq-search-synth-[a-z0-9]{4}$/
const recordKeys = Object.freeze(['catalogId','displayName','city','district','nature','sourceKind','verification','catalogRevision'])

// Validation never repairs absent/illegal values or infers nature/district from a name.
export function validateSyntheticSearchCatalog(input:unknown):SearchCatalogValidation {
 const issues:SearchCatalogValidationIssue[]=[]
 const issue=(recordIndex:number,code:string):void=>{issues.push(Object.freeze({recordIndex,code}))}
 if(!Array.isArray(input))return Object.freeze({ok:false,errors:Object.freeze([Object.freeze({recordIndex:-1,code:'INVALID_CATALOG'})])})
 const ids=new Set<string>()
 for(let index=0;index<input.length;index++){
  const value:unknown=input[index]
  if(!value||typeof value!=='object'||Array.isArray(value)){issue(index,'INVALID_RECORD');continue}
  const row=value as {[key:string]:unknown}
  if(Object.keys(row).length!==recordKeys.length||recordKeys.some(key=>!Object.prototype.hasOwnProperty.call(row,key)))issue(index,'INVALID_RECORD_SHAPE')
  if(typeof row.catalogId!=='string'||!idPattern.test(row.catalogId))issue(index,'INVALID_CATALOG_ID')
  else if(ids.has(row.catalogId))issue(index,'DUPLICATE_CATALOG_ID')
  else ids.add(row.catalogId)
  if(typeof row.displayName!=='string'||!/^虚构示例·\S.*$/.test(row.displayName)||row.displayName.trim()!==row.displayName)issue(index,'INVALID_DISPLAY_NAME')
  if(row.city!=='wuhan')issue(index,'INVALID_CITY')
  if(!districtOptions.some(option=>option.value===row.district))issue(index,'INVALID_DISTRICT')
  if(!natureOptions.some(option=>option.value===row.nature))issue(index,'INVALID_NATURE')
  if(row.sourceKind!=='synthetic')issue(index,'INVALID_PROVENANCE')
  if(row.verification!=='not_applicable_synthetic')issue(index,'INVALID_VERIFICATION')
  if(typeof row.catalogRevision!=='number'||!Number.isSafeInteger(row.catalogRevision)||row.catalogRevision<1)issue(index,'INVALID_CATALOG_REVISION')
 }
 return issues.length?Object.freeze({ok:false,errors:Object.freeze(issues)}):Object.freeze({ok:true})
}

// IDs are assigned literals. They are not generated from position, district or displayName.
const records:readonly SyntheticSearchCatalogRecord[] = Object.freeze(directory.map(row => Object.freeze({catalogId:row.catalogId,displayName:row.displayName,city:'wuhan' as const,district:row.district as SearchCatalogDistrict,nature:row.nature as SearchCatalogNature,sourceKind:'synthetic' as const,verification:'not_applicable_synthetic' as const,catalogRevision:row.catalogRevision})))
if(!validateSyntheticSearchCatalog(records).ok)throw new Error('INVALID_SYNTHETIC_SEARCH_CATALOG_FIXTURE')

export const readSyntheticSearchCatalog = ():readonly SyntheticSearchCatalogRecord[]=>records
export const readSearchCatalogNatureOptions = ():readonly SearchCatalogOption<SearchCatalogNature>[]=>natureOptions
export const readSearchCatalogDistrictOptions = ():readonly SearchCatalogOption<SearchCatalogDistrict>[]=>districtOptions
export const readSyntheticSearchCatalogInfo = ():Readonly<typeof catalogInfo>=>catalogInfo
export function readSyntheticSearchCatalogRecord(catalogId:unknown):SearchCatalogReadResult {
 if(typeof catalogId!=='string'||!idPattern.test(catalogId))return Object.freeze({ok:false,code:'INVALID_CATALOG_ID' as const})
 const record=records.find(row=>row.catalogId===catalogId)
 return record?Object.freeze({ok:true,record}):Object.freeze({ok:false,code:'CATALOG_NOT_FOUND' as const})
}
