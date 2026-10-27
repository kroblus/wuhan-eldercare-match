import type { InstitutionCapabilityStatus, InstitutionEvidenceSourceType, InstitutionVerificationStatus } from '../types/institution'
import type { InstitutionRecordV121, InstitutionEvidenceV121 } from '../types/institution-v1-2-1'
import { INSTITUTION_CARE_LEVEL_CODES, INSTITUTION_MOBILITY_CAPABILITY_CODES, INSTITUTION_COGNITIVE_CAPABILITY_CODES, INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES, INSTITUTION_REHABILITATION_FEATURE_CODES } from '../domain/institution/rules'
import { isValidIsoTimestamp } from '../domain/institution/primitives'
import { validateInstitutionRecordV121 } from '../domain/institution/v1-2-1/validate-institution-v1-2-1'
import { administrativeDivisionResolver } from './administrative-divisions'

// Import metadata only. PUBLIC_DOCUMENT_REVIEW_ONLY is not a Domain enum.
export interface CapabilitySource {
  institutionIds: readonly string[]
  title: string; publisher: string; url: string; publishedOn: string | null
  publicationNote?: string; reviewedOn: string; reviewDueOn: string
  reviewState: 'available' | 'unavailable' | 'conflicting'
  sourceType: InstitutionEvidenceSourceType
}
export interface CapabilityEvidenceRow {
  disposition?: 'publish' | 'withdraw_to_unknown'
  fieldPath: string; status: InstitutionCapabilityStatus
  verificationStatus: InstitutionVerificationStatus
  valueSnapshot: { valueType: 'stable_code'; value: InstitutionCapabilityStatus }
  sourceKeys: readonly string[]; originalStatement: string
  basis: 'direct_current_statement' | 'general_description' | 'historical_program' | 'not_stated'
  verifiedAt?: string; validUntil?: string
  question: string
}
export interface CapabilityRevisionChange {
  institutionId: string; parentRevision: number; recordRevision: number
  reviewMethod: 'PUBLIC_DOCUMENT_REVIEW_ONLY'
  rows: readonly CapabilityEvidenceRow[]
}
export const capabilityFieldPaths: readonly string[] = [
  ...INSTITUTION_CARE_LEVEL_CODES.map(code => `capabilities.careLevelAcceptance.${code}`),
  ...INSTITUTION_MOBILITY_CAPABILITY_CODES.map(code => `capabilities.mobilitySupport.${code}`),
  ...INSTITUTION_COGNITIVE_CAPABILITY_CODES.map(code => `capabilities.cognitiveSupport.${code}`),
  ...INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES.map(code => `capabilities.specialCare.${code}`),
  ...INSTITUTION_REHABILITATION_FEATURE_CODES.map(code => `rehabilitationSupport.features.${code}`),
]
const validDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && isValidIsoTimestamp(day + 'T00:00:00.000Z')
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const validateCapabilityRow = (row: CapabilityEvidenceRow, sources: Readonly<Record<string, CapabilitySource>>): string[] => {
  const issues: string[] = []
  if (capabilityFieldPaths.indexOf(row.fieldPath) < 0) issues.push('INVALID_FIELD_PATH')
  if (!['supported', 'requires_assessment', 'unsupported', 'unknown'].includes(row.status)
    || row.valueSnapshot.valueType !== 'stable_code' || row.valueSnapshot.value !== row.status) issues.push('VALUE_SNAPSHOT_MISMATCH')
  // An explicit successor may withdraw an earlier conclusion after an outage
  // or conflict. This is not publication of an unverified claim, and creates
  // neither a new verification date nor new evidence of service support.
  if (row.disposition === 'withdraw_to_unknown') {
    if (row.status !== 'unknown' || row.verificationStatus !== 'unverified' || !row.originalStatement.trim()
      || row.verifiedAt !== undefined || row.validUntil !== undefined || row.sourceKeys.length) issues.push('INVALID_WITHDRAWAL')
    return issues
  }
  if (!row.originalStatement.trim() || !row.sourceKeys.length || new Set(row.sourceKeys).size !== row.sourceKeys.length) issues.push('MISSING_OR_DUPLICATE_SOURCE')
  for (const key of row.sourceKeys) {
    const source = sources[key]
    if (!source) { issues.push('SOURCE_NOT_FOUND'); continue }
    if (!/^https:\/\//.test(source.url) || !source.publisher.trim() || !source.title.trim()) issues.push('INVALID_SOURCE')
    if (!source.publishedOn || !validDay(source.publishedOn)) issues.push('PUBLICATION_DATE_UNCONFIRMED')
    if (!validDay(source.reviewedOn) || !validDay(source.reviewDueOn) || source.reviewDueOn < source.reviewedOn
      || source.publishedOn && source.publishedOn > source.reviewedOn) issues.push('INVALID_SOURCE_DATES')
    if (source.reviewState !== 'available') issues.push(source.reviewState === 'conflicting' ? 'SOURCE_CONFLICT' : 'SOURCE_UNAVAILABLE')
    if (!['official_document', 'institution_provided'].includes(source.sourceType)) issues.push('NOT_PUBLIC_DOCUMENT_REVIEW')
    if (row.verifiedAt && row.verifiedAt.slice(0, 10) !== source.reviewedOn) issues.push('REVIEW_DATE_MISMATCH')
    if (row.validUntil && row.validUntil.slice(0, 10) > source.reviewDueOn) issues.push('RECHECK_DEADLINE_EXCEEDED')
  }
  if (row.status === 'unknown' || row.verificationStatus === 'unverified' || row.basis !== 'direct_current_statement') issues.push('PENDING_REVIEW_ONLY')
  if (!row.verifiedAt || !isValidIsoTimestamp(row.verifiedAt) || !row.validUntil || !isValidIsoTimestamp(row.validUntil)
    || row.validUntil < row.verifiedAt) issues.push('INVALID_VERIFICATION_DATES')
  if (!['verified', 'expired', 'unverified'].includes(row.verificationStatus)) issues.push('INVALID_VERIFICATION_STATUS')
  return Array.from(new Set(issues))
}

// Create a successor, never edit the parent. Inherited evidence is rebound to
// the successor with its original observation/review times and typed values.
export const buildCapabilityRevision = (parent: InstitutionRecordV121, change: CapabilityRevisionChange, sources: Readonly<Record<string, CapabilitySource>>) => {
  const issues: string[] = []
  if (parent.institutionId !== change.institutionId || parent.recordRevision !== change.parentRevision
    || !Number.isSafeInteger(change.recordRevision) || change.recordRevision <= change.parentRevision) issues.push('INVALID_PARENT_IDENTITY')
  if (change.reviewMethod !== 'PUBLIC_DOCUMENT_REVIEW_ONLY' || !change.rows.length) issues.push('INVALID_REVIEW_CHANGE')
  if (!validateInstitutionRecordV121(parent, { administrativeDivisionResolver }).ok) issues.push('INVALID_PARENT_RECORD')
  const paths = change.rows.map(row => row.fieldPath)
  if (new Set(paths).size !== paths.length) issues.push('DUPLICATE_FIELD')
  change.rows.forEach(row => issues.push(...validateCapabilityRow(row, sources)))
  change.rows.forEach(row => row.sourceKeys.forEach(key => {
    if (sources[key] && sources[key].institutionIds.indexOf(change.institutionId) < 0) issues.push('SOURCE_INSTITUTION_MISMATCH')
  }))
  if (issues.length) return { ok: false as const, issues: Array.from(new Set(issues)) }
  const record = copy(parent)
  record.recordRevision = change.recordRevision
  const ids = new Map(record.evidence.map((item, index) => [item.evidenceId, `${record.institutionId}-r${record.recordRevision}-inherited-${index + 1}`]))
  const rebind = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(rebind); return }
    const object = value as Record<string, unknown>
    if (Array.isArray(object.evidenceIds)) object.evidenceIds = object.evidenceIds.map(id => ids.get(id as string) || id)
    Object.values(object).forEach(rebind)
  }
  rebind(record)
  const evidence: InstitutionEvidenceV121[] = record.evidence.filter(item => paths.indexOf(item.fieldPath) < 0)
    .map(item => ({ ...item, evidenceId: ids.get(item.evidenceId)!, recordRevision: record.recordRevision }))
  change.rows.forEach((row, rowIndex) => {
    const [root, group, code] = row.fieldPath.split('.')
    const target = root === 'capabilities' ? record.capabilities[group as keyof typeof record.capabilities] : record.rehabilitationSupport.features
    if (row.disposition === 'withdraw_to_unknown') {
      ;(target as unknown as Record<string, unknown>)[code] = { code, status: 'unknown', verification: { status: 'unverified', evidenceIds: [] } }
      return
    }
    const evidenceIds = row.sourceKeys.map((key, sourceIndex) => {
      const source = sources[key], evidenceId = `${record.institutionId}-r${record.recordRevision}-cap-${rowIndex + 1}-${sourceIndex + 1}`
      evidence.push({ evidenceId, institutionId: record.institutionId, recordRevision: record.recordRevision,
        fieldPath: row.fieldPath, valueSnapshot: copy(row.valueSnapshot), observedAt: row.verifiedAt!,
        sourceType: source.sourceType, sourceReference: source.url,
        sourceNote: `${source.publisher}｜${source.title}｜发布：${source.publishedOn}｜PUBLIC_DOCUMENT_REVIEW_ONLY。${row.originalStatement}。复核期限为内部资料检查期限，不是服务承诺。`,
        verificationStatus: row.verificationStatus as 'verified' | 'expired', verifiedAt: row.verifiedAt!, validUntil: row.validUntil! })
      return evidenceId
    })
    ;(target as unknown as Record<string, unknown>)[code] = { code, status: row.status, asOf: row.verifiedAt,
      verification: { status: row.verificationStatus, evidenceIds, verifiedAt: row.verifiedAt, validUntil: row.validUntil } }
  })
  record.evidence = evidence
  if (!validateInstitutionRecordV121(record, { administrativeDivisionResolver }).ok) return { ok: false as const, issues: ['INVALID_SUCCESSOR_RECORD'] }
  return { ok: true as const, record }
}

export const buildCapabilityHistory = (base: readonly InstitutionRecordV121[], changes: readonly CapabilityRevisionChange[], sources: Readonly<Record<string, CapabilitySource>>) => {
  const records = base.map(copy), current = base.map(record => ({ institutionId: record.institutionId, recordRevision: record.recordRevision }))
  if (new Set(current.map(row => row.institutionId)).size !== current.length) throw Error('Duplicate production identity')
  for (const change of changes) {
    const pointer = current.find(row => row.institutionId === change.institutionId)
    const parent = records.find(row => row.institutionId === change.institutionId && row.recordRevision === change.parentRevision)
    if (!pointer || !parent || pointer.recordRevision !== change.parentRevision || records.some(row => row.institutionId === change.institutionId && row.recordRevision === change.recordRevision)) throw Error('Invalid production revision lineage')
    const next = buildCapabilityRevision(parent, change, sources)
    if (!next.ok) throw Error('Invalid production capability evidence: ' + next.issues.join(','))
    records.push(next.record); pointer.recordRevision = change.recordRevision
  }
  return { records, currentPointers: current, currentRecords: current.map(pointer => records.find(row => row.institutionId === pointer.institutionId && row.recordRevision === pointer.recordRevision)!) }
}
