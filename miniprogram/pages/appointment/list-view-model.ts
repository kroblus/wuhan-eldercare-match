import type { InstitutionVisitPublicSnapshotV1 } from '../../types/appointment-institution-visit-v1'

export type AppointmentListFilter = 'all' | 'awaiting' | 'confirmed' | 'completed' | 'cancelled'
export type AppointmentListLoadState = 'loading' | 'ready_non_empty' | 'ready_empty' | 'load_error'

export interface AppointmentListFilterOption {
  key: AppointmentListFilter
  label: string
}

export interface AppointmentListCardViewModel {
  visitId: string
  status: InstitutionVisitPublicSnapshotV1['status']
  institutionLabel: string
  visitDate: string
  visitTimePreference: string
  participantLabel: string
  pickupLabel: string
  statusLabel: string
  showEvaluationAction: boolean
}

export interface AppointmentListViewModel {
  loadState: AppointmentListLoadState
  activeFilter: AppointmentListFilter
  filters: AppointmentListFilterOption[]
  visits: AppointmentListCardViewModel[]
  visibleVisits: AppointmentListCardViewModel[]
  errorMessage: string
}

export const APPOINTMENT_LIST_FILTERS: AppointmentListFilterOption[] = [
  { key: 'all', label: '全部' },
  { key: 'awaiting', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

const STATUS_LABELS: Record<InstitutionVisitPublicSnapshotV1['status'], string> = {
  requested: '待确认 · 已提交',
  contacting: '待确认 · 顾问联系中',
  scheduled: '已确认',
  completed: '已完成',
  cancelled: '已取消',
}

const matchesFilter = (
  status: InstitutionVisitPublicSnapshotV1['status'],
  filter: AppointmentListFilter,
): boolean => {
  if (filter === 'all') return true
  if (filter === 'awaiting') return status === 'requested' || status === 'contacting'
  if (filter === 'confirmed') return status === 'scheduled'
  if (filter === 'completed') return status === 'completed'
  return status === 'cancelled'
}

export const createAppointmentListViewModel = (
  visits: readonly InstitutionVisitPublicSnapshotV1[],
  activeFilter: AppointmentListFilter = 'all',
): AppointmentListViewModel => {
  const cards = visits.map((visit): AppointmentListCardViewModel => ({
    visitId: visit.visitId,
    status: visit.status,
    institutionLabel: '机构资料暂不可用',
    visitDate: visit.visitDate,
    visitTimePreference: visit.visitTimePreference,
    participantLabel: `${visit.participantCount}人同行`,
    pickupLabel: visit.pickupRequested === true ? '已提出接送需求' : '',
    statusLabel: STATUS_LABELS[visit.status],
    showEvaluationAction: visit.status === 'completed',
  }))
  const visibleVisits = filterAppointmentListCards(cards, activeFilter)

  return {
    loadState: visits.length > 0 ? 'ready_non_empty' : 'ready_empty',
    activeFilter,
    filters: APPOINTMENT_LIST_FILTERS,
    visits: cards,
    visibleVisits,
    errorMessage: '',
  }
}

export const filterAppointmentListCards = (
  cards: readonly AppointmentListCardViewModel[],
  activeFilter: AppointmentListFilter,
): AppointmentListCardViewModel[] => cards.filter((card) => matchesFilter(card.status, activeFilter))

export const unavailableAppointmentListViewModel = (): AppointmentListViewModel => ({
  loadState: 'load_error',
  activeFilter: 'all',
  filters: APPOINTMENT_LIST_FILTERS,
  visits: [],
  visibleVisits: [],
  errorMessage: '预约列表服务暂不可用，请稍后再试。',
})
