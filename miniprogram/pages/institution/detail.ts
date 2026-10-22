import {
  buildInstitutionCurrentRevisionSnapshot,
  buildInstitutionDetailPageSnapshot,
} from '../../services/institution-list-detail-page'
import {
  parseInstitutionDetailRouteQuery,
  serializeInstitutionDetailRoute,
} from '../../services/institution-detail-route'
import type { InstitutionDetailRoute } from '../../services/institution-detail-route'
import { canRequestInstitutionService } from '../../runtime/institution-service-access'
import { readInstitutionSourceNotes } from '../../runtime/institution-source-notes'
import { createDetailReading } from './detail-reading'
import {
  createInstitutionDetailErrorViewModel,
  createInstitutionDetailPageViewModel,
} from './detail-view-model'
import type {
  InstitutionDetailErrorViewModelV12,
  InstitutionDetailMapActionViewModel,
  InstitutionDetailPageViewModelV12,
} from './detail-view-model'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'
import {
  discardAppointmentInstitutionDisplaySnapshotV1,
  recordAppointmentInstitutionDisplaySnapshotV1,
} from '../../services/appointment-create-client'

type DetailPageState = 'loading' | InstitutionDetailErrorViewModelV12['pageState'] | 'ready'

interface InstitutionDetailPageData {
  pageState: DetailPageState
  viewModel: InstitutionDetailPageViewModelV12 | null
  errorViewModel: InstitutionDetailErrorViewModelV12 | null
  actionErrorKey: string
  actionErrorMessage: string
  isSwitchingRevision: boolean
  expandedSections: Record<string, boolean>
  coverLoadFailed: boolean
  canRequestService: boolean
  reading: ReturnType<typeof createDetailReading> | null
  sourceNotes: ReturnType<typeof readInstitutionSourceNotes>
}

const routeByPage = new WeakMap<object, InstitutionDetailRoute>()
const detailGenerations = new WeakMap<object, number>()

const nextGeneration = (instance: object): number => {
  const generation = (detailGenerations.get(instance) || 0) + 1
  detailGenerations.set(instance, generation)
  return generation
}

const isCurrentGeneration = (instance: object, generation: number): boolean =>
  detailGenerations.get(instance) === generation

const detailStateForError = (code: string): InstitutionDetailErrorViewModelV12['pageState'] => {
  if (code === 'INSTITUTION_ROUTE_ERROR') return 'route_error'
  if (code === 'INSTITUTION_NOT_FOUND') return 'not_found'
  if (code === 'INSTITUTION_REVISION_NOT_FOUND') return 'revision_not_found'
  if (code === 'INSTITUTION_SOURCE_CONTEXT_ERROR') return 'source_context_error'
  if (code === 'INSTITUTION_DETAIL_PROJECTION_ERROR'
    || code === 'INSTITUTION_RECORD_NOT_DISPLAYABLE') return 'projection_error'
  return 'catalog_error'
}

const runBack = (
  instance: object,
  onFailure: () => void,
): boolean => {
  const guard = getNavigationGuard(instance)
  if (!guard.acquire('institution.detail.back')) return false
  const pages = getCurrentPages()
  let succeeded = false
  let reported = false
  const fail = () => {
    guard.release('institution.detail.back')
    if (!reported) {
      reported = true
      onFailure()
    }
  }
  try {
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    } else {
      wx.redirectTo({
        url: '/pages/institution/index',
        success: () => { succeeded = true },
        fail,
        complete: () => { if (!succeeded) fail() },
      })
    }
  } catch (_error) {
    fail()
    return false
  }
  return true
}

