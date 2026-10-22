import {
  ASSESSMENT_SCHEMA_VERSION,
  ASSESSMENT_QUESTION_DEFINITIONS,
  isAssessmentQuestionId,
  isValidAnswerForQuestion,
} from '../../types/assessment'
import type { AssessmentQuestionId, PreferencePriority } from '../../types/assessment'
import type {
  DerivedFact,
  ElderProfileDerivedField,
  ProfileClarification,
} from '../../types/elder-profile'
import type {
  ElderEvidenceRef,
  RecommendationElderReadiness,
  RecommendationElderSemanticSnapshot,
  RecommendationError,
  RecommendationEvaluationResult,
  RecommendationProfile,
  RecommendationReadinessCode,
  RequirementReadiness,
} from '../../types/recommendation'
import {
  isNonEmptyString,
  isPlainRecord,
  RECOMMENDATION_PRIORITY_CODES,
  sortAscii,
  SPECIAL_CARE_CAPABILITY_CODES,
  hasUniqueStrings,
  copyDomainData as copyValue,
} from './rules'
import { isValidIsoTimestamp } from '../institution/primitives'

/** Identity and raw clinical answers stop at the adapter, not in the core. */
export interface RecommendationCoreProfile {
  adl: { derivedFacts: RecommendationProfile['adl']['derivedFacts'] }
  mobility: { derivedFacts: RecommendationProfile['mobility']['derivedFacts'] }
  health: { derivedFacts: RecommendationProfile['health']['derivedFacts'] }
  cognition: { derivedFacts: RecommendationProfile['cognition']['derivedFacts'] }
  specialCare: { derivedFacts: RecommendationProfile['specialCare']['derivedFacts'] }
  preference: RecommendationProfile['preference']
  financial: RecommendationProfile['financial']
  intent: RecommendationProfile['intent']
}

/**
 * Version-neutral input surface for the frozen V1 readiness rules.
 * Recommendation V2 may reuse this surface because the referenced ADL,
 * mobility, cognition and special-care semantics are explicitly unchanged.
 */
export interface FrozenSafetyReadinessProfile {
  adl: RecommendationCoreProfile['adl']
  mobility: RecommendationCoreProfile['mobility']
  health: RecommendationCoreProfile['health']
  cognition: RecommendationCoreProfile['cognition']
  specialCare: RecommendationProfile['specialCare']
  clarifications: readonly ProfileClarification[]
}

export interface ValidatedProfileSnapshot {
  profile: RecommendationCoreProfile
  snapshot: RecommendationElderSemanticSnapshot
  elderReadiness: RecommendationElderReadiness
  requirementReadiness: readonly RequirementReadiness[]
  elderClarifications: readonly ProfileClarification[]
}

const makeError = (code: RecommendationError['code'], paths: readonly string[]): RecommendationError => ({
  code,
  paths: paths.length > 0 ? sortAscii(paths, (path) => path) : ['$'],
})

const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value)

const isStringArray = (value: unknown): value is readonly string[] =>
  isArray(value) && value.every(isNonEmptyString)

const FACT_VALUES: Readonly<Record<string, readonly string[]>> = {
  'adl.careLevel': ['independent', 'light_care', 'semi_disabled', 'disabled', 'severely_disabled'],
  'mobility.level': ['independent', 'walking_aid', 'wheelchair', 'bedbound'],
  'health.rehabilitationNeed': ['required', 'possible', 'not_required'],
  'cognition.cognitiveConcern': ['present', 'absent', 'not_reported'],
  'cognition.reportedDiagnosis': ['reported', 'not_reported'],
  'cognition.wanderingRisk': ['present', 'not_reported'],
  'cognition.behavioralRisk': ['present', 'not_reported'],
  'cognition.sleepCycleIssue': ['present', 'not_reported'],
}
const CARE_MODE_CODES: readonly string[] = [
  'feeding_minor', 'feeding_dependence', 'special_feeding_review', 'walking_aid',
  'wheelchair', 'bedridden', 'toileting_minor', 'incontinence', 'toileting_full_assistance',
  'catheter_or_stoma_review', 'bathing_partial', 'bathing_full_assistance',
  'dressing_partial', 'dressing_full_assistance', 'transfer_minor', 'transfer_support',
  'fully_dependent_transfer', 'stairs_assistance', 'stairs_unable', 'no_stairs_context',
]
const REQUIREMENT_STATUSES = ['required', 'not_required', 'not_reported', 'unknown', 'needs_confirmation']
const CLARIFICATION_REASONS = ['other_without_detail', 'unknown_answer', 'non_ordinal_adl_answer', 'cross_answer_conflict', 'risk_signal_needs_confirmation']
const CLARIFICATION_PRIORITIES = ['required_before_classification', 'required_before_hard_filter', 'recommended', 'informational']
const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)
const knownField = (value: string): boolean => hasOwn(FACT_VALUES, value)
  || CARE_MODE_CODES.some((code) => value === `adl.careModes.${code}`)
  || SPECIAL_CARE_CAPABILITY_CODES.some((code) => value === `specialCare.requiredCareCapabilities.${code}`)
const enumValue = (value: unknown, allowed: readonly string[]): boolean =>
  typeof value === 'string' && allowed.indexOf(value) >= 0

const isAcyclicData = (value: unknown, ancestors: readonly object[] = []): boolean => {
  if (value === null) return true
  if (value === undefined || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || value === null) return false
  if (ancestors.indexOf(value) >= 0 || ancestors.length > 64) return false
  const next = ancestors.slice()
  next.push(value)
  return Object.keys(value).every((key) => isAcyclicData((value as Record<string, unknown>)[key], next))
}

