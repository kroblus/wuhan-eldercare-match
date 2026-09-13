/**
 * V1.2-A0-2 application contracts for the Institution List / Detail flow.
 *
 * These are presentation-oriented contracts. They deliberately do not
 * replace `InstitutionRecordV11` or publish an institution-contract-v1.2
 * record shape.
 */

import type {
  InstitutionCareLevelCode,
  InstitutionCognitiveCapabilityCode,
  InstitutionEffectiveCapabilityStatus,
  InstitutionField,
  InstitutionMobilityCapabilityCode,
  InstitutionRecordProvenance,
  InstitutionRecordStatus,
  InstitutionRoomTypeCode,
  InstitutionSpecialCareCapabilityCode,
  InstitutionTypeCode,
} from './institution'
import type {
  InstitutionMealScheduleCodeV11,
  InstitutionRecordV11,
  InstitutionServiceAvailabilityV11,
} from './institution-v1-1'
import type {
  CareProcessPresenceCode,
  CareRecordCompletenessCode,
  CareRecordFrequencyCode,
  CareRecordTraceabilityCode,
  HandoverContentCode,
} from './institution-v1-2'
import type {
  InstitutionOfficialPhonePurposeCode,
  InstitutionPublicContentSourceTypeV1,
  InstitutionRecordV121,
} from './institution-v1-2-1'
import type {
  InstitutionCatalogCurrentPointerV121,
  InstitutionCatalogPresentationMetadataV121,
} from './institution-catalog-v1-2-1'
import type { RecommendationPolicyVersion } from './recommendation'

export interface InstitutionCanonicalIdentity {
  institutionId: string
  recordRevision: number
}

export type InstitutionApplicationSource = 'direct' | 'recommendation'

export type InstitutionRouteSource = 'direct_list' | 'recommendation' | 'direct_link'

export type InstitutionPresentationAvailability = 'provided' | 'unknown' | 'unavailable'

export type InstitutionEffectiveVerification = 'current_verified' | 'unverified' | 'expired'

export type InstitutionDataDisclosure =
  | { kind: 'PRODUCTION'; text: null }
  | { kind: 'MOCK_DEVELOPMENT_ONLY'; text: string }

export interface InstitutionPresentationFact<T> {
  availability: InstitutionPresentationAvailability
  value: T | null
  effectiveVerification: InstitutionEffectiveVerification
}

export interface InstitutionReferenceMonthlyPriceDisplay {
  kind: 'bounded' | 'starting_at'
  minAmountMinor: number
  maxAmountMinor: number | null
  currency: 'CNY'
  period: 'month'
  basis: 'reference_total'
}

export interface InstitutionCoverDisplay {
  state: 'current_verified' | 'placeholder'
  mediaId: string | null
  url: string | null
}

export interface InstitutionMediaDisplayItem {
  mediaId: string
  role: 'cover' | 'gallery'
  category: string
  availability: InstitutionPresentationAvailability
  effectiveVerification: InstitutionEffectiveVerification
  displayUrl: string | null
  caption: string | null
  sortOrder: number | null
}

export interface InstitutionVrDisplayState {
  state: 'available' | 'unavailable' | 'unknown'
  canNavigate: boolean
  sceneCount: number
}

export interface InstitutionVerifiedDisplayTag {
  code: string
  fieldPath: string
}

export type InstitutionRecommendationCandidateGroup =
  | 'cards'
  | 'nearMatches'
  | 'conditionalCandidates'

export interface InstitutionRecommendationReasonRef {
  code: string
  reference?: string
}

export interface InstitutionRecommendationDifferenceRef {
  code: string
  reference?: string
}

export interface InstitutionRecommendationCandidateProjection {
  identity: InstitutionCanonicalIdentity
  group: InstitutionRecommendationCandidateGroup
  order: number
  tier: 'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL'
  reasons: readonly InstitutionRecommendationReasonRef[]
  differences: readonly InstitutionRecommendationDifferenceRef[]
}

export interface InstitutionContextManifestEntry {
  identity: InstitutionCanonicalIdentity
  recordProvenance: InstitutionRecordProvenance
  recordStatus: InstitutionRecordStatus
  disposition: 'included' | 'excluded'
}

export interface InstitutionNavigationSourceContextInput {
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  recommendationContractVersion: 'recommendation-contract-v2'
  recommendationRulesetVersion: 'recommendation-ruleset-v2'
  recommendationPolicyVersion: RecommendationPolicyVersion
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
  manifest: readonly InstitutionContextManifestEntry[]
  candidates: readonly InstitutionRecommendationCandidateProjection[]
  /** Presentation-only exact content references; never recommendation input. */
  publicContentPins?: readonly InstitutionPublicContentPresentationPinV121[]
}

