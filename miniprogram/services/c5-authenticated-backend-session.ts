const AUTH_CONTRACT_VERSION = 'wechat-authenticated-principal-contract-v1'
const AUTH_REQUEST_KIND = 'wechat_authentication_request_v1'
const AUTH_RESULT_KIND = 'wechat_authentication_result_v1'
const AUTH_ENDPOINT = '/api/v1/auth/wechat'
const REQUEST_TIMEOUT_MS = 15000
export const DEVELOPMENT_BACKEND_ORIGIN_STORAGE_KEY_V1 = '__dev_backend_origin_v1'

export interface WeChatC5BackendTransportV1 {
  environment(): unknown
  developmentBackendOrigin?(): unknown
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

const isValidPort = (value: string | undefined): boolean => {
  if (value === undefined) return true
  if (!/^[0-9]{1,5}$/.test(value)) return false
  const port = Number(value)
  return port >= 1 && port <= 65535
}

const parseIpv4 = (host: string): number[] | null => {
  if (!/^[0-9.]+$/.test(host)) return null
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return -1
    const value = Number(part)
    return value <= 255 ? value : -1
  })
  return octets.some((octet) => octet < 0) ? null : octets
}

const parseIpv6 = (host: string): number[] | null => {
  if (!host.startsWith('[') || !host.endsWith(']')) return null
  const address = host.slice(1, -1)
  if (address.includes('%') || !/^[0-9a-fA-F:]+$/.test(address)) return null
  const halves = address.split('::')
  if (halves.length > 2) return null
  const left = halves[0].length > 0 ? halves[0].split(':') : []
  const right = halves.length === 2 && halves[1].length > 0 ? halves[1].split(':') : []
  const groups = [...left, ...right]
  if (groups.some((group) => group.length < 1 || group.length > 4)) return null
  if (halves.length === 1 && groups.length !== 8) return null
  if (halves.length === 2 && groups.length >= 8) return null
  const parsed = groups.map((group) => parseInt(group, 16))
  if (halves.length === 1) return parsed
  const expanded = [...parsed.slice(0, left.length)]
  for (let index = parsed.length; index < 8; index += 1) expanded.push(0)
  return [...expanded, ...parsed.slice(left.length)]
}

const isPrivateIpv4 = (octets: number[]): boolean =>
  octets[0] === 10
  || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  || (octets[0] === 192 && octets[1] === 168)

const isLoopbackOrUnspecifiedIpv4 = (octets: number[]): boolean =>
  octets[0] === 127
  || octets[0] === 0

const isLoopbackOrUnspecifiedIpv6 = (groups: number[]): boolean =>
  groups.every((group) => group === 0)
  || (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1)
  || (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff)

const isValidDevelopmentBackendOrigin = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false
  const match = /^(https?):\/\/(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::([0-9]+))?$/.exec(value)
  if (!match || !isValidPort(match[3])) return false

  const scheme = match[1]
  const host = match[2]
  const ipv4 = parseIpv4(host)
  const ipv6 = parseIpv6(host)
  const hostname = host.toLowerCase()
  const domainLabels = hostname.split('.')
  const isNumericHost = domainLabels.every((label) => /^(?:[0-9]+|0x[0-9a-f]+)$/i.test(label))
  const isDomain = domainLabels.length >= 2
    && domainLabels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  if (ipv4 === null && ipv6 === null && !isDomain) return false
  if (isNumericHost && ipv4 === null) return false
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  if (ipv4 && isLoopbackOrUnspecifiedIpv4(ipv4)) return false
  if (ipv6 && isLoopbackOrUnspecifiedIpv6(ipv6)) return false

  if (scheme === 'http') {
    if (match[3] === undefined) return false
    if (ipv4) return isPrivateIpv4(ipv4)
    if (ipv6) return (ipv6[0] & 0xfe00) === 0xfc00
    return hostname.endsWith('.local')
  }

  return true
}

export const resolveC5BackendOriginV1 = (environment: unknown, developmentOrigin?: unknown): string =>
  environment === 'develop' && isValidDevelopmentBackendOrigin(developmentOrigin)
    ? developmentOrigin
    : ''

export const createDefaultWeChatC5BackendTransportV1 = (): WeChatC5BackendTransportV1 => ({
  environment: () => wx.getAccountInfoSync().miniProgram.envVersion,
  developmentBackendOrigin: () => {
    try {
      return wx.getStorageSync(DEVELOPMENT_BACKEND_ORIGIN_STORAGE_KEY_V1)
    } catch (_error) {
      return ''
    }
  },
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
        const environment = transport.environment()
        if (environment !== 'develop') return ''
        const developmentOrigin = typeof transport.developmentBackendOrigin === 'function'
          ? transport.developmentBackendOrigin()
          : undefined
        return resolveC5BackendOriginV1(environment, developmentOrigin)
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
