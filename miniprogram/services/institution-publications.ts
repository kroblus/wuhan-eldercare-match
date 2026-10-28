import { EXPECTED_RECOMMENDATION_DATASET_MODE } from '../runtime/recommendation-mode'
import { INSTITUTION_PUBLICATION_ORIGIN } from '../runtime/institution-publication-origin'
import { createDefaultWeChatC5BackendTransportV1, resolveC5BackendOriginV1 } from './c5-authenticated-backend-session'
import { validateInstitutionCatalogPayloadV121 } from './institution-catalog-validation-v121'
import type { WeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import type { InstitutionPublicProfile, InstitutionPublications } from '../types/institution-publication'
import { validateInstitutionRecordV121 } from '../domain/institution/v1-2-1/validate-institution-v1-2-1'
import { projectInstitutionRecordV121ToV11 } from '../domain/institution/v1-2-1/project-to-v1-1'
import { institutionValidationOptions } from '../runtime/institution-validation'
import { validateInstitutionCanonicalIdentity } from './institution-record-resolver'
import type { InstitutionCanonicalIdentity } from '../types/institution-list-detail'
import type { InstitutionHistoricalRevisionResult } from './institution-record-resolver'

export const DEVELOPMENT_PUBLICATION_ORIGIN_KEY = '__dev_institution_publication_origin_v1'
export const isPublicationInstitutionId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{1,99}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function readInstitutionPublicProfile(value: unknown): InstitutionPublicProfile {
  const textFields = ['name', 'source', 'room', 'address', 'nature', 'tagNote', 'otherFees', 'priceNote', 'historyNote']
  if (!object(value) || value.schemaVersion !== 'institution-public-profile-v1' || !isPublicationInstitutionId(value.id)
    || textFields.some(key => typeof value[key] !== 'string' || (value[key] as string).length > 4000)
    || !value.name || !value.source || !Array.isArray(value.tags) || value.tags.length > 20
    || value.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 100)
    || !Array.isArray(value.prices) || value.prices.length > 40
    || value.prices.some(row => !object(row) || typeof row.level !== 'string' || !row.level.trim() || row.level.length > 100
      || ['bed', 'care', 'food', 'total'].some(key => !Number.isSafeInteger(row[key]) || Number(row[key]) < 0 || Number(row[key]) > 100000000)
      || row.total !== Number(row.bed) + Number(row.care) + Number(row.food))) throw new Error('INVALID_PUBLIC_PROFILE')
  return {
    schemaVersion: 'institution-public-profile-v1', id: value.id,
    name: value.name as string, source: value.source as string, room: value.room as string,
    address: value.address as string, nature: value.nature as string, tagNote: value.tagNote as string,
    otherFees: value.otherFees as string, priceNote: value.priceNote as string, historyNote: value.historyNote as string,
    tags: (value.tags as string[]).slice(),
    prices: (value.prices as InstitutionPublicProfile['prices']).map(row => ({ level: row.level, bed: row.bed, care: row.care, food: row.food, total: row.total })),
  }
}

export interface InstitutionPublicationTransport extends Pick<WeChatC5BackendTransportV1, 'environment' | 'request'> {
  developmentPublicationOrigin(): unknown
}

