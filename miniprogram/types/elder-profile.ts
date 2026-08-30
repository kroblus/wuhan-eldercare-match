import type {
  AdlRequiredQuestionId,
  AssessmentAnswerValueMap,
  AssessmentQuestionId,
  AssessmentSchemaVersion,
} from './assessment'

/** Frozen Phase 3A-2 semantic versions. */
export type ElderProfileContractVersion = 'elder-profile-contract-v1'
export type ElderProfileDerivationRulesetVersion = 'elder-profile-ruleset-v1'
export type AdlRulesetVersion = 'adl-ruleset-v1'

export type AssessmentAnswerOf<Q extends AssessmentQuestionId> = AssessmentAnswerValueMap[Q]

export interface ElderProfileIdentity {
  elderId: string
  assessmentId: string
  assessmentSchemaVersion: AssessmentSchemaVersion
  assessmentCompletedAt: string
  profileContractVersion: ElderProfileContractVersion
  derivationRulesetVersion: ElderProfileDerivationRulesetVersion
}

export interface BasicProfileRawFacts {
  relation: AssessmentAnswerOf<'basic.relationship'>
  name?: AssessmentAnswerOf<'basic.elderName'>
  sex: AssessmentAnswerOf<'basic.gender'>
  age: AssessmentAnswerOf<'basic.age'>
  livingStatus?: AssessmentAnswerOf<'basic.livingStatus'>
  primaryCaregiver?: AssessmentAnswerOf<'basic.primaryCaregiver'>
  hasInstitutionExperience?: AssessmentAnswerOf<'basic.hasInstitutionExperience'>
  institutionExitReasons?: AssessmentAnswerOf<'basic.institutionExitReasons'>
}

export interface HealthProfileRawFacts {
  /** Preserves concrete codes, [none], or [unknown] exactly as reported. */
  reportedDiseases: AssessmentAnswerOf<'health.conditions'>
  /** Preserves concrete codes, [none], or [unknown] exactly as reported. */
  recentHealthRisks: AssessmentAnswerOf<'health.recentEvents'>
  rehabilitationNeedAnswer: AssessmentAnswerOf<'health.rehabilitationNeed'>
}

export interface AdlProfileRawAnswers {
  eating: AssessmentAnswerOf<'adl.eating'>
  mobility: AssessmentAnswerOf<'adl.mobility'>
  toileting: AssessmentAnswerOf<'adl.toileting'>
  bathing: AssessmentAnswerOf<'adl.bathing'>
  dressing: AssessmentAnswerOf<'adl.dressing'>
  transfer: AssessmentAnswerOf<'adl.transfer'>
  stairs: AssessmentAnswerOf<'adl.stairs'>
}

export interface CognitionProfileRawFacts {
  reportedSymptoms: AssessmentAnswerOf<'cognitive.symptoms'>
}

export interface SpecialCareProfileRawFacts {
  answers: AssessmentAnswerOf<'cognitive.specialCareNeeds'>
}

export interface PreferenceProfileRawFacts {
  preferredInstitutionType: AssessmentAnswerOf<'preference.careType'>
  priorities: AssessmentAnswerOf<'preference.priorities'>
  regionPreference?: AssessmentAnswerOf<'preference.region'>
}

export interface FinancialProfileRawFacts {
  monthlyBudget: AssessmentAnswerOf<'budget.monthlyRange'>
  depositTolerance: AssessmentAnswerOf<'budget.upfrontCostAcceptance'>
}

export interface IntentProfileRawFacts {
  moveInTiming: AssessmentAnswerOf<'budget.moveInTiming'>
  consultantIntent: AssessmentAnswerOf<'budget.consultantSupport'>
}

export type DerivationConfidence = 'high' | 'medium' | 'needs_confirmation'

export interface KnownDerivedFact<T> {
  status: 'known'
  value: T
  confidence: Exclude<DerivationConfidence, 'needs_confirmation'>
  evidenceIds: readonly [string, ...string[]]
}

export interface UnknownDerivedFact {
  status: 'unknown'
  confidence: 'needs_confirmation'
  evidenceIds: readonly [string, ...string[]]
  clarificationIds: readonly [string, ...string[]]
}

export interface NeedsConfirmationDerivedFact<T> {
  status: 'needs_confirmation'
  confidence: 'needs_confirmation'
  candidateValue?: T
  evidenceIds: readonly [string, ...string[]]
  clarificationIds: readonly [string, ...string[]]
}

