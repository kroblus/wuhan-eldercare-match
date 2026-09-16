import {
  deriveConsultantResolutionStatusV1,
  GLOBAL_CONSULTANT_SELECTION_SOURCE_V1,
  GLOBAL_CONSULTANT_SNAPSHOT_KIND_V1,
  inspectAssignmentLookupV1,
  projectConsultantPublicProfileV1,
  resolveConsultantAssignmentV1,
  resolveGlobalConsultantSelectionV1,
  validateCanonicalInstitutionContextV1,
  validateConsultantProfileV1,
  validateDataProvenanceV1,
  validateDefaultConsultantConfigurationV1,
  validateGlobalConsultantApplicationInputV1,
  validateGlobalConsultantSelectionConfigurationV1,
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
  GlobalConsultantPublicApplicationResultV1,
  GlobalConsultantPublicApplicationSnapshotV1,
  InstitutionConsultantContactApplicationSnapshotV1,
} from '../types/consultant-v1'
import {
  CONSULTANT_CONTRACT_VERSION_V1,
  GLOBAL_CONSULTANT_SELECTION_ROLE_V1,
  GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_VERSION_V1,
} from '../types/consultant-v1'

export interface ConsultantApplicationRequestV1 {
  institutionIdentity: unknown
  snapshotAsOf: unknown
}

export interface ConsultantPublicMediaRequestV1 {
  consultantId: string
  wechatQrMediaId: string
  snapshotAsOf: string
}

export interface GlobalConsultantApplicationRequestV1 {
  snapshotAsOf: unknown
}

/**
 * Read-only foundation port. Implementations are deliberately opaque to the
 * application layer: validation occurs at the trust boundary before any
 * value is projected to the public snapshot.
 */
export interface ConsultantPublicMediaProviderV1 {
  resolvePublicMedia(input: ConsultantPublicMediaRequestV1): unknown
}

export interface ConsultantFoundationProviderV1 extends ConsultantPublicMediaProviderV1 {
  readonly dataProvenance: ConsultantDataProvenanceV1
  loadAssignments(context: ConsultantCanonicalInstitutionContextV1): unknown
  loadConsultantProfile(consultantId: string): unknown
  loadDefaultConsultant(): unknown
}

/**
 * Global configuration is a separate read-only port. It intentionally has no
 * Institution assignment/default methods, so the global path cannot depend on
 * or accidentally fall through to the Institution resolver.
 */
export interface GlobalConsultantFoundationProviderV1 extends ConsultantPublicMediaProviderV1 {
  readonly dataProvenance: ConsultantDataProvenanceV1
  loadGlobalConsultantConfiguration(): unknown
  loadConsultantProfile(consultantId: string): unknown
}

export interface ConsultantApplicationServiceV1 {
  resolveForInstitution(input: ConsultantApplicationRequestV1): ConsultantApplicationResultV1
}

