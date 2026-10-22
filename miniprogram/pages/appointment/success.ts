import {
  consumeAppointmentSuccessHandoffV1,
  validateAppointmentCreateSuccessHandoffV1,
} from '../../services/appointment-create-client'
import type {
  AppointmentCreateSuccessHandoffV1,
} from '../../types/appointment-create-v1'
import { formatTime } from '../../utils/util'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'

type SuccessPageState = 'unavailable' | 'ready'
type SuccessAction = '' | 'consultant' | 'appointments' | 'home' | 'back'

interface AppointmentSuccessPageData {
  pageState: SuccessPageState
  handoff: AppointmentCreateSuccessHandoffV1 | null
  acceptedAtDisplay: string
  actionErrorKey: SuccessAction
  actionErrorMessage: string
}

const hasExactQuery = (query: Record<string, string | undefined>): boolean => {
  const keys = Object.keys(query).sort()
  return keys.length === 1 && keys[0] === 'handoffId'
}

const runTabAction = (
  instance: WechatMiniprogram.Page.Instance<AppointmentSuccessPageData, WechatMiniprogram.IAnyObject>,
  action: 'home',
): void => {
  if (instance.data.pageState !== 'ready' || instance.data.handoff === null) return
  const guard = getNavigationGuard(instance)
  const key = `appointment.success.${action}`
  if (!guard.acquire(key)) return
  let succeeded = false
  let failureReported = false
  const fail = (): void => {
    guard.release(key)
    if (failureReported) return
    failureReported = true
    instance.setData({
      actionErrorKey: action,
      actionErrorMessage: '暂时无法返回首页，请稍后重试。',
    })
  }
  try {
    wx.switchTab({
      url: '/pages/home/index',
      success: () => { succeeded = true },
      fail,
      complete: () => { if (!succeeded) fail() },
    })
  } catch (_error) {
    fail()
  }
}

Page({
  data: {
    pageState: 'unavailable',
    handoff: null,
    acceptedAtDisplay: '',
    actionErrorKey: '',
    actionErrorMessage: '',
  } as AppointmentSuccessPageData,

  onLoad(query: Record<string, string | undefined>) {
    if (!hasExactQuery(query) || typeof query.handoffId !== 'string') {
      this.setData({
        pageState: 'unavailable',
        handoff: null,
        acceptedAtDisplay: '',
        actionErrorKey: '',
        actionErrorMessage: '',
      })
      return
    }
    const consumed = consumeAppointmentSuccessHandoffV1(query.handoffId)
    const handoff = validateAppointmentCreateSuccessHandoffV1(consumed)
    if (!handoff) {
      this.setData({
        pageState: 'unavailable',
        handoff: null,
        acceptedAtDisplay: '',
        actionErrorKey: '',
        actionErrorMessage: '',
      })
      return
    }
    this.setData({
      pageState: 'ready',
      handoff,
      acceptedAtDisplay: formatTime(new Date(handoff.receipt.acceptedAt)),
      actionErrorKey: '',
      actionErrorMessage: '',
    })
  },

  onShow() {
    resetNavigationGuard(this)
  },

  onContactConsultant() {
    if (this.data.pageState !== 'ready' || this.data.handoff === null) return
    navigateToWithGuard(this, 'appointment.success.consultant', '/pages/consultant/consultation', undefined, () => {
      this.setData({
        actionErrorKey: 'consultant',
        actionErrorMessage: '暂时无法打开养老顾问页面，请稍后重试。',
      })
    })
  },

  onViewAppointments() {
    if (this.data.pageState !== 'ready' || this.data.handoff === null) return
    navigateToWithGuard(this, 'appointment.success.appointments', '/pages/appointment/index', undefined, () => {
      this.setData({
        actionErrorKey: 'appointments',
        actionErrorMessage: '暂时无法打开我的预约，请稍后重试。',
      })
    })
  },

  onReturnHome() {
    runTabAction(this, 'home')
  },

  onNavigationFailure() {
    if (this.data.pageState !== 'ready') return
    this.setData({
      actionErrorKey: 'back',
      actionErrorMessage: '暂时无法返回，请使用下方入口继续。',
    })
  },
})
