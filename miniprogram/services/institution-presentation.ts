/**
 * Versioned, display-safe projections for the Institution List / Detail
 * application layer. No projector in this file invents facts or derives a
 * capability from a neighbouring field.
 */

import { isHttpsUrl, isValidIsoTimestamp } from '../domain/institution/primitives'
import { resolveEffectiveCapability, isVerificationCurrentAt } from '../domain/institution/verification'
import type {
  InstitutionCapability,
  InstitutionField,
  ReferenceMonthlyPrice,
  InstitutionTypeCode,
} from '../types/institution'
import type { InstitutionRecordV11 } from '../types/institution-v1-1'
import type {
  InstitutionCanonicalIdentity,
  InstitutionCoverDisplay,
  InstitutionDetailApplicationSnapshotV12,
  InstitutionDetailBasicDisplay,
  InstitutionDetailMediaDisplay,
  InstitutionDetailRecommendationDisplay,
  InstitutionDetailRoomDisplay,
  InstitutionDetailSectionsV12,
  InstitutionEffectiveVerification,
  InstitutionDataDisclosure,
  InstitutionListDisplayItemV12,
  InstitutionMediaDisplayItem,
  InstitutionPresentationAvailability,
  InstitutionPresentationFact,
  InstitutionRecommendationPlacement,
  InstitutionReferenceMonthlyPriceDisplay,
  InstitutionRevisionDisplayContext,
  InstitutionVrDisplayState,
} from '../types/institution-list-detail'
import {
  projectInstitutionDisplaySnapshotV11Pure,
} from './institution-display-projection-v11'

export const MOCK_DEVELOPMENT_DISCLOSURE =
  '开发演示数据\n以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。'

export const institutionDataDisclosure = (
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY',
): InstitutionDataDisclosure => datasetMode === 'MOCK_DEVELOPMENT_ONLY'
  ? { kind: 'MOCK_DEVELOPMENT_ONLY', text: MOCK_DEVELOPMENT_DISCLOSURE }
  : { kind: 'PRODUCTION', text: null }

const verificationState = (
  verification: InstitutionField<unknown>['verification'],
  evaluationAsOf: string,
): InstitutionEffectiveVerification => {
  if (verification.status === 'expired') return 'expired'
  if (verification.status === 'verified'
    && verification.validUntil !== undefined
    && isValidIsoTimestamp(evaluationAsOf)
    && isValidIsoTimestamp(verification.validUntil)
    && Date.parse(verification.validUntil) < Date.parse(evaluationAsOf)) {
    return 'expired'
  }
  return verification.status === 'verified' && isVerificationCurrentAt(verification, evaluationAsOf)
    ? 'current_verified'
    : 'unverified'
}

export const projectInstitutionField = <T>(
  field: InstitutionField<T>,
  evaluationAsOf: string,
): InstitutionPresentationFact<T> => ({
  availability: field.availability,
  value: field.availability === 'provided' ? field.value : null,
  effectiveVerification: verificationState(field.verification, evaluationAsOf),
})

const mergeAvailability = (
  left: InstitutionPresentationAvailability,
  right: InstitutionPresentationAvailability,
): InstitutionPresentationAvailability => {
  if (left === 'unavailable' || right === 'unavailable') return 'unavailable'
  if (left === 'unknown' || right === 'unknown') return 'unknown'
  return 'provided'
}

const mergeVerification = (
  left: InstitutionEffectiveVerification,
  right: InstitutionEffectiveVerification,
): InstitutionEffectiveVerification => {
  if (left === 'expired' || right === 'expired') return 'expired'
  if (left === 'current_verified' && right === 'current_verified') return 'current_verified'
  return 'unverified'
}

const projectRegion = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): InstitutionPresentationFact<{ code: string; displayName: string }> => {
  const code = projectInstitutionField(record.identity.regionCode, evaluationAsOf)
  const displayName = projectInstitutionField(record.identity.regionDisplayName, evaluationAsOf)
  return {
    availability: mergeAvailability(code.availability, displayName.availability),
    value: code.value !== null && displayName.value !== null
      ? { code: code.value, displayName: displayName.value }
      : null,
    effectiveVerification: mergeVerification(code.effectiveVerification, displayName.effectiveVerification),
  }
}

