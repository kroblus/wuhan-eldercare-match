import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'

const out = 'docs/design/global-ui-ux-fix-batch-b-v1-evidence/'
const plain = value => JSON.parse(JSON.stringify(value))
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const { ts } = loadWechatTypeScript()
let font = 16, registered, active
const effects = []
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ fontSizeSetting: font, platform: 'devtools', safeArea: { top: 0 } }),
  nextTick: fn => fn(), pageScrollTo() {},
}
for (const key of ['request', 'login', 'getStorageSync', 'setStorageSync', 'makePhoneCall', 'openLocation', 'openCustomerServiceChat']) wx[key] = () => effects.push(key)
const runtime = createWechatTsRuntime(ts, {
  wx, App() {}, Page(p) { registered = p }, Component(p) { registered = p },
  getCurrentPages: () => active ? [active] : [], setTimeout, clearTimeout,
})
const load = file => runtime.load(path.resolve('dist/demo/miniprogram', file + '.js'))
load('app')
const session = load('demo/session')
await session.loadDemo()
const store = load('store/assessment-draft').assessmentDraftStore
const before = digest({ session: session.readDemo(), draft: store.getDraft() })
const fontReader = load('utils/browse-font').readBrowseFontStyle
assert.equal(fontReader(), '')
font = 24
assert.match(fontReader(), /--browse-body-size:24px/)
assert.match(fontReader(), /--browse-meta-size:21px/)

const results = []
const withoutFont = data => { const { fontStyle, ...rest } = plain(data); return rest }
for (const step of ['basic', 'health', 'adl', 'cognitive', 'preference', 'budget']) {
  font = 16
  load('pages/assessment/' + step)
  const p = { ...registered, route: 'pages/assessment/' + step, data: plain(registered.data), setData(patch, cb) { Object.assign(this.data, plain(patch)); cb?.() } }
  active = p
  p.onLoad?.call(p)
  p.onShow.call(p)
  await new Promise(resolve => setTimeout(resolve, 0))
  const ordinary = withoutFont(p.data)
  assert.equal(p.data.fontStyle, '')
  font = 24
  p.onShow.call(p)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.match(p.data.fontStyle, /--browse-body-size:24px/)
  assert.deepEqual(withoutFont(p.data), ordinary, step + ': font settings never change answers, options, order, validation or restored state')
  p.onHide?.call(p)
  p.onUnload?.call(p)
  results.push({ step, result: 'PASS', displayAndDraftStateEqualExceptFont: true })
}
font = 16
load('pages/service/ai-chat/index')
const c = { ...registered.methods, data: plain(registered.data), setData(patch, cb) { Object.assign(this.data, plain(patch)); cb?.() } }
active = c
registered.lifetimes.attached.call(c)
const ordinaryAI = withoutFont(c.data)
font = 24
registered.pageLifetimes.show.call(c)
assert.match(c.data.fontStyle, /--browse-body-size:24px/)
assert.deepEqual(withoutFont(c.data), ordinaryAI, 'AI font change never submits a question or changes the consultation state')
assert.equal(digest({ session: session.readDemo(), draft: store.getDraft() }), before, 'font changes preserve complete session, draft, IDs and saved snapshots')
assert.equal(effects.length, 0, 'font projection has no external API or storage side effects')

const baseline = JSON.parse(fs.readFileSync(out + 'baseline.json', 'utf8'))
const protectedFiles = Object.keys(baseline.hashes).filter(file => /^(miniprogram\/(types|domain|services|store)\/|modes\/demo\/(session|fixtures|record-pages)\.)/.test(file))
for (const file of protectedFiles) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), baseline.hashes[file], 'protected business source changed: ' + file)
const roleStyles = fs.readFileSync('miniprogram/styles/assessment-readability.less', 'utf8')
assert.match(roleStyles, /--assessment-body-size: var\(--browse-body-size, 16px\)/)
assert.match(roleStyles, /--assessment-meta-size: var\(--browse-meta-size, 14px\)/)
const report = { result: 'PASS', steps: results, aiStateUnchanged: true, savedStateUnchanged: true, externalEffects: effects.length, protectedBusinessFiles: protectedFiles.length }
fs.writeFileSync(out + 'font-state-regression.json', JSON.stringify(report, null, 2))
console.log('PASS six steps 16/24px state equality, AI state, complete draft/snapshots, protected business source and zero external effects')
