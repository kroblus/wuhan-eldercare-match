import { storyDestination, storyInstitutionId } from '../demo/story'
import type { InstitutionDetailRoute } from '../services/institution-detail-route'
export const detailPreview = (route: InstitutionDetailRoute) => ({
  detailPreviewUrl: storyDestination(route, '/pages/institution/detail'),
  hideLocation: route.identity.institutionId === storyInstitutionId && route.identity.recordRevision === 1,
})
export const consultationDestination = (route: InstitutionDetailRoute | undefined): string => storyDestination(route, '/pages/consultant/consultation')
export const appointmentDestination = (route: InstitutionDetailRoute): string => storyDestination(route, '/pages/appointment/create')
