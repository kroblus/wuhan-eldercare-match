import { sourceV121ForDataset } from './institution-current-source'
/**
 * Application orchestration for future Institution List / Detail pages.
 *
 * This file has no Page wiring and does not evaluate recommendations. It
 * combines validated current/historical records with immutable, narrowed
 * source context and presentation-only metadata.
 */

import { isNonNegativeInteger, isValidIsoTimestamp } from '../domain/institution/primitives'
import type {
  InstitutionCanonicalIdentity,
  InstitutionCatalogPresentationMetadata,
  InstitutionCurrentCatalogDataset,
  InstitutionDetailApplicationErrorV12,
  InstitutionDetailApplicationResultV12,
  InstitutionDetailApplicationSnapshotV12,
  InstitutionDetailSectionsV12,
  InstitutionDetailRecommendationDisplay,
  InstitutionDetailFutureSectionsV121,
  InstitutionListApplicationResultV12,
  InstitutionListApplicationSnapshotV12,
  InstitutionListDisplayItemV12,
  InstitutionListOrderingGroup,
  InstitutionListOrderingKind,
  InstitutionNavigationSourceContext,
  InstitutionRecommendationCandidateProjection,
  InstitutionRevisionDisplayContext,
} from '../types/institution-list-detail'
import type { InstitutionRecordV11 } from '../types/institution-v1-1'
import type {
  CurrentInstitutionPublicContentResolver,
  ExactInstitutionPublicContentRevisionResolver,
} from '../domain/institution/v1-2-1/public-content'
import {
  compareInstitutionCanonicalIdentity,
  equalInstitutionCanonicalIdentity,
  institutionCanonicalKey,
  resolveExactCurrentInstitutionRecord,
  resolveExactHistoricalInstitutionRecord,
  validateInstitutionCanonicalIdentity,
} from './institution-record-resolver'
import type {
  InstitutionCurrentCatalogResult,
  InstitutionCurrentCatalogResolver,
  InstitutionCurrentRevisionResult,
  InstitutionHistoricalRevisionResolver,
} from './institution-record-resolver'
import {
  institutionDataDisclosure,
  projectInstitutionDetailSnapshotV12,
  projectInstitutionListDisplayItemV12,
} from './institution-presentation'
import {
  assertInstitutionSourceContextIdentity,
} from './institution-source-context'
import type { InstitutionSourceContextRegistry } from './institution-source-context'
import {
  createUnavailableFutureSectionsV121,
  projectInstitutionPublicIntroductionV121,
  projectInstitutionFutureSectionsV121,
} from './institution-v1-2-1-presentation'
import { resolveCurrentPublishedPublicContent, resolveExactPublishedPublicContentRevision } from '../domain/institution/v1-2-1/public-content'

export interface InstitutionListApplicationDependenciesV12 {
  currentCatalogResolver: InstitutionCurrentCatalogResolver
  historicalRevisionResolver: InstitutionHistoricalRevisionResolver
  sourceContextRegistry: InstitutionSourceContextRegistry
}

export interface InstitutionListApplicationBuildInputV12 {
  evaluationAsOf: string
  sourceContextRef?: string | null
  presentationMetadata?: InstitutionCatalogPresentationMetadata
}

export interface InstitutionDetailApplicationDependenciesV12 {
  currentCatalogResolver: InstitutionCurrentCatalogResolver
  historicalRevisionResolver: InstitutionHistoricalRevisionResolver
  sourceContextRegistry: InstitutionSourceContextRegistry
  /** Optional presentation sidecars; failures never invalidate Institution catalog. */
  publicContentCurrentResolver?: CurrentInstitutionPublicContentResolver
  publicContentExactResolver?: ExactInstitutionPublicContentRevisionResolver
}

export interface InstitutionDetailApplicationBuildInputV12 {
  identity: InstitutionCanonicalIdentity
  source: 'direct' | 'recommendation'
  sourceContextRef: string | null
  evaluationAsOf: string
}

export interface InstitutionCurrentRevisionSwitchInputV12 {
  originalIdentity: InstitutionCanonicalIdentity
  evaluationAsOf: string
}

type InstitutionPresentationOrderingResult =
  | {
    ok: true
    value: {
      kind: Exclude<InstitutionListOrderingKind, 'RECOMMENDATION_CONTEXT_V1'>
      records: readonly InstitutionRecordV11[]
    }
  }
  | { ok: false; error: { code: 'INVALID_LIST_ORDER_METADATA' } }

