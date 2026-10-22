import type { InstitutionEvidenceValueSnapshot, InstitutionRecord } from '../../types/institution'
import {
  INSTITUTION_AVAILABILITY_STATUS_CODES,
  INSTITUTION_CAPABILITY_CONTRACT_VERSION,
  INSTITUTION_CAPABILITY_STATUS_CODES,
  INSTITUTION_CARE_LEVEL_CODES,
  INSTITUTION_COGNITIVE_CAPABILITY_CODES,
  INSTITUTION_CONTRACT_VERSION,
  INSTITUTION_DAILY_CARE_SERVICE_CODES,
  INSTITUTION_EVIDENCE_SOURCE_TYPES,
  INSTITUTION_MEDIA_CATEGORY_CODES,
  INSTITUTION_MOBILITY_CAPABILITY_CODES,
  INSTITUTION_PRICE_ADJUSTMENT_FACTOR_CODES,
  INSTITUTION_QUALIFICATION_TYPE_CODES,
  INSTITUTION_RECURRING_PRICE_COMPONENT_CODES,
  INSTITUTION_REHABILITATION_FEATURE_CODES,
  INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES,
  INSTITUTION_STAFF_ROLE_CODES,
  INSTITUTION_TYPE_CODES,
  INSTITUTION_VERIFICATION_STATUS_CODES,
  INSTITUTION_VR_SCENE_CODES,
} from './rules'
import {
  compareIsoTimestamps,
  hasExactKeys,
  hasUniqueStrings,
  isFiniteInteger,
  isHttpsUrl,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  isStableRegionCode,
  isValidIsoDate,
  isValidIsoTimestamp,
} from './primitives'
import type { InstitutionRawRecord } from './primitives'

export type InstitutionValidationErrorCode =
  | 'INVALID_RECORD_SHAPE'
  | 'INVALID_CONTRACT_VERSION'
  | 'INVALID_CAPABILITY_CONTRACT_VERSION'
  | 'INVALID_INSTITUTION_ID'
  | 'INVALID_RECORD_REVISION'
  | 'INVALID_RECORD_PROVENANCE'
  | 'INVALID_MOCK_LABEL'
  | 'INVALID_COORDINATES'
  | 'INVALID_RECORD_STATUS'
  | 'INVALID_FIELD'
  | 'INVALID_VERIFICATION'
  | 'INVALID_TYPE_PROFILE'
  | 'INVALID_CAPABILITY_MATRIX'
  | 'INVALID_CAPABILITY'
  | 'INVALID_SERVICE'
  | 'INVALID_MEDICAL_SUPPORT'
  | 'INVALID_REHABILITATION_SUPPORT'
  | 'INVALID_STAFFING'
  | 'INVALID_PRICE'
  | 'INVALID_AVAILABILITY'
  | 'INVALID_ROOM'
  | 'INVALID_MEDIA'
  | 'INVALID_VR'
  | 'INVALID_QUALIFICATION'
  | 'INVALID_EVIDENCE'
  | 'DUPLICATE_ID'
  | 'BROKEN_REFERENCE'
  | 'EVIDENCE_REVISION_MISMATCH'
  | 'EVIDENCE_STATUS_MISMATCH'
  | 'EVIDENCE_VALUE_MISMATCH'
  | 'EVIDENCE_VERIFICATION_MISMATCH'

export interface InstitutionValidationIssue {
  code: InstitutionValidationErrorCode
  path: string
}

export type InstitutionValidationResult =
  | { ok: true; value: InstitutionRecord }
  | { ok: false; issues: readonly InstitutionValidationIssue[] }

interface VerificationBinding {
  fieldPath: string
  rawValue: unknown
  absentValue?: boolean
  verification: InstitutionRawRecord
}

interface EvidenceEntry {
  evidenceId: string
  value: InstitutionRawRecord
}

type IssueCollector = (code: InstitutionValidationErrorCode, path: string) => void
type ValueValidator = (value: unknown) => boolean

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => isNonEmptyString(item))

const isStableCodeArray = <T extends string>(value: unknown, allowed: readonly T[]): value is T[] =>
  isStringArray(value)
    && value.length > 0
    && hasUniqueStrings(value)
    && value.every((item) => isOneOf(item, allowed))

const isNumericRange = (value: unknown): boolean =>
  isPlainRecord(value)
    && isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && value.min >= 0
    && value.max >= value.min

const isMoneyAmount = (value: unknown): boolean =>
  isPlainRecord(value)
    && isPositiveInteger(value.amountMinor)
    && value.currency === 'CNY'

const isMoneyRange = (value: unknown, expectedPeriod?: 'month' | 'one_time'): boolean => {
  if (!isPlainRecord(value)
    || (value.period !== 'month' && value.period !== 'one_time')
    || (expectedPeriod !== undefined && value.period !== expectedPeriod)
    || !isMoneyAmount(value.min)) {
    return false
  }
  if (value.kind === 'starting_at') {
    return value.max === null
  }
  if (value.kind !== 'bounded' || !isMoneyAmount(value.max)) {
    return false
  }
  const min = value.min as InstitutionRawRecord
  const max = value.max as InstitutionRawRecord
  return (max.amountMinor as number) >= (min.amountMinor as number)
}

