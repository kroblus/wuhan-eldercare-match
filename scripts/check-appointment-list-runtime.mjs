import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  APPOINTMENT_LIST_FIXTURE_POLICY,
  makeAppointmentListFixtures,
} from './fixtures/appointment-list-test-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.ts')
const viewModelPath = path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'list-view-model.ts')
const evaluationPagePath = path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.ts')
const productionSources = [pagePath, viewModelPath, evaluationPagePath]
const failures = []
const executedCases = []

const runCase = (name, callback) => {
  executedCases.push(name)
  try {
    callback()
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const createPageHarness = (runtime, pageConfig, navigationCalls, toastCalls) => {
  const page = {
    ...pageConfig,
    data: clone(pageConfig.data),
    setData(patch) {
      Object.assign(this.data, patch)
    },
  }
  runtime.context.wx.navigateTo = (options) => {
    navigationCalls.push(options)
    if (options.success) options.success({})
    if (options.complete) options.complete({})
  }
  runtime.context.wx.showToast = (options) => toastCalls.push(options)
  return page
}

const run = () => {
  assert.equal(APPOINTMENT_LIST_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_PUBLIC_VISIT_SNAPSHOTS')
  const { ts } = loadWechatTypeScript()
  let pageConfig = null
  const runtime = createWechatTsRuntime(ts, {
    Page: (config) => { pageConfig = config },
    wx: {
      navigateTo() {},
      showToast() {},
    },
  })
  runtime.load(pagePath)
  assert.ok(pageConfig)
  const navigationCalls = []
  const toastCalls = []
  const page = createPageHarness(runtime, pageConfig, navigationCalls, toastCalls)

  runCase('PRODUCTION_NO_PROVIDER_IS_UNAVAILABLE', () => {
    page.onLoad()
    assert.equal(page.data.loadState, 'load_error')
    assert.equal(page.data.visibleVisits.length, 0)
    assert.match(page.data.errorMessage, /暂不可用/)
  })

  const fixtures = makeAppointmentListFixtures()
  const sourceStatuses = fixtures.map((visit) => visit.status)

  runCase('APPLICATION_DATA_AND_STATUS_DISPLAY', () => {
    page.applyApplicationData(fixtures)
    assert.equal(page.data.loadState, 'ready_non_empty')
    assert.equal(page.data.visits.length, 5)
    assert.deepEqual(page.data.visits.map((visit) => visit.statusLabel), [
      '待确认 · 已提交',
      '待确认 · 顾问联系中',
      '已确认',
      '已完成',
      '已取消',
    ])
    assert.deepEqual(fixtures.map((visit) => visit.status), sourceStatuses)
    assert.equal(page.data.visits.find((visit) => visit.status === 'scheduled').showEvaluationAction, false)
    assert.equal(page.data.visits.find((visit) => visit.status === 'completed').showEvaluationAction, true)
    assert.equal(page.data.visits.every((visit) => visit.visitDate === '2020-01-02'), true)
  })

  runCase('FIVE_FILTERS_ARE_LOCAL_DISPLAY_ONLY', () => {
    const expectedCounts = {
      all: 5,
      awaiting: 2,
      confirmed: 1,
      completed: 1,
      cancelled: 1,
    }
    Object.entries(expectedCounts).forEach(([filter, count]) => {
      page.onFilterTap({ currentTarget: { dataset: { filter } } })
      assert.equal(page.data.activeFilter, filter)
      assert.equal(page.data.visibleVisits.length, count)
    })
    assert.equal(navigationCalls.length, 0)
    assert.equal(fixtures.map((visit) => visit.status).join(','), sourceStatuses.join(','))
  })

  runCase('COMPLETED_ENTRY_IS_SINGLE_ACTION_AND_VISIT_BOUND', () => {
    page.onFilterTap({ currentTarget: { dataset: { filter: 'all' } } })
    const completedId = 'visit-test-completed'
    const scheduledId = 'visit-test-scheduled'
    page.openEvaluation({ currentTarget: { dataset: { visitId: scheduledId } } })
    assert.equal(navigationCalls.length, 0)

    page.openEvaluation({ currentTarget: { dataset: { visitId: completedId } } })
    page.openEvaluation({ currentTarget: { dataset: { visitId: completedId } } })
    assert.equal(navigationCalls.length, 1)
    assert.equal(navigationCalls[0].url, `/pages/visit/evaluation?visitId=${encodeURIComponent(completedId)}`)
    assert.equal(/phone|elder|health|contact/i.test(navigationCalls[0].url), false)

    page.onShow()
    page.openEvaluation({ currentTarget: { dataset: { visitId: completedId } } })
    assert.equal(navigationCalls.length, 2)
  })

  runCase('FAILURE_AND_EMPTY_STATES_STAY_DISTINCT', () => {
    page.onLoad()
    assert.equal(page.data.loadState, 'load_error')
    page.applyApplicationData([])
    assert.equal(page.data.loadState, 'ready_empty')
  })

  runCase('EVALUATION_SCAFFOLD_ACCEPTS_ONLY_VISIT_ID', () => {
    let evaluationConfig = null
    runtime.context.Page = (config) => { evaluationConfig = config }
    runtime.load(evaluationPagePath)
    const evaluationPage = {
      ...evaluationConfig,
      data: clone(evaluationConfig.data),
      setData(patch) { Object.assign(this.data, patch) },
    }
    evaluationPage.onLoad({ visitId: 'visit-test-completed' })
    assert.equal(evaluationPage.data.hasVisitId, true)
    assert.equal(evaluationPage.data.visitId, 'visit-test-completed')
    evaluationPage.onLoad({ visitId: '' })
    assert.equal(evaluationPage.data.hasVisitId, false)
  })

  runCase('ROUTE_AND_TEST_FIXTURE_ISOLATION', () => {
    const appConfig = JSON.parse(readFileSync(path.join(repositoryRoot, 'miniprogram', 'app.json'), 'utf8'))
    assert.ok(appConfig.pages.includes('pages/visit/evaluation'))
    productionSources.forEach((file) => {
      const source = readFileSync(file, 'utf8')
      assert.equal(/scripts[\\/]fixtures|TEST_ONLY_SYNTHETIC/.test(source), false)
      assert.equal(/getPhoneNumber|phoneCode|realPhone/i.test(source), false)
    })
    const wxml = readFileSync(path.join(repositoryRoot, 'miniprogram', 'pages', 'appointment', 'index.wxml'), 'utf8')
    assert.match(wxml, /wx:if="\{\{item\.showEvaluationAction\}\}"/)
    assert.match(wxml, /data-visit-id="\{\{item\.visitId\}\}"/)
    const evaluationWxml = readFileSync(path.join(repositoryRoot, 'miniprogram', 'pages', 'visit', 'evaluation.wxml'), 'utf8')
    assert.equal(/<input|<textarea|评分控件|提交按钮/.test(evaluationWxml), false)
  })

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`APPOINTMENT_LIST_FIXTURE_POLICY: ${APPOINTMENT_LIST_FIXTURE_POLICY}`)
  console.log(`APPOINTMENT_LIST_RUNTIME_CASES: ${executedCases.length}`)
  console.log(`APPOINTMENT_LIST_RUNTIME_ASSERTIONS: PASS`)
}

run()