const isAssessmentEvidenceSource = (value: unknown): boolean => {
  if (!isPlainRecord(value) || !isNonEmptyString(value.sourceKind)
    || !isAssessmentQuestionId(value.sourceQuestionId)
    || !isNonEmptyString(value.contribution)) {
    return false
  }
  const definition = ASSESSMENT_QUESTION_DEFINITIONS[value.sourceQuestionId]
  const allowed = definition.allowedValues || []
  if (value.sourceKind === 'assessment_option') {
    return enumValue(value.sourceOptionCode, allowed)
      && enumValue(value.contribution, ['supports', 'overrides', 'context', 'limits_confidence', 'excluded_not_applicable', 'requires_clarification'])
  }
  if (value.sourceKind === 'assessment_answer_set') {
    return definition.type === 'multi_choice'
      && isStringArray(value.sourceOptionCodes)
      && value.sourceOptionCodes.length > 0
      && isValidAnswerForQuestion(value.sourceQuestionId, value.sourceOptionCodes)
      && enumValue(value.targetOptionCode, allowed)
      && (value.sourceOptionCodes as readonly string[]).indexOf(value.targetOptionCode as string) < 0
      && value.contribution === 'establishes_not_reported'
  }
  return false
}

const isAssessmentEvidenceSourceArray = (value: unknown): value is readonly Record<string, unknown>[] =>
  isArray(value)
    && value.length > 0
    && value.every(isAssessmentEvidenceSource)

const validateDerivedFactShape = (
  value: unknown,
  path: string,
  issues: string[],
): value is DerivedFact<unknown> => {
  if (!isPlainRecord(value)
    || (value.status !== 'known' && value.status !== 'unknown' && value.status !== 'needs_confirmation')
    || !isStringArray(value.evidenceIds)
    || value.evidenceIds.length === 0) {
    issues.push(path)
    return false
  }
  if (value.status === 'known'
    && value.confidence !== 'high'
    && value.confidence !== 'medium') {
    issues.push(`${path}.confidence`)
  }
  const values = FACT_VALUES[path.replace('.derivedFacts.', '.')]
  if (!values
    || (value.status === 'known' && (!enumValue(value.value, values) || hasOwn(value, 'candidateValue') || hasOwn(value, 'clarificationIds')))
    || (value.status !== 'known' && hasOwn(value, 'value'))
    || (value.status === 'unknown' && hasOwn(value, 'candidateValue'))
    || (value.status === 'needs_confirmation' && hasOwn(value, 'candidateValue') && !enumValue(value.candidateValue, values))
    || !hasUniqueStrings(value.evidenceIds)) {
    issues.push(path)
  }
  if (value.status !== 'known'
    && (value.confidence !== 'needs_confirmation'
      || !isStringArray(value.clarificationIds)
      || value.clarificationIds.length === 0)) {
    issues.push(path)
  }
  return true
}

const validateQuestion = (
  questionId: AssessmentQuestionId,
  value: unknown,
  path: string,
  issues: string[],
): void => {
  if (!isValidAnswerForQuestion(questionId, value)) {
    issues.push(path)
  }
}

const validateIdentity = (profile: unknown, expectedKind: 'elder_profile' | 'elder_profile_preview', issues: string[]): void => {
  if (!isPlainRecord(profile) || profile.kind !== expectedKind) {
    issues.push('kind')
    return
  }
  if (expectedKind === 'elder_profile') {
    const identity = profile.identity
    if (!isPlainRecord(identity)
      || Object.keys(identity).some((key) => ['elderId', 'assessmentId', 'assessmentSchemaVersion', 'assessmentCompletedAt', 'profileContractVersion', 'derivationRulesetVersion'].indexOf(key) < 0)
      || !isNonEmptyString(identity.elderId)
      || !isNonEmptyString(identity.assessmentId)
      || identity.profileContractVersion !== 'elder-profile-contract-v1'
      || identity.derivationRulesetVersion !== 'elder-profile-ruleset-v1'
      || identity.assessmentSchemaVersion !== ASSESSMENT_SCHEMA_VERSION
      || !isValidIsoTimestamp(identity.assessmentCompletedAt)
      || hasOwn(profile, 'source')
      || hasOwn(identity, 'localDraftId')) {
      issues.push('identity')
    }
    return
  }
  const source = profile.source
  if (!isPlainRecord(source)
    || Object.keys(source).some((key) => ['kind', 'localDraftId', 'assessmentSchemaVersion'].indexOf(key) < 0)
    || source.kind !== 'local_assessment_preview'
    || !isNonEmptyString(source.localDraftId)
    || source.assessmentSchemaVersion !== ASSESSMENT_SCHEMA_VERSION
    || hasOwn(profile, 'identity')
    || ['assessmentId', 'elderId', 'completedAt', 'generatedAt', 'recommendationId'].some((key) => hasOwn(profile, key) || hasOwn(source, key))
    || profile.profileContractVersion !== 'elder-profile-contract-v1'
    || profile.derivationRulesetVersion !== 'elder-profile-ruleset-v1') {
    issues.push('source')
  }
}

