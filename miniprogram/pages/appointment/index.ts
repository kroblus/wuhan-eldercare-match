import {
  APPOINTMENT_LIST_FILTERS,
  createAppointmentListViewModel,
  filterAppointmentListCards,
  unavailableAppointmentListViewModel,
} from './list-view-model'
import type {
  AppointmentListFilter,
  AppointmentListViewModel,
} from './list-view-model'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'
import {
  createProductionAppointmentOwnerReadProviderV1,
} from '../../services/appointment-owner-read'
import type {
  AppointmentOwnerReadProviderResultV1,
  AppointmentOwnerReadProviderV1,
} from '../../services/appointment-owner-read'
import type { AppointmentOwnerReadVisitV1 } from '../../types/appointment-owner-read-v1'

interface AppointmentListPageData extends AppointmentListViewModel {
  consultantActionError: string
}

interface AppointmentFilterEvent {
  currentTarget: { dataset: { filter?: string } }
}

interface EvaluationActionEvent {
  currentTarget: { dataset: { visitId?: string } }
}

const CONSULTANT_TAB_URL = '/pages/consultant/index'

interface AppointmentListPageInstance {
  data: AppointmentListPageData
  setData(patch: Partial<AppointmentListPageData>): void
  _appointmentOwnerReadProvider?: AppointmentOwnerReadProviderV1
  _appointmentLoadLocked?: boolean
}

const isAppointmentListFilter = (value: string | undefined): value is AppointmentListFilter =>
  APPOINTMENT_LIST_FILTERS.some((item) => item.key === value)

const errorMessageFor = (result: AppointmentOwnerReadProviderResultV1): string => {
  if (result.kind === 'auth_required') return '无法确认当前账号身份，请稍后重试。'
  if (result.kind === 'unavailable') return '预约列表服务暂不可用，请稍后再试。'
  return '暂时无法读取预约记录，请稍后重试。'
}

const loadAppointments = async (page: AppointmentListPageInstance): Promise<void> => {
  if (page._appointmentLoadLocked) return
  page._appointmentLoadLocked = true
  page.setData({ loadState: 'loading', errorMessage: '' })
  try {
    const provider = page._appointmentOwnerReadProvider || createProductionAppointmentOwnerReadProviderV1()
    page._appointmentOwnerReadProvider = provider
    const result = await provider.loadOwnedVisits()
    if (result.kind === 'ready') {
      page.setData(createAppointmentListViewModel(result.visits, page.data.activeFilter))
      return
    }
    page.setData(unavailableAppointmentListViewModel(errorMessageFor(result)))
  } catch (_error) {
    page.setData(unavailableAppointmentListViewModel())
  } finally {
    page._appointmentLoadLocked = false
  }
}

Page({
  data: {
    loadState: 'loading',
    activeFilter: 'all',
    filters: APPOINTMENT_LIST_FILTERS,
    visits: [],
    visibleVisits: [],
    errorMessage: '',
    consultantActionError: '',
  } as AppointmentListPageData,

  onLoad() {
    resetNavigationGuard(this)
    return loadAppointments(this)
  },

  onShow() {
    resetNavigationGuard(this)
  },

  onRetry() {
    return loadAppointments(this)
  },

  applyApplicationData(visits: readonly AppointmentOwnerReadVisitV1[]) {
    this.setData(createAppointmentListViewModel(visits, this.data.activeFilter))
  },

  onFilterTap(event: AppointmentFilterEvent) {
    const filter = event.currentTarget.dataset.filter
    if (!isAppointmentListFilter(filter)) return

    const visits = this.data.visits
    this.setData({
      activeFilter: filter,
      visibleVisits: filterAppointmentListCards(visits, filter),
    })
  },

  openEvaluation(event: EvaluationActionEvent) {
    const visitId = event.currentTarget.dataset.visitId
    if (!visitId || !this.data.visibleVisits.some((visit) =>
      visit.visitId === visitId && visit.showEvaluationAction)) {
      return
    }

    const route = `/pages/visit/evaluation?visitId=${encodeURIComponent(visitId)}`
    navigateToWithGuard(this, 'appointment.openEvaluation', route, undefined, () => {
      wx.showToast({ title: '暂时无法打开看院评价', icon: 'none' })
    })
  },

  openConsultant() {
    if (!this.data.visibleVisits.some((visit) => visit.showContactConsultantAction)) return

    const guard = getNavigationGuard(this)
    const action = 'appointment.openConsultant'
    if (!guard.acquire(action)) return

    let succeeded = false
    let failureReported = false
    const fail = () => {
      guard.release(action)
      if (failureReported) return
      failureReported = true
      this.setData({ consultantActionError: '暂时无法打开养老顾问，请稍后重试。' })
      wx.showToast({ title: '暂时无法打开养老顾问，请稍后重试。', icon: 'none' })
    }

    this.setData({ consultantActionError: '' })
    try {
      wx.switchTab({
        url: CONSULTANT_TAB_URL,
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    } catch (_error) {
      fail()
    }
  },
})
