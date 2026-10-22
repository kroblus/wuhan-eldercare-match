import type {
  HealthCondition,
  HealthRecentEvent,
  RehabilitationNeed,
} from '../../types/assessment'
import {
  validateHealthAnswersV2,
} from '../../types/assessment-v2'
import type {
  ChewingAbility,
  SwallowingAbility,
} from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { getAssessmentBackText, navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { invalidateAssessmentPageAction, navigateAssessmentForwardWithCapacity, onHideAssessmentPhasePage, onUnloadAssessmentPhasePage, resetAssessmentPageNavigation } from '../../utils/assessment-phase-navigation'

type ChoiceOption = { value: string; label: string }

interface AssessmentHealthData {
  backEnabled: boolean
  backText: string
  warmSwissHeaderHeight: number
  conditions: HealthCondition[]
  recentEvents: HealthRecentEvent[]
  rehabilitationNeed: RehabilitationNeed | ''
  chewingAbility: ChewingAbility | ''
  swallowingAbility: SwallowingAbility | ''
  conditionsOptions: ChoiceOption[]
  recentEventOptions: ChoiceOption[]
  rehabilitationOptions: ChoiceOption[]
  chewingOptions: ChoiceOption[]
  swallowingOptions: ChoiceOption[]
  conditionsError: string
  recentEventsError: string
  rehabilitationNeedError: string
  chewingAbilityError: string
  swallowingAbilityError: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
  conditionsAnchorId: string
  recentEventsAnchorId: string
  rehabilitationNeedAnchorId: string
  chewingAbilityAnchorId: string
  swallowingAbilityAnchorId: string
}

type AssessmentHealthPageMetadata = {
  _warmSwissHeaderPatch?: Pick<AssessmentHealthData, 'warmSwissHeaderHeight'>
}

const conditionsOptions: ChoiceOption[] = [
  { value: 'hypertension', label: '高血压' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'coronary_heart_disease', label: '冠心病' },
  { value: 'stroke_sequelae', label: '脑卒中后遗症' },
  { value: 'parkinson_disease', label: '帕金森' },
  { value: 'alzheimers_disease', label: '阿尔茨海默症' },
  { value: 'other_cognitive_impairment', label: '其他认知障碍' },
  { value: 'chronic_respiratory_disease', label: '慢性呼吸疾病' },
  { value: 'osteoarticular_disease', label: '骨关节疾病' },
  { value: 'tumor', label: '肿瘤' },
  { value: 'other_chronic_disease', label: '其他慢性疾病' },
  { value: 'none', label: '暂无明显慢性疾病' },
  { value: 'unknown', label: '暂不清楚' },
]

const recentEventOptions: ChoiceOption[] = [
  { value: 'fall_within_6_months', label: '近半年发生过跌倒' },
  { value: 'fracture_within_6_months', label: '近半年发生过骨折' },
  { value: 'frequent_hospitalization_within_6_months', label: '近半年频繁住院' },
  { value: 'recently_discharged', label: '近期刚出院' },
  { value: 'postoperative_recovery', label: '术后恢复中' },
  { value: 'long_term_bedridden', label: '长期卧床' },
  { value: 'pressure_injury', label: '存在压疮' },
  { value: 'none', label: '以上均无' },
  { value: 'unknown', label: '暂不清楚' },
]

const rehabilitationOptions: ChoiceOption[] = [
  { value: 'definite', label: '明确需要' },
  { value: 'possible', label: '可能需要' },
  { value: 'none', label: '不需要' },
  { value: 'unknown', label: '不确定' },
]

const chewingOptions: ChoiceOption[] = [
  { value: 'normal', label: '正常咀嚼' },
  { value: 'easy_chew', label: '更适合软食、易咀嚼食物' },
  { value: 'modified_food', label: '咀嚼能力较差，需要对食物做特殊处理' },
  { value: 'unknown', label: '暂不确定' },
]

const swallowingOptions: ChoiceOption[] = [
  { value: 'normal', label: '正常' },
  { value: 'occasional_difficulty', label: '偶尔吞咽不顺或容易呛咳' },
  { value: 'significant_difficulty', label: '明显吞咽困难' },
  { value: 'unknown', label: '暂不确定' },
]

const conditionsAnchorId = getAssessmentQuestionAnchorId('health.conditions')
const recentEventsAnchorId = getAssessmentQuestionAnchorId('health.recentEvents')
const rehabilitationNeedAnchorId = getAssessmentQuestionAnchorId('health.rehabilitationNeed')
const chewingAbilityAnchorId = getAssessmentQuestionAnchorId('health.chewingAbility')
const swallowingAbilityAnchorId = getAssessmentQuestionAnchorId('health.swallowingAbility')

const hasHealthAnswers = (
  conditions: HealthCondition[],
  recentEvents: HealthRecentEvent[],
  rehabilitationNeed: RehabilitationNeed | '',
  chewingAbility: ChewingAbility | '',
  swallowingAbility: SwallowingAbility | '',
): boolean => conditions.length > 0
  || recentEvents.length > 0
  || rehabilitationNeed !== ''
  || chewingAbility !== ''
  || swallowingAbility !== ''

const sameStringArray = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

Page({
  data: {
    backEnabled: true,
    backText: '返回上一页',
    warmSwissHeaderHeight: 0,
    conditions: [],
    recentEvents: [],
    rehabilitationNeed: '',
    chewingAbility: '',
    swallowingAbility: '',
    conditionsOptions,
    recentEventOptions,
    rehabilitationOptions,
    chewingOptions,
    swallowingOptions,
    conditionsError: '',
    recentEventsError: '',
    rehabilitationNeedError: '',
    chewingAbilityError: '',
    swallowingAbilityError: '',
    formError: '',
    saveStatus: '选择后会尝试保存到本机开发态草稿',
    persistenceFailed: false,
    conditionsAnchorId,
    recentEventsAnchorId,
    rehabilitationNeedAnchorId,
    chewingAbilityAnchorId,
    swallowingAbilityAnchorId,
  } as AssessmentHealthData,

  onLoad() {
    // Match UI-0 AppHeader geometry so the first-error anchor stays visible.
    const system = wx.getSystemInfoSync()
    const page = this as unknown as AssessmentHealthPageMetadata
    page._warmSwissHeaderPatch = {
      warmSwissHeaderHeight: (system.platform === 'android' ? 48 : 44) + system.safeArea.top,
    }
  },

  onShow() {
    resetAssessmentPageNavigation(this)
    this.syncFromDraft()
  },

  onHide() {
    onHideAssessmentPhasePage(this)
  },

  onUnload() {
    onUnloadAssessmentPhasePage(this)
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    const page = this as unknown as AssessmentHealthPageMetadata
    const conditions = answers['health.conditions'] || []
    const recentEvents = answers['health.recentEvents'] || []
    const rehabilitationNeed = answers['health.rehabilitationNeed'] || ''
    const chewingAbility = answers['health.chewingAbility'] || ''
    const swallowingAbility = answers['health.swallowingAbility'] || ''
    const patch: Pick<AssessmentHealthData,
      | 'warmSwissHeaderHeight'
      | 'backText'
      | 'conditions'
      | 'recentEvents'
      | 'rehabilitationNeed'
      | 'chewingAbility'
      | 'swallowingAbility'
      | 'conditionsError'
      | 'recentEventsError'
      | 'rehabilitationNeedError'
      | 'chewingAbilityError'
      | 'swallowingAbilityError'
      | 'formError'
      | 'persistenceFailed'
      | 'saveStatus'
    > = {
      ...(page._warmSwissHeaderPatch || { warmSwissHeaderHeight: this.data.warmSwissHeaderHeight }),
      backText: getAssessmentBackText('health'),
      conditions: [...conditions],
      recentEvents: [...recentEvents],
      rehabilitationNeed,
      chewingAbility,
      swallowingAbility,
      conditionsError: '',
      recentEventsError: '',
      rehabilitationNeedError: '',
      chewingAbilityError: '',
      swallowingAbilityError: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: hasHealthAnswers(conditions, recentEvents, rehabilitationNeed, chewingAbility, swallowingAbility)
        ? '已从本机草稿恢复（开发态）'
        : '选择后会尝试保存到本机开发态草稿',
    }
    const changedPatch: Partial<AssessmentHealthData> = {}
    if (this.data.backText !== patch.backText) changedPatch.backText = patch.backText
    if (this.data.warmSwissHeaderHeight !== patch.warmSwissHeaderHeight) changedPatch.warmSwissHeaderHeight = patch.warmSwissHeaderHeight
    if (!sameStringArray(this.data.conditions, patch.conditions)) changedPatch.conditions = patch.conditions
    if (!sameStringArray(this.data.recentEvents, patch.recentEvents)) changedPatch.recentEvents = patch.recentEvents
    if (this.data.rehabilitationNeed !== patch.rehabilitationNeed) changedPatch.rehabilitationNeed = patch.rehabilitationNeed
    if (this.data.chewingAbility !== patch.chewingAbility) changedPatch.chewingAbility = patch.chewingAbility
    if (this.data.swallowingAbility !== patch.swallowingAbility) changedPatch.swallowingAbility = patch.swallowingAbility
    if (this.data.conditionsError !== patch.conditionsError) changedPatch.conditionsError = patch.conditionsError
    if (this.data.recentEventsError !== patch.recentEventsError) changedPatch.recentEventsError = patch.recentEventsError
    if (this.data.rehabilitationNeedError !== patch.rehabilitationNeedError) changedPatch.rehabilitationNeedError = patch.rehabilitationNeedError
    if (this.data.chewingAbilityError !== patch.chewingAbilityError) changedPatch.chewingAbilityError = patch.chewingAbilityError
    if (this.data.swallowingAbilityError !== patch.swallowingAbilityError) changedPatch.swallowingAbilityError = patch.swallowingAbilityError
    if (this.data.formError !== patch.formError) changedPatch.formError = patch.formError
    if (this.data.persistenceFailed !== patch.persistenceFailed) changedPatch.persistenceFailed = patch.persistenceFailed
    if (this.data.saveStatus !== patch.saveStatus) changedPatch.saveStatus = patch.saveStatus
    if (Object.keys(changedPatch).length > 0) this.setData(changedPatch)
  },

  applyPersistenceResult(result: AssessmentDraftMutationResult) {
    this.setData({
      persistenceFailed: !result.persistence.ok,
      saveStatus: result.persistence.ok
        ? '已保存到本机（开发态），不会同步服务器'
        : '本机保存失败，请重试；答案不会同步服务器',
    })
  },

  onConditionsChange(event: WechatMiniprogram.CustomEvent) {
    const values = (event.detail as { values: HealthCondition[] }).values
    const result = values.length > 0
      ? assessmentDraftStore.setAnswer('health.conditions', values)
      : assessmentDraftStore.clearAnswer('health.conditions')
    const answers = result.draft.answers
    this.setData({
      conditions: answers['health.conditions'] || [],
      conditionsError: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onRecentEventsChange(event: WechatMiniprogram.CustomEvent) {
    const values = (event.detail as { values: HealthRecentEvent[] }).values
    const result = values.length > 0
      ? assessmentDraftStore.setAnswer('health.recentEvents', values)
      : assessmentDraftStore.clearAnswer('health.recentEvents')
    const answers = result.draft.answers
    this.setData({
      recentEvents: answers['health.recentEvents'] || [],
      recentEventsError: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onRehabilitationNeedChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: RehabilitationNeed }).value
    const result = assessmentDraftStore.setAnswer('health.rehabilitationNeed', value)
    const answers = result.draft.answers
    this.setData({
      rehabilitationNeed: answers['health.rehabilitationNeed'] || '',
      rehabilitationNeedError: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onChewingAbilityChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: ChewingAbility }).value
    const result = assessmentDraftStore.setAnswer('health.chewingAbility', value)
    const answer = result.draft.answers['health.chewingAbility'] || ''
    this.setData({
      chewingAbility: answer,
      chewingAbilityError: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onSwallowingAbilityChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: SwallowingAbility }).value
    const result = assessmentDraftStore.setAnswer('health.swallowingAbility', value)
    const answer = result.draft.answers['health.swallowingAbility'] || ''
    this.setData({
      swallowingAbility: answer,
      swallowingAbilityError: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onBack() {
    invalidateAssessmentPageAction(this)
    navigateBackFromAssessment('health')
  },

  onNavigationFailure() {
    wx.showToast({ title: '暂时无法返回，请重试。', icon: 'none' })
  },

  onNext() {
    const validation = validateHealthAnswersV2(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      conditionsError: validation.errors['health.conditions'] || '',
      recentEventsError: validation.errors['health.recentEvents'] || '',
      rehabilitationNeedError: validation.errors['health.rehabilitationNeed'] || '',
      chewingAbilityError: validation.errors['health.chewingAbility'] || '',
      swallowingAbilityError: validation.errors['health.swallowingAbility'] || '',
      formError: '',
    }, () => {
      if (!validation.valid && firstErrorQuestionId) {
        scrollToAssessmentQuestion(firstErrorQuestionId)
      }
    })
    if (!validation.valid) {
      return
    }

    if (this.data.persistenceFailed) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重新选择并保存后再试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
      })
      return
    }

    navigateAssessmentForwardWithCapacity(
      this,
      'health',
      'adl',
      'health.next',
      () => {
        const result = assessmentDraftStore.setCurrentStep('adl')
        if (!result.persistence.ok) {
          this.setData({
            formError: '本机保存失败，暂时无法进入下一步，请重试',
            saveStatus: '本机保存失败，请重试；答案不会同步服务器',
          })
          return false
        }
        return true
      },
      () => this.setData({ formError: '暂时无法进入下一步，请重试' }),
    )
  },
})
