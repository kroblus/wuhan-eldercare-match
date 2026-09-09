import type {
  InstitutionEvidence,
  InstitutionEvidenceValueSnapshot,
  InstitutionField,
} from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import type { RecommendationDatasetMode } from '../../../types/recommendation'
import type {
  InstitutionExtensionEvidenceRefV2,
  RecommendationErrorV2,
  RecommendationEvaluationResultV2,
  RecommendationInstitutionExtensionFieldPathV2,
  RecommendationPoolManifestEntryV2,
  RecommendationPoolManifestV2,
} from '../../../types/recommendation-v2'
import {
  compareIsoTimestamps,
  isValidIsoTimestamp,
} from '../../institution/primitives'
import {
  projectInstitutionRecordV11ToV1,
} from '../../institution/v1-1/project-to-v1'
import { validateInstitutionRecordV11 } from '../../institution/v1-1/validate-institution-v1-1'
import { isVerificationCurrentAt } from '../../institution/verification'
import {
  validateAndProjectInstitutionPool,
} from '../institution'
import type { EffectiveInstitutionFacts } from '../institution'
import {
  copyDomainDataV2,
  isNonEmptyStringV2,
  sortAsciiV2,
} from './rules-v2'

export interface ValidatedInstitutionFactsV2 {
  institutionId: string
  recordRevision: number
  baseFacts: EffectiveInstitutionFacts
  extensionFields: readonly InstitutionExtensionEvidenceRefV2[]
}

export interface ValidatedInstitutionPoolV2 {
  facts: readonly ValidatedInstitutionFactsV2[]
  manifest: RecommendationPoolManifestV2
}

const makeError = (
  code: RecommendationErrorV2['code'],
  paths: readonly string[],
): RecommendationErrorV2 => ({
  code,
  paths: paths.length > 0 ? sortAsciiV2(paths, (path) => path) : ['$'],
})

const rawSnapshot = (field: InstitutionField<unknown>): InstitutionEvidenceValueSnapshot | null =>
  field.availability === 'provided'
    ? { valueType: 'stable_code', value: String(field.value) }
    : null

const effectiveSnapshot = (field: InstitutionField<unknown>, evaluationAsOf: string): InstitutionEvidenceValueSnapshot | null =>
  field.availability === 'provided' && isVerificationCurrentAt(field.verification, evaluationAsOf)
    ? { valueType: 'stable_code', value: String(field.value) }
    : null

const projectionReason = (
  field: InstitutionField<unknown>,
  evaluationAsOf: string,
): InstitutionExtensionEvidenceRefV2['projectionReason'] => {
  if (field.availability === 'unknown') return 'raw_field_unknown'
  if (field.availability === 'unavailable') return 'raw_field_unavailable'
  if (field.verification.status === 'unverified') return 'raw_value_unverified'
  if (field.verification.status === 'expired') return 'raw_value_expired'
  if (compareIsoTimestamps(field.verification.verifiedAt, evaluationAsOf) > 0) return 'verification_in_future'
  if (field.verification.validUntil !== undefined
    && compareIsoTimestamps(field.verification.validUntil, evaluationAsOf) < 0) {
    return 'raw_value_past_valid_until'
  }
  if (field.value === 'unknown') return 'raw_value_unknown'
  return 'raw_value_currently_verified'
}

const makeExtensionRef = (
  record: InstitutionRecordV11,
  fieldPath: RecommendationInstitutionExtensionFieldPathV2,
  field: InstitutionField<unknown>,
  evaluationAsOf: string,
): InstitutionExtensionEvidenceRefV2 => ({
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  fieldPath,
  rawAvailability: field.availability,
  rawSnapshot: rawSnapshot(field),
  effectiveSnapshot: effectiveSnapshot(field, evaluationAsOf),
  projectionReason: projectionReason(field, evaluationAsOf),
  evidenceIds: sortAsciiV2(field.verification.evidenceIds, (id) => id),
  verificationStatus: field.verification.status,
  ...(field.verification.status === 'unverified' ? {} : { verifiedAt: field.verification.verifiedAt }),
  ...(field.verification.status === 'verified' && field.verification.validUntil === undefined
    ? {}
    : field.verification.status === 'unverified'
      ? {}
      : { validUntil: field.verification.validUntil }),
  evaluationAsOf,
})

