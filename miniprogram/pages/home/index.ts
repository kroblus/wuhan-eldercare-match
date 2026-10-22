import { buildInstitutionListPageSnapshot } from '../../services/institution-list-detail-page'
import type { InstitutionListItemViewModel } from '../institution/list-view-model'
import { createInstitutionListPageViewModel } from '../institution/list-view-model'
import {
  getNavigationGuard,
  navigateToWithGuard,
  resetNavigationGuard,
} from '../../utils/navigation-guard'
import { serializeInstitutionDetailRoute } from '../../services/institution-detail-route'
import { filterInstitutionDirectory } from '../../services/institution-directory-search'
import { directoryNatureOptions, directoryDistrictOptions } from '../../runtime/directory-metadata'

interface HomePageData {
  institutions: readonly InstitutionListItemViewModel[]
  isLoading: boolean
  loadError: boolean
  empty: boolean
  mockDisclosure: string
  showMockDisclosure: boolean
  institutionActionError: string
  institutionListActionError: string
  consultantActionError: string
  aiActionError: string
  readingActionError: string
  keyword: string
  natureIndex: number
  districtIndex: number
  natureOptions: typeof directoryNatureOptions
  districtOptions: typeof directoryDistrictOptions
  hasMetadataFilters: boolean
  actionErrorKey: string
}

