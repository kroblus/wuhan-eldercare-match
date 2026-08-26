import { assessmentDraftStore } from '../../store/assessment-draft'

interface AssessmentIntroData {
  backEnabled: boolean
  hasDraft: boolean
  savedAtLabel: string
  restartError: string
  overviewItems: Array<{ index: string; title: string; description: string }>
}

const hasDraftContent = (): boolean => {
  const draft = assessmentDraftStore.getDraft()
  return assessmentDraftStore.hasAnswers() || draft.currentStep !== 'basic'
}

Page({
  data: {
    backEnabled: true,
    hasDraft: false,
    savedAtLabel: '',
    restartError: '',
    overviewItems: [
      { index: '01', title: '基本情况', description: '先了解老人年龄、关系和目前生活状态。' },
      { index: '02', title: '身体与生活能力', description: '从健康和日常场景了解照护需要。' },
      { index: '03', title: '认知与照护需求', description: '识别认知、夜间和特殊护理线索。' },
      { index: '04', title: '养老偏好', description: '了解家庭更在意的服务与区域。' },
      { index: '05', title: '预算与入住计划', description: '帮助后续解释推荐范围和差异。' },
    ],
  } as AssessmentIntroData,

  onShow() {
    this.refreshDraftState()
  },

  refreshDraftState() {
    const hasDraft = hasDraftContent()
    const persistence = assessmentDraftStore.getLastPersistenceResult()
    this.setData({
      hasDraft,
      savedAtLabel: hasDraft
        ? persistence.ok
          ? '草稿已保存在本机，仅用于本次开发体验'
          : '本机保存失败，当前答案只在本次打开期间保留，请重试'
        : '',
      restartError: '',
    })
  },

  startAssessment() {
    wx.navigateTo({ url: '/pages/assessment/basic' })
  },

  restartAssessment() {
    wx.showModal({
      title: '重新开始评估？',
      content: '本机会清除当前未完成的草稿，但不会影响任何历史评估。',
      confirmText: '清除并开始',
      cancelText: '先保留',
      success: (result) => {
        if (result.confirm) {
          const clearResult = assessmentDraftStore.clear()
          if (!clearResult.persistence.ok) {
            this.setData({ restartError: '本机草稿清理失败，未开始新的评估，请重试。' })
            return
          }
          this.refreshDraftState()
          wx.navigateTo({ url: '/pages/assessment/basic' })
        }
      },
    })
  },
})