const validateProfileEvidence = (
  profile: Record<string, unknown>,
  issues: string[],
): void => {
  const evidence = profile.evidence
  if (!isArray(evidence) || evidence.length === 0) {
    issues.push('evidence')
    return
  }
  const ids: string[] = []
  evidence.forEach((entry, index) => {
    if (!isPlainRecord(entry) || !isNonEmptyString(entry.evidenceId)
      || !isNonEmptyString(entry.derivedField)
      || !isNonEmptyString(entry.outcomeCode)
      || !isNonEmptyString(entry.ruleId)
      || !isAssessmentEvidenceSourceArray(entry.sources)) {
      issues.push(`evidence[${index}]`)
      return
    }
    if (!knownField(entry.derivedField) || entry.evidenceId !== `ev:${entry.derivedField}`) {
      issues.push(`evidence[${index}].evidenceId`)
    }
    ids.push(entry.evidenceId)
  })
  if (!hasUniqueStrings(ids)) {
    issues.push('evidence.evidenceId')
  }
}

const validateClarifications = (
  profile: Record<string, unknown>,
  issues: string[],
): void => {
  const clarifications = profile.clarifications
  if (!isArray(clarifications)) {
    issues.push('clarifications')
    return
  }
  const ids: string[] = []
  clarifications.forEach((entry, index) => {
    if (!isPlainRecord(entry)
      || !isNonEmptyString(entry.clarificationId)
      || entry.status !== 'open'
      || !enumValue(entry.reasonCode, CLARIFICATION_REASONS)
      || !enumValue(entry.priority, CLARIFICATION_PRIORITIES)
      || !isAssessmentEvidenceSourceArray(entry.sources)
      || !isStringArray(entry.affectedDerivedFields)
      || entry.affectedDerivedFields.length === 0) {
      issues.push(`clarifications[${index}]`)
      return
    }
    if (!entry.clarificationId.startsWith(`cl:${entry.reasonCode}:`)
      || !hasUniqueStrings(entry.affectedDerivedFields)
      || !entry.affectedDerivedFields.every(knownField)) {
      issues.push(`clarifications[${index}]`)
    }
    ids.push(entry.clarificationId)
  })
  if (!hasUniqueStrings(ids)) {
    issues.push('clarifications.clarificationId')
  }
}

const validateSpecialCare = (profile: Record<string, unknown>, issues: string[]): void => {
  const specialCare = profile.specialCare
  if (!isPlainRecord(specialCare) || !isPlainRecord(specialCare.derivedFacts)
    || !isArray(specialCare.derivedFacts.requiredCareCapabilities)
    || specialCare.derivedFacts.requiredCareCapabilities.length !== SPECIAL_CARE_CAPABILITY_CODES.length) {
    issues.push('specialCare.derivedFacts.requiredCareCapabilities')
    return
  }
  const seen: string[] = []
  specialCare.derivedFacts.requiredCareCapabilities.forEach((entry, index) => {
    if (!isPlainRecord(entry)
      || !isNonEmptyString(entry.capability)
      || SPECIAL_CARE_CAPABILITY_CODES.indexOf(entry.capability as typeof SPECIAL_CARE_CAPABILITY_CODES[number]) < 0
      || !enumValue(entry.status, REQUIREMENT_STATUSES)
      || !isStringArray(entry.evidenceIds)
      || entry.evidenceIds.length === 0 || !hasUniqueStrings(entry.evidenceIds)) {
      issues.push(`specialCare.derivedFacts.requiredCareCapabilities[${index}]`)
      return
    }
    if (entry.status === 'unknown' || entry.status === 'needs_confirmation') {
      if (!isStringArray(entry.clarificationIds) || entry.clarificationIds.length === 0) {
        issues.push(`specialCare.derivedFacts.requiredCareCapabilities[${index}].clarificationIds`)
      }
    }
    seen.push(entry.capability)
  })
  if (seen.length !== SPECIAL_CARE_CAPABILITY_CODES.length || !hasUniqueStrings(seen)
    || SPECIAL_CARE_CAPABILITY_CODES.some((code) => seen.indexOf(code) < 0)) {
    issues.push('specialCare.derivedFacts.requiredCareCapabilities')
  }
}

const validateCareModes = (profile: Record<string, unknown>, issues: string[]): void => {
  const adl = profile.adl
  if (!isPlainRecord(adl) || !isPlainRecord(adl.derivedFacts)
    || !isArray(adl.derivedFacts.careModes)) {
    issues.push('adl.derivedFacts.careModes')
    return
  }
  const codes: string[] = []
  adl.derivedFacts.careModes.forEach((entry, index) => {
    if (!isPlainRecord(entry)
      || !isNonEmptyString(entry.code) || !enumValue(entry.code, CARE_MODE_CODES)
      || !enumValue(entry.status, ['reported', 'context', 'needs_confirmation'])
      || !isStringArray(entry.evidenceIds)
      || entry.evidenceIds.length === 0 || !hasUniqueStrings(entry.evidenceIds)) {
      issues.push(`adl.derivedFacts.careModes[${index}]`)
      return
    }
    if (entry.status === 'needs_confirmation'
      && (!isStringArray(entry.clarificationIds) || entry.clarificationIds.length === 0)) {
      issues.push(`adl.derivedFacts.careModes[${index}].clarificationIds`)
    }
    codes.push(entry.code)
  })
  if (!hasUniqueStrings(codes)) {
    issues.push('adl.derivedFacts.careModes.code')
  }
}