const extensionRefs = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionExtensionEvidenceRefV2[] => {
  const refs: InstitutionExtensionEvidenceRefV2[] = []
  // A room's stable child identity, rather than provider array order, owns
  // equivalent-evidence selection. Keep the original index in fieldPath: the
  // frozen Institution Contract defines it as the current revision locator.
  const roomsByStableId = sortAsciiV2(
    record.rooms.map((room, index) => ({ index, room })),
    (entry) => entry.room.roomId,
  )
  roomsByStableId.forEach(({ index, room }) => {
    const fieldPath = `rooms.${index}.roomType` as RecommendationInstitutionExtensionFieldPathV2
    refs.push(makeExtensionRef(record, fieldPath, room.roomType, evaluationAsOf))
  })
  refs.push(makeExtensionRef(record, 'meal.mealSchedule', record.meal.mealSchedule, evaluationAsOf))
  refs.push(makeExtensionRef(record, 'meal.easyChewSupport', record.meal.easyChewSupport, evaluationAsOf))
  refs.push(makeExtensionRef(record, 'meal.modifiedFoodSupport', record.meal.modifiedFoodSupport, evaluationAsOf))
  refs.push(makeExtensionRef(record, 'activity.indoorSpace', record.activity.indoorSpace, evaluationAsOf))
  refs.push(makeExtensionRef(record, 'activity.outdoorSpace', record.activity.outdoorSpace, evaluationAsOf))
  return refs
}

const evidenceSnapshot = (evidence: InstitutionEvidence) => ({
  evidenceId: evidence.evidenceId,
  institutionId: evidence.institutionId,
  recordRevision: evidence.recordRevision,
  fieldPath: evidence.fieldPath,
  valueSnapshot: copyDomainDataV2(evidence.valueSnapshot),
  sourceType: evidence.sourceType,
  ...(evidence.observedAt === undefined ? {} : { observedAt: evidence.observedAt }),
  verificationStatus: evidence.verificationStatus,
  ...(evidence.verifiedAt === undefined ? {} : { verifiedAt: evidence.verifiedAt }),
  ...(evidence.validUntil === undefined ? {} : { validUntil: evidence.validUntil }),
})

const mergeManifestEvidence = (
  record: InstitutionRecordV11,
  baseEntry: { evidence: EffectiveInstitutionFacts['manifestEntry']['evidence'] },
  extensions: readonly InstitutionExtensionEvidenceRefV2[],
) => {
  const selectedIds: string[] = []
  baseEntry.evidence.forEach((item) => selectedIds.push(item.evidenceId))
  extensions.forEach((ref) => ref.evidenceIds.forEach((id) => {
    if (selectedIds.indexOf(id) < 0) selectedIds.push(id)
  }))
  return sortAsciiV2(
    record.evidence
      .filter((item) => selectedIds.indexOf(item.evidenceId) >= 0)
      .map(evidenceSnapshot),
    (item) => item.evidenceId,
  )
}

const provenanceMatchesMode = (
  record: InstitutionRecordV11,
  mode: RecommendationDatasetMode,
): boolean => mode === 'PRODUCTION'
  ? record.recordProvenance === 'PRODUCTION_CANDIDATE'
  : record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'

