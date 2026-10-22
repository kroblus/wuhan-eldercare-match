import type {
  InstitutionCapability,
  InstitutionEffectiveCapabilityStatus,
  InstitutionEvidence,
  InstitutionEvidenceValueSnapshot,
  InstitutionField,
  InstitutionFieldVerification,
  InstitutionMatchingCriticalFieldPath,
  InstitutionRecord,
  InstitutionTypeCode,
  ReferenceMonthlyPrice,
} from '../../types/institution'
import type {
  RecommendationDatasetMode,
  RecommendationError,
  RecommendationInstitutionEvidenceSnapshot,
  RecommendationPoolManifest,
  RecommendationPoolManifestEntry,
  InstitutionEffectiveEvidenceRef,
} from '../../types/recommendation'
import {
  resolveEffectiveCapability,
  resolveEffectiveInstitutionField,
} from '../institution/verification'
import { validateInstitutionRecord } from '../institution/validate-institution'
import { compareIsoTimestamps, isValidIsoTimestamp } from '../institution/primitives'
import {
  compareAscii,
  copyDomainData,
  isMatchingFieldPath,
  isNonEmptyString,
  RECOMMENDATION_MATCHING_FIELD_PATHS,
  sortAscii,
} from './rules'

/*
 * This module is deliberately the only place where a raw InstitutionRecord
 * crosses into the recommendation core.  Keeping the projection small makes
 * it difficult for a future reason/ranking change to accidentally consume a
 * display, operational, or media field.
 */

export interface EffectiveInstitutionFacts {
  institutionId: string
  recordRevision: number
  matchingFields: readonly InstitutionEffectiveEvidenceRef[]
  manifestEntry: RecommendationPoolManifestEntry
}

export interface ValidatedInstitutionPool {
  facts: readonly EffectiveInstitutionFacts[]
  manifest: RecommendationPoolManifest
}

interface RawMatchingValue {
  rawSnapshot: InstitutionEvidenceValueSnapshot | null
  effectiveSnapshot: InstitutionEvidenceValueSnapshot | null
  effectiveCapabilityStatus?: InstitutionEffectiveCapabilityStatus
  verification: InstitutionFieldVerification
}

const makeError = (code: RecommendationError['code'], paths: readonly string[]): RecommendationError => ({
  code,
  paths: paths.length > 0 ? sortAscii(paths, (path) => path) : ['$'],
})

const isRecordArray = (value: unknown): value is readonly unknown[] => Array.isArray(value)

const capabilityPath = (path: InstitutionMatchingCriticalFieldPath): boolean =>
  path.indexOf('capabilities.') === 0

const pathIs = <P extends InstitutionMatchingCriticalFieldPath>(
  path: InstitutionMatchingCriticalFieldPath,
  expected: P,
): path is P => path === expected

const fieldAtPath = (
  record: InstitutionRecord,
  path: InstitutionMatchingCriticalFieldPath,
): InstitutionField<unknown> | InstitutionCapability<string> => {
  if (pathIs(path, 'identity.regionCode')) {
    return record.identity.regionCode
  }
  if (pathIs(path, 'typeProfile.supportedTypes')) {
    return record.typeProfile.supportedTypes as InstitutionField<unknown>
  }
  if (pathIs(path, 'price.referenceMonthlyPrice')) {
    return record.price.referenceMonthlyPrice as InstitutionField<unknown>
  }
  if (path.indexOf('capabilities.careLevelAcceptance.') === 0) {
    const code = path.slice('capabilities.careLevelAcceptance.'.length)
    return record.capabilities.careLevelAcceptance[code as keyof typeof record.capabilities.careLevelAcceptance]
  }
  if (path.indexOf('capabilities.mobilitySupport.') === 0) {
    const code = path.slice('capabilities.mobilitySupport.'.length)
    return record.capabilities.mobilitySupport[code as keyof typeof record.capabilities.mobilitySupport]
  }
  if (path.indexOf('capabilities.cognitiveSupport.') === 0) {
    const code = path.slice('capabilities.cognitiveSupport.'.length)
    return record.capabilities.cognitiveSupport[code as keyof typeof record.capabilities.cognitiveSupport]
  }
  const code = path.slice('capabilities.specialCare.'.length)
  return record.capabilities.specialCare[code as keyof typeof record.capabilities.specialCare]
}