const listFailure = (
  code: 'INSTITUTION_CATALOG_ERROR' | 'INSTITUTION_SOURCE_CONTEXT_ERROR' | 'INSTITUTION_LIST_PROJECTION_ERROR',
  causeCode: string,
): InstitutionListApplicationResultV12 => ({ ok: false, error: { code, causeCode } })

const detailFailure = (
  code: InstitutionDetailApplicationErrorV12['code'],
  causeCode: string,
): InstitutionDetailApplicationResultV12 => ({
  ok: false,
  error: { code, causeCode },
})

const loadCurrentCatalogSafely = async (
  resolver: InstitutionCurrentCatalogResolver,
): Promise<InstitutionCurrentCatalogResult> => {
  try {
    return await resolver.loadCurrentCatalog()
  } catch (_error) {
    return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
  }
}

const resolveExactCurrentRevisionSafely = async (
  resolver: InstitutionCurrentCatalogResolver,
  identity: InstitutionCanonicalIdentity,
): Promise<InstitutionCurrentRevisionResult> => {
  try {
    return await resolver.resolveExactCurrentRevision(identity)
  } catch (_error) {
    return { ok: false, error: { code: 'PROVIDER_LOAD_FAILED' } }
  }
}

const isDatasetRecordProvenanceCompatible = (
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY',
  record: InstitutionRecordV11,
): boolean => datasetMode === 'MOCK_DEVELOPMENT_ONLY'
  ? record.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
  : record.recordProvenance === 'PRODUCTION_CANDIDATE'

/**
 * Apply a complete curated order or the canonical fallback. Partial,
 * duplicate and unknown metadata fail as one presentation error.
 */
export const orderCurrentInstitutionRecordsForList = (
  records: readonly InstitutionRecordV11[],
  metadata?: InstitutionCatalogPresentationMetadata,
): InstitutionPresentationOrderingResult => {
  if (metadata === undefined) {
    return {
      ok: true,
      value: {
        kind: 'CANONICAL_IDENTITY_ASC_V1',
        records: records.slice().sort(compareInstitutionCanonicalIdentity),
      },
    }
  }
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)
    || !Array.isArray(metadata.entries) || metadata.entries.length !== records.length) {
    return { ok: false, error: { code: 'INVALID_LIST_ORDER_METADATA' } }
  }
  const entries: Array<{ identity: InstitutionCanonicalIdentity; displayOrder: number }> = []
  const identityKeys = new Set<string>()
  const displayOrders = new Set<number>()
  for (let index = 0; index < metadata.entries.length; index += 1) {
    const entry = metadata.entries[index]
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: { code: 'INVALID_LIST_ORDER_METADATA' } }
    }
    const identity = validateInstitutionCanonicalIdentity(entry.identity)
    if (!identity.ok || !isNonNegativeInteger(entry.displayOrder)) {
      return { ok: false, error: { code: 'INVALID_LIST_ORDER_METADATA' } }
    }
    const key = institutionCanonicalKey(identity.value)
    if (identityKeys.has(key) || displayOrders.has(entry.displayOrder)
      || !records.some((record) => equalInstitutionCanonicalIdentity(record, identity.value))) {
      return { ok: false, error: { code: 'INVALID_LIST_ORDER_METADATA' } }
    }
    identityKeys.add(key)
    displayOrders.add(entry.displayOrder)
    entries.push({ identity: identity.value, displayOrder: entry.displayOrder })
  }
  if (records.some((record) => !identityKeys.has(institutionCanonicalKey(record)))) {
    return { ok: false, error: { code: 'INVALID_LIST_ORDER_METADATA' } }
  }
  const orderByKey = new Map<string, number>()
  entries.forEach((entry) => { orderByKey.set(institutionCanonicalKey(entry.identity), entry.displayOrder) })
  const ordered = records.slice().sort((left, right) => {
    const leftOrder = orderByKey.get(institutionCanonicalKey(left)) as number
    const rightOrder = orderByKey.get(institutionCanonicalKey(right)) as number
    if (leftOrder !== rightOrder) return leftOrder < rightOrder ? -1 : 1
    return compareInstitutionCanonicalIdentity(left, right)
  })
  return { ok: true, value: { kind: 'CURATED_DISPLAY_ORDER_V1', records: ordered } }
}

