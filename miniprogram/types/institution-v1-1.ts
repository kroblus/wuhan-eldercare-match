/**
 * FROZEN_PHASE_V1_1_D
 *
 * Additive Institution V1.1 record shape. The frozen nursing capability
 * contract is deliberately reused without adding or reinterpreting a code.
 */
import type {
  InstitutionField,
  InstitutionMedicalSupport,
  InstitutionPresenceStatus,
  InstitutionRecord,
  InstitutionRoom,
  InstitutionRoomFeatures,
  InstitutionStaffing,
  InstitutionStaffRoleCode,
  MoneyRange,
} from './institution'

export type InstitutionContractVersionV11 = 'institution-contract-v1.1'

/** Service availability is not a nursing capability status. */
export type InstitutionServiceAvailabilityV11 =
  | 'available'
  | 'unavailable'
  | 'requires_inquiry'
  | 'unknown'

export type InstitutionCaregiverCertificateTypeCodeV11 =
  | 'eldercare_caregiver_certificate'
  | 'nursing_assistant_certificate'
  | 'other_documented_certificate'

export type InstitutionCaregiverExperienceBandCodeV11 =
  | 'less_than_one_year'
  | 'one_to_three_years'
  | 'three_to_five_years'
  | 'five_years_or_more'

export interface InstitutionCaregiverCertificationV11 {
  certifiedCaregiverCount: InstitutionField<number>
  observedCaregiverCount: InstitutionField<number>
  certifiedRatioBasisPoints: InstitutionField<number>
  certificateTypes: InstitutionField<readonly InstitutionCaregiverCertificateTypeCodeV11[]>
  rawStatement: InstitutionField<string>
}

export type InstitutionCaregiverExperienceDistributionV11 = {
  readonly [K in InstitutionCaregiverExperienceBandCodeV11]: InstitutionField<number>
}

export type InstitutionResponseTimeScenarioCodeV11 =
  | 'resident_call_to_nurse_arrival'
  | 'resident_call_to_caregiver_arrival'
  | 'emergency_call_to_staff_arrival'
  | 'other_documented_scenario'

export type InstitutionResponseTimeStatisticCodeV11 =
  | 'documented_target'
  | 'documented_median'
  | 'documented_maximum'
  | 'other_documented_statistic'

export interface InstitutionResponseTimeV11 {
  responseTimeMinutes: InstitutionField<number>
  scenario: InstitutionField<InstitutionResponseTimeScenarioCodeV11>
  statistic: InstitutionField<InstitutionResponseTimeStatisticCodeV11>
  measurementNote: InstitutionField<string>
}

export interface InstitutionDutyStaffing24hV11 {
  availability: InstitutionField<InstitutionServiceAvailabilityV11>
  staffedRoles: InstitutionField<readonly InstitutionStaffRoleCode[]>
  coverageNote: InstitutionField<string>
}

/**
 * `counts` remains the one canonical doctor/nurse/caregiver/therapist count
 * collection inherited from V1. Named duplicate count fields are avoided.
 */
export interface InstitutionStaffingV11 extends InstitutionStaffing {
  caregiverCertification: InstitutionCaregiverCertificationV11
  caregiverExperienceDistribution: InstitutionCaregiverExperienceDistributionV11
  caregiverExperienceStatement: InstitutionField<string>
  nurseResponseTime: InstitutionResponseTimeV11
  caregiverResponseTime: InstitutionResponseTimeV11
  dutyStaffing24h: InstitutionDutyStaffing24hV11
}

export type InstitutionMedicalRelationshipTypeCodeV11 =
  | 'community_health_center'
  | 'owned_hospital'
  | 'partner_hospital'

export interface InstitutionMedicalRelationshipV11 {
  relationshipId: string
  relationshipType: InstitutionField<InstitutionMedicalRelationshipTypeCodeV11>
  organizationName: InstitutionField<string>
  relationshipNote: InstitutionField<string>
}

export interface InstitutionMedicalSupportV11 extends InstitutionMedicalSupport {
  clinic: InstitutionField<InstitutionPresenceStatus>
  relationships: readonly InstitutionMedicalRelationshipV11[]
  medicalDuty24h: InstitutionField<InstitutionServiceAvailabilityV11>
  medicalDuty24hNote: InstitutionField<string>
}

export type InstitutionHealthMonitoringFrequencyCodeV11 =
  | 'daily'
  | 'weekly'
  | 'on_demand'
  | 'other'
  | 'unknown'

export interface InstitutionHealthMonitoringItemV11 {
  availability: InstitutionField<InstitutionServiceAvailabilityV11>
  frequency: InstitutionField<InstitutionHealthMonitoringFrequencyCodeV11>
  serviceNote: InstitutionField<string>
}

export interface InstitutionHealthMonitoringV11 {
  bloodPressure: InstitutionHealthMonitoringItemV11
  bloodOxygen: InstitutionHealthMonitoringItemV11
  bloodGlucose: InstitutionHealthMonitoringItemV11
}