const asStableCodeList = (value: readonly InstitutionTypeCode[]): readonly [InstitutionTypeCode, ...InstitutionTypeCode[]] =>
  value.slice() as unknown as readonly [InstitutionTypeCode, ...InstitutionTypeCode[]]

const makeSnapshot = (
  path: InstitutionMatchingCriticalFieldPath,
  value: unknown,
): InstitutionEvidenceValueSnapshot => {
  if (path === 'identity.regionCode') {
    return { valueType: 'stable_code', value: value as string }
  }
  if (path === 'typeProfile.supportedTypes') {
    return { valueType: 'stable_code_list', value: asStableCodeList(value as readonly InstitutionTypeCode[]) }
  }
  if (path === 'price.referenceMonthlyPrice') {
    return { valueType: 'reference_monthly_price', value: copyDomainData(value as ReferenceMonthlyPrice) }
  }
  return { valueType: 'stable_code', value: value as string }
}

const projectionReason = (
  field: InstitutionField<unknown> | InstitutionCapability<string>,
  evaluationAsOf: string,
  effectiveCapabilityStatus?: InstitutionEffectiveCapabilityStatus,
): InstitutionEffectiveEvidenceRef['projectionReason'] => {
  if ('availability' in field && field.availability !== 'provided') {
    return 'raw_field_unavailable'
  }
  if (effectiveCapabilityStatus === 'unknown' && 'status' in field && field.status === 'unknown') {
    return 'raw_value_unknown'
  }
  if (field.verification.status === 'unverified') {
    return 'raw_value_unverified'
  }
  if (field.verification.status === 'expired') {
    return 'raw_value_expired'
  }
  const verifiedAt = 'verifiedAt' in field.verification ? field.verification.verifiedAt : undefined
  const validUntil = 'validUntil' in field.verification ? field.verification.validUntil : undefined
  if (verifiedAt !== undefined && compareIsoTimestamps(verifiedAt, evaluationAsOf) > 0) {
    return 'verification_in_future'
  }
  if (validUntil !== undefined && compareIsoTimestamps(validUntil, evaluationAsOf) < 0) {
    return 'raw_value_past_valid_until'
  }
  if (effectiveCapabilityStatus === 'unknown') {
    return 'raw_value_unknown'
  }
  return 'raw_value_currently_verified'
}

const rawMatchingValueAt = (
  record: InstitutionRecord,
  path: InstitutionMatchingCriticalFieldPath,
  evaluationAsOf: string,
): RawMatchingValue => {
  const field = fieldAtPath(record, path)
  if (capabilityPath(path)) {
    const capability = field as InstitutionCapability<string>
    const effective = resolveEffectiveCapability(capability.status, capability.verification, evaluationAsOf)
    return {
      rawSnapshot: makeSnapshot(path, capability.status),
      effectiveSnapshot: makeSnapshot(path, effective),
      effectiveCapabilityStatus: effective,
      verification: capability.verification,
    }
  }

  const ordinaryField = field as InstitutionField<unknown>
  const effective = resolveEffectiveInstitutionField(ordinaryField, evaluationAsOf)
  const absent = ordinaryField.availability !== 'provided'
  return {
    rawSnapshot: absent ? null : makeSnapshot(path, ordinaryField.value),
    effectiveSnapshot: effective.availability === 'provided'
      ? makeSnapshot(path, effective.value)
      : null,
    verification: ordinaryField.verification,
  }
}

const makeMatchingRef = (
  record: InstitutionRecord,
  path: InstitutionMatchingCriticalFieldPath,
  evaluationAsOf: string,
): InstitutionEffectiveEvidenceRef => {
  const field = fieldAtPath(record, path)
  const projection = rawMatchingValueAt(record, path, evaluationAsOf)
  const evidenceIds = sortAscii(field.verification.evidenceIds, (id) => id)
  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    fieldPath: path,
    rawSnapshot: projection.rawSnapshot,
    effectiveSnapshot: projection.effectiveSnapshot,
    projectionReason: projectionReason(field, evaluationAsOf, projection.effectiveCapabilityStatus),
    evidenceIds,
    verificationStatus: field.verification.status,
    ...(field.verification.status === 'unverified' ? {} : { verifiedAt: field.verification.verifiedAt }),
    ...(field.verification.status === 'verified' && field.verification.validUntil === undefined
      ? {}
      : field.verification.status === 'unverified'
        ? {}
        : { validUntil: field.verification.validUntil }),
    evaluationAsOf,
  }
}

