export const V2_FIXTURE_STARTED_AT = '2026-01-02T03:04:05.000Z'
export const V2_FIXTURE_UPDATED_AT = '2026-01-03T04:05:06.000Z'

export const makeCompleteV2Answers = (overrides = {}) => {
  const answers = {
    'basic.relationship': 'father',
  'basic.elderName': '王叔叔',
  'basic.gender': 'male',
  'basic.age': 72,
  'basic.livingStatus': 'with_children',
  'basic.primaryCaregiver': 'children',
  'basic.hasInstitutionExperience': 'true',
  'basic.institutionExitReasons': ['too_far'],
  'health.conditions': ['diabetes'],
  'health.recentEvents': ['recently_discharged'],
  'health.rehabilitationNeed': 'possible',
  'health.chewingAbility': 'normal',
  'health.swallowingAbility': 'normal',
  'adl.eating': 'independent',
  'adl.mobility': 'independent',
  'adl.toileting': 'independent',
  'adl.bathing': 'independent',
  'adl.dressing': 'independent',
  'adl.transfer': 'independent',
  'adl.stairs': 'independent',
  'cognitive.symptoms': ['none'],
  'cognitive.specialCareNeeds': ['none'],
  'preference.careType': 'medical_nursing_integrated',
  'preference.roomType': 'double',
  'preference.mealSchedule': 'three_meals_one_snack',
  'preference.activityPreference': 'indoor_and_outdoor',
  'preference.priorities': ['medical_conditions', 'price'],
  'preference.region': {
    kind: 'no_preference',
    regionCode: 'no_preference',
    regionLabelSnapshot: '不限制',
    catalogVersion: 'institution-region-catalog-v1',
  },
  'budget.monthlyRange': 'cny_5000_8000',
  'budget.upfrontCostAcceptance': 'depends_on_amount',
  'budget.moveInTiming': 'within_1_to_3_months',
  'budget.consultantSupport': 'recommendation_first',
    ...overrides,
  }
  Object.keys(overrides).forEach((key) => {
    if (overrides[key] === undefined) {
      delete answers[key]
    }
  })
  return answers
}

export const makeV2Draft = (answers = {}, overrides = {}) => ({
  kind: 'assessment_draft',
  schemaVersion: 2,
  localDraftId: 'local-draft-v2-fixture',
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: 'budget',
  answers: makeCompleteV2Answers(answers),
  startedAt: V2_FIXTURE_STARTED_AT,
  updatedAt: V2_FIXTURE_UPDATED_AT,
  ...overrides,
})

export const assessmentV2Fixtures = Object.freeze([
  { id: 'V2-001', description: 'complete V2', answers: makeCompleteV2Answers(), expectedValid: true },
  {
    id: 'V2-002',
    description: 'five new required answers missing',
    answers: makeCompleteV2Answers({
      'health.chewingAbility': undefined,
      'health.swallowingAbility': undefined,
      'preference.roomType': undefined,
      'preference.mealSchedule': undefined,
      'preference.activityPreference': undefined,
    }),
    expectedValid: false,
  },
  { id: 'V2-003', description: 'chewing unknown is explicit valid answer', answers: makeCompleteV2Answers({ 'health.chewingAbility': 'unknown' }), expectedValid: true },
  { id: 'V2-004', description: 'swallowing unknown is explicit valid answer', answers: makeCompleteV2Answers({ 'health.swallowingAbility': 'unknown' }), expectedValid: true },
  { id: 'V2-005', description: 'room no preference is explicit valid answer', answers: makeCompleteV2Answers({ 'preference.roomType': 'no_preference' }), expectedValid: true },
  { id: 'V2-006', description: 'meal no preference is explicit valid answer', answers: makeCompleteV2Answers({ 'preference.mealSchedule': 'no_preference' }), expectedValid: true },
  { id: 'V2-007', description: 'activity no preference is explicit valid answer', answers: makeCompleteV2Answers({ 'preference.activityPreference': 'no_preference' }), expectedValid: true },
  { id: 'V2-008', description: 'zero priorities is incomplete', answers: makeCompleteV2Answers({ 'preference.priorities': [] }), expectedValid: false },
  { id: 'V2-009', description: 'more than three priorities is invalid', answers: makeCompleteV2Answers({ 'preference.priorities': ['price', 'region', 'food_quality', 'activity_space'] }), expectedValid: false },
  { id: 'V2-010', description: 'illegal new option is invalid', answers: makeCompleteV2Answers({ 'health.chewingAbility': 'soft_food_only' }), expectedValid: false },
  { id: 'V2-011', description: 'unknown question key is invalid', answers: makeCompleteV2Answers({ 'health.unknownQuestion': 'value' }), expectedValid: false },
  { id: 'V2-012', description: 'none and concrete answers remain exclusive', answers: makeCompleteV2Answers({ 'health.conditions': ['none', 'diabetes'] }), expectedValid: false },
])
