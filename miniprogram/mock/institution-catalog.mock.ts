/**
 * MOCK_DEVELOPMENT_ONLY
 *
 * 仅开发演示，不是真实机构数据。以下记录用于 application integration
 * 的完整池、核验投影和错误状态演示，不代表任何武汉合作机构、价格、能力、
 * 床位、资质、媒体或 VR 事实。
 */
import type {
  InstitutionAvailabilityFact,
  InstitutionCapability,
  InstitutionCapabilityMatrix,
  InstitutionCapabilityStatus,
  InstitutionCareLevelCode,
  InstitutionCognitiveCapabilityCode,
  InstitutionField,
  InstitutionEvidence,
  InstitutionEvidenceValueSnapshot,
  InstitutionMobilityCapabilityCode,
  InstitutionPriceProfile,
  InstitutionRecord,
  InstitutionRehabilitationFeatureCode,
  InstitutionRehabilitationSupport,
  InstitutionRecurringPriceComponentCode,
  InstitutionSpecialCareCapabilityCode,
  InstitutionTypeCode,
  InstitutionTypeProfile,
  InstitutionFieldVerification,
  ReferenceMonthlyPrice,
  MoneyRange,
} from '../types/institution'
import type {
  InstitutionActivityV11,
  InstitutionHealthMonitoringItemV11,
  InstitutionHealthMonitoringV11,
  InstitutionMealV11,
  InstitutionMedicalSupportV11,
  InstitutionRecordV11,
  InstitutionResponseTimeV11,
  InstitutionStaffingV11,
  InstitutionTransportationV11,
} from '../types/institution-v1-1'
import {
  projectInstitutionRecordV11ToV1,
  validateInstitutionRecordV11,
} from '../domain/institution/v1-1'
import type {
  InstitutionCatalogPayload,
  InstitutionCatalogProvider,
} from '../types/institution-catalog'

const FACT_AS_OF = '2026-08-30T09:00:00.000Z'
const VERIFIED_AT = FACT_AS_OF
const VALID_UNTIL = '2027-08-30T09:00:00.000Z'
const EXPIRED_VERIFIED_AT = '2025-08-30T09:00:00.000Z'
const EXPIRED_UNTIL = '2025-12-31T09:00:00.000Z'
const SYNTHETIC_EVIDENCE_NOTE =
  'DEVELOPMENT_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA'

type VerificationMode = 'verified' | 'expired' | 'unverified'

type ProvidedInstitutionField<T> = Extract<InstitutionField<T>, { availability: 'provided' }>

const CARE_LEVEL_CODES: readonly InstitutionCareLevelCode[] = [
  'independent',
  'light_care',
  'semi_disabled',
  'disabled',
  'severely_disabled',
]

const MOBILITY_CODES: readonly InstitutionMobilityCapabilityCode[] = [
  'wheelchair_support',
  'bedbound_support',
  'transfer_support',
]

const COGNITIVE_CODES: readonly InstitutionCognitiveCapabilityCode[] = [
  'dementia_acceptance',
  'wandering_risk_support',
]

const SPECIAL_CARE_CODES: readonly InstitutionSpecialCareCapabilityCode[] = [
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

const REHABILITATION_FEATURE_CODES: readonly InstitutionRehabilitationFeatureCode[] = [
  'rehabilitation_therapist',
  'rehabilitation_room',
  'postoperative_rehabilitation',
  'limb_function_training',
  'cognitive_training',
]

const RECURRING_PRICE_COMPONENT_CODES: readonly InstitutionRecurringPriceComponentCode[] = [
  'bed_fee',
  'care_fee',
  'meal_fee',
  'management_fee',
  'special_care_fee',
  'other_fee',
]

const asNonEmpty = <T>(values: readonly T[]): readonly [T, ...T[]] =>
  values.slice() as unknown as readonly [T, ...T[]]

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item))
  }
  if (isPlainRecord(value)) {
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    Object.keys(value).forEach((key) => {
      copy[key] = cloneValue(value[key])
    })
    return copy
  }
  return value
}

const cloneCatalog = (catalog: InstitutionCatalogPayload): InstitutionCatalogPayload => ({
  datasetVersion: catalog.datasetVersion,
  datasetMode: catalog.datasetMode,
  records: cloneValue(catalog.records) as InstitutionRecord[],
})

interface InstitutionCatalogPayloadV11 {
  datasetVersion: string
  datasetMode: 'MOCK_DEVELOPMENT_ONLY'
  records: readonly InstitutionRecordV11[]
}

