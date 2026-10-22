import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  makeProfileV2UiDraft,
  PROFILE_V2_UI_CASES,
  PROFILE_V2_UI_FIXTURES,
  PROFILE_V2_UI_FIXTURE_MANIFEST,
} from './fixtures/profile-v2-ui-fixtures.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'miniprogram')

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const makeDraft = (fixture, overrides = {}, draftOverrides = {}) =>
  makeProfileV2UiDraft({ ...(fixture ? fixture.answers : {}), ...overrides }, draftOverrides)

const loadWechatTypeScript = () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const file = path.resolve(explicitPath)
    assert.ok(existsSync(file), `WECHAT_TYPESCRIPT_PATH does not exist: ${file}`)
    const ts = require(file)
    assert.equal(ts.version, '4.1.2', `expected WeChat TypeScript 4.1.2, got ${ts.version}`)
    return { ts, file }
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'User Data')
  const candidates = []
  if (existsSync(profileRoot)) {
    readdirSync(profileRoot, { withFileTypes: true }).forEach((profile) => {
      if (!profile.isDirectory()) return
      const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
      if (!existsSync(packageRoot)) return
      readdirSync(packageRoot, { withFileTypes: true }).forEach((runtime) => {
        const file = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
        if (runtime.isDirectory() && existsSync(file)) candidates.push({ file, mtime: statSync(file).mtimeMs })
      })
    })
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  const selected = candidates.find((candidate) => require(candidate.file).version === '4.1.2')
  assert.ok(selected, 'WeChat TypeScript 4.1.2 parser is required')
  return { ts: require(selected.file), file: selected.file }
}

