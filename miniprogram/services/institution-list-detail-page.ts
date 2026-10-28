/**
 * Page-facing composition for the V1.2-A0-3 Institution List / Detail pages.
 *
 * Pages deliberately depend on this small application entry only.  The
 * current catalog resolver, historical resolver and source-context registry
 * are composed once for the app session here, so a recommendation route can
 * reuse the exact evaluationAsOf captured by its source context.
 */

import { isValidIsoTimestamp } from '../domain/institution/primitives'
import {
  createInstitutionDetailApplicationServiceV12,
  createInstitutionListApplicationServiceV12,
} from './institution-list-detail-application'
import { institutionPublicationClient } from './institution-publications'
import { institutionCurrentCatalogResolver as currentCatalogResolver } from './institution-current-catalog'
import {
  createInstitutionSourceContextRegistry,
} from './institution-source-context'
import {
  registerInstitutionRecommendationSourceContextV2 as registerInstitutionRecommendationSourceContextV2WithSidecar,
} from './institution-recommendation-source'
import { institutionPublicContentServiceV1 } from './institution-public-content-v1'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import type {
  InstitutionCanonicalIdentity,
  InstitutionDetailApplicationResultV12,
  InstitutionListApplicationResultV12,
} from '../types/institution-list-detail'
import type { InstitutionDetailRoute } from './institution-detail-route'

const currentEvaluationAsOf = (): string => new Date().toISOString()

const sourceContextFailure = (
  causeCode: string,
): { ok: false; error: { code: 'INSTITUTION_SOURCE_CONTEXT_ERROR'; causeCode: string } } => ({
  ok: false,
  error: { code: 'INSTITUTION_SOURCE_CONTEXT_ERROR', causeCode },
})

const evaluationAsOfForSourceContext = (
  sourceContextRef: string | null | undefined,
): { ok: true; value: string } | { ok: false; error: { causeCode: string } } => {
  if (sourceContextRef === undefined || sourceContextRef === null) {
    return { ok: true, value: currentEvaluationAsOf() }
  }
  const context = institutionSourceContextRegistry.resolve(sourceContextRef)
  if (!context.ok) return { ok: false, error: { causeCode: context.error.code } }
  return isValidIsoTimestamp(context.value.evaluationAsOf)
    ? { ok: true, value: context.value.evaluationAsOf }
    : { ok: false, error: { causeCode: 'SOURCE_CONTEXT_EVALUATION_AS_OF_INVALID' } }
}

/**
 * One ephemeral registry is shared by future Result/List/Detail consumers.
 * It intentionally has no storage or network side effects.
 */
export const institutionSourceContextRegistry = createInstitutionSourceContextRegistry()

const historicalRevisionResolver = institutionPublicationClient

export const institutionListApplicationV12 = createInstitutionListApplicationServiceV12({
  currentCatalogResolver,
  historicalRevisionResolver,
  sourceContextRegistry: institutionSourceContextRegistry,
})

/**
 * Page-facing source-context entry point. Result Page only passes its frozen
 * Recommendation snapshot here; provider details stay in this application
 * composition boundary and presentation pins remain outside Recommendation
 * manifest/ranking semantics.
 */
export const registerInstitutionRecommendationSourceContextV2 = (
  snapshot: RecommendationResultApplicationSnapshotV2,
) => registerInstitutionRecommendationSourceContextV2WithSidecar(
  snapshot,
  institutionSourceContextRegistry,
  { publicContentResolver: institutionPublicContentServiceV1 },
)

export const institutionDetailApplicationV12 = createInstitutionDetailApplicationServiceV12({
  currentCatalogResolver,
  historicalRevisionResolver,
  sourceContextRegistry: institutionSourceContextRegistry,
  publicContentCurrentResolver: institutionPublicContentServiceV1,
  publicContentExactResolver: institutionPublicContentServiceV1,
})

export const buildInstitutionListPageSnapshot = async (
  sourceContextRef?: string | null,
): Promise<InstitutionListApplicationResultV12> => {
  const evaluation = evaluationAsOfForSourceContext(sourceContextRef)
  if (!evaluation.ok) return sourceContextFailure(evaluation.error.causeCode)
  return institutionListApplicationV12.build({
    evaluationAsOf: evaluation.value,
    sourceContextRef: sourceContextRef === undefined ? null : sourceContextRef,
  })
}

export const buildInstitutionDetailPageSnapshot = async (
  route: InstitutionDetailRoute,
): Promise<InstitutionDetailApplicationResultV12> => {
  const evaluation = evaluationAsOfForSourceContext(route.sourceContextRef)
  if (!evaluation.ok) return sourceContextFailure(evaluation.error.causeCode) as InstitutionDetailApplicationResultV12
  return institutionDetailApplicationV12.build({
    identity: route.identity,
    source: route.source,
    sourceContextRef: route.sourceContextRef,
    evaluationAsOf: evaluation.value,
  })
}

export const buildInstitutionCurrentRevisionSnapshot = async (
  originalIdentity: InstitutionCanonicalIdentity,
): Promise<InstitutionDetailApplicationResultV12> => institutionDetailApplicationV12.buildCurrentRevision({
  originalIdentity,
  evaluationAsOf: currentEvaluationAsOf(),
})
