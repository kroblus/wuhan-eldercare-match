import {
  createC5AuthenticatedJsonHeadersV1,
  createC5AuthenticatedBackendSessionClientV1,
  createDefaultWeChatC5BackendTransportV1,
} from './c5-authenticated-backend-session'
import type { WeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import type { C5BackendSessionAcquireResultV1 } from './c5-authenticated-backend-session'

const ELDER_RECORD_ENDPOINT = '/api/v1/elder-record'
const ELDER_RECORD_CONTRACT_VERSION = 'elder-record-identity-api-v1'
const ELDER_RECORD_RESOLUTION_KIND = 'elder_record_resolution_result_v1'
const REQUEST_TIMEOUT_MS = 15000

export type ElderRecordReadOnlyDiagnosticResultV1 =
  | { kind: 'exists' }
  | { kind: 'not_found' }
  | { kind: 'auth_unavailable' }
  | { kind: 'service_unavailable' }
  | { kind: 'malformed' }

export interface ElderRecordReadOnlyDiagnosticClientV1 {
  resolveCurrentElderRecordReadOnly(): Promise<ElderRecordReadOnlyDiagnosticResultV1>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

const isOpaqueIdentifier = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= 200
  && value === value.trim()
  && !/[\u0000-\u001f\u007f]/.test(value)

const readSafeClassification = (value: unknown): ElderRecordReadOnlyDiagnosticResultV1 => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'authResolution', 'availability', 'elderId',
  ]) || value.contractVersion !== ELDER_RECORD_CONTRACT_VERSION
    || value.kind !== ELDER_RECORD_RESOLUTION_KIND) return { kind: 'malformed' }

  if (value.authResolution === 'missing' || value.authResolution === 'expired'
    || value.authResolution === 'invalid' || value.authResolution === 'unavailable') {
    return value.availability === null && value.elderId === null
      ? { kind: 'auth_unavailable' }
      : { kind: 'malformed' }
  }
  if (value.authResolution === 'technical_failure') {
    return value.availability === null && value.elderId === null
      ? { kind: 'service_unavailable' }
      : { kind: 'malformed' }
  }
  if (value.authResolution !== 'authenticated') return { kind: 'malformed' }

  if (value.availability === 'bound' && isOpaqueIdentifier(value.elderId)) return { kind: 'exists' }
  if (value.availability === 'not_found' && value.elderId === null) return { kind: 'not_found' }
  if ((value.availability === 'unavailable' || value.availability === 'technical_failure')
    && value.elderId === null) return { kind: 'service_unavailable' }
  return { kind: 'malformed' }
}

export const isElderRecordDiagnosticDevelopRuntimeV1 = (): boolean => {
  try {
    return createDefaultWeChatC5BackendTransportV1().environment() === 'develop'
  } catch (_error) {
    return false
  }
}

export const createElderRecordReadOnlyDiagnosticClientV1 = (
  transport: WeChatC5BackendTransportV1 = createDefaultWeChatC5BackendTransportV1(),
): ElderRecordReadOnlyDiagnosticClientV1 => {
  const sessionClient = createC5AuthenticatedBackendSessionClientV1(transport)

  return {
    async resolveCurrentElderRecordReadOnly(): Promise<ElderRecordReadOnlyDiagnosticResultV1> {
      const origin = sessionClient.resolveBackendOrigin()
      if (origin.length === 0) return { kind: 'service_unavailable' }

      let sessionResult: C5BackendSessionAcquireResultV1
      try {
        sessionResult = await sessionClient.acquireSession(origin)
      } catch (_error) {
        return { kind: 'auth_unavailable' }
      }
      if (sessionResult.kind !== 'authenticated') return { kind: 'auth_unavailable' }

      let response: { statusCode: number; data: unknown }
      try {
        response = await transport.request({
          url: `${sessionResult.session.origin}${ELDER_RECORD_ENDPOINT}`,
          method: 'GET',
          timeout: REQUEST_TIMEOUT_MS,
          header: createC5AuthenticatedJsonHeadersV1(sessionResult.session),
        })
      } catch (_error) {
        return { kind: 'service_unavailable' }
      }

      if (!response || !Number.isInteger(response.statusCode)) return { kind: 'malformed' }
      if (response.statusCode === 401 || response.statusCode === 403) {
        sessionClient.clearSession()
        return { kind: 'auth_unavailable' }
      }
      if (response.statusCode !== 200) return { kind: 'service_unavailable' }

      const result = readSafeClassification(response.data)
      if (result.kind === 'auth_unavailable') sessionClient.clearSession()
      return result
    },
  }
}