export interface InstitutionNavigationSourceContext extends InstitutionNavigationSourceContextInput {
  kind: 'institution_navigation_source_context_v1'
}

/**
 * An immutable presentation reference for a recommendation-pinned Detail.
 * `contentRevision` versions the public sidecar only; it is not an Institution
 * identity and must never be used for matching or current-record selection.
 */
export interface InstitutionPublicContentPresentationPinV121 {
  identity: InstitutionCanonicalIdentity
  contentRevision: number
}

export interface InstitutionCatalogPresentationMetadataEntry {
  identity: InstitutionCanonicalIdentity
  displayOrder: number
}

export interface InstitutionCatalogPresentationMetadata {
  entries: readonly InstitutionCatalogPresentationMetadataEntry[]
}

export type InstitutionListOrderingKind =
  | 'CURATED_DISPLAY_ORDER_V1'
  | 'CANONICAL_IDENTITY_ASC_V1'
  | 'RECOMMENDATION_CONTEXT_V1'

export interface InstitutionListOrderingGroup {
  group: 'recommendation' | 'conditional' | 'other'
  candidateGroup?: InstitutionRecommendationCandidateGroup
  identityKeys: readonly string[]
}

export interface InstitutionListOrderingManifestV12 {
  kind: InstitutionListOrderingKind
  source: InstitutionApplicationSource
  groups: readonly InstitutionListOrderingGroup[]
}

export interface InstitutionListDisplayItemV12 {
  institutionId: string
  recordRevision: number
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2' | 'institution-contract-v1.2.1'
  recordProvenance: 'PRODUCTION_CANDIDATE' | 'MOCK_DEVELOPMENT_ONLY'
  recordStatus: 'published'
  name: InstitutionPresentationFact<string>
  region: InstitutionPresentationFact<{ code: string; displayName: string }>
  institutionType: InstitutionPresentationFact<readonly InstitutionTypeCode[]>
  referenceMonthlyPrice: InstitutionPresentationFact<InstitutionReferenceMonthlyPriceDisplay>
  cover: InstitutionCoverDisplay
  vr: InstitutionVrDisplayState
  verifiedDisplayTags: readonly InstitutionVerifiedDisplayTag[]
  recommendationPlacement: InstitutionRecommendationPlacement | null
}

export interface InstitutionRecommendationPlacement {
  group: InstitutionRecommendationCandidateGroup
  order: number
  tier: 'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL'
}

export interface InstitutionListApplicationSnapshotV12 {
  kind: 'institution_list_application_snapshot_v1_2'
  snapshotVersion: 'institution-list-application-snapshot-v1.2'
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  dataDisclosure: InstitutionDataDisclosure
  source: InstitutionApplicationSource
  sourceContextRef: string | null
  ordering: InstitutionListOrderingManifestV12
  recommendedCandidates: readonly InstitutionListDisplayItemV12[]
  otherCurrentPartners: readonly InstitutionListDisplayItemV12[]
  displayInstitutions: readonly InstitutionListDisplayItemV12[]
}

export interface InstitutionCapabilityDisplayItem {
  code: string
  status: InstitutionEffectiveCapabilityStatus
  effectiveVerification: InstitutionEffectiveVerification
}

export interface InstitutionCareCapabilityDisplay {
  careLevelAcceptance: readonly InstitutionCapabilityDisplayItem[]
  mobilitySupport: readonly InstitutionCapabilityDisplayItem[]
  cognitiveSupport: readonly InstitutionCapabilityDisplayItem[]
  specialCare: readonly InstitutionCapabilityDisplayItem[]
}

export interface InstitutionDetailBasicDisplay {
  name: InstitutionPresentationFact<string>
  region: InstitutionPresentationFact<{ code: string; displayName: string }>
  address: InstitutionPresentationFact<string>
  institutionType: InstitutionPresentationFact<readonly InstitutionTypeCode[]>
}

export interface InstitutionDetailRecommendationDisplay {
  group: InstitutionRecommendationCandidateGroup
  order: number
  tier: 'EXACT' | 'SOFT_NEAR' | 'CONDITIONAL'
  reasons: readonly InstitutionRecommendationReasonRef[]
  differences: readonly InstitutionRecommendationDifferenceRef[]
}

export interface InstitutionRevisionDisplayContext {
  kind: 'CURRENT_INSTITUTION_CONTEXT' | 'PINNED_RECOMMENDATION_REVISION'
  state: 'current' | 'different_current_revision_available' | 'current_revision_unknown' | 'historical_inactive'
  originalIdentity: InstitutionCanonicalIdentity
  currentIdentity: InstitutionCanonicalIdentity | null
}

