import type {
  ElderProfile,
  ElderProfilePreview,
} from '../../types/elder-profile'
import type {
  FormalRecommendation,
  RecommendationDatasetMode,
  RecommendationError,
  RecommendationEvaluationInput,
  RecommendationEvaluationResult,
  RecommendationPreview,
  RecommendationVersions,
} from '../../types/recommendation'
import { buildRecommendationAdvisories } from './advisories'
import { evaluateSemanticCore } from './core'
import { validateAndProjectInstitutionPool } from './institution'
import type { ValidatedInstitutionPool } from './institution'
import {
  validateAndSnapshotProfile,
} from './profile'
import type { ValidatedProfileSnapshot } from './profile'
import { isPlainRecord } from './rules'

interface ValidatedEvaluation {
  profileInput: ElderProfile | ElderProfilePreview
  profileSnapshot: ValidatedProfileSnapshot
  datasetVersion: string
  datasetMode: RecommendationDatasetMode
  evaluationAsOf: string
  versions: RecommendationVersions
  institutionPool: ValidatedInstitutionPool
}

const makeError = (code: RecommendationError['code'], paths: readonly string[]): RecommendationError => ({
  code,
  paths: paths.length > 0 ? paths.slice().sort() : ['$'],
})

const validateVersionInputs = (
  input: Record<string, unknown>,
): RecommendationError | null => {
  if (input.rulesetVersion !== 'recommendation-ruleset-v1') {
    return makeError('INVALID_RECOMMENDATION_VERSION', ['rulesetVersion'])
  }
  if (input.policyVersion !== 'conservative-exact-with-conditional-v1') {
    return makeError('INVALID_RECOMMENDATION_VERSION', ['policyVersion'])
  }
  return null
}

const makeVersions = (
  profile: ElderProfile | ElderProfilePreview,
): RecommendationVersions => ({
  recommendationContractVersion: 'recommendation-contract-v1',
  recommendationRulesetVersion: 'recommendation-ruleset-v1',
  policyVersion: 'conservative-exact-with-conditional-v1',
  elderProfileContractVersion: 'elder-profile-contract-v1',
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v1',
  adlRulesetVersion: profile.adl.derivedFacts.rulesetVersion,
  institutionContractVersion: 'institution-contract-v1',
  institutionCapabilityContractVersion: 'institution-capability-contract-v1',
})

const validateEvaluation = (
  input: unknown,
  expectedKind: 'elder_profile' | 'elder_profile_preview',
): RecommendationEvaluationResult<ValidatedEvaluation> => {
  if (!isPlainRecord(input)) {
    return { ok: false, error: makeError('INVALID_INPUT', ['$']) }
  }
  const versionError = validateVersionInputs(input)
  if (versionError !== null) {
    return { ok: false, error: versionError }
  }
  if (!('profile' in input)) {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', ['profile']) }
  }
  const profileResult = validateAndSnapshotProfile(input.profile, expectedKind)
  if (!profileResult.ok) {
    return profileResult
  }
  const poolResult = validateAndProjectInstitutionPool(
    input.institutions,
    input.datasetVersion,
    input.datasetMode,
    input.evaluationAsOf,
  )
  if (!poolResult.ok) {
    return poolResult
  }
  const profileInput = input.profile as ElderProfile | ElderProfilePreview
  return {
    ok: true,
    value: {
      profileInput,
      profileSnapshot: profileResult.value,
      datasetVersion: input.datasetVersion as string,
      datasetMode: input.datasetMode as RecommendationDatasetMode,
      evaluationAsOf: input.evaluationAsOf as string,
      versions: makeVersions(profileInput),
      institutionPool: poolResult.value,
    },
  }
}

const evaluate = (
  input: unknown,
  expectedKind: 'elder_profile' | 'elder_profile_preview',
): RecommendationEvaluationResult<ValidatedEvaluation & {
  semantics: import('../../types/recommendation').RecommendationSemanticResult
}> => {
  const validated = validateEvaluation(input, expectedKind)
  if (!validated.ok) {
    return validated
  }
  const semanticResult = evaluateSemanticCore({
    profileSnapshot: validated.value.profileSnapshot,
    institutionFacts: validated.value.institutionPool.facts,
    poolManifest: validated.value.institutionPool.manifest,
    datasetVersion: validated.value.datasetVersion,
    datasetMode: validated.value.datasetMode,
    evaluationAsOf: validated.value.evaluationAsOf,
    versions: validated.value.versions,
  })
  if (!semanticResult.ok) {
    return semanticResult
  }
  return {
    ok: true,
    value: {
      ...validated.value,
      semantics: semanticResult.value,
    },
  }
}

export const evaluateRecommendationPreview = (
  input: RecommendationEvaluationInput<ElderProfilePreview>,
): RecommendationEvaluationResult<RecommendationPreview> => {
  const result = evaluate(input, 'elder_profile_preview')
  if (!result.ok) {
    return result
  }
  const profile = result.value.profileInput
  if (profile.kind !== 'elder_profile_preview') {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', ['profile.kind']) }
  }
  return {
    ok: true,
    value: {
      kind: 'recommendation_preview',
      source: {
        kind: profile.source.kind,
        localDraftId: profile.source.localDraftId,
        assessmentSchemaVersion: profile.source.assessmentSchemaVersion,
      },
      profileContractVersion: profile.profileContractVersion,
      derivationRulesetVersion: profile.derivationRulesetVersion,
      adlRulesetVersion: profile.adl.derivedFacts.rulesetVersion,
      semantics: result.value.semantics,
    },
  }
}

export const evaluateFormalRecommendation = (
  input: RecommendationEvaluationInput<ElderProfile>,
): RecommendationEvaluationResult<FormalRecommendation> => {
  const result = evaluate(input, 'elder_profile')
  if (!result.ok) {
    return result
  }
  const profile = result.value.profileInput
  if (profile.kind !== 'elder_profile') {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', ['profile.kind']) }
  }
  return {
    ok: true,
    value: {
      kind: 'recommendation',
      identity: {
        elderId: profile.identity.elderId,
        assessmentId: profile.identity.assessmentId,
        assessmentSchemaVersion: profile.identity.assessmentSchemaVersion,
        assessmentCompletedAt: profile.identity.assessmentCompletedAt,
        profileContractVersion: profile.identity.profileContractVersion,
        derivationRulesetVersion: profile.identity.derivationRulesetVersion,
      },
      semantics: result.value.semantics,
    },
  }
}

export { buildRecommendationAdvisories }
export type {
  RecommendationAdvisoryAttachment,
  RecommendationAdvisoryInput,
  RecommendationEvaluationInput,
  RecommendationEvaluationResult,
} from '../../types/recommendation'
