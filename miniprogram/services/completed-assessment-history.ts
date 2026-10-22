import {
  createC5AuthenticatedBackendSessionClientV1,
  createC5AuthenticatedJsonHeadersV1,
  createDefaultWeChatC5BackendTransportV1,
} from './c5-authenticated-backend-session'
import type { WeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import type { C5AuthenticatedBackendSessionV1 } from './c5-authenticated-backend-session'
import { HISTORY_API_CONTRACT_V1, HISTORY_SERVER_TEST_ONLY_SOURCE_V1 } from '../types/completed-assessment-history'
import type { CompletedAssessmentHistoryMetadataV1, CompletedAssessmentHistoryReadV1 } from '../types/completed-assessment-history'

export interface CompletedAssessmentHistoryClientV1 {
  readPage(cursor?: string): Promise<CompletedAssessmentHistoryReadV1>
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(value).sort().join('|') === keys.sort().join('|')
const id = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const timestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19)
}
const metadata = (value: unknown): value is CompletedAssessmentHistoryMetadataV1 => object(value)
  && exactKeys(value, ['kind', 'id', 'status', 'schemaVersion', 'completedAt', 'assessmentContractVersion', 'source', 'snapshotRevision'])
  && value.kind === 'completed_assessment' && id(value.id) && value.status === 'completed'
  && value.schemaVersion === 2 && timestamp(value.completedAt)
  && value.assessmentContractVersion === 'assessment-schema-v2'
  && value.source === HISTORY_SERVER_TEST_ONLY_SOURCE_V1 && value.snapshotRevision === 1
export const isCompletedAssessmentHistoryMetadataV1 = metadata

export const createCompletedAssessmentHistoryClientV1 = (
  transport: WeChatC5BackendTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): CompletedAssessmentHistoryClientV1 => {
  const sessionClient = createC5AuthenticatedBackendSessionClientV1(transport)
  const error = (reason: 'identity' | 'permission' | 'read_failed'): CompletedAssessmentHistoryReadV1 => ({ state: 'ERROR', reason })
  const scope = async (s: C5AuthenticatedBackendSessionV1): Promise<string | null> => {
    const r = await transport.request({ url: s.origin + '/api/v1/completed-assessments/save-intents/scope', method: 'GET', timeout: 15000, header: createC5AuthenticatedJsonHeadersV1(s) }), v = r.data
    return r.statusCode === 200 && object(v) && exactKeys(v, ['contractVersion','kind','scopeId','intentId','createdAt','state','item','sessionId'])
      && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'history_save_recovery_v1' && v.state === 'SCOPE'
      && id(v.scopeId) && v.intentId === null && v.createdAt === null && v.item === null && v.sessionId === null ? v.scopeId : null
  }
  return {
    async readPage(cursor?: string): Promise<CompletedAssessmentHistoryReadV1> {
      if (cursor !== undefined && !id(cursor)) return error('read_failed')
      const origin = sessionClient.resolveBackendOrigin()
      if (!origin) return { state: 'UNAVAILABLE' }
      try {
        // Probe only public feature metadata. Do not authenticate against an unknown/disabled history backend.
        const capability = await transport.request({ url: `${origin}/api/v1/completed-assessments/capability`,
          method: 'GET', timeout: 15000, header: { Accept: 'application/json' } })
        if (capability.statusCode === 404) return { state: 'UNAVAILABLE' }
        const cap = capability.data
        if (capability.statusCode !== 200 || !object(cap)
          || !exactKeys(cap, ['contractVersion', 'kind', 'availability', 'source'])
          || cap.contractVersion !== HISTORY_API_CONTRACT_V1 || cap.kind !== 'completed_assessment_history_capability_v1') return error('read_failed')
        if (cap.availability === 'unavailable' && cap.source === null) return { state: 'UNAVAILABLE' }
        if (cap.availability !== 'ready' || cap.source !== HISTORY_SERVER_TEST_ONLY_SOURCE_V1) return error('read_failed')
        sessionClient.clearSession()
        const session = await sessionClient.acquireSession(origin)
        if (session.kind !== 'authenticated') return error('identity')
        const originalScope = await scope(session.session)
        if (!originalScope) return error('permission')
        const response = await transport.request({
          url: `${session.session.origin}/api/v1/completed-assessments?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          method: 'GET', timeout: 15000, header: createC5AuthenticatedJsonHeadersV1(session.session),
        })
        if (response.statusCode === 401) { sessionClient.clearSession(); return error('identity') }
        if (response.statusCode === 403) return error('permission')
        const data = response.data
        if (response.statusCode === 503 && object(data) && data.contractVersion === HISTORY_API_CONTRACT_V1
          && data.kind === 'completed_assessment_history_error_v1' && data.code === 'UNAVAILABLE'
          && data.availability === 'unavailable') return { state: 'UNAVAILABLE' }
        if (response.statusCode !== 200 || !object(data)
          || !exactKeys(data, ['contractVersion', 'kind', 'availability', 'items', 'nextCursor'])
          || data.contractVersion !== HISTORY_API_CONTRACT_V1 || data.kind !== 'completed_assessment_history_result_v1'
          || data.availability !== 'ready' || !Array.isArray(data.items) || data.items.length > 20
          || !data.items.every(metadata) || new Set(data.items.map(item => item.id)).size !== data.items.length
          || (data.nextCursor !== null && (!id(data.nextCursor) || data.items.length === 0
            || data.nextCursor !== data.items[data.items.length - 1].id || data.nextCursor === cursor))) return error('read_failed')
        if (sessionClient.resolveBackendOrigin() !== origin || transport.environment() !== 'develop') return error('identity')
        sessionClient.clearSession()
        const current = await sessionClient.acquireSession(origin)
        if (current.kind !== 'authenticated' || await scope(current.session) !== originalScope) return error('identity')
        return { state: 'READY', records: data.items.map(item => ({ ...item })), nextCursor: data.nextCursor as string | null }
      } catch (_error) { return error('read_failed') }
    },
  }
}
