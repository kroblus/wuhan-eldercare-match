/** TEST_ONLY builder regression, not Android evidence. */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
const { ts } = loadWechatTypeScript(), factory = 'scripts/check-completed-assessment-user-loop-devtools.mjs'
const clone = v => JSON.parse(JSON.stringify(v))
const env = { ...process.env, HISTORY_DISPOSABLE_MYSQL: 'true' }
const build = args => JSON.parse(execFileSync(process.execPath, [factory, ...args], { env, encoding: 'utf8' }))
const generated = build(['--synthetic-account=A']), empty = build(['--empty-context', '--synthetic-account=INVALID'])
const seedKey = '__test_only_history_fixture_seed_v1', draftKey = 'wuhan-eldercare-match.assessment-draft.v2'
const launch = (project, storage, platform = 'devtools', failWrites = false) => {
  let apps = 0, draftWrites = 0, draftReads = 0, requests = 0
  const runtime = createWechatTsRuntime(ts, { App() { apps++ }, wx: {
    getSystemInfoSync: () => ({ platform }), getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: key => { if (key.includes('assessment-draft')) draftReads++; return clone(storage.get(key) ?? '') },
    setStorageSync: (key, value) => { if (failWrites) throw new Error('TEST_ONLY storage unavailable'); if (key.includes('assessment-draft')) draftWrites++; storage.set(key, clone(value)) },
    request() { requests++; throw new Error('unexpected backend call') },
  } })
  runtime.load(path.join(project, 'miniprogram/app.ts'))
  assert.equal(apps, 1, 'bootstrap failure must not abort the application')
  return { runtime, draftWrites: () => draftWrites, draftReads: () => draftReads, requests: () => requests }
}
const storage = new Map(), first = launch(generated.project, storage)
assert.equal(storage.get(seedKey).state, 'SYNTHETIC_ANSWERS_SEEDED')
const store = first.runtime.load(path.join(generated.project, 'miniprogram/store/assessment-draft.ts')).assessmentDraftStore
assert.equal(store.setAnswer('basic.age', 74).persistence.ok, true)
const edited = JSON.stringify(storage.get(draftKey)), restored = launch(generated.project, storage)
assert.equal(JSON.stringify(storage.get(draftKey)), edited); assert.equal(restored.draftWrites(), 0, 'new runtime never re-seeds edited Draft')
const existing = new Map([...storage].map(([k, v]) => [k, clone(v)])); existing.delete(seedKey)
const nonempty = launch(generated.project, existing)
assert.equal(existing.get(seedKey).state, 'PRESERVED_EXISTING_CONTEXT'); assert.equal(nonempty.draftWrites(), 0)
assert.equal(JSON.stringify(existing.get(draftKey)), edited)
const emptyStorage = new Map(), emptyRuntime = launch(empty.project, emptyStorage)
assert.equal(emptyStorage.get(seedKey).state, 'EMPTY_CONTEXT_CONFIRMED'); assert.equal(emptyRuntime.draftWrites(), 0)
const interrupted = new Map([...storage].map(([k,v])=>[k,clone(v)])); interrupted.set(seedKey, {version:1,state:'SEED_STARTED'})
assert.equal(launch(generated.project, interrupted).draftWrites(), 0, 'partial seed is preserved, never silently overwritten')
assert.equal(JSON.stringify(interrupted.get(draftKey)), edited)
launch(generated.project, new Map(), 'devtools', true)
const device = launch(generated.project, new Map(), 'android')
assert.equal(device.draftReads(), 0); assert.equal(device.draftWrites(), 0)
const client = device.runtime.load(path.join(generated.project, 'miniprogram/services/completed-assessment-user-loop.ts'))
  .createCompletedAssessmentUserLoopV1(() => { throw new Error('must not read device Draft') })
assert.equal(await client.capability(), false); assert.equal((await client.saveCurrent()).state, 'ERROR'); assert.equal(device.requests(), 0)
const normalAppId = JSON.parse(readFileSync('project.config.json', 'utf8')).appid
for (const args of [['--synthetic-account=FORGED'], ['--test-appid=invalid'], [`--test-appid=${normalAppId}`]]) {
  const rejected = spawnSync(process.execPath, [factory, ...args], { env, encoding: 'utf8' }); assert.notEqual(rejected.status, 0)
}
const manifest = JSON.parse(readFileSync(generated.manifest, 'utf8'))
assert.equal(manifest.appIdSource, 'EXISTING_REGISTERED_SIMULATOR_ONLY'); assert.equal(manifest.deviceIsolation, 'OWNER_VERIFICATION_REQUIRED')
for (const key of ['originalMiniprogramDigest','testOnlyPackageDigest','projectConfigDigest','backendArtifactDigest','backendTestHarnessDigest']) assert.match(manifest[key], /^[0-9a-f]{64}$/)
const config = JSON.parse(readFileSync('tsconfig.json', 'utf8'))
const options = ts.convertCompilerOptionsFromJson(config.compilerOptions, process.cwd()).options
const program = ts.createProgram([path.join(generated.project,'miniprogram/app.ts'),path.resolve('typings/index.d.ts')], { ...options, noEmit: true })
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error)
assert.equal(errors.length, 0, errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'))
console.log('PASS: one-time seed; edited/nonempty/partial/empty Draft preserved across fresh runtimes; storage failure does not abort App')
console.log('PASS: default copy on simulated Android has zero Draft reads/writes and backend requests; fixed synthetic account/AppID rejection and source manifests; not physical Android evidence')
console.log(`PASS: generated-copy semantic TypeScript ${ts.version}; TEST_ONLY artifacts retained: ${generated.project}`)
