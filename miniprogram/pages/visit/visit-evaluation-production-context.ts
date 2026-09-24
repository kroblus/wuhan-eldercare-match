const AUTH_CONTRACT_VERSION = 'wechat-authenticated-principal-contract-v1'
const AUTH_REQUEST_KIND = 'wechat_authentication_request_v1'
const AUTH_RESULT_KIND = 'wechat_authentication_result_v1'
const CONTEXT_CONTRACT_VERSION = 'authenticated-visit-evaluation-context-contract-v1'
const CONTEXT_RESULT_KIND = 'authenticated_visit_evaluation_context_result_v1'

const AUTH_ENDPOINT = '/api/v1/auth/wechat'
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

export interface WeChatEvaluationContextTransportV1 {
  environment(): unknown
  login(): Promise<string>
  request(input: {
    url: string
    method: 'POST' | 'GET'
    timeout: number
    header: Record<string, string>
    data?: Record<string, string>
  }): Promise<{ statusCode: number; data: unknown }>
}

export interface ProductionVisitEvaluationContextProviderV1 {
  loadContext(visitId: string): Promise<ProductionVisitEvaluationContextResultV1>
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

const readSessionEvidence = (value: unknown): string => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'outcome', 'code', 'sessionEvidence', 'expiresAt',
  ])) return ''

  if (value.contractVersion !== AUTH_CONTRACT_VERSION
    || value.kind !== AUTH_RESULT_KIND
    || value.outcome !== 'AUTHENTICATED'
    || value.code !== 'AUTHENTICATED'
    || typeof value.sessionEvidence !== 'string'
    || value.sessionEvidence.trim().length === 0
    || typeof value.expiresAt !== 'string') return ''

  const expiresAt = Date.parse(value.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return ''
  return value.sessionEvidence
}

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

const createDefaultTransport = (): WeChatEvaluationContextTransportV1 => ({
  environment: () => wx.getAccountInfoSync().miniProgram.envVersion,
  login: () => new Promise((resolve, reject) => {
    wx.login({
      success: (result) => resolve(result && typeof result.code === 'string' ? result.code : ''),
      fail: () => reject(new Error('login_unavailable')),
    })
  }),
  request: (input) => new Promise((resolve, reject) => {
    wx.request({
      url: input.url,
      method: input.method,
      timeout: input.timeout,
      header: input.header,
      data: input.data,
      success: (response) => resolve({ statusCode: response.statusCode, data: response.data }),
      fail: () => reject(new Error('request_unavailable')),
    })
  }),
})

const resolveBackendOrigin = (environment: unknown): string =>
  environment === 'develop' ? 'http://127.0.0.1:8080' : ''

export const createProductionVisitEvaluationContextProviderV1 = (
  transport: WeChatEvaluationContextTransportV1 = createDefaultTransport(),
): ProductionVisitEvaluationContextProviderV1 => ({
  async loadContext(visitId: string): Promise<ProductionVisitEvaluationContextResultV1> {
    if (!isSafeIdentifier(visitId)) return { kind: 'unavailable' }

    let origin = ''
    try {
      origin = resolveBackendOrigin(transport.environment())
    } catch (_error) {
      return { kind: 'unavailable' }
    }
    if (origin.length === 0) return { kind: 'unavailable' }

    let loginCode = ''
    try {
      loginCode = await transport.login()
    } catch (_error) {
      return { kind: 'load_error' }
    }
    if (typeof loginCode !== 'string' || loginCode.length === 0) return { kind: 'load_error' }

    let authResponse: { statusCode: number; data: unknown }
    try {
      authResponse = await transport.request({
        url: `${origin}${AUTH_ENDPOINT}`,
        method: 'POST',
        timeout: REQUEST_TIMEOUT_MS,
        header: { 'Content-Type': 'application/json' },
        data: {
          contractVersion: AUTH_CONTRACT_VERSION,
          kind: AUTH_REQUEST_KIND,
          loginCode,
        },
      })
    } catch (_error) {
      return { kind: 'load_error' }
    }
    if (authResponse.statusCode < 200 || authResponse.statusCode >= 300) return { kind: 'load_error' }
    const sessionEvidence = readSessionEvidence(authResponse.data)
    if (sessionEvidence.length === 0) return { kind: 'unavailable' }

    let contextResponse: { statusCode: number; data: unknown }
    try {
      contextResponse = await transport.request({
        url: `${origin}${CONTEXT_ENDPOINT}/${encodeURIComponent(visitId)}/evaluation-context`,
        method: 'GET',
        timeout: REQUEST_TIMEOUT_MS,
        header: {
          Accept: 'application/json',
          'X-Auth-Evidence': sessionEvidence,
        },
      })
    } catch (_error) {
      return { kind: 'load_error' }
    }
    if (contextResponse.statusCode < 200 || contextResponse.statusCode >= 300) return { kind: 'load_error' }
    return readProductionVisitEvaluationContextResponseV1(contextResponse.data, visitId)
  },
})
