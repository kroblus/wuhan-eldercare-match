import nodeAssert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  AI_B5_FIXTURE_CONTROL,
  AI_B5_FIXTURE_MANIFEST,
  AI_B5_FIXTURE_POLICY,
  aiB5FixtureConstants,
  makeApplicationRequestFixture,
  makeContextSourcesFixture,
  makeConversationFixture,
  makePolicyFixture,
  makeProviderFixture,
} from './fixtures/ai-b5-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const domainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'ai-consultation')
const typesPath = path.join(repositoryRoot, 'miniprogram', 'types', 'ai-consultation-v1.ts')
const servicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'ai-consultation-application.ts')
const contextServicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'ai-consultation-context.ts')
const failures = []
const caseIds = []
const assertionCounts = new Map()
let activeCaseId = null

const assert = new Proxy(nodeAssert, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args) => {
      if (activeCaseId !== null) assertionCounts.set(activeCaseId, (assertionCounts.get(activeCaseId) || 0) + 1)
      return value.apply(target, args)
    }
  },
})

const runCase = (id, test) => {
  caseIds.push(id)
  activeCaseId = id
  try {
    test()
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    activeCaseId = null
  }
  const count = assertionCounts.get(id) || 0
  if (count < AI_B5_FIXTURE_CONTROL.minimumAssertionsPerCase) {
    failures.push(`${id}: expected at least ${AI_B5_FIXTURE_CONTROL.minimumAssertionsPerCase} assertions, got ${count}`)
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const walkTypeScript = (directory) => {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walkTypeScript(entryPath))
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(entryPath)
  }
  return result
}

const last = (items) => items[items.length - 1]

