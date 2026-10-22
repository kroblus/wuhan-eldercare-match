import type { InstitutionEvidenceValueSnapshot } from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'
import {
  INSTITUTION_EVIDENCE_SOURCE_TYPES,
  INSTITUTION_STAFF_ROLE_CODES,
  INSTITUTION_VERIFICATION_STATUS_CODES,
} from '../rules'
import { validateInstitutionRecord } from '../validate-institution'
import type { InstitutionValidationErrorCode } from '../validate-institution'
import {
  compareIsoTimestamps,
  hasExactKeys,
  hasUniqueStrings,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  isValidIsoTimestamp,
} from '../primitives'
import type { InstitutionRawRecord } from '../primitives'
import {
  INSTITUTION_ACTIVITY_CODES_V11,
  INSTITUTION_CAREGIVER_CERTIFICATE_TYPE_CODES_V11,
  INSTITUTION_CAREGIVER_EXPERIENCE_BAND_CODES_V11,
  INSTITUTION_CONTRACT_VERSION_V11,
  INSTITUTION_DISTANCE_METHOD_CODES_V11,
  INSTITUTION_HEALTH_MONITORING_FREQUENCY_CODES_V11,
  INSTITUTION_HOSPITAL_CATEGORY_CODES_V11,
  INSTITUTION_MEAL_SCHEDULE_CODES_V11,
  INSTITUTION_MEDICAL_RELATIONSHIP_TYPE_CODES_V11,
  INSTITUTION_RESPONSE_TIME_SCENARIO_CODES_V11,
  INSTITUTION_RESPONSE_TIME_STATISTIC_CODES_V11,
  INSTITUTION_SERVICE_AVAILABILITY_CODES_V11,
  INSTITUTION_TRAVEL_MODE_CODES_V11,
} from './rules-v1-1'
import {
  isInstitutionV11ExtensionFieldPath,
  projectInstitutionRecordV11ToV1,
} from './project-to-v1'

export type InstitutionV11ValidationErrorCode =
  | InstitutionValidationErrorCode
  | 'INVALID_V11_RECORD_SHAPE'
  | 'INVALID_V11_STAFFING'
  | 'INVALID_V11_MEDICAL_SUPPORT'
  | 'INVALID_HEALTH_MONITORING'
  | 'INVALID_V11_ROOM'
  | 'INVALID_MEAL_SERVICE'
  | 'INVALID_ACTIVITY_FACT'
  | 'INVALID_TRANSPORTATION_FACT'
  | 'INVALID_MAJOR_HOSPITAL_ACCESS'
  | 'INVALID_V11_EVIDENCE'

export interface InstitutionV11ValidationIssue {
  code: InstitutionV11ValidationErrorCode
  path: string
}

export type InstitutionV11ValidationResult =
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; issues: readonly InstitutionV11ValidationIssue[] }

type SnapshotType = InstitutionEvidenceValueSnapshot['valueType']
type IssueCollector = (code: InstitutionV11ValidationErrorCode, path: string) => void
type ValueValidator = (value: unknown) => boolean

interface ExtensionBinding {
  fieldPath: string
  rawValue: unknown
  snapshotType: SnapshotType
  verification: InstitutionRawRecord
}

const TOP_LEVEL_KEYS_V11: readonly string[] = [
  'contractVersion',
  'capabilityContractVersion',
  'institutionId',
  'recordRevision',
  'recordProvenance',
  'recordStatus',
  'identity',
  'typeProfile',
  'capabilities',
  'services',
  'medicalSupport',
  'rehabilitationSupport',
  'staffing',
  'healthMonitoring',
  'price',
  'operations',
  'rooms',
  'meal',
  'activity',
  'transportation',
  'majorHospitalAccess',
  'media',
  'vr',
  'qualifications',
  'evidence',
]

const PRESENCE_CODES = ['present', 'absent'] as const

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => isNonEmptyString(item))

const isStableCodeArray = <T extends string>(value: unknown, codes: readonly T[]): value is T[] =>
  isStringArray(value)
    && value.length > 0
    && hasUniqueStrings(value)
    && value.every((item) => isOneOf(item, codes))

