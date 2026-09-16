export const AI_B7_FIXTURE_POLICY = 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_FAQ'

const baseEntry = (overrides = {}) => ({
  contentId: 'test-product-assessment',
  category: 'product_faq',
  question: '怎样开始养老需求评估？',
  aliases: ['如何开始需求评估', '怎么做养老评估'],
  answer: '可以从首页进入养老需求评估，按页面提示逐步填写信息。',
  manifestVersion: 'ai-faq-manifest-v1',
  approvalStatus: 'approved',
  approvalAuthority: 'TEST_ONLY_OWNER_APPROVAL',
  approvalEvidenceRef: 'TEST_ONLY_APPROVAL_PRODUCT',
  publicLabel: '测试产品说明',
  publicVersion: 'b7-test',
  publicRef: 'test-product-assessment',
  ...overrides,
})

const visitEntry = {
  contentId: 'test-visit-process',
  category: 'visit_faq',
  question: '看院前需要准备什么？',
  aliases: ['参观机构前要准备什么'],
  answer: '可以先记录希望重点了解的照护服务和问题，到院后结合现场情况进一步确认。',
  manifestVersion: 'ai-faq-manifest-v1',
  approvalStatus: 'approved',
  approvalAuthority: 'TEST_ONLY_OWNER_APPROVAL',
  approvalEvidenceRef: 'TEST_ONLY_APPROVAL_VISIT',
  publicLabel: '测试看院流程说明',
  publicVersion: 'b7-test',
  publicRef: 'test-visit-process',
}

export const AI_B7_APPROVED_FIXTURE_MANIFEST = {
  kind: 'ai_approved_faq_manifest_v1',
  manifestVersion: 'ai-faq-manifest-v1',
  entries: [baseEntry(), visitEntry],
}

export const AI_B7_FIXTURE_MANIFEST = [
  'B7-CONTROL',
  'B7-PRODUCTION-MANIFEST-EMPTY',
  'B7-APPROVED-MANIFEST-VALIDATION',
  'B7-EXACT-LOOKUP',
  'B7-ALIAS-LOOKUP',
  'B7-DETERMINISTIC-LOOKUP',
  'B7-NO-MATCH-FAIL-CLOSED',
  'B7-AMBIGUOUS-LOOKUP-FAIL-CLOSED',
  'B7-INVALID-APPROVAL-FAIL-CLOSED',
  'B7-DUPLICATE-ALIAS-FAIL-CLOSED',
  'B7-INVALID-SOURCE-REF-FAIL-CLOSED',
  'B7-PROVIDER-PROJECTION',
  'B7-B5-SAFETY-PRECEDENCE',
  'B7-SAFETY-BEFORE-LOOKUP',
  'B7-B6-APPLICATION-INTEGRATION',
  'B7-MOCK-AND-DOMAIN-ISOLATION',
]

export { baseEntry }
