import { compareIsoTimestamps, isValidIsoTimestamp } from '../../institution/primitives'
import { copyDomainDataV2 } from '../v2/rules-v2'
import type { InstitutionEvidenceV121 } from '../../../types/institution-v1-2-1'
import type {
  ElderEvidenceRefV2,
  RecommendationElderSemanticSnapshotV2,
} from '../../../types/recommendation-v2'
import type {
  HardConstraintResult,
  RecommendationMatchTier,
} from '../../../types/recommendation'
import type {
  InitialReferenceBasisCategoryV1,
  InitialReferenceBasisEvaluationV1,
  InitialReferenceBasisStatusV1,
  InitialReferenceEligibleCandidateV1,
  InitialReferenceEligibilityDecisionV1,
  InitialReferenceEligibilityInputV1,
  InitialReferenceExclusionCodeV1,
  ReferenceFieldFactV1,
} from '../../../types/initial-reference-v1'

interface BudgetRangeV1 {
  lowerMinor: number
  upperMinor: number | null
}

const budgetRangeFor = (value: string): BudgetRangeV1 | null => {
  switch (value) {
    case 'cny_3500_5000': return { lowerMinor: 350000, upperMinor: 500000 }
    case 'cny_5000_8000': return { lowerMinor: 500000, upperMinor: 800000 }
    case 'cny_8000_12000': return { lowerMinor: 800000, upperMinor: 1200000 }
    case 'cny_12000_15000': return { lowerMinor: 1200000, upperMinor: 1500000 }
    case 'cny_15000_plus': return { lowerMinor: 1500000, upperMinor: null }
    default: return null
  }
}

const roomTypeFor = (value: string): 'single' | 'double' | 'multi_bed' | null => {
  switch (value) {
    case 'single': return 'single'
    case 'double': return 'double'
    case 'triple_or_more': return 'multi_bed'
    default: return null
  }
}

const isRecordIdentity = (
  value: { institutionId: string; recordRevision: number },
  institutionId: string,
  recordRevision: number,
): boolean => value.institutionId === institutionId && value.recordRevision === recordRevision

const fail = (code: string): never => {
  throw new Error(code)
}

const assertInputIdentity = (input: InitialReferenceEligibilityInputV1): void => {
  const facts = input.institutionFacts
  if (facts.recordStatus !== 'published'
    || facts.currentPointer.institutionId !== facts.institutionId
    || facts.currentPointer.recordRevision !== facts.recordRevision
    || !isValidIsoTimestamp(facts.evaluationAsOf)) {
    fail('INITIAL_REFERENCE_FACTS_IDENTITY_MISMATCH')
  }

  const candidate = input.legacyCandidate
  if (!isRecordIdentity(candidate, facts.institutionId, facts.recordRevision)) {
    fail('INITIAL_REFERENCE_CANDIDATE_IDENTITY_MISMATCH')
  }
  for (let index = 0; index < candidate.constraintResults.length; index += 1) {
    if (!isRecordIdentity(candidate.constraintResults[index], facts.institutionId, facts.recordRevision)) {
      fail('INITIAL_REFERENCE_CANDIDATE_IDENTITY_MISMATCH')
    }
  }

  const expectedFieldPaths = [
    ['identity.regionCode', facts.identity.regionCode.fieldPath],
    ['price.referenceMonthlyPrice', facts.price.referenceMonthlyPrice.fieldPath],
    ['meal.mealSchedule', facts.meal.mealSchedule.fieldPath],
    ['meal.easyChewSupport', facts.meal.easyChewSupport.fieldPath],
    ['meal.modifiedFoodSupport', facts.meal.modifiedFoodSupport.fieldPath],
  ]
  for (let index = 0; index < expectedFieldPaths.length; index += 1) {
    if (expectedFieldPaths[index][0] !== expectedFieldPaths[index][1]) {
      fail('INITIAL_REFERENCE_FACTS_FIELD_PATH_MISMATCH')
    }
  }
  for (let index = 0; index < facts.rooms.length; index += 1) {
    if (facts.rooms[index].fieldPath !== `rooms.${index}.roomType`
      || facts.rooms[index].roomType.fieldPath !== facts.rooms[index].fieldPath) {
      fail('INITIAL_REFERENCE_FACTS_FIELD_PATH_MISMATCH')
    }
  }
}

