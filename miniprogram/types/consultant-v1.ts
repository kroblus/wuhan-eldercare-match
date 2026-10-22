/**
 * B1-backed Consultant runtime and public application contracts.
 *
 * This file contains data shapes only. It intentionally has no I/O, state,
 * provider dependency, or user-facing policy beyond the frozen B1 shapes.
 */

export const CONSULTANT_CONTRACT_VERSION_V1 = 'consultant-permission-contract-v1' as const
export type ConsultantContractVersionV1 = typeof CONSULTANT_CONTRACT_VERSION_V1

export const GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_VERSION_V1 = 'global-consultant-snapshot-contract-v1' as const
export type GlobalConsultantSnapshotContractVersionV1 = typeof GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_VERSION_V1

export const GLOBAL_CONSULTANT_SELECTION_ROLE_V1 = 'platform_primary_consultant' as const
export type GlobalConsultantSelectionRoleV1 = typeof GLOBAL_CONSULTANT_SELECTION_ROLE_V1

export type ConsultantServiceStatusV1 = 'active' | 'inactive' | 'unknown'

export interface ConsultantServiceAreaV1 {
  displayName: string
}

export type ContactReviewStatusV1 = 'approved' | 'pending_review' | 'rejected' | 'unknown'

export type ConsultantPlatformPhoneConfigV1 =
  | {
      sourceState: 'configured'
      value: string
      reviewStatus: ContactReviewStatusV1
    }
  | { sourceState: 'unavailable' }
  | { sourceState: 'unknown' }

export type WechatQrReviewStatusV1 = 'approved' | 'pending_review' | 'rejected' | 'unknown'
export type WechatQrLifecycleStatusV1 = 'active' | 'inactive' | 'expired' | 'unknown'

export type ConsultantWechatQrConfigV1 =
  | {
      sourceState: 'configured'
      wechatQrMediaId: string
      reviewStatus: WechatQrReviewStatusV1
      lifecycleStatus: WechatQrLifecycleStatusV1
    }
  | { sourceState: 'unavailable' }
  | { sourceState: 'unknown' }

export interface ConsultantProfileV1 {
  contractVersion: ConsultantContractVersionV1
  consultantId: string
  displayName: string
  serviceStatus: ConsultantServiceStatusV1
  serviceArea: ConsultantServiceAreaV1
  platformPhone: ConsultantPlatformPhoneConfigV1
  enterpriseWechatQr: ConsultantWechatQrConfigV1
}

export type ConsultantAssignmentStatusV1 = 'active' | 'inactive'

export interface InstitutionConsultantAssignmentV1 {
  assignmentId: string
  institutionId: string
  consultantId: string
  status: ConsultantAssignmentStatusV1
}

export interface ConsultantCanonicalInstitutionContextV1 {
  institutionId: string
  recordRevision: number
}

export type ConsultantDataProvenanceV1 = 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'

export type GlobalConsultantSelectionConfigurationV1 =
  | {
      role: GlobalConsultantSelectionRoleV1
      sourceState: 'configured'
      consultantId: string
    }
  | {
      role: GlobalConsultantSelectionRoleV1
      sourceState: 'missing' | 'unavailable' | 'unknown'
    }

export type ConsultantPublicPhoneStatusV1 = 'available' | 'unavailable' | 'unknown' | 'missing'

export type ConsultantPublicPhoneProjectionV1 =
  | {
      status: 'available'
      label: '养老顾问电话' | '带看顾问电话'
      displayValue: string
      dialValue: string
      actionAvailable: true
    }
  | {
      status: 'unavailable' | 'unknown' | 'missing'
      label: '养老顾问电话' | '带看顾问电话'
      displayValue?: never
      dialValue?: never
      actionAvailable: false
    }

export type ConsultantPublicWechatQrStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'

export type ConsultantPublicWechatQrProjectionV1 =
  | {
      status: 'available'
      label: '企业微信养老顾问'
      publicImageUrl: string
      actionAvailable: true
    }
  | {
      status: 'unavailable' | 'inactive' | 'expired' | 'unknown' | 'missing'
      label: '企业微信养老顾问'
      publicImageUrl?: never
      actionAvailable: false
    }

export interface ConsultantPublicProfileV1 {
  consultantId: string
  displayName: string
  serviceStatus: ConsultantServiceStatusV1
  serviceAreaDisplayName: string
  phone: ConsultantPublicPhoneProjectionV1
  enterpriseWechatQr: ConsultantPublicWechatQrProjectionV1
}

export type ConsultantResolutionStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'
  | 'ambiguous'

