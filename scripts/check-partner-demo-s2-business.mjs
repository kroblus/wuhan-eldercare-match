import assert from 'node:assert/strict'
import { stripTypeScriptTypes } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const workspace = process.cwd()
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'partner-demo-s2-business-'))
const miniRoot = path.join(tempRoot, 'miniprogram')
const servicesDir = path.join(miniRoot, 'services')
const domainDir = path.join(miniRoot, 'domain', 'appointment-institution-visit')
await Promise.all([
  mkdir(servicesDir, { recursive: true }),
  mkdir(domainDir, { recursive: true }),
])

const sourceFiles = [
  'partner-demo-s2/templates/business/business-session.ts',
  'partner-demo-s2/templates/business/appointment-create-client.ts',
  'partner-demo-s2/templates/business/appointment-owner-read.ts',
  'partner-demo-s2/templates/business/visit-evaluation-providers.ts',
  'miniprogram/domain/appointment-institution-visit/phone-format.ts',
]
const forbidden = /\bwx\s*\.|\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|C5Authenticated|C6|assessment-draft|wx\.getStorage|wx\.setStorage|wx\.request/i
for (const relative of sourceFiles.slice(0, 4)) {
  const source = await readFile(path.join(workspace, relative), 'utf8')
  assert.equal(forbidden.test(source), false, `${relative} must have no platform, storage, auth, or network access`)
}

const rewriteRelativeImports = (source) => source.replace(
  /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
  (_match, before, specifier, after) => `${before}${specifier.endsWith('.mjs') ? specifier : `${specifier}.mjs`}${after}`,
)
const writeStrippedModule = async (sourceRelative, targetPath) => {
  const source = await readFile(path.join(workspace, sourceRelative), 'utf8')
  const stripped = stripTypeScriptTypes(source, { mode: 'strip' })
  await writeFile(targetPath, rewriteRelativeImports(stripped), 'utf8')
}

await Promise.all([
  writeStrippedModule(sourceFiles[0], path.join(servicesDir, 'business-session.mjs')),
  writeStrippedModule(sourceFiles[1], path.join(servicesDir, 'appointment-create-client.mjs')),
  writeStrippedModule(sourceFiles[2], path.join(servicesDir, 'appointment-owner-read.mjs')),
  writeStrippedModule(sourceFiles[3], path.join(servicesDir, 'visit-evaluation-providers.mjs')),
  writeStrippedModule(sourceFiles[4], path.join(domainDir, 'phone-format.mjs')),
])

const sessionModule = await import(pathToFileURL(path.join(servicesDir, 'business-session.mjs')).href)
const appointmentModule = await import(pathToFileURL(path.join(servicesDir, 'appointment-create-client.mjs')).href)
const ownerReadModule = await import(pathToFileURL(path.join(servicesDir, 'appointment-owner-read.mjs')).href)
const evaluationModule = await import(pathToFileURL(path.join(servicesDir, 'visit-evaluation-providers.mjs')).href)

const session = sessionModule.createDemoBusinessSession({ now: () => '2026-10-11T02:00:00.000Z' })
const institution = {
  identity: { institutionId: 's2a-synth-alpha', recordRevision: 1 },
  displayName: '虚构示例机构 Alpha（Mock，TEST ONLY）',
}
const form = {
  visitDate: '2026-10-20',
  visitTimePreference: '工作日上午',
  participantCount: '2',
  contactName: '合成联系人 TEST ONLY',
  phone: '13900000000',
  notes: 'TEST ONLY 合成预约意向',
}
const client = appointmentModule.createDemoAppointmentCreateClientV1({ session })
const prepared = await client.resolveOrEstablishElderAfterIntent()
assert.deepEqual(prepared, { kind: 'ready', elderId: 'synthetic-demo-elder' })

const submitted = await client.submit({
  institution,
  elderId: prepared.elderId,
  form,
  // This sentinel is intentionally ignored; the demo adapter never accepts or uses phone authorization evidence.
  phoneCode: 'TEST_ONLY_NOT_AUTH_EVIDENCE',
})
assert.equal(submitted.kind, 'accepted')
assert.equal(submitted.receipt.status, 'requested')
assert.equal(submitted.receipt.institutionId, institution.identity.institutionId)
assert.equal(submitted.receipt.acceptedAt, '2026-10-11T02:00:00.000Z')
const visitId = submitted.receipt.visitId
assert.equal(session.listVisits().length, 1)
assert.equal(session.readVisit(visitId).provenance, 'DEMO_ONLY')
assert.equal(session.readVisit(visitId).visitStatus, 'requested')
assert.equal('contactName' in session.readVisit(visitId), false)
assert.equal('phone' in session.readVisit(visitId), false)
assert.equal('notes' in session.readVisit(visitId), false)

