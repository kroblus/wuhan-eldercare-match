import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  elderProfilePreviewFixtures,
  elderProfilePreviewParityFixtures,
  makeFormalAssessment,
  makePreviewDraft,
  PREVIEW_REGION_SNAPSHOT,
} from './fixtures/elder-profile-preview-fixtures.mjs'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(repositoryRoot, 'miniprogram')
const domainRoot = path.join(miniprogramRoot, 'domain', 'elder-profile')
const failures = []
const caseIds = []
let caseCount = 0

const EXPECTED_PREVIEW_CASE_IDS = Object.freeze([
  'PREVIEW-001', 'PREVIEW-002', 'PREVIEW-003', 'PREVIEW-004', 'PREVIEW-005',
  'PREVIEW-006', 'PREVIEW-007', 'PREVIEW-008', 'PREVIEW-009', 'PREVIEW-010',
  'PREVIEW-011', 'PREVIEW-012', 'PREVIEW-013', 'PREVIEW-014', 'PREVIEW-015',
])

const EXPECTED_PARITY_CASE_IDS = Object.freeze([
  'PARITY-001', 'PARITY-002', 'PARITY-003', 'PARITY-004', 'PARITY-005',
])

const SEMANTIC_PAYLOAD_KEYS = Object.freeze([
  'basic',
  'health',
  'adl',
  'mobility',
  'cognition',
  'specialCare',
  'preference',
  'financial',
  'intent',
  'userFacingSummary',
  'evidence',
  'clarifications',
])

const PREVIEW_KEYS = Object.freeze([
  'adl',
  'basic',
  'cognition',
  'clarifications',
  'derivationRulesetVersion',
  'evidence',
  'financial',
  'health',
  'intent',
  'kind',
  'mobility',
  'preference',
  'profileContractVersion',
  'source',
  'specialCare',
  'userFacingSummary',
])

const PREVIEW_SOURCE_KEYS = Object.freeze([
  'assessmentSchemaVersion',
  'kind',
  'localDraftId',
])

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const getTypeScriptParser = async () => {
  const explicitPath = process.env.WECHAT_TYPESCRIPT_PATH
  if (explicitPath) {
    const parserPath = path.resolve(explicitPath)
    return { parser: require(parserPath), parserPath }
  }
  try {
    return { parser: require('typescript'), parserPath: require.resolve('typescript') }
  } catch {
    // The repository intentionally keeps TypeScript out of runtime dependencies.
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
    throw new Error('TypeScript parser not found; set WECHAT_TYPESCRIPT_PATH or open WeChat DevTools')
  }
  return { parser: require(candidates[0].parserPath), parserPath: candidates[0].parserPath }
}

const formatDiagnostic = (typescript, diagnostic) => {
  if (typeof diagnostic.messageText === 'string') {
    return diagnostic.messageText
  }
  return typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}

