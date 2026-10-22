import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')
const require = createRequire(import.meta.url)

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const makeDraft = (overrides = {}) => ({
  kind: 'assessment_draft',
  schemaVersion: 1,
  localDraftId: 'result-runtime-draft',
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY',
  currentStep: 'budget',
  startedAt: '2026-08-30T08:00:00.000Z',
  updatedAt: '2026-08-30T09:00:00.000Z',
  answers: {
    'basic.relationship': 'father',
    'basic.gender': 'male',
    'basic.age': 72,
    'health.conditions': ['none'],
    'health.recentEvents': ['none'],
    'health.rehabilitationNeed': 'none',
    'adl.eating': 'independent',
    'adl.mobility': 'independent',
    'adl.toileting': 'independent',
    'adl.bathing': 'independent',
    'adl.dressing': 'independent',
    'adl.transfer': 'independent',
    'adl.stairs': 'independent',
    'cognitive.symptoms': ['none'],
    'cognitive.specialCareNeeds': ['tube_feeding'],
    'preference.careType': 'medical_nursing_integrated',
    'preference.priorities': ['price'],
    'budget.monthlyRange': 'cny_5000_8000',
    'budget.upfrontCostAcceptance': 'unknown',
    'budget.moveInTiming': 'research_only',
    'budget.consultantSupport': 'recommendation_first',
    ...overrides,
  },
})

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) return { ts: require(path.resolve(explicitPath)), file: path.resolve(explicitPath) }
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const candidates = []
  if (existsSync(profileRoot)) {
    for (const profile of readdirSync(profileRoot, { withFileTypes: true })) {
      if (!profile.isDirectory()) continue
      const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(packageRoot)) continue
      for (const runtime of readdirSync(packageRoot, { withFileTypes: true })) {
        const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(parserPath)) {
          candidates.push({ file: parserPath, mtime: statSync(parserPath).mtimeMs })
        }
      }
    }
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  assert.ok(candidates.length > 0, 'WeChat TypeScript parser is required')
  return { ts: require(candidates[0].file), file: candidates[0].file }
}

const runtimeState = {
  storage: clone(makeDraft()),
  pageStack: [
    { route: 'pages/assessment/profile' },
    { route: 'pages/recommendation/result' },
  ],
  navigationCalls: [],
  forbiddenCalls: { request: 0, login: 0, phone: 0 },
  navigationModes: { navigateBack: 'success', redirectTo: 'success', switchTab: 'success' },
}

const pageDefinitions = []
const createRuntime = (ts) => {
  const cache = new Map()
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Page: (definition) => { pageDefinitions.push(definition); return definition },
    Component: (definition) => definition,
    getCurrentPages: () => runtimeState.pageStack,
    wx: {},
  })

  const recordNavigation = (type, options) => {
    runtimeState.navigationCalls.push({ type, options })
    const mode = runtimeState.navigationModes[type] || 'success'
    if (mode === 'fail') {
      if (options.fail) options.fail({ errMsg: `${type}:fail` })
      if (options.complete) options.complete({ errMsg: `${type}:fail` })
      return
    }
    if (options.success) options.success({})
    if (options.complete) options.complete({})
  }

  context.wx = {
    getStorageSync: () => clone(runtimeState.storage),
    setStorageSync: () => {},
    removeStorageSync: () => {},
    navigateBack: (options) => recordNavigation('navigateBack', options),
    redirectTo: (options) => recordNavigation('redirectTo', options),
    switchTab: (options) => recordNavigation('switchTab', options),
    request: () => { runtimeState.forbiddenCalls.request += 1; throw new Error('wx.request forbidden') },
    login: () => { runtimeState.forbiddenCalls.login += 1; throw new Error('wx.login forbidden') },
    getPhoneNumber: () => { runtimeState.forbiddenCalls.phone += 1; throw new Error('phone authorization forbidden') },
  }

  const resolveModule = (requestPath, importer) => {
    const base = path.resolve(path.dirname(importer), requestPath)
    const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts')]
    const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    assert.ok(resolved, `Cannot resolve ${requestPath} from ${importer}`)
    return resolved
  }

  const load = (filePath) => {
    const resolved = path.resolve(filePath)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = ts.transpileModule(source, {
      fileName: resolved,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
      },
    })
    const diagnostics = (output.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error)
    assert.equal(diagnostics.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (requestPath) => {
      assert.ok(requestPath.startsWith('.'), `external runtime import ${requestPath}`)
      return load(resolveModule(requestPath, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire,
      module,
      module.exports,
    )
    return module.exports
  }
  return { load }
}

const { ts } = loadWechatTypeScript()
const runtime = createRuntime(ts)
const serviceModule = runtime.load(path.join(appRoot, 'services', 'recommendation-preview.ts'))
const institutionCatalogModule = runtime.load(path.join(appRoot, 'services', 'institution-catalog.ts'))
const storeModule = runtime.load(path.join(appRoot, 'store', 'assessment-draft.ts'))
const viewModelModule = runtime.load(path.join(appRoot, 'pages', 'recommendation', 'result-view-model.ts'))
runtime.load(path.join(appRoot, 'pages', 'recommendation', 'result.ts'))
assert.equal(pageDefinitions.length, 1, 'result page registers once')
const pageDefinition = pageDefinitions[0]
const draftStore = storeModule.assessmentDraftStore
const originalGetDraft = draftStore.getDraft
const originalBuildSnapshot = serviceModule.buildRecommendationResultSnapshot

const mountPage = () => {
  const instance = {
    data: clone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) },
  }
  Object.keys(pageDefinition).forEach((key) => {
    if (typeof pageDefinition[key] === 'function') instance[key] = pageDefinition[key].bind(instance)
  })
  return instance
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const setDraft = (draft) => {
  draftStore.getDraft = () => clone(draft)
}

