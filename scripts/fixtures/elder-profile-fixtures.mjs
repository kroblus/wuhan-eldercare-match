const BASE_ADL_ANSWERS = Object.freeze({
  eating: 'independent',
  mobility: 'independent',
  toileting: 'independent',
  bathing: 'independent',
  dressing: 'independent',
  transfer: 'independent',
  stairs: 'independent',
})

export const ADL_QUESTION_ORDER = Object.freeze([
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.bathing',
  'adl.dressing',
  'adl.transfer',
  'adl.stairs',
])

export const CARE_CAPABILITY_ORDER = Object.freeze([
  'round_the_clock_care',
  'one_to_one_caregiver',
  'night_care',
  'dementia_unit',
  'rehabilitation_training',
  'tube_feeding',
  'catheter_care',
  'pressure_injury_care',
  'incontinence_care',
])

export const makeAdlAnswers = (overrides = {}) => ({
  ...BASE_ADL_ANSWERS,
  ...overrides,
})

const BASE_COMPLETED_ANSWERS = Object.freeze({
  'basic.relationship': 'father',
  'basic.gender': 'male',
  'basic.age': 72,
  'health.conditions': ['none'],
  'health.recentEvents': ['none'],
  'health.rehabilitationNeed': 'none',
  'adl.eating': BASE_ADL_ANSWERS.eating,
  'adl.mobility': BASE_ADL_ANSWERS.mobility,
  'adl.toileting': BASE_ADL_ANSWERS.toileting,
  'adl.bathing': BASE_ADL_ANSWERS.bathing,
  'adl.dressing': BASE_ADL_ANSWERS.dressing,
  'adl.transfer': BASE_ADL_ANSWERS.transfer,
  'adl.stairs': BASE_ADL_ANSWERS.stairs,
  'cognitive.symptoms': ['none'],
  'cognitive.specialCareNeeds': ['none'],
  'preference.careType': 'unknown',
  'preference.priorities': ['price'],
  'budget.monthlyRange': 'unknown',
  'budget.upfrontCostAcceptance': 'unknown',
  'budget.moveInTiming': 'research_only',
  'budget.consultantSupport': 'recommendation_first',
})

export const makeCompletedAssessment = (answerOverrides = {}, identityOverrides = {}) => ({
  kind: 'completed_assessment',
  id: identityOverrides.id || 'assessment-fixture-001',
  elderId: identityOverrides.elderId || 'elder-fixture-001',
  status: 'completed',
  schemaVersion: 1,
  answers: {
    ...BASE_COMPLETED_ANSWERS,
    ...answerOverrides,
  },
  completedAt: Object.prototype.hasOwnProperty.call(identityOverrides, 'completedAt')
    ? identityOverrides.completedAt
    : '2026-08-30T09:00:00.000Z',
})

export const completedAtValidationFixtures = Object.freeze([
  {
    id: 'COMPLETED_AT_VALID_ISO',
    completedAt: '2026-08-30T09:00:00.000Z',
    expectedErrorCode: null,
  },
  {
    id: 'COMPLETED_AT_EMPTY',
    completedAt: '',
    expectedErrorCode: 'INVALID_COMPLETED_AT_TIMESTAMP',
  },
  {
    id: 'COMPLETED_AT_ARBITRARY_TEXT',
    completedAt: 'not-a-timestamp',
    expectedErrorCode: 'INVALID_COMPLETED_AT_TIMESTAMP',
  },
  {
    id: 'COMPLETED_AT_MALFORMED',
    completedAt: '2026-8-30T09:00:00.000Z',
    expectedErrorCode: 'INVALID_COMPLETED_AT_TIMESTAMP',
  },
  {
    id: 'COMPLETED_AT_IMPOSSIBLE_DATE',
    completedAt: '2026-02-30T09:00:00.000Z',
    expectedErrorCode: 'INVALID_COMPLETED_AT_TIMESTAMP',
  },
  {
    id: 'COMPLETED_AT_IMPOSSIBLE_TIME',
    completedAt: '2026-08-30T24:00:00.000Z',
    expectedErrorCode: 'INVALID_COMPLETED_AT_TIMESTAMP',
  },
])

const adlOverrides = (overrides) => makeAdlAnswers(overrides)