const replayed = await client.submit({ institution, elderId: prepared.elderId, form, phoneCode: '' })
assert.equal(replayed.kind, 'accepted')
assert.equal(replayed.replayed, true)
assert.equal(replayed.receipt.visitId, visitId)
assert.equal(session.listVisits().length, 1)

const conflicting = await client.submit({
  institution,
  elderId: prepared.elderId,
  form: { ...form, notes: '不同意向 TEST ONLY' },
  phoneCode: '',
})
assert.deepEqual(conflicting, { kind: 'rejected', code: 'IDEMPOTENCY_CONFLICT' })

const ownerProvider = ownerReadModule.createDemoAppointmentOwnerReadProviderV1({ session })
assert.equal(ownerProvider.provenance, 'DEMO_ONLY')
const listed = await ownerProvider.loadOwnedVisits()
assert.equal(listed.kind, 'ready')
assert.equal(listed.provenance, 'DEMO_ONLY')
assert.equal(listed.visits.length, 1)
assert.equal(listed.visits[0].visitId, visitId)

assert.equal(session.loadEvaluationContext(visitId), null)
assert.equal(session.advanceVisitStatus(visitId).visit.visitStatus, 'contacting')
assert.equal(session.advanceVisitStatus(visitId).visit.visitStatus, 'scheduled')
assert.equal(session.advanceVisitStatus(visitId).visit.visitStatus, 'completed')
assert.equal(session.advanceVisitStatus(visitId).kind, 'already_completed')
const context = session.loadEvaluationContext(visitId)
assert.equal(context.provenance, 'TEST_ONLY')
assert.equal(context.visitStatus, 'completed')
assert.equal(context.institutionRecordRevision, '1')

const providers = evaluationModule.createDemoVisitEvaluationProvidersV1({ session })
assert.equal(providers.provenance, 'TEST_ONLY')
assert.deepEqual(await providers.contextProvider.loadContext(visitId), context)
const draft = { overallRating: 4, consideration: 'willing', likedTags: ['care'], concernTags: [], comment: 'TEST_ONLY 观察' }
const evaluationInput = { provenance: 'TEST_ONLY', context, draft }
assert.deepEqual(await providers.submitProvider.submit(evaluationInput), {
  outcome: 'submitted', provenance: 'TEST_ONLY',
})
assert.deepEqual(await providers.submitProvider.submit(evaluationInput), {
  outcome: 'submitted', provenance: 'TEST_ONLY',
})
assert.deepEqual(await providers.submitProvider.submit({
  ...evaluationInput,
  draft: { ...draft, comment: '不同评价 TEST_ONLY' },
}), { outcome: 'already_submitted', provenance: 'TEST_ONLY' })

const beforeReset = session.listVisits()[0]
const receipt = submitted.receipt
const summary = {
  institutionId: receipt.institutionId,
  institutionRecordRevision: receipt.institutionRecordRevision,
  institutionName: institution.displayName,
  visitDate: form.visitDate,
  visitTimePreference: form.visitTimePreference,
  participantCount: 2,
}
const handoff = session.createSuccessHandoff(receipt, summary)
assert.equal(session.consumeSuccessHandoff(handoff.id).receipt.visitId, visitId)
assert.equal(session.consumeSuccessHandoff(handoff.id), null)
session.recordInstitutionDisplaySnapshot(institution.identity.institutionId, 1, institution.displayName)
assert.equal(session.consumeInstitutionDisplaySnapshot(institution.identity.institutionId, 1), institution.displayName)
assert.equal(session.consumeInstitutionDisplaySnapshot(institution.identity.institutionId, 1), null)
session.reset()
assert.equal(session.listVisits().length, 0)
assert.equal(session.readVisit(visitId), null)
assert.equal(session.loadEvaluationContext(visitId), null)
assert.equal(session.submitEvaluation({ provenance: 'TEST_ONLY', context, draft }).outcome, 'provider_failed')
assert.equal(session.consumeSuccessHandoff(handoff.id), null)
assert.equal((await client.submit({ institution, elderId: prepared.elderId, form, phoneCode: '' })).kind, 'rejected')
assert.equal(session.listVisits().length, 0)
assert.equal(beforeReset.provenance, 'DEMO_ONLY')

const invalidInstitutionClient = appointmentModule.createDemoAppointmentCreateClientV1({ session })
await invalidInstitutionClient.resolveOrEstablishElderAfterIntent()
const invalid = await invalidInstitutionClient.submit({
  institution: { identity: { institutionId: 'real-looking-id', recordRevision: 1 }, displayName: '真实名称' },
  elderId: 'synthetic-demo-elder',
  form,
  phoneCode: '',
})
assert.deepEqual(invalid, { kind: 'rejected', code: 'REFERENCE_UNAVAILABLE' })

console.log(JSON.stringify({
  status: 'PASS',
  tempRoot,
  importedModules: sourceFiles.slice(0, 4),
  provenance: { appointment: 'DEMO_ONLY', evaluation: 'TEST_ONLY' },
}, null, 2))
