import type {
  PreferencePriority,
} from '../../types/assessment'
import type {
  ElderProfileDerivedField,
} from '../../types/elder-profile'
import type {
  InstitutionMatchingCriticalFieldPath,
  InstitutionEffectiveCapabilityStatus,
} from '../../types/institution'
import type {
  ElderEvidenceRef,
  NamedFactorResult,
  PriorityFitStatus,
  PriorityFitVector,
  RecommendationFactorRankParticipation,
  RegionFit,
  BudgetFit,
  RehabilitationFit,
} from '../../types/recommendation'
import type { EffectiveInstitutionFacts } from './institution'
import type { RecommendationCoreProfile } from './profile'
import {
  effectiveCapabilityStatus,
  institutionEvidenceRefsFor,
  matchingEvidenceRef,
} from './institution'
import { derivedEvidenceRefs } from './profile'
import { sortByStablePriorityCode } from './rules'

type ProfileForPriority = RecommendationCoreProfile

export interface PriorityEvaluation {
  factors: readonly NamedFactorResult[]
  vector: PriorityFitVector
  rankParticipation: RecommendationFactorRankParticipation
}

const PRIORITY_DERIVED_FIELDS: Readonly<Record<string, ElderProfileDerivedField>> = {
  rehabilitation_training: 'specialCare.requiredCareCapabilities.rehabilitation_training',
}

const PRICE_PRIORITY = 'price' as const
const CLOSE_PRIORITY = 'close_to_family' as const
const REHABILITATION_PRIORITY = 'rehabilitation_capability' as const
const DEMENTIA_PRIORITY = 'dementia_care' as const

const REHABILITATION_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.specialCare.rehabilitation_training'
const DEMENTIA_ACCEPTANCE_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.cognitiveSupport.dementia_acceptance'
const DEMENTIA_UNIT_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.specialCare.dementia_unit'

const makePriorityRef = (
  profile: ProfileForPriority,
): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'preference.rawFacts.priorities',
  sourceQuestionId: 'preference.priorities',
  valueSnapshot: sortByStablePriorityCode(profile.preference.rawFacts.priorities),
})

const makeRegionRef = (profile: ProfileForPriority): ElderEvidenceRef => {
  const region = profile.preference.rawFacts.regionPreference
  return {
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: region === undefined ? 'absent' : 'provided',
    valueSnapshot: region === undefined ? null : region,
  }
}

const makeBudgetRef = (profile: ProfileForPriority): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: profile.financial.rawFacts.monthlyBudget,
})

const budgetStatus = (fit: BudgetFit): PriorityFitStatus => {
  if (fit === 'within_budget') {
    return 'match'
  }
  if (fit === 'partially_overlapping') {
    return 'partial'
  }
  if (fit === 'below_declared_range' || fit === 'above_budget') {
    return 'mismatch'
  }
  return 'unknown'
}

const regionStatus = (fit: RegionFit): PriorityFitStatus => {
  if (fit === 'same') {
    return 'match'
  }
  if (fit === 'different') {
    return 'mismatch'
  }
  if (fit === 'unknown') {
    return 'unknown'
  }
  return 'not_applicable'
}

const rehabilitationStatus = (fit: RehabilitationFit): PriorityFitStatus => {
  if (fit === 'supported') {
    return 'match'
  }
  if (fit === 'requires_assessment') {
    return 'partial'
  }
  if (fit === 'unsupported') {
    return 'mismatch'
  }
  if (fit === 'unknown') {
    return 'unknown'
  }
  return 'not_applicable'
}

const dementiaStatus = (
  statuses: readonly InstitutionEffectiveCapabilityStatus[],
): PriorityFitStatus => {
  if (statuses.some((status) => status === 'unsupported')) {
    return 'mismatch'
  }
  if (statuses.some((status) => status === 'unknown')) {
    return 'unknown'
  }
  if (statuses.some((status) => status === 'requires_assessment')) {
    return 'partial'
  }
  return 'match'
}

const countVector = (statuses: readonly PriorityFitStatus[]): PriorityFitVector => ({
  matchedCount: statuses.filter((status) => status === 'match').length,
  partialCount: statuses.filter((status) => status === 'partial').length,
  knownMismatchCount: statuses.filter((status) => status === 'mismatch').length,
  unknownCount: statuses.filter((status) => status === 'unknown').length,
})

const selectedPriorityParticipation = (
  status: PriorityFitStatus,
): RecommendationFactorRankParticipation => {
  if (status === 'not_scorable') {
    return 'not_scorable'
  }
  if (status === 'not_applicable') {
    return 'not_applicable'
  }
  return 'selected_priority'
}

const makeNotScorableFactor = (
  profile: ProfileForPriority,
  priority: PreferencePriority,
): NamedFactorResult => ({
  factorCode: 'priority_fit',
  priorityCode: priority,
  status: 'not_scorable',
  rankParticipation: 'not_scorable',
    elderEvidenceRefs: [makePriorityRef(profile)],
  institutionEvidenceRefs: [],
})