const isReferenceMonthlyPrice = (value: unknown): boolean =>
  isPlainRecord(value)
    && value.basis === 'reference_total'
    && isMoneyRange(value.range, 'month')

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
  if (value.validUntil !== undefined) {
    if (!isValidIsoTimestamp(value.validUntil)
      || compareIsoTimestamps(value.verifiedAt, value.validUntil) > 0) {
      issue('INVALID_VERIFICATION', path)
      return false
    }
  }
  if (value.status === 'expired' && !isValidIsoTimestamp(value.validUntil)) {
    issue('INVALID_VERIFICATION', path)
    return false
  }
  return true
}

const validateField = (
  value: unknown,
  path: string,
  valueValidator: ValueValidator,
  issue: IssueCollector,
  bindings: VerificationBinding[],
  options?: { requireProvided?: boolean; requireAsOfWhenProvided?: boolean },
): InstitutionRawRecord | null => {
  if (!isPlainRecord(value)
    || (value.availability !== 'provided'
      && value.availability !== 'unknown'
      && value.availability !== 'unavailable')) {
    issue('INVALID_FIELD', path)
    return null
  }
  const verificationPath = `${path}.verification`
  const verificationValid = isVerificationShape(value.verification, verificationPath, issue)
  if (value.asOf !== undefined && !isValidIsoTimestamp(value.asOf)) {
    issue('INVALID_FIELD', `${path}.asOf`)
  }

  if (value.availability === 'provided') {
    if (!valueValidator(value.value)) {
      issue('INVALID_FIELD', `${path}.value`)
    }
    if (options && options.requireAsOfWhenProvided && !isValidIsoTimestamp(value.asOf)) {
      issue('INVALID_FIELD', `${path}.asOf`)
    }
  } else if (value.value !== null) {
    issue('INVALID_FIELD', `${path}.value`)
  }

  if (options && options.requireProvided && value.availability !== 'provided') {
    issue('INVALID_FIELD', path)
  }
  if (verificationValid) {
    bindings.push({
      fieldPath: path,
      rawValue: value.availability === 'provided' ? value.value : value.availability,
      absentValue: value.availability !== 'provided',
      verification: value.verification as InstitutionRawRecord,
    })
  }
  return value
}

const validateIdentity = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): InstitutionRawRecord | null => {
  if (!isPlainRecord(value)) {
    issue('INVALID_FIELD', 'identity')
    return null
  }
  validateField(value.name, 'identity.name', isNonEmptyString, issue, bindings, { requireProvided: true })
  validateField(value.regionCode, 'identity.regionCode', isStableRegionCode, issue, bindings, { requireProvided: true })
  validateField(value.regionDisplayName, 'identity.regionDisplayName', isNonEmptyString, issue, bindings, { requireProvided: true })
  validateField(value.address, 'identity.address', isNonEmptyString, issue, bindings)
  validateField(value.coordinates, 'identity.coordinates', (coordinates) =>
    isPlainRecord(coordinates)
      && isFiniteNumber(coordinates.latitude)
      && isFiniteNumber(coordinates.longitude)
      && coordinates.latitude >= -90
      && coordinates.latitude <= 90
      && coordinates.longitude >= -180
      && coordinates.longitude <= 180, issue, bindings)
  if (isPlainRecord(value.coordinates) && value.coordinates.availability === 'provided'
    && isPlainRecord(value.coordinates.value)
    && value.coordinates.value.latitude === 0 && value.coordinates.value.longitude === 0) {
    issue('INVALID_COORDINATES', 'identity.coordinates')
  }
  validateField(value.establishedDate, 'identity.establishedDate', isValidIsoDate, issue, bindings)
  validateField(value.bedCapacity, 'identity.bedCapacity', isPositiveInteger, issue, bindings)
  validateField(value.publicContact, 'identity.publicContact', isNonEmptyString, issue, bindings)
  validateField(value.coverMediaId, 'identity.coverMediaId', isStableIdentifier, issue, bindings)
  return value
}

const validateTypeProfile = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_TYPE_PROFILE', 'typeProfile')
    return
  }
  const supported = validateField(
    value.supportedTypes,
    'typeProfile.supportedTypes',
    (types) => isStableCodeArray(types, INSTITUTION_TYPE_CODES),
    issue,
    bindings,
  )
  if (value.primaryType === undefined) {
    return
  }
  const primary = validateField(
    value.primaryType,
    'typeProfile.primaryType',
    (type) => isOneOf(type, INSTITUTION_TYPE_CODES),
    issue,
    bindings,
    { requireProvided: true },
  )
  if (primary && primary.availability === 'provided') {
    if (!supported
      || supported.availability !== 'provided'
      || !Array.isArray(supported.value)
      || supported.value.indexOf(primary.value) < 0) {
      issue('INVALID_TYPE_PROFILE', 'typeProfile.primaryType')
    }
  }
}

const validateCapability = (
  value: unknown,
  expectedCode: string,
  path: string,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)
    || value.code !== expectedCode
    || !isOneOf(value.status, INSTITUTION_CAPABILITY_STATUS_CODES)) {
    issue('INVALID_CAPABILITY', path)
    return
  }
  if (value.asOf !== undefined && !isValidIsoTimestamp(value.asOf)) {
    issue('INVALID_CAPABILITY', `${path}.asOf`)
  }
  if (isVerificationShape(value.verification, `${path}.verification`, issue)) {
    bindings.push({
      fieldPath: path,
      rawValue: value.status,
      verification: value.verification as InstitutionRawRecord,
    })
  }
}

