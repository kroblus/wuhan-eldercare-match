import type {
  InstitutionOfficialPhonePurposeCode,
  InstitutionPublicContentPublicationStatusV1,
  InstitutionPublicContentSourceTypeV1,
} from '../../../types/institution-v1-2-1'

export const INSTITUTION_CONTRACT_VERSION_V121 = 'institution-contract-v1.2.1' as const
export const INSTITUTION_OFFICIAL_CONTACT_SCHEMA_VERSION_V1 = 'institution-official-contact-v1' as const
export const INSTITUTION_PUBLIC_LOCATION_SCHEMA_VERSION_V1 = 'institution-public-location-v1' as const
export const INSTITUTION_PUBLIC_CONTENT_SCHEMA_VERSION_V1 = 'institution-public-content-v1' as const
export const MAP_READY_COORDINATE_SYSTEM = 'gcj02' as const

export const OFFICIAL_PHONE_PURPOSE_CODES: readonly InstitutionOfficialPhonePurposeCode[] = [
  'main',
  'admission_consultation',
  'service',
  'other',
]

export const OFFICIAL_PHONE_DIRECTORY_PRESENCE_CODES = ['present', 'absent'] as const

export const PUBLIC_CONTENT_SOURCE_TYPES: readonly InstitutionPublicContentSourceTypeV1[] = [
  'institution_supplied',
  'platform_edited',
]

export const PUBLIC_CONTENT_PUBLICATION_STATUSES: readonly InstitutionPublicContentPublicationStatusV1[] = [
  'draft',
  'published',
  'archived',
]

export const isV121ExtensionEvidencePath = (fieldPath: string): boolean =>
  fieldPath.indexOf('officialContact.') === 0
  || fieldPath.indexOf('publicLocation.') === 0

export const isAnyPostV11EvidencePath = (fieldPath: string): boolean =>
  fieldPath.indexOf('careProcess.') === 0
  || isV121ExtensionEvidencePath(fieldPath)

export const officialPhoneFieldPath = (officialPhoneKey: string): string =>
  `officialContact.officialPhones.${officialPhoneKey}.phone`
