// SYNTHETIC_TEST_ONLY. Source-only read-boundary tests; no WeChat compiler, network or real records.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWechatTsRuntime, loadWechatTypeScript } from './support/load-wechat-ts-runtime.mjs'
import {
  INITIAL_REFERENCE_EVALUATION_AS_OF as T,
  makeInitialReferenceRecordV121,
  makeInitialReferenceCatalogWithRecordsV121 as catalogFor,
  reidentifyInitialReferenceRecordV121 as reidentify,
} from './fixtures/initial-reference-v1-fixtures.mjs'
import {
  makeEvidenceField, unavailableField, SYNTHETIC_ADDRESS, SYNTHETIC_GEO, SYNTHETIC_MOBILE,
  SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER,
} from './fixtures/institution-v1-2-1-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'output/directory-read-v1-20261028')
const { ts } = loadWechatTypeScript()
let forbiddenEffects = 0, assertions = 0
const runtime = createWechatTsRuntime(ts, { wx: new Proxy({}, { get(_target, key) {
  forbiddenEffects++
  throw new Error(`Real side effect forbidden: wx.${String(key)}`)
} }) })
const load = file => runtime.load(path.join(root, 'miniprogram', file + '.ts'))
const clone = value => JSON.parse(JSON.stringify(value))
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++ }
const deep = (actual, expected, message) => { assert.deepStrictEqual(clone(actual), clone(expected), message); assertions++ }
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const identity = record => ({ institutionId: record.institutionId, recordRevision: record.recordRevision })
const validationOptions = load('runtime/institution-validation').institutionValidationOptions
validationOptions.administrativeDivisionResolver = SYNTHETIC_ADMINISTRATIVE_DIVISION_RESOLVER
const catalogApi = load('services/institution-catalog-validation-v121')
const resolverApi = load('services/institution-record-resolver')
const { createInstitutionDirectoryReadService } = load('services/institution-directory-read')
const { createInstitutionDetailApplicationServiceV12 } = load('services/institution-list-detail-application')
const { createInstitutionDetailPageViewModel } = load('pages/institution/detail-view-model')
const { addressViewModel, officialContactViewModel } = load('presentation/institution/contact-location')

// Successful paths use the actual catalog validator and exact-current resolver.
const realHost = (catalogSource, options = {}) => {
  const counts = { providerLoads: 0, batchLoads: 0, exactLoads: 0 }
  const provider = { loadCatalog: async () => {
    counts.providerLoads++
    return typeof catalogSource === 'function' ? catalogSource() : catalogSource
  } }
  const real = resolverApi.createInstitutionCurrentCatalogResolverV121(catalogApi.createInstitutionCatalogServiceV121(provider), options)
  const resolver = {
    loadCurrentCatalog: async () => { counts.batchLoads++; return real.loadCurrentCatalog() },
    resolveExactCurrentRevision: async id => { counts.exactLoads++; return real.resolveExactCurrentRevision(id) },
  }
  return { counts, resolver, read: createInstitutionDirectoryReadService(resolver) }
}
const injectedHost = response => {
  const counts = { loads: 0 }
  const resolver = { loadCurrentCatalog: async () => {
    counts.loads++
    return typeof response === 'function' ? response() : response
  }, resolveExactCurrentRevision: () => { throw new Error('Batch read must not perform per-item reads') } }
  return { counts, read: createInstitutionDirectoryReadService(resolver) }
}
const failed = (result, code) => {
  equal(result.ok, false, code)
  equal(result.error.code, code, 'Stable failure code')
  deep(Object.keys(result).sort(), ['error', 'ok'], 'Failure must not retain facts')
}
const ready = result => { equal(result.ok, true, 'Legal synthetic fixture must be readable'); return result.value }
const base = makeInitialReferenceRecordV121()
const second = reidentify(base, 'directory-read-synthetic-second')
const legalCatalog = freeze(catalogFor([base, second]))
const groups = []
const test = async (name, run) => {
  const started = Date.now()
  await run()
  groups.push({ name, status: 'PASS', elapsedMs: Date.now() - started })
  console.log('PASS DIRECTORY_READ ' + name)
}

