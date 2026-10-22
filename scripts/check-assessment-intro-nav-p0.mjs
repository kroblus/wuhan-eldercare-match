/**
 * Scoped interaction matrix: Home CTA pushes Intro once; Intro Back pops its
 * existing parent (root-only fallback switches Home Tab); Continue/Basic Back
 * preserve Draft; failure releases guards for retry. No Android gesture claim.
 */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(path.join(root, file), 'utf8')
const { ts } = loadWechatTypeScript()
let definition
let stack = []
let backFails = false
const storage = new Map()
const calls = { push: [], back: [], tab: [], redirect: [], launch: [], toast: [], modal: [] }
let storageMutations = 0
const wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))); storageMutations++ },
  removeStorageSync(key) { storage.delete(key); storageMutations++ },
  getSystemInfoSync: () => ({ platform: 'android', safeArea: { top: 24 } }),
  navigateTo: options => calls.push.push(options),
  redirectTo: options => calls.redirect.push(options),
  reLaunch: options => calls.launch.push(options),
  switchTab: options => calls.tab.push(options),
  showToast: options => calls.toast.push(options),
  showModal: options => calls.modal.push(options),
  navigateBack(options) {
    calls.back.push(options)
    if (backFails) { options.fail?.(); options.complete?.(); return }
    stack.pop(); options.success?.(); options.complete?.(); show(stack.at(-1))
  },
}
const runtime = createWechatTsRuntime(ts, {
  wx, getCurrentPages: () => stack,
  Page: value => { definition = value }, Component: value => { definition = value },
})
const load = file => { runtime.load(path.join(root, 'miniprogram', file)); return definition }
const mount = (value, route) => ({
  ...value, ...value.methods, route,
  data: JSON.parse(JSON.stringify(value.data || {})),
  setData(patch) { Object.assign(this.data, patch) },
  triggerEvent() { wx.showToast({ title: '返回失败' }) },
})
const show = page => {
  page?.onShow?.()
  if (page?.pageLifetimes?.show) page.pageLifetimes.show.call(page)
}
const homeDef = load('pages/home/index.ts')
const introDef = load('pages/assessment/intro.ts')
const basicDef = load('pages/assessment/basic.ts')
const barDef = load('components/navigation-bar/navigation-bar.ts')
const draftModule = runtime.load(path.join(root, 'miniprogram/store/assessment-draft.ts'))
const store = draftModule.assessmentDraftStore
const home = mount(homeDef, 'pages/home/index')
const newIntro = () => mount(introDef, 'pages/assessment/intro')
const newBar = () => {
  const bar = mount(barDef, '')
  bar.data = { guardBack: true, delta: 1, fallbackUrl: '/pages/home/index', fallbackIsTab: true }
  return bar
}
const commitPush = page => {
  const options = calls.push.at(-1)
  stack.push(page); options.success(); options.complete()
  page.onLoad?.(); show(page)
}
const cases = []
const check = (name, test) => { test(); cases.push(name); console.log('PASS ' + name) }
let intro

