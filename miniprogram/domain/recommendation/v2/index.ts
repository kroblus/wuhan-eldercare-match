import type {
  ElderProfilePreviewV2,
  ElderProfileV2,
} from '../../../types/elder-profile-v2'
import type {
  RecommendationErrorV2,
  RecommendationEvaluationInputV2,
  RecommendationEvaluationResultV2,
  RecommendationPreviewV2,
  RecommendationProfileV2,
  RecommendationV2,
  RecommendationVersionsV2,
} from '../../../types/recommendation-v2'
import { isValidIsoTimestamp } from '../../institution/primitives'
import { deriveRecommendationSemanticsV2 } from './core-v2'
import { validateAndProjectInstitutionPoolV2 } from './institution-v2'
import { validateAndSnapshotProfileV2 } from './profile-v2'
import {
  isPlainRecordV2,
  sortAsciiV2,
} from './rules-v2'

interface ValidatedEvaluationV2 {
  profile: RecommendationProfileV2
  versions: RecommendationVersionsV2
  semantics: import('../../../types/recommendation-v2').RecommendationSemanticResultV2
}

const makeError = (
  code: RecommendationErrorV2['code'],
  paths: readonly string[],
): RecommendationErrorV2 => ({
  code,
  paths: paths.length > 0 ? sortAsciiV2(paths, (path) => path) : ['$'],
})

const versionsFor = (profile: RecommendationProfileV2): RecommendationVersionsV2 => ({
  recommendationContractVersion: 'recommendation-contract-v2',
  recommendationRulesetVersion: 'recommendation-ruleset-v2',
  policyVersion: 'conservative-exact-with-conditional-v1',
  elderProfileContractVersion: 'elder-profile-contract-v2',
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v2',
  adlRulesetVersion: profile.adl.derivedFacts.rulesetVersion,
  institutionContractVersion: 'institution-contract-v1.1',
  institutionCapabilityContractVersion: 'institution-capability-contract-v1',
})

const evaluate = (
  input: unknown,
  expectedKind: RecommendationProfileV2['kind'],
): RecommendationEvaluationResultV2<ValidatedEvaluationV2> => {
  if (!isPlainRecordV2(input)) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', ['$']) }
  }
  if (input.contractVersion !== 'recommendation-contract-v2') {
    return { ok: false, error: makeError('UNSUPPORTED_RECOMMENDATION_CONTRACT', ['contractVersion']) }
  }
  if (input.rulesetVersion !== 'recommendation-ruleset-v2') {
    return { ok: false, error: makeError('UNSUPPORTED_RECOMMENDATION_RULESET', ['rulesetVersion']) }
  }
  if (input.policyVersion !== 'conservative-exact-with-conditional-v1') {
    return { ok: false, error: makeError('UNSUPPORTED_RECOMMENDATION_RULESET', ['policyVersion']) }
  }
  if (!isValidIsoTimestamp(input.evaluationAsOf)) {
    return { ok: false, error: makeError('INVALID_EVALUATION_AS_OF', ['evaluationAsOf']) }
  }
  const profileResult = validateAndSnapshotProfileV2(input.profile, expectedKind)
  if (!profileResult.ok) return profileResult
  const poolResult = validateAndProjectInstitutionPoolV2(
    input.institutions,
    input.datasetVersion,
    input.datasetMode,
    input.evaluationAsOf,
  )
  if (!poolResult.ok) return poolResult
  const versions = versionsFor(profileResult.value.profile)
  const semanticResult = deriveRecommendationSemanticsV2({
    profileSnapshot: profileResult.value,
    institutionFacts: poolResult.value.facts,
    poolManifest: poolResult.value.manifest,
    datasetVersion: input.datasetVersion as string,
    datasetMode: input.datasetMode as 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY',
    evaluationAsOf: input.evaluationAsOf,
    versions,
  })
  if (!semanticResult.ok) return semanticResult
  return {
    ok: true,
    value: {
      profile: profileResult.value.profile,
      versions,
      semantics: semanticResult.value,
    },
  }
}

export const evaluateRecommendationPreviewV2 = (
  input: RecommendationEvaluationInputV2<ElderProfilePreviewV2>,
): RecommendationEvaluationResultV2<RecommendationPreviewV2> => {
  const result = evaluate(input, 'elder_profile_preview')
  if (!result.ok) return result
  if (result.value.profile.kind !== 'elder_profile_preview') {
    return { ok: false, error: makeError('UNSUPPORTED_PROFILE_VERSION', ['profile.kind']) }
  }
  return {
    ok: true,
    value: {
      kind: 'recommendation_preview_v2',
      source: {
        kind: result.value.profile.source.kind,
        localDraftId: result.value.profile.source.localDraftId,
        assessmentSchemaVersion: result.value.profile.source.assessmentSchemaVersion,
      },
      profileContractVersion: 'elder-profile-contract-v2',
      derivationRulesetVersion: 'elder-profile-ruleset-v2',
      adlRulesetVersion: result.value.profile.adl.derivedFacts.rulesetVersion,
      persistence: 'FORBIDDEN',
      semantics: result.value.semantics,
    },
  }
}

export const evaluateFormalRecommendationV2 = (
  input: RecommendationEvaluationInputV2<ElderProfileV2>,
): RecommendationEvaluationResultV2<RecommendationV2> => {
  const result = evaluate(input, 'elder_profile')
  if (!result.ok) return result
  if (result.value.profile.kind !== 'elder_profile') {
    return { ok: false, error: makeError('UNSUPPORTED_PROFILE_VERSION', ['profile.kind']) }
  }
  return {
    ok: true,
    value: {
      kind: 'recommendation_v2',
      identity: {
        elderId: result.value.profile.identity.elderId,
        assessmentId: result.value.profile.identity.assessmentId,
        assessmentSchemaVersion: result.value.profile.identity.assessmentSchemaVersion,
        assessmentCompletedAt: result.value.profile.identity.assessmentCompletedAt,
        profileContractVersion: result.value.profile.identity.profileContractVersion,
        derivationRulesetVersion: result.value.profile.identity.derivationRulesetVersion,
      },
      semantics: result.value.semantics,
    },
  }
}

export { deriveRecommendationSemanticsV2 } from './core-v2'
export {
  ACTIVITY_MATCHING_RUNTIME_V2,
  MEAL_SCHEDULE_COMPARATOR_V2,
  RANK_TUPLE_POLICY_V2,
  ROOM_TYPE_MISMATCH_RUNTIME_V2,
  STRUCTURED_UNKNOWN_EXACT_POLICY_V2,
} from './core-v2'
export {
  RECOMMENDATION_DIFFERENCE_CODES_V2,
  RECOMMENDATION_PRIORITY_CODES_V2,
  RECOMMENDATION_REASON_CODES_V2,
} from './rules-v2'