const validateCapabilityMatrix = (
  value: unknown,
  codes: readonly string[],
  path: string,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value) || !hasExactKeys(value, codes)) {
    issue('INVALID_CAPABILITY_MATRIX', path)
    return
  }
  codes.forEach((code) => validateCapability(value[code], code, `${path}.${code}`, issue, bindings))
}

const validateCapabilities = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)
    || !hasExactKeys(value, ['careLevelAcceptance', 'mobilitySupport', 'cognitiveSupport', 'specialCare'])) {
    issue('INVALID_CAPABILITY_MATRIX', 'capabilities')
    return
  }
  validateCapabilityMatrix(value.careLevelAcceptance, INSTITUTION_CARE_LEVEL_CODES, 'capabilities.careLevelAcceptance', issue, bindings)
  validateCapabilityMatrix(value.mobilitySupport, INSTITUTION_MOBILITY_CAPABILITY_CODES, 'capabilities.mobilitySupport', issue, bindings)
  validateCapabilityMatrix(value.cognitiveSupport, INSTITUTION_COGNITIVE_CAPABILITY_CODES, 'capabilities.cognitiveSupport', issue, bindings)
  validateCapabilityMatrix(value.specialCare, INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES, 'capabilities.specialCare', issue, bindings)
}

const validateServices = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!Array.isArray(value)) {
    issue('INVALID_SERVICE', 'services')
    return
  }
  const ids: string[] = []
  const codes: string[] = []
  value.forEach((service, index) => {
    const path = `services.${index}`
    if (!isPlainRecord(service)
      || !isStableIdentifier(service.serviceId)
      || !isOneOf(service.code, INSTITUTION_DAILY_CARE_SERVICE_CODES)
      || !isOneOf(service.availability, ['available', 'requires_assessment', 'unavailable', 'unknown'])
      || !isOneOf(service.priceTreatment, ['included', 'additional_fee', 'unknown'])) {
      issue('INVALID_SERVICE', path)
      return
    }
    if (ids.indexOf(service.serviceId) >= 0 || codes.indexOf(service.code) >= 0) {
      issue('DUPLICATE_ID', path)
    }
    ids.push(service.serviceId)
    codes.push(service.code)
    validateField(service.name, `${path}.name`, isNonEmptyString, issue, bindings, { requireProvided: true })
    validateField(service.scheduleNote, `${path}.scheduleNote`, isNonEmptyString, issue, bindings)
    validateField(service.description, `${path}.description`, isNonEmptyString, issue, bindings)
    if (service.asOf !== undefined && !isValidIsoTimestamp(service.asOf)) {
      issue('INVALID_SERVICE', `${path}.asOf`)
    }
    if (isVerificationShape(service.verification, `${path}.verification`, issue)) {
      bindings.push({ fieldPath: `${path}.availability`, rawValue: service.availability, verification: service.verification })
    }
  })
}

const validateMedicalSupport = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_MEDICAL_SUPPORT', 'medicalSupport')
    return
  }
  const presence = (item: unknown): boolean => item === 'present' || item === 'absent'
  validateField(value.doctorRounds, 'medicalSupport.doctorRounds', presence, issue, bindings)
  validateField(value.nurseStaff, 'medicalSupport.nurseStaff', presence, issue, bindings)
  validateField(value.nurseStation, 'medicalSupport.nurseStation', presence, issue, bindings)
  validateField(value.partnerHospitals, 'medicalSupport.partnerHospitals', (hospitals) =>
    Array.isArray(hospitals) && hospitals.every((hospital) =>
      isPlainRecord(hospital)
        && isNonEmptyString(hospital.name)
        && (hospital.relationshipNote === undefined || isNonEmptyString(hospital.relationshipNote))), issue, bindings)
  validateCapability(value.emergencyTransferSupport, 'emergency_transfer_support', 'medicalSupport.emergencyTransferSupport', issue, bindings)
}

const validateRehabilitationSupport = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_REHABILITATION_SUPPORT', 'rehabilitationSupport')
    return
  }
  validateCapabilityMatrix(value.features, INSTITUTION_REHABILITATION_FEATURE_CODES, 'rehabilitationSupport.features', issue, bindings)
}

const validateStaffing = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_STAFFING', 'staffing')
    return
  }
  validateField(value.counts, 'staffing.counts', (counts) => {
    if (!Array.isArray(counts)) {
      return false
    }
    const roles: string[] = []
    return counts.every((count) => {
      if (!isPlainRecord(count)
        || !isOneOf(count.role, INSTITUTION_STAFF_ROLE_CODES)
        || !isNonNegativeInteger(count.count)
        || roles.indexOf(count.role) >= 0) {
        return false
      }
      roles.push(count.role)
      return true
    })
  }, issue, bindings, { requireAsOfWhenProvided: true })
  validateField(value.caregiverResidentRatio, 'staffing.caregiverResidentRatio', (ratio) =>
    isPlainRecord(ratio)
      && isNonNegativeInteger(ratio.caregiverCount)
      && isPositiveInteger(ratio.residentCount), issue, bindings, { requireAsOfWhenProvided: true })
}

