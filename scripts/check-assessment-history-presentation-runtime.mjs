/** TEST_ONLY in-memory presentation acceptance. No user/elder records or Provider. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(path.join(root, file), 'utf8')
const { ts } = loadWechatTypeScript()
let component
const navigations = []
const forbiddenCalls = []
const protectedDraft = Object.freeze({ kind: 'assessment_draft', localDraftId: 'TEST_ONLY-draft', schemaVersion: 2 })
const wx = new Proxy({
  navigateTo(options) { navigations.push(options) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'release' } } },
}, {
  get(target, key) {
    if (key in target) return target[key]
    return () => { forbiddenCalls.push(key); throw new Error(`Forbidden wx.${String(key)}`) }
  },
})
const runtime = createWechatTsRuntime(ts, { Component(config) { component = config }, wx })
const viewModel = runtime.load(path.join(root, 'miniprogram/pages/assessment/history-view-model.ts'))
const model = viewModel.createHistoryViewModel
const plain = value => JSON.parse(JSON.stringify(value))

// Minimal metadata projections, never completed answers or fictional owner identities.
const fixture = (id, completedAt, schemaVersion = 2) => Object.freeze({
  kind: 'completed_assessment', id, status: 'completed', schemaVersion, completedAt, source: 'TEST_ONLY',
})
const records = Object.freeze([
  fixture('TEST_ONLY-older', '2026-09-01T08:00:00Z', 1),
  fixture('TEST_ONLY-tie-first', '2026-10-01T08:00:00Z'),
  fixture('TEST_ONLY-newest', '2026-10-03T08:00:00Z'),
  fixture('TEST_ONLY-tie-second', '2026-10-01T16:00:00+08:00', 1),
])
const before = JSON.stringify(records)
assert.equal(model().historyState, 'UNAVAILABLE')
assert.equal(model({ state: 'UNAVAILABLE', records }).historyState, 'UNAVAILABLE')
assert.equal(model({ state: 'READY', records: [] }).historyState, 'EMPTY')
assert.equal(model({ state: 'ERROR', records: [] }).historyState, 'ERROR')
assert.equal(model({ state: 'EMPTY' }).historyState, 'ERROR', 'empty cannot be asserted without successful list read')
const ready = model({ state: 'READY', records })
assert.equal(ready.historyState, 'READY')
assert.deepEqual(plain(ready.records.map(row => row.id)), [
  'TEST_ONLY-newest', 'TEST_ONLY-tie-first', 'TEST_ONLY-tie-second', 'TEST_ONLY-older',
])
assert.deepEqual(plain(model({ state: 'READY', records }).records), plain(ready.records))
assert.equal(JSON.stringify(records), before, 'sorting must not mutate snapshots')
assert.equal(ready.testOnly, true)
assert.ok(ready.records.every(row => row.sourceLabel.includes('TEST_ONLY') && row.resultDisabled))
assert.equal(ready.records.at(-1).versionLabel, 'Assessment Schema 1', 'no V1 upgrade')
assert.equal(ready.records[2].completedAtLabel, records[3].completedAt, 'original timestamp preserved')

const invalid = [null, {}, protectedDraft, { ...records[0], localDraftId: 'TEST_ONLY-draft' },
  { ...records[0], id: '' }, { ...records[0], id: undefined },
  { ...records[0], completedAt: undefined }, { ...records[0], completedAt: '2026-02-30T08:00:00Z' },
  { ...records[0], completedAt: '2026-10-03' }, { ...records[0], completedAt: '2026-10-03T25:00:00Z' },
  { ...records[0], completedAt: '2026-10-03T08:00:00+25:00' },
  { ...records[0], schemaVersion: 99 }, { ...records[0], source: 'unknown' },
  { ...records[0], status: 'draft' }]
for (const item of [null, 1, '', [], {}, { state: 'READY' }, { state: 'READY', records: {} }]) {
  assert.equal(model(item).historyState, 'ERROR')
}
assert.equal(model({ state: 'READY', records: invalid }).historyState, 'ERROR', 'invalid nonempty is not EMPTY')
const mixed = model({ state: 'READY', records: [...invalid, ...records, records[0]] })
assert.deepEqual(plain(mixed.records), plain(ready.records))
assert.ok(mixed.invalidRecordsMessage)
const development = model({ state: 'READY', records: [{ ...records[0], source: 'LOCAL_DEVICE_DEVELOPMENT_ONLY' }] })
assert.equal(development.testOnly, false)
assert.match(development.records[0].sourceLabel, /本机开发记录/)
assert.equal(model({ state: 'READY', records: [...records, { ...records[0], id: 'TEST_ONLY-local', source: 'LOCAL_DEVICE_DEVELOPMENT_ONLY' }] }).historyState, 'ERROR')

const instantiate = config => {
  const page = { data: plain(config.data), setData(patch) { Object.assign(this.data, plain(patch)) } }
  for (const [name, handler] of Object.entries(config.methods)) page[name] = handler.bind(page)
  return page
}
runtime.load(path.join(root, 'miniprogram/pages/assessment/history.ts'))
const historyConfig = component
const page = instantiate(historyConfig)
assert.equal(page.data.historyState, 'UNAVAILABLE')
assert.deepEqual(page.data.records, [])
// Only this Node test sets the display data. No query flag or production injection seam.
page.setData(ready)
await page.viewHistoryResult()
assert.equal(page.data.actionMessage, viewModel.historyActionMessage('VIEW_RESULT'))
const viewResultMessage = viewModel.historyActionMessage('VIEW_RESULT')
for (const event of [undefined, null, false, 0, {}, { currentTarget: null }, { currentTarget: {} },
  { currentTarget: { dataset: null } }, { currentTarget: { dataset: {} } },
  { currentTarget: { dataset: { recordId: false } } }, { currentTarget: { dataset: { recordId: 0 } } },
  { currentTarget: { dataset: { recordId: 'TEST_ONLY-unknown-record' } } }]) {
  await page.viewHistoryResult(event)
  assert.equal(page.data.actionMessage, viewResultMessage, 'malformed or unknown recordId must fail closed')
}
assert.equal(navigations.length, 0, 'malformed and unknown history events never navigate')
await page.newAssessment()
assert.equal(page.data.actionMessage, viewModel.historyActionMessage('NEW_ASSESSMENT'))
assert.equal(navigations.length, 0, 'history/new assessment intents never route to current results or Draft')
assert.equal(page.data.newAssessmentDisabled, true)
historyConfig.pageLifetimes.show.call(page)
assert.equal(page.data.historyState, 'UNAVAILABLE', 'normal lifecycle cannot retain TEST_ONLY data')
assert.deepEqual(page.data.records, [])

runtime.load(path.join(root, 'miniprogram/components/primary-button/primary-button.ts'))
const button = component
let events = 0
button.methods.handleAction.call({ data: { disabled: true, loading: false }, triggerEvent() { events++ } })
assert.equal(events, 0)
button.methods.handleAction.call({ data: { disabled: false, loading: false }, triggerEvent(name, detail, options) {
  events++
  assert.equal(name, 'action')
  assert.equal(options.bubbles, false)
  assert.equal(options.composed, false)
  page.navigateNext()
} })
assert.equal(events, 1)
page.navigateNext()
assert.equal(navigations.length, 1, 'rapid tap must be guarded')
assert.equal(navigations[0].url, '/pages/recommendation/result')
navigations[0].fail({ errMsg: 'TEST_ONLY navigation failure' })
assert.match(page.data.actionMessage, /暂时无法打开当前推荐/)
page.navigateNext()
assert.equal(navigations.length, 2, 'failed navigation releases guard')
navigations[1].success({})
historyConfig.pageLifetimes.show.call(page)
page.navigateNext()
assert.equal(navigations.length, 3, 'return lifecycle releases guard')

// Existing Mine -> Elder directory -> Elder detail -> History entry chain.
for (const [file, target] of [
  ['mine/index.ts', '/pages/elder/index'],
  ['elder/index.ts', '/pages/elder/detail'],
  ['elder/detail.ts', '/pages/assessment/history'],
]) {
  runtime.load(path.join(root, 'miniprogram/pages', file))
  const entry = instantiate(component)
  entry.navigateNext()
  assert.equal(navigations.at(-1).url, target)
}
assert.deepEqual(forbiddenCalls, [], 'no storage, authentication, network or Draft capabilities')
assert.equal(protectedDraft.localDraftId, 'TEST_ONLY-draft')
const template = read('miniprogram/pages/assessment/history.wxml')
assert.match(template, /wx:for="\{\{records\}\}" wx:key="id"/)
for (const binding of ['item.number', 'item.completedAtLabel', 'item.versionLabel', 'item.sourceLabel']) {
  assert.ok(template.includes(`{{${binding}}}`), `row binding missing: ${binding}`)
}
assert.match(template, /wx:if="\{\{testOnly\}\}"[^>]*>[\s\S]*?TEST_ONLY/)
assert.match(template, /state="\{\{panelState\}\}"/)
assert.match(template, /disabled="\{\{item.resultDisabled\}\}" bind:action="viewHistoryResult"/)
assert.match(template, /disabled="\{\{newAssessmentDisabled\}\}" bind:action="newAssessment"/)
assert.match(template, /fallbackUrl="\/pages\/mine\/index" fallbackIsTab="\{\{true\}\}" guardBack="\{\{true\}\}"/)
assert.ok(JSON.parse(read('miniprogram/app.json')).pages.includes('pages/assessment/history'))
for (const file of ['history.ts', 'history-view-model.ts']) {
  const source = read(`miniprogram/pages/assessment/${file}`)
  assert.doesNotMatch(source, /from\s+['"][^'"]*(?:store\/|mock\/|scripts\/)/)
  assert.doesNotMatch(source, /TEST_ONLY-(?:older|newest|tie)|2026-\d{2}-\d{2}/)
}
assert.match(read('miniprogram/pages/assessment/history.ts'), /createHistoryViewModel\(\)/)
const historySource = read('miniprogram/pages/assessment/history.ts')
assert.doesNotMatch(historySource, /\?\./, 'history source must avoid optional chaining')
assert.doesNotMatch(historySource, /\?\?/, 'history source must avoid nullish coalescing')
assert.doesNotMatch(historySource, /recordId\s*\|\|/, 'recordId extraction must preserve false and zero values')

const historyEmit = ts.transpileModule(historySource, {
  fileName: path.join(root, 'miniprogram/pages/assessment/history.ts'), reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
})
const emitErrors = (historyEmit.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
assert.equal(emitErrors.length, 0, ts.formatDiagnosticsWithColorAndContext(emitErrors, {
  getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
}))
const emittedSource = ts.createSourceFile('history.js', historyEmit.outputText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS)
assert.equal(emittedSource.parseDiagnostics.length, 0, 'target ES2020 history output must parse')
assert.doesNotMatch(historyEmit.outputText, /\?\./, 'target ES2020 output must not contain optional chaining')
assert.doesNotMatch(historyEmit.outputText, /\?\?/, 'target ES2020 output must not contain nullish coalescing')

// Actual semantic TypeScript check for the changed surface, using the WeChat parser.
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
assert.equal(configFile.error, undefined)
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
const roots = ['miniprogram/pages/assessment/history.ts', 'miniprogram/pages/assessment/history-view-model.ts', 'typings/index.d.ts'].map(file => path.join(root, file))
const program = ts.createProgram(roots, { ...config.options, noEmit: true })
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
}))
console.log('PASS: UNAVAILABLE / successful EMPTY / ERROR / TEST_ONLY list bindings / stable descending times / malformed and duplicate metadata')
console.log('PASS: readonly history intents / disabled new assessment / no Draft or storage calls / no production fixture / existing entry chain and navigation retry')
console.log(`PASS: malformed/unknown event fail-closed; targeted semantic TypeScript ${ts.version}; ES2020 output contains no optional-chain syntax; no device or Android claim`)
// Optional DevTools-only transient setData payload. No route flag or bundled fixture.
if (process.argv.includes('--test-only-visual-patch')) console.log(JSON.stringify(ready))
