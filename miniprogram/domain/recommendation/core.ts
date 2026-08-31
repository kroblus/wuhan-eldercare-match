import type {
  MonthlyRange,
  PreferencePriority,
} from '../../types/assessment'
import type {
  CareCapabilityCode,
  DerivedFact,
  ElderProfileDerivedField,
} from '../../types/elder-profile'
import type {
  InstitutionEffectiveCapabilityStatus,
  InstitutionMatchingCriticalFieldPath,
  ReferenceMonthlyPrice,
} from '../../types/institution'
import type {
  BudgetFit,
  ElderEvidenceRef,
  HardConstraintResult,
  NamedFactorResult,
  RecommendationDifference,
  RecommendationDifferenceCategory,
  RecommendationDifferenceCode,
  RecommendationEvaluationResult,
  RecommendationItem,
  RecommendationMatchTier,
  RecommendationRankParticipation,
  RecommendationRankTuple,
  RecommendationReason,
  RecommendationReasonCode,
  RecommendationReasonType,
  RecommendationSoftFit,
  RehabilitationFit,
  RegionFit,
  TypeFit,
  PriorityFitVector,
  RecommendationPoolManifest,
  RecommendationSemanticResult,
} from '../../types/recommendation'
import type { ValidatedProfileSnapshot } from './profile'
import type { EffectiveInstitutionFacts } from './institution'
import type { RecommendationCoreProfile } from './profile'
import {
  effectiveCapabilityStatus,
  effectiveReferenceMonthlyPrice,
  effectiveStableCode,
  effectiveStableCodeList,
  matchingEvidenceRef,
} from './institution'
import {
  derivedEvidenceRefs,
} from './profile'
import { evaluatePriorityFit } from './priority'
import {
  compareAscii,
  RECOMMENDATION_MATCHING_FIELD_PATHS,
  RECOMMENDATION_TIER_ORDER,
} from './rules'
import { RECOMMENDATION_CARD_LIMIT } from '../../types/recommendation'

type Profile = RecommendationCoreProfile

interface RequirementSpec {
  path: InstitutionMatchingCriticalFieldPath | null
  constraintCode: string
  sourceDerivedField: ElderProfileDerivedField
  elderRequirementStatus: HardConstraintResult['elderRequirementStatus']
  elderEvidenceRefs: readonly ElderEvidenceRef[]
  clarificationIds: readonly string[]
}

interface SoftFits {
  budget: BudgetFit
  type: TypeFit
  region: RegionFit
  rehabilitation: RehabilitationFit
  referencePrice: ReferenceMonthlyPrice | null
}

interface EvaluatedCandidate {
  item: RecommendationItem
  exact: boolean
  tier: RecommendationMatchTier | null
}

const CARE_LEVEL_PATH_PREFIX = 'capabilities.careLevelAcceptance.'
const SPECIAL_CARE_PATH_PREFIX = 'capabilities.specialCare.'

const WHEELCHAIR_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.mobilitySupport.wheelchair_support'
const BEDBOUND_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.mobilitySupport.bedbound_support'
const TRANSFER_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.mobilitySupport.transfer_support'
const DEMENTIA_ACCEPTANCE_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.cognitiveSupport.dementia_acceptance'
const WANDERING_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.cognitiveSupport.wandering_risk_support'
const REHABILITATION_PATH: InstitutionMatchingCriticalFieldPath = 'capabilities.specialCare.rehabilitation_training'

const MONTHLY_BUDGET_RANGES: Readonly<Record<Exclude<MonthlyRange, 'unknown' | 'cny_15000_plus'>, { min: number, max: number }>> = {
  cny_3500_5000: { min: 350000, max: 500000 },
  cny_5000_8000: { min: 500000, max: 800000 },
  cny_8000_12000: { min: 800000, max: 1200000 },
  cny_12000_15000: { min: 1200000, max: 1500000 },
}

const isKnown = <T>(fact: DerivedFact<T>): fact is Extract<DerivedFact<T>, { status: 'known' }> =>
  fact.status === 'known'

const uniqStrings = (values: readonly string[]): string[] => {
  const result: string[] = []
  values.forEach((value) => {
    if (result.indexOf(value) < 0) {
      result.push(value)
    }
  })
  return result
}

const evidenceRefKey = (ref: ElderEvidenceRef): string => {
  if (ref.kind === 'derived_evidence') {
    return `${ref.kind}|${ref.derivedField}|${ref.evidenceId}`
  }
  return `${ref.kind}|${ref.profilePath}|${JSON.stringify(ref.valueSnapshot)}`
}

const uniqueEvidenceRefs = (refs: readonly ElderEvidenceRef[]): ElderEvidenceRef[] => {
  const result: ElderEvidenceRef[] = []
  const keys: string[] = []
  refs.forEach((ref) => {
    const key = evidenceRefKey(ref)
    if (keys.indexOf(key) < 0) {
      keys.push(key)
      result.push(ref)
    }
  })
  return result
}

const preferenceTypeRef = (profile: Profile): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'preference.rawFacts.preferredInstitutionType',
  sourceQuestionId: 'preference.careType',
  valueSnapshot: profile.preference.rawFacts.preferredInstitutionType,
})

const preferenceRegionRef = (profile: Profile): ElderEvidenceRef => {
  const region = profile.preference.rawFacts.regionPreference
  return {
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: region === undefined ? 'absent' : 'provided',
    valueSnapshot: region === undefined ? null : region,
  }
}

const financialBudgetRef = (profile: Profile): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: profile.financial.rawFacts.monthlyBudget,
})

const requirementPathOrder = (path: InstitutionMatchingCriticalFieldPath | null): number =>
  path === null ? RECOMMENDATION_MATCHING_FIELD_PATHS.length : RECOMMENDATION_MATCHING_FIELD_PATHS.indexOf(path)