const cloneCatalogV11 = (catalog: InstitutionCatalogPayloadV11): InstitutionCatalogPayloadV11 => ({
  datasetVersion: catalog.datasetVersion,
  datasetMode: catalog.datasetMode,
  records: cloneValue(catalog.records) as InstitutionRecordV11[],
})

const evidenceIdFor = (institutionId: string, fieldPath: string): string =>
  `ev-${institutionId.replace(/^institution-/, '')}-${fieldPath.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`

const makeVerification = (
  institutionId: string,
  fieldPath: string,
  valueSnapshot: InstitutionEvidenceValueSnapshot,
  mode: VerificationMode,
  evidence: InstitutionEvidence[],
): InstitutionFieldVerification => {
  if (mode === 'unverified') {
    return { status: 'unverified', evidenceIds: [] }
  }

  const evidenceId = evidenceIdFor(institutionId, fieldPath)
  const expired = mode === 'expired'
  const verifiedAt = expired ? EXPIRED_VERIFIED_AT : VERIFIED_AT
  const validUntil = expired ? EXPIRED_UNTIL : VALID_UNTIL
  const evidenceBase = {
    evidenceId,
    institutionId,
    recordRevision: 1,
    fieldPath,
    valueSnapshot,
    observedAt: FACT_AS_OF,
    sourceType: 'official_document',
    sourceNote: SYNTHETIC_EVIDENCE_NOTE,
  } as const
  if (expired) {
    evidence.push({
      ...evidenceBase,
      verificationStatus: 'expired',
      verifiedAt,
      validUntil,
    })
    return { status: 'expired', evidenceIds: [evidenceId], verifiedAt, validUntil }
  }
  evidence.push({
    ...evidenceBase,
    verificationStatus: 'verified',
    verifiedAt,
    validUntil,
  })
  return { status: 'verified', evidenceIds: [evidenceId], verifiedAt, validUntil }
}

const makeProvidedField = <T>(
  institutionId: string,
  fieldPath: string,
  value: T,
  valueSnapshot: InstitutionEvidenceValueSnapshot,
  mode: VerificationMode,
  evidence: InstitutionEvidence[],
): ProvidedInstitutionField<T> => ({
  availability: 'provided',
  value,
  asOf: FACT_AS_OF,
  verification: makeVerification(institutionId, fieldPath, valueSnapshot, mode, evidence),
})

const makeUnknownField = <T>(): InstitutionField<T> => ({
  availability: 'unknown',
  value: null,
  verification: { status: 'unverified', evidenceIds: [] },
})

const makeCapability = <C extends string>(
  institutionId: string,
  fieldPath: string,
  code: C,
  status: InstitutionCapabilityStatus,
  mode: VerificationMode,
  evidence: InstitutionEvidence[],
): InstitutionCapability<C> => ({
  code,
  status,
  asOf: FACT_AS_OF,
  verification: makeVerification(
    institutionId,
    fieldPath,
    { valueType: 'stable_code', value: status },
    mode,
    evidence,
  ),
})

const makeCapabilityMatrix = <C extends string>(
  institutionId: string,
  fieldPrefix: string,
  codes: readonly C[],
  defaultStatus: InstitutionCapabilityStatus,
  mode: VerificationMode,
  overrides: Partial<Record<C, InstitutionCapabilityStatus>> | undefined,
  evidence: InstitutionEvidence[],
): InstitutionCapabilityMatrix<C> => {
  const matrix = {} as { [K in C]: InstitutionCapability<K> }
  codes.forEach((code) => {
    const override = overrides === undefined ? undefined : overrides[code]
    const status: InstitutionCapabilityStatus = override === undefined
      ? defaultStatus
      : override as InstitutionCapabilityStatus
    matrix[code] = makeCapability(
      institutionId,
      `${fieldPrefix}.${code}`,
      code,
      status,
      mode,
      evidence,
    )
  })
  return matrix
}

interface MockPriceSpecBase {
  verification: VerificationMode
}

interface MockBoundedPriceSpec extends MockPriceSpecBase {
  kind: 'bounded'
  minAmountMinor: number
  maxAmountMinor: number
}

interface MockStartingAtPriceSpec extends MockPriceSpecBase {
  kind: 'starting_at'
  minAmountMinor: number
  maxAmountMinor: null
}

type MockPriceSpec = MockBoundedPriceSpec | MockStartingAtPriceSpec

