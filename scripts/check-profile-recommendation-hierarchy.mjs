import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadWechatTypeScript, createWechatTsRuntime } from './support/load-wechat-ts-runtime.mjs'

const out = 'docs/design/global-ui-ux-profile-recommendation-hierarchy-v1-evidence/'
const { ts } = loadWechatTypeScript()
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const wx = { getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(fs.readFileSync('dist/demo/project.config.json')).appid, envVersion: 'develop' } }), getSystemInfoSync: () => ({ fontSizeSetting: 16 }) }
const effects = []
for (const key of ['request', 'login', 'getStorageSync', 'setStorageSync', 'makePhoneCall', 'openLocation', 'openCustomerServiceChat']) wx[key] = () => effects.push(key)
const rt = createWechatTsRuntime(ts, { wx, App() {}, Page() {}, Component() {}, setTimeout, clearTimeout })
const load = file => rt.load(path.resolve('dist/demo/miniprogram', file+'.js'))
load('app')
const session = load('demo/session'); await session.loadDemo()
const original = digest(session.readDemo())
const application = load('services/profile-application-v2').buildProfileApplicationSnapshot()
assert.equal(application.ok, true); assert.equal(application.version, 2)
const profile = load('pages/assessment/profile-v2-view-model').createProfilePageViewModelV2(application.value.preview)
const result = await load('services/recommendation-result-application').buildRecommendationResultApplicationSnapshot({ evaluationAsOf: '2026-10-25T00:00:00.000Z' })
assert.equal(result.ok, true); assert.equal(result.version, 2)
const recommendation = load('pages/recommendation/result-v2-view-model').createRecommendationResultViewModelV2(result.value)
const projections = { profile: digest(profile), recommendation: digest(recommendation), savedAssessments: digest(session.readDemo().assessments),
  profileTags: profile.overviewTags, focusTags: recommendation.focusTags,
  candidates: recommendation.cards.map(c => ({ institutionId:c.institutionId, recordRevision:c.recordRevision, name:c.name, matchLabel:c.matchLabel })) }
assert.equal(digest(session.readDemo()), original, 'reading display projections never mutates session/snapshots')
assert.equal(effects.length, 0)
const file = out+'display-baseline.json'
if (process.argv.includes('--record-baseline')) {
  fs.writeFileSync(file, JSON.stringify(projections,null,2)); console.log('Recorded pre-change full display hashes and original ordered tags'); process.exit(0)
}
const { savedAssessments: recordingSessionHash, ...expectedDisplay } = JSON.parse(fs.readFileSync(file))
const { savedAssessments: validationSessionHash, ...actualDisplay } = projections
// Each isolated VM initializes a new localDraftId. Compare complete UI values
// across builds; exact saved-session immutability was asserted above, including
// those draft references. Never rewrite the saved snapshots to normalize IDs.
assert.deepEqual(JSON.parse(JSON.stringify(actualDisplay)), expectedDisplay, 'complete display values/order/identity/reasons must remain byte-equivalent')
for (const page of ['assessment/profile','recommendation/result']) {
  const source = fs.readFileSync('miniprogram/pages/'+page+'.ts','utf8')
  assert.match(source, /readBrowseFontStyle/)
}
assert.match(fs.readFileSync('miniprogram/pages/recommendation/result.wxml','utf8'), /本次匹配依据/)
fs.writeFileSync(out+'data-comparison.json', JSON.stringify({ result:'PASS', projections, savedSnapshotsSameSessionUnchanged:true, recordingSessionHash, validationSessionHash, crossSessionNote:'Isolated VM initialization creates a fresh localDraftId; actual saved state is never normalized or rewritten.', externalEffects:effects.length },null,2))
console.log('PASS complete profile/recommendation VM hashes, ordered tags, candidates, saved snapshots and zero external effects')