const validatePriceField = (
  value: unknown,
  path: string,
  expectedPeriod: 'month' | 'one_time',
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  const field = validateField(
    value,
    path,
    (range) => isMoneyRange(range, expectedPeriod),
    issue,
    bindings,
    { requireAsOfWhenProvided: true },
  )
  if (field && field.availability === 'provided' && !isMoneyRange(field.value, expectedPeriod)) {
    issue('INVALID_PRICE', path)
  }
}

const validatePrice = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_PRICE', 'price')
    return
  }
  const reference = validateField(
    value.referenceMonthlyPrice,
    'price.referenceMonthlyPrice',
    isReferenceMonthlyPrice,
    issue,
    bindings,
    { requireAsOfWhenProvided: true },
  )
  if (reference && reference.availability === 'provided' && !isReferenceMonthlyPrice(reference.value)) {
    issue('INVALID_PRICE', 'price.referenceMonthlyPrice')
  }

  if (!Array.isArray(value.recurringComponents)) {
    issue('INVALID_PRICE', 'price.recurringComponents')
  } else {
    const componentCodes: string[] = []
    value.recurringComponents.forEach((component, index) => {
      const path = `price.recurringComponents.${index}`
      if (!isPlainRecord(component)
        || !isOneOf(component.component, INSTITUTION_RECURRING_PRICE_COMPONENT_CODES)
        || componentCodes.indexOf(component.component) >= 0) {
        issue('INVALID_PRICE', path)
        return
      }
      componentCodes.push(component.component)
      validatePriceField(component.referenceAmount, `${path}.referenceAmount`, 'month', issue, bindings)
    })
  }

  validatePriceField(value.deposit, 'price.deposit', 'one_time', issue, bindings)

  if (!Array.isArray(value.oneTimeFees)) {
    issue('INVALID_PRICE', 'price.oneTimeFees')
  } else {
    const feeIds: string[] = []
    value.oneTimeFees.forEach((fee, index) => {
      const path = `price.oneTimeFees.${index}`
      if (!isPlainRecord(fee)
        || !isStableIdentifier(fee.feeId)
        || feeIds.indexOf(fee.feeId) >= 0
        || !isNonEmptyString(fee.label)) {
        issue('INVALID_PRICE', path)
        return
      }
      feeIds.push(fee.feeId)
      validatePriceField(fee.referenceAmount, `${path}.referenceAmount`, 'one_time', issue, bindings)
    })
  }

  validateField(value.adjustmentFactors, 'price.adjustmentFactors', (factors) => {
    if (!Array.isArray(factors)) {
      return false
    }
    const codes: string[] = []
    return factors.every((factor) => {
      if (!isPlainRecord(factor)
        || !isOneOf(factor.factor, INSTITUTION_PRICE_ADJUSTMENT_FACTOR_CODES)
        || codes.indexOf(factor.factor) >= 0
        || (factor.note !== undefined && !isNonEmptyString(factor.note))) {
        return false
      }
      codes.push(factor.factor)
      return true
    })
  }, issue, bindings)
  validateField(value.priceNote, 'price.priceNote', isNonEmptyString, issue, bindings)
}

const validateOperations = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!isPlainRecord(value)) {
    issue('INVALID_AVAILABILITY', 'operations')
    return
  }
  const bed = value.bedAvailability
  if (!isPlainRecord(bed) || !isOneOf(bed.status, INSTITUTION_AVAILABILITY_STATUS_CODES)) {
    issue('INVALID_AVAILABILITY', 'operations.bedAvailability')
  } else {
    const asOfValid = bed.asOf === undefined || isValidIsoTimestamp(bed.asOf)
    if (!asOfValid || (bed.status !== 'unknown' && !isValidIsoTimestamp(bed.asOf))) {
      issue('INVALID_AVAILABILITY', 'operations.bedAvailability.asOf')
    }
    if (isVerificationShape(bed.verification, 'operations.bedAvailability.verification', issue)) {
      bindings.push({ fieldPath: 'operations.bedAvailability', rawValue: bed.status, verification: bed.verification })
    }
  }
  if (value.acceptingNewResidents !== undefined) {
    validateField(value.acceptingNewResidents, 'operations.acceptingNewResidents', (status) =>
      isOneOf(status, ['yes', 'no', 'inquiry_required', 'unknown']), issue, bindings, { requireAsOfWhenProvided: true })
  }
  if (value.estimatedWait !== undefined) {
    validateField(value.estimatedWait, 'operations.estimatedWait', (wait) =>
      isPlainRecord(wait)
        && isNonNegativeInteger(wait.minDays)
        && isNonNegativeInteger(wait.maxDays)
        && wait.maxDays >= wait.minDays, issue, bindings, { requireAsOfWhenProvided: true })
  }
  if (value.earliestMoveInDate !== undefined) {
    validateField(value.earliestMoveInDate, 'operations.earliestMoveInDate', isValidIsoDate, issue, bindings, { requireAsOfWhenProvided: true })
  }
}

