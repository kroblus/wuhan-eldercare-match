// Formal C2: unchanged pure domain rules + current public display projections.
// No default provider, client result, wx, Storage, network, or read-time recomputation.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('runtime')
  const root = process.argv[process.argv.indexOf('--source-root') + 1]
  registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL) {
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(specifier + suffix, context.parentURL)
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
      }
    }
    return nextResolve(specifier, context)
  } })
  const load = relative => import(pathToFileURL(path.join(root, relative)).href)
  let text = ''; process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) { text += chunk; if (Buffer.byteLength(text) > 1048576) throw new Error('bound') }
  const { completed, catalog, evaluationAsOf } = JSON.parse(text)
  if (catalog.datasetMode !== 'PRODUCTION') throw new Error('source')
  const { deriveElderProfileV2 } = await load('domain/elder-profile/v2/derive-elder-profile-v2.ts')
  const { evaluateRecommendationPreviewV2 } = await load('domain/recommendation/v2/evaluate-recommendation-preview-v2.ts')
  const { projectInstitutionCatalogV121ToV11 } = await load('domain/institution/v1-2-1/catalog.ts')
  const { projectInstitutionDisplaySnapshotV11Pure } = await load('domain/institution/display-projection-v11.ts')
  const { isVerificationCurrentAt } = await load('domain/institution/verification.ts')
  const { composeReferenceResultV1 } = await load('domain/recommendation/initial-reference-v1/composition.ts')
  const { createInitialReferenceResultViewModel } = await load('presentation/recommendation/initial-reference-view-model.ts')
  const { createProfilePageViewModelV2 } = await load('presentation/assessment/profile-v2-view-model.ts')
  const derived = deriveElderProfileV2(completed)
  const projected = projectInstitutionCatalogV121ToV11(catalog)
  if (!derived.ok || !projected.ok) throw new Error('input')
  const { kind, identity, ...semantics } = derived.profile
  // Adapter into the unchanged preview evaluator; all input originated on this server.
  const profile = { kind: 'elder_profile_preview',
    source: { kind: 'local_assessment_preview', localDraftId: completed.id, assessmentSchemaVersion: 2 },
    profileContractVersion: identity.profileContractVersion,
    derivationRulesetVersion: identity.derivationRulesetVersion, ...semantics }
  const evaluated = evaluateRecommendationPreviewV2({ profile, institutions: projected.value.records,
    datasetVersion: catalog.datasetVersion, datasetMode: catalog.datasetMode, evaluationAsOf,
    contractVersion: 'recommendation-contract-v2', rulesetVersion: 'recommendation-ruleset-v2',
    policyVersion: 'conservative-exact-with-conditional-v1' })
  if (!evaluated.ok) throw new Error('evaluation')
  const legacyV2 = { kind: 'recommendation_result_application_snapshot_v2', preview: evaluated.value,
    institutionDisplays: projected.value.records.map(record => projectInstitutionDisplaySnapshotV11Pure(record, evaluationAsOf)),
    operationalDisplayAdvisories: projected.value.records.filter(record => {
      const bed = record.operations.bedAvailability
      return record.recordStatus === 'published' && bed.status !== 'unknown'
        && Date.parse(bed.asOf) <= Date.parse(evaluationAsOf)
        && isVerificationCurrentAt(bed.verification, evaluationAsOf)
    }).map(record => ({ institutionId: record.institutionId, recordRevision: record.recordRevision, code: 'AVAILABILITY_DISPLAY_ONLY' })),
    sourceContext: { datasetVersion: catalog.datasetVersion, datasetMode: catalog.datasetMode, evaluationAsOf,
      institutionContractVersion: 'institution-contract-v1.1', institutionCapabilityContractVersion: 'institution-capability-contract-v1' },
    source: evaluated.value.source }
  const composed = composeReferenceResultV1({ catalog, legacyV2, evaluationAsOf, expectedDatasetMode: 'PRODUCTION' })
  if (!composed.ok) throw new Error('composition')
  const composition = composed.value
  const resultView = createInitialReferenceResultViewModel(composition)
  const poolRevisions = evaluated.value.semantics.poolManifest.entries.map(row => ({
    institutionId: row.institutionId, recordRevision: row.recordRevision,
    recordProvenance: row.recordProvenance, recordStatus: row.recordStatus, disposition: row.disposition,
  }))
  const publicDisplay = { snapshotVersion: 1, state: composition.state, evaluationAsOf,
    assessmentVersion: 'assessment-contract-v2', versions: evaluated.value.semantics.versions,
    compositionVersion: composition.compositionVersion, referencePolicyVersion: composition.policyVersion,
    datasetVersion: catalog.datasetVersion, datasetMode: catalog.datasetMode, poolRevisions,
    profileView: createProfilePageViewModelV2(profile), resultView }
  // Store the complete answer + derived semantics privately; only publicDisplay crosses the detail API.
  process.stdout.write(JSON.stringify({ ok: true, snapshot: { snapshotVersion: 1, completed,
    profile: derived.profile, publicDisplay } }) + '\n')
} catch { process.stdout.write('{"ok":false}\n'); process.exitCode = 2 }
