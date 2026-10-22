import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(repositoryRoot, 'output', 'assessment-basic-health-performance-b-implementation-v1')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const definitions = []
const failures = []
const results = []
const performanceSamples = []
const state = {
  storage: Object.create(null),
  pageStack: [],
  navigationCalls: [],
  scrollCalls: [],
  toastCalls: [],
  setDataSamples: [],
  activeSample: 'unlabeled',
  failWriteKey: '',
  failWriteOnce: false,
  navigationMode: 'success',
  pendingNavigation: null,
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const utf8Bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')
const noopOptions = (options) => {
  if (options.success) options.success({ errMsg: 'api:ok' })
  if (options.complete) options.complete({ errMsg: 'api:ok' })
}

const wxMock = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(state.storage, key) ? clone(state.storage[key]) : undefined
  },
  setStorageSync(key, value) {
    if (state.failWriteOnce && state.failWriteKey === key) {
      state.failWriteOnce = false
      throw new Error('synthetic storage write failure')
    }
    state.storage[key] = clone(value)
  },
  removeStorageSync(key) {
    delete state.storage[key]
  },
  getSystemInfoSync() {
    return { platform: 'android', safeArea: { top: 24 } }
  },
  nextTick(callback) {
    callback()
  },
  pageScrollTo(options) {
    state.scrollCalls.push({ selector: options.selector, duration: options.duration })
  },
  showToast(options) {
    state.toastCalls.push({ title: options.title, icon: options.icon })
  },
  navigateTo(options) {
    state.navigationCalls.push({ type: 'navigateTo', url: options.url })
    if (state.navigationMode === 'deferred') {
      state.pendingNavigation = options
      return
    }
    if (state.navigationMode === 'fail-next') {
      state.navigationMode = 'success'
      if (options.fail) options.fail({ errMsg: 'navigateTo:fail synthetic' })
      if (options.complete) options.complete({ errMsg: 'navigateTo:fail synthetic' })
      return
    }
    noopOptions(options)
  },
  navigateBack(options) {
    state.navigationCalls.push({ type: 'navigateBack', delta: options.delta })
    noopOptions(options)
  },
  redirectTo(options) {
    state.navigationCalls.push({ type: 'redirectTo', url: options.url })
    noopOptions(options)
  },
}

const { ts } = loadWechatTypeScript()
const runtime = createWechatTsRuntime(ts, {
  Page(definition) {
    definitions.push(definition)
    return definition
  },
  wx: wxMock,
  getCurrentPages: () => state.pageStack,
})
const draftModule = runtime.load(path.join(miniprogramRoot, 'store', 'assessment-draft.ts'))
const draftStore = draftModule.assessmentDraftStore