const careLevelPath = (level: string): InstitutionMatchingCriticalFieldPath =>
  `${CARE_LEVEL_PATH_PREFIX}${level}` as InstitutionMatchingCriticalFieldPath

const specialCarePath = (capability: CareCapabilityCode): InstitutionMatchingCriticalFieldPath =>
  `${SPECIAL_CARE_PATH_PREFIX}${capability}` as InstitutionMatchingCriticalFieldPath

const careModeField = (code: string): ElderProfileDerivedField =>
  `adl.careModes.${code}` as ElderProfileDerivedField

const addRequirementSpec = (specs: RequirementSpec[], next: RequirementSpec): void => {
  const existing = specs.find((spec) => next.path !== null
    ? spec.path === next.path
    : spec.path === null && spec.constraintCode === next.constraintCode)
  if (existing === undefined) {
    specs.push({ ...next, elderEvidenceRefs: uniqueEvidenceRefs(next.elderEvidenceRefs) })
    return
  }
  existing.elderEvidenceRefs = uniqueEvidenceRefs(existing.elderEvidenceRefs.concat(next.elderEvidenceRefs))
  existing.clarificationIds = uniqStrings(existing.clarificationIds.concat(next.clarificationIds))
}

const buildRequirementSpecs = (profile: Profile): RequirementSpec[] => {
  const specs: RequirementSpec[] = []
  const adlCareLevel = profile.adl.derivedFacts.careLevel
  if (isKnown(adlCareLevel)) {
    addRequirementSpec(specs, {
      path: careLevelPath(adlCareLevel.value),
      constraintCode: 'CARE_LEVEL_ACCEPTANCE',
      sourceDerivedField: 'adl.careLevel',
      elderRequirementStatus: 'known_care_level',
      elderEvidenceRefs: derivedEvidenceRefs('adl.careLevel', adlCareLevel),
      clarificationIds: [],
    })
  }

  const mobility = profile.mobility.derivedFacts.level
  if (isKnown(mobility)) {
    const mobilityPath = mobility.value === 'wheelchair'
      ? WHEELCHAIR_PATH
      : mobility.value === 'bedbound' ? BEDBOUND_PATH : null
    if (mobilityPath !== null) {
      addRequirementSpec(specs, {
        path: mobilityPath,
        constraintCode: 'MOBILITY_SUPPORT',
        sourceDerivedField: 'mobility.level',
        elderRequirementStatus: 'known_mobility',
        elderEvidenceRefs: derivedEvidenceRefs('mobility.level', mobility),
        clarificationIds: [],
      })
    }
  }

  profile.adl.derivedFacts.careModes.forEach((mode) => {
    if (mode.status !== 'reported') {
      return
    }
    let path: InstitutionMatchingCriticalFieldPath | null = null
    let code = ''
    if (mode.code === 'wheelchair') {
      path = WHEELCHAIR_PATH
      code = 'MOBILITY_SUPPORT'
    } else if (mode.code === 'bedridden') {
      path = BEDBOUND_PATH
      code = 'MOBILITY_SUPPORT'
    } else if (mode.code === 'transfer_support' || mode.code === 'fully_dependent_transfer') {
      path = TRANSFER_PATH
      code = 'TRANSFER_SUPPORT'
    }
    if (path === null) {
      return
    }
    const field = careModeField(mode.code)
    addRequirementSpec(specs, {
      path,
      constraintCode: code,
      sourceDerivedField: field,
      elderRequirementStatus: 'known_mobility',
      elderEvidenceRefs: derivedEvidenceRefs(field, mode),
      clarificationIds: mode.clarificationIds || [],
    })
  })

  const diagnosis = profile.cognition.derivedFacts.reportedDiagnosis
  if (isKnown(diagnosis) && diagnosis.value === 'reported') {
    addRequirementSpec(specs, {
      path: DEMENTIA_ACCEPTANCE_PATH,
      constraintCode: 'DEMENTIA_ACCEPTANCE',
      sourceDerivedField: 'cognition.reportedDiagnosis',
      elderRequirementStatus: 'required',
      elderEvidenceRefs: derivedEvidenceRefs('cognition.reportedDiagnosis', diagnosis),
      clarificationIds: [],
    })
  } else if (isKnown(diagnosis) && diagnosis.value === 'not_reported') {
    addRequirementSpec(specs, {
      path: null,
      constraintCode: 'DEMENTIA_ACCEPTANCE',
      sourceDerivedField: 'cognition.reportedDiagnosis',
      elderRequirementStatus: 'not_reported',
      elderEvidenceRefs: derivedEvidenceRefs('cognition.reportedDiagnosis', diagnosis),
      clarificationIds: [],
    })
  }
  const wandering = profile.cognition.derivedFacts.wanderingRisk
  if (isKnown(wandering) && wandering.value === 'present') {
    addRequirementSpec(specs, {
      path: WANDERING_PATH,
      constraintCode: 'WANDERING_RISK_SUPPORT',
      sourceDerivedField: 'cognition.wanderingRisk',
      elderRequirementStatus: 'required',
      elderEvidenceRefs: derivedEvidenceRefs('cognition.wanderingRisk', wandering),
      clarificationIds: [],
    })
  } else if (isKnown(wandering) && wandering.value === 'not_reported') {
    addRequirementSpec(specs, {
      path: null,
      constraintCode: 'WANDERING_RISK_SUPPORT',
      sourceDerivedField: 'cognition.wanderingRisk',
      elderRequirementStatus: 'not_reported',
      elderEvidenceRefs: derivedEvidenceRefs('cognition.wanderingRisk', wandering),
      clarificationIds: [],
    })
  }

  profile.specialCare.derivedFacts.requiredCareCapabilities.forEach((requirement) => {
    const field = `specialCare.requiredCareCapabilities.${requirement.capability}` as ElderProfileDerivedField
    if (requirement.status === 'unknown' || requirement.status === 'needs_confirmation') {
      return
    }
    if (requirement.status === 'not_required' || requirement.status === 'not_reported') {
      addRequirementSpec(specs, {
        path: null,
        constraintCode: `SPECIAL_CARE_${requirement.capability}`,
        sourceDerivedField: field,
        elderRequirementStatus: requirement.status,
        elderEvidenceRefs: derivedEvidenceRefs(field, requirement),
        clarificationIds: [],
      })
      return
    }
    addRequirementSpec(specs, {
      path: specialCarePath(requirement.capability),
      constraintCode: `SPECIAL_CARE_${requirement.capability}`,
      sourceDerivedField: field,
      elderRequirementStatus: requirement.status,
      elderEvidenceRefs: derivedEvidenceRefs(field, requirement),
      clarificationIds: requirement.clarificationIds || [],
    })
  })

  return specs.sort((left, right) => requirementPathOrder(left.path) - requirementPathOrder(right.path))
}

