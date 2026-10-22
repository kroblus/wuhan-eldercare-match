import type { PreferencePriorityV2 } from '../../../types/assessment-v2'
import type { InstitutionMatchingCriticalFieldPath } from '../../../types/institution'
import type {
  BudgetFit,
  RehabilitationFit,
  RegionFit,
} from '../../../types/recommendation'
import type {
  ElderEvidenceRefV2,
  PriorityFactorResultV2,
  PriorityFitStatusV2,
  PriorityFitVectorV2,
  RecommendationProfileV2,
} from '../../../types/recommendation-v2'
import {
  matchingEvidenceRef,
} from '../institution'
import type { ValidatedInstitutionFactsV2 } from './institution-v2'
import { derivedEvidenceRefsV2, rawPreferenceEvidenceRefV2 } from './profile-v2'
import {
  RECOMMENDATION_PRIORITY_CODES_V2,
  sortPrioritiesV2,
} from './rules-v2'

export interface PriorityEvaluationV2 {
  factors: readonly PriorityFactorResultV2[]
  vector: PriorityFitVectorV2
}

const REHABILITATION_PATH: InstitutionMatchingCriticalFieldPath =
  'capabilities.specialCare.rehabilitation_training'

const budgetRef = (profile: RecommendationProfileV2): ElderEvidenceRefV2 => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: profile.financial.rawFacts.monthlyBudget,
})

const regionRef = (profile: RecommendationProfileV2): ElderEvidenceRefV2 => {
  const region = profile.preference.rawFacts.regionPreference
  return {
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: region === undefined ? 'absent' : 'provided',
    valueSnapshot: region === undefined ? null : region,
  }
}

const rehabRefs = (profile: RecommendationProfileV2): ElderEvidenceRefV2[] =>
  derivedEvidenceRefsV2('health.rehabilitationNeed', profile.health.derivedFacts.rehabilitationNeed)

const prioritySelectionRef = (profile: RecommendationProfileV2): ElderEvidenceRefV2 =>
  rawPreferenceEvidenceRefV2(profile, 'priorities')

const budgetStatus = (fit: BudgetFit): PriorityFitStatusV2 => {
  if (fit === 'within_budget') return 'match'
  if (fit === 'partially_overlapping') return 'partial'
  if (fit === 'unknown') return 'unknown'
  return 'mismatch'
}

const regionStatus = (fit: RegionFit): PriorityFitStatusV2 => {
  if (fit === 'same') return 'match'
  if (fit === 'different') return 'mismatch'
  return fit
}

const rehabilitationStatus = (fit: RehabilitationFit): PriorityFitStatusV2 => {
  if (fit === 'supported') return 'match'
  if (fit === 'requires_assessment') return 'partial'
  if (fit === 'unsupported') return 'mismatch'
  return fit
}

const makeStructuredFactor = (
  profile: RecommendationProfileV2,
  facts: ValidatedInstitutionFactsV2,
  priorityCode: Extract<PreferencePriorityV2, 'price' | 'region' | 'rehabilitation_capability'>,
  status: PriorityFitStatusV2,
  hardPaths: readonly InstitutionMatchingCriticalFieldPath[],
): PriorityFactorResultV2 => {
  if (priorityCode === 'price') {
    return {
      priorityCode,
      role: 'STRUCTURED_SCORABLE',
      status,
      rankParticipation: status === 'not_applicable' ? 'not_applicable' : 'selected_priority',
      elderEvidenceRefs: [prioritySelectionRef(profile), budgetRef(profile)],
      institutionEvidenceRefs: [matchingEvidenceRef(facts.baseFacts, 'price.referenceMonthlyPrice')],
    }
  }
  if (priorityCode === 'region') {
    return {
      priorityCode,
      role: 'STRUCTURED_SCORABLE',
      status,
      rankParticipation: status === 'not_applicable' ? 'not_applicable' : 'selected_priority',
      elderEvidenceRefs: [prioritySelectionRef(profile), regionRef(profile)],
      institutionEvidenceRefs: status === 'not_applicable'
        ? [] : [matchingEvidenceRef(facts.baseFacts, 'identity.regionCode')],
    }
  }
  const consumedByHard = hardPaths.indexOf(REHABILITATION_PATH) >= 0
  return {
    priorityCode,
    role: 'STRUCTURED_SCORABLE',
    status: consumedByHard ? 'not_applicable' : status,
    rankParticipation: consumedByHard
      ? 'consumed_by_hard'
      : status === 'not_applicable' ? 'not_applicable' : 'selected_priority',
    elderEvidenceRefs: [prioritySelectionRef(profile), ...rehabRefs(profile)],
    institutionEvidenceRefs: consumedByHard || status === 'not_applicable'
      ? [] : [matchingEvidenceRef(facts.baseFacts, REHABILITATION_PATH)],
  }
}

const makeNotScorableFactor = (
  profile: RecommendationProfileV2,
  priorityCode: Exclude<PreferencePriorityV2, 'price' | 'region' | 'rehabilitation_capability'>,
): PriorityFactorResultV2 => ({
  priorityCode,
  role: priorityCode === 'care_capability' ? 'SAFETY_OWNER' : 'DISPLAY_ONLY_NOT_SCORABLE',
  status: 'not_scorable',
  rankParticipation: priorityCode === 'care_capability' ? 'consumed_by_hard' : 'not_scorable',
  elderEvidenceRefs: [prioritySelectionRef(profile)],
  institutionEvidenceRefs: [],
})

const countVector = (factors: readonly PriorityFactorResultV2[]): PriorityFitVectorV2 => ({
  matchedCount: factors.filter((factor) => factor.rankParticipation === 'selected_priority'
    && factor.status === 'match').length,
  partialCount: factors.filter((factor) => factor.rankParticipation === 'selected_priority'
    && factor.status === 'partial').length,
  knownMismatchCount: factors.filter((factor) => factor.rankParticipation === 'selected_priority'
    && factor.status === 'mismatch').length,
  unknownCount: factors.filter((factor) => factor.rankParticipation === 'selected_priority'
    && factor.status === 'unknown').length,
})

export const evaluatePriorityFitV2 = (
  profile: RecommendationProfileV2,
  facts: ValidatedInstitutionFactsV2,
  budgetFit: BudgetFit,
  regionFit: RegionFit,
  rehabilitationFit: RehabilitationFit,
  hardPaths: readonly InstitutionMatchingCriticalFieldPath[],
): PriorityEvaluationV2 => {
  const factors = sortPrioritiesV2(profile.preference.rawFacts.priorities).map((priorityCode) => {
    if (priorityCode === 'price') {
      return makeStructuredFactor(profile, facts, priorityCode, budgetStatus(budgetFit), hardPaths)
    }
    if (priorityCode === 'region') {
      return makeStructuredFactor(profile, facts, priorityCode, regionStatus(regionFit), hardPaths)
    }
    if (priorityCode === 'rehabilitation_capability') {
      return makeStructuredFactor(profile, facts, priorityCode, rehabilitationStatus(rehabilitationFit), hardPaths)
    }
    return makeNotScorableFactor(profile, priorityCode)
  })
  return { factors, vector: countVector(factors) }
}

export const isActiveStructuredPriorityV2 = (priority: PreferencePriorityV2): boolean =>
  priority === 'price' || priority === 'region' || priority === 'rehabilitation_capability'

export const canonicalPriorityIndexV2 = (priority: PreferencePriorityV2): number =>
  RECOMMENDATION_PRIORITY_CODES_V2.indexOf(priority)