const isVerificationShape = (
  value: unknown,
  path: string,
  issue: IssueCollector,
): value is InstitutionRawRecord => {
  if (!isPlainRecord(value)
    || !isOneOf(value.status, INSTITUTION_VERIFICATION_STATUS_CODES)
    || !isStringArray(value.evidenceIds)
    || !hasUniqueStrings(value.evidenceIds)) {
    issue('INVALID_VERIFICATION', path)
    return false
  }
  if (value.status === 'unverified') {
    if (value.verifiedAt !== undefined || value.validUntil !== undefined) {
      issue('INVALID_VERIFICATION', path)
      return false
    }
    return true
  }
  if (value.evidenceIds.length === 0 || !isValidIsoTimestamp(value.verifiedAt)) {
    issue('INVALID_VERIFICATION', path)
    return false
  }
  if (value.validUntil !== undefined
    && (!isValidIsoTimestamp(value.validUntil)
      || compareIsoTimestamps(String(value.verifiedAt), value.validUntil) > 0)) {
    issue('INVALID_VERIFICATION', path)
    return false
  }
  if (value.status === 'expired' && !isValidIsoTimestamp(value.validUntil)) {
    issue('INVALID_VERIFICATION', path)
    return false
  }
  return true
}

const validateExtensionField = (
  value: unknown,
  path: string,
  valueValidator: ValueValidator,
  snapshotType: SnapshotType,
  errorCode: InstitutionV11ValidationErrorCode,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
  requireProvided = false,
  requireAsOfWhenProvided = false,
): InstitutionRawRecord | null => {
  if (!isPlainRecord(value)
    || (value.availability !== 'provided'
      && value.availability !== 'unknown'
      && value.availability !== 'unavailable')) {
    issue(errorCode, path)
    return null
  }
  const verificationValid = isVerificationShape(value.verification, `${path}.verification`, issue)
  if (value.asOf !== undefined && !isValidIsoTimestamp(value.asOf)) {
    issue(errorCode, `${path}.asOf`)
  }
  if (value.availability === 'provided') {
    if (!valueValidator(value.value)) {
      issue(errorCode, `${path}.value`)
    }
    if (requireAsOfWhenProvided && !isValidIsoTimestamp(value.asOf)) {
      issue(errorCode, `${path}.asOf`)
    }
  } else if (value.value !== null) {
    issue(errorCode, `${path}.value`)
  }
  if (requireProvided && value.availability !== 'provided') {
    issue(errorCode, path)
  }
  if (verificationValid) {
    bindings.push({
      fieldPath: path,
      rawValue: value.availability === 'provided' ? value.value : value.availability,
      snapshotType: value.availability === 'provided' ? snapshotType : 'stable_code',
      verification: value.verification as InstitutionRawRecord,
    })
  }
  return value
}

const validateResponseTime = (
  value: unknown,
  path: string,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['responseTimeMinutes', 'scenario', 'statistic', 'measurementNote'])) {
    issue('INVALID_V11_STAFFING', path)
    return
  }
  const minutes = validateExtensionField(value.responseTimeMinutes, `${path}.responseTimeMinutes`, isNonNegativeInteger,
    'integer', 'INVALID_V11_STAFFING', issue, bindings, false, true)
  const scenario = validateExtensionField(value.scenario, `${path}.scenario`, (item) =>
    isOneOf(item, INSTITUTION_RESPONSE_TIME_SCENARIO_CODES_V11),
  'stable_code', 'INVALID_V11_STAFFING', issue, bindings)
  const statistic = validateExtensionField(value.statistic, `${path}.statistic`, (item) =>
    isOneOf(item, INSTITUTION_RESPONSE_TIME_STATISTIC_CODES_V11),
  'stable_code', 'INVALID_V11_STAFFING', issue, bindings)
  validateExtensionField(value.measurementNote, `${path}.measurementNote`, isNonEmptyString,
    'text', 'INVALID_V11_STAFFING', issue, bindings)
  if (minutes && minutes.availability === 'provided'
    && (!scenario || scenario.availability !== 'provided'
      || !statistic || statistic.availability !== 'provided')) {
    issue('INVALID_V11_STAFFING', `${path}.responseTimeMinutes`)
  }
}

