import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  INSTITUTION_V121_EVALUATION_AS_OF,
  SYNTHETIC_ADDRESS,
  SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER,
  SYNTHETIC_COMPLETENESS_CRITERIA_REF,
  SYNTHETIC_COMPLETENESS_CRITERIA_RESOLVER,
  SYNTHETIC_GEO,
  SYNTHETIC_LANDLINE,
  SYNTHETIC_MOBILE,
  cloneInstitutionV121Record,
  enrichInstitutionV121,
  makeEvidenceField,
  makePublicContent,
  makeUnknownCareProcess,
  makeUnknownOfficialContact,
  makeUnknownPublicLocation,
  makeValidInstitutionV12,
  makeValidInstitutionV121,
  unknownField,
  unavailableField,
  unverifiedField,
} from './fixtures/institution-v1-2-1-fixtures.mjs'
import { makeV2InstitutionPool } from './fixtures/recommendation-v2-fixtures.mjs'
import { makeAssessmentDraftV2 } from './fixtures/elder-profile-v2-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const v121Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2-1', 'index.ts')
const v12Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2', 'index.ts')
const v11Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-1', 'index.ts')
const recommendationV2Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'recommendation', 'v2', 'index.ts')
const elderProfileV2Entry = path.join(repositoryRoot, 'miniprogram', 'domain', 'elder-profile', 'v2', 'index.ts')

const failures = []
const executedIds = []
const categoryCounts = new Map()

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const formatDiagnostic = (typescript, diagnostic) => {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  if (!diagnostic.file || diagnostic.start === undefined) return message
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
  return `${path.relative(repositoryRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`
}

const loadWechatTypeScript = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parser = require(path.resolve(explicitPath))
    if (parser.version !== '4.1.2') throw new Error(`expected WeChat TypeScript 4.1.2, got ${parser.version}`)
    return { parser, parserPath: path.resolve(explicitPath), source: 'WECHAT_TYPESCRIPT_PATH' }
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('WeChat TypeScript 4.1.2 not found')
  }
  const profileRoot = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
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
  const selected = candidates.find((candidate) => require(candidate.parserPath).version === '4.1.2')
  if (!selected) throw new Error('WeChat TypeScript 4.1.2 parser not found')
  return { parser: require(selected.parserPath), parserPath: selected.parserPath, source: 'WeChat DevTools mptslib' }
}

const createLoader = (typescript, loadedSources) => {
  const cache = new Map()
  const resolve = (request, importer) => {
    const base = path.resolve(path.dirname(importer), request)
    const candidates = [`${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js'), base]
    const resolved = candidates.find(existsSync)
    if (!resolved) throw new Error(`cannot resolve ${request} from ${importer}`)
    return resolved
  }
  const load = (filePath) => {
    const resolved = path.resolve(filePath)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = readFileSync(resolved, 'utf8')
    loadedSources.set(resolved, source)
    const output = resolved.endsWith('.ts') ? typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
      fileName: resolved,
      reportDiagnostics: true,
    }) : { outputText: source, diagnostics: [] }
    const errors = (output.diagnostics || []).filter((diagnostic) =>
      diagnostic.category === typescript.DiagnosticCategory.Error)
    if (errors.length > 0) throw new Error(errors.map((item) => formatDiagnostic(typescript, item)).join('\n'))
    const localRequire = (request) => {
      if (!request.startsWith('.')) throw new Error(`runtime dependency forbidden: ${request}`)
      return load(resolve(request, resolved))
    }
    const factory = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){\n${output.outputText}\n})`, { filename: resolved })
    factory(localRequire, module, module.exports, resolved, path.dirname(resolved))
    return module.exports
  }
  return load
}

const options = {
  administrativeDivisionResolver: SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER,
  completenessCriteriaResolver: SYNTHETIC_COMPLETENESS_CRITERIA_RESOLVER,
}