export interface InstitutionConsultantContactApplicationSnapshotV1 {
  kind: 'institution_consultant_contact_application_snapshot_v1'
  contractVersion: ConsultantContractVersionV1
  institutionIdentity: ConsultantCanonicalInstitutionContextV1
  snapshotAsOf: string
  dataProvenance: ConsultantDataProvenanceV1
  assignmentSource: 'institution_assignment' | 'default_consultant' | null
  resolutionStatus: ConsultantResolutionStatusV1
  consultant: ConsultantPublicProfileV1 | null
}

export type GlobalConsultantSelectionStatusV1 =
  | 'configured'
  | 'missing'
  | 'unavailable'
  | 'unknown'

export type GlobalConsultantResolutionStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'

export interface GlobalConsultantPublicApplicationSnapshotV1 {
  kind: 'global_consultant_public_application_snapshot_v1'
  contractVersion: GlobalConsultantSnapshotContractVersionV1
  context: {
    kind: 'platform_global_consultant'
    selectionRole: GlobalConsultantSelectionRoleV1
    selectionSource: 'platform_configuration'
  }
  snapshotAsOf: string
  dataProvenance: ConsultantDataProvenanceV1
  selectionStatus: GlobalConsultantSelectionStatusV1
  resolutionStatus: GlobalConsultantResolutionStatusV1
  consultant: ConsultantPublicProfileV1 | null
}

export interface GlobalConsultantPublicApplicationFailureV1 {
  kind: 'global_consultant_public_application_failure_v1'
  status: 'unavailable'
}

export type GlobalConsultantPublicApplicationResultV1 =
  | { ok: true; value: GlobalConsultantPublicApplicationSnapshotV1 }
  | { ok: false; error: GlobalConsultantPublicApplicationFailureV1 }

export type ConsultantDefaultConfigurationV1 =
  | { enabled: false }
  | { enabled: true; consultantId: string }

export type ConsultantPublicMediaResolutionStatusV1 =
  | 'available'
  | 'unavailable'
  | 'inactive'
  | 'expired'
  | 'unknown'
  | 'missing'

export type ConsultantPublicMediaResolutionV1 =
  | { status: 'available'; publicImageUrl: string }
  | { status: 'unavailable' | 'inactive' | 'expired' | 'unknown' | 'missing' }

export type ConsultantValidationErrorCodeV1 =
  | 'INVALID_CONSULTANT_PROFILE'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_INSTITUTION_CONTEXT'
  | 'INVALID_DEFAULT_CONFIGURATION'
  | 'INVALID_MEDIA_RESOLUTION'
  | 'INVALID_SNAPSHOT_AS_OF'
  | 'INVALID_PROVENANCE'
  | 'INVALID_GLOBAL_CONFIGURATION'
  | 'INVALID_GLOBAL_REQUEST'
  | 'INVALID_VALUE'

export interface ConsultantValidationIssueV1 {
  code: ConsultantValidationErrorCodeV1
  path: string
}

export type ConsultantValidationResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly ConsultantValidationIssueV1[] }

export type ConsultantAssignmentLookupStateV1 = 'missing' | 'unknown' | 'available' | 'ambiguous'

export type ConsultantAssignmentLookupV1 =
  | { status: 'missing' }
  | { status: 'unknown' }
  | { status: 'available'; assignments: readonly unknown[] }
  | { status: 'ambiguous' }

export interface ConsultantAssignmentInspectionV1 {
  status: 'missing' | 'unknown' | 'active' | 'inactive' | 'ambiguous'
  assignment: InstitutionConsultantAssignmentV1 | null
}

export type ConsultantApplicationFailureCodeV1 =
  | 'INVALID_INPUT'
  | 'PROVIDER_FAILURE'
  | 'PROJECTION_FAILURE'

export type ConsultantApplicationFailureCauseCodeV1 =
  | 'INVALID_INSTITUTION_CONTEXT'
  | 'INVALID_SNAPSHOT_AS_OF'
  | 'INVALID_PROVENANCE'
  | 'INVALID_ASSIGNMENT_PAYLOAD'
  | 'INVALID_DEFAULT_CONFIGURATION'
  | 'INVALID_CONSULTANT_PROFILE'
  | 'INVALID_MEDIA_RESULT'
  | 'ASSIGNMENT_PROVIDER_FAILED'
  | 'DEFAULT_PROVIDER_FAILED'
  | 'PROFILE_PROVIDER_FAILED'
  | 'MEDIA_PROVIDER_FAILED'
  | 'PUBLIC_SNAPSHOT_INVARIANT_FAILED'

export interface ConsultantApplicationErrorV1 {
  code: ConsultantApplicationFailureCodeV1
  causeCode: ConsultantApplicationFailureCauseCodeV1
}

export type ConsultantApplicationResultV1 =
  | { ok: true; value: InstitutionConsultantContactApplicationSnapshotV1 }
  | { ok: false; error: ConsultantApplicationErrorV1 }
