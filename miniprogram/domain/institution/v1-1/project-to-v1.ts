import type { InstitutionRecord } from '../../../types/institution'
import type { InstitutionRecordV11 } from '../../../types/institution-v1-1'

const V11_EXTENSION_PREFIXES: readonly string[] = [
  'staffing.caregiverCertification',
  'staffing.caregiverExperienceDistribution',
  'staffing.caregiverExperienceStatement',
  'staffing.nurseResponseTime',
  'staffing.caregiverResponseTime',
  'staffing.dutyStaffing24h',
  'medicalSupport.clinic',
  'medicalSupport.relationships',
  'medicalSupport.medicalDuty24h',
  'medicalSupport.medicalDuty24hNote',
  'healthMonitoring',
  'meal',
  'activity',
  'transportation',
  'majorHospitalAccess',
]

const V11_ROOM_FEATURES: readonly string[] = [
  'electricCurtain',
  'refrigerator',
  'bedsideTableOrFoldBoard',
  'wheelchairOrAssistiveEquipment',
  'smartSpeakerOrRadio',
  'magnifier',
  'calligraphyOrPersonalItems',
]

export const isInstitutionV11ExtensionFieldPath = (fieldPath: string): boolean => {
  if (V11_EXTENSION_PREFIXES.some((prefix) =>
    fieldPath === prefix || fieldPath.indexOf(`${prefix}.`) === 0)) {
    return true
  }
  const match = /^rooms\.[^.]+\.features\.([^.]+)$/.exec(fieldPath)
  return match !== null && V11_ROOM_FEATURES.indexOf(match[1]) >= 0
}

/**
 * Explicit compatibility projection for frozen V1 consumers. It removes only
 * V1.1 facts and V1.1 evidence; it never derives, defaults, or upgrades a
 * capability. Callers must validate the V1.1 record before projecting it.
 */
export const projectInstitutionRecordV11ToV1 = (
  record: InstitutionRecordV11,
): InstitutionRecord => ({
  contractVersion: 'institution-contract-v1',
  capabilityContractVersion: record.capabilityContractVersion,
  institutionId: record.institutionId,
  recordRevision: record.recordRevision,
  recordProvenance: record.recordProvenance,
  recordStatus: record.recordStatus,
  identity: record.identity,
  typeProfile: record.typeProfile,
  capabilities: record.capabilities,
  services: record.services,
  medicalSupport: {
    doctorRounds: record.medicalSupport.doctorRounds,
    nurseStaff: record.medicalSupport.nurseStaff,
    nurseStation: record.medicalSupport.nurseStation,
    partnerHospitals: record.medicalSupport.partnerHospitals,
    emergencyTransferSupport: record.medicalSupport.emergencyTransferSupport,
  },
  rehabilitationSupport: record.rehabilitationSupport,
  staffing: {
    counts: record.staffing.counts,
    caregiverResidentRatio: record.staffing.caregiverResidentRatio,
  },
  price: record.price,
  operations: record.operations,
  rooms: record.rooms.map((room) => ({
    roomId: room.roomId,
    name: room.name,
    roomType: room.roomType,
    areaSquareMeters: room.areaSquareMeters,
    bedType: room.bedType,
    features: {
      privateBathroom: room.features.privateBathroom,
      airConditioner: room.features.airConditioner,
      wardrobe: room.features.wardrobe,
      television: room.features.television,
      callSystem: room.features.callSystem,
      balcony: room.features.balcony,
      accessibility: room.features.accessibility,
    },
    referencePrice: room.referencePrice,
    mediaIds: room.mediaIds,
  })),
  media: record.media,
  vr: record.vr,
  qualifications: record.qualifications,
  evidence: record.evidence.filter((item) =>
    !isInstitutionV11ExtensionFieldPath(item.fieldPath)),
})
