import type { InstitutionCatalogPayloadV121 } from './institution-catalog-v1-2-1'

/** Public descriptions are independent of care capability evidence and P1 access grants. */
export interface InstitutionPublicProfile {
  schemaVersion: 'institution-public-profile-v1'
  id: string
  name: string
  source: string
  room: string
  address: string
  nature: string
  tags: string[]
  tagNote: string
  prices: { level: string; bed: number; care: number; food: number; total: number }[]
  otherFees: string
  priceNote: string
  historyNote: string
}
export interface InstitutionPublishedProfile {
  institutionId: string
  recordRevision: number
  profile: InstitutionPublicProfile
}
export interface InstitutionPublications {
  contractVersion: 'institution-publications-v1'
  dataEnvironment: 'PRODUCTION' | 'SYNTHETIC_TEST_ONLY'
  catalog: InstitutionCatalogPayloadV121
  publicProfiles: InstitutionPublishedProfile[]
}
