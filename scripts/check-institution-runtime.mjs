import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  CAPABILITY_COVERAGE_MATRIX,
  CAPABILITY_MAPPING_INTENTS,
  CARE_LEVEL_CODES,
  COGNITIVE_CODES,
  INSTITUTION_FIXTURE_AS_OF,
  INSTITUTION_FIXTURE_EVALUATION_AS_OF,
  INSTITUTION_FIXTURE_EXPIRED_AT,
  INSTITUTION_FIXTURE_EXPIRED_UNTIL,
  INSTITUTION_FIXTURE_POLICY,
  INSTITUTION_FIXTURE_VALID_UNTIL,
  MATCHING_CRITICAL_FIELD_PATHS,
  MOBILITY_CODES,
  NOT_REAL_INSTITUTION_DATA,
  SPECIAL_CARE_CODES,
  TEST_SYNTHETIC_VERIFIED,
  cloneInstitutionRecord,
  compoundSnapshotFixture,
  institutionFixtures,
  invalidInstitutionFixtures,
} from './fixtures/institution-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const institutionDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution')
const institutionTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution.ts')
const failures = []
const caseIds = []
let caseCount = 0

const EXPECTED_CASE_IDS = Object.freeze([
  'VALID_INSTITUTION_A_MOCK',
  'VALID_INSTITUTION_B_MOCK',
  'VALID_INSTITUTION_C_MOCK',
  'VALID_INSTITUTION_D_MOCK',
  'VALID_INSTITUTION_E_MOCK',
  'INVALID_MOCK_NAME_LABEL',
  'INVALID_COORDINATES_ZERO_PLACEHOLDER',
  'INVALID_INSTITUTION_ID',
  'INVALID_RECORD_REVISION',
  'INVALID_RECORD_REVISION_FRACTION',
  'INVALID_REGION_CODE',
  'INVALID_SUPPORTED_TYPE_CODE',
  'INVALID_CAPABILITY_STATUS',
  'INVALID_CARE_LEVEL_MATRIX_MISSING',
  'INVALID_SPECIAL_CARE_MATRIX_EXTRA',
  'INVALID_SUPPORTED_TYPE_DUPLICATE',
  'INVALID_PRIMARY_TYPE_OUTSIDE_SUPPORTED_TYPES',
  'INVALID_NEGATIVE_PRICE',
  'INVALID_INFINITY_PRICE',
  'INVALID_ZERO_PRICE',
  'INVALID_BOUNDED_PRICE_ORDER',
  'INVALID_STARTING_AT_PRICE_MAX',
  'INVALID_PRICE_PERIOD',
  'INVALID_NAN_PRICE',
  'INVALID_FRACTIONAL_PRICE',
  'INVALID_UNSAFE_INTEGER_PRICE',
  'INVALID_PRICE_CURRENCY',
  'INVALID_UNKNOWN_PRICE_NON_NULL',
  'INVALID_AVAILABILITY_AS_OF',
  'INVALID_EVIDENCE_REVISION',
  'INVALID_EVIDENCE_STATUS',
  'INVALID_EVIDENCE_VALUE',
  'INVALID_EVIDENCE_NONCRITICAL_VALUE',
  'INVALID_EVIDENCE_VERIFIED_AT_MISMATCH',
  'INVALID_EVIDENCE_VALID_UNTIL_MISMATCH',
  'INVALID_EVIDENCE_SOURCE',
  'INVALID_EVIDENCE_FIELD_PATH',
  'INVALID_EVIDENCE_SNAPSHOT_DISCRIMINATOR',
  'INVALID_EVIDENCE_ISO_TIMESTAMP',
  'INVALID_EVIDENCE_SOURCE_REFERENCE_TYPE',
  'INVALID_VR_MISSING_SCENES',
  'INVALID_VR_BROKEN_MEDIA',
  'INVALID_VR_DUPLICATE_SCENE',
  'INVALID_MEDIA_URL_NO_HOST',
  'INVALID_MEDIA_URL_CREDENTIALS',
  'INVALID_MEDIA_URL_PORT',
  'INVALID_VR_UNAVAILABLE_WITH_SCENE',
  'INVALID_IDENTITY_COVER_GALLERY',
  'INVALID_QUALIFICATION_EXPIRY',
  'INVALID_QUALIFICATION_DATE_ORDER',
  'INVALID_ACCEPTING_RESIDENTS_WITHOUT_AS_OF',
  'INVALID_ESTIMATED_WAIT_WITHOUT_AS_OF',
  'INVALID_EARLIEST_MOVE_IN_WITHOUT_AS_OF',
  'PRIMARY_TYPE_OPTIONAL',
  'PRIMARY_TYPE_MEMBERSHIP_ENFORCED',
  'NO_PRIMARY_TYPE_AUTO_SELECTION',
  'CARE_LEVEL_FIVE_KEYS_EXACT',
  'MOBILITY_THREE_KEYS_EXACT',
  'COGNITIVE_TWO_KEYS_EXACT',
  'SPECIAL_CARE_NINE_KEYS_EXACT',
  'COMPOUND_SNAPSHOT_VALID_ALL_SIX',
  'COMPOUND_SNAPSHOT_INVALID_DISCRIMINATORS',
  'EFFECTIVE_SUPPORTED_VERIFIED',
  'EFFECTIVE_REQUIRES_ASSESSMENT_VERIFIED',
  'EFFECTIVE_UNSUPPORTED_VERIFIED',
  'EFFECTIVE_UNKNOWN_RAW',
  'EFFECTIVE_UNKNOWN_UNVERIFIED',
  'EFFECTIVE_SUPPORTED_UNVERIFIED',
  'EFFECTIVE_UNSUPPORTED_UNVERIFIED',
  'EFFECTIVE_REQUIRES_ASSESSMENT_UNVERIFIED',
  'EFFECTIVE_SUPPORTED_EXPIRED',
  'EFFECTIVE_UNSUPPORTED_EXPIRED',
  'EFFECTIVE_REQUIRES_ASSESSMENT_EXPIRED',
  'EFFECTIVE_VERIFIED_AT_FUTURE',
  'EFFECTIVE_VALID_UNTIL_BOUNDARY',
  'EFFECTIVE_VALID_UNTIL_PASSED',
  'EFFECTIVE_INVALID_EVALUATION_TIME',
  'EFFECTIVE_FIELD_GATE',
  'REFERENCE_PRICE_BOUNDED_VALID',
  'REFERENCE_PRICE_STARTING_AT_VALID',
  'MONTH_ONE_TIME_SEPARATION',
  'UNKNOWN_PRICE_EXPLICIT_NULL',
  'INVALID_PRICE_PERIOD_ON_ONE_TIME_FIELD',
  'AVAILABILITY_INDEPENDENT',
  'AVAILABILITY_OPTIONAL_FACTS_ABSENT',
  'EVIDENCE_TYPED_SNAPSHOT',
  'EVIDENCE_SOURCE_REFERENCE_OPTIONAL',
  'VR_AVAILABLE_WITH_SCENES',
  'VR_UNAVAILABLE_WITHOUT_SCENES',
  'QUALIFICATION_VALIDITY_SEPARATE',
  'COVERAGE_MATRIX_ZERO_MISSING',
  'MATCHING_WHITELIST_EXACT',
  'DETERMINISTIC_EXPLICIT_TIME',
  'JCS_RUNTIME_DEPENDENCY_ZERO',
  'PURE_DEPENDENCY_GRAPH',
  'RECOMMENDATION_UI_BACKEND_DEPENDENCY_ZERO',
])