const validateStaffingV11 = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  const keys = [
    'counts', 'caregiverResidentRatio', 'caregiverCertification',
    'caregiverExperienceDistribution', 'caregiverExperienceStatement',
    'nurseResponseTime', 'caregiverResponseTime', 'dutyStaffing24h',
  ]
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    issue('INVALID_V11_STAFFING', 'staffing')
    return
  }
  const certification = value.caregiverCertification
  if (!isPlainRecord(certification) || !hasExactKeys(certification, [
    'certifiedCaregiverCount', 'observedCaregiverCount', 'certifiedRatioBasisPoints',
    'certificateTypes', 'rawStatement',
  ])) {
    issue('INVALID_V11_STAFFING', 'staffing.caregiverCertification')
  } else {
    const certified = validateExtensionField(certification.certifiedCaregiverCount,
      'staffing.caregiverCertification.certifiedCaregiverCount', isNonNegativeInteger,
      'integer', 'INVALID_V11_STAFFING', issue, bindings, false, true)
    const observed = validateExtensionField(certification.observedCaregiverCount,
      'staffing.caregiverCertification.observedCaregiverCount', isNonNegativeInteger,
      'integer', 'INVALID_V11_STAFFING', issue, bindings, false, true)
    validateExtensionField(certification.certifiedRatioBasisPoints,
      'staffing.caregiverCertification.certifiedRatioBasisPoints', (item) =>
        isNonNegativeInteger(item) && item <= 10000,
      'integer', 'INVALID_V11_STAFFING', issue, bindings, false, true)
    validateExtensionField(certification.certificateTypes,
      'staffing.caregiverCertification.certificateTypes', (item) =>
        isStableCodeArray(item, INSTITUTION_CAREGIVER_CERTIFICATE_TYPE_CODES_V11),
      'stable_code_list', 'INVALID_V11_STAFFING', issue, bindings)
    validateExtensionField(certification.rawStatement,
      'staffing.caregiverCertification.rawStatement', isNonEmptyString,
      'text', 'INVALID_V11_STAFFING', issue, bindings)
    if (certified && observed
      && certified.availability === 'provided' && observed.availability === 'provided'
      && isNonNegativeInteger(certified.value) && isNonNegativeInteger(observed.value)
      && certified.value > observed.value) {
      issue('INVALID_V11_STAFFING', 'staffing.caregiverCertification.certifiedCaregiverCount')
    }
  }

  const distribution = value.caregiverExperienceDistribution
  if (!isPlainRecord(distribution)
    || !hasExactKeys(distribution, INSTITUTION_CAREGIVER_EXPERIENCE_BAND_CODES_V11)) {
    issue('INVALID_V11_STAFFING', 'staffing.caregiverExperienceDistribution')
  } else {
    INSTITUTION_CAREGIVER_EXPERIENCE_BAND_CODES_V11.forEach((band) => {
      validateExtensionField(distribution[band],
        `staffing.caregiverExperienceDistribution.${band}`, isNonNegativeInteger,
        'integer', 'INVALID_V11_STAFFING', issue, bindings, false, true)
    })
  }
  validateExtensionField(value.caregiverExperienceStatement,
    'staffing.caregiverExperienceStatement', isNonEmptyString,
    'text', 'INVALID_V11_STAFFING', issue, bindings)
  validateResponseTime(value.nurseResponseTime, 'staffing.nurseResponseTime', issue, bindings)
  validateResponseTime(value.caregiverResponseTime, 'staffing.caregiverResponseTime', issue, bindings)

  const duty = value.dutyStaffing24h
  if (!isPlainRecord(duty) || !hasExactKeys(duty, ['availability', 'staffedRoles', 'coverageNote'])) {
    issue('INVALID_V11_STAFFING', 'staffing.dutyStaffing24h')
  } else {
    validateExtensionField(duty.availability, 'staffing.dutyStaffing24h.availability', (item) =>
      isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
    'stable_code', 'INVALID_V11_STAFFING', issue, bindings)
    validateExtensionField(duty.staffedRoles, 'staffing.dutyStaffing24h.staffedRoles', (item) =>
      isStableCodeArray(item, INSTITUTION_STAFF_ROLE_CODES),
    'stable_code_list', 'INVALID_V11_STAFFING', issue, bindings)
    validateExtensionField(duty.coverageNote, 'staffing.dutyStaffing24h.coverageNote', isNonEmptyString,
      'text', 'INVALID_V11_STAFFING', issue, bindings)
  }
}

