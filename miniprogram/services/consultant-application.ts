import {
  deriveConsultantResolutionStatusV1,
  inspectAssignmentLookupV1,
  projectConsultantPhoneV1,
  projectConsultantQrV1,
  resolveConsultantAssignmentV1,
  validateCanonicalInstitutionContextV1,
  validateConsultantProfileV1,
  validateDataProvenanceV1,
  validateDefaultConsultantConfigurationV1,
  validatePublicMediaResolutionV1,
  validateSnapshotAsOfV1,
} from '../domain/consultant'
import type {
  ConsultantApplicationFailureCauseCodeV1,
  ConsultantApplicationResultV1,
  ConsultantCanonicalInstitutionContextV1,
  ConsultantDataProvenanceV1,
  ConsultantPublicMediaResolutionV1,
  ConsultantPublicProfileV1,
  InstitutionConsultantContactApplicationSnapshotV1,
} from '../types/consultant-v1'
import { CONSULTANT_CONTRACT_VERSION_V1 } from '../types/consultant-v1'

export interface ConsultantApplicationRequestV1 {
  institutionIdentity: unknown
  snapshotAsOf: unknown
}

export interface ConsultantPublicMediaRequestV1 {
  consultantId: string
  wechatQrMediaId: string
  snapshotAsOf: string
}

/**
 * Read-only foundation port. Implementations are deliberately opaque to the
 * application layer: validation occurs at the trust boundary before any
 * value is projected to the public snapshot.
 */
export interface ConsultantFoundationProviderV1 {
  readonly dataProvenance: ConsultantDataProvenanceV1
  loadAssignments(context: ConsultantCanonicalInstitutionContextV1): unknown
  loadConsultantProfile(consultantId: string): unknown
  loadDefaultConsultant(): unknown
  resolvePublicMedia(input: ConsultantPublicMediaRequestV1): unknown
}

export interface ConsultantApplicationServiceV1 {
  resolveForInstitution(input: ConsultantApplicationRequestV1): ConsultantApplicationResultV1
}

const failure = (
  code: 'INVALID_INPUT' | 'PROVIDER_FAILURE' | 'PROJECTION_FAILURE',
  causeCode: ConsultantApplicationFailureCauseCodeV1,
): ConsultantApplicationResultV1 => ({ ok: false, error: { code, causeCode } })

const buildSnapshot = (
  context: ConsultantCanonicalInstitutionContextV1,
  snapshotAsOf: string,
  dataProvenance: ConsultantDataProvenanceV1,
  assignmentSource: 'institution_assignment' | 'default_consultant' | null,
  resolutionStatus: InstitutionConsultantContactApplicationSnapshotV1['resolutionStatus'],
  consultant: ConsultantPublicProfileV1 | null,
): ConsultantApplicationResultV1 => ({
  ok: true,
  value: {
    kind: 'institution_consultant_contact_application_snapshot_v1',
    contractVersion: CONSULTANT_CONTRACT_VERSION_V1,
    institutionIdentity: {
      institutionId: context.institutionId,
      recordRevision: context.recordRevision,
    },
    snapshotAsOf,
    dataProvenance,
    assignmentSource,
    resolutionStatus,
    consultant,
  },
})

const isProvider = (value: unknown): value is ConsultantFoundationProviderV1 => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return typeof candidate.loadAssignments === 'function'
    && typeof candidate.loadConsultantProfile === 'function'
    && typeof candidate.loadDefaultConsultant === 'function'
    && typeof candidate.resolvePublicMedia === 'function'
}

const shouldResolveMedia = (
  profile: { serviceStatus: string; enterpriseWechatQr: { sourceState: string; reviewStatus?: string; lifecycleStatus?: string } },
): boolean => profile.serviceStatus === 'active'
  && profile.enterpriseWechatQr.sourceState === 'configured'
  && profile.enterpriseWechatQr.reviewStatus === 'approved'
  && profile.enterpriseWechatQr.lifecycleStatus === 'active'

const resolveProfileMedia = (
  provider: ConsultantFoundationProviderV1,
  profile: import('../types/consultant-v1').ConsultantProfileV1,
  snapshotAsOf: string,
): { ok: true; value: ConsultantPublicMediaResolutionV1 | null }
  | { ok: false; error: { code: 'PROVIDER_FAILURE'; causeCode: 'INVALID_MEDIA_RESULT' | 'MEDIA_PROVIDER_FAILED' } } => {
  if (!shouldResolveMedia(profile)) {
    return { ok: true, value: null }
  }
  const qr = profile.enterpriseWechatQr
  if (qr.sourceState !== 'configured') {
    return { ok: true, value: null }
  }
  try {
    const raw = provider.resolvePublicMedia({
      consultantId: profile.consultantId,
      wechatQrMediaId: qr.wechatQrMediaId,
      snapshotAsOf,
    })
    const validation = validatePublicMediaResolutionV1(raw)
    if (!validation.ok) {
      return { ok: false, error: { code: 'PROVIDER_FAILURE', causeCode: 'INVALID_MEDIA_RESULT' } }
    }
    return { ok: true, value: validation.value }
  } catch (_error) {
    return { ok: false, error: { code: 'PROVIDER_FAILURE', causeCode: 'MEDIA_PROVIDER_FAILED' } }
  }
}

const createPublicProfile = (
  profile: import('../types/consultant-v1').ConsultantProfileV1,
  mediaResolution: ConsultantPublicMediaResolutionV1 | null,
): ConsultantPublicProfileV1 => {
  const phone = projectConsultantPhoneV1(profile)
  const qr = projectConsultantQrV1(profile, mediaResolution)
  return {
    consultantId: profile.consultantId,
    displayName: profile.displayName,
    serviceStatus: profile.serviceStatus,
    serviceAreaDisplayName: profile.serviceArea.displayName,
    phone,
    enterpriseWechatQr: qr,
  }
}