const EXPECTED_COVERAGE_ROWS = Object.freeze([
  ['careLevel=independent', 'careLevelAcceptance.independent', 'capabilities.careLevelAcceptance.independent', 'DIRECT'],
  ['careLevel=light_care', 'careLevelAcceptance.light_care', 'capabilities.careLevelAcceptance.light_care', 'DIRECT'],
  ['careLevel=semi_disabled', 'careLevelAcceptance.semi_disabled', 'capabilities.careLevelAcceptance.semi_disabled', 'DIRECT'],
  ['careLevel=disabled', 'careLevelAcceptance.disabled', 'capabilities.careLevelAcceptance.disabled', 'DIRECT'],
  ['careLevel=severely_disabled', 'careLevelAcceptance.severely_disabled', 'capabilities.careLevelAcceptance.severely_disabled', 'DIRECT'],
  ['mobility=wheelchair', 'mobilitySupport.wheelchair_support', 'capabilities.mobilitySupport.wheelchair_support', 'REQUIRES_MAPPING'],
  ['mobility=bedbound', 'mobilitySupport.bedbound_support', 'capabilities.mobilitySupport.bedbound_support', 'REQUIRES_MAPPING'],
  ['careMode=transfer_support/fully_dependent_transfer', 'mobilitySupport.transfer_support', 'capabilities.mobilitySupport.transfer_support', 'REQUIRES_MAPPING'],
  ['rehabilitation required/possible', 'specialCare.rehabilitation_training', 'capabilities.specialCare.rehabilitation_training', 'REQUIRES_MAPPING'],
  ['reported dementia diagnosis', 'cognitiveSupport.dementia_acceptance', 'capabilities.cognitiveSupport.dementia_acceptance', 'REQUIRES_MAPPING'],
  ['cognitive concern without diagnosis', 'cognitiveSupport.dementia_acceptance', 'capabilities.cognitiveSupport.dementia_acceptance', 'REQUIRES_MAPPING'],
  ['wandering risk present', 'cognitiveSupport.wandering_risk_support', 'capabilities.cognitiveSupport.wandering_risk_support', 'REQUIRES_MAPPING'],
  ['round_the_clock_care', 'specialCare.round_the_clock_care', 'capabilities.specialCare.round_the_clock_care', 'DIRECT'],
  ['one_to_one_caregiver', 'specialCare.one_to_one_caregiver', 'capabilities.specialCare.one_to_one_caregiver', 'DIRECT'],
  ['night_care', 'specialCare.night_care', 'capabilities.specialCare.night_care', 'DIRECT'],
  ['dementia_unit', 'specialCare.dementia_unit', 'capabilities.specialCare.dementia_unit', 'DIRECT'],
  ['rehabilitation_training', 'specialCare.rehabilitation_training', 'capabilities.specialCare.rehabilitation_training', 'DIRECT'],
  ['tube_feeding', 'specialCare.tube_feeding', 'capabilities.specialCare.tube_feeding', 'DIRECT'],
  ['catheter_care', 'specialCare.catheter_care', 'capabilities.specialCare.catheter_care', 'DIRECT'],
  ['pressure_injury_care', 'specialCare.pressure_injury_care', 'capabilities.specialCare.pressure_injury_care', 'DIRECT'],
  ['incontinence_care', 'specialCare.incontinence_care', 'capabilities.specialCare.incontinence_care', 'DIRECT'],
  ['ADL special_feeding clue', 'none', 'none', 'NOT_APPLICABLE'],
  ['ADL catheter_or_stoma clue', 'none', 'none', 'NOT_APPLICABLE'],
])

