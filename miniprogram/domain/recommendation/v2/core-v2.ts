import type { MonthlyRange } from '../../../types/assessment'
import type { PreferencePriorityV2 } from '../../../types/assessment-v2'
import type {
  InstitutionMatchingCriticalFieldPath,
  ReferenceMonthlyPrice,
} from '../../../types/institution'
import type {
  BudgetFit,
  HardConstraintResult,
  RecommendationMatchTier,
  RehabilitationFit,
  RegionFit,
  TypeFit,
} from '../../../types/recommendation'
import type {
  ActivityFitV2,
  ElderEvidenceRefV2,
  InstitutionEvidenceRefV2,
  MealScheduleFitEvaluationV2,
  NutritionDisplayEvaluationV2,
  PriorityFactorResultV2,
  PriorityFitVectorV2,
  RecommendationAdvisoryV2,
  RecommendationCandidateEvaluationV2,
  RecommendationDifferenceV2,
  RecommendationEvaluationResultV2,
  RecommendationNoExactMatchV2,
  RecommendationPoolManifestV2,
  RecommendationRankParticipationV2,
  RecommendationRankTupleV2,
  RecommendationReasonV2,
  RecommendationSemanticResultV2,
  RecommendationVersionsV2,
  RoomFitEvaluationV2,
} from '../../../types/recommendation-v2'
import {
  effectiveCapabilityStatus,
  effectiveReferenceMonthlyPrice,
  effectiveStableCode,
  effectiveStableCodeList,
  matchingEvidenceRef,
} from '../institution'
import {
  evaluateFrozenSafetyCore,
} from '../core'
import type { ValidatedProfileSnapshotV2 } from './profile-v2'
import {
  derivedEvidenceRefsV2,
  rawPreferenceEvidenceRefV2,
} from './profile-v2'
import type { ValidatedInstitutionFactsV2 } from './institution-v2'
import {
  currentExtensionStableCodeV2,
  extensionEvidenceRefV2,
} from './institution-v2'
import { evaluatePriorityFitV2 } from './priority-v2'
import {
  compareAsciiV2,
  copyDomainDataV2,
  sortAsciiV2,
} from './rules-v2'

export interface SemanticCoreInputV2 {
  profileSnapshot: ValidatedProfileSnapshotV2
  institutionFacts: readonly ValidatedInstitutionFactsV2[]
  poolManifest: RecommendationPoolManifestV2
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  versions: RecommendationVersionsV2
}

interface BaseFitsWithPrice {
  budget: BudgetFit
  type: TypeFit
  region: RegionFit
  rehabilitation: RehabilitationFit
  referencePrice: ReferenceMonthlyPrice | null
}

interface EvaluatedCandidateV2 {
  item: RecommendationCandidateEvaluationV2
  exact: boolean
  tier: RecommendationMatchTier | null
}

const REHABILITATION_PATH: InstitutionMatchingCriticalFieldPath =
  'capabilities.specialCare.rehabilitation_training'

const MONTHLY_BUDGET_RANGES: Readonly<Record<
  Exclude<MonthlyRange, 'unknown' | 'cny_15000_plus'>,
  { min: number, max: number }
>> = {
  cny_3500_5000: { min: 350000, max: 500000 },
  cny_5000_8000: { min: 500000, max: 800000 },
  cny_8000_12000: { min: 800000, max: 1200000 },
  cny_12000_15000: { min: 1200000, max: 1500000 },
}

const evidenceKey = (ref: ElderEvidenceRefV2): string => JSON.stringify(ref)

const uniqueElderRefs = (refs: readonly ElderEvidenceRefV2[]): ElderEvidenceRefV2[] => {
  const keys: string[] = []
  const result: ElderEvidenceRefV2[] = []
  refs.forEach((ref) => {
    const key = evidenceKey(ref)
    if (keys.indexOf(key) < 0) {
      keys.push(key)
      result.push(ref)
    }
  })
  return result
}

const budgetRef = (profile: ValidatedProfileSnapshotV2['profile']): ElderEvidenceRefV2 => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: profile.financial.rawFacts.monthlyBudget,
})

const typeRef = (profile: ValidatedProfileSnapshotV2['profile']): ElderEvidenceRefV2 => ({
  kind: 'profile_raw_fact',
  profilePath: 'preference.rawFacts.preferredInstitutionType',
  sourceQuestionId: 'preference.careType',
  valueSnapshot: profile.preference.rawFacts.preferredInstitutionType,
})

const regionRef = (profile: ValidatedProfileSnapshotV2['profile']): ElderEvidenceRefV2 => {
  const region = profile.preference.rawFacts.regionPreference
  return {
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: region === undefined ? 'absent' : 'provided',
    valueSnapshot: region === undefined ? null : region,
  }
}

const makeReason = (
  reasonCode: RecommendationReasonV2['reasonCode'],
  reasonType: RecommendationReasonV2['reasonType'],
  polarity: RecommendationReasonV2['polarity'],
  elderEvidenceRefs: readonly ElderEvidenceRefV2[],
  institutionEvidenceRefs: readonly InstitutionEvidenceRefV2[],
): RecommendationReasonV2 => ({
  reasonCode,
  reasonType,
  polarity,
  elderEvidenceRefs: uniqueElderRefs(elderEvidenceRefs),
  institutionEvidenceRefs: institutionEvidenceRefs.slice(),
})

