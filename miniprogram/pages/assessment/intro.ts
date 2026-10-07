import { assessmentDraftStore } from '../../store/assessment-draft'
import { getAssessmentResumeRouteV2 } from '../../utils/assessment-resume'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

interface AssessmentIntroData {
  backEnabled: boolean
  hasDraft: boolean
  draftRecoveryRequired: boolean
  savedAtLabel: string
  restartError: string
  restartPending: boolean
  overviewItems: Array<{ index: string; title: string; description: string }>
}

const hasDraftContent = (): boolean => {
  const draft = assessmentDraftStore.getDraft()
  return assessmentDraftStore.hasAnswers() || draft.currentStep !== 'basic'
}

const navigateFromIntro = (page: object, action: string, url: string): boolean => {
  const replaceRootIntro = getCurrentPages().length <= 1
  const navigateTo = replaceRootIntro
    ? (options: WechatMiniprogram.NavigateToOption) => wx.redirectTo(options as WechatMiniprogram.RedirectToOption)
    : undefined
  return navigateToWithGuard(page, action, url, navigateTo, () => {
    wx.showToast({ title: '暂时无法进入评估，请重试。', icon: 'none' })
  })
}

Page({
  data: {
    backEnabled: true,
    hasDraft: false,
    draftRecoveryRequired: false,
    savedAtLabel: '',
    restartError: '',
    restartPending: false,
    overviewItems: [
      { index: '01', title: '基本情况', description: '年龄、居住状态、主要照护者等。' },
      { index: '02', title: '健康情况', description: '慢性病、康复需求和近期健康风险。' },
      { index: '03', title: '生活自理', description: '进食、行走、洗澡、如厕等。' },
      { index: '04', title: '认知与护理', description: '认知状态和已明确的特殊护理需求。' },
      { index: '05', title: '养老偏好', description: '机构类型、居住环境和服务偏好等。' },
      { index: '06', title: '预算与计划', description: '预算范围、入住时间和其他考虑。' },
    ],
  } as AssessmentIntroData,

  onShow() {
    resetNavigationGuard(this)
    this.setData({
      restartPending: false,
    })
    this.refreshDraftState()
  },

  refreshDraftState() {
    const hasDraft = hasDraftContent()
    const persistence = assessmentDraftStore.getLastPersistenceResult()
    const draftRecoveryRequired = assessmentDraftStore.requiresLegacyRecovery()
    this.setData({
      hasDraft,
      draftRecoveryRequired,
      savedAtLabel: hasDraft
        ? draftRecoveryRequired
          ? '检测到旧版草稿，但无法安全迁移；原数据仍保留，请重新开始后再填写'
          : persistence.ok
          ? '草稿已保存在本机，仅用于本次开发体验'
          : '本机保存失败，当前答案只在本次打开期间保留，请重试'
        : '',
      restartError: '',
    })
  },

  startAssessment() {
    if (assessmentDraftStore.requiresLegacyRecovery()) {
      this.setData({ restartError: '旧版草稿无法安全迁移；原数据仍保留，请选择重新开始。' })
      return
    }
    const targetRoute = getAssessmentResumeRouteV2(assessmentDraftStore.getDraft())
    navigateFromIntro(this, 'intro.startAssessment', targetRoute)
  },

  restartAssessment() {
    if (this.data.restartPending) {
      return
    }

    this.setData({ restartPending: true, restartError: '' })

    try {
      wx.showModal({
        title: '重新开始评估？',
        content: '本机会清除当前未完成的草稿，但不会影响任何历史评估。',
        confirmText: '清除重来',
        cancelText: '先保留',
        success: (result) => {
          if (!result.confirm) {
            return
          }

          const clearResult = assessmentDraftStore.clear()
          if (!clearResult.persistence.ok) {
            this.setData({
              restartPending: false,
              restartError: '本机草稿清理失败，未开始新的评估，请重试。',
            })
            return
          }

          this.refreshDraftState()
          navigateFromIntro(this, 'intro.restartAssessment', '/pages/assessment/basic')
        },
        fail: () => {
          this.setData({
            restartPending: false,
            restartError: '无法打开重新开始提示，请重试。',
          })
        },
        complete: () => {
          this.setData({ restartPending: false })
        },
      })
    } catch (_error) {
      this.setData({
        restartPending: false,
        restartError: '无法打开重新开始提示，请重试。',
      })
    }
  },

  onNavigationFailure() {
    wx.showToast({ title: '暂时无法返回，请稍后重试。', icon: 'none' })
  },
})
