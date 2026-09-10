import { deriveElderProfilePreviewV2 } from '../domain/elder-profile/v2/derive-elder-profile-preview-v2'
import { isValidIsoTimestamp } from '../domain/institution/primitives'
import { isVerificationCurrentAt } from '../domain/institution/verification'
import { evaluateRecommendationPreviewV2 } from '../domain/recommendation/v2/evaluate-recommendation-preview-v2'
import { assessmentDraftStore } from '../store/assessment-draft'
import type { InstitutionRecordV11 } from '../types/institution-v1-1'
import type { InstitutionCatalogResultV11 } from '../types/institution-catalog-v1-1'
import type {
  RecommendationPreviewApplicationErrorV2,
  RecommendationPreviewApplicationResultV2,
  RecommendationPreviewServiceDependenciesV2,
  RecommendationPreviewServiceV2,
} from '../types/recommendation-preview-v2'
import type { RecommendationPreviewV2 } from '../types/recommendation-v2'
import type {
  InstitutionDisplayFactV11,
  InstitutionDisplaySnapshotV11,
  InstitutionOperationalDisplayAdvisoryV11,
  RecommendationResultApplicationResultV2,
  RecommendationResultSourceAssociationErrorV2,
  RecommendationResultSourceAssociationErrorCauseV2,
  RecommendationResultSourceContextV2,
  RecommendationResultApplicationSnapshotV2,
} from '../types/recommendation-result-v2'
import { institutionCatalogServiceV11 } from './institution-catalog-v1-1'
import { projectInstitutionDisplaySnapshotV11Pure } from './institution-display-projection-v11'

interface EvaluatedPreview {
  preview: RecommendationPreviewV2
  records: readonly InstitutionRecordV11[]
}

type EvaluatePreviewResult =
  | { ok: true, evaluated: EvaluatedPreview }
  | { ok: false, error: RecommendationPreviewApplicationErrorV2 }

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const projectDisplaySnapshot = projectInstitutionDisplaySnapshotV11Pure

const candidateKey = (candidate: { institutionId: string, recordRevision: number }): string =>
  `${candidate.institutionId}#${candidate.recordRevision}`

const sourceAssociationError = (
  causeCode: RecommendationResultSourceAssociationErrorCauseV2,
  candidateIndex?: number,
): RecommendationResultSourceAssociationErrorV2 => ({
  code: 'RESULT_SOURCE_ASSOCIATION_ERROR',
  causeCode,
  ...(candidateIndex === undefined ? {} : { candidateIndex }),
})

const sourceAssociationFailure = (
  causeCode: RecommendationResultSourceAssociationErrorCauseV2,
  candidateIndex?: number,
): RecommendationResultApplicationResultV2 => ({
  ok: false,
  error: sourceAssociationError(causeCode, candidateIndex),
})

/**
 * Validate the display-side source identity before it is joined to cards.
 * This is intentionally separate from catalog validation: a valid catalog
 * must still fail closed if a later display projection duplicates a source.
 */
export const validateInstitutionDisplaySourcesV2 = (
  displays: readonly InstitutionDisplaySnapshotV11[],
): RecommendationResultSourceAssociationErrorV2 | null => {
  const keys = displays.map(candidateKey)
  const institutionIds = displays.map((display) => display.institutionId)
  return new Set(keys).size === keys.length && new Set(institutionIds).size === institutionIds.length
    ? null
    : sourceAssociationError('DISPLAY_SOURCE_DUPLICATE')
}

const sameSourceContext = (
  preview: RecommendationPreviewV2,
  evaluationAsOf: string,
): RecommendationResultSourceContextV2 | null => {
  const semantics = preview.semantics
  const context: RecommendationResultSourceContextV2 = {
    datasetVersion: semantics.datasetVersion,
    datasetMode: semantics.datasetMode,
    evaluationAsOf: semantics.evaluationAsOf,
    institutionContractVersion: semantics.versions.institutionContractVersion,
    institutionCapabilityContractVersion: semantics.versions.institutionCapabilityContractVersion,
  }
  return context.datasetVersion === semantics.poolManifest.datasetVersion
    && context.datasetMode === semantics.poolManifest.datasetMode
    && context.evaluationAsOf === semantics.poolManifest.evaluationAsOf
    && context.evaluationAsOf === evaluationAsOf
    && context.institutionContractVersion === 'institution-contract-v1.1'
    && context.institutionCapabilityContractVersion === 'institution-capability-contract-v1'
    && preview.source.assessmentSchemaVersion === 2
    ? context : null
}

