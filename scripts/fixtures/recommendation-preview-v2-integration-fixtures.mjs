import { makeV2Draft } from './assessment-v2-fixtures.mjs'

/**
 * Test-only inputs for the V2 application boundary.
 *
 * This module is intentionally owned by scripts/fixtures.  Production
 * miniprogram code must obtain drafts through its store and institutions
 * through the provider/service boundary; it must never import this file.
 */
export const REC_V2_INTEGRATION_EVALUATION_AS_OF = '2026-09-08T12:00:00.000Z'

export const REC_V2_INTEGRATION_ALTERNATE_EVALUATION_AS_OF = '2026-09-08T13:00:00.000Z'

export const makeRecommendationPreviewV2IntegrationDraft = (
  answerOverrides = {},
  draftOverrides = {},
) => makeV2Draft(answerOverrides, {
  localDraftId: 'local-recommendation-preview-v2-integration',
  ...draftOverrides,
})

// Independent manifest: the runtime must execute every listed case exactly
// once, so a green run cannot be produced by silently skipping a scenario.
export const REC_V2_INTEGRATION_CASE_IDS = Object.freeze([
  'INTEGRATION-V2-001',
  'INTEGRATION-V2-002',
  'INTEGRATION-V2-003',
  'INTEGRATION-V2-004',
  'INTEGRATION-V2-005',
  'INTEGRATION-V2-006',
  'INTEGRATION-V2-007',
  'INTEGRATION-V2-008',
  'INTEGRATION-V2-009',
  'INTEGRATION-V2-010',
  'INTEGRATION-V2-011',
  'INTEGRATION-V2-012',
  'INTEGRATION-V2-013',
  'INTEGRATION-V2-014',
  'INTEGRATION-V2-015',
  'INTEGRATION-V2-016',
  'INTEGRATION-V2-017',
  'INTEGRATION-V2-018',
  'INTEGRATION-V2-019',
  'INTEGRATION-V2-020',
])

export const REC_V2_INTEGRATION_FIXTURE_MANIFEST = Object.freeze({
  expectedCount: REC_V2_INTEGRATION_CASE_IDS.length,
  minimumAssertionsPerCase: 2,
  completePoolSize: 8,
})
