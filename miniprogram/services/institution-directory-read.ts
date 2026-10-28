import { isValidIsoTimestamp } from '../domain/institution/primitives'
import { projectInstitutionPrice } from '../domain/institution/presentation-facts'
import { projectOfficialContact, projectOfficialAddress, projectMap } from '../domain/institution/v1-2-1/contact-location-projection'
import { institutionValidationOptions } from '../runtime/institution-validation'
import { resolveExactCurrentInstitutionRecord } from './institution-record-resolver'
import type { InstitutionCurrentCatalogResolver, InstitutionCurrentCatalogResult } from './institution-record-resolver'
import { sourceV121ForDataset } from './institution-current-source'
import { institutionCurrentCatalogResolver } from './institution-current-catalog'
import type { InstitutionDirectoryContactFacts, InstitutionDirectoryReadResult, InstitutionDirectoryReadService } from '../types/institution-directory-read'

const failed = (code: string): InstitutionDirectoryReadResult => ({ ok: false, error: { code } })

export const createInstitutionDirectoryReadService = (
  resolver: InstitutionCurrentCatalogResolver,
): InstitutionDirectoryReadService => ({
  read: async (identities, evaluationAsOf) => {
    if (identities.length === 0) return []
    if (!isValidIsoTimestamp(evaluationAsOf)) return identities.map(() => failed('INVALID_EVALUATION_AS_OF'))
    let loaded: InstitutionCurrentCatalogResult
    try { loaded = await resolver.loadCurrentCatalog() }
    catch (_) { return identities.map(() => failed('PROVIDER_LOAD_FAILED')) }
    if (!loaded.ok) {
      const code = loaded.error.code
      return identities.map(() => failed(code))
    }
    // This batch owns one validated catalog. It is not retained after this call.
    const dataset = loaded.value
    return identities.map((identity): InstitutionDirectoryReadResult => {
      const resolved = resolveExactCurrentInstitutionRecord(dataset.records, identity)
      if (!resolved.ok) return failed(resolved.error.code)
      const record = resolved.value
      if (record.recordStatus !== 'published') return failed('INSTITUTION_RECORD_NOT_DISPLAYABLE')
      if (record.recordProvenance !== (dataset.datasetMode === 'PRODUCTION' ? 'PRODUCTION_CANDIDATE' : 'MOCK_DEVELOPMENT_ONLY')) return failed('DATASET_PROVENANCE_MISMATCH')
      const source = sourceV121ForDataset(dataset, identity)
      if (!source.ok && source.error.code !== 'LEGACY_DATASET_WITHOUT_V121_SOURCE') return failed(source.error.code)
      try {
        let facts: InstitutionDirectoryContactFacts
        if (source.ok) {
          const map = projectMap(source.value, evaluationAsOf, institutionValidationOptions)
          facts = {
            officialAddress: projectOfficialAddress(source.value, evaluationAsOf, map.formattedAddress),
            officialContact: projectOfficialContact(source.value, evaluationAsOf),
          }
        } else {
          // Same explicit unavailable facts as a legacy Detail; never infer an address/phone.
          facts = {
            officialAddress: { status: 'unavailable', formattedAddress: null, effectiveVerification: 'unverified' },
            officialContact: { status: 'unavailable', directory: { availability: 'unavailable', value: null, effectiveVerification: 'unverified' }, phones: [] },
          }
        }
        return { ok: true, value: {
          kind: 'institution_directory_read_snapshot_v1',
          identity: { institutionId: record.institutionId, recordRevision: record.recordRevision },
          datasetVersion: dataset.datasetVersion, datasetMode: dataset.datasetMode, evaluationAsOf,
          recordStatus: record.recordStatus, recordProvenance: record.recordProvenance,
          source: 'direct', contextKind: 'DIRECT_CURRENT', recommendationContext: null,
          sections: { price: projectInstitutionPrice(record, evaluationAsOf), futureV121: facts },
        } }
      } catch (_) { return failed('DIRECTORY_PROJECTION_FAILED') }
    })
  },
})

export const institutionDirectoryReadService = createInstitutionDirectoryReadService(institutionCurrentCatalogResolver)
