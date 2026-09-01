/** Test-only Assessment snapshots. Never imported by miniprogram code. */
export const INTEGRATION_EVALUATION_AS_OF = '2026-08-31T12:00:00.000Z'

export const makeIntegrationDraft = (overrides = {}) => ({
  kind: 'assessment_draft',
  schemaVersion: 1,
  localDraftId: 'local-integration-draft',
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: 'budget',
  startedAt: '2026-08-30T08:00:00.000Z',
  updatedAt: '2026-08-30T09:00:00.000Z',
  answers: {
    'basic.relationship': 'father',
    'basic.gender': 'male',
    'basic.age': 72,
    'health.conditions': ['none'],
    'health.recentEvents': ['none'],
    'health.rehabilitationNeed': 'none',
    'adl.eating': 'independent',
    'adl.mobility': 'independent',
    'adl.toileting': 'independent',
    'adl.bathing': 'independent',
    'adl.dressing': 'independent',
    'adl.transfer': 'independent',
    'adl.stairs': 'independent',
    'cognitive.symptoms': ['none'],
    'cognitive.specialCareNeeds': ['tube_feeding'],
    'preference.careType': 'medical_nursing_integrated',
    'preference.priorities': ['price'],
    'budget.monthlyRange': 'cny_5000_8000',
    'budget.upfrontCostAcceptance': 'unknown',
    'budget.moveInTiming': 'research_only',
    'budget.consultantSupport': 'recommendation_first',
    ...overrides,
  },
})

// Independent expected IDs; do not derive this list from the executed tests.
export const INTEGRATION_CASE_IDS = Object.freeze([
  'INTEGRATION-001', 'INTEGRATION-002', 'INTEGRATION-003', 'INTEGRATION-004',
  'INTEGRATION-005', 'INTEGRATION-006', 'INTEGRATION-007', 'INTEGRATION-008',
  'INTEGRATION-009', 'INTEGRATION-010', 'INTEGRATION-011', 'INTEGRATION-012',
  'INTEGRATION-013', 'INTEGRATION-014', 'INTEGRATION-015', 'INTEGRATION-016',
  'INTEGRATION-017', 'INTEGRATION-018', 'INTEGRATION-019', 'INTEGRATION-020',
  'INTEGRATION-021', 'INTEGRATION-022', 'INTEGRATION-023', 'INTEGRATION-024',
])