const resetRuntime = () => {
  setDraft(makeDraft())
  runtimeState.navigationCalls.length = 0
  runtimeState.forbiddenCalls.request = 0
  runtimeState.forbiddenCalls.login = 0
  runtimeState.forbiddenCalls.phone = 0
  runtimeState.navigationModes.navigateBack = 'success'
  runtimeState.navigationModes.redirectTo = 'success'
  runtimeState.navigationModes.switchTab = 'success'
  runtimeState.pageStack = [
    { route: 'pages/assessment/profile' },
    { route: 'pages/recommendation/result' },
  ]
  runtimeState.storage = clone(makeDraft())
}

const getSnapshot = async () => {
  const result = await originalBuildSnapshot({ evaluationAsOf: '2026-08-31T12:00:00.000Z' })
  assert.equal(result.ok, true, `base snapshot failed: ${result.ok ? '' : result.error.code}`)
  return result.value
}

const firstCandidate = (snapshot) => {
  const item = snapshot.preview.semantics.candidateEvaluations[0]
  assert.ok(item, 'runtime fixture must include a candidate evaluation')
  return item
}

const recordForItem = (snapshot, item) => {
  const record = snapshot.institutionRecords.find((candidate) =>
    candidate.institutionId === item.institutionId && candidate.recordRevision === item.recordRevision)
  assert.ok(record, `runtime fixture is missing ${item.institutionId}@${item.recordRevision}`)
  return record
}

const itemForRecord = (item, record, matchTier = 'EXACT') => ({
  ...clone(item),
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  matchTier,
})

const snapshotWithItems = (
  snapshot,
  items,
  exactMatch,
  conditionalCandidates = [],
) => {
  const next = clone(snapshot)
  next.preview.semantics.items = items
  next.preview.semantics.candidateEvaluations = items.concat(conditionalCandidates)
  next.preview.semantics.conditionalCandidates = conditionalCandidates
  next.preview.semantics.exactMatch = exactMatch
  return next
}

const customCatalogService = (payload) => institutionCatalogModule.createInstitutionCatalogService({
  loadCatalog: async () => clone(payload),
})

const buildWithCatalog = async (catalogService, draft = makeDraft()) => {
  const service = serviceModule.createRecommendationPreviewService({
    readDraftSnapshot: () => clone(draft),
    catalogService,
  })
  return service.buildRecommendationResultSnapshot({ evaluationAsOf: '2026-08-31T12:00:00.000Z' })
}

const runCase = async (id, description, fn) => {
  let assertions = 0
  const check = {
    equal: (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message) },
    deepEqual: (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message) },
    ok: (value, message) => { assertions += 1; assert.ok(value, message) },
    notEqual: (actual, expected, message) => { assertions += 1; assert.notEqual(actual, expected, message) },
    throws: (fn, expected, message) => { assertions += 1; assert.throws(fn, expected, message) },
  }
  try {
    resetRuntime()
    await fn(check)
    assert.ok(assertions >= 2, `${id} must have at least two assertions`)
    console.log(`PASS ${id} ${description} (${assertions} assertions)`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`FAIL ${id} ${description}: ${message}`)
    return `${id}: ${message}`
  }
}