const validateMedicalSupportV11 = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  const keys = [
    'doctorRounds', 'nurseStaff', 'nurseStation', 'partnerHospitals',
    'emergencyTransferSupport', 'clinic', 'relationships', 'medicalDuty24h',
    'medicalDuty24hNote',
  ]
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    issue('INVALID_V11_MEDICAL_SUPPORT', 'medicalSupport')
    return
  }
  validateExtensionField(value.clinic, 'medicalSupport.clinic', (item) => isOneOf(item, PRESENCE_CODES),
    'stable_code', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings)
  validateExtensionField(value.medicalDuty24h, 'medicalSupport.medicalDuty24h', (item) =>
    isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
  'stable_code', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings)
  validateExtensionField(value.medicalDuty24hNote, 'medicalSupport.medicalDuty24hNote', isNonEmptyString,
    'text', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings)
  if (!Array.isArray(value.relationships)) {
    issue('INVALID_V11_MEDICAL_SUPPORT', 'medicalSupport.relationships')
    return
  }
  const ids: string[] = []
  value.relationships.forEach((relationship, index) => {
    const path = `medicalSupport.relationships.${index}`
    if (!isPlainRecord(relationship)
      || !hasExactKeys(relationship, ['relationshipId', 'relationshipType', 'organizationName', 'relationshipNote'])
      || !isStableIdentifier(relationship.relationshipId)
      || ids.indexOf(String(relationship.relationshipId)) >= 0) {
      issue(ids.indexOf(String(isPlainRecord(relationship) ? relationship.relationshipId : '')) >= 0
        ? 'DUPLICATE_ID' : 'INVALID_V11_MEDICAL_SUPPORT', path)
      return
    }
    ids.push(relationship.relationshipId)
    validateExtensionField(relationship.relationshipType, `${path}.relationshipType`, (item) =>
      isOneOf(item, INSTITUTION_MEDICAL_RELATIONSHIP_TYPE_CODES_V11),
    'stable_code', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings, true)
    validateExtensionField(relationship.organizationName, `${path}.organizationName`, isNonEmptyString,
      'text', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings, true)
    validateExtensionField(relationship.relationshipNote, `${path}.relationshipNote`, isNonEmptyString,
      'text', 'INVALID_V11_MEDICAL_SUPPORT', issue, bindings)
  })
}

const validateMonitoringItem = (
  value: unknown,
  path: string,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['availability', 'frequency', 'serviceNote'])) {
    issue('INVALID_HEALTH_MONITORING', path)
    return
  }
  const availability = validateExtensionField(value.availability, `${path}.availability`, (item) =>
    isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
  'stable_code', 'INVALID_HEALTH_MONITORING', issue, bindings)
  const frequency = validateExtensionField(value.frequency, `${path}.frequency`, (item) =>
    isOneOf(item, INSTITUTION_HEALTH_MONITORING_FREQUENCY_CODES_V11),
  'stable_code', 'INVALID_HEALTH_MONITORING', issue, bindings)
  validateExtensionField(value.serviceNote, `${path}.serviceNote`, isNonEmptyString,
    'text', 'INVALID_HEALTH_MONITORING', issue, bindings)
  if (availability && availability.availability === 'provided'
    && availability.value !== 'available'
    && frequency && frequency.availability === 'provided'
    && frequency.value !== 'unknown') {
    issue('INVALID_HEALTH_MONITORING', `${path}.frequency`)
  }
}

const validateHealthMonitoring = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  const keys = ['bloodPressure', 'bloodOxygen', 'bloodGlucose']
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    issue('INVALID_HEALTH_MONITORING', 'healthMonitoring')
    return
  }
  keys.forEach((key) => validateMonitoringItem(value[key], `healthMonitoring.${key}`, issue, bindings))
}

