const AUTH_CONTRACT_VERSION = 'wechat-authenticated-principal-contract-v1'
const AUTH_REQUEST_KIND = 'wechat_authentication_request_v1'
const AUTH_RESULT_KIND = 'wechat_authentication_result_v1'
const AUTH_ENDPOINT = '/api/v1/auth/wechat'
const REQUEST_TIMEOUT_MS = 15000

export interface WeChatC5BackendTransportV1 {
  environment(): unknown
  login(): Promise<string>
  request(input: {
    url: string
    method: 'POST' | 'GET'
    timeout: number
    header: Record<string, string>
    data?: Record<string, unknown>
  }): Promise<{ statusCode: number; data: unknown }>
}

export interface C5AuthenticatedBackendSessionV1 {
  origin: string
  evidence: string
  expiresAt: number
}

export type C5BackendSessionAcquireResultV1 =
  | { kind: 'authenticated'; session: C5AuthenticatedBackendSessionV1 }
  | { kind: 'unavailable' }
  | { kind: 'load_error' }

export interface C5AuthenticatedBackendSessionClientV1 {
  resolveBackendOrigin(): string
  acquireSession(origin: string): Promise<C5BackendSessionAcquireResultV1>
  activeSession(): C5AuthenticatedBackendSessionV1 | null
  clearSession(): void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|')

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

export const resolveC5BackendOriginV1 = (environment: unknown): string =>
  environment === 'develop' ? 'http://127.0.0.1:8080' : ''

export const createDefaultWeChatC5BackendTransportV1 = (): WeChatC5BackendTransportV1 => ({
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
      data: input.data as WechatMiniprogram.IAnyObject | undefined,
      success: (response) => resolve({ statusCode: response.statusCode, data: response.data }),
      fail: () => reject(new Error('request_unavailable')),
    })
  }),
})

export const createC5AuthenticatedBackendSessionClientV1 = (
  transport: WeChatC5BackendTransportV1,
): C5AuthenticatedBackendSessionClientV1 => {
  let cachedSession: C5AuthenticatedBackendSessionV1 | null = null

  const clearSession = (): void => {
    cachedSession = null
  }

  return {
    resolveBackendOrigin(): string {
      try {
        return resolveC5BackendOriginV1(transport.environment())
      } catch (_error) {
        return ''
      }
    },

    async acquireSession(origin: string): Promise<C5BackendSessionAcquireResultV1> {
      if (cachedSession && cachedSession.origin === origin && cachedSession.expiresAt > Date.now()) {
        return { kind: 'authenticated', session: cachedSession }
      }

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

      const evidence = readSessionEvidence(authResponse.data)
      if (!evidence || !isRecord(authResponse.data) || typeof authResponse.data.expiresAt !== 'string') {
        return { kind: 'unavailable' }
      }
      const expiresAt = Date.parse(authResponse.data.expiresAt)
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { kind: 'unavailable' }
      cachedSession = { origin, evidence, expiresAt }
      return { kind: 'authenticated', session: cachedSession }
    },

    activeSession(): C5AuthenticatedBackendSessionV1 | null {
      return cachedSession
    },

    clearSession,
  }
}