// Build legal, evidence-bound state fixtures instead of replacing the implementation projectors.
const stateRecord = state => {
  const record = reidentify(makeInitialReferenceRecordV121(), 'directory-read-state-' + state)
  if (state === 'unavailable') {
    record.publicLocation.address = unavailableField()
    record.officialContact.phoneDirectoryPresence = unavailableField()
  } else if (state !== 'unknown') {
    const verification = state === 'unverified' ? 'unverified' : state === 'expired' ? 'expired' : 'verified'
    record.publicLocation.address = makeEvidenceField(record, 'publicLocation.address', SYNTHETIC_ADDRESS, 'structured_address', verification)
    record.publicLocation.geo = makeEvidenceField(record, 'publicLocation.geo', SYNTHETIC_GEO, 'geo_location')
    record.officialContact.phoneDirectoryPresence = makeEvidenceField(record, 'officialContact.phoneDirectoryPresence', 'present', 'stable_code')
    record.officialContact.officialPhones = [{ officialPhoneKey: 'directory-phone-main', phone:
      makeEvidenceField(record, 'officialContact.officialPhones.directory-phone-main.phone', SYNTHETIC_MOBILE, 'official_phone', verification) }]
  }
  return record
}

const fullDetailOracle = async (catalog, id, evaluationAsOf) => {
  const host = realHost(catalog)
  const application = createInstitutionDetailApplicationServiceV12({
    currentCatalogResolver: host.resolver,
    historicalRevisionResolver: resolverApi.createNotConfiguredHistoricalRevisionResolver(),
    sourceContextRegistry: { resolve: () => { throw new Error('Direct oracle must not read recommendation context') } },
  })
  const result = await application.build({ identity: id, source: 'direct', sourceContextRef: null, evaluationAsOf })
  return ready(result)
}