const validateRoomExtensions = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!Array.isArray(value)) {
    issue('INVALID_V11_ROOM', 'rooms')
    return
  }
  const extensionFeatures = [
    'electricCurtain', 'refrigerator', 'bedsideTableOrFoldBoard',
    'wheelchairOrAssistiveEquipment', 'smartSpeakerOrRadio', 'magnifier',
    'calligraphyOrPersonalItems',
  ]
  const allFeatures = [
    'privateBathroom', 'airConditioner', 'wardrobe', 'television', 'callSystem',
    'balcony', 'accessibility', ...extensionFeatures,
  ]
  value.forEach((room, index) => {
    const path = `rooms.${index}`
    if (!isPlainRecord(room) || !isPlainRecord(room.features)
      || !hasExactKeys(room.features, allFeatures)) {
      issue('INVALID_V11_ROOM', path)
      return
    }
    const features = room.features as InstitutionRawRecord
    extensionFeatures.forEach((feature) => {
      validateExtensionField(features[feature], `${path}.features.${feature}`, (item) =>
        isOneOf(item, PRESENCE_CODES), 'stable_code', 'INVALID_V11_ROOM', issue, bindings)
    })
  })
}

const validateMeal = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  const keys = [
    'mealSchedule', 'easyChewSupport', 'modifiedFoodSupport',
    'mealFee', 'specialDietExtraFee', 'serviceNote',
  ]
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    issue('INVALID_MEAL_SERVICE', 'meal')
    return
  }
  validateExtensionField(value.mealSchedule, 'meal.mealSchedule', (item) =>
    isOneOf(item, INSTITUTION_MEAL_SCHEDULE_CODES_V11),
  'stable_code', 'INVALID_MEAL_SERVICE', issue, bindings)
  ;['easyChewSupport', 'modifiedFoodSupport'].forEach((key) => {
    validateExtensionField(value[key], `meal.${key}`, (item) =>
      isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
    'stable_code', 'INVALID_MEAL_SERVICE', issue, bindings)
  })
  ;['mealFee', 'specialDietExtraFee'].forEach((key) => {
    validateExtensionField(value[key], `meal.${key}`, (item) => isMoneyRange(item, 'month'),
      'money_range', 'INVALID_PRICE', issue, bindings, false, true)
  })
  validateExtensionField(value.serviceNote, 'meal.serviceNote', isNonEmptyString,
    'text', 'INVALID_MEAL_SERVICE', issue, bindings)
}

const isMoneyAmount = (value: unknown): boolean =>
  isPlainRecord(value)
    && isPositiveInteger(value.amountMinor)
    && value.currency === 'CNY'

const isMoneyRange = (value: unknown, period: 'month' | 'one_time'): boolean => {
  if (!isPlainRecord(value) || value.period !== period || !isMoneyAmount(value.min)) {
    return false
  }
  if (value.kind === 'starting_at') {
    return value.max === null
  }
  return value.kind === 'bounded'
    && isMoneyAmount(value.max)
    && Number((value.max as InstitutionRawRecord).amountMinor)
      >= Number((value.min as InstitutionRawRecord).amountMinor)
}

const validateActivity = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['indoorSpace', 'outdoorSpace', 'offerings', 'zones'])) {
    issue('INVALID_ACTIVITY_FACT', 'activity')
    return
  }
  ;['indoorSpace', 'outdoorSpace'].forEach((key) => {
    validateExtensionField(value[key], `activity.${key}`, (item) => isOneOf(item, PRESENCE_CODES),
      'stable_code', 'INVALID_ACTIVITY_FACT', issue, bindings)
  })
  if (!Array.isArray(value.offerings)) {
    issue('INVALID_ACTIVITY_FACT', 'activity.offerings')
  } else {
    const ids: string[] = []
    const codes: string[] = []
    value.offerings.forEach((offering, index) => {
      const path = `activity.offerings.${index}`
      if (!isPlainRecord(offering)
        || !hasExactKeys(offering, ['activityId', 'code', 'availability', 'scheduleNote'])
        || !isStableIdentifier(offering.activityId)
        || !isOneOf(offering.code, INSTITUTION_ACTIVITY_CODES_V11)
        || ids.indexOf(String(offering.activityId)) >= 0
        || codes.indexOf(String(offering.code)) >= 0) {
        issue('INVALID_ACTIVITY_FACT', path)
        return
      }
      ids.push(offering.activityId)
      codes.push(offering.code)
      validateExtensionField(offering.availability, `${path}.availability`, (item) =>
        isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
      'stable_code', 'INVALID_ACTIVITY_FACT', issue, bindings)
      validateExtensionField(offering.scheduleNote, `${path}.scheduleNote`, isNonEmptyString,
        'text', 'INVALID_ACTIVITY_FACT', issue, bindings)
    })
  }
  const zones = value.zones
  const zoneKeys = ['publicActivityZone', 'activeAgingZone', 'careZone', 'dementiaZone']
  if (!isPlainRecord(zones) || !hasExactKeys(zones, zoneKeys)) {
    issue('INVALID_ACTIVITY_FACT', 'activity.zones')
  } else {
    zoneKeys.forEach((key) => {
      validateExtensionField(zones[key], `activity.zones.${key}`, (item) => isOneOf(item, PRESENCE_CODES),
        'stable_code', 'INVALID_ACTIVITY_FACT', issue, bindings)
    })
  }
}