const makeMonthlyPrice = (spec: MockPriceSpec): ReferenceMonthlyPrice => {
  if (spec.kind === 'starting_at') {
    return {
      basis: 'reference_total',
      range: {
        kind: 'starting_at',
        min: { amountMinor: spec.minAmountMinor, currency: 'CNY' },
        max: null,
        period: 'month',
      },
    }
  }
  return {
    basis: 'reference_total',
    range: {
      kind: 'bounded',
      min: { amountMinor: spec.minAmountMinor, currency: 'CNY' },
      max: { amountMinor: spec.maxAmountMinor, currency: 'CNY' },
      period: 'month',
    },
  }
}

interface CapabilityOverrides {
  careLevelAcceptance?: Partial<Record<InstitutionCareLevelCode, InstitutionCapabilityStatus>>
  mobilitySupport?: Partial<Record<InstitutionMobilityCapabilityCode, InstitutionCapabilityStatus>>
  cognitiveSupport?: Partial<Record<InstitutionCognitiveCapabilityCode, InstitutionCapabilityStatus>>
  specialCare?: Partial<Record<InstitutionSpecialCareCapabilityCode, InstitutionCapabilityStatus>>
}

interface MockRecordSpec {
  institutionId: string
  name: string
  regionCode: string
  supportedTypes: readonly InstitutionTypeCode[] | null
  primaryType?: InstitutionTypeCode
  capabilityStatus: InstitutionCapabilityStatus
  capabilityVerification: VerificationMode
  capabilityOverrides?: CapabilityOverrides
  price: MockPriceSpec | null
}

const makeMedicalSupport = (): InstitutionMedicalSupportV11 => ({
  doctorRounds: makeUnknownField(),
  nurseStaff: makeUnknownField(),
  nurseStation: makeUnknownField(),
  partnerHospitals: makeUnknownField(),
  emergencyTransferSupport: {
    code: 'emergency_transfer_support',
    status: 'unknown',
    verification: { status: 'unverified', evidenceIds: [] },
  },
  clinic: makeUnknownField(),
  relationships: [],
  medicalDuty24h: makeUnknownField(),
  medicalDuty24hNote: makeUnknownField(),
})

const makeRehabilitationSupport = (): InstitutionRehabilitationSupport => {
  const features = {} as {
    [K in InstitutionRehabilitationFeatureCode]: InstitutionCapability<K>
  }
  REHABILITATION_FEATURE_CODES.forEach((code) => {
    Object.assign(features, {
      [code]: makeCapability(
        'unused',
        `rehabilitationSupport.features.${code}`,
        code,
        'unknown',
        'unverified',
        [],
      ),
    })
  })
  return { features }
}

const makeResponseTime = (): InstitutionResponseTimeV11 => ({
  responseTimeMinutes: makeUnknownField(),
  scenario: makeUnknownField(),
  statistic: makeUnknownField(),
  measurementNote: makeUnknownField(),
})

const makeStaffing = (): InstitutionStaffingV11 => ({
  counts: makeUnknownField(),
  caregiverResidentRatio: makeUnknownField(),
  caregiverCertification: {
    certifiedCaregiverCount: makeUnknownField(),
    observedCaregiverCount: makeUnknownField(),
    certifiedRatioBasisPoints: makeUnknownField(),
    certificateTypes: makeUnknownField(),
    rawStatement: makeUnknownField(),
  },
  caregiverExperienceDistribution: {
    less_than_one_year: makeUnknownField(),
    one_to_three_years: makeUnknownField(),
    three_to_five_years: makeUnknownField(),
    five_years_or_more: makeUnknownField(),
  },
  caregiverExperienceStatement: makeUnknownField(),
  nurseResponseTime: makeResponseTime(),
  caregiverResponseTime: makeResponseTime(),
  dutyStaffing24h: {
    availability: makeUnknownField(),
    staffedRoles: makeUnknownField(),
    coverageNote: makeUnknownField(),
  },
})

const makeMonitoringItem = (): InstitutionHealthMonitoringItemV11 => ({
  availability: makeUnknownField(),
  frequency: makeUnknownField(),
  serviceNote: makeUnknownField(),
})

const makeHealthMonitoring = (): InstitutionHealthMonitoringV11 => ({
  bloodPressure: makeMonitoringItem(),
  bloodOxygen: makeMonitoringItem(),
  bloodGlucose: makeMonitoringItem(),
})

const makeMeal = (): InstitutionMealV11 => ({
  mealSchedule: makeUnknownField(),
  easyChewSupport: makeUnknownField(),
  modifiedFoodSupport: makeUnknownField(),
  mealFee: makeUnknownField(),
  specialDietExtraFee: makeUnknownField(),
  serviceNote: makeUnknownField(),
})