const createRuntime = (typescript, storageSeed = {}) => {
  const cache = new Map()
  const storage = clone(storageSeed)
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    wx: {
      getStorageSync: (key) => clone(Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : ''),
      setStorageSync: () => { throw new Error('storage writes are forbidden') },
      removeStorageSync: () => { throw new Error('storage writes are forbidden') },
    },
  })
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.js')]
    const resolved = candidates.find((file) => existsSync(file) && statSync(file).isFile())
    assert.ok(resolved, `cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (file) => {
    const resolved = path.resolve(file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    if (resolved.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
    const output = resolved.endsWith('.ts')
      ? typescript.transpileModule(source, {
        fileName: resolved,
        reportDiagnostics: true,
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          strict: true,
        },
      })
      : { outputText: source, diagnostics: [] }
    const diagnostics = (output.diagnostics || []).filter((item) => item.category === typescript.DiagnosticCategory.Error)
    assert.equal(diagnostics.length, 0, `${resolved}: TypeScript diagnostics`)
    const localRequire = (request) => {
      assert.ok(request.startsWith('.'), `external runtime import: ${request}`)
      return load(resolve(request, resolved))
    }
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: resolved })(
      localRequire, module, module.exports,
    )
    return module.exports
  }
  return { load }
}

const containsForbiddenIdentity = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)
  const forbidden = ['assessmentId', 'elderId', 'recommendationId', 'previewId', 'completedAt', 'generatedAt']
  if (Object.keys(value).some((key) => forbidden.includes(key))) return true
  return Object.values(value).some((child) => containsForbiddenIdentity(child, seen))
}

const findRow = (rows, label) => rows.find((item) => item.label === label)

const failures = []
const executed = []

const run = async (id, description, fn) => {
  assert.ok(PROFILE_V2_UI_CASES.includes(id), `unexpected profile fixture ${id}`)
  assert.ok(!executed.includes(id), `duplicate profile fixture ${id}`)
  let assertions = 0
  const check = {
    equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message) },
    deepEqual(actual, expected, message) { assertions += 1; assert.deepEqual(actual, expected, message) },
    ok(value, message) { assertions += 1; assert.ok(value, message) },
  }
  try {
    await fn(check)
    assert.ok(assertions >= PROFILE_V2_UI_FIXTURE_MANIFEST.minimumAssertionsPerCase,
      `${id} must have at least ${PROFILE_V2_UI_FIXTURE_MANIFEST.minimumAssertionsPerCase} assertions`)
    executed.push(id)
    console.log(`PASS ${id} ${description} (${assertions} assertions)`)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    console.error(`FAIL ${id} ${description}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const main = async () => {
  const { ts, file: parserFile } = loadWechatTypeScript()
  const runtime = createRuntime(ts)
  const serviceModule = runtime.load(path.join(appRoot, 'services', 'profile-application-v2.ts'))
  const vmModule = runtime.load(path.join(appRoot, 'pages', 'assessment', 'profile-v2-view-model.ts'))
  const profileSource = readFileSync(path.join(appRoot, 'pages', 'assessment', 'profile.ts'), 'utf8')

  const build = (fixture = PROFILE_V2_UI_FIXTURES.normal, overrides = {}, draftOverrides = {}) =>
    serviceModule.createProfileApplicationServiceV2({
      draftSource: { getDraft: () => clone(makeDraft(fixture, overrides, draftOverrides)) },
    }).build()

  await run('PROFILE-UI-V2-001', 'normal nutrition and swallowing facts remain explicit', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.normal)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.ok, true)
    c.equal(result.value.displayState, 'ready')
    c.equal(result.value.preview.nutrition.derivedFacts.foodTextureSupport.value, 'standard')
    c.equal(result.value.preview.nutrition.derivedFacts.swallowingConcern.value, 'normal')
    c.equal(findRow(viewModel.nutritionRows, '饮食适配').value, '咀嚼情况正常')
    c.equal(findRow(viewModel.nutritionRows, '吞咽情况').value, '吞咽情况正常')
    c.equal(viewModel.clarifications.length, 0, JSON.stringify(viewModel.clarifications))
  })

  await run('PROFILE-UI-V2-002', 'easy-chew answer maps to a lifestyle adaptation row', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.easyChew)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.nutrition.derivedFacts.foodTextureSupport.value, 'easy_chew')
    c.equal(findRow(viewModel.nutritionRows, '饮食适配').value, '更适合软食、易咀嚼食物')
    c.equal(viewModel.specialCareTags.some((tag) => tag.text.includes('鼻饲')), false)
  })

  await run('PROFILE-UI-V2-003', 'modified-food answer never becomes tube feeding', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.modifiedFood)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.nutrition.derivedFacts.foodTextureSupport.value, 'modified_food')
    c.equal(findRow(viewModel.nutritionRows, '饮食适配').value, '需要特殊处理的饮食形式')
    c.equal(viewModel.nutritionRows.some((row) => row.value.includes('鼻饲')), false)
    c.equal(viewModel.specialCareTags.some((tag) => tag.text.includes('鼻饲')), false)
  })

  await run('PROFILE-UI-V2-004', 'swallowing risk is shown as a clarification', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.swallowClarification)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.nutrition.derivedFacts.swallowingConcern.status, 'needs_confirmation')
    c.ok(result.value.preview.clarifications.some((item) => item.reasonCode === 'risk_signal_needs_confirmation'))
    c.equal(findRow(viewModel.nutritionRows, '吞咽情况').value, '吞咽情况需要进一步确认')
    c.ok(viewModel.clarifications.some((item) => item.editSection === 'health' && item.text.includes('吞咽')))
    c.equal(viewModel.specialCareTags.some((tag) => tag.text.includes('鼻饲')), false)
  })

  await run('PROFILE-UI-V2-005', 'room preference is consumed from the V2 preference facts', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.room)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.preference.rawFacts.roomTypePreference, 'double')
    c.equal(findRow(viewModel.preferenceRows, '房型偏好').value, '双人间')
    c.equal(viewModel.preferenceRows.filter((row) => row.label === '房型偏好').length, 1)
  })

  await run('PROFILE-UI-V2-006', 'meal preference is shown with its stable label', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.meal)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.preference.rawFacts.mealSchedulePreference, 'three_meals_two_snacks')
    c.equal(findRow(viewModel.preferenceRows, '餐次偏好').value, '一日三餐加两次加餐')
    c.equal(viewModel.preferenceRows.filter((row) => row.label === '餐次偏好').length, 1)
  })

  await run('PROFILE-UI-V2-007', 'activity preference remains a user preference fact', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.activity)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.preference.rawFacts.activityPreference, 'outdoor')
    c.equal(findRow(viewModel.preferenceRows, '活动偏好').value, '室外活动')
    c.equal(viewModel.preferenceRows.some((row) => row.value.includes('匹配度') || row.value.includes('评分')), false)
  })

  await run('PROFILE-UI-V2-008', 'three V2 priorities stay three user-focus labels', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.priorities)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    const priorityRow = findRow(viewModel.preferenceRows, '关注重点')
    c.deepEqual(result.value.preview.preference.rawFacts.priorities,
      ['price', 'rehabilitation_capability', 'transportation'])
    c.ok(priorityRow.value.includes('价格'))
    c.ok(priorityRow.value.includes('康复能力'))
    c.ok(priorityRow.value.includes('交通方便'))
    c.equal(priorityRow.value.split('、').length, 3)
  })

  await run('PROFILE-UI-V2-009', 'high-care low-budget advisory is consumed once', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.budgetAdvisory)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.value.preview.financial.derivedFacts.budgetAdvisories.length, 1)
    c.equal(result.value.preview.financial.derivedFacts.budgetAdvisories[0].code, 'HIGH_CARE_LOW_BUDGET')
    c.equal(viewModel.budgetAdvisory.code, 'HIGH_CARE_LOW_BUDGET')
    c.equal(viewModel.financialRows.filter((row) => row.value.includes('建议预留')).length, 0)
    c.equal(viewModel.budgetAdvisory.tone, 'warning')
  })

  await run('PROFILE-UI-V2-010', 'ViewModel renders supplied Domain facts without recomputing them', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.normal)
    const preview = clone(result.value.preview)
    preview.adl.derivedFacts.careLevel.value = 'disabled'
    preview.nutrition.derivedFacts.foodTextureSupport.value = 'easy_chew'
    const viewModel = vmModule.createProfilePageViewModelV2(preview)
    c.equal(findRow(viewModel.dailyRows, '照护等级').value, '失能')
    c.equal(findRow(viewModel.nutritionRows, '饮食适配').value, '更适合软食、易咀嚼食物')
    c.equal(findRow(viewModel.basicRows, '性别与年龄').value, '男 · 72 岁')
  })

  await run('PROFILE-UI-V2-011', 'snapshot and ViewModel do not invent formal identity', async (c) => {
    const result = build(PROFILE_V2_UI_FIXTURES.normal)
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(containsForbiddenIdentity(result.value), false)
    c.equal(containsForbiddenIdentity(viewModel), false)
    c.equal(Object.prototype.hasOwnProperty.call(viewModel, 'localDraftId'), false)
    c.equal(JSON.stringify(viewModel).includes('evidenceId'), false)
  })

  await run('PROFILE-UI-V2-012', 'live V2 dispatcher does not fall back to V1', async (c) => {
    const draft = makeDraft(PROFILE_V2_UI_FIXTURES.easyChew)
    const dispatcherRuntime = createRuntime(ts, {
      'wuhan-eldercare-match.assessment-draft.v2': draft,
      'wuhan-eldercare-match.assessment-draft.v1': '',
      'wuhan-eldercare-match.assessment-draft.active': 'v2',
    })
    const dispatcher = dispatcherRuntime.load(path.join(appRoot, 'services', 'profile-application-v2.ts'))
    const result = dispatcher.buildProfileApplicationSnapshot()
    const viewModel = vmModule.createProfilePageViewModelV2(result.value.preview)
    c.equal(result.ok, true)
    c.equal(result.version, 2)
    c.equal(result.value.kind, 'profile_application_snapshot_v2')
    c.equal(result.value.preview.nutrition.derivedFacts.foodTextureSupport.value, 'easy_chew')
    c.equal(findRow(viewModel.nutritionRows, '饮食适配').value, '更适合软食、易咀嚼食物')
    c.ok(profileSource.includes('result.version === 2'))
    c.ok(profileSource.includes('createProfilePageViewModelV2'))
  })

  assert.deepEqual(executed, PROFILE_V2_UI_CASES)
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure))
    throw new Error(`${failures.length} Profile V2 UI runtime case(s) failed`)
  }
  console.log(`PARSER: WeChat TypeScript 4.1.2 (${parserFile})`)
  console.log(`PROFILE_V2_UI_CASES: ${executed.length}/${PROFILE_V2_UI_FIXTURE_MANIFEST.caseCount} PASS`)
  console.log(`PROFILE_V2_UI_REQUIRED_QUESTIONS: ${PROFILE_V2_UI_FIXTURE_MANIFEST.requiredQuestionCount}`)
  console.log('PROFILE_V2_UI_NO_PERSISTENCE: PASS')
  console.log('PROFILE_V2_UI_RUNTIME = PASS')
}

main().catch((error) => {
  console.error('PROFILE_V2_UI_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