const validateProfileShape = (
  value: unknown,
  expectedKind: 'elder_profile' | 'elder_profile_preview',
): RecommendationEvaluationResult<RecommendationProfile> => {
  const issues: string[] = []
  validateIdentity(value, expectedKind, issues)
  if (!isPlainRecord(value) || issues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_ENVELOPE', issues) }
  }
  if (!isAcyclicData(value)) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', ['$']) }
  }
  const profileRecord = value
  const profile = value as unknown as RecommendationProfile
  const requiredSections = ['basic', 'health', 'adl', 'mobility', 'cognition', 'specialCare', 'preference', 'financial', 'intent', 'userFacingSummary']
  requiredSections.forEach((section) => {
    if (!isPlainRecord(profileRecord[section])) {
      issues.push(section)
    }
  })
  // Validate the complete public envelope before narrowing. Neither basic nor
  // presentation summary is copied into the recommendation semantic core.
  if (isPlainRecord(profile.basic) && isPlainRecord(profile.basic.rawFacts)) {
    const basic = profile.basic.rawFacts
    validateQuestion('basic.relationship', basic.relation, 'basic.rawFacts.relation', issues)
    validateQuestion('basic.gender', basic.sex, 'basic.rawFacts.sex', issues)
    validateQuestion('basic.age', basic.age, 'basic.rawFacts.age', issues)
    const optionalFields: readonly [keyof typeof basic, AssessmentQuestionId][] = [
      ['name', 'basic.elderName'], ['livingStatus', 'basic.livingStatus'],
      ['primaryCaregiver', 'basic.primaryCaregiver'], ['hasInstitutionExperience', 'basic.hasInstitutionExperience'],
      ['institutionExitReasons', 'basic.institutionExitReasons'],
    ]
    optionalFields.forEach(([key, question]) => {
      if (hasOwn(basic, key)) validateQuestion(question, basic[key], `basic.rawFacts.${key}`, issues)
    })
  } else {
    issues.push('basic.rawFacts')
  }
  const summary: unknown = profile.userFacingSummary
  const summarySections = ['basic', 'health', 'adl', 'mobility', 'cognition', 'special_care', 'preference', 'financial_intent']
  if (!isPlainRecord(summary) || summary.summarySchemaVersion !== 'elder-profile-summary-input-v1'
    || !isArray(summary.sections) || summary.sections.length !== summarySections.length
    || !summary.sections.every((section, index) => isPlainRecord(section)
      && section.section === summarySections[index] && isArray(section.items)
      && section.items.every((item) => isPlainRecord(item) && isNonEmptyString(item.summaryCode)
        && isArray(item.sources) && item.sources.length > 0
        && item.sources.every((source) => isPlainRecord(source)
          && (source.kind === 'raw_fact' ? isAssessmentQuestionId(source.sourceQuestionId)
            : source.kind === 'derived_fact' && isNonEmptyString(source.derivedField)
              && knownField(source.derivedField) && isStringArray(source.evidenceIds) && source.evidenceIds.length > 0))))) {
    issues.push('userFacingSummary')
  }
  if (isPlainRecord(profile.health)) {
    if (!isPlainRecord(profile.health.rawFacts) || !isPlainRecord(profile.health.derivedFacts)) {
      issues.push('health')
    } else {
      validateQuestion('health.conditions', profile.health.rawFacts.reportedDiseases, 'health.rawFacts.reportedDiseases', issues)
      validateQuestion('health.recentEvents', profile.health.rawFacts.recentHealthRisks, 'health.rawFacts.recentHealthRisks', issues)
      validateQuestion('health.rehabilitationNeed', profile.health.rawFacts.rehabilitationNeedAnswer, 'health.rawFacts.rehabilitationNeedAnswer', issues)
      validateDerivedFactShape(profile.health.derivedFacts.rehabilitationNeed, 'health.derivedFacts.rehabilitationNeed', issues)
    }
  }
  if (isPlainRecord(profile.adl)) {
    if (!isPlainRecord(profile.adl.rawAnswers) || !isPlainRecord(profile.adl.derivedFacts)) {
      issues.push('adl')
    } else {
      const adlQuestionIds: readonly AssessmentQuestionId[] = [
        'adl.eating', 'adl.mobility', 'adl.toileting', 'adl.bathing', 'adl.dressing', 'adl.transfer', 'adl.stairs',
      ]
      const rawAnswers = profile.adl.rawAnswers as unknown as Record<string, unknown>
      adlQuestionIds.forEach((questionId) => {
        const rawKey = questionId.substring(4) as keyof typeof profile.adl.rawAnswers
        validateQuestion(
          questionId,
          rawAnswers[rawKey],
          `adl.rawAnswers.${rawKey}`,
          issues,
        )
      })
      if (profile.adl.derivedFacts.rulesetVersion !== 'adl-ruleset-v1'
        || !isPlainRecord(profile.adl.derivedFacts.careLevel)
        || !isArray(profile.adl.derivedFacts.careModes)) {
        issues.push('adl.derivedFacts')
      } else {
        validateDerivedFactShape(profile.adl.derivedFacts.careLevel, 'adl.derivedFacts.careLevel', issues)
        validateCareModes(profile as unknown as Record<string, unknown>, issues)
        const coverage = profile.adl.derivedFacts.observationCoverage
        const unknownIds = profile.adl.derivedFacts.unknownQuestionIds
        if (!isPlainRecord(coverage) || !enumValue(coverage.status, ['complete', 'limited', 'unknown'])
          || !isStringArray(coverage.issues) || !hasUniqueStrings(coverage.issues)
          || !coverage.issues.every((issue) => enumValue(issue, ['stairs_not_applicable', 'special_feeding_non_ordinal', 'catheter_or_stoma_non_ordinal', 'unknown_input']))) {
          issues.push('adl.derivedFacts.observationCoverage')
        }
        if (!isStringArray(unknownIds) || !hasUniqueStrings(unknownIds)
          || !unknownIds.every((id) => enumValue(id, adlQuestionIds))) {
          issues.push('adl.derivedFacts.unknownQuestionIds')
        }
      }
    }
  }
  if (isPlainRecord(profile.mobility) && isPlainRecord(profile.mobility.derivedFacts)) {
    validateDerivedFactShape(profile.mobility.derivedFacts.level, 'mobility.derivedFacts.level', issues)
  } else {
    issues.push('mobility')
  }
  if (isPlainRecord(profile.cognition)) {
    if (!isPlainRecord(profile.cognition.rawFacts) || !isPlainRecord(profile.cognition.derivedFacts)) {
      issues.push('cognition')
    } else {
      validateQuestion('cognitive.symptoms', profile.cognition.rawFacts.reportedSymptoms, 'cognition.rawFacts.reportedSymptoms', issues)
      ;(['cognitiveConcern', 'reportedDiagnosis', 'wanderingRisk', 'behavioralRisk', 'sleepCycleIssue'] as const).forEach((field) => {
        validateDerivedFactShape(profile.cognition.derivedFacts[field], `cognition.derivedFacts.${field}`, issues)
      })
    }
  }
  if (isPlainRecord(profile.specialCare)) {
    if (!isPlainRecord(profile.specialCare.rawFacts)) {
      issues.push('specialCare.rawFacts')
    } else {
      validateQuestion('cognitive.specialCareNeeds', profile.specialCare.rawFacts.answers, 'specialCare.rawFacts.answers', issues)
    }
    validateSpecialCare(profile as unknown as Record<string, unknown>, issues)
  }
  if (isPlainRecord(profile.preference)) {
    if (!isPlainRecord(profile.preference.rawFacts)) {
      issues.push('preference.rawFacts')
    } else {
      validateQuestion('preference.careType', profile.preference.rawFacts.preferredInstitutionType, 'preference.rawFacts.preferredInstitutionType', issues)
      const priorities = profile.preference.rawFacts.priorities
      if (!isArray(priorities) || priorities.length === 0 || priorities.length > 3
        || priorities.some((priority) => !isNonEmptyString(priority)
          || RECOMMENDATION_PRIORITY_CODES.indexOf(priority as PreferencePriority) < 0)
        || !hasUniqueStrings(priorities.filter(isNonEmptyString))) {
        issues.push('preference.rawFacts.priorities')
      } else {
        validateQuestion('preference.priorities', priorities, 'preference.rawFacts.priorities', issues)
      }
      if (profile.preference.rawFacts.regionPreference !== undefined) {
        validateQuestion('preference.region', profile.preference.rawFacts.regionPreference, 'preference.rawFacts.regionPreference', issues)
      }
    }
  }
  if (isPlainRecord(profile.financial) && isPlainRecord(profile.financial.rawFacts)) {
    validateQuestion('budget.monthlyRange', profile.financial.rawFacts.monthlyBudget, 'financial.rawFacts.monthlyBudget', issues)
    validateQuestion('budget.upfrontCostAcceptance', profile.financial.rawFacts.depositTolerance, 'financial.rawFacts.depositTolerance', issues)
  } else {
    issues.push('financial')
  }
  if (isPlainRecord(profile.intent) && isPlainRecord(profile.intent.rawFacts)) {
    validateQuestion('budget.moveInTiming', profile.intent.rawFacts.moveInTiming, 'intent.rawFacts.moveInTiming', issues)
    validateQuestion('budget.consultantSupport', profile.intent.rawFacts.consultantIntent, 'intent.rawFacts.consultantIntent', issues)
  } else {
    issues.push('intent')
  }
  validateProfileEvidence(profile as unknown as Record<string, unknown>, issues)
  validateClarifications(profile as unknown as Record<string, unknown>, issues)
  if (issues.length > 0) {
    return { ok: false, error: makeError('INVALID_PROFILE_SNAPSHOT', issues) }
  }
  validateReferenceClosure(profile, issues)
  if (issues.length > 0) {
    const onlyClarifications = issues.every((issue) => issue.startsWith('clarifications.') || issue.endsWith('.clarificationIds'))
    return { ok: false, error: makeError(onlyClarifications ? 'INVALID_PROFILE_CLARIFICATION' : 'INVALID_PROFILE_EVIDENCE', issues) }
  }
  return { ok: true, value: profile }
}