export interface InstitutionDetailMediaDisplay {
  cover: InstitutionCoverDisplay
  gallery: readonly InstitutionMediaDisplayItem[]
  vr: InstitutionVrDisplayState
}

export interface InstitutionDetailRoomDisplay {
  roomId: string
  name: InstitutionPresentationFact<string>
  roomType: InstitutionPresentationFact<InstitutionRoomTypeCode>
  areaSquareMeters: InstitutionPresentationFact<{ min: number; max: number }>
  bedType: InstitutionPresentationFact<string>
  features: Readonly<Record<string, InstitutionPresentationFact<string>>>
  referencePrice: InstitutionPresentationFact<unknown>
  mediaIds: readonly string[]
}

export type InstitutionV121FutureAvailability = 'provided' | 'unknown' | 'unavailable'

export interface InstitutionPublicIntroductionApplicationSnapshotV121 {
  status: 'ready' | 'hidden_no_pin' | 'hidden_no_current_head' | 'hidden_not_found' | 'unavailable'
  contentRevision: number | null
  text: string | null
  sourceType: InstitutionPublicContentSourceTypeV1 | null
  updatedAt: string | null
}

export interface InstitutionOfficialPhoneApplicationSnapshotV121 {
  officialPhoneKey: string
  purpose: InstitutionOfficialPhonePurposeCode
  displayValue: string | null
  dialValue: string | null
  extension: string | null
  status: 'current_verified' | 'unverified_with_source' | 'unverified_without_source' | 'expired'
  verifiedDate: string | null
  callActionAvailable: boolean
}

export interface InstitutionOfficialContactApplicationSnapshotV121 {
  status: InstitutionV121FutureAvailability
  directory: InstitutionPresentationFact<'present' | 'absent'>
  phones: readonly InstitutionOfficialPhoneApplicationSnapshotV121[]
}

export interface InstitutionOfficialAddressApplicationSnapshotV121 {
  status: InstitutionV121FutureAvailability
  formattedAddress: string | null
  effectiveVerification: InstitutionEffectiveVerification
}

export type InstitutionMapApplicationStatusV121 =
  | 'available'
  | 'address_unknown'
  | 'address_unavailable'
  | 'address_unverified'
  | 'address_expired'
  | 'geo_unknown'
  | 'geo_unavailable'
  | 'geo_unverified'
  | 'geo_expired'
  | 'unavailable'

export interface InstitutionMapApplicationSnapshotV121 {
  status: InstitutionMapApplicationStatusV121
  institutionName: string
  formattedAddress: string | null
  latitude: number | null
  longitude: number | null
  coordinateSystem: 'gcj02' | null
  addressVerification: InstitutionEffectiveVerification | null
  geoVerification: InstitutionEffectiveVerification | null
  mapActionAvailable: boolean
}

export interface InstitutionCareRecordApplicationSnapshotV121 {
  presence: InstitutionPresentationFact<CareProcessPresenceCode>
  completeness: InstitutionPresentationFact<CareRecordCompletenessCode>
  frequency: InstitutionPresentationFact<readonly CareRecordFrequencyCode[]>
  traceability: InstitutionPresentationFact<CareRecordTraceabilityCode>
}

export type InstitutionCareHandoverContentApplicationSnapshotV121 = Readonly<{
  [K in HandoverContentCode]: InstitutionPresentationFact<CareProcessPresenceCode>
}>

export interface InstitutionCareProcessApplicationSnapshotV121 {
  status: InstitutionV121FutureAvailability
  careRecord: InstitutionCareRecordApplicationSnapshotV121
  shiftHandover24h: {
    presence: InstitutionPresentationFact<CareProcessPresenceCode>
    contents: InstitutionCareHandoverContentApplicationSnapshotV121
  }
}

export interface InstitutionDetailFutureSectionsV121 {
  publicIntroduction: InstitutionPublicIntroductionApplicationSnapshotV121
  officialContact: InstitutionOfficialContactApplicationSnapshotV121
  officialAddress: InstitutionOfficialAddressApplicationSnapshotV121
  mapLocation: InstitutionMapApplicationSnapshotV121
  careProcess: InstitutionCareProcessApplicationSnapshotV121
}

