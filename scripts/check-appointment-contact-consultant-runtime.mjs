import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const pagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.ts')
const viewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'list-view-model.ts')
const wxmlPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.wxml')
const failures = []
const cases = []

const runCase = async (name, run) => {
  cases.push(name)
  try {
    await run()
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const makeVisit = (visitId, visitStatus) => ({
  visitId,
  visitStatus,
  visitDate: '2026-09-27',
  visitTimePreference: 'morning',
  participantCount: 1,
  institutionDisplay: { availability: 'unavailable', name: null },
})

const getMethodBody = (source, methodName) => {
  const marker = `${methodName}() {`
  const markerIndex = source.indexOf(marker)
  assert.notEqual(markerIndex, -1, `missing ${methodName} page method`)
  const bodyStart = markerIndex + marker.length
  let depth = 1
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(bodyStart, index)
  }
  assert.fail(`unterminated ${methodName} page method`)
}

const makePage = (config) => ({
  ...config,
  data: { ...config.data },
  setData(patch) {
    this.data = { ...this.data, ...patch }
  },
})

const run = async () => {
  const { ts } = loadWechatTypeScript()
  const vmRuntime = createWechatTsRuntime(ts)
  const viewModel = vmRuntime.load(viewModelPath)
  const statuses = ['requested', 'contacting', 'scheduled', 'completed', 'cancelled', 'unknown']
  const visits = statuses.map((status) => makeVisit(`visit-${status}`, status))
  const mapped = viewModel.createAppointmentListViewModel(visits)

  await runCase('CONTACT_ACTION_STATUS_MATRIX_FAILS_CLOSED', () => {
    assert.deepEqual(
      mapped.visits.map((visit) => visit.showContactConsultantAction),
      [true, true, true, true, false, false],
    )
    assert.equal(mapped.visits.find((visit) => visit.status === 'unknown').statusLabel, '状态暂不可用')
  })

  await runCase('COMPLETED_CONTACT_AND_EVALUATION_ACTIONS_COEXIST', () => {
    const completed = mapped.visits.find((visit) => visit.status === 'completed')
    assert.equal(completed.showContactConsultantAction, true)
    assert.equal(completed.showEvaluationAction, true)
    assert.equal(mapped.visits.find((visit) => visit.status === 'cancelled').showEvaluationAction, false)
  })

  const navigationCalls = []
  const tabCalls = []
  const toastCalls = []
  let throwNextTabCall = false
  let pageConfig = null
  const runtime = createWechatTsRuntime(ts, {
    Page(config) { pageConfig = config },
    wx: {
      switchTab(options) {
        if (throwNextTabCall) {
          throwNextTabCall = false
          throw new Error('TEST_ONLY synchronous navigation failure')
        }
        tabCalls.push(options)
      },
      navigateTo(options) { navigationCalls.push(options) },
      showToast(options) { toastCalls.push(options) },
    },
  })
  runtime.load(pagePath)
  assert.ok(pageConfig)
  const page = makePage(pageConfig)

  await runCase('CANCELLED_AND_UNKNOWN_CARDS_CANNOT_OPEN_CONSULTANT', () => {
    page.applyApplicationData([makeVisit('visit-cancelled-only', 'cancelled')])
    page.openConsultant()
    assert.equal(tabCalls.length, 0)
    page.applyApplicationData([makeVisit('visit-unknown-only', 'unknown')])
    page.openConsultant()
    assert.equal(tabCalls.length, 0)
  })

  await runCase('TAB_NAVIGATION_DEDUPE_RETURN_AND_RETRY', () => {
    page.applyApplicationData(visits)
    page.openConsultant()
    page.openConsultant()
    assert.equal(tabCalls.length, 1)
    assert.equal(tabCalls[0].url, '/pages/consultant/index')
    assert.deepEqual(Object.keys(tabCalls[0]).sort(), ['complete', 'fail', 'success', 'url'])
    tabCalls[0].success()
    tabCalls[0].complete()

    page.onShow()
    page.openConsultant()
    assert.equal(tabCalls.length, 2)
    tabCalls[1].fail({ errMsg: 'TEST_ONLY navigation failure' })
    tabCalls[1].complete()
    assert.equal(page.data.consultantActionError, '暂时无法打开养老顾问，请稍后重试。')
    assert.equal(toastCalls.length, 1, 'navigation failure reports one visible toast')

    page.openConsultant()
    assert.equal(tabCalls.length, 3)
    assert.equal(page.data.consultantActionError, '')
    tabCalls[2].success()
    tabCalls[2].complete()
  })

  await runCase('SYNCHRONOUS_NAVIGATION_THROW_RELEASES_GUARD', () => {
    page.onShow()
    throwNextTabCall = true
    page.openConsultant()
    assert.equal(page.data.consultantActionError, '暂时无法打开养老顾问，请稍后重试。')
    assert.equal(toastCalls.length, 2, 'synchronous failure reports a visible toast')
    const beforeRetry = tabCalls.length
    page.openConsultant()
    assert.equal(tabCalls.length, beforeRetry + 1)
  })

  await runCase('COMPLETED_EVALUATION_REMAINS_VISIT_BOUND', () => {
    page.applyApplicationData(visits)
    page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-scheduled' } } })
    assert.equal(navigationCalls.length, 0)
    page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-completed' } } })
    page.openEvaluation({ currentTarget: { dataset: { visitId: 'visit-completed' } } })
    assert.equal(navigationCalls.length, 1)
    assert.equal(navigationCalls[0].url, '/pages/visit/evaluation?visitId=visit-completed')
  })

  await runCase('WXML_WIRES_ONE_ACTION_WITHOUT_VISIT_CONTEXT', () => {
    const wxml = read('miniprogram/pages/appointment/index.wxml')
    const consultantButton = wxml.match(/<primary-button\s+wx:if="\{\{item\.showContactConsultantAction\}\}"[\s\S]*?<\/primary-button>/)
    assert.ok(consultantButton)
    assert.match(consultantButton[0], /text="联系顾问"/)
    assert.match(consultantButton[0], /bind:action="openConsultant"/)
    assert.doesNotMatch(consultantButton[0], /bindtap|data-(?:visit|institution|elder|user)-id/)
    assert.match(wxml, /wx:if="\{\{item\.showEvaluationAction\}\}"/)
    assert.match(wxml, /consultantActionError[\s\S]*?role="alert"/)
  })

  await runCase('ACTION_HAS_NO_CROSS_DOMAIN_OR_PHONE_CAPABILITY', () => {
    const source = read('miniprogram/pages/appointment/index.ts')
    const body = getMethodBody(source, 'openConsultant')
    assert.match(body, /wx\.switchTab/)
    assert.match(source, /const CONSULTANT_TAB_URL = '\/pages\/consultant\/index'/)
    assert.doesNotMatch(body, /wx\.(?:navigateTo|getPhoneNumber|request)|visitId|institutionId|elderId|userId|operations|createVisit|submitVisit|assignConsultant|phone/i)
    assert.doesNotMatch(source, /TEST_ONLY|scripts[\\/]fixtures/)
  })

  if (failures.length > 0) {
    console.error('APPOINTMENT_CONTACT_CONSULTANT_RUNTIME = FAIL')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }

  console.log(`APPOINTMENT_CONTACT_CONSULTANT_RUNTIME_CASES: ${cases.length}`)
  console.log('APPOINTMENT_CONTACT_CONSULTANT_STATUS_MATRIX: PASS')
  console.log('APPOINTMENT_CONTACT_CONSULTANT_SWITCH_TAB: PASS')
  console.log('APPOINTMENT_CONTACT_CONSULTANT_DEDUPE_AND_RETRY: PASS')
  console.log('APPOINTMENT_COMPLETED_EVALUATION_PRESERVED: PASS')
  console.log('APPOINTMENT_CONTACT_CONSULTANT_CROSS_DOMAIN_CAPABILITIES: 0')
  console.log('APPOINTMENT_CONTACT_CONSULTANT_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('APPOINTMENT_CONTACT_CONSULTANT_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