/** Execute production TypeScript through the current WeChat parser. */
const createSourceLoader = (typescript, loadedSourcePaths) => {
  const moduleCache = new Map()
  const resolveModule = (request, importer) => {
    const basePath = path.resolve(path.dirname(importer), request)
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.js`,
      `${basePath}.json`,
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
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }
    if (resolvedPath.includes(`${path.sep}tmp${path.sep}`)) {
      throw new Error(`Preview runtime must not load tmp artifact: ${resolvedPath}`)
    }
    const module = { exports: {} }
    moduleCache.set(resolvedPath, module)
    loadedSourcePaths.add(resolvedPath)
    const source = readFileSync(resolvedPath, 'utf8')
    if (resolvedPath.endsWith('.json')) {
      module.exports = JSON.parse(source)
      return module.exports
    }
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
    if (output.diagnostics && output.diagnostics.length > 0) {
      throw new Error(`${resolvedPath}: ${output.diagnostics.map((item) => formatDiagnostic(typescript, item)).join('; ')}`)
    }
    const localRequire = (request) => {
      if (!request.startsWith('.')) {
        throw new Error(`Pure elder-profile preview runtime forbids external import ${request} from ${resolvedPath}`)
      }
      return loadModule(resolveModule(request, resolvedPath))
    }
    const wrapped = `(function (require, module, exports, __filename, __dirname) {\n${output.outputText}\n})`
    const factory = vm.runInThisContext(wrapped, { filename: resolvedPath })
    factory(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
  return loadModule
}

const runCase = (id, callback) => {
  caseCount += 1
  if (caseIds.indexOf(id) >= 0) {
    throw new Error(`duplicate preview runtime case id ${id}`)
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

const semanticPayload = (profile) => {
  const payload = {}
  SEMANTIC_PAYLOAD_KEYS.forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(profile, key), `semantic payload missing ${key}`)
    payload[key] = profile[key]
  })
  return payload
}

const makePair = (answers, localDraftId, formalIdentity = {}) => {
  const draft = makePreviewDraft(clone(answers), localDraftId)
  const assessment = makeFormalAssessment(clone(answers), formalIdentity)
  return { draft, assessment }
}

const assertPreviewSuccess = (result) => {
  assert.equal(result.ok, true, 'preview derivation should succeed')
  assert.ok(result.preview)
  return result.preview
}

const assertPreviewError = (result, code, questionIds = []) => {
  assert.equal(result.ok, false, 'preview derivation should reject')
  assert.deepEqual(result.error, { code, questionIds })
}

const assertPreviewEnvelope = (preview, localDraftId) => {
  assert.deepEqual(Object.keys(preview).sort(), [...PREVIEW_KEYS].sort())
  assert.deepEqual(Object.keys(preview.source).sort(), [...PREVIEW_SOURCE_KEYS].sort())
  assert.deepEqual(preview.source, {
    kind: 'local_assessment_preview',
    localDraftId,
    assessmentSchemaVersion: 1,
  })
  assert.equal(preview.profileContractVersion, 'elder-profile-contract-v1')
  assert.equal(preview.derivationRulesetVersion, 'elder-profile-ruleset-v1')
}

const assertFormalSemanticParity = (formalModule, preview, answers, caseId) => {
  const formalResult = formalModule.deriveElderProfile(makeFormalAssessment(clone(answers), {
    id: `server-${caseId.toLowerCase()}`,
    elderId: `elder-${caseId.toLowerCase()}`,
  }))
  assert.equal(formalResult.ok, true, `${caseId}: formal derivation failed`)
  assert.deepEqual(semanticPayload(preview), semanticPayload(formalResult.profile),
    `${caseId}: preview/formal semantic payload drifted`)
}

const collectKeyPaths = (value, prefix = '$', result = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectKeyPaths(item, `${prefix}[${index}]`, result))
    return result
  }
  if (value === null || typeof value !== 'object') {
    return result
  }
  Object.keys(value).forEach((key) => {
    const pathValue = `${prefix}.${key}`
    result.push({ key, path: pathValue, value: value[key] })
    collectKeyPaths(value[key], pathValue, result)
  })
  return result
}

const assertNoServerIdentity = (preview) => {
  const entries = collectKeyPaths(preview)
  ;['assessmentId', 'elderId', 'completedAt', 'assessmentCompletedAt', 'previewId', 'generatedAt', 'serverId'].forEach((key) => {
    assert.equal(entries.some((entry) => entry.key === key), false, `preview contains forbidden identity key ${key}`)
  })
  const localDraftEntries = entries.filter((entry) => entry.key === 'localDraftId')
  assert.equal(localDraftEntries.length, 1, 'localDraftId must occur only in preview source')
  assert.equal(localDraftEntries[0].path, '$.source.localDraftId')
}

const assertAnswerSetEvidence = (preview, questionId, answers, targetOptionCode) => {
  const sources = preview.evidence.flatMap((item) => item.sources)
  const source = sources.find((item) => item.sourceKind === 'assessment_answer_set'
    && item.sourceQuestionId === questionId
    && item.targetOptionCode === targetOptionCode)
  assert.ok(source, `missing answer-set evidence for ${questionId}/${targetOptionCode}`)
  assert.deepEqual(source.sourceOptionCodes, answers[questionId])
  assert.equal(source.contribution, 'establishes_not_reported')
}

const assertStaticPureGraph = (loadedSourcePaths) => {
  const allowedTypePaths = new Set([
    path.join(miniprogramRoot, 'types', 'assessment.ts'),
    path.join(miniprogramRoot, 'types', 'elder-profile.ts'),
  ])
  assert.ok(loadedSourcePaths.size > 0, 'runtime loader did not load production sources')
  loadedSourcePaths.forEach((filePath) => {
    const allowed = filePath.startsWith(`${domainRoot}${path.sep}`) || allowedTypePaths.has(filePath)
    assert.equal(allowed, true, `preview graph loaded forbidden file ${filePath}`)
    assert.equal(filePath.includes(`${path.sep}tmp${path.sep}`), false, `tmp artifact loaded: ${filePath}`)
    const source = readFileSync(filePath, 'utf8')
    assert.doesNotMatch(source, /\bwx\s*\./, `${filePath} uses wx API`)
    assert.doesNotMatch(source, /(?:get|set|remove|clear)Storage(?:Sync)?\s*\(/, `${filePath} uses storage API`)
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|profilePreviewStore|previewStore)\b/i, `${filePath} contains preview persistence`)
    assert.doesNotMatch(source, /Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|randomUUID\s*\(/, `${filePath} uses time/random API`)
    assert.doesNotMatch(source, /\bcrypto\b/i, `${filePath} uses crypto/random dependency`)
  })
  const previewSourcePath = path.join(domainRoot, 'derive-elder-profile-preview.ts')
  const previewSource = readFileSync(previewSourcePath, 'utf8')
  assert.doesNotMatch(previewSource, /(?:setData|setStorage(?:Sync)?|(?:get|remove|clear)Storage(?:Sync)?|localStorage|sessionStorage|preview(?:Store|Cache)|persist(?:Preview|Profile)\s*\()/i, 'preview adapter contains persistence behavior')
  assert.doesNotMatch(previewSource, /(?:assessmentId|elderId|completedAt|generatedAt|previewId)/, 'preview adapter contains fake identity field')
  assert.doesNotMatch(previewSource, /kind\s*:\s*['"]completed_assessment['"]/, 'preview adapter creates formal assessment')
}

const run = async () => {
  const { parser, parserPath } = await getTypeScriptParser()
  const loadedSourcePaths = new Set()
  const loadModule = createSourceLoader(parser, loadedSourcePaths)
  const previewModule = loadModule(path.join(domainRoot, 'derive-elder-profile-preview.ts'))
  const formalModule = loadModule(path.join(domainRoot, 'derive-elder-profile.ts'))
  const assessmentModule = loadModule(path.join(miniprogramRoot, 'types', 'assessment.ts'))
  assert.equal(typeof previewModule.deriveElderProfilePreview, 'function')
  assert.equal(typeof formalModule.deriveElderProfile, 'function')
  assert.equal(typeof assessmentModule.validateAssessmentDraftForCompletion, 'function')

  assert.deepEqual(elderProfilePreviewFixtures.map((fixture) => fixture.id), EXPECTED_PREVIEW_CASE_IDS,
    'preview fixture manifest drifted')
  assert.deepEqual(elderProfilePreviewParityFixtures.map((fixture) => fixture.id), EXPECTED_PARITY_CASE_IDS,
    'preview parity fixture manifest drifted')
  assert.equal(new Set([...EXPECTED_PREVIEW_CASE_IDS, ...EXPECTED_PARITY_CASE_IDS]).size,
    EXPECTED_PREVIEW_CASE_IDS.length + EXPECTED_PARITY_CASE_IDS.length,
    'preview case IDs are not unique')

  const fixture = (id) => elderProfilePreviewFixtures.find((item) => item.id === id)

  runCase('PREVIEW-001', () => {
    const current = fixture('PREVIEW-001')
    const { draft } = makePair(current.answers, 'local-preview-001')
    const before = clone(draft)
    const result = previewModule.deriveElderProfilePreview(draft)
    const preview = assertPreviewSuccess(result)
    assertPreviewEnvelope(preview, 'local-preview-001')
    assertNoServerIdentity(preview)
    assert.deepEqual(draft, before, 'preview mutated the draft')
  })

  runCase('PREVIEW-002', () => {
    const current = fixture('PREVIEW-002')
    const draft = makePreviewDraft(current.answers, 'local-preview-002')
    const completeDraft = makePreviewDraft(fixture('PREVIEW-001').answers, 'local-preview-002-complete')
    assert.equal(assessmentModule.validateAssessmentDraftForCompletion(draft.answers).valid, false)
    assert.deepEqual(assessmentModule.validateAssessmentDraftForCompletion(draft.answers).invalidQuestionIds, ['adl.transfer'])
    assertPreviewError(previewModule.deriveElderProfilePreview(draft),
      current.expected.error.code, current.expected.error.questionIds)
    assertPreviewError(previewModule.deriveElderProfilePreview(null), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, kind: 'completed_assessment' }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, schemaVersion: 2 }), 'UNSUPPORTED_ASSESSMENT_SCHEMA')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, unexpected: true }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, persistence: 'SERVER' }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, currentStep: 'profile' }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, localDraftId: '   ' }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, answers: [] }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, startedAt: 'not-a-timestamp' }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({ ...draft, updatedAt: '2026-02-30T09:00:00.000Z' }), 'INVALID_DRAFT_STRUCTURE')
    const missingStartedAt = { ...draft }
    delete missingStartedAt.startedAt
    assertPreviewError(previewModule.deriveElderProfilePreview(missingStartedAt), 'INVALID_DRAFT_STRUCTURE')
    const missingUpdatedAt = { ...draft }
    delete missingUpdatedAt.updatedAt
    assertPreviewError(previewModule.deriveElderProfilePreview(missingUpdatedAt), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({
      ...completeDraft,
      answers: { ...completeDraft.answers, 'future.unknownQuestion': 'value' },
    }), 'INVALID_DRAFT_STRUCTURE')
    assertPreviewError(previewModule.deriveElderProfilePreview({
      ...completeDraft,
      answers: { ...completeDraft.answers, 'basic.elderName': '' },
    }), 'INVALID_DRAFT_STRUCTURE', ['basic.elderName'])
    const invalidConditional = makePreviewDraft({
      ...fixture('PREVIEW-001').answers,
      'basic.hasInstitutionExperience': 'false',
      'basic.institutionExitReasons': ['poor_nursing'],
    }, 'local-preview-002-invalid-conditional')
    assertPreviewError(previewModule.deriveElderProfilePreview(invalidConditional), 'INVALID_DRAFT_STRUCTURE', [
      'basic.institutionExitReasons',
    ])
  })

  runCase('PREVIEW-003', () => {
    const current = fixture('PREVIEW-003')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-003'),
    ))
    assert.equal(preview.adl.derivedFacts.careLevel.status, 'unknown')
    assert.equal(preview.adl.derivedFacts.careLevel.value, undefined)
    assert.deepEqual(preview.adl.derivedFacts.unknownQuestionIds, ['adl.bathing'])
    assert.equal(preview.clarifications.some((item) => item.clarificationId === 'cl:unknown_answer:adl.bathing'), true)
  })

  runCase('PREVIEW-004', () => {
    const current = fixture('PREVIEW-004')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-004'),
    ))
    const mode = preview.adl.derivedFacts.careModes.find((item) => item.code === current.expected.careMode)
    assert.ok(mode)
    assert.equal(mode.status, 'needs_confirmation')
    assert.equal(preview.adl.derivedFacts.observationCoverage.issues.includes('special_feeding_non_ordinal'), true)
    assertFormalSemanticParity(formalModule, preview, current.answers, current.id)
  })

  runCase('PREVIEW-005', () => {
    const current = fixture('PREVIEW-005')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-005'),
    ))
    const mode = preview.adl.derivedFacts.careModes.find((item) => item.code === current.expected.careMode)
    assert.ok(mode)
    assert.equal(mode.status, 'needs_confirmation')
    assert.equal(preview.adl.derivedFacts.observationCoverage.issues.includes('catheter_or_stoma_non_ordinal'), true)
    assertFormalSemanticParity(formalModule, preview, current.answers, current.id)
  })

  runCase('PREVIEW-006', () => {
    const current = fixture('PREVIEW-006')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-006'),
    ))
    const mode = preview.adl.derivedFacts.careModes.find((item) => item.code === current.expected.careMode)
    assert.ok(mode)
    assert.equal(mode.status, 'context')
    assert.deepEqual(preview.adl.derivedFacts.observationCoverage, {
      status: 'limited',
      issues: ['stairs_not_applicable'],
    })
    assertFormalSemanticParity(formalModule, preview, current.answers, current.id)
  })

  runCase('PREVIEW-007', () => {
    const current = fixture('PREVIEW-007')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-007'),
    ))
    const concern = preview.cognition.derivedFacts.cognitiveConcern
    assert.equal(concern.status, 'needs_confirmation')
    assert.equal(concern.candidateValue, 'present')
    assert.equal(preview.clarifications.some((item) => item.clarificationId === current.expected.clarification), true)
    assertFormalSemanticParity(formalModule, preview, current.answers, current.id)
  })

  runCase('PREVIEW-008', () => {
    const current = fixture('PREVIEW-008')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-008'),
    ))
    assertAnswerSetEvidence(preview, current.expected.answerSetQuestionId, current.answers, 'tube_feeding')
    assertAnswerSetEvidence(preview, current.expected.answerSetQuestionId, current.answers, 'catheter_care')
    const source = preview.evidence
      .flatMap((item) => item.sources)
      .find((item) => item.sourceKind === 'assessment_answer_set' && item.sourceQuestionId === 'health.conditions')
    assert.ok(source)
    assert.deepEqual(source.sourceOptionCodes, ['hypertension'])
    assert.equal(source.sourceOptionCodes.includes('unknown'), false)
    assert.equal(source.sourceOptionCodes.includes('none'), false)
    assertFormalSemanticParity(formalModule, preview, current.answers, current.id)

    const otherAnswers = {
      ...fixture('PREVIEW-001').answers,
      'cognitive.specialCareNeeds': ['other'],
    }
    const otherPreview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(otherAnswers, 'local-preview-008-other'),
    ))
    assert.equal(otherPreview.specialCare.rawFacts.answers.includes('other'), true)
    assert.equal(otherPreview.clarifications.some((item) =>
      item.clarificationId === 'cl:other_without_detail:cognitive.specialCareNeeds'), true)
    assert.equal(otherPreview.specialCare.derivedFacts.requiredCareCapabilities.some((item) =>
      item.status === 'required'), false, 'other must not invent a care capability')
    assertAnswerSetEvidence(otherPreview, 'cognitive.specialCareNeeds', otherAnswers, 'tube_feeding')
    assertFormalSemanticParity(formalModule, otherPreview, otherAnswers, 'PREVIEW-008-OTHER')
  })

  runCase('PREVIEW-009', () => {
    const current = fixture('PREVIEW-009')
    const { draft } = makePair(current.answers, 'local-preview-009')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(draft))
    assert.deepEqual(preview.preference.rawFacts.regionPreference, PREVIEW_REGION_SNAPSHOT)
    assert.notEqual(preview.preference.rawFacts.regionPreference, draft.answers['preference.region'])
    assert.equal(preview.preference.rawFacts.regionPreference.catalogVersion, 'institution-catalog-v1')
  })

  runCase('PREVIEW-010', () => {
    const current = fixture('PREVIEW-010')
    const draft = makePreviewDraft(current.answers, 'local-preview-010')
    const before = clone(draft)
    const first = previewModule.deriveElderProfilePreview(draft)
    const second = previewModule.deriveElderProfilePreview(draft)
    assert.deepEqual(first, second)
    assert.deepEqual(draft, before)
    assert.equal(first.ok, true)
  })

  runCase('PREVIEW-011', () => {
    const current = fixture('PREVIEW-011')
    const draft = makePreviewDraft(current.answers, 'local-preview-011')
    const first = assertPreviewSuccess(previewModule.deriveElderProfilePreview(draft))
    assert.equal(first.basic.rawFacts.age, 72)
    draft.answers['basic.age'] = current.expected.mutatedAge
    const second = assertPreviewSuccess(previewModule.deriveElderProfilePreview(draft))
    assert.equal(second.basic.rawFacts.age, current.expected.mutatedAge)
    assert.equal(first.basic.rawFacts.age, 72, 'old preview changed after draft mutation')
    assert.notDeepEqual(semanticPayload(first), semanticPayload(second))
  })

  runCase('PREVIEW-012', () => {
    const current = fixture('PREVIEW-012')
    const localDraftId = current.expected.localDraftId
    const { draft } = makePair(current.answers, localDraftId, {
      id: 'server-assessment-012',
      elderId: 'server-elder-012',
    })
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(draft))
    assert.equal(preview.source.localDraftId, localDraftId)
    assertNoServerIdentity(preview)
    assert.equal(formalModule.deriveElderProfile(draft).error.code, 'NOT_COMPLETED_ASSESSMENT')
  })

  runCase('PREVIEW-013', () => {
    const current = fixture('PREVIEW-013')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-013'),
    ))
    assertNoServerIdentity(preview)
    assert.equal(Object.prototype.hasOwnProperty.call(preview, 'elderId'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(preview, 'identity'), false)
  })

  runCase('PREVIEW-014', () => {
    const current = fixture('PREVIEW-014')
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(
      makePreviewDraft(current.answers, 'local-preview-014'),
    ))
    assertNoServerIdentity(preview)
    assert.equal(Object.prototype.hasOwnProperty.call(preview, 'completedAt'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(preview, 'generatedAt'), false)
  })

  runCase('PREVIEW-015', () => {
    const current = fixture('PREVIEW-015')
    const { assessment, draft } = makePair(current.answers, 'local-preview-015', {
      id: 'server-assessment-015',
      elderId: 'server-elder-015',
    })
    const formalBefore = formalModule.deriveElderProfile(assessment)
    assert.equal(formalBefore.ok, true)
    const preview = assertPreviewSuccess(previewModule.deriveElderProfilePreview(draft))
    const formalAfter = formalModule.deriveElderProfile(assessment)
    assert.deepEqual(formalAfter, formalBefore)
    assert.equal(preview.kind, 'elder_profile_preview')
    assert.equal(formalAfter.profile.kind, 'elder_profile')
    assert.deepEqual(semanticPayload(preview), semanticPayload(formalAfter.profile))
    assert.deepEqual(formalAfter.profile.identity, {
      elderId: 'server-elder-015',
      assessmentId: 'server-assessment-015',
      assessmentSchemaVersion: 1,
      assessmentCompletedAt: '2026-08-30T09:00:00.000Z',
      profileContractVersion: 'elder-profile-contract-v1',
      derivationRulesetVersion: 'elder-profile-ruleset-v1',
    })
  })

  elderProfilePreviewParityFixtures.forEach((parityFixture) => {
    runCase(parityFixture.id, () => {
      const { draft, assessment } = makePair(parityFixture.answers, `local-${parityFixture.id.toLowerCase()}`, {
        id: `server-${parityFixture.id.toLowerCase()}`,
        elderId: `elder-${parityFixture.id.toLowerCase()}`,
      })
      const beforeDraft = clone(draft)
      const formalResult = formalModule.deriveElderProfile(assessment)
      const previewResult = previewModule.deriveElderProfilePreview(draft)
      const formal = formalResult.ok ? formalResult.profile : null
      const preview = previewResult.ok ? previewResult.preview : null
      assert.equal(formalResult.ok, true, `${parityFixture.description}: formal derivation failed`)
      assert.equal(previewResult.ok, true, `${parityFixture.description}: preview derivation failed`)
      assert.ok(formal)
      assert.ok(preview)
      assert.deepEqual(semanticPayload(preview), semanticPayload(formal))
      assert.equal(preview.kind, 'elder_profile_preview')
      assert.equal(formal.kind, 'elder_profile')
      assertNoServerIdentity(preview)
      assert.deepEqual(draft, beforeDraft)
    })
  })

  assertStaticPureGraph(loadedSourcePaths)
  assert.deepEqual(caseIds, [...EXPECTED_PREVIEW_CASE_IDS, ...EXPECTED_PARITY_CASE_IDS],
    'preview runtime case ID set/order drifted')
  assert.equal(new Set(caseIds).size, caseIds.length, 'preview runtime case IDs are not unique')

  if (failures.length > 0) {
    console.error(`ELDER PROFILE PREVIEW RUNTIME FAIL: ${failures.length} case(s)`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }
  console.log(`ELDER PROFILE PREVIEW RUNTIME PASS: ${caseCount} cases`)
  console.log(`TypeScript parser: ${parser.version || 'unknown'} (${parserPath})`)
  console.log(`Loaded production modules: ${loadedSourcePaths.size}`)
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  console.error(`ELDER PROFILE PREVIEW RUNTIME ERROR: ${message}`)
  process.exitCode = 1
}
