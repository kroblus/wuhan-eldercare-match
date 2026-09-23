import { buildGlobalConsultantPageApplicationV1 } from '../../services/consultant-global-page'
import type {
  ConsultantPagePhoneViewModelV1,
  ConsultantPageViewModelV1,
} from './index-view-model'
import { createConsultantPageViewModelV1 } from './index-view-model'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'
import type { C6PhoneAuthorizationResult, C6PhoneEvidenceOutcome } from '../../services/c6-phone-authorization'
import { verifyC6PhoneAuthorization } from '../../services/c6-phone-authorization'

const APPOINTMENT_URL = '/pages/appointment/create'

interface ConsultantPageData {
  pageTitle: string
  routeLabel: string
  description: string
  backEnabled: boolean
  pageState: 'loading' | ConsultantPageViewModelV1['pageState']
  viewModel: ConsultantPageViewModelV1 | null
  actionErrorKey: '' | 'phone' | 'appointment'
  actionErrorMessage: string
  phoneAuthorizationLoading: boolean
  phoneAuthorizationMessage: string
}

interface PhoneAuthorizationEvent {
  detail?: {
    code?: unknown
    errMsg?: unknown
  }
}

const phoneAuthorizationMessage = (result: C6PhoneAuthorizationResult): string => {
  if (result.authResolution !== 'authenticated' || result.phoneEvidenceOutcome === null) {
    return '暂时无法完成手机号授权核验，请稍后重试。'
  }
  if (result.phoneEvidenceOutcome === 'authorized') {
    return '本次手机号授权已核验。没有提交联系申请或预约，也不会保留可复用凭证。'
  }
  return phoneEvidenceFailureMessage(result.phoneEvidenceOutcome)
}

const phoneEvidenceFailureMessage = (outcome: C6PhoneEvidenceOutcome): string => {
  if (outcome === 'declined') return '你尚未授权手机号，仍可查看或拨打顾问公开联系方式。'
  if (outcome === 'missing') return '未取得手机号授权凭证，请重新操作。'
  if (outcome === 'expired' || outcome === 'invalid') return '手机号授权凭证无效或已失效，请重新授权。'
  return '暂时无法完成手机号授权核验，请稍后重试。'
}

const getPhoneAuthorizationCode = (event: PhoneAuthorizationEvent): string => {
  const detail = event && event.detail
  const code = detail && detail.code
  return typeof code === 'string' ? code : ''
}

const isAuthorizationDeclined = (event: PhoneAuthorizationEvent): boolean => {
  const errMsg = event && event.detail && event.detail.errMsg
  if (typeof errMsg !== 'string') return false
  const normalized = errMsg.toLowerCase()
  return normalized.indexOf('deny') >= 0 || normalized.indexOf('cancel') >= 0
}

const isDevelopmentWechatRuntime = (() => {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion === 'develop'
  } catch (_error) {
    return false
  }
})()

const logPhoneAuthorizationDiagnostic = (
  codePresent: boolean,
  category: 'declined' | 'missing' | null,
): void => {
  if (!isDevelopmentWechatRuntime) return
  try {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return
    console.log('C6_PHONE_AUTH_CALLBACK', {
      callbackReached: true,
      codePresent,
      category,
    })
  } catch (_error) {
    // Diagnostics must not affect the native authorization callback path.
  }
}

const runPhoneAction = (
  instance: object,
  phone: ConsultantPagePhoneViewModelV1,
  onFailure: () => void,
): boolean => {
  if (!phone.actionAvailable || !phone.dialValue) return false
  const guard = getNavigationGuard(instance)
  const actionKey = 'consultant.phone'
  if (!guard.acquire(actionKey)) return false
  let released = false
  let reported = false
  const release = () => {
    if (released) return
    released = true
    guard.release(actionKey)
  }
  const fail = () => {
    if (!reported) {
      reported = true
      onFailure()
    }
    release()
  }
  try {
    wx.makePhoneCall({
      phoneNumber: phone.dialValue,
      success: () => {},
      fail,
      complete: release,
    })
  } catch (_error) {
    fail()
    return false
  }
  return true
}

Component({
  data: {
    pageTitle: '养老顾问',
    routeLabel: '顾问 · 武汉服务',
    description: '在画像、推荐、机构差异和看院安排之间，获得真实、清楚的人工协助。',
    backEnabled: false,
    pageState: 'loading',
    viewModel: null,
    actionErrorKey: '',
    actionErrorMessage: '',
    phoneAuthorizationLoading: false,
    phoneAuthorizationMessage: '',
  } as ConsultantPageData,

  lifetimes: {
    attached() {
      this.loadConsultant()
    },
  },

  pageLifetimes: {
    show() {
      resetNavigationGuard(this)
    },
  },

  methods: {
    loadConsultant() {
      this.setData({
        pageState: 'loading',
        viewModel: null,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
      try {
        const result = buildGlobalConsultantPageApplicationV1()
        const viewModel = createConsultantPageViewModelV1(result)
        this.setData({
          pageState: viewModel.pageState,
          viewModel,
          actionErrorKey: '',
          actionErrorMessage: '',
        })
      } catch (_error) {
        this.setData({
          pageState: 'failure',
          viewModel: createConsultantPageViewModelV1({
            ok: false,
            error: {
              kind: 'global_consultant_public_application_failure_v1',
              status: 'unavailable',
            },
          }),
          actionErrorKey: '',
          actionErrorMessage: '',
        })
      }
    },

    onRetry() {
      if (this.data.pageState === 'loading') return
      this.loadConsultant()
    },

    onPhoneTap() {
      if (this.data.pageState === 'loading' || this.data.viewModel === null) return
      this.setData({ actionErrorKey: '', actionErrorMessage: '' })
      runPhoneAction(this, this.data.viewModel.phone, () => {
        this.setData({
          actionErrorKey: 'phone',
          actionErrorMessage: '暂时无法拨打顾问电话，请稍后重试。',
        })
      })
    },

    onPhoneAuthorization(event: PhoneAuthorizationEvent) {
      if (this.data.phoneAuthorizationLoading) return
      const code = getPhoneAuthorizationCode(event)
      if (code.length === 0) {
        const outcome: C6PhoneEvidenceOutcome = isAuthorizationDeclined(event) ? 'declined' : 'missing'
        logPhoneAuthorizationDiagnostic(false, outcome)
        this.setData({
          phoneAuthorizationLoading: false,
          phoneAuthorizationMessage: phoneEvidenceFailureMessage(outcome),
        })
        return
      }

      logPhoneAuthorizationDiagnostic(true, null)
      this.setData({ phoneAuthorizationLoading: true, phoneAuthorizationMessage: '' })
      verifyC6PhoneAuthorization(code, (result) => {
        this.setData({
          phoneAuthorizationLoading: false,
          phoneAuthorizationMessage: phoneAuthorizationMessage(result),
        })
      })
    },

    onAppointmentTap() {
      if (this.data.pageState === 'loading') return
      this.setData({ actionErrorKey: '', actionErrorMessage: '' })
      navigateToWithGuard(this, 'consultant.appointment', APPOINTMENT_URL, undefined, () => {
        this.setData({
          actionErrorKey: 'appointment',
          actionErrorMessage: '暂时无法打开预约看院入口，请稍后重试。',
        })
      })
    },
  },
})
