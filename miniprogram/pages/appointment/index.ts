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
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'
import type { InstitutionVisitPublicSnapshotV1 } from '../../types/appointment-institution-visit-v1'

interface AppointmentListPageData extends AppointmentListViewModel {}

interface AppointmentFilterEvent {
  currentTarget: { dataset: { filter?: string } }
}

interface EvaluationActionEvent {
  currentTarget: { dataset: { visitId?: string } }
}

const isAppointmentListFilter = (value: string | undefined): value is AppointmentListFilter =>
  APPOINTMENT_LIST_FILTERS.some((item) => item.key === value)

Page({
  data: {
    loadState: 'loading',
    activeFilter: 'all',
    filters: APPOINTMENT_LIST_FILTERS,
    visits: [],
    visibleVisits: [],
    errorMessage: '',
  } as AppointmentListPageData,

  onLoad() {
    resetNavigationGuard(this)
    this.setData({ loadState: 'loading', errorMessage: '' })

    // Owner-read remains deferred. Keep production explicitly unavailable until an
    // authenticated, permission-filtered application provider is connected.
    this.setData(unavailableAppointmentListViewModel())
  },

  onShow() {
    resetNavigationGuard(this)
  },

  applyApplicationData(visits: readonly InstitutionVisitPublicSnapshotV1[]) {
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
})
