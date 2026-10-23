/** Scoped page-handler tests; in-memory wx navigation is not Android gesture evidence. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const { ts } = loadWechatTypeScript()
const calls = { push: [], tab: [], back: [], toast: [], phone: [], launch: [] }
let definition
let stack = []
let throwNavigation = false
const wx = {
  navigateTo(options) {
    if (throwNavigation) throw new Error('TEST_ONLY navigation exception')
    calls.push.push(options)
  },
  switchTab: (options) => calls.tab.push(options),
  navigateBack: (options) => calls.back.push(options),
  reLaunch: (options) => calls.launch.push(options),
  showToast: (options) => calls.toast.push(options),
  makePhoneCall: (options) => calls.phone.push(options),
  getStorageSync: () => undefined,
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
}
const runtime = createWechatTsRuntime(ts, {
  wx,
  Page: (value) => { definition = value },
  Component: (value) => { definition = value },
  getCurrentPages: () => stack,
})
const make = (value, route) => ({
  ...value, ...value.methods, route,
  data: JSON.parse(JSON.stringify(value.data || {})),
  setData(patch) { Object.assign(this.data, patch) },
})
const load = (file) => { runtime.load(path.join(root, 'miniprogram', file)); return definition }
const flush = async () => { for (let index = 0; index < 5; index++) await new Promise(resolve => setTimeout(resolve, 0)) }
const show = (page) => {
  if (page.onShow) page.onShow()
  if (page.pageLifetimes?.show) page.pageLifetimes.show.call(page)
}
const fail = (options) => { options.fail(); options.complete() }
const succeed = (options) => { options.success(); options.complete() }
const cases = []
const check = async (name, test) => { await test(); cases.push(name); console.log('PASS ' + name) }
const homeDef = load('pages/home/index.ts')
const home = make(homeDef, 'pages/home/index')
const detailDef = load('pages/institution/detail.ts')
const detail = make(detailDef, 'pages/institution/detail')
const consultantDef = load('pages/consultant/consultation.ts')
const consultant = make(consultantDef, 'pages/consultant/consultation')
const tabDef = load('pages/consultant/index.ts')
const successDef = load('pages/appointment/success.ts')
const barDef = load('components/navigation-bar/navigation-bar.ts')
const makeBar = () => {
  const bar = make(barDef, '')
  bar.data = { delta: 1, fallbackUrl: '/pages/consultant/index', fallbackIsTab: true, navigationFailureMessage: '暂时无法返回，请稍后重试。' }
  return bar
}

await check('N01 Home has one Assessment CTA and no untested time promise', () => {
  const wxml = read('miniprogram/pages/home/index.wxml')
  assert.equal((wxml.match(/bindtap="startAssessment"/g) || []).length, 1)
  assert.doesNotMatch(wxml, /3[–—-]5|分钟完成|home-editorial-row/)
  assert.match(wxml, /查找养老机构/)
  assert.match(wxml, /展开完整目录/)
  home.startAssessment(); home.startAssessment()
  assert.equal(calls.launch.length, 0)
  assert.equal(calls.push.length, 1)
  assert.equal(calls.push[0].url, '/pages/assessment/intro')
  calls.push.length = 0
})
await check('N02 Home previews two unchanged directory items and opens complete directory', async () => {
  home.loadInstitutions()
  await flush()
  const app = runtime.load(path.join(root, 'miniprogram/services/institution-list-detail-page.ts'))
  const list = await app.buildInstitutionListPageSnapshot(null)
  const vm = runtime.load(path.join(root, 'miniprogram/pages/institution/list-view-model.ts')).createInstitutionListPageViewModel(list.value)
  assert.ok(vm.items.length > 2, 'development catalogue provides a meaningful truncation case')
  assert.equal(home.data.institutions.length, 2)
  assert.equal(JSON.stringify(home.data.institutions.map(item => item.navigationIntent)), JSON.stringify(vm.items.slice(0, 2).map(item => item.navigationIntent)))
  home.openInstitutions(); home.openInstitutions()
  assert.equal(calls.push.length, 1)
  assert.equal(calls.push[0].url, '/pages/institution/index')
  fail(calls.push[0])
  assert.match(home.data.institutionListActionError, /重试/)
  home.openInstitutions()
  assert.equal(calls.push.length, 2)
})
await check('N03 Detail consult pushes one non-Tab route without context payload', async () => {
  const identity = home.data.institutions[0].navigationIntent
  detail.onLoad({ institutionId: identity.institutionId, recordRevision: String(identity.recordRevision) })
  await flush()
  assert.equal(detail.data.pageState, 'ready')
  detail.onSectionToggle({ currentTarget: { dataset: { sectionKey: 'fees' } } })
  stack = [home, detail]
  const before = calls.push.length
  detail.onConsultantTap(); detail.onConsultantTap()
  assert.equal(calls.push.length, before + 1)
  assert.equal(calls.push.at(-1).url, '/pages/consultant/consultation')
  assert.equal(calls.tab.length, 0)
  const config = JSON.parse(read('miniprogram/app.json'))
  assert.ok(config.pages.includes('pages/consultant/consultation'))
  assert.ok(!config.tabBar.list.some(item => item.pagePath === 'pages/consultant/consultation'))
})
await check('N04 Shared consultant retains lawful missing state and the original Detail instance', () => {
  const originalVm = detail.data.viewModel
  const expanded = JSON.stringify(detail.data.expandedSections)
  consultant.lifetimes.attached.call(consultant)
  assert.equal(consultant.data.backEnabled, true)
  assert.equal(tabDef.data.backEnabled, false)
  assert.equal(consultant.data.pageState, 'missing')
  consultant.onPhoneTap()
  assert.equal(calls.phone.length, 0)
  assert.equal(consultant.data.viewModel.showPhoneAction, false)
  assert.equal(consultant.data.viewModel.showQrImage, false)
  succeed(calls.push.at(-1))
  stack.push(consultant)
  const bar = makeBar()
  bar._guardedBack(); bar._guardedBack()
  assert.equal(calls.back.length, 1)
  assert.equal(calls.back[0].delta, 1)
  succeed(calls.back[0])
  stack.pop(); show(detail)
  assert.equal(stack.at(-1), detail)
  assert.equal(detail.data.viewModel, originalVm)
  assert.equal(JSON.stringify(detail.data.expandedSections), expanded)
  detail.onConsultantTap()
  assert.equal(calls.push.at(-1).url, '/pages/consultant/consultation')
})
await check('N05 Navigation failure, complete-only failure and exception release for retry', () => {
  for (const mode of ['failure', 'complete-only', 'exception']) {
    show(detail)
    const before = calls.push.length
    throwNavigation = mode === 'exception'
    detail.onConsultantTap()
    throwNavigation = false
    if (mode === 'failure') fail(calls.push.at(-1))
    if (mode === 'complete-only') calls.push.at(-1).complete()
    assert.match(detail.data.actionErrorMessage, /重试/)
    detail.onConsultantTap()
    assert.equal(calls.push.length, before + (mode === 'exception' ? 1 : 2))
  }
})
await check('N06 Consultant Back failure can retry, root arrow uses lawful Tab fallback', () => {
  stack = [home, detail, consultant]
  const bar = makeBar()
  const before = calls.back.length
  bar._guardedBack(); fail(calls.back.at(-1)); bar._guardedBack()
  assert.equal(calls.back.length, before + 2)
  assert.match(calls.toast.at(-1).title, /重试/)
  stack = [consultant]
  const rootBar = makeBar()
  rootBar._guardedBack(); rootBar._guardedBack()
  assert.equal(calls.tab.length, 1)
  assert.equal(calls.tab[0].url, '/pages/consultant/index')
})
await check('N07 Appointment result consult and My Appointments retain result as parent', () => {
  // Synthetic page state only; the existing appointment regression validates the real handoff seam.
  const success = make(successDef, 'pages/appointment/success')
  success.data.pageState = 'ready'; success.data.handoff = { TEST_ONLY: true }
  stack = [home, detail, success]
  for (const [handler, url] of [
    ['onContactConsultant', '/pages/consultant/consultation'],
    ['onViewAppointments', '/pages/appointment/index'],
  ]) {
    const before = calls.push.length
    success[handler](); success[handler]()
    assert.equal(calls.push.length, before + 1)
    assert.equal(calls.push.at(-1).url, url)
    fail(calls.push.at(-1))
    assert.match(success.data.actionErrorMessage, /重试/)
    success[handler]()
    succeed(calls.push.at(-1)); stack.push({ route: url.slice(1) })
    const bar = makeBar(); bar._guardedBack()
    succeed(calls.back.at(-1)); stack.pop(); show(success)
    assert.equal(stack.at(-1), success)
    success[handler]()
    assert.equal(calls.push.at(-1).url, url)
  }
  const invalid = make(successDef, 'pages/appointment/success')
  const before = calls.push.length
  invalid.onContactConsultant(); invalid.onViewAppointments()
  assert.equal(calls.push.length, before)
})
await check('N08 Tab registration and deliberate Home/Consultant Tab actions stay unchanged', () => {
  const config = JSON.parse(read('miniprogram/app.json'))
  assert.deepEqual(config.tabBar.list.map(item => item.pagePath), ['pages/home/index', 'pages/consultant/index', 'pages/mine/index'])
  show(home)
  home.openConsultant(); home.openConsultant()
  assert.equal(calls.tab.at(-1).url, '/pages/consultant/index')
  const success = make(successDef, 'pages/appointment/success')
  success.data.pageState = 'ready'; success.data.handoff = { TEST_ONLY: true }
  success.onReturnHome(); success.onReturnHome()
  assert.equal(calls.tab.at(-1).url, '/pages/home/index')
})
await check('N09 Frozen FAQ and appointment-card Tab consumers remain deferred per Owner decision', () => {
  for (const file of ['miniprogram/pages/service/ai-chat/index.ts', 'miniprogram/pages/appointment/index.ts']) {
    const source = read(file)
    assert.match(source, /wx\.switchTab/)
    assert.doesNotMatch(source, /consultant\/consultation/)
  }
  assert.match(read('miniprogram/pages/consultant/consultation.wxml'), /include src="\.\/index.wxml"/)
  assert.match(read('miniprogram/pages/consultant/consultation.less'), /@import '\.\/index.less'/)
})
await check('N10 Consultant appointment returns to an existing directory ancestor and falls back to guarded push', () => {
  const directory = { route: 'pages/institution/index', sourceContext: 'recommendation', retainedFilter: 'north' }
  const backBefore = calls.back.length
  const pushBefore = calls.push.length
  for (let cycle = 0; cycle < 3; cycle += 1) {
    stack = [home, directory]
    // Model the user's normal directory -> detail -> consultation path each time.
    stack.push({ route: 'pages/institution/detail', cycle }, { route: 'pages/consultant/consultation' })
    show(consultant)
    consultant.onAppointmentTap()
    assert.equal(calls.back.length, backBefore + cycle + 1)
    assert.equal(calls.back.at(-1).delta, 2, `cycle ${cycle + 1} returns to the original list in one operation`)
    assert.equal(calls.push.length, pushBefore, 'an existing directory must not be duplicated')
    succeed(calls.back.at(-1))
    stack = [home, directory]
    assert.equal(stack.at(-1), directory, 'the original sourceContext-bearing directory instance is retained')
  }

  stack = [home, consultant]
  show(consultant)
  const beforeFallback = calls.push.length
  consultant.onAppointmentTap()
  assert.equal(calls.push.length, beforeFallback + 1)
  assert.equal(calls.push.at(-1).url, '/pages/institution/index')
  fail(calls.push.at(-1))
  assert.match(consultant.data.actionErrorMessage, /暂时无法打开合作机构列表/)
  consultant.onAppointmentTap()
  assert.equal(calls.push.length, beforeFallback + 2, 'a failed fallback push releases its guard for retry')
  succeed(calls.push.at(-1))
})
const output = path.join(root, 'output/navigation-home-dedup-p0')
mkdirSync(output, { recursive: true })
writeFileSync(path.join(output, 'runtime-results.json'), JSON.stringify({
  task: 'MAIN_APP_NAVIGATION_AND_HOME_DEDUP_P0', cases, status: 'PASS',
  faqAndAppointmentCardStackFix: 'DEFERRED_BY_OWNER_PENDING_SUCCESSOR', androidGesture: 'OWNER_PENDING',
}, null, 2) + '\n')
console.log(`NAVIGATION_HOME_DEDUP_P0 = PASS (${cases.length}/${cases.length}; FAQ/card stack changes deferred)`)
