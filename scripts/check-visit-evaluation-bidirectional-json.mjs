// TEST_ONLY synthetic, offline wire gate. No application server or persistence.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createClientDriver } from './support/visit-evaluation-json-client-driver.mjs'
import { requestNegativeCases, responseNegativeCases } from './fixtures/visit-evaluation-json-negative-cases.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const audit = path.join(repo, 'output/warm-swiss-v1_2-visit-evaluation-bidirectional-json-gate-20261010')
const option = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
const out = path.resolve(option('--output') || path.join(audit, 'artifacts'))
assert.ok(out.startsWith(`${audit}${path.sep}`), 'outputs must remain in this audit directory')
assert.ok(!existsSync(out), 'fresh output directory required; previous artifacts are never overwritten')
const classpathFile = path.join(audit, 'offline-classpath.txt')
assert.ok(existsSync(classpathFile), 'run Maven OFFLINE dependency:build-classpath first; no auto-fetch')
const classpath = readFileSync(classpathFile, 'utf8').trim()
assert.ok(classpath && classpath.split(path.delimiter).every(existsSync), 'cached dependency closure required')
const jdk = option('--jdk') || process.env.JAVA_HOME
assert.ok(jdk && existsSync(path.join(jdk, 'bin/javac.exe')), 'existing JDK 21 required; no installation')
mkdirSync(out, { recursive: true })
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const save = (name, value) => writeFileSync(path.join(out, name), `${JSON.stringify(value, null, 2)}\n`)
const commands = []
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]))
const run = (exe, args, input) => {
  const r = spawnSync(exe, args, { cwd: repo, env, encoding: 'utf8', input, timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
  commands.push({ executable: exe, arguments: args, exitCode: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error?.message })
  save('commands.json', commands)
  assert.equal(r.status, 0, `offline process failed: ${exe}; see commands.json`)
  return r.stdout
}
const scenario = {
  provenance: 'TEST_ONLY_SYNTHETIC_NO_REAL_PERSONAL_DATA',
  visitId: 'synthetic-visit-json-gate', institutionId: 'synthetic-institution-json-gate',
  revision: 'synthetic-revision-json-gate', evaluationId: 'synthetic-evaluation-json-gate',
  ownerId: 'synthetic-owner-json-gate', idempotencyKey: 'synthetic-json-gate-key-001',
  submittedAt: '2026-10-10T01:02:03.123456Z',
}
const tools = [
  'scripts/check-visit-evaluation-bidirectional-json.mjs',
  'scripts/support/visit-evaluation-json-client-driver.mjs',
  'scripts/fixtures/visit-evaluation-json-negative-cases.mjs',
  'server/src/test/java/com/wuhan/eldercare/visit/VisitEvaluationJsonOfflineDriver.java',
]
try {
  // A standard JSON.stringify of the real body is useful compatibility evidence,
  // but is not execution of wx.request's native encoder. This task requires that
  // production encoder and forbids the SDK/DevTools path needed to reach it.
  const nativeTransportPath = 'miniprogram/services/c5-authenticated-backend-session.ts'
  const productionBodyPath = 'miniprogram/pages/visit/visit-evaluation-production-context.ts'
  const nativeTransport = readFileSync(path.join(repo, nativeTransportPath), 'utf8')
  const productionBody = readFileSync(path.join(repo, productionBodyPath), 'utf8')
  const nativeObjectTransportIdentified = nativeTransport.includes('wx.request({') && nativeTransport.includes('data: input.data')
    && productionBody.includes('data: createVisitEvaluationSubmissionBodyV1(request)')
  // Absence of these markers is not affirmative evidence of an accessible codec.
  // No offline production encoder seam has been established by this task.
  const requireProductionEncoderAccess = () => {
    save('codec-preflight-result.json', {
      RESULT: 'BLOCKED', CLIENT_TO_SERVER_JSON: 'BLOCKED', SOURCE_ARTIFACT_BINDING: 'BLOCKED',
      STOP_CONDITION: 'PRODUCTION_CODEC_PATH_NOT_ACCESSIBLE_OFFLINE',
      nativeObjectTransportIdentified,
      reason: nativeObjectTransportIdentified
        ? 'Production hands an object to the native wx.request encoder; this offline tool cannot execute that encoder.'
        : 'Production transport markers changed; no executable offline production encoder has been affirmatively established.',
      standardJsonSubsetEvidence: 'run-03/artifacts (not a complete mandatory Gate)',
      sources: [nativeTransportPath, productionBodyPath].map((p) => ({ path: p, sha256: hash(readFileSync(path.join(repo, p))) })),
      toolFiles: tools.map((p) => ({ path: p, sha256: hash(readFileSync(path.join(repo, p))) })),
      productionClientSerializerExecuted: false, realIoExecuted: false,
    })
    throw new Error('PRODUCTION_CODEC_PATH_NOT_ACCESSIBLE_OFFLINE: native wx.request serialization is outside authorization')
  }
  requireProductionEncoderAccess()
  const javaVersion = run(path.join(jdk, 'bin/java.exe'), ['-version'])
  assert.match(commands.at(-1).stderr + javaVersion, /version "21[.\"]/)
  const client = createClientDriver(repo)
  const requests = client.generateRequests(scenario)
  assert.ok(requests.length >= 2, 'minimal and optional request coverage required')
  const requestNegatives = requestNegativeCases(requests)
  save('scenario.json', scenario)
  save('client-produced-request.json', requests)
  const validText = requests[0].jsonText
  const responseBranches = [
    { repositoryStatus: 'replayed', expectedKind: 'submitted', expectedReplayed: true },
    ...['not_found', 'not_completed', 'already_submitted', 'idempotency_conflict'].map((s) => ({ repositoryStatus: s, expectedKind: s })),
    { repositoryStatus: 'unavailable', expectedKind: 'service_unavailable' },
    { repositoryStatus: 'technical_failure', expectedKind: 'technical_failure' },
    ...['missing', 'expired', 'invalid'].map((s) => ({ authResolution: s, expectedKind: 'auth_required' })),
    { authResolution: 'unavailable', expectedKind: 'service_unavailable' },
    { authResolution: 'technical_failure', expectedKind: 'technical_failure' },
  ].map((c) => ({ caseId: `server-branch-${c.repositoryStatus || c.authResolution}`,
    jsonText: validText, ...c }))
  // Distinguish repository and resolver unavailability in artifact IDs.
  responseBranches.forEach((c) => { if (c.authResolution) c.caseId = `server-auth-${c.authResolution}` })
  const contexts = [
    ...['completed', 'requested', 'contacting', 'scheduled', 'cancelled'].map((s) => ({ visitStatus: s,
      caseId: `context-status-${s}`, authResolution: 'authenticated', expectedKind: s === 'completed' ? 'eligible' : 'not_completed' })),
    ...['not_found', 'unavailable', 'technical_failure'].map((s) => ({ repositoryStatus: s,
      caseId: `context-repository-${s}`, authResolution: 'authenticated', expectedKind: s === 'not_found' ? 'denied' : s === 'unavailable' ? 'unavailable' : 'load_error' })),
    ...['missing', 'expired', 'invalid', 'unavailable', 'technical_failure'].map((s) => ({ authResolution: s,
      caseId: `context-auth-${s}`, expectedKind: ['missing', 'expired', 'invalid'].includes(s) ? 'denied' : s === 'unavailable' ? 'unavailable' : 'load_error' })),
  ]
  const manifest = { scenario, contexts, requests: [
    ...requests.map(({ caseId, jsonText }) => ({ caseId, jsonText, expectedKind: 'submitted', expectedReplayed: false })),
    ...requestNegatives.map(({ caseId, jsonText }) => ({ caseId, jsonText, expectedKind: 'validation_failed' })),
    ...responseBranches,
  ] }
  save('java-input.json', manifest)
  const classes = path.join(out, 'classes')
  mkdirSync(classes)
  run(path.join(jdk, 'bin/javac.exe'), ['-J-Duser.language=en', '-J-Duser.country=US', '--release', '21', '-encoding', 'UTF-8', '-verbose',
    '-cp', classpath, '-sourcepath', path.join(repo, 'server/src/main/java'), '-d', classes, path.join(repo, tools[3])])
  const serverText = run(path.join(jdk, 'bin/java.exe'), ['-Djava.security.manager=allow', '-cp', `${classes}${path.delimiter}${classpath}`,
    'com.wuhan.eldercare.visit.VisitEvaluationJsonOfflineDriver', repo], JSON.stringify(manifest))
  const server = JSON.parse(serverText)
  save('java-execution-result.json', server)
  save('server-produced-response.json', server.responses)
  const stable = (v) => v && typeof v === 'object'
    ? Array.isArray(v) ? v.map(stable) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v
  const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
  // WRITE §4/§6: omitted unanswered optional values remain unanswered. Jackson's
  // request DTO re-projection includes nulls for absent record components. Only
  // these explicitly optional components may be added, and only as null.
  const optionalNullPaths = new Set(['ratings', 'feeExplanationClear', 'feeTopicExplanations',
    'careProcessObservations', 'likedTags', 'concernTags', 'comment',
    'careProcessObservations.careRecordLearned', 'careProcessObservations.handoverLearned',
    'careProcessObservations.handoverTopics'])
  const fieldsPreserved = (sent, bound, prefix = '') => {
    if (!sent || typeof sent !== 'object' || Array.isArray(sent)) return equal(sent, bound)
    if (!bound || typeof bound !== 'object' || Array.isArray(bound)) return false
    return Object.keys(sent).every((k) => Object.hasOwn(bound, k)
      && fieldsPreserved(sent[k], bound[k], prefix ? `${prefix}.${k}` : k))
      && Object.keys(bound).filter((k) => !Object.hasOwn(sent, k)).every((k) =>
        bound[k] === null && optionalNullPaths.has(prefix ? `${prefix}.${k}` : k))
  }
  const positive = []
  for (const item of requests) {
    const actual = server.requestResults.find((r) => r.caseId === item.caseId)
    const sent = JSON.parse(item.jsonText)
    const fieldEquality = actual?.boundBody && fieldsPreserved(sent, actual.boundBody)
    positive.push({ caseId: item.caseId, direction: 'CLIENT_TO_SERVER', actual,
      fieldsPreserved: !!fieldEquality, passed: actual?.accepted === true && actual.repositoryCalls === 1 && !!fieldEquality })
  }
  for (const item of server.responses) {
    const actual = client.consumeResponse(item.jsonText, scenario.visitId, item.responseType)
    let passed = actual.result?.kind === item.expectedKind
    if (item.expectedKind === 'submitted') passed &&= actual.result.receipt?.evaluationId === scenario.evaluationId
      && actual.result.receipt?.visitId === scenario.visitId && actual.result.receipt?.submittedAt === scenario.submittedAt
      && actual.result.replayed === item.expectedReplayed
    positive.push({ caseId: item.caseId, direction: 'SERVER_TO_CLIENT', expectedKind: item.expectedKind, actual, passed })
  }
  const negative = []
  for (const item of requestNegatives) {
    const actual = server.requestResults.find((r) => r.caseId === item.caseId)
    const rejected = actual?.accepted === false && actual.repositoryCalls === 0
      && (actual.rejectionPoint === 'Jackson.readValue' || actual.serviceResult?.code === 'VALIDATION_FAILED')
    negative.push({ CASE_ID: item.caseId, DIRECTION: item.direction, CONTRACT_BASIS: item.contractBasis,
      ACTUAL_JSON_PAYLOAD: item.jsonText, PRODUCTION_REJECTION_POINT: actual?.rejectionPoint,
      EXPECTED_RESULT: item.expectedResult, ACTUAL_RESULT: actual, passed: rejected })
  }
  for (const item of responseNegativeCases(server.responses)) {
    const actual = client.consumeResponse(item.jsonText, scenario.visitId, item.responseType)
    const rejected = actual.rejectionPoint === 'JSON.parse'
      || (item.responseType === 'submission' ? actual.result?.kind === 'technical_failure' : actual.result?.kind === 'load_error')
    negative.push({ CASE_ID: item.caseId, DIRECTION: item.direction, CONTRACT_BASIS: item.contractBasis,
      ACTUAL_JSON_PAYLOAD: item.jsonText, PRODUCTION_REJECTION_POINT: actual.rejectionPoint,
      EXPECTED_RESULT: item.expectedResult, ACTUAL_RESULT: actual, passed: rejected })
  }
  save('cross-consumption-results.json', positive)
  save('negative-case-results.json', negative)
  const sourcePaths = [...new Set([...client.sourcePaths, ...server.codecEvidence.sourcePaths,
    'server/pom.xml', 'server/src/main/resources/application.yml',
    'docs/architecture/VISIT_EVALUATION_PRODUCTION_WRITE_CONTRACT_V1.md',
    'docs/architecture/AUTHENTICATED_VISIT_EVALUATION_CONTEXT_CONTRACT_V1.md',
    'docs/architecture/VISIT_EVALUATION_NON_SENSITIVE_UI_CONTRACT_V1.md']
    .map((p) => path.relative(repo, path.resolve(repo, p)).replaceAll(path.sep, '/')))]
  const before = JSON.parse(readFileSync(path.join(audit, 'worktree-before.json'), 'utf8'))
  const bindFiles = (files) => files.map((p) => ({ path: p, sha256: hash(readFileSync(path.resolve(repo, p))),
    presentAtStart: Object.hasOwn(before.files, p), dirtyAtStart: before.status.split('\n').some((s) => s.slice(3) === p || s.slice(3) === `"${p}"`) }))
  const dependencyHashes = classpath.split(path.delimiter).map((p) => ({ path: p, sha256: hash(readFileSync(p)) }))
  const javaAttempts = server.codecEvidence.networkAttemptsBlocked
  const ioPass = client.ioGuardAttempts.length === 0 && javaAttempts === 0
    && client.runtimeEnvironment.guardCanary?.status === 'PASS'
    && server.codecEvidence.guardCanary?.blockedChecks === 2
  const result = { TASK: 'VISIT_EVALUATION_BIDIRECTIONAL_JSON_CONTRACT_GATE',
    RESULT: positive.every((r) => r.passed) && negative.every((r) => r.passed) && ioPass ? 'PASS' : 'FAIL',
    CLIENT_TO_SERVER_JSON: positive.filter((r) => r.direction === 'CLIENT_TO_SERVER').every((r) => r.passed) ? 'PASS' : 'FAIL',
    SERVER_TO_CLIENT_JSON: positive.filter((r) => r.direction === 'SERVER_TO_CLIENT').every((r) => r.passed) ? 'PASS' : 'FAIL',
    NEGATIVE_CONTRACT_CASES: negative.every((r) => r.passed) ? 'PASS' : 'FAIL', OFFLINE_ISOLATION: ioPass ? 'PASS' : 'FAIL',
    POSITIVE_CASES_PASSED: positive.filter((r) => r.passed).length, POSITIVE_CASES_TOTAL: positive.length,
    NEGATIVE_CASES_PASSED: negative.filter((r) => r.passed).length, NEGATIVE_CASES_TOTAL: negative.length,
    failures: [...positive, ...negative].filter((r) => !r.passed),
    environment: { node: process.version, jdk, client: { ...client.runtimeEnvironment,
      typescriptSha256: hash(readFileSync(client.runtimeEnvironment.typescriptPath)) }, java: server.codecEvidence },
    isolation: { clientGuardAttempts: client.ioGuardAttempts, javaNetworkAttempts: javaAttempts,
      repository: 'TEST_ONLY_CAPTURE_INTERFACE_NO_PERSISTENCE', noHttpServer: true, noDatabase: true },
    binding: { actualHead: before.head, sourceFiles: bindFiles(sourcePaths), toolFiles: bindFiles(tools), dependencyHashes,
      classpathSha256: hash(readFileSync(classpathFile)),
      generatedFiles: ['client-produced-request.json', 'server-produced-response.json', 'cross-consumption-results.json', 'negative-case-results.json']
        .map((p) => ({ path: path.join(out, p), sha256: hash(readFileSync(path.join(out, p))) })) },
  }
  save('runtime-gate-result.json', result)
  console.log(JSON.stringify({ RESULT: result.RESULT, positive: `${result.POSITIVE_CASES_PASSED}/${positive.length}`,
    negative: `${result.NEGATIVE_CASES_PASSED}/${negative.length}`, output: out }))
  process.exitCode = result.RESULT === 'PASS' ? 0 : 1
} catch (error) {
  save('blocked-result.json', { RESULT: 'BLOCKED', reason: error.message, stack: error.stack })
  console.error(error.message)
  process.exitCode = 2
}