const resolveFromPage = (request, pageFile) => {
  assert.ok(request.startsWith('.'), `unexpected external module ${request}`)
  const base = path.resolve(path.dirname(pageFile), request)
  const candidates = [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')]
  const resolved = candidates.find((candidate) => existsSync(candidate))
  assert.ok(resolved, `cannot resolve ${request} from ${pageFile}`)
  return runtime.load(resolved)
}

const compileSnapshotPage = (sourceFile, actualPageFile) => {
  const source = readFileSync(sourceFile, 'utf8')
  const output = ts.transpileModule(source, {
    fileName: sourceFile,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      strict: true,
      esModuleInterop: true,
    },
  })
  const errors = output.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${sourceFile}: TypeScript diagnostics`)
  const module = { exports: {} }
  const before = definitions.length
  const localRequire = (request) => resolveFromPage(request, actualPageFile)
  const factory = vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, runtime.context, { filename: sourceFile })
  factory(localRequire, module, module.exports)
  assert.equal(definitions.length, before + 1, `${sourceFile} did not register one page`)
  return definitions.at(-1)
}

const pageFiles = {
  basic: path.join(miniprogramRoot, 'pages', 'assessment', 'basic.ts'),
  health: path.join(miniprogramRoot, 'pages', 'assessment', 'health.ts'),
}
const pageDefinitions = {
  before: {},
  after: {},
}
for (const step of ['basic', 'health']) {
  const beforeFile = path.join(outputRoot, `${step}.before.ts`)
  assert.ok(existsSync(beforeFile), `owner before snapshot is missing: ${beforeFile}`)
  pageDefinitions.before[step] = compileSnapshotPage(beforeFile, pageFiles[step])
  const definitionCount = definitions.length
  runtime.load(pageFiles[step])
  assert.equal(definitions.length, definitionCount + 1, `${pageFiles[step]} did not register one page`)
  pageDefinitions.after[step] = definitions.at(-1)
}

const storeKeys = {
  draft: draftModule.assessmentDraftStorageKey,
  pointer: draftModule.assessmentDraftActivePointerKey,
}

const clearRuntime = () => {
  Object.keys(state.storage).forEach((key) => delete state.storage[key])
  const cleared = draftStore.clear()
  assert.equal(cleared.persistence.ok, true, 'synthetic Draft clear must succeed')
  state.navigationCalls.length = 0
  state.scrollCalls.length = 0
  state.toastCalls.length = 0
  state.setDataSamples.length = 0
  state.failWriteKey = ''
  state.failWriteOnce = false
  state.navigationMode = 'success'
  state.pendingNavigation = null
}

const mountPage = (definition, step, parentRoutes = ['pages/assessment/intro']) => {
  const instance = {
    route: `pages/assessment/${step}`,
    data: clone(definition.data || {}),
    setData(patch, callback) {
      const fields = Object.keys(patch)
      state.setDataSamples.push({
        page: step,
        phase: state.activeSample,
        fields,
        fieldCount: fields.length,
        payloadUtf8Bytes: utf8Bytes(patch),
        hasCallback: typeof callback === 'function',
      })
      Object.assign(this.data, clone(patch))
      if (callback) callback()
    },
  }
  for (const route of parentRoutes) {
    state.pageStack.push({ route })
  }
  state.pageStack.push(instance)
  Object.keys(definition).forEach((key) => {
    if (typeof definition[key] === 'function') instance[key] = definition[key].bind(instance)
  })
  state.activeSample = `${step}.onLoad`
  instance.onLoad()
  state.activeSample = `${step}.first-onShow`
  instance.onShow()
  return instance
}

const prepare = (variant, step, parentRoutes = ['pages/assessment/intro']) => {
  clearRuntime()
  state.pageStack.length = 0
  return mountPage(pageDefinitions[variant][step], step, parentRoutes)
}

const captureGroup = (variant, step, name, start) => {
  const samples = state.setDataSamples.slice(start)
  const fields = samples.flatMap((sample) => sample.fields)
  const sample = {
    variant,
    step,
    scenario: name,
    setDataCount: samples.length,
    fieldCount: fields.length,
    fields,
    payloadUtf8Bytes: samples.reduce((total, item) => total + item.payloadUtf8Bytes, 0),
    samples,
  }
  performanceSamples.push(sample)
  return sample
}

const test = (name, callback) => {
  try {
    callback()
    results.push({ name, result: 'PASS' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${name}: ${message}`)
    results.push({ name, result: 'FAIL', message })
  }
}

const setBasicAnswers = (page, age = '72') => {
  page.onRelationshipChange({ detail: { value: 'father' } })
  page.onGenderChange({ detail: { value: 'female' } })
  page.onAgeInput({ detail: { value: age } })
}

const setHealthAnswers = (page) => {
  page.onConditionsChange({ detail: { values: ['none'] } })
  page.onRecentEventsChange({ detail: { values: ['none'] } })
  page.onRehabilitationNeedChange({ detail: { value: 'unknown' } })
  page.onChewingAbilityChange({ detail: { value: 'unknown' } })
  page.onSwallowingAbilityChange({ detail: { value: 'unknown' } })
}

