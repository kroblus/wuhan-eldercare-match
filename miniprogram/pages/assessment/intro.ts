import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentStepId } from '../../types/assessment'
import { getAssessmentResumeRouteV2 } from '../../utils/assessment-resume'
import {
  acceptAssessmentPhaseIntent,
  beginAssessmentPageAction,
  endAssessmentPageAction,
  getAssessmentPhaseIntentView,
  getAssessmentPhaseStepLabel,
  getAssessmentStepFromRoute,
  isAssessmentPageActionActive,
  navigateAssessmentFromIntroWithCapacity,
  navigateAssessmentIntentFromIntro,
  onHideAssessmentPhasePage,
  onUnloadAssessmentPhasePage,
  resetAssessmentPageNavigation,
} from '../../utils/assessment-phase-navigation'

interface AssessmentIntroData {
  backEnabled: boolean
  hasDraft: boolean
  draftRecoveryRequired: boolean
  savedAtLabel: string
  restartError: string
  restartPending: boolean
  phaseIntentStep: string
  phaseIntentMessage: string
  phaseIntentActionLabel: string
  phaseIntentError: string
  overviewItems: Array<{ index: string; title: string; description: string }>
}

const hasDraftContent = (): boolean => {
  const draft = assessmentDraftStore.getDraft()
  return assessmentDraftStore.hasAnswers() || draft.currentStep !== 'basic'
}

const phaseIntentActionLabel = (step: string, source: string): string => {
  const label = getAssessmentPhaseStepLabel(step as AssessmentStepId)
  const verb = source === 'profile-edit'
    ? '继续修改'
    : source === 'profile-recovery'
      ? '继续补充'
      : '继续填写'
  return `${verb}：${label}`
}

const phaseIntentMessage = (step: string, source: string): string => {
  const label = getAssessmentPhaseStepLabel(step as AssessmentStepId)
  if (source === 'profile-edit') return `已确认本次修改目标：${label}。点击下方按钮后才会进入。`
  if (source === 'profile-recovery') return `已确认本次补充目标：${label}。点击下方按钮后才会进入。`
  return `已确认本次评估目标：${label}。点击下方按钮后才会进入。`
}

Page({
  data: {
    backEnabled: true,
    hasDraft: false,
    draftRecoveryRequired: false,
    savedAtLabel: '',
    restartError: '',
    restartPending: false,
    phaseIntentStep: '',
    phaseIntentMessage: '',
    phaseIntentActionLabel: '',
    phaseIntentError: '',
    overviewItems: [
      { index: '01', title: '基本情况', description: '年龄、居住状态、主要照护者等。' },
      { index: '02', title: '健康情况', description: '慢性病、康复需求和近期健康风险。' },
      { index: '03', title: '生活自理', description: '进食、行走、洗澡、如厕等。' },
      { index: '04', title: '认知与护理', description: '认知状态和已明确的特殊护理需求。' },
      { index: '05', title: '养老偏好', description: '机构类型、居住环境和服务偏好等。' },
      { index: '06', title: '预算与计划', description: '预算范围、入住时间和其他考虑。' },
    ],
  } as AssessmentIntroData,

  onLoad(options: Record<string, unknown>) {
    const acceptance = acceptAssessmentPhaseIntent(this, options)
    if (acceptance.intent) {
      const step = acceptance.intent.step
      const source = acceptance.intent.source
      this.setData({
        phaseIntentStep: step,
        phaseIntentMessage: phaseIntentMessage(step, source),
        phaseIntentActionLabel: phaseIntentActionLabel(step, source),
        phaseIntentError: '',
      })
    } else if (acceptance.invalid) {
      this.setData({
        phaseIntentStep: '',
        phaseIntentMessage: '',
        phaseIntentActionLabel: '',
        phaseIntentError: '本次进入请求无效或已过期。您仍可从下方正常开始或继续评估。',
      })
    }
  },

  onShow() {
    resetAssessmentPageNavigation(this)
    const intent = getAssessmentPhaseIntentView(this)
    if (intent) {
      this.setData({
        phaseIntentStep: intent.step,
        phaseIntentMessage: phaseIntentMessage(intent.step, intent.source),
        phaseIntentActionLabel: phaseIntentActionLabel(intent.step, intent.source),
      })
    } else if (this.data.phaseIntentStep) {
      this.setData({
        phaseIntentStep: '',
        phaseIntentMessage: '',
        phaseIntentActionLabel: '',
        phaseIntentError: '本次进入请求已结束。请从下方重新选择评估操作。',
      })
    }
    this.setData({
      restartPending: false,
    })
    this.refreshDraftState()
  },

  onHide() {
    onHideAssessmentPhasePage(this)
    this.setData({ restartPending: false })
  },

  onUnload() {
    onUnloadAssessmentPhasePage(this)
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
    if (this.data.restartPending) return
    if (this.data.phaseIntentStep) {
      this.setData({ phaseIntentError: '' })
      navigateAssessmentIntentFromIntro(this, 'intro.phaseIntent', {
        onConsumed: () => {
          this.setData({
            phaseIntentStep: '',
            phaseIntentMessage: '',
            phaseIntentActionLabel: '',
            phaseIntentError: '',
          })
        },
        onFailure: () => {
          this.setData({ phaseIntentError: '暂时无法进入目标步骤，请重试。' })
        },
        onChanged: (intent, message) => {
          this.setData({
            phaseIntentStep: intent.step,
            phaseIntentMessage: message,
            phaseIntentActionLabel: phaseIntentActionLabel(intent.step, intent.source),
            phaseIntentError: '',
          })
        },
        onInvalid: (message) => {
          this.setData({
            phaseIntentStep: '',
            phaseIntentMessage: '',
            phaseIntentActionLabel: '',
            phaseIntentError: message,
          })
        },
      })
      return
    }
    const targetRoute = getAssessmentResumeRouteV2(assessmentDraftStore.getDraft())
    const targetStep = getAssessmentStepFromRoute(targetRoute) || 'basic'
    navigateAssessmentFromIntroWithCapacity(this, targetStep, 'intro.startAssessment', () => {
      wx.showToast({ title: '暂时无法进入评估，请重试。', icon: 'none' })
    })
  },

  restartAssessment() {
    const action = 'intro.restartAssessment'
    if (this.data.restartPending || !beginAssessmentPageAction(this, action)) {
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
          if (!isAssessmentPageActionActive(this, action)) return
          if (!result.confirm) {
            endAssessmentPageAction(this, action)
            this.setData({ restartPending: false })
            return
          }

          const clearResult = assessmentDraftStore.clear()
          if (!clearResult.persistence.ok) {
            endAssessmentPageAction(this, action)
            this.setData({
              restartPending: false,
              restartError: '本机草稿清理失败，未开始新的评估，请重试。',
            })
            return
          }

          this.refreshDraftState()
          this.setData({ restartPending: false })
          endAssessmentPageAction(this, action)
          navigateAssessmentFromIntroWithCapacity(this, 'basic', action, () => {
            wx.showToast({ title: '暂时无法开始评估，请重试。', icon: 'none' })
          })
        },
        fail: () => {
          if (!isAssessmentPageActionActive(this, action)) return
          endAssessmentPageAction(this, action)
          this.setData({
            restartPending: false,
            restartError: '无法打开重新开始提示，请重试。',
          })
        },
      })
    } catch (_error) {
      endAssessmentPageAction(this, action)
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