/** Used only where unknown or ambiguous input is materially different from a fact. */
export type DerivedFact<T> =
  | KnownDerivedFact<T>
  | UnknownDerivedFact
  | NeedsConfirmationDerivedFact<T>

export type AdlCareLevel =
  | 'independent'
  | 'light_care'
  | 'semi_disabled'
  | 'disabled'
  | 'severely_disabled'

export type AdlObservationCoverageIssue =
  | 'stairs_not_applicable'
  | 'special_feeding_non_ordinal'
  | 'catheter_or_stoma_non_ordinal'
  | 'unknown_input'

export interface AdlObservationCoverage {
  status: 'complete' | 'limited' | 'unknown'
  issues: readonly AdlObservationCoverageIssue[]
}

export type AdlCareModeCode =
  | 'feeding_minor'
  | 'feeding_dependence'
  | 'special_feeding_review'
  | 'walking_aid'
  | 'wheelchair'
  | 'bedridden'
  | 'toileting_minor'
  | 'incontinence'
  | 'toileting_full_assistance'
  | 'catheter_or_stoma_review'
  | 'bathing_partial'
  | 'bathing_full_assistance'
  | 'dressing_partial'
  | 'dressing_full_assistance'
  | 'transfer_minor'
  | 'transfer_support'
  | 'fully_dependent_transfer'
  | 'stairs_assistance'
  | 'stairs_unable'
  | 'no_stairs_context'

interface AdlCareModeFactBase {
  code: AdlCareModeCode
  evidenceIds: readonly [string, ...string[]]
}

export type AdlCareModeFact = AdlCareModeFactBase & (
  | {
    status: 'reported' | 'context'
    clarificationIds?: readonly [string, ...string[]]
  }
  | {
    status: 'needs_confirmation'
    clarificationIds: readonly [string, ...string[]]
  }
)

export interface AdlProfileDerivedFacts {
  rulesetVersion: AdlRulesetVersion
  careLevel: DerivedFact<AdlCareLevel>
  /** Structured second axis; it never replaces the seven raw ADL answers. */
  careModes: readonly AdlCareModeFact[]
  observationCoverage: AdlObservationCoverage
  /** Explicit unknown answers only; missing required IDs reject derivation. */
  unknownQuestionIds: readonly AdlRequiredQuestionId[]
}

export type MobilityLevel = 'independent' | 'walking_aid' | 'wheelchair' | 'bedbound'

export interface MobilityProfileDerivedFacts {
  level: DerivedFact<MobilityLevel>
}

export type RehabilitationRequirement = 'required' | 'possible' | 'not_required'

export interface HealthProfileDerivedFacts {
  rehabilitationNeed: DerivedFact<RehabilitationRequirement>
}

export type CognitiveConcern = 'present' | 'absent' | 'not_reported'
export type ReportedCognitiveDiagnosis = 'reported' | 'not_reported'
export type ReportedRiskState = 'present' | 'not_reported'

export interface CognitionProfileDerivedFacts {
  cognitiveConcern: DerivedFact<CognitiveConcern>
  /** `reported` means user-reported diagnosis; it is never a system diagnosis. */
  reportedDiagnosis: DerivedFact<ReportedCognitiveDiagnosis>
  wanderingRisk: DerivedFact<ReportedRiskState>
  behavioralRisk: DerivedFact<ReportedRiskState>
  sleepCycleIssue: DerivedFact<ReportedRiskState>
}

export type CareCapabilityCode =
  | 'round_the_clock_care'
  | 'one_to_one_caregiver'
  | 'night_care'
  | 'dementia_unit'
  | 'rehabilitation_training'
  | 'tube_feeding'
  | 'catheter_care'
  | 'pressure_injury_care'
  | 'incontinence_care'

export type CareCapabilityRequirementStatus =
  | 'required'
  | 'not_required'
  | 'not_reported'
  | 'unknown'
  | 'needs_confirmation'

interface CareCapabilityRequirementBase {
  capability: CareCapabilityCode
  evidenceIds: readonly [string, ...string[]]
}

export type CareCapabilityRequirement = CareCapabilityRequirementBase & (
  | {
    status: Exclude<CareCapabilityRequirementStatus, 'unknown' | 'needs_confirmation'>
    clarificationIds?: readonly [string, ...string[]]
  }
  | {
    status: 'unknown' | 'needs_confirmation'
    clarificationIds: readonly [string, ...string[]]
  }
)

