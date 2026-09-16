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