const hardOutcome = (
  status: InstitutionEffectiveCapabilityStatus,
): HardConstraintResult['outcome'] => {
  if (status === 'supported') {
    return 'satisfied'
  }
  if (status === 'requires_assessment') {
    return 'conditional'
  }
  if (status === 'unsupported') {
    return 'conflict'
  }
  return 'unverified'
}

const evaluateHardConstraints = (
  specs: readonly RequirementSpec[],
  facts: EffectiveInstitutionFacts,
): HardConstraintResult[] => specs.map((spec) => {
  const status = spec.path === null ? 'unknown' : effectiveCapabilityStatus(facts, spec.path)
  const outcome = spec.path === null ? 'not_applicable' : hardOutcome(status)
  return {
    constraintCode: spec.constraintCode,
    sourceDerivedField: spec.sourceDerivedField,
    elderRequirementStatus: spec.elderRequirementStatus,
    institutionId: facts.institutionId,
    recordRevision: facts.recordRevision,
    institutionFieldPath: spec.path,
    institutionEffectiveStatus: spec.path === null ? 'not_evaluated' : status,
    outcome,
    blocksExact: outcome !== 'satisfied',
    blocksEligibility: outcome === 'conflict',
    elderEvidenceRefs: spec.elderEvidenceRefs.slice(),
    institutionEvidenceRefs: spec.path === null ? [] : [matchingEvidenceRef(facts, spec.path)],
    clarificationIds: spec.clarificationIds.slice(),
  }
})

const budgetFitFor = (
  profile: Profile,
  referencePrice: ReferenceMonthlyPrice | null,
): BudgetFit => {
  const budget = profile.financial.rawFacts.monthlyBudget
  if (budget === 'unknown' || budget === 'cny_15000_plus' || referencePrice === null) {
    return 'unknown'
  }
  const declared = MONTHLY_BUDGET_RANGES[budget]
  const range = referencePrice.range
  if (range.kind === 'starting_at') {
    return range.min.amountMinor > declared.max ? 'above_budget' : 'partially_overlapping'
  }
  if (range.max.amountMinor < declared.min) {
    return 'below_declared_range'
  }
  if (range.min.amountMinor > declared.max) {
    return 'above_budget'
  }
  if (range.min.amountMinor >= declared.min && range.max.amountMinor <= declared.max) {
    return 'within_budget'
  }
  return 'partially_overlapping'
}

const typeFitFor = (profile: Profile, facts: EffectiveInstitutionFacts): TypeFit => {
  const preferred = profile.preference.rawFacts.preferredInstitutionType
  if (preferred === 'unknown') {
    return 'not_applicable'
  }
  const supportedTypes = effectiveStableCodeList(facts, 'typeProfile.supportedTypes')
  if (supportedTypes === null) {
    return 'unknown'
  }
  return supportedTypes.indexOf(preferred) >= 0 ? 'match' : 'mismatch'
}

const regionFitFor = (profile: Profile, facts: EffectiveInstitutionFacts): RegionFit => {
  const preference = profile.preference.rawFacts.regionPreference
  if (preference === undefined || preference.kind === 'no_preference') {
    return 'not_applicable'
  }
  const region = effectiveStableCode(facts, 'identity.regionCode')
  if (region === null) {
    return 'unknown'
  }
  return region === preference.regionCode ? 'same' : 'different'
}

const rehabilitationFitFor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
): RehabilitationFit => {
  if (hardPaths.has(REHABILITATION_PATH)) {
    return 'not_applicable'
  }
  const rehabilitation = profile.health.derivedFacts.rehabilitationNeed
  if (!isKnown(rehabilitation) || rehabilitation.value === 'not_required') {
    return 'not_applicable'
  }
  return effectiveCapabilityStatus(facts, REHABILITATION_PATH)
}

const softFitsFor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
): SoftFits => {
  const referencePrice = effectiveReferenceMonthlyPrice(facts)
  return {
    budget: budgetFitFor(profile, referencePrice),
    type: typeFitFor(profile, facts),
    region: regionFitFor(profile, facts),
    rehabilitation: rehabilitationFitFor(profile, facts, hardPaths),
    referencePrice,
  }
}

const rankParticipationFor = (
  profile: Profile,
  softFits: SoftFits,
  priorityCodes: readonly PreferencePriority[],
  hardPaths: ReadonlySet<InstitutionMatchingCriticalFieldPath>,
  priorityParticipation: RecommendationRankParticipation['priority'],
): RecommendationRankParticipation => {
  const priceConsumed = priorityCodes.indexOf('price') >= 0
  const closeConsumed = priorityCodes.indexOf('close_to_family') >= 0 && softFits.region !== 'not_applicable'
  const rehabPriority = priorityCodes.indexOf('rehabilitation_capability') >= 0
  const rehabilitationParticipation = hardPaths.has(REHABILITATION_PATH)
    ? 'consumed_by_hard'
    : rehabPriority
      ? 'consumed_by_priority'
      : softFits.rehabilitation === 'not_applicable' ? 'not_applicable' : 'baseline'
  return {
    priority: priorityParticipation,
    budget: priceConsumed ? 'consumed_by_priority' : 'baseline',
    type: profile.preference.rawFacts.preferredInstitutionType === 'unknown' ? 'not_applicable' : 'baseline',
    region: closeConsumed
      ? 'consumed_by_priority'
      : softFits.region === 'not_applicable' ? 'not_applicable' : 'baseline',
    rehabilitation: rehabilitationParticipation,
  }
}

