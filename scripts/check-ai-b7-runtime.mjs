/**
 * Targeted B7 approved FAQ / knowledge capability gate.
 *
 * Production positive cases use only the owner-approved manifest. Additional
 * edge cases inject TEST_ONLY manifests into the Application factory and
 * never enter the miniprogram production graph.
 */
import nodeAssert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  AI_B7_APPROVED_FIXTURE_MANIFEST,
  AI_B7_FIXTURE_MANIFEST,
  AI_B7_FIXTURE_POLICY,
  baseEntry,
} from './fixtures/ai-b7-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const failures = []
const assertionCounts = new Map()
let activeCase = null

const assert = new Proxy(nodeAssert, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args) => {
      if (activeCase) assertionCounts.set(activeCase, (assertionCounts.get(activeCase) || 0) + 1)
      return value.apply(target, args)
    }
  },
})

const runCase = async (id, test) => {
  activeCase = id
  try {
    await test()
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    activeCase = null
  }
  if ((assertionCounts.get(id) || 0) === 0) failures.push(`${id}: expected at least one assertion`)
}

const modulePath = (relativePath) => path.join(repositoryRoot, 'miniprogram', relativePath)
const clone = (value) => JSON.parse(JSON.stringify(value))

const makeConversation = () => ({
  contractVersion: 'ai-consultation-contract-v1',
  ref: { kind: 'local_session', localSessionId: 'b7-test-session' },
  createdAt: '2026-09-17T00:00:00.000Z',
  state: 'idle',
  messages: [],
})

const makeApplicationRequest = (policy, contextSources, provider) => ({
  conversation: makeConversation(),
  userInput: '测试问题',
  userMessageId: 'b7-user-message',
  userMessageCreatedAt: '2026-09-17T00:00:00.000Z',
  responseMessageId: 'b7-assistant-message',
  responseCreatedAt: '2026-09-17T00:00:01.000Z',
  policy,
  contextSources,
  provider,
})

