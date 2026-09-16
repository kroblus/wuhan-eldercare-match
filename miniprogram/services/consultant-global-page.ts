import {
  createGlobalConsultantApplicationServiceV1,
} from './consultant-application'
import type {
  GlobalConsultantFoundationProviderV1,
} from './consultant-application'
import type {
  GlobalConsultantPublicApplicationResultV1,
} from '../types/consultant-v1'

/**
 * The production composition currently has no approved platform consultant
 * configuration.  Keeping that fact at the Application boundary gives the
 * page a truthful public-safe result without inventing a consultant, phone,
 * QR media, or Institution context.
 *
 * A future production provider can replace this adapter without changing the
 * page/ViewModel contract. Test-only inputs stay outside the production
 * application graph and are never imported here.
 */
const productionSafeMissingProvider: GlobalConsultantFoundationProviderV1 = {
  dataProvenance: 'PRODUCTION',
  loadGlobalConsultantConfiguration: () => ({
    role: 'platform_primary_consultant',
    sourceState: 'missing',
  }),
  loadConsultantProfile: () => null,
  resolvePublicMedia: () => ({ status: 'unavailable' }),
}

const globalConsultantApplication = createGlobalConsultantApplicationServiceV1(
  productionSafeMissingProvider,
)

export const buildGlobalConsultantPageApplicationV1 = (
  snapshotAsOf: string = new Date().toISOString(),
): GlobalConsultantPublicApplicationResultV1 => globalConsultantApplication.resolveGlobal({
  snapshotAsOf,
})