export interface GlobalConsultantApplicationServiceV1 {
  resolveGlobal(input: GlobalConsultantApplicationRequestV1): GlobalConsultantPublicApplicationResultV1
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

const globalFailure = (): GlobalConsultantPublicApplicationResultV1 => ({
  ok: false,
  error: {
    kind: 'global_consultant_public_application_failure_v1',
    status: 'unavailable',
  },
})

const buildGlobalSnapshot = (
  snapshotAsOf: string,
  dataProvenance: ConsultantDataProvenanceV1,
  selectionStatus: GlobalConsultantPublicApplicationSnapshotV1['selectionStatus'],
  resolutionStatus: GlobalConsultantPublicApplicationSnapshotV1['resolutionStatus'],
  consultant: ConsultantPublicProfileV1 | null,
): GlobalConsultantPublicApplicationResultV1 => ({
  ok: true,
  value: {
    kind: GLOBAL_CONSULTANT_SNAPSHOT_KIND_V1,
    contractVersion: GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_VERSION_V1,
    context: {
      kind: 'platform_global_consultant',
      selectionRole: GLOBAL_CONSULTANT_SELECTION_ROLE_V1,
      selectionSource: GLOBAL_CONSULTANT_SELECTION_SOURCE_V1,
    },
    snapshotAsOf,
    dataProvenance,
    selectionStatus,
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

const isGlobalProvider = (value: unknown): value is GlobalConsultantFoundationProviderV1 => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return typeof candidate.loadGlobalConsultantConfiguration === 'function'
    && typeof candidate.loadConsultantProfile === 'function'
    && typeof candidate.resolvePublicMedia === 'function'
}

const shouldResolveMedia = (
  profile: { serviceStatus: string; enterpriseWechatQr: { sourceState: string; reviewStatus?: string; lifecycleStatus?: string } },
): boolean => profile.serviceStatus === 'active'
  && profile.enterpriseWechatQr.sourceState === 'configured'
  && profile.enterpriseWechatQr.reviewStatus === 'approved'
  && profile.enterpriseWechatQr.lifecycleStatus === 'active'

const resolveProfileMedia = (
  provider: ConsultantPublicMediaProviderV1,
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

const resolveGlobalConsultant = (
  provider: GlobalConsultantFoundationProviderV1,
  input: GlobalConsultantApplicationRequestV1,
): GlobalConsultantPublicApplicationResultV1 => {
  const inputValidation = validateGlobalConsultantApplicationInputV1(input)
  if (!inputValidation.ok || !isGlobalProvider(provider)) {
    return globalFailure()
  }
  const provenanceValidation = validateDataProvenanceV1(provider.dataProvenance)
  if (!provenanceValidation.ok) {
    return globalFailure()
  }
  let rawConfiguration: unknown
  try {
    rawConfiguration = provider.loadGlobalConsultantConfiguration()
  } catch (_error) {
    return globalFailure()
  }
  const configurationValidation = validateGlobalConsultantSelectionConfigurationV1(rawConfiguration)
  if (!configurationValidation.ok) {
    return globalFailure()
  }
  const selection = resolveGlobalConsultantSelectionV1(configurationValidation.value)
  const snapshotAsOf = inputValidation.value.snapshotAsOf
  if (selection.status !== 'configured' || selection.consultantId === null) {
    const resolutionStatus = selection.status === 'configured' ? 'missing' : selection.status
    return buildGlobalSnapshot(
      snapshotAsOf,
      provenanceValidation.value,
      selection.status,
      resolutionStatus,
      null,
    )
  }
  let profileRaw: unknown
  try {
    profileRaw = provider.loadConsultantProfile(selection.consultantId)
  } catch (_error) {
    return globalFailure()
  }
  if (profileRaw === null || profileRaw === undefined) {
    return buildGlobalSnapshot(
      snapshotAsOf,
      provenanceValidation.value,
      'configured',
      'missing',
      null,
    )
  }
  const profileValidation = validateConsultantProfileV1(profileRaw)
  if (!profileValidation.ok || profileValidation.value.consultantId !== selection.consultantId) {
    return globalFailure()
  }
  const profile = profileValidation.value
  if (profile.serviceStatus === 'inactive' || profile.serviceStatus === 'unknown') {
    return buildGlobalSnapshot(
      snapshotAsOf,
      provenanceValidation.value,
      'configured',
      profile.serviceStatus,
      null,
    )
  }
  const media = resolveProfileMedia(provider, profile, snapshotAsOf)
  if (!media.ok) {
    return globalFailure()
  }
  try {
    const publicProfile = projectConsultantPublicProfileV1(profile, media.value)
    const resolutionStatus = deriveConsultantResolutionStatusV1(
      publicProfile.phone,
      publicProfile.enterpriseWechatQr,
    )
    return buildGlobalSnapshot(
      snapshotAsOf,
      provenanceValidation.value,
      'configured',
      resolutionStatus,
      publicProfile,
    )
  } catch (_error) {
    return globalFailure()
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
      const publicProfile = projectConsultantPublicProfileV1(profile, media.value)
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

export const createGlobalConsultantApplicationServiceV1 = (
  provider: GlobalConsultantFoundationProviderV1,
): GlobalConsultantApplicationServiceV1 => ({
  resolveGlobal: (input: GlobalConsultantApplicationRequestV1): GlobalConsultantPublicApplicationResultV1 =>
    resolveGlobalConsultant(provider, input),
})

export const createConsultantFoundationServiceV1 = createConsultantApplicationServiceV1

export const resolveInstitutionConsultantContactV1 = (
  provider: ConsultantFoundationProviderV1,
  input: ConsultantApplicationRequestV1,
): ConsultantApplicationResultV1 => createConsultantApplicationServiceV1(provider).resolveForInstitution(input)
