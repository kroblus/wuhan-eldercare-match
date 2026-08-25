import { institutionService } from '../../services/institution.service'
import type { Institution } from '../../types/domain'

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
      wx.navigateTo({ url: '/pages/assessment/intro' })
    },
    openInstitutions() {
      wx.navigateTo({ url: '/pages/institution/index' })
    },
    openConsultant() {
      wx.switchTab({ url: '/pages/consultant/index' })
    },
    openInstitution(event: WechatMiniprogram.TouchEvent) {
      const institutionId = event.currentTarget.dataset.institutionId as string
      if (institutionId) {
        wx.navigateTo({ url: `/pages/institution/detail?id=${institutionId}` })
      }
    },
    retryLoad() {
      this.loadInstitutions()
    },
  },
})