const isValidDisplaySnapshot = (display: InstitutionDisplaySnapshotV11): boolean => {
  if (display.kind !== 'institution_display_snapshot_v1_1'
    || typeof display.institutionId !== 'string' || display.institutionId.length === 0
    || !Number.isInteger(display.recordRevision) || display.recordRevision <= 0
    || !isPlainRecord(display.identity) || !isPlainRecord(display.type)
    || !isPlainRecord(display.price) || !isPlainRecord(display.media)
    || !Array.isArray(display.roomFacts)
    || !isPlainRecord(display.mealFacts)) return false
  const facts: Array<InstitutionDisplayFactV11<unknown>> = [
    display.identity.name,
    display.identity.regionDisplayName,
    display.type.primaryType,
    display.type.supportedTypes,
    display.price.referenceMonthlyPrice,
    display.mealFacts.mealSchedule,
    display.mealFacts.easyChewSupport,
    display.mealFacts.modifiedFoodSupport,
  ]
  if (facts.some((fact) => !isPlainRecord(fact)
    || (fact.availability !== 'provided' && fact.availability !== 'unknown' && fact.availability !== 'unavailable')
    || (fact.availability === 'provided' ? fact.value === null : fact.value !== null)
    || (fact.effectiveVerification !== 'current_verified'
      && fact.effectiveVerification !== 'unverified'
      && fact.effectiveVerification !== 'expired'))) return false
  if (display.media.cover.state === 'current_verified'
    && (typeof display.media.cover.mediaId !== 'string' || typeof display.media.cover.url !== 'string')) return false
  if (display.media.cover.state === 'placeholder'
    && (display.media.cover.mediaId !== null || display.media.cover.url !== null)) return false
  if (display.media.vr.state !== 'current_verified_available'
    && display.media.vr.state !== 'unavailable'
    && display.media.vr.state !== 'unknown') return false
  return display.roomFacts.every((room) => isPlainRecord(room)
    && typeof room.roomId === 'string' && room.roomId.length > 0
    && isPlainRecord(room.roomType))
}

const candidateList = (preview: RecommendationPreviewV2): ReadonlyArray<{ institutionId: string, recordRevision: number }> => {
  const values: Array<{ institutionId: string, recordRevision: number }> = []
  preview.semantics.cards.forEach((candidate) => values.push(candidate))
  preview.semantics.conditionalCandidates.forEach((candidate) => values.push(candidate))
  if (preview.semantics.noExactMatch !== undefined) {
    preview.semantics.noExactMatch.nearMatches.forEach((candidate) => values.push(candidate))
  }
  return values
}

const buildResultSnapshot = (
  evaluated: EvaluatedPreview,
  evaluationAsOf: string,
): RecommendationResultApplicationResultV2 => {
  const context = sameSourceContext(evaluated.preview, evaluationAsOf)
  if (context === null) return sourceAssociationFailure('DISPLAY_SOURCE_CONTEXT_MISMATCH')

  let displays: InstitutionDisplaySnapshotV11[]
  try {
    displays = evaluated.records.map((record) => projectDisplaySnapshot(record, evaluationAsOf))
  } catch (_error) {
    return sourceAssociationFailure('DISPLAY_SOURCE_PROJECTION_INVALID')
  }
  const duplicateDisplayError = validateInstitutionDisplaySourcesV2(displays)
  if (duplicateDisplayError !== null) return { ok: false, error: duplicateDisplayError }
  if (displays.some((display) => !isValidDisplaySnapshot(display))) {
    return sourceAssociationFailure('DISPLAY_SOURCE_PROJECTION_INVALID')
  }
  const displayBySourceKey = new Map(
    displays.map((display) => [candidateKey(display), display] as const),
  )
  const displayInstitutionIds = new Set(
    displays.map((display) => display.institutionId),
  )

  const manifest = evaluated.preview.semantics.poolManifest.entries
  const candidates = candidateList(evaluated.preview)
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    const key = candidateKey(candidate)
    const display = displayBySourceKey.get(key)
    if (display === undefined) {
      return sourceAssociationFailure(
        displayInstitutionIds.has(candidate.institutionId)
          ? 'DISPLAY_SOURCE_REVISION_MISMATCH'
          : 'DISPLAY_SOURCE_MISSING',
        index,
      )
    }
    const matchingEntries = manifest.filter((entry) => entry.institutionId === candidate.institutionId)
    if (matchingEntries.length !== 1 || matchingEntries[0].recordRevision !== candidate.recordRevision) {
      return sourceAssociationFailure('DISPLAY_SOURCE_REVISION_MISMATCH', index)
    }
    const entry = matchingEntries[0]
    if (entry.recordProvenance !== display.recordProvenance || entry.recordStatus !== display.recordStatus) {
      return sourceAssociationFailure('DISPLAY_SOURCE_PROVENANCE_MISMATCH', index)
    }
  }

  const evaluationTime = Date.parse(evaluationAsOf)
  const operationalDisplayAdvisories: InstitutionOperationalDisplayAdvisoryV11[] = evaluated.records
    .filter((record) => {
      const availability = record.operations.bedAvailability
      return record.recordStatus === 'published'
        && availability.status !== 'unknown'
        && isValidIsoTimestamp(availability.asOf)
        && Date.parse(availability.asOf) <= evaluationTime
        && isVerificationCurrentAt(availability.verification, evaluationAsOf)
    })
    .map((record) => ({
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
      code: 'AVAILABILITY_DISPLAY_ONLY' as const,
    }))

  const value: RecommendationResultApplicationSnapshotV2 = {
    kind: 'recommendation_result_application_snapshot_v2',
    preview: evaluated.preview,
    institutionDisplays: displays,
    operationalDisplayAdvisories,
    sourceContext: context,
    source: evaluated.preview.source,
  }
  return { ok: true, value }
}

