import { makeCompleteV2Answers, V2_FIXTURE_STARTED_AT, V2_FIXTURE_UPDATED_AT } from './assessment-v2-fixtures.mjs'

export const V1_FIXTURE_STARTED_AT = V2_FIXTURE_STARTED_AT
export const V1_FIXTURE_UPDATED_AT = V2_FIXTURE_UPDATED_AT

export const makeCompleteV1Answers = (overrides = {}) => {
  const v2 = makeCompleteV2Answers()
  const answers = {
    'basic.relationship': v2['basic.relationship'],
    'basic.elderName': v2['basic.elderName'],
    'basic.gender': v2['basic.gender'],
    'basic.age': v2['basic.age'],
    'basic.livingStatus': v2['basic.livingStatus'],
    'basic.primaryCaregiver': v2['basic.primaryCaregiver'],
    'basic.hasInstitutionExperience': v2['basic.hasInstitutionExperience'],
    'basic.institutionExitReasons': v2['basic.institutionExitReasons'],
    'health.conditions': v2['health.conditions'],
    'health.recentEvents': v2['health.recentEvents'],
    'health.rehabilitationNeed': v2['health.rehabilitationNeed'],
    'adl.eating': v2['adl.eating'],
    'adl.mobility': v2['adl.mobility'],
    'adl.toileting': v2['adl.toileting'],
    'adl.bathing': v2['adl.bathing'],
    'adl.dressing': v2['adl.dressing'],
    'adl.transfer': v2['adl.transfer'],
    'adl.stairs': v2['adl.stairs'],
    'cognitive.symptoms': v2['cognitive.symptoms'],
    'cognitive.specialCareNeeds': v2['cognitive.specialCareNeeds'],
    'preference.careType': v2['preference.careType'],
    'preference.region': v2['preference.region'],
    'budget.monthlyRange': v2['budget.monthlyRange'],
    'budget.upfrontCostAcceptance': v2['budget.upfrontCostAcceptance'],
    'budget.moveInTiming': v2['budget.moveInTiming'],
    'budget.consultantSupport': v2['budget.consultantSupport'],
    ...overrides,
  }
  Object.keys(overrides).forEach((key) => {
    if (overrides[key] === undefined) {
      delete answers[key]
    }
  })
  return answers
}

export const makeV1Draft = (answers = {}, overrides = {}) => ({
  kind: 'assessment_draft',
  schemaVersion: 1,
  localDraftId: 'local-draft-v1-fixture',
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: 'budget',
  answers: makeCompleteV1Answers(answers),
  startedAt: V1_FIXTURE_STARTED_AT,
  updatedAt: V1_FIXTURE_UPDATED_AT,
  ...overrides,
})

export const migrationFixtures = Object.freeze([
  { id: 'MIGRATION-001', description: 'partial V1 without priorities', input: makeV1Draft({ 'preference.priorities': undefined }), expected: 'success_no_notice' },
  { id: 'MIGRATION-002', description: 'complete V1 safe priorities', input: makeV1Draft({ 'preference.priorities': ['medical_conditions', 'price'] }), expected: 'success_safe_priorities' },
  { id: 'MIGRATION-003', description: 'ambiguous V1 priority', input: makeV1Draft({ 'preference.priorities': ['nursing_professionalism'] }), expected: 'success_notice' },
  { id: 'MIGRATION-004', description: 'mixed safe and ambiguous priorities', input: makeV1Draft({ 'preference.priorities': ['price', 'caregiver_attitude'] }), expected: 'success_notice' },
  { id: 'MIGRATION-005', description: 'same input repeated', input: makeV1Draft(), expected: 'deterministic' },
  { id: 'MIGRATION-006', description: 'arrays and region object cloned', input: makeV1Draft(), expected: 'deep_clone' },
  { id: 'MIGRATION-007', description: 'inactive conditional answer cleans only target', input: makeV1Draft({ 'basic.hasInstitutionExperience': 'false', 'basic.institutionExitReasons': ['too_far'] }), expected: 'conditional_cleanup' },
  { id: 'MIGRATION-008', description: 'invalid V1 option rejected', input: makeV1Draft({ 'health.conditions': ['not-a-code'] }), expected: 'invalid_source' },
  { id: 'MIGRATION-009', description: 'unsupported source schema rejected', input: makeV1Draft({}, { schemaVersion: 0 }), expected: 'unsupported_schema' },
  { id: 'MIGRATION-010', description: 'CompletedAssessment rejected', input: { kind: 'completed_assessment', id: 'assessment-v1', elderId: 'elder-v1', status: 'completed', schemaVersion: 1, answers: makeCompleteV1Answers(), completedAt: V1_FIXTURE_UPDATED_AT }, expected: 'completed_forbidden' },
  { id: 'MIGRATION-011', description: 'simulated V2 persistence failure keeps V1', input: makeV1Draft(), expected: 'persistence_failure' },
  { id: 'MIGRATION-012', description: 'verified V2 persistence can retire pointer', input: makeV1Draft(), expected: 'persistence_success' },
])
