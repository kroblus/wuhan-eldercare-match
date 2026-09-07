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
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = { value: string; label: string }

interface AssessmentHealthData {
  backEnabled: boolean
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

Page({
  data: {
    backEnabled: true,
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

  onShow() {
    resetNavigationGuard(this)
    this.syncFromDraft()
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    const conditions = answers['health.conditions'] || []
    const recentEvents = answers['health.recentEvents'] || []
    const rehabilitationNeed = answers['health.rehabilitationNeed'] || ''
    const chewingAbility = answers['health.chewingAbility'] || ''
    const swallowingAbility = answers['health.swallowingAbility'] || ''
    this.setData({
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
    })
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
    navigateBackFromAssessment('health')
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

    const result = assessmentDraftStore.setCurrentStep('adl')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
      })
      return
    }
    navigateToWithGuard(this, 'health.next', '/pages/assessment/adl')
  },
})