const userRegionEvidence = (
  snapshot: RecommendationElderSemanticSnapshotV2,
): ElderEvidenceRefV2[] => {
  const region = snapshot.preference.regionPreference
  if (region === undefined || region.kind !== 'institution_region') return []
  return [{
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: 'provided',
    valueSnapshot: region,
  }]
}

const userBudgetEvidence = (
  snapshot: RecommendationElderSemanticSnapshotV2,
): ElderEvidenceRefV2[] => [{
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: snapshot.financial.rawFacts.monthlyBudget,
}]

const explicitServicePreferenceEvidence = (
  snapshot: RecommendationElderSemanticSnapshotV2,
  matchedRoomPreference: boolean,
  matchedMealPreference: boolean,
): ElderEvidenceRefV2[] => {
  const refs: ElderEvidenceRefV2[] = []
  const roomTypePreference = snapshot.preference.roomTypePreference
  if (matchedRoomPreference && roomTypePreference !== 'no_preference') {
    refs.push({
      kind: 'profile_raw_fact_v2',
      profilePath: 'preference.rawFacts.roomTypePreference',
      sourceQuestionId: 'preference.roomType',
      valueSnapshot: roomTypePreference,
    })
  }
  const mealSchedulePreference = snapshot.preference.mealSchedulePreference
  if (matchedMealPreference && mealSchedulePreference !== 'no_preference') {
    refs.push({
      kind: 'profile_raw_fact_v2',
      profilePath: 'preference.rawFacts.mealSchedulePreference',
      sourceQuestionId: 'preference.mealSchedule',
      valueSnapshot: mealSchedulePreference,
    })
  }
  return refs
}

const makeBasisEvaluation = (
  category: InitialReferenceBasisCategoryV1,
  status: InitialReferenceBasisStatusV1,
  fields: readonly ReferenceFieldFactV1<unknown>[],
  matchedFields: readonly ReferenceFieldFactV1<unknown>[],
  elderEvidenceRefs: readonly ElderEvidenceRefV2[],
): InitialReferenceBasisEvaluationV1 => {
  const evidence: InstitutionEvidenceV121[] = []
  const fieldPaths: string[] = []
  const matchedFieldPaths: string[] = []
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    fieldPaths.push(fields[fieldIndex].fieldPath)
  }
  for (let fieldIndex = 0; fieldIndex < matchedFields.length; fieldIndex += 1) {
    const field = matchedFields[fieldIndex]
    matchedFieldPaths.push(field.fieldPath)
    for (let evidenceIndex = 0; evidenceIndex < field.evidence.length; evidenceIndex += 1) {
      const item = field.evidence[evidenceIndex]
      if (!evidence.some((existing) => existing.evidenceId === item.evidenceId)) evidence.push(item)
    }
  }
  return {
    category,
    status,
    fieldPaths,
    matchedFieldPaths,
    evidence,
    elderEvidenceRefs: elderEvidenceRefs.slice(),
  }
}

const areaStatus = (
  input: InitialReferenceEligibilityInputV1,
): InitialReferenceBasisStatusV1 => {
  const preference = input.elderSnapshot.preference.regionPreference
  if (preference === undefined || preference.kind !== 'institution_region') return 'NOT_APPLICABLE'
  const regionCode = input.institutionFacts.identity.regionCode
  if (regionCode.effectiveStatus !== 'current_verified' || regionCode.effectiveValue === null) {
    return 'UNKNOWN'
  }
  return regionCode.effectiveValue === preference.regionCode ? 'MATCHED' : 'NOT_MATCHED'
}