const makeDifference = (
  differenceCode: RecommendationDifferenceV2['differenceCode'],
  differenceCategory: RecommendationDifferenceV2['differenceCategory'],
  differenceType: RecommendationDifferenceV2['differenceType'],
  severity: RecommendationDifferenceV2['severity'],
  elderEvidenceRefs: readonly ElderEvidenceRefV2[],
  institutionEvidenceRefs: readonly InstitutionEvidenceRefV2[],
): RecommendationDifferenceV2 => ({
  differenceCode,
  differenceCategory,
  differenceType,
  severity,
  elderEvidenceRefs: uniqueElderRefs(elderEvidenceRefs),
  institutionEvidenceRefs: institutionEvidenceRefs.slice(),
})

const budgetFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  referencePrice: ReferenceMonthlyPrice | null,
): BudgetFit => {
  const budget = profile.financial.rawFacts.monthlyBudget
  if (budget === 'unknown' || budget === 'cny_15000_plus' || referencePrice === null) return 'unknown'
  const declared = MONTHLY_BUDGET_RANGES[budget]
  const range = referencePrice.range
  if (range.kind === 'starting_at') {
    return range.min.amountMinor > declared.max ? 'above_budget' : 'partially_overlapping'
  }
  if (range.max.amountMinor < declared.min) return 'below_declared_range'
  if (range.min.amountMinor > declared.max) return 'above_budget'
  if (range.min.amountMinor >= declared.min && range.max.amountMinor <= declared.max) return 'within_budget'
  return 'partially_overlapping'
}

const typeFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): TypeFit => {
  const preferred = profile.preference.rawFacts.preferredInstitutionType
  if (preferred === 'unknown') return 'not_applicable'
  const supported = effectiveStableCodeList(facts.baseFacts, 'typeProfile.supportedTypes')
  if (supported === null) return 'unknown'
  return supported.indexOf(preferred) >= 0 ? 'match' : 'mismatch'
}

const regionFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): RegionFit => {
  const preference = profile.preference.rawFacts.regionPreference
  if (preference === undefined || preference.kind === 'no_preference') return 'not_applicable'
  const region = effectiveStableCode(facts.baseFacts, 'identity.regionCode')
  if (region === null) return 'unknown'
  return region === preference.regionCode ? 'same' : 'different'
}

const rehabilitationFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
  hardPaths: readonly InstitutionMatchingCriticalFieldPath[],
): RehabilitationFit => {
  if (hardPaths.indexOf(REHABILITATION_PATH) >= 0) return 'not_applicable'
  const rehabilitation = profile.health.derivedFacts.rehabilitationNeed
  if (rehabilitation.status !== 'known' || rehabilitation.value === 'not_required') return 'not_applicable'
  return effectiveCapabilityStatus(facts.baseFacts, REHABILITATION_PATH)
}

const baseFitsFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
  hardPaths: readonly InstitutionMatchingCriticalFieldPath[],
): BaseFitsWithPrice => {
  const referencePrice = effectiveReferenceMonthlyPrice(facts.baseFacts)
  return {
    budget: budgetFitFor(profile, referencePrice),
    type: typeFitFor(profile, facts),
    region: regionFitFor(profile, facts),
    rehabilitation: rehabilitationFitFor(profile, facts, hardPaths),
    referencePrice,
  }
}

const roomFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): RoomFitEvaluationV2 => {
  const preference = profile.preference.rawFacts.roomTypePreference
  const elderRefs = [rawPreferenceEvidenceRefV2(profile, 'room')]
  if (preference === 'no_preference') {
    return { fit: 'not_applicable', rankParticipation: 'not_applicable', elderEvidenceRefs: elderRefs, institutionEvidenceRefs: [] }
  }
  const compatible = preference === 'single' ? 'single'
    : preference === 'double' ? 'double' : 'multi_bed'
  const roomRefs = facts.extensionFields.filter((entry) => entry.fieldPath.indexOf('rooms.') === 0
    && entry.fieldPath.endsWith('.roomType'))
  const matched = roomRefs.find((ref) => currentExtensionStableCodeV2(ref) === compatible)
  return matched
    ? { fit: 'match', rankParticipation: 'baseline', elderEvidenceRefs: elderRefs, institutionEvidenceRefs: [matched] }
    : { fit: 'unknown', rankParticipation: 'baseline', elderEvidenceRefs: elderRefs, institutionEvidenceRefs: roomRefs }
}

const mealFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): MealScheduleFitEvaluationV2 => {
  const preference = profile.preference.rawFacts.mealSchedulePreference
  const elderRefs = [rawPreferenceEvidenceRefV2(profile, 'meal')]
  if (preference === 'no_preference') {
    return {
      fit: 'not_applicable', sourceState: 'not_applicable', rankParticipation: 'not_applicable',
      elderEvidenceRefs: elderRefs, institutionEvidenceRefs: [],
    }
  }
  const ref = extensionEvidenceRefV2(facts, 'meal.mealSchedule')
  if (ref.rawAvailability === 'unavailable') {
    return {
      fit: 'unknown', sourceState: 'data_unavailable', rankParticipation: 'baseline',
      elderEvidenceRefs: elderRefs, institutionEvidenceRefs: [ref],
    }
  }
  const schedule = currentExtensionStableCodeV2(ref)
  if (schedule === null || schedule === 'unknown' || schedule === 'other') {
    return {
      fit: 'unknown', sourceState: 'unknown', rankParticipation: 'baseline',
      elderEvidenceRefs: elderRefs, institutionEvidenceRefs: [ref],
    }
  }
  return {
    fit: schedule === preference ? 'match' : 'mismatch',
    sourceState: 'known',
    rankParticipation: 'baseline',
    elderEvidenceRefs: elderRefs,
    institutionEvidenceRefs: [ref],
  }
}

const activityFitFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): ActivityFitV2 => {
  const displayFacts: ActivityFitV2['displayFacts'][number][] = []
  ;(['activity.indoorSpace', 'activity.outdoorSpace'] as const).forEach((path) => {
    const ref = extensionEvidenceRefV2(facts, path)
    const value = currentExtensionStableCodeV2(ref)
    if (value === 'present' || value === 'absent') {
      displayFacts.push({ fieldPath: path, value, institutionEvidenceRef: ref })
    }
  })
  return {
    preference: profile.preference.rawFacts.activityPreference,
    displayFacts,
    rankParticipation: 'not_scorable',
    elderEvidenceRefs: [rawPreferenceEvidenceRefV2(profile, 'activity')],
  }
}

const nutritionFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
): NutritionDisplayEvaluationV2 => {
  const textureFact = profile.nutrition.derivedFacts.foodTextureSupport
  const elderRefs = derivedEvidenceRefsV2('nutrition.foodTextureSupport', textureFact)
  if (textureFact.status !== 'known' || textureFact.value === 'standard') {
    return {
      texture: textureFact.status === 'known' ? textureFact.value : 'standard',
      status: textureFact.status === 'known' ? 'not_applicable' : 'unknown',
      rankParticipation: 'not_applicable',
      elderEvidenceRefs: elderRefs,
      institutionEvidenceRefs: [],
    }
  }
  const path = textureFact.value === 'easy_chew'
    ? 'meal.easyChewSupport' as const : 'meal.modifiedFoodSupport' as const
  const ref = extensionEvidenceRefV2(facts, path)
  const value = currentExtensionStableCodeV2(ref)
  const status = value === 'available' ? 'supported'
    : value === 'unavailable' ? 'unavailable'
      : value === 'requires_inquiry' ? 'requires_inquiry' : 'unknown'
  return {
    texture: textureFact.value,
    status,
    rankParticipation: 'not_applicable',
    elderEvidenceRefs: elderRefs,
    institutionEvidenceRefs: [ref],
  }
}

const hasHardOutcome = (
  constraints: readonly HardConstraintResult[],
  outcome: HardConstraintResult['outcome'],
): boolean => constraints.some((constraint) => constraint.outcome === outcome)

const exactFor = (
  snapshot: ValidatedProfileSnapshotV2,
  constraints: readonly HardConstraintResult[],
  fits: BaseFitsWithPrice,
  roomFit: RoomFitEvaluationV2,
  mealFit: MealScheduleFitEvaluationV2,
): boolean => snapshot.elderReadiness === 'ready'
  && constraints.every((constraint) => constraint.outcome === 'satisfied' || constraint.outcome === 'not_applicable')
  && fits.budget === 'within_budget'
  && fits.type !== 'unknown' && fits.type !== 'mismatch'
  && fits.region !== 'unknown' && fits.region !== 'different'
  && (fits.rehabilitation === 'not_applicable' || fits.rehabilitation === 'supported')
  && (roomFit.fit === 'not_applicable' || roomFit.fit === 'match')
  && (mealFit.fit === 'not_applicable' || mealFit.fit === 'match')

const tierFor = (
  readiness: ValidatedProfileSnapshotV2['elderReadiness'],
  constraints: readonly HardConstraintResult[],
  exact: boolean,
): RecommendationMatchTier | null => {
  if (readiness !== 'ready') return hasHardOutcome(constraints, 'conflict') ? 'INELIGIBLE' : null
  if (hasHardOutcome(constraints, 'conflict')) return 'INELIGIBLE'
  if (hasHardOutcome(constraints, 'unverified')) return 'UNVERIFIED'
  if (hasHardOutcome(constraints, 'conditional')) return 'CONDITIONAL'
  return exact ? 'EXACT' : 'SOFT_NEAR'
}

const rankParticipationFor = (
  profile: ValidatedProfileSnapshotV2['profile'],
  fits: BaseFitsWithPrice,
  roomFit: RoomFitEvaluationV2,
  mealFit: MealScheduleFitEvaluationV2,
  hardPaths: readonly InstitutionMatchingCriticalFieldPath[],
  priorityFactors: readonly PriorityFactorResultV2[],
): RecommendationRankParticipationV2 => {
  const priorities = profile.preference.rawFacts.priorities
  const priceSelected = priorities.indexOf('price') >= 0
  const regionSelected = priorities.indexOf('region') >= 0
  const rehabSelected = priorities.indexOf('rehabilitation_capability') >= 0
  const activePriority = priorityFactors.some((factor) => factor.rankParticipation === 'selected_priority')
  return {
    priority: activePriority ? 'selected_priority' : 'not_scorable',
    budget: priceSelected ? 'consumed_by_priority' : 'baseline',
    type: fits.type === 'not_applicable' ? 'not_applicable' : 'baseline',
    region: fits.region === 'not_applicable' ? 'not_applicable'
      : regionSelected ? 'consumed_by_priority' : 'baseline',
    rehabilitation: hardPaths.indexOf(REHABILITATION_PATH) >= 0 ? 'consumed_by_hard'
      : fits.rehabilitation === 'not_applicable' ? 'not_applicable'
        : rehabSelected ? 'consumed_by_priority' : 'baseline',
    room: roomFit.rankParticipation,
    mealSchedule: mealFit.rankParticipation,
    activity: 'not_scorable',
    nutrition: 'not_applicable',
  }
}