/** Normative Proposal C cases. C12/C13 intentionally expose both fixtures. */
export const elderProfileFixtures = Object.freeze([
  {
    id: 'C01',
    expected: {
      careLevel: 'independent', careLevelStatus: 'known', confidence: 'high', rule: 'C_NO_BURDEN',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [], careModes: [],
    },
    answers: adlOverrides({}),
  },
  {
    id: 'C02',
    expected: {
      careLevel: 'light_care', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_LIGHT_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'bathing_partial', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ bathing: 'partial_assistance' }),
  },
  {
    id: 'C03',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_LIGHT_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'walking_aid', status: 'reported', clarificationIds: [] },
        { code: 'bathing_partial', status: 'reported', clarificationIds: [] },
      ],
    },
    answers: adlOverrides({ mobility: 'walking_aid', bathing: 'partial_assistance' }),
  },
  {
    id: 'C04',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_HALF_FLOOR',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'wheelchair', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ mobility: 'wheelchair' }),
  },
  {
    id: 'C05',
    expected: {
      careLevel: 'disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_DEPENDENT_FLOOR',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'feeding_dependence', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ eating: 'needs_feeding' }),
  },
  {
    id: 'C06',
    expected: {
      careLevel: 'independent', careLevelStatus: 'known', confidence: 'medium', rule: 'C_NO_BURDEN',
      coverage: { status: 'limited', issues: ['special_feeding_non_ordinal'] }, unknownQuestionIds: [],
      careModes: [{
        code: 'special_feeding_review', status: 'needs_confirmation',
        clarificationIds: ['cl:non_ordinal_adl_answer:adl.eating'],
      }],
      profileClarificationIds: [
        'cl:non_ordinal_adl_answer:adl.eating',
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.tube_feeding',
      ],
    },
    answers: adlOverrides({ eating: 'special_feeding' }),
  },
  {
    id: 'C07',
    expected: {
      careLevel: 'severely_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_SEVERE_OVERRIDE',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'bedridden', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ mobility: 'bedridden' }),
  },
  {
    id: 'C08',
    expected: {
      careLevel: 'severely_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_SEVERE_OVERRIDE',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'fully_dependent_transfer', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ transfer: 'fully_dependent' }),
  },
  {
    id: 'C09',
    expected: {
      careLevel: 'disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_DEPENDENT_FLOOR',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'toileting_full_assistance', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ toileting: 'full_assistance' }),
  },
  {
    id: 'C10',
    expected: {
      careLevel: 'independent', careLevelStatus: 'known', confidence: 'medium', rule: 'C_NO_BURDEN',
      coverage: { status: 'limited', issues: ['catheter_or_stoma_non_ordinal'] }, unknownQuestionIds: [],
      careModes: [{
        code: 'catheter_or_stoma_review', status: 'needs_confirmation',
        clarificationIds: ['cl:non_ordinal_adl_answer:adl.toileting'],
      }],
      profileClarificationIds: [
        'cl:non_ordinal_adl_answer:adl.toileting',
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.catheter_care',
      ],
    },
    answers: adlOverrides({ toileting: 'catheter_or_stoma' }),
  },
  {
    id: 'C11',
    expected: {
      careLevel: 'independent', careLevelStatus: 'known', confidence: 'medium', rule: 'C_NO_BURDEN',
      coverage: { status: 'limited', issues: ['stairs_not_applicable'] }, unknownQuestionIds: [],
      careModes: [{ code: 'no_stairs_context', status: 'context', clarificationIds: [] }],
    },
    answers: adlOverrides({ stairs: 'no_stairs' }),
  },
  {
    id: 'C12a',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_LIGHT_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'walking_aid', status: 'reported', clarificationIds: [] },
        { code: 'bathing_partial', status: 'reported', clarificationIds: [] },
      ],
    },
    answers: adlOverrides({ mobility: 'walking_aid', bathing: 'partial_assistance' }),
  },
  {
    id: 'C12b',
    expected: {
      careLevel: 'independent', careLevelStatus: 'known', confidence: 'medium', rule: 'C_NO_BURDEN',
      coverage: { status: 'limited', issues: ['special_feeding_non_ordinal'] }, unknownQuestionIds: [],
      careModes: [{
        code: 'special_feeding_review', status: 'needs_confirmation',
        clarificationIds: ['cl:non_ordinal_adl_answer:adl.eating'],
      }],
      profileClarificationIds: [
        'cl:non_ordinal_adl_answer:adl.eating',
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.tube_feeding',
      ],
    },
    answers: adlOverrides({ eating: 'special_feeding' }),
  },
  {
    id: 'C13a',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_HALF_FLOOR',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'wheelchair', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ mobility: 'wheelchair' }),
  },
  {
    id: 'C13b',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_HALF_FLOOR',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'incontinence', status: 'reported', clarificationIds: [] }],
      profileClarificationIds: [
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.incontinence_care',
      ],
    },
    answers: adlOverrides({ toileting: 'frequent_incontinence' }),
  },
  {
    id: 'C14',
    expected: {
      careLevel: 'unknown', careLevelStatus: 'unknown', confidence: 'needs_confirmation', rule: 'C_UNKNOWN_BLOCK',
      coverage: { status: 'unknown', issues: ['unknown_input'] }, unknownQuestionIds: ['adl.bathing'], careModes: [],
      careLevelClarificationIds: ['cl:unknown_answer:adl.bathing'],
    },
    answers: adlOverrides({ bathing: 'unknown' }),
  },
  {
    id: 'C15',
    expected: { error: { code: 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE', questionIds: ['adl.transfer'] } },
    answers: (() => { const value = adlOverrides({}); delete value.transfer; return value })(),
  },
  {
    id: 'C16',
    expected: {
      careLevel: 'disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_HALF_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'incontinence', status: 'reported', clarificationIds: [] },
        { code: 'transfer_support', status: 'reported', clarificationIds: [] },
      ],
      profileClarificationIds: [
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.incontinence_care',
      ],
    },
    answers: adlOverrides({ toileting: 'frequent_incontinence', transfer: 'needs_support' }),
  },
  {
    id: 'C17',
    expected: {
      careLevel: 'light_care', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_LIGHT_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [{ code: 'walking_aid', status: 'reported', clarificationIds: [] }],
    },
    answers: adlOverrides({ mobility: 'walking_aid' }),
  },
  {
    id: 'C18',
    expected: {
      careLevel: 'disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_HALF_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'wheelchair', status: 'reported', clarificationIds: [] },
        { code: 'bathing_full_assistance', status: 'reported', clarificationIds: [] },
      ],
    },
    answers: adlOverrides({ mobility: 'wheelchair', bathing: 'full_assistance' }),
  },
  {
    id: 'C19',
    expected: {
      careLevel: 'disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_TWO_HALF_ESCALATION',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'wheelchair', status: 'reported', clarificationIds: [] },
        { code: 'incontinence', status: 'reported', clarificationIds: [] },
        { code: 'transfer_support', status: 'reported', clarificationIds: [] },
      ],
      profileClarificationIds: [
        'cl:risk_signal_needs_confirmation:specialCare.requiredCareCapabilities.incontinence_care',
      ],
    },
    answers: adlOverrides({ mobility: 'wheelchair', toileting: 'frequent_incontinence', transfer: 'needs_support' }),
  },
  {
    id: 'C20',
    expected: {
      careLevel: 'severely_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_SEVERE_OVERRIDE',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'toileting_full_assistance', status: 'reported', clarificationIds: [] },
        { code: 'bathing_full_assistance', status: 'reported', clarificationIds: [] },
        { code: 'dressing_full_assistance', status: 'reported', clarificationIds: [] },
        { code: 'fully_dependent_transfer', status: 'reported', clarificationIds: [] },
      ],
    },
    answers: adlOverrides({ toileting: 'full_assistance', bathing: 'full_assistance', dressing: 'full_assistance', transfer: 'fully_dependent' }),
  },
  {
    id: 'C21',
    expected: {
      careLevel: 'semi_disabled', careLevelStatus: 'known', confidence: 'high', rule: 'C_NON_CORE_HALF_FALLBACK',
      coverage: { status: 'complete', issues: [] }, unknownQuestionIds: [],
      careModes: [
        { code: 'bathing_full_assistance', status: 'reported', clarificationIds: [] },
        { code: 'dressing_full_assistance', status: 'reported', clarificationIds: [] },
      ],
    },
    answers: adlOverrides({ bathing: 'full_assistance', dressing: 'full_assistance' }),
  },
])

export { BASE_COMPLETED_ANSWERS }