const projectReferencePrice = (
  field: InstitutionField<ReferenceMonthlyPrice>,
  evaluationAsOf: string,
): InstitutionPresentationFact<InstitutionReferenceMonthlyPriceDisplay> => {
  const fact = projectInstitutionField(field, evaluationAsOf)
  if (fact.value === null) {
    return {
      availability: fact.availability,
      value: null,
      effectiveVerification: fact.effectiveVerification,
    }
  }
  const range = fact.value.range
  return {
    availability: fact.availability,
    effectiveVerification: fact.effectiveVerification,
    value: range.kind === 'bounded'
      ? {
        kind: 'bounded',
        minAmountMinor: range.min.amountMinor,
        maxAmountMinor: range.max.amountMinor,
        currency: 'CNY',
        period: 'month',
        basis: 'reference_total',
      }
      : {
        kind: 'starting_at',
        minAmountMinor: range.min.amountMinor,
        maxAmountMinor: null,
        currency: 'CNY',
        period: 'month',
        basis: 'reference_total',
      },
  }
}

const projectCover = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  baseCover: InstitutionCoverDisplay,
): InstitutionCoverDisplay => {
  const mediaIdFact = projectInstitutionField(record.identity.coverMediaId, evaluationAsOf)
  if (mediaIdFact.value === null || mediaIdFact.effectiveVerification !== 'current_verified') {
    return { state: 'placeholder', mediaId: null, url: null }
  }
  const media = record.media.find((entry) => entry.mediaId === mediaIdFact.value && entry.role === 'cover')
  if (media === undefined) return { state: 'placeholder', mediaId: null, url: null }
  const url = projectInstitutionField(media.url, evaluationAsOf)
  if (url.value === null || url.effectiveVerification !== 'current_verified' || !isHttpsUrl(url.value)) {
    return { state: 'placeholder', mediaId: null, url: null }
  }
  // The existing V1.1 projector remains the common baseline; this projector
  // tightens the URL gate before exposing a display URL.
  if (baseCover.state !== 'current_verified') return { state: 'placeholder', mediaId: null, url: null }
  return { state: 'current_verified', mediaId: mediaIdFact.value, url: url.value }
}

const projectVr = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  baseState: 'current_verified_available' | 'unavailable' | 'unknown',
): InstitutionVrDisplayState => {
  if (record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY') {
    return { state: 'unknown', canNavigate: false, sceneCount: 0 }
  }
  if (record.vr.status === 'unavailable') {
    return isVerificationCurrentAt(record.vr.verification, evaluationAsOf)
      ? { state: 'unavailable', canNavigate: false, sceneCount: 0 }
      : { state: 'unknown', canNavigate: false, sceneCount: 0 }
  }
  if (record.vr.status !== 'available'
    || baseState !== 'current_verified_available'
    || !isVerificationCurrentAt(record.vr.verification, evaluationAsOf)) {
    return { state: 'unknown', canNavigate: false, sceneCount: 0 }
  }
  const rootUrl = projectInstitutionField(record.vr.url, evaluationAsOf)
  const cover = projectInstitutionField(record.vr.coverMediaId, evaluationAsOf)
  const sceneCount = record.vr.scenes.filter((scene) => {
    const url = projectInstitutionField(scene.url, evaluationAsOf)
    return url.value !== null && url.effectiveVerification === 'current_verified' && isHttpsUrl(url.value)
  }).length
  if (rootUrl.value === null || rootUrl.effectiveVerification !== 'current_verified'
    || !isHttpsUrl(rootUrl.value)
    || cover.value === null || cover.effectiveVerification !== 'current_verified'
    || sceneCount === 0) {
    return { state: 'unknown', canNavigate: false, sceneCount: 0 }
  }
  return { state: 'available', canNavigate: true, sceneCount }
}