/** Validate references and their snapshots, never rerun classification rules. */
const validateReferenceClosure = (profile: RecommendationProfile, issues: string[]): void => {
  const factRows: Array<{
    field: ElderProfileDerivedField
    outcome: string
    evidenceIds: readonly string[]
    clarificationIds?: readonly string[]
  }> = []
  const addFact = (field: ElderProfileDerivedField, fact: DerivedFact<unknown>): void => {
    factRows.push({
      field,
      outcome: fact.status === 'known' ? String(fact.value) : fact.status,
      evidenceIds: fact.evidenceIds,
      ...(fact.status === 'known' ? {} : { clarificationIds: fact.clarificationIds }),
    })
  }
  addFact('adl.careLevel', profile.adl.derivedFacts.careLevel)
  addFact('mobility.level', profile.mobility.derivedFacts.level)
  addFact('health.rehabilitationNeed', profile.health.derivedFacts.rehabilitationNeed)
  ;(['cognitiveConcern', 'reportedDiagnosis', 'wanderingRisk', 'behavioralRisk', 'sleepCycleIssue'] as const).forEach((field) => {
    addFact(`cognition.${field}` as ElderProfileDerivedField, profile.cognition.derivedFacts[field])
  })
  profile.adl.derivedFacts.careModes.forEach((mode) => factRows.push({
    field: `adl.careModes.${mode.code}` as ElderProfileDerivedField, outcome: mode.status,
    evidenceIds: mode.evidenceIds, clarificationIds: mode.clarificationIds,
  }))
  profile.specialCare.derivedFacts.requiredCareCapabilities.forEach((requirement) => factRows.push({
    field: `specialCare.requiredCareCapabilities.${requirement.capability}` as ElderProfileDerivedField, outcome: requirement.status,
    evidenceIds: requirement.evidenceIds, clarificationIds: requirement.clarificationIds,
  }))
  const sourceAnswers: Record<string, unknown> = {
    'health.conditions': profile.health.rawFacts.reportedDiseases,
    'health.recentEvents': profile.health.rawFacts.recentHealthRisks,
    'health.rehabilitationNeed': profile.health.rawFacts.rehabilitationNeedAnswer,
    'cognitive.symptoms': profile.cognition.rawFacts.reportedSymptoms,
    'cognitive.specialCareNeeds': profile.specialCare.rawFacts.answers,
  }
  Object.keys(profile.adl.rawAnswers).forEach((key) => {
    sourceAnswers[`adl.${key}`] = (profile.adl.rawAnswers as unknown as Record<string, unknown>)[key]
  })
  const sourceMatches = (source: RecommendationProfile['evidence'][number]['sources'][number]): boolean => {
    const answer = sourceAnswers[source.sourceQuestionId]
    if (source.sourceKind === 'assessment_option') {
      return Array.isArray(answer) ? answer.indexOf(source.sourceOptionCode) >= 0 : answer === source.sourceOptionCode
    }
    return Array.isArray(answer) && answer.length === source.sourceOptionCodes.length
      && answer.every((code, index) => code === source.sourceOptionCodes[index])
  }
  const ruleForField = (field: ElderProfileDerivedField, rule: string): boolean => {
    if (field === 'adl.careLevel') return [
      'C_UNKNOWN_BLOCK', 'C_SEVERE_OVERRIDE', 'C_DEPENDENT_FLOOR', 'C_TWO_HALF_ESCALATION',
      'C_NON_CORE_HALF_FALLBACK', 'C_HALF_FLOOR', 'C_TWO_LIGHT_ESCALATION', 'C_NO_BURDEN',
    ].some((code) => rule === `adl-ruleset-v1:${code}`)
    if (field.startsWith('adl.careModes.')) return rule === 'adl-ruleset-v1:C_PROJECT_CARE_MODE'
      || rule === 'adl-ruleset-v1:C_NO_STAIRS_NEUTRAL'
    const ruleCodes: Record<string, string> = {
      'mobility.level': 'MOBILITY_DIRECT', 'health.rehabilitationNeed': 'REHABILITATION',
      'cognition.cognitiveConcern': 'COGNITIVE_CONCERN', 'cognition.reportedDiagnosis': 'REPORTED_DIAGNOSIS',
      'cognition.wanderingRisk': 'WANDERING_RISK', 'cognition.behavioralRisk': 'BEHAVIORAL_RISK',
      'cognition.sleepCycleIssue': 'SLEEP_CYCLE',
    }
    const code = field.startsWith('specialCare.requiredCareCapabilities.') ? 'CARE_CAPABILITY' : ruleCodes[field]
    return rule === `elder-profile-ruleset-v1:${code}`
  }
  factRows.forEach((row) => {
    row.evidenceIds.forEach((id) => {
      const evidence = profile.evidence.find((entry) => entry.evidenceId === id)
      if (!evidence || evidence.derivedField !== row.field || evidence.outcomeCode !== row.outcome) {
        issues.push(`${row.field}.evidenceIds`)
      }
    })
    if (row.clarificationIds !== undefined) {
      if (!isStringArray(row.clarificationIds) || !hasUniqueStrings(row.clarificationIds) || row.clarificationIds.length === 0) {
        issues.push(`${row.field}.clarificationIds`)
      } else row.clarificationIds.forEach((id) => {
        const clarification = profile.clarifications.find((entry) => entry.clarificationId === id)
        if (!clarification || clarification.affectedDerivedFields.indexOf(row.field) < 0) issues.push(`${row.field}.clarificationIds`)
      })
    }
  })
  profile.evidence.forEach((entry) => {
    if (!factRows.some((row) => row.field === entry.derivedField && row.evidenceIds.indexOf(entry.evidenceId) >= 0)
      || !ruleForField(entry.derivedField, entry.ruleId) || !entry.sources.every(sourceMatches)) {
      issues.push(`evidence.${entry.evidenceId}`)
    }
  })
  profile.clarifications.forEach((entry) => {
    if (!entry.affectedDerivedFields.every((field) => factRows.some((row) => row.field === field))
      || !entry.sources.every(sourceMatches)) issues.push(`clarifications.${entry.clarificationId}`)
  })
}

