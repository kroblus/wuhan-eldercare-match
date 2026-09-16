/**
 * TEST_ONLY_SYNTHETIC fixtures for V1.2-B5. These values are neither
 * approved production knowledge nor live-provider output.
 */
export const AI_B5_FIXTURE_POLICY = 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_AI_DATA'

export const AI_B5_FIXTURE_MANIFEST = [
  'B5-CONTROL',
  'B5-OBJECT-IDENTITY',
  'B5-OBJECT-ROLE-KIND',
  'B5-SEVEN-STATES',
  'B5-FIVE-KNOWLEDGE-CATEGORIES',
  'B5-UNKNOWN-KNOWLEDGE-DENIED',
  'B5-SAFETY-DETERMINISM',
  'B5-SAFETY-REFUSAL',
  'B5-SAFETY-MEDICAL',
  'B5-SAFETY-HANDOFF-REASONS',
  'B5-SAFETY-KNOWLEDGE-INSUFFICIENCY',
  'B5-HANDOFF-BOUNDARY',
  'B5-SOURCE-REFS',
  'B5-CONTEXT-MINIMIZATION',
  'B5-APPLICATION-ANSWER',
  'B5-APPLICATION-REFUSAL',
  'B5-APPLICATION-HANDOFF',
  'B5-PROVIDER-RAW-FIREWALL',
  'B5-PROVIDER-NETWORK-FAILURE',
  'B5-PROVIDER-SERVICE-FAILURE',
  'B5-ERROR-ID-FAIL-CLOSED',
  'B5-PRIVACY-ISOLATION',
  'B5-DOMAIN-ISOLATION',
  'B5-MOCK-ISOLATION',
]

export const AI_B5_FIXTURE_CONTROL = {
  expectedCount: AI_B5_FIXTURE_MANIFEST.length,
  minimumAssertionsPerCase: 2,
}

export const aiB5FixtureConstants = {
  conversationCreatedAt: '2026-09-16T00:00:00Z',
  userMessageCreatedAt: '2026-09-16T00:00:01Z',
  responseCreatedAt: '2026-09-16T00:00:02Z',
  localSessionId: 'b5-local-session-001',
  userMessageId: 'b5-user-message-001',
  responseMessageId: 'b5-response-message-001',
}

export const makeConversationFixture = (overrides = {}) => ({
  contractVersion: 'ai-consultation-contract-v1',
  ref: { kind: 'local_session', localSessionId: aiB5FixtureConstants.localSessionId },
  createdAt: aiB5FixtureConstants.conversationCreatedAt,
  state: 'idle',
  messages: [],
  ...overrides,
})

export const makeContextSourcesFixture = () => [
  { category: 'product_faq', publicLabel: '小程序使用说明', publicVersion: 'v1', publicRef: 'faq-b5', publicSummary: '说明小程序基础使用方式。' },
  { category: 'profile_display_snapshot', publicLabel: '老人画像摘要', publicVersion: 'v2', publicRef: 'profile-b5', publicSummary: '已展示的画像结论。' },
  { category: 'recommendation_display_snapshot', publicLabel: '推荐结果摘要', publicVersion: 'v2', publicRef: 'recommendation-b5', publicSummary: '已有推荐理由说明。' },
  { category: 'institution_display_snapshot', publicLabel: '机构公开摘要', publicVersion: 'v1.2.1', publicRef: 'institution-b5', publicSummary: '合法公开的机构资料。' },
  { category: 'visit_faq', publicLabel: '看院流程说明', publicVersion: 'v1', publicRef: 'visit-b5', publicSummary: '说明看院流程和注意事项。' },
]

export const makePolicyFixture = (overrides = {}) => ({
  requestCategory: 'allowlisted_explanation',
  userRequestedHuman: false,
  consecutiveAllowedKnowledgeInsufficiencyCount: 0,
  hasSufficientAllowedKnowledge: true,
  ...overrides,
})

export const makeApplicationRequestFixture = (overrides = {}) => ({
  conversation: makeConversationFixture(),
  userInput: '请说明小程序的看院流程。',
  userMessageId: aiB5FixtureConstants.userMessageId,
  userMessageCreatedAt: aiB5FixtureConstants.userMessageCreatedAt,
  responseMessageId: aiB5FixtureConstants.responseMessageId,
  responseCreatedAt: aiB5FixtureConstants.responseCreatedAt,
  policy: makePolicyFixture(),
  contextSources: makeContextSourcesFixture(),
  ...overrides,
})

export const makeProviderFixture = ({
  responseProvenance = 'approved_faq',
  result = { ok: true, candidate: { kind: 'answer', content: '当前资料说明了看院流程，具体安排仍需进一步确认。' } },
  onRequest,
} = {}) => ({
  responseProvenance,
  requestCandidate(input) {
    if (onRequest) onRequest(input)
    return result
  },
})
