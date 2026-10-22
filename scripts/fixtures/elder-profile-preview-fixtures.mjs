import {
  elderProfileFixtures,
  makeCompletedAssessment,
  REHABILITATION_CONFLICT_ANSWERS,
} from './elder-profile-fixtures.mjs'

const fixtureById = new Map(elderProfileFixtures.map((fixture) => [fixture.id, fixture]))

const ADL_SHORT_KEY_TO_QUESTION_ID = Object.freeze({
  eating: 'adl.eating',
  mobility: 'adl.mobility',
  toileting: 'adl.toileting',
  bathing: 'adl.bathing',
  dressing: 'adl.dressing',
  transfer: 'adl.transfer',
  stairs: 'adl.stairs',
})

const answersFor = (fixtureId, overrides = {}) => {
  const fixture = fixtureById.get(fixtureId)
  if (!fixture) {
    throw new Error(`unknown formal fixture ${fixtureId}`)
  }
  const normalizedOverrides = { ...overrides }
  Object.keys(ADL_SHORT_KEY_TO_QUESTION_ID).forEach((shortKey) => {
    if (Object.prototype.hasOwnProperty.call(fixture.answers, shortKey)) {
      normalizedOverrides[ADL_SHORT_KEY_TO_QUESTION_ID[shortKey]] = fixture.answers[shortKey]
    }
  })
  return { ...makeCompletedAssessment(normalizedOverrides).answers }
}

const missingAnswer = (fixtureId, questionId) => {
  const answers = answersFor(fixtureId)
  delete answers[questionId]
  return answers
}

const regionAnswer = Object.freeze({
  kind: 'institution_region',
  regionCode: 'wuchang',
  regionLabelSnapshot: '武昌区',
  catalogVersion: 'institution-catalog-v1',
})

/**
 * Fixed Preview runtime manifest. These cases describe the public boundary,
 * while the formal C01-C21 fixtures remain owned by the ElderProfile harness.
 */
export const elderProfilePreviewFixtures = Object.freeze([
  {
    id: 'PREVIEW-001',
    description: 'complete local draft derives a preview',
    answers: answersFor('C01'),
    expected: { ok: true },
  },
  {
    id: 'PREVIEW-002',
    description: 'incomplete local draft is not derivable',
    answers: missingAnswer('C01', 'adl.transfer'),
    expected: {
      ok: false,
      error: {
        code: 'INCOMPLETE_ASSESSMENT_NOT_DERIVABLE',
        questionIds: ['adl.transfer'],
      },
    },
  },
  {
    id: 'PREVIEW-003',
    description: 'ADL unknown remains unknown with clarification',
    answers: answersFor('C14'),
    expected: { ok: true, careLevel: 'unknown' },
  },
  {
    id: 'PREVIEW-004',
    description: 'special feeding remains non-ordinal and needs confirmation',
    answers: answersFor('C06'),
    expected: { ok: true, careMode: 'special_feeding_review' },
  },
  {
    id: 'PREVIEW-005',
    description: 'catheter or stoma remains non-ordinal and needs confirmation',
    answers: answersFor('C10'),
    expected: { ok: true, careMode: 'catheter_or_stoma_review' },
  },
  {
    id: 'PREVIEW-006',
    description: 'no stairs preserves context and limited coverage',
    answers: answersFor('C11'),
    expected: { ok: true, careMode: 'no_stairs_context' },
  },
  {
    id: 'PREVIEW-007',
    description: 'cognitive symptom and health diagnosis conflict is explicit',
    answers: answersFor('C01', {
      'health.conditions': ['alzheimers_disease'],
      'cognitive.symptoms': ['none'],
    }),
    expected: { ok: true, clarification: 'cl:cross_answer_conflict:cognition.cognitiveConcern' },
  },
  {
    id: 'PREVIEW-008',
    description: 'multi-choice absence evidence keeps the answer snapshot',
    answers: answersFor('C01', {
      'health.conditions': ['hypertension'],
      'cognitive.symptoms': ['memory_decline'],
      'cognitive.specialCareNeeds': ['night_care'],
    }),
    expected: { ok: true, answerSetQuestionId: 'cognitive.specialCareNeeds' },
  },
  {
    id: 'PREVIEW-009',
    description: 'region preference is copied as a saved snapshot',
    answers: answersFor('C01', { 'preference.region': regionAnswer }),
    expected: { ok: true, region: regionAnswer },
  },
  {
    id: 'PREVIEW-010',
    description: 'same draft and versions derive deterministically',
    answers: answersFor('C01'),
    expected: { ok: true },
  },
  {
    id: 'PREVIEW-011',
    description: 'draft mutation derives from current answers, without preview cache',
    answers: answersFor('C01'),
    expected: { ok: true, mutatedAge: 88 },
  },
  {
    id: 'PREVIEW-012',
    description: 'localDraftId is not a server assessmentId',
    answers: answersFor('C01'),
    expected: { ok: true, localDraftId: 'local-preview-012' },
  },
  {
    id: 'PREVIEW-013',
    description: 'preview has no elderId identity',
    answers: answersFor('C01'),
    expected: { ok: true },
  },
  {
    id: 'PREVIEW-014',
    description: 'preview has no completedAt or generatedAt',
    answers: answersFor('C01'),
    expected: { ok: true },
  },
  {
    id: 'PREVIEW-015',
    description: 'formal CompletedAssessment path remains valid and unchanged',
    answers: answersFor('C01'),
    expected: { ok: true },
  },
])

/** Same answer snapshots are deliberately paired with formal profiles. */
export const elderProfilePreviewParityFixtures = Object.freeze([
  {
    id: 'PARITY-001',
    description: 'independent C01',
    formalFixtureId: 'C01',
    answers: answersFor('C01'),
  },
  {
    id: 'PARITY-002',
    description: 'wheelchair C04',
    formalFixtureId: 'C04',
    answers: answersFor('C04'),
  },
  {
    id: 'PARITY-003',
    description: 'disabled C05',
    formalFixtureId: 'C05',
    answers: answersFor('C05'),
  },
  {
    id: 'PARITY-004',
    description: 'unknown C14',
    formalFixtureId: 'C14',
    answers: answersFor('C14'),
  },
  {
    id: 'PARITY-005',
    description: 'special-care rehabilitation conflict',
    formalFixtureId: 'REHABILITATION_CONFLICT',
    answers: answersFor('C01', REHABILITATION_CONFLICT_ANSWERS),
  },
])

export const makePreviewDraft = (answers, localDraftId = 'local-preview-fixture') => ({
  kind: 'assessment_draft',
  schemaVersion: 1,
  localDraftId,
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: 'budget',
  answers: { ...answers },
  startedAt: '2026-08-30T08:00:00.000Z',
  updatedAt: '2026-08-30T09:00:00.000Z',
})

export const makeFormalAssessment = (
  answers,
  identity = {},
) => makeCompletedAssessment(answers, {
  id: identity.id || 'formal-preview-fixture-assessment',
  elderId: identity.elderId || 'formal-preview-fixture-elder',
  completedAt: identity.completedAt || '2026-08-30T09:00:00.000Z',
})

export const PREVIEW_REGION_SNAPSHOT = regionAnswer