export const createConsultantApplicationServiceV1 = (
  provider: ConsultantFoundationProviderV1,
): ConsultantApplicationServiceV1 => ({
  resolveForInstitution(input: ConsultantApplicationRequestV1): ConsultantApplicationResultV1 {
    const contextValidation = validateCanonicalInstitutionContextV1(input && input.institutionIdentity)
    if (!contextValidation.ok) {
      return failure('INVALID_INPUT', 'INVALID_INSTITUTION_CONTEXT')
    }
    const snapshotValidation = validateSnapshotAsOfV1(input && input.snapshotAsOf)
    if (!snapshotValidation.ok) {
      return failure('INVALID_INPUT', 'INVALID_SNAPSHOT_AS_OF')
    }
    if (!isProvider(provider)) {
      return failure('PROVIDER_FAILURE', 'PROFILE_PROVIDER_FAILED')
    }
    const provenanceValidation = validateDataProvenanceV1(provider.dataProvenance)
    if (!provenanceValidation.ok) {
      return failure('PROVIDER_FAILURE', 'INVALID_PROVENANCE')
    }
    const context: ConsultantCanonicalInstitutionContextV1 = {
      institutionId: contextValidation.value.institutionId,
      recordRevision: contextValidation.value.recordRevision,
    }
    const snapshotAsOf = snapshotValidation.value
    let assignmentLookup: unknown
    try {
      assignmentLookup = provider.loadAssignments({
        institutionId: context.institutionId,
        recordRevision: context.recordRevision,
      })
    } catch (_error) {
      return failure('PROVIDER_FAILURE', 'ASSIGNMENT_PROVIDER_FAILED')
    }
    const assignmentValidation = inspectAssignmentLookupV1(assignmentLookup)
    if (!assignmentValidation.ok) {
      return failure('PROVIDER_FAILURE', 'INVALID_ASSIGNMENT_PAYLOAD')
    }
    if (assignmentValidation.value.assignment !== null
      && assignmentValidation.value.assignment.institutionId !== contextValidation.value.institutionId) {
      return failure('PROVIDER_FAILURE', 'INVALID_ASSIGNMENT_PAYLOAD')
    }
    let defaultRaw: unknown = null
    if (assignmentValidation.value.status === 'missing') {
      try {
        defaultRaw = provider.loadDefaultConsultant()
      } catch (_error) {
        return failure('PROVIDER_FAILURE', 'DEFAULT_PROVIDER_FAILED')
      }
    }
    const defaultValidation = validateDefaultConsultantConfigurationV1(defaultRaw)
    if (!defaultValidation.ok) {
      return failure('PROVIDER_FAILURE', 'INVALID_DEFAULT_CONFIGURATION')
    }
    const selection = resolveConsultantAssignmentV1(assignmentValidation.value, defaultValidation.value)
    if (selection.status !== 'selected' || selection.consultantId === null) {
      const resolutionStatus = selection.status === 'selected' ? 'missing' : selection.status
      return buildSnapshot(
        context,
        snapshotAsOf,
        provenanceValidation.value,
        selection.assignmentSource,
        resolutionStatus,
        null,
      )
    }
    let profileRaw: unknown
    try {
      profileRaw = provider.loadConsultantProfile(selection.consultantId)
    } catch (_error) {
      return failure('PROVIDER_FAILURE', 'PROFILE_PROVIDER_FAILED')
    }
    if (profileRaw === null || profileRaw === undefined) {
      return buildSnapshot(
        context,
        snapshotAsOf,
        provenanceValidation.value,
        selection.assignmentSource,
        'missing',
        null,
      )
    }
    const profileValidation = validateConsultantProfileV1(profileRaw)
    if (!profileValidation.ok) {
      return failure('PROVIDER_FAILURE', 'INVALID_CONSULTANT_PROFILE')
    }
    const profile = profileValidation.value
    if (profile.consultantId !== selection.consultantId) {
      return failure('PROVIDER_FAILURE', 'INVALID_CONSULTANT_PROFILE')
    }
    if (profile.serviceStatus === 'inactive' || profile.serviceStatus === 'unknown') {
      return buildSnapshot(
        context,
        snapshotAsOf,
        provenanceValidation.value,
        selection.assignmentSource,
        profile.serviceStatus,
        null,
      )
    }
    const media = resolveProfileMedia(provider, profile, snapshotAsOf)
    if (!media.ok) {
      return media
    }
    try {
      const publicProfile = createPublicProfile(profile, media.value)
      const resolutionStatus = deriveConsultantResolutionStatusV1(
        publicProfile.phone,
        publicProfile.enterpriseWechatQr,
      )
      return buildSnapshot(
        context,
        snapshotAsOf,
        provenanceValidation.value,
        selection.assignmentSource,
        resolutionStatus,
        publicProfile,
      )
    } catch (_error) {
      return failure('PROJECTION_FAILURE', 'PUBLIC_SNAPSHOT_INVARIANT_FAILED')
    }
  },
})

export const createConsultantFoundationServiceV1 = createConsultantApplicationServiceV1

export const resolveInstitutionConsultantContactV1 = (
  provider: ConsultantFoundationProviderV1,
  input: ConsultantApplicationRequestV1,
): ConsultantApplicationResultV1 => createConsultantApplicationServiceV1(provider).resolveForInstitution(input)
