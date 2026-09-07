import type {
  InstitutionActivityCodeV11,
  InstitutionCaregiverCertificateTypeCodeV11,
  InstitutionCaregiverExperienceBandCodeV11,
  InstitutionDistanceMethodCodeV11,
  InstitutionHealthMonitoringFrequencyCodeV11,
  InstitutionHospitalCategoryCodeV11,
  InstitutionMealScheduleCodeV11,
  InstitutionMedicalRelationshipTypeCodeV11,
  InstitutionResponseTimeScenarioCodeV11,
  InstitutionResponseTimeStatisticCodeV11,
  InstitutionServiceAvailabilityV11,
  InstitutionTravelModeCodeV11,
  InstitutionV11FieldMatchingRoleEntry,
} from '../../../types/institution-v1-1'

export const INSTITUTION_CONTRACT_VERSION_V11 = 'institution-contract-v1.1' as const

export const INSTITUTION_SERVICE_AVAILABILITY_CODES_V11: readonly InstitutionServiceAvailabilityV11[] = [
  'available',
  'unavailable',
  'requires_inquiry',
  'unknown',
]

export const INSTITUTION_CAREGIVER_CERTIFICATE_TYPE_CODES_V11: readonly InstitutionCaregiverCertificateTypeCodeV11[] = [
  'eldercare_caregiver_certificate',
  'nursing_assistant_certificate',
  'other_documented_certificate',
]

export const INSTITUTION_CAREGIVER_EXPERIENCE_BAND_CODES_V11: readonly InstitutionCaregiverExperienceBandCodeV11[] = [
  'less_than_one_year',
  'one_to_three_years',
  'three_to_five_years',
  'five_years_or_more',
]

export const INSTITUTION_RESPONSE_TIME_SCENARIO_CODES_V11: readonly InstitutionResponseTimeScenarioCodeV11[] = [
  'resident_call_to_nurse_arrival',
  'resident_call_to_caregiver_arrival',
  'emergency_call_to_staff_arrival',
  'other_documented_scenario',
]

export const INSTITUTION_RESPONSE_TIME_STATISTIC_CODES_V11: readonly InstitutionResponseTimeStatisticCodeV11[] = [
  'documented_target',
  'documented_median',
  'documented_maximum',
  'other_documented_statistic',
]

export const INSTITUTION_MEDICAL_RELATIONSHIP_TYPE_CODES_V11: readonly InstitutionMedicalRelationshipTypeCodeV11[] = [
  'community_health_center',
  'owned_hospital',
  'partner_hospital',
]

export const INSTITUTION_HEALTH_MONITORING_FREQUENCY_CODES_V11: readonly InstitutionHealthMonitoringFrequencyCodeV11[] = [
  'daily',
  'weekly',
  'on_demand',
  'other',
  'unknown',
]

export const INSTITUTION_MEAL_SCHEDULE_CODES_V11: readonly InstitutionMealScheduleCodeV11[] = [
  'three_meals',
  'three_meals_one_snack',
  'three_meals_two_snacks',
  'other',
  'unknown',
]

export const INSTITUTION_ACTIVITY_CODES_V11: readonly InstitutionActivityCodeV11[] = [
  'dance',
  'calligraphy',
  'arts_crafts',
  'chess_cards',
  'general_activity',
  'music',
  'fitness',
]

export const INSTITUTION_HOSPITAL_CATEGORY_CODES_V11: readonly InstitutionHospitalCategoryCodeV11[] = [
  'tertiary_grade_a',
  'other_tertiary',
  'other_documented_category',
]

export const INSTITUTION_DISTANCE_METHOD_CODES_V11: readonly InstitutionDistanceMethodCodeV11[] = [
  'straight_line',
  'road_route',
  'co_located',
  'other_documented_method',
]

