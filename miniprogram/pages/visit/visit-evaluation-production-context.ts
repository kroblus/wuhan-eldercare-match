import {
  createProductionVisitEvaluationSubmitProviderV1,
  createVisitEvaluationSubmissionBodyV1,
} from './visit-evaluation-production-submit'
import type {
  ProductionVisitEvaluationSubmitProviderV1,
} from './visit-evaluation-production-submit'
import {
  createC5AuthenticatedBackendSessionClientV1,
  createDefaultWeChatC5BackendTransportV1,
} from '../../services/c5-authenticated-backend-session'
import type {
  C5AuthenticatedBackendSessionV1,
  WeChatC5BackendTransportV1,
} from '../../services/c5-authenticated-backend-session'

const CONTEXT_CONTRACT_VERSION = 'authenticated-visit-evaluation-context-contract-v1'
const CONTEXT_RESULT_KIND = 'authenticated_visit_evaluation_context_result_v1'

const CONTEXT_ENDPOINT = '/api/v1/visits'
const REQUEST_TIMEOUT_MS = 15000

type AuthResolution = 'authenticated' | 'missing' | 'expired' | 'invalid' | 'unavailable' | 'technical_failure'
type VisitStatus = 'requested' | 'contacting' | 'scheduled' | 'completed' | 'cancelled'
type ContextAvailability = 'eligible' | 'not_completed' | 'not_found' | 'unavailable' | 'technical_failure'

export interface ProductionVisitEvaluationContextV1 {
  provenance: 'PRODUCTION'
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  visitStatus: 'completed'
}

export type ProductionVisitEvaluationContextResultV1 =
  | { kind: 'eligible'; context: ProductionVisitEvaluationContextV1 }
  | { kind: 'not_completed' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'load_error' }

export interface WeChatEvaluationContextTransportV1 extends WeChatC5BackendTransportV1 {}

export interface ProductionVisitEvaluationContextProviderV1 {
  loadContext(visitId: string): Promise<ProductionVisitEvaluationContextResultV1>
}

export interface ProductionVisitEvaluationProvidersV1 {
  contextProvider: ProductionVisitEvaluationContextProviderV1
  submitProvider: ProductionVisitEvaluationSubmitProviderV1
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isSafeIdentifier = (value: unknown): value is string =>
  typeof value === 'string'
  && value.trim().length > 0
  && value.length <= 200
  && !/[\u0000-\u001f\u007f]/.test(value)

const VISIT_STATUSES: readonly VisitStatus[] = [
  'requested', 'contacting', 'scheduled', 'completed', 'cancelled',
]

const AUTH_RESOLUTIONS: readonly AuthResolution[] = [
  'authenticated', 'missing', 'expired', 'invalid', 'unavailable', 'technical_failure',
]

const CONTEXT_AVAILABILITIES: readonly ContextAvailability[] = [
  'eligible', 'not_completed', 'not_found', 'unavailable', 'technical_failure',
]

const readContext = (value: unknown, expectedVisitId: string): {
  visitId: string
  institutionId: string
  institutionRecordRevision: string
  visitStatus: VisitStatus
} | null => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'visitId', 'institutionId', 'institutionRecordRevision', 'visitStatus',
  ])) return null
  if (value.visitId !== expectedVisitId
    || !isSafeIdentifier(value.institutionId)
    || !isSafeIdentifier(value.institutionRecordRevision)
    || typeof value.visitStatus !== 'string'
    || !VISIT_STATUSES.includes(value.visitStatus as VisitStatus)) return null
  return {
    visitId: value.visitId,
    institutionId: value.institutionId,
    institutionRecordRevision: value.institutionRecordRevision,
    visitStatus: value.visitStatus as VisitStatus,
  }
}

