import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

// UI-0: exercise the new placement of the existing platform Consultant Tab,
// including duplicate taps and recovery. No production data or contact source.
// Read committed page sources only; all wx calls below stay inside the test VM.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pageRoot = path.join(root, 'miniprogram', 'pages', 'institution')
const wxml = readFileSync(path.join(pageRoot, 'detail.wxml'), 'utf8')
const consultantCtas = wxml.match(/<primary-button\b(?=[^>]*\btext="咨询顾问")(?=[^>]*\bbind:action="onConsultantTap")[^>]*>/g) || []
assert.equal(consultantCtas.length, 1, 'detail has one consultant CTA with the approved copy and handler')
assert.equal(/\b(?:bind|catch):?tap=/.test(consultantCtas[0]), false, 'consultant CTA uses only the component action channel')
console.log('WARM_SWISS_UI0_CONSULTANT_CTA = PASS (copy, one CTA, single action binding)')

const { ts } = loadWechatTypeScript()
let definition
const calls = []
const runtime = createWechatTsRuntime(ts, {
  Page(config) { definition = config },
  Component() {},
  getCurrentPages() { return [] },
  wx: { getStorageSync() {}, switchTab(options) { calls.push(options) } },
})
runtime.load(path.join(pageRoot, 'detail.ts'))
const page = { ...definition, data: { pageState: 'loading', viewModel: null, isSwitchingRevision: false }, setData(patch) { Object.assign(this.data, patch) } }
page.onConsultantTap()
assert.equal(calls.length, 0, 'loading/absent institution has no service action')
page.data.pageState = 'ready'
page.data.viewModel = { title: 'Synthetic UI-0 test fixture' }
page.data.isSwitchingRevision = true
page.onConsultantTap()
assert.equal(calls.length, 0, 'revision transition blocks service action')
page.data.isSwitchingRevision = false
page.onConsultantTap()
page.onConsultantTap()
assert.equal(calls.length, 1, 'rapid taps open at most one Tab')
assert.equal(calls[0].url, '/pages/consultant/index')
assert.equal(calls[0].url.includes('institutionId'), false, 'global entry does not invent institution assignment')
calls[0].fail({ errMsg: 'synthetic navigation failure' })
calls[0].complete()
assert.equal(page.data.actionErrorKey, 'consultant')
assert.ok(page.data.actionErrorMessage)
page.onConsultantTap()
assert.equal(calls.length, 2, 'failed navigation releases guard')
calls[1].success({ errMsg: 'switchTab:ok' })
calls[1].complete()
page.onConsultantTap()
assert.equal(calls.length, 2, 'success cannot duplicate Tab navigation')
page.onShow()
page.onConsultantTap()
assert.equal(calls.length, 3, 'return lifecycle resets guard')
page.onShow()
runtime.context.wx.switchTab = () => { throw new Error('synthetic synchronous navigation failure') }
page.onConsultantTap()
assert.equal(page.data.actionErrorKey, 'consultant', 'synchronous failure is visible')
runtime.context.wx.switchTab = (options) => { calls.push(options) }
page.onConsultantTap()
assert.equal(calls.length, 4, 'synchronous failure also releases guard')
console.log('WARM_SWISS_UI0_CONSULTANT_ACTION = PASS (state gates, one navigation, visible failure, retry, lifecycle)')