export function createInstitutionPublicationClient(transport: InstitutionPublicationTransport, expectedMode: string, releaseOrigin = '') {
  const resolveOrigin = (): string => {
    if (expectedMode !== 'PRODUCTION') return ''
    const development = transport.environment() === 'develop' ? transport.developmentPublicationOrigin() : ''
    const configured = development || releaseOrigin
    if (!configured) return ''
    if (typeof configured !== 'string' || (!development && !configured.startsWith('https://'))) throw new Error('INVALID_PUBLICATION_ORIGIN')
    const origin = resolveC5BackendOriginV1('develop', configured)
    if (!origin) throw new Error('INVALID_PUBLICATION_ORIGIN')
    return origin
  }
  return {
    async resolveExactRevision(identity: InstitutionCanonicalIdentity): Promise<InstitutionHistoricalRevisionResult> {
      if (!validateInstitutionCanonicalIdentity(identity).ok) return { ok: false, error: { code: 'IDENTITY_INVALID' } }
      const origin = resolveOrigin()
      if (!origin) return { ok: false, error: { code: 'HISTORICAL_REVISION_RESOLVER_NOT_CONFIGURED' } }
      const response = await transport.request({
        url: origin + '/api/v1/institution-publications/' + encodeURIComponent(identity.institutionId) + '/revisions/' + identity.recordRevision,
        method: 'GET', timeout: 15000, header: { Accept: 'application/json' },
      })
      if (resolveOrigin() !== origin) return { ok: false, error: { code: 'HISTORICAL_REVISION_PROVIDER_FAILED' } }
      if (response.statusCode === 404) return { ok: false, error: { code: 'INSTITUTION_REVISION_NOT_FOUND' } }
      const data = response.data
      // Recommendation history only accepts the same production authority as the current pool.
      if (response.statusCode !== 200 || !object(data) || data.contractVersion !== 'institution-publications-v1'
        || data.dataEnvironment !== 'PRODUCTION') return { ok: false, error: { code: 'HISTORICAL_REVISION_PROVIDER_FAILED' } }
      if (data.institutionId !== identity.institutionId || data.recordRevision !== identity.recordRevision)
        return { ok: false, error: { code: 'EXACT_IDENTITY_MISMATCH' } }
      const record = validateInstitutionRecordV121(data.record, institutionValidationOptions)
      if (!record.ok || record.value.recordProvenance !== 'PRODUCTION_CANDIDATE')
        return { ok: false, error: { code: 'INVALID_HISTORICAL_INSTITUTION_RECORD' } }
      if (record.value.institutionId !== identity.institutionId || record.value.recordRevision !== identity.recordRevision)
        return { ok: false, error: { code: 'EXACT_IDENTITY_MISMATCH' } }
      const projected = projectInstitutionRecordV121ToV11(record.value, institutionValidationOptions)
      return projected.ok ? projected : { ok: false, error: { code: 'INVALID_HISTORICAL_INSTITUTION_RECORD' } }
    },
    async load(): Promise<InstitutionPublications | null> {
      const origin = resolveOrigin()
      if (!origin) return null
      const response = await transport.request({ url: origin + '/api/v1/institution-publications/catalog', method: 'GET', timeout: 15000, header: { Accept: 'application/json' } })
      if (resolveOrigin() !== origin) throw new Error('PUBLICATION_SOURCE_CHANGED')
      const data = response.data
      if (response.statusCode !== 200 || !object(data) || data.contractVersion !== 'institution-publications-v1'
        || !(data.dataEnvironment === 'PRODUCTION' || data.dataEnvironment === 'SYNTHETIC_TEST_ONLY' && transport.environment() === 'develop')
        || !Array.isArray(data.publicProfiles)) throw new Error('PUBLICATION_LOAD_FAILED')
      const catalog = validateInstitutionCatalogPayloadV121(data.catalog)
      if (!catalog.ok || catalog.value.datasetMode !== 'PRODUCTION') throw new Error('INVALID_PUBLICATION_CATALOG')
      const seen = new Set<string>()
      const publicProfiles = data.publicProfiles.map(value => {
        if (!object(value) || !isPublicationInstitutionId(value.institutionId) || !Number.isSafeInteger(value.recordRevision)
          || Number(value.recordRevision) < 1 || seen.has(value.institutionId)) throw new Error('INVALID_PUBLICATION_PROFILE_LINK')
        const record = catalog.value.records.find(row => row.institutionId === value.institutionId && row.recordRevision === value.recordRevision)
        const profile = readInstitutionPublicProfile(value.profile)
        if (!record || record.recordStatus !== 'published' || profile.id !== record.institutionId
          || record.identity.name.availability !== 'provided' || profile.name !== record.identity.name.value) throw new Error('INVALID_PUBLICATION_PROFILE_LINK')
        seen.add(value.institutionId)
        return { institutionId: value.institutionId, recordRevision: value.recordRevision as number, profile }
      })
      return { contractVersion: 'institution-publications-v1', dataEnvironment: data.dataEnvironment, catalog: catalog.value, publicProfiles }
    },
  }
}

const transport = createDefaultWeChatC5BackendTransportV1()
export const institutionPublicationClient = createInstitutionPublicationClient({
  environment: () => transport.environment(),
  request: input => transport.request(input),
  developmentPublicationOrigin: () => wx.getStorageSync(DEVELOPMENT_PUBLICATION_ORIGIN_KEY),
}, EXPECTED_RECOMMENDATION_DATASET_MODE, INSTITUTION_PUBLICATION_ORIGIN)