check('I01 Intro title and remaining visible copy have no escaped newline literals', () => {
  const wxml = read('miniprogram/pages/assessment/intro.wxml')
  assert.equal(wxml.match(/<text class="intro-title">([^<]+)<\/text>/)[1], '先花几分钟，了解老人的真实需求。')
  assert.doesNotMatch(wxml.replace(/<[^>]*>/g, ''), /\\[nrt]|\/n/)
  assert.doesNotMatch(introDef.data.overviewItems.map(item => item.title + item.description).join(''), /\\[nrt]|\/n/)
  assert.match(wxml, /guardBack="\{\{true\}\}"/)
  assert.match(wxml, /fallbackUrl="\/pages\/home\/index"/)
  assert.match(wxml, /fallbackIsTab="\{\{true\}\}"/)
})
check('I02 Home pushes Intro once and arrow Back returns its original Home', () => {
  stack = [home]; show(home)
  const originalDraft = JSON.stringify(store.getDraft())
  home.startAssessment(); home.startAssessment()
  assert.equal(calls.push.length, 1)
  assert.equal(calls.push[0].url, '/pages/assessment/intro')
  assert.equal(calls.launch.length, 0)
  intro = newIntro(); commitPush(intro)
  assert.equal(stack.length, 2)
  assert.equal(stack[0], home)
  const bar = newBar(); bar.back(); bar.back()
  assert.equal(calls.back.length, 1)
  assert.equal(stack.at(-1), home)
  assert.equal(calls.tab.length, 0)
  assert.equal(JSON.stringify(store.getDraft()), originalDraft)
})
check('I03 Reentry -> Intro -> Basic -> Intro -> Home remains an ordinary parent stack', () => {
  const before = calls.push.length
  home.startAssessment(); home.startAssessment()
  assert.equal(calls.push.length, before + 1)
  intro = newIntro(); commitPush(intro)
  const originalDraft = JSON.stringify(store.getDraft())
  intro.startAssessment(); intro.startAssessment()
  assert.equal(calls.push.length, before + 2)
  assert.equal(calls.push.at(-1).url, '/pages/assessment/basic')
  const basic = mount(basicDef, 'pages/assessment/basic'); commitPush(basic)
  assert.equal(stack.length, 3)
  basic.onBack()
  assert.equal(stack.at(-1), intro)
  newBar().back()
  assert.equal(stack.at(-1), home)
  assert.equal(JSON.stringify(store.getDraft()), originalDraft)
  assert.equal(calls.redirect.length, 0)
})
check('I04 Existing Draft survives Back, reentry, Continue and cancel Restart', () => {
  // TEST_ONLY answers in an isolated memory storage, never the live user's Draft.
  store.setAnswer('basic.relationship', 'mother')
  const snapshot = JSON.stringify(store.getDraft())
  const mutations = storageMutations
  home.startAssessment(); intro = newIntro(); commitPush(intro)
  assert.equal(intro.data.hasDraft, true)
  newBar().back()
  home.startAssessment(); intro = newIntro(); commitPush(intro)
  assert.equal(JSON.stringify(store.getDraft()), snapshot)
  intro.startAssessment(); commitPush(mount(basicDef, 'pages/assessment/basic'))
  assert.equal(stack.at(-1).data.relationship, 'mother')
  stack.at(-1).onBack()
  assert.equal(intro.data.hasDraft, true)
  intro.restartAssessment(); intro.restartAssessment()
  assert.equal(calls.modal.length, 1)
  calls.modal[0].success({ confirm: false })
  assert.equal(JSON.stringify(store.getDraft()), snapshot)
  assert.equal(storageMutations, mutations)
  const restored = new draftModule.AssessmentDraftStore()
  assert.equal(JSON.stringify(restored.getDraft()), snapshot)
  newBar().back()
})
check('I05 Failed Home navigation and Intro parent Back both allow visible retry', () => {
  home.startAssessment()
  const failed = calls.push.at(-1); failed.fail(); failed.complete()
  assert.equal(calls.toast.at(-1).title, '无法开始评估')
  const before = calls.push.length
  home.startAssessment()
  assert.equal(calls.push.length, before + 1)
  intro = newIntro(); commitPush(intro)
  const bar = newBar()
  backFails = true; bar.back(); backFails = false
  assert.equal(stack.at(-1), intro)
  bar.back()
  assert.equal(stack.at(-1), home)
})
check('I06 Independent root Intro only uses lawful Home Tab arrow fallback', () => {
  intro = newIntro(); stack = [intro]; show(intro)
  const snapshot = JSON.stringify(store.getDraft())
  const bar = newBar(); bar.back(); bar.back()
  assert.equal(calls.tab.length, 1)
  assert.equal(calls.tab[0].url, '/pages/home/index')
  calls.tab[0].fail(); calls.tab[0].complete(); bar.back()
  assert.equal(calls.tab.length, 2)
  assert.equal(JSON.stringify(store.getDraft()), snapshot)
})
const output = path.join(root, 'output/assessment-intro-nav-p0')
mkdirSync(output, { recursive: true })
writeFileSync(path.join(output, 'targeted-results.json'), JSON.stringify({ task: 'MAIN_APP_ASSESSMENT_INTRO_NAV_FIX_P0', status: 'PASS', cases, androidGesture: 'OWNER_PENDING' }, null, 2) + '\n')
console.log(`ASSESSMENT_INTRO_NAV_P0 = PASS (${cases.length}/${cases.length})`)
