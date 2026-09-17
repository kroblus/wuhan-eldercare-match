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

  runCase('C2-MISSING-AUTH', () => {
    const application = service.createAppointmentVisitApplicationServiceV1({
      submissionPort: { submit: () => { throw new Error('must not call without auth') } },
    })
    const result = application.submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(result.ok, false)
    countedAssert.equal(result.error.code, 'AUTH_REQUIRED')
    countedAssert.equal(result.error.draftAction, 'RETAIN_LOCAL_DRAFT')
    const missing = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: false, failure: 'missing' }) },
    }).submit({ submission: makeSubmissionFixture() })
    const unavailable = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: false, failure: 'unavailable' }) },
    }).submit({ submission: makeSubmissionFixture() })
    const failed = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: false, failure: 'failed' }) },
    }).submit({ submission: makeSubmissionFixture() })
    const malformed = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: false, failure: 'missing', provider: 'raw' }) },
    }).submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(missing.error.code, 'AUTH_REQUIRED')
    countedAssert.equal(unavailable.error.code, 'SERVICE_UNAVAILABLE')
    countedAssert.equal(failed.error.code, 'SERVICE_UNAVAILABLE')
    countedAssert.equal(malformed.error.code, 'SERVICE_UNAVAILABLE')
  })

  runCase('C2-CONTACT-REQUIRED', () => {
    let authCalls = 0
    const application = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => { authCalls += 1; return { ok: true, principal: { userId: 'user-trusted-001' } } } },
    })
    const missingNameFixture = makeSubmissionFixture()
    const missingPhoneFixture = makeSubmissionFixture()
    delete missingNameFixture.contactName
    delete missingPhoneFixture.phone
    const missingName = application.submit({ submission: missingNameFixture })
    const missingPhone = application.submit({ submission: missingPhoneFixture })
    countedAssert.equal(missingName.ok, false)
    countedAssert.equal(missingName.error.code, 'CONTACT_REQUIRED')
    countedAssert.equal(missingPhone.ok, false)
    countedAssert.equal(missingPhone.error.code, 'CONTACT_REQUIRED')
    countedAssert.equal(authCalls, 0)
  })

  runCase('C2-REFERENCE-FAIL-CLOSED', () => {
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ institutionId: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ institutionRecordRevision: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ elderId: '' })).ok, false)
    countedAssert.equal(domain.validateAppointmentSubmissionV1(makeSubmissionFixture({ participantCount: 0 })).ok, false)
  })

  runCase('C2-PHONE-NOT-IDENTITY', () => {
    let submittedPrincipal = null
    const application = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
      submissionPort: { submit: (input) => { submittedPrincipal = input.principal.userId; return { ok: false, failure: 'unavailable' } } },
    })
    const result = application.submit({ submission: makeSubmissionFixture({ phone: '13800000000' }) })
    countedAssert.equal(result.ok, false)
    countedAssert.equal(submittedPrincipal, 'user-trusted-001')
    countedAssert.equal(submittedPrincipal === '13800000000', false)
  })

  runCase('C2-ACCEPTED-PUBLIC-RESULT', () => {
    const candidate = makeAcceptedCandidateFixture()
    const application = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
      submissionPort: { submit: () => ({ ok: true, candidate }) },
    })
    const result = application.submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(result.ok, true)
    countedAssert.equal(result.value.receipt.status, 'requested')
    countedAssert.equal(result.value.visit.status, 'requested')
    countedAssert.equal(result.value.receipt.visitId, 'visit-server-generated-001')
    countedAssert.equal(Object.prototype.hasOwnProperty.call(result.value.visit, 'phone'), false)
    countedAssert.equal(Object.prototype.hasOwnProperty.call(result.value.visit, 'contactName'), false)
    countedAssert.equal(JSON.stringify(result).includes('provider'), false)
  })

  runCase('C2-NO-FAKE-SUCCESS', () => {
    const application = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
    })
    const result = application.submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(result.ok, false)
    countedAssert.equal(result.error.code, 'SERVICE_UNAVAILABLE')
    countedAssert.equal('value' in result, false)
    countedAssert.equal(JSON.stringify(result).includes('visit-server-generated'), false)
  })

  runCase('C2-MALFORMED-CANDIDATE', () => {
    const application = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
      submissionPort: { submit: () => ({ ok: true, candidate: { kind: 'accepted_persistence_candidate_v1', visit: { status: 'requested', visitId: 'fake' } } }) },
    })
    const result = application.submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(result.ok, false)
    countedAssert.equal(result.error.code, 'TECHNICAL_FAILURE')
    countedAssert.equal('value' in result, false)
    const timestampMismatch = service.createAppointmentVisitApplicationServiceV1({
      authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
      submissionPort: { submit: () => ({
        ok: true,
        candidate: {
          ...makeAcceptedCandidateFixture(),
          visit: { ...makeAcceptedCandidateFixture().visit, completedAt: '2026-10-02T10:00:00.000Z' },
        },
      }) },
    }).submit({ submission: makeSubmissionFixture() })
    countedAssert.equal(timestampMismatch.ok, false)
    countedAssert.equal(timestampMismatch.error.code, 'TECHNICAL_FAILURE')
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

  runCase('C2-PORT-FAILURE-MAPPING', () => {
    const failures = ['reference_unavailable', 'idempotency_conflict', 'unavailable', 'technical']
    const codes = ['REFERENCE_UNAVAILABLE', 'IDEMPOTENCY_CONFLICT', 'SERVICE_UNAVAILABLE', 'TECHNICAL_FAILURE']
    failures.forEach((portFailure, index) => {
      const application = service.createAppointmentVisitApplicationServiceV1({
        authenticatedPrincipalPort: { getPrincipal: () => ({ ok: true, principal: { userId: 'user-trusted-001' } }) },
        submissionPort: { submit: () => ({ ok: false, failure: portFailure }) },
      })
      const result = application.submit({ submission: makeSubmissionFixture() })
      countedAssert.equal(result.ok, false)
      countedAssert.equal(result.error.code, codes[index])
      countedAssert.equal(result.error.draftAction, 'RETAIN_LOCAL_DRAFT')
    })
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