const budgetStatus = (
  input: InitialReferenceEligibilityInputV1,
): InitialReferenceBasisStatusV1 => {
  const userRange = budgetRangeFor(input.elderSnapshot.financial.rawFacts.monthlyBudget)
  if (userRange === null) return 'NOT_APPLICABLE'

  const priceField = input.institutionFacts.price.referenceMonthlyPrice
  if (priceField.effectiveStatus !== 'current_verified'
    || priceField.effectiveValue === null
    || priceField.raw.availability !== 'provided'
    || priceField.raw.asOf === undefined
    || !isValidIsoTimestamp(priceField.raw.asOf)
    || compareIsoTimestamps(priceField.raw.asOf, input.institutionFacts.evaluationAsOf) > 0) {
    return 'UNKNOWN'
  }
  const referencePrice = priceField.effectiveValue
  const range = referencePrice.range
  if (referencePrice.basis !== 'reference_total'
    || range.kind !== 'bounded'
    || range.period !== 'month'
    || range.min.currency !== 'CNY'
    || range.max.currency !== 'CNY'
    || !Number.isSafeInteger(range.min.amountMinor)
    || !Number.isSafeInteger(range.max.amountMinor)
    || range.min.amountMinor <= 0
    || range.max.amountMinor < range.min.amountMinor) {
    return 'UNKNOWN'
  }
  const overlaps = range.max.amountMinor >= userRange.lowerMinor
    && (userRange.upperMinor === null || range.min.amountMinor <= userRange.upperMinor)
  return overlaps ? 'MATCHED' : 'NOT_MATCHED'
}

interface RoomPreferenceResultV1 {
  status: InitialReferenceBasisStatusV1
  fields: ReferenceFieldFactV1<unknown>[]
  matchedFields: ReferenceFieldFactV1<unknown>[]
}

const roomPreferenceStatus = (
  input: InitialReferenceEligibilityInputV1,
): RoomPreferenceResultV1 => {
  const expectedType = roomTypeFor(input.elderSnapshot.preference.roomTypePreference)
  if (expectedType === null) return { status: 'NOT_APPLICABLE', fields: [], matchedFields: [] }
  const roomFacts = input.institutionFacts.rooms.map((room) => room.roomType)
  const matchedFields: ReferenceFieldFactV1<unknown>[] = []
  for (let index = 0; index < roomFacts.length; index += 1) {
    const room = roomFacts[index]
    if (room.effectiveStatus === 'current_verified' && room.effectiveValue === expectedType) {
      matchedFields.push(room)
    }
  }
  if (matchedFields.length > 0) {
    return { status: 'MATCHED', fields: roomFacts, matchedFields }
  }
  // The catalog room list is open-ended. Omission of a requested room type
  // does not establish that the institution cannot provide it.
  return { status: 'UNKNOWN', fields: roomFacts, matchedFields: [] }
}

const mealPreferenceStatus = (
  input: InitialReferenceEligibilityInputV1,
): {
  status: InitialReferenceBasisStatusV1
  fields: ReferenceFieldFactV1<unknown>[]
  matchedFields: ReferenceFieldFactV1<unknown>[]
} => {
  const preference = input.elderSnapshot.preference.mealSchedulePreference
  if (preference === 'no_preference') {
    return { status: 'NOT_APPLICABLE', fields: [], matchedFields: [] }
  }
  const field = input.institutionFacts.meal.mealSchedule
  if (field.effectiveStatus !== 'current_verified' || field.effectiveValue === null) {
    return { status: 'UNKNOWN', fields: [field], matchedFields: [] }
  }
  const matched = field.effectiveValue === preference
  return {
    status: matched ? 'MATCHED' : 'NOT_MATCHED',
    fields: [field],
    matchedFields: matched ? [field] : [],
  }
}

