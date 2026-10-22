import { deriveElderProfilePreview } from '../domain/elder-profile/derive-elder-profile-preview'
import { deriveElderProfilePreviewV2 } from '../domain/elder-profile/v2/derive-elder-profile-preview-v2'
import { assessmentDraftStore } from '../store/assessment-draft'
import type { AssessmentQuestionIdV2 } from '../types/assessment-v2'
import type { ElderProfilePreview } from '../types/elder-profile'
import type {
  ProfileApplicationErrorV2,
  ProfileApplicationResultV2,
  ProfileApplicationSnapshotV2,
} from '../types/profile-application-v2'
import type { ProfilePageViewModel } from '../pages/assessment/profile-view-model'

export interface ProfileApplicationV1Snapshot {
  kind: 'profile_application_snapshot_v1'
  preview: ElderProfilePreview
}

export type ProfileApplicationSnapshot = ProfileApplicationV1Snapshot | ProfileApplicationSnapshotV2

export interface ProfileApplicationV1Failure {
  ok: false
  error: {
    code: 'PROFILE_APPLICATION_V1_ERROR'
    causeCode: string
    questionIds?: readonly string[]
  }
  hasAnswers: boolean
}

export type ProfileApplicationResult =
  | { ok: true, version: 1, value: ProfileApplicationV1Snapshot }
  | { ok: true, version: 2, value: ProfileApplicationSnapshotV2 }
  | ({ ok: false, version: 2, error: ProfileApplicationErrorV2, hasAnswers: boolean })
  | ({ ok: false, version: 1, error: ProfileApplicationV1Failure['error'], hasAnswers: boolean })

export interface ProfileApplicationServiceDependenciesV2 {
  draftSource: {
    getDraft(): unknown
  }
}

export interface ProfileApplicationServiceV2 {
  build(): ProfileApplicationResultV2
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasDraftAnswers = (value: unknown): boolean =>
  isPlainRecord(value)
  && isPlainRecord(value.answers)
  && Object.keys(value.answers).length > 0

const safeQuestionIds = (value: unknown): readonly AssessmentQuestionIdV2[] =>
  Array.isArray(value)
    ? value.filter((item): item is AssessmentQuestionIdV2 => typeof item === 'string')
    : []

const v2Failure = (
  causeCode: ProfileApplicationErrorV2['causeCode'],
  questionIds: readonly AssessmentQuestionIdV2[] = [],
): ProfileApplicationResultV2 => ({
  ok: false,
  error: {
    code: 'PROFILE_APPLICATION_V2_ERROR',
    causeCode,
    ...(questionIds.length > 0 ? { questionIds: questionIds.slice() } : {}),
  },
})

const buildV2FromDraft = (draft: unknown): ProfileApplicationResultV2 => {
  if (!isPlainRecord(draft) || draft.schemaVersion !== 2 || draft.kind !== 'assessment_draft') {
    return v2Failure('UNSUPPORTED_ASSESSMENT_SCHEMA')
  }

  const previewResult = deriveElderProfilePreviewV2(draft)
  if (!previewResult.ok) {
    return v2Failure(previewResult.error.code, safeQuestionIds(previewResult.error.questionIds))
  }

  const preview = previewResult.preview
  const source = preview.source
  const versions = {
    assessmentSchemaVersion: source.assessmentSchemaVersion,
    profileContractVersion: preview.profileContractVersion,
    derivationRulesetVersion: preview.derivationRulesetVersion,
    adlRulesetVersion: preview.adl.derivedFacts.rulesetVersion,
    summarySchemaVersion: preview.userFacingSummary.summarySchemaVersion,
  }
  if (source.kind !== 'local_assessment_preview'
    || source.assessmentSchemaVersion !== 2
    || preview.profileContractVersion !== 'elder-profile-contract-v2'
    || preview.derivationRulesetVersion !== 'elder-profile-ruleset-v2'
    || versions.adlRulesetVersion !== 'adl-ruleset-v1'
    || versions.summarySchemaVersion !== 'elder-profile-summary-input-v2') {
    return v2Failure('SNAPSHOT_METADATA_MISMATCH')
  }

  return {
    ok: true,
    value: {
      kind: 'profile_application_snapshot_v2',
      preview,
      displayState: 'ready',
      source: {
        kind: source.kind,
        localDraftId: source.localDraftId,
        assessmentSchemaVersion: source.assessmentSchemaVersion,
      },
      versions,
    },
  }
}

export const createProfileApplicationServiceV2 = (
  dependencies: ProfileApplicationServiceDependenciesV2,
): ProfileApplicationServiceV2 => ({
  build: (): ProfileApplicationResultV2 => {
    let draft: unknown
    try {
      draft = dependencies.draftSource.getDraft()
    } catch (_error) {
      return v2Failure('DRAFT_READ_FAILED')
    }
    return buildV2FromDraft(draft)
  },
})

const defaultServiceV2 = createProfileApplicationServiceV2({
  draftSource: assessmentDraftStore,
})

export const buildProfileApplicationSnapshotV2 = (): ProfileApplicationResultV2 =>
  defaultServiceV2.build()

/** Test seam used by the version dispatcher; it does not read storage. */
export const buildProfileApplicationSnapshotV2FromDraft = (draft: unknown): ProfileApplicationResultV2 =>
  buildV2FromDraft(draft)

/**
 * The public Profile route remains V1-compatible for historical runtime
 * fixtures while a schema-2 active Draft always crosses the V2 boundary.
 * This adapter never turns a V2 Draft into a V1 Preview.
 */
export const buildProfileApplicationSnapshot = (): ProfileApplicationResult => {
  let draft: unknown
  try {
    draft = assessmentDraftStore.getDraft()
  } catch (_error) {
    return {
      ok: false,
      version: 1,
      error: { code: 'PROFILE_APPLICATION_V1_ERROR', causeCode: 'DRAFT_READ_FAILED' },
      hasAnswers: false,
    }
  }
  const hasAnswers = hasDraftAnswers(draft)
  if (isPlainRecord(draft) && draft.schemaVersion === 2) {
    const result = buildProfileApplicationSnapshotV2FromDraft(draft)
    return result.ok
      ? { ok: true, version: 2, value: result.value }
      : { ok: false, version: 2, error: result.error, hasAnswers }
  }
  if (isPlainRecord(draft) && draft.schemaVersion !== undefined && draft.schemaVersion !== 1) {
    return {
      ok: false,
      version: 2,
      error: {
        code: 'PROFILE_APPLICATION_V2_ERROR',
        causeCode: 'UNSUPPORTED_ASSESSMENT_SCHEMA',
      },
      hasAnswers,
    }
  }

  try {
    const result = deriveElderProfilePreview(draft)
    if (result.ok) {
      return {
        ok: true,
        version: 1,
        value: { kind: 'profile_application_snapshot_v1', preview: result.preview },
      }
    }
    return {
      ok: false,
      version: 1,
      error: {
        code: 'PROFILE_APPLICATION_V1_ERROR',
        causeCode: result.error.code,
        questionIds: result.error.questionIds,
      },
      hasAnswers,
    }
  } catch (_error) {
    return {
      ok: false,
      version: 1,
      error: { code: 'PROFILE_APPLICATION_V1_ERROR', causeCode: 'DRAFT_DERIVATION_FAILED' },
      hasAnswers,
    }
  }
}

/** Kept as a type-only compatibility export for callers that build page data. */
export type ProfileApplicationPageViewModelV1 = ProfilePageViewModel
