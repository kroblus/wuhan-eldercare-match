/**
 * Session-only Recommendation source context.
 *
 * The registry is deliberately a small closure rather than a persistent
 * store. Query strings carry only the opaque token; the source manifest and
 * narrow candidate projection remain here until the process is gone or the
 * context is explicitly cleared. Raw records never enter this registry.
 */

import {
  isNonNegativeInteger,
  isPlainRecord,
  isPositiveInteger,
  isValidIsoTimestamp,
} from '../domain/institution/primitives'
import type {
  InstitutionCanonicalIdentity,
  InstitutionContextManifestEntry,
  InstitutionNavigationSourceContext,
  InstitutionNavigationSourceContextInput,
  InstitutionPublicContentPresentationPinV121,
  InstitutionRecommendationCandidateProjection,
  InstitutionRecommendationCandidateGroup,
} from '../types/institution-list-detail'
import {
  equalInstitutionCanonicalIdentity,
  institutionCanonicalKey,
  validateInstitutionCanonicalIdentity,
} from './institution-record-resolver'

export type InstitutionSourceContextErrorCode =
  | 'SOURCE_CONTEXT_NOT_FOUND'
  | 'SOURCE_CONTEXT_EXPIRED'
  | 'SOURCE_CONTEXT_REF_INVALID'
  | 'SOURCE_CONTEXT_TOKEN_COLLISION'
  | 'SOURCE_CONTEXT_TOKEN_FACTORY_FAILED'
  | 'SOURCE_CONTEXT_INVALID'
  | 'SOURCE_CONTEXT_IDENTITY_MISMATCH'
  | 'SOURCE_CONTEXT_MANIFEST_MISMATCH'
  | 'SOURCE_CONTEXT_CANDIDATE_DUPLICATE'
  | 'SOURCE_CONTEXT_CANDIDATE_INVALID'
  | 'SOURCE_CONTEXT_PRESENTATION_PIN_INVALID'
  | 'SOURCE_CONTEXT_PRESENTATION_PIN_DUPLICATE'

export type InstitutionSourceContextResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: InstitutionSourceContextErrorCode } }

export interface InstitutionSourceContextRegistry {
  register(
    input: InstitutionNavigationSourceContextInput,
  ): InstitutionSourceContextResult<string>
  resolve(
    sourceContextRef: unknown,
  ): InstitutionSourceContextResult<InstitutionNavigationSourceContext>
  clear(sourceContextRef: unknown): boolean
  clearAll(): void
}

export interface InstitutionSourceContextRegistryOptions {
  tokenFactory?: () => string
  clock?: () => number
  ttlMs?: number
}

const OPAQUE_REF_MAX_LENGTH = 128
const CANDIDATE_GROUPS: readonly InstitutionRecommendationCandidateGroup[] = [
  'cards',
  'nearMatches',
  'conditionalCandidates',
]

export const isValidOpaqueSourceContextRef = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= OPAQUE_REF_MAX_LENGTH
  && value.trim() === value
  && !/[\u0000-\u0020\u007f]/.test(value)

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    ;(value as unknown as readonly unknown[]).forEach((item: unknown) => {
      copy.push(cloneValue(item))
    })
    return copy as unknown as T
  }
  if (isPlainRecord(value)) {
    const copy: Record<string, unknown> = {}
    Object.keys(value).forEach((key) => { copy[key] = cloneValue(value[key]) })
    return copy as T
  }
  return value
}

const freezeDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    ;(value as unknown as readonly unknown[]).forEach((item: unknown) => freezeDeep(item))
    return Object.freeze(value as unknown as object) as unknown as T
  }
  if (isPlainRecord(value)) {
    Object.keys(value).forEach((key) => freezeDeep(value[key]))
    return Object.freeze(value)
  }
  return value
}

const invalid = (
  code: InstitutionSourceContextErrorCode,
): InstitutionSourceContextResult<never> => ({ ok: false, error: { code } })

const isCandidateGroup = (value: unknown): value is InstitutionRecommendationCandidateGroup =>
  typeof value === 'string' && CANDIDATE_GROUPS.indexOf(value as InstitutionRecommendationCandidateGroup) >= 0

const isReference = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && value.length > 0 && value.length <= 256)