const validateDistanceField = (
  value: unknown,
  path: string,
  code: InstitutionV11ValidationErrorCode,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
  allowVerifiedCoLocation = false,
): InstitutionRawRecord | null => validateExtensionField(value, path,
  allowVerifiedCoLocation ? isNonNegativeInteger : isPositiveInteger,
  'integer', code, issue, bindings, false, true)

const hasVerifiedFieldVerification = (field: InstitutionRawRecord | null): boolean =>
  field !== null
    && isPlainRecord(field.verification)
    && field.verification.status === 'verified'

const validateTransportation = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['metro', 'busStops', 'vehicleAccess'])) {
    issue('INVALID_TRANSPORTATION_FACT', 'transportation')
    return
  }
  const metro = value.metro
  if (!isPlainRecord(metro) || !hasExactKeys(metro, ['nearestStationName', 'distanceMeters', 'routeNote'])) {
    issue('INVALID_TRANSPORTATION_FACT', 'transportation.metro')
  } else {
    validateExtensionField(metro.nearestStationName, 'transportation.metro.nearestStationName', isNonEmptyString,
      'text', 'INVALID_TRANSPORTATION_FACT', issue, bindings)
    validateDistanceField(metro.distanceMeters, 'transportation.metro.distanceMeters',
      'INVALID_TRANSPORTATION_FACT', issue, bindings)
    validateExtensionField(metro.routeNote, 'transportation.metro.routeNote', isNonEmptyString,
      'text', 'INVALID_TRANSPORTATION_FACT', issue, bindings)
  }
  if (!Array.isArray(value.busStops)) {
    issue('INVALID_TRANSPORTATION_FACT', 'transportation.busStops')
  } else {
    const ids: string[] = []
    value.busStops.forEach((stop, index) => {
      const path = `transportation.busStops.${index}`
      if (!isPlainRecord(stop)
        || !hasExactKeys(stop, ['busStopId', 'stopName', 'distanceMeters', 'routeSummary'])
        || !isStableIdentifier(stop.busStopId)
        || ids.indexOf(String(stop.busStopId)) >= 0) {
        issue(ids.indexOf(String(isPlainRecord(stop) ? stop.busStopId : '')) >= 0
          ? 'DUPLICATE_ID' : 'INVALID_TRANSPORTATION_FACT', path)
        return
      }
      ids.push(stop.busStopId)
      validateExtensionField(stop.stopName, `${path}.stopName`, isNonEmptyString,
        'text', 'INVALID_TRANSPORTATION_FACT', issue, bindings, true)
      validateDistanceField(stop.distanceMeters, `${path}.distanceMeters`,
        'INVALID_TRANSPORTATION_FACT', issue, bindings)
      validateExtensionField(stop.routeSummary, `${path}.routeSummary`, isNonEmptyString,
        'text', 'INVALID_TRANSPORTATION_FACT', issue, bindings)
    })
  }
  const vehicle = value.vehicleAccess
  if (!isPlainRecord(vehicle) || !hasExactKeys(vehicle, ['availability', 'accessNote'])) {
    issue('INVALID_TRANSPORTATION_FACT', 'transportation.vehicleAccess')
  } else {
    validateExtensionField(vehicle.availability, 'transportation.vehicleAccess.availability', (item) =>
      isOneOf(item, INSTITUTION_SERVICE_AVAILABILITY_CODES_V11),
    'stable_code', 'INVALID_TRANSPORTATION_FACT', issue, bindings)
    validateExtensionField(vehicle.accessNote, 'transportation.vehicleAccess.accessNote', isNonEmptyString,
      'text', 'INVALID_TRANSPORTATION_FACT', issue, bindings)
  }
}