const currentPresentationMetadataFor = (
  dataset: InstitutionCurrentCatalogDataset,
  records: readonly InstitutionRecordV11[],
): InstitutionCatalogPresentationMetadata | undefined => {
  const presentation = dataset.presentationV121
  if (presentation === undefined || presentation.orderingPolicy !== 'CURATED_DISPLAY_ORDER_V1') {
    return undefined
  }
  const entries = presentation.displayOrder
    .filter((entry) => records.some((record) =>
      equalInstitutionCanonicalIdentity(record, entry)))
    .map((entry) => ({
      identity: {
        institutionId: entry.institutionId,
        recordRevision: entry.recordRevision,
      },
      displayOrder: entry.displayOrder,
    }))
  return entries.length === records.length ? { entries } : undefined
}

const sourceCandidateOrder = (
  candidates: readonly InstitutionRecommendationCandidateProjection[],
): readonly InstitutionRecommendationCandidateProjection[] => {
  const groupOrder = (group: InstitutionRecommendationCandidateProjection['group']): number => {
    if (group === 'cards') return 0
    if (group === 'nearMatches') return 1
    return 2
  }
  return candidates.slice().sort((left, right) => {
    const groupDelta = groupOrder(left.group) - groupOrder(right.group)
    if (groupDelta !== 0) return groupDelta
    if (left.order !== right.order) return left.order < right.order ? -1 : 1
    return compareInstitutionCanonicalIdentity(left.identity, right.identity)
  })
}

const findContextManifestEntry = (
  context: InstitutionNavigationSourceContext,
  identity: InstitutionCanonicalIdentity,
) => context.manifest.filter((entry) =>
  equalInstitutionCanonicalIdentity(entry.identity, identity))

const sourceRecordMatchesContext = (
  context: InstitutionNavigationSourceContext,
  record: InstitutionRecordV11,
): boolean => {
  const manifest = findContextManifestEntry(context, record)
  return manifest.length === 1
    && manifest[0].disposition === 'included'
    && manifest[0].recordProvenance === record.recordProvenance
    && manifest[0].recordStatus === record.recordStatus
    && isDatasetRecordProvenanceCompatible(context.datasetMode, record)
}

const resolvePinnedRecord = async (
  currentDataset: InstitutionCurrentCatalogDataset | null,
  historicalRevisionResolver: InstitutionHistoricalRevisionResolver,
  identity: InstitutionCanonicalIdentity,
): Promise<
  | { ok: true; value: InstitutionRecordV11 }
  | { ok: false; error: { code: string } }
> => {
  if (currentDataset !== null) {
    const current = resolveExactCurrentInstitutionRecord(currentDataset.records, identity)
    if (current.ok) return current
    if (current.error.code !== 'INSTITUTION_NOT_FOUND'
      && current.error.code !== 'INSTITUTION_REVISION_NOT_FOUND') {
      return current
    }
  }
  return resolveExactHistoricalInstitutionRecord(historicalRevisionResolver, identity)
}

const projectListItems = (
  records: readonly InstitutionRecordV11[],
  evaluationAsOf: string,
  placementByKey?: ReadonlyMap<string, InstitutionRecommendationCandidateProjection>,
  sourceContractVersion: InstitutionListDisplayItemV12['sourceContractVersion'] = 'institution-contract-v1.1',
): InstitutionListDisplayItemV12[] => records.map((record) => {
  const candidate = placementByKey === undefined
    ? undefined
    : placementByKey.get(institutionCanonicalKey(record))
  return projectInstitutionListDisplayItemV12(
    record,
    evaluationAsOf,
    candidate === undefined ? null : {
      group: candidate.group,
      order: candidate.order,
      tier: candidate.tier,
    },
    sourceContractVersion,
  )
})

const directOrderingGroups = (
  records: readonly InstitutionRecordV11[],
): readonly InstitutionListOrderingGroup[] => [{
  group: 'other',
  identityKeys: records.map(institutionCanonicalKey),
}]

