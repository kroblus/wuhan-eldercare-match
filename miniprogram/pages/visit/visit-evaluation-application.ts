import {
  cloneVisitEvaluationDraft,
  validateVisitEvaluationDraft,
} from './evaluation-view-model'
import type { VisitEvaluationDraftV1 } from './evaluation-view-model'

export interface TestOnlyVisitEvaluationContextV1 {
  provenance: 'TEST_ONLY'
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  ownerUserId: string
  visitStatus: 'completed'
}

export interface TestOnlyEvaluationSubmitInputV1 {
  provenance: 'TEST_ONLY'
  context: TestOnlyVisitEvaluationContextV1
  draft: VisitEvaluationDraftV1
}

export interface TestOnlyEvaluationContextProviderV1 {
  loadContext(visitId: string): unknown | Promise<unknown>
}

export interface TestOnlyEvaluationSubmitProviderV1 {
  submit(input: TestOnlyEvaluationSubmitInputV1): unknown | Promise<unknown>
}

export interface VisitEvaluationUiApplicationDependenciesV1 {
  testOnlyContextProvider?: TestOnlyEvaluationContextProviderV1
  testOnlySubmitProvider?: TestOnlyEvaluationSubmitProviderV1
}

export type VisitEvaluationContextResultV1 =
  | { kind: 'ready'; context: TestOnlyVisitEvaluationContextV1 }
  | { kind: 'unavailable'; reason: 'provider_missing' | 'context_invalid' }

export type VisitEvaluationSubmitResultV1 =
  | { kind: 'submitted_test_only' }
  | { kind: 'submit_failed'; reason: 'provider_missing' | 'invalid_draft' | 'provider_failed' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSafeIdentifier = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= 200
  && !/[\u0000-\u001f\u007f]/.test(value)

const isTestOnlyContextForVisit = (
  value: unknown,
  visitId: string,
): value is TestOnlyVisitEvaluationContextV1 => {
  if (!isRecord(value)) return false
  const keys = Object.keys(value).sort().join('|')
  return keys === 'institutionId|institutionRecordRevision|ownerUserId|provenance|visitId|visitStatus'
    && value.provenance === 'TEST_ONLY'
    && value.visitId === visitId
    && value.visitStatus === 'completed'
    && isSafeIdentifier(value.institutionId)
    && isSafeIdentifier(value.institutionRecordRevision)
    && isSafeIdentifier(value.ownerUserId)
}

const isTestOnlySuccess = (value: unknown): boolean => isRecord(value)
  && Object.keys(value).sort().join('|') === 'outcome|provenance'
  && value.provenance === 'TEST_ONLY'
  && value.outcome === 'submitted'

export const createVisitEvaluationUiApplicationV1 = (
  dependencies: VisitEvaluationUiApplicationDependenciesV1 = {},
) => ({
  async loadContext(visitId: string): Promise<VisitEvaluationContextResultV1> {
    const provider = dependencies.testOnlyContextProvider
    if (!provider || typeof provider.loadContext !== 'function') {
      return { kind: 'unavailable', reason: 'provider_missing' }
    }
    try {
      const candidate = await provider.loadContext(visitId)
      if (!isTestOnlyContextForVisit(candidate, visitId)) {
        return { kind: 'unavailable', reason: 'context_invalid' }
      }
      return { kind: 'ready', context: candidate }
    } catch (_error) {
      return { kind: 'unavailable', reason: 'context_invalid' }
    }
  },

  async submit(
    context: TestOnlyVisitEvaluationContextV1,
    draft: VisitEvaluationDraftV1,
  ): Promise<VisitEvaluationSubmitResultV1> {
    if (!isTestOnlyContextForVisit(context, context.visitId)) {
      return { kind: 'submit_failed', reason: 'provider_failed' }
    }
    if (validateVisitEvaluationDraft(draft).length > 0) {
      return { kind: 'submit_failed', reason: 'invalid_draft' }
    }
    const provider = dependencies.testOnlySubmitProvider
    if (!provider || typeof provider.submit !== 'function') {
      return { kind: 'submit_failed', reason: 'provider_missing' }
    }
    try {
      const result = await provider.submit({
        provenance: 'TEST_ONLY',
        context,
        draft: cloneVisitEvaluationDraft(draft),
      })
      return isTestOnlySuccess(result)
        ? { kind: 'submitted_test_only' }
        : { kind: 'submit_failed', reason: 'provider_failed' }
    } catch (_error) {
      return { kind: 'submit_failed', reason: 'provider_failed' }
    }
  },
})
