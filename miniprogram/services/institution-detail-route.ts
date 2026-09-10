/** Pure, wx-free parser/serializer for the canonical Institution Detail route. */

import type {
  InstitutionApplicationSource,
  InstitutionCanonicalIdentity,
  InstitutionRouteSource,
} from '../types/institution-list-detail'
import {
  createInstitutionCanonicalIdentity,
} from './institution-record-resolver'

export type InstitutionDetailRouteErrorCode =
  | 'ROUTE_IDENTITY_MISSING'
  | 'ROUTE_INSTITUTION_ID_INVALID'
  | 'ROUTE_RECORD_REVISION_INVALID'
  | 'ROUTE_SOURCE_INVALID'
  | 'ROUTE_CONTEXT_REF_INVALID'

export interface InstitutionDetailRoute {
  identity: InstitutionCanonicalIdentity
  source: InstitutionApplicationSource
  sourceContextRef: string | null
}

export type InstitutionDetailRouteResult =
  | { ok: true; value: InstitutionDetailRoute }
  | { ok: false; error: { code: InstitutionDetailRouteErrorCode } }

export interface InstitutionDetailRouteQuery {
  institutionId?: unknown
  recordRevision?: unknown
  source?: unknown
  sourceContextRef?: unknown
  /** Legacy `id` is intentionally observed only to reject it explicitly. */
  id?: unknown
}

const OPAQUE_REF_MAX_LENGTH = 128

export const isValidOpaqueSourceContextRef = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= OPAQUE_REF_MAX_LENGTH
  && value.trim() === value
  && !/[\u0000-\u0020\u007f]/.test(value)

const decodeOnce = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  try {
    const decoded = decodeURIComponent(value)
    return decoded
  } catch (_error) {
    return null
  }
}

const mapIdentityError = (code: string): InstitutionDetailRouteErrorCode => {
  if (code === 'INSTITUTION_ID_INVALID') return 'ROUTE_INSTITUTION_ID_INVALID'
  return 'ROUTE_RECORD_REVISION_INVALID'
}

const routeSource = (value: unknown): InstitutionApplicationSource | null => {
  if (value === undefined || value === null || value === '') return 'direct'
  const decoded = decodeOnce(value)
  // `direct` is accepted as the application-level compatibility value from
  // the implementation brief. Producers still serialize the frozen route
  // provenance values `direct_list` or `direct_link`.
  if (decoded === 'direct_list' || decoded === 'direct_link' || decoded === 'direct') return 'direct'
  if (decoded === 'recommendation') return 'recommendation'
  return null
}

/**
 * Parse one level of percent encoding and require the canonical identity.
 * `id`-only legacy links, aliases and malformed revisions fail closed.
 */
export const parseInstitutionDetailRoute = (
  query: InstitutionDetailRouteQuery,
): InstitutionDetailRouteResult => {
  if (!query || typeof query !== 'object'
    || query.institutionId === undefined || query.recordRevision === undefined
    || query.institutionId === null || query.recordRevision === null) {
    return { ok: false, error: { code: 'ROUTE_IDENTITY_MISSING' } }
  }
  const institutionId = decodeOnce(query.institutionId)
  if (institutionId === null) {
    return { ok: false, error: { code: 'ROUTE_INSTITUTION_ID_INVALID' } }
  }
  const rawRevision = decodeOnce(query.recordRevision)
  if (rawRevision === null || !/^[1-9][0-9]*$/.test(rawRevision)) {
    return { ok: false, error: { code: 'ROUTE_RECORD_REVISION_INVALID' } }
  }
  const numericRevision = Number(rawRevision)
  if (!Number.isSafeInteger(numericRevision) || numericRevision <= 0) {
    return { ok: false, error: { code: 'ROUTE_RECORD_REVISION_INVALID' } }
  }
  const identityResult = createInstitutionCanonicalIdentity({
    institutionId,
    recordRevision: numericRevision,
  })
  if (!identityResult.ok) {
    return { ok: false, error: { code: mapIdentityError(identityResult.error.code) } }
  }

  const source = routeSource(query.source)
  if (source === null) return { ok: false, error: { code: 'ROUTE_SOURCE_INVALID' } }

  let sourceContextRef: string | null = null
  if (query.sourceContextRef !== undefined && query.sourceContextRef !== null) {
    const decodedRef = decodeOnce(query.sourceContextRef)
    if (!isValidOpaqueSourceContextRef(decodedRef)) {
      return { ok: false, error: { code: 'ROUTE_CONTEXT_REF_INVALID' } }
    }
    sourceContextRef = decodedRef
  }
  if (source === 'recommendation' && sourceContextRef === null) {
    return { ok: false, error: { code: 'ROUTE_CONTEXT_REF_INVALID' } }
  }
  if (source === 'direct' && sourceContextRef !== null) {
    return { ok: false, error: { code: 'ROUTE_CONTEXT_REF_INVALID' } }
  }

  return {
    ok: true,
    value: {
      identity: identityResult.value,
      source,
      sourceContextRef,
    },
  }
}

export const parseInstitutionDetailRouteQuery = parseInstitutionDetailRoute

export const serializeInstitutionDetailRoute = (
  identity: InstitutionCanonicalIdentity,
  source: InstitutionRouteSource = 'direct_link',
  sourceContextRef?: string | null,
): string | null => {
  const identityResult = createInstitutionCanonicalIdentity(identity)
  if (!identityResult.ok) return null
  if (source !== 'direct_list' && source !== 'direct_link' && source !== 'recommendation') {
    return null
  }
  const normalizedSource: InstitutionRouteSource = source
  if (normalizedSource === 'recommendation' && !isValidOpaqueSourceContextRef(sourceContextRef)) {
    return null
  }
  if (normalizedSource !== 'recommendation' && sourceContextRef !== undefined && sourceContextRef !== null) {
    return null
  }
  const query = [
    `institutionId=${encodeURIComponent(identityResult.value.institutionId)}`,
    `recordRevision=${encodeURIComponent(String(identityResult.value.recordRevision))}`,
    `source=${encodeURIComponent(normalizedSource)}`,
  ]
  if (normalizedSource === 'recommendation') {
    query.push(`sourceContextRef=${encodeURIComponent(sourceContextRef as string)}`)
  }
  return `/pages/institution/detail?${query.join('&')}`
}