export const createInstitutionListApplicationServiceV12 = (
  dependencies: InstitutionListApplicationDependenciesV12,
) => ({
  build: async (
    input: InstitutionListApplicationBuildInputV12,
  ): Promise<InstitutionListApplicationResultV12> => {
    if (!isValidIsoTimestamp(input.evaluationAsOf)) {
      return listFailure('INSTITUTION_LIST_PROJECTION_ERROR', 'INVALID_EVALUATION_AS_OF')
    }

    let context: InstitutionNavigationSourceContext | null = null
    const sourceContextRef = input.sourceContextRef === undefined ? null : input.sourceContextRef
    if (sourceContextRef !== null) {
      const contextResult = dependencies.sourceContextRegistry.resolve(sourceContextRef)
      if (!contextResult.ok) {
        return listFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', contextResult.error.code)
      }
      context = contextResult.value
      if (context.evaluationAsOf !== input.evaluationAsOf) {
        return listFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_EVALUATION_TIME_MISMATCH')
      }
    }

    const currentResult = await loadCurrentCatalogSafely(dependencies.currentCatalogResolver)
    if (!currentResult.ok) {
      return listFailure('INSTITUTION_CATALOG_ERROR', currentResult.error.code)
    }
    const currentDataset = currentResult.value
    if (context !== null && context.datasetMode !== currentDataset.datasetMode) {
      return listFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_DATASET_MODE_MISMATCH')
    }
    const sourceCurrentDataset = context !== null
      && context.datasetVersion !== currentDataset.datasetVersion
      ? null
      : currentDataset
    const published = currentDataset.records.filter((record) => record.recordStatus === 'published')
    const directOrder = orderCurrentInstitutionRecordsForList(
      published,
      input.presentationMetadata || currentPresentationMetadataFor(currentDataset, published),
    )
    if (!directOrder.ok) {
      return listFailure('INSTITUTION_LIST_PROJECTION_ERROR', directOrder.error.code)
    }

    try {
      if (context === null) {
        const directItems = projectListItems(
          directOrder.value.records,
          input.evaluationAsOf,
          undefined,
          currentDataset.sourceContractVersion || 'institution-contract-v1.1',
        )
        const snapshot: InstitutionListApplicationSnapshotV12 = {
          kind: 'institution_list_application_snapshot_v1_2',
          snapshotVersion: 'institution-list-application-snapshot-v1.2',
          datasetVersion: currentDataset.datasetVersion,
          datasetMode: currentDataset.datasetMode,
          evaluationAsOf: input.evaluationAsOf,
          dataDisclosure: institutionDataDisclosure(currentDataset.datasetMode),
          source: 'direct',
          sourceContextRef: null,
          ordering: {
            kind: directOrder.value.kind,
            source: 'direct',
            groups: directOrderingGroups(directOrder.value.records),
          },
          recommendedCandidates: [],
          otherCurrentPartners: directItems,
          displayInstitutions: directItems,
        }
        return { ok: true, value: snapshot }
      }

      const orderedCandidates = sourceCandidateOrder(context.candidates)
      const candidateRecords: InstitutionRecordV11[] = []
      const placementByKey = new Map<string, InstitutionRecommendationCandidateProjection>()
      for (let index = 0; index < orderedCandidates.length; index += 1) {
        const candidate = orderedCandidates[index]
        const association = assertInstitutionSourceContextIdentity(context, candidate.identity)
        if (!association.ok) {
          return listFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', association.error.code)
        }
        const resolved = await resolvePinnedRecord(
          sourceCurrentDataset,
          dependencies.historicalRevisionResolver,
          candidate.identity,
        )
        if (!resolved.ok || !sourceRecordMatchesContext(context, resolved.value)) {
          return listFailure(
            'INSTITUTION_SOURCE_CONTEXT_ERROR',
            resolved.ok ? 'SOURCE_CONTEXT_RECORD_MISMATCH' : resolved.error.code,
          )
        }
        if (resolved.value.recordStatus !== 'published') {
          return listFailure('INSTITUTION_LIST_PROJECTION_ERROR', 'PINNED_RECORD_NOT_LIST_DISPLAYABLE')
        }
        candidateRecords.push(resolved.value)
        placementByKey.set(institutionCanonicalKey(candidate.identity), candidate)
      }

      const candidateKeys = new Set(candidateRecords.map(institutionCanonicalKey))
      const otherRecords = directOrder.value.records.filter((record) =>
        !candidateKeys.has(institutionCanonicalKey(record)))
      const recommendedItems = projectListItems(
        candidateRecords,
        context.evaluationAsOf,
        placementByKey,
        sourceCurrentDataset === null
          ? 'institution-contract-v1.1'
          : sourceCurrentDataset.sourceContractVersion || 'institution-contract-v1.1',
      )
      const otherItems = projectListItems(
        otherRecords,
        input.evaluationAsOf,
        undefined,
        currentDataset.sourceContractVersion || 'institution-contract-v1.1',
      )
      const groups: InstitutionListOrderingGroup[] = []
      ;(['cards', 'nearMatches', 'conditionalCandidates'] as const).forEach((candidateGroup) => {
        const keys = orderedCandidates
          .filter((candidate) => candidate.group === candidateGroup)
          .map((candidate) => institutionCanonicalKey(candidate.identity))
        if (keys.length > 0) {
          groups.push({
            group: candidateGroup === 'conditionalCandidates' ? 'conditional' : 'recommendation',
            candidateGroup,
            identityKeys: keys,
          })
        }
      })
      groups.push({ group: 'other', identityKeys: otherRecords.map(institutionCanonicalKey) })
      const snapshot: InstitutionListApplicationSnapshotV12 = {
        kind: 'institution_list_application_snapshot_v1_2',
        snapshotVersion: 'institution-list-application-snapshot-v1.2',
        datasetVersion: currentDataset.datasetVersion,
        datasetMode: currentDataset.datasetMode,
        evaluationAsOf: input.evaluationAsOf,
        dataDisclosure: institutionDataDisclosure(currentDataset.datasetMode),
        source: 'recommendation',
        sourceContextRef,
        ordering: { kind: 'RECOMMENDATION_CONTEXT_V1', source: 'recommendation', groups },
        recommendedCandidates: recommendedItems,
        otherCurrentPartners: otherItems,
        displayInstitutions: recommendedItems.concat(otherItems),
      }
      return { ok: true, value: snapshot }
    } catch (_error) {
      return listFailure('INSTITUTION_LIST_PROJECTION_ERROR', 'LIST_PROJECTION_FAILED')
    }
  },
})

