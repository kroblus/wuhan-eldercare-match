import type {
  InstitutionPublicContentV1,
} from '../../../types/institution-v1-2-1'
import {
  hasExactKeys,
  isOneOf,
  isPlainRecord,
  isPositiveInteger,
  isStableIdentifier,
  isValidIsoTimestamp,
} from '../primitives'
import {
  INSTITUTION_PUBLIC_CONTENT_SCHEMA_VERSION_V1,
  PUBLIC_CONTENT_PUBLICATION_STATUSES,
  PUBLIC_CONTENT_SOURCE_TYPES,
} from './rules-v1-2-1'

export type InstitutionPublicContentValidationErrorCode =
  | 'PUBLIC_CONTENT_VALIDATION_ERROR'
  | 'UNSUPPORTED_PUBLIC_CONTENT_SCHEMA_VERSION'

export interface InstitutionPublicContentValidationIssue {
  code: InstitutionPublicContentValidationErrorCode
  path: string
}

export type InstitutionPublicContentValidationResult =
  | { ok: true; value: InstitutionPublicContentV1 }
  | { ok: false; issues: readonly InstitutionPublicContentValidationIssue[] }

export type PublicIntroductionCanonicalizationResult =
  | { ok: true; value: string }
  | { ok: false; code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }

const containsForbiddenControl = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if ((code < 32 && code !== 10) || (code >= 127 && code <= 159)) return true
  }
  return false
}

const containsMarkup = (value: string): boolean =>
  /<\/?[A-Za-z][^>]*>|<![^>]*>|<\?(?:.|\n)*?\?>/.test(value)

export const canonicalizePublicIntroductionText = (
  input: unknown,
): PublicIntroductionCanonicalizationResult => {
  if (typeof input !== 'string') {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  const value = input.replace(/\r\n?/g, '\n').normalize('NFC').trim()
  const codePointLength = Array.from(value).length
  if (codePointLength < 1 || codePointLength > 2000
    || containsForbiddenControl(value)
    || containsMarkup(value)) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  return { ok: true, value }
}

export const validateInstitutionPublicContentV1 = (
  input: unknown,
): InstitutionPublicContentValidationResult => {
  const issues: InstitutionPublicContentValidationIssue[] = []
  const addIssue = (code: InstitutionPublicContentValidationErrorCode, path: string): void => {
    issues.push({ code, path })
  }
  if (!isPlainRecord(input)
    || !hasExactKeys(input, [
      'schemaVersion', 'institutionId', 'contentRevision', 'publicationStatus',
      'introduction', 'updatedAt',
    ])) {
    return { ok: false, issues: [{ code: 'PUBLIC_CONTENT_VALIDATION_ERROR', path: '$' }] }
  }
  if (input.schemaVersion !== INSTITUTION_PUBLIC_CONTENT_SCHEMA_VERSION_V1) {
    addIssue('UNSUPPORTED_PUBLIC_CONTENT_SCHEMA_VERSION', 'schemaVersion')
  }
  if (!isStableIdentifier(input.institutionId)) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'institutionId')
  }
  if (!isPositiveInteger(input.contentRevision)) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'contentRevision')
  }
  if (!isOneOf(input.publicationStatus, PUBLIC_CONTENT_PUBLICATION_STATUSES)) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'publicationStatus')
  }
  if (!isValidIsoTimestamp(input.updatedAt)) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'updatedAt')
  }
  const introduction = input.introduction
  if (!isPlainRecord(introduction)
    || !hasExactKeys(introduction, ['availability', 'text', 'sourceType'])) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'introduction')
  } else if (introduction.availability === 'provided') {
    const canonical = canonicalizePublicIntroductionText(introduction.text)
    if (!canonical.ok || canonical.value !== introduction.text
      || !isOneOf(introduction.sourceType, PUBLIC_CONTENT_SOURCE_TYPES)) {
      addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'introduction')
    }
  } else if ((introduction.availability !== 'unknown'
      && introduction.availability !== 'unavailable')
    || introduction.text !== null || introduction.sourceType !== null) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'introduction')
  }
  if (input.publicationStatus === 'published'
    && (!isPlainRecord(introduction) || introduction.availability !== 'provided')) {
    addIssue('PUBLIC_CONTENT_VALIDATION_ERROR', 'introduction')
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as unknown as InstitutionPublicContentV1 }
}

export type PublicContentResolveErrorCode =
  | 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED'
  | 'PUBLIC_CONTENT_REVISION_NOT_FOUND'
  | 'PUBLIC_CONTENT_VALIDATION_ERROR'

export type PublicContentProviderResult =
  | { ok: true; value: InstitutionPublicContentV1 | null }
  | { ok: false; code: PublicContentResolveErrorCode }

export interface CurrentInstitutionPublicContentResolver {
  resolveCurrent(institutionId: string): PublicContentProviderResult
}

export interface ExactInstitutionPublicContentRevisionResolver {
  resolveExact(institutionId: string, contentRevision: number): PublicContentProviderResult
}

export const UNCONFIGURED_CURRENT_PUBLIC_CONTENT_RESOLVER: CurrentInstitutionPublicContentResolver = {
  resolveCurrent: () => ({ ok: false, code: 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED' }),
}

export const UNCONFIGURED_EXACT_PUBLIC_CONTENT_RESOLVER: ExactInstitutionPublicContentRevisionResolver = {
  resolveExact: () => ({ ok: false, code: 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED' }),
}

export type PublicContentProjectionResult =
  | { ok: true; value: InstitutionPublicContentV1 | null }
  | { ok: false; code: PublicContentResolveErrorCode }

const acceptResolvedContent = (
  result: PublicContentProviderResult,
  institutionId: string,
  contentRevision?: number,
): PublicContentProjectionResult => {
  if (!result.ok) return result
  if (result.value === null) return { ok: true, value: null }
  const validation = validateInstitutionPublicContentV1(result.value)
  if (!validation.ok
    || result.value.institutionId !== institutionId
    || (contentRevision !== undefined && result.value.contentRevision !== contentRevision)) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  return result.value.publicationStatus === 'published'
    ? { ok: true, value: result.value }
    : { ok: true, value: null }
}

export const resolveCurrentPublishedPublicContent = (
  resolver: CurrentInstitutionPublicContentResolver,
  institutionId: string,
): PublicContentProjectionResult => {
  if (!isStableIdentifier(institutionId)) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  try {
    return acceptResolvedContent(resolver.resolveCurrent(institutionId), institutionId)
  } catch (_error) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
}

export const resolveExactPublishedPublicContentRevision = (
  resolver: ExactInstitutionPublicContentRevisionResolver,
  institutionId: string,
  contentRevision: number,
): PublicContentProjectionResult => {
  if (!isStableIdentifier(institutionId) || !isPositiveInteger(contentRevision)) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  let resolved: PublicContentProviderResult
  try {
    resolved = resolver.resolveExact(institutionId, contentRevision)
  } catch (_error) {
    return { ok: false, code: 'PUBLIC_CONTENT_VALIDATION_ERROR' }
  }
  if (resolved.ok && resolved.value === null) {
    return { ok: false, code: 'PUBLIC_CONTENT_REVISION_NOT_FOUND' }
  }
  return acceptResolvedContent(resolved, institutionId, contentRevision)
}