const makeActivity = (): InstitutionActivityV11 => ({
  indoorSpace: makeUnknownField(),
  outdoorSpace: makeUnknownField(),
  offerings: [],
  zones: {
    publicActivityZone: makeUnknownField(),
    activeAgingZone: makeUnknownField(),
    careZone: makeUnknownField(),
    dementiaZone: makeUnknownField(),
  },
})

const makeTransportation = (): InstitutionTransportationV11 => ({
  metro: {
    nearestStationName: makeUnknownField(),
    distanceMeters: makeUnknownField(),
    routeNote: makeUnknownField(),
  },
  busStops: [],
  vehicleAccess: {
    availability: makeUnknownField(),
    accessNote: makeUnknownField(),
  },
})

const makePrice = (
  institutionId: string,
  spec: MockPriceSpec | null,
  evidence: InstitutionEvidence[],
): InstitutionPriceProfile => {
  const referenceMonthlyPrice = spec === null
    ? makeUnknownField<ReferenceMonthlyPrice>()
    : makeProvidedField(
      institutionId,
      'price.referenceMonthlyPrice',
      makeMonthlyPrice(spec),
      {
        valueType: 'reference_monthly_price',
        value: makeMonthlyPrice(spec),
      },
      spec.verification,
      evidence,
    )
  return {
    referenceMonthlyPrice,
    recurringComponents: RECURRING_PRICE_COMPONENT_CODES.map((component) => ({
      component,
      referenceAmount: makeUnknownField<MoneyRange<'month'>>(),
    })),
    deposit: makeUnknownField<MoneyRange<'one_time'>>(),
    oneTimeFees: [],
    adjustmentFactors: makeUnknownField(),
    priceNote: makeUnknownField(),
  }
}

const makeRecord = (spec: MockRecordSpec): InstitutionRecordV11 => {
  const evidence: InstitutionEvidence[] = []
  const { institutionId } = spec
  const identityRegion = makeProvidedField(
    institutionId,
    'identity.regionCode',
    spec.regionCode,
    { valueType: 'stable_code', value: spec.regionCode },
    spec.capabilityVerification,
    evidence,
  )
  const supportedTypes = spec.supportedTypes === null
    ? makeUnknownField<readonly InstitutionTypeCode[]>()
    : makeProvidedField(
      institutionId,
      'typeProfile.supportedTypes',
      spec.supportedTypes.slice(),
      { valueType: 'stable_code_list', value: asNonEmpty(spec.supportedTypes) },
      spec.capabilityVerification,
      evidence,
    )
  const typeProfile: InstitutionTypeProfile = {
    ...(spec.primaryType === undefined ? {} : {
      primaryType: makeProvidedField(
        institutionId,
        'typeProfile.primaryType',
        spec.primaryType,
        { valueType: 'stable_code', value: spec.primaryType },
        'unverified',
        evidence,
      ),
    }),
    supportedTypes,
  }
  const capabilities = {
    careLevelAcceptance: makeCapabilityMatrix(
      institutionId,
      'capabilities.careLevelAcceptance',
      CARE_LEVEL_CODES,
      spec.capabilityStatus,
      spec.capabilityVerification,
      spec.capabilityOverrides === undefined ? undefined : spec.capabilityOverrides.careLevelAcceptance,
      evidence,
    ),
    mobilitySupport: makeCapabilityMatrix(
      institutionId,
      'capabilities.mobilitySupport',
      MOBILITY_CODES,
      spec.capabilityStatus,
      spec.capabilityVerification,
      spec.capabilityOverrides === undefined ? undefined : spec.capabilityOverrides.mobilitySupport,
      evidence,
    ),
    cognitiveSupport: makeCapabilityMatrix(
      institutionId,
      'capabilities.cognitiveSupport',
      COGNITIVE_CODES,
      spec.capabilityStatus,
      spec.capabilityVerification,
      spec.capabilityOverrides === undefined ? undefined : spec.capabilityOverrides.cognitiveSupport,
      evidence,
    ),
    specialCare: makeCapabilityMatrix(
      institutionId,
      'capabilities.specialCare',
      SPECIAL_CARE_CODES,
      spec.capabilityStatus,
      spec.capabilityVerification,
      spec.capabilityOverrides === undefined ? undefined : spec.capabilityOverrides.specialCare,
      evidence,
    ),
  }
  const operations: {
    bedAvailability: InstitutionAvailabilityFact
    acceptingNewResidents: InstitutionField<'yes' | 'no' | 'inquiry_required' | 'unknown'>
    estimatedWait: InstitutionField<{ minDays: number, maxDays: number }>
    earliestMoveInDate: InstitutionField<string>
  } = {
    bedAvailability: { status: 'unknown', verification: { status: 'unverified', evidenceIds: [] } },
    acceptingNewResidents: makeUnknownField(),
    estimatedWait: makeUnknownField(),
    earliestMoveInDate: makeUnknownField(),
  }
  const regionSuffix = spec.regionCode.slice(-1).toUpperCase()
  return {
    contractVersion: 'institution-contract-v1.1',
    capabilityContractVersion: 'institution-capability-contract-v1',
    institutionId,
    recordRevision: 1,
    recordProvenance: 'MOCK_DEVELOPMENT_ONLY',
    recordStatus: 'published',
    identity: {
      name: makeProvidedField(
        institutionId,
        'identity.name',
        spec.name,
        { valueType: 'text', value: spec.name },
        'unverified',
        evidence,
      ),
      regionCode: identityRegion,
      regionDisplayName: makeProvidedField(
        institutionId,
        'identity.regionDisplayName',
        `开发示例区域 ${regionSuffix}（Mock）`,
        { valueType: 'text', value: `开发示例区域 ${regionSuffix}（Mock）` },
        'unverified',
        evidence,
      ),
      address: makeUnknownField(),
      coordinates: makeUnknownField(),
      establishedDate: makeUnknownField(),
      bedCapacity: makeUnknownField(),
      publicContact: makeUnknownField(),
      coverMediaId: makeUnknownField(),
    },
    typeProfile,
    capabilities,
    services: [],
    medicalSupport: makeMedicalSupport(),
    rehabilitationSupport: makeRehabilitationSupport(),
    staffing: makeStaffing(),
    healthMonitoring: makeHealthMonitoring(),
    price: makePrice(institutionId, spec.price, evidence),
    operations,
    rooms: [],
    meal: makeMeal(),
    activity: makeActivity(),
    transportation: makeTransportation(),
    majorHospitalAccess: [],
    media: [],
    vr: {
      status: 'unknown',
      url: null,
      coverMediaId: null,
      scenes: [],
      verification: { status: 'unverified', evidenceIds: [] },
    },
    qualifications: [],
    evidence,
  }
}

