/**
 * FROZEN_PHASE_4A_2
 *
 * Production Institution V1 shape. Runtime validation lives in
 * `domain/institution`; this type module remains free of Page, Service,
 * Recommendation, backend, persistence, and `wx.*` dependencies.
 */

export type InstitutionContractVersion = 'institution-contract-v1'
export type InstitutionCapabilityContractVersion = 'institution-capability-contract-v1'

export type InstitutionRecordProvenance =
  | 'MOCK_DEVELOPMENT_ONLY'
  | 'PRODUCTION_CANDIDATE'

export type InstitutionRecordStatus = 'draft' | 'published' | 'suspended' | 'archived'

export type InstitutionFieldUsageClass =
  | 'MATCHING_CRITICAL'
  | 'DISPLAY_SUPPORTING'
  | 'OPERATIONAL_DYNAMIC'
  | 'AUDIT_ONLY'

export type InstitutionFieldAvailability = 'provided' | 'unknown' | 'unavailable'

export type InstitutionVerificationStatus = 'unverified' | 'verified' | 'expired'

export type InstitutionEvidenceSourceType =
  | 'institution_provided'
  | 'platform_manual_verification'
  | 'official_document'
  | 'contract_material'
  | 'on_site_verification'

export type NonEmptyEvidenceIds = readonly [string, ...string[]]
export type NonEmptyStableCodeList = readonly [string, ...string[]]

/**
 * Typed evidence value. V1 deliberately does not require RFC 8785/JCS.
 * The discriminator prevents UI text from standing in for structured values.
 */
export type InstitutionEvidenceValueSnapshot =
  | { valueType: 'stable_code'; value: string }
  | { valueType: 'stable_code_list'; value: NonEmptyStableCodeList }
  | { valueType: 'text'; value: string }
  | { valueType: 'integer'; value: number }
  | { valueType: 'boolean'; value: boolean }
  | { valueType: 'iso_date'; value: string }
  | { valueType: 'iso_timestamp'; value: string }
  | { valueType: 'numeric_range'; value: NumericRange }
  | { valueType: 'money_range'; value: MoneyRange }
  | { valueType: 'reference_monthly_price'; value: ReferenceMonthlyPrice }
  | { valueType: 'coordinates'; value: GeoCoordinates }
  | { valueType: 'partner_hospital_list'; value: readonly PartnerHospitalReference[] }
  | { valueType: 'staff_count_list'; value: readonly InstitutionStaffCount[] }
  | { valueType: 'caregiver_resident_ratio'; value: CaregiverResidentRatio }
  | { valueType: 'price_adjustment_factor_list'; value: readonly InstitutionPriceAdjustmentFactor[] }
  | { valueType: 'estimated_wait_range'; value: EstimatedWaitRange }

export interface UnverifiedInstitutionFieldVerification {
  status: 'unverified'
  evidenceIds: readonly string[]
}

export interface VerifiedInstitutionFieldVerification {
  status: 'verified'
  evidenceIds: NonEmptyEvidenceIds
  verifiedAt: string
  validUntil?: string
}

export interface ExpiredInstitutionFieldVerification {
  status: 'expired'
  evidenceIds: NonEmptyEvidenceIds
  verifiedAt: string
  validUntil: string
}

export type InstitutionFieldVerification =
  | UnverifiedInstitutionFieldVerification
  | VerifiedInstitutionFieldVerification
  | ExpiredInstitutionFieldVerification

export type InstitutionField<T> =
  | {
    availability: 'provided'
    value: T
    asOf?: string
    verification: InstitutionFieldVerification
  }
  | {
    availability: 'unknown' | 'unavailable'
    value: null
    asOf?: string
    verification: InstitutionFieldVerification
  }

export interface InstitutionEvidenceBase {
  evidenceId: string
  institutionId: string
  recordRevision: number
  fieldPath: string
  valueSnapshot: InstitutionEvidenceValueSnapshot
  observedAt?: string
  sourceType: InstitutionEvidenceSourceType
}

export type InstitutionEvidenceSourceLocator =
  | {
    sourceReference: string
    sourceNote?: string
  }
  | {
    sourceReference?: string
    sourceNote: string
  }