const tierOrdinal = (tier: RecommendationMatchTier): number => RECOMMENDATION_TIER_ORDER.indexOf(tier)

const comparePriorityVector = (left: PriorityFitVector, right: PriorityFitVector): number => {
  if (left.matchedCount !== right.matchedCount) {
    return right.matchedCount - left.matchedCount
  }
  if (left.partialCount !== right.partialCount) {
    return right.partialCount - left.partialCount
  }
  if (left.knownMismatchCount !== right.knownMismatchCount) {
    return left.knownMismatchCount - right.knownMismatchCount
  }
  return left.unknownCount - right.unknownCount
}

const budgetOrdinal = (fit: BudgetFit): number => [
  'within_budget',
  'partially_overlapping',
  'below_declared_range',
  'above_budget',
  'unknown',
].indexOf(fit)

const typeOrdinal = (fit: Exclude<TypeFit, 'not_applicable'>): number => ['match', 'unknown', 'mismatch'].indexOf(fit)
const regionOrdinal = (fit: Exclude<RegionFit, 'not_applicable'>): number => ['same', 'unknown', 'different'].indexOf(fit)
const rehabilitationOrdinal = (fit: Exclude<RehabilitationFit, 'not_applicable'>): number => [
  'supported',
  'requires_assessment',
  'unknown',
  'unsupported',
].indexOf(fit)

const compareOptionalOrdinal = (
  left: string | null,
  right: string | null,
  ordinal: (value: never) => number,
): number => {
  if (left === null || right === null) {
    return 0
  }
  return ordinal(left as never) - ordinal(right as never)
}

const compareRankTuples = (left: RecommendationRankTuple, right: RecommendationRankTuple): number => {
  if (left.tier !== right.tier) {
    if (left.tier === null) return 1
    if (right.tier === null) return -1
    const tierResult = tierOrdinal(left.tier) - tierOrdinal(right.tier)
    if (tierResult !== 0) return tierResult
  }
  const vectorResult = comparePriorityVector(left.priorityFitVector, right.priorityFitVector)
  if (vectorResult !== 0) return vectorResult
  const budgetResult = compareOptionalOrdinal(left.budgetFit, right.budgetFit, budgetOrdinal as (value: never) => number)
  if (budgetResult !== 0) return budgetResult
  const typeResult = compareOptionalOrdinal(left.institutionTypeFit === 'not_applicable' ? null : left.institutionTypeFit,
    right.institutionTypeFit === 'not_applicable' ? null : right.institutionTypeFit,
    typeOrdinal as (value: never) => number)
  if (typeResult !== 0) return typeResult
  const regionResult = compareOptionalOrdinal(left.regionFit === 'not_applicable' ? null : left.regionFit,
    right.regionFit === 'not_applicable' ? null : right.regionFit,
    regionOrdinal as (value: never) => number)
  if (regionResult !== 0) return regionResult
  const rehabilitationResult = compareOptionalOrdinal(
    left.rehabilitationSoftFit === 'not_applicable' ? null : left.rehabilitationSoftFit,
    right.rehabilitationSoftFit === 'not_applicable' ? null : right.rehabilitationSoftFit,
    rehabilitationOrdinal as (value: never) => number,
  )
  if (rehabilitationResult !== 0) return rehabilitationResult
  return compareAscii(left.institutionId, right.institutionId)
}

const sortCandidates = (candidates: readonly EvaluatedCandidate[]): EvaluatedCandidate[] => candidates
  .slice()
  .sort((left, right) => {
    if (left.item.rankTuple === null || right.item.rankTuple === null) {
      if (left.item.rankTuple === null && right.item.rankTuple === null) {
        return compareAscii(left.item.institutionId, right.item.institutionId)
      }
      return left.item.rankTuple === null ? 1 : -1
    }
    return compareRankTuples(left.item.rankTuple, right.item.rankTuple)
  })

const takeTop = (candidates: readonly EvaluatedCandidate[]): RecommendationItem[] =>
  candidates.slice(0, RECOMMENDATION_CARD_LIMIT).map((candidate) => candidate.item)

const makeReason = (
  reasonCode: RecommendationReasonCode,
  reasonType: RecommendationReasonType,
  polarity: RecommendationReason['polarity'],
  elderEvidenceRefs: readonly ElderEvidenceRef[],
  institutionEvidenceRefs: readonly ReturnType<typeof matchingEvidenceRef>[],
): RecommendationReason => ({
  reasonCode,
  reasonType,
  polarity,
  elderEvidenceRefs: elderEvidenceRefs.slice(),
  institutionEvidenceRefs: institutionEvidenceRefs.slice(),
})

const makeDifference = (
  differenceCode: RecommendationDifferenceCode,
  differenceCategory: RecommendationDifferenceCategory,
  differenceType: RecommendationDifference['differenceType'],
  severity: RecommendationDifference['severity'],
  elderEvidenceRefs: readonly ElderEvidenceRef[],
  institutionEvidenceRefs: readonly ReturnType<typeof matchingEvidenceRef>[],
): RecommendationDifference => ({
  differenceCode,
  differenceCategory,
  differenceType,
  severity,
  elderEvidenceRefs: elderEvidenceRefs.slice(),
  institutionEvidenceRefs: institutionEvidenceRefs.slice(),
})