export type InstitutionRevisionDriftState =
  | 'no_drift'
  | 'different_current_revision_available'
  | 'current_revision_unknown'

export const detectInstitutionRevisionDrift = (
  pinnedIdentity: InstitutionCanonicalIdentity,
  currentIdentity: InstitutionCanonicalIdentity | null,
): InstitutionRevisionDriftState => {
  const pinned = validateInstitutionCanonicalIdentity(pinnedIdentity)
  if (!pinned.ok || currentIdentity === null) return 'current_revision_unknown'
  const current = validateInstitutionCanonicalIdentity(currentIdentity)
  if (!current.ok || current.value.institutionId !== pinned.value.institutionId) {
    return 'current_revision_unknown'
  }
  return equalInstitutionCanonicalIdentity(pinned.value, current.value)
    ? 'no_drift'
    : 'different_current_revision_available'
}

const currentPublishedIdentityForInstitution = (
  dataset: InstitutionCurrentCatalogDataset | null,
  institutionId: string,
): InstitutionCanonicalIdentity | null => {
  if (dataset === null) return null
  const matches = dataset.records.filter((record) => record.institutionId === institutionId)
  if (matches.length !== 1) return null
  if (matches[0].recordStatus !== 'published') return null
  return {
    institutionId: matches[0].institutionId,
    recordRevision: matches[0].recordRevision,
  }
}

const revisionContextFor = (
  originalIdentity: InstitutionCanonicalIdentity,
  currentIdentity: InstitutionCanonicalIdentity | null,
  record: InstitutionRecordV11,
  kind: InstitutionRevisionDisplayContext['kind'],
): InstitutionRevisionDisplayContext => {
  const drift = detectInstitutionRevisionDrift(originalIdentity, currentIdentity)
  return {
    kind,
    state: record.recordStatus === 'suspended' || record.recordStatus === 'archived'
      ? 'historical_inactive'
      : drift === 'no_drift'
        ? 'current'
        : drift,
    originalIdentity,
    currentIdentity,
  }
}

const candidateForIdentity = (
  context: InstitutionNavigationSourceContext,
  identity: InstitutionCanonicalIdentity,
): InstitutionRecommendationCandidateProjection | null => {
  const matches = context.candidates.filter((candidate) =>
    equalInstitutionCanonicalIdentity(candidate.identity, identity))
  return matches.length === 1 ? matches[0] : null
}

const recommendationDisplay = (
  candidate: InstitutionRecommendationCandidateProjection,
): InstitutionDetailRecommendationDisplay => ({
  group: candidate.group,
  order: candidate.order,
  tier: candidate.tier,
  reasons: candidate.reasons.map((item) => ({ ...item })),
  differences: candidate.differences.map((item) => ({ ...item })),
})

type PublicContentApplicationInput =
  | { status: 'ready'; value: import('../types/institution-v1-2-1').InstitutionPublicContentV1 }
  | { status: 'hidden_no_pin' | 'hidden_no_current_head' | 'hidden_not_found' | 'unavailable'; value: null }