export const createRecommendationPreviewServiceV2 = (
  dependencies: RecommendationPreviewServiceDependenciesV2,
): RecommendationPreviewServiceV2 => {
  const evaluatePreview = async (evaluationAsOf: string): Promise<EvaluatePreviewResult> => {
    let draft: unknown
    try {
      draft = dependencies.draftSource.getDraft()
    } catch (_error) {
      return {
        ok: false,
        error: {
          code: 'ASSESSMENT_PROFILE_V2_ERROR',
          causeCode: 'DRAFT_READ_FAILED',
        },
      }
    }
    const profileResult = deriveElderProfilePreviewV2(draft)
    if (!profileResult.ok) {
      return {
        ok: false,
        error: {
          code: 'ASSESSMENT_PROFILE_V2_ERROR',
          causeCode: profileResult.error.code,
        },
      }
    }
    let catalogResult: InstitutionCatalogResultV11
    try {
      catalogResult = await dependencies.institutionCatalog.loadCatalog()
    } catch (_error) {
      return {
        ok: false,
        error: {
          code: 'INSTITUTION_CATALOG_V11_ERROR',
          causeCode: 'PROVIDER_LOAD_FAILED',
        },
      }
    }
    if (!catalogResult.ok) {
      return {
        ok: false,
        error: {
          code: 'INSTITUTION_CATALOG_V11_ERROR',
          causeCode: catalogResult.error.code,
        },
      }
    }
    const recommendationResult = evaluateRecommendationPreviewV2({
      profile: profileResult.preview,
      institutions: catalogResult.value.records,
      datasetVersion: catalogResult.value.datasetVersion,
      datasetMode: catalogResult.value.datasetMode,
      evaluationAsOf,
      contractVersion: 'recommendation-contract-v2',
      rulesetVersion: 'recommendation-ruleset-v2',
      policyVersion: 'conservative-exact-with-conditional-v1',
    })
    if (!recommendationResult.ok) {
      return {
        ok: false,
        error: {
          code: 'RECOMMENDATION_V2_ERROR',
          causeCode: recommendationResult.error.code,
          paths: recommendationResult.error.paths.slice(),
        },
      }
    }
    return {
      ok: true,
      evaluated: {
        preview: recommendationResult.value,
        records: catalogResult.value.records,
      },
    }
  }

  return {
    build: async (evaluationAsOf: string): Promise<RecommendationPreviewApplicationResultV2> => {
      const result = await evaluatePreview(evaluationAsOf)
      if (!result.ok) return result
      return { ok: true, value: result.evaluated.preview }
    },
    buildResultSnapshot: async (evaluationAsOf: string): Promise<RecommendationResultApplicationResultV2> => {
      const result = await evaluatePreview(evaluationAsOf)
      if (!result.ok) return result
      if (result.evaluated.records.length === 0) {
        return {
          ok: false,
          error: {
            code: 'INSTITUTION_CATALOG_V11_ERROR',
            causeCode: 'NO_INSTITUTIONS_AVAILABLE',
          },
        }
      }
      return buildResultSnapshot(result.evaluated, evaluationAsOf)
    },
  }
}

export const recommendationPreviewServiceV2 = createRecommendationPreviewServiceV2({
  draftSource: assessmentDraftStore,
  institutionCatalog: institutionCatalogServiceV11,
})

export const buildRecommendationResultApplicationSnapshotV2 = (
  input: { evaluationAsOf: string },
): Promise<RecommendationResultApplicationResultV2> =>
  recommendationPreviewServiceV2.buildResultSnapshot(input.evaluationAsOf)

export const projectInstitutionDisplaySnapshotV11 = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionDisplaySnapshotV11 => projectDisplaySnapshot(record, evaluationAsOf)