const projectGallery = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): readonly InstitutionMediaDisplayItem[] => {
  const items = record.media
    .filter((media) => media.role === 'gallery')
    .map((media): InstitutionMediaDisplayItem => {
      const url = projectInstitutionField(media.url, evaluationAsOf)
      const caption = projectInstitutionField(media.caption, evaluationAsOf)
      const sortOrder = projectInstitutionField(media.sortOrder, evaluationAsOf)
      const displayUrl = url.value !== null && url.effectiveVerification === 'current_verified' && isHttpsUrl(url.value)
        ? url.value
        : null
      return {
        mediaId: media.mediaId,
        role: media.role,
        category: media.category,
        availability: url.availability,
        effectiveVerification: url.effectiveVerification,
        displayUrl,
        caption: caption.value,
        sortOrder: sortOrder.value,
      }
    })
  return items.sort((left, right) => {
    if (left.sortOrder === null && right.sortOrder !== null) return 1
    if (left.sortOrder !== null && right.sortOrder === null) return -1
    if (left.sortOrder !== null && right.sortOrder !== null && left.sortOrder !== right.sortOrder) {
      return left.sortOrder < right.sortOrder ? -1 : 1
    }
    return left.mediaId < right.mediaId ? -1 : left.mediaId > right.mediaId ? 1 : 0
  })
}

const projectCapability = <C extends string>(
  capability: InstitutionCapability<C>,
  evaluationAsOf: string,
): { code: string; status: 'supported' | 'requires_assessment' | 'unsupported' | 'unknown'; effectiveVerification: InstitutionEffectiveVerification } => ({
  code: capability.code,
  status: resolveEffectiveCapability(capability.status, capability.verification, evaluationAsOf),
  effectiveVerification: verificationState(capability.verification, evaluationAsOf),
})

const projectCapabilityMatrix = <C extends string>(
  matrix: { readonly [K in C]: InstitutionCapability<K> },
  evaluationAsOf: string,
): readonly { code: string; status: 'supported' | 'requires_assessment' | 'unsupported' | 'unknown'; effectiveVerification: InstitutionEffectiveVerification }[] =>
  Object.keys(matrix).map((code) => projectCapability(matrix[code as C], evaluationAsOf))

const projectSafeFieldMap = (
  fields: object,
  evaluationAsOf: string,
): Readonly<Record<string, InstitutionPresentationFact<unknown>>> => {
  const typedFields = fields as Readonly<Record<string, InstitutionField<unknown>>>
  const output: Record<string, InstitutionPresentationFact<unknown>> = {}
  Object.keys(typedFields).forEach((key) => { output[key] = projectInstitutionField(typedFields[key], evaluationAsOf) })
  return output
}

const projectCaregiverCertification = (
  certification: InstitutionRecordV11['staffing']['caregiverCertification'],
  evaluationAsOf: string,
): Readonly<Record<string, unknown>> => ({
  certifiedCaregiverCount: projectInstitutionField(certification.certifiedCaregiverCount, evaluationAsOf),
  observedCaregiverCount: projectInstitutionField(certification.observedCaregiverCount, evaluationAsOf),
  certifiedRatioBasisPoints: projectInstitutionField(certification.certifiedRatioBasisPoints, evaluationAsOf),
  certificateTypes: projectInstitutionField(certification.certificateTypes, evaluationAsOf),
  rawStatement: projectInstitutionField(certification.rawStatement, evaluationAsOf),
})

const projectResponseTime = (
  responseTime: InstitutionRecordV11['staffing']['nurseResponseTime'],
  evaluationAsOf: string,
): Readonly<Record<string, unknown>> => ({
  responseTimeMinutes: projectInstitutionField(responseTime.responseTimeMinutes, evaluationAsOf),
  scenario: projectInstitutionField(responseTime.scenario, evaluationAsOf),
  statistic: projectInstitutionField(responseTime.statistic, evaluationAsOf),
  measurementNote: projectInstitutionField(responseTime.measurementNote, evaluationAsOf),
})

const projectDutyStaffing = (
  dutyStaffing: InstitutionRecordV11['staffing']['dutyStaffing24h'],
  evaluationAsOf: string,
): Readonly<Record<string, unknown>> => ({
  availability: projectInstitutionField(dutyStaffing.availability, evaluationAsOf),
  staffedRoles: projectInstitutionField(dutyStaffing.staffedRoles, evaluationAsOf),
  coverageNote: projectInstitutionField(dutyStaffing.coverageNote, evaluationAsOf),
})

