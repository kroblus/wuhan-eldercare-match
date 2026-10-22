import type {
  InstitutionAvailabilityFact,
  InstitutionRecord,
} from '../../types/institution'
import type {
  ElderEvidenceRef,
  RecommendationAdvisoryAttachment,
  RecommendationAdvisoryInput,
  RecommendationError,
  RecommendationEvaluationResult,
  InstitutionAdvisoryEvidenceRef,
} from '../../types/recommendation'
import { isValidIsoTimestamp } from '../institution/primitives'
import { isVerificationCurrentAt } from '../institution/verification'
import { validateInstitutionRecord } from '../institution/validate-institution'
import { validateAndSnapshotProfile } from './profile'
import { compareAscii, copyDomainData, isNonEmptyString, isPlainRecord, sortAscii } from './rules'

const makeError = (code: RecommendationError['code'], paths: readonly string[]): RecommendationError => ({
  code,
  paths: paths.length > 0 ? sortAscii(paths, (path) => path) : ['$'],
})

const depositEvidenceRef = (profile: RecommendationAdvisoryInput['profile']): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.depositTolerance',
  sourceQuestionId: 'budget.upfrontCostAcceptance',
  valueSnapshot: profile.financial.rawFacts.depositTolerance,
})

const depositNeedsInquiry = (record: InstitutionRecord, evaluationAsOf: string): boolean =>
  record.price.deposit.availability !== 'provided'
    || !isVerificationCurrentAt(record.price.deposit.verification, evaluationAsOf)

const feeNeedsInquiry = (
  record: InstitutionRecord,
  feeIndex: number,
  evaluationAsOf: string,
): boolean => {
  const fee = record.price.oneTimeFees[feeIndex]
  return fee.referenceAmount.availability !== 'provided'
    || !isVerificationCurrentAt(fee.referenceAmount.verification, evaluationAsOf)
}

const availabilityNeedsDisplayAdvisory = (
  fact: InstitutionAvailabilityFact,
  evaluationAsOf: string,
): boolean => fact.status !== 'available'
  && fact.status !== 'limited'
  || !isVerificationCurrentAt(fact.verification, evaluationAsOf)

const makeDepositAttachment = (
  profile: RecommendationAdvisoryInput['profile'],
  record: InstitutionRecord,
  evaluationAsOf: string,
): RecommendationAdvisoryAttachment => ({
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  advisoryCode: 'UPFRONT_COST_NEEDS_INQUIRY',
  advisoryCategory: 'OPERATIONAL_ADVISORY',
  severity: 'advisory',
  elderEvidenceRefs: [depositEvidenceRef(profile)],
  advisoryEvidenceRefs: [{
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    evaluationAsOf,
    evidenceIds: sortAscii(record.price.deposit.verification.evidenceIds, (id) => id),
    fieldPath: 'price.deposit',
    snapshot: record.price.deposit,
  }],
})

const makeFeeAttachment = (
  profile: RecommendationAdvisoryInput['profile'],
  record: InstitutionRecord,
  feeIndex: number,
  evaluationAsOf: string,
): RecommendationAdvisoryAttachment => {
  const fee = record.price.oneTimeFees[feeIndex]
  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    advisoryCode: 'UPFRONT_COST_NEEDS_INQUIRY',
    advisoryCategory: 'OPERATIONAL_ADVISORY',
    severity: 'advisory',
    elderEvidenceRefs: [depositEvidenceRef(profile)],
    advisoryEvidenceRefs: [{
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      evaluationAsOf,
      evidenceIds: sortAscii(fee.referenceAmount.verification.evidenceIds, (id) => id),
      fieldPath: 'price.oneTimeFees',
      scope: 'fee_amount',
      feeId: fee.feeId,
      snapshot: fee.referenceAmount,
    }],
  }
}

const makeFeeListPresenceAttachment = (
  profile: RecommendationAdvisoryInput['profile'],
  record: InstitutionRecord,
  evaluationAsOf: string,
): RecommendationAdvisoryAttachment => {
  const evidenceRef: InstitutionAdvisoryEvidenceRef = {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    evaluationAsOf,
    evidenceIds: [],
    fieldPath: 'price.oneTimeFees',
    scope: 'list_presence',
    snapshot: record.price.oneTimeFees,
  }
  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    advisoryCode: 'UPFRONT_COST_NEEDS_INQUIRY',
    advisoryCategory: 'OPERATIONAL_ADVISORY',
    severity: 'advisory',
    elderEvidenceRefs: [depositEvidenceRef(profile)],
    advisoryEvidenceRefs: [evidenceRef],
  }
}