const runMapAction = (
  instance: object,
  action: InstitutionDetailMapActionViewModel,
  onFailure: () => void,
): boolean => {
  if (!action.available) return false
  const guard = getNavigationGuard(instance)
  const actionKey = 'institution.detail.map'
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
    wx.openLocation({
      latitude: action.latitude,
      longitude: action.longitude,
      name: action.name,
      address: action.address,
      scale: action.scale,
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

const findPhone = (
  viewModel: InstitutionDetailPageViewModelV12,
  phoneKey: string,
): InstitutionDetailPageViewModelV12['officialContact']['phones'][number] | null => {
  for (let index = 0; index < viewModel.officialContact.phones.length; index += 1) {
    const phone = viewModel.officialContact.phones[index]
    if (phone.key === phoneKey) return phone
  }
  return null
}

const runPhoneAction = (
  instance: object,
  phone: InstitutionDetailPageViewModelV12['officialContact']['phones'][number],
  onFailure: () => void,
): boolean => {
  if (!phone.callAction.available) return false
  const guard = getNavigationGuard(instance)
  const actionKey = `institution.detail.phone.${phone.key}`
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
      phoneNumber: phone.callAction.dialValue,
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

Page({
  data: {
    pageState: 'loading',
    viewModel: null,
    errorViewModel: null,
    actionErrorKey: '',
    actionErrorMessage: '',
    isSwitchingRevision: false,
    expandedSections: {},
    coverLoadFailed: false,
    canRequestService: true,
    reading: null, sourceNotes: [],
  } as InstitutionDetailPageData,

  onLoad(query: Record<string, string | undefined>) {
    const parsed = parseInstitutionDetailRouteQuery(query)
    if (!parsed.ok) {
      this.setData({
        pageState: 'route_error',
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel('route_error'),
        actionErrorKey: '',
        actionErrorMessage: '',
      })
      return
    }
    routeByPage.set(this, parsed.value)
    this.buildRoute(parsed.value)
  },

  onShow() {
    // Detail has a single build entry in onLoad.  Showing the page again only
    // resets navigation protection; it does not rebuild the same snapshot.
    resetNavigationGuard(this)
  },

  buildRoute(route: InstitutionDetailRoute) {
    this.setData({ canRequestService: canRequestInstitutionService(route.identity.institutionId) })
    const generation = nextGeneration(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      errorViewModel: null,
      actionErrorKey: '',
      actionErrorMessage: '',
      isSwitchingRevision: false,
      expandedSections: {},
      coverLoadFailed: false,
      reading: null, sourceNotes: [],
    })
    buildInstitutionDetailPageSnapshot(route).then((result) => {
      if (!isCurrentGeneration(this, generation)) return
      if (result.ok) {
        const viewModel = createInstitutionDetailPageViewModel(result.value)
        this.setData({
          pageState: 'ready',
          viewModel,
          reading: createDetailReading(viewModel),
          sourceNotes: readInstitutionSourceNotes(result.value.identity.institutionId, result.value.identity.recordRevision),
          errorViewModel: null,
          actionErrorKey: '',
          actionErrorMessage: '',
          isSwitchingRevision: false,
        })
        return
      }
      const pageState = detailStateForError(result.error.code)
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        actionErrorKey: '',
        actionErrorMessage: '',
        isSwitchingRevision: false,
      })
    }).catch(() => {
      if (!isCurrentGeneration(this, generation)) return
      const pageState = 'catalog_error' as const
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        actionErrorKey: '',
        actionErrorMessage: '',
        isSwitchingRevision: false,
      })
    })
  },

  onRetry() {
    if (this.data.pageState === 'loading' || this.data.isSwitchingRevision) return
    const route = routeByPage.get(this)
    if (route === undefined) return
    this.buildRoute(route)
  },

  onSectionToggle(event: WechatMiniprogram.BaseEvent) {
    if (this.data.pageState !== 'ready' || !this.data.viewModel) return
    const key = event.currentTarget.dataset.sectionKey as string
    if (!this.data.viewModel.overview.sections.some((section) => section.key === key)) return
    this.setData({
      expandedSections: {
        ...this.data.expandedSections,
        [key]: !this.data.expandedSections[key],
      },
    })
  },

  onCoverLoadError() {
    if (this.data.pageState !== 'ready' || !this.data.viewModel || !this.data.viewModel.media.hasCover) return
    this.setData({ coverLoadFailed: true })
  },

  onViewCurrentRevision() {
    if (this.data.pageState !== 'ready'
      || this.data.viewModel === null
      || !this.data.viewModel.canViewCurrentRevision
      || this.data.isSwitchingRevision) return
    const route = routeByPage.get(this)
    if (route === undefined) return
    const guard = getNavigationGuard(this)
    if (!guard.acquire('institution.detail.currentRevision')) return
    const generation = nextGeneration(this)
    this.setData({
      pageState: 'loading',
      viewModel: null,
      errorViewModel: null,
      isSwitchingRevision: true,
      expandedSections: {},
      coverLoadFailed: false,
      actionErrorKey: '',
      actionErrorMessage: '',
    })
    buildInstitutionCurrentRevisionSnapshot(route.identity).then((result) => {
      guard.release('institution.detail.currentRevision')
      if (!isCurrentGeneration(this, generation)) return
      if (result.ok) {
        const viewModel = createInstitutionDetailPageViewModel(result.value)
        const currentRoute: InstitutionDetailRoute = {
          identity: result.value.identity,
          source: 'direct',
          sourceContextRef: null,
        }
        routeByPage.set(this, currentRoute)
        this.setData({
          pageState: 'ready',
          viewModel,
          reading: createDetailReading(viewModel),
          sourceNotes: readInstitutionSourceNotes(result.value.identity.institutionId, result.value.identity.recordRevision),
          errorViewModel: null,
          isSwitchingRevision: false,
          actionErrorKey: '',
          actionErrorMessage: '',
        })
        return
      }
      const pageState = detailStateForError(result.error.code)
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        isSwitchingRevision: false,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    }).catch(() => {
      guard.release('institution.detail.currentRevision')
      if (!isCurrentGeneration(this, generation)) return
      const pageState = 'catalog_error' as const
      this.setData({
        pageState,
        viewModel: null,
        errorViewModel: createInstitutionDetailErrorViewModel(pageState),
        isSwitchingRevision: false,
        actionErrorKey: '',
        actionErrorMessage: '',
      })
    })
  },

  onVrTap() {
    if (this.data.pageState !== 'ready' || this.data.viewModel === null) return
    if (!this.data.viewModel.media.canOpenVr) return
    const route = routeByPage.get(this)
    if (!route) return
    const detailUrl = serializeInstitutionDetailRoute(route.identity, route.source === 'recommendation' ? 'recommendation' : 'direct_link', route.sourceContextRef)
    if (!detailUrl) return
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    navigateToWithGuard(this, 'institution.detail.vr', detailUrl.replace('/detail?', '/vr?'), undefined, () => {
      this.setData({ actionErrorKey: 'vr', actionErrorMessage: '暂时无法打开全景，请重试。' })
    })
  },

  onMapTap() {
    if (this.data.pageState !== 'ready' || this.data.viewModel === null) return
    runMapAction(this, this.data.viewModel.location.mapAction, () => {
      this.setData({
        actionErrorKey: 'map',
        actionErrorMessage: '暂时无法打开地图，请稍后重试。',
      })
    })
  },

  onOfficialPhoneTap(event: WechatMiniprogram.BaseEvent) {
    if (this.data.pageState !== 'ready' || this.data.viewModel === null) return
    const phoneKey = event.currentTarget.dataset.phoneKey as string
    const phone = findPhone(this.data.viewModel, phoneKey)
    if (phone === null) return
    runPhoneAction(this, phone, () => {
      this.setData({
        actionErrorKey: 'phone',
        actionErrorMessage: '暂时无法拨打机构电话，请稍后重试。',
      })
    })
  },

  onAppointmentTap() {
    if (!this.data.canRequestService) {
      this.setData({ actionErrorKey: 'appointment', actionErrorMessage: '本机构目前仅提供公开资料查询，平台尚未开放预约。' })
      return
    }
    const route = routeByPage.get(this)
    const viewModel = this.data.viewModel
    if (this.data.pageState !== 'ready' || !route || !viewModel || this.data.isSwitchingRevision) return
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    const displayName = viewModel.title.trim()
    if (displayName.length === 0 || displayName === '机构详情' || displayName.length > 200) {
      this.setData({
        actionErrorKey: 'appointment',
        actionErrorMessage: '当前机构名称暂不可用，请返回列表重新选择。',
      })
      return
    }
    const identity = route.identity
    recordAppointmentInstitutionDisplaySnapshotV1(
      identity.institutionId,
      identity.recordRevision,
      displayName,
    )
    const url = `/pages/appointment/create?institutionId=${encodeURIComponent(identity.institutionId)}&recordRevision=${String(identity.recordRevision)}`
    const navigationStarted = navigateToWithGuard(this, 'institution.detail.appointment', url, undefined, () => {
      discardAppointmentInstitutionDisplaySnapshotV1(identity.institutionId, identity.recordRevision)
      this.setData({
        actionErrorKey: 'appointment',
        actionErrorMessage: '暂时无法打开预约申请，请稍后重试。',
      })
    })
    if (!navigationStarted) discardAppointmentInstitutionDisplaySnapshotV1(identity.institutionId, identity.recordRevision)
  },

  onAIChatTap() {
    if (this.data.pageState !== 'ready' || !this.data.viewModel || this.data.isSwitchingRevision) return
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    navigateToWithGuard(this, 'institution.detail.faq', '/pages/service/ai-chat/index', undefined, () => {
      this.setData({ actionErrorKey: 'faq', actionErrorMessage: '暂时无法打开常见问题，请稍后重试。' })
    })
  },

  // Push the shared public consultant page to keep this exact detail instance
  // (including its revision, recommendation context, expansion and scroll) alive.
  onConsultantTap() {
    if (this.data.pageState !== 'ready' || !this.data.viewModel || this.data.isSwitchingRevision) return
    this.setData({ actionErrorKey: '', actionErrorMessage: '' })
    navigateToWithGuard(this, 'institution.detail.consultant', '/pages/consultant/consultation', undefined, () => {
      this.setData({
        actionErrorKey: 'consultant',
        actionErrorMessage: '暂时无法打开养老顾问，请稍后重试。',
      })
    })
  },

  onBackToList() {
    runBack(this, () => {
      this.setData({
        actionErrorKey: 'back',
        actionErrorMessage: '暂时无法返回，请稍后重试。',
      })
    })
  },

  onNavigationFailure() {
    this.setData({
      actionErrorKey: 'back',
      actionErrorMessage: '暂时无法返回，请稍后重试。',
    })
  },
})
