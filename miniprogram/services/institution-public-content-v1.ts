/**
 * Development PublicContent provider.
 *
 * Current and historical reads are intentionally separate operations. Current
 * resolution follows an explicit head entry; exact resolution follows the
 * requested contentRevision. Neither operation performs latest/max fallback.
 */
import {
  validateInstitutionPublicContentV1,
} from '../domain/institution/v1-2-1/public-content'
import type {
  PublicContentProviderResult,
} from '../domain/institution/v1-2-1/public-content'
import {
  isPositiveInteger,
  isStableIdentifier,
  isPlainRecord,
} from '../domain/institution/primitives'
import { institutionPublicContentCatalog } from '../runtime/legacy-institution-data'
import type {
  InstitutionPublicContentCatalogV1,
  InstitutionPublicContentCurrentHeadV1,
  InstitutionPublicContentProviderV1,
} from '../types/institution-public-content-v1'

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

const isHead = (value: unknown): value is InstitutionPublicContentCurrentHeadV1 =>
  isPlainRecord(value)
  && Object.keys(value).length === 2
  && isStableIdentifier(value.institutionId)
  && isPositiveInteger(value.contentRevision)

const contentKey = (institutionId: string, contentRevision: number): string =>
  `${institutionId}#${contentRevision}`

const catalogLooksValid = (catalog: InstitutionPublicContentCatalogV1): boolean => {
  const keys: string[] = []
  for (let index = 0; index < catalog.records.length; index += 1) {
    const record = catalog.records[index]
    if (!validateInstitutionPublicContentV1(record).ok) return false
    const key = contentKey(record.institutionId, record.contentRevision)
    if (keys.indexOf(key) >= 0) return false
    keys.push(key)
  }
  const headKeys: string[] = []
  for (let index = 0; index < catalog.currentHeads.length; index += 1) {
    const head = catalog.currentHeads[index]
    if (!isHead(head)) return false
    const key = contentKey(head.institutionId, head.contentRevision)
    if (headKeys.indexOf(head.institutionId) >= 0 || headKeys.indexOf(key) >= 0) return false
    if (keys.indexOf(key) < 0) return false
    headKeys.push(head.institutionId)
    headKeys.push(key)
  }
  return true
}

const invalid = (code: 'PUBLIC_CONTENT_RESOLVER_NOT_CONFIGURED'
  | 'PUBLIC_CONTENT_REVISION_NOT_FOUND'
  | 'PUBLIC_CONTENT_VALIDATION_ERROR'): PublicContentProviderResult => ({
  ok: false,
  code,
})

const exactRecord = (
  catalog: InstitutionPublicContentCatalogV1,
  institutionId: string,
  contentRevision: number,
): PublicContentProviderResult => {
  if (!isStableIdentifier(institutionId) || !isPositiveInteger(contentRevision)) {
    return invalid('PUBLIC_CONTENT_VALIDATION_ERROR')
  }
  const record = catalog.records.find((item) =>
    item.institutionId === institutionId && item.contentRevision === contentRevision)
  if (record === undefined) return invalid('PUBLIC_CONTENT_REVISION_NOT_FOUND')
  const validation = validateInstitutionPublicContentV1(record)
  if (!validation.ok) return invalid('PUBLIC_CONTENT_VALIDATION_ERROR')
  return { ok: true, value: cloneValue(validation.value) }
}

/**
 * Build a provider over an immutable-in-practice, caller-owned catalog
 * snapshot. The returned values are cloned so callers cannot mutate the
 * development source between current and exact reads.
 */
export const createInstitutionPublicContentProviderV1 = (
  source: InstitutionPublicContentCatalogV1,
): InstitutionPublicContentProviderV1 => {
  const catalog = cloneValue(source)
  const valid = catalogLooksValid(catalog)
  return {
    resolveCurrent: (institutionId: string): PublicContentProviderResult => {
      if (!valid) return invalid('PUBLIC_CONTENT_VALIDATION_ERROR')
      if (!isStableIdentifier(institutionId)) return invalid('PUBLIC_CONTENT_VALIDATION_ERROR')
      const head = catalog.currentHeads.find((item) => item.institutionId === institutionId)
      if (head === undefined) return { ok: true, value: null }
      // The explicit head is the only allowed current lookup path.
      return exactRecord(catalog, head.institutionId, head.contentRevision)
    },
    resolveExact: (
      institutionId: string,
      contentRevision: number,
    ): PublicContentProviderResult => {
      if (!valid) return invalid('PUBLIC_CONTENT_VALIDATION_ERROR')
      return exactRecord(catalog, institutionId, contentRevision)
    },
  }
}

export const createDevelopmentPublicContentProvider =
  createInstitutionPublicContentProviderV1

export const institutionPublicContentProviderV1 =
  createInstitutionPublicContentProviderV1(institutionPublicContentCatalog)

/** Application alias; both current and exact reads use the same provider. */
export const institutionPublicContentServiceV1 = institutionPublicContentProviderV1