const validateRooms = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
  mediaIds: readonly string[],
): void => {
  if (!Array.isArray(value)) {
    issue('INVALID_ROOM', 'rooms')
    return
  }
  const roomIds: string[] = []
  value.forEach((room, index) => {
    const path = `rooms.${index}`
    if (!isPlainRecord(room)
      || !isStableIdentifier(room.roomId)
      || roomIds.indexOf(room.roomId) >= 0
      || !isPlainRecord(room.features)
      || !Array.isArray(room.mediaIds)
      || !room.mediaIds.every((id) => isStableIdentifier(id))) {
      issue('INVALID_ROOM', path)
      return
    }
    roomIds.push(room.roomId)
    const features = room.features as InstitutionRawRecord
    validateField(room.name, `${path}.name`, isNonEmptyString, issue, bindings, { requireProvided: true })
    validateField(room.roomType, `${path}.roomType`, (type) => isOneOf(type, ['single', 'double', 'multi_bed', 'suite', 'other']), issue, bindings)
    validateField(room.areaSquareMeters, `${path}.areaSquareMeters`, isNumericRange, issue, bindings)
    validateField(room.bedType, `${path}.bedType`, (type) => isOneOf(type, ['standard_bed', 'nursing_bed', 'medical_bed', 'other']), issue, bindings)
    ;['privateBathroom', 'airConditioner', 'wardrobe', 'television', 'callSystem', 'balcony', 'accessibility'].forEach((feature) => {
      validateField(features[feature], `${path}.features.${feature}`, (status) => status === 'present' || status === 'absent', issue, bindings)
    })
    validatePriceField(room.referencePrice, `${path}.referencePrice`, 'month', issue, bindings)
    if (!hasUniqueStrings(room.mediaIds)) {
      issue('INVALID_ROOM', `${path}.mediaIds`)
    }
    room.mediaIds.forEach((mediaId) => {
      if (mediaIds.indexOf(mediaId) < 0) {
        issue('BROKEN_REFERENCE', `${path}.mediaIds`)
      }
    })
  })
}

const validateMedia = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): string[] => {
  if (!Array.isArray(value)) {
    issue('INVALID_MEDIA', 'media')
    return []
  }
  const mediaIds: string[] = []
  value.forEach((media, index) => {
    const path = `media.${index}`
    if (!isPlainRecord(media)
      || !isStableIdentifier(media.mediaId)
      || mediaIds.indexOf(media.mediaId) >= 0
      || !isOneOf(media.category, INSTITUTION_MEDIA_CATEGORY_CODES)
      || (media.role !== 'cover' && media.role !== 'gallery')) {
      issue(mediaIds.indexOf(String(media && (media as InstitutionRawRecord).mediaId)) >= 0 ? 'DUPLICATE_ID' : 'INVALID_MEDIA', path)
      return
    }
    mediaIds.push(media.mediaId)
    validateField(media.sortOrder, `${path}.sortOrder`, isNonNegativeInteger, issue, bindings)
    validateField(media.url, `${path}.url`, isHttpsUrl, issue, bindings, { requireProvided: true })
    validateField(media.caption, `${path}.caption`, isNonEmptyString, issue, bindings)
    validateField(media.capturedAt, `${path}.capturedAt`, isValidIsoTimestamp, issue, bindings)
  })
  return mediaIds
}

const validateVr = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
  mediaIds: readonly string[],
): void => {
  if (!isPlainRecord(value)
    || (value.status !== 'available' && value.status !== 'unavailable' && value.status !== 'unknown')) {
    issue('INVALID_VR', 'vr')
    return
  }
  const verificationValid = isVerificationShape(value.verification, 'vr.verification', issue)
  if (verificationValid) {
    bindings.push({ fieldPath: 'vr.status', rawValue: value.status, verification: value.verification as InstitutionRawRecord })
  }
  if (value.status !== 'available') {
    if (value.url !== null || value.coverMediaId !== null || !Array.isArray(value.scenes) || value.scenes.length !== 0) {
      issue('INVALID_VR', 'vr')
    }
    return
  }
  const url = validateField(value.url, 'vr.url', isHttpsUrl, issue, bindings, { requireProvided: true })
  const cover = validateField(value.coverMediaId, 'vr.coverMediaId', isStableIdentifier, issue, bindings, { requireProvided: true })
  if (url && url.availability !== 'provided') {
    issue('INVALID_VR', 'vr.url')
  }
  if (cover && cover.availability === 'provided' && mediaIds.indexOf(String(cover.value)) < 0) {
    issue('BROKEN_REFERENCE', 'vr.coverMediaId')
  }
  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    issue('INVALID_VR', 'vr.scenes')
    return
  }
  const sceneIds: string[] = []
  value.scenes.forEach((scene, index) => {
    const path = `vr.scenes.${index}`
    if (!isPlainRecord(scene)
      || !isStableIdentifier(scene.sceneId)
      || sceneIds.indexOf(scene.sceneId) >= 0
      || !isOneOf(scene.sceneCode, INSTITUTION_VR_SCENE_CODES)) {
      issue('INVALID_VR', path)
      return
    }
    sceneIds.push(scene.sceneId)
    validateField(scene.name, `${path}.name`, isNonEmptyString, issue, bindings, { requireProvided: true })
    validateField(scene.url, `${path}.url`, isHttpsUrl, issue, bindings, { requireProvided: true })
    const sceneCover = validateField(scene.coverMediaId, `${path}.coverMediaId`, isStableIdentifier, issue, bindings, { requireProvided: true })
    if (sceneCover && sceneCover.availability === 'provided' && mediaIds.indexOf(String(sceneCover.value)) < 0) {
      issue('BROKEN_REFERENCE', `${path}.coverMediaId`)
    }
  })
}