const failures = []

failures.push(await runCase('RESULT-001', 'valid exact result is ready', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const exact = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  const vm = viewModelModule.createRecommendationResultViewModel(exact)
  c.equal(vm.state, 'ready_exact')
  c.equal(vm.cards.length, 1)
}))

failures.push(await runCase('RESULT-002', 'one exact candidate renders one card', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const vm = viewModelModule.createRecommendationResultViewModel(
    snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true),
  )
  c.equal(vm.cards.length, 1)
  c.equal(vm.cards[0].institutionId, record.institutionId)
  const missingSource = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  missingSource.institutionRecords = missingSource.institutionRecords.filter(
    (candidate) => candidate.institutionId !== record.institutionId,
  )
  c.throws(
    () => viewModelModule.createRecommendationResultViewModel(missingSource),
    /RECOMMENDATION_RESULT_INSTITUTION_SOURCE_MISSING/,
  )
}))

failures.push(await runCase('RESULT-003', 'two safe candidates render two cards', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const records = value.institutionRecords.slice(0, 2)
  const items = records.map((record) => itemForRecord(baseItem, record, 'EXACT'))
  const vm = viewModelModule.createRecommendationResultViewModel(snapshotWithItems(value, items, true))
  c.equal(vm.cards.length, 2)
  c.deepEqual(vm.cards.map((card) => card.institutionId), records.map((record) => record.institutionId))
}))

failures.push(await runCase('RESULT-004', 'SoftNear is a no-exact result with differences', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const difference = {
    differenceCode: 'BUDGET_ABOVE_RANGE',
    differenceCategory: 'SOFT_DIFFERENCE',
    differenceType: 'budget',
    severity: 'important',
    elderEvidenceRefs: [],
    institutionEvidenceRefs: [],
  }
  const nearItem = { ...itemForRecord(baseItem, record, 'SOFT_NEAR'), differences: [difference] }
  const soft = snapshotWithItems(value, [nearItem], false)
  soft.preview.semantics.noExactMatch = {
    ...(soft.preview.semantics.noExactMatch || {}),
    code: 'NO_EXACT_MATCH',
    reasonCode: 'ONLY_SOFT_NEAR_MATCHES',
    nearMatches: [nearItem],
    differences: [difference],
    unmetHardRequirements: [],
    unverifiedRequirements: [],
    elderClarifications: [],
  }
  const vm = viewModelModule.createRecommendationResultViewModel(soft)
  c.equal(vm.state, 'ready_soft_near')
  c.equal(vm.headline, '暂时没有完全符合全部偏好条件的已收录机构')
  c.ok(vm.cards[0].differences.length > 0)
}))

failures.push(await runCase('RESULT-005', 'conditional-only candidates stay in a separate section', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const conditionalItem = itemForRecord(baseItem, record, 'CONDITIONAL')
  const conditional = snapshotWithItems(value, [], false, [conditionalItem])
  const vm = viewModelModule.createRecommendationResultViewModel(conditional)
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(vm.state, 'ready_conditional')
  c.equal(vm.cards.length, 0)
  c.equal(vm.conditionalCards.length, 1)
  c.ok(source.includes('需要进一步评估的机构'))
}))

failures.push(await runCase('RESULT-006', 'unverified candidate never becomes a card', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const vm = viewModelModule.createRecommendationResultViewModel(
    snapshotWithItems(value, [itemForRecord(baseItem, record, 'UNVERIFIED')], false),
  )
  c.equal(vm.cards.length, 0)
  c.equal(vm.conditionalCards.length, 0)
}))

failures.push(await runCase('RESULT-007', 'ineligible candidate never becomes a card', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const vm = viewModelModule.createRecommendationResultViewModel(
    snapshotWithItems(value, [itemForRecord(baseItem, record, 'INELIGIBLE')], false),
  )
  c.equal(vm.cards.length, 0)
  c.equal(vm.conditionalCards.length, 0)
}))

failures.push(await runCase('RESULT-008', 'no safe candidate renders the safety empty state', async (c) => {
  const value = await getSnapshot()
  const empty = snapshotWithItems(value, [], false)
  empty.preview.semantics.noExactMatch = {
    ...(empty.preview.semantics.noExactMatch || {}),
    code: 'NO_EXACT_MATCH',
    reasonCode: 'NO_VERIFIED_INSTITUTION_POOL',
    nearMatches: [],
    differences: [],
    unmetHardRequirements: [],
    unverifiedRequirements: [],
    elderClarifications: [],
  }
  const vm = viewModelModule.createRecommendationResultViewModel(empty)
  c.equal(vm.state, 'no_safe_recommendation')
  c.equal(vm.cards.length + vm.conditionalCards.length, 0)
}))