const hardReasonCode = (
  constraintCode: string,
  outcome: HardConstraintResult['outcome'],
): RecommendationReasonV2['reasonCode'] => {
  if (outcome === 'conditional') return 'REQUIREMENT_REQUIRES_ASSESSMENT'
  if (outcome === 'unverified') return 'REQUIREMENT_UNVERIFIED'
  if (outcome === 'conflict') return 'REQUIREMENT_UNSUPPORTED'
  if (constraintCode === 'CARE_LEVEL_ACCEPTANCE') return 'CARE_LEVEL_SUPPORTED'
  if (constraintCode === 'MOBILITY_SUPPORT') return 'MOBILITY_SUPPORTED'
  if (constraintCode === 'TRANSFER_SUPPORT') return 'TRANSFER_SUPPORTED'
  if (constraintCode === 'DEMENTIA_ACCEPTANCE') return 'COGNITIVE_ACCEPTANCE_SUPPORTED'
  if (constraintCode === 'WANDERING_RISK_SUPPORT') return 'WANDERING_SUPPORT_SUPPORTED'
  return 'SPECIAL_CARE_SUPPORTED'
}

const hardOutputs = (
  constraints: readonly HardConstraintResult[],
  reasons: RecommendationReasonV2[],
  differences: RecommendationDifferenceV2[],
): void => constraints.forEach((constraint) => {
  if (constraint.outcome === 'not_applicable') return
  const polarity = constraint.outcome === 'satisfied' ? 'supported'
    : constraint.outcome === 'conditional' ? 'conditional'
      : constraint.outcome === 'unverified' ? 'unverified' : 'conflict'
  reasons.push(makeReason(
    hardReasonCode(constraint.constraintCode, constraint.outcome),
    'care_capability',
    polarity,
    constraint.elderEvidenceRefs,
    constraint.institutionEvidenceRefs,
  ))
  if (constraint.outcome === 'conflict') {
    differences.push(makeDifference('HARD_CAPABILITY_UNSUPPORTED', 'HARD_CONFLICT', 'hard_conflict', 'blocking',
      constraint.elderEvidenceRefs, constraint.institutionEvidenceRefs))
  } else if (constraint.outcome === 'conditional') {
    differences.push(makeDifference('CAPABILITY_REQUIRES_ASSESSMENT', 'CONDITIONAL_REQUIREMENT', 'requires_assessment', 'important',
      constraint.elderEvidenceRefs, constraint.institutionEvidenceRefs))
  } else if (constraint.outcome === 'unverified') {
    differences.push(makeDifference('CAPABILITY_NOT_VERIFIED', 'UNVERIFIED_DATA_GAP', 'unknown_capability', 'important',
      constraint.elderEvidenceRefs, constraint.institutionEvidenceRefs))
  }
})