const run = (category, id, assertion) => {
  const fullId = `${category}-${id}`
  executedIds.push(fullId)
  categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
  try {
    assertion()
  } catch (error) {
    failures.push(`${fullId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const codes = (result) => result.ok ? [] : result.issues.map((issue) => issue.code)
const expectInvalid = (result, expectedCode) => {
  assert.equal(result.ok, false)
  if (expectedCode) assert.ok(codes(result).includes(expectedCode), `${expectedCode} not in ${codes(result).join(',')}`)
}

const removeEvidenceForField = (record, field) => {
  const ids = field.verification.evidenceIds.slice()
  record.evidence = record.evidence.filter((entry) => !ids.includes(entry.evidenceId))
}

const setUnverified = (record, field) => {
  removeEvidenceForField(record, field)
  field.verification = { status: 'unverified', evidenceIds: [] }
}

const makeCareRecord = () => {
  const record = makeValidInstitutionV121()
  record.careProcess.careRecord.presence = unverifiedField('present')
  return record
}

const makeShiftRecord = () => {
  const record = makeValidInstitutionV121()
  record.careProcess.shiftHandover24h.presence = unverifiedField('present')
  return record
}

const makePhoneRecord = (phones = [SYNTHETIC_MOBILE]) => {
  const record = makeValidInstitutionV121()
  record.officialContact.phoneDirectoryPresence = unverifiedField('present')
  record.officialContact.officialPhones = phones.map((phone, index) => ({
    officialPhoneKey: `phone-test-${String(index + 1).padStart(3, '0')}`,
    phone: unverifiedField(clone(phone)),
  }))
  return record
}

const makeAddressRecord = () => {
  const record = makeValidInstitutionV121()
  record.publicLocation.address = unverifiedField(clone(SYNTHETIC_ADDRESS))
  return record
}

const makeGeoRecord = () => {
  const record = makeValidInstitutionV121()
  record.publicLocation.geo = unverifiedField(clone(SYNTHETIC_GEO))
  return record
}

const makeSuccessorFromV11 = (record) => ({
  ...clone(record),
  contractVersion: 'institution-contract-v1.2.1',
  careProcess: makeUnknownCareProcess(),
  officialContact: makeUnknownOfficialContact(),
  publicLocation: makeUnknownPublicLocation(),
})

const baseProfileAnswers = {
  'preference.careType': 'medical_nursing_integrated',
  'preference.roomType': 'no_preference',
  'preference.mealSchedule': 'no_preference',
  'preference.activityPreference': 'no_preference',
  'preference.priorities': ['price'],
  'budget.monthlyRange': 'cny_5000_8000',
}

const execute = async () => {
  const loadedSources = new Map()
  const wechatTypeScript = await loadWechatTypeScript()
  const load = createLoader(wechatTypeScript.parser, loadedSources)
  const v121 = load(v121Entry)
  const v12 = load(v12Entry)
  const v11 = load(v11Entry)
  const recommendationV2 = load(recommendationV2Entry)
  const elderProfileV2 = load(elderProfileV2Entry)

  runCareProcessTests(v121, v12)
  runFrequencyTests(v121, v12)
  runCompletenessTests(v121)
  runEvidenceTests(v121)
  runPhoneTests(v121)
  runAddressTests(v121)
  runGeoTests(v121)
  runMapTests(v121)
  runPublicContentTests(v121)
  runPublicResolverTests(v121)
  runV12Tests(v12)
  runV121Tests(v121)
  runDispatchTests(v121)
  runProjectionV12Tests(v121, v12)
  runProjectionV11Tests(v121, v11)
  runProjectionParityTests(v121, v12)
  runRecommendationParityTests(v121, recommendationV2, elderProfileV2)
  runStaticIsolationTests(loadedSources)

  const minimums = {
    CARE: 35,
    FREQUENCY: 15,
    COMPLETENESS: 10,
    EVIDENCE: 25,
    PHONE: 30,
    ADDRESS: 20,
    GEO: 20,
    MAP: 15,
    PUBLIC_CONTENT: 25,
    PUBLIC_RESOLVER: 15,
    V12: 15,
    V121: 30,
    DISPATCH: 12,
    PROJECT_V12: 15,
    PROJECT_V11: 20,
    PROJECTION_PARITY: 10,
    RECOMMENDATION_PARITY: 20,
  }
  Object.entries(minimums).forEach(([category, minimum]) => {
    if ((categoryCounts.get(category) || 0) < minimum) {
      failures.push(`${category}: expected at least ${minimum} cases, got ${categoryCounts.get(category) || 0}`)
    }
  })
  assert.equal(new Set(executedIds).size, executedIds.length, 'runtime case IDs must be unique')
  if (failures.length > 0) {
    console.error('INSTITUTION_V1_2_1_RUNTIME = FAIL')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log('INSTITUTION_V1_2_1_RUNTIME = PASS')
  console.log(`WECHAT_TYPESCRIPT_RUNTIME = ${wechatTypeScript.parser.version} (${wechatTypeScript.source})`)
  console.log(`TOTAL_CASES = ${executedIds.length}`)
  Object.keys(minimums).forEach((category) => {
    console.log(`${category}_CASES = ${categoryCounts.get(category)}`)
  })
  console.log('SYNTHETIC_FIXTURE_POLICY = PASS')
  console.log('RECOMMENDATION_V2_ISOLATION = PASS')
}

const runCareProcessTests = (v121) => {
  run('CARE', '001-all-unknown', () => assert.equal(v121.validateInstitutionRecordV121(
    makeValidInstitutionV121(), options,
  ).ok, true))
  ;[
    ['present', true],
    ['absent', true],
    ['unknown', true],
    ['unavailable', true],
  ].forEach(([state, valid], index) => run('CARE', `00${index + 2}-care-parent-${state}`, () => {
    const record = makeValidInstitutionV121()
    record.careProcess.careRecord.presence = state === 'unknown'
      ? unknownField() : state === 'unavailable' ? unavailableField() : unverifiedField(state)
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, valid)
  }))
  const careDependents = [
    ['completeness', 'complete'],
    ['completenessCriteriaRef', 'test-only-criteria'],
    ['frequency', ['daily']],
    ['otherFrequencyNote', 'stale note'],
    ['traceability', 'traceable'],
  ]
  careDependents.forEach(([field, value], index) => run('CARE', `01${index}-absent-dirty-${field}`, () => {
    const record = makeValidInstitutionV121()
    record.careProcess.careRecord.presence = unverifiedField('absent')
    record.careProcess.careRecord[field] = unverifiedField(value)
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_CARE_PROCESS_RELATION')
  }))
  ;[
    ['missing-schema', (record) => { delete record.careProcess.schemaVersion }],
    ['extra-root', (record) => { record.careProcess.extra = true }],
    ['missing-care-record', (record) => { delete record.careProcess.careRecord }],
    ['missing-shift', (record) => { delete record.careProcess.shiftHandover24h }],
    ['extra-care-key', (record) => { record.careProcess.careRecord.extra = true }],
    ['missing-presence', (record) => { delete record.careProcess.careRecord.presence }],
    ['extra-shift-key', (record) => { record.careProcess.shiftHandover24h.extra = true }],
    ['missing-content', (record) => { delete record.careProcess.shiftHandover24h.contents.follow_up }],
    ['invalid-schema', (record) => { record.careProcess.schemaVersion = 'future-care' }],
  ].forEach(([name, mutate], index) => run('CARE', `02${index}-${name}`, () => {
    const record = makeValidInstitutionV121()
    mutate(record)
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_CARE_PROCESS_SHAPE')
  }))
  ;['absent', 'unknown', 'unavailable'].forEach((state, index) => run('CARE', `03${index}-shift-parent-${state}`, () => {
    const record = makeValidInstitutionV121()
    record.careProcess.shiftHandover24h.presence = state === 'absent'
      ? unverifiedField('absent') : state === 'unknown' ? unknownField() : unavailableField()
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  }))
  const shiftDependents = [
    'processNote',
    'vital_signs',
    'abnormal_events',
    'interventions_recorded',
    'follow_up',
    'family_communication',
    'medical_transfer',
  ]
  shiftDependents.forEach((field, index) => run('CARE', `04${index}-shift-absent-dirty-${field}`, () => {
    const record = makeValidInstitutionV121()
    record.careProcess.shiftHandover24h.presence = unverifiedField('absent')
    if (field === 'processNote') record.careProcess.shiftHandover24h.processNote = unverifiedField('dirty')
    else record.careProcess.shiftHandover24h.contents[field] = unverifiedField('present')
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_CARE_PROCESS_RELATION')
  }))
  const contentCodes = [
    'vital_signs', 'abnormal_events', 'interventions_recorded', 'follow_up',
    'family_communication', 'medical_transfer',
  ]
  contentCodes.forEach((field, index) => {
    ;['present', 'absent'].forEach((state, stateIndex) => run(
      'CARE', `05${index}${stateIndex}-${field}-${state}`, () => {
        const record = makeShiftRecord()
        record.careProcess.shiftHandover24h.contents[field] = unverifiedField(state)
        assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
      },
    ))
  })
  ;[
    ['bad-presence', (record) => { record.careProcess.careRecord.presence = unverifiedField('yes') }],
    ['bad-completeness', (record) => { record.careProcess.careRecord.completeness = unverifiedField('good') }],
    ['bad-traceability', (record) => { record.careProcess.careRecord.traceability = unverifiedField('sometimes') }],
    ['bad-content', (record) => { record.careProcess.shiftHandover24h.contents.follow_up = unverifiedField('yes') }],
    ['invalid-as-of', (record) => { record.careProcess.careRecord.presence.asOf = 'tomorrow' }],
  ].forEach(([name, mutate], index) => run('CARE', `06${index}-${name}`, () => {
    const record = name === 'bad-content' ? makeShiftRecord() : makeCareRecord()
    mutate(record)
    expectInvalid(v121.validateInstitutionRecordV121(record, options))
  }))
  run('CARE', '065-process-note-has-no-unfrozen-length-cap', () => {
    const record = makeShiftRecord()
    record.careProcess.shiftHandover24h.processNote = unverifiedField('交'.repeat(501))
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
}

const runFrequencyTests = (v121) => {
  const canonicalCases = [
    [['per_shift'], ['per_shift']],
    [['daily'], ['daily']],
    [['event_based'], ['event_based']],
    [['other'], ['other']],
    [['event_based', 'per_shift'], ['per_shift', 'event_based']],
    [['other', 'daily'], ['daily', 'other']],
    [['other', 'event_based', 'daily'], ['daily', 'event_based', 'other']],
    [['daily', 'per_shift', 'event_based'], ['per_shift', 'daily', 'event_based']],
    [['daily', 'daily'], ['daily']],
    [['other', 'per_shift', 'other'], ['per_shift', 'other']],
  ]
  canonicalCases.forEach(([input, expected], index) => run('FREQUENCY', `00${index}-canonical`, () => {
    assert.deepEqual(v121.canonicalizeCareRecordFrequencyCodes(input), { ok: true, value: expected })
  }))
  ;[[], ['unknown'], ['DAILY'], [null], ['daily', 1]].forEach((input, index) => run(
    'FREQUENCY', `01${index}-invalid-input`, () => {
      assert.equal(v121.canonicalizeCareRecordFrequencyCodes(input).ok, false)
    },
  ))
  ;[
    [['daily'], null, true],
    [['per_shift', 'event_based'], null, true],
    [['other'], '其他测试频率', true],
    [['daily', 'other'], '其他测试频率', true],
    [['daily', 'daily'], null, false],
    [['event_based', 'daily'], null, false],
    [['other'], null, false],
    [['daily'], 'stale note', false],
  ].forEach(([values, note, valid], index) => run('FREQUENCY', `02${index}-record`, () => {
    const record = makeCareRecord()
    record.careProcess.careRecord.frequency = unverifiedField(values)
    record.careProcess.careRecord.otherFrequencyNote = note === null
      ? unknownField() : unverifiedField(note)
    const result = v121.validateInstitutionRecordV121(record, options)
    assert.equal(result.ok, valid)
  }))
  run('FREQUENCY', '028-other-note-has-no-unfrozen-length-cap', () => {
    const record = makeCareRecord()
    record.careProcess.careRecord.frequency = unverifiedField(['other'])
    record.careProcess.careRecord.otherFrequencyNote = unverifiedField('频'.repeat(501))
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
}

const runCompletenessTests = (v121) => {
  run('COMPLETENESS', '001-unknown', () => assert.equal(
    v121.validateInstitutionRecordV121(makeCareRecord(), options).ok, true,
  ))
  const makeWithCompleteness = (value, criteria = SYNTHETIC_COMPLETENESS_CRITERIA_REF) => {
    const record = makeCareRecord()
    record.careProcess.careRecord.completeness = unverifiedField(value)
    record.careProcess.careRecord.completenessCriteriaRef = criteria === null
      ? unknownField() : unverifiedField(criteria)
    return record
  }
  run('COMPLETENESS', '002-complete-approved', () => assert.equal(
    v121.validateInstitutionRecordV121(makeWithCompleteness('complete'), options).ok, true,
  ))
  run('COMPLETENESS', '003-partial-approved', () => assert.equal(
    v121.validateInstitutionRecordV121(makeWithCompleteness('partial'), options).ok, true,
  ))
  run('COMPLETENESS', '004-no-resolver', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeWithCompleteness('complete'), {
      administrativeDivisionResolver: SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER,
    }),
    'CARE_RECORD_COMPLETENESS_CRITERIA_RESOLVER_NOT_CONFIGURED',
  ))
  run('COMPLETENESS', '005-unapproved', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeWithCompleteness('complete', 'unapproved-test-ref'), options),
    'INVALID_CARE_RECORD_COMPLETENESS_CRITERIA',
  ))
  run('COMPLETENESS', '006-missing-criteria', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeWithCompleteness('partial', null), options),
    'INVALID_CARE_RECORD_COMPLETENESS_CRITERIA',
  ))
  run('COMPLETENESS', '007-criteria-without-result', () => {
    const record = makeCareRecord()
    record.careProcess.careRecord.completenessCriteriaRef = unverifiedField(SYNTHETIC_COMPLETENESS_CRITERIA_REF)
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_CARE_RECORD_COMPLETENESS_CRITERIA')
  })
  run('COMPLETENESS', '008-invalid-result', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeWithCompleteness('mostly_complete'), options),
    'INVALID_CARE_PROCESS_FACT',
  ))
  run('COMPLETENESS', '009-unavailable-result', () => {
    const record = makeCareRecord()
    record.careProcess.careRecord.completeness = unavailableField()
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
  run('COMPLETENESS', '010-parent-absent', () => {
    const record = makeWithCompleteness('complete')
    record.careProcess.careRecord.presence = unverifiedField('absent')
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_CARE_PROCESS_RELATION')
  })
  run('COMPLETENESS', '011-whitespace-ref', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeWithCompleteness('complete', ' test-only-care-record-criteria-v1 '), options),
    'INVALID_CARE_RECORD_COMPLETENESS_CRITERIA',
  ))
  run('COMPLETENESS', '012-approved-ref-has-no-unfrozen-length-cap', () => {
    const criteriaRef = `criteria-v1-${'a'.repeat(200)}`
    const result = v121.validateInstitutionRecordV121(makeWithCompleteness('complete', criteriaRef), {
      administrativeDivisionResolver: SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER,
      completenessCriteriaResolver: {
        isApprovedCriteriaRef: (input) => input === criteriaRef,
      },
    })
    assert.equal(result.ok, true)
  })
}

const runEvidenceTests = (v121) => {
  const validRecord = () => enrichInstitutionV121()
  const target = (record) => record.evidence.find((entry) => entry.fieldPath === 'publicLocation.geo')
  run('EVIDENCE', '001-valid-closure', () => assert.equal(
    v121.validateInstitutionRecordV121(validRecord(), options).ok, true,
  ))
  const mutations = [
    ['missing-reference', (record) => { record.evidence = record.evidence.filter((entry) => entry.fieldPath !== 'publicLocation.geo') }],
    ['duplicate-id', (record) => { record.evidence.push(clone(target(record))) }],
    ['institution-mismatch', (record) => { target(record).institutionId = 'other-test-institution' }],
    ['revision-mismatch', (record) => { target(record).recordRevision += 1 }],
    ['path-mismatch', (record) => { target(record).fieldPath = 'publicLocation.address' }],
    ['snapshot-type', (record) => { target(record).valueSnapshot.valueType = 'structured_address' }],
    ['snapshot-value', (record) => { target(record).valueSnapshot.value.latitude += 1 }],
    ['status-mismatch', (record) => { target(record).verificationStatus = 'expired' }],
    ['verified-at-mismatch', (record) => { target(record).verifiedAt = '2026-09-11T08:00:00.000Z' }],
    ['valid-until-mismatch', (record) => { target(record).validUntil = '2028-09-12T08:00:00.000Z' }],
    ['invalid-source-type', (record) => { target(record).sourceType = 'consultant' }],
    ['missing-source-locator', (record) => { delete target(record).sourceNote; delete target(record).sourceReference }],
    ['invalid-observed-at', (record) => { target(record).observedAt = 'yesterday' }],
    ['invalid-evidence-id', (record) => {
      const item = target(record)
      const old = item.evidenceId
      item.evidenceId = 'X'
      record.publicLocation.geo.verification.evidenceIds = ['X']
      void old
    }],
    ['extra-evidence-key', (record) => { target(record).internalReviewer = 'private' }],
    ['snapshot-extra-key', (record) => { target(record).valueSnapshot.extra = true }],
    ['field-duplicate-reference', (record) => {
      const id = record.publicLocation.geo.verification.evidenceIds[0]
      record.publicLocation.geo.verification.evidenceIds = [id, id]
    }],
    ['field-future-verification', (record) => {
      record.publicLocation.geo.verification.verifiedAt = 'not-time'
    }],
    ['unknown-with-evidence', (record) => {
      record.publicLocation.geo.availability = 'unknown'
      record.publicLocation.geo.value = null
    }],
    ['unknown-verified', (record) => {
      record.publicLocation.geo.availability = 'unknown'
      record.publicLocation.geo.value = null
      record.publicLocation.geo.verification.status = 'verified'
    }],
    ['unavailable-concrete', (record) => { record.publicLocation.geo.availability = 'unavailable' }],
    ['provided-null', (record) => { record.publicLocation.geo.value = null }],
  ]
  mutations.forEach(([name, mutate], index) => run('EVIDENCE', `${String(index + 2).padStart(3, '0')}-${name}`, () => {
    const record = validRecord()
    mutate(record)
    expectInvalid(v121.validateInstitutionRecordV121(record, options))
  }))
  run('EVIDENCE', '024-unverified-empty-valid', () => {
    const record = makeGeoRecord()
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
  run('EVIDENCE', '025-unverified-closed-valid', () => {
    const record = makeValidInstitutionV121()
    record.publicLocation.geo = makeEvidenceField(
      record, 'publicLocation.geo', SYNTHETIC_GEO, 'geo_location', 'unverified', 'institution_provided',
    )
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
  run('EVIDENCE', '026-unavailable-verified-valid', () => {
    const record = makeValidInstitutionV121()
    record.publicLocation.geo = makeEvidenceField(
      record, 'publicLocation.geo', SYNTHETIC_GEO, 'geo_location', 'verified',
    )
    const evidence = target(record)
    record.publicLocation.geo.availability = 'unavailable'
    record.publicLocation.geo.value = null
    evidence.valueSnapshot = { valueType: 'stable_code', value: 'unavailable' }
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
  run('EVIDENCE', '027-orphan-successor-evidence', () => {
    const record = validRecord()
    const orphan = clone(target(record))
    orphan.evidenceId = 'ev-v121-test-orphan'
    record.evidence.push(orphan)
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'BROKEN_REFERENCE')
  })
}

const runPhoneTests = (v121) => {
  const mobileWithSeparators = {
    purpose: 'main', otherPurposeNote: null,
    number: {
      kind: 'mainland_mobile', countryCallingCode: ' +86 ',
      nationalNumber: '139 0000-0001', extension: null,
    },
  }
  run('PHONE', '001-mobile-canonicalize', () => {
    const result = v121.canonicalizeOfficialPhoneValue(mobileWithSeparators)
    assert.equal(result.ok, true)
    assert.equal(result.value.number.nationalNumber, '13900000001')
  })
  run('PHONE', '002-landline-canonicalize', () => {
    const dirty = clone(SYNTHETIC_LANDLINE)
    dirty.number.areaCode = '(0999)'
    dirty.number.subscriberNumber = '1234-5678'
    const result = v121.canonicalizeOfficialPhoneValue(dirty)
    assert.equal(result.ok, true)
    assert.equal(v121.officialPhoneDialValue(result.value), '099912345678')
  })
  run('PHONE', '003-extension-display-only', () => {
    assert.equal(v121.officialPhoneDialValue(SYNTHETIC_LANDLINE), '099912345678')
    assert.match(v121.officialPhoneDisplayValue(SYNTHETIC_LANDLINE), /123/)
  })
  ;['main', 'admission_consultation', 'service', 'other'].forEach((purpose, index) => run(
    'PHONE', `00${index + 4}-purpose-${purpose}`, () => {
      const value = clone(SYNTHETIC_MOBILE)
      value.purpose = purpose
      value.otherPurposeNote = purpose === 'other' ? '测试其他用途' : null
      assert.equal(v121.canonicalizeOfficialPhoneValue(value).ok, true)
    },
  ))
  const invalidValues = [
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), nationalNumber: '138' } },
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), nationalNumber: '12900000001' } },
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), nationalNumber: 'https://x.test' } },
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), nationalNumber: '13900000001,13800000002' } },
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), countryCallingCode: '+1' } },
    { ...clone(SYNTHETIC_MOBILE), number: { ...clone(SYNTHETIC_MOBILE.number), extension: '1' } },
    { ...clone(SYNTHETIC_LANDLINE), number: { ...clone(SYNTHETIC_LANDLINE.number), areaCode: '999' } },
    { ...clone(SYNTHETIC_LANDLINE), number: { ...clone(SYNTHETIC_LANDLINE.number), areaCode: '09999' } },
    { ...clone(SYNTHETIC_LANDLINE), number: { ...clone(SYNTHETIC_LANDLINE.number), subscriberNumber: '123456' } },
    { ...clone(SYNTHETIC_LANDLINE), number: { ...clone(SYNTHETIC_LANDLINE.number), extension: '1234567' } },
    { ...clone(SYNTHETIC_LANDLINE), number: { ...clone(SYNTHETIC_LANDLINE.number), subscriberNumber: 12345678 } },
    { ...clone(SYNTHETIC_MOBILE), purpose: 'other', otherPurposeNote: null },
    { ...clone(SYNTHETIC_MOBILE), purpose: 'other', otherPurposeNote: 'x'.repeat(81) },
    { ...clone(SYNTHETIC_MOBILE), purpose: 'main', otherPurposeNote: 'not allowed' },
    { ...clone(SYNTHETIC_MOBILE), purpose: 'consultant' },
  ]
  invalidValues.forEach((value, index) => run('PHONE', `${String(index + 8).padStart(3, '0')}-invalid`, () => {
    assert.equal(v121.canonicalizeOfficialPhoneValue(value).ok, false)
  }))
  run('PHONE', '023-contact-valid', () => assert.equal(
    v121.validateInstitutionRecordV121(makePhoneRecord(), options).ok, true,
  ))
  run('PHONE', '024-directory-present-empty', () => {
    const record = makePhoneRecord([])
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_OFFICIAL_CONTACT')
  })
  run('PHONE', '025-directory-unknown-child', () => {
    const record = makePhoneRecord()
    record.officialContact.phoneDirectoryPresence = unknownField()
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_OFFICIAL_CONTACT')
  })
  run('PHONE', '026-duplicate-value-purpose', () => {
    const second = clone(SYNTHETIC_MOBILE)
    second.purpose = 'service'
    const record = makePhoneRecord([SYNTHETIC_MOBILE, second])
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_OFFICIAL_PHONE')
  })
  run('PHONE', '027-duplicate-key', () => {
    const record = makePhoneRecord([SYNTHETIC_MOBILE, SYNTHETIC_LANDLINE])
    record.officialContact.officialPhones[1].officialPhoneKey = record.officialContact.officialPhones[0].officialPhoneKey
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_OFFICIAL_PHONE')
  })
  run('PHONE', '028-noncanonical-order', () => {
    const record = makePhoneRecord([SYNTHETIC_LANDLINE, SYNTHETIC_MOBILE])
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_OFFICIAL_PHONE_ORDER')
  })
  run('PHONE', '029-canonical-order-permutation', () => {
    const record = makePhoneRecord([SYNTHETIC_LANDLINE, SYNTHETIC_MOBILE])
    const result = v121.canonicalizeOfficialPhones(record.officialContact.officialPhones)
    assert.equal(result.ok, true)
    assert.equal(result.value[0].phone.value.purpose, 'main')
  })
  run('PHONE', '030-current-verified-public', () => {
    const record = enrichInstitutionV121()
    const phone = record.officialContact.officialPhones[0]
    const snapshot = v121.deriveOfficialPhonePublicSnapshot(record, phone, INSTITUTION_V121_EVALUATION_AS_OF)
    assert.equal(snapshot.status, 'current_verified')
    assert.equal(snapshot.callActionAvailable, true)
    assert.equal(snapshot.dialValue, '13900000001')
  })
  run('PHONE', '031-expired-hides-number', () => {
    const record = enrichInstitutionV121()
    const phone = record.officialContact.officialPhones[0]
    phone.phone.verification.status = 'expired'
    phone.phone.verification.validUntil = '2026-09-12T23:59:59.000Z'
    const evidence = record.evidence.find((item) => item.fieldPath.endsWith('phone-main-001.phone'))
    evidence.verificationStatus = 'expired'
    evidence.validUntil = '2026-09-12T23:59:59.000Z'
    const snapshot = v121.deriveOfficialPhonePublicSnapshot(record, phone, INSTITUTION_V121_EVALUATION_AS_OF)
    assert.equal(snapshot.status, 'expired')
    assert.equal(snapshot.displayValue, null)
  })
  run('PHONE', '032-unverified-no-source-hidden', () => {
    const record = makePhoneRecord()
    const snapshot = v121.deriveOfficialPhonePublicSnapshot(
      record, record.officialContact.officialPhones[0], INSTITUTION_V121_EVALUATION_AS_OF,
    )
    assert.equal(snapshot.status, 'unverified_without_source')
    assert.equal(snapshot.displayValue, null)
  })
  run('PHONE', '033-unverified-source-visible-disabled', () => {
    const record = makePhoneRecord()
    record.officialContact.officialPhones[0].phone = makeEvidenceField(
      record,
      'officialContact.officialPhones.phone-test-001.phone',
      SYNTHETIC_MOBILE,
      'official_phone',
      'unverified',
      'institution_provided',
    )
    const snapshot = v121.deriveOfficialPhonePublicSnapshot(
      record, record.officialContact.officialPhones[0], INSTITUTION_V121_EVALUATION_AS_OF,
    )
    assert.equal(snapshot.status, 'unverified_with_source')
    assert.notEqual(snapshot.displayValue, null)
    assert.equal(snapshot.callActionAvailable, false)
  })
}

const runAddressTests = (v121) => {
  run('ADDRESS', '001-canonical', () => assert.equal(
    v121.canonicalizeInstitutionAddress(SYNTHETIC_ADDRESS).ok, true,
  ))
  run('ADDRESS', '002-normalize-outer-space', () => {
    const dirty = clone(SYNTHETIC_ADDRESS)
    dirty.addressLine = '  测试大道一号测试园区  '
    const result = v121.canonicalizeInstitutionAddress(dirty)
    assert.equal(result.ok, true)
    assert.equal(result.value.addressLine, '测试大道一号测试园区')
  })
  run('ADDRESS', '003-formatted-address', () => {
    const result = v121.formatInstitutionAddress(SYNTHETIC_ADDRESS)
    assert.deepEqual(result, { ok: true, value: '测试省测试市测试区测试大道一号测试园区' })
  })
  run('ADDRESS', '004-record-with-resolver', () => assert.equal(
    v121.validateInstitutionRecordV121(makeAddressRecord(), options).ok, true,
  ))
  run('ADDRESS', '005-resolver-not-configured', () => expectInvalid(
    v121.validateInstitutionRecordV121(makeAddressRecord()),
    'ADMINISTRATIVE_DIVISION_RESOLVER_NOT_CONFIGURED',
  ))
  run('ADDRESS', '006-hierarchy-mismatch', () => {
    const record = makeAddressRecord()
    record.publicLocation.address.value.city.code = 'wrong-city'
    expectInvalid(v121.validateInstitutionRecordV121(record, options), 'INVALID_ADMINISTRATIVE_DIVISION_HIERARCHY')
  })
  const invalidAddresses = [
    { ...clone(SYNTHETIC_ADDRESS), countryCode: 'US' },
    { ...clone(SYNTHETIC_ADDRESS), province: { code: '', displayName: '测试省' } },
    { ...clone(SYNTHETIC_ADDRESS), province: { code: 'test-province', displayName: '' } },
    { ...clone(SYNTHETIC_ADDRESS), city: { code: '', displayName: '测试市' } },
    { ...clone(SYNTHETIC_ADDRESS), district: { code: '', displayName: '测试区' } },
    { ...clone(SYNTHETIC_ADDRESS), district: { code: 'test-district', displayName: '暂无' } },
    { ...clone(SYNTHETIC_ADDRESS), addressLine: '' },
    { ...clone(SYNTHETIC_ADDRESS), addressLine: '暂无' },
    { ...clone(SYNTHETIC_ADDRESS), addressLine: 'x'.repeat(201) },
    { ...clone(SYNTHETIC_ADDRESS), postalCode: '' },
    { ...clone(SYNTHETIC_ADDRESS), postalCode: 'bad code' },
    { ...clone(SYNTHETIC_ADDRESS), postalCode: 'x'.repeat(17) },
    { ...clone(SYNTHETIC_ADDRESS), formattedAddress: 'forbidden duplicate fact' },
    { countryCode: 'CN', addressLine: 'free text only' },
  ]
  invalidAddresses.forEach((address, index) => run('ADDRESS', `${String(index + 7).padStart(3, '0')}-invalid`, () => {
    assert.equal(v121.canonicalizeInstitutionAddress(address).ok, false)
  }))
  run('ADDRESS', '021-unknown-valid', () => assert.equal(
    v121.validateInstitutionRecordV121(makeValidInstitutionV121(), options).ok, true,
  ))
  run('ADDRESS', '022-unavailable-valid', () => {
    const record = makeValidInstitutionV121()
    record.publicLocation.address = unavailableField()
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
  run('ADDRESS', '023-formatted-address-overflow-rejected', () => {
    const address = clone(SYNTHETIC_ADDRESS)
    address.province.displayName = '省'.repeat(40)
    address.city.displayName = '市'.repeat(40)
    address.district.displayName = '区'.repeat(40)
    address.addressLine = '路'.repeat(181)
    assert.equal(v121.canonicalizeInstitutionAddress(address).ok, false)

    const record = makeAddressRecord()
    record.publicLocation.address.value = address
    assert.deepEqual(
      v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options),
      { ok: false, code: 'INVALID_INSTITUTION_V121_RECORD' },
    )
  })
}

const runGeoTests = (v121) => {
  const validCoordinates = [
    SYNTHETIC_GEO,
    { latitude: -90, longitude: -180, coordinateSystem: 'gcj02' },
    { latitude: 90, longitude: 180, coordinateSystem: 'gcj02' },
    { latitude: 0, longitude: 1, coordinateSystem: 'gcj02' },
    { latitude: 1, longitude: 0, coordinateSystem: 'gcj02' },
  ]
  validCoordinates.forEach((geo, index) => run('GEO', `00${index + 1}-valid`, () => {
    assert.equal(v121.isValidInstitutionGeoLocation(geo), true)
  }))
  const invalidCoordinates = [
    { latitude: 91, longitude: 1, coordinateSystem: 'gcj02' },
    { latitude: -91, longitude: 1, coordinateSystem: 'gcj02' },
    { latitude: 1, longitude: 181, coordinateSystem: 'gcj02' },
    { latitude: 1, longitude: -181, coordinateSystem: 'gcj02' },
    { latitude: 0, longitude: 0, coordinateSystem: 'gcj02' },
    { latitude: Number.NaN, longitude: 1, coordinateSystem: 'gcj02' },
    { latitude: Number.POSITIVE_INFINITY, longitude: 1, coordinateSystem: 'gcj02' },
    { latitude: 1, longitude: Number.NEGATIVE_INFINITY, coordinateSystem: 'gcj02' },
    { latitude: '31.2', longitude: 114.3, coordinateSystem: 'gcj02' },
    { latitude: 31.2, longitude: '114.3', coordinateSystem: 'gcj02' },
    { latitude: 31.2, longitude: 114.3, coordinateSystem: 'wgs84' },
    { latitude: 31.2, longitude: 114.3, coordinateSystem: 'bd09' },
    { latitude: null, longitude: 114.3, coordinateSystem: 'gcj02' },
    { latitude: 31.2, longitude: null, coordinateSystem: 'gcj02' },
    { latitude: 31.2, longitude: 114.3, coordinateSystem: 'gcj02', accuracy: 1 },
  ]
  invalidCoordinates.forEach((geo, index) => run('GEO', `${String(index + 6).padStart(3, '0')}-invalid`, () => {
    assert.equal(v121.isValidInstitutionGeoLocation(geo), false)
  }))
  run('GEO', '021-record-provided', () => assert.equal(
    v121.validateInstitutionRecordV121(makeGeoRecord(), options).ok, true,
  ))
  run('GEO', '022-unknown-valid', () => assert.equal(
    v121.validateInstitutionRecordV121(makeValidInstitutionV121(), options).ok, true,
  ))
  run('GEO', '023-unavailable-valid', () => {
    const record = makeValidInstitutionV121()
    record.publicLocation.geo = unavailableField()
    assert.equal(v121.validateInstitutionRecordV121(record, options).ok, true)
  })
}

const expireField = (record, fieldPath, field) => {
  field.verification.status = 'expired'
  field.verification.validUntil = '2026-09-12T23:59:59.000Z'
  field.verification.evidenceIds.forEach((id) => {
    const evidence = record.evidence.find((item) => item.evidenceId === id)
    evidence.verificationStatus = 'expired'
    evidence.validUntil = '2026-09-12T23:59:59.000Z'
    assert.equal(evidence.fieldPath, fieldPath)
  })
}

const runMapTests = (v121) => {
  run('MAP', '001-available', () => {
    const result = v121.deriveInstitutionMapReadiness(
      enrichInstitutionV121(), INSTITUTION_V121_EVALUATION_AS_OF, options,
    )
    assert.equal(result.ok, true)
    assert.equal(result.value.status, 'available')
    assert.equal(result.value.mapActionAvailable, true)
    assert.equal(result.value.coordinateSystem, 'gcj02')
  })
  run('MAP', '002-deterministic', () => {
    const record = enrichInstitutionV121()
    const first = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    const second = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    assert.deepEqual(first, second)
  })
  run('MAP', '003-invalid-time', () => assert.deepEqual(
    v121.deriveInstitutionMapReadiness(enrichInstitutionV121(), 'now', options),
    { ok: false, code: 'INVALID_EVALUATION_AS_OF' },
  ))
  const scenarios = [
    ['address_unknown', (record) => {
      removeEvidenceForField(record, record.publicLocation.address)
      record.publicLocation.address = unknownField()
    }],
    ['address_unavailable', (record) => {
      removeEvidenceForField(record, record.publicLocation.address)
      record.publicLocation.address = unavailableField()
    }],
    ['address_unverified', (record) => setUnverified(record, record.publicLocation.address)],
    ['address_expired', (record) => expireField(record, 'publicLocation.address', record.publicLocation.address)],
    ['geo_unknown', (record) => {
      removeEvidenceForField(record, record.publicLocation.geo)
      record.publicLocation.geo = unknownField()
    }],
    ['geo_unavailable', (record) => {
      removeEvidenceForField(record, record.publicLocation.geo)
      record.publicLocation.geo = unavailableField()
    }],
    ['geo_unverified', (record) => setUnverified(record, record.publicLocation.geo)],
    ['geo_expired', (record) => expireField(record, 'publicLocation.geo', record.publicLocation.geo)],
  ]
  scenarios.forEach(([status, mutate], index) => run('MAP', `${String(index + 4).padStart(3, '0')}-${status}`, () => {
    const record = enrichInstitutionV121()
    mutate(record)
    const result = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    assert.equal(result.ok, true)
    assert.equal(result.value.status, status)
    assert.equal(result.value.mapActionAvailable, false)
    assert.equal(result.value.latitude, null)
    assert.equal(result.value.longitude, null)
  }))
  run('MAP', '012-address-verified-geo-unverified', () => {
    const record = enrichInstitutionV121()
    setUnverified(record, record.publicLocation.geo)
    const result = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    assert.equal(result.value.status, 'geo_unverified')
    assert.notEqual(result.value.formattedAddress, null)
  })
  run('MAP', '013-geo-verified-address-unknown', () => {
    const record = enrichInstitutionV121()
    removeEvidenceForField(record, record.publicLocation.address)
    record.publicLocation.address = unknownField()
    const result = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    assert.equal(result.value.status, 'address_unknown')
  })
  run('MAP', '014-invalid-geo-is-domain-error', () => {
    const record = enrichInstitutionV121()
    record.publicLocation.geo.value.coordinateSystem = 'wgs84'
    assert.deepEqual(
      v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options),
      { ok: false, code: 'INVALID_INSTITUTION_V121_RECORD' },
    )
  })
  run('MAP', '015-draft-not-actionable', () => {
    const record = enrichInstitutionV121()
    record.recordStatus = 'draft'
    const result = v121.deriveInstitutionMapReadiness(record, INSTITUTION_V121_EVALUATION_AS_OF, options)
    assert.deepEqual(result, { ok: false, code: 'MAP_ACTION_UNAVAILABLE' })
  })
}

const runPublicContentTests = (v121) => {
  run('PUBLIC_CONTENT', '001-valid-published', () => assert.equal(
    v121.validateInstitutionPublicContentV1(makePublicContent()).ok, true,
  ))
  ;['draft', 'archived'].forEach((status, index) => run(
    'PUBLIC_CONTENT', `00${index + 2}-${status}-provided`, () => {
      assert.equal(v121.validateInstitutionPublicContentV1(
        makePublicContent({ publicationStatus: status }),
      ).ok, true)
    },
  ))
  ;['unknown', 'unavailable'].forEach((availability, index) => run(
    'PUBLIC_CONTENT', `00${index + 4}-draft-${availability}`, () => {
      const content = makePublicContent({
        publicationStatus: 'draft',
        introduction: { availability, text: null, sourceType: null },
      })
      assert.equal(v121.validateInstitutionPublicContentV1(content).ok, true)
    },
  ))
  ;['institution_supplied', 'platform_edited'].forEach((sourceType, index) => run(
    'PUBLIC_CONTENT', `00${index + 6}-source-${sourceType}`, () => {
      const content = makePublicContent()
      content.introduction.sourceType = sourceType
      assert.equal(v121.validateInstitutionPublicContentV1(content).ok, true)
    },
  ))
  run('PUBLIC_CONTENT', '008-crlf-normalization', () => assert.deepEqual(
    v121.canonicalizePublicIntroductionText('  第一行\r\n第二行\r第三行  '),
    { ok: true, value: '第一行\n第二行\n第三行' },
  ))
  run('PUBLIC_CONTENT', '009-emoji-2000-codepoints', () => {
    const text = '😀'.repeat(2000)
    assert.equal(text.length, 4000)
    assert.equal(v121.canonicalizePublicIntroductionText(text).ok, true)
  })
  run('PUBLIC_CONTENT', '010-over-2000-codepoints', () => assert.equal(
    v121.canonicalizePublicIntroductionText('😀'.repeat(2001)).ok, false,
  ))
  const invalidContents = [
    makePublicContent({ publicationStatus: 'published', introduction: { availability: 'unknown', text: null, sourceType: null } }),
    makePublicContent({ contentRevision: 0 }),
    makePublicContent({ contentRevision: -1 }),
    makePublicContent({ contentRevision: 1.5 }),
    makePublicContent({ contentRevision: Number.MAX_SAFE_INTEGER + 1 }),
    makePublicContent({ updatedAt: 'today' }),
    makePublicContent({ schemaVersion: 'institution-public-content-v2' }),
    makePublicContent({ publicationStatus: 'live' }),
    makePublicContent({ introduction: { availability: 'provided', text: '', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '<b>五星</b>', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '<script>alert(1)</script>', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '<iframe src="x"></iframe>', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '合法\u0000非法', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '合法\t非法', sourceType: 'platform_edited' } }),
    makePublicContent({ introduction: { availability: 'provided', text: '文本', sourceType: 'AI_generated' } }),
    { ...makePublicContent(), extra: true },
  ]
  invalidContents.forEach((content, index) => run(
    'PUBLIC_CONTENT', `${String(index + 11).padStart(3, '0')}-invalid`, () => {
      assert.equal(v121.validateInstitutionPublicContentV1(content).ok, false)
    },
  ))
  run('PUBLIC_CONTENT', '027-natural-language-no-derivation', () => {
    const content = makePublicContent()
    content.introduction.text = '本测试文案声称24小时护理、五星级、医保和医生值班。'
    assert.equal(v121.validateInstitutionPublicContentV1(content).ok, true)
    assert.equal(Object.prototype.hasOwnProperty.call(content, 'capabilities'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(content, 'careProcess'), false)
  })
  run('PUBLIC_CONTENT', '028-plain-url-text-no-fetch', () => {
    const content = makePublicContent()
    content.introduction.text = '资料来源说明：https://example.invalid/test（仅文本，不抓取）'
    assert.equal(v121.validateInstitutionPublicContentV1(content).ok, true)
  })
}

const runPublicResolverTests = (v121) => {
  const institutionId = makePublicContent().institutionId
  run('PUBLIC_RESOLVER', '001-unconfigured-current', () => assert.deepEqual(
    v121.resolveCurrentPublishedPublicContent(
      v121.UNCONFIGURED_CURRENT_PUBLIC_CONTENT_RESOLVER,
      institutionId,
    ),
    { ok: false, code: 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED' },
  ))
  run('PUBLIC_RESOLVER', '002-unconfigured-exact', () => assert.deepEqual(
    v121.resolveExactPublishedPublicContentRevision(
      v121.UNCONFIGURED_EXACT_PUBLIC_CONTENT_RESOLVER,
      institutionId,
      1,
    ),
    { ok: false, code: 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED' },
  ))
  const current = (value) => ({ resolveCurrent: () => ({ ok: true, value }) })
  const exact = (value) => ({ resolveExact: () => ({ ok: true, value }) })
  run('PUBLIC_RESOLVER', '003-current-published', () => assert.equal(
    v121.resolveCurrentPublishedPublicContent(current(makePublicContent()), institutionId).value.contentRevision,
    1,
  ))
  ;['draft', 'archived'].forEach((status, index) => run(
    'PUBLIC_RESOLVER', `00${index + 4}-current-${status}-hidden`, () => assert.deepEqual(
      v121.resolveCurrentPublishedPublicContent(
        current(makePublicContent({ publicationStatus: status })), institutionId,
      ),
      { ok: true, value: null },
    ),
  ))
  run('PUBLIC_RESOLVER', '006-current-null', () => assert.deepEqual(
    v121.resolveCurrentPublishedPublicContent(current(null), institutionId),
    { ok: true, value: null },
  ))
  run('PUBLIC_RESOLVER', '007-exact-published', () => assert.equal(
    v121.resolveExactPublishedPublicContentRevision(exact(makePublicContent()), institutionId, 1).value.contentRevision,
    1,
  ))
  run('PUBLIC_RESOLVER', '008-exact-missing', () => assert.deepEqual(
    v121.resolveExactPublishedPublicContentRevision(exact(null), institutionId, 7),
    { ok: false, code: 'PUBLIC_CONTENT_REVISION_NOT_FOUND' },
  ))
  run('PUBLIC_RESOLVER', '009-exact-revision-mismatch', () => assert.deepEqual(
    v121.resolveExactPublishedPublicContentRevision(exact(makePublicContent()), institutionId, 2),
    { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' },
  ))
  run('PUBLIC_RESOLVER', '010-exact-institution-mismatch', () => {
    const content = makePublicContent({ institutionId: 'other-test-institution' })
    assert.deepEqual(
      v121.resolveExactPublishedPublicContentRevision(exact(content), institutionId, 1),
      { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' },
    )
  })
  run('PUBLIC_RESOLVER', '011-exact-draft-hidden', () => assert.deepEqual(
    v121.resolveExactPublishedPublicContentRevision(
      exact(makePublicContent({ publicationStatus: 'draft' })), institutionId, 1,
    ),
    { ok: true, value: null },
  ))
  run('PUBLIC_RESOLVER', '012-explicit-head-not-max', () => {
    const revisions = [makePublicContent({ contentRevision: 1 }), makePublicContent({ contentRevision: 9 })]
    const resolver = { resolveCurrent: () => ({ ok: true, value: revisions[0] }) }
    const result = v121.resolveCurrentPublishedPublicContent(resolver, institutionId)
    assert.equal(result.value.contentRevision, 1)
  })
  run('PUBLIC_RESOLVER', '013-no-current-fallback-on-exact-miss', () => {
    const resolver = { resolveExact: () => ({ ok: true, value: null }) }
    assert.deepEqual(
      v121.resolveExactPublishedPublicContentRevision(resolver, institutionId, 99),
      { ok: false, code: 'PUBLIC_CONTENT_REVISION_NOT_FOUND' },
    )
  })
  run('PUBLIC_RESOLVER', '014-invalid-return-isolated', () => {
    const invalid = makePublicContent({ updatedAt: 'bad' })
    assert.deepEqual(
      v121.resolveCurrentPublishedPublicContent(current(invalid), institutionId),
      { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' },
    )
  })
  run('PUBLIC_RESOLVER', '015-provider-error', () => {
    const resolver = { resolveCurrent: () => ({ ok: false, code: 'PUBLIC_CONTENT_REVISION_NOT_FOUND' }) }
    assert.deepEqual(
      v121.resolveCurrentPublishedPublicContent(resolver, institutionId),
      { ok: false, code: 'PUBLIC_CONTENT_REVISION_NOT_FOUND' },
    )
  })
  run('PUBLIC_RESOLVER', '016-invalid-input-id', () => assert.deepEqual(
    v121.resolveCurrentPublishedPublicContent(current(makePublicContent()), 'x'),
    { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' },
  ))
}

const runV12Tests = (v12) => {
  run('V12', '001-valid-unknown', () => assert.equal(
    v12.validateInstitutionRecordV12(makeValidInstitutionV12(), options).ok, true,
  ))
  run('V12', '002-valid-care-present', () => {
    const record = makeValidInstitutionV12()
    record.careProcess.careRecord.presence = unverifiedField('present')
    record.careProcess.careRecord.frequency = unverifiedField(['daily'])
    assert.equal(v12.validateInstitutionRecordV12(record, options).ok, true)
  })
  const mutations = [
    ['missing-care', (record) => { delete record.careProcess }],
    ['extra-official-contact', (record) => { record.officialContact = makeUnknownOfficialContact() }],
    ['wrong-version-v121', (record) => { record.contractVersion = 'institution-contract-v1.2.1' }],
    ['short-version', (record) => { record.contractVersion = '1.2' }],
    ['missing-contract', (record) => { delete record.contractVersion }],
    ['extra-root', (record) => { record.future = true }],
    ['bad-care-schema', (record) => { record.careProcess.schemaVersion = 'bad' }],
    ['missing-care-record', (record) => { delete record.careProcess.careRecord }],
    ['parent-absent-child', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('absent')
      record.careProcess.careRecord.frequency = unverifiedField(['daily'])
    }],
    ['frequency-duplicate', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.frequency = unverifiedField(['daily', 'daily'])
    }],
    ['complete-without-criteria', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.completeness = unverifiedField('complete')
    }],
    ['unknown-concrete', (record) => { record.careProcess.careRecord.presence.value = 'present' }],
    ['unknown-verified', (record) => {
      record.careProcess.careRecord.presence.verification = {
        status: 'verified', evidenceIds: [], verifiedAt: '2026-09-12T08:00:00.000Z',
      }
    }],
    ['invalid-v11-fact', (record) => { record.recordRevision = 0 }],
  ]
  mutations.forEach(([name, mutate], index) => run('V12', `${String(index + 3).padStart(3, '0')}-${name}`, () => {
    const record = makeValidInstitutionV12()
    mutate(record)
    expectInvalid(v12.validateInstitutionRecordV12(record, options))
  }))
  ;[
    ['null-completeness', (record) => { record.careProcess.careRecord.completeness = null }],
    ['null-frequency', (record) => { record.careProcess.careRecord.frequency = null }],
  ].forEach(([name, mutate], index) => run('V12', `${String(index + 17).padStart(3, '0')}-${name}-fail-closed`, () => {
    const record = makeValidInstitutionV12()
    record.careProcess.careRecord.presence = unverifiedField('present')
    mutate(record)
    assert.equal(v12.validateInstitutionRecordV12(record, options).ok, false)
    assert.deepEqual(
      v12.projectInstitutionRecordV12ToV11(record, options),
      { ok: false, code: 'V12_TO_V11_PROJECTION_FAILED' },
    )
  }))
}

const runV121Tests = (v121) => {
  run('V121', '001-valid-unknown', () => assert.equal(
    v121.validateInstitutionRecordV121(makeValidInstitutionV121(), options).ok, true,
  ))
  run('V121', '002-valid-enriched', () => assert.equal(
    v121.validateInstitutionRecordV121(enrichInstitutionV121(), options).ok, true,
  ))
  const mutations = [
    ['missing-care', (record) => { delete record.careProcess }],
    ['missing-official', (record) => { delete record.officialContact }],
    ['missing-location', (record) => { delete record.publicLocation }],
    ['extra-root', (record) => { record.publicIntroduction = 'forbidden' }],
    ['v12-version', (record) => { record.contractVersion = 'institution-contract-v1.2' }],
    ['unknown-version', (record) => { record.contractVersion = 'institution-contract-v9' }],
    ['missing-version', (record) => { delete record.contractVersion }],
    ['official-schema', (record) => { record.officialContact.schemaVersion = 'bad' }],
    ['location-schema', (record) => { record.publicLocation.schemaVersion = 'bad' }],
    ['official-extra', (record) => { record.officialContact.extra = true }],
    ['location-extra', (record) => { record.publicLocation.extra = true }],
    ['directory-null-provided', (record) => {
      record.officialContact.phoneDirectoryPresence = {
        availability: 'provided', value: null,
        verification: { status: 'unverified', evidenceIds: [] },
      }
    }],
    ['directory-present-empty', (record) => {
      record.officialContact.phoneDirectoryPresence = unverifiedField('present')
    }],
    ['directory-absent-child', (record) => {
      const withPhone = makePhoneRecord()
      record.officialContact = withPhone.officialContact
      record.officialContact.phoneDirectoryPresence = unverifiedField('absent')
    }],
    ['phone-url', (record) => {
      const withPhone = makePhoneRecord()
      record.officialContact = withPhone.officialContact
      record.officialContact.officialPhones[0].phone.value.number.nationalNumber = 'https://test.invalid'
    }],
    ['phone-child-unknown', (record) => {
      const withPhone = makePhoneRecord()
      record.officialContact = withPhone.officialContact
      record.officialContact.officialPhones[0].phone = unknownField()
    }],
    ['phone-key-index', (record) => {
      const withPhone = makePhoneRecord()
      record.officialContact = withPhone.officialContact
      record.officialContact.officialPhones[0].officialPhoneKey = '0'
    }],
    ['address-free-text', (record) => {
      record.publicLocation.address = unverifiedField({ addressLine: 'only text' })
    }],
    ['address-country', (record) => {
      record.publicLocation.address = unverifiedField({ ...clone(SYNTHETIC_ADDRESS), countryCode: 'US' })
    }],
    ['address-no-resolver', (record) => { record.publicLocation.address = unverifiedField(clone(SYNTHETIC_ADDRESS)) }, null],
    ['geo-string', (record) => {
      record.publicLocation.geo = unverifiedField({ ...clone(SYNTHETIC_GEO), latitude: '31.2' })
    }],
    ['geo-zero', (record) => {
      record.publicLocation.geo = unverifiedField({ latitude: 0, longitude: 0, coordinateSystem: 'gcj02' })
    }],
    ['geo-wgs84', (record) => {
      record.publicLocation.geo = unverifiedField({ ...clone(SYNTHETIC_GEO), coordinateSystem: 'wgs84' })
    }],
    ['address-unknown-concrete', (record) => { record.publicLocation.address.value = clone(SYNTHETIC_ADDRESS) }],
    ['geo-unavailable-concrete', (record) => {
      record.publicLocation.geo.availability = 'unavailable'
      record.publicLocation.geo.value = clone(SYNTHETIC_GEO)
    }],
    ['record-revision-zero', (record) => { record.recordRevision = 0 }],
    ['invalid-base-identity', (record) => { record.identity.name.value = '' }],
    ['duplicate-global-evidence', (record) => {
      const enriched = enrichInstitutionV121(record)
      record.evidence = enriched.evidence
      record.careProcess = enriched.careProcess
      record.officialContact = enriched.officialContact
      record.publicLocation = enriched.publicLocation
      record.evidence.push(clone(record.evidence[record.evidence.length - 1]))
    }],
    ['extra-evidence-metadata', (record) => {
      const enriched = enrichInstitutionV121(record)
      record.evidence = enriched.evidence
      record.careProcess = enriched.careProcess
      record.officialContact = enriched.officialContact
      record.publicLocation = enriched.publicLocation
      record.evidence[record.evidence.length - 1].reviewer = 'private'
    }],
    ['official-evidence-index-path', (record) => {
      const enriched = enrichInstitutionV121(record)
      record.evidence = enriched.evidence
      record.careProcess = enriched.careProcess
      record.officialContact = enriched.officialContact
      record.publicLocation = enriched.publicLocation
      record.evidence.find((item) => item.fieldPath.endsWith('phone-main-001.phone')).fieldPath =
        'officialContact.officialPhones.0.phone'
    }],
  ]
  mutations.forEach(([name, mutate, special], index) => run('V121', `${String(index + 3).padStart(3, '0')}-${name}`, () => {
    const record = makeValidInstitutionV121()
    mutate(record)
    const useOptions = special === null ? {} : options
    expectInvalid(v121.validateInstitutionRecordV121(record, useOptions))
  }))
}

const makeV11FromV12Fixture = (v12) => {
  const projected = v12.projectInstitutionRecordV12ToV11(makeValidInstitutionV12(), options)
  assert.equal(projected.ok, true)
  return projected.value
}

const runDispatchTests = (v121) => {
  const v12ModuleRecord = makeValidInstitutionV12()
  const v11Record = clone(v12ModuleRecord)
  delete v11Record.careProcess
  v11Record.contractVersion = 'institution-contract-v1.1'
  const validCases = [v11Record, v12ModuleRecord, makeValidInstitutionV121()]
  validCases.forEach((record, index) => run('DISPATCH', `00${index + 1}-valid`, () => {
    const result = v121.validateInstitutionRecordByVersion(record, options)
    assert.equal(result.ok, true)
    assert.equal(result.contractVersion, record.contractVersion)
  }))
  const invalidCases = [
    null,
    {},
    { contractVersion: null },
    { contractVersion: 'institution-contract-v9' },
    { contractVersion: '1.2.1' },
    { ...clone(v11Record), officialContact: makeUnknownOfficialContact() },
    { ...clone(v12ModuleRecord), officialContact: makeUnknownOfficialContact() },
    { ...clone(makeValidInstitutionV121()), contractVersion: 'institution-contract-v1.2' },
    { ...clone(makeValidInstitutionV121()), careProcess: undefined },
    (() => {
      const record = clone(v12ModuleRecord)
      record.careProcess.careRecord.completeness = null
      return record
    })(),
    (() => {
      const record = clone(v12ModuleRecord)
      record.careProcess.careRecord.frequency = null
      return record
    })(),
  ]
  invalidCases.forEach((record, index) => run('DISPATCH', `${String(index + 4).padStart(3, '0')}-fail-closed`, () => {
    assert.equal(v121.validateInstitutionRecordByVersion(record, options).ok, false)
  }))
}

const runProjectionV12Tests = (v121, v12) => {
  const project = (record = enrichInstitutionV121()) => v121.projectInstitutionRecordV121ToV12(record, options)
  run('PROJECT_V12', '001-success', () => assert.equal(project().ok, true))
  run('PROJECT_V12', '002-version', () => assert.equal(project().value.contractVersion, 'institution-contract-v1.2'))
  run('PROJECT_V12', '003-identity', () => {
    const input = enrichInstitutionV121()
    const output = project(input).value
    assert.equal(output.institutionId, input.institutionId)
    assert.equal(output.recordRevision, input.recordRevision)
  })
  run('PROJECT_V12', '004-care-retained', () => assert.deepEqual(project().value.careProcess, enrichInstitutionV121().careProcess))
  ;['officialContact', 'publicLocation', 'publicIntroduction'].forEach((key, index) => run(
    'PROJECT_V12', `00${index + 5}-${key}-absent`, () => {
      assert.equal(Object.prototype.hasOwnProperty.call(project().value, key), false)
    },
  ))
  run('PROJECT_V12', '008-new-evidence-dropped', () => {
    const output = project().value
    assert.equal(output.evidence.some((item) => item.fieldPath.startsWith('officialContact.')), false)
    assert.equal(output.evidence.some((item) => item.fieldPath.startsWith('publicLocation.')), false)
  })
  run('PROJECT_V12', '009-care-evidence-retained', () => assert.equal(
    project().value.evidence.some((item) => item.fieldPath.startsWith('careProcess.')), true,
  ))
  run('PROJECT_V12', '010-output-valid', () => assert.equal(
    v12.validateInstitutionRecordV12(project().value, options).ok, true,
  ))
  run('PROJECT_V12', '011-input-immutable', () => {
    const input = enrichInstitutionV121()
    const before = clone(input)
    project(input)
    assert.deepEqual(input, before)
  })
  run('PROJECT_V12', '012-invalid-input', () => {
    const input = enrichInstitutionV121()
    delete input.officialContact
    assert.deepEqual(project(input), { ok: false, code: 'V121_TO_V12_PROJECTION_ERROR' })
  })
  run('PROJECT_V12', '013-legacy-address-unchanged', () => {
    const input = enrichInstitutionV121()
    assert.deepEqual(project(input).value.identity.address, input.identity.address)
  })
  run('PROJECT_V12', '014-legacy-coordinates-unchanged', () => {
    const input = enrichInstitutionV121()
    assert.deepEqual(project(input).value.identity.coordinates, input.identity.coordinates)
  })
  run('PROJECT_V12', '015-legacy-contact-unchanged', () => {
    const input = enrichInstitutionV121()
    assert.deepEqual(project(input).value.identity.publicContact, input.identity.publicContact)
  })
}

const runProjectionV11Tests = (v121, v11) => {
  const project = (record = enrichInstitutionV121()) => v121.projectInstitutionRecordV121ToV11(record, options)
  run('PROJECT_V11', '001-success', () => assert.equal(project().ok, true))
  run('PROJECT_V11', '002-version', () => assert.equal(project().value.contractVersion, 'institution-contract-v1.1'))
  run('PROJECT_V11', '003-output-valid', () => assert.equal(v11.validateInstitutionRecordV11(project().value).ok, true))
  run('PROJECT_V11', '004-identity', () => {
    const input = enrichInstitutionV121()
    const output = project(input).value
    assert.equal(output.institutionId, input.institutionId)
    assert.equal(output.recordRevision, input.recordRevision)
  })
  ;['careProcess', 'officialContact', 'publicLocation', 'publicIntroduction'].forEach((key, index) => run(
    'PROJECT_V11', `00${index + 5}-${key}-absent`, () => {
      assert.equal(Object.prototype.hasOwnProperty.call(project().value, key), false)
    },
  ))
  ;['careProcess.', 'officialContact.', 'publicLocation.'].forEach((prefix, index) => run(
    'PROJECT_V11', `00${index + 9}-${prefix}-evidence-dropped`, () => {
      assert.equal(project().value.evidence.some((item) => item.fieldPath.startsWith(prefix)), false)
    },
  ))
  run('PROJECT_V11', '012-input-immutable', () => {
    const input = enrichInstitutionV121()
    const before = clone(input)
    project(input)
    assert.deepEqual(input, before)
  })
  run('PROJECT_V11', '013-invalid-input', () => {
    const input = enrichInstitutionV121()
    input.publicLocation.geo.value.coordinateSystem = 'wgs84'
    assert.deepEqual(project(input), { ok: false, code: 'V121_TO_V11_PROJECTION_ERROR' })
  })
  const preservedKeys = [
    'capabilities', 'services', 'medicalSupport', 'staffing', 'healthMonitoring',
    'price', 'operations', 'rooms', 'meal', 'activity', 'transportation',
    'majorHospitalAccess',
  ]
  preservedKeys.forEach((key, index) => run('PROJECT_V11', `${String(index + 14).padStart(3, '0')}-${key}-preserved`, () => {
    const input = enrichInstitutionV121()
    assert.deepEqual(project(input).value[key], input[key])
  }))
}

const runProjectionParityTests = (v121, v12) => {
  const variants = [
    makeValidInstitutionV121(),
    enrichInstitutionV121(),
    makePhoneRecord(),
    makeAddressRecord(),
    makeGeoRecord(),
    makeCareRecord(),
    makeShiftRecord(),
    (() => { const value = makeCareRecord(); value.careProcess.careRecord.frequency = unverifiedField(['per_shift']); return value })(),
    (() => { const value = makePhoneRecord([SYNTHETIC_MOBILE, SYNTHETIC_LANDLINE]); return value })(),
    (() => { const value = makeValidInstitutionV121(); value.publicLocation.address = unavailableField(); return value })(),
  ]
  variants.forEach((record, index) => run('PROJECTION_PARITY', `${String(index + 1).padStart(3, '0')}`, () => {
    const direct = v121.projectInstitutionRecordV121ToV11(record, options)
    const predecessor = v121.projectInstitutionRecordV121ToV12(record, options)
    assert.equal(direct.ok, true)
    assert.equal(predecessor.ok, true)
    const multihop = v12.projectInstitutionRecordV12ToV11(predecessor.value, options)
    assert.equal(multihop.ok, true)
    assert.deepEqual(direct.value, multihop.value)
  }))
}

const runRecommendationParityTests = (v121, recommendationV2, elderProfileV2) => {
  const profileResult = elderProfileV2.deriveElderProfilePreviewV2(
    makeAssessmentDraftV2(baseProfileAnswers),
  )
  assert.equal(profileResult.ok, true, 'V2 preview profile fixture must derive')
  const profile = profileResult.preview
  const originalV11 = makeV2InstitutionPool(1)[0]
  const evaluate = (institution) => recommendationV2.evaluateRecommendationPreviewV2({
    profile,
    institutions: [institution],
    datasetVersion: 'institution-v121-isolation-test-v1',
    datasetMode: 'MOCK_DEVELOPMENT_ONLY',
    evaluationAsOf: INSTITUTION_V121_EVALUATION_AS_OF,
    contractVersion: 'recommendation-contract-v2',
    rulesetVersion: 'recommendation-ruleset-v2',
    policyVersion: 'conservative-exact-with-conditional-v1',
  })
  const baseline = evaluate(originalV11)
  assert.equal(baseline.ok, true, 'V1.1 baseline must evaluate')

  const variants = [
    ['all-unknown', (record) => record],
    ['care-absent', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('absent'); return record
    }],
    ['care-daily', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.frequency = unverifiedField(['daily']); return record
    }],
    ['care-event', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.frequency = unverifiedField(['event_based']); return record
    }],
    ['care-other', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.frequency = unverifiedField(['other'])
      record.careProcess.careRecord.otherFrequencyNote = unverifiedField('测试其他频率'); return record
    }],
    ['shift-present', (record) => {
      record.careProcess.shiftHandover24h.presence = unverifiedField('present'); return record
    }],
    ['shift-content', (record) => {
      record.careProcess.shiftHandover24h.presence = unverifiedField('present')
      record.careProcess.shiftHandover24h.contents.follow_up = unverifiedField('present'); return record
    }],
    ['contact-absent', (record) => {
      record.officialContact.phoneDirectoryPresence = unverifiedField('absent'); return record
    }],
    ['contact-unavailable', (record) => {
      record.officialContact.phoneDirectoryPresence = unavailableField(); return record
    }],
    ['phone-main', (record) => {
      record.officialContact.phoneDirectoryPresence = unverifiedField('present')
      record.officialContact.officialPhones = [{ officialPhoneKey: 'phone-test-main', phone: unverifiedField(clone(SYNTHETIC_MOBILE)) }]
      return record
    }],
    ['phone-service', (record) => {
      record.officialContact.phoneDirectoryPresence = unverifiedField('present')
      record.officialContact.officialPhones = [{ officialPhoneKey: 'phone-test-service', phone: unverifiedField(clone(SYNTHETIC_LANDLINE)) }]
      return record
    }],
    ['phone-other', (record) => {
      const phone = clone(SYNTHETIC_MOBILE)
      phone.purpose = 'other'; phone.otherPurposeNote = '测试其他用途'
      record.officialContact.phoneDirectoryPresence = unverifiedField('present')
      record.officialContact.officialPhones = [{ officialPhoneKey: 'phone-test-other', phone: unverifiedField(phone) }]
      return record
    }],
    ['address-unavailable', (record) => { record.publicLocation.address = unavailableField(); return record }],
    ['address-unverified', (record) => { record.publicLocation.address = unverifiedField(clone(SYNTHETIC_ADDRESS)); return record }],
    ['geo-unavailable', (record) => { record.publicLocation.geo = unavailableField(); return record }],
    ['geo-unverified', (record) => { record.publicLocation.geo = unverifiedField(clone(SYNTHETIC_GEO)); return record }],
    ['location-both-unverified', (record) => {
      record.publicLocation.address = unverifiedField(clone(SYNTHETIC_ADDRESS))
      record.publicLocation.geo = unverifiedField(clone(SYNTHETIC_GEO)); return record
    }],
    ['alternate-geo', (record) => {
      record.publicLocation.geo = unverifiedField({ latitude: 30.123, longitude: 115.456, coordinateSystem: 'gcj02' }); return record
    }],
    ['phone-and-care', (record) => {
      record.careProcess.careRecord.presence = unverifiedField('present')
      record.careProcess.careRecord.frequency = unverifiedField(['per_shift'])
      record.officialContact.phoneDirectoryPresence = unverifiedField('present')
      record.officialContact.officialPhones = [{ officialPhoneKey: 'phone-combined', phone: unverifiedField(clone(SYNTHETIC_MOBILE)) }]
      return record
    }],
    ['public-content-external', (record) => {
      const content = makePublicContent()
      content.introduction.text = '24小时护理、五星级（仅测试文案，不是事实）'
      assert.equal(v121.validateInstitutionPublicContentV1(content).ok, true)
      assert.equal(Object.prototype.hasOwnProperty.call(record, 'publicContent'), false)
      return record
    }],
  ]
  variants.forEach(([name, mutate], index) => run(
    'RECOMMENDATION_PARITY', `${String(index + 1).padStart(3, '0')}-${name}`, () => {
      const successor = mutate(makeSuccessorFromV11(originalV11))
      const validation = v121.validateInstitutionRecordV121(successor, options)
      assert.equal(validation.ok, true, `successor invalid: ${JSON.stringify(codes(validation))}`)
      const projected = v121.projectInstitutionRecordV121ToV11(successor, options)
      assert.equal(projected.ok, true)
      assert.deepEqual(projected.value, originalV11)
      const actual = evaluate(projected.value)
      assert.equal(actual.ok, true)
      assert.deepEqual(actual, baseline)
    },
  ))
}

const runStaticIsolationTests = (loadedSources) => {
  const productionEntries = Array.from(loadedSources.entries()).filter(([filePath]) =>
    filePath.includes(`${path.sep}domain${path.sep}institution${path.sep}v1-2`))
  const forbiddenRuntimePatterns = [
    /wx\.request/,
    /wx\.getLocation/,
    /wx\.openLocation/,
    /wx\.makePhoneCall/,
    /geocoder/i,
    /recommendation\/v2/,
    /rank-helper/i,
    /priority-comparator/i,
  ]
  productionEntries.forEach(([filePath, source]) => {
    forbiddenRuntimePatterns.forEach((pattern) => {
      assert.equal(pattern.test(source), false, `${path.relative(repositoryRoot, filePath)} matches ${pattern}`)
    })
  })
  const directProjectionPath = path.join(
    repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2-1', 'project-to-v1-1.ts',
  )
  const directProjection = readFileSync(directProjectionPath, 'utf8')
  assert.equal(directProjection.includes('projectInstitutionRecordV121ToV12'), false,
    'direct V121 to V11 projector must not call multihop projection')
  ;[
    directProjectionPath,
    path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2-1', 'project-to-v1-2.ts'),
    path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2', 'project-to-v1-1.ts'),
    path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2', 'projection-common.ts'),
    path.join(repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2-1', 'projection-common.ts'),
  ].forEach((filePath) => {
    const source = readFileSync(filePath, 'utf8')
    assert.equal(/Object\.assign|\bdelete\b|JSON\.(?:parse|stringify)|\.\.\.record\b/.test(source), false,
      `${path.relative(repositoryRoot, filePath)} uses a forbidden projection construction`)
  })
  const careSource = readFileSync(path.join(
    repositoryRoot, 'miniprogram', 'domain', 'institution', 'v1-2', 'care-process.ts',
  ), 'utf8')
  assert.equal(/capabilit|recommendation|score|ranking/i.test(careSource), false,
    'CareProcess runtime must not import or mutate matching/capability logic')

  const appFiles = []
  const visit = (directory) => {
    for (const entry of require('node:fs').readdirSync(directory, { withFileTypes: true })) {
      const itemPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(itemPath)
      else if (/\.(?:ts|js)$/.test(entry.name)) appFiles.push(itemPath)
    }
  }
  visit(path.join(repositoryRoot, 'miniprogram'))
  appFiles.forEach((filePath) => {
    const source = readFileSync(filePath, 'utf8')
    assert.equal(/scripts[\\/]fixtures|institution-v1-2-1-fixtures/.test(source), false,
      `${path.relative(repositoryRoot, filePath)} imports a test fixture`)
  })
}

execute().catch((error) => {
  console.error('INSTITUTION_V1_2_1_RUNTIME = FAIL')
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