const validateMajorHospitalAccess = (
  value: unknown,
  issue: IssueCollector,
  bindings: ExtensionBinding[],
): void => {
  if (!Array.isArray(value)) {
    issue('INVALID_MAJOR_HOSPITAL_ACCESS', 'majorHospitalAccess')
    return
  }
  const ids: string[] = []
  value.forEach((access, index) => {
    const path = `majorHospitalAccess.${index}`
    const keys = [
      'hospitalAccessId', 'hospitalName', 'hospitalCategory', 'distanceMeters',
      'distanceMethod', 'distanceSource', 'travelTimeMinutes', 'travelMode',
    ]
    if (!isPlainRecord(access) || !hasExactKeys(access, keys)
      || !isStableIdentifier(access.hospitalAccessId)
      || ids.indexOf(String(access.hospitalAccessId)) >= 0) {
      issue(ids.indexOf(String(isPlainRecord(access) ? access.hospitalAccessId : '')) >= 0
        ? 'DUPLICATE_ID' : 'INVALID_MAJOR_HOSPITAL_ACCESS', path)
      return
    }
    ids.push(access.hospitalAccessId)
    validateExtensionField(access.hospitalName, `${path}.hospitalName`, isNonEmptyString,
      'text', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings, true)
    validateExtensionField(access.hospitalCategory, `${path}.hospitalCategory`, (item) =>
      isOneOf(item, INSTITUTION_HOSPITAL_CATEGORY_CODES_V11),
    'stable_code', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings)
    const distance = validateDistanceField(access.distanceMeters, `${path}.distanceMeters`,
      'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings, true)
    const method = validateExtensionField(access.distanceMethod, `${path}.distanceMethod`, (item) =>
      isOneOf(item, INSTITUTION_DISTANCE_METHOD_CODES_V11),
    'stable_code', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings)
    const source = validateExtensionField(access.distanceSource, `${path}.distanceSource`, isNonEmptyString,
      'text', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings)
    validateExtensionField(access.travelTimeMinutes, `${path}.travelTimeMinutes`, isNonNegativeInteger,
      'integer', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings, false, true)
    validateExtensionField(access.travelMode, `${path}.travelMode`, (item) =>
      isOneOf(item, INSTITUTION_TRAVEL_MODE_CODES_V11),
    'stable_code', 'INVALID_MAJOR_HOSPITAL_ACCESS', issue, bindings)

    if (distance && distance.availability === 'provided') {
      if (!method || method.availability !== 'provided'
        || !source || source.availability !== 'provided') {
        issue('INVALID_MAJOR_HOSPITAL_ACCESS', `${path}.distanceMeters`)
      } else if (distance.value === 0
        && (method.value !== 'co_located'
          || !hasVerifiedFieldVerification(distance)
          || !hasVerifiedFieldVerification(method)
          || !hasVerifiedFieldVerification(source))) {
        issue('INVALID_MAJOR_HOSPITAL_ACCESS', `${path}.distanceMethod`)
      } else if (typeof distance.value === 'number' && distance.value > 0
        && method.value === 'co_located') {
        issue('INVALID_MAJOR_HOSPITAL_ACCESS', `${path}.distanceMethod`)
      }
    }
  })
}

const equalValue = (left: unknown, right: unknown, depth = 0): boolean => {
  if (left === right) {
    return true
  }
  if (depth > 10) {
    return false
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((item, index) => equalValue(item, right[index], depth + 1))
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return false
  }
  const keys = Object.keys(left)
  return hasExactKeys(right, keys)
    && keys.every((key) => equalValue(left[key], right[key], depth + 1))
}

const validateExtensionEvidence = (
  input: InstitutionRawRecord,
  bindings: readonly ExtensionBinding[],
  issue: IssueCollector,
): void => {
  if (!Array.isArray(input.evidence)) {
    issue('INVALID_V11_EVIDENCE', 'evidence')
    return
  }
  const evidenceItems = input.evidence
  const allIds: string[] = []
  evidenceItems.forEach((item, index) => {
    if (!isPlainRecord(item) || !isStableIdentifier(item.evidenceId)) {
      issue('INVALID_V11_EVIDENCE', `evidence.${index}`)
      return
    }
    if (allIds.indexOf(item.evidenceId) >= 0) {
      issue('DUPLICATE_ID', `evidence.${index}.evidenceId`)
      return
    }
    allIds.push(item.evidenceId)
  })

  const referencedIds: string[] = []
  bindings.forEach((binding) => {
    const evidenceIds = binding.verification.evidenceIds as readonly string[]
    evidenceIds.forEach((evidenceId) => {
      if (referencedIds.indexOf(evidenceId) < 0) {
        referencedIds.push(evidenceId)
      }
      const evidence = evidenceItems.find((item: unknown) =>
        isPlainRecord(item) && item.evidenceId === evidenceId)
      if (!isPlainRecord(evidence)) {
        issue('BROKEN_REFERENCE', `${binding.fieldPath}.verification.evidenceIds`)
        return
      }
      if (evidence.institutionId !== input.institutionId
        || evidence.recordRevision !== input.recordRevision
        || evidence.fieldPath !== binding.fieldPath
        || evidence.verificationStatus !== binding.verification.status
        || evidence.verifiedAt !== binding.verification.verifiedAt
        || evidence.validUntil !== binding.verification.validUntil
        || !isOneOf(evidence.sourceType, INSTITUTION_EVIDENCE_SOURCE_TYPES)
        || (evidence.observedAt !== undefined && !isValidIsoTimestamp(evidence.observedAt))) {
        issue('INVALID_V11_EVIDENCE', binding.fieldPath)
      }
      const hasReference = isNonEmptyString(evidence.sourceReference)
      const hasNote = isNonEmptyString(evidence.sourceNote)
      if (!hasReference && !hasNote) {
        issue('INVALID_V11_EVIDENCE', binding.fieldPath)
      }
      const snapshot = evidence.valueSnapshot
      if (!isPlainRecord(snapshot)
        || snapshot.valueType !== binding.snapshotType
        || !equalValue(snapshot.value, binding.rawValue)) {
        issue('EVIDENCE_VALUE_MISMATCH', binding.fieldPath)
      }
    })
  })

  evidenceItems.forEach((item, index) => {
    if (isPlainRecord(item) && typeof item.fieldPath === 'string'
      && isInstitutionV11ExtensionFieldPath(item.fieldPath)
      && referencedIds.indexOf(String(item.evidenceId)) < 0) {
      issue('BROKEN_REFERENCE', `evidence.${index}`)
    }
  })
}

export const validateInstitutionRecordV11 = (input: unknown): InstitutionV11ValidationResult => {
  const issues: InstitutionV11ValidationIssue[] = []
  const issue: IssueCollector = (code, path) => {
    issues.push({ code, path })
  }
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [{ code: 'INVALID_V11_RECORD_SHAPE', path: '$' }] }
  }
  if (!hasExactKeys(input, TOP_LEVEL_KEYS_V11)) {
    issue('INVALID_V11_RECORD_SHAPE', '$')
  }
  if (input.contractVersion !== INSTITUTION_CONTRACT_VERSION_V11) {
    issue('INVALID_CONTRACT_VERSION', 'contractVersion')
  }

  if (input.contractVersion === INSTITUTION_CONTRACT_VERSION_V11) {
    try {
      const baseProjection = projectInstitutionRecordV11ToV1(input as unknown as InstitutionRecordV11)
      const baseValidation = validateInstitutionRecord(baseProjection)
      if (!baseValidation.ok) {
        baseValidation.issues.forEach((baseIssue) => issue(baseIssue.code, baseIssue.path))
      }
    } catch (_error) {
      issue('INVALID_V11_RECORD_SHAPE', '$')
    }
  }

  const bindings: ExtensionBinding[] = []
  validateStaffingV11(input.staffing, issue, bindings)
  validateMedicalSupportV11(input.medicalSupport, issue, bindings)
  validateHealthMonitoring(input.healthMonitoring, issue, bindings)
  validateRoomExtensions(input.rooms, issue, bindings)
  validateMeal(input.meal, issue, bindings)
  validateActivity(input.activity, issue, bindings)
  validateTransportation(input.transportation, issue, bindings)
  validateMajorHospitalAccess(input.majorHospitalAccess, issue, bindings)
  validateExtensionEvidence(input, bindings, issue)

  if (issues.length > 0) {
    return { ok: false, issues }
  }
  return { ok: true, value: input as unknown as InstitutionRecordV11 }
}