const hardReasonCode = (constraintCode: string, outcome: HardConstraintResult['outcome']): RecommendationReasonCode => {
  if (outcome === 'conditional') return 'REQUIREMENT_REQUIRES_ASSESSMENT'
  if (outcome === 'unverified') return 'REQUIREMENT_UNVERIFIED'
  if (outcome === 'conflict') return 'REQUIREMENT_UNSUPPORTED'
  if (constraintCode === 'CARE_LEVEL_ACCEPTANCE') return 'CARE_LEVEL_SUPPORTED'
  if (constraintCode === 'MOBILITY_SUPPORT') return 'MOBILITY_SUPPORTED'
  if (constraintCode === 'TRANSFER_SUPPORT') return 'TRANSFER_SUPPORTED'
  if (constraintCode === 'DEMENTIA_ACCEPTANCE') return 'COGNITIVE_ACCEPTANCE_SUPPORTED'
  if (constraintCode === 'WANDERING_RISK_SUPPORT') return 'WANDERING_SUPPORT_SUPPORTED'
  if (constraintCode === 'SPECIAL_CARE_rehabilitation_training') return 'REHABILITATION_SUPPORTED'
  return 'SPECIAL_CARE_SUPPORTED'
}

const hardReasonPolarity = (outcome: HardConstraintResult['outcome']): RecommendationReason['polarity'] => {
  if (outcome === 'satisfied') return 'supported'
  if (outcome === 'conditional') return 'conditional'
  if (outcome === 'unverified') return 'unverified'
  return 'conflict'
}

const hardDifference = (
  constraint: HardConstraintResult,
): RecommendationDifference | null => {
  if (constraint.outcome === 'conditional') {
    return makeDifference(
      'CAPABILITY_REQUIRES_ASSESSMENT',
      'CONDITIONAL_REQUIREMENT',
      'requires_assessment',
      'important',
      constraint.elderEvidenceRefs,
      constraint.institutionEvidenceRefs,
    )
  }
  if (constraint.outcome === 'unverified') {
    return makeDifference(
      'CAPABILITY_NOT_VERIFIED',
      'UNVERIFIED_DATA_GAP',
      'unknown_capability',
      'important',
      constraint.elderEvidenceRefs,
      constraint.institutionEvidenceRefs,
    )
  }
  if (constraint.outcome === 'conflict') {
    return makeDifference(
      'HARD_CAPABILITY_UNSUPPORTED',
      'HARD_CONFLICT',
      'hard_conflict',
      'blocking',
      constraint.elderEvidenceRefs,
      constraint.institutionEvidenceRefs,
    )
  }
  return null
}

const softFactorRefs = (
  facts: EffectiveInstitutionFacts,
  fieldPath: InstitutionMatchingCriticalFieldPath | null,
): ReturnType<typeof matchingEvidenceRef>[] => fieldPath === null
  ? []
  : [matchingEvidenceRef(facts, fieldPath)]

const makeBudgetFactor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  fit: BudgetFit,
  participation: RecommendationRankParticipation['budget'],
): NamedFactorResult => ({
  factorCode: 'budget_fit',
  status: fit,
  rankParticipation: participation,
  elderEvidenceRefs: [financialBudgetRef(profile)],
  institutionEvidenceRefs: softFactorRefs(facts, 'price.referenceMonthlyPrice'),
})

const makeTypeFactor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  fit: TypeFit,
  participation: RecommendationRankParticipation['type'],
): NamedFactorResult => ({
  factorCode: 'institution_type_fit',
  status: fit,
  rankParticipation: participation,
  elderEvidenceRefs: [preferenceTypeRef(profile)],
  institutionEvidenceRefs: fit === 'not_applicable'
    ? []
    : softFactorRefs(facts, 'typeProfile.supportedTypes'),
})

const makeRegionFactor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  fit: RegionFit,
  participation: RecommendationRankParticipation['region'],
): NamedFactorResult => ({
  factorCode: 'region_fit',
  status: fit,
  rankParticipation: participation,
  elderEvidenceRefs: [preferenceRegionRef(profile)],
  institutionEvidenceRefs: fit === 'not_applicable'
    ? []
    : softFactorRefs(facts, 'identity.regionCode'),
})

const rehabilitationElderRefs = (
  profile: Profile,
): ElderEvidenceRef[] => {
  const fact = profile.health.derivedFacts.rehabilitationNeed
  return isKnown(fact) && (fact.value === 'required' || fact.value === 'possible')
    ? derivedEvidenceRefs('health.rehabilitationNeed', fact)
    : []
}

const makeRehabilitationFactor = (
  profile: Profile,
  facts: EffectiveInstitutionFacts,
  fit: RehabilitationFit,
  participation: RecommendationRankParticipation['rehabilitation'],
): NamedFactorResult => ({
  factorCode: 'rehabilitation_fit',
  status: fit,
  rankParticipation: participation,
  elderEvidenceRefs: rehabilitationElderRefs(profile),
  institutionEvidenceRefs: fit === 'not_applicable'
    ? []
    : softFactorRefs(facts, REHABILITATION_PATH),
})

const makeCareFactor = (
  tier: RecommendationMatchTier | null,
  constraints: readonly HardConstraintResult[],
): NamedFactorResult => ({
  factorCode: 'care_compatibility_tier',
  status: tier,
  rankParticipation: 'baseline',
  elderEvidenceRefs: uniqueEvidenceRefs(constraints.reduce<ElderEvidenceRef[]>(
    (refs, constraint) => refs.concat(constraint.elderEvidenceRefs),
    [],
  )),
  institutionEvidenceRefs: constraints.reduce<ReturnType<typeof matchingEvidenceRef>[]>(
    (refs, constraint) => refs.concat(constraint.institutionEvidenceRefs),
    [],
  ),
})

const hasHardOutcome = (
  constraints: readonly HardConstraintResult[],
  outcome: HardConstraintResult['outcome'],
): boolean => constraints.some((constraint) => constraint.outcome === outcome)

