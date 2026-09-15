import nodeAssert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  CONSULTANT_B2_FIXTURE_POLICY,
  CONSULTANT_B2_FIXTURE_CONTROL,
  CONSULTANT_B2_FIXTURE_MANIFEST,
  consultantB2FixtureConstants,
  makeApplicationRequestFixture,
  makeAssignmentFixture,
  makeConsultantProfileFixture,
  makeFixtureProvider,
} from './fixtures/consultant-b2-fixtures.mjs'
import {
  REC_V2_DATASET_MODE,
  REC_V2_DATASET_VERSION,
  REC_V2_EVALUATION_AS_OF,
  configureLifeFit,
  makeV2InstitutionPool,
} from './fixtures/recommendation-v2-fixtures.mjs'
import { makeAssessmentDraftV2 } from './fixtures/elder-profile-v2-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const consultantDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'consultant')
const consultantTypesPath = path.join(repositoryRoot, 'miniprogram', 'types', 'consultant-v1.ts')
const consultantServicePath = path.join(repositoryRoot, 'miniprogram', 'services', 'consultant-application.ts')
const elderProfileV2EntryPath = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'v2', 'index.ts')
const recommendationV2EntryPath = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation', 'v2', 'index.ts')
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

const formatDiagnostic = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) {
    return message
  }
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1} ${message}`
}

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    return { parser: require(parserPath), parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  try {
    const parserPath = require.resolve('typescript')
    return { parser: require(parserPath), parserPath, source: 'local typescript' }
  } catch {
    // The repository intentionally does not depend on TypeScript at runtime.
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or open WeChat DevTools')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) {
    throw new Error('WeChat DevTools profile directory not found')
  }
  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) continue
    const packageRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(packageRoot)) continue
    for (const runtime of await readdir(packageRoot, { withFileTypes: true })) {
      const parserPath = path.join(packageRoot, runtime.name, 'lib', 'typescript.js')
      if (runtime.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('WeChat DevTools TypeScript parser not found')
  }
  return { parser: require(candidates[0].parserPath), parserPath: candidates[0].parserPath, source: 'WeChat DevTools mptslib' }
}

const createSourceLoader = (typescript, loadedSourcePaths, loadedSourceTexts) => {
  const moduleCache = new Map()
  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [basePath, `${basePath}.ts`, `${basePath}.js`, path.join(basePath, 'index.ts')]
    const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    if (!resolved) throw new Error(`Cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const loadModule = (filePath) => {
    const resolvedPath = path.resolve(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) return cached.exports
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    loadedSourcePaths.add(resolvedPath)
    const source = readFileSync(resolvedPath, 'utf8')
    loadedSourceTexts.set(resolvedPath, source)
    const output = resolvedPath.endsWith('.ts')
      ? typescript.transpileModule(source, {
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          target: typescript.ScriptTarget.ES2019,
          esModuleInterop: true,
        },
        fileName: resolvedPath,
        reportDiagnostics: true,
      })
      : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((diagnostic) =>
      diagnostic.category === typescript.DiagnosticCategory.Error)
    if (errors.length > 0) {
      throw new Error(errors.map((diagnostic) => formatDiagnostic(typescript, diagnostic)).join('\n'))
    }
    const localRequire = (request) => {
      if (!request.startsWith('.')) throw new Error(`Consultant runtime forbids external import ${request}`)
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output.outputText}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
  return loadModule
}

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
  const assertionCount = assertionCounts.get(id) || 0
  if (assertionCount < CONSULTANT_B2_FIXTURE_CONTROL.minimumAssertionsPerCase) {
    failures.push(`${id}: expected at least ${CONSULTANT_B2_FIXTURE_CONTROL.minimumAssertionsPerCase} assertion(s), got ${assertionCount}`)
  }
}

