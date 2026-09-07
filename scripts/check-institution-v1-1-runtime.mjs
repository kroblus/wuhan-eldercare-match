import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  INSTITUTION_V11_AS_OF,
  INSTITUTION_V11_DATA_LABEL,
  INSTITUTION_V11_DATA_PROVENANCE,
  INSTITUTION_V11_EVALUATION_AS_OF,
  INSTITUTION_V11_FIXTURE_MANIFEST,
  INSTITUTION_V11_FIXTURE_POLICY,
  INSTITUTION_V11_SYNTHETIC_VERIFICATION,
  V1_FROZEN_CAPABILITY_CODES,
  cloneInstitutionV11Record,
  institutionV11Fixtures,
} from './fixtures/institution-v1-1-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const institutionDomainRoot = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution')
const institutionV11DomainRoot = path.join(institutionDomainRoot, 'v1-1')
const institutionV11EntryPath = path.join(institutionV11DomainRoot, 'index.ts')
const institutionTypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution.ts')
const institutionV11TypePath = path.join(repositoryRoot, 'miniprogram', 'types', 'institution-v1-1.ts')
const applicationMockRoot = path.join(repositoryRoot, 'miniprogram', 'mock')
const failures = []
const caseIds = []
let caseCount = 0

const normalizePath = (filePath) => path.resolve(filePath).toLowerCase()

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
    // The project intentionally keeps TypeScript out of runtime dependencies.
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

const createSourceLoader = (typescript, allowedRoots, loadedSourcePaths, loadedSourceTexts) => {
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
    if (!allowedRoots.some((root) => isWithin(resolvedPath, root))) {
      throw new Error(`Institution V1.1 runtime loaded a file outside its allowed boundary: ${path.relative(repositoryRoot, resolvedPath)}`)
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
        throw new Error(`Institution V1.1 runtime forbids external import ${request} from ${resolvedPath}`)
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

const assertValidationOk = (validator, record, label) => {
  const result = validator(record)
  assert.equal(result.ok, true, `${label} should be valid: ${JSON.stringify(result)}`)
}

const assertValidationFail = (validator, fixture) => {
  const result = validator(fixture.record)
  assert.equal(result.ok, false, `${fixture.id} should be invalid`)
  const issueCodes = result.issues.map((issue) => issue.code)
  assert.ok(
    fixture.expectedCodes.some((code) => issueCodes.includes(code)),
    `${fixture.id} expected one of ${fixture.expectedCodes.join(', ')}; got ${issueCodes.join(', ')}`,
  )
}

const setPath = (root, dottedPath, value) => {
  const parts = dottedPath.split('.')
  let cursor = root
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor[part]
  })
  cursor[parts[parts.length - 1]] = value
}

const getPath = (root, dottedPath) => dottedPath.split('.').reduce((value, part) => value[part], root)

const updateEvidenceValue = (record, fieldPath, value) => {
  const field = getPath(record, fieldPath)
  field.value = value
  field.verification.evidenceIds.forEach((evidenceId) => {
    const evidence = record.evidence.find((item) => item.evidenceId === evidenceId)
    if (evidence) {
      evidence.valueSnapshot.value = value
    }
  })
}

const replaceWithUnknownField = (record, fieldPath) => {
  const field = getPath(record, fieldPath)
  const evidenceIds = field && field.verification && Array.isArray(field.verification.evidenceIds)
    ? field.verification.evidenceIds
    : []
  record.evidence = record.evidence.filter((item) => !evidenceIds.includes(item.evidenceId))
  setPath(record, fieldPath, {
    availability: 'unknown',
    value: null,
    verification: { status: 'unverified', evidenceIds: [] },
  })
}

const cloneAndSet = (fixture, fieldPath, value) => {
  const record = cloneInstitutionV11Record(fixture.record)
  setPath(record, fieldPath, value)
  return record
}

const deepEqual = (left, right) => {
  assert.deepEqual(left, right)
}