export interface SpecialCareProfileDerivedFacts {
  /** One entry per V1 capability; matching must not collapse unknown into false. */
  requiredCareCapabilities: readonly CareCapabilityRequirement[]
}

export type ElderProfileDerivedField =
  | 'health.rehabilitationNeed'
  | 'adl.careLevel'
  | `adl.careModes.${AdlCareModeCode}`
  | 'mobility.level'
  | 'cognition.cognitiveConcern'
  | 'cognition.reportedDiagnosis'
  | 'cognition.wanderingRisk'
  | 'cognition.behavioralRisk'
  | 'cognition.sleepCycleIssue'
  | `specialCare.requiredCareCapabilities.${CareCapabilityCode}`

export type AdlRuleCode =
  | 'C_UNKNOWN_BLOCK'
  | 'C_SEVERE_OVERRIDE'
  | 'C_DEPENDENT_FLOOR'
  | 'C_TWO_HALF_ESCALATION'
  | 'C_NON_CORE_HALF_FALLBACK'
  | 'C_HALF_FLOOR'
  | 'C_TWO_LIGHT_ESCALATION'
  | 'C_NO_BURDEN'
  | 'C_PROJECT_CARE_MODE'
  | 'C_NO_STAIRS_NEUTRAL'

export type ElderProfileRuleCode =
  | 'MOBILITY_DIRECT'
  | 'REHABILITATION'
  | 'COGNITIVE_CONCERN'
  | 'REPORTED_DIAGNOSIS'
  | 'WANDERING_RISK'
  | 'BEHAVIORAL_RISK'
  | 'SLEEP_CYCLE'
  | 'CARE_CAPABILITY'

export type DerivationRuleId =
  | `adl-ruleset-v1:${AdlRuleCode}`
  | `elder-profile-ruleset-v1:${ElderProfileRuleCode}`

export type DerivationEvidenceId = `ev:${ElderProfileDerivedField}`

export type DerivationEvidenceOutcomeCode =
  | AdlCareLevel
  | MobilityLevel
  | RehabilitationRequirement
  | CognitiveConcern
  | ReportedCognitiveDiagnosis
  | ReportedRiskState
  | CareCapabilityRequirementStatus
  | 'reported'
  | 'context'
  | 'unknown'
  | 'needs_confirmation'

export type CodedAssessmentQuestionId = Exclude<
  AssessmentQuestionId,
  'basic.elderName' | 'basic.age' | 'preference.region'
>

export type AssessmentMultiChoiceQuestionId =
  | 'basic.institutionExitReasons'
  | 'health.conditions'
  | 'health.recentEvents'
  | 'cognitive.symptoms'
  | 'cognitive.specialCareNeeds'
  | 'preference.priorities'

export type AssessmentOptionCode<Q extends CodedAssessmentQuestionId> =
  AssessmentAnswerValueMap[Q] extends readonly (infer Item)[]
    ? Extract<Item, string>
    : Extract<AssessmentAnswerValueMap[Q], string>

export type EvidenceContribution =
  | 'supports'
  | 'overrides'
  | 'context'
  | 'limits_confidence'
  | 'excluded_not_applicable'
  | 'requires_clarification'
  | 'establishes_not_reported'

export type AssessmentOptionEvidenceSource = {
  [Q in CodedAssessmentQuestionId]: {
    sourceKind: 'assessment_option'
    sourceQuestionId: Q
    sourceOptionCode: AssessmentOptionCode<Q>
    contribution: Exclude<EvidenceContribution, 'establishes_not_reported'>
  }
}[CodedAssessmentQuestionId]

/**
 * Evidence for an absence claim. `sourceOptionCodes` is the exact persisted
 * multi-choice answer snapshot and `targetOptionCode` must not be in that set.
 */
export type AssessmentAnswerSetEvidenceSource = {
  [Q in AssessmentMultiChoiceQuestionId]: {
    sourceKind: 'assessment_answer_set'
    sourceQuestionId: Q
    sourceOptionCodes: readonly AssessmentOptionCode<Q>[]
    targetOptionCode: AssessmentOptionCode<Q>
    contribution: 'establishes_not_reported'
  }
}[AssessmentMultiChoiceQuestionId]

export type AssessmentEvidenceSource =
  | AssessmentOptionEvidenceSource
  | AssessmentAnswerSetEvidenceSource