const toManifestEvidence = (
  evidence: InstitutionEvidence,
): RecommendationInstitutionEvidenceSnapshot => ({
  evidenceId: evidence.evidenceId,
  institutionId: evidence.institutionId,
  recordRevision: evidence.recordRevision,
  fieldPath: evidence.fieldPath,
  valueSnapshot: copyDomainData(evidence.valueSnapshot),
  sourceType: evidence.sourceType,
  ...(evidence.observedAt === undefined ? {} : { observedAt: evidence.observedAt }),
  verificationStatus: evidence.verificationStatus,
  ...(evidence.verifiedAt === undefined ? {} : { verifiedAt: evidence.verifiedAt }),
  ...(evidence.validUntil === undefined ? {} : { validUntil: evidence.validUntil }),
})

const buildManifestEntry = (
  record: InstitutionRecord,
  datasetMode: RecommendationDatasetMode,
  evaluationAsOf: string,
): { facts: EffectiveInstitutionFacts, entry: RecommendationPoolManifestEntry } => {
  const matchingFields = RECOMMENDATION_MATCHING_FIELD_PATHS.map((path) =>
    makeMatchingRef(record, path, evaluationAsOf))
  const selectedEvidenceIds: string[] = []
  matchingFields.forEach((field) => field.evidenceIds.forEach((evidenceId) => {
    if (selectedEvidenceIds.indexOf(evidenceId) < 0) {
      selectedEvidenceIds.push(evidenceId)
    }
  }))
  const evidenceById = new Map(record.evidence.map((entry) => [entry.evidenceId, entry]))
  const manifestEvidence = sortAscii(
    selectedEvidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((entry): entry is InstitutionEvidence => entry !== undefined)
      .map(toManifestEvidence),
    (entry) => entry.evidenceId,
  )
  const exclusionReason = record.recordStatus !== 'published'
    ? 'RECORD_NOT_PUBLISHED'
    : datasetMode === 'PRODUCTION' && record.recordProvenance !== 'PRODUCTION_CANDIDATE'
      ? 'MOCK_DATA_NOT_PRODUCTION'
      : datasetMode === 'MOCK_DEVELOPMENT_ONLY' && record.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY'
        ? 'NON_MOCK_DATA_IN_SYNTHETIC_MODE'
        : undefined
  const entry: RecommendationPoolManifestEntry = exclusionReason === undefined
    ? {
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      recordProvenance: record.recordProvenance,
      recordStatus: record.recordStatus,
      disposition: 'included',
      matchingFields,
      evidence: manifestEvidence,
    }
    : {
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      recordProvenance: record.recordProvenance,
      recordStatus: record.recordStatus,
      disposition: 'excluded',
      exclusionReasonCode: exclusionReason,
      matchingFields,
      evidence: manifestEvidence,
    }
  return {
    entry,
    facts: {
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      matchingFields,
      manifestEntry: entry,
    },
  }
}

const validatePoolArguments = (
  institutions: unknown,
  datasetVersion: unknown,
  datasetMode: unknown,
  evaluationAsOf: unknown,
): RecommendationError | null => {
  if (!isRecordArray(institutions)) {
    return makeError('INVALID_DATASET', ['institutions'])
  }
  if (!isNonEmptyString(datasetVersion)) {
    return makeError('INVALID_DATASET', ['datasetVersion'])
  }
  if (datasetMode !== 'PRODUCTION' && datasetMode !== 'MOCK_DEVELOPMENT_ONLY') {
    return makeError('INVALID_DATASET', ['datasetMode'])
  }
  if (!isNonEmptyString(evaluationAsOf) || !isValidIsoTimestamp(evaluationAsOf)) {
    return makeError('INVALID_EVALUATION_AS_OF', ['evaluationAsOf'])
  }
  return null
}

