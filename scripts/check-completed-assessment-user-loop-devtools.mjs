/** Prepare an isolated TEST_ONLY copy. Default AppID is simulator-only; device isolation requires Owner verification. */
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
assert.equal(process.env.HISTORY_DISPOSABLE_MYSQL, 'true')
const accountArgument = process.argv.find(arg => arg.startsWith('--synthetic-account='))
const syntheticAccount = accountArgument ? accountArgument.split('=')[1] : 'A'
const syntheticRunId = randomUUID()
assert.ok(['A', 'B', 'INVALID'].includes(syntheticAccount), 'only fixed synthetic test accounts')
const appIdArgument = process.argv.find(arg => arg.startsWith('--test-appid='))
const testAppId = appIdArgument ? appIdArgument.split('=')[1] : null
assert.ok(testAppId === null || /^wx[0-9a-f]{16}$/.test(testAppId), 'Owner must supply a valid registered independent TEST AppID')
const digestTree = directory => {
  const rows = []
  const visit = (dir, relative = '') => { for (const item of readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    const name = relative ? `${relative}/${item.name}` : item.name, full = path.join(dir,item.name)
    if (item.isDirectory()) visit(full,name); else if (item.isFile()) rows.push(name+':'+createHash('sha256').update(readFileSync(full)).digest('hex'))
  } }
  visit(directory); return createHash('sha256').update(rows.sort().join('\n')).digest('hex')
}
const originalConfig = JSON.parse(readFileSync('project.config.json', 'utf8'))
assert.ok(testAppId === null || testAppId !== originalConfig.appid, 'Device test AppID must differ from the normal project AppID')
const root = path.resolve('server/target', `history-loop-simulator-${randomUUID()}`)
mkdirSync(root, { recursive: false })
cpSync('miniprogram', path.join(root, 'miniprogram'), { recursive: true,
  filter: source => !/(?:node_modules|\.git|\.env|secret|deepseekapi)/i.test(source) })