const DEVELOPMENT_CATALOG_V11_RECORDS: InstitutionRecordV11[] = [
  makeRecord({
    institutionId: 'institution-a-mock',
    name: '示例机构 A（Mock）',
    regionCode: 'mock-region-a',
    supportedTypes: ['medical_nursing_integrated', 'disability_care'],
    primaryType: 'medical_nursing_integrated',
    capabilityStatus: 'supported',
    capabilityVerification: 'verified',
    price: { kind: 'bounded', minAmountMinor: 650000, maxAmountMinor: 750000, verification: 'verified' },
  }),
  makeRecord({
    institutionId: 'institution-b-mock',
    name: '示例机构 B（Mock）',
    regionCode: 'mock-region-b',
    supportedTypes: ['medical_nursing_integrated', 'disability_care'],
    primaryType: 'medical_nursing_integrated',
    capabilityStatus: 'supported',
    capabilityVerification: 'verified',
    capabilityOverrides: {
      mobilitySupport: { wheelchair_support: 'requires_assessment' },
      cognitiveSupport: { dementia_acceptance: 'requires_assessment' },
      specialCare: { tube_feeding: 'requires_assessment' },
    },
    price: { kind: 'bounded', minAmountMinor: 620000, maxAmountMinor: 780000, verification: 'verified' },
  }),
  makeRecord({
    institutionId: 'institution-c-mock',
    name: '示例机构 C（Mock）',
    regionCode: 'mock-region-c',
    supportedTypes: ['active_aging'],
    primaryType: 'active_aging',
    capabilityStatus: 'unsupported',
    capabilityVerification: 'verified',
    price: null,
  }),
  makeRecord({
    institutionId: 'institution-d-mock',
    name: '示例机构 D（Mock）',
    regionCode: 'mock-region-d',
    supportedTypes: null,
    capabilityStatus: 'unknown',
    capabilityVerification: 'unverified',
    price: null,
  }),
  makeRecord({
    institutionId: 'institution-e-mock',
    name: '示例机构 E（Mock）',
    regionCode: 'mock-region-e',
    supportedTypes: ['rehabilitation_care'],
    primaryType: 'rehabilitation_care',
    capabilityStatus: 'supported',
    capabilityVerification: 'expired',
    price: { kind: 'bounded', minAmountMinor: 700000, maxAmountMinor: 1000000, verification: 'expired' },
  }),
  makeRecord({
    institutionId: 'institution-f-mock',
    name: '示例机构 F（Mock）',
    regionCode: 'mock-region-f',
    supportedTypes: ['medical_nursing_integrated', 'disability_care'],
    primaryType: 'medical_nursing_integrated',
    capabilityStatus: 'supported',
    capabilityVerification: 'verified',
    price: { kind: 'starting_at', minAmountMinor: 480000, maxAmountMinor: null, verification: 'verified' },
  }),
  makeRecord({
    institutionId: 'institution-g-mock',
    name: '示例机构 G（Mock）',
    regionCode: 'mock-region-g',
    supportedTypes: ['active_aging'],
    primaryType: 'active_aging',
    capabilityStatus: 'supported',
    capabilityVerification: 'verified',
    price: { kind: 'bounded', minAmountMinor: 450000, maxAmountMinor: 900000, verification: 'verified' },
  }),
  makeRecord({
    institutionId: 'institution-h-mock',
    name: '示例机构 H（Mock）',
    regionCode: 'mock-region-h',
    supportedTypes: ['medical_nursing_integrated', 'disability_care'],
    primaryType: 'medical_nursing_integrated',
    capabilityStatus: 'supported',
    capabilityVerification: 'verified',
    price: { kind: 'bounded', minAmountMinor: 700000, maxAmountMinor: 780000, verification: 'verified' },
  }),
]