const projectRooms = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): readonly InstitutionDetailRoomDisplay[] => record.rooms.map((room) => {
  const features: Record<string, InstitutionPresentationFact<string>> = {}
  const roomFeatures = room.features as unknown as Readonly<Record<string, InstitutionField<string>>>
  Object.keys(roomFeatures).forEach((key) => {
    features[key] = projectInstitutionField(roomFeatures[key], evaluationAsOf) as InstitutionPresentationFact<string>
  })
  return {
    roomId: room.roomId,
    name: projectInstitutionField(room.name, evaluationAsOf),
    roomType: projectInstitutionField(room.roomType, evaluationAsOf),
    areaSquareMeters: projectInstitutionField(room.areaSquareMeters, evaluationAsOf),
    bedType: projectInstitutionField(room.bedType, evaluationAsOf),
    features,
    referencePrice: projectInstitutionField(room.referencePrice, evaluationAsOf),
    mediaIds: room.mediaIds.slice(),
  }
})

const projectMeals = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): Readonly<Record<string, InstitutionPresentationFact<unknown>>> => projectSafeFieldMap({
  mealSchedule: record.meal.mealSchedule,
  easyChewSupport: record.meal.easyChewSupport,
  modifiedFoodSupport: record.meal.modifiedFoodSupport,
  mealFee: record.meal.mealFee,
  specialDietExtraFee: record.meal.specialDietExtraFee,
  serviceNote: record.meal.serviceNote,
}, evaluationAsOf)

const projectActivity = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): Readonly<Record<string, unknown>> => ({
  indoorSpace: projectInstitutionField(record.activity.indoorSpace, evaluationAsOf),
  outdoorSpace: projectInstitutionField(record.activity.outdoorSpace, evaluationAsOf),
  offerings: record.activity.offerings.map((offering) => ({
    activityId: offering.activityId,
    code: offering.code,
    availability: projectInstitutionField(offering.availability, evaluationAsOf),
    scheduleNote: projectInstitutionField(offering.scheduleNote, evaluationAsOf),
  })),
  zones: projectSafeFieldMap(record.activity.zones, evaluationAsOf),
})

const projectTransportHospital = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): Readonly<Record<string, unknown>> => ({
  transportation: {
    metro: projectSafeFieldMap(record.transportation.metro, evaluationAsOf),
    busStops: record.transportation.busStops.map((stop) => ({
      busStopId: stop.busStopId,
      stopName: projectInstitutionField(stop.stopName, evaluationAsOf),
      distanceMeters: projectInstitutionField(stop.distanceMeters, evaluationAsOf),
      routeSummary: projectInstitutionField(stop.routeSummary, evaluationAsOf),
    })),
    vehicleAccess: projectSafeFieldMap(record.transportation.vehicleAccess, evaluationAsOf),
  },
  majorHospitalAccess: record.majorHospitalAccess.map((hospital) => ({
    hospitalAccessId: hospital.hospitalAccessId,
    hospitalName: projectInstitutionField(hospital.hospitalName, evaluationAsOf),
    hospitalCategory: projectInstitutionField(hospital.hospitalCategory, evaluationAsOf),
    distanceMeters: projectInstitutionField(hospital.distanceMeters, evaluationAsOf),
    distanceMethod: projectInstitutionField(hospital.distanceMethod, evaluationAsOf),
    distanceSource: projectInstitutionField(hospital.distanceSource, evaluationAsOf),
    travelTimeMinutes: projectInstitutionField(hospital.travelTimeMinutes, evaluationAsOf),
    travelMode: projectInstitutionField(hospital.travelMode, evaluationAsOf),
  })),
})

const projectPrice = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): Readonly<Record<string, InstitutionPresentationFact<unknown> | readonly unknown[]>> => ({
  referenceMonthlyPrice: projectReferencePrice(record.price.referenceMonthlyPrice, evaluationAsOf),
  recurringComponents: record.price.recurringComponents.map((component) => ({
    component: component.component,
    referenceAmount: projectInstitutionField(component.referenceAmount, evaluationAsOf),
  })),
  deposit: projectInstitutionField(record.price.deposit, evaluationAsOf),
  oneTimeFees: record.price.oneTimeFees.map((fee) => ({
    feeId: fee.feeId,
    label: fee.label,
    referenceAmount: projectInstitutionField(fee.referenceAmount, evaluationAsOf),
  })),
  adjustmentFactors: projectInstitutionField(record.price.adjustmentFactors, evaluationAsOf),
  priceNote: projectInstitutionField(record.price.priceNote, evaluationAsOf),
})