const basicServiceStatus = (
  roomStatus: InitialReferenceBasisStatusV1,
  mealStatus: InitialReferenceBasisStatusV1,
): InitialReferenceBasisStatusV1 => {
  if (roomStatus === 'MATCHED' || mealStatus === 'MATCHED') return 'MATCHED'
  const applicable = [roomStatus, mealStatus].filter((status) => status !== 'NOT_APPLICABLE')
  if (applicable.length === 0) return 'NOT_APPLICABLE'
  if (applicable.some((status) => status === 'UNKNOWN')) return 'UNKNOWN'
  return 'NOT_MATCHED'
}

const foodTextureExclusion = (
  input: InitialReferenceEligibilityInputV1,
): {
  code: InitialReferenceExclusionCodeV1 | null
  evidence: InstitutionEvidenceV121[]
  elderEvidenceRefs: ElderEvidenceRefV2[]
} => {
  const need = input.elderSnapshot.nutrition.foodTextureSupport
  if (need.status !== 'known' || (need.value !== 'easy_chew' && need.value !== 'modified_food')) {
    return { code: null, evidence: [], elderEvidenceRefs: [] }
  }

  const matchingEvidence = input.elderSnapshot.evidence.filter((item) =>
    item.derivedField === 'nutrition.foodTextureSupport')
  if (matchingEvidence.length !== 1 || matchingEvidence[0].outcomeCode !== need.value) {
    fail('INITIAL_REFERENCE_ELDER_EVIDENCE_INVALID')
  }
  const elderEvidence: ElderEvidenceRefV2[] = [{
    kind: 'derived_evidence_v2',
    derivedField: 'nutrition.foodTextureSupport',
    evidenceId: matchingEvidence[0].evidenceId,
  }]

  const field = need.value === 'easy_chew'
    ? input.institutionFacts.meal.easyChewSupport
    : input.institutionFacts.meal.modifiedFoodSupport
  if (field.effectiveStatus !== 'current_verified' || field.effectiveValue !== 'unavailable') {
    return { code: null, evidence: [], elderEvidenceRefs: [] }
  }
  return {
    code: 'REFERENCE_FOOD_TEXTURE_UNSUPPORTED',
    evidence: field.evidence.slice(),
    elderEvidenceRefs: elderEvidence,
  }
}

const validTier = (tier: RecommendationMatchTier | null): boolean => tier === null
  || tier === 'EXACT'
  || tier === 'SOFT_NEAR'
  || tier === 'CONDITIONAL'
  || tier === 'UNVERIFIED'
  || tier === 'INELIGIBLE'

const assertCandidateShape = (
  candidate: InitialReferenceEligibilityInputV1['legacyCandidate'],
): void => {
  if (!validTier(candidate.matchTier)) fail('INITIAL_REFERENCE_CANDIDATE_INVALID')
  const validOutcomes: readonly string[] = [
    'satisfied', 'conditional', 'unverified', 'conflict', 'not_applicable',
  ]
  for (let index = 0; index < candidate.constraintResults.length; index += 1) {
    const constraint = candidate.constraintResults[index]
    if (validOutcomes.indexOf(constraint.outcome) < 0) {
      fail('INITIAL_REFERENCE_CANDIDATE_INVALID')
    }
  }
}

/**
 * Pure C1 fallback policy. The legacy candidate is inspected only for its
 * frozen identity, tier, and hard-constraint outcomes; no V2 result is changed.
 */