const runPerformanceComparison = (variant, step) => {
  const page = prepare(variant, step, [step === 'basic' ? 'pages/assessment/intro' : 'pages/assessment/basic'])
  const initial = captureGroup(variant, step, 'first_entry', 0)
  const sameStart = state.setDataSamples.length
  state.activeSample = `${step}.same-draft-return`
  page.onShow()
  const same = captureGroup(variant, step, 'same_draft_return', sameStart)

  const changedStart = state.setDataSamples.length
  const answerId = step === 'basic' ? 'basic.relationship' : 'health.conditions'
  const changedAnswer = step === 'basic' ? 'mother' : ['unknown']
  const mutation = draftStore.setAnswer(answerId, changedAnswer)
  assert.equal(mutation.persistence.ok, true, `${step} synthetic Draft mutation must persist`)
  state.activeSample = `${step}.changed-draft-return`
  page.onShow()
  const changed = captureGroup(variant, step, 'changed_draft_return', changedStart)
  const expected = variant === 'before'
    ? { first: 3, same: 2, changed: 2 }
    : { first: 1, same: 0, changed: 1 }
  assert.equal(initial.setDataCount, expected.first, `${step} first-entry restore update count`)
  assert.equal(same.setDataCount, expected.same, `${step} same-Draft return update count`)
  assert.equal(changed.setDataCount, expected.changed, `${step} changed-Draft return update count`)
  assert.ok(changed.fields.includes(step === 'basic' ? 'relationship' : 'conditions'), `${step} changed Draft field was filtered`)
  return { initial, same, changed }
}