const resolveDirectPublicContent = (
  resolver: CurrentInstitutionPublicContentResolver | undefined,
  institutionId: string,
): PublicContentApplicationInput => {
  if (resolver === undefined) return { status: 'unavailable', value: null }
  const result = resolveCurrentPublishedPublicContent(resolver, institutionId)
  if (!result.ok) return { status: 'unavailable', value: null }
  return result.value === null
    ? { status: 'hidden_no_current_head', value: null }
    : { status: 'ready', value: result.value }
}

const resolvePinnedPublicContent = (
  resolver: ExactInstitutionPublicContentRevisionResolver | undefined,
  context: InstitutionNavigationSourceContext,
  identity: InstitutionCanonicalIdentity,
): PublicContentApplicationInput => {
  const pin = (context.publicContentPins || []).find((item) =>
    equalInstitutionCanonicalIdentity(item.identity, identity))
  if (pin === undefined) return { status: 'hidden_no_pin', value: null }
  if (resolver === undefined) return { status: 'hidden_not_found', value: null }
  const result = resolveExactPublishedPublicContentRevision(
    resolver,
    identity.institutionId,
    pin.contentRevision,
  )
  return result.ok && result.value !== null
    ? { status: 'ready', value: result.value }
    : { status: 'hidden_not_found', value: null }
}

const unavailableFutureSectionsWithPublicContent = (
  institutionId: string,
  publicContent: PublicContentApplicationInput,
): InstitutionDetailFutureSectionsV121 => {
  const fallback = createUnavailableFutureSectionsV121()
  return {
    ...fallback,
    publicIntroduction: projectInstitutionPublicIntroductionV121(publicContent, institutionId),
  }
}

const futureSectionsFor = (
  dataset: InstitutionCurrentCatalogDataset | null,
  record: InstitutionRecordV11,
  evaluationAsOf: string,
  publicContent: PublicContentApplicationInput,
):
  | {
      ok: true
      value: {
        sections: InstitutionDetailFutureSectionsV121
        careProcessState: InstitutionDetailSectionsV12['careProcess']['state']
      }
    }
  | { ok: false; error: { code: string } } => {
  const identity = {
    institutionId: record.institutionId,
    recordRevision: record.recordRevision,
  }
  if (dataset === null) {
    return {
      ok: true,
      value: {
        sections: unavailableFutureSectionsWithPublicContent(record.institutionId, publicContent),
        careProcessState: 'not_applicable_for_schema',
      },
    }
  }
  const source = sourceV121ForDataset(dataset, identity)
  if (!source.ok && source.error.code === 'LEGACY_DATASET_WITHOUT_V121_SOURCE') {
    return {
      ok: true,
      value: {
        sections: unavailableFutureSectionsWithPublicContent(record.institutionId, publicContent),
        careProcessState: 'not_applicable_for_schema',
      },
    }
  }
  // A V1.2.1 dataset may still be used to display a historical V1.1 pinned
  // revision. In that case there is no raw successor to project, so only the
  // exact public-content pin may be shown; all future V1.2.1 fact sections
  // remain explicitly unavailable. A current projected identity, however,
  // must fail closed if its raw source is missing or inconsistent.
  if (!source.ok && source.error.code === 'HISTORICAL_V11_SOURCE_NOT_IN_CURRENT_DATASET') {
    return {
      ok: true,
      value: {
        sections: unavailableFutureSectionsWithPublicContent(record.institutionId, publicContent),
        careProcessState: 'not_applicable_for_schema',
      },
    }
  }
  if (!source.ok) return source
  try {
    return {
      ok: true,
      value: {
        sections: projectInstitutionFutureSectionsV121(source.value, evaluationAsOf, publicContent),
        careProcessState: 'available_for_schema',
      },
    }
  } catch (_error) {
    return { ok: false, error: { code: 'V121_FUTURE_SECTION_PROJECTION_ERROR' } }
  }
}

const projectDetail = (
  record: InstitutionRecordV11,
  input: {
    contextKind: InstitutionDetailApplicationSnapshotV12['contextKind']
    source: 'direct' | 'recommendation'
    datasetVersion: string
    datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
    evaluationAsOf: string
    revisionContext: InstitutionRevisionDisplayContext
    recommendationContext: InstitutionDetailRecommendationDisplay | null
    canViewCurrentRevision: boolean
    sourceContractVersion?: InstitutionDetailApplicationSnapshotV12['sourceContractVersion']
    futureV121?: InstitutionDetailFutureSectionsV121
    careProcessState?: InstitutionDetailSectionsV12['careProcess']['state']
  },
): InstitutionDetailApplicationResultV12 => {
  try {
    return { ok: true, value: projectInstitutionDetailSnapshotV12(record, input) }
  } catch (_error) {
    return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', 'DETAIL_PROJECTION_FAILED')
  }
}

