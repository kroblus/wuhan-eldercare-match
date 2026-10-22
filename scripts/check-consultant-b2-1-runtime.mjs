import nodeAssert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createWechatTsRuntime,
  loadWechatTypeScript,
} from './support/load-wechat-ts-runtime.mjs'
import {
  CONSULTANT_B2_1_FIXTURE_CONTROL,
  CONSULTANT_B2_1_FIXTURE_MANIFEST,
  CONSULTANT_B2_1_FIXTURE_POLICY,
  consultantB2_1FixtureConstants,
  makeGlobalConsultantConfigurationFixture,
  makeGlobalConsultantProfileFixture,
  makeGlobalConsultantProvider,
} from './fixtures/consultant-b2-1-fixtures.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const consultantDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'consultant')
const consultantTypesPath = path.join(repositoryRoot, 'miniprogram', 'types', 'consultant-v1.ts')
const consultantServicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'consultant-application.ts')
const globalDomainPath = path.join(consultantDomainRoot, 'global-consultant.ts')
const failures = []
const caseIds = []
const assertionCounts = new Map()
let activeCaseId = null
const assert = new Proxy(nodeAssert, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args) => {
      if (activeCaseId !== null) {
        assertionCounts.set(activeCaseId, (assertionCounts.get(activeCaseId) || 0) + 1)
      }
      return value.apply(target, args)
    }
  },
})

const clone = (value) => JSON.parse(JSON.stringify(value))

const runCase = (id, test) => {
  caseIds.push(id)
  activeCaseId = id
  try {
    test()
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    activeCaseId = null
  }
  const count = assertionCounts.get(id) || 0
  if (count < CONSULTANT_B2_1_FIXTURE_CONTROL.minimumAssertionsPerCase) {
    failures.push(`${id}: expected at least ${CONSULTANT_B2_1_FIXTURE_CONTROL.minimumAssertionsPerCase} assertion(s), got ${count}`)
  }
}

const assertGlobalSnapshot = (result, expectedSelectionStatus, expectedResolutionStatus, consultantPresent) => {
  assert.equal(result.ok, true)
  assert.deepEqual(Object.keys(result.value).sort(), [
    'consultant',
    'context',
    'contractVersion',
    'dataProvenance',
    'kind',
    'resolutionStatus',
    'selectionStatus',
    'snapshotAsOf',
  ])
  assert.equal(result.value.context.kind, 'platform_global_consultant')
  assert.equal(result.value.context.selectionRole, 'platform_primary_consultant')
  assert.equal(result.value.context.selectionSource, 'platform_configuration')
  assert.equal(result.value.selectionStatus, expectedSelectionStatus)
  assert.equal(result.value.resolutionStatus, expectedResolutionStatus)
  assert.equal(result.value.consultant !== null, consultantPresent)
  assert.equal('institutionId' in result.value, false)
  assert.equal('recordRevision' in result.value, false)
  assert.equal('assignmentSource' in result.value, false)
  const serialized = JSON.stringify(result.value)
  ;[
    'institutionId',
    'recordRevision',
    'assignment',
    'default_consultant',
    'wechatQrMediaId',
    'internalMediaId',
    'privateNotes',
    'auditMetadata',
    'credentials',
    'User.phone',
  ].forEach((forbidden) => assert.equal(serialized.includes(forbidden), false, `forbidden field ${forbidden}`))
}

const assertFailure = (result) => {
  assert.equal(result.ok, false)
  assert.equal(result.error.kind, 'global_consultant_public_application_failure_v1')
  assert.equal(result.error.status, 'unavailable')
}