const run = async () => {
  const { ts } = loadWechatTypeScript()
  const domainRuntime = createWechatTsRuntime(ts)
  const domain = domainRuntime.load(modulePath('domain/ai-consultation/index.ts'))
  const providerRuntime = createWechatTsRuntime(ts)
  const providerModule = providerRuntime.load(modulePath('services/ai-consultation-approved-faq.ts'))
  const pageRuntime = createWechatTsRuntime(ts)
  const pageModule = pageRuntime.load(modulePath('services/ai-consultation-page.ts'))
  const applicationRuntime = createWechatTsRuntime(ts)
  const applicationModule = applicationRuntime.load(modulePath('services/ai-consultation-application.ts'))

  await runCase('B7-CONTROL', () => {
    assert.equal(AI_B7_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_FAQ')
    assert.equal(AI_B7_FIXTURE_MANIFEST.length, 16)
    assert.equal(new Set(AI_B7_FIXTURE_MANIFEST).size, 16)
  })

  await runCase('B7-PRODUCTION-MANIFEST-APPROVED', () => {
    const manifest = providerModule.AI_APPROVED_FAQ_PRODUCTION_MANIFEST_V1
    const approvalRecord = read('docs/architecture/V1_2_B7_FAQ_APPROVAL_RECORD.md')
    assert.equal(manifest.entries.length, 11)
    assert.equal(manifest.entries.filter((entry) => entry.category === 'product_faq').length, 7)
    assert.equal(manifest.entries.filter((entry) => entry.category === 'visit_faq').length, 4)
    assert.equal(manifest.entries.every((entry) => entry.approvalStatus === 'approved'), true)
    assert.equal(manifest.entries.every((entry) => entry.approvalAuthority === 'project_owner'), true)
    assert.equal(manifest.entries.every((entry) => entry.approvalEvidenceRef === 'b7-faq-approval-2026-09-17'), true)
    assert.equal(approvalRecord.includes('approvalEvidenceRef = b7-faq-approval-2026-09-17'), true)
    assert.equal(approvalRecord.includes('approvedFaqCount = 11'), true)
    assert.equal(manifest.entries.every((entry) => approvalRecord.includes(entry.contentId)), true)
    manifest.entries.forEach((entry) => {
      [
        entry.question,
        entry.answer,
        entry.publicLabel,
        entry.publicVersion,
        ...entry.aliases,
      ].forEach((approvedText) => {
        assert.equal(
          approvalRecord.includes(approvedText),
          true,
          `${entry.contentId} approval evidence must include: ${approvedText}`,
        )
      })
    })
    assert.equal(providerModule.createAIApprovedFaqProviderV1(manifest).ok, true)
    const provider = providerModule.createAIApprovedFaqProviderV1(manifest).provider
    assert.equal(provider.lookup('怎样开始养老需求评估？').kind, 'match')
    assert.equal(provider.lookup('如何开始需求评估？').kind, 'match')
    assert.equal(provider.lookup('带看有哪些状态？').kind, 'match')
    assert.equal(provider.lookup('未批准的实时床位问题').kind, 'no_match')
  })

  await runCase('B7-APPROVED-MANIFEST-VALIDATION', () => {
    const result = domain.validateAIApprovedFaqManifestV1(AI_B7_APPROVED_FIXTURE_MANIFEST)
    assert.equal(result.ok, true)
    assert.equal(result.value.entries.length, 2)
    assert.equal(result.value.entries.every((entry) => entry.approvalStatus === 'approved'), true)
  })

  await runCase('B7-EXACT-LOOKUP', () => {
    const result = domain.lookupApprovedFaqV1(AI_B7_APPROVED_FIXTURE_MANIFEST, '怎样开始养老需求评估？')
    assert.equal(result.kind, 'match')
    assert.equal(result.entry.contentId, 'test-product-assessment')
  })

  await runCase('B7-ALIAS-LOOKUP', () => {
    const result = domain.lookupApprovedFaqV1(AI_B7_APPROVED_FIXTURE_MANIFEST, '  如何开始需求评估  ')
    assert.equal(result.kind, 'match')
    assert.equal(result.entry.category, 'product_faq')
  })

  await runCase('B7-DETERMINISTIC-LOOKUP', () => {
    const first = domain.lookupApprovedFaqV1(AI_B7_APPROVED_FIXTURE_MANIFEST, '怎么做养老评估')
    const second = domain.lookupApprovedFaqV1(AI_B7_APPROVED_FIXTURE_MANIFEST, '怎么做养老评估')
    assert.equal(JSON.stringify(first), JSON.stringify(second))
    assert.equal(first.kind, 'match')
  })

  await runCase('B7-NO-MATCH-FAIL-CLOSED', () => {
    const result = domain.lookupApprovedFaqV1(AI_B7_APPROVED_FIXTURE_MANIFEST, '实时床位还有吗？')
    assert.equal(result.kind, 'no_match')
    assert.equal(providerModule.createAIApprovedFaqProviderV1(AI_B7_APPROVED_FIXTURE_MANIFEST).provider.lookup('未知问题').kind, 'no_match')
  })

  await runCase('B7-AMBIGUOUS-LOOKUP-FAIL-CLOSED', () => {
    const duplicateAliasManifest = clone(AI_B7_APPROVED_FIXTURE_MANIFEST)
    duplicateAliasManifest.entries.push(baseEntry({
      contentId: 'test-ambiguous',
      question: '另一个问题',
      aliases: ['如何开始需求评估'],
    }))
    const validated = domain.validateAIApprovedFaqManifestV1(duplicateAliasManifest)
    assert.equal(validated.ok, false)
    const ambiguous = domain.lookupValidatedApprovedFaqV1(duplicateAliasManifest, '如何开始需求评估')
    assert.equal(ambiguous.kind, 'ambiguous')
    assert.equal(ambiguous.contentIds.length, 2)
  })

  await runCase('B7-INVALID-APPROVAL-FAIL-CLOSED', () => {
    const pending = clone(AI_B7_APPROVED_FIXTURE_MANIFEST)
    pending.entries[0].approvalStatus = 'pending'
    const result = domain.validateAIApprovedFaqManifestV1(pending)
    assert.equal(result.ok, false)
    assert.equal(providerModule.createAIApprovedFaqProviderV1(pending).ok, false)
  })

  await runCase('B7-DUPLICATE-ALIAS-FAIL-CLOSED', () => {
    const duplicate = clone(AI_B7_APPROVED_FIXTURE_MANIFEST)
    duplicate.entries[1].aliases.push('怎样开始养老需求评估？')
    const result = domain.validateAIApprovedFaqManifestV1(duplicate)
    assert.equal(result.ok, false)
    assert.equal(result.issues[0].code, 'INVALID_CONTEXT')
  })

  await runCase('B7-INVALID-SOURCE-REF-FAIL-CLOSED', () => {
    const invalid = clone(AI_B7_APPROVED_FIXTURE_MANIFEST)
    invalid.entries[0].publicRef = 'https://internal.example/faq'
    const result = domain.validateAIApprovedFaqManifestV1(invalid)
    assert.equal(result.ok, false)
    assert.equal(providerModule.createAIApprovedFaqProviderV1(invalid).ok, false)
  })

  await runCase('B7-PROVIDER-PROJECTION', () => {
    const result = providerModule.createAIApprovedFaqProviderV1(AI_B7_APPROVED_FIXTURE_MANIFEST)
    assert.equal(result.ok, true)
    const candidate = result.provider.requestCandidate({
      contractVersion: 'ai-consultation-contract-v1',
      userInput: '怎样开始养老需求评估？',
      context: [],
    })
    assert.equal(candidate.ok, true)
    assert.equal(candidate.candidate.kind, 'answer')
    const source = providerModule.toAIConsultationContextSourceV1(result.provider.lookup('怎样开始养老需求评估？').entry)
    assert.deepEqual(Object.keys(source).sort(), ['category', 'publicLabel', 'publicRef', 'publicSummary', 'publicVersion'].sort())
  })

  await runCase('B7-B5-SAFETY-PRECEDENCE', () => {
    let providerCalls = 0
    const service = applicationModule.createAIConsultationApplicationServiceV1({
      responseProvenance: 'approved_faq',
      requestCandidate() {
        providerCalls += 1
        return { ok: true, candidate: { kind: 'answer', content: '不应返回' } }
      },
    })
    const result = service.consult(makeApplicationRequest({
      requestCategory: 'medical_professional_judgment',
      userRequestedHuman: false,
      consecutiveAllowedKnowledgeInsufficiencyCount: 0,
      hasSufficientAllowedKnowledge: true,
    }, [{ category: 'product_faq', publicLabel: '测试产品说明', publicSummary: '受信内容', publicVersion: 'b7-test', publicRef: 'test' }]))
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'need_human')
    assert.equal(result.value.messages[result.value.messages.length - 1].kind, 'safe_refusal')
    assert.equal(providerCalls, 0)
  })

  await runCase('B7-SAFETY-BEFORE-LOOKUP', async () => {
    const unsafeAliasManifest = clone(AI_B7_APPROVED_FIXTURE_MANIFEST)
    unsafeAliasManifest.entries[0].question = '我该吃什么药？'
    unsafeAliasManifest.entries[0].aliases = ['药物建议']
    const preflight = domain.evaluateApprovedFaqSafetyPreflightV1('我该吃什么药？')
    assert.equal(preflight.kind, 'blocked')
    assert.equal(preflight.policy.requestCategory, 'medical_professional_judgment')
    const pageApplication = pageModule.createAIConsultationPageApplicationForTestV1(unsafeAliasManifest)
    const result = await pageApplication.completeSend(pageApplication.beginSend(pageApplication.createInitialResult(), '我该吃什么药？'))
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'need_human')
    assert.equal(result.value.messages[result.value.messages.length - 1].kind, 'safe_refusal')
  })

  await runCase('B7-B6-APPLICATION-INTEGRATION', async () => {
    const productionPageApplication = pageModule.createAIConsultationPageApplicationV1()
    const productionInitial = productionPageApplication.createInitialResult()
    const productionCanonical = await productionPageApplication.completeSend(
      productionPageApplication.beginSend(productionInitial, '怎样开始养老需求评估？'),
    )
    assert.equal(productionCanonical.ok, true)
    assert.equal(productionCanonical.value.state, 'answer_ready')
    assert.equal(productionCanonical.value.responseProvenance, 'approved_faq')
    assert.equal(productionCanonical.value.messages[productionCanonical.value.messages.length - 1].sourceRefs[0].category, 'product_faq')
    const productionAlias = await productionPageApplication.completeSend(
      productionPageApplication.beginSend(productionInitial, '如何开始需求评估？'),
    )
    assert.equal(productionAlias.ok, true)
    assert.equal(productionAlias.value.state, 'answer_ready')
    const productionVisit = await productionPageApplication.completeSend(
      productionPageApplication.beginSend(productionInitial, '什么是已完成带看状态？'),
    )
    assert.equal(productionVisit.ok, true)
    assert.equal(productionVisit.value.state, 'answer_ready')
    assert.equal(productionVisit.value.messages[productionVisit.value.messages.length - 1].sourceRefs[0].category, 'visit_faq')
    const productionUnknown = await productionPageApplication.completeSend(
      productionPageApplication.beginSend(productionInitial, '未批准的实时床位问题'),
    )
    assert.equal(productionUnknown.ok, true)
    assert.equal(productionUnknown.value.state, 'knowledge_unavailable')
    const productionMedical = await productionPageApplication.completeSend(
      productionPageApplication.beginSend(productionInitial, '我该吃什么药？'),
    )
    assert.equal(productionMedical.ok, true)
    assert.equal(productionMedical.value.state, 'need_human')
    assert.equal(productionMedical.value.messages[productionMedical.value.messages.length - 1].kind, 'safe_refusal')

    const pageApplication = pageModule.createAIConsultationPageApplicationForTestV1(AI_B7_APPROVED_FIXTURE_MANIFEST)
    const initial = pageApplication.createInitialResult()
    const sending = pageApplication.beginSend(initial, '怎样开始养老需求评估？')
    const result = await pageApplication.completeSend(sending)
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'answer_ready')
    assert.equal(result.value.responseProvenance, 'approved_faq')
    assert.equal(result.value.messages[result.value.messages.length - 1].sourceRefs[0].category, 'product_faq')
    const unavailable = await pageApplication.completeSend(pageApplication.beginSend(initial, '未批准的实时床位问题'))
    assert.equal(unavailable.value.state, 'knowledge_unavailable')
  })

  await runCase('B7-MOCK-AND-DOMAIN-ISOLATION', () => {
    const productionFiles = [
      'miniprogram/types/ai-consultation-faq-v1.ts',
      'miniprogram/domain/ai-consultation/validate-approved-faq.ts',
      'miniprogram/domain/ai-consultation/lookup-approved-faq.ts',
      'miniprogram/services/ai-consultation-approved-faq.ts',
      'miniprogram/services/ai-consultation-page.ts',
      'miniprogram/services/ai-consultation-application.ts',
    ]
    const combined = productionFiles.map(read).join('\n')
    assert.equal(/scripts[\\/]fixtures|ai-b7-fixtures|TEST_ONLY_SYNTHETIC/.test(combined), false)
    assert.equal(/wx\.request|fetch\(|XMLHttpRequest|apiKey|appSecret|Authorization|token\b|provider-sdk/i.test(combined), false)
    assert.equal(/writeRecommendation|rerank|recompute|writeInstitution|writeProfile|createAppointment|createVisit|submitEvaluation/.test(combined), false)
    assert.equal(providerModule.AI_APPROVED_FAQ_PRODUCTION_MANIFEST_V1.entries.length, 11)
  })

  assert.deepEqual(AI_B7_FIXTURE_MANIFEST, Array.from(assertionCounts.keys()))
  if (failures.length > 0) {
    console.error('AI_B7_TARGETED_RUNTIME = FAIL')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  const assertionCount = [...assertionCounts.values()].reduce((total, count) => total + count, 0)
  console.log(`AI_B7_FIXTURE_POLICY: ${AI_B7_FIXTURE_POLICY}`)
  console.log(`AI_B7_FIXTURE_COUNT: ${AI_B7_FIXTURE_MANIFEST.length}`)
  console.log(`AI_B7_ASSERTION_COUNT: ${assertionCount}`)
  console.log('AI_B7_APPROVED_PRODUCTION_FAQ_COUNT: 11')
  console.log('AI_B7_UNAPPROVED_PRODUCTION_FAQ_COUNT: 0')
  console.log('AI_B7_PRODUCT_FAQ_COUNT: 7')
  console.log('AI_B7_VISIT_FAQ_COUNT: 4')
  console.log('AI_B7_OWNER_APPROVAL_PROVENANCE: PASS')
  console.log('AI_B7_ALIAS_COLLISION_COUNT: 0')
  console.log('AI_B7_ALIAS_COLLISION_RECHECK: PASS')
  console.log('AI_B7_SAFETY_PREFLIGHT_RECHECK: PASS')
  console.log('AI_B7_TEST_ONLY_PRODUCT_FAQ_COUNT: 1')
  console.log('AI_B7_TEST_ONLY_VISIT_FAQ_COUNT: 1')
  console.log('AI_B7_NO_MATCH_CASES: 2')
  console.log('AI_B7_AMBIGUOUS_MATCH_CASES: 1')
  console.log('AI_B7_SAFETY_PRECEDENCE: PASS')
  console.log('AI_B7_SAFETY_BEFORE_LOOKUP: PASS')
  console.log('AI_B7_PUBLIC_APPLICATION_BOUNDARY: PASS')
  console.log('AI_B7_PRODUCTION_FIXTURE_IMPORT_COUNT: 0')
  console.log('AI_B7_REAL_PROVIDER_DEPENDENCY_COUNT: 0')
  console.log('AI_B7_SECRET_DEPENDENCY_COUNT: 0')
  console.log('AI_B7_RECOMMENDATION_WRITE_COUNT: 0')
  console.log('AI_B7_INSTITUTION_WRITE_COUNT: 0')
  console.log('AI_B7_VISIT_APPOINTMENT_WRITE_COUNT: 0')
  console.log('AI_B7_SAME_INPUT_SAME_RESULT: PASS')
  console.log('AI_B7_TARGETED_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('AI_B7_TARGETED_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