const validateQualifications = (
  value: unknown,
  issue: IssueCollector,
  bindings: VerificationBinding[],
): void => {
  if (!Array.isArray(value)) {
    issue('INVALID_QUALIFICATION', 'qualifications')
    return
  }
  const qualificationIds: string[] = []
  value.forEach((qualification, index) => {
    const path = `qualifications.${index}`
    if (!isPlainRecord(qualification)
      || !isStableIdentifier(qualification.qualificationId)
      || qualificationIds.indexOf(qualification.qualificationId) >= 0
      || !isOneOf(qualification.type, INSTITUTION_QUALIFICATION_TYPE_CODES)
      || !isOneOf(qualification.validity, ['valid', 'expired', 'unknown'])) {
      issue('INVALID_QUALIFICATION', path)
      return
    }
    qualificationIds.push(qualification.qualificationId)
    validateField(qualification.certificateName, `${path}.certificateName`, isNonEmptyString, issue, bindings)
    validateField(qualification.documentUrl, `${path}.documentUrl`, isHttpsUrl, issue, bindings)
    const validFrom = validateField(qualification.validFrom, `${path}.validFrom`, isValidIsoDate, issue, bindings)
    const validUntil = validateField(qualification.validUntil, `${path}.validUntil`, isValidIsoDate, issue, bindings)
    if (validFrom && validUntil && validFrom.availability === 'provided' && validUntil.availability === 'provided'
      && isValidIsoDate(validFrom.value) && isValidIsoDate(validUntil.value) && validFrom.value > validUntil.value) {
      issue('INVALID_QUALIFICATION', `${path}.validUntil`)
    }
    if (qualification.validity === 'expired'
      && (!validUntil || validUntil.availability !== 'provided')) {
      issue('INVALID_QUALIFICATION', `${path}.validUntil`)
    }
    if (isVerificationShape(qualification.verification, `${path}.verification`, issue)) {
      bindings.push({ fieldPath: `${path}.validity`, rawValue: qualification.validity, verification: qualification.verification })
    }
  })
}

const validateEvidenceSnapshot = (value: unknown): boolean => {
  if (!isPlainRecord(value) || !isNonEmptyString(value.valueType)) {
    return false
  }
  switch (value.valueType) {
    case 'stable_code':
    case 'text':
      return isNonEmptyString(value.value)
    case 'stable_code_list':
      return isStringArray(value.value) && value.value.length > 0 && hasUniqueStrings(value.value)
    case 'integer':
      return isFiniteInteger(value.value)
    case 'boolean':
      return typeof value.value === 'boolean'
    case 'iso_date':
      return isValidIsoDate(value.value)
    case 'iso_timestamp':
      return isValidIsoTimestamp(value.value)
    case 'numeric_range':
      return isNumericRange(value.value)
    case 'money_range':
      return isMoneyRange(value.value)
    case 'reference_monthly_price':
      return isReferenceMonthlyPrice(value.value)
    case 'coordinates':
      return isPlainRecord(value.value)
        && isFiniteNumber(value.value.latitude) && isFiniteNumber(value.value.longitude)
        && Math.abs(value.value.latitude) <= 90 && Math.abs(value.value.longitude) <= 180
    case 'partner_hospital_list':
      return Array.isArray(value.value) && value.value.every((item) =>
        isPlainRecord(item) && isNonEmptyString(item.name)
          && (item.relationshipNote === undefined || isNonEmptyString(item.relationshipNote)))
    case 'staff_count_list':
      return Array.isArray(value.value) && value.value.every((item) =>
        isPlainRecord(item) && isOneOf(item.role, INSTITUTION_STAFF_ROLE_CODES) && isNonNegativeInteger(item.count))
    case 'caregiver_resident_ratio':
      return isPlainRecord(value.value)
        && isNonNegativeInteger(value.value.caregiverCount) && isPositiveInteger(value.value.residentCount)
    case 'price_adjustment_factor_list':
      return Array.isArray(value.value) && value.value.every((item) =>
        isPlainRecord(item) && isOneOf(item.factor, INSTITUTION_PRICE_ADJUSTMENT_FACTOR_CODES)
          && (item.note === undefined || isNonEmptyString(item.note)))
    case 'estimated_wait_range':
      return isPlainRecord(value.value)
        && isNonNegativeInteger(value.value.minDays) && isNonNegativeInteger(value.value.maxDays)
        && value.value.minDays <= value.value.maxDays
    default:
      return false
  }
}

// Compare typed facts, not serialized/canonical JSON or presentation labels.
// The depth bound also rejects non-JSON cycles without an unbounded recursion.
const equalSnapshotValue = (left: unknown, right: unknown, depth = 0): boolean => {
  if (left === right) { return true }
  if (depth > 8) { return false }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((item, index) => equalSnapshotValue(item, right[index], depth + 1))
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) { return false }
  const keys = Object.keys(left)
  return hasExactKeys(right, keys)
    && keys.every((key) => equalSnapshotValue(left[key], right[key], depth + 1))
}

