/**
 * FROZEN_PHASE_V1_2_A1_1C
 *
 * Institution V1.2.1 adds official contact and public location facts. Public
 * introduction content intentionally remains a separate versioned aggregate.
 */
import type {
  InstitutionEvidenceBase,
  InstitutionEvidenceSourceLocator,
  InstitutionEvidenceValueSnapshot,
  InstitutionField,
} from './institution'
import type { InstitutionRecordV12 } from './institution-v1-2'

export type InstitutionContractVersionV121 = 'institution-contract-v1.2.1'
export type InstitutionOfficialContactSchemaVersionV1 = 'institution-official-contact-v1'
export type InstitutionPublicLocationSchemaVersionV1 = 'institution-public-location-v1'

export type InstitutionOfficialPhonePurposeCode =
  | 'main'
  | 'admission_consultation'
  | 'service'
  | 'other'

export type InstitutionOfficialPhoneNumberV1 =
  | {
      kind: 'mainland_mobile'
      countryCallingCode: '+86'
      nationalNumber: string
      extension: null
    }
  | {
      kind: 'mainland_landline'
      countryCallingCode: '+86'
      areaCode: string
      subscriberNumber: string
      extension: string | null
    }

export interface InstitutionOfficialPhoneValueV1 {
  purpose: InstitutionOfficialPhonePurposeCode
  otherPurposeNote: string | null
  number: InstitutionOfficialPhoneNumberV1
}

export interface InstitutionOfficialPhoneV1 {
  officialPhoneKey: string
  phone: InstitutionField<InstitutionOfficialPhoneValueV1>
}

export type InstitutionOfficialPhoneDirectoryPresenceCode = 'present' | 'absent'

export interface InstitutionOfficialContactV1 {
  schemaVersion: InstitutionOfficialContactSchemaVersionV1
  phoneDirectoryPresence: InstitutionField<InstitutionOfficialPhoneDirectoryPresenceCode>
  officialPhones: readonly InstitutionOfficialPhoneV1[]
}

export interface InstitutionAdministrativeAreaV1 {
  code: string
  displayName: string
}

export interface InstitutionAddressV1 {
  countryCode: 'CN'
  province: InstitutionAdministrativeAreaV1
  city: InstitutionAdministrativeAreaV1
  district: InstitutionAdministrativeAreaV1
  addressLine: string
  postalCode: string | null
}

export type InstitutionMapReadyCoordinateSystemV1 = 'gcj02'

export interface InstitutionGeoLocationV1 {
  latitude: number
  longitude: number
  coordinateSystem: InstitutionMapReadyCoordinateSystemV1
}

export interface InstitutionPublicLocationV1 {
  schemaVersion: InstitutionPublicLocationSchemaVersionV1
  address: InstitutionField<InstitutionAddressV1>
  geo: InstitutionField<InstitutionGeoLocationV1>
}

export type InstitutionEvidenceValueSnapshotV121 =
  | InstitutionEvidenceValueSnapshot
  | { valueType: 'official_phone'; value: InstitutionOfficialPhoneValueV1 }
  | { valueType: 'structured_address'; value: InstitutionAddressV1 }
  | { valueType: 'geo_location'; value: InstitutionGeoLocationV1 }

export interface InstitutionEvidenceBaseV121 extends Omit<
  InstitutionEvidenceBase,
  'valueSnapshot'
> {
  valueSnapshot: InstitutionEvidenceValueSnapshotV121
}

export type InstitutionEvidenceV121 = InstitutionEvidenceBaseV121
  & InstitutionEvidenceSourceLocator
  & (
    | {
        verificationStatus: 'unverified'
        verifiedAt?: never
        validUntil?: never
      }
    | {
        verificationStatus: 'verified'
        verifiedAt: string
        validUntil?: string
      }
    | {
        verificationStatus: 'expired'
        verifiedAt: string
        validUntil: string
      }
  )

export interface InstitutionRecordV121 extends Omit<
  InstitutionRecordV12,
  'contractVersion' | 'evidence'
> {
  contractVersion: InstitutionContractVersionV121
  officialContact: InstitutionOfficialContactV1
  publicLocation: InstitutionPublicLocationV1
  evidence: readonly InstitutionEvidenceV121[]
}

export type InstitutionPublicContentSourceTypeV1 =
  | 'institution_supplied'
  | 'platform_edited'

export type InstitutionPublicContentPublicationStatusV1 =
  | 'draft'
  | 'published'
  | 'archived'

export type InstitutionPublicIntroductionV1 =
  | {
      availability: 'provided'
      text: string
      sourceType: InstitutionPublicContentSourceTypeV1
    }
  | {
      availability: 'unknown' | 'unavailable'
      text: null
      sourceType: null
    }

export interface InstitutionPublicContentV1 {
  schemaVersion: 'institution-public-content-v1'
  institutionId: string
  contentRevision: number
  publicationStatus: InstitutionPublicContentPublicationStatusV1
  introduction: InstitutionPublicIntroductionV1
  updatedAt: string
}
