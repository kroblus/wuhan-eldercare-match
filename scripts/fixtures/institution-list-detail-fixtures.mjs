/**
 * V1.2-A0-2 Institution List / Detail runtime fixtures.
 *
 * This file is test-only.  Every record is synthetic and deliberately carries
 * all three disclosure labels used by the gate.  It must never be imported by
 * miniprogram application code.
 */

import {
  cloneInstitutionV11Record,
  validInstitutionV11Fixtures,
} from './institution-v1-1-fixtures.mjs'

export const INSTITUTION_LIST_DETAIL_FIXTURE_POLICY = 'TEST_FIXTURE_ONLY'
export const INSTITUTION_LIST_DETAIL_DATA_PROVENANCE = 'MOCK_DEVELOPMENT_ONLY'
export const INSTITUTION_LIST_DETAIL_DATA_LABEL = 'NOT_REAL_INSTITUTION_DATA'
export const INSTITUTION_LIST_DETAIL_SYNTHETIC_VERIFICATION = 'TEST_SYNTHETIC_VERIFICATION'
export const INSTITUTION_LIST_DETAIL_EVALUATION_AS_OF = '2026-09-01T09:00:00.000Z'
export const INSTITUTION_LIST_DETAIL_DATASET_VERSION = 'institution-catalog-v1.2-test-20260901'
export const INSTITUTION_LIST_DETAIL_HISTORY_DATASET_VERSION = 'institution-history-v1.2-test-20260901'

const clone = (record) => cloneInstitutionV11Record(record)

const currentRecords = validInstitutionV11Fixtures.slice(0, 8).map((fixture) => clone(fixture.record))

// Keep the fixture pool close to the product's current development catalog,
// while remaining synthetic and independent from the app's mock provider.
export const INSTITUTION_LIST_DETAIL_CURRENT_RECORDS = Object.freeze(currentRecords)

export const makeCurrentCatalogPayload = (
  records = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS,
  datasetVersion = INSTITUTION_LIST_DETAIL_DATASET_VERSION,
) => ({
  datasetVersion,
  datasetMode: 'MOCK_DEVELOPMENT_ONLY',
  records: records.map((record) => clone(record)),
})

const updateNestedRevision = (record, revision) => {
  record.recordRevision = revision
  record.evidence = record.evidence.map((evidence) => ({ ...evidence, recordRevision: revision }))
  return record
}

/**
 * Synthetic historical records are intentionally kept only in this fixture
 * module.  They are not part of the app's current eight-record catalog.
 */
export const makeHistoricalFixture = (
  sourceRecord = INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0],
  recordRevision = 2,
  recordStatus = 'archived',
) => {
  const record = updateNestedRevision(clone(sourceRecord), recordRevision)
  record.recordStatus = recordStatus
  record.recordProvenance = INSTITUTION_LIST_DETAIL_DATA_PROVENANCE
  record.identity.name = {
    ...record.identity.name,
    value: `${record.identity.name.value} 历史修订（Mock）`,
  }
  return record
}

export const INSTITUTION_LIST_DETAIL_HISTORICAL_RECORD = makeHistoricalFixture()

export const INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS = Object.freeze([
  makeHistoricalFixture(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0], 2, 'published'),
  makeHistoricalFixture(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0], 3, 'suspended'),
  makeHistoricalFixture(INSTITUTION_LIST_DETAIL_CURRENT_RECORDS[0], 4, 'archived'),
])

export const INSTITUTION_LIST_DETAIL_FIXTURE_MANIFEST = Object.freeze({
  fixturePolicy: INSTITUTION_LIST_DETAIL_FIXTURE_POLICY,
  dataProvenance: INSTITUTION_LIST_DETAIL_DATA_PROVENANCE,
  dataLabel: INSTITUTION_LIST_DETAIL_DATA_LABEL,
  syntheticVerification: INSTITUTION_LIST_DETAIL_SYNTHETIC_VERIFICATION,
  currentRecordCount: INSTITUTION_LIST_DETAIL_CURRENT_RECORDS.length,
  historicalRecordCount: INSTITUTION_LIST_DETAIL_HISTORICAL_RECORDS.length,
  historicalRecordIsNotCurrent: true,
  vrPolicy: 'vr=null-or-unavailable-or-unknown; no synthetic URL or scene',
  appImportBoundary: 'scripts/fixtures -> test-only; app source import count must remain zero',
})

export const cloneInstitutionListDetailRecord = (record) => clone(record)

export const cloneInstitutionListDetailRecords = (records) => records.map((record) => clone(record))