const snapshotTypeFor = (path: string, absentValue?: boolean): InstitutionEvidenceValueSnapshot['valueType'] => {
  if (absentValue) { return 'stable_code' }
  if (path === 'typeProfile.supportedTypes') { return 'stable_code_list' }
  if (path === 'price.referenceMonthlyPrice') { return 'reference_monthly_price' }
  if (path === 'identity.coordinates') { return 'coordinates' }
  if (path === 'medicalSupport.partnerHospitals') { return 'partner_hospital_list' }
  if (path === 'staffing.counts') { return 'staff_count_list' }
  if (path === 'staffing.caregiverResidentRatio') { return 'caregiver_resident_ratio' }
  if (path === 'price.adjustmentFactors') { return 'price_adjustment_factor_list' }
  if (path === 'operations.estimatedWait') { return 'estimated_wait_range' }
  if (path === 'price.deposit' || /\.(referenceAmount|referencePrice)$/.test(path)) { return 'money_range' }
  if (/\.areaSquareMeters$/.test(path)) { return 'numeric_range' }
  if (path === 'identity.bedCapacity' || /\.sortOrder$/.test(path)) { return 'integer' }
  if (path === 'identity.establishedDate' || path === 'operations.earliestMoveInDate'
    || /^qualifications\.[^.]+\.(validFrom|validUntil)$/.test(path)) { return 'iso_date' }
  if (/\.capturedAt$/.test(path)) { return 'iso_timestamp' }
  if (/^(capabilities\.|rehabilitationSupport\.features\.)/.test(path)
    || /^medicalSupport\.(doctorRounds|nurseStaff|nurseStation|emergencyTransferSupport)$/.test(path)
    || path === 'identity.regionCode' || path === 'typeProfile.primaryType'
    || path === 'operations.bedAvailability' || path === 'operations.acceptingNewResidents'
    || path === 'vr.status' || /\.coverMediaId$/.test(path)
    || /^rooms\.[^.]+\.(roomType|bedType|features\.[^.]+)$/.test(path)
    || /^services\.[^.]+\.availability$/.test(path)
    || /^qualifications\.[^.]+\.validity$/.test(path)) { return 'stable_code' }
  return 'text'
}

const validateEvidence = (
  value: unknown,
  institutionId: string,
  recordRevision: number,
  bindings: readonly VerificationBinding[],
  issue: IssueCollector,
): EvidenceEntry[] => {
  if (!Array.isArray(value)) {
    issue('INVALID_EVIDENCE', 'evidence')
    return []
  }
  const entries: EvidenceEntry[] = []
  const evidenceIds: string[] = []
  value.forEach((evidence, index) => {
    const path = `evidence.${index}`
    if (!isPlainRecord(evidence)
      || !isStableIdentifier(evidence.evidenceId)
      || evidenceIds.indexOf(String(evidence.evidenceId)) >= 0
      || !isNonEmptyString(evidence.fieldPath)
      || !isOneOf(evidence.sourceType, INSTITUTION_EVIDENCE_SOURCE_TYPES)
      || !isOneOf(evidence.verificationStatus, INSTITUTION_VERIFICATION_STATUS_CODES)
      || !validateEvidenceSnapshot(evidence.valueSnapshot)) {
      issue('INVALID_EVIDENCE', path)
      return
    }
    evidenceIds.push(evidence.evidenceId)
    if (evidence.institutionId !== institutionId) {
      issue('INVALID_EVIDENCE', `${path}.institutionId`)
    }
    if (evidence.recordRevision !== recordRevision) {
      issue('EVIDENCE_REVISION_MISMATCH', `${path}.recordRevision`)
    }
    if (bindings.every((binding) => binding.fieldPath !== evidence.fieldPath)) {
      issue('INVALID_EVIDENCE', `${path}.fieldPath`)
    }
    if (evidence.observedAt !== undefined && !isValidIsoTimestamp(evidence.observedAt)) {
      issue('INVALID_EVIDENCE', `${path}.observedAt`)
    }
    const hasReference = isNonEmptyString(evidence.sourceReference)
    const hasNote = isNonEmptyString(evidence.sourceNote)
    if ((evidence.sourceReference !== undefined && !hasReference)
      || (evidence.sourceNote !== undefined && !hasNote)) {
      issue('INVALID_EVIDENCE', `${path}.sourceReference`)
    }
    if (!hasReference && !hasNote) {
      issue('INVALID_EVIDENCE', `${path}.sourceReference`)
    }
    if (evidence.verificationStatus === 'unverified') {
      if (evidence.verifiedAt !== undefined || evidence.validUntil !== undefined) {
        issue('INVALID_EVIDENCE', path)
      }
    } else {
      if (!isValidIsoTimestamp(evidence.verifiedAt)) {
        issue('INVALID_EVIDENCE', `${path}.verifiedAt`)
      }
      if (evidence.validUntil !== undefined
        && (!isValidIsoTimestamp(evidence.validUntil)
          || (isValidIsoTimestamp(evidence.verifiedAt)
            && compareIsoTimestamps(evidence.verifiedAt, evidence.validUntil) > 0))) {
        issue('INVALID_EVIDENCE', `${path}.validUntil`)
      }
      if (evidence.verificationStatus === 'expired' && !isValidIsoTimestamp(evidence.validUntil)) {
        issue('INVALID_EVIDENCE', `${path}.validUntil`)
      }
    }
    entries.push({ evidenceId: evidence.evidenceId, value: evidence })
  })
  return entries
}