failures.push(await runCase('RESULT-009', 'development Mock data disclosure is visible', async (c) => {
  const value = await getSnapshot()
  const vm = viewModelModule.createRecommendationResultViewModel(value)
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(value.datasetMode, 'MOCK_DEVELOPMENT_ONLY')
  c.equal(vm.hasMockDisclosure, true)
  c.ok(source.includes('开发演示数据') && source.includes('不代表真实合作机构信息'))
}))

failures.push(await runCase('RESULT-010', 'result copy has no percentage or score display', async (c) => {
  const wxml = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  const vmSource = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result-view-model.ts'), 'utf8')
  c.equal(/匹配度|概率|AI推荐|AI 推荐|评分/.test(wxml + vmSource), false)
  c.equal(/\{\{[^}]*percentage|\{\{[^}]*score/i.test(wxml), false)
}))

failures.push(await runCase('RESULT-011', 'reasons are rendered only from Domain reason entries', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  c.ok(baseItem.reasons.length > 0, 'fixture must include a Domain reason')
  const item = { ...itemForRecord(baseItem, record, 'EXACT'), reasons: [baseItem.reasons[0]] }
  const vm = viewModelModule.createRecommendationResultViewModel(snapshotWithItems(value, [item], true))
  c.equal(vm.cards[0].reasons.length, item.reasons.length)
  c.equal(vm.cards[0].reasons.some((reason) => /evidence|fieldPath|ruleId|ev:/.test(reason.text)), false)
}))

failures.push(await runCase('RESULT-012', 'difference entries map to readable difference text', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const difference = {
    differenceCode: 'BUDGET_ABOVE_RANGE',
    differenceCategory: 'SOFT_DIFFERENCE',
    differenceType: 'budget',
    severity: 'important',
    elderEvidenceRefs: [],
    institutionEvidenceRefs: [],
  }
  const item = { ...itemForRecord(baseItem, record, 'SOFT_NEAR'), differences: [difference] }
  const vm = viewModelModule.createRecommendationResultViewModel(snapshotWithItems(value, [item], false))
  c.equal(vm.cards[0].differences.length, item.differences.length)
  c.equal(vm.cards[0].differences[0].text, '偏好差异：参考费用高于当前预算范围')
}))

failures.push(await runCase('RESULT-013', 'unknown price is displayed as not provided', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const input = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  const matchedRecord = recordForItem(input, input.preview.semantics.items[0])
  matchedRecord.price.referenceMonthlyPrice = {
    availability: 'provided',
    value: {
      basis: 'reference_total',
      range: {
        kind: 'bounded',
        min: { amountMinor: 560000, currency: 'CNY' },
        max: { amountMinor: 760000, currency: 'CNY' },
        period: 'month',
      },
    },
    verification: { status: 'unverified', evidenceIds: [] },
  }
  const vm = viewModelModule.createRecommendationResultViewModel(input)
  c.equal(vm.cards[0].price, '参考费用暂未提供')
  c.equal(vm.cards[0].price.includes('0'), false)
}))

failures.push(await runCase('RESULT-014', 'starting_at price keeps the start marker and period', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const input = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  const matchedRecord = recordForItem(input, input.preview.semantics.items[0])
  matchedRecord.price.referenceMonthlyPrice = {
    availability: 'provided',
    value: {
      basis: 'reference_total',
      range: {
        kind: 'starting_at',
        min: { amountMinor: 480000, currency: 'CNY' },
        max: null,
        period: 'month',
      },
    },
    verification: { status: 'verified', evidenceIds: ['result-runtime-price'] },
  }
  const vm = viewModelModule.createRecommendationResultViewModel(input)
  c.ok(vm.cards[0].price.includes('起'))
  c.ok(vm.cards[0].price.includes('/ 月'))
}))

failures.push(await runCase('RESULT-015', 'availability remains an advisory only', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const input = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  input.advisories = [{
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    advisoryCode: 'AVAILABILITY_DISPLAY_ONLY',
    advisoryCategory: 'OPERATIONAL_ADVISORY',
    severity: 'advisory',
    elderEvidenceRefs: [],
    advisoryEvidenceRefs: [],
  }]
  const vm = viewModelModule.createRecommendationResultViewModel(input)
  c.ok(vm.cards[0].advisories.includes('当前床位：需咨询'))
  c.equal(vm.state, 'ready_exact')
}))

