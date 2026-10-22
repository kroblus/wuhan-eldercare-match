import type { InstitutionRecordV121 } from '../types/institution-v1-2-1'
import type { InstitutionCapability, InstitutionCapabilityMatrix } from '../types/institution'
import { INSTITUTION_CARE_LEVEL_CODES, INSTITUTION_MOBILITY_CAPABILITY_CODES, INSTITUTION_COGNITIVE_CAPABILITY_CODES, INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES, INSTITUTION_REHABILITATION_FEATURE_CODES } from '../domain/institution/rules'

// A schema-only constructor. It imports no Mock/demo/test records or factual values.
const verification = () => ({ status: 'unverified' as const, evidenceIds: [] as string[] })
export const unknownField = () => ({ availability: 'unknown' as const, value: null, verification: verification() })
const capability = <C extends string>(code: C): InstitutionCapability<C> => ({ code, status: 'unknown', verification: verification() })
const matrix = <C extends string>(codes: readonly C[]): InstitutionCapabilityMatrix<C> => {
  const result: { [key: string]: InstitutionCapability<C> } = {}
  codes.forEach(code => { result[code] = capability(code) })
  return result as InstitutionCapabilityMatrix<C>
}
const responseTime = () => ({ responseTimeMinutes: unknownField(), scenario: unknownField(), statistic: unknownField(), measurementNote: unknownField() })
const monitoring = () => ({ availability: unknownField(), frequency: unknownField(), serviceNote: unknownField() })
export const createUnknownProductionRecord = (institutionId: string, recordRevision: number): InstitutionRecordV121 => ({
  contractVersion: 'institution-contract-v1.2.1', capabilityContractVersion: 'institution-capability-contract-v1',
  institutionId, recordRevision, recordProvenance: 'PRODUCTION_CANDIDATE', recordStatus: 'published',
  identity: { name: unknownField(), regionCode: unknownField(), regionDisplayName: unknownField(), address: unknownField(), coordinates: unknownField(), establishedDate: unknownField(), bedCapacity: unknownField(), publicContact: unknownField(), coverMediaId: unknownField() },
  typeProfile: { supportedTypes: unknownField() },
  capabilities: { careLevelAcceptance: matrix(INSTITUTION_CARE_LEVEL_CODES), mobilitySupport: matrix(INSTITUTION_MOBILITY_CAPABILITY_CODES), cognitiveSupport: matrix(INSTITUTION_COGNITIVE_CAPABILITY_CODES), specialCare: matrix(INSTITUTION_SPECIAL_CARE_CAPABILITY_CODES) },
  services: [],
  medicalSupport: { doctorRounds: unknownField(), nurseStaff: unknownField(), nurseStation: unknownField(), partnerHospitals: unknownField(), emergencyTransferSupport: capability('emergency_transfer_support'), clinic: unknownField(), relationships: [], medicalDuty24h: unknownField(), medicalDuty24hNote: unknownField() },
  rehabilitationSupport: { features: matrix(INSTITUTION_REHABILITATION_FEATURE_CODES) },
  staffing: { counts: unknownField(), caregiverResidentRatio: unknownField(), caregiverCertification: { certifiedCaregiverCount: unknownField(), observedCaregiverCount: unknownField(), certifiedRatioBasisPoints: unknownField(), certificateTypes: unknownField(), rawStatement: unknownField() }, caregiverExperienceDistribution: { less_than_one_year: unknownField(), one_to_three_years: unknownField(), three_to_five_years: unknownField(), five_years_or_more: unknownField() }, caregiverExperienceStatement: unknownField(), nurseResponseTime: responseTime(), caregiverResponseTime: responseTime(), dutyStaffing24h: { availability: unknownField(), staffedRoles: unknownField(), coverageNote: unknownField() } },
  healthMonitoring: { bloodPressure: monitoring(), bloodOxygen: monitoring(), bloodGlucose: monitoring() },
  price: { referenceMonthlyPrice: unknownField(), recurringComponents: [], deposit: unknownField(), oneTimeFees: [], adjustmentFactors: unknownField(), priceNote: unknownField() },
  operations: { bedAvailability: { status: 'unknown', verification: verification() }, acceptingNewResidents: unknownField(), estimatedWait: unknownField(), earliestMoveInDate: unknownField() },
  rooms: [], meal: { mealSchedule: unknownField(), easyChewSupport: unknownField(), modifiedFoodSupport: unknownField(), mealFee: unknownField(), specialDietExtraFee: unknownField(), serviceNote: unknownField() },
  activity: { indoorSpace: unknownField(), outdoorSpace: unknownField(), offerings: [], zones: { publicActivityZone: unknownField(), activeAgingZone: unknownField(), careZone: unknownField(), dementiaZone: unknownField() } },
  transportation: { metro: { nearestStationName: unknownField(), distanceMeters: unknownField(), routeNote: unknownField() }, busStops: [], vehicleAccess: { availability: unknownField(), accessNote: unknownField() } },
  majorHospitalAccess: [], media: [], vr: { status: 'unknown', url: null, coverMediaId: null, scenes: [], verification: verification() }, qualifications: [], evidence: [],
  careProcess: { schemaVersion: 'institution-care-process-v1', careRecord: { presence: unknownField(), completeness: unknownField(), completenessCriteriaRef: unknownField(), frequency: unknownField(), otherFrequencyNote: unknownField(), traceability: unknownField() }, shiftHandover24h: { presence: unknownField(), processNote: unknownField(), contents: { vital_signs: unknownField(), abnormal_events: unknownField(), interventions_recorded: unknownField(), follow_up: unknownField(), family_communication: unknownField(), medical_transfer: unknownField() } } },
  officialContact: { schemaVersion: 'institution-official-contact-v1', phoneDirectoryPresence: unknownField(), officialPhones: [] },
  publicLocation: { schemaVersion: 'institution-public-location-v1', address: unknownField(), geo: unknownField() },
})