const validateEvidenceBindings = (
  bindings: readonly VerificationBinding[],
  evidenceEntries: readonly EvidenceEntry[],
  issue: IssueCollector,
): void => {
  const referencedIds: string[] = []
  bindings.forEach((binding) => {
    const evidenceIds = binding.verification.evidenceIds
    if (!Array.isArray(evidenceIds)) {
      return
    }
    evidenceIds.forEach((evidenceId) => {
      if (referencedIds.indexOf(evidenceId) < 0) {
        referencedIds.push(evidenceId)
      }
      const entry = evidenceEntries.find((item) => item.evidenceId === evidenceId)
      if (!entry) {
        issue('BROKEN_REFERENCE', `${binding.fieldPath}.verification.evidenceIds`)
        return
      }
      if (entry.value.fieldPath !== binding.fieldPath) {
        issue('BROKEN_REFERENCE', `${binding.fieldPath}.verification.evidenceIds`)
      }
      if (entry.value.verificationStatus !== binding.verification.status) {
        issue('EVIDENCE_STATUS_MISMATCH', `${binding.fieldPath}.verification`)
      }
      if (entry.value.verifiedAt !== binding.verification.verifiedAt
        || entry.value.validUntil !== binding.verification.validUntil) {
        issue('EVIDENCE_VERIFICATION_MISMATCH', `${binding.fieldPath}.verification`)
      }
      const snapshot = entry.value.valueSnapshot
      if (!isPlainRecord(snapshot)
        || snapshot.valueType !== snapshotTypeFor(binding.fieldPath, binding.absentValue)
        || !equalSnapshotValue(snapshot.value, binding.rawValue)) {
        issue('EVIDENCE_VALUE_MISMATCH', binding.fieldPath)
      }
    })
  })
  evidenceEntries.forEach((entry) => {
    if (referencedIds.indexOf(entry.evidenceId) < 0) {
      issue('BROKEN_REFERENCE', `evidence.${entry.evidenceId}`)
    }
  })
}

export const validateInstitutionRecord = (input: unknown): InstitutionValidationResult => {
  const issues: InstitutionValidationIssue[] = []
  const issue: IssueCollector = (code, path) => {
    issues.push({ code, path })
  }
  if (!isPlainRecord(input)) {
    return { ok: false, issues: [{ code: 'INVALID_RECORD_SHAPE', path: '$' }] }
  }
  if (input.contractVersion !== INSTITUTION_CONTRACT_VERSION) {
    issue('INVALID_CONTRACT_VERSION', 'contractVersion')
  }
  if (input.capabilityContractVersion !== INSTITUTION_CAPABILITY_CONTRACT_VERSION) {
    issue('INVALID_CAPABILITY_CONTRACT_VERSION', 'capabilityContractVersion')
  }
  if (!isStableIdentifier(input.institutionId)) {
    issue('INVALID_INSTITUTION_ID', 'institutionId')
  }
  if (!isPositiveInteger(input.recordRevision)) {
    issue('INVALID_RECORD_REVISION', 'recordRevision')
  }
  if (input.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY'
    && input.recordProvenance !== 'PRODUCTION_CANDIDATE') {
    issue('INVALID_RECORD_PROVENANCE', 'recordProvenance')
  }
  if (!isOneOf(input.recordStatus, ['draft', 'published', 'suspended', 'archived'])) {
    issue('INVALID_RECORD_STATUS', 'recordStatus')
  }

  const bindings: VerificationBinding[] = []
  const identity = validateIdentity(input.identity, issue, bindings)
  if (input.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
    && identity && isPlainRecord(identity.name) && typeof identity.name.value === 'string'
    && !/\bmock\b/i.test(identity.name.value)) {
    issue('INVALID_MOCK_LABEL', 'identity.name')
  }
  validateTypeProfile(input.typeProfile, issue, bindings)
  validateCapabilities(input.capabilities, issue, bindings)
  validateServices(input.services, issue, bindings)
  validateMedicalSupport(input.medicalSupport, issue, bindings)
  validateRehabilitationSupport(input.rehabilitationSupport, issue, bindings)
  validateStaffing(input.staffing, issue, bindings)
  validatePrice(input.price, issue, bindings)
  validateOperations(input.operations, issue, bindings)
  const mediaIds = validateMedia(input.media, issue, bindings)
  validateRooms(input.rooms, issue, bindings, mediaIds)
  validateVr(input.vr, issue, bindings, mediaIds)
  validateQualifications(input.qualifications, issue, bindings)

  if (identity && isPlainRecord(identity.coverMediaId) && identity.coverMediaId.availability === 'provided') {
    const coverMediaId = identity.coverMediaId.value
    const cover = Array.isArray(input.media)
      ? input.media.find((item) => isPlainRecord(item) && item.mediaId === coverMediaId)
      : undefined
    if (!isPlainRecord(cover) || cover.role !== 'cover') {
      issue('BROKEN_REFERENCE', 'identity.coverMediaId')
    }
  }

  const institutionId = typeof input.institutionId === 'string' ? input.institutionId : ''
  const recordRevision = typeof input.recordRevision === 'number' ? input.recordRevision : 0
  const evidenceEntries = validateEvidence(input.evidence, institutionId, recordRevision, bindings, issue)
  validateEvidenceBindings(bindings, evidenceEntries, issue)

  if (issues.length > 0) {
    return { ok: false, issues }
  }
  return { ok: true, value: input as unknown as InstitutionRecord }
}
