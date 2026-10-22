import { isHttpsUrl } from '../domain/institution/primitives'
import { isVerificationCurrentAt } from '../domain/institution/verification'
import { buildInstitutionDetailPageSnapshot } from './institution-list-detail-page'
import { institutionCatalogServiceV121 } from './institution-catalog-v1-2-1'
import type { InstitutionDetailRoute } from './institution-detail-route'
import type { InstitutionCatalogServiceV121 } from '../types/institution-catalog-v1-2-1'

// The frozen VR URL is a platform URL, not an attested equirectangular JPEG.
// SphereRenderer remains the shared native panorama renderer for development.
export const createInstitutionVrResourceResolver = (
  catalog: InstitutionCatalogServiceV121,
  buildDetail: typeof buildInstitutionDetailPageSnapshot,
) => async (route: InstitutionDetailRoute): Promise<{ url: string; name: string } | null> => {
  const detail = await buildDetail(route)
  if (!detail.ok || detail.value.contextKind === 'HISTORICAL_READ_ONLY'
    || !detail.value.actions.canOpenVr || !detail.value.sections.media.vr.canNavigate) return null
  const result = await catalog.loadCatalog()
  if (!result.ok || result.value.datasetMode !== 'PRODUCTION') return null
  const record = result.value.records.find(item => item.institutionId === route.identity.institutionId
    && item.recordRevision === route.identity.recordRevision)
  if (!record || record.recordProvenance !== 'PRODUCTION_CANDIDATE'
    || record.recordStatus !== 'published' || record.vr.status !== 'available') return null
  const now = new Date().toISOString()
  const url = record.vr.url
  if (!isVerificationCurrentAt(record.vr.verification, now)
    || url.availability !== 'provided' || !isVerificationCurrentAt(url.verification, now)
    || typeof url.value !== 'string' || !isHttpsUrl(url.value)) return null
  return { url: url.value, name: detail.value.sections.basic.name.value || '机构全景' }
}

export const resolveInstitutionVrResource = createInstitutionVrResourceResolver(
  institutionCatalogServiceV121, buildInstitutionDetailPageSnapshot,
)