const assertSnapshotKeys = (snapshot) => {
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'assignmentSource',
    'consultant',
    'contractVersion',
    'dataProvenance',
    'institutionIdentity',
    'kind',
    'resolutionStatus',
    'snapshotAsOf',
  ])
  const forbidden = [
    'wechatQrMediaId',
    'privatePhone',
    'internalMediaId',
    'auditMetadata',
    'privateNotes',
    'credentials',
    'User.phone',
  ]
  const serialized = JSON.stringify(snapshot)
  forbidden.forEach((key) => assert.equal(serialized.includes(key), false, `forbidden key ${key}`))
}

const run = async () => {
  const parserInfo = await getTypeScriptParser()
  const loadedSourcePaths = new Set()
  const loadedSourceTexts = new Map()
  const loadModule = createSourceLoader(parserInfo.parser, loadedSourcePaths, loadedSourceTexts)
  const serviceModule = loadModule(consultantServicePath)
  const domainModule = loadModule(path.join(consultantDomainRoot, 'index.ts'))
  const elderProfileV2 = loadModule(elderProfileV2EntryPath)
  const recommendationV2 = loadModule(recommendationV2EntryPath)
  const serviceFactory = serviceModule.createConsultantApplicationServiceV1
  const { BASE_SNAPSHOT_AS_OF, BASE_INSTITUTION_ID, DEFAULT_CONSULTANT_ID } = consultantB2FixtureConstants

  const assertResolution = (result, assignmentSource, resolutionStatus, consultantPresent) => {
    assert.equal(result.ok, true)
    assert.equal(result.value.assignmentSource, assignmentSource)
    assert.equal(result.value.resolutionStatus, resolutionStatus)
    assert.equal(result.value.consultant !== null, consultantPresent)
  }

  assert.equal(Array.isArray(CONSULTANT_B2_FIXTURE_MANIFEST), true)
  assert.equal(CONSULTANT_B2_FIXTURE_MANIFEST.length, CONSULTANT_B2_FIXTURE_CONTROL.expectedCount)
  assert.equal(new Set(CONSULTANT_B2_FIXTURE_MANIFEST).size, CONSULTANT_B2_FIXTURE_CONTROL.expectedCount)
  assert.equal(CONSULTANT_B2_FIXTURE_POLICY, 'TEST_FIXTURE_ONLY_NOT_REAL_CONSULTANT_DATA')

  runCase('B2-CONSULTANT-001', () => {
    const result = domainModule.validateConsultantProfileV1(makeConsultantProfileFixture())
    assert.equal(result.ok, true)
  })
  runCase('B2-CONSULTANT-002', () => {
    const invalid = makeConsultantProfileFixture({ serviceStatus: 'unavailable' })
    const result = domainModule.validateConsultantProfileV1(invalid)
    assert.equal(result.ok, false)
  })
  runCase('B2-CONSULTANT-003', () => {
    const invalid = makeConsultantProfileFixture({ privateNotes: 'must never cross the trust boundary' })
    const result = domainModule.validateConsultantProfileV1(invalid)
    assert.equal(result.ok, false)
  })
  runCase('B2-ASSIGNMENT-001', () => {
    const result = serviceFactory(makeFixtureProvider()).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(result.ok, true)
    assert.equal(result.value.resolutionStatus, 'available')
    assert.equal(result.value.assignmentSource, 'institution_assignment')
    assert.equal(result.value.consultant.phone.status, 'available')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'available')
    assertSnapshotKeys(result.value)
  })
  runCase('B2-ASSIGNMENT-002', () => {
    let defaultCalls = 0
    const provider = makeFixtureProvider({
      loadAssignments: () => ({ status: 'missing' }),
      loadDefaultConsultant: () => {
        defaultCalls += 1
        return { enabled: true, consultantId: DEFAULT_CONSULTANT_ID }
      },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'default_consultant', 'available', true)
    assert.equal(result.value.consultant.consultantId, DEFAULT_CONSULTANT_ID)
    assert.equal(defaultCalls, 1)
    const inactiveDefault = serviceFactory(makeFixtureProvider({
      loadAssignments: () => ({ status: 'missing' }),
      loadDefaultConsultant: () => ({ enabled: true, consultantId: DEFAULT_CONSULTANT_ID }),
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        serviceStatus: 'inactive',
      }),
    })).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(inactiveDefault, 'default_consultant', 'inactive', false)
  })
  runCase('B2-ASSIGNMENT-003', () => {
    let defaultCalls = 0
    const provider = makeFixtureProvider({
      loadAssignments: () => [makeAssignmentFixture({ status: 'inactive' })],
      loadDefaultConsultant: () => {
        defaultCalls += 1
        return { enabled: true, consultantId: DEFAULT_CONSULTANT_ID }
      },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'inactive', false)
    assert.equal(defaultCalls, 0)
  })
  runCase('B2-ASSIGNMENT-004', () => {
    let defaultCalls = 0
    const provider = makeFixtureProvider({
      loadAssignments: () => ({ status: 'unknown' }),
      loadDefaultConsultant: () => {
        defaultCalls += 1
        return { enabled: true, consultantId: DEFAULT_CONSULTANT_ID }
      },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unknown', false)
    assert.equal(defaultCalls, 0)
  })
  runCase('B2-ASSIGNMENT-005', () => {
    const provider = makeFixtureProvider({
      loadAssignments: () => ({ status: 'missing' }),
      loadDefaultConsultant: () => ({ enabled: false }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, null, 'missing', false)
  })
  runCase('B2-ASSIGNMENT-006', () => {
    let defaultCalls = 0
    const provider = makeFixtureProvider({
      loadAssignments: () => [
        makeAssignmentFixture(),
        makeAssignmentFixture({ assignmentId: 'assignment-synthetic-b2-2', consultantId: DEFAULT_CONSULTANT_ID }),
      ],
      loadDefaultConsultant: () => {
        defaultCalls += 1
        return { enabled: true, consultantId: DEFAULT_CONSULTANT_ID }
      },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'ambiguous', false)
    assert.equal(defaultCalls, 0)
  })
  runCase('B2-ASSIGNMENT-007', () => {
    let defaultCalls = 0
    const provider = makeFixtureProvider({
      loadAssignments: () => [{ assignmentId: 'invalid' }],
      loadDefaultConsultant: () => {
        defaultCalls += 1
        return { enabled: true, consultantId: DEFAULT_CONSULTANT_ID }
      },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'PROVIDER_FAILURE')
    assert.equal(result.error.causeCode, 'INVALID_ASSIGNMENT_PAYLOAD')
    assert.equal(defaultCalls, 0)
  })
  runCase('B2-ASSIGNMENT-008', () => {
    const provider = makeFixtureProvider({ loadConsultantProfile: () => null })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'missing', false)
  })
  runCase('B2-ASSIGNMENT-009', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({ consultantId, serviceStatus: 'inactive' }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'inactive', false)
  })
  runCase('B2-ASSIGNMENT-010', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({ consultantId, serviceStatus: 'unknown' }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unknown', false)
  })
  runCase('B2-PROJECTION-001', () => {
    const provider = makeFixtureProvider()
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'available', true)
    assert.equal(result.value.consultant.phone.label, '养老顾问电话')
    assert.equal(result.value.consultant.phone.dialValue, '+860000000000')
    assert.equal(result.value.consultant.enterpriseWechatQr.label, '企业微信养老顾问')
    assert.equal(result.value.consultant.enterpriseWechatQr.publicImageUrl, 'https://example.test/consultant-b2.png')
    assertSnapshotKeys(result.value)
  })
  runCase('B2-PROJECTION-002', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: {
          sourceState: 'configured',
          value: '+86 0000 0000 00',
          reviewStatus: 'pending_review',
        },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2',
          reviewStatus: 'rejected',
          lifecycleStatus: 'active',
        },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unavailable', true)
    assert.equal(result.value.consultant.phone.status, 'unavailable')
    assert.equal(result.value.consultant.phone.actionAvailable, false)
    assert.equal('dialValue' in result.value.consultant.phone, false)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'unavailable')
    assert.equal('publicImageUrl' in result.value.consultant.enterpriseWechatQr, false)
    const pendingQr = domainModule.projectConsultantQrV1(makeConsultantProfileFixture({
      enterpriseWechatQr: {
        sourceState: 'configured',
        wechatQrMediaId: 'media-synthetic-b2',
        reviewStatus: 'pending_review',
        lifecycleStatus: 'active',
      },
    }), null)
    assert.equal(pendingQr.status, 'unavailable')
  })
  runCase('B2-PROJECTION-003', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2',
          reviewStatus: 'approved',
          lifecycleStatus: 'expired',
        },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'available', true)
    assert.equal(result.value.consultant.phone.status, 'available')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'expired')
    assert.equal('publicImageUrl' in result.value.consultant.enterpriseWechatQr, false)
  })
  runCase('B2-PROJECTION-004', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2',
          reviewStatus: 'approved',
          lifecycleStatus: 'expired',
        },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'expired', true)
    assert.equal(result.value.consultant.phone.status, 'unavailable')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'expired')
  })
  runCase('B2-PROJECTION-005', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unknown' },
        enterpriseWechatQr: { sourceState: 'unavailable' },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unknown', true)
    assert.equal(result.value.consultant.phone.status, 'unknown')
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'unavailable')
  })
  runCase('B2-PROJECTION-006', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
      }),
      resolvePublicMedia: () => ({ status: 'missing' }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unavailable', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'missing')
    assert.equal('publicImageUrl' in result.value.consultant.enterpriseWechatQr, false)
  })
  runCase('B2-PROJECTION-007', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2',
          reviewStatus: 'approved',
          lifecycleStatus: 'inactive',
        },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unavailable', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'inactive')
  })
  runCase('B2-PROJECTION-008', () => {
    const provider = makeFixtureProvider({
      loadConsultantProfile: (consultantId) => makeConsultantProfileFixture({
        consultantId,
        platformPhone: { sourceState: 'unavailable' },
        enterpriseWechatQr: {
          sourceState: 'configured',
          wechatQrMediaId: 'media-synthetic-b2',
          reviewStatus: 'unknown',
          lifecycleStatus: 'active',
        },
      }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(result, 'institution_assignment', 'unknown', true)
    assert.equal(result.value.consultant.enterpriseWechatQr.status, 'unknown')
  })
  runCase('B2-FAILURE-001', () => {
    const provider = makeFixtureProvider({
      loadAssignments: () => { throw new Error('synthetic provider failure') },
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'PROVIDER_FAILURE')
    assert.equal(result.error.causeCode, 'ASSIGNMENT_PROVIDER_FAILED')
  })
  runCase('B2-FAILURE-002', () => {
    const provider = makeFixtureProvider({
      loadAssignments: () => [makeAssignmentFixture({ institutionId: 'institution-other-b2' })],
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'PROVIDER_FAILURE')
    assert.equal(result.error.causeCode, 'INVALID_ASSIGNMENT_PAYLOAD')
  })
  runCase('B2-FAILURE-003', () => {
    const provider = makeFixtureProvider({
      resolvePublicMedia: () => ({ status: 'available', publicImageUrl: 'http://not-https.test/qr.png' }),
    })
    const result = serviceFactory(provider).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'PROVIDER_FAILURE')
    assert.equal(result.error.causeCode, 'INVALID_MEDIA_RESULT')
  })
  runCase('B2-FAILURE-004', () => {
    const service = serviceFactory(makeFixtureProvider())
    const contextResult = service.resolveForInstitution(makeApplicationRequestFixture({
      institutionIdentity: { institutionId: BASE_INSTITUTION_ID, recordRevision: 0 },
    }))
    const timeResult = service.resolveForInstitution(makeApplicationRequestFixture({ snapshotAsOf: 'not-a-timestamp' }))
    const provenanceResult = serviceFactory({
      ...makeFixtureProvider(),
      dataProvenance: 'UNKNOWN_PROVENANCE',
    }).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(contextResult.ok, false)
    assert.equal(contextResult.error.code, 'INVALID_INPUT')
    assert.equal(contextResult.error.causeCode, 'INVALID_INSTITUTION_CONTEXT')
    assert.equal(timeResult.ok, false)
    assert.equal(timeResult.error.code, 'INVALID_INPUT')
    assert.equal(timeResult.error.causeCode, 'INVALID_SNAPSHOT_AS_OF')
    assert.equal(provenanceResult.ok, false)
    assert.equal(provenanceResult.error.code, 'PROVIDER_FAILURE')
    assert.equal(provenanceResult.error.causeCode, 'INVALID_PROVENANCE')
  })
  runCase('B2-FAILURE-005', () => {
    const throwing = serviceFactory(makeFixtureProvider({
      loadAssignments: () => ({ status: 'missing' }),
      loadDefaultConsultant: () => { throw new Error('synthetic default provider failure') },
    })).resolveForInstitution(makeApplicationRequestFixture())
    const invalid = serviceFactory(makeFixtureProvider({
      loadAssignments: () => ({ status: 'missing' }),
      loadDefaultConsultant: () => ({ enabled: true, consultantId: '' }),
    })).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(throwing.ok, false)
    assert.equal(throwing.error.causeCode, 'DEFAULT_PROVIDER_FAILED')
    assert.equal(invalid.ok, false)
    assert.equal(invalid.error.causeCode, 'INVALID_DEFAULT_CONFIGURATION')
  })
  runCase('B2-FAILURE-006', () => {
    const profileFailure = serviceFactory(makeFixtureProvider({
      loadConsultantProfile: () => { throw new Error('synthetic profile provider failure') },
    })).resolveForInstitution(makeApplicationRequestFixture())
    const mediaFailure = serviceFactory(makeFixtureProvider({
      resolvePublicMedia: () => { throw new Error('synthetic media provider failure') },
    })).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(profileFailure.ok, false)
    assert.equal(profileFailure.error.causeCode, 'PROFILE_PROVIDER_FAILED')
    assert.equal(mediaFailure.ok, false)
    assert.equal(mediaFailure.error.causeCode, 'MEDIA_PROVIDER_FAILED')
  })
  runCase('B2-ISOLATION-001', () => {
    const request = makeApplicationRequestFixture()
    const before = clone(request)
    const provider = makeFixtureProvider({
      loadAssignments: (context) => {
        context.institutionId = 'mutated-provider-context'
        context.recordRevision = 999
        return [makeAssignmentFixture()]
      },
    })
    const first = serviceFactory(provider).resolveForInstitution(request)
    const second = serviceFactory(provider).resolveForInstitution(request)
    assert.deepEqual(first, second)
    assert.deepEqual(request, before)
    assert.equal(BASE_INSTITUTION_ID, first.value.institutionIdentity.institutionId)
    assert.equal(1, first.value.institutionIdentity.recordRevision)
    assert.equal(BASE_SNAPSHOT_AS_OF, first.value.snapshotAsOf)
  })
  runCase('B2-ISOLATION-002', () => {
    const service = serviceFactory(makeFixtureProvider())
    const result = service.resolveForInstitution(makeApplicationRequestFixture({
      institutionIdentity: {
        institutionId: BASE_INSTITUTION_ID,
        recordRevision: 1,
        officialPhone: '+86 1111 1111 11',
      },
    }))
    assert.equal(result.ok, false)
    assert.equal(result.error.causeCode, 'INVALID_INSTITUTION_CONTEXT')
    const normal = service.resolveForInstitution(makeApplicationRequestFixture())
    assertResolution(normal, 'institution_assignment', 'available', true)
    assert.equal(JSON.stringify(normal.value).includes('officialPhone'), false)
    assert.equal(normal.value.consultant.phone.label, '养老顾问电话')
  })
  runCase('B2-ISOLATION-003', () => {
    const derived = elderProfileV2.deriveElderProfilePreviewV2(makeAssessmentDraftV2({
      'preference.careType': 'medical_nursing_integrated',
      'budget.monthlyRange': 'cny_5000_8000',
    }))
    assert.equal(derived.ok, true)
    const recommendationInput = {
      profile: derived.preview,
      institutions: makeV2InstitutionPool(2).map((record) => configureLifeFit(record)),
      datasetVersion: REC_V2_DATASET_VERSION,
      datasetMode: REC_V2_DATASET_MODE,
      evaluationAsOf: REC_V2_EVALUATION_AS_OF,
      contractVersion: 'recommendation-contract-v2',
      rulesetVersion: 'recommendation-ruleset-v2',
      policyVersion: 'conservative-exact-with-conditional-v1',
    }
    const before = recommendationV2.evaluateRecommendationPreviewV2(clone(recommendationInput))
    const consultantResult = serviceFactory(makeFixtureProvider()).resolveForInstitution(makeApplicationRequestFixture())
    assert.equal(consultantResult.ok, true)
    const withSidecar = { recommendationInput: clone(recommendationInput), consultant: consultantResult.value }
    const afterAdd = recommendationV2.evaluateRecommendationPreviewV2(withSidecar.recommendationInput)
    withSidecar.consultant = { ...withSidecar.consultant, resolutionStatus: 'unavailable' }
    const afterChange = recommendationV2.evaluateRecommendationPreviewV2(withSidecar.recommendationInput)
    delete withSidecar.consultant
    const afterDelete = recommendationV2.evaluateRecommendationPreviewV2(withSidecar.recommendationInput)
    assert.equal(before.ok, true)
    assert.deepEqual(afterAdd, before)
    assert.deepEqual(afterChange, before)
    assert.deepEqual(afterDelete, before)
  })

  assert.deepEqual(caseIds, CONSULTANT_B2_FIXTURE_MANIFEST, 'fixture manifest must exactly match executed case order')

  const sourcePaths = [consultantTypesPath, ...Array.from(loadedSourcePaths)]
  const uniqueSourcePaths = Array.from(new Set(sourcePaths))
  const consultantSourcePaths = uniqueSourcePaths.filter((filePath) =>
    filePath === consultantTypesPath
    || filePath === consultantServicePath
    || filePath.startsWith(`${consultantDomainRoot}${path.sep}`))
  consultantSourcePaths.forEach((filePath) => {
    const source = readFileSync(filePath, 'utf8')
    assert.equal(/\b(?:Date\.now|Math\.random|new\s+Date)\s*\(/.test(source), false, `time/random API in ${filePath}`)
    assert.equal(/\bwx\s*\./.test(source), false, `wx dependency in ${filePath}`)
    assert.equal(/(?:scripts[\\/]fixtures|miniprogram[\\/]mock)/.test(source), false, `fixture/mock dependency in ${filePath}`)
    assert.equal(/\.\.\/(?:types|services)\/(?:recommendation|institution)|\.\.\/domain\/recommendation\//i.test(source), false, `cross-domain import in ${filePath}`)
    assert.equal(/\b(?:User\.phone|userPhone|privatePhone|privateNotes|auditMetadata|credentials)\b/.test(source), false, `private field in ${filePath}`)
  })

  if (failures.length > 0) {
    console.error(`CONSULTANT B2 RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`CONSULTANT_B2_FIXTURES: ${caseIds.length} executed`)
  console.log(`CONSULTANT_B2_ASSERTIONS: ${Array.from(assertionCounts.values()).reduce((total, count) => total + count, 0)}`)
  console.log(`CONSULTANT_B2_SOURCE_MODULES: ${uniqueSourcePaths.length}`)
  console.log(`CONSULTANT_B2_PARSER: ${parserInfo.source}`)
  console.log('CONSULTANT_B2_RUNTIME = PASS')
}

run().catch((error) => {
  console.error('CONSULTANT_B2_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
