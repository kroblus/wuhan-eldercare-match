export const VISIT_EVALUATION_TEST_FIXTURE_POLICY =
  'TEST_ONLY_SYNTHETIC_VISIT_EVALUATION_CONTEXT_AND_SUBMIT_PROVIDER'

export const createVisitEvaluationContextFixture = (visitId = 'visit-test-completed') => ({
  provenance: 'TEST_ONLY',
  visitId,
  institutionId: 'institution-test-001',
  institutionRecordRevision: 'revision-test-001',
  ownerUserId: 'user-test-001',
  visitStatus: 'completed',
})

export const createVisitEvaluationTestOnlyProviders = (outcomes = ['submitted']) => {
  const calls = []
  const nextOutcomes = outcomes.slice()
  return {
    calls,
    contextProvider: {
      loadContext(visitId) {
        return createVisitEvaluationContextFixture(visitId)
      },
    },
    submitProvider: {
      async submit(input) {
        calls.push(input)
        const outcome = nextOutcomes.length > 0 ? nextOutcomes.shift() : 'failed'
        return { provenance: 'TEST_ONLY', outcome }
      },
    },
  }
}
