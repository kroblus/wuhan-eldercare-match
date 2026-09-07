const BASE_V2_ANSWERS = Object.freeze({
  'basic.relationship': 'father',
  'basic.gender': 'male',
  'basic.age': 72,
  'health.conditions': Object.freeze(['none']),
  'health.recentEvents': Object.freeze(['none']),
  'health.rehabilitationNeed': 'none',
  'health.chewingAbility': 'normal',
  'health.swallowingAbility': 'normal',
  'adl.eating': 'independent',
  'adl.mobility': 'independent',
  'adl.toileting': 'independent',
  'adl.bathing': 'independent',
  'adl.dressing': 'independent',
  'adl.transfer': 'independent',
  'adl.stairs': 'independent',
  'cognitive.symptoms': Object.freeze(['none']),
  'cognitive.specialCareNeeds': Object.freeze(['none']),
  'preference.careType': 'unknown',
  'preference.roomType': 'no_preference',
  'preference.mealSchedule': 'no_preference',
  'preference.activityPreference': 'no_preference',
  'preference.priorities': Object.freeze(['price']),
  'budget.monthlyRange': 'unknown',
  'budget.upfrontCostAcceptance': 'unknown',
  'budget.moveInTiming': 'research_only',
  'budget.consultantSupport': 'recommendation_first',
})

const cloneValue = (value) => {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (value && typeof value === 'object') {
    return { ...value }
  }
  return value
}

export const makeV2Answers = (overrides = {}) => {
  const answers = {}
  Object.entries({ ...BASE_V2_ANSWERS, ...overrides }).forEach(([key, value]) => {
    if (value !== undefined) {
      answers[key] = cloneValue(value)
    }
  })
  return answers
}

export const makeCompletedAssessmentV2 = (answerOverrides = {}, identityOverrides = {}) => ({
  kind: 'completed_assessment',
  id: identityOverrides.id || 'assessment-v2-fixture-001',
  elderId: identityOverrides.elderId || 'elder-v2-fixture-001',
  status: 'completed',
  schemaVersion: 2,
  answers: makeV2Answers(answerOverrides),
  completedAt: Object.prototype.hasOwnProperty.call(identityOverrides, 'completedAt')
    ? identityOverrides.completedAt
    : '2026-09-07T09:00:00.000Z',
})

export const makeAssessmentDraftV2 = (answerOverrides = {}, envelopeOverrides = {}) => ({
  kind: 'assessment_draft',
  schemaVersion: 2,
  localDraftId: envelopeOverrides.localDraftId || 'local-v2-fixture-001',
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: envelopeOverrides.currentStep || 'budget',
  answers: makeV2Answers(answerOverrides),
  startedAt: envelopeOverrides.startedAt || '2026-09-07T08:00:00.000Z',
  updatedAt: envelopeOverrides.updatedAt || '2026-09-07T09:00:00.000Z',
})