export interface InstitutionRoomFeaturesV11 extends InstitutionRoomFeatures {
  electricCurtain: InstitutionField<InstitutionPresenceStatus>
  refrigerator: InstitutionField<InstitutionPresenceStatus>
  bedsideTableOrFoldBoard: InstitutionField<InstitutionPresenceStatus>
  wheelchairOrAssistiveEquipment: InstitutionField<InstitutionPresenceStatus>
  smartSpeakerOrRadio: InstitutionField<InstitutionPresenceStatus>
  magnifier: InstitutionField<InstitutionPresenceStatus>
  calligraphyOrPersonalItems: InstitutionField<InstitutionPresenceStatus>
}

export interface InstitutionRoomV11 extends Omit<InstitutionRoom, 'features'> {
  features: InstitutionRoomFeaturesV11
}

export type InstitutionMealScheduleCodeV11 =
  | 'three_meals'
  | 'three_meals_one_snack'
  | 'three_meals_two_snacks'
  | 'other'
  | 'unknown'

export interface InstitutionMealV11 {
  mealSchedule: InstitutionField<InstitutionMealScheduleCodeV11>
  easyChewSupport: InstitutionField<InstitutionServiceAvailabilityV11>
  modifiedFoodSupport: InstitutionField<InstitutionServiceAvailabilityV11>
  mealFee: InstitutionField<MoneyRange<'month'>>
  specialDietExtraFee: InstitutionField<MoneyRange<'month'>>
  serviceNote: InstitutionField<string>
}

export type InstitutionActivityCodeV11 =
  | 'dance'
  | 'calligraphy'
  | 'arts_crafts'
  | 'chess_cards'
  | 'general_activity'
  | 'music'
  | 'fitness'

export interface InstitutionActivityOfferingV11 {
  activityId: string
  code: InstitutionActivityCodeV11
  availability: InstitutionField<InstitutionServiceAvailabilityV11>
  scheduleNote: InstitutionField<string>
}

export interface InstitutionActivityZonesV11 {
  publicActivityZone: InstitutionField<InstitutionPresenceStatus>
  activeAgingZone: InstitutionField<InstitutionPresenceStatus>
  careZone: InstitutionField<InstitutionPresenceStatus>
  dementiaZone: InstitutionField<InstitutionPresenceStatus>
}

export interface InstitutionActivityV11 {
  indoorSpace: InstitutionField<InstitutionPresenceStatus>
  outdoorSpace: InstitutionField<InstitutionPresenceStatus>
  offerings: readonly InstitutionActivityOfferingV11[]
  zones: InstitutionActivityZonesV11
}

export interface InstitutionMetroAccessV11 {
  nearestStationName: InstitutionField<string>
  distanceMeters: InstitutionField<number>
  routeNote: InstitutionField<string>
}

export interface InstitutionBusStopAccessV11 {
  busStopId: string
  stopName: InstitutionField<string>
  distanceMeters: InstitutionField<number>
  routeSummary: InstitutionField<string>
}

export interface InstitutionVehicleAccessV11 {
  availability: InstitutionField<InstitutionServiceAvailabilityV11>
  accessNote: InstitutionField<string>
}

export interface InstitutionTransportationV11 {
  metro: InstitutionMetroAccessV11
  busStops: readonly InstitutionBusStopAccessV11[]
  vehicleAccess: InstitutionVehicleAccessV11
}

export type InstitutionHospitalCategoryCodeV11 =
  | 'tertiary_grade_a'
  | 'other_tertiary'
  | 'other_documented_category'

export type InstitutionDistanceMethodCodeV11 =
  | 'straight_line'
  | 'road_route'
  | 'co_located'
  | 'other_documented_method'

export type InstitutionTravelModeCodeV11 =
  | 'driving'
  | 'walking'
  | 'public_transit'
  | 'other_documented_mode'

export interface InstitutionMajorHospitalAccessV11 {
  hospitalAccessId: string
  hospitalName: InstitutionField<string>
  hospitalCategory: InstitutionField<InstitutionHospitalCategoryCodeV11>
  distanceMeters: InstitutionField<number>
  distanceMethod: InstitutionField<InstitutionDistanceMethodCodeV11>
  distanceSource: InstitutionField<string>
  travelTimeMinutes: InstitutionField<number>
  travelMode: InstitutionField<InstitutionTravelModeCodeV11>
}

export type InstitutionV11FieldMatchingRole =
  | 'MATCHING_CANDIDATE'
  | 'DISPLAY_EXPLAINABLE'
  | 'NOT_YET_SCORABLE'
  | 'OPERATIONAL_ONLY'
  | 'AUDIT_ONLY'

export interface InstitutionV11FieldMatchingRoleEntry {
  fieldPathPattern: string
  role: InstitutionV11FieldMatchingRole
  rationale: string
}

export interface InstitutionRecordV11 extends Omit<
  InstitutionRecord,
  'contractVersion' | 'staffing' | 'medicalSupport' | 'rooms'
> {
  contractVersion: InstitutionContractVersionV11
  staffing: InstitutionStaffingV11
  medicalSupport: InstitutionMedicalSupportV11
  healthMonitoring: InstitutionHealthMonitoringV11
  rooms: readonly InstitutionRoomV11[]
  meal: InstitutionMealV11
  activity: InstitutionActivityV11
  transportation: InstitutionTransportationV11
  majorHospitalAccess: readonly InstitutionMajorHospitalAccessV11[]
}