const validateCandidate = (
  candidate: unknown,
): boolean => {
  if (!isPlainRecord(candidate)
    || !isPlainRecord(candidate.identity)
    || !isCandidateGroup(candidate.group)
    || !isNonNegativeInteger(candidate.order)
    || (candidate.tier !== 'EXACT'
      && candidate.tier !== 'SOFT_NEAR'
      && candidate.tier !== 'CONDITIONAL')
    || !Array.isArray(candidate.reasons)
    || !Array.isArray(candidate.differences)) {
    return false
  }
  const identity = validateInstitutionCanonicalIdentity(candidate.identity)
  if (!identity.ok) return false
  const validateRefs = (refs: unknown): boolean => Array.isArray(refs) && refs.every((ref) => {
    if (!isPlainRecord(ref) || typeof ref.code !== 'string' || ref.code.trim().length === 0) return false
    return isReference(ref.reference)
  })
  if (!validateRefs(candidate.reasons) || !validateRefs(candidate.differences)) return false
  if (candidate.group === 'conditionalCandidates') return candidate.tier === 'CONDITIONAL'
  if (candidate.group === 'nearMatches') return candidate.tier === 'SOFT_NEAR'
  return candidate.tier === 'EXACT' || candidate.tier === 'SOFT_NEAR'
}