export const evaluateInitialReferenceEligibilityV1 = (
  input: InitialReferenceEligibilityInputV1,
): InitialReferenceEligibilityDecisionV1 => {
  assertInputIdentity(input)
  assertCandidateShape(input.legacyCandidate)

  const facts = input.institutionFacts
  const candidate = input.legacyCandidate
  const exclusionCodes: InitialReferenceExclusionCodeV1[] = []
  const hasLegacyConflict = candidate.constraintResults.some((item) => item.outcome === 'conflict')
  const hasLegacyIneligible = candidate.matchTier === 'INELIGIBLE'
  if (hasLegacyConflict) exclusionCodes.push('LEGACY_CONSTRAINT_CONFLICT')
  if (hasLegacyIneligible) exclusionCodes.push('LEGACY_INELIGIBLE')

  const legacyConstraintResults: HardConstraintResult[] = candidate.constraintResults.slice()
  if (exclusionCodes.length > 0) {
    return copyDomainDataV2({
      institutionId: facts.institutionId,
      recordRevision: facts.recordRevision,
      eligible: false,
      legacyMatchTier: candidate.matchTier,
      legacyConstraintResults,
      matchedCategories: [],
      basisEvaluations: [],
      exclusionCodes,
      exclusionEvidence: [],
      exclusionElderEvidenceRefs: [],
      candidate: null,
    })
  }

  const foodExclusion = foodTextureExclusion(input)
  if (foodExclusion.code !== null) {
    exclusionCodes.push(foodExclusion.code)
    return copyDomainDataV2({
      institutionId: facts.institutionId,
      recordRevision: facts.recordRevision,
      eligible: false,
      legacyMatchTier: candidate.matchTier,
      legacyConstraintResults,
      matchedCategories: [],
      basisEvaluations: [],
      exclusionCodes,
      exclusionEvidence: foodExclusion.evidence,
      exclusionElderEvidenceRefs: foodExclusion.elderEvidenceRefs,
      candidate: null,
    })
  }

  const elder = input.elderSnapshot
  const areaStatusValue = areaStatus(input)
  const budgetStatusValue = budgetStatus(input)
  const areaFields: ReferenceFieldFactV1<unknown>[] = [facts.identity.regionCode]
  const budgetFields: ReferenceFieldFactV1<unknown>[] = [facts.price.referenceMonthlyPrice]
  const area = makeBasisEvaluation(
    'AREA',
    areaStatusValue,
    areaFields,
    areaStatusValue === 'MATCHED' ? areaFields : [],
    areaStatusValue === 'MATCHED' ? userRegionEvidence(elder) : [],
  )
  const budget = makeBasisEvaluation(
    'BUDGET',
    budgetStatusValue,
    budgetFields,
    budgetStatusValue === 'MATCHED' ? budgetFields : [],
    budgetStatusValue === 'MATCHED' ? userBudgetEvidence(elder) : [],
  )

  const room = roomPreferenceStatus(input)
  const meal = mealPreferenceStatus(input)
  const basicFields = room.fields.concat(meal.fields)
  const basicMatchedFields = room.matchedFields.concat(meal.matchedFields)
  const basicStatus = basicServiceStatus(room.status, meal.status)
  const basic = makeBasisEvaluation(
    'BASIC_SERVICE',
    basicStatus,
    basicFields,
    basicMatchedFields,
    basicStatus === 'MATCHED'
      ? explicitServicePreferenceEvidence(
        elder,
        room.matchedFields.length > 0,
        meal.matchedFields.length > 0,
      )
      : [],
  )
  const basisEvaluations = [area, budget, basic]
  const matchedCategories = basisEvaluations
    .filter((item) => item.status === 'MATCHED')
    .map((item) => item.category)
  const eligible = matchedCategories.length > 0
  const eligibleCandidate: InitialReferenceEligibleCandidateV1 | null = eligible ? {
    institutionId: facts.institutionId,
    recordRevision: facts.recordRevision,
    matchedCategories,
    basisEvaluations,
    institutionFacts: facts,
  } : null

  return copyDomainDataV2({
    institutionId: facts.institutionId,
    recordRevision: facts.recordRevision,
    eligible,
    legacyMatchTier: candidate.matchTier,
    legacyConstraintResults,
    matchedCategories,
    basisEvaluations,
    exclusionCodes,
    exclusionEvidence: foodExclusion.evidence,
    exclusionElderEvidenceRefs: foodExclusion.elderEvidenceRefs,
    candidate: eligibleCandidate,
  })
}
