// Offline by default. --probe is an explicit read-only request to an approved
// HTTPS endpoint, never a deployment or a substitute for WeChat/device checks.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'

const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), 'Missing value for ' + name)
  return args[index + 1]
}
for (let i = 0; i < args.length; i++) {
  assert.ok(['--probe', '--origin', '--institution', '--revision'].includes(args[i]), 'Unknown option')
  if (args[i] !== '--probe') i++
}
const root = process.cwd()
const runtime = createWechatTsRuntime(loadWechatTypeScript().ts, {})
const publication = runtime.load(path.join(root, 'miniprogram/services/institution-publications.ts'))
const release = runtime.load(path.join(root, 'modes/production/runtime/institution-publication-origin.ts')).INSTITUTION_PUBLICATION_ORIGIN
const report = { kind: 'PUBLICATION_PREFLIGHT', networkRequested: false, checks: [], pending: [] }
try {
  assert.ok(release === '' || publication.isReleasePublicationOrigin(release), 'INVALID_CONFIGURED_RELEASE_ORIGIN')
  const application = fs.readFileSync('server/src/main/resources/application.yml', 'utf8')
  for (const name of ['P1_INTAKE_ENABLED', 'C2_HISTORY_WRITES_ENABLED', 'INSTITUTION_PUBLICATIONS_ENABLED']) {
    assert.ok(application.includes('${' + name + ':false}'), 'UNSAFE_DEFAULT_' + name)
  }
  report.checks.push('Release origin format and repository business defaults are safe')
  report.configured = release !== ''
  if (!release) report.pending.push('Approved public HTTPS origin is not configured; bundled directory remains active')
  if (args.includes('--probe')) {
    const origin = option('--origin') || release
    assert.ok(publication.isReleasePublicationOrigin(origin), 'PROBE_REQUIRES_APPROVED_PUBLIC_HTTPS_ORIGIN')
    const institutionId = option('--institution'), revision = option('--revision')
    assert.equal(!!institutionId, !!revision, 'Provide institution and revision together')
    if (institutionId) {
      assert.ok(publication.isPublicationInstitutionId(institutionId), 'INVALID_INSTITUTION_ID')
      assert.ok(/^[1-9][0-9]*$/.test(revision) && Number.isSafeInteger(Number(revision)), 'INVALID_REVISION')
    }
    report.networkRequested = true
    const client = publication.createInstitutionPublicationClient({
      environment: () => 'release', developmentPublicationOrigin: () => '',
      async request(input) {
        const response = await fetch(input.url, { method: 'GET', headers: { Accept: 'application/json' },
          credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(input.timeout) })
        return { statusCode: response.status, data: await response.json() }
      },
    }, 'PRODUCTION', origin)
    const current = await client.load()
    assert.equal(current.dataEnvironment, 'PRODUCTION')
    report.currentCount = current.catalog.currentPointers.length
    report.checks.push('Current HTTP response schema, production environment and profile identities')
    const identities = institutionId ? [{ institutionId, recordRevision: Number(revision) }] : current.catalog.currentPointers
    assert.ok(identities.length, 'NO_RECORD_AVAILABLE_FOR_EXACT_READ_CHECK')
    for (const identity of identities) {
      const result = await client.resolveExactRevision(identity)
      assert.ok(result.ok, result.error?.code || 'EXACT_READ_FAILED')
    }
    report.exactReads = identities.length
    report.checks.push('Exact revision HTTP schema, identity and environment')
    if (!institutionId) report.pending.push('Provide a known older revision to check pre-update history as well')
  } else {
    assert.ok(!args.length, 'Probe parameters require --probe')
    report.pending.push('No endpoint contacted; approved test endpoint required for online checks')
  }
  report.pending.push('WeChat request allowlist, approved institution sources and real-device acceptance require separate evidence')
  report.status = 'PASS_ENGINEERING_CHECKS_WITH_EXTERNAL_GATES'
} catch (error) {
  // Never echo a failed URL, response body, headers or credential-bearing input.
  report.status = 'FAIL'
  report.error = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'PREFLIGHT_CHECK_FAILED'
  process.exitCode = 1
}
console.log(JSON.stringify(report, null, 2))
