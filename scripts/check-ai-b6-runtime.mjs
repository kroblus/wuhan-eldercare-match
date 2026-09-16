/**
 * Targeted B6 AI Consultation Page/Application gate.
 *
 * Positive answer/refusal/handoff states are TEST_ONLY public snapshots.  The
 * production page/application facade deliberately has no provider and remains
 * honest about its unavailable capability.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  AI_B6_FIXTURE_MANIFEST,
  AI_B6_FIXTURE_POLICY,
  AI_B6_PUBLIC_STATE_FIXTURES,
  AI_B6_SAFE_REFUSAL_FIXTURE,
} from './fixtures/ai-b6-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const failures = []
const assertionCounts = new Map()
let activeCase = null

const countedAssert = new Proxy(assert, {
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
  const count = assertionCounts.get(id) || 0
  if (count === 0) failures.push(`${id}: expected at least one assertion`)
}

const modulePath = (relativePath) => path.join(repositoryRoot, 'miniprogram', relativePath)

const makePage = (config) => {
  const page = {
    ...config,
    ...config.methods,
    data: { ...config.data },
    setData(patch) {
      this.data = { ...this.data, ...patch }
    },
  }
  return page
}

const run = async () => {
  const { ts } = loadWechatTypeScript()

  await runCase('B6-CONTROL', () => {
    countedAssert.equal(AI_B6_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_AI_DATA')
    countedAssert.equal(AI_B6_PUBLIC_STATE_FIXTURES.length, 7)
    countedAssert.deepEqual(AI_B6_PUBLIC_STATE_FIXTURES.map(([state]) => state), [
      'idle', 'sending', 'answer_ready', 'need_human', 'knowledge_unavailable', 'network_error', 'service_error',
    ])
  })

  const viewModelRuntime = createWechatTsRuntime(ts)
  const viewModel = viewModelRuntime.load(modulePath('pages/service/ai-chat/index-view-model.ts'))
  await runCase('B6-SEVEN-STATE-MAPPING', () => {
    AI_B6_PUBLIC_STATE_FIXTURES.forEach(([state, result]) => {
      const mapped = viewModel.createAIChatPageViewModelV1(result)
      countedAssert.equal(mapped.state, state)
      countedAssert.equal(typeof mapped.stateTitle, 'string')
      countedAssert.equal(typeof mapped.provenanceLabel, 'string')
      countedAssert.equal(Array.isArray(mapped.messages), true)
    })
  })

  const appRuntime = createWechatTsRuntime(ts)
  const app = appRuntime.load(modulePath('services/ai-consultation-page.ts'))
  const pageApplication = app.createAIConsultationPageApplicationV1()
  await runCase('B6-APPLICATION-UNAVAILABLE', async () => {
    const initial = pageApplication.createInitialResult()
    countedAssert.equal(initial.ok, true)
    countedAssert.equal(initial.value.state, 'idle')
    countedAssert.equal(initial.value.responseProvenance, 'unavailable')
    const sending = pageApplication.beginSend(initial, '问题')
    countedAssert.equal(sending.ok, true)
    countedAssert.equal(sending.value.state, 'sending')
    const completed = await pageApplication.completeSend(sending)
    countedAssert.equal(completed.ok, true)
    countedAssert.equal(completed.value.state, 'knowledge_unavailable')
    countedAssert.equal(completed.value.responseProvenance, 'unavailable')
  })

  let componentConfig = null
  const switchTabCalls = []
  const pageRuntime = createWechatTsRuntime(ts, {
    Component(config) { componentConfig = config },
    wx: {
      switchTab(options) { switchTabCalls.push(options) },
    },
  })
  pageRuntime.load(modulePath('pages/service/ai-chat/index.ts'))
  countedAssert.ok(componentConfig)
  const page = makePage(componentConfig)
  componentConfig.lifetimes.attached.call(page)

  await runCase('B6-EMPTY-INPUT', () => {
    const before = page.data.result.value.messages.length
    page.onSend()
    countedAssert.equal(page.data.inputError, '请先输入想了解的问题。')
    countedAssert.equal(page.data.result.value.messages.length, before)
    countedAssert.equal(page.data.isSending, false)
  })

  await runCase('B6-SEND-RAPID-TAP-RECOVERY', async () => {
    page.setData({ inputValue: '怎样开始评估？' })
    page.onSend()
    page.onSend()
    page.onQuickQuestion({ currentTarget: { dataset: { question: '发送中不应覆盖输入' } } })
    countedAssert.equal(page.data.isSending, true)
    countedAssert.equal(page.data.inputValue, '怎样开始评估？')
    await Promise.resolve()
    await Promise.resolve()
    countedAssert.equal(page.data.isSending, false)
    countedAssert.equal(page.data.viewModel.state, 'knowledge_unavailable')
    countedAssert.equal(page.data.viewModel.messages.filter((item) => item.isUser).length, 1)
  })

  await runCase('B6-SEND-FAILURE-RETRY-RECOVERY', async () => {
    let failureComponentConfig = null
    const failureRuntime = createWechatTsRuntime(ts, {
      Component(config) { failureComponentConfig = config },
      wx: { switchTab() {} },
    })
    const serviceModule = failureRuntime.load(modulePath('services/ai-consultation-page.ts'))
    const realFactory = serviceModule.createAIConsultationPageApplicationV1
    serviceModule.createAIConsultationPageApplicationV1 = () => {
      const real = realFactory()
      let rejectNext = true
      return {
        ...real,
        completeSend(result) {
          if (rejectNext) {
            rejectNext = false
            return Promise.reject(new Error('TEST_ONLY synthetic failure'))
          }
          return real.completeSend(result)
        },
      }
    }
    failureRuntime.load(modulePath('pages/service/ai-chat/index.ts'))
    countedAssert.ok(failureComponentConfig)
    const failurePage = makePage(failureComponentConfig)
    failureComponentConfig.lifetimes.attached.call(failurePage)
    failurePage.setData({ inputValue: '测试失败后重试' })
    failurePage.onSend()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    countedAssert.equal(failurePage.data.isSending, false)
    countedAssert.equal(failurePage.data.viewModel.state, 'service_error')
    countedAssert.equal(failurePage.data.viewModel.canRetry, true)
    countedAssert.equal(failurePage.data.actionError, '咨询服务暂时不可用，请稍后重试。')
    failurePage.onRetry()
    await Promise.resolve()
    await Promise.resolve()
    countedAssert.equal(failurePage.data.isSending, false)
    countedAssert.equal(failurePage.data.viewModel.state, 'knowledge_unavailable')
  })

  await runCase('B6-SEND-SYNC-THROW-RETRY-RECOVERY', async () => {
    let throwComponentConfig = null
    const throwRuntime = createWechatTsRuntime(ts, {
      Component(config) { throwComponentConfig = config },
      wx: { switchTab() {} },
    })
    const serviceModule = throwRuntime.load(modulePath('services/ai-consultation-page.ts'))
    const realFactory = serviceModule.createAIConsultationPageApplicationV1
    serviceModule.createAIConsultationPageApplicationV1 = () => {
      const real = realFactory()
      let throwNext = true
      return {
        ...real,
        beginSend(current, input) {
          if (throwNext) {
            throwNext = false
            throw new Error('TEST_ONLY synthetic synchronous failure')
          }
          return real.beginSend(current, input)
        },
      }
    }
    throwRuntime.load(modulePath('pages/service/ai-chat/index.ts'))
    countedAssert.ok(throwComponentConfig)
    const throwPage = makePage(throwComponentConfig)
    throwComponentConfig.lifetimes.attached.call(throwPage)
    throwPage.setData({ inputValue: '测试同步异常后重试' })
    throwPage.onSend()
    countedAssert.equal(throwPage.data.isSending, false)
    countedAssert.equal(throwPage.data.viewModel.state, 'service_error')
    countedAssert.equal(throwPage.data.viewModel.canRetry, true)
    countedAssert.equal(throwPage.data.actionError, '咨询服务暂时不可用，请稍后重试。')
    throwPage.onRetry()
    await Promise.resolve()
    await Promise.resolve()
    countedAssert.equal(throwPage.data.isSending, false)
    countedAssert.equal(throwPage.data.viewModel.state, 'knowledge_unavailable')
  })

  await runCase('B6-RETRY-RECOVERY', async () => {
    page.onRetry()
    await Promise.resolve()
    await Promise.resolve()
    countedAssert.equal(page.data.isSending, false)
    countedAssert.equal(page.data.viewModel.state, 'knowledge_unavailable')
    countedAssert.equal(page.data.viewModel.messages.filter((item) => item.isUser).length, 2)
  })

  await runCase('B6-HUMAN-HANDOFF-SWITCH-TAB', () => {
    page.openHumanHandoff()
    page.openHumanHandoff()
    countedAssert.equal(switchTabCalls.length, 1)
    countedAssert.equal(switchTabCalls[0].url, '/pages/consultant/index')
    countedAssert.equal(read('miniprogram/pages/service/ai-chat/index.ts').includes('wx.navigateTo'), false)
    switchTabCalls[0].fail()
    switchTabCalls[0].complete()
    countedAssert.equal(page.data.actionError, '暂时无法打开养老顾问，请稍后重试。')
    page.openHumanHandoff()
    countedAssert.equal(switchTabCalls.length, 2)
  })

  await runCase('B6-HOME-ENTRY', () => {
    let homeComponentConfig = null
    const navigateToCalls = []
    const homeRuntime = createWechatTsRuntime(ts, {
      Component(config) { homeComponentConfig = config },
      wx: {
        navigateTo(options) { navigateToCalls.push(options) },
      },
    })
    homeRuntime.load(modulePath('pages/home/index.ts'))
    countedAssert.ok(homeComponentConfig)
    const home = makePage(homeComponentConfig)
    home.openAIConsultation()
    home.openAIConsultation()
    countedAssert.equal(navigateToCalls.length, 1)
    countedAssert.equal(navigateToCalls[0].url, '/pages/service/ai-chat/index')
    navigateToCalls[0].fail()
    navigateToCalls[0].complete()
    countedAssert.equal(home.data.aiActionError, '暂时无法打开养老咨询助手，请稍后重试。')
    home.openAIConsultation()
    countedAssert.equal(navigateToCalls.length, 2)
  })

  await runCase('B6-SAFE-REFUSAL', () => {
    const mapped = viewModel.createAIChatPageViewModelV1(AI_B6_SAFE_REFUSAL_FIXTURE)
    countedAssert.equal(mapped.state, 'need_human')
    countedAssert.equal(mapped.messages[1].kind, 'safe_refusal')
    countedAssert.equal(mapped.messages[1].handoffExplanation.length > 0, true)
    countedAssert.equal(mapped.messages[1].sourceLabels.length, 0)
  })

  await runCase('B6-PRIVACY-AND-ISOLATION', () => {
    const productionFiles = [
      'miniprogram/services/ai-consultation-page.ts',
      'miniprogram/pages/service/ai-chat/index.ts',
      'miniprogram/pages/service/ai-chat/index-view-model.ts',
      'miniprogram/pages/home/index.ts',
    ]
    const combined = productionFiles.map(read).join('\n')
    countedAssert.equal(/scripts[\\/]fixtures|ai-b6-fixtures|TEST_ONLY_SYNTHETIC/.test(combined), false)
    countedAssert.equal(/wx\.request|fetch\(|XMLHttpRequest|apiKey|appSecret|Authorization|token\b/.test(combined), false)
    countedAssert.equal(/rawAssessment|userPhone|User\.phone|private|secret|credential/.test(combined), false)
    countedAssert.equal(/writeRecommendation|rerank|recompute|writeInstitution|writeProfile|createAppointment|createVisit|submitEvaluation/.test(combined), false)
    countedAssert.equal(read('miniprogram/app.json').includes('pages/service/ai-chat/index'), true)
    countedAssert.equal(read('miniprogram/pages/home/index.ts').includes('/pages/service/ai-chat/index'), true)
  })

  const allCases = [...AI_B6_FIXTURE_MANIFEST]
  const executed = ['B6-CONTROL', 'B6-SEVEN-STATE-MAPPING', 'B6-APPLICATION-UNAVAILABLE', 'B6-EMPTY-INPUT', 'B6-SEND-RAPID-TAP-RECOVERY', 'B6-SEND-FAILURE-RETRY-RECOVERY', 'B6-SEND-SYNC-THROW-RETRY-RECOVERY', 'B6-RETRY-RECOVERY', 'B6-HUMAN-HANDOFF-SWITCH-TAB', 'B6-HOME-ENTRY', 'B6-SAFE-REFUSAL', 'B6-PRIVACY-AND-ISOLATION']
  countedAssert.deepEqual(executed, allCases)
  if (failures.length > 0) {
    console.error('AI_B6_TARGETED_RUNTIME = FAIL')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  const assertionCount = [...assertionCounts.values()].reduce((total, count) => total + count, 0)
  console.log(`AI_B6_FIXTURE_POLICY: ${AI_B6_FIXTURE_POLICY}`)
  console.log(`AI_B6_FIXTURE_COUNT: ${executed.length}`)
  console.log(`AI_B6_ASSERTION_COUNT: ${assertionCount}`)
  console.log('AI_B6_SEVEN_STATE_MAPPING: PASS')
  console.log('AI_B6_EMPTY_INPUT_NO_CALL: PASS')
  console.log('AI_B6_SEND_RETRY_GUARD: PASS')
  console.log('AI_B6_HUMAN_HANDOFF_SWITCH_TAB: PASS')
  console.log('AI_B6_HOME_ENTRY: PASS')
  console.log('AI_B6_SAFE_REFUSAL_DISPLAY: PASS')
  console.log('AI_B6_NAVIGATE_TO_CONSULTANT_CALLS: 0')
  console.log('AI_B6_PRODUCTION_FIXTURE_IMPORT_COUNT: 0')
  console.log('AI_B6_PROVIDER_SECRET_DEPENDENCY_COUNT: 0')
  console.log('AI_B6_CROSS_DOMAIN_WRITE_COUNT: 0')
  console.log('AI_B6_TARGETED_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('AI_B6_TARGETED_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
