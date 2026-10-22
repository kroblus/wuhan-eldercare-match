/**
 * TEST_FIXTURE_ONLY — synthetic Consultant B2.1 global-selection facts.
 * These values are not real configuration, consultants, phone numbers, or QR
 * media and must never be imported by Mini Program production code.
 */
import { makeConsultantProfileFixture } from './consultant-b2-fixtures.mjs'

export const CONSULTANT_B2_1_FIXTURE_POLICY = 'TEST_FIXTURE_ONLY_NOT_REAL_GLOBAL_CONSULTANT_DATA'

const BASE_SNAPSHOT_AS_OF = '2026-09-16T00:00:00.000Z'
const BASE_GLOBAL_CONSULTANT_ID = 'consultant-global-b2-1'
const DEFAULT_CONSULTANT_ID = 'consultant-default-b2'

export const CONSULTANT_B2_1_FIXTURE_MANIFEST = Object.freeze([
  'B2.1-CONFIG-001',
  'B2.1-CONFIG-002',
  'B2.1-CONFIG-003',
  'B2.1-CONFIG-004',
  'B2.1-CONFIG-005',
  'B2.1-CONFIG-006',
  'B2.1-SELECT-001',
  'B2.1-SELECT-002',
  'B2.1-SELECT-003',
  'B2.1-PROFILE-001',
  'B2.1-PROFILE-002',
  'B2.1-PROFILE-003',
  'B2.1-PROJECTION-001',
  'B2.1-PROJECTION-002',
  'B2.1-PROJECTION-003',
  'B2.1-PROJECTION-004',
  'B2.1-PROJECTION-005',
  'B2.1-PROJECTION-006',
  'B2.1-FAILURE-001',
  'B2.1-FAILURE-002',
  'B2.1-FAILURE-003',
  'B2.1-FAILURE-004',
  'B2.1-FAILURE-005',
  'B2.1-FAILURE-006',
  'B2.1-FAILURE-007',
  'B2.1-FAILURE-008',
  'B2.1-FAILURE-009',
  'B2.1-FAILURE-010',
  'B2.1-ISOLATION-001',
  'B2.1-ISOLATION-002',
  'B2.1-ISOLATION-003',
  'B2.1-ISOLATION-004',
])

export const CONSULTANT_B2_1_FIXTURE_CONTROL = Object.freeze({
  expectedCount: 32,
  minimumAssertionsPerCase: 1,
})

export const makeGlobalConsultantConfigurationFixture = (overrides = {}) => ({
  role: 'platform_primary_consultant',
  sourceState: 'configured',
  consultantId: BASE_GLOBAL_CONSULTANT_ID,
  ...overrides,
})

export const makeGlobalConsultantProfileFixture = (overrides = {}) => makeConsultantProfileFixture({
  consultantId: BASE_GLOBAL_CONSULTANT_ID,
  displayName: '开发测试平台顾问',
  serviceArea: { displayName: '开发测试服务区域' },
  ...overrides,
})

export const makeGlobalConsultantProvider = (overrides = {}) => ({
  dataProvenance: 'MOCK_DEVELOPMENT_ONLY',
  loadGlobalConsultantConfiguration: () => makeGlobalConsultantConfigurationFixture(),
  loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({ consultantId }),
  resolvePublicMedia: () => ({
    status: 'available',
    publicImageUrl: 'https://example.test/consultant-b2-1.png',
  }),
  ...overrides,
})

export const consultantB2_1FixtureConstants = Object.freeze({
  BASE_SNAPSHOT_AS_OF,
  BASE_GLOBAL_CONSULTANT_ID,
  DEFAULT_CONSULTANT_ID,
})
