// TEST_ONLY: mutations of freshly produced wire artifacts, never business data.
const write = 'docs/architecture/VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md'
const context = 'docs/architecture/AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md'
const copy = (value) => JSON.parse(JSON.stringify(value))

export function requestNegativeCases(requests) {
  const base = JSON.parse(requests[0].jsonText)
  const cases = []
  const mutate = (id, section, change) => {
    const value = copy(base)
    change(value)
    cases.push({ caseId: id, direction: 'CLIENT_TO_SERVER', contractBasis: `${write} ${section}`,
      jsonText: JSON.stringify(value), expectedResult: 'PRODUCTION_REJECTION' })
  }
  for (const key of ['contractVersion', 'kind', 'idempotencyKey', 'overallRating', 'consideration']) {
    mutate(`request-missing-${key}`, '§4 / §5.1', (v) => { delete v[key] })
  }
  mutate('request-null-rating', '§5.1', (v) => { v.overallRating = null })
  mutate('request-null-consideration', '§5.1', (v) => { v.consideration = null })
  mutate('request-wrong-version', '§4', (v) => { v.contractVersion = 'synthetic-invalid-version' })
  mutate('request-wrong-kind', '§4', (v) => { v.kind = 'synthetic_invalid_kind' })
  mutate('request-short-key', '§6 (opaque key validation)', (v) => { v.idempotencyKey = 'x' })
  mutate('request-key-whitespace', '§6 (opaque key validation)', (v) => { v.idempotencyKey = 'synthetic invalid key' })
  for (const [id, value] of [['string', '5'], ['fraction', 1.5], ['boolean', true], ['zero', 0], ['six', 6]]) {
    mutate(`request-rating-${id}`, '§5.1', (v) => { v.overallRating = value })
  }
  mutate('request-invalid-consideration', '§5.1', (v) => { v.consideration = 'synthetic_invalid_enum' })
  mutate('request-unknown-dimension', '§5.2', (v) => { v.ratings = { synthetic_unknown: 3 } })
  mutate('request-null-dimension', '§5.2 (each included value integer 1–5)', (v) => { v.ratings = { hygiene: null } })
  mutate('request-string-dimension', '§5.2', (v) => { v.ratings = { hygiene: '3' } })
  mutate('request-invalid-fee-enum', '§5.3', (v) => { v.feeExplanationClear = 'synthetic_invalid_enum' })
  mutate('request-invalid-fee-topic', '§5.3', (v) => { v.feeTopicExplanations = { bed_fee: 'synthetic_invalid_enum' } })
  mutate('request-invalid-observation', '§5.4', (v) => { v.careProcessObservations = { careRecordLearned: 'synthetic_invalid_enum' } })
  mutate('request-handover-exclusive', '§5.4', (v) => { v.careProcessObservations = { handoverTopics: ['unconfirmed', 'follow_up'] } })
  mutate('request-handover-duplicate', '§5.4', (v) => { v.careProcessObservations = { handoverTopics: ['follow_up', 'follow_up'] } })
  mutate('request-handover-unknown', '§5.4', (v) => { v.careProcessObservations = { handoverTopics: ['medical_transfer'] } })
  for (const group of ['likedTags', 'concernTags']) {
    mutate(`request-${group}-duplicate`, '§5.5', (v) => { v[group] = ['care', 'care'] })
    mutate(`request-${group}-limit`, '§5.5', (v) => { v[group] = ['care', 'medical', 'room', 'dining'] })
    mutate(`request-${group}-unknown`, '§5.5', (v) => { v[group] = ['synthetic_unknown_tag'] })
  }
  mutate('request-comment-over-limit', '§5.6', (v) => { v.comment = '合'.repeat(201) })
  cases.push({ caseId: 'request-malformed-json', direction: 'CLIENT_TO_SERVER',
    contractBasis: `${write} §9 transport/parser failures`, jsonText: '{"overallRating":', expectedResult: 'PRODUCTION_REJECTION' })
  return cases
}