const run = () => {
  const { ts } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts)
  const domain = runtime.load(path.join(domainRoot, 'index.ts'))
  const application = runtime.load(servicePath)
  const contextApplication = runtime.load(contextServicePath)
  const createService = application.createAIConsultationApplicationServiceV1

  runCase('B5-CONTROL', () => {
    assert.equal(AI_B5_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_AI_DATA')
    assert.equal(AI_B5_FIXTURE_MANIFEST.length, AI_B5_FIXTURE_CONTROL.expectedCount)
    assert.equal(new Set(AI_B5_FIXTURE_MANIFEST).size, AI_B5_FIXTURE_CONTROL.expectedCount)
  })

  runCase('B5-OBJECT-IDENTITY', () => {
    assert.equal(domain.validateAIConversationV1(makeConversationFixture()).ok, true)
    assert.equal(domain.validateAIConversationV1(makeConversationFixture({ ref: { kind: 'local_session', localSessionId: '' } })).ok, false)
    assert.equal(domain.validateAIConversationV1(makeConversationFixture({ ref: { kind: 'local_session', localSessionId: 'local', conversationId: 'service' } })).ok, false)
  })

  runCase('B5-OBJECT-ROLE-KIND', () => {
    const invalid = makeConversationFixture({
      state: 'sending',
      messages: [{
        contractVersion: 'ai-consultation-contract-v1', messageId: 'bad-role', role: 'assistant', kind: 'user_input',
        content: 'invalid', sourceRefs: [], createdAt: aiB5FixtureConstants.userMessageCreatedAt,
      }],
    })
    assert.equal(domain.validateAIConversationV1(invalid).ok, false)
    const duplicate = makeConversationFixture({
      state: 'sending',
      messages: [
        { contractVersion: 'ai-consultation-contract-v1', messageId: 'same', role: 'user', kind: 'user_input', content: 'one', sourceRefs: [], createdAt: aiB5FixtureConstants.userMessageCreatedAt },
        { contractVersion: 'ai-consultation-contract-v1', messageId: 'same', role: 'user', kind: 'user_input', content: 'two', sourceRefs: [], createdAt: aiB5FixtureConstants.userMessageCreatedAt },
      ],
    })
    assert.equal(domain.validateAIConversationV1(duplicate).ok, false)
  })

  runCase('B5-SEVEN-STATES', () => {
    const user = { contractVersion: 'ai-consultation-contract-v1', messageId: 'state-user', role: 'user', kind: 'user_input', content: '问题', sourceRefs: [], createdAt: aiB5FixtureConstants.userMessageCreatedAt }
    const answer = { contractVersion: 'ai-consultation-contract-v1', messageId: 'state-answer', role: 'assistant', kind: 'answer', content: '回答', sourceRefs: [{ category: 'product_faq', publicLabel: '使用说明' }], createdAt: aiB5FixtureConstants.responseCreatedAt }
    const handoff = { contractVersion: 'ai-consultation-contract-v1', messageId: 'state-handoff', role: 'assistant', kind: 'human_handoff', content: '转人工', sourceRefs: [], handoff: { level: 'required', reason: 'user_requested_human', publicExplanation: '请联系顾问', destination: 'global_consultant_service' }, createdAt: aiB5FixtureConstants.responseCreatedAt }
    const failure = { contractVersion: 'ai-consultation-contract-v1', messageId: 'state-failure', role: 'assistant', kind: 'technical_failure', content: '请重试', sourceRefs: [], createdAt: aiB5FixtureConstants.responseCreatedAt }
    const fixtures = [
      makeConversationFixture({ state: 'idle', messages: [] }),
      makeConversationFixture({ state: 'sending', messages: [user] }),
      makeConversationFixture({ state: 'answer_ready', messages: [user, answer] }),
      makeConversationFixture({ state: 'need_human', messages: [user, handoff] }),
      makeConversationFixture({ state: 'knowledge_unavailable', messages: [user] }),
      makeConversationFixture({ state: 'network_error', messages: [user, failure] }),
      makeConversationFixture({ state: 'service_error', messages: [user, failure] }),
    ]
    fixtures.forEach((fixture) => assert.equal(domain.validateAIConversationV1(fixture).ok, true))
    assert.equal(fixtures.length, 7)
  })

  runCase('B5-FIVE-KNOWLEDGE-CATEGORIES', () => {
    const sources = makeContextSourcesFixture()
    assert.equal(domain.evaluateAIKnowledgeAllowlistV1(sources).allowed, true)
    assert.equal(sources.length, 5)
    assert.deepEqual(sources.map((source) => source.category), [
      'product_faq', 'profile_display_snapshot', 'recommendation_display_snapshot', 'institution_display_snapshot', 'visit_faq',
    ])
  })

  runCase('B5-UNKNOWN-KNOWLEDGE-DENIED', () => {
    const sources = makeContextSourcesFixture()
    sources.push({ category: 'general_model_knowledge', publicLabel: '模型知识', publicSummary: 'forbidden' })
    assert.equal(domain.evaluateAIKnowledgeAllowlistV1(sources).allowed, false)
    assert.equal(domain.isAllowedAISourceCategoryV1('global_consultant_service'), false)
  })

  runCase('B5-SAFETY-DETERMINISM', () => {
    const input = makePolicyFixture()
    assert.equal(
      JSON.stringify(domain.evaluateAISafetyDispositionV1(input)),
      JSON.stringify(domain.evaluateAISafetyDispositionV1(input)),
    )
    assert.equal(JSON.stringify(domain.evaluateAISafetyDispositionV1(input)), JSON.stringify({ kind: 'answer', state: 'answer_ready' }))
  })

  runCase('B5-SAFETY-REFUSAL', () => {
    const result = domain.evaluateAISafetyDispositionV1(makePolicyFixture({ requestCategory: 'prohibited_nonmedical' }))
    assert.equal(result.kind, 'safe_refusal')
    assert.equal(result.state, 'answer_ready')
    assert.equal(result.handoff, null)
  })

  runCase('B5-SAFETY-MEDICAL', () => {
    const result = domain.evaluateAISafetyDispositionV1(makePolicyFixture({ requestCategory: 'medical_professional_judgment' }))
    assert.equal(result.kind, 'safe_refusal')
    assert.equal(result.state, 'need_human')
    assert.equal(result.handoff.reason, 'medical_professional_required')
    assert.equal(result.handoff.destination, undefined)
  })

  runCase('B5-SAFETY-HANDOFF-REASONS', () => {
    const cases = [
      ['institution_confirmation', 'institution_confirmation_required'],
      ['realtime_business_fact', 'realtime_business_fact_required'],
      ['contract_payment_or_complaint', 'contract_payment_or_complaint'],
      ['appointment_or_complex_care', 'appointment_or_complex_care'],
    ]
    cases.forEach(([requestCategory, reason]) => {
      const result = domain.evaluateAISafetyDispositionV1(makePolicyFixture({ requestCategory }))
      assert.equal(result.kind, 'human_handoff')
      assert.equal(result.handoff.reason, reason)
    })
  })

  runCase('B5-SAFETY-KNOWLEDGE-INSUFFICIENCY', () => {
    const once = domain.evaluateAISafetyDispositionV1(makePolicyFixture({ hasSufficientAllowedKnowledge: false, consecutiveAllowedKnowledgeInsufficiencyCount: 1 }))
    const twice = domain.evaluateAISafetyDispositionV1(makePolicyFixture({ hasSufficientAllowedKnowledge: false, consecutiveAllowedKnowledgeInsufficiencyCount: 2 }))
    assert.equal(once.state, 'knowledge_unavailable')
    assert.equal(twice.kind, 'human_handoff')
    assert.equal(twice.handoff.reason, 'allowed_knowledge_insufficient')
  })

  runCase('B5-HANDOFF-BOUNDARY', () => {
    assert.equal(domain.validateAIHandoffV1({ level: 'required', reason: 'user_requested_human', publicExplanation: '请联系顾问', destination: 'global_consultant_service' }).ok, true)
    assert.equal(domain.validateAIHandoffV1({ level: 'required', reason: 'medical_professional_required', publicExplanation: '请就医', destination: 'global_consultant_service' }).ok, false)
    assert.equal(domain.validateAIHandoffV1({ level: 'suggested', reason: 'user_requested_human', publicExplanation: '请联系顾问', destination: 'global_consultant_service' }).ok, false)
    assert.equal(domain.validateAIHandoffV1({ level: 'required', reason: 'consultant_guidance_suggested', publicExplanation: '可联系顾问', destination: 'global_consultant_service' }).ok, false)
    assert.equal(JSON.stringify(domain.evaluateAISafetyDispositionV1(makePolicyFixture({ userRequestedHuman: true }))).includes('User.phone'), false)
    const suggested = { level: 'suggested', reason: 'consultant_guidance_suggested', publicExplanation: '如需进一步了解，可联系顾问。', destination: 'global_consultant_service' }
    assert.equal(domain.validateAIMessageV1({
      contractVersion: 'ai-consultation-contract-v1', messageId: 'answer-suggested', role: 'assistant', kind: 'answer',
      content: '这是当前资料能够解释的内容。', sourceRefs: [{ category: 'product_faq', publicLabel: '使用说明' }],
      handoff: suggested, createdAt: aiB5FixtureConstants.responseCreatedAt,
    }).ok, true)
    assert.equal(domain.validateAIMessageV1({
      contractVersion: 'ai-consultation-contract-v1', messageId: 'human-suggested', role: 'assistant', kind: 'human_handoff',
      content: '可联系顾问。', sourceRefs: [], handoff: suggested, createdAt: aiB5FixtureConstants.responseCreatedAt,
    }).ok, false)
  })

  runCase('B5-SOURCE-REFS', () => {
    assert.equal(domain.validateAISourceRefV1({ category: 'visit_faq', publicLabel: '看院流程', publicVersion: 'v1', publicRef: 'visit-b5' }).ok, true)
    assert.equal(domain.validateAISourceRefV1({ category: 'visit_faq', publicLabel: 'https://internal.example' }).ok, false)
    assert.equal(domain.validateAISourceRefV1({ category: 'visit_faq', publicLabel: '看院流程', publicRef: 'https://db/internal' }).ok, false)
  })

  runCase('B5-CONTEXT-MINIMIZATION', () => {
    const valid = makeContextSourcesFixture()
    const projected = contextApplication.minimizeAIConsultationContextV1(valid)
    assert.equal(projected.ok, true)
    assert.deepEqual(Object.keys(projected.value.providerContext[0]).sort(), ['category', 'publicRef', 'publicSummary', 'publicVersion'])
    assert.equal(JSON.stringify(projected.value.providerContext).includes('publicLabel'), false)
    const unsafe = clone(valid)
    unsafe[0].rawAssessment = { healthAnswers: ['private'] }
    assert.equal(domain.validateAIContextSourcesV1(unsafe).ok, false)
  })

  runCase('B5-APPLICATION-ANSWER', () => {
    let providerRequest = null
    const service = createService(makeProviderFixture({ onRequest: (input) => { providerRequest = input } }))
    const result = service.consult(makeApplicationRequestFixture())
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'answer_ready')
    assert.equal(last(result.value.messages).kind, 'answer')
    assert.equal(last(result.value.messages).sourceRefs.length, 5)
    assert.equal(providerRequest.context.length, 5)
    assert.equal(domain.validateAIApplicationResultV1(result).ok, true)
    assert.equal(domain.validateAIApplicationSnapshotV1({ ...result.value, providerMetadata: 'forbidden' }).ok, false)
    assert.equal(domain.validateAIApplicationSnapshotV1({
      ...result.value,
      actions: { canSend: true, canRetry: true, canOpenHumanHandoff: true },
    }).ok, false)
  })

  runCase('B5-APPLICATION-REFUSAL', () => {
    let calls = 0
    const service = createService(makeProviderFixture({ onRequest: () => { calls += 1 } }))
    const result = service.consult(makeApplicationRequestFixture({ policy: makePolicyFixture({ requestCategory: 'prohibited_nonmedical' }) }))
    assert.equal(result.ok, true)
    assert.equal(last(result.value.messages).kind, 'safe_refusal')
    assert.equal(calls, 0)
  })

  runCase('B5-APPLICATION-HANDOFF', () => {
    let calls = 0
    const service = createService(makeProviderFixture({ onRequest: () => { calls += 1 } }))
    const result = service.consult(makeApplicationRequestFixture({ policy: makePolicyFixture({ userRequestedHuman: true }) }))
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'need_human')
    assert.equal(last(result.value.messages).handoff.destination, 'global_consultant_service')
    assert.equal(calls, 0)
  })

  runCase('B5-PROVIDER-RAW-FIREWALL', () => {
    const raw = { ok: true, candidate: { kind: 'answer', content: 'unsafe', prompt: 'hidden', moderation: { raw: true } } }
    const result = createService(makeProviderFixture({ result: raw })).consult(makeApplicationRequestFixture())
    const wrappedRaw = createService(makeProviderFixture({
      result: { ok: true, candidate: { kind: 'answer', content: 'unsafe' }, providerRequestId: 'internal' },
    })).consult(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'SERVICE_ERROR')
    assert.equal(JSON.stringify(result).includes('hidden'), false)
    assert.equal(JSON.stringify(result).includes('moderation'), false)
    assert.equal(wrappedRaw.ok, false)
    assert.equal(JSON.stringify(wrappedRaw).includes('providerRequestId'), false)
  })

  runCase('B5-PROVIDER-NETWORK-FAILURE', () => {
    const result = createService(makeProviderFixture({ result: { ok: false, failure: 'network_error' } })).consult(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'NETWORK_ERROR')
    assert.equal(result.error.snapshot.state, 'network_error')
    assert.equal(result.error.retryable, true)
  })

  runCase('B5-PROVIDER-SERVICE-FAILURE', () => {
    const malformed = createService(makeProviderFixture({ result: { ok: true, candidate: { kind: 'answer', content: '' } } })).consult(makeApplicationRequestFixture())
    const unavailable = createService(makeProviderFixture({ result: { ok: false, failure: 'service_error' } })).consult(makeApplicationRequestFixture())
    assert.equal(malformed.ok, false)
    assert.equal(malformed.error.code, 'SERVICE_ERROR')
    assert.equal(unavailable.ok, false)
    assert.equal(unavailable.error.snapshot.state, 'service_error')
  })

  runCase('B5-ERROR-ID-FAIL-CLOSED', () => {
    const prior = {
      contractVersion: 'ai-consultation-contract-v1',
      messageId: 'duplicate-response-id',
      role: 'assistant',
      kind: 'answer',
      content: '已有安全回答',
      sourceRefs: [{ category: 'product_faq', publicLabel: '使用说明' }],
      createdAt: aiB5FixtureConstants.responseCreatedAt,
    }
    const conversation = makeConversationFixture({ state: 'answer_ready', messages: [prior] })
    const result = createService(makeProviderFixture()).consult(makeApplicationRequestFixture({
      conversation,
      userInput: '',
      responseMessageId: 'duplicate-response-id',
    }))
    assert.equal(result.ok, false)
    const ids = result.error.snapshot.messages.map((message) => message.messageId)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(last(ids), 'duplicate-response-id-technical-failure-1')
    assert.equal(domain.validateAIApplicationResultV1(result).ok, true)
  })

  runCase('B5-PRIVACY-ISOLATION', () => {
    let providerRequest = null
    const context = makeContextSourcesFixture()
    context[0].userPhone = 'TEST_ONLY_FORBIDDEN'
    const result = createService(makeProviderFixture({ onRequest: (input) => { providerRequest = input } }))
      .consult(makeApplicationRequestFixture({ contextSources: context }))
    assert.equal(result.ok, false)
    assert.equal(providerRequest, null)
    assert.equal(JSON.stringify(result).includes('TEST_ONLY_FORBIDDEN'), false)
  })

  runCase('B5-DOMAIN-ISOLATION', () => {
    const productionFiles = [typesPath, ...walkTypeScript(domainRoot), contextServicePath, servicePath]
    const forbiddenImports = productionFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return /from\s+['"][^'"]*(?:recommendation|institution|elder-profile|appointment|visit-evaluation|assessment)[^'"]*['"]/.test(source)
        ? [path.relative(repositoryRoot, file)]
        : []
    })
    assert.deepEqual(forbiddenImports, [])
    assert.equal(productionFiles.some((file) => /\b(?:wx\.|fetch\(|XMLHttpRequest|require\(['"](?:http|https|fs|path))/.test(readFileSync(file, 'utf8'))), false)
    assert.equal(productionFiles.some((file) => /(?:rerank|recompute|writeInstitution|writeProfile|createAppointment|createVisit|submitEvaluation)/.test(readFileSync(file, 'utf8'))), false)
  })

  runCase('B5-MOCK-ISOLATION', () => {
    const productionFiles = [typesPath, ...walkTypeScript(domainRoot), contextServicePath, servicePath]
    const fixtureImports = productionFiles.filter((file) => /scripts[\\/]fixtures|ai-b5-fixtures/.test(readFileSync(file, 'utf8')))
    assert.deepEqual(fixtureImports, [])
    assert.equal(productionFiles.some((file) => readFileSync(file, 'utf8').includes('TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_AI_DATA')), false)
  })

  assert.deepEqual(caseIds, AI_B5_FIXTURE_MANIFEST, 'fixture manifest must exactly match executed cases')
  const assertionCount = [...assertionCounts.values()].reduce((total, count) => total + count, 0)
  if (failures.length > 0) {
    console.error('AI_B5_TARGETED_RUNTIME = FAIL')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`AI_B5_FIXTURE_POLICY: ${AI_B5_FIXTURE_POLICY}`)
  console.log(`AI_B5_FIXTURE_COUNT: ${caseIds.length}`)
  console.log(`AI_B5_ASSERTION_COUNT: ${assertionCount}`)
  console.log('AI_B5_NEGATIVE_FAIL_CLOSED_COVERAGE: PASS')
  console.log('AI_B5_PRODUCTION_FIXTURE_IMPORT_COUNT: 0')
  console.log('AI_B5_RECOMMENDATION_WRITE_CALLS: 0')
  console.log('AI_B5_INSTITUTION_PROFILE_WRITE_CALLS: 0')
  console.log('AI_B5_VISIT_APPOINTMENT_WRITE_CALLS: 0')
  console.log('AI_B5_TARGETED_RUNTIME = PASS')
}

run()
