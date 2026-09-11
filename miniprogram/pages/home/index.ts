import { buildInstitutionListPageSnapshot } from '../../services/institution-list-detail-page'
import type { InstitutionListItemViewModel } from '../institution/list-view-model'
import { createInstitutionListPageViewModel } from '../institution/list-view-model'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'

interface HomePageData {
  institutions: readonly InstitutionListItemViewModel[]
  isLoading: boolean
  loadError: boolean
  empty: boolean
  mockDisclosure: string
  showMockDisclosure: boolean
  institutionActionError: string
  consultantActionError: string
}

const loadGenerations = new WeakMap<object, number>()
const homeLoadsInFlight = new WeakSet<object>()
const blockedInstitutionActions = new WeakSet<object>()

const nextGeneration = (instance: object): number => {
  const generation = (loadGenerations.get(instance) || 0) + 1
  loadGenerations.set(instance, generation)
  return generation
}

const isCurrentGeneration = (instance: object, generation: number): boolean =>
  loadGenerations.get(instance) === generation

const switchToConsultantWithGuard = (
  instance: object,
  onFailure: () => void,
): boolean => {
  const guard = getNavigationGuard(instance)
  const action = 'home.openConsultant'
  if (!guard.acquire(action)) return false
  let succeeded = false
  let reported = false
  const fail = () => {
    guard.release(action)
    if (!reported) {
      reported = true
      onFailure()
    }
  }
  try {
    wx.switchTab({
      url: '/pages/consultant/index',
      success: () => { succeeded = true },
      fail,
      complete: () => { if (!succeeded) fail() },
    })
  } catch (_error) {
    fail()
    return false
  }
  return true
}

Component({
  data: {
    institutions: [],
    isLoading: true,
    loadError: false,
    empty: false,
    mockDisclosure: '',
    showMockDisclosure: false,
    institutionActionError: '',
    consultantActionError: '',
  } as HomePageData,

  lifetimes: {
    attached() {
      this.loadInstitutions()
    },
  },

  pageLifetimes: {
    show() {
      resetNavigationGuard(this)
    },
  },

  methods: {
    loadInstitutions() {
      if (homeLoadsInFlight.has(this)) return
      homeLoadsInFlight.add(this)
      blockedInstitutionActions.delete(this)
      const generation = nextGeneration(this)
      this.setData({
        isLoading: true,
        loadError: false,
        empty: false,
        institutionActionError: '',
      })
      buildInstitutionListPageSnapshot(null).then((result) => {
        homeLoadsInFlight.delete(this)
        if (!isCurrentGeneration(this, generation)) return
        if (!result.ok) {
          this.setData({
            isLoading: false,
            loadError: true,
            empty: false,
            institutions: [],
            mockDisclosure: '',
            showMockDisclosure: false,
          })
          return
        }
        const viewModel = createInstitutionListPageViewModel(result.value)
        this.setData({
          isLoading: false,
          loadError: false,
          empty: viewModel.pageState === 'empty',
          institutions: viewModel.items,
          mockDisclosure: viewModel.disclosure,
          showMockDisclosure: viewModel.hasDisclosure,
        })
      }).catch(() => {
        homeLoadsInFlight.delete(this)
        if (!isCurrentGeneration(this, generation)) return
        this.setData({
          isLoading: false,
          loadError: true,
          empty: false,
          institutions: [],
          mockDisclosure: '',
          showMockDisclosure: false,
        })
      })
    },

    startAssessment() {
      navigateToWithGuard(this, 'home.startAssessment', '/pages/assessment/intro')
    },

    openInstitutions() {
      navigateToWithGuard(this, 'home.openInstitutions', '/pages/institution/index')
    },

    openConsultant() {
      this.setData({ consultantActionError: '' })
      switchToConsultantWithGuard(this, () => {
        this.setData({ consultantActionError: '暂时无法打开养老顾问，请稍后重试。' })
      })
    },

    openInstitution(event: WechatMiniprogram.BaseEvent) {
      const itemKey = event.currentTarget.dataset.itemKey as string
      if (!itemKey) return
      if (blockedInstitutionActions.has(this)) return
      blockedInstitutionActions.add(this)
      // The canonical identity is already carried by the List ViewModel.  The
      // A0-3 navigation gate remains closed, so this tap never navigates.
      this.setData(
        { institutionActionError: '机构详情入口正在开发验证中，当前不会打开详情页面。' },
        () => { blockedInstitutionActions.delete(this) },
      )
    },

    retryLoad() {
      this.loadInstitutions()
    },
  },
})
