import type {
  InstitutionAvailabilityStatus,
  InstitutionCapabilityStatus,
  InstitutionCareLevelCode,
  InstitutionCognitiveCapabilityCode,
  InstitutionDailyCareServiceCode,
  InstitutionEvidenceSourceType,
  InstitutionMatchingCriticalFieldPath,
  InstitutionMediaCategory,
  InstitutionMobilityCapabilityCode,
  InstitutionPriceAdjustmentFactorCode,
  InstitutionQualificationTypeCode,
  InstitutionRecurringPriceComponentCode,
  InstitutionRehabilitationFeatureCode,
  InstitutionSpecialCareCapabilityCode,
  InstitutionStaffRoleCode,
  InstitutionTypeCode,
  InstitutionVerificationStatus,
  InstitutionVrSceneCode,
} from '../../types/institution'

export const INSTITUTION_CONTRACT_VERSION = 'institution-contract-v1' as const
export const INSTITUTION_CAPABILITY_CONTRACT_VERSION = 'institution-capability-contract-v1' as const

export const INSTITUTION_CAPABILITY_STATUS_CODES: readonly InstitutionCapabilityStatus[] = [
  'supported',
  'requires_assessment',
  'unsupported',
  'unknown',
]

export const INSTITUTION_VERIFICATION_STATUS_CODES: readonly InstitutionVerificationStatus[] = [
  'unverified',
  'verified',
  'expired',
]

export const INSTITUTION_TYPE_CODES: readonly InstitutionTypeCode[] = [
  'active_aging',
  'medical_nursing_integrated',
  'disability_care',
  'dementia_care',
  'rehabilitation_care',
]

export const INSTITUTION_CARE_LEVEL_CODES: readonly InstitutionCareLevelCode[] = [
  'independent',
  'light_care',
  'semi_disabled',
  'disabled',
  'severely_disabled',
]

export const INSTITUTION_MOBILITY_CAPABILITY_CODES: readonly InstitutionMobilityCapabilityCode[] = [
  'wheelchair_support',
  'bedbound_support',
  'transfer_support',
]

export const INSTITUTION_COGNITIVE_CAPABILITY_CODES: readonly InstitutionCognitiveCapabilityCode[] = [
  'dementia_acceptance',
  'wandering_risk_support',
]

export const INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES: readonly InstitutionSpecialCareCapabilityCode[] = [
  'round_the_clock_care',
  'one_to_one_caregiver',
  'night_care',
  'dementia_unit',
  'rehabilitation_training',
  'tube_feeding',
  'catheter_care',
  'pressure_injury_care',
  'incontinence_care',
]

export const INSTITUTION_DAILY_CARE_SERVICE_CODES: readonly InstitutionDailyCareServiceCode[] = [
  'daily_living_support',
  'bathing_assistance',
  'turning_assistance',
  'feeding_assistance',
  'toileting_assistance',
  'night_rounds',
  'medical_escort',
  'emergency_response',
]

export const INSTITUTION_REHABILITATION_FEATURE_CODES: readonly InstitutionRehabilitationFeatureCode[] = [
  'rehabilitation_therapist',
  'rehabilitation_room',
  'postoperative_rehabilitation',
  'limb_function_training',
  'cognitive_training',
]

export const INSTITUTION_STAFF_ROLE_CODES: readonly InstitutionStaffRoleCode[] = [
  'doctor',
  'nurse',
  'caregiver',
  'rehabilitation_therapist',
  'nutritionist',
  'social_worker',
]

export const INSTITUTION_RECURRING_PRICE_COMPONENT_CODES: readonly InstitutionRecurringPriceComponentCode[] = [
  'bed_fee',
  'care_fee',
  'meal_fee',
  'management_fee',
  'special_care_fee',
  'other_fee',
]

export const INSTITUTION_PRICE_ADJUSTMENT_FACTOR_CODES: readonly InstitutionPriceAdjustmentFactorCode[] = [
  'care_level',
  'room_type',
  'special_care',
]

export const INSTITUTION_AVAILABILITY_STATUS_CODES: readonly InstitutionAvailabilityStatus[] = [
  'available',
  'limited',
  'unavailable',
  'inquiry_required',
  'unknown',
]

export const INSTITUTION_MEDIA_CATEGORY_CODES: readonly InstitutionMediaCategory[] = [
  'exterior',
  'lobby',
  'room',
  'restaurant',
  'bathroom',
  'rehabilitation',
  'activity',
  'outdoor',
]

export const INSTITUTION_VR_SCENE_CODES: readonly InstitutionVrSceneCode[] = [
  'exterior',
  'lobby',
  'room',
  'bathroom',
  'restaurant',
  'rehabilitation',
  'activity',
  'garden',
]

export const INSTITUTION_QUALIFICATION_TYPE_CODES: readonly InstitutionQualificationTypeCode[] = [
  'business_license',
  'civil_affairs_filing',
  'eldercare_institution_rating',
  'medical_insurance_qualification',
  'medical_qualification',
  'other_certification',
]

export const INSTITUTION_EVIDENCE_SOURCE_TYPES: readonly InstitutionEvidenceSourceType[] = [
  'institution_provided',
  'platform_manual_verification',
  'official_document',
  'contract_material',
  'on_site_verification',
]

export const INSTITUTION_MATCHING_CRITICAL_FIELD_PATHS: readonly InstitutionMatchingCriticalFieldPath[] = [
  'identity.regionCode',
  'typeProfile.supportedTypes',
  'capabilities.careLevelAcceptance.independent',
  'capabilities.careLevelAcceptance.light_care',
  'capabilities.careLevelAcceptance.semi_disabled',
  'capabilities.careLevelAcceptance.disabled',
  'capabilities.careLevelAcceptance.severely_disabled',
  'capabilities.mobilitySupport.wheelchair_support',
  'capabilities.mobilitySupport.bedbound_support',
  'capabilities.mobilitySupport.transfer_support',
  'capabilities.cognitiveSupport.dementia_acceptance',
  'capabilities.cognitiveSupport.wandering_risk_support',
  'capabilities.specialCare.round_the_clock_care',
  'capabilities.specialCare.one_to_one_caregiver',
  'capabilities.specialCare.night_care',
  'capabilities.specialCare.dementia_unit',
  'capabilities.specialCare.rehabilitation_training',
  'capabilities.specialCare.tube_feeding',
  'capabilities.specialCare.catheter_care',
  'capabilities.specialCare.pressure_injury_care',
  'capabilities.specialCare.incontinence_care',
  'price.referenceMonthlyPrice',
]
