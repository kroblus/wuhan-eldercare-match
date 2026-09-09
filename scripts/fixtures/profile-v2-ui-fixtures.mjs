import { makeV2Draft } from './assessment-v2-fixtures.mjs'

/**
 * Test-only inputs for the live Profile V2 application/ViewModel boundary.
 *
 * The fixture deliberately uses real Assessment V2 answer codes. It is kept
 * outside the miniprogram source graph so a passing UI runtime test cannot be
 * produced by a fixture-only production import.
 */
export const makeProfileV2UiDraft = (answerOverrides = {}, draftOverrides = {}) =>
  makeV2Draft({
    // The generic assessment fixture intentionally exercises an unresolved
    // rehabilitation clue. Profile UI cases that are about a single rendered
    // fact need a neutral baseline so unrelated clarification rows cannot
    // mask the behavior under test.
    'health.rehabilitationNeed': 'none',
    ...answerOverrides,
  }, {
    localDraftId: 'profile-v2-ui-fixture',
    ...draftOverrides,
  })

export const PROFILE_V2_UI_FIXTURES = Object.freeze({
  normal: Object.freeze({
    answers: Object.freeze({
      'health.chewingAbility': 'normal',
      'health.swallowingAbility': 'normal',
    }),
  }),
  easyChew: Object.freeze({
    answers: Object.freeze({ 'health.chewingAbility': 'easy_chew' }),
  }),
  modifiedFood: Object.freeze({
    answers: Object.freeze({ 'health.chewingAbility': 'modified_food' }),
  }),
  swallowClarification: Object.freeze({
    answers: Object.freeze({ 'health.swallowingAbility': 'significant_difficulty' }),
  }),
  room: Object.freeze({
    answers: Object.freeze({ 'preference.roomType': 'double' }),
  }),
  meal: Object.freeze({
    answers: Object.freeze({ 'preference.mealSchedule': 'three_meals_two_snacks' }),
  }),
  activity: Object.freeze({
    answers: Object.freeze({ 'preference.activityPreference': 'outdoor' }),
  }),
  priorities: Object.freeze({
    answers: Object.freeze({
      'preference.priorities': ['price', 'rehabilitation_capability', 'transportation'],
    }),
  }),
  budgetAdvisory: Object.freeze({
    answers: Object.freeze({
      'adl.eating': 'needs_feeding',
      'adl.mobility': 'bedridden',
      'adl.toileting': 'full_assistance',
      'adl.bathing': 'full_assistance',
      'adl.dressing': 'full_assistance',
      'adl.transfer': 'fully_dependent',
      'adl.stairs': 'unable',
      'budget.monthlyRange': 'cny_3500_5000',
    }),
  }),
})

// Independent manifest: every declared case must run once and in order.
export const PROFILE_V2_UI_CASES = Object.freeze([
  'PROFILE-UI-V2-001',
  'PROFILE-UI-V2-002',
  'PROFILE-UI-V2-003',
  'PROFILE-UI-V2-004',
  'PROFILE-UI-V2-005',
  'PROFILE-UI-V2-006',
  'PROFILE-UI-V2-007',
  'PROFILE-UI-V2-008',
  'PROFILE-UI-V2-009',
  'PROFILE-UI-V2-010',
  'PROFILE-UI-V2-011',
  'PROFILE-UI-V2-012',
])

export const PROFILE_V2_UI_FIXTURE_MANIFEST = Object.freeze({
  caseCount: PROFILE_V2_UI_CASES.length,
  requiredQuestionCount: 26,
  minimumAssertionsPerCase: 2,
})