const tierFor = (
  elderReadiness: ValidatedProfileSnapshot['elderReadiness'],
  constraints: readonly HardConstraintResult[],
  exact: boolean,
): RecommendationMatchTier | null => {
  if (elderReadiness !== 'ready') {
    return hasHardOutcome(constraints, 'conflict') ? 'INELIGIBLE' : null
  }
  if (hasHardOutcome(constraints, 'conflict')) {
    return 'INELIGIBLE'
  }
  if (hasHardOutcome(constraints, 'unverified')) {
    return 'UNVERIFIED'
  }
  if (hasHardOutcome(constraints, 'conditional')) {
    return 'CONDITIONAL'
  }
  return exact ? 'EXACT' : 'SOFT_NEAR'
}

const exactFor = (
  elderReadiness: ValidatedProfileSnapshot['elderReadiness'],
  constraints: readonly HardConstraintResult[],
  softFits: SoftFits,
): boolean => {
  if (elderReadiness !== 'ready'
    || constraints.some((constraint) => constraint.outcome !== 'satisfied' && constraint.outcome !== 'not_applicable')) {
    return false
  }
  if (softFits.budget !== 'within_budget'
    || softFits.type === 'unknown' || softFits.type === 'mismatch'
    || softFits.region === 'unknown' || softFits.region === 'different'
    || (softFits.rehabilitation !== 'not_applicable' && softFits.rehabilitation !== 'supported')) {
    return false
  }
  return true
}

const priorityDifference = (
  factor: Extract<NamedFactorResult, { factorCode: 'priority_fit' }>,
): RecommendationDifference | null => {
  if (factor.status === 'match' || factor.status === 'not_applicable') {
    return null
  }
  if (factor.status === 'partial' || factor.status === 'mismatch') {
    return makeDifference(
      'PRIORITY_NOT_MET',
      'SOFT_DIFFERENCE',
      'priority',
      'advisory',
      factor.elderEvidenceRefs,
      factor.institutionEvidenceRefs,
    )
  }
  if (factor.status === 'unknown') {
    return makeDifference(
      'PRIORITY_UNVERIFIED',
      'UNVERIFIED_DATA_GAP',
      'priority',
      'advisory',
      factor.elderEvidenceRefs,
      factor.institutionEvidenceRefs,
    )
  }
  return makeDifference(
    'PRIORITY_NOT_SCORABLE',
    'UNVERIFIED_DATA_GAP',
    'priority',
    'advisory',
    factor.elderEvidenceRefs,
    factor.institutionEvidenceRefs,
  )
}