export interface InstitutionDetailSectionsV12 {
  basic: InstitutionDetailBasicDisplay
  recommendation: InstitutionDetailRecommendationDisplay | null
  media: InstitutionDetailMediaDisplay
  careCapability: InstitutionCareCapabilityDisplay
  careProcess: { state: 'not_integrated' | 'not_in_source_contract' }
  /** Prepared for V1.2.1 consumers; current WXML intentionally ignores it. */
  futureV121?: InstitutionDetailFutureSectionsV121
  staffing: Readonly<Record<string, unknown>>
  medicalRehabilitationMonitoring: Readonly<Record<string, unknown>>
  rooms: readonly InstitutionDetailRoomDisplay[]
  meals: Readonly<Record<string, InstitutionPresentationFact<unknown>>>
  activity: Readonly<Record<string, unknown>>
  transportHospital: Readonly<Record<string, unknown>>
  price: Readonly<Record<string, InstitutionPresentationFact<unknown> | readonly unknown[]>>
  qualifications: readonly Readonly<Record<string, unknown>>[]
  consultantVisit: { state: 'not_integrated' | 'not_in_source_contract' }
}

export interface InstitutionDetailActionAvailability {
  canOpenVr: boolean
  canContactConsultant: boolean
  canCreateAppointment: boolean
  canViewCurrentRevision: boolean
}

export interface InstitutionDetailApplicationSnapshotV12 {
  kind: 'institution_detail_application_snapshot_v1_2'
  snapshotVersion: 'institution-detail-application-snapshot-v1.2'
  identity: InstitutionCanonicalIdentity
  contextKind:
    | 'DIRECT_CURRENT'
    | 'RECOMMENDATION_PINNED'
    | 'HISTORICAL_READ_ONLY'
    | 'CURRENT_INSTITUTION_CONTEXT'
  source: InstitutionApplicationSource
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2' | 'institution-contract-v1.2.1'
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  dataDisclosure: InstitutionDataDisclosure
  recordProvenance: 'PRODUCTION_CANDIDATE' | 'MOCK_DEVELOPMENT_ONLY'
  recordStatus: 'published' | 'suspended' | 'archived'
  revisionContext: InstitutionRevisionDisplayContext
  recommendationContext: InstitutionDetailRecommendationDisplay | null
  sections: InstitutionDetailSectionsV12
  actions: InstitutionDetailActionAvailability
}

export type InstitutionListPageStateV12 =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'catalog_error'
  | 'source_context_error'
  | 'projection_error'

export type InstitutionDetailPageStateV12 =
  | 'loading'
  | 'ready'
  | 'route_error'
  | 'not_found'
  | 'revision_not_found'
  | 'catalog_error'
  | 'source_context_error'
  | 'projection_error'

export interface InstitutionListApplicationErrorV12 {
  code: 'INSTITUTION_CATALOG_ERROR' | 'INSTITUTION_SOURCE_CONTEXT_ERROR' | 'INSTITUTION_LIST_PROJECTION_ERROR'
  causeCode: string
}

export interface InstitutionDetailApplicationErrorV12 {
  code:
    | 'INSTITUTION_ROUTE_ERROR'
    | 'INSTITUTION_NOT_FOUND'
    | 'INSTITUTION_REVISION_NOT_FOUND'
    | 'INSTITUTION_RECORD_NOT_DISPLAYABLE'
    | 'INSTITUTION_CATALOG_ERROR'
    | 'INSTITUTION_SOURCE_CONTEXT_ERROR'
    | 'INSTITUTION_DETAIL_PROJECTION_ERROR'
  causeCode: string
}

export type InstitutionListApplicationResultV12 =
  | { ok: true; value: InstitutionListApplicationSnapshotV12 }
  | { ok: false; error: InstitutionListApplicationErrorV12 }

export type InstitutionDetailApplicationResultV12 =
  | { ok: true; value: InstitutionDetailApplicationSnapshotV12 }
  | { ok: false; error: InstitutionDetailApplicationErrorV12 }

export type InstitutionCurrentCatalogDataset = {
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  records: readonly InstitutionRecordV11[]
  /** Present only when the current provider was loaded through V1.2.1. */
  sourceContractVersion?: 'institution-contract-v1.2.1'
  sourceRecordsV121?: readonly InstitutionRecordV121[]
  currentPointersV121?: readonly InstitutionCatalogCurrentPointerV121[]
  presentationV121?: InstitutionCatalogPresentationMetadataV121
}

export type InstitutionCanonicalCapabilityCode =
  | InstitutionCareLevelCode
  | InstitutionMobilityCapabilityCode
  | InstitutionCognitiveCapabilityCode
  | InstitutionSpecialCareCapabilityCode

export type InstitutionServiceAvailabilityFact = InstitutionField<InstitutionServiceAvailabilityV11>

export type InstitutionMealScheduleFact = InstitutionField<InstitutionMealScheduleCodeV11>