const main = async () => {
  await test('one batch, one catalog read, ordered results and immutable inputs', async () => {
    const input = freeze([identity(second), identity(base), identity(second)])
    const before = JSON.stringify({ input, legalCatalog })
    const host = realHost(legalCatalog)
    const results = await host.read.read(input, T)
    equal(results.length, input.length)
    deep(results.map(result => ready(result).identity), input)
    deep(host.counts, { providerLoads: 1, batchLoads: 1, exactLoads: 0 })
    equal(JSON.stringify({ input, legalCatalog }), before, 'No caller input or provider fact is mutated')
    const first = ready(results[0])
    first.sections.price.referenceMonthlyPrice.value.minAmountMinor = 1
    const next = await host.read.read(input, T)
    equal(ready(next[0]).sections.price.referenceMonthlyPrice.value.minAmountMinor, 650000, 'Returned data cannot contaminate a later read')
    equal(host.counts.providerLoads, 2, 'Settled results are not cached across reads')
  })

  await test('empty batch and invalid time never touch the resolver', async () => {
    const host = injectedHost(() => { throw new Error('Must not read') })
    deep(await host.read.read([], T), [])
    deep(await host.read.read([], 'invalid-time'), [])
    for (const time of ['invalid-time', '2026-10-26', '2026-02-30T04:00:00.000Z']) {
      const results = await host.read.read([identity(base), identity(second)], time)
      results.forEach(result => failed(result, 'INVALID_EVALUATION_AS_OF'))
    }
    equal(host.counts.loads, 0)
  })

  await test('identity, revision and published-only gates preserve batch alignment', async () => {
    const host = realHost(legalCatalog)
    const requested = [identity(base), { ...identity(base), recordRevision: base.recordRevision + 1 },
      { institutionId: 'directory-no-such-institution', recordRevision: 1 },
      { ...identity(base), recordRevision: 0 }, { ...identity(base), institutionId: '' }]
    const results = await host.read.read(requested, T)
    ready(results[0])
    for (const [index, code] of [[1, 'INSTITUTION_REVISION_NOT_FOUND'], [2, 'INSTITUTION_NOT_FOUND'], [3, 'IDENTITY_INVALID'], [4, 'IDENTITY_INVALID']]) failed(results[index], code)
    equal(host.counts.providerLoads, 1)
    for (const status of ['draft', 'suspended', 'archived']) {
      const record = clone(base); record.recordStatus = status
      const hidden = realHost(catalogFor([record]))
      failed((await hidden.read.read([identity(record)], T))[0], 'INSTITUTION_RECORD_NOT_DISPLAYABLE')
    }
    const wrongMode = realHost(catalogFor([base], { datasetMode: 'PRODUCTION' }))
    failed((await wrongMode.read.read([identity(base)], T))[0], 'DATASET_PROVENANCE_MISMATCH')
    const productionFixture = reidentify(base, 'directory-production-synthetic-only')
    productionFixture.recordProvenance = 'PRODUCTION_CANDIDATE'
    const production = realHost(catalogFor([productionFixture], { datasetMode: 'PRODUCTION' }))
    equal(ready((await production.read.read([identity(productionFixture)], T))[0]).datasetMode, 'PRODUCTION', 'Matching production provenance is accepted with synthetic inputs only')
  })

  const legalDataset = ready(await realHost(legalCatalog).resolver.loadCurrentCatalog())
  await test('injected resolver cannot bypass provenance or exact V121 source association', async () => {
    const mutations = [
      ['V121_SOURCE_RECORD_MISSING', dataset => { delete dataset.sourceRecordsV121 }],
      ['V121_SOURCE_RECORD_MISSING', dataset => { dataset.sourceRecordsV121 = [] }],
      ['V121_SOURCE_RECORD_DUPLICATE', dataset => { dataset.sourceRecordsV121.push(clone(dataset.sourceRecordsV121[0])) }],
      ['V121_SOURCE_RECORD_MISMATCH', dataset => { dataset.records[0].identity.name.value = 'SYNTHETIC mismatched projection' }],
      ['V121_TO_V11_PROJECTION_ERROR', dataset => { dataset.sourceRecordsV121[0].contractVersion = 'unsupported' }],
      ['DUPLICATE_CANONICAL_IDENTITY', dataset => { dataset.records.push(clone(dataset.records[0])) }],
      ['DATASET_PROVENANCE_MISMATCH', dataset => { dataset.datasetMode = 'PRODUCTION' }],
    ]
    for (const [code, mutate] of mutations) {
      const dataset = clone(legalDataset); mutate(dataset)
      const before = JSON.stringify(dataset)
      const host = injectedHost({ ok: true, value: freeze(dataset) })
      failed((await host.read.read([identity(base)], T))[0], code)
      equal(JSON.stringify(dataset), before, 'Rejected custom data is not repaired or rewritten')
    }
  })

  await test('legacy source uses explicit unavailable contact/address facts', async () => {
    const dataset = clone(legalDataset)
    dataset.sourceContractVersion = 'institution-contract-v1.1'
    delete dataset.sourceRecordsV121
    const snapshot = ready((await injectedHost({ ok: true, value: dataset }).read.read([identity(base)], T))[0])
    deep(snapshot.sections.futureV121, {
      officialAddress: { status: 'unavailable', formattedAddress: null, effectiveVerification: 'unverified' },
      officialContact: { status: 'unavailable', directory: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' }, phones: [] },
    })
    equal(snapshot.sections.price.referenceMonthlyPrice.effectiveVerification, 'current_verified')
  })

  await test('provider failure and resolver throw remain retryable without cached errors', async () => {
    let providerFails = true
    const providerHost = realHost(() => { if (providerFails) throw new Error('Synthetic provider failure'); return legalCatalog })
    const errors = await providerHost.read.read([identity(base), identity(second)], T)
    errors.forEach(result => failed(result, 'PROVIDER_LOAD_FAILED'))
    providerFails = false
    const recovered = await providerHost.read.read([identity(base)], T)
    ready(recovered[0]); equal(providerHost.counts.providerLoads, 2)
    let throws = true
    const host = injectedHost(() => { if (throws) throw new Error('Synthetic resolver exception'); return { ok: true, value: legalDataset } })
    failed((await host.read.read([identity(base)], T))[0], 'PROVIDER_LOAD_FAILED')
    throws = false; ready((await host.read.read([identity(base)], T))[0]); equal(host.counts.loads, 2)
    const dataError = injectedHost({ ok: false, error: { code: 'INVALID_CATALOG_ENVELOPE' } })
    failed((await dataError.read.read([identity(base)], T))[0], 'INVALID_CATALOG_ENVELOPE')
  })

  await test('current revision change rejects the old identity without rewriting an earlier result', async () => {
    let current = catalogFor([base])
    const host = realHost(() => current)
    const earlier = ready((await host.read.read([identity(base)], T))[0]), frozenEarlier = JSON.stringify(earlier)
    const newer = reidentify(base, base.institutionId, base.recordRevision + 1)
    current = catalogFor([newer], { datasetVersion: 'directory-new-current-revision' })
    const results = await host.read.read([identity(base), identity(newer)], T)
    failed(results[0], 'INSTITUTION_REVISION_NOT_FOUND')
    equal(ready(results[1]).identity.recordRevision, newer.recordRevision)
    equal(JSON.stringify(earlier), frozenEarlier)
    equal(host.counts.providerLoads, 2)
  })

  await test('lightweight facts equal independent full Detail across five states and time expiry', async () => {
    for (const state of ['ready', 'unknown', 'unavailable', 'unverified', 'expired']) {
      const record = stateRecord(state), catalog = freeze(catalogFor([record]))
      const light = ready((await realHost(catalog).read.read([identity(record)], T))[0])
      const full = await fullDetailOracle(catalog, identity(record), T)
      deep(light.sections.price, full.sections.price, state + ': price projection parity')
      deep(light.sections.futureV121.officialAddress, full.sections.futureV121.officialAddress, state + ': address facts parity')
      deep(light.sections.futureV121.officialContact, full.sections.futureV121.officialContact, state + ': contact facts parity')
      const detailView = createInstitutionDetailPageViewModel(full)
      const address = addressViewModel(light.sections.futureV121.officialAddress)
      deep(address, { addressState: detailView.location.addressState, address: detailView.location.address,
        addressStatus: detailView.location.addressStatus, addressStatusTone: detailView.location.addressStatusTone })
      deep(officialContactViewModel(light.sections.futureV121.officialContact), detailView.officialContact)
      equal(address.addressState, state === 'ready' ? 'ready' : 'address_' + state)
      const contact = light.sections.futureV121.officialContact
      if (state === 'unknown' || state === 'unavailable') equal(contact.status, state)
      else equal(contact.phones[0].status, state === 'ready' ? 'current_verified' : state === 'unverified' ? 'unverified_with_source' : 'expired')
    }
    const record = stateRecord('ready'), catalog = catalogFor([record]), host = realHost(catalog)
    const now = ready((await host.read.read([identity(record)], T))[0])
    const laterTime = '2027-09-13T08:00:00.000Z'
    const later = ready((await host.read.read([identity(record)], laterTime))[0])
    const oracle = await fullDetailOracle(catalog, identity(record), laterTime)
    deep(later.sections.price, oracle.sections.price)
    deep(later.sections.futureV121.officialContact, oracle.sections.futureV121.officialContact)
    equal(now.sections.price.referenceMonthlyPrice.effectiveVerification, 'current_verified')
    equal(later.sections.price.referenceMonthlyPrice.effectiveVerification, 'expired')
    equal(later.sections.futureV121.officialAddress.effectiveVerification, 'expired')
    equal(later.sections.futureV121.officialContact.phones[0].callActionAvailable, false)
    equal(host.counts.providerLoads, 2, 'Explicit later evaluation reads again')
  })

  await test('returned shape excludes full Detail, raw records, evidence and map payloads', async () => {
    const record = stateRecord('ready')
    const snapshot = ready((await realHost(catalogFor([record])).read.read([identity(record)], T))[0])
    deep(Object.keys(snapshot).sort(), ['kind', 'identity', 'datasetVersion', 'datasetMode', 'evaluationAsOf',
      'recordStatus', 'recordProvenance', 'source', 'contextKind', 'recommendationContext', 'sections'].sort())
    deep(Object.keys(snapshot.sections).sort(), ['futureV121', 'price'])
    deep(Object.keys(snapshot.sections.futureV121).sort(), ['officialAddress', 'officialContact'])
    const forbidden = new Set(['evidence', 'evidenceIds', 'sourceReference', 'sourceRecordsV121', 'currentPointersV121',
      'capabilities', 'careProcess', 'rooms', 'media', 'vr', 'staffing', 'medicalSupport', 'qualifications', 'mapLocation', 'rawRecord'])
    const keys = []
    const collect = value => {
      if (!value || typeof value !== 'object') return
      for (const key of Object.keys(value)) { keys.push(key); collect(value[key]) }
    }
    collect(snapshot)
    deep(keys.filter(key => forbidden.has(key)), [])
    equal(snapshot.source, 'direct')
    equal(snapshot.contextKind, 'DIRECT_CURRENT')
    equal(snapshot.recommendationContext, null)
    equal(forbiddenEffects, 0, 'Factory and every read must avoid wx, storage, network and authentication')
  })
}

fs.mkdirSync(output, { recursive: true })
try {
  await main()
  fs.writeFileSync(path.join(output, 'source-read-results.json'), JSON.stringify({ kind: 'SOURCE_ONLY_DIRECTORY_READ_BOUNDARY',
    policy: 'SYNTHETIC_TEST_ONLY', parser: ts.version, assertions, groups, status: 'PASS', realEffects: forbiddenEffects }, null, 2) + '\n')
  console.log(`INSTITUTION_DIRECTORY_READ: ${groups.length} groups / ${assertions} assertions PASS; TypeScript ${ts.version}; source-only, no device or persistence claim`)
} catch (error) {
  fs.writeFileSync(path.join(output, 'source-read-results.json'), JSON.stringify({ kind: 'SOURCE_ONLY_DIRECTORY_READ_BOUNDARY',
    policy: 'SYNTHETIC_TEST_ONLY', parser: ts.version, assertions, groups, status: 'FAIL', message: String(error.message).slice(0, 500) }, null, 2) + '\n')
  throw error
}
