import {
  validateCognitiveAnswers,
  type AssessmentAnswerValueMap,
  type CognitiveSpecialCareNeed,
  type CognitiveSymptom,
} from '../../types/assessment'
import { assessmentDraftStore, type AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = { value: string; label: string }
type CognitiveQuestionId = 'cognitive.symptoms' | 'cognitive.specialCareNeeds'

interface AssessmentCognitiveData {
  backEnabled: boolean
  symptoms: CognitiveSymptom[]
  specialCareNeeds: CognitiveSpecialCareNeed[]
  symptomsOptions: ChoiceOption[]
  specialCareNeedsOptions: ChoiceOption[]
  symptomsAnchorId: string
  specialCareNeedsAnchorId: string
  symptomsError: string
  specialCareNeedsError: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
}

const symptomsOptions: ChoiceOption[] = [
  { value: 'memory_decline', label: '记忆力明显下降' },
  { value: 'repetitive_questioning', label: '经常重复询问' },
  { value: 'gets_lost', label: '容易迷路' },
  { value: 'wandering_risk', label: '有走失风险' },
  { value: 'sleep_wake_disorder', label: '昼夜作息混乱' },
  { value: 'mood_instability', label: '情绪波动明显' },
  { value: 'agitation', label: '容易躁动' },
  { value: 'aggression', label: '有攻击行为' },
  { value: 'diagnosed_dementia', label: '已确诊认知症' },
  { value: 'none', label: '无以上情况' },
  { value: 'unknown', label: '暂不确定' },
]

const specialCareNeedsOptions: ChoiceOption[] = [
  { value: 'round_the_clock_care', label: '24 小时照护' },
  { value: 'one_to_one_caregiver', label: '一对一护工' },
  { value: 'night_care', label: '夜间重点照护' },
  { value: 'dementia_unit', label: '认知症专区' },
  { value: 'rehabilitation_training', label: '康复训练' },
  { value: 'tube_feeding', label: '鼻饲护理' },
  { value: 'catheter_care', label: '导尿护理' },
  { value: 'pressure_injury_care', label: '压疮护理' },
  { value: 'incontinence_care', label: '失禁护理' },
  { value: 'other', label: '其他' },
  { value: 'none', label: '无以上特殊护理需求' },
  { value: 'unknown', label: '暂不确定' },
]

const symptomsAnchorId = getAssessmentQuestionAnchorId('cognitive.symptoms')
const specialCareNeedsAnchorId = getAssessmentQuestionAnchorId('cognitive.specialCareNeeds')

type DraftAnswers = ReturnType<typeof assessmentDraftStore.getDraft>['answers']

const readMultiAnswer = <K extends CognitiveQuestionId>(answers: DraftAnswers, questionId: K): string[] => {
  const value = answers[questionId]
  return Array.isArray(value) ? [...value] : []
}

Page({
  data: {
    backEnabled: true,
    symptoms: [],
    specialCareNeeds: [],
    symptomsOptions,
    specialCareNeedsOptions,
    symptomsAnchorId,
    specialCareNeedsAnchorId,
    symptomsError: '',
    specialCareNeedsError: '',
    formError: '',
    saveStatus: '选择后会尝试保存到本机开发态草稿',
    persistenceFailed: false,
  } as AssessmentCognitiveData,

  onShow() {
    resetNavigationGuard(this)
    this.syncFromDraft()
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    const symptoms = readMultiAnswer(answers, 'cognitive.symptoms') as CognitiveSymptom[]
    const specialCareNeeds = readMultiAnswer(answers, 'cognitive.specialCareNeeds') as CognitiveSpecialCareNeed[]
    this.setData({
      symptoms,
      specialCareNeeds,
      symptomsError: '',
      specialCareNeedsError: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: symptoms.length > 0 || specialCareNeeds.length > 0
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

  onSymptomsChange(event: WechatMiniprogram.CustomEvent) {
    this.updateMultiAnswer(
      'cognitive.symptoms',
      (event.detail as { values: CognitiveSymptom[] }).values,
      'symptoms',
    )
  },

  onSpecialCareNeedsChange(event: WechatMiniprogram.CustomEvent) {
    this.updateMultiAnswer(
      'cognitive.specialCareNeeds',
      (event.detail as { values: CognitiveSpecialCareNeed[] }).values,
      'specialCareNeeds',
    )
  },

  updateMultiAnswer<K extends CognitiveQuestionId>(
    questionId: K,
    values: AssessmentAnswerValueMap[K],
    dataKey: 'symptoms' | 'specialCareNeeds',
  ) {
    const result = values.length > 0
      ? assessmentDraftStore.setAnswer(questionId, values)
      : assessmentDraftStore.clearAnswer(questionId)
    const answers = result.draft.answers
    this.setData({
      [dataKey]: readMultiAnswer(answers, questionId),
      [`${dataKey}Error`]: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onBack() {
    navigateBackFromAssessment('cognitive')
  },

  onNext() {
    const validation = validateCognitiveAnswers(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      symptomsError: validation.errors['cognitive.symptoms'] || '',
      specialCareNeedsError: validation.errors['cognitive.specialCareNeeds'] || '',
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

    const result = assessmentDraftStore.setCurrentStep('preference')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
        persistenceFailed: true,
      })
      return
    }
    navigateToWithGuard(this, 'cognitive.next', '/pages/assessment/preference')
  },
})