const makePriceFactor = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  budget: BudgetFit,
): NamedFactorResult => ({
  factorCode: 'priority_fit',
  priorityCode: PRICE_PRIORITY,
  status: budgetStatus(budget),
  rankParticipation: selectedPriorityParticipation(budgetStatus(budget)),
  elderEvidenceRefs: [makePriorityRef(profile), makeBudgetRef(profile)],
  institutionEvidenceRefs: [matchingEvidenceRef(facts, 'price.referenceMonthlyPrice')],
})

const makeCloseFactor = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  region: RegionFit,
): NamedFactorResult => {
  const status = regionStatus(region)
  return {
    factorCode: 'priority_fit',
    priorityCode: CLOSE_PRIORITY,
    status: status === 'not_applicable' ? 'not_scorable' : status,
    rankParticipation: status === 'not_applicable' ? 'not_scorable' : selectedPriorityParticipation(status),
    elderEvidenceRefs: [makePriorityRef(profile), makeRegionRef(profile)],
    institutionEvidenceRefs: region === 'not_applicable'
      ? []
      : [matchingEvidenceRef(facts, 'identity.regionCode')],
  }
}

const makeRehabilitationFactor = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  rehabilitation: RehabilitationFit,
  directHard: boolean,
): NamedFactorResult => {
  const status = directHard
    ? 'not_applicable'
    : rehabilitationStatus(rehabilitation === 'not_applicable'
      ? effectiveCapabilityStatus(facts, REHABILITATION_PATH)
      : rehabilitation)
  const participation: RecommendationFactorRankParticipation = directHard
    ? 'consumed_by_hard'
    : selectedPriorityParticipation(status)
  const derivedField = PRIORITY_DERIVED_FIELDS.rehabilitation_training
  const rehabilitationFact = profile.specialCare.derivedFacts.requiredCareCapabilities
    .find((entry) => entry.capability === 'rehabilitation_training')
  return {
    factorCode: 'priority_fit',
    priorityCode: REHABILITATION_PRIORITY,
    status,
    rankParticipation: participation,
    elderEvidenceRefs: [
      makePriorityRef(profile),
      ...(rehabilitationFact === undefined ? [] : derivedEvidenceRefs(derivedField, rehabilitationFact)),
    ],
    institutionEvidenceRefs: [matchingEvidenceRef(facts, REHABILITATION_PATH)],
  }
}

const makeDementiaFactor = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
): NamedFactorResult => {
  const paths: readonly InstitutionMatchingCriticalFieldPath[] = [DEMENTIA_ACCEPTANCE_PATH, DEMENTIA_UNIT_PATH]
  const statuses = paths.map((path) => effectiveCapabilityStatus(facts, path))
  const subStatuses = paths.map((path, index) => ({
    fieldPath: path,
    status: statuses[index],
    institutionEvidenceRefs: [matchingEvidenceRef(facts, path)],
  }))
  const activeStatuses = statuses.filter((_status, index) => !hardPaths.has(paths[index]))
  const status: PriorityFitStatus = activeStatuses.length === 0
    ? 'not_applicable'
    : dementiaStatus(activeStatuses)
  return {
    factorCode: 'priority_fit',
    priorityCode: DEMENTIA_PRIORITY,
    status,
    rankParticipation: activeStatuses.length === 0
      ? 'consumed_by_hard'
      : selectedPriorityParticipation(status),
    subStatuses,
    elderEvidenceRefs: [makePriorityRef(profile)],
    institutionEvidenceRefs: institutionEvidenceRefsFor(facts, paths.filter((path) => !hardPaths.has(path))),
  }
}

const makeFactor = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  priority: PreferencePriority,
  budget: BudgetFit,
  region: RegionFit,
  rehabilitation: RehabilitationFit,
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
): NamedFactorResult => {
  if (priority === PRICE_PRIORITY) {
    return makePriceFactor(profile, facts, budget)
  }
  if (priority === CLOSE_PRIORITY) {
    return makeCloseFactor(profile, facts, region)
  }
  if (priority === REHABILITATION_PRIORITY) {
    return makeRehabilitationFactor(profile, facts, rehabilitation, hardPaths.has(REHABILITATION_PATH))
  }
  if (priority === DEMENTIA_PRIORITY) {
    return makeDementiaFactor(profile, facts, hardPaths)
  }
  return makeNotScorableFactor(profile, priority)
}

export const evaluatePriorityFit = (
  profile: ProfileForPriority,
  facts: EffectiveInstitutionFacts,
  budget: BudgetFit,
  region: RegionFit,
  rehabilitation: RehabilitationFit,
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
): PriorityEvaluation => {
  const priorities = sortByStablePriorityCode(profile.preference.rawFacts.priorities)
  const factors = priorities.map((priority) => makeFactor(
    profile,
    facts,
    priority,
    budget,
    region,
    rehabilitation,
    hardPaths,
  ))
  const activeStatuses = factors
    .filter((factor): factor is Extract<NamedFactorResult, { factorCode: 'priority_fit' }> =>
      factor.factorCode === 'priority_fit')
    .map((factor) => factor.status)
    .filter((status): status is PriorityFitStatus =>
      status === 'match' || status === 'partial' || status === 'mismatch' || status === 'unknown')
  const priorityParticipation: RecommendationFactorRankParticipation = activeStatuses.length > 0
    ? 'selected_priority'
    : 'not_scorable'
  return {
    factors,
    vector: countVector(activeStatuses),
    rankParticipation: priorityParticipation,
  }
}