failures.push(await runCase('RESULT-016', 'unavailable VR has no CTA', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const input = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  const vm = viewModelModule.createRecommendationResultViewModel(input)
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(vm.cards.some((card) => card.vrLabel.length > 0), false)
  c.ok(source.includes('wx:if="{{item.vrLabel}}"'))
  c.equal(source.includes('bind:action="onViewVr"'), false)
  c.equal(source.includes('pages/institution/vr'), false)
}))

failures.push(await runCase('RESULT-017', 'missing media never introduces an invented photo', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const record = recordForItem(value, baseItem)
  const input = snapshotWithItems(value, [itemForRecord(baseItem, record, 'EXACT')], true)
  const matchedRecord = recordForItem(input, input.preview.semantics.items[0])
  matchedRecord.media = []
  const vm = viewModelModule.createRecommendationResultViewModel(input)
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(vm.cards[0].hasCover, false)
  c.equal(vm.cards[0].coverUrl, '')
  c.equal(source.includes('<image'), false)
}))

failures.push(await runCase('RESULT-018', 'incomplete assessment exposes error and recovery actions', async (c) => {
  const page = mountPage()
  setDraft(makeDraft({ 'basic.age': undefined }))
  page.onShow()
  await flush()
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(page.data.pageState, 'assessment_error')
  c.ok(source.includes('重新生成推荐') && source.includes('调整老人需求'))
  setDraft(makeDraft())
  page.onRetry()
  await flush()
  c.equal(page.data.pageState === 'assessment_error', false)
}))

failures.push(await runCase('RESULT-019', 'invalid catalog is rejected before recommendation output', async (c) => {
  const result = await buildWithCatalog(customCatalogService({
    datasetVersion: 'result-runtime-invalid',
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    records: [{}],
  }))
  c.equal(result.ok, false)
  c.equal(result.error.code, 'INVALID_INSTITUTION_RECORD')
}))

failures.push(await runCase('RESULT-020', 'empty catalog has a stable empty error', async (c) => {
  const result = await buildWithCatalog(customCatalogService({
    datasetVersion: 'result-runtime-empty',
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    records: [],
  }))
  c.equal(result.ok, false)
  c.equal(result.error.code, 'NO_INSTITUTIONS_AVAILABLE')
}))

failures.push(await runCase('RESULT-021', 'onShow re-evaluates the latest snapshot', async (c) => {
  const first = await getSnapshot()
  const second = clone(first)
  second.preview.semantics.exactMatch = false
  second.preview.semantics.items = []
  second.preview.semantics.conditionalCandidates = []
  second.preview.semantics.noExactMatch = {
    ...(second.preview.semantics.noExactMatch || {}),
    code: 'NO_EXACT_MATCH',
    reasonCode: 'NO_VERIFIED_INSTITUTION_POOL',
    nearMatches: [],
    differences: [],
    unmetHardRequirements: [],
    unverifiedRequirements: [],
    elderClarifications: [],
  }
  const original = serviceModule.buildRecommendationResultSnapshot
  let calls = 0
  serviceModule.buildRecommendationResultSnapshot = () => {
    calls += 1
    return Promise.resolve({ ok: true, value: calls === 1 ? first : second })
  }
  try {
    const page = mountPage()
    page.onShow()
    await flush()
    const firstState = page.data.pageState
    page.onShow()
    await flush()
    c.equal(calls, 2)
    c.notEqual(page.data.pageState, firstState)
  } finally {
    serviceModule.buildRecommendationResultSnapshot = original
  }
}))

failures.push(await runCase('RESULT-022', 'changed Assessment Draft produces a fresh result', async (c) => {
  const firstDraft = makeDraft({ 'preference.careType': 'medical_nursing_integrated' })
  const secondDraft = makeDraft({ 'preference.careType': 'active_aging' })
  setDraft(firstDraft)
  const first = await originalBuildSnapshot({ evaluationAsOf: '2026-08-31T12:00:00.000Z' })
  setDraft(secondDraft)
  const second = await originalBuildSnapshot({ evaluationAsOf: '2026-08-31T12:00:00.000Z' })
  c.equal(first.ok, true)
  c.equal(second.ok, true)
  c.notEqual(
    JSON.stringify(first.value.preview.semantics.elderSnapshot.preference),
    JSON.stringify(second.value.preview.semantics.elderSnapshot.preference),
  )
}))