export const validateAndProjectInstitutionPoolV2 = (
  institutions: unknown,
  datasetVersion: unknown,
  datasetMode: unknown,
  evaluationAsOf: unknown,
): RecommendationEvaluationResultV2<ValidatedInstitutionPoolV2> => {
  if (!Array.isArray(institutions)) {
    return { ok: false, error: makeError('INVALID_INSTITUTION_RECORD', ['institutions']) }
  }
  if (!isNonEmptyStringV2(datasetVersion)
    || (datasetMode !== 'PRODUCTION' && datasetMode !== 'MOCK_DEVELOPMENT_ONLY')) {
    return { ok: false, error: makeError('INVALID_DATASET_MODE_OR_PROVENANCE', ['datasetVersion', 'datasetMode']) }
  }
  if (!isValidIsoTimestamp(evaluationAsOf)) {
    return { ok: false, error: makeError('INVALID_EVALUATION_AS_OF', ['evaluationAsOf']) }
  }
  const validated: InstitutionRecordV11[] = []
  const issues: string[] = []
  institutions.forEach((record, index) => {
    const result = validateInstitutionRecordV11(record)
    if (!result.ok) {
      const wrongVersion = typeof record === 'object' && record !== null
        && 'contractVersion' in record
        && (record as { contractVersion?: unknown }).contractVersion !== 'institution-contract-v1.1'
      if (wrongVersion) {
        issues.push(`institutions[${index}].contractVersion`)
      } else {
        result.issues.forEach((issue) => issues.push(`institutions[${index}].${issue.path}`))
      }
      return
    }
    validated.push(result.value)
  })
  if (issues.length > 0) {
    const versionOnly = issues.every((path) => path.endsWith('.contractVersion'))
    return {
      ok: false,
      error: makeError(versionOnly ? 'UNSUPPORTED_INSTITUTION_VERSION' : 'INVALID_INSTITUTION_RECORD', issues),
    }
  }
  const ids = validated.map((record) => record.institutionId)
  if (ids.some((id, index) => ids.indexOf(id) !== index)) {
    return { ok: false, error: makeError('DUPLICATE_INSTITUTION_ID', ids) }
  }
  const mode = datasetMode as RecommendationDatasetMode
  const mismatched = validated
    .filter((record) => !provenanceMatchesMode(record, mode))
    .map((record) => `institutions.${record.institutionId}.recordProvenance`)
  if (mismatched.length > 0) {
    return { ok: false, error: makeError('INVALID_DATASET_MODE_OR_PROVENANCE', mismatched) }
  }

  const projectedV1 = validated.map(projectInstitutionRecordV11ToV1)
  const baseResult = validateAndProjectInstitutionPool(
    projectedV1,
    datasetVersion,
    mode,
    evaluationAsOf,
  )
  if (!baseResult.ok) {
    const code = baseResult.error.code === 'INVALID_EVALUATION_AS_OF'
      ? 'INVALID_EVALUATION_AS_OF'
      : baseResult.error.code === 'DUPLICATE_INSTITUTION_ID'
        ? 'DUPLICATE_INSTITUTION_ID'
        : 'INVALID_INSTITUTION_RECORD'
    return { ok: false, error: makeError(code, baseResult.error.paths) }
  }

  const sortedRecords = validated.slice().sort((left, right) =>
    left.institutionId < right.institutionId ? -1 : left.institutionId > right.institutionId ? 1 : 0)
  const facts: ValidatedInstitutionFactsV2[] = []
  const entries: RecommendationPoolManifestEntryV2[] = sortedRecords.map((record) => {
    const baseManifest = baseResult.value.manifest.entries.find((entry) =>
      entry.institutionId === record.institutionId)
    if (!baseManifest) throw new Error('validated V1 manifest entry missing')
    const extensions = extensionRefs(record, evaluationAsOf as string)
    const baseFacts = baseResult.value.facts.find((entry) => entry.institutionId === record.institutionId)
    if (baseManifest.disposition === 'included') {
      if (!baseFacts) throw new Error('validated V1 included facts missing')
      facts.push({
        institutionId: record.institutionId,
        recordRevision: record.recordRevision,
        baseFacts,
        extensionFields: extensions,
      })
      return {
        institutionId: record.institutionId,
        recordRevision: record.recordRevision,
        recordProvenance: record.recordProvenance,
        recordStatus: record.recordStatus,
        disposition: 'included',
        matchingFields: baseManifest.matchingFields,
        extensionFields: extensions,
        evidence: mergeManifestEvidence(record, baseFacts.manifestEntry, extensions),
      }
    }
    return {
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      recordProvenance: record.recordProvenance,
      recordStatus: record.recordStatus,
      disposition: 'excluded',
      exclusionReasonCode: 'RECORD_NOT_PUBLISHED',
      matchingFields: baseManifest.matchingFields,
      extensionFields: extensions,
      evidence: mergeManifestEvidence(record, baseManifest, extensions),
    }
  })

  return {
    ok: true,
    value: {
      facts,
      manifest: {
        datasetVersion: datasetVersion as string,
        datasetMode: mode,
        evaluationAsOf: evaluationAsOf as string,
        institutionContractVersion: 'institution-contract-v1.1',
        institutionCapabilityContractVersion: 'institution-capability-contract-v1',
        entries,
      },
    },
  }
}

export const extensionEvidenceRefV2 = (
  facts: ValidatedInstitutionFactsV2,
  path: RecommendationInstitutionExtensionFieldPathV2,
): InstitutionExtensionEvidenceRefV2 => {
  const ref = facts.extensionFields.find((entry) => entry.fieldPath === path)
  if (!ref) throw new Error(`missing extension field: ${path}`)
  return ref
}

export const currentExtensionStableCodeV2 = (
  ref: InstitutionExtensionEvidenceRefV2,
): string | null => ref.effectiveSnapshot !== null && ref.effectiveSnapshot.valueType === 'stable_code'
  ? ref.effectiveSnapshot.value : null
