import { readBrowseFontStyle } from '../../utils/browse-font'
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
import { decorateDirectoryCards } from '../institution/directory-presentation'
import { callDirectoryPhone, invalidateDirectoryCall } from '../institution/directory-call'
import { reviewedOn } from '../../content/family-reading'

interface HomePageData {
  browseFontStyle: string
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
  expanded: boolean
  activeQuery: boolean
  resultCount: number
  searchFocus: boolean
  searchActionError: string
  reviewedOn: string
}

const loadGenerations = new WeakMap<object, number>()
const homeLoadsInFlight = new WeakSet<object>()
const homeReloadRequested = new WeakSet<object>()
const homeDirectories = new WeakMap<object, readonly InstitutionListItemViewModel[]>()
const homeLifetimes = new WeakMap<object, number>()

const currentLifetime = (instance: object): number => homeLifetimes.get(instance) || 0

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
    browseFontStyle: '',
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
    expanded: false, activeQuery: false, resultCount: 0, searchFocus: false, searchActionError: '', reviewedOn,
  } as HomePageData,

  lifetimes: {
    attached() {
      invalidateDirectoryCall(this, true)
      this.syncBrowseFont()
      this.loadInstitutions()
    },
    detached() {
      invalidateDirectoryCall(this, false)
      nextGeneration(this)
      homeLifetimes.set(this, currentLifetime(this) + 1)
      homeLoadsInFlight.delete(this)
      homeDirectories.delete(this)
      homeReloadRequested.delete(this)
      resetNavigationGuard(this)
    },
  },

  pageLifetimes: {
    show() {
      invalidateDirectoryCall(this, true)
      this.syncBrowseFont()
      resetNavigationGuard(this)
      this.loadInstitutions()
    },
    hide() { invalidateDirectoryCall(this, false) },
  },

  methods: {
    syncBrowseFont() {
      const browseFontStyle = readBrowseFontStyle()
      if (browseFontStyle !== this.data.browseFontStyle) this.setData({ browseFontStyle })
    },
    filterDirectory() {
      invalidateDirectoryCall(this)
      const matches = filterInstitutionDirectory(homeDirectories.get(this) || [], this.data.keyword, this.data.natureIndex, this.data.districtIndex)
      const activeQuery = this.data.keyword.trim().length > 0 || this.data.natureIndex !== 0 || this.data.districtIndex !== 0
      this.setData({ institutions: activeQuery || this.data.expanded ? matches : matches.slice(0, 2), activeQuery, resultCount: matches.length, institutionActionError: '', actionErrorKey: '' })
    },
    toggleDirectory() { this.setData({ expanded: !this.data.expanded }); this.filterDirectory() },
    onSearchBlur() { this.setData({ searchFocus: false }) },
    focusSearch() {
      const guard = getNavigationGuard(this), action = 'home.focusSearch'
      if (!guard.acquire(action)) return
      const lifetime = currentLifetime(this)
      const isCurrent = () => currentLifetime(this) === lifetime
      this.setData({ searchActionError: '', searchFocus: false })
      const fail = () => {
        if (!isCurrent()) return
        guard.release(action)
        this.setData({ searchActionError: '暂时无法定位，请向下滑动到搜索区域后重试。' })
      }
      try {
        let offsetTop = -96
        try {
          const capsule = wx.getMenuButtonBoundingClientRect()
          if (capsule && Number.isFinite(capsule.bottom) && capsule.bottom > 0) offsetTop = -capsule.bottom - 8
        } catch (_error) { /* Keep the fixed-navigation fallback when geometry is unavailable. */ }
        // The bundled legacy typings omit offsetTop; verified against the native runtime.
        const scrollOptions: WechatMiniprogram.PageScrollToOption & { offsetTop: number } = {
          selector: '#home-search', offsetTop, duration: 200,
          success: () => { if (isCurrent()) this.setData({ searchFocus: true }) }, fail,
          complete: () => { if (isCurrent()) guard.release(action) } }
        wx.pageScrollTo(scrollOptions)
      } catch (_error) { fail() }
    },
    openAnnouncements() {
      const guard = getNavigationGuard(this), action = 'home.announcements'
      if (!guard.acquire(action)) return
      const lifetime = currentLifetime(this)
      const isCurrent = () => currentLifetime(this) === lifetime
      this.setData({ searchActionError: '' })
      const fail = () => {
        if (!isCurrent()) return
        guard.release(action)
        this.setData({ searchActionError: '暂时无法打开公告，请重试。' })
      }
      try {
        wx.showModal({ title: '平台公告', content: '当前暂无可展示的公告。', showCancel: false, confirmText: '关闭',
          fail, complete: () => { if (isCurrent()) guard.release(action) } })
      } catch (_error) { fail() }
    },
    onSearchInput(event: WechatMiniprogram.Input) {
      this.setData({ keyword: event.detail.value, expanded: false }); this.filterDirectory()
    },
    onNatureChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value)
      if (!Number.isInteger(index) || !directoryNatureOptions[index]) return
      this.setData({ natureIndex: index, expanded: false }); this.filterDirectory()
    },
    onDistrictChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value)
      if (!Number.isInteger(index) || !directoryDistrictOptions[index]) return
      this.setData({ districtIndex: index, expanded: false }); this.filterDirectory()
    },
    clearSearch() {
      this.setData({ keyword: '', natureIndex: 0, districtIndex: 0, expanded: false }); this.filterDirectory()
    },
    clearKeyword() { this.setData({ keyword: '' }); this.filterDirectory() },
    onCardTap(event: WechatMiniprogram.BaseEvent) { this.openInstitution(event) },
    onDirectoryPhoneTap(event: WechatMiniprogram.BaseEvent) {
      const key = event.currentTarget.dataset.itemKey as string
      void callDirectoryPhone(this, key, () => this.data.isLoading || this.data.loadError ? [] : this.data.institutions,
        message => this.setData({ actionErrorKey: message ? key : '', institutionActionError: message }))
    },
    openReading(event: WechatMiniprogram.BaseEvent) {
      const topic = event.currentTarget.dataset.topic
      if (typeof topic !== 'string' || ['policy', 'education', 'admission'].indexOf(topic) < 0) return
      this.setData({ readingActionError: '' })
      navigateToWithGuard(this, 'home.openReading', '/pages/service/' + topic + '/index', undefined, () => {
        this.setData({ readingActionError: '暂时无法打开内容，请重试。' })
      })
    },
    loadInstitutions() {
      invalidateDirectoryCall(this)
      if (homeLoadsInFlight.has(this)) { homeReloadRequested.add(this); return }
      homeLoadsInFlight.add(this)
      const generation = nextGeneration(this)
      this.setData({
        // Retain result height/input nodes while returning from Detail. Demo
        // resets still refresh the cache, without flashing an empty directory.
        isLoading: !homeDirectories.has(this),
        loadError: false,
        empty: homeDirectories.has(this) ? this.data.empty : false,
        institutionActionError: '',
        institutionListActionError: '',
      })
      buildInstitutionListPageSnapshot(null).then(async (result) => {
        if (!isCurrentGeneration(this, generation)) return
        if (!result.ok) {
          homeLoadsInFlight.delete(this)
          if (homeReloadRequested.has(this)) { homeReloadRequested.delete(this); this.loadInstitutions(); return }
          homeDirectories.delete(this)
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
        const items = await decorateDirectoryCards(viewModel.items, result.value.evaluationAsOf)
        if (!isCurrentGeneration(this, generation)) return
        homeLoadsInFlight.delete(this)
        if (homeReloadRequested.has(this)) { homeReloadRequested.delete(this); this.loadInstitutions(); return }
        homeDirectories.set(this, items)
        this.setData({
          isLoading: false,
          loadError: false,
          empty: viewModel.pageState === 'empty',
          // Preview follows the existing directory order; it is not a recommendation.
          mockDisclosure: viewModel.disclosure,
          showMockDisclosure: viewModel.hasDisclosure,
        })
        this.filterDirectory()
      }).catch(() => {
        if (!isCurrentGeneration(this, generation)) return
        homeLoadsInFlight.delete(this)
        if (homeReloadRequested.has(this)) { homeReloadRequested.delete(this); this.loadInstitutions(); return }
        homeDirectories.delete(this)
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