export const validateAndProjectInstitutionPool = (
  institutions: unknown,
  datasetVersion: unknown,
  datasetMode: unknown,
  evaluationAsOf: unknown,
): { ok: true, value: ValidatedInstitutionPool } | { ok: false, error: RecommendationError } => {
  const argumentError = validatePoolArguments(institutions, datasetVersion, datasetMode, evaluationAsOf)
  if (argumentError !== null) {
    return { ok: false, error: argumentError }
  }
  const input = institutions as readonly unknown[]
  const asOf = evaluationAsOf as string
  const mode = datasetMode as RecommendationDatasetMode
  const validated: InstitutionRecord[] = []
  const issues: string[] = []
  input.forEach((record, index) => {
    const result = validateInstitutionRecord(record)
    if (!result.ok) {
      result.issues.forEach((issue) => issues.push(`institutions[${index}].${issue.path}`))
      return
    }
    validated.push(result.value)
  })
  if (issues.length > 0) {
    return { ok: false, error: makeError('INVALID_INSTITUTION_RECORD', issues) }
  }
  const ids = validated.map((record) => record.institutionId)
  if (ids.some((id, index) => ids.indexOf(id) !== index)) {
    return { ok: false, error: makeError('DUPLICATE_INSTITUTION_ID', ids) }
  }
  const projected = validated
    .slice()
    .sort((left, right) => compareAscii(left.institutionId, right.institutionId))
    .map((record) => buildManifestEntry(record, mode, asOf))
  const entries = projected.map((item) => item.entry)
  const facts = projected
    .filter((item) => item.entry.disposition === 'included')
    .map((item) => item.facts)
  return {
    ok: true,
    value: {
      facts,
      manifest: {
        datasetVersion: datasetVersion as string,
        datasetMode: mode,
        evaluationAsOf: asOf,
        institutionContractVersion: 'institution-contract-v1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
        entries,
      },
    },
  }
}

export const matchingEvidenceRef = (
  facts: EffectiveInstitutionFacts,
  path: InstitutionMatchingCriticalFieldPath,
): InstitutionEffectiveEvidenceRef => {
  const ref = facts.matchingFields.find((entry) => entry.fieldPath === path)
  if (ref !== undefined) {
    return ref
  }
  // This is unreachable for adapter-produced facts.  Keeping the failure
  // explicit prevents a missing whitelist path from becoming an invented ref.
  throw new Error(`missing matching field: ${path}`)
}

export const effectiveCapabilityStatus = (
  facts: EffectiveInstitutionFacts,
  path: InstitutionMatchingCriticalFieldPath,
): InstitutionEffectiveCapabilityStatus => {
  const ref = matchingEvidenceRef(facts, path)
  if (ref.effectiveSnapshot === null || ref.effectiveSnapshot.valueType !== 'stable_code') {
    return 'unknown'
  }
  const status = ref.effectiveSnapshot.value
  return status === 'supported' || status === 'requires_assessment' || status === 'unsupported'
    ? status
    : 'unknown'
}

export const effectiveStableCode = (
  facts: EffectiveInstitutionFacts,
  path: InstitutionMatchingCriticalFieldPath,
): string | null => {
  const ref = matchingEvidenceRef(facts, path)
  return ref.effectiveSnapshot !== null && ref.effectiveSnapshot.valueType === 'stable_code'
    ? ref.effectiveSnapshot.value
    : null
}

export const effectiveStableCodeList = (
  facts: EffectiveInstitutionFacts,
  path: InstitutionMatchingCriticalFieldPath,
): readonly string[] | null => {
  const ref = matchingEvidenceRef(facts, path)
  return ref.effectiveSnapshot !== null && ref.effectiveSnapshot.valueType === 'stable_code_list'
    ? ref.effectiveSnapshot.value
    : null
}

export const effectiveReferenceMonthlyPrice = (
  facts: EffectiveInstitutionFacts,
): ReferenceMonthlyPrice | null => {
  const ref = matchingEvidenceRef(facts, 'price.referenceMonthlyPrice')
  return ref.effectiveSnapshot !== null && ref.effectiveSnapshot.valueType === 'reference_monthly_price'
    ? ref.effectiveSnapshot.value
    : null
}

export const institutionEvidenceRefsFor = (
  facts: EffectiveInstitutionFacts,
  paths: readonly InstitutionMatchingCriticalFieldPath[],
): InstitutionEffectiveEvidenceRef[] => paths
  .map((path) => matchingEvidenceRef(facts, path))

export const isEffectiveMatchingPath = isMatchingFieldPath