const makeAvailabilityAttachment = (
  record: InstitutionRecord,
  evaluationAsOf: string,
): RecommendationAdvisoryAttachment => ({
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  advisoryCode: 'AVAILABILITY_DISPLAY_ONLY',
  advisoryCategory: 'OPERATIONAL_ADVISORY',
  severity: 'advisory',
  elderEvidenceRefs: [],
  advisoryEvidenceRefs: [{
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    evaluationAsOf,
    evidenceIds: sortAscii(record.operations.bedAvailability.verification.evidenceIds, (id) => id),
    fieldPath: 'operations.bedAvailability',
    snapshot: record.operations.bedAvailability,
  }],
})

const sortAttachments = (attachments: readonly RecommendationAdvisoryAttachment[]): RecommendationAdvisoryAttachment[] =>
  attachments.slice().sort((left, right) => {
    const idResult = compareAscii(left.institutionId, right.institutionId)
    if (idResult !== 0) return idResult
    const codeResult = compareAscii(left.advisoryCode, right.advisoryCode)
    if (codeResult !== 0) return codeResult
    const leftRef = left.advisoryEvidenceRefs[0]
    const rightRef = right.advisoryEvidenceRefs[0]
    const leftPath = leftRef === undefined ? '' : leftRef.fieldPath
    const rightPath = rightRef === undefined ? '' : rightRef.fieldPath
    const pathResult = compareAscii(leftPath, rightPath)
    if (pathResult !== 0) return pathResult
    if (leftRef !== undefined && rightRef !== undefined
      && leftRef.fieldPath === 'price.oneTimeFees'
      && rightRef.fieldPath === 'price.oneTimeFees'
      && leftRef.scope === 'fee_amount'
      && rightRef.scope === 'fee_amount') {
      return compareAscii(leftRef.feeId, rightRef.feeId)
    }
    return 0
  })

export const buildRecommendationAdvisories = (
  input: RecommendationAdvisoryInput,
): RecommendationEvaluationResult<readonly RecommendationAdvisoryAttachment[]> => {
  if (!isPlainRecord(input) || !isPlainRecord(input.profile)) {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', ['profile']) }
  }
  const expectedKind = input.profile.kind === 'elder_profile_preview'
    ? 'elder_profile_preview'
    : input.profile.kind === 'elder_profile' ? 'elder_profile' : null
  if (expectedKind === null) {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', ['profile.kind']) }
  }
  const profileResult = validateAndSnapshotProfile(input.profile, expectedKind)
  if (!profileResult.ok) {
    return profileResult
  }
  if (!isNonEmptyString(input.evaluationAsOf) || !isValidIsoTimestamp(input.evaluationAsOf)) {
    return { ok: false, error: makeError('INVALID_EVALUATION_AS_OF', ['evaluationAsOf']) }
  }
  if (!Array.isArray(input.institutions)) {
    return { ok: false, error: makeError('INVALID_INPUT', ['institutions']) }
  }
  const records: InstitutionRecord[] = []
  const issues: string[] = []
  input.institutions.forEach((record, index) => {
    const validation = validateInstitutionRecord(record)
    if (!validation.ok) {
      validation.issues.forEach((issue) => issues.push(`institutions[${index}].${issue.path}`))
      return
    }
    records.push(validation.value)
  })
  if (issues.length > 0) {
    return { ok: false, error: makeError('INVALID_INSTITUTION_RECORD', issues) }
  }
  const ids = records.map((record) => record.institutionId)
  if (ids.some((id, index) => ids.indexOf(id) !== index)) {
    return { ok: false, error: makeError('DUPLICATE_INSTITUTION_ID', ids) }
  }
  const profile = profileResult.value.profile as RecommendationAdvisoryInput['profile']
  const attachments: RecommendationAdvisoryAttachment[] = []
  records.slice().sort((left, right) => compareAscii(left.institutionId, right.institutionId)).forEach((record) => {
    if (depositNeedsInquiry(record, input.evaluationAsOf)) {
      attachments.push(makeDepositAttachment(profile, record, input.evaluationAsOf))
    }
    if (record.price.oneTimeFees.length === 0) {
      attachments.push(makeFeeListPresenceAttachment(profile, record, input.evaluationAsOf))
    } else {
      record.price.oneTimeFees.forEach((_fee, index) => {
        if (feeNeedsInquiry(record, index, input.evaluationAsOf)) {
          attachments.push(makeFeeAttachment(profile, record, index, input.evaluationAsOf))
        }
      })
    }
    if (availabilityNeedsDisplayAdvisory(record.operations.bedAvailability, input.evaluationAsOf)) {
      attachments.push(makeAvailabilityAttachment(record, input.evaluationAsOf))
    }
  })
  return { ok: true, value: copyDomainData(sortAttachments(attachments)) }
}