export function responseNegativeCases(responses) {
  const success = responses.find((v) => v.responseType === 'submission' && JSON.parse(v.jsonText).outcome === 'accepted')
  const eligible = responses.find((v) => v.responseType === 'context' && JSON.parse(v.jsonText).availability === 'eligible')
  if (!success || !eligible) throw new Error('Java-produced accepted/eligible artifacts required')
  const cases = []
  const mutate = (id, source, section, change) => {
    const value = JSON.parse(source.jsonText)
    change(value)
    cases.push({ caseId: id, direction: 'SERVER_TO_CLIENT', responseType: source.responseType,
      contractBasis: `${source.responseType === 'context' ? context : write} ${section}`,
      jsonText: JSON.stringify(value), expectedResult: 'PRODUCTION_REJECTION' })
  }
  mutate('response-missing-code', success, '§9 exact envelope', (v) => { delete v.code })
  mutate('response-invalid-outcome', success, '§9', (v) => { v.outcome = 'synthetic_invalid_enum' })
  mutate('response-null-receipt', success, '§9', (v) => { v.receipt = null })
  mutate('response-receipt-wrong-type', success, '§9', (v) => { v.receipt = [] })
  mutate('response-time-null', success, '§8 / §9', (v) => { v.receipt.submittedAt = null })
  mutate('response-time-number', success, '§8 / §9 and production runtime time validation', (v) => { v.receipt.submittedAt = 1791594123 })
  mutate('response-time-invalid', success, '§8 / §9', (v) => { v.receipt.submittedAt = 'synthetic-invalid-time' })
  mutate('response-wrong-visit', success, '§8 binding / §9', (v) => { v.receipt.visitId = 'synthetic-other-visit' })
  mutate('response-wrong-state', success, '§9', (v) => { v.receipt.state = 'completed' })
  mutate('response-success-unauthenticated', success, '§9 auth/outcome relationship', (v) => { v.authResolution = 'missing' })
  mutate('response-success-errors', success, '§9 fieldErrors only VALIDATION_FAILED', (v) => { v.fieldErrors = [{ field: 'overallRating', code: 'REQUIRED' }] })
  mutate('response-private-extra-field', success, '§9 exact fields / §11 privacy', (v) => { v.ownerId = 'synthetic-owner-not-wire' })
  mutate('response-validation-empty-errors', success, '§9 non-empty errors', (v) => {
    v.outcome = 'rejected'; v.code = 'VALIDATION_FAILED'; v.receipt = null; v.fieldErrors = []
  })
  mutate('response-rejection-with-receipt', success, '§9 receipt only accepted/replayed', (v) => { v.outcome = 'rejected'; v.code = 'NOT_FOUND' })
  mutate('context-missing-availability', eligible, '§3–4 result schema', (v) => { delete v.availability })
  mutate('context-eligible-not-completed', eligible, '§3 completed eligibility / §4', (v) => { v.context.visitStatus = 'scheduled' })
  mutate('context-null-context', eligible, '§4 context relationship', (v) => { v.context = null })
  mutate('context-wrong-visit', eligible, '§3 owner-bound identity / §4', (v) => { v.context.visitId = 'synthetic-other-visit' })
  mutate('context-unauthenticated-data', eligible, '§4 no Visit data for unauthenticated', (v) => { v.authResolution = 'missing' })
  mutate('context-private-extra-field', eligible, '§4 exact/minimal schema', (v) => { v.context.ownerId = 'synthetic-owner-not-wire' })
  for (const source of [success, eligible]) cases.push({ caseId: `${source.responseType}-malformed-json`,
    direction: 'SERVER_TO_CLIENT', responseType: source.responseType, contractBasis: 'Actual JSON syntax parser',
    jsonText: '{"kind":', expectedResult: 'PRODUCTION_REJECTION' })
  return cases
}