const validateContextInput = (
  input: InstitutionNavigationSourceContextInput,
): InstitutionSourceContextResult<InstitutionNavigationSourceContext> => {
  if (!isPlainRecord(input)
    || typeof input.datasetVersion !== 'string'
    || input.datasetVersion.trim().length === 0
    || (input.datasetMode !== 'PRODUCTION' && input.datasetMode !== 'MOCK_DEVELOPMENT_ONLY')
    || !isValidIsoTimestamp(input.evaluationAsOf)
    || input.recommendationContractVersion !== 'recommendation-contract-v2'
    || input.recommendationRulesetVersion !== 'recommendation-ruleset-v2'
    || input.recommendationPolicyVersion !== 'conservative-exact-with-conditional-v1'
    || input.institutionContractVersion !== 'institution-contract-v1.1'
    || input.institutionCapabilityContractVersion !== 'institution-capability-contract-v1'
    || !Array.isArray(input.manifest)
    || !Array.isArray(input.candidates)) {
    return invalid('SOURCE_CONTEXT_INVALID')
  }

  const manifestByKey = new Map<string, InstitutionContextManifestEntry>()
  const normalizedManifest: InstitutionContextManifestEntry[] = []
  for (let index = 0; index < input.manifest.length; index += 1) {
    const entry = input.manifest[index]
    if (!isPlainRecord(entry) || !isPlainRecord(entry.identity)
      || (entry.disposition !== 'included' && entry.disposition !== 'excluded')
      || (entry.recordProvenance !== 'PRODUCTION_CANDIDATE'
        && entry.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY')
      || (entry.recordStatus !== 'draft' && entry.recordStatus !== 'published'
        && entry.recordStatus !== 'suspended' && entry.recordStatus !== 'archived')) {
      return invalid('SOURCE_CONTEXT_MANIFEST_MISMATCH')
    }
    if ((input.datasetMode === 'MOCK_DEVELOPMENT_ONLY'
        && entry.recordProvenance !== 'MOCK_DEVELOPMENT_ONLY')
      || (input.datasetMode === 'PRODUCTION'
        && entry.recordProvenance !== 'PRODUCTION_CANDIDATE')) {
      return invalid('SOURCE_CONTEXT_MANIFEST_MISMATCH')
    }
    const identity = validateInstitutionCanonicalIdentity(entry.identity)
    if (!identity.ok) return invalid('SOURCE_CONTEXT_MANIFEST_MISMATCH')
    const key = institutionCanonicalKey(identity.value)
    if (manifestByKey.has(key)) return invalid('SOURCE_CONTEXT_MANIFEST_MISMATCH')
    const normalized: InstitutionContextManifestEntry = {
      identity: {
        institutionId: identity.value.institutionId,
        recordRevision: identity.value.recordRevision,
      },
      recordProvenance: entry.recordProvenance,
      recordStatus: entry.recordStatus,
      disposition: entry.disposition,
    }
    manifestByKey.set(key, normalized)
    normalizedManifest.push(normalized)
  }

  const candidateKeys = new Set<string>()
  const groupOrderKeys = new Set<string>()
  const ordersByGroup = new Map<InstitutionRecommendationCandidateGroup, number[]>()
  const normalizedCandidates: InstitutionRecommendationCandidateProjection[] = []
  for (let index = 0; index < input.candidates.length; index += 1) {
    const candidate = input.candidates[index]
    if (!validateCandidate(candidate)) return invalid('SOURCE_CONTEXT_CANDIDATE_INVALID')
    const identityResult = validateInstitutionCanonicalIdentity(candidate.identity)
    if (!identityResult.ok) return invalid('SOURCE_CONTEXT_CANDIDATE_INVALID')
    const key = institutionCanonicalKey(identityResult.value)
    if (candidateKeys.has(key)) return invalid('SOURCE_CONTEXT_CANDIDATE_DUPLICATE')
    const orderKey = `${candidate.group}#${candidate.order}`
    if (groupOrderKeys.has(orderKey)) return invalid('SOURCE_CONTEXT_CANDIDATE_INVALID')
    candidateKeys.add(key)
    groupOrderKeys.add(orderKey)
    const groupOrders = ordersByGroup.get(candidate.group) || []
    groupOrders.push(candidate.order)
    ordersByGroup.set(candidate.group, groupOrders)
    const manifest = manifestByKey.get(key)
    if (manifest === undefined
      || manifest.disposition !== 'included'
    ) {
      return invalid('SOURCE_CONTEXT_IDENTITY_MISMATCH')
    }
    const typedCandidate = candidate as InstitutionRecommendationCandidateProjection
    normalizedCandidates.push({
      identity: {
        institutionId: identityResult.value.institutionId,
        recordRevision: identityResult.value.recordRevision,
      },
      group: typedCandidate.group,
      order: typedCandidate.order,
      tier: typedCandidate.tier,
      reasons: typedCandidate.reasons.map((ref) => ({
        code: ref.code,
        ...(ref.reference === undefined ? {} : { reference: ref.reference }),
      })),
      differences: typedCandidate.differences.map((ref) => ({
        code: ref.code,
        ...(ref.reference === undefined ? {} : { reference: ref.reference }),
      })),
    })
  }
  if (ordersByGroup.has('cards') && ordersByGroup.has('nearMatches')) {
    return invalid('SOURCE_CONTEXT_CANDIDATE_INVALID')
  }
  for (const orders of ordersByGroup.values()) {
    const sorted = orders.slice().sort((left, right) => left - right)
    for (let index = 0; index < sorted.length; index += 1) {
      if (sorted[index] !== index) return invalid('SOURCE_CONTEXT_CANDIDATE_INVALID')
    }
  }

  const normalizedPublicContentPins: InstitutionPublicContentPresentationPinV121[] = []
  if (input.publicContentPins !== undefined && !Array.isArray(input.publicContentPins)) {
    return invalid('SOURCE_CONTEXT_PRESENTATION_PIN_INVALID')
  }
  const publicContentPins = input.publicContentPins === undefined
    ? []
    : input.publicContentPins
  const presentationPinKeys = new Set<string>()
  for (let index = 0; index < publicContentPins.length; index += 1) {
    const pin = publicContentPins[index]
    if (!isPlainRecord(pin)
      || !isPlainRecord(pin.identity)
      || !isPositiveInteger(pin.contentRevision)) {
      return invalid('SOURCE_CONTEXT_PRESENTATION_PIN_INVALID')
    }
    const identity = validateInstitutionCanonicalIdentity(pin.identity)
    if (!identity.ok) return invalid('SOURCE_CONTEXT_PRESENTATION_PIN_INVALID')
    const identityKey = institutionCanonicalKey(identity.value)
    if (!candidateKeys.has(identityKey)) {
      return invalid('SOURCE_CONTEXT_IDENTITY_MISMATCH')
    }
    if (presentationPinKeys.has(identityKey)) {
      return invalid('SOURCE_CONTEXT_PRESENTATION_PIN_DUPLICATE')
    }
    presentationPinKeys.add(identityKey)
    normalizedPublicContentPins.push({
      identity: {
        institutionId: identity.value.institutionId,
        recordRevision: identity.value.recordRevision,
      },
      contentRevision: pin.contentRevision,
    })
  }

  const value: InstitutionNavigationSourceContext = {
    kind: 'institution_navigation_source_context_v1',
    datasetVersion: input.datasetVersion,
    datasetMode: input.datasetMode,
    evaluationAsOf: input.evaluationAsOf,
    recommendationContractVersion: input.recommendationContractVersion,
    recommendationRulesetVersion: input.recommendationRulesetVersion,
    recommendationPolicyVersion: input.recommendationPolicyVersion,
    institutionContractVersion: input.institutionContractVersion,
    institutionCapabilityContractVersion: input.institutionCapabilityContractVersion,
    manifest: cloneValue(normalizedManifest),
    candidates: cloneValue(normalizedCandidates),
    ...(normalizedPublicContentPins.length === 0
      ? {}
      : { publicContentPins: cloneValue(normalizedPublicContentPins) }),
  }
  return { ok: true, value: freezeDeep(value) }
}

let defaultTokenSequence = 0

const defaultTokenFactory = (): string => {
  defaultTokenSequence += 1
  return `institution-context-${defaultTokenSequence}`
}

export const createInstitutionSourceContextRegistry = (
  options: InstitutionSourceContextRegistryOptions = {},
): InstitutionSourceContextRegistry => {
  const tokenFactory = options.tokenFactory || defaultTokenFactory
  const clock = options.clock || (() => Date.now())
  const ttlMs = options.ttlMs
  const entries = new Map<string, { context: InstitutionNavigationSourceContext; expiresAt: number | null }>()

  const register = (
    input: InstitutionNavigationSourceContextInput,
  ): InstitutionSourceContextResult<string> => {
    const validated = validateContextInput(input)
    if (!validated.ok) return validated
    if (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0)) {
      return invalid('SOURCE_CONTEXT_INVALID')
    }
    let token: string
    try {
      token = tokenFactory()
    } catch (_error) {
      return invalid('SOURCE_CONTEXT_TOKEN_FACTORY_FAILED')
    }
    if (!isValidOpaqueSourceContextRef(token)) return invalid('SOURCE_CONTEXT_REF_INVALID')
    if (entries.has(token)) return invalid('SOURCE_CONTEXT_TOKEN_COLLISION')
    let createdAt: number
    try {
      createdAt = clock()
    } catch (_error) {
      return invalid('SOURCE_CONTEXT_INVALID')
    }
    if (!Number.isFinite(createdAt)) return invalid('SOURCE_CONTEXT_INVALID')
    const expiresAt = ttlMs === undefined ? null : createdAt + (ttlMs as number)
    entries.set(token, { context: validated.value, expiresAt })
    return { ok: true, value: token }
  }

  const resolve = (
    sourceContextRef: unknown,
  ): InstitutionSourceContextResult<InstitutionNavigationSourceContext> => {
    if (!isValidOpaqueSourceContextRef(sourceContextRef)) return invalid('SOURCE_CONTEXT_REF_INVALID')
    const entry = entries.get(sourceContextRef)
    if (entry === undefined) return invalid('SOURCE_CONTEXT_NOT_FOUND')
    if (entry.expiresAt !== null) {
      let now: number
      try {
        now = clock()
      } catch (_error) {
        entries.delete(sourceContextRef)
        return invalid('SOURCE_CONTEXT_EXPIRED')
      }
      if (!Number.isFinite(now) || now >= entry.expiresAt) {
        entries.delete(sourceContextRef)
        return invalid('SOURCE_CONTEXT_EXPIRED')
      }
    }
    return { ok: true, value: entry.context }
  }

  return {
    register,
    resolve,
    clear: (sourceContextRef: unknown): boolean => {
      if (!isValidOpaqueSourceContextRef(sourceContextRef)) return false
      return entries.delete(sourceContextRef)
    },
    clearAll: (): void => { entries.clear() },
  }
}

export const assertInstitutionSourceContextIdentity = (
  context: InstitutionNavigationSourceContext,
  identity: InstitutionCanonicalIdentity,
): InstitutionSourceContextResult<InstitutionNavigationSourceContext> => {
  const identityResult = validateInstitutionCanonicalIdentity(identity)
  if (!identityResult.ok) return invalid('SOURCE_CONTEXT_IDENTITY_MISMATCH')
  const candidate = context.candidates.find((entry) =>
    equalInstitutionCanonicalIdentity(entry.identity, identityResult.value))
  const manifest = context.manifest.filter((entry) =>
    equalInstitutionCanonicalIdentity(entry.identity, identityResult.value))
  if (candidate === undefined || manifest.length !== 1
    || manifest[0].disposition !== 'included'
    || !equalInstitutionCanonicalIdentity(manifest[0].identity, identityResult.value)) {
    return invalid('SOURCE_CONTEXT_IDENTITY_MISMATCH')
  }
  return { ok: true, value: context }
}

export const validateInstitutionSourceContextInput = validateContextInput