export interface DerivationEvidence {
  /** Exactly one final evidence record exists for each derived field. */
  evidenceId: DerivationEvidenceId
  derivedField: ElderProfileDerivedField
  outcomeCode: DerivationEvidenceOutcomeCode
  ruleId: DerivationRuleId
  sources: readonly [AssessmentEvidenceSource, ...AssessmentEvidenceSource[]]
}

export type ClarificationReasonCode =
  | 'other_without_detail'
  | 'unknown_answer'
  | 'non_ordinal_adl_answer'
  | 'cross_answer_conflict'
  | 'risk_signal_needs_confirmation'

export type ClarificationPriority =
  | 'required_before_classification'
  | 'required_before_hard_filter'
  | 'recommended'
  | 'informational'

export interface ProfileClarification {
  clarificationId: `cl:${ClarificationReasonCode}:${string}`
  status: 'open'
  reasonCode: ClarificationReasonCode
  priority: ClarificationPriority
  sources: readonly [AssessmentEvidenceSource, ...AssessmentEvidenceSource[]]
  affectedDerivedFields: readonly [ElderProfileDerivedField, ...ElderProfileDerivedField[]]
}

export type ProfileSummarySectionCode =
  | 'basic'
  | 'health'
  | 'adl'
  | 'mobility'
  | 'cognition'
  | 'special_care'
  | 'preference'
  | 'financial_intent'

export type BasicProfileSummaryCode =
  | 'basic.relationship'
  | 'basic.name'
  | 'basic.gender'
  | 'basic.age'
  | 'basic.living_status'
  | 'basic.primary_caregiver'
  | 'basic.institution_experience'
  | 'basic.institution_exit_reasons'

export type HealthProfileSummaryCode =
  | 'health.reported_diseases'
  | 'health.recent_risks'
  | 'health.rehabilitation_need'

export type AdlProfileSummaryCode =
  | 'adl.care_level'
  | `adl.care_mode.${AdlCareModeCode}`

export type MobilityProfileSummaryCode = 'mobility.level'

export type CognitionProfileSummaryCode =
  | 'cognition.concern'
  | 'cognition.reported_diagnosis'
  | 'cognition.wandering_risk'
  | 'cognition.behavioral_risk'
  | 'cognition.sleep_cycle_issue'

export type SpecialCareProfileSummaryCode = `special_care.capability.${CareCapabilityCode}`

export type PreferenceProfileSummaryCode =
  | 'preference.care_type'
  | 'preference.priorities'
  | 'preference.region'

export type FinancialIntentProfileSummaryCode =
  | 'financial.monthly_budget'
  | 'financial.deposit_tolerance'
  | 'intent.move_in_timing'
  | 'intent.consultant_support'

export type ProfileSummaryCode =
  | BasicProfileSummaryCode
  | HealthProfileSummaryCode
  | AdlProfileSummaryCode
  | MobilityProfileSummaryCode
  | CognitionProfileSummaryCode
  | SpecialCareProfileSummaryCode
  | PreferenceProfileSummaryCode
  | FinancialIntentProfileSummaryCode

export type ProfileSummarySource =
  | {
    kind: 'raw_fact'
    sourceQuestionId: AssessmentQuestionId
  }
  | {
    kind: 'derived_fact'
    derivedField: ElderProfileDerivedField
    evidenceIds: readonly [string, ...string[]]
  }

/** Phase 3A-2 freezes semantic summary codes, not Chinese presentation copy. */
export interface ProfileSummaryItem<C extends ProfileSummaryCode = ProfileSummaryCode> {
  summaryCode: C
  sources: readonly [ProfileSummarySource, ...ProfileSummarySource[]]
}

export interface ProfileSummarySection<
  S extends ProfileSummarySectionCode = ProfileSummarySectionCode,
  C extends ProfileSummaryCode = ProfileSummaryCode
> {
  section: S
  items: readonly ProfileSummaryItem<C>[]
}

export interface ElderProfileUserFacingSummary {
  summarySchemaVersion: 'elder-profile-summary-input-v1'
  sections: readonly [
    ProfileSummarySection<'basic', BasicProfileSummaryCode>,
    ProfileSummarySection<'health', HealthProfileSummaryCode>,
    ProfileSummarySection<'adl', AdlProfileSummaryCode>,
    ProfileSummarySection<'mobility', MobilityProfileSummaryCode>,
    ProfileSummarySection<'cognition', CognitionProfileSummaryCode>,
    ProfileSummarySection<'special_care', SpecialCareProfileSummaryCode>,
    ProfileSummarySection<'preference', PreferenceProfileSummaryCode>,
    ProfileSummarySection<'financial_intent', FinancialIntentProfileSummaryCode>
  ]
}

