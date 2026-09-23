const AUTH_CONTRACT_VERSION = 'wechat-authenticated-principal-contract-v1'
const AUTH_REQUEST_KIND = 'wechat_authentication_request_v1'
const AUTH_RESULT_KIND = 'wechat_authentication_result_v1'
const CONTACT_CONTRACT_VERSION = 'authenticated-visit-submission-persistence-contract-v1'
const PHONE_REQUEST_KIND = 'purpose_bound_phone_verification_request_v1'
const PHONE_RESULT_KIND = 'purpose_bound_phone_verification_result_v1'
const PHONE_PURPOSE = 'appointment_or_consultant_contact'

const AUTH_ENDPOINT = '/api/v1/auth/wechat'
const PHONE_VERIFY_ENDPOINT = '/api/v1/auth/wechat/phone/verify'

export type C6AuthResolution =
  | 'authenticated'
  | 'missing'
  | 'expired'
  | 'invalid'
  | 'unavailable'
  | 'technical_failure'

export type C6PhoneEvidenceOutcome =
  | 'authorized'
  | 'missing'
  | 'declined'
  | 'expired'
  | 'invalid'
  | 'unavailable'
  | 'technical_failure'

export interface C6PhoneAuthorizationResult {
  authResolution: C6AuthResolution
  phoneEvidenceOutcome: C6PhoneEvidenceOutcome | null
}

type BackendEnvironment = 'develop' | 'trial' | 'release'

const BACKEND_ORIGIN_BY_ENVIRONMENT: Record<BackendEnvironment, string> = {
  develop: 'http://127.0.0.1:8080',
  trial: '',
  release: '',
}

export const resolveC6BackendOrigin = (environment: unknown): string => {
  if (environment !== 'develop' && environment !== 'trial' && environment !== 'release') return ''
  return BACKEND_ORIGIN_BY_ENVIRONMENT[environment]
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

const AUTH_RESOLUTIONS: readonly C6AuthResolution[] = [
  'authenticated', 'missing', 'expired', 'invalid', 'unavailable', 'technical_failure',
]

const PHONE_OUTCOMES: readonly C6PhoneEvidenceOutcome[] = [
  'authorized', 'missing', 'declined', 'expired', 'invalid', 'unavailable', 'technical_failure',
]

const readPhoneAuthorizationResult = (value: unknown): C6PhoneAuthorizationResult | null => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contractVersion', 'kind', 'authResolution', 'phoneEvidenceOutcome',
  ])) return null
  if (value.contractVersion !== CONTACT_CONTRACT_VERSION || value.kind !== PHONE_RESULT_KIND) return null
  if (typeof value.authResolution !== 'string'
    || !AUTH_RESOLUTIONS.includes(value.authResolution as C6AuthResolution)) return null

  const authResolution = value.authResolution as C6AuthResolution
  if (authResolution !== 'authenticated') {
    return value.phoneEvidenceOutcome === null
      ? { authResolution, phoneEvidenceOutcome: null }
      : null
  }
  if (typeof value.phoneEvidenceOutcome !== 'string'
    || !PHONE_OUTCOMES.includes(value.phoneEvidenceOutcome as C6PhoneEvidenceOutcome)) return null

  return {
    authResolution,
    phoneEvidenceOutcome: value.phoneEvidenceOutcome as C6PhoneEvidenceOutcome,
  }
}

const unavailable = (): C6PhoneAuthorizationResult => ({
  authResolution: 'unavailable',
  phoneEvidenceOutcome: null,
})

export const verifyC6PhoneAuthorization = (
  phoneAuthorizationCode: string,
  onComplete: (result: C6PhoneAuthorizationResult) => void,
): void => {
  let completed = false
  const finish = (result: C6PhoneAuthorizationResult) => {
    if (completed) return
    completed = true
    onComplete(result)
  }

  if (typeof phoneAuthorizationCode !== 'string' || phoneAuthorizationCode.trim().length === 0) {
    finish({ authResolution: 'missing', phoneEvidenceOutcome: null })
    return
  }

  let origin = ''
  try {
    origin = resolveC6BackendOrigin(wx.getAccountInfoSync().miniProgram.envVersion)
  } catch (_error) {
    finish(unavailable())
    return
  }
  if (origin.length === 0) {
    finish(unavailable())
    return
  }

  try {
    wx.login({
      success: (loginResult) => {
        const loginCode = loginResult && typeof loginResult.code === 'string' ? loginResult.code : ''
        if (loginCode.length === 0) {
          finish(unavailable())
          return
        }

        try {
          wx.request({
            url: `${origin}${AUTH_ENDPOINT}`,
            method: 'POST',
            timeout: 15_000,
            header: { 'Content-Type': 'application/json' },
            data: {
              contractVersion: AUTH_CONTRACT_VERSION,
              kind: AUTH_REQUEST_KIND,
              loginCode,
            },
            success: (authResponse) => {
              if (authResponse.statusCode < 200 || authResponse.statusCode >= 300) {
                finish(unavailable())
                return
              }
              const sessionEvidence = readSessionEvidence(authResponse.data)
              if (sessionEvidence.length === 0) {
                finish(unavailable())
                return
              }

              try {
                wx.request({
                  url: `${origin}${PHONE_VERIFY_ENDPOINT}`,
                  method: 'POST',
                  timeout: 15_000,
                  header: {
                    'Content-Type': 'application/json',
                    'X-Auth-Evidence': sessionEvidence,
                  },
                  data: {
                    contractVersion: CONTACT_CONTRACT_VERSION,
                    kind: PHONE_REQUEST_KIND,
                    purpose: PHONE_PURPOSE,
                    code: phoneAuthorizationCode,
                  },
                  success: (phoneResponse) => {
                    if (phoneResponse.statusCode < 200 || phoneResponse.statusCode >= 300) {
                      finish(unavailable())
                      return
                    }
                    finish(readPhoneAuthorizationResult(phoneResponse.data) || unavailable())
                  },
                  fail: () => finish(unavailable()),
                })
              } catch (_error) {
                finish(unavailable())
              }
            },
            fail: () => finish(unavailable()),
          })
        } catch (_error) {
          finish(unavailable())
        }
      },
      fail: () => finish(unavailable()),
    })
  } catch (_error) {
    finish(unavailable())
  }
}