const softDifference = (
  factor: NamedFactorResult,
): RecommendationDifference | null => {
  if (factor.factorCode === 'priority_fit') {
    return priorityDifference(factor)
  }
  if (factor.factorCode === 'care_compatibility_tier' || factor.status === 'not_applicable') {
    return null
  }
  if (factor.factorCode === 'budget_fit') {
    if (factor.status === 'within_budget') return null
    if (factor.status === 'partially_overlapping') {
      return makeDifference('BUDGET_PARTIAL_OVERLAP', 'SOFT_DIFFERENCE', 'budget', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'above_budget') {
      return makeDifference('BUDGET_ABOVE_RANGE', 'SOFT_DIFFERENCE', 'budget', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'below_declared_range') {
      return makeDifference('BUDGET_BELOW_DECLARED_RANGE', 'SOFT_DIFFERENCE', 'budget', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    return makeDifference('BUDGET_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'budget', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
  }
  if (factor.factorCode === 'institution_type_fit') {
    if (factor.status === 'mismatch') {
      return makeDifference('TYPE_DIFFERENT', 'SOFT_DIFFERENCE', 'institution_type', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'unknown') {
      return makeDifference('TYPE_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'institution_type', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    return null
  }
  if (factor.factorCode === 'region_fit') {
    if (factor.status === 'different') {
      return makeDifference('REGION_DIFFERENT', 'SOFT_DIFFERENCE', 'region', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'unknown') {
      return makeDifference('REGION_UNKNOWN', 'UNVERIFIED_DATA_GAP', 'region', 'advisory', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    return null
  }
  if (factor.factorCode === 'rehabilitation_fit') {
    if (factor.status === 'unsupported') {
      return makeDifference('REHABILITATION_SOFT_DATA_GAP', 'SOFT_DIFFERENCE', 'data_quality', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'requires_assessment') {
      return makeDifference('REHABILITATION_SOFT_DATA_GAP', 'SOFT_DIFFERENCE', 'requires_assessment', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
    if (factor.status === 'unknown') {
      return makeDifference('REHABILITATION_SOFT_DATA_GAP', 'UNVERIFIED_DATA_GAP', 'unknown_capability', 'important', factor.elderEvidenceRefs, factor.institutionEvidenceRefs)
    }
  }
  return null
}

const addBudgetUpperBoundDifference = (
  softFits: SoftFits,
  budgetFactor: NamedFactorResult,
): RecommendationDifference | null => {
  if (softFits.referencePrice === null || softFits.referencePrice.range.kind !== 'starting_at') {
    return null
  }
  return makeDifference(
    'PRICE_UPPER_BOUND_UNKNOWN',
    'UNVERIFIED_DATA_GAP',
    'budget',
    'important',
    budgetFactor.elderEvidenceRefs,
    budgetFactor.institutionEvidenceRefs,
  )
}

const addElderReadinessDifference = (
  snapshot: ValidatedProfileSnapshot,
): RecommendationDifference | null => {
  if (snapshot.elderReadiness === 'ready') {
    return null
  }
  const refs = snapshot.requirementReadiness.reduce<ElderEvidenceRef[]>(
    (all, entry) => all.concat(entry.elderEvidenceRefs),
    [],
  )
  return makeDifference(
    'ELDER_REQUIREMENT_NEEDS_CONFIRMATION',
    'UNVERIFIED_DATA_GAP',
    'data_quality',
    'blocking',
    uniqueEvidenceRefs(refs),
    [],
  )
}

const buildCandidate = (
  profileSnapshot: ValidatedProfileSnapshot,
  facts: EffectiveInstitutionFacts,
  specs: readonly RequirementSpec[],
): EvaluatedCandidate => {
  const constraints = evaluateHardConstraints(specs, facts)
  const hardPaths = new Set(specs
    .filter((spec): spec is RequirementSpec & { path: InstitutionMatchingCriticalFieldPath } => spec.path !== null)
    .map((spec) => spec.path))
  const softFits = softFitsFor(profileSnapshot.profile, facts, hardPaths)
  const priorityEvaluation = evaluatePriorityFit(
    profileSnapshot.profile,
    facts,
    softFits.budget,
    softFits.region,
    softFits.rehabilitation,
    hardPaths,
  )
  const participation = rankParticipationFor(
    profileSnapshot.profile,
    softFits,
    profileSnapshot.profile.preference.rawFacts.priorities,
    hardPaths,
    priorityEvaluation.rankParticipation,
  )
  const exact = exactFor(profileSnapshot.elderReadiness, constraints, softFits)
  const tier = tierFor(profileSnapshot.elderReadiness, constraints, exact)
  const budgetFactor = makeBudgetFactor(profileSnapshot.profile, facts, softFits.budget, participation.budget)
  const typeFactor = makeTypeFactor(profileSnapshot.profile, facts, softFits.type, participation.type)
  const regionFactor = makeRegionFactor(profileSnapshot.profile, facts, softFits.region, participation.region)
  const rehabilitationFactor = makeRehabilitationFactor(profileSnapshot.profile, facts, softFits.rehabilitation, participation.rehabilitation)
  const softFit: RecommendationSoftFit = {
    factors: [
      makeCareFactor(tier, constraints),
      budgetFactor,
      typeFactor,
      regionFactor,
      rehabilitationFactor,
      ...priorityEvaluation.factors,
    ],
  }
  const reasons: RecommendationReason[] = []
  const differences: RecommendationDifference[] = []
  constraints.forEach((constraint) => {
    if (constraint.outcome !== 'not_applicable') {
      reasons.push(makeReason(
        hardReasonCode(constraint.constraintCode, constraint.outcome),
        'care_capability',
        hardReasonPolarity(constraint.outcome),
        constraint.elderEvidenceRefs,
        constraint.institutionEvidenceRefs,
      ))
      const difference = hardDifference(constraint)
      if (difference !== null) differences.push(difference)
    }
  })
  const factors: readonly NamedFactorResult[] = [budgetFactor, typeFactor, regionFactor, rehabilitationFactor, ...priorityEvaluation.factors]
  factors.forEach((factor) => {
    if (factor.factorCode === 'budget_fit') {
      if (factor.status === 'within_budget') {
        reasons.push(makeReason('BUDGET_WITHIN_RANGE', 'budget', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      } else if (factor.status === 'partially_overlapping') {
        reasons.push(makeReason('BUDGET_PARTIAL_OVERLAP', 'budget', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      } else if (factor.status === 'above_budget') {
        reasons.push(makeReason('BUDGET_ABOVE_RANGE', 'budget', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      } else if (factor.status === 'below_declared_range') {
        reasons.push(makeReason('BUDGET_BELOW_DECLARED_RANGE', 'budget', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      } else {
        reasons.push(makeReason('BUDGET_UNKNOWN', 'budget', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      }
    } else if (factor.factorCode === 'institution_type_fit') {
      if (factor.status === 'match') reasons.push(makeReason('TYPE_MATCH', 'institution_type', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'mismatch') reasons.push(makeReason('TYPE_DIFFERENT', 'institution_type', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'unknown') reasons.push(makeReason('TYPE_UNKNOWN', 'institution_type', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    } else if (factor.factorCode === 'region_fit') {
      if (factor.status === 'same') reasons.push(makeReason('REGION_MATCH', 'region', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'different') reasons.push(makeReason('REGION_DIFFERENT', 'region', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'unknown') reasons.push(makeReason('REGION_UNKNOWN', 'region', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    } else if (factor.factorCode === 'rehabilitation_fit') {
      if (factor.status === 'supported') reasons.push(makeReason('REHABILITATION_SUPPORTED', 'medical_rehabilitation', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'requires_assessment') reasons.push(makeReason('REQUIREMENT_REQUIRES_ASSESSMENT', 'medical_rehabilitation', 'conditional', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'unknown') reasons.push(makeReason('REQUIREMENT_UNVERIFIED', 'medical_rehabilitation', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'unsupported') reasons.push(makeReason('REQUIREMENT_UNSUPPORTED', 'medical_rehabilitation', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    } else if (factor.factorCode === 'priority_fit') {
      if (factor.status === 'match') reasons.push(makeReason('PRIORITY_STRUCTURED_MATCH', 'priority', 'supported', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'partial' || factor.status === 'mismatch') reasons.push(makeReason('PRIORITY_NOT_MET', 'priority', 'difference', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'unknown') reasons.push(makeReason('PRIORITY_UNVERIFIED', 'priority', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
      else if (factor.status === 'not_scorable') reasons.push(makeReason('PRIORITY_NOT_SCORABLE', 'priority', 'unverified', factor.elderEvidenceRefs, factor.institutionEvidenceRefs))
    }
    const difference = softDifference(factor)
    if (difference !== null) differences.push(difference)
  })
  const upperBoundDifference = addBudgetUpperBoundDifference(softFits, budgetFactor)
  if (upperBoundDifference !== null) differences.push(upperBoundDifference)
  const readinessDifference = addElderReadinessDifference(profileSnapshot)
  if (readinessDifference !== null) {
    differences.push(readinessDifference)
    reasons.push(makeReason('DATA_NOT_VERIFIED', 'data_quality', 'unverified', readinessDifference.elderEvidenceRefs, []))
  }
  const rankTuple: RecommendationRankTuple | null = profileSnapshot.elderReadiness !== 'ready' || tier === null
    ? null
    : {
      tier,
      priorityFitVector: priorityEvaluation.vector,
      budgetFit: participation.budget === 'baseline' ? softFits.budget : null,
      institutionTypeFit: participation.type === 'baseline' ? softFits.type : null,
      regionFit: participation.region === 'baseline' ? softFits.region : null,
      rehabilitationSoftFit: participation.rehabilitation === 'baseline' ? softFits.rehabilitation : null,
      institutionId: facts.institutionId,
    }
  const item: RecommendationItem = {
    institutionId: facts.institutionId,
    recordRevision: facts.recordRevision,
    matchTier: tier,
    constraintResults: constraints,
    softFit,
    rankTuple,
    rankParticipation: rankTuple === null ? null : participation,
    reasons,
    differences,
  }
  return { item, exact, tier }
}

const makeNoExactMatch = (
  profileSnapshot: ValidatedProfileSnapshot,
  includedCount: number,
  candidates: readonly EvaluatedCandidate[],
  softNearCandidates: readonly EvaluatedCandidate[],
  conditionalCandidates: readonly EvaluatedCandidate[],
): import('../../types/recommendation').NoExactMatch => {
  let reasonCode: import('../../types/recommendation').NoExactMatchReasonCode
  if (includedCount === 0) {
    reasonCode = 'NO_VERIFIED_INSTITUTION_POOL'
  } else if (profileSnapshot.elderReadiness !== 'ready') {
    reasonCode = 'REQUIRED_CAPABILITY_UNRESOLVED'
  } else if (candidates.length > 0 && candidates.every((candidate) => candidate.tier === 'INELIGIBLE')) {
    reasonCode = 'ALL_CANDIDATES_HAVE_HARD_CONFLICT'
  } else if (softNearCandidates.length > 0) {
    reasonCode = 'ONLY_SOFT_NEAR_MATCHES'
  } else if (conditionalCandidates.length > 0) {
    reasonCode = 'ONLY_CONDITIONAL_CANDIDATES'
  } else {
    reasonCode = 'REQUIRED_CAPABILITY_UNRESOLVED'
  }
  const unmetHardRequirements = candidates.reduce<HardConstraintResult[]>(
    (all, candidate) => all.concat(candidate.item.constraintResults.filter((constraint) => constraint.outcome === 'conflict')),
    [],
  )
  const unverifiedRequirements = candidates.reduce<HardConstraintResult[]>(
    (all, candidate) => all.concat(candidate.item.constraintResults.filter((constraint) =>
      constraint.outcome === 'conditional' || constraint.outcome === 'unverified')),
    [],
  )
  const differences = candidates.reduce<RecommendationDifference[]>(
    (all, candidate) => all.concat(candidate.item.differences),
    [],
  )
  return {
    code: 'NO_EXACT_MATCH',
    reasonCode,
    unmetHardRequirements,
    unverifiedRequirements,
    nearMatches: softNearCandidates.length > 0 ? takeTop(softNearCandidates) : [],
    differences,
    elderClarifications: profileSnapshot.elderClarifications,
  }
}

export interface SemanticCoreInput {
  profileSnapshot: ValidatedProfileSnapshot
  institutionFacts: readonly EffectiveInstitutionFacts[]
  poolManifest: RecommendationPoolManifest
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  versions: import('../../types/recommendation').RecommendationVersions
}

export const evaluateSemanticCore = (
  input: SemanticCoreInput,
): RecommendationEvaluationResult<RecommendationSemanticResult> => {
  const specs = buildRequirementSpecs(input.profileSnapshot.profile)
  const candidates = sortCandidates(input.institutionFacts.map((facts) => buildCandidate(input.profileSnapshot, facts, specs)))
  const exactCandidates = candidates.filter((candidate) => candidate.tier === 'EXACT')
  const softNearCandidates = candidates.filter((candidate) => candidate.tier === 'SOFT_NEAR')
  const conditionalCandidates = candidates.filter((candidate) => candidate.tier === 'CONDITIONAL')
  const items = input.profileSnapshot.elderReadiness !== 'ready'
    ? []
    : exactCandidates.length > 0
      ? takeTop(exactCandidates)
      : softNearCandidates.length > 0
        ? takeTop(softNearCandidates)
        : []
  const selectedConditionalCandidates = input.profileSnapshot.elderReadiness === 'ready'
    && exactCandidates.length === 0
    && softNearCandidates.length === 0
    ? takeTop(conditionalCandidates)
    : []
  const exactMatch = exactCandidates.length > 0
  const noExactMatch = exactMatch ? undefined : makeNoExactMatch(
    input.profileSnapshot,
    input.institutionFacts.length,
    candidates,
    softNearCandidates,
    conditionalCandidates,
  )
  return {
    ok: true,
    value: {
      versions: input.versions,
      policy: 'CONSERVATIVE_EXACT_WITH_CONDITIONAL',
      evaluationAsOf: input.evaluationAsOf,
      datasetVersion: input.datasetVersion,
      datasetMode: input.datasetMode,
      elderSnapshot: input.profileSnapshot.snapshot,
      poolManifest: input.poolManifest,
      elderReadiness: input.profileSnapshot.elderReadiness,
      requirementReadiness: input.profileSnapshot.requirementReadiness,
      elderClarifications: input.profileSnapshot.elderClarifications,
      items,
      conditionalCandidates: selectedConditionalCandidates,
      candidateEvaluations: candidates.map((candidate) => candidate.item),
      exactMatch,
      ...(noExactMatch === undefined ? {} : { noExactMatch }),
    },
  }
}