export const elderProfileV2Fixtures = Object.freeze([
  {
    id: 'PROFILE-V2-001',
    title: 'normal chewing and swallowing',
    answers: {},
    expected: {
      foodTexture: { status: 'known', value: 'standard' },
      swallowing: { status: 'known', value: 'normal' },
    },
  },
  {
    id: 'PROFILE-V2-002',
    title: 'easy chew food texture',
    answers: { 'health.chewingAbility': 'easy_chew' },
    expected: { foodTexture: { status: 'known', value: 'easy_chew' } },
  },
  {
    id: 'PROFILE-V2-003',
    title: 'modified food texture',
    answers: { 'health.chewingAbility': 'modified_food' },
    expected: { foodTexture: { status: 'known', value: 'modified_food' } },
  },
  {
    id: 'PROFILE-V2-004',
    title: 'occasional swallowing concern',
    answers: { 'health.swallowingAbility': 'occasional_difficulty' },
    expected: {
      swallowing: { status: 'needs_confirmation', candidateValue: 'occasional_difficulty' },
      clarificationId: 'cl:risk_signal_needs_confirmation:nutrition.swallowingConcern',
    },
  },
  {
    id: 'PROFILE-V2-005',
    title: 'significant swallowing concern',
    answers: { 'health.swallowingAbility': 'significant_difficulty' },
    expected: {
      swallowing: { status: 'needs_confirmation', candidateValue: 'significant_difficulty' },
      clarificationId: 'cl:risk_signal_needs_confirmation:nutrition.swallowingConcern',
    },
  },
  {
    id: 'PROFILE-V2-006',
    title: 'swallowing unknown',
    answers: { 'health.swallowingAbility': 'unknown' },
    expected: {
      swallowing: { status: 'unknown' },
      clarificationId: 'cl:unknown_answer:health.swallowingAbility',
    },
  },
  {
    id: 'PROFILE-V2-007',
    title: 'significant swallowing is not tube feeding',
    answers: {
      'health.swallowingAbility': 'significant_difficulty',
      'cognitive.specialCareNeeds': ['none'],
    },
    expected: { tubeFeedingStatus: 'not_required' },
  },
  {
    id: 'PROFILE-V2-008',
    title: 'explicit tube feeding is required',
    answers: { 'cognitive.specialCareNeeds': ['tube_feeding'] },
    expected: { tubeFeedingStatus: 'required' },
  },
  {
    id: 'PROFILE-V2-009',
    title: 'room preference exact copy',
    answers: { 'preference.roomType': 'single' },
    expected: { roomType: 'single' },
  },
  {
    id: 'PROFILE-V2-010',
    title: 'meal schedule exact copy',
    answers: { 'preference.mealSchedule': 'three_meals_two_snacks' },
    expected: { mealSchedule: 'three_meals_two_snacks' },
  },
  {
    id: 'PROFILE-V2-011',
    title: 'activity preference exact copy',
    answers: { 'preference.activityPreference': 'indoor_and_outdoor' },
    expected: { activityPreference: 'indoor_and_outdoor' },
  },
  {
    id: 'PROFILE-V2-012',
    title: 'priority V2 stable codes and evidence',
    answers: {
      'preference.priorities': ['care_capability', 'near_major_hospital', 'region'],
    },
    expected: {
      priorities: ['care_capability', 'near_major_hospital', 'region'],
    },
  },
  {
    id: 'PROFILE-V2-013',
    title: 'high care and low budget advisory',
    answers: {
      'adl.eating': 'needs_feeding',
      'cognitive.specialCareNeeds': ['round_the_clock_care', 'tube_feeding'],
      'budget.monthlyRange': 'cny_3500_5000',
    },
    expected: {
      advisory: true,
      triggers: [
        'care_level.disabled',
        'special_care.round_the_clock_care',
        'special_care.tube_feeding',
      ],
    },
  },
  {
    id: 'PROFILE-V2-014',
    title: 'high care and higher budget has no advisory',
    answers: {
      'adl.eating': 'needs_feeding',
      'budget.monthlyRange': 'cny_5000_8000',
    },
    expected: { advisory: false },
  },
  {
    id: 'PROFILE-V2-015',
    title: 'low budget and low care has no advisory',
    answers: { 'budget.monthlyRange': 'cny_3500_5000' },
    expected: { advisory: false },
  },
  {
    id: 'PROFILE-V2-016',
    title: 'unknown budget has no advisory',
    answers: {
      'adl.eating': 'needs_feeding',
      'budget.monthlyRange': 'unknown',
    },
    expected: { advisory: false },
  },
  {
    id: 'PROFILE-V2-017',
    title: 'ADL parity against frozen V1 fixtures',
    answers: {},
    expected: { adlParity: 'all-valid-v1-fixtures' },
  },
  {
    id: 'PROFILE-V2-018',
    title: 'repeated derivation is deep equal',
    answers: {
      'health.chewingAbility': 'modified_food',
      'health.swallowingAbility': 'occasional_difficulty',
      'preference.roomType': 'double',
    },
    expected: { deterministicRepeat: true },
  },
])

export const elderProfileV2ParityFixtures = Object.freeze([
  { id: 'PARITY-V2-001', title: 'normal', answers: {} },
  {
    id: 'PARITY-V2-002',
    title: 'nutrition concern',
    answers: {
      'health.chewingAbility': 'easy_chew',
      'health.swallowingAbility': 'significant_difficulty',
    },
  },
  {
    id: 'PARITY-V2-003',
    title: 'unknown',
    answers: {
      'health.chewingAbility': 'unknown',
      'health.swallowingAbility': 'unknown',
      'health.conditions': ['unknown'],
    },
  },
  {
    id: 'PARITY-V2-004',
    title: 'high-care low-budget advisory',
    answers: {
      'adl.mobility': 'bedridden',
      'budget.monthlyRange': 'cny_3500_5000',
    },
  },
  {
    id: 'PARITY-V2-005',
    title: 'explicit special care',
    answers: {
      'cognitive.specialCareNeeds': ['night_care', 'tube_feeding', 'pressure_injury_care'],
      'preference.priorities': ['care_capability', 'food_quality', 'room_facilities'],
    },
  },
])
