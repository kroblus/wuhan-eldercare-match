import type { InstitutionField } from '../types/institution'
import type { InstitutionAddressV1, InstitutionEvidenceV121, InstitutionOfficialPhoneValueV1 } from '../types/institution-v1-2-1'
import type { DirectoryNature, PublicDirectoryEntry, SourcedValue } from './directory-data'
import { publicSources } from './sources'
import type { PublicSource, PublicSourceKey } from './sources'
import { reviewedDistricts } from './administrative-divisions'
import { createUnknownProductionRecord, unknownField } from './unknown-record'

export const buildPublicDirectoryEntry = (entry: PublicDirectoryEntry, sources: Record<PublicSourceKey, PublicSource> = publicSources) => {
  const district = reviewedDistricts.find(row => row.code === entry.districtCode)
  if (!district) throw new Error('Unsupported reviewed administrative district')
  const record = createUnknownProductionRecord(entry.institutionId, entry.recordRevision)
  const evidence: InstitutionEvidenceV121[] = [], natureEvidence: InstitutionEvidenceV121[] = []
  let sequence = 0
  const field = <T>(fieldPath: string, input: SourcedValue<T>, valueSnapshot: InstitutionEvidenceV121['valueSnapshot'], target = evidence): InstitutionField<T> => {
    // No partial fallback: required missing/unavailable/contradictory sources leave a fact unknown.
    if (!input.sources.length || input.sources.some(key => !sources[key] || sources[key].reviewState !== 'available')) return unknownField()
    const documents = input.sources.map(key => sources[key])
    const verifiedAt = documents.map(doc => doc.reviewedOn + 'T00:00:00.000Z').sort()[0]
    const validUntil = documents.map(doc => doc.validUntil).sort()[0]
    const ids: string[] = []
    documents.forEach(doc => {
      const evidenceId = `${entry.institutionId}-r${entry.recordRevision}-e${++sequence}`
      ids.push(evidenceId)
      target.push({ evidenceId, institutionId: entry.institutionId, recordRevision: entry.recordRevision,
        fieldPath, valueSnapshot, observedAt: verifiedAt, sourceType: 'official_document', sourceReference: doc.url,
        sourceNote: `${doc.publisher}｜${doc.title}｜发布：${doc.publishedOn || '未标注'}。${doc.publicationNote || ''}仅核对公开资料，未电话或现场确认，不证明当前能力、床位、合作或可预约。`,
        verificationStatus: 'verified', verifiedAt, validUntil })
    })
    return { availability: 'provided', value: input.value, asOf: verifiedAt, verification: { status: 'verified', evidenceIds: [ids[0], ...ids.slice(1)], verifiedAt, validUntil } }
  }
  record.identity.name = field('identity.name', entry.name, { valueType: 'text', value: entry.name.value })
  record.identity.regionCode = field('identity.regionCode', { value: district.code, sources: ['divisions'] }, { valueType: 'stable_code', value: district.code })
  record.identity.regionDisplayName = field('identity.regionDisplayName', { value: district.displayName, sources: entry.address.sources }, { valueType: 'text', value: district.displayName })
  const address: InstitutionAddressV1 = { countryCode: 'CN', province: { code: '420000', displayName: '湖北省' }, city: { code: '420100', displayName: '武汉市' }, district: { code: district.code, displayName: district.displayName }, addressLine: entry.address.value, postalCode: null }
  record.publicLocation.address = field('publicLocation.address', { value: address, sources: entry.address.sources }, { valueType: 'structured_address', value: address })
  if (entry.phone) {
    if (!/^[2-9]\d{7}$/.test(entry.phone.value)) throw new Error('Only reviewed Wuhan landlines may be imported')
    const phone: InstitutionOfficialPhoneValueV1 = { purpose: 'main', otherPurposeNote: null, number: { kind: 'mainland_landline', countryCallingCode: '+86', areaCode: '027', subscriberNumber: entry.phone.value, extension: null } }
    const phoneField = field('officialContact.officialPhones.main-office.phone', { value: phone, sources: entry.phone.sources }, { valueType: 'official_phone', value: phone })
    if (phoneField.availability === 'provided') {
      record.officialContact.phoneDirectoryPresence = field('officialContact.phoneDirectoryPresence', { value: 'present' as const, sources: entry.phone.sources }, { valueType: 'stable_code', value: 'present' })
      record.officialContact.officialPhones = [{ officialPhoneKey: 'main-office', phone: phoneField }]
    }
  }
  // Ownership evidence stays outside the Frozen Institution record and recommendation inputs.
  const nature: InstitutionField<DirectoryNature> = entry.nature
    ? field('directory.nature', entry.nature, { valueType: 'stable_code', value: entry.nature.value }, natureEvidence) : unknownField()
  record.evidence = evidence
  return { record, nature, natureEvidence }
}

export const isCurrentPublicField = <T>(institutionId: string, recordRevision: number, fieldPath: string, fact: InstitutionField<T>, evidence: readonly InstitutionEvidenceV121[], asOf = Date.now()): boolean => {
  if (fact.availability !== 'provided' || fact.verification.status !== 'verified' || !fact.verification.evidenceIds.length) return false
  const verified = Date.parse(fact.verification.verifiedAt), until = Date.parse(fact.verification.validUntil || '')
  if (!Number.isFinite(verified) || !Number.isFinite(until) || verified > asOf || until < asOf) return false
  return fact.verification.evidenceIds.every(id => evidence.some(item => item.evidenceId === id
    && item.institutionId === institutionId && item.recordRevision === recordRevision && item.fieldPath === fieldPath
    && item.verificationStatus === 'verified' && Date.parse(item.verifiedAt) <= asOf && Date.parse(item.validUntil || '') >= asOf
    && JSON.stringify(item.valueSnapshot.value) === JSON.stringify(fact.value)))
}