const projectQualifications = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
): readonly Readonly<Record<string, unknown>>[] => record.qualifications.map((qualification) => ({
  qualificationId: qualification.qualificationId,
  type: qualification.type,
  certificateName: projectInstitutionField(qualification.certificateName, evaluationAsOf),
  validity: qualification.validity,
  validFrom: projectInstitutionField(qualification.validFrom, evaluationAsOf),
  validUntil: projectInstitutionField(qualification.validUntil, evaluationAsOf),
}))

const projectBasic = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  baseName: InstitutionPresentationFact<string>,
  baseSupportedTypes: InstitutionPresentationFact<readonly string[]>,
): InstitutionDetailBasicDisplay => ({
  name: baseName,
  region: projectRegion(record, evaluationAsOf),
  address: projectInstitutionField(record.identity.address, evaluationAsOf),
  institutionType: baseSupportedTypes as InstitutionPresentationFact<readonly InstitutionTypeCode[]>,
})

const projectMedia = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  baseCover: InstitutionCoverDisplay,
  baseVr: 'current_verified_available' | 'unavailable' | 'unknown',
): InstitutionDetailMediaDisplay => ({
  cover: projectCover(record, evaluationAsOf, baseCover),
  gallery: projectGallery(record, evaluationAsOf),
  vr: projectVr(record, evaluationAsOf, baseVr),
})

export const projectInstitutionListDisplayItemV12 = (
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  recommendationPlacement: InstitutionRecommendationPlacement | null = null,
): InstitutionListDisplayItemV12 => {
  if (record.recordStatus !== 'published') throw new Error('CURRENT_RECORD_NOT_LIST_DISPLAYABLE')
  const base = projectInstitutionDisplaySnapshotV11Pure(record, evaluationAsOf)
  return {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
    sourceContractVersion: 'institution-contract-v1.1',
    recordProvenance: record.recordProvenance,
    recordStatus: 'published',
    name: base.identity.name,
    region: projectRegion(record, evaluationAsOf),
    institutionType: base.type.supportedTypes as InstitutionPresentationFact<readonly InstitutionTypeCode[]>,
    referenceMonthlyPrice: projectReferencePrice(record.price.referenceMonthlyPrice, evaluationAsOf),
    cover: projectCover(record, evaluationAsOf, base.media.cover),
    vr: projectVr(record, evaluationAsOf, base.media.vr.state),
    verifiedDisplayTags: [],
    recommendationPlacement,
  }
}

