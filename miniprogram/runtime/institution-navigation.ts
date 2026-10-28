import type { InstitutionDetailRoute } from '../services/institution-detail-route'
export const detailPreview = (_route: InstitutionDetailRoute) => ({ detailPreviewUrl: '', hideLocation: false })
export const consultationDestination = (_route: InstitutionDetailRoute | undefined): string => '/pages/consultant/consultation'
export const appointmentDestination = (route: InstitutionDetailRoute): string =>
  `/pages/appointment/create?institutionId=${encodeURIComponent(route.identity.institutionId)}&recordRevision=${String(route.identity.recordRevision)}`