failures.push(await runCase('RESULT-023', 'rapid Back and CTA taps navigate once each', async (c) => {
  const page = mountPage()
  page.onAdjustNeeds()
  page.onAdjustNeeds()
  page.onConsultant()
  page.onConsultant()
  c.equal(runtimeState.navigationCalls.filter((item) => item.type === 'navigateBack').length, 1)
  c.equal(runtimeState.navigationCalls.filter((item) => item.type === 'switchTab').length, 1)
}))

failures.push(await runCase('RESULT-024', 'result flow never invokes wx.login', async (c) => {
  await getSnapshot()
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.ts'), 'utf8')
  c.equal(runtimeState.forbiddenCalls.login, 0)
  c.equal(/wx\.login|login\(/.test(source), false)
}))

failures.push(await runCase('RESULT-025', 'result flow never invokes phone authorization', async (c) => {
  await getSnapshot()
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  c.equal(runtimeState.forbiddenCalls.phone, 0)
  c.equal(/getPhoneNumber|手机号/.test(source), false)
}))

failures.push(await runCase('RESULT-026', 'result flow never invokes wx.request', async (c) => {
  await getSnapshot()
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.ts'), 'utf8')
  c.equal(runtimeState.forbiddenCalls.request, 0)
  c.equal(/wx\.request|request\(/.test(source), false)
}))

failures.push(await runCase('RESULT-027', 'application code does not import test fixtures', async (c) => {
  const sourceFiles = []
  const visit = (directory) => {
    readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(entryPath)
      } else if (/\.(ts|js)$/.test(entry.name)) {
        sourceFiles.push(entryPath)
      }
    })
  }
  visit(appRoot)
  const importedFixtureFiles = sourceFiles.filter((file) => /scripts[\\/]fixtures/.test(readFileSync(file, 'utf8')))
  c.equal(importedFixtureFiles.length, 0)
  c.ok(sourceFiles.some((file) => file.endsWith(path.join('recommendation', 'result.ts'))))
}))

failures.push(await runCase('RESULT-028', 'Detail navigation releases only through a V2 canonical source context', async (c) => {
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  const pageSource = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.ts'), 'utf8')
  c.ok(source.includes('bindtap="onRecommendationCardTap"'))
  c.ok(pageSource.includes('registerInstitutionRecommendationSourceContextV2'))
  c.ok(pageSource.includes('serializeInstitutionDetailRoute'))
  c.ok(pageSource.includes("'recommendation'"))
  c.ok(pageSource.includes('当前推荐资料已失效，请重新生成后再查看详情'))
  c.equal(/detail\?id=|[?&]id=/.test(source + pageSource), false)
}))

failures.push(await runCase('RESULT-029', 'List navigation shares the current V2 source context and keeps V1 safe', async (c) => {
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.wxml'), 'utf8')
  const pageSource = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result.ts'), 'utf8')
  c.ok(source.includes('bindtap="onBrowseDirectory"'))
  c.ok(pageSource.includes('/pages/institution/index?sourceContextRef='))
  c.ok(pageSource.includes('resultSnapshots.get(this)'))
  c.ok(pageSource.includes('本次候选列表已失效'))
}))

failures.push(await runCase('RESULT-030', 'ViewModel preserves Domain ranking order', async (c) => {
  const value = await getSnapshot()
  const baseItem = firstCandidate(value)
  const records = value.institutionRecords.slice(0, 3)
  const items = records.map((record) => itemForRecord(baseItem, record, 'SOFT_NEAR'))
  const ordered = snapshotWithItems(value, items, false)
  const vm = viewModelModule.createRecommendationResultViewModel(ordered)
  const source = readFileSync(path.join(appRoot, 'pages', 'recommendation', 'result-view-model.ts'), 'utf8')
  c.deepEqual(vm.cards.map((card) => card.institutionId), items.map((item) => item.institutionId))
  c.equal(vm.cards.length, 3)
  c.equal(/\.sort\s*\(/.test(source), false)
  c.equal(/sourceItems\.slice\s*\(/.test(source), false)
  c.equal(/conditionalCandidates\.slice\s*\(/.test(source), false)
}))

const failed = failures.filter(Boolean)
console.log(`RESULT_CASES: ${failures.length}`)
if (failed.length > 0) {
  console.error(`RESULT_RUNTIME_FAILURES: ${failed.length}`)
  failed.forEach((failure) => console.error(failure))
  process.exitCode = 1
} else {
  console.log('RECOMMENDATION_RESULT_PAGE_RUNTIME = PASS')
}