export const INSTITUTION_TRAVEL_MODE_CODES_V11: readonly InstitutionTravelModeCodeV11[] = [
  'driving',
  'walking',
  'public_transit',
  'other_documented_mode',
]

/**
 * This matrix classifies facts only. It is not a score, comparator, ranking
 * configuration, or permission for Recommendation V1/V2 to consume a field.
 */
export const V1_1_INSTITUTION_FIELD_MATCHING_ROLE_MATRIX: readonly InstitutionV11FieldMatchingRoleEntry[] = [
  { fieldPathPattern: 'rooms.*.roomType', role: 'MATCHING_CANDIDATE', rationale: 'Future verified room-preference comparison only.' },
  { fieldPathPattern: 'meal.mealSchedule', role: 'MATCHING_CANDIDATE', rationale: 'Future verified meal-schedule comparison only.' },
  { fieldPathPattern: 'meal.easyChewSupport', role: 'DISPLAY_EXPLAINABLE', rationale: 'Lifestyle support; never a tube-feeding capability.' },
  { fieldPathPattern: 'meal.modifiedFoodSupport', role: 'DISPLAY_EXPLAINABLE', rationale: 'Lifestyle support; never a tube-feeding capability.' },
  { fieldPathPattern: 'meal.mealFee', role: 'DISPLAY_EXPLAINABLE', rationale: 'Service fee is independently verified and is never auto-summed.' },
  { fieldPathPattern: 'meal.specialDietExtraFee', role: 'DISPLAY_EXPLAINABLE', rationale: 'Unknown is not zero and the fee is never auto-summed.' },
  { fieldPathPattern: 'meal.serviceNote', role: 'DISPLAY_EXPLAINABLE', rationale: 'Source text is displayed with verification and never parsed into capability.' },
  { fieldPathPattern: 'staffing.*', role: 'NOT_YET_SCORABLE', rationale: 'No approved comparable quality metric or threshold.' },
  { fieldPathPattern: 'medicalSupport.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'Separate verified configuration facts, not a medical quality score.' },
  { fieldPathPattern: 'healthMonitoring.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'Frequency is descriptive and does not imply quality.' },
  { fieldPathPattern: 'rooms.*.features.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'Room facts do not imply nursing capability.' },
  { fieldPathPattern: 'activity.indoorSpace', role: 'NOT_YET_SCORABLE', rationale: 'No approved activity-space comparator.' },
  { fieldPathPattern: 'activity.outdoorSpace', role: 'NOT_YET_SCORABLE', rationale: 'No approved activity-space comparator.' },
  { fieldPathPattern: 'activity.offerings.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'Verified offering facts do not create an activity score.' },
  { fieldPathPattern: 'activity.zones.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'A zone fact does not create a nursing capability.' },
  { fieldPathPattern: 'transportation.*', role: 'NOT_YET_SCORABLE', rationale: 'No user origin or approved transport comparator.' },
  { fieldPathPattern: 'majorHospitalAccess.*', role: 'NOT_YET_SCORABLE', rationale: 'No approved hospital definition, threshold, or ranking rule.' },
  { fieldPathPattern: 'price.recurringComponents.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'Components explain price and never replace the reference total.' },
  { fieldPathPattern: 'price.deposit', role: 'DISPLAY_EXPLAINABLE', rationale: 'One-time charge is separate from monthly matching.' },
  { fieldPathPattern: 'price.oneTimeFees.*', role: 'DISPLAY_EXPLAINABLE', rationale: 'One-time charges are not monthly price.' },
  { fieldPathPattern: 'operations.*', role: 'OPERATIONAL_ONLY', rationale: 'Dynamic availability does not rewrite capability.' },
  { fieldPathPattern: 'evidence.*', role: 'AUDIT_ONLY', rationale: 'Evidence supports audit and verification, never ranking.' },
  { fieldPathPattern: 'recordRevision', role: 'AUDIT_ONLY', rationale: 'Revision binds facts and evidence; it is never a score.' },
]
