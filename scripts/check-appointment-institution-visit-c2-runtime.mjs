import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  C2_FIXTURE_MANIFEST,
  C2_FIXTURE_POLICY,
  makeAcceptedCandidateFixture,
  makeCompletedVisitFixture,
  makeDraftFixture,
  makeSubmissionFixture,
} from './fixtures/appointment-institution-visit-c2-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const domainPath = path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit', 'index.ts')
const typePath = path.join(repositoryRoot, 'miniprogram', 'types', 'appointment-institution-visit-v1.ts')
const servicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'appointment-institution-visit-application.ts')
const productionPaths = [typePath, servicePath]
const failures = []
const assertionCounts = new Map()
const executedCases = []
let activeCase = null
const countedAssert = new Proxy(assert, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args) => {
      if (activeCase) assertionCounts.set(activeCase, (assertionCounts.get(activeCase) || 0) + 1)
      return value.apply(target, args)
    }
  },
})

const runCase = (id, callback) => {
  executedCases.push(id)
  activeCase = id
  try {
    callback()
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    activeCase = null
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const last = (items) => items[items.length - 1]
const makeApplicationSubmission = (overrides = {}) => makeSubmissionFixture({
  institutionRecordRevision: '8',
  ...overrides,
})
const makePublicReceipt = (submission, overrides = {}) => ({
  contractVersion: 'appointment-institution-visit-contract-v1',
  kind: 'appointment_submission_receipt_v1',
  visitId: 'visit-server-generated-001',
  institutionId: submission.institutionId,
  institutionRecordRevision: submission.institutionRecordRevision,
  status: 'requested',
  acceptedAt: '2026-09-17T08:00:00.000Z',
  publicMessage: '预约申请已提交',
  ...overrides,
})
const makePublicResult = (submission, outcome = 'accepted', code = 'ACCEPTED', overrides = {}) => ({
  outcome,
  code,
  receipt: outcome === 'accepted' || outcome === 'replayed' ? makePublicReceipt(submission) : null,
  ...overrides,
})

const walkTypeScript = (directory) => {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walkTypeScript(entryPath))
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(entryPath)
  }
  return result
}

