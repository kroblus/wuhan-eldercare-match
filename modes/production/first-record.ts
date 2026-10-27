
import type { InstitutionAddressV1, InstitutionOfficialPhoneValueV1, InstitutionEvidenceV121 } from '../types/institution-v1-2-1'
import type { InstitutionField } from '../types/institution'
import { createUnknownProductionRecord } from './unknown-record'

export const firstInstitutionId = 'wh-social-welfare-institute'
export const verificationDate = '2026-10-22T00:00:00.000Z'
const profileSource = 'https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/jgjj/jgsz/xsjg/201912/t20191220_255274.shtml'
const registrySource = 'https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/qtzdgknr/ssj/202401/t20240104_2335959.shtml'
const divisionSource = 'https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/'
// Internal 90-day recheck horizon, not a government guarantee of future accuracy.
const validUntil = '2027-01-20T23:59:59.000Z'
export const createFirstRecord = () => {
  const record = createUnknownProductionRecord(firstInstitutionId, 1)
  const evidence: InstitutionEvidenceV121[] = []
  const field = <T>(fieldPath: string, value: T, valueSnapshot: InstitutionEvidenceV121['valueSnapshot'], sourceReference = profileSource): InstitutionField<T> => {
    const evidenceId = 'wh-swi-r1-' + (evidence.length + 1)
    evidence.push({ evidenceId, institutionId: firstInstitutionId, recordRevision: 1, fieldPath, valueSnapshot, observedAt: verificationDate,
      sourceType: 'official_document', sourceReference, sourceNote: '公开政府页面逐项核对；仅证明所列公开资料，未进行电话或现场确认，不证明服务能力、合作或预约开放。',
      verificationStatus: 'verified', verifiedAt: verificationDate, validUntil })
    return { availability: 'provided', value, asOf: verificationDate, verification: { status: 'verified', evidenceIds: [evidenceId], verifiedAt: verificationDate, validUntil } }
  }
  record.identity.name = field('identity.name', '武汉市社会福利院', { valueType: 'text', value: '武汉市社会福利院' })
  record.identity.regionCode = field('identity.regionCode', '420103', { valueType: 'stable_code', value: '420103' }, divisionSource)
  record.identity.regionDisplayName = field('identity.regionDisplayName', '江汉区', { valueType: 'text', value: '江汉区' }, registrySource)
  const address: InstitutionAddressV1 = { countryCode: 'CN', province: { code: '420000', displayName: '湖北省' }, city: { code: '420100', displayName: '武汉市' }, district: { code: '420103', displayName: '江汉区' }, addressLine: '发展大道198号', postalCode: null }
  record.publicLocation.address = field('publicLocation.address', address, { valueType: 'structured_address', value: address })
  record.officialContact.phoneDirectoryPresence = field('officialContact.phoneDirectoryPresence', 'present', { valueType: 'stable_code', value: 'present' })
  const phone: InstitutionOfficialPhoneValueV1 = { purpose: 'main', otherPurposeNote: null, number: { kind: 'mainland_landline', countryCallingCode: '+86', areaCode: '027', subscriberNumber: '85872325', extension: null } }
  record.officialContact.officialPhones = [{ officialPhoneKey: 'main-office', phone: field('officialContact.officialPhones.main-office.phone', phone, { valueType: 'official_phone', value: phone }) }]
  record.evidence = evidence
  return record
}