export const projectInstitutionDetailSnapshotV12 = (
  record: InstitutionRecordV11,
  input: {
    contextKind:
      | 'DIRECT_CURRENT'
      | 'RECOMMENDATION_PINNED'
      | 'HISTORICAL_READ_ONLY'
      | 'CURRENT_INSTITUTION_CONTEXT'
    source: 'direct' | 'recommendation'
    datasetVersion: string
    datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
    evaluationAsOf: string
    revisionContext: InstitutionRevisionDisplayContext
    recommendationContext: InstitutionDetailRecommendationDisplay | null
    canViewCurrentRevision: boolean
  },
): InstitutionDetailApplicationSnapshotV12 => {
  if (record.recordStatus === 'draft') throw new Error('DRAFT_RECORD_NOT_DISPLAYABLE')
  const base = projectInstitutionDisplaySnapshotV11Pure(record, input.evaluationAsOf)
  const media = projectMedia(record, input.evaluationAsOf, base.media.cover, base.media.vr.state)
  const capability = {
    careLevelAcceptance: projectCapabilityMatrix(record.capabilities.careLevelAcceptance, input.evaluationAsOf),
    mobilitySupport: projectCapabilityMatrix(record.capabilities.mobilitySupport, input.evaluationAsOf),
    cognitiveSupport: projectCapabilityMatrix(record.capabilities.cognitiveSupport, input.evaluationAsOf),
    specialCare: projectCapabilityMatrix(record.capabilities.specialCare, input.evaluationAsOf),
  }
  const sections: InstitutionDetailSectionsV12 = {
    basic: projectBasic(record, input.evaluationAsOf, base.identity.name, base.type.supportedTypes),
    recommendation: input.recommendationContext,
    media,
    careCapability: capability,
    careProcess: { state: 'not_integrated' },
    staffing: {
      counts: projectInstitutionField(record.staffing.counts, input.evaluationAsOf),
      caregiverResidentRatio: projectInstitutionField(record.staffing.caregiverResidentRatio, input.evaluationAsOf),
      caregiverCertification: projectCaregiverCertification(record.staffing.caregiverCertification, input.evaluationAsOf),
      caregiverExperienceDistribution: projectSafeFieldMap(record.staffing.caregiverExperienceDistribution, input.evaluationAsOf),
      caregiverExperienceStatement: projectInstitutionField(record.staffing.caregiverExperienceStatement, input.evaluationAsOf),
      nurseResponseTime: projectResponseTime(record.staffing.nurseResponseTime, input.evaluationAsOf),
      caregiverResponseTime: projectResponseTime(record.staffing.caregiverResponseTime, input.evaluationAsOf),
      dutyStaffing24h: projectDutyStaffing(record.staffing.dutyStaffing24h, input.evaluationAsOf),
    },
    medicalRehabilitationMonitoring: {
      medicalSupport: {
        doctorRounds: projectInstitutionField(record.medicalSupport.doctorRounds, input.evaluationAsOf),
        nurseStaff: projectInstitutionField(record.medicalSupport.nurseStaff, input.evaluationAsOf),
        nurseStation: projectInstitutionField(record.medicalSupport.nurseStation, input.evaluationAsOf),
        partnerHospitals: projectInstitutionField(record.medicalSupport.partnerHospitals, input.evaluationAsOf),
        clinic: projectInstitutionField(record.medicalSupport.clinic, input.evaluationAsOf),
        medicalDuty24h: projectInstitutionField(record.medicalSupport.medicalDuty24h, input.evaluationAsOf),
        medicalDuty24hNote: projectInstitutionField(record.medicalSupport.medicalDuty24hNote, input.evaluationAsOf),
        relationships: record.medicalSupport.relationships.map((relationship) => ({
          relationshipId: relationship.relationshipId,
          relationshipType: projectInstitutionField(relationship.relationshipType, input.evaluationAsOf),
          organizationName: projectInstitutionField(relationship.organizationName, input.evaluationAsOf),
          relationshipNote: projectInstitutionField(relationship.relationshipNote, input.evaluationAsOf),
        })),
        emergencyTransferSupport: projectCapability(record.medicalSupport.emergencyTransferSupport, input.evaluationAsOf),
      },
      rehabilitationSupport: projectCapabilityMatrix(record.rehabilitationSupport.features, input.evaluationAsOf),
      healthMonitoring: {
        bloodPressure: projectSafeFieldMap(record.healthMonitoring.bloodPressure, input.evaluationAsOf),
        bloodOxygen: projectSafeFieldMap(record.healthMonitoring.bloodOxygen, input.evaluationAsOf),
        bloodGlucose: projectSafeFieldMap(record.healthMonitoring.bloodGlucose, input.evaluationAsOf),
      },
    },
    rooms: projectRooms(record, input.evaluationAsOf),
    meals: projectMeals(record, input.evaluationAsOf),
    activity: projectActivity(record, input.evaluationAsOf),
    transportHospital: projectTransportHospital(record, input.evaluationAsOf),
    price: projectPrice(record, input.evaluationAsOf),
    qualifications: projectQualifications(record, input.evaluationAsOf),
    consultantVisit: { state: 'not_integrated' },
  }
  const identity: InstitutionCanonicalIdentity = {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
  }
  return {
    kind: 'institution_detail_application_snapshot_v1_2',
    snapshotVersion: 'institution-detail-application-snapshot-v1.2',
    identity,
    contextKind: input.contextKind,
    source: input.source,
    sourceContractVersion: 'institution-contract-v1.1',
    datasetVersion: input.datasetVersion,
    datasetMode: input.datasetMode,
    evaluationAsOf: input.evaluationAsOf,
    dataDisclosure: institutionDataDisclosure(input.datasetMode),
    recordProvenance: record.recordProvenance,
    recordStatus: record.recordStatus,
    revisionContext: input.revisionContext,
    recommendationContext: input.recommendationContext,
    sections,
    actions: {
      canOpenVr: record.recordStatus === 'published' && media.vr.canNavigate,
      canContactConsultant: false,
      canCreateAppointment: false,
      canViewCurrentRevision: input.canViewCurrentRevision,
    },
  }
}