const runBehaviorCases = (variant) => {
  test(`${variant}: changed Draft is reread and persisted for Basic/Health`, () => {
    for (const step of ['basic', 'health']) {
      const page = prepare(variant, step)
      const id = step === 'basic' ? 'basic.relationship' : 'health.conditions'
      const answer = step === 'basic' ? 'mother' : ['unknown']
      assert.equal(draftStore.setAnswer(id, answer).persistence.ok, true)
      page.onShow()
      assert.deepEqual(page.data[step === 'basic' ? 'relationship' : 'conditions'], answer)
      const restoredStore = new draftModule.AssessmentDraftStore()
      assert.deepEqual(clone(restoredStore.getDraft().answers[id]), answer)
      assert.ok(state.storage[storeKeys.draft], 'synthetic Draft was not persisted')
    }
  })

  test(`${variant}: restore clears Basic/Health errors and persistence state`, () => {
    for (const step of ['basic', 'health']) {
      const page = prepare(variant, step)
      page.data.formError = 'synthetic prior error'
      page.data.saveStatus = 'synthetic prior save failure'
      if (step === 'basic') {
        page.data.relationshipError = 'synthetic error'
        page.data.genderError = 'synthetic error'
        page.data.ageError = 'synthetic error'
        page.onShow()
        assert.equal(page.data.relationshipError, '')
        assert.equal(page.data.genderError, '')
        assert.equal(page.data.ageError, '')
      } else {
        page.data.conditionsError = 'synthetic error'
        page.data.recentEventsError = 'synthetic error'
        page.data.rehabilitationNeedError = 'synthetic error'
        page.data.chewingAbilityError = 'synthetic error'
        page.data.swallowingAbilityError = 'synthetic error'
        page.data.persistenceFailed = true
        page.onShow()
        assert.equal(page.data.conditionsError, '')
        assert.equal(page.data.recentEventsError, '')
        assert.equal(page.data.rehabilitationNeedError, '')
        assert.equal(page.data.chewingAbilityError, '')
        assert.equal(page.data.swallowingAbilityError, '')
        assert.equal(page.data.persistenceFailed, false)
      }
      assert.equal(page.data.formError, '')
      assert.notEqual(page.data.saveStatus, 'synthetic prior save failure')
    }
  })

  test(`${variant}: Basic backText follows actual parent, root fallback and deep stack on each show`, () => {
    const page = prepare(variant, 'basic', ['pages/assessment/intro'])
    assert.equal(page.data.backText, '返回评估说明')
    state.pageStack = [{ route: 'pages/home/index' }, page]
    page.onShow()
    assert.equal(page.data.backText, '返回首页')
    state.pageStack = [page]
    page.onShow()
    assert.equal(page.data.backText, '返回评估说明')
    state.pageStack = [
      { route: 'pages/home/index' },
      { route: 'pages/appointment/index' },
      page,
    ]
    page.onShow()
    assert.equal(page.data.backText, '返回上一页')
  })

  test(`${variant}: Health backText follows actual parent, root fallback and deep stack on each show`, () => {
    const page = prepare(variant, 'health', ['pages/assessment/basic'])
    assert.equal(page.data.backText, '返回老人基本情况')
    state.pageStack = [page]
    page.onShow()
    assert.equal(page.data.backText, '返回老人基本情况')
    state.pageStack = [
      { route: 'pages/home/index' },
      { route: 'pages/assessment/basic?source=deep' },
      page,
    ]
    page.onShow()
    assert.equal(page.data.backText, '返回老人基本情况')
  })

  test(`${variant}: Basic required answers, age boundaries and repeated invalid first-error scroll`, () => {
    const page = prepare(variant, 'basic')
    state.setDataSamples.length = 0
    page.onNext()
    page.onNext()
    assert.equal(state.navigationCalls.length, 0)
    assert.equal(state.scrollCalls.length, 2, 'repeated invalid Next must keep first-error scroll callback')
    assert.equal(state.setDataSamples.length, 2, 'Next validation patch must not be filtered')
    assert.ok(page.data.relationshipError)
    page.onAgeInput({ detail: { value: '49' } })
    assert.equal(page.data.ageError, '请输入 50–110 岁的整数')
    assert.equal(draftStore.getDraft().answers['basic.age'], undefined)
    page.onAgeInput({ detail: { value: '50' } })
    assert.equal(draftStore.getDraft().answers['basic.age'], 50)
    page.onAgeInput({ detail: { value: '110' } })
    assert.equal(draftStore.getDraft().answers['basic.age'], 110)
    page.onAgeInput({ detail: { value: '111' } })
    assert.equal(draftStore.getDraft().answers['basic.age'], undefined)
    setBasicAnswers(page, '50')
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
    assert.equal(state.navigationCalls[0].url, '/pages/assessment/health')
  })

  test(`${variant}: Health all five required answers and inline error clearing`, () => {
    const page = prepare(variant, 'health', ['pages/assessment/basic'])
    page.onNext()
    assert.equal(state.navigationCalls.length, 0)
    assert.ok(page.data.conditionsError)
    assert.ok(page.data.recentEventsError)
    assert.ok(page.data.rehabilitationNeedError)
    assert.ok(page.data.chewingAbilityError)
    assert.ok(page.data.swallowingAbilityError)
    page.onConditionsChange({ detail: { values: ['unknown'] } })
    assert.equal(page.data.conditionsError, '')
    assert.equal(page.data.formError, '')
    page.onRecentEventsChange({ detail: { values: ['unknown'] } })
    page.onRehabilitationNeedChange({ detail: { value: 'unknown' } })
    page.onChewingAbilityChange({ detail: { value: 'unknown' } })
    page.onSwallowingAbilityChange({ detail: { value: 'unknown' } })
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
    assert.equal(state.navigationCalls[0].url, '/pages/assessment/adl')
  })

  test(`${variant}: Basic conditional answer cleanup and Health none/unknown exclusivity persist`, () => {
    const basic = prepare(variant, 'basic')
    basic.onExperienceChange({ detail: { value: 'true' } })
    basic.onExitReasonChange({ detail: { values: ['poor_nursing'] } })
    assert.deepEqual(clone(draftStore.getDraft().answers['basic.institutionExitReasons']), ['poor_nursing'])
    basic.onExperienceChange({ detail: { value: 'false' } })
    assert.equal(draftStore.getDraft().answers['basic.institutionExitReasons'], undefined)
    assert.deepEqual(basic.data.institutionExitReasons, [])

    const health = prepare(variant, 'health', ['pages/assessment/basic'])
    health.onConditionsChange({ detail: { values: ['hypertension', 'unknown'] } })
    health.onRecentEventsChange({ detail: { values: ['none', 'fall_within_6_months'] } })
    assert.deepEqual(clone(draftStore.getDraft().answers['health.conditions']), ['unknown'])
    assert.deepEqual(clone(draftStore.getDraft().answers['health.recentEvents']), ['fall_within_6_months'])
  })

  test(`${variant}: Back uses parent/root API without validation or Draft clearing`, () => {
    for (const step of ['basic', 'health']) {
      const parent = step === 'basic' ? 'pages/assessment/intro' : 'pages/assessment/basic'
      const page = prepare(variant, step, [parent])
      assert.equal(draftStore.setAnswer('basic.relationship', 'mother').persistence.ok, true)
      const before = clone(draftStore.getDraft())
      state.navigationCalls.length = 0
      state.scrollCalls.length = 0
      page.onBack()
      assert.deepEqual(state.navigationCalls.map((call) => call.type), ['navigateBack'])
      assert.deepEqual(clone(draftStore.getDraft()), before)
      assert.equal(state.scrollCalls.length, 0)
    }
    const rootPage = prepare(variant, 'basic', [])
    state.navigationCalls.length = 0
    rootPage.onBack()
    assert.deepEqual(state.navigationCalls.map((call) => call.type), ['redirectTo'])
    assert.equal(state.navigationCalls[0].url, '/pages/assessment/intro')
  })

  test(`${variant}: rapid valid Next is guarded and the page can navigate again after onShow`, () => {
    const page = prepare(variant, 'basic')
    setBasicAnswers(page)
    page.onNext()
    page.onNext()
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
    page.onShow()
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 2)
  })

  test(`${variant}: storage failure blocks Next and retry succeeds`, () => {
    const page = prepare(variant, 'basic')
    setBasicAnswers(page)
    state.failWriteKey = storeKeys.pointer
    state.failWriteOnce = true
    page.onNext()
    assert.equal(state.navigationCalls.length, 0)
    assert.match(page.data.formError, /保存失败/)
    assert.match(page.data.saveStatus, /保存失败/)
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
  })

  test(`${variant}: navigation failure releases guard and retry succeeds`, () => {
    const page = prepare(variant, 'basic')
    setBasicAnswers(page)
    state.navigationMode = 'fail-next'
    page.onNext()
    assert.equal(state.navigationCalls.length, 1)
    assert.match(page.data.formError, /暂时无法进入下一步/)
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 2)
  })

  test(`${variant}: Health persistence failure blocks Next until a successful reselection`, () => {
    const page = prepare(variant, 'health', ['pages/assessment/basic'])
    setHealthAnswers(page)
    state.failWriteKey = storeKeys.draft
    state.failWriteOnce = true
    page.onConditionsChange({ detail: { values: ['unknown'] } })
    assert.equal(page.data.persistenceFailed, true)
    page.onNext()
    assert.equal(state.navigationCalls.length, 0)
    assert.match(page.data.formError, /重新选择并保存/)
    page.onConditionsChange({ detail: { values: ['unknown'] } })
    assert.equal(page.data.persistenceFailed, false)
    page.onNext()
    assert.equal(state.navigationCalls.filter((call) => call.type === 'navigateTo').length, 1)
  })

  test(`${variant}: late navigation failure after unload causes no page writes`, () => {
    const page = prepare(variant, 'basic')
    setBasicAnswers(page)
    state.navigationMode = 'deferred'
    page.onNext()
    assert.ok(state.pendingNavigation, 'navigation did not wait for synthetic callback')
    page.onHide()
    page.onUnload()
    state.pageStack = [{ route: 'pages/assessment/health' }]
    const beforeWrites = state.setDataSamples.length
    state.pendingNavigation.fail({ errMsg: 'navigateTo:fail after unload' })
    state.pendingNavigation.complete({ errMsg: 'navigateTo:fail after unload' })
    assert.equal(state.setDataSamples.length, beforeWrites)
    assert.equal(page.data.formError, '')
  })
}

const main = () => {
  const comparison = {}
  for (const variant of ['before', 'after']) {
    comparison[variant] = {
      basic: runPerformanceComparison(variant, 'basic'),
      health: runPerformanceComparison(variant, 'health'),
    }
    runBehaviorCases(variant)
  }

  const report = {
    parser: `TypeScript ${ts.version}`,
    syntheticOnly: true,
    answerValuesRecorded: false,
    comparison,
    cases: results,
    failures,
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (failures.length > 0) process.exitCode = 1
}

main()