const run = async () => {
  const { ts } = loadWechatTypeScript()
  const runtime = createWechatTsRuntime(ts)
  const domain = runtime.load(path.join(consultantDomainRoot, 'index.ts'))
  const serviceModule = runtime.load(consultantServicePath)
  const globalServiceFactory = serviceModule.createGlobalConsultantApplicationServiceV1
  const {
    BASE_GLOBAL_CONSULTANT_ID,
    BASE_SNAPSHOT_AS_OF,
    DEFAULT_CONSULTANT_ID,
  } = consultantB2_1FixtureConstants

  const isolationCounters = {
    institutionAssignmentResolverCalls: 0,
    institutionDefaultFallbackCalls: 0,
  }
  const isolationProvider = (overrides = {}) => makeGlobalConsultantProvider({
    loadAssignments: () => {
      isolationCounters.institutionAssignmentResolverCalls += 1
      throw new Error('Global path must not read Institution assignments')
    },
    loadDefaultConsultant: () => {
      isolationCounters.institutionDefaultFallbackCalls += 1
      throw new Error('Global path must not read Institution default')
    },
    ...overrides,
  })

  assert.equal(CONSULTANT_B2_1_FIXTURE_POLICY, 'TEST_FIXTURE_ONLY_NOT_REAL_GLOBAL_CONSULTANT_DATA')
  assert.equal(CONSULTANT_B2_1_FIXTURE_MANIFEST.length, CONSULTANT_B2_1_FIXTURE_CONTROL.expectedCount)
  assert.equal(new Set(CONSULTANT_B2_1_FIXTURE_MANIFEST).size, CONSULTANT_B2_1_FIXTURE_CONTROL.expectedCount)

  runCase('B2.1-CONFIG-001', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1(
      makeGlobalConsultantConfigurationFixture(),
    )
    assert.equal(result.ok, true)
    assert.equal(JSON.stringify(result.value), JSON.stringify(makeGlobalConsultantConfigurationFixture()))
  })
  runCase('B2.1-CONFIG-002', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1(null)
    assert.equal(result.ok, true)
    assert.equal(JSON.stringify(result.value), JSON.stringify({ role: 'platform_primary_consultant', sourceState: 'missing' }))
  })
  runCase('B2.1-CONFIG-003', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1({
      role: 'wrong_role',
      sourceState: 'configured',
      consultantId: BASE_GLOBAL_CONSULTANT_ID,
    })
    assert.equal(result.ok, false)
  })
  runCase('B2.1-CONFIG-004', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1({
      role: 'platform_primary_consultant',
      sourceState: 'configured',
      consultantId: 'x',
    })
    assert.equal(result.ok, false)
  })
  runCase('B2.1-CONFIG-005', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1({
      role: 'platform_primary_consultant',
      sourceState: 'unknown',
    })
    assert.equal(result.ok, true)
    assert.equal(result.value.sourceState, 'unknown')
  })
  runCase('B2.1-CONFIG-006', () => {
    const result = domain.validateGlobalConsultantSelectionConfigurationV1({
      role: 'platform_primary_consultant',
      sourceState: 'configured',
      consultantId: BASE_GLOBAL_CONSULTANT_ID,
      secondConsultantId: 'consultant-other-b2-1',
    })
    assert.equal(result.ok, false)
  })

  runCase('B2.1-SELECT-001', () => {
    const result = domain.resolveGlobalConsultantSelectionV1({
      role: 'platform_primary_consultant',
      sourceState: 'configured',
      consultantId: BASE_GLOBAL_CONSULTANT_ID,
    })
    assert.equal(result.status, 'configured')
    assert.equal(result.consultantId, BASE_GLOBAL_CONSULTANT_ID)
  })
  runCase('B2.1-SELECT-002', () => {
    const result = domain.resolveGlobalConsultantSelectionV1({
      role: 'platform_primary_consultant',
      sourceState: 'missing',
    })
    assert.equal(result.status, 'missing')
    assert.equal(result.consultantId, null)
  })
  runCase('B2.1-SELECT-003', () => {
    const result = globalServiceFactory(isolationProvider()).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'available', true)
    assert.equal(isolationCounters.institutionAssignmentResolverCalls, 0)
    assert.equal(isolationCounters.institutionDefaultFallbackCalls, 0)
  })

  runCase('B2.1-PROFILE-001', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: () => null,
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'missing', false)
  })
  runCase('B2.1-PROFILE-002', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({ consultantId, serviceStatus: 'inactive' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'inactive', false)
  })
  runCase('B2.1-PROFILE-003', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({ consultantId, serviceStatus: 'unknown' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'unknown', false)
  })

  runCase('B2.1-PROJECTION-001', () => {
    const result = globalServiceFactory(isolationProvider()).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assert.equal(result.ok, true)
    assert.deepEqual(Object.keys(result.value.consultant).sort(), [
      'consultantId',
      'displayName',
      'enterpriseWechatQr',
      'phone',
      'serviceAreaDisplayName',
      'serviceStatus',
    ])
    assert.equal(result.value.consultant.phone.status, 'available')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'available')
  })
  runCase('B2.1-PROJECTION-002', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
      }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'available', true)
    assert.equal(result.value.consultant.phone.status, 'unavailable')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'available')
  })
  runCase('B2.1-PROJECTION-003', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2-1-expired',
          reviewStatus: 'approved',
          lifecycleStatus: 'expired',
        },
      }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'expired', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'expired')
  })
  runCase('B2.1-PROJECTION-004', () => {
    const result = globalServiceFactory(isolationProvider({
      loadGlobalConsultantConfiguration: () => ({ role: 'platform_primary_consultant', sourceState: 'missing' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'missing', 'missing', false)
  })
  runCase('B2.1-PROJECTION-005', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: { sourceState: 'unavailable' },
      }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'unavailable', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'unavailable')
    assert.equal(result.value.consultant.enterpriseWechatQr.actionAvailable, false)
  })
  runCase('B2.1-PROJECTION-006', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2-1-pending',
          reviewStatus: 'pending_review',
          lifecycleStatus: 'active',
        },
      }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'unavailable', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'unavailable')
    assert.equal(result.value.consultant.enterpriseWechatQr.actionAvailable, false)
  })

  runCase('B2.1-FAILURE-001', () => {
    const result = globalServiceFactory(isolationProvider({
      loadGlobalConsultantConfiguration: () => ({ role: 'platform_primary_consultant', sourceState: 'unavailable' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'unavailable', 'unavailable', false)
  })
  runCase('B2.1-FAILURE-002', () => {
    const result = globalServiceFactory(isolationProvider({
      loadGlobalConsultantConfiguration: () => ({ role: 'platform_primary_consultant', sourceState: 'unknown' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'unknown', 'unknown', false)
  })
  runCase('B2.1-FAILURE-003', () => {
    const result = globalServiceFactory(isolationProvider({
      loadGlobalConsultantConfiguration: () => ({ role: 'platform_primary_consultant', sourceState: 'configured' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-004', () => {
    const result = globalServiceFactory(isolationProvider({
      loadGlobalConsultantConfiguration: () => { throw new Error('synthetic global configuration provider failure') },
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-005', () => {
    const result = globalServiceFactory(isolationProvider({
      dataProvenance: 'INVALID_PROVENANCE',
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-006', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: () => { throw new Error('synthetic global profile provider failure') },
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-007', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: () => makeGlobalConsultantProfileFixture({ consultantId: 'consultant-other-b2-1' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-008', () => {
    const result = globalServiceFactory(isolationProvider({
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({ consultantId, serviceStatus: 'unavailable' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-009', () => {
    const result = globalServiceFactory(isolationProvider({
      resolvePublicMedia: () => ({ status: 'available', publicImageUrl: 'http://invalid.example/qr.png' }),
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })
  runCase('B2.1-FAILURE-010', () => {
    const result = globalServiceFactory(isolationProvider({
      resolvePublicMedia: () => { throw new Error('synthetic global media provider failure') },
    })).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertFailure(result)
  })

  runCase('B2.1-ISOLATION-001', () => {
    const provider = isolationProvider({
      loadGlobalConsultantConfiguration: () => makeGlobalConsultantConfigurationFixture({
        consultantId: DEFAULT_CONSULTANT_ID,
      }),
      loadConsultantProfile: (consultantId) => makeGlobalConsultantProfileFixture({ consultantId }),
    })
    const result = globalServiceFactory(provider).resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assertGlobalSnapshot(result, 'configured', 'available', true)
    assert.equal(result.value.consultant.consultantId, DEFAULT_CONSULTANT_ID)
    assert.equal(isolationCounters.institutionAssignmentResolverCalls, 0)
    assert.equal(isolationCounters.institutionDefaultFallbackCalls, 0)
  })
  runCase('B2.1-ISOLATION-002', () => {
    const result = globalServiceFactory(isolationProvider()).resolveGlobal({
      snapshotAsOf: BASE_SNAPSHOT_AS_OF,
      institutionIdentity: { institutionId: 'institution-forbidden', recordRevision: 1 },
    })
    assertFailure(result)
    assert.equal(isolationCounters.institutionAssignmentResolverCalls, 0)
    assert.equal(isolationCounters.institutionDefaultFallbackCalls, 0)
  })
  runCase('B2.1-ISOLATION-003', () => {
    const provider = isolationProvider()
    const service = globalServiceFactory(provider)
    const first = service.resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    const second = service.resolveGlobal({ snapshotAsOf: BASE_SNAPSHOT_AS_OF })
    assert.equal(JSON.stringify(second), JSON.stringify(clone(first)))
    assert.equal(isolationCounters.institutionAssignmentResolverCalls, 0)
    assert.equal(isolationCounters.institutionDefaultFallbackCalls, 0)
  })
  runCase('B2.1-ISOLATION-004', () => {
    const productionGraphPaths = [
      consultantTypesPath,
      path.join(consultantDomainRoot, 'index.ts'),
      globalDomainPath,
      path.join(consultantDomainRoot, 'project-consultant.ts'),
      consultantServicePath,
    ]
    productionGraphPaths.forEach((productionPath) => {
      const source = readFileSync(productionPath, 'utf8')
      assert.equal(/(?:scripts[\\/]fixtures|miniprogram[\\/]mock)/.test(source), false, `fixture/mock import in ${productionPath}`)
      assert.equal(/\b(?:Date\.now|Math\.random|new\s+Date)\s*\(/.test(source), false, `non-determinism in ${productionPath}`)
      assert.equal(/\bwx\s*\./.test(source), false, `wx dependency in ${productionPath}`)
    })
    const globalDomainSource = readFileSync(globalDomainPath, 'utf8')
    assert.equal(/(?:loadAssignments|loadDefaultConsultant|institutionId|recordRevision)/.test(globalDomainSource), false)
    const globalServiceSource = readFileSync(consultantServicePath, 'utf8')
    assert.equal(/from ['"]\.\.\/domain\/recommendation/.test(globalServiceSource), false)
    assert.equal(/from ['"]\.\.\/domain\/institution/.test(globalServiceSource), false)
  })

  assert.deepEqual(caseIds, CONSULTANT_B2_1_FIXTURE_MANIFEST, 'fixture manifest must match executed case order')
  assert.equal(BASE_GLOBAL_CONSULTANT_ID, 'consultant-global-b2-1')

  if (failures.length > 0) {
    console.error(`CONSULTANT B2.1 RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`CONSULTANT_B2_1_FIXTURES: ${caseIds.length} executed`)
  console.log(`CONSULTANT_B2_1_ASSERTIONS: ${Array.from(assertionCounts.values()).reduce((total, count) => total + count, 0)}`)
  console.log(`INSTITUTION_ASSIGNMENT_RESOLVER_CALLS: ${isolationCounters.institutionAssignmentResolverCalls}`)
  console.log(`INSTITUTION_DEFAULT_FALLBACK_CALLS: ${isolationCounters.institutionDefaultFallbackCalls}`)
  console.log('INSTITUTION_ID_DEPENDENCY: 0')
  console.log('RECORD_REVISION_DEPENDENCY: 0')
  console.log('GLOBAL_CONTEXT_ISOLATION = PASS')
  console.log('CONSULTANT_B2_1_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('CONSULTANT_B2_1_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
