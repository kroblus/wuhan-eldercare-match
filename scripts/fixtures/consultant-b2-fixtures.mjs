/**
 * TEST_FIXTURE_ONLY — synthetic Consultant B2 facts.
 * These values are not real consultants, phone numbers, assignments, or QR media
 * and must never be imported by Mini Program production code.
 */
export const CONSULTANT_B2_FIXTURE_POLICY = 'TEST_FIXTURE_ONLY_NOT_REAL_CONSULTANT_DATA'

const BASE_SNAPSHOT_AS_OF = '2026-09-16T00:00:00.000Z'
const BASE_INSTITUTION_ID = 'institution-synthetic-b2'
const BASE_CONSULTANT_ID = 'consultant-synthetic-b2'
const DEFAULT_CONSULTANT_ID = 'consultant-default-b2'

export const CONSULTANT_B2_FIXTURE_MANIFEST = Object.freeze([
  'B2-CONSULTANT-001',
  'B2-CONSULTANT-002',
  'B2-CONSULTANT-003',
  'B2-ASSIGNMENT-001',
  'B2-ASSIGNMENT-002',
  'B2-ASSIGNMENT-003',
  'B2-ASSIGNMENT-004',
  'B2-ASSIGNMENT-005',
  'B2-ASSIGNMENT-006',
  'B2-ASSIGNMENT-007',
  'B2-ASSIGNMENT-008',
  'B2-ASSIGNMENT-009',
  'B2-ASSIGNMENT-010',
  'B2-PROJECTION-001',
  'B2-PROJECTION-002',
  'B2-PROJECTION-003',
  'B2-PROJECTION-004',
  'B2-PROJECTION-005',
  'B2-PROJECTION-006',
  'B2-PROJECTION-007',
  'B2-PROJECTION-008',
  'B2-FAILURE-001',
  'B2-FAILURE-002',
  'B2-FAILURE-003',
  'B2-FAILURE-004',
  'B2-FAILURE-005',
  'B2-FAILURE-006',
  'B2-ISOLATION-001',
  'B2-ISOLATION-002',
  'B2-ISOLATION-003',
])

export const CONSULTANT_B2_FIXTURE_CONTROL = Object.freeze({
  expectedCount: 30,
  minimumAssertionsPerCase: 1,
})

export const makeConsultantProfileFixture = (overrides = {}) => ({
  contractVersion: 'consultant-permission-contract-v1',
  consultantId: BASE_CONSULTANT_ID,
  displayName: '开发测试顾问',
  serviceStatus: 'active',
  serviceArea: { displayName: '开发测试区域' },
  platformPhone: {
    sourceState: 'configured',
    value: '+86 0000 0000 00',
    reviewStatus: 'approved',
  },
  enterpriseWechatQr: {
    sourceState: 'configured',
    wechatQrMediaId: 'media-synthetic-b2',
    reviewStatus: 'approved',
    lifecycleStatus: 'active',
  },
  ...overrides,
})

export const makeAssignmentFixture = (overrides = {}) => ({
  assignmentId: 'assignment-synthetic-b2',
  institutionId: BASE_INSTITUTION_ID,
  consultantId: BASE_CONSULTANT_ID,
  status: 'active',
  ...overrides,
})

export const makeInstitutionContextFixture = (overrides = {}) => ({
  institutionId: BASE_INSTITUTION_ID,
  recordRevision: 1,
  ...overrides,
})

export const makeApplicationRequestFixture = (overrides = {}) => ({
  institutionIdentity: makeInstitutionContextFixture(),
  snapshotAsOf: BASE_SNAPSHOT_AS_OF,
  ...overrides,
})

export const makeFixtureProvider = (overrides = {}) => {
  const provider = {
    dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
    loadAssignments: () => [makeAssignmentFixture()],
    loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({ consultantId }),
    loadDefaultConsultant: () => ({ enabled: false }),
    resolvePublicMedia: () => ({ status: 'available', publicImageUrl: 'https://example.test/consultant-b2.png' }),
    ...overrides,
  }
  return provider
}

export const consultantB2FixtureConstants = Object.freeze({
  BASE_SNAPSHOT_AS_OF,
  BASE_INSTITUTION_ID,
  BASE_CONSULTANT_ID,
  DEFAULT_CONSULTANT_ID,
})