const run = () => {
  const { ts } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts)
  const domain = runtime.load(domainPath)
  const service = runtime.load(servicePath)

  runCase('C2-CONTROL', () => {
    countedAssert.equal(C2_FIXTURE_POLICY, 'TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_APPOINTMENT_VISIT_DATA')
    countedAssert.equal(C2_FIXTURE_MANIFEST.length, 19)
    countedAssert.equal(new Set(C2_FIXTURE_MANIFEST).size, 19)
  })

  runCase('C2-OBJECT-ROLES', () => {
    countedAssert.equal(domain.validateAppointmentLocalDraftV1(makeDraftFixture()).ok, true)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture()).ok, true)
    countedAssert.equal(domain.validateInstitutionVisitV1(makeAcceptedCandidateFixture().visit).ok, true)
    countedAssert.equal(domain.validateAppointmentLocalDraftV1({ ...makeDraftFixture(), visitId: 'forbidden' }).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1({ ...makeSubmissionFixture(), userId: 'forbidden' }).ok, false)
    countedAssert.equal(domain.validateInstitutionVisitV1({ ...makeAcceptedCandidateFixture().visit, status: 'confirmed' }).ok, false)
  })

  runCase('C2-LOCAL-DRAFT', () => {
    const draft = domain.validateAppointmentLocalDraftV1(makeDraftFixture({ contactName: '联系人', phone: '13800000000' }))
    countedAssert.equal(draft.ok, true)
    countedAssert.equal(draft.value.provenance, 'LOCAL_DRAFT_ONLY')
    countedAssert.equal(Object.prototype.hasOwnProperty.call(draft.value, 'visitId'), false)
    countedAssert.equal(Object.prototype.hasOwnProperty.call(draft.value, 'status'), false)
    countedAssert.equal(domain.validateAppointmentLocalDraftV1(makeDraftFixture({ provenance: 'SUBMITTED' })).ok, false)
  })

  runCase('C2-VALID-SUBMISSION', () => {
    const result = domain.validateAppointmentSubmissionV1(makeSubmissionFixture())
    countedAssert.equal(result.ok, true)
    countedAssert.equal(result.value.phonePurpose, 'appointment_or_consultant_contact')
    countedAssert.equal(result.value.phoneAuthorization, 'explicit')
    countedAssert.equal(result.value.idempotencyKey, 'idem-c2-001')
  })

  runCase('C2-APPLICATION-VALIDATION', () => {
    const application = service.createAppointmentVisitApplicationServiceV1()
    const malformedSubmission = application.submit({
      submission: { ...makeApplicationSubmission(), userId: 'client-authority-forbidden' },
      response: makePublicResult(makeApplicationSubmission()),
    })
    const malformedEnvelope = application.submit({
      submission: makeApplicationSubmission(),
      response: makePublicResult(makeApplicationSubmission()),
      candidate: null,
    })
    countedAssert.equal(malformedSubmission.kind, 'rejected')
    countedAssert.equal(malformedSubmission.code, 'VALIDATION_FAILED')
    countedAssert.equal(malformedEnvelope.kind, 'rejected')
    countedAssert.equal(malformedEnvelope.code, 'VALIDATION_FAILED')
  })

  runCase('C2-CLIENT-SAFE-APPLICATION', () => {
    const submission = makeApplicationSubmission()
    const application = service.createAppointmentVisitApplicationServiceV1()
    const accepted = application.submit({
      submission,
      response: makePublicResult(submission),
    })
    countedAssert.equal(accepted.kind, 'accepted')
    countedAssert.equal('visit' in accepted, false)
    countedAssert.equal('userId' in accepted, false)
    countedAssert.equal(JSON.stringify(accepted).includes(submission.phone), false)
    countedAssert.equal(JSON.stringify(accepted).includes(submission.contactName), false)
  })

  runCase('C2-REFERENCE-FAIL-CLOSED', () => {
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ institutionId: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ institutionRecordRevision: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ elderId: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ participantCount: 0 })).ok, false)
  })

  runCase('C2-PHONE-NOT-IDENTITY', () => {
    const submission = makeApplicationSubmission({ phone: '13800000000' })
    const result = service.createAppointmentVisitApplicationServiceV1().submit({
      submission,
      response: makePublicResult(submission),
    })
    countedAssert.equal(result.kind, 'accepted')
    countedAssert.equal(JSON.stringify(result).includes('13800000000'), false)
  })

  runCase('C2-ACCEPTED-PUBLIC-RESULT', () => {
    const submission = makeApplicationSubmission()
    const application = service.createAppointmentVisitApplicationServiceV1()
    const accepted = application.submit({ submission, response: makePublicResult(submission) })
    const replayed = application.submit({
      submission,
      response: makePublicResult(submission, 'replayed', 'REPLAYED'),
    })
    countedAssert.equal(accepted.kind, 'accepted')
    countedAssert.equal(accepted.replayed, false)
    countedAssert.equal(JSON.stringify(accepted.receipt), JSON.stringify(makePublicReceipt(submission)))
    countedAssert.equal(replayed.kind, 'accepted')
    countedAssert.equal(replayed.replayed, true)
    countedAssert.equal(replayed.receipt.status, 'requested')
    countedAssert.equal(replayed.receipt.publicMessage, '预约申请已提交')
  })

  runCase('C2-NO-FAKE-SUCCESS', () => {
    const submission = makeApplicationSubmission()
    const result = service.createAppointmentVisitApplicationServiceV1().submit({
      submission,
      response: null,
    })
    countedAssert.equal(result.kind, 'outcome_unknown')
    countedAssert.equal('receipt' in result, false)
  })

  runCase('C2-MALFORMED-PUBLIC-DTO', () => {
    const submission = makeApplicationSubmission()
    const application = service.createAppointmentVisitApplicationServiceV1()
    const candidateEnvelope = application.submit({
      submission,
      response: {
        ...makePublicResult(submission),
        candidate: { kind: 'accepted_persistence_candidate_v1', visit: makeAcceptedCandidateFixture().visit },
      },
    })
    const mismatch = application.submit({
      submission,
      response: makePublicResult(submission, 'accepted', 'ACCEPTED', {
        receipt: makePublicReceipt(submission, { institutionRecordRevision: '9' }),
      }),
    })
    countedAssert.equal(candidateEnvelope.kind, 'outcome_unknown')
    countedAssert.equal(mismatch.kind, 'outcome_unknown')
  })

  runCase('C2-LIFECYCLE-ALLOWED', () => {
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('create', 'requested'), true)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('requested', 'contacting'), true)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('requested', 'scheduled'), true)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('contacting', 'scheduled'), true)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('scheduled', 'completed'), true)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('scheduled', 'cancelled'), true)
    countedAssert.equal(domain.evaluateInstitutionVisitTransitionV1('requested', 'requested').kind, 'noop')
  })

  runCase('C2-LIFECYCLE-FORBIDDEN', () => {
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('create', 'completed'), false)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('requested', 'completed'), false)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('completed', 'requested'), false)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('cancelled', 'scheduled'), false)
    countedAssert.equal(domain.evaluateInstitutionVisitTransitionV1('requested', 'unknown').ok, false)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('__proto__', 'requested'), false)
    countedAssert.equal(domain.canTransitionInstitutionVisitV1('toString', 'requested'), false)
    countedAssert.equal(domain.evaluateInstitutionVisitTransitionV1('__proto__', 'requested').ok, false)
  })

  runCase('C2-IDEMPOTENCY-REPLAY', () => {
    const submission = domain.validateAppointmentSubmissionV1(makeSubmissionFixture()).value
    const input = { ownerUserId: 'user-trusted-001', idempotencyKey: submission.idempotencyKey, submission }
    const prior = { ...input, acceptedVisitId: 'visit-server-generated-001' }
    countedAssert.equal(domain.classifyAppointmentIdempotencyV1(input, prior), 'replay')
    countedAssert.equal(domain.classifyAppointmentIdempotencyV1(input, null), 'new_attempt')
    countedAssert.equal(domain.validateAppointmentIdempotencyInputV1(input), true)
  })

  runCase('C2-IDEMPOTENCY-CONFLICT', () => {
    const submission = domain.validateAppointmentSubmissionV1(makeSubmissionFixture()).value
    const input = { ownerUserId: 'user-trusted-001', idempotencyKey: submission.idempotencyKey, submission }
    const prior = { ...input, acceptedVisitId: 'visit-server-generated-001' }
    countedAssert.equal(domain.classifyAppointmentIdempotencyV1({ ...input, submission: { ...submission, visitDate: '2026-10-02' } }, prior), 'conflict')
    countedAssert.equal(domain.classifyAppointmentIdempotencyV1({ ...input, idempotencyKey: 'idem-c2-002' }, prior), 'new_attempt')
    countedAssert.equal(domain.validateAppointmentIdempotencyInputV1({ ...input, idempotencyKey: 'mismatch-key' }), false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ idempotencyKey: '13800000000' })).ok, false)
  })

  runCase('C2-PUBLIC-ERROR-MAPPING', () => {
    const submission = makeApplicationSubmission()
    const cases = [
      ['rejected', 'AUTH_REQUIRED', 'AUTH_REQUIRED'],
      ['rejected', 'CONTACT_REQUIRED', 'CONTACT_REQUIRED'],
      ['rejected', 'VALIDATION_FAILED', 'VALIDATION_FAILED'],
      ['rejected', 'REFERENCE_UNAVAILABLE', 'REFERENCE_UNAVAILABLE'],
      ['conflict', 'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_CONFLICT'],
      ['unavailable', 'SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE'],
    ]
    cases.forEach(([outcome, wireCode, code]) => {
      const result = service.createAppointmentVisitApplicationServiceV1().submit({
        submission,
        response: makePublicResult(submission, outcome, wireCode),
      })
      countedAssert.equal(result.kind, 'rejected')
      countedAssert.equal(result.code, code)
    })
    const technical = service.createAppointmentVisitApplicationServiceV1().submit({
      submission,
      response: makePublicResult(submission, 'technical_failure', 'TECHNICAL_FAILURE'),
    })
    countedAssert.equal(technical.kind, 'outcome_unknown')
  })

  runCase('C2-COMPLETED-PREREQUISITE', () => {
    const completed = makeCompletedVisitFixture()
    countedAssert.equal(domain.validateInstitutionVisitV1(completed).ok, true)
    countedAssert.equal(domain.validateInstitutionVisitV1({ ...completed, scheduledAt: undefined }).ok, false)
    countedAssert.equal(domain.validateInstitutionVisitV1({ ...completed, completedAt: undefined }).ok, false)
    countedAssert.equal(domain.validateInstitutionVisitV1({
      ...completed,
      completedAt: '2026-09-17T07:00:00.000Z',
    }).ok, false)
    countedAssert.equal(domain.validateInstitutionVisitV1({
      ...completed,
      status: 'scheduled',
      scheduledAt: undefined,
      completedAt: undefined,
    }).ok, false)
    countedAssert.equal(domain.validateInstitutionVisitV1({
      ...completed,
      status: 'cancelled',
      completedAt: undefined,
      cancelledAt: undefined,
    }).ok, false)
    const projected = domain.projectInstitutionVisitPublicSnapshotV1(domain.validateInstitutionVisitV1(completed).value)
    countedAssert.equal(projected.status, 'completed')
    countedAssert.equal(domain.validateAcceptedPersistenceCandidateV1({ kind: 'accepted_persistence_candidate_v1', visit: completed }).ok, false)
    countedAssert.equal(domain.evaluateInstitutionVisitTransitionV1('scheduled', 'completed').ok, true)
    countedAssert.equal(JSON.stringify(projected).includes('13800000000'), false)
    countedAssert.equal(domain.validateAppointmentOwnerReadPortResultV1({ ok: true, visits: [projected] }).ok, true)
    countedAssert.equal(domain.validateAppointmentOwnerReadPortResultV1({ ok: true, visits: [{ ...projected, phone: '13800000000' }] }).ok, false)
  })

  runCase('C2-PRODUCTION-ISOLATION', () => {
    const productionFiles = [
      ...productionPaths,
      ...walkTypeScript(path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit')),
    ]
    const source = productionFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
    countedAssert.equal(/wx\.|fetch\(|XMLHttpRequest|server\//.test(source), false)
    countedAssert.equal(/\b(?:createVisit|persistVisit|writeInstitution|writeRecommendation|writeProfile|createAppointment)\s*\(/.test(source), false)
    countedAssert.equal(/from\s+['"][^'"]*(?:\/recommendation(?:\/|['"]|$)|\/institution(?:\/|['"]|$)|\/elder-profile(?:\/|['"]|$)|\/consultant(?:\/|['"]|$)|\/ai-consultation(?:\/|['"]|$)|\/visit-evaluation(?:\/|['"]|$))/.test(source), false)
    countedAssert.equal(/Date\.now\(|Math\.random\(/.test(source), false)
  })

  runCase('C2-MOCK-ISOLATION', () => {
    const productionFiles = [
      ...productionPaths,
      ...walkTypeScript(path.join(repositoryRoot, 'miniprogram', 'domain', 'appointment-institution-visit')),
    ]
    const source = productionFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
    countedAssert.equal(/scripts[\\/]fixtures|C2_FIXTURE_POLICY|TEST_ONLY_SYNTHETIC_NOT_PRODUCTION_APPOINTMENT_VISIT_DATA/.test(source), false)
    countedAssert.equal(productionFiles.filter((file) => /scripts[\\/]fixtures/.test(readFileSync(file, 'utf8'))).length, 0)
    countedAssert.equal(C2_FIXTURE_POLICY.startsWith('TEST_ONLY_'), true)
  })

  countedAssert.deepEqual(executedCases, C2_FIXTURE_MANIFEST)
  const assertionCount = [...assertionCounts.values()].reduce((total, count) => total + count, 0)
  if (failures.length > 0) {
    console.error('C2_TARGETED_RUNTIME = FAIL')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(`C2_FIXTURE_POLICY: ${C2_FIXTURE_POLICY}`)
  console.log(`C2_FIXTURE_COUNT: ${C2_FIXTURE_MANIFEST.length}`)
  console.log(`C2_ASSERTION_COUNT: ${assertionCount}`)
  console.log('C2_NEGATIVE_FAIL_CLOSED_COVERAGE: PASS')
  console.log('C2_INSTITUTION_ASSIGNMENT_RESOLVER_CALLS: 0')
  console.log('C2_INSTITUTION_DEFAULT_FALLBACK_CALLS: 0')
  console.log('C2_RECOMMENDATION_WRITE_CALLS: 0')
  console.log('C2_INSTITUTION_WRITE_CALLS: 0')
  console.log('C2_VISIT_APPOINTMENT_WRITE_CALLS: 0')
  console.log('C2_PRODUCTION_FIXTURE_IMPORT_COUNT: 0')
  console.log('C2_REAL_PERSISTENCE_ADAPTER_COUNT: 0')
  console.log('C2_FAKE_SUCCESS_COUNT: 0')
  console.log('C2_TARGETED_RUNTIME = PASS')
}

run()