export const createInstitutionDetailApplicationServiceV12 = (
  dependencies: InstitutionDetailApplicationDependenciesV12,
) => ({
  build: async (
    input: InstitutionDetailApplicationBuildInputV12,
  ): Promise<InstitutionDetailApplicationResultV12> => {
    const identity = validateInstitutionCanonicalIdentity(input.identity)
    if (!identity.ok) return detailFailure('INSTITUTION_ROUTE_ERROR', identity.error.code)
    if (!isValidIsoTimestamp(input.evaluationAsOf)) {
      return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', 'INVALID_EVALUATION_AS_OF')
    }
    if (input.source === 'direct') {
      if (input.sourceContextRef !== null) {
        return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'DIRECT_CONTEXT_REF_FORBIDDEN')
      }
      const current = await resolveExactCurrentRevisionSafely(
        dependencies.currentCatalogResolver,
        identity.value,
      )
      if (!current.ok) {
        const code = current.error.code === 'INSTITUTION_NOT_FOUND'
          ? 'INSTITUTION_NOT_FOUND'
          : current.error.code === 'INSTITUTION_REVISION_NOT_FOUND'
            ? 'INSTITUTION_REVISION_NOT_FOUND'
            : 'INSTITUTION_CATALOG_ERROR'
        return detailFailure(code, current.error.code)
      }
      if (current.value.record.recordStatus !== 'published') {
        return detailFailure('INSTITUTION_RECORD_NOT_DISPLAYABLE', current.value.record.recordStatus)
      }
      const futureV121 = futureSectionsFor(
        current.value.dataset,
        current.value.record,
        input.evaluationAsOf,
        resolveDirectPublicContent(
          dependencies.publicContentCurrentResolver,
          identity.value.institutionId,
        ),
      )
      if (!futureV121.ok) {
        return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', futureV121.error.code)
      }
      const revisionContext = revisionContextFor(
        identity.value,
        identity.value,
        current.value.record,
        'CURRENT_INSTITUTION_CONTEXT',
      )
      return projectDetail(current.value.record, {
        contextKind: 'DIRECT_CURRENT',
        source: 'direct',
        datasetVersion: current.value.dataset.datasetVersion,
        datasetMode: current.value.dataset.datasetMode,
        evaluationAsOf: input.evaluationAsOf,
        revisionContext,
        recommendationContext: null,
        canViewCurrentRevision: false,
        futureV121: futureV121.value.sections,
        careProcessState: futureV121.value.careProcessState,
        sourceContractVersion: current.value.dataset.sourceContractVersion || 'institution-contract-v1.1',
      })
    }

    if (input.sourceContextRef === null) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_NOT_FOUND')
    }
    // Resolve the opaque context before touching current data. Context loss
    // therefore cannot silently become a current/direct Detail.
    const contextResult = dependencies.sourceContextRegistry.resolve(input.sourceContextRef)
    if (!contextResult.ok) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', contextResult.error.code)
    }
    const context = contextResult.value
    if (context.evaluationAsOf !== input.evaluationAsOf) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_EVALUATION_TIME_MISMATCH')
    }
    const association = assertInstitutionSourceContextIdentity(context, identity.value)
    if (!association.ok) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', association.error.code)
    }
    const candidate = candidateForIdentity(context, identity.value)
    if (candidate === null) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_IDENTITY_MISMATCH')
    }

    const currentResult = await loadCurrentCatalogSafely(dependencies.currentCatalogResolver)
    const currentDataset = currentResult.ok ? currentResult.value : null
    if (currentDataset !== null && currentDataset.datasetMode !== context.datasetMode) {
      return detailFailure(
        'INSTITUTION_SOURCE_CONTEXT_ERROR',
        'SOURCE_CONTEXT_DATASET_MODE_MISMATCH',
      )
    }
    const sourceCurrentDataset = currentDataset !== null
      && currentDataset.datasetVersion === context.datasetVersion
      ? currentDataset
      : null
    const resolved = await resolvePinnedRecord(
      sourceCurrentDataset,
      dependencies.historicalRevisionResolver,
      identity.value,
    )
    if (!resolved.ok) {
      return detailFailure('INSTITUTION_REVISION_NOT_FOUND', resolved.error.code)
    }
    if (resolved.value.recordStatus === 'draft') {
      return detailFailure('INSTITUTION_RECORD_NOT_DISPLAYABLE', 'draft')
    }
    if (!sourceRecordMatchesContext(context, resolved.value)) {
      return detailFailure('INSTITUTION_SOURCE_CONTEXT_ERROR', 'SOURCE_CONTEXT_RECORD_MISMATCH')
    }
    const currentIdentity = currentPublishedIdentityForInstitution(currentDataset, identity.value.institutionId)
    const isHistoricalInactive = resolved.value.recordStatus === 'suspended'
      || resolved.value.recordStatus === 'archived'
    const revisionContext = revisionContextFor(
      identity.value,
      currentIdentity,
      resolved.value,
      'PINNED_RECOMMENDATION_REVISION',
    )
    const futureV121 = futureSectionsFor(
      sourceCurrentDataset,
      resolved.value,
      context.evaluationAsOf,
      resolvePinnedPublicContent(
        dependencies.publicContentExactResolver,
        context,
        identity.value,
      ),
    )
    if (!futureV121.ok) {
      return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', futureV121.error.code)
    }
    return projectDetail(resolved.value, {
      contextKind: isHistoricalInactive ? 'HISTORICAL_READ_ONLY' : 'RECOMMENDATION_PINNED',
      source: 'recommendation',
      datasetVersion: context.datasetVersion,
      datasetMode: context.datasetMode,
      evaluationAsOf: context.evaluationAsOf,
      revisionContext,
      recommendationContext: recommendationDisplay(candidate),
      canViewCurrentRevision: currentIdentity !== null
        && !equalInstitutionCanonicalIdentity(currentIdentity, identity.value),
      futureV121: futureV121.value.sections,
      careProcessState: futureV121.value.careProcessState,
      sourceContractVersion: sourceCurrentDataset === null
        ? 'institution-contract-v1.1'
        : sourceCurrentDataset.sourceContractVersion || 'institution-contract-v1.1',
    })
  },

  buildCurrentRevision: async (
    input: InstitutionCurrentRevisionSwitchInputV12,
  ): Promise<InstitutionDetailApplicationResultV12> => {
    const original = validateInstitutionCanonicalIdentity(input.originalIdentity)
    if (!original.ok) return detailFailure('INSTITUTION_ROUTE_ERROR', original.error.code)
    if (!isValidIsoTimestamp(input.evaluationAsOf)) {
      return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', 'INVALID_EVALUATION_AS_OF')
    }
    const currentResult = await loadCurrentCatalogSafely(dependencies.currentCatalogResolver)
    if (!currentResult.ok) {
      return detailFailure('INSTITUTION_CATALOG_ERROR', currentResult.error.code)
    }
    const matches = currentResult.value.records.filter((record) =>
      record.institutionId === original.value.institutionId)
    if (matches.length === 0) return detailFailure('INSTITUTION_NOT_FOUND', 'INSTITUTION_NOT_FOUND')
    if (matches.length !== 1) {
      return detailFailure('INSTITUTION_CATALOG_ERROR', 'DUPLICATE_CURRENT_INSTITUTION_ID')
    }
    const record = matches[0]
    if (record.recordStatus !== 'published') {
      return detailFailure('INSTITUTION_RECORD_NOT_DISPLAYABLE', record.recordStatus)
    }
    const currentIdentity: InstitutionCanonicalIdentity = {
      institutionId: record.institutionId,
      recordRevision: record.recordRevision,
    }
    const revisionContext: InstitutionRevisionDisplayContext = {
      kind: 'CURRENT_INSTITUTION_CONTEXT',
      state: 'current',
      originalIdentity: original.value,
      currentIdentity,
    }
    const futureV121 = futureSectionsFor(
      currentResult.value,
      record,
      input.evaluationAsOf,
      resolveDirectPublicContent(
        dependencies.publicContentCurrentResolver,
        original.value.institutionId,
      ),
    )
    if (!futureV121.ok) {
      return detailFailure('INSTITUTION_DETAIL_PROJECTION_ERROR', futureV121.error.code)
    }
    return projectDetail(record, {
      contextKind: 'CURRENT_INSTITUTION_CONTEXT',
      source: 'direct',
      datasetVersion: currentResult.value.datasetVersion,
      datasetMode: currentResult.value.datasetMode,
      evaluationAsOf: input.evaluationAsOf,
      revisionContext,
      recommendationContext: null,
      canViewCurrentRevision: false,
      futureV121: futureV121.value.sections,
      careProcessState: futureV121.value.careProcessState,
      sourceContractVersion: currentResult.value.sourceContractVersion || 'institution-contract-v1.1',
    })
  },
})