const walkFiles = async (root) => {
  const files = []
  if (!existsSync(root)) {
    return files
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFiles(entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
  return files
}

const assertCapabilityMatrixFrozen = (record, projected) => {
  Object.keys(V1_FROZEN_CAPABILITY_CODES).forEach((group) => {
    const expectedCodes = V1_FROZEN_CAPABILITY_CODES[group]
    assert.deepEqual(Object.keys(record.capabilities[group]).sort(), [...expectedCodes].sort())
    assert.deepEqual(Object.keys(projected.capabilities[group]).sort(), [...expectedCodes].sort())
    deepEqual(projected.capabilities[group], record.capabilities[group])
    expectedCodes.forEach((code) => {
      const capability = record.capabilities[group][code]
      assert.equal(capability.code, code)
      assert.ok(['supported', 'requires_assessment', 'unsupported', 'unknown'].includes(capability.status))
      assert.ok(['unverified', 'verified', 'expired'].includes(capability.verification.status))
    })
  })
}

const assertExtensionEvidence = (record) => {
  const extensionPrefixes = [
    'staffing.', 'medicalSupport.clinic', 'medicalSupport.relationships',
    'medicalSupport.medicalDuty24h', 'medicalSupport.medicalDuty24hNote',
    'healthMonitoring.', 'activity.', 'transportation.', 'majorHospitalAccess.',
    'rooms.0.features.',
  ]
  const relevantEvidence = record.evidence.filter((evidence) =>
    extensionPrefixes.some((prefix) => evidence.fieldPath.startsWith(prefix)))
  relevantEvidence.forEach((evidence) => {
    const field = getPath(record, evidence.fieldPath)
    assert.ok(field && field.verification, `missing field for ${evidence.fieldPath}`)
    assert.ok(field.verification.evidenceIds.includes(evidence.evidenceId))
    deepEqual(evidence.valueSnapshot.value, field.value)
    assert.equal(evidence.institutionId, record.institutionId)
    assert.equal(evidence.recordRevision, record.recordRevision)
    assert.equal(evidence.verificationStatus, field.verification.status)
  })
}

const run = async () => {
  const { parser: typescript, parserPath, source: parserSource } = await loadWechatTypeScript()
  const loadedSourcePaths = new Set()
  const loadedSourceTexts = new Map()
  const loadDomainModule = createSourceLoader(
    typescript,
    [institutionDomainRoot, institutionTypePath, institutionV11TypePath],
    loadedSourcePaths,
    loadedSourceTexts,
  )
  const institutionV11Domain = loadDomainModule(institutionV11EntryPath)
  const institutionV1Domain = loadDomainModule(path.join(institutionDomainRoot, 'index.ts'))
  const validateV11 = institutionV11Domain.validateInstitutionRecordV11
  const validateV1 = institutionV1Domain.validateInstitutionRecord
  const projectToV1 = institutionV11Domain.projectInstitutionRecordV11ToV1
  const miniprogramSourceFiles = (await walkFiles(path.join(repositoryRoot, 'miniprogram')))
    .filter((filePath) => /\.(ts|js)$/.test(filePath))
  assert.equal(typeof validateV11, 'function')
  assert.equal(typeof validateV1, 'function')
  assert.equal(typeof projectToV1, 'function')

  runCase('MANIFEST_EXACT_ID_SET', () => {
    assert.equal(institutionV11Fixtures.length, INSTITUTION_V11_FIXTURE_MANIFEST.expectedCount)
    assert.deepEqual(
      institutionV11Fixtures.map((fixture) => fixture.id),
      INSTITUTION_V11_FIXTURE_MANIFEST.expectedIds,
    )
    assert.deepEqual(
      institutionV11Fixtures.map((fixture) => fixture.category),
      INSTITUTION_V11_FIXTURE_MANIFEST.expectedCategories,
    )
    assert.equal(new Set(institutionV11Fixtures.map((fixture) => fixture.id)).size, 20)
  })

  runCase('MANIFEST_ANTI_FAKE_GREEN', () => {
    const invalidIds = institutionV11Fixtures.filter((fixture) => !fixture.expectedValid).map((fixture) => fixture.id)
    assert.deepEqual(invalidIds, INSTITUTION_V11_FIXTURE_MANIFEST.expectedInvalidIds)
    assert.equal(
      institutionV11Fixtures.find((fixture) => fixture.id === INSTITUTION_V11_FIXTURE_MANIFEST.capabilityPreservationFixtureId).expectedValid,
      true,
    )
    institutionV11Fixtures.forEach((fixture) => {
      assert.equal(fixture.labels.fixturePolicy, INSTITUTION_V11_FIXTURE_POLICY)
      assert.equal(fixture.labels.dataProvenance, INSTITUTION_V11_DATA_PROVENANCE)
      assert.equal(fixture.labels.data, INSTITUTION_V11_DATA_LABEL)
      assert.equal(fixture.record.contractVersion, 'institution-contract-v1.1')
      assert.equal(fixture.record.capabilityContractVersion, 'institution-capability-contract-v1')
      assert.equal(fixture.record.recordProvenance, INSTITUTION_V11_DATA_PROVENANCE)
      assert.match(fixture.record.identity.name.value, /Mock/)
      assert.equal(fixture.record.vr.status, 'unknown')
      assert.deepEqual(fixture.record.vr.scenes, [])
    })
  })

  runCase('MATCHING_ROLE_MATRIX_EXACT', () => {
    const matrix = institutionV11Domain.V1_1_INSTITUTION_FIELD_MATCHING_ROLE_MATRIX
    const expectedPatterns = [
      'rooms.*.roomType',
      'meal.mealSchedule',
      'meal.easyChewSupport',
      'meal.modifiedFoodSupport',
      'meal.mealFee',
      'meal.specialDietExtraFee',
      'meal.serviceNote',
      'staffing.*',
      'medicalSupport.*',
      'healthMonitoring.*',
      'rooms.*.features.*',
      'activity.indoorSpace',
      'activity.outdoorSpace',
      'activity.offerings.*',
      'activity.zones.*',
      'transportation.*',
      'majorHospitalAccess.*',
      'price.recurringComponents.*',
      'price.deposit',
      'price.oneTimeFees.*',
      'operations.*',
      'evidence.*',
      'recordRevision',
    ]
    assert.deepEqual(matrix.map((entry) => entry.fieldPathPattern), expectedPatterns)
    assert.equal(new Set(matrix.map((entry) => entry.fieldPathPattern)).size, matrix.length)
    assert.deepEqual(
      [...new Set(matrix.map((entry) => entry.role))].sort(),
      ['AUDIT_ONLY', 'DISPLAY_EXPLAINABLE', 'MATCHING_CANDIDATE', 'NOT_YET_SCORABLE', 'OPERATIONAL_ONLY'],
    )
  })

  institutionV11Fixtures.filter((fixture) => fixture.expectedValid).forEach((fixture) => {
    runCase(`VALID_${fixture.id}`, () => {
      assertValidationOk(validateV11, fixture.record, fixture.id)
      assertExtensionEvidence(fixture.record)
      const projected = projectToV1(fixture.record)
      assert.equal(projected.contractVersion, 'institution-contract-v1')
      assert.equal(projected.capabilityContractVersion, 'institution-capability-contract-v1')
      assertValidationOk(validateV1, projected, `${fixture.id} V1 projection`)
      assertCapabilityMatrixFrozen(fixture.record, projected)
    })
  })

  institutionV11Fixtures.filter((fixture) => !fixture.expectedValid).forEach((fixture) => {
    runCase(`INVALID_${fixture.id}`, () => assertValidationFail(validateV11, fixture))
  })

  runCase('UNKNOWN_STAFFING_IS_NOT_ZERO', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-003').record
    assert.equal(record.staffing.counts.availability, 'unknown')
    assert.equal(record.staffing.counts.value, null)
    assert.equal(record.staffing.caregiverCertification.certifiedCaregiverCount.value, null)
    assertValidationOk(validateV11, record, 'unknown staffing')
  })

  runCase('UNKNOWN_PRICE_IS_NOT_ZERO', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-016').record
    assert.equal(record.price.referenceMonthlyPrice.availability, 'unknown')
    assert.equal(record.price.referenceMonthlyPrice.value, null)
    assert.equal(record.price.deposit.availability, 'unknown')
    assert.equal(record.price.deposit.value, null)
    assertValidationOk(validateV11, record, 'unknown price')
  })

  runCase('MEAL_STATUS_DOES_NOT_BECOME_CAPABILITY', () => {
    const easyChew = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-010').record
    const modifiedFood = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-011').record
    assert.equal(easyChew.meal.easyChewSupport.value, 'available')
    assert.equal(modifiedFood.meal.modifiedFoodSupport.value, 'available')
    assert.equal(easyChew.capabilities.specialCare.tube_feeding.code, 'tube_feeding')
    assert.equal(modifiedFood.capabilities.specialCare.tube_feeding.code, 'tube_feeding')
    assert.equal(easyChew.capabilities.specialCare.tube_feeding.status, 'supported')
    assert.equal(modifiedFood.capabilities.specialCare.tube_feeding.status, 'supported')
  })

  runCase('MEAL_AVAILABLE_WITH_UNKNOWN_TUBE_FEEDING_CAPABILITY', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-011')
    const record = cloneInstitutionV11Record(source.record)
    const tubeFeeding = record.capabilities.specialCare.tube_feeding
    const removedEvidenceIds = tubeFeeding.verification.evidenceIds
    record.evidence = record.evidence.filter((item) => !removedEvidenceIds.includes(item.evidenceId))
    tubeFeeding.status = 'unknown'
    tubeFeeding.verification = { status: 'unverified', evidenceIds: [] }
    assertValidationOk(validateV11, record, 'meal available with unknown tube-feeding capability')
    assert.equal(record.meal.modifiedFoodSupport.value, 'available')
    assert.equal(record.capabilities.specialCare.tube_feeding.status, 'unknown')
  })

  runCase('DUPLICATE_ACTIVITY_ID_REJECTED', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-012')
    const record = cloneInstitutionV11Record(source.record)
    record.activity.offerings[1].activityId = record.activity.offerings[0].activityId
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_ACTIVITY_FACT'))
  })

  runCase('INVALID_SERVICE_STATUS_REJECTED', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-010')
    const record = cloneAndSet(source, 'meal.easyChewSupport.availability', 'invalid_status')
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_MEAL_SERVICE'))
  })

  runCase('ZERO_TRANSPORT_DISTANCE_REJECTED', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-013')
    const record = cloneInstitutionV11Record(source.record)
    updateEvidenceValue(record, 'transportation.metro.distanceMeters', 0)
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) =>
      issue.code === 'INVALID_TRANSPORTATION_FACT'
        && issue.path === 'transportation.metro.distanceMeters.value'))
  })

  runCase('INVALID_AS_OF_REJECTED', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-002')
    const record = cloneAndSet(source, 'staffing.nurseResponseTime.responseTimeMinutes.asOf', 'not-an-iso-time')
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_V11_STAFFING'))
  })

  runCase('RESPONSE_TIME_REQUIRES_MEASUREMENT_SEMANTICS', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-002')
    const record = cloneInstitutionV11Record(source.record)
    replaceWithUnknownField(record, 'staffing.nurseResponseTime.scenario')
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) =>
      issue.code === 'INVALID_V11_STAFFING'
        && issue.path === 'staffing.nurseResponseTime.responseTimeMinutes'))
  })

  runCase('MONITORING_FREQUENCY_REQUIRES_AVAILABLE_SERVICE', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-005')
    const record = cloneInstitutionV11Record(source.record)
    updateEvidenceValue(record, 'healthMonitoring.bloodPressure.availability', 'unavailable')
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) =>
      issue.code === 'INVALID_HEALTH_MONITORING'
        && issue.path === 'healthMonitoring.bloodPressure.frequency'))
  })

  runCase('HOSPITAL_DISTANCE_REQUIRES_METHOD_AND_SOURCE', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-014')
    const record = cloneInstitutionV11Record(source.record)
    replaceWithUnknownField(record, 'majorHospitalAccess.0.distanceMethod')
    const result = validateV11(record)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) =>
      issue.code === 'INVALID_MAJOR_HOSPITAL_ACCESS'
        && issue.path === 'majorHospitalAccess.0.distanceMeters'))
  })

  runCase('ZERO_DISTANCE_ONLY_WITH_CO_LOCATION', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-014')
    const colocated = cloneInstitutionV11Record(source.record)
    updateEvidenceValue(colocated, 'majorHospitalAccess.0.distanceMeters', 0)
    updateEvidenceValue(colocated, 'majorHospitalAccess.0.distanceMethod', 'co_located')
    assertValidationOk(validateV11, colocated, 'co-located hospital distance')

    const nonColocated = cloneInstitutionV11Record(source.record)
    updateEvidenceValue(nonColocated, 'majorHospitalAccess.0.distanceMeters', 0)
    const result = validateV11(nonColocated)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => issue.code === 'INVALID_MAJOR_HOSPITAL_ACCESS'))
  })

  runCase('ZERO_HOSPITAL_DISTANCE_INVALID_VERIFICATION_NEVER_THROWS', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-014')
    const fieldPaths = [
      'majorHospitalAccess.0.distanceMeters',
      'majorHospitalAccess.0.distanceMethod',
      'majorHospitalAccess.0.distanceSource',
    ]
    fieldPaths.forEach((fieldPath) => {
      const record = cloneInstitutionV11Record(source.record)
      updateEvidenceValue(record, 'majorHospitalAccess.0.distanceMeters', 0)
      updateEvidenceValue(record, 'majorHospitalAccess.0.distanceMethod', 'co_located')
      delete getPath(record, fieldPath).verification
      let result
      assert.doesNotThrow(() => {
        result = validateV11(record)
      })
      assert.equal(result.ok, false)
      assert.ok(result.issues.some((issue) =>
        issue.code === 'INVALID_VERIFICATION'
          || issue.code === 'INVALID_MAJOR_HOSPITAL_ACCESS'))
    })
  })

  runCase('EVIDENCE_BINDING_AND_SYNTHETIC_LABEL', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-015').record
    const priceEvidence = record.evidence.find((entry) => entry.fieldPath === 'price.recurringComponents.0.referenceAmount')
    assert.ok(priceEvidence)
    assert.equal(priceEvidence.sourceNote.includes(INSTITUTION_V11_SYNTHETIC_VERIFICATION), true)
    assert.equal(priceEvidence.sourceNote.includes(INSTITUTION_V11_DATA_LABEL), true)
    assert.equal(priceEvidence.institutionId, record.institutionId)
    assert.equal(priceEvidence.recordRevision, record.recordRevision)
    const result = validateV11(record)
    assert.equal(result.ok, true)
  })

  runCase('INVALID_EXTENSION_EVIDENCE_BINDINGS_REJECTED', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-002')
    const fieldPath = 'staffing.caregiverCertification.certifiedCaregiverCount'
    const makeMutation = (mutate) => {
      const record = cloneInstitutionV11Record(source.record)
      const evidenceId = getPath(record, fieldPath).verification.evidenceIds[0]
      const evidence = record.evidence.find((item) => item.evidenceId === evidenceId)
      mutate(record, evidence)
      const result = validateV11(record)
      assert.equal(result.ok, false)
      assert.ok(result.issues.some((issue) =>
        issue.code === 'INVALID_V11_EVIDENCE'
          || issue.code === 'BROKEN_REFERENCE'
          || issue.code === 'EVIDENCE_VALUE_MISMATCH'))
    }
    makeMutation((_record, evidence) => { evidence.institutionId = 'wrong-institution-id' })
    makeMutation((_record, evidence) => { evidence.recordRevision += 1 })
    makeMutation((_record, evidence) => { evidence.verificationStatus = 'expired' })
    makeMutation((_record, evidence) => { evidence.valueSnapshot.value += 1 })
    makeMutation((record, evidence) => {
      record.evidence.push({
        ...JSON.parse(JSON.stringify(evidence)),
        evidenceId: 'ev-orphan-v11-extension',
      })
    })
  })

  runCase('NO_V11_CAPABILITY_CODE_ADDED', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-020').record
    const projected = projectToV1(record)
    Object.keys(V1_FROZEN_CAPABILITY_CODES).forEach((group) => {
      assert.deepEqual(Object.keys(record.capabilities[group]).sort(), [...V1_FROZEN_CAPABILITY_CODES[group]].sort())
      assert.deepEqual(Object.keys(projected.capabilities[group]).sort(), [...V1_FROZEN_CAPABILITY_CODES[group]].sort())
    })
    assert.equal(record.capabilityContractVersion, 'institution-capability-contract-v1')
    assertValidationOk(validateV11, record, 'capability preservation')
  })

  runCase('V1_CAPABILITY_STATUS_SNAPSHOT_EXACT', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-020').record
    Object.keys(V1_FROZEN_CAPABILITY_CODES).forEach((group) => {
      V1_FROZEN_CAPABILITY_CODES[group].forEach((code) => {
        assert.equal(record.capabilities[group][code].status, 'supported')
        assert.equal(record.capabilities[group][code].verification.status, 'verified')
      })
    })
  })

  runCase('ACTIVITY_ZONE_DOES_NOT_BECOME_CAPABILITY', () => {
    const activity = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-012').record
    const baseline = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-001').record
    assert.equal(activity.activity.zones.dementiaZone.value, 'present')
    assert.equal(
      activity.capabilities.specialCare.dementia_unit.status,
      baseline.capabilities.specialCare.dementia_unit.status,
    )
  })

  runCase('PRICE_COMPONENTS_DO_NOT_REWRITE_REFERENCE_TOTAL', () => {
    const source = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-015')
    const record = cloneInstitutionV11Record(source.record)
    const referenceBefore = JSON.parse(JSON.stringify(record.price.referenceMonthlyPrice))
    updateEvidenceValue(record, 'price.recurringComponents.0.referenceAmount', {
      kind: 'bounded',
      min: { amountMinor: 910000, currency: 'CNY' },
      max: { amountMinor: 930000, currency: 'CNY' },
      period: 'month',
    })
    assertValidationOk(validateV11, record, 'independent component and reference total')
    assert.deepEqual(record.price.referenceMonthlyPrice, referenceBefore)
  })

  runCase('V1_PROJECTION_STRIPS_EXTENSION_EVIDENCE', () => {
    const record = institutionV11Fixtures.find((fixture) => fixture.id === 'INST-V11-002').record
    const projected = projectToV1(record)
    assert.equal(
      projected.evidence.some((item) => institutionV11Domain.isInstitutionV11ExtensionFieldPath(item.fieldPath)),
      false,
    )
    assertValidationOk(validateV1, projected, 'V1 projection without extension evidence')
  })

  runCase('EXPLICIT_EVALUATION_TIME_FIXTURE', () => {
    assert.equal(INSTITUTION_V11_AS_OF, '2026-08-30T09:00:00.000Z')
    assert.equal(INSTITUTION_V11_EVALUATION_AS_OF, '2026-08-31T09:00:00.000Z')
    assert.equal(/Z$/.test(INSTITUTION_V11_EVALUATION_AS_OF), true)
  })

  runCase('APP_DEVELOPMENT_CATALOG_EIGHT_V11_RECORDS', () => {
    // This is a static runtime check of the application-owned catalog. It does
    // not import the test fixture module into app code.
    const appLoadedPaths = new Set()
    const appLoadedTexts = new Map()
    const loadAppModule = createSourceLoader(
      typescript,
      [institutionDomainRoot, path.join(repositoryRoot, 'miniprogram', 'types'), applicationMockRoot],
      appLoadedPaths,
      appLoadedTexts,
    )
    const appCatalog = loadAppModule(path.join(applicationMockRoot, 'institution-catalog.mock.ts'))
    const records = appCatalog.MOCK_INSTITUTION_CATALOG_V11_RECORDS
    assert.ok(Array.isArray(records))
    assert.equal(records.length, 8)
    records.forEach((record) => {
      assert.equal(record.contractVersion, 'institution-contract-v1.1')
      assert.equal(record.recordProvenance, 'MOCK_DEVELOPMENT_ONLY')
      assert.match(record.identity.name.value, /Mock/)
      assertValidationOk(validateV11, record, record.institutionId)
    })
    const appSources = [...appLoadedTexts.entries()]
    appSources.forEach(([filePath, source]) => {
      assert.equal(/scripts[\\/]fixtures|institution-v1-1-fixtures/.test(source), false, `${filePath} imports test fixtures`)
    })
  })

  runCase('APP_SOURCE_FIXTURE_IMPORT_ZERO', () => {
    const offenders = miniprogramSourceFiles.filter((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      return /scripts[\\/]fixtures|institution-v1-1-fixtures/.test(source)
    })
    assert.deepEqual(offenders, [])
  })

  runCase('PURE_V11_DEPENDENCY_BOUNDARY', () => {
    loadedSourcePaths.forEach((filePath) => {
      assert.equal(
        isWithin(filePath, institutionDomainRoot)
          || normalizePath(filePath) === normalizePath(institutionTypePath)
          || normalizePath(filePath) === normalizePath(institutionV11TypePath),
        true,
        `outside institution domain boundary: ${path.relative(repositoryRoot, filePath)}`,
      )
    })
    assert.equal([...loadedSourceTexts.values()].some((source) => /\bDate\.now\s*\(/.test(source)), false)
  })

  if (failures.length > 0) {
    console.error(`INSTITUTION V1.1 RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`PARSER_SOURCE: ${parserSource}`)
  console.log(`PARSER: TypeScript ${typescript.version} (${parserPath})`)
  console.log(`LOADED_PURE_MODULES: ${loadedSourcePaths.size}`)
  console.log(`INSTITUTION_V11_RUNTIME_PASS: ${caseCount} cases`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`INSTITUTION V1.1 RUNTIME ERROR: ${message}`)
  process.exitCode = 1
}