const baseFitOutputs = (
  profile: ValidatedProfileSnapshotV2['profile'],
  facts: ValidatedInstitutionFactsV2,
  fits: BaseFitsWithPrice,
  reasons: RecommendationReasonV2[],
  differences: RecommendationDifferenceV2[],
): void => {
  const priceRef = matchingEvidenceRef(facts.baseFacts, 'price.referenceMonthlyPrice')
  const budgetRefs = [budgetRef(profile)]
  if (fits.budget === 'within_budget') reasons.push(makeReason('BUDGET_WITHIN_RANGE', 'budget', 'supported', budgetRefs, [priceRef]))
  else if (fits.budget === 'partially_overlapping') {
    reasons.push(makeReason('BUDGET_PARTIAL_OVERLAP', 'budget', 'difference', budgetRefs, [priceRef]))
    differences.push(makeDifference('BUDGET_PARTIAL_OVERLAP', 'SOFT_DIFFERENCE', 'budget', 'important', budgetRefs, [priceRef]))
  } else if (fits.budget === 'above_budget') {
    reasons.push(makeReason('BUDGET_ABOVE_RANGE', 'budget', 'difference', budgetRefs, [priceRef]))
    differences.push(makeDifference('BUDGET_ABOVE_RANGE', 'SOFT_DIFFERENCE', 'budget', 'important', budgetRefs, [priceRef]))
  } else if (fits.budget === 'below_declared_range') {
    reasons.push(makeReason('BUDGET_BELOW_DECLARED_RANGE', 'budget', 'difference', budgetRefs, [priceRef]))
    differences.push(makeDifference('BUDGET_BELOW_DECLARED_RANGE', 'SOFT_DIFFERENCE', 'budget', 'important', budgetRefs, [priceRef]))
  } else {
    reasons.push(makeReason('BUDGET_UNKNOWN', 'budget', 'unverified', budgetRefs, [priceRef]))
    differences.push(makeDifference('BUDGET_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'budget', 'important', budgetRefs, [priceRef]))
  }
  if (fits.referencePrice !== null && fits.referencePrice.range.kind === 'starting_at') {
    differences.push(makeDifference('PRICE_UPPER_BOUND_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'budget', 'important', budgetRefs, [priceRef]))
  }

  const typeEvidence = [matchingEvidenceRef(facts.baseFacts, 'typeProfile.supportedTypes')]
  if (fits.type === 'match') reasons.push(makeReason('TYPE_MATCH', 'institution_type', 'supported', [typeRef(profile)], typeEvidence))
  else if (fits.type === 'mismatch') {
    reasons.push(makeReason('TYPE_DIFFERENT', 'institution_type', 'difference', [typeRef(profile)], typeEvidence))
    differences.push(makeDifference('TYPE_DIFFERENT', 'SOFT_DIFFERENCE', 'institution_type', 'advisory', [typeRef(profile)], typeEvidence))
  } else if (fits.type === 'unknown') {
    reasons.push(makeReason('TYPE_UNKNOWN', 'institution_type', 'unverified', [typeRef(profile)], typeEvidence))
    differences.push(makeDifference('TYPE_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'institution_type', 'advisory', [typeRef(profile)], typeEvidence))
  }

  const regionEvidence = [matchingEvidenceRef(facts.baseFacts, 'identity.regionCode')]
  if (fits.region === 'same') reasons.push(makeReason('REGION_MATCH', 'region', 'supported', [regionRef(profile)], regionEvidence))
  else if (fits.region === 'different') {
    reasons.push(makeReason('REGION_DIFFERENT', 'region', 'difference', [regionRef(profile)], regionEvidence))
    differences.push(makeDifference('REGION_DIFFERENT', 'SOFT_DIFFERENCE', 'region', 'advisory', [regionRef(profile)], regionEvidence))
  } else if (fits.region === 'unknown') {
    reasons.push(makeReason('REGION_UNKNOWN', 'region', 'unverified', [regionRef(profile)], regionEvidence))
    differences.push(makeDifference('REGION_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'region', 'advisory', [regionRef(profile)], regionEvidence))
  }

  if (fits.rehabilitation !== 'not_applicable') {
    const rehabElderRefs = derivedEvidenceRefsV2('health.rehabilitationNeed', profile.health.derivedFacts.rehabilitationNeed)
    const rehabInstitutionRefs = [matchingEvidenceRef(facts.baseFacts, REHABILITATION_PATH)]
    if (fits.rehabilitation === 'supported') {
      reasons.push(makeReason('REHABILITATION_SUPPORTED', 'medical_rehabilitation', 'supported', rehabElderRefs, rehabInstitutionRefs))
    } else {
      const reasonCode = fits.rehabilitation === 'requires_assessment' ? 'REQUIREMENT_REQUIRES_ASSESSMENT'
        : fits.rehabilitation === 'unknown' ? 'REQUIREMENT_UNVERIFIED' : 'REQUIREMENT_UNSUPPORTED'
      reasons.push(makeReason(reasonCode, 'medical_rehabilitation', fits.rehabilitation === 'requires_assessment'
        ? 'conditional' : fits.rehabilitation === 'unknown' ? 'unverified' : 'difference', rehabElderRefs, rehabInstitutionRefs))
      differences.push(makeDifference('REHABILITATION_SOFT_DATA_GAP',
        fits.rehabilitation === 'unknown' ? 'UNVERIFIED_DATA_GAP' : 'SOFT_DIFFERENCE',
        fits.rehabilitation === 'requires_assessment' ? 'requires_assessment'
          : fits.rehabilitation === 'unknown' ? 'unknown_capability' : 'data_quality',
        'important', rehabElderRefs, rehabInstitutionRefs))
    }
  }
}

const priorityOutputs = (
  factors: readonly PriorityFactorResultV2[],
  reasons: RecommendationReasonV2[],
  differences: RecommendationDifferenceV2[],
): void => factors.forEach((factor) => {
  if (factor.status === 'match') {
    reasons.push(makeReason('PRIORITY_STRUCTURED_MATCH', 'priority', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
  } else if (factor.status === 'partial' || factor.status === 'mismatch') {
    reasons.push(makeReason('PRIORITY_NOT_MET', 'priority', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    differences.push(makeDifference('PRIORITY_NOT_MET', 'SOFT_DIFFERENCE', 'priority', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
  } else if (factor.status === 'unknown') {
    reasons.push(makeReason('PRIORITY_UNVERIFIED', 'priority', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    differences.push(makeDifference('PRIORITY_UNVERIFIED', 'UNVERIFIED_DATA_GAP', 'priority', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
  } else if (factor.status === 'not_scorable') {
    reasons.push(makeReason('PRIORITY_NOT_SCORABLE', 'priority', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    differences.push(makeDifference('PRIORITY_NOT_SCORABLE', 'UNVERIFIED_DATA_GAP', 'priority', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
  }
})

const lifeFitOutputs = (
  room: RoomFitEvaluationV2,
  meal: MealScheduleFitEvaluationV2,
  nutrition: NutritionDisplayEvaluationV2,
  reasons: RecommendationReasonV2[],
  differences: RecommendationDifferenceV2[],
): void => {
  if (room.fit === 'match') {
    reasons.push(makeReason('ROOM_TYPE_MATCH', 'room_type', 'supported', room.elderEvidenceRefs, room.institutionEvidenceRefs))
  } else if (room.fit === 'unknown') {
    differences.push(makeDifference('ROOM_TYPE_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'room_type', 'important',
      room.elderEvidenceRefs, room.institutionEvidenceRefs))
  } else if (room.fit === 'mismatch') {
    differences.push(makeDifference('ROOM_TYPE_MISMATCH', 'SOFT_DIFFERENCE', 'room_type', 'important',
      room.elderEvidenceRefs, room.institutionEvidenceRefs))
  }

  if (meal.fit === 'match') {
    reasons.push(makeReason('MEAL_SCHEDULE_MATCH', 'meal_schedule', 'supported', meal.elderEvidenceRefs, meal.institutionEvidenceRefs))
  } else if (meal.fit === 'mismatch') {
    differences.push(makeDifference('MEAL_SCHEDULE_MISMATCH', 'SOFT_DIFFERENCE', 'meal_schedule', 'important',
      meal.elderEvidenceRefs, meal.institutionEvidenceRefs))
  } else if (meal.fit === 'unknown') {
    differences.push(makeDifference(
      meal.sourceState === 'data_unavailable' ? 'MEAL_SCHEDULE_DATA_UNAVAILABLE' : 'MEAL_SCHEDULE_UNKNOWN',
      'UNVERIFIED_DATA_GAP', 'meal_schedule', 'important', meal.elderEvidenceRefs, meal.institutionEvidenceRefs,
    ))
  }

  if (nutrition.status === 'supported') {
    reasons.push(makeReason(nutrition.texture === 'easy_chew' ? 'EASY_CHEW_SUPPORT' : 'MODIFIED_FOOD_SUPPORT',
      'nutrition', 'supported', nutrition.elderEvidenceRefs, nutrition.institutionEvidenceRefs))
  } else if (nutrition.status !== 'not_applicable' && nutrition.institutionEvidenceRefs.length > 0) {
    const prefix = nutrition.texture === 'easy_chew' ? 'EASY_CHEW_SUPPORT' : 'MODIFIED_FOOD_SUPPORT'
    const suffix = nutrition.status === 'unavailable' ? 'UNAVAILABLE'
      : nutrition.status === 'requires_inquiry' ? 'REQUIRES_INQUIRY' : 'UNKNOWN'
    differences.push(makeDifference(
      `${prefix}_${suffix}` as RecommendationDifferenceV2['differenceCode'],
      nutrition.status === 'unavailable' ? 'SOFT_DIFFERENCE' : 'UNVERIFIED_DATA_GAP',
      'nutrition', 'advisory', nutrition.elderEvidenceRefs, nutrition.institutionEvidenceRefs,
    ))
  }
}

const readinessOutputs = (
  snapshot: ValidatedProfileSnapshotV2,
  reasons: RecommendationReasonV2[],
  differences: RecommendationDifferenceV2[],
): void => {
  if (snapshot.elderReadiness === 'ready') return
  const refs = uniqueElderRefs(snapshot.requirementReadiness.reduce<ElderEvidenceRefV2[]>(
    (all, entry) => all.concat(entry.elderEvidenceRefs), [],
  ))
  reasons.push(makeReason('DATA_NOT_VERIFIED', 'data_quality', 'unverified', refs, []))
  differences.push(makeDifference('ELDER_REQUIREMENT_NEEDS_CONFIRMATION', 'UNVERIFIED_DATA_GAP',
    'data_quality', 'blocking', refs, []))
}

const tierOrdinal = (tier: RecommendationMatchTier | null): number =>
  tier === null ? 5 : ['EXACT', 'SOFT_NEAR', 'CONDITIONAL', 'UNVERIFIED', 'INELIGIBLE'].indexOf(tier)

const compareVector = (left: PriorityFitVectorV2, right: PriorityFitVectorV2): number => {
  if (left.matchedCount !== right.matchedCount) return right.matchedCount - left.matchedCount
  if (left.partialCount !== right.partialCount) return right.partialCount - left.partialCount
  if (left.knownMismatchCount !== right.knownMismatchCount) return left.knownMismatchCount - right.knownMismatchCount
  return left.unknownCount - right.unknownCount
}

const ordinal = (value: string, order: readonly string[]): number => order.indexOf(value)

const compareNullable = (
  left: string | null,
  right: string | null,
  order: readonly string[],
): number => left === null || right === null ? 0 : ordinal(left, order) - ordinal(right, order)

export const compareRankTuplesV2 = (
  left: RecommendationRankTupleV2,
  right: RecommendationRankTupleV2,
): number => {
  const tier = tierOrdinal(left.tier) - tierOrdinal(right.tier)
  if (tier !== 0) return tier
  const vector = compareVector(left.priorityFitVector, right.priorityFitVector)
  if (vector !== 0) return vector
  const comparisons = [
    compareNullable(left.budgetFit, right.budgetFit,
      ['within_budget', 'partially_overlapping', 'below_declared_range', 'above_budget', 'unknown']),
    compareNullable(left.institutionTypeFit, right.institutionTypeFit, ['match', 'unknown', 'mismatch']),
    compareNullable(left.regionFit, right.regionFit, ['same', 'unknown', 'different']),
    compareNullable(left.rehabilitationSoftFit, right.rehabilitationSoftFit,
      ['supported', 'requires_assessment', 'unknown', 'unsupported']),
    compareNullable(left.roomFit, right.roomFit, ['match', 'unknown', 'mismatch']),
    compareNullable(left.mealScheduleFit, right.mealScheduleFit, ['match', 'unknown', 'mismatch']),
  ]
  const nonZero = comparisons.find((result) => result !== 0)
  return nonZero === undefined ? compareAsciiV2(left.institutionId, right.institutionId) : nonZero
}

const buildCandidate = (
  profileSnapshot: ValidatedProfileSnapshotV2,
  facts: ValidatedInstitutionFactsV2,
): EvaluatedCandidateV2 => {
  const safety = evaluateFrozenSafetyCore(profileSnapshot.profile, facts.baseFacts)
  const constraints = safety.constraints
  const fits = baseFitsFor(profileSnapshot.profile, facts, safety.hardPaths)
  const roomFit = roomFitFor(profileSnapshot.profile, facts)
  const mealScheduleFit = mealFitFor(profileSnapshot.profile, facts)
  const activityFit = activityFitFor(profileSnapshot.profile, facts)
  const nutrition = nutritionFor(profileSnapshot.profile, facts)
  const priority = evaluatePriorityFitV2(
    profileSnapshot.profile, facts, fits.budget, fits.region, fits.rehabilitation, safety.hardPaths,
  )
  const exact = exactFor(profileSnapshot, constraints, fits, roomFit, mealScheduleFit)
  const tier = tierFor(profileSnapshot.elderReadiness, constraints, exact)
  const participation = rankParticipationFor(
    profileSnapshot.profile, fits, roomFit, mealScheduleFit, safety.hardPaths, priority.factors,
  )
  const reasons: RecommendationReasonV2[] = []
  const differences: RecommendationDifferenceV2[] = []
  hardOutputs(constraints, reasons, differences)
  baseFitOutputs(profileSnapshot.profile, facts, fits, reasons, differences)
  priorityOutputs(priority.factors, reasons, differences)
  lifeFitOutputs(roomFit, mealScheduleFit, nutrition, reasons, differences)
  readinessOutputs(profileSnapshot, reasons, differences)
  const rankTuple: RecommendationRankTupleV2 | null = profileSnapshot.elderReadiness !== 'ready' || tier === null
    ? null
    : {
      tier,
      priorityFitVector: priority.vector,
      budgetFit: participation.budget === 'baseline' ? fits.budget : null,
      institutionTypeFit: participation.type === 'baseline' ? fits.type : null,
      regionFit: participation.region === 'baseline' ? fits.region : null,
      rehabilitationSoftFit: participation.rehabilitation === 'baseline' ? fits.rehabilitation : null,
      roomFit: participation.room === 'baseline' && roomFit.fit !== 'not_applicable' ? roomFit.fit : null,
      mealScheduleFit: participation.mealSchedule === 'baseline' && mealScheduleFit.fit !== 'not_applicable'
        ? mealScheduleFit.fit : null,
      institutionId: facts.institutionId,
    }
  return {
    exact,
    tier,
    item: {
      institutionId: facts.institutionId,
      recordRevision: facts.recordRevision,
      matchTier: tier,
      constraintResults: constraints,
      baseFits: {
        budget: fits.budget,
        type: fits.type,
        region: fits.region,
        rehabilitation: fits.rehabilitation,
      },
      roomFit,
      mealScheduleFit,
      activityFit,
      nutrition,
      priorityFactors: priority.factors,
      priorityFitVector: priority.vector,
      rankTuple,
      rankParticipation: rankTuple === null ? null : participation,
      reasons,
      differences,
    },
  }
}

const sortCandidates = (candidates: readonly EvaluatedCandidateV2[]): EvaluatedCandidateV2[] =>
  candidates.slice().sort((left, right) => {
    if (left.item.rankTuple && right.item.rankTuple) return compareRankTuplesV2(left.item.rankTuple, right.item.rankTuple)
    const tier = tierOrdinal(left.tier) - tierOrdinal(right.tier)
    return tier !== 0 ? tier : compareAsciiV2(left.item.institutionId, right.item.institutionId)
  })

const topThree = (values: readonly EvaluatedCandidateV2[]): RecommendationCandidateEvaluationV2[] =>
  values.slice(0, 3).map((entry) => copyDomainDataV2(entry.item))

const makeNoExactMatch = (
  profileSnapshot: ValidatedProfileSnapshotV2,
  includedCount: number,
  candidates: readonly EvaluatedCandidateV2[],
  softNear: readonly EvaluatedCandidateV2[],
  conditional: readonly EvaluatedCandidateV2[],
): RecommendationNoExactMatchV2 => {
  const reasonCode = includedCount === 0 ? 'NO_VERIFIED_INSTITUTION_POOL'
    : profileSnapshot.elderReadiness !== 'ready' ? 'REQUIRED_CAPABILITY_UNRESOLVED'
      : candidates.length > 0 && candidates.every((candidate) => candidate.tier === 'INELIGIBLE')
        ? 'ALL_CANDIDATES_HAVE_HARD_CONFLICT'
        : softNear.length > 0 ? 'ONLY_SOFT_NEAR_MATCHES'
          : conditional.length > 0 ? 'ONLY_CONDITIONAL_CANDIDATES'
            : 'REQUIRED_CAPABILITY_UNRESOLVED'
  return {
    code: 'NO_EXACT_MATCH',
    reasonCode,
    unmetHardRequirements: candidates.reduce<HardConstraintResult[]>((all, candidate) =>
      all.concat(candidate.item.constraintResults.filter((constraint) => constraint.outcome === 'conflict')), []),
    unverifiedRequirements: candidates.reduce<HardConstraintResult[]>((all, candidate) =>
      all.concat(candidate.item.constraintResults.filter((constraint) =>
        constraint.outcome === 'conditional' || constraint.outcome === 'unverified')), []),
    nearMatches: softNear.length > 0 ? topThree(softNear) : [],
    differences: candidates.reduce<RecommendationDifferenceV2[]>((all, candidate) =>
      all.concat(candidate.item.differences), []),
    elderClarifications: profileSnapshot.elderClarifications.map(copyDomainDataV2),
  }
}

const buildAdvisories = (
  profileSnapshot: ValidatedProfileSnapshotV2,
): RecommendationAdvisoryV2[] => profileSnapshot.profile.financial.derivedFacts.budgetAdvisories.map((advisory) => {
  const ids = sortAsciiV2(
    [...advisory.evidenceIds, ...advisory.triggerEvidenceIds]
      .filter((id, index, values) => values.indexOf(id) === index),
    (id) => id,
  )
  const refs = ids.map((evidenceId) => {
    const evidence = profileSnapshot.profile.evidence.find((entry) => entry.evidenceId === evidenceId)
    if (!evidence) throw new Error('validated advisory evidence missing')
    return {
      kind: 'derived_evidence_v2' as const,
      derivedField: evidence.derivedField,
      evidenceId,
    }
  })
  return {
    code: advisory.code,
    role: 'advisory_only',
    status: 'present',
    rankParticipation: 'not_applicable',
    triggerCodes: advisory.triggerCodes.slice(),
    elderEvidenceRefs: refs,
    institutionEvidenceRefs: [],
  }
})

export const deriveRecommendationSemanticsV2 = (
  input: SemanticCoreInputV2,
): RecommendationEvaluationResultV2<RecommendationSemanticResultV2> => {
  const candidates = sortCandidates(input.institutionFacts.map((facts) =>
    buildCandidate(input.profileSnapshot, facts)))
  const exact = candidates.filter((candidate) => candidate.tier === 'EXACT')
  const softNear = candidates.filter((candidate) => candidate.tier === 'SOFT_NEAR')
  const conditional = candidates.filter((candidate) => candidate.tier === 'CONDITIONAL')
  const cards = input.profileSnapshot.elderReadiness !== 'ready' ? []
    : exact.length > 0 ? topThree(exact)
      : softNear.length > 0 ? topThree(softNear) : []
  const conditionalCandidates = input.profileSnapshot.elderReadiness === 'ready'
    && exact.length === 0 && softNear.length === 0 ? topThree(conditional) : []
  const exactMatch = exact.length > 0
  return {
    ok: true,
    value: {
      versions: copyDomainDataV2(input.versions),
      policy: 'CONSERVATIVE_EXACT_WITH_CONDITIONAL',
      evaluationAsOf: input.evaluationAsOf,
      datasetVersion: input.datasetVersion,
      datasetMode: input.datasetMode,
      elderSnapshot: copyDomainDataV2(input.profileSnapshot.snapshot),
      poolManifest: copyDomainDataV2(input.poolManifest),
      elderReadiness: input.profileSnapshot.elderReadiness,
      requirementReadiness: input.profileSnapshot.requirementReadiness.map(copyDomainDataV2),
      elderClarifications: input.profileSnapshot.elderClarifications.map(copyDomainDataV2),
      cards,
      conditionalCandidates,
      candidateEvaluations: candidates.map((candidate) => copyDomainDataV2(candidate.item)),
      advisories: buildAdvisories(input.profileSnapshot),
      exactMatch,
      ...(exactMatch ? {} : {
        noExactMatch: makeNoExactMatch(
          input.profileSnapshot, input.institutionFacts.length, candidates, softNear, conditional,
        ),
      }),
    },
  }
}

export const ROOM_TYPE_MISMATCH_RUNTIME_V2 = 'NOT_PRODUCIBLE' as const
export const ACTIVITY_MATCHING_RUNTIME_V2 = 'DISPLAY_ONLY_NOT_SCORABLE' as const
export const MEAL_SCHEDULE_COMPARATOR_V2 = 'EXACT_STABLE_CODE_ONLY' as const
export const STRUCTURED_UNKNOWN_EXACT_POLICY_V2 = 'UNKNOWN_DOWNGRADES_EXACT_TO_SOFT_NEAR' as const
export const RANK_TUPLE_POLICY_V2 = 'PRESERVE_ESTABLISHED_FACTORS_FIRST' as const

export type RecommendationPriorityCodeRuntimeV2 = PreferencePriorityV2