/** Identity-free semantics shared by formal profiles and ephemeral previews. */
export interface ElderProfileSemanticPayload {
  basic: {
    rawFacts: BasicProfileRawFacts
  }
  health: {
    rawFacts: HealthProfileRawFacts
    derivedFacts: HealthProfileDerivedFacts
  }
  adl: {
    rawAnswers: AdlProfileRawAnswers
    derivedFacts: AdlProfileDerivedFacts
  }
  mobility: {
    derivedFacts: MobilityProfileDerivedFacts
  }
  cognition: {
    rawFacts: CognitionProfileRawFacts
    derivedFacts: CognitionProfileDerivedFacts
  }
  specialCare: {
    rawFacts: SpecialCareProfileRawFacts
    derivedFacts: SpecialCareProfileDerivedFacts
  }
  preference: {
    rawFacts: PreferenceProfileRawFacts
  }
  financial: {
    rawFacts: FinancialProfileRawFacts
  }
  intent: {
    rawFacts: IntentProfileRawFacts
  }
  userFacingSummary: ElderProfileUserFacingSummary
  evidence: readonly DerivationEvidence[]
  clarifications: readonly ProfileClarification[]
}

/** Historical profile derived only from a valid CompletedAssessment. */
export interface ElderProfile extends ElderProfileSemanticPayload {
  kind: 'elder_profile'
  identity: ElderProfileIdentity
}

export interface ElderProfilePreviewSource {
  kind: 'local_assessment_preview'
  localDraftId: string
  assessmentSchemaVersion: AssessmentSchemaVersion
}

/** Ephemeral preview; it is never a CompletedAssessment or saved profile. */
export interface ElderProfilePreview extends ElderProfileSemanticPayload {
  kind: 'elder_profile_preview'
  source: ElderProfilePreviewSource
  profileContractVersion: ElderProfileContractVersion
  derivationRulesetVersion: ElderProfileDerivationRulesetVersion
}

export type AdlClassificationErrorCode =
  | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
  | 'INVALID_ADL_ANSWER_NOT_DERIVABLE'

export interface AdlClassificationFailure {
  ok: false
  error: {
    code: AdlClassificationErrorCode
    questionIds: readonly AdlRequiredQuestionId[]
  }
}

export interface AdlClassificationSuccess {
  ok: true
  classification: {
    rawAnswers: AdlProfileRawAnswers
    derivedFacts: AdlProfileDerivedFacts
    evidence: readonly DerivationEvidence[]
    clarifications: readonly ProfileClarification[]
  }
}

export type AdlClassificationResult = AdlClassificationSuccess | AdlClassificationFailure

export type ElderProfileDerivationErrorCode =
  | 'NOT_COMPLETED_ASSESSMENT'
  | 'UNSUPPORTED_ASSESSMENT_SCHEMA'
  | 'INVALID_COMPLETED_AT_TIMESTAMP'
  | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
  | 'INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE'

export interface ElderProfileDerivationFailure {
  ok: false
  error: {
    code: ElderProfileDerivationErrorCode
    questionIds: readonly AssessmentQuestionId[]
  }
}

export interface ElderProfileDerivationSuccess {
  ok: true
  profile: ElderProfile
}

export type ElderProfileDerivationResult =
  | ElderProfileDerivationSuccess
  | ElderProfileDerivationFailure

export type ElderProfilePreviewDerivationErrorCode =
  | 'INVALID_DRAFT_STRUCTURE'
  | 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE'
  | 'UNSUPPORTED_ASSESSMENT_SCHEMA'

export interface ElderProfilePreviewDerivationFailure {
  ok: false
  error: {
    code: ElderProfilePreviewDerivationErrorCode
    questionIds: readonly AssessmentQuestionId[]
  }
}

export interface ElderProfilePreviewDerivationSuccess {
  ok: true
  preview: ElderProfilePreview
}

export type ElderProfilePreviewDerivationResult =
  | ElderProfilePreviewDerivationSuccess
  | ElderProfilePreviewDerivationFailure