export const readProductionVisitEvaluationContextResponseV1 = (
  value: unknown,
  expectedVisitId: string,
): ProductionVisitEvaluationContextResultV1 => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'authResolution', 'availability', 'context',
  ])) return { kind: 'load_error' }
  if (value.contractVersion !== CONTEXT_CONTRACT_VERSION
    || value.kind !== CONTEXT_RESULT_KIND
    || typeof value.authResolution !== 'string'
    || !AUTH_RESOLUTIONS.includes(value.authResolution as AuthResolution)) return { kind: 'load_error' }

  if (value.authResolution !== 'authenticated') {
    if (value.availability !== null || value.context !== null) return { kind: 'load_error' }
    if (value.authResolution === 'unavailable') return { kind: 'unavailable' }
    if (value.authResolution === 'technical_failure') return { kind: 'load_error' }
    return { kind: 'denied' }
  }

  if (typeof value.availability !== 'string'
    || !CONTEXT_AVAILABILITIES.includes(value.availability as ContextAvailability)) return { kind: 'load_error' }

  const availability = value.availability as ContextAvailability
  if (availability === 'not_found') {
    return value.context === null ? { kind: 'denied' } : { kind: 'load_error' }
  }
  if (availability === 'unavailable') {
    return value.context === null ? { kind: 'unavailable' } : { kind: 'load_error' }
  }
  if (availability === 'technical_failure') {
    if (value.context !== null) return { kind: 'load_error' }
    return { kind: 'load_error' }
  }

  const context = readContext(value.context, expectedVisitId)
  if (!context) return { kind: 'load_error' }
  if (availability === 'not_completed') {
    return context.visitStatus !== 'completed' ? { kind: 'not_completed' } : { kind: 'load_error' }
  }
  if (context.visitStatus !== 'completed') return { kind: 'load_error' }
  return {
    kind: 'eligible',
    context: {
      provenance: 'PRODUCTION',
      visitId: context.visitId,
      institutionId: context.institutionId,
      institutionRecordRevision: context.institutionRecordRevision,
      visitStatus: 'completed',
    },
  }
}

export const createProductionVisitEvaluationProvidersV1 = (
  transport: WeChatEvaluationContextTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): ProductionVisitEvaluationProvidersV1 => {
  const sessionClient = createC5AuthenticatedBackendSessionClientV1(transport)

  const contextProvider: ProductionVisitEvaluationContextProviderV1 = {
    async loadContext(visitId: string): Promise<ProductionVisitEvaluationContextResultV1> {
      if (!isSafeIdentifier(visitId)) return { kind: 'unavailable' }

      const origin = sessionClient.resolveBackendOrigin()
      if (origin.length === 0) return { kind: 'unavailable' }

      const sessionResult = await sessionClient.acquireSession(origin)
      if (sessionResult.kind !== 'authenticated') return { kind: sessionResult.kind }

      let contextResponse: { statusCode: number; data: unknown }
      try {
        contextResponse = await transport.request({
          url: `${origin}${CONTEXT_ENDPOINT}/${encodeURIComponent(visitId)}/evaluation-context`,
          method: 'GET',
          timeout: REQUEST_TIMEOUT_MS,
          header: {
            Accept: 'application/json',
            'X-Auth-Evidence': sessionResult.session.evidence,
          },
        })
      } catch (_error) {
        return { kind: 'load_error' }
      }
      if (contextResponse.statusCode < 200 || contextResponse.statusCode >= 300) return { kind: 'load_error' }
      if (isRecord(contextResponse.data)
        && ['missing', 'expired', 'invalid'].includes(String(contextResponse.data.authResolution))) {
        sessionClient.clearSession()
      }
      return readProductionVisitEvaluationContextResponseV1(contextResponse.data, visitId)
    },
  }

  const submitProvider = createProductionVisitEvaluationSubmitProviderV1({
    submit: async (request) => {
      const session = sessionClient.activeSession() as C5AuthenticatedBackendSessionV1 | null
      if (!session || session.expiresAt <= Date.now()) {
        sessionClient.clearSession()
        return null
      }
      return transport.request({
        url: `${session.origin}${CONTEXT_ENDPOINT}/${encodeURIComponent(request.visitId)}/evaluation`,
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        header: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Evidence': session.evidence,
        },
        data: createVisitEvaluationSubmissionBodyV1(request),
      })
    },
    clearSession: sessionClient.clearSession,
  })

  return { contextProvider, submitProvider }
}

export const createProductionVisitEvaluationContextProviderV1 = (
  transport: WeChatEvaluationContextTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): ProductionVisitEvaluationContextProviderV1 =>
  createProductionVisitEvaluationProvidersV1(transport).contextProvider