const loadGenerations = new WeakMap<object, number>()
const homeLoadsInFlight = new WeakSet<object>()
const homeReloadRequested = new WeakSet<object>()
const homeDirectories = new WeakMap<object, readonly InstitutionListItemViewModel[]>()

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
    institutionListActionError: '',
    consultantActionError: '',
    aiActionError: '',
    readingActionError: '',
    keyword: '', natureIndex: 0, districtIndex: 0,
    natureOptions: directoryNatureOptions, districtOptions: directoryDistrictOptions,
    hasMetadataFilters: true, actionErrorKey: '',
  } as HomePageData,

  lifetimes: {
    attached() {
      this.loadInstitutions()
    },
    detached() {
      nextGeneration(this)
      homeDirectories.delete(this)
      homeReloadRequested.delete(this)
    },
  },

  pageLifetimes: {
    show() {
      resetNavigationGuard(this)
      this.loadInstitutions()
    },
  },

  methods: {
    filterDirectory() {
      this.setData({ institutions: filterInstitutionDirectory(homeDirectories.get(this) || [], this.data.keyword, this.data.natureIndex, this.data.districtIndex), institutionActionError: '', actionErrorKey: '' })
    },
    onSearchInput(event: WechatMiniprogram.Input) {
      this.setData({ keyword: event.detail.value }); this.filterDirectory()
    },
    onNatureChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value)
      if (!Number.isInteger(index) || !directoryNatureOptions[index]) return
      this.setData({ natureIndex: index }); this.filterDirectory()
    },
    onDistrictChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value)
      if (!Number.isInteger(index) || !directoryDistrictOptions[index]) return
      this.setData({ districtIndex: index }); this.filterDirectory()
    },
    clearSearch() {
      this.setData({ keyword: '', natureIndex: 0, districtIndex: 0 }); this.filterDirectory()
    },
    clearKeyword() { this.setData({ keyword: '' }); this.filterDirectory() },
    onCardTap(event: WechatMiniprogram.BaseEvent) { this.openInstitution(event) },
    openReading(event: WechatMiniprogram.BaseEvent) {
      const topic = event.currentTarget.dataset.topic
      if (typeof topic !== 'string' || ['policy', 'education', 'admission'].indexOf(topic) < 0) return
      this.setData({ readingActionError: '' })
      navigateToWithGuard(this, 'home.openReading', '/pages/service/' + topic + '/index', undefined, () => {
        this.setData({ readingActionError: '暂时无法打开内容，请重试。' })
      })
    },
    loadInstitutions() {
      if (homeLoadsInFlight.has(this)) { homeReloadRequested.add(this); return }
      homeLoadsInFlight.add(this)
      const generation = nextGeneration(this)
      this.setData({
        isLoading: true,
        loadError: false,
        empty: false,
        institutionActionError: '',
        institutionListActionError: '',
      })
      buildInstitutionListPageSnapshot(null).then((result) => {
        homeLoadsInFlight.delete(this)
        if (!isCurrentGeneration(this, generation)) return
        if (homeReloadRequested.has(this)) { homeReloadRequested.delete(this); this.loadInstitutions(); return }
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
        homeDirectories.set(this, viewModel.items)
        this.setData({
          isLoading: false,
          loadError: false,
          empty: viewModel.pageState === 'empty',
          // Preview follows the existing directory order; it is not a recommendation.
          institutions: viewModel.items,
          mockDisclosure: viewModel.disclosure,
          showMockDisclosure: viewModel.hasDisclosure,
        })
        this.filterDirectory()
      }).catch(() => {
        homeLoadsInFlight.delete(this)
        if (!isCurrentGeneration(this, generation)) return
        if (homeReloadRequested.has(this)) { homeReloadRequested.delete(this); this.loadInstitutions(); return }
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
      navigateToWithGuard(
        this,
        'home.startAssessment',
        '/pages/assessment/intro',
        undefined,
        () => wx.showToast({ title: '无法开始评估', icon: 'none' }),
      )
    },

    openInstitutions() {
      this.setData({ institutionListActionError: '' })
      const guard = getNavigationGuard(this)
      if (!guard.acquire('home.openInstitutions')) return
      let succeeded = false
      let reported = false
      const fail = () => {
        guard.release('home.openInstitutions')
        if (reported) return
        reported = true
        this.setData({ institutionListActionError: '暂时无法打开机构列表，请稍后重试。' })
      }
      try {
        wx.navigateTo({
          url: '/pages/institution/index',
          success: () => { succeeded = true },
          fail,
          complete: () => { if (!succeeded) fail() },
        })
      } catch (_error) {
        fail()
      }
    },

    openConsultant() {
      this.setData({ consultantActionError: '' })
      switchToConsultantWithGuard(this, () => {
        this.setData({ consultantActionError: '暂时无法打开养老顾问，请稍后重试。' })
      })
    },

    openAIConsultation() {
      this.setData({ aiActionError: '' })
      navigateToWithGuard(this, 'home.openAIConsultation', '/pages/service/ai-chat/index', undefined, () => {
        this.setData({ aiActionError: '暂时无法打开养老咨询助手，请稍后重试。' })
      })
    },

    openInstitution(event: WechatMiniprogram.BaseEvent) {
      const itemKey = event.currentTarget.dataset.itemKey as string
      if (!itemKey) return
      const item = this.data.institutions.find((candidate) => candidate.key === itemKey)
      if (item === undefined) return
      this.setData({ institutionActionError: '', actionErrorKey: itemKey })
      const guard = getNavigationGuard(this)
      if (!guard.acquire('home.openInstitution')) return
      const url = serializeInstitutionDetailRoute(
        {
          institutionId: item.navigationIntent.institutionId,
          recordRevision: item.navigationIntent.recordRevision,
        },
        'direct_link',
      )
      if (url === null) {
        guard.release('home.openInstitution')
        this.setData({ institutionActionError: '机构资料链接暂时无法生成，请稍后重试。' })
        return
      }
      let succeeded = false
      let reported = false
      const fail = () => {
        guard.release('home.openInstitution')
        if (reported) return
        reported = true
        this.setData({ institutionActionError: '暂时无法打开机构详情，请稍后重试。' })
      }
      try {
        wx.navigateTo({
          url,
          success: () => { succeeded = true },
          fail,
          complete: () => { if (!succeeded) fail() },
        })
      } catch (_error) {
        fail()
      }
    },

    retryLoad() {
      this.loadInstitutions()
    },
  },
})