const originalMiniprogramDigest = digestTree(path.join(root,'miniprogram'))
const config = originalConfig
// Existing registered AppID is only a simulator default. Explicit TEST AppID changes only this copy.
if (testAppId) config.appid = testAppId
config.projectname = 'TEST_ONLY CompletedAssessment User Loop'
config.setting.urlCheck = false
writeFileSync(path.join(root, 'project.config.json'), JSON.stringify(config, null, 2))
writeFileSync(path.join(root, 'TEST_ONLY.txt'), 'Disposable simulator copy. Synthetic C5/MySQL only. Never upload. Original project files untouched. Device storage requires a verified independent TEST AppID; default copy is simulator-only.\n')
const transportPath = path.join(root, 'miniprogram/services/c5-authenticated-backend-session.ts')
let transport = readFileSync(transportPath, 'utf8')
assert.ok(transport.includes('login: () => new Promise((resolve, reject) => {'))
if (!testAppId) {
  assert.ok(transport.includes('environment: () => wx.getAccountInfoSync().miniProgram.envVersion,'))
  transport = transport.replace('environment: () => wx.getAccountInfoSync().miniProgram.envVersion,', "environment: () => { try { return wx.getSystemInfoSync().platform === 'devtools' ? wx.getAccountInfoSync().miniProgram.envVersion : 'release' } catch (_error) { return 'release' } },")
}
transport = transport.replace('login: () => new Promise((resolve, reject) => {', `login: () => Promise.resolve('TEST_ONLY_LOGIN_${syntheticAccount}_${syntheticRunId}'),\n  unusedRealLogin: () => new Promise((resolve, reject) => {`)
// Remove the unused real-login member rather than ship a widened transport shape.
const start = transport.indexOf('  unusedRealLogin:')
const end = transport.indexOf('  request: (input)', start)
transport = transport.slice(0, start) + transport.slice(end)
assert.ok(transport.includes('url: input.url,'))
transport = transport.replace('url: input.url,', "url: input.url.replace('http://history-e2e.local:34479', 'http://127.0.0.1:34479'),")
writeFileSync(transportPath, transport)
const answers = JSON.parse(readFileSync('server/src/test/resources/assessment-history/test-only-answers.json', 'utf8'))
const empty = process.argv.includes('--empty-context')
const bootstrap = `// TEST_ONLY generated in an ignored copy; absent from the main application.
import type { AssessmentDraftStore } from './store/assessment-draft'
declare function require(path: string): { assessmentDraftStore: AssessmentDraftStore }
const testOnlyRuntimeAllowed = (): boolean => { try { return ${testAppId ? 'true' : "wx.getSystemInfoSync().platform === 'devtools'"} } catch (_error) { return false } }
const fixtureKey = '__test_only_history_fixture_seed_v1'
const testOnlyAnswers = ${JSON.stringify(empty ? {} : answers)}
const seedTestOnlyOnce = (): void => {
  try {
    if (!testOnlyRuntimeAllowed() || wx.getStorageSync(fixtureKey)) return
    const assessmentDraftStore = require('./store/assessment-draft').assessmentDraftStore
    if (assessmentDraftStore.requiresLegacyRecovery() || assessmentDraftStore.hasAnswers()) {
      wx.setStorageSync(fixtureKey, { version: 1, state: 'PRESERVED_EXISTING_CONTEXT' })
      return
    }
    const started = { version: 1, state: 'SEED_STARTED' }
    wx.setStorageSync(fixtureKey, started)
    if (JSON.stringify(wx.getStorageSync(fixtureKey)) !== JSON.stringify(started)) return
    for (const key of Object.keys(testOnlyAnswers)) {
      const result = assessmentDraftStore.setAnswer(key as any, (testOnlyAnswers as any)[key])
      if (!result.persistence.ok) {
        wx.setStorageSync(fixtureKey, { version: 1, state: 'SEED_FAILED_DRAFT_PRESERVED' })
        return
      }
    }
    wx.setStorageSync(fixtureKey, { version: 1, state: ${JSON.stringify(empty ? 'EMPTY_CONTEXT_CONFIRMED' : 'SYNTHETIC_ANSWERS_SEEDED')} })
  } catch (_error) { /* Preserve existing/partial Draft; never abort the whole application. */ }
}
seedTestOnlyOnce()
if (testOnlyRuntimeAllowed()) { try { wx.setStorageSync('__dev_backend_origin_v1', 'http://history-e2e.local:34479') } catch (_error) { /* Capability stays unavailable. */ } }
`

const appPath = path.join(root, 'miniprogram/app.ts')
writeFileSync(appPath, bootstrap + readFileSync(appPath, 'utf8'))
writeFileSync(path.join(root,'TEST_ONLY_MANIFEST.json'),JSON.stringify({kind:'history_device_test_only_manifest_v1',createdAt:new Date().toISOString(),sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),originalMiniprogramDigest,testOnlyPackageDigest:digestTree(path.join(root,'miniprogram')),projectConfigDigest:createHash('sha256').update(readFileSync(path.join(root,'project.config.json'))).digest('hex'),backendArtifactDigest:existsSync('server/target/classes')?digestTree('server/target/classes'):'NOT_BUILT',backendTestHarnessDigest:existsSync('server/target/test-classes')?digestTree('server/target/test-classes'):'NOT_BUILT',syntheticAccount,appId:config.appid,appIdSource:testAppId?'EXPLICIT_OWNER_TEST_APPID':'EXISTING_REGISTERED_SIMULATOR_ONLY',deviceIsolation:'OWNER_VERIFICATION_REQUIRED',mode:empty?'EMPTY_DRAFT':'SYNTHETIC_COMPLETED_DRAFT',backend:'LOOPBACK_DISPOSABLE_TEST_ONLY',productionWrite:false},null,2))
console.log(JSON.stringify({ project: root, syntheticAccount, manifest:path.join(root,'TEST_ONLY_MANIFEST.json'), mode: empty ? 'TEST_ONLY_EMPTY_CONTEXT' : 'TEST_ONLY_SYNTHETIC_COMPLETED_DRAFT' }))
