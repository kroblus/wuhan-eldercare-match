import { institutionService } from '../../services/institution.service'
import type { Institution } from '../../types/domain'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

Component({
  data: {
    institutions: [] as Institution[],
    isLoading: true,
    loadError: false,
  },
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
      this.setData({ isLoading: true, loadError: false })
      institutionService
        .listInstitutions()
        .then((institutions) => {
          this.setData({ institutions, isLoading: false })
        })
        .catch(() => {
          this.setData({ isLoading: false, loadError: true })
        })
    },
    startAssessment() {
      navigateToWithGuard(this, 'home.startAssessment', '/pages/assessment/intro')
    },
    openInstitutions() {
      navigateToWithGuard(this, 'home.openInstitutions', '/pages/institution/index')
    },
    openConsultant() {
      wx.switchTab({ url: '/pages/consultant/index' })
    },
    openInstitution(event: WechatMiniprogram.TouchEvent) {
      const institutionId = event.currentTarget.dataset.institutionId as string
      if (institutionId) {
        navigateToWithGuard(this, 'home.openInstitution', `/pages/institution/detail?id=${institutionId}`)
      }
    },
    retryLoad() {
      this.loadInstitutions()
    },
  },
})