export type InstitutionEvidence = InstitutionEvidenceBase & InstitutionEvidenceSourceLocator & (
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

export type InstitutionCapabilityStatus =
  | 'supported'
  | 'requires_assessment'
  | 'unsupported'
  | 'unknown'

/** Output code after the field-level verification gate. */
export type InstitutionEffectiveCapabilityStatus =
  | 'supported'
  | 'requires_assessment'
  | 'unsupported'
  | 'unknown'

export interface InstitutionCapability<C extends string> {
  code: C
  status: InstitutionCapabilityStatus
  asOf?: string
  verification: InstitutionFieldVerification
}

export type InstitutionCapabilityMatrix<C extends string> = {
  readonly [K in C]: InstitutionCapability<K>
}

export type InstitutionTypeCode =
  | 'active_aging'
  | 'medical_nursing_integrated'
  | 'disability_care'
  | 'dementia_care'
  | 'rehabilitation_care'

export interface InstitutionTypeProfile {
  /** Optional display positioning only; future matching must not consume it. */
  primaryType?: Extract<InstitutionField<InstitutionTypeCode>, { availability: 'provided' }>
  supportedTypes: InstitutionField<readonly InstitutionTypeCode[]>
}

export type InstitutionCareLevelCode =
  | 'independent'
  | 'light_care'
  | 'semi_disabled'
  | 'disabled'
  | 'severely_disabled'

export type InstitutionMobilityCapabilityCode =
  | 'wheelchair_support'
  | 'bedbound_support'
  | 'transfer_support'

export type InstitutionCognitiveCapabilityCode =
  | 'dementia_acceptance'
  | 'wandering_risk_support'

export type InstitutionSpecialCareCapabilityCode =
  | 'round_the_clock_care'
  | 'one_to_one_caregiver'
  | 'night_care'
  | 'dementia_unit'
  | 'rehabilitation_training'
  | 'tube_feeding'
  | 'catheter_care'
  | 'pressure_injury_care'
  | 'incontinence_care'

export type InstitutionDailyCareServiceCode =
  | 'daily_living_support'
  | 'bathing_assistance'
  | 'turning_assistance'
  | 'feeding_assistance'
  | 'toileting_assistance'
  | 'night_rounds'
  | 'medical_escort'
  | 'emergency_response'

export interface InstitutionCapabilityProfile {
  careLevelAcceptance: InstitutionCapabilityMatrix<InstitutionCareLevelCode>
  mobilitySupport: InstitutionCapabilityMatrix<InstitutionMobilityCapabilityCode>
  cognitiveSupport: InstitutionCapabilityMatrix<InstitutionCognitiveCapabilityCode>
  specialCare: InstitutionCapabilityMatrix<InstitutionSpecialCareCapabilityCode>
}

export type InstitutionServiceAvailability =
  | 'available'
  | 'requires_assessment'
  | 'unavailable'
  | 'unknown'

export type InstitutionServicePriceTreatment = 'included' | 'additional_fee' | 'unknown'

export interface InstitutionServiceOffering {
  serviceId: string
  code: InstitutionDailyCareServiceCode
  name: InstitutionField<string>
  availability: InstitutionServiceAvailability
  priceTreatment: InstitutionServicePriceTreatment
  scheduleNote: InstitutionField<string>
  description: InstitutionField<string>
  asOf?: string
  verification: InstitutionFieldVerification
}

export type InstitutionPresenceStatus = 'present' | 'absent'

export interface PartnerHospitalReference {
  name: string
  relationshipNote?: string
}

export interface InstitutionMedicalSupport {
  doctorRounds: InstitutionField<InstitutionPresenceStatus>
  nurseStaff: InstitutionField<InstitutionPresenceStatus>
  nurseStation: InstitutionField<InstitutionPresenceStatus>
  partnerHospitals: InstitutionField<readonly PartnerHospitalReference[]>
  emergencyTransferSupport: InstitutionCapability<'emergency_transfer_support'>
}

export type InstitutionRehabilitationFeatureCode =
  | 'rehabilitation_therapist'
  | 'rehabilitation_room'
  | 'postoperative_rehabilitation'
  | 'limb_function_training'
  | 'cognitive_training'

export interface InstitutionRehabilitationSupport {
  features: InstitutionCapabilityMatrix<InstitutionRehabilitationFeatureCode>
}

export type InstitutionStaffRoleCode =
  | 'doctor'
  | 'nurse'
  | 'caregiver'
  | 'rehabilitation_therapist'
  | 'nutritionist'
  | 'social_worker'

export interface InstitutionStaffCount {
  role: InstitutionStaffRoleCode
  count: number
}

export interface CaregiverResidentRatio {
  caregiverCount: number
  residentCount: number
}

export interface InstitutionStaffing {
  counts: InstitutionField<readonly InstitutionStaffCount[]>
  caregiverResidentRatio: InstitutionField<CaregiverResidentRatio>
}

export type CurrencyCode = 'CNY'
export type PricePeriod = 'month' | 'one_time'

export interface MoneyAmount {
  amountMinor: number
  currency: CurrencyCode
}

export interface BoundedMoneyRange<P extends PricePeriod = PricePeriod> {
  kind: 'bounded'
  min: MoneyAmount
  max: MoneyAmount
  period: P
}

export interface StartingAtMoneyRange<P extends PricePeriod = PricePeriod> {
  kind: 'starting_at'
  min: MoneyAmount
  max: null
  period: P
}

export type MoneyRange<P extends PricePeriod = PricePeriod> =
  | BoundedMoneyRange<P>
  | StartingAtMoneyRange<P>

export interface ReferenceMonthlyPrice {
  range: MoneyRange<'month'>
  basis: 'reference_total'
}

export type InstitutionRecurringPriceComponentCode =
  | 'bed_fee'
  | 'care_fee'
  | 'meal_fee'
  | 'management_fee'
  | 'special_care_fee'
  | 'other_fee'

export interface InstitutionRecurringPriceComponent {
  component: InstitutionRecurringPriceComponentCode
  referenceAmount: InstitutionField<MoneyRange<'month'>>
}

export interface InstitutionOneTimeFee {
  feeId: string
  label: string
  referenceAmount: InstitutionField<MoneyRange<'one_time'>>
}

export type InstitutionPriceAdjustmentFactorCode = 'care_level' | 'room_type' | 'special_care'

export interface InstitutionPriceAdjustmentFactor {
  factor: InstitutionPriceAdjustmentFactorCode
  note?: string
}

export interface InstitutionPriceProfile {
  referenceMonthlyPrice: InstitutionField<ReferenceMonthlyPrice>
  recurringComponents: readonly InstitutionRecurringPriceComponent[]
  deposit: InstitutionField<MoneyRange<'one_time'>>
  oneTimeFees: readonly InstitutionOneTimeFee[]
  adjustmentFactors: InstitutionField<readonly InstitutionPriceAdjustmentFactor[]>
  priceNote: InstitutionField<string>
}

export type InstitutionAvailabilityStatus =
  | 'available'
  | 'limited'
  | 'unavailable'
  | 'inquiry_required'
  | 'unknown'

export type InstitutionAvailabilityFact =
  | {
    status: 'unknown'
    asOf?: string
    verification: InstitutionFieldVerification
  }
  | {
    status: Exclude<InstitutionAvailabilityStatus, 'unknown'>
    asOf: string
    verification: InstitutionFieldVerification
  }

export type AcceptingNewResidentsStatus = 'yes' | 'no' | 'inquiry_required' | 'unknown'

export interface EstimatedWaitRange {
  minDays: number
  maxDays: number
}

export interface InstitutionOperationalFacts {
  bedAvailability: InstitutionAvailabilityFact
  acceptingNewResidents?: InstitutionField<AcceptingNewResidentsStatus>
  estimatedWait?: InstitutionField<EstimatedWaitRange>
  earliestMoveInDate?: InstitutionField<string>
}

export interface GeoCoordinates {
  latitude: number
  longitude: number
}

export interface InstitutionIdentityFacts {
  name: InstitutionField<string>
  regionCode: InstitutionField<string>
  regionDisplayName: InstitutionField<string>
  address: InstitutionField<string>
  coordinates: InstitutionField<GeoCoordinates>
  establishedDate: InstitutionField<string>
  bedCapacity: InstitutionField<number>
  publicContact: InstitutionField<string>
  coverMediaId: InstitutionField<string>
}

export type InstitutionRoomTypeCode = 'single' | 'double' | 'multi_bed' | 'suite' | 'other'
export type InstitutionBedTypeCode = 'standard_bed' | 'nursing_bed' | 'medical_bed' | 'other'

export interface NumericRange {
  min: number
  max: number
}

export interface InstitutionRoomFeatures {
  privateBathroom: InstitutionField<InstitutionPresenceStatus>
  airConditioner: InstitutionField<InstitutionPresenceStatus>
  wardrobe: InstitutionField<InstitutionPresenceStatus>
  television: InstitutionField<InstitutionPresenceStatus>
  callSystem: InstitutionField<InstitutionPresenceStatus>
  balcony: InstitutionField<InstitutionPresenceStatus>
  accessibility: InstitutionField<InstitutionPresenceStatus>
}

export interface InstitutionRoom {
  roomId: string
  name: InstitutionField<string>
  roomType: InstitutionField<InstitutionRoomTypeCode>
  areaSquareMeters: InstitutionField<NumericRange>
  bedType: InstitutionField<InstitutionBedTypeCode>
  features: InstitutionRoomFeatures
  referencePrice: InstitutionField<MoneyRange<'month'>>
  mediaIds: readonly string[]
}

export type InstitutionMediaCategory =
  | 'exterior'
  | 'lobby'
  | 'room'
  | 'restaurant'
  | 'bathroom'
  | 'rehabilitation'
  | 'activity'
  | 'outdoor'

export interface InstitutionMedia {
  mediaId: string
  category: InstitutionMediaCategory
  role: 'cover' | 'gallery'
  sortOrder: InstitutionField<number>
  url: InstitutionField<string>
  caption: InstitutionField<string>
  capturedAt: InstitutionField<string>
}

export type InstitutionVrSceneCode =
  | 'exterior'
  | 'lobby'
  | 'room'
  | 'bathroom'
  | 'restaurant'
  | 'rehabilitation'
  | 'activity'
  | 'garden'

export interface InstitutionVrScene {
  sceneId: string
  sceneCode: InstitutionVrSceneCode
  name: InstitutionField<string>
  url: InstitutionField<string>
  coverMediaId: InstitutionField<string>
}

export type InstitutionVr =
  | {
    status: 'available'
    url: InstitutionField<string>
    coverMediaId: InstitutionField<string>
    scenes: readonly [InstitutionVrScene, ...InstitutionVrScene[]]
    verification: InstitutionFieldVerification
  }
  | {
    status: 'unavailable' | 'unknown'
    url: null
    coverMediaId: null
    scenes: readonly []
    verification: InstitutionFieldVerification
  }

export type InstitutionQualificationTypeCode =
  | 'business_license'
  | 'civil_affairs_filing'
  | 'eldercare_institution_rating'
  | 'medical_insurance_qualification'
  | 'medical_qualification'
  | 'other_certification'

export type InstitutionQualificationValidity = 'valid' | 'expired' | 'unknown'

export interface InstitutionQualification {
  qualificationId: string
  type: InstitutionQualificationTypeCode
  certificateName: InstitutionField<string>
  documentUrl: InstitutionField<string>
  validity: InstitutionQualificationValidity
  validFrom: InstitutionField<string>
  validUntil: InstitutionField<string>
  verification: InstitutionFieldVerification
}

export interface InstitutionRecord {
  contractVersion: InstitutionContractVersion
  capabilityContractVersion: InstitutionCapabilityContractVersion
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecordProvenance
  recordStatus: InstitutionRecordStatus
  identity: InstitutionIdentityFacts
  typeProfile: InstitutionTypeProfile
  capabilities: InstitutionCapabilityProfile
  services: readonly InstitutionServiceOffering[]
  medicalSupport: InstitutionMedicalSupport
  rehabilitationSupport: InstitutionRehabilitationSupport
  staffing: InstitutionStaffing
  price: InstitutionPriceProfile
  operations: InstitutionOperationalFacts
  rooms: readonly InstitutionRoom[]
  media: readonly InstitutionMedia[]
  vr: InstitutionVr
  qualifications: readonly InstitutionQualification[]
  evidence: readonly InstitutionEvidence[]
}

export type InstitutionMatchingCriticalFieldPath =
  | 'identity.regionCode'
  | 'typeProfile.supportedTypes'
  | 'capabilities.careLevelAcceptance.independent'
  | 'capabilities.careLevelAcceptance.light_care'
  | 'capabilities.careLevelAcceptance.semi_disabled'
  | 'capabilities.careLevelAcceptance.disabled'
  | 'capabilities.careLevelAcceptance.severely_disabled'
  | 'capabilities.mobilitySupport.wheelchair_support'
  | 'capabilities.mobilitySupport.bedbound_support'
  | 'capabilities.mobilitySupport.transfer_support'
  | 'capabilities.cognitiveSupport.dementia_acceptance'
  | 'capabilities.cognitiveSupport.wandering_risk_support'
  | 'capabilities.specialCare.round_the_clock_care'
  | 'capabilities.specialCare.one_to_one_caregiver'
  | 'capabilities.specialCare.night_care'
  | 'capabilities.specialCare.dementia_unit'
  | 'capabilities.specialCare.rehabilitation_training'
  | 'capabilities.specialCare.tube_feeding'
  | 'capabilities.specialCare.catheter_care'
  | 'capabilities.specialCare.pressure_injury_care'
  | 'capabilities.specialCare.incontinence_care'
  | 'price.referenceMonthlyPrice'
