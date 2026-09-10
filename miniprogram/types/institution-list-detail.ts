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
}

export interface InstitutionNavigationSourceContext extends InstitutionNavigationSourceContextInput {
  kind: 'institution_navigation_source_context_v1'
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
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2'
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

export interface InstitutionDetailSectionsV12 {
  basic: InstitutionDetailBasicDisplay
  recommendation: InstitutionDetailRecommendationDisplay | null
  media: InstitutionDetailMediaDisplay
  careCapability: InstitutionCareCapabilityDisplay
  careProcess: { state: 'not_integrated' | 'not_in_source_contract' }
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
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2'
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
}

export type InstitutionCanonicalCapabilityCode =
  | InstitutionCareLevelCode
  | InstitutionMobilityCapabilityCode
  | InstitutionCognitiveCapabilityCode
  | InstitutionSpecialCareCapabilityCode

export type InstitutionServiceAvailabilityFact = InstitutionField<InstitutionServiceAvailabilityV11>

export type InstitutionMealScheduleFact = InstitutionField<InstitutionMealScheduleCodeV11>
