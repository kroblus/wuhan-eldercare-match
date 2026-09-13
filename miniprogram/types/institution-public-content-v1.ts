/**
 * Development-only PublicContent sidecar boundary.
 *
 * Public content is a separate presentation aggregate.  Its revision is not
 * an Institution record identity and must be resolved by explicit head/pin,
 * never by array order or a maximum revision.
 */
import type {
  ExactInstitutionPublicContentRevisionResolver,
  CurrentInstitutionPublicContentResolver,
  PublicContentProviderResult,
} from '../domain/institution/v1-2-1/public-content'
import type { InstitutionPublicContentV1 } from './institution-v1-2-1'

export interface InstitutionPublicContentCurrentHeadV1 {
  institutionId: string
  contentRevision: number
}

export interface InstitutionPublicContentCatalogV1 {
  records: readonly InstitutionPublicContentV1[]
  currentHeads: readonly InstitutionPublicContentCurrentHeadV1[]
}

export interface InstitutionPublicContentProviderV1
  extends CurrentInstitutionPublicContentResolver, ExactInstitutionPublicContentRevisionResolver {}

export type InstitutionPublicContentServiceResultV1 = PublicContentProviderResult