const EXPECTED_MAPPING_INTENTS = Object.freeze([
  ['mobility.level = wheelchair', 'capabilities.mobilitySupport.wheelchair_support'],
  ['mobility.level = bedbound', 'capabilities.mobilitySupport.bedbound_support'],
  ['adl.careModes = transfer_support / fully_dependent_transfer', 'capabilities.mobilitySupport.transfer_support'],
  ['health rehabilitation required / possible', 'capabilities.specialCare.rehabilitation_training'],
  ['reported cognitive diagnosis/concern', 'capabilities.cognitiveSupport.dementia_acceptance'],
  ['cognition.wanderingRisk = present', 'capabilities.cognitiveSupport.wandering_risk_support'],
])

const normalizePath = (filePath) => path.resolve(filePath).toLowerCase()

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.keys(value).forEach((key) => deepFreeze(value[key]))
  return value
}

const isWithin = (filePath, root) => {
  const normalizedFile = normalizePath(filePath)
  const normalizedRoot = normalizePath(root)
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)
}

const diagnosticText = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || typeof diagnostic.start !== 'number') {
    return message
  }
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`
}

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    if (!existsSync(parserPath)) {
      throw new Error(`WECHAT_TYPESCRIPT_PATH does not exist: ${parserPath}`)
    }
    return { parser: require(parserPath), parserPath, source: 'WECHAT_TYPESCRIPT_PATH' }
  }

  try {
    const parserPath = require.resolve('typescript')
    return { parser: require(parserPath), parserPath, source: 'project TypeScript parser' }
  } catch {
    // The repository intentionally keeps TypeScript out of runtime dependencies.
  }

  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat DevTools TypeScript not found; set WECHAT_TYPESCRIPT_PATH explicitly')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
  if (!existsSync(profileRoot)) {
    throw new Error('WeChat DevTools profile directory not found')
  }
  const candidates = []
  for (const profile of await readdir(profileRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) {
      continue
    }
    const runtimeRoot = path.join(profileRoot, profile.name, 'WeappForeignPkgs', 'mptslib')
    if (!existsSync(runtimeRoot)) {
      continue
    }
    for (const runtimePackage of await readdir(runtimeRoot, { withFileTypes: true })) {
      const parserPath = path.join(runtimeRoot, runtimePackage.name, 'lib', 'typescript.js')
      if (runtimePackage.isDirectory() && existsSync(parserPath)) {
        candidates.push({ parserPath, mtimeMs: (await stat(parserPath)).mtimeMs })
      }
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (candidates.length === 0) {
    throw new Error('WeChat DevTools TypeScript not found; open DevTools or set WECHAT_TYPESCRIPT_PATH')
  }
  const parserPath = candidates[0].parserPath
  return { parser: require(parserPath), parserPath, source: 'WeChat DevTools mptslib' }
}

const createSourceLoader = (typescript, loadedSourcePaths, loadedSourceTexts, externalImports) => {
  const moduleCache = new Map()
  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [
      `${basePath}.ts`,
      `${basePath}.js`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.js'),
    ]
    const resolved = candidates.find((candidate) => existsSync(candidate))
    if (!resolved) {
      throw new Error(`Cannot resolve ${request} from ${importer}`)
    }
    return resolved
  }
  const loadModule = (filePath) => {
    const resolvedPath = path.resolve(filePath)
    if (!isWithin(resolvedPath, institutionDomainRoot) && normalizePath(resolvedPath) !== normalizePath(institutionTypePath)) {
      throw new Error(`Institution runtime loaded a file outside its pure dependency boundary: ${path.relative(repositoryRoot, resolvedPath)}`)
    }
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    const source = readFileSync(resolvedPath, 'utf8')
    loadedSourcePaths.add(resolvedPath)
    loadedSourceTexts.set(resolvedPath, source)
    const output = resolvedPath.endsWith('.ts')
      ? (() => {
        const result = typescript.transpileModule(source, {
          compilerOptions: {
            module: typescript.ModuleKind.CommonJS,
            target: typescript.ScriptTarget.ES2019,
            esModuleInterop: true,
          },
          fileName: resolvedPath,
          reportDiagnostics: true,
        })
        const errors = (result.diagnostics || [])
          .filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error)
        if (errors.length > 0) {
          throw new Error(`WeChat TypeScript parser rejected ${path.relative(repositoryRoot, resolvedPath)}:\n${errors.map((diagnostic) => diagnosticText(typescript, diagnostic)).join('\n')}`)
        }
        return result.outputText
      })()
      : source
    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        externalImports.push(`${path.relative(repositoryRoot, resolvedPath)} -> ${request}`)
        throw new Error(`Pure Institution runtime forbids external import ${request} from ${resolvedPath}`)
      }
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
  return loadModule
}

const runCase = (id, callback) => {
  caseCount += 1
  if (caseIds.includes(id)) {
    throw new Error(`duplicate runtime case id ${id}`)
  }
  caseIds.push(id)
  try {
    callback()
    console.log(`PASS ${id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${id}: ${message}`)
    console.error(`FAIL ${id}: ${message}`)
  }
}

const assertValidationOk = (validateInstitutionRecord, record, id) => {
  const result = validateInstitutionRecord(record)
  assert.equal(result.ok, true, `${id} should be valid: ${JSON.stringify(result)}`)
}

const assertValidationFail = (validateInstitutionRecord, fixture) => {
  const result = validateInstitutionRecord(fixture.record)
  assert.equal(result.ok, false, `${fixture.id} should be invalid`)
  const issueCodes = result.issues.map((issue) => issue.code)
  assert.ok(
    fixture.expectedCodes.some((code) => issueCodes.includes(code)),
    `${fixture.id} expected one of ${fixture.expectedCodes.join(', ')}; got ${issueCodes.join(', ')}`,
  )
}

const makeVerification = (status, overrides = {}) => {
  if (status === 'unverified') {
    return { status, evidenceIds: [] }
  }
  return {
    status,
    evidenceIds: ['synthetic-effective-evidence'],
    verifiedAt: status === 'expired' ? INSTITUTION_FIXTURE_EXPIRED_AT : '2026-08-01T00:00:00.000Z',
    validUntil: status === 'expired' ? INSTITUTION_FIXTURE_EXPIRED_UNTIL : INSTITUTION_FIXTURE_VALID_UNTIL,
    ...overrides,
  }
}

const makeProvidedField = (value, verification = makeVerification('verified')) => ({
  availability: 'provided',
  value,
  asOf: '2026-08-01T00:00:00.000Z',
  verification,
})

const run = async () => {
  const { parser: typescript, parserPath, source: parserSource } = await loadWechatTypeScript()
  const loadedSourcePaths = new Set()
  const loadedSourceTexts = new Map()
  const externalImports = []
  const loadModule = createSourceLoader(
    typescript,
    loadedSourcePaths,
    loadedSourceTexts,
    externalImports,
  )
  const institutionDomain = loadModule(path.join(institutionDomainRoot, 'index.ts'))
  const validateInstitutionRecord = institutionDomain.validateInstitutionRecord
  const resolveEffectiveCapability = institutionDomain.resolveEffectiveCapability
  const resolveEffectiveInstitutionField = institutionDomain.resolveEffectiveInstitutionField
  assert.equal(typeof validateInstitutionRecord, 'function')
  assert.equal(typeof resolveEffectiveCapability, 'function')
  assert.equal(typeof resolveEffectiveInstitutionField, 'function')

  institutionFixtures.forEach((fixture) => {
    runCase(`VALID_${fixture.id}`, () => {
      assert.equal(fixture.labels.fixturePolicy, INSTITUTION_FIXTURE_POLICY)
      assert.equal(fixture.labels.data, NOT_REAL_INSTITUTION_DATA)
      assert.ok(fixture.record.institutionId.endsWith('-mock'))
      assert.equal(fixture.record.recordProvenance, 'MOCK_DEVELOPMENT_ONLY')
      assert.equal(
        fixture.record.evidence.length > 0,
        fixture.labels.verification === TEST_SYNTHETIC_VERIFIED,
        'synthetic verified label must accompany evidence-bearing fixtures',
      )
      assertValidationOk(validateInstitutionRecord, fixture.record, fixture.id)
    })
  })

  runCase('INVALID_MOCK_NAME_LABEL', () => {
    const record = cloneInstitutionRecord(institutionFixtures[0].record)
    record.identity.name.value = 'Unlabelled synthetic institution'
    const result = validateInstitutionRecord(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_MOCK_LABEL' && issue.path === 'identity.name'))
  })

  runCase('INVALID_COORDINATES_ZERO_PLACEHOLDER', () => {
    const record = cloneInstitutionRecord(institutionFixtures[0].record)
    record.identity.coordinates.value = { latitude: 0, longitude: 0 }
    const result = validateInstitutionRecord(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_COORDINATES'))
    record.identity.coordinates.value = { latitude: 0, longitude: 114 }
    assertValidationOk(validateInstitutionRecord, record, 'single zero latitude is not a placeholder')
    record.identity.coordinates.value = { latitude: 30, longitude: 0 }
    assertValidationOk(validateInstitutionRecord, record, 'single zero longitude is not a placeholder')
  })

  invalidInstitutionFixtures.forEach((fixture) => {
    runCase(fixture.id, () => assertValidationFail(validateInstitutionRecord, fixture))
  })

  runCase('PRIMARY_TYPE_OPTIONAL', () => {
    const record = institutionFixtures.find((fixture) => fixture.id === 'INSTITUTION_C_MOCK').record
    assert.equal(Object.prototype.hasOwnProperty.call(record.typeProfile, 'primaryType'), false)
    assertValidationOk(validateInstitutionRecord, record, 'PRIMARY_TYPE_OPTIONAL')
  })

  runCase('PRIMARY_TYPE_MEMBERSHIP_ENFORCED', () => {
    const invalid = invalidInstitutionFixtures.find((fixture) => fixture.id === 'INVALID_PRIMARY_TYPE_OUTSIDE_SUPPORTED_TYPES')
    assertValidationFail(validateInstitutionRecord, invalid)
  })

  runCase('NO_PRIMARY_TYPE_AUTO_SELECTION', () => {
    const record = institutionFixtures.find((fixture) => fixture.id === 'INSTITUTION_C_MOCK').record
    assert.equal(record.typeProfile.primaryType, undefined)
    assert.equal(record.typeProfile.supportedTypes.value.length, 2)
    assertValidationOk(validateInstitutionRecord, record, 'NO_PRIMARY_TYPE_AUTO_SELECTION')
  })

  const exactKeyCases = [
    ['CARE_LEVEL_FIVE_KEYS_EXACT', 'careLevelAcceptance', CARE_LEVEL_CODES],
    ['MOBILITY_THREE_KEYS_EXACT', 'mobilitySupport', MOBILITY_CODES],
    ['COGNITIVE_TWO_KEYS_EXACT', 'cognitiveSupport', COGNITIVE_CODES],
    ['SPECIAL_CARE_NINE_KEYS_EXACT', 'specialCare', SPECIAL_CARE_CODES],
  ]
  exactKeyCases.forEach(([id, group, codes]) => {
    runCase(id, () => {
      const record = institutionFixtures[0].record
      assert.deepEqual(Object.keys(record.capabilities[group]).sort(), [...codes].sort())
      assert.equal(Object.keys(record.capabilities[group]).length, codes.length)
    })
  })

  const compoundSnapshotEntries = [
    ['identity.coordinates', 'coordinates'],
    ['medicalSupport.partnerHospitals', 'partner_hospital_list'],
    ['staffing.counts', 'staff_count_list'],
    ['staffing.caregiverResidentRatio', 'caregiver_resident_ratio'],
    ['price.adjustmentFactors', 'price_adjustment_factor_list'],
    ['operations.estimatedWait', 'estimated_wait_range'],
  ]

  runCase('COMPOUND_SNAPSHOT_VALID_ALL_SIX', () => {
    assertValidationOk(validateInstitutionRecord, compoundSnapshotFixture, 'COMPOUND_SNAPSHOT_VALID_ALL_SIX')
    compoundSnapshotEntries.forEach(([fieldPath, valueType]) => {
      const evidence = compoundSnapshotFixture.evidence.find((entry) => entry.fieldPath === fieldPath)
      assert.ok(evidence, `compound evidence missing for ${fieldPath}`)
      assert.equal(evidence.valueSnapshot.valueType, valueType)
    })
  })

  runCase('COMPOUND_SNAPSHOT_INVALID_DISCRIMINATORS', () => {
    compoundSnapshotEntries.forEach(([fieldPath]) => {
      const record = cloneInstitutionRecord(compoundSnapshotFixture)
      const evidence = record.evidence.find((entry) => entry.fieldPath === fieldPath)
      evidence.valueSnapshot = { valueType: 'text', value: 'wrong compound discriminator' }
      const result = validateInstitutionRecord(record)
      assert.equal(result.ok, false, `${fieldPath} invalid snapshot should reject`)
      assert.ok(result.issues.some((issue) => issue.code === 'EVIDENCE_VALUE_MISMATCH'))
    })
  })

  const effectiveCases = [
    ['EFFECTIVE_SUPPORTED_VERIFIED', 'supported', makeVerification('verified'), 'supported'],
    ['EFFECTIVE_REQUIRES_ASSESSMENT_VERIFIED', 'requires_assessment', makeVerification('verified'), 'requires_assessment'],
    ['EFFECTIVE_UNSUPPORTED_VERIFIED', 'unsupported', makeVerification('verified'), 'unsupported'],
    ['EFFECTIVE_UNKNOWN_RAW', 'unknown', makeVerification('verified'), 'unknown'],
    ['EFFECTIVE_UNKNOWN_UNVERIFIED', 'unknown', makeVerification('unverified'), 'unknown'],
    ['EFFECTIVE_SUPPORTED_UNVERIFIED', 'supported', makeVerification('unverified'), 'unknown'],
    ['EFFECTIVE_UNSUPPORTED_UNVERIFIED', 'unsupported', makeVerification('unverified'), 'unknown'],
    ['EFFECTIVE_REQUIRES_ASSESSMENT_UNVERIFIED', 'requires_assessment', makeVerification('unverified'), 'unknown'],
    ['EFFECTIVE_SUPPORTED_EXPIRED', 'supported', makeVerification('expired'), 'unknown'],
    ['EFFECTIVE_UNSUPPORTED_EXPIRED', 'unsupported', makeVerification('expired'), 'unknown'],
    ['EFFECTIVE_REQUIRES_ASSESSMENT_EXPIRED', 'requires_assessment', makeVerification('expired'), 'unknown'],
    ['EFFECTIVE_VERIFIED_AT_FUTURE', 'supported', makeVerification('verified', { verifiedAt: '2027-01-01T00:00:00.000Z' }), 'unknown'],
    ['EFFECTIVE_VALID_UNTIL_BOUNDARY', 'supported', makeVerification('verified', { validUntil: INSTITUTION_FIXTURE_EVALUATION_AS_OF }), 'supported'],
    ['EFFECTIVE_VALID_UNTIL_PASSED', 'supported', makeVerification('verified', { validUntil: '2026-08-30T09:00:00.000Z' }), 'unknown'],
    ['EFFECTIVE_INVALID_EVALUATION_TIME', 'supported', makeVerification('verified'), 'unknown', 'not-a-time'],
  ]
  effectiveCases.forEach(([id, rawStatus, verification, expected, evaluationAsOf = INSTITUTION_FIXTURE_EVALUATION_AS_OF]) => {
    runCase(id, () => assert.equal(
      resolveEffectiveCapability(rawStatus, verification, evaluationAsOf),
      expected,
    ))
  })

  runCase('EFFECTIVE_FIELD_GATE', () => {
    const rawField = makeProvidedField('mock-region-a', makeVerification('unverified'))
    assert.deepEqual(resolveEffectiveInstitutionField(rawField, INSTITUTION_FIXTURE_EVALUATION_AS_OF), {
      availability: 'unknown',
      value: null,
    })
    const verifiedField = makeProvidedField('mock-region-a', makeVerification('verified'))
    assert.deepEqual(resolveEffectiveInstitutionField(verifiedField, INSTITUTION_FIXTURE_EVALUATION_AS_OF), {
      availability: 'provided',
      value: 'mock-region-a',
    })
  })

  runCase('REFERENCE_PRICE_BOUNDED_VALID', () => {
    assertValidationOk(validateInstitutionRecord, institutionFixtures[0].record, 'REFERENCE_PRICE_BOUNDED_VALID')
    const range = institutionFixtures[0].record.price.referenceMonthlyPrice.value.range
    assert.equal(range.kind, 'bounded')
    assert.ok(range.min.amountMinor <= range.max.amountMinor)
    assert.equal(range.period, 'month')
  })

  runCase('REFERENCE_PRICE_STARTING_AT_VALID', () => {
    const record = cloneInstitutionRecord(institutionFixtures[1].record)
    record.price.referenceMonthlyPrice = makeProvidedField({
      basis: 'reference_total',
      range: {
        kind: 'starting_at',
        min: { amountMinor: 480000, currency: 'CNY' },
        max: null,
        period: 'month',
      },
    }, makeVerification('unverified'))
    assertValidationOk(validateInstitutionRecord, record, 'REFERENCE_PRICE_STARTING_AT_VALID')
  })

  runCase('MONTH_ONE_TIME_SEPARATION', () => {
    const record = cloneInstitutionRecord(institutionFixtures[1].record)
    record.price.deposit = makeProvidedField({
      kind: 'bounded',
      min: { amountMinor: 100000, currency: 'CNY' },
      max: { amountMinor: 200000, currency: 'CNY' },
      period: 'one_time',
    }, makeVerification('unverified'))
    assertValidationOk(validateInstitutionRecord, record, 'MONTH_ONE_TIME_SEPARATION')
    assert.equal(record.price.referenceMonthlyPrice.value.range.period, 'month')
    assert.equal(record.price.deposit.value.period, 'one_time')
  })

  runCase('UNKNOWN_PRICE_EXPLICIT_NULL', () => {
    const record = institutionFixtures[3].record
    assert.equal(record.price.referenceMonthlyPrice.availability, 'unknown')
    assert.equal(record.price.referenceMonthlyPrice.value, null)
    assertValidationOk(validateInstitutionRecord, record, 'UNKNOWN_PRICE_EXPLICIT_NULL')
  })

  runCase('INVALID_PRICE_PERIOD_ON_ONE_TIME_FIELD', () => {
    const invalid = cloneInstitutionRecord(institutionFixtures[1].record)
    invalid.price.deposit = makeProvidedField({
      kind: 'bounded',
      min: { amountMinor: 100000, currency: 'CNY' },
      max: { amountMinor: 200000, currency: 'CNY' },
      period: 'month',
    }, makeVerification('unverified'))
    const result = validateInstitutionRecord(invalid)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_FIELD'))
  })

  runCase('AVAILABILITY_INDEPENDENT', () => {
    const available = cloneInstitutionRecord(institutionFixtures[0].record)
    const unavailable = cloneInstitutionRecord(institutionFixtures[0].record)
    unavailable.operations.bedAvailability.status = 'unavailable'
    assertValidationOk(validateInstitutionRecord, available, 'AVAILABILITY_INDEPENDENT.available')
    assertValidationOk(validateInstitutionRecord, unavailable, 'AVAILABILITY_INDEPENDENT.unavailable')
    assert.equal(available.capabilities.careLevelAcceptance.independent.status, 'supported')
    assert.equal(unavailable.capabilities.careLevelAcceptance.independent.status, 'supported')
  })

  runCase('AVAILABILITY_OPTIONAL_FACTS_ABSENT', () => {
    const record = cloneInstitutionRecord(institutionFixtures[3].record)
    delete record.operations.estimatedWait
    delete record.operations.earliestMoveInDate
    assertValidationOk(validateInstitutionRecord, record, 'AVAILABILITY_OPTIONAL_FACTS_ABSENT')
  })

  runCase('EVIDENCE_TYPED_SNAPSHOT', () => {
    const record = institutionFixtures[0].record
    assertValidationOk(validateInstitutionRecord, record, 'EVIDENCE_TYPED_SNAPSHOT')
    const typeEvidence = record.evidence.find((entry) => entry.fieldPath === 'typeProfile.supportedTypes')
    const capabilityEvidence = record.evidence.find((entry) => entry.fieldPath.endsWith('night_care'))
    const priceEvidence = record.evidence.find((entry) => entry.fieldPath === 'price.referenceMonthlyPrice')
    assert.equal(typeEvidence.valueSnapshot.valueType, 'stable_code_list')
    assert.equal(capabilityEvidence.valueSnapshot.valueType, 'stable_code')
    assert.equal(priceEvidence.valueSnapshot.valueType, 'reference_monthly_price')
    assert.equal(typeEvidence.recordRevision, record.recordRevision)
    assert.equal(typeEvidence.observedAt, INSTITUTION_FIXTURE_AS_OF)
  })

  runCase('EVIDENCE_SOURCE_REFERENCE_OPTIONAL', () => {
    const record = institutionFixtures[0].record
    const reference = record.evidence.find((entry) => entry.sourceReference !== undefined)
    const noteOnly = record.evidence.find((entry) => entry.sourceReference === undefined)
    assert.ok(reference && typeof reference.sourceReference === 'string')
    assert.ok(noteOnly && typeof noteOnly.sourceNote === 'string')
    assertValidationOk(validateInstitutionRecord, record, 'EVIDENCE_SOURCE_REFERENCE_OPTIONAL')
  })

  runCase('VR_AVAILABLE_WITH_SCENES', () => {
    const record = institutionFixtures[0].record
    assert.equal(record.vr.status, 'available')
    assert.ok(record.vr.scenes.length > 0)
    assertValidationOk(validateInstitutionRecord, record, 'VR_AVAILABLE_WITH_SCENES')
  })

  runCase('VR_UNAVAILABLE_WITHOUT_SCENES', () => {
    const record = institutionFixtures[3].record
    assert.equal(record.vr.status, 'unknown')
    assert.deepEqual(record.vr.scenes, [])
    assertValidationOk(validateInstitutionRecord, record, 'VR_UNAVAILABLE_WITHOUT_SCENES')
  })

  runCase('QUALIFICATION_VALIDITY_SEPARATE', () => {
    const record = institutionFixtures[0].record
    assert.equal(record.qualifications[0].validity, 'valid')
    assert.equal(record.qualifications[0].verification.status, 'unverified')
    assertValidationOk(validateInstitutionRecord, record, 'QUALIFICATION_VALIDITY_SEPARATE')
  })

  runCase('COVERAGE_MATRIX_ZERO_MISSING', () => {
    const contractPath = path.join(repositoryRoot, 'docs', 'architecture', 'INSTITUTION_CAPABILITY_CONTRACT.md')
    const contractText = readFileSync(contractPath, 'utf8').replaceAll('`', '')
    const matrixStart = contractText.indexOf('## 10. Capability Coverage Matrix')
    const mappingStart = contractText.indexOf('### 10.1 Frozen Mapping Intent')
    const matrixEnd = contractText.indexOf('## 11. Unknown Matrix')
    const matrixSection = contractText.slice(matrixStart, matrixEnd)
    const mappingEnd = contractText.indexOf('## 11. Unknown Matrix', mappingStart)
    const mappingSection = contractText.slice(mappingStart, mappingEnd)
    assert.ok(matrixStart >= 0 && mappingStart > matrixStart && matrixEnd > mappingStart)
    assert.equal(CAPABILITY_COVERAGE_MATRIX.length, EXPECTED_COVERAGE_ROWS.length)
    assert.deepEqual(
      CAPABILITY_COVERAGE_MATRIX.map((entry) => [entry.source, entry.docTarget, entry.target, entry.coverage]),
      EXPECTED_COVERAGE_ROWS,
    )
    EXPECTED_COVERAGE_ROWS.forEach(([source, docTarget, target, coverage]) => {
      assert.ok(matrixSection.includes(`| ${source} | ${docTarget} | ${coverage} |`), `doc matrix row missing: ${source}`)
      if (coverage === 'NOT_APPLICABLE') {
        assert.equal(target, 'none')
      } else {
        assert.ok(MATCHING_CRITICAL_FIELD_PATHS.includes(target), `coverage target is not whitelisted: ${target}`)
      }
    })
    assert.ok(matrixSection.includes('MISSING = 0'))
    assert.deepEqual(
      CAPABILITY_MAPPING_INTENTS.map((entry) => [entry.source, entry.target]),
      EXPECTED_MAPPING_INTENTS,
    )
    EXPECTED_MAPPING_INTENTS.forEach(([source, target]) => {
      assert.ok(mappingSection.includes(`| ${source} | ${target} |`), `doc mapping intent missing: ${source}`)
      assert.ok(MATCHING_CRITICAL_FIELD_PATHS.includes(target), `mapping target is not whitelisted: ${target}`)
    })
    assert.equal(CAPABILITY_COVERAGE_MATRIX.some((entry) => entry.coverage === 'MISSING'), false)
    CAPABILITY_COVERAGE_MATRIX.forEach((entry) => {
      assert.ok(['DIRECT', 'REQUIRES_MAPPING', 'NOT_APPLICABLE'].includes(entry.coverage))
      assert.ok(entry.source && entry.target)
    })
  })

  runCase('MATCHING_WHITELIST_EXACT', () => {
    assert.deepEqual(
      institutionDomain.INSTITUTION_MATCHING_CRITICAL_FIELD_PATHS,
      MATCHING_CRITICAL_FIELD_PATHS,
    )
    assert.equal(new Set(MATCHING_CRITICAL_FIELD_PATHS).size, MATCHING_CRITICAL_FIELD_PATHS.length)
  })

  runCase('DETERMINISTIC_EXPLICIT_TIME', () => {
    const verification = makeVerification('verified')
    const first = resolveEffectiveCapability('supported', verification, INSTITUTION_FIXTURE_EVALUATION_AS_OF)
    const second = resolveEffectiveCapability('supported', verification, INSTITUTION_FIXTURE_EVALUATION_AS_OF)
    assert.equal(first, 'supported')
    assert.equal(second, first)
    assert.equal(resolveEffectiveCapability('supported', verification, '2028-01-01T00:00:00.000Z'), 'unknown')
    const frozenRecord = deepFreeze(cloneInstitutionRecord(institutionFixtures[0].record))
    const frozenBefore = cloneInstitutionRecord(frozenRecord)
    const firstValidation = validateInstitutionRecord(frozenRecord)
    const secondValidation = validateInstitutionRecord(frozenRecord)
    assert.equal(firstValidation.ok, true)
    assert.deepEqual(secondValidation, firstValidation)
    assert.deepEqual(frozenRecord, frozenBefore, 'validator mutated a deeply frozen record')
    loadedSourceTexts.forEach((source, filePath) => {
      assert.equal(/\bDate\.now\s*\(/.test(source), false, `${filePath} reads implicit current time`)
    })
  })

  runCase('JCS_RUNTIME_DEPENDENCY_ZERO', () => {
    assert.equal(externalImports.length, 0)
    const emitted = [...loadedSourceTexts.values()].join('\n')
    assert.equal(/require\(['"][^./][^'"]*jcs/i.test(emitted), false)
    assert.equal(/from\s+['"][^./][^'"]*jcs/i.test(emitted), false)
  })

  runCase('PURE_DEPENDENCY_GRAPH', () => {
    assert.ok(loadedSourcePaths.size >= 5)
    loadedSourcePaths.forEach((filePath) => {
      assert.equal(
        isWithin(filePath, institutionDomainRoot) || normalizePath(filePath) === normalizePath(institutionTypePath),
        true,
        `outside pure graph: ${filePath}`,
      )
    })
  })

  runCase('RECOMMENDATION_UI_BACKEND_DEPENDENCY_ZERO', () => {
    assert.equal(loadedSourcePaths.has(path.join(repositoryRoot, 'server')), false)
    loadedSourcePaths.forEach((filePath) => {
      assert.equal(isWithin(filePath, path.join(repositoryRoot, 'miniprogram', 'pages')), false)
      assert.equal(isWithin(filePath, path.join(repositoryRoot, 'miniprogram', 'components')), false)
      assert.equal(isWithin(filePath, path.join(repositoryRoot, 'miniprogram', 'services')), false)
    })
  })

  assert.deepEqual(caseIds, EXPECTED_CASE_IDS, 'Institution runtime case ID set/order drifted')
  assert.equal(new Set(caseIds).size, caseIds.length, 'Institution runtime case IDs are not unique')
  if (failures.length > 0) {
    console.error(`INSTITUTION RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${typescript.version} (${parserPath})`)
  console.log(`LOADED_PURE_MODULES: ${loadedSourcePaths.size}`)
  console.log(`EXTERNAL_RUNTIME_IMPORTS: ${externalImports.length}`)
  console.log(`INSTITUTION RUNTIME PASS: ${caseCount} cases`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`INSTITUTION RUNTIME ERROR: ${message}`)
  process.exitCode = 1
}