const asDerivedRefs = (
  derivedField: ElderProfileDerivedField,
  fact: { evidenceIds: readonly string[] },
): ElderEvidenceRef[] => fact.evidenceIds.map((evidenceId) => ({
  kind: 'derived_evidence',
  derivedField,
  evidenceId: evidenceId as `ev:${ElderProfileDerivedField}`,
}))

const mergeReadiness = (
  entries: RequirementReadiness[],
  code: RecommendationReadinessCode,
  sourceDerivedField: ElderProfileDerivedField,
  disposition: RequirementReadiness['disposition'],
  blocksEligibility: boolean,
  clarificationIds: readonly string[],
  elderEvidenceRefs: readonly ElderEvidenceRef[],
): void => {
  const key = `${code}|${sourceDerivedField}`
  const existing = entries.find((entry) => `${entry.code}|${entry.sourceDerivedField}` === key)
  if (!existing) {
    entries.push({
      code,
      sourceDerivedField,
      disposition,
      blocksEligibility,
      clarificationIds: sortAscii(clarificationIds, (id) => id),
      elderEvidenceRefs: elderEvidenceRefs.slice(),
    })
    return
  }
  existing.blocksEligibility = existing.blocksEligibility || blocksEligibility
  existing.clarificationIds = sortAscii(
    [...existing.clarificationIds, ...clarificationIds].filter((id, index, ids) => ids.indexOf(id) === index),
    (id) => id,
  )
  existing.elderEvidenceRefs = existing.elderEvidenceRefs.concat(elderEvidenceRefs)
}