const assertDevelopmentRecordV11 = (record: InstitutionRecordV11): InstitutionRecordV11 => {
  const result = validateInstitutionRecordV11(record)
  if (!result.ok) {
    throw new Error('Invalid Institution V1.1 development catalog record')
  }
  return result.value
}

const VALIDATED_DEVELOPMENT_CATALOG_V11_RECORDS =
  DEVELOPMENT_CATALOG_V11_RECORDS.map(assertDevelopmentRecordV11)

const DEVELOPMENT_CATALOG_V11: InstitutionCatalogPayloadV11 = {
  datasetVersion: 'institution-catalog-development-v1.1',
  datasetMode: 'MOCK_DEVELOPMENT_ONLY',
  records: VALIDATED_DEVELOPMENT_CATALOG_V11_RECORDS,
}

/**
 * Frozen Recommendation V1 still requires institution-contract-v1. This view
 * is an explicit lossless V1 projection; no V1.1 fact is converted into a V1
 * capability, matching field, price, or recommendation reason.
 */
const DEVELOPMENT_CATALOG_RECORDS: InstitutionRecord[] =
  VALIDATED_DEVELOPMENT_CATALOG_V11_RECORDS.map(projectInstitutionRecordV11ToV1)

const DEVELOPMENT_CATALOG: InstitutionCatalogPayload = {
  datasetVersion: 'institution-catalog-development-v1',
  datasetMode: 'MOCK_DEVELOPMENT_ONLY',
  records: DEVELOPMENT_CATALOG_RECORDS,
}

/** A caller-visible snapshot; mutating it cannot alter the provider source. */
export const MOCK_INSTITUTION_CATALOG_RECORDS: readonly InstitutionRecord[] =
  cloneValue(DEVELOPMENT_CATALOG_RECORDS) as InstitutionRecord[]

export const MOCK_INSTITUTION_CATALOG: InstitutionCatalogPayload =
  cloneCatalog(DEVELOPMENT_CATALOG)

/** Canonical eight-record App development catalog after the V1.1 migration. */
export const MOCK_INSTITUTION_CATALOG_V11_RECORDS: readonly InstitutionRecordV11[] =
  cloneValue(VALIDATED_DEVELOPMENT_CATALOG_V11_RECORDS) as InstitutionRecordV11[]

export const MOCK_INSTITUTION_CATALOG_V11: InstitutionCatalogPayloadV11 =
  cloneCatalogV11(DEVELOPMENT_CATALOG_V11)

/** Development provider: each call returns a fresh isolated copy of all eight records. */
export const mockInstitutionCatalogProvider: InstitutionCatalogProvider = {
  loadCatalog: (): Promise<InstitutionCatalogPayload> =>
    Promise.resolve(cloneCatalog(DEVELOPMENT_CATALOG)),
}