const buildReadiness = (profile: FrozenSafetyReadinessProfile): {
  elderReadiness: RecommendationElderReadiness
  requirementReadiness: readonly RequirementReadiness[]
} => {
  const entries: RequirementReadiness[] = []
  const addFactStatus = (
    fact: DerivedFact<unknown>,
    field: ElderProfileDerivedField,
    code: RecommendationReadinessCode,
    exception = false,
  ): void => {
    if (fact.status === 'known') {
      return
    }
    const refs = asDerivedRefs(field, fact)
    const clarificationIds = fact.clarificationIds || []
    mergeReadiness(entries, code, field, exception ? 'soft_fit_data_gap' : 'unresolved', !exception, clarificationIds, refs)
  }

  const specialRequirements = profile.specialCare.derivedFacts.requiredCareCapabilities
  const directRehab = specialRequirements.some((requirement) =>
    requirement.capability === 'rehabilitation_training' && requirement.status === 'required')
  const rehabFact = profile.health.derivedFacts.rehabilitationNeed
  const healthSoftRehab = rehabFact.status === 'known'
    && (rehabFact.value === 'required' || rehabFact.value === 'possible')
    && !directRehab
  const rehabField = 'specialCare.requiredCareCapabilities.rehabilitation_training'
  // Only the frozen deriver's health-cue clarification is a soft exception.
  // Unknown requirements and cross-answer/unrelated clarifications stay blocked.
  const isHealthRehabClarification = (clarification: ProfileClarification): boolean =>
    healthSoftRehab
      && profile.specialCare.rawFacts.answers.indexOf('unknown') < 0
      && clarification.reasonCode === 'risk_signal_needs_confirmation'
      && clarification.affectedDerivedFields.length === 1
      && clarification.affectedDerivedFields[0] === rehabField
      && clarification.sources.some((source) => source.sourceKind === 'assessment_option'
        && source.sourceQuestionId === 'health.rehabilitationNeed'
        && (source.sourceOptionCode === 'definite' || source.sourceOptionCode === 'possible'))
      && clarification.sources.every((source) => source.sourceQuestionId === 'health.rehabilitationNeed'
        || source.sourceQuestionId === 'cognitive.specialCareNeeds')

  addFactStatus(profile.adl.derivedFacts.careLevel, 'adl.careLevel', 'ELDER_CLASSIFICATION_NEEDS_CONFIRMATION')
  addFactStatus(profile.mobility.derivedFacts.level, 'mobility.level', 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION')
  addFactStatus(rehabFact, 'health.rehabilitationNeed', 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION', healthSoftRehab)

  ;([
    ['cognitiveConcern', 'cognition.cognitiveConcern'],
    ['reportedDiagnosis', 'cognition.reportedDiagnosis'],
    ['wanderingRisk', 'cognition.wanderingRisk'],
    ['behavioralRisk', 'cognition.behavioralRisk'],
    ['sleepCycleIssue', 'cognition.sleepCycleIssue'],
  ] as const).forEach(([field, derivedField]) => {
    addFactStatus(profile.cognition.derivedFacts[field], derivedField, 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION')
  })

  specialRequirements.forEach((requirement) => {
    if (requirement.status === 'unknown' || requirement.status === 'needs_confirmation') {
      const field = `specialCare.requiredCareCapabilities.${requirement.capability}` as ElderProfileDerivedField
      const exception = requirement.capability === 'rehabilitation_training'
        && requirement.status === 'needs_confirmation'
        && (requirement.clarificationIds || []).length > 0
        && (requirement.clarificationIds || []).every((id) => {
          const clarification = profile.clarifications.find((entry) => entry.clarificationId === id)
          return clarification !== undefined && isHealthRehabClarification(clarification)
        })
      mergeReadiness(
        entries,
        exception ? 'REHABILITATION_SOFT_DATA_GAP' : 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION',
        field,
        exception ? 'soft_fit_data_gap' : 'unresolved',
        !exception,
        requirement.clarificationIds || [],
        asDerivedRefs(field, requirement),
      )
    }
  })

  profile.adl.derivedFacts.careModes.forEach((mode) => {
    if (mode.status === 'needs_confirmation') {
      const field = `adl.careModes.${mode.code}` as ElderProfileDerivedField
      mergeReadiness(entries, 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION', field, 'unresolved', true, mode.clarificationIds, asDerivedRefs(field, mode))
    }
  })

  profile.clarifications.forEach((clarification) => {
    const affected = clarification.affectedDerivedFields
    const isRehabException = isHealthRehabClarification(clarification)
    const field = affected[0]
    if (!field) {
      return
    }
    if (isRehabException) {
      mergeReadiness(entries, 'REHABILITATION_SOFT_DATA_GAP', field, 'soft_fit_data_gap', false, [clarification.clarificationId], [])
      return
    }
    if (clarification.priority === 'required_before_classification') {
      mergeReadiness(entries, 'ELDER_CLASSIFICATION_NEEDS_CONFIRMATION', field, 'unresolved', true, [clarification.clarificationId], [])
      return
    }
    if (clarification.priority === 'required_before_hard_filter') {
      mergeReadiness(entries, 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION', field, 'unresolved', true, [clarification.clarificationId], [])
      return
    }
    mergeReadiness(entries, 'ELDER_REQUIREMENT_NEEDS_CONFIRMATION', field, 'informational', false, [clarification.clarificationId], [])
  })

  entries.sort((left, right) => {
    const codeCompare = left.code < right.code ? -1 : left.code > right.code ? 1 : 0
    if (codeCompare !== 0) {
      return codeCompare
    }
    return left.sourceDerivedField < right.sourceDerivedField ? -1 : left.sourceDerivedField > right.sourceDerivedField ? 1 : 0
  })
  return {
    elderReadiness: entries.some((entry) => entry.blocksEligibility)
      ? 'blocked_by_required_clarification'
      : 'ready',
    requirementReadiness: entries,
  }
}

/** Reuses the frozen V1 readiness policy without exposing mutable internals. */
export const evaluateFrozenSafetyReadiness = (
  profile: FrozenSafetyReadinessProfile,
): {
  elderReadiness: RecommendationElderReadiness
  requirementReadiness: readonly RequirementReadiness[]
} => buildReadiness(profile)

const createSnapshot = (profile: RecommendationProfile): RecommendationElderSemanticSnapshot => {
  const priorities = profile.preference.rawFacts.priorities.slice().sort((left, right) =>
    RECOMMENDATION_PRIORITY_CODES.indexOf(left) - RECOMMENDATION_PRIORITY_CODES.indexOf(right))
  const clarifications = profile.clarifications.slice().sort((left, right) =>
    left.clarificationId < right.clarificationId ? -1 : left.clarificationId > right.clarificationId ? 1 : 0)
  const evidence = profile.evidence.slice().sort((left, right) =>
    left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
  return copyValue({
    adl: profile.adl.derivedFacts,
    mobility: profile.mobility.derivedFacts,
    health: profile.health.derivedFacts,
    cognition: profile.cognition.derivedFacts,
    specialCare: profile.specialCare.derivedFacts,
    preference: { ...profile.preference.rawFacts, priorities },
    financial: profile.financial.rawFacts,
    intent: profile.intent.rawFacts,
    evidence,
    clarifications,
  })
}

export const derivedEvidenceRefs = asDerivedRefs

export const validateAndSnapshotProfile = (
  input: unknown,
  expectedKind: 'elder_profile' | 'elder_profile_preview',
): RecommendationEvaluationResult<ValidatedProfileSnapshot> => {
  const profileResult = validateProfileShape(input, expectedKind)
  if (!profileResult.ok) {
    return profileResult
  }
  const profile = profileResult.value
  const readiness = buildReadiness(profile)
  const snapshot = createSnapshot(profile)
  return {
    ok: true,
    value: {
      profile: {
        adl: { derivedFacts: snapshot.adl },
        mobility: { derivedFacts: snapshot.mobility },
        health: { derivedFacts: snapshot.health },
        cognition: { derivedFacts: snapshot.cognition },
        specialCare: { derivedFacts: snapshot.specialCare },
        preference: { rawFacts: snapshot.preference },
        financial: { rawFacts: snapshot.financial },
        intent: { rawFacts: snapshot.intent },
      },
      snapshot,
      elderReadiness: readiness.elderReadiness,
      requirementReadiness: copyValue(readiness.requirementReadiness),
      elderClarifications: snapshot.clarifications,
    },
  }
}

export const rawPreferenceEvidenceRef = (
  profile: RecommendationCoreProfile,
  path: 'preferredInstitutionType' | 'priorities' | 'regionPreference',
): ElderEvidenceRef => {
  if (path === 'preferredInstitutionType') {
    return {
      kind: 'profile_raw_fact',
      profilePath: 'preference.rawFacts.preferredInstitutionType',
      sourceQuestionId: 'preference.careType',
      valueSnapshot: profile.preference.rawFacts.preferredInstitutionType,
    }
  }
  if (path === 'priorities') {
    return {
      kind: 'profile_raw_fact',
      profilePath: 'preference.rawFacts.priorities',
      sourceQuestionId: 'preference.priorities',
      valueSnapshot: profile.preference.rawFacts.priorities.slice().sort((left, right) =>
        RECOMMENDATION_PRIORITY_CODES.indexOf(left) - RECOMMENDATION_PRIORITY_CODES.indexOf(right)),
    }
  }
  const region = profile.preference.rawFacts.regionPreference
  return {
    kind: 'profile_raw_fact',
    profilePath: 'preference.rawFacts.regionPreference',
    sourceQuestionId: 'preference.region',
    presence: region === undefined ? 'absent' : 'provided',
    valueSnapshot: region === undefined ? null : region,
  }
}

export const rawFinancialEvidenceRef = (
  profile: RecommendationCoreProfile,
): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'financial.rawFacts.monthlyBudget',
  sourceQuestionId: 'budget.monthlyRange',
  valueSnapshot: profile.financial.rawFacts.monthlyBudget,
})

export const rawIntentEvidenceRef = (
  profile: RecommendationCoreProfile,
): ElderEvidenceRef => ({
  kind: 'profile_raw_fact',
  profilePath: 'intent.rawFacts.moveInTiming',
  sourceQuestionId: 'budget.moveInTiming',
  valueSnapshot: profile.intent.rawFacts.moveInTiming,
})
