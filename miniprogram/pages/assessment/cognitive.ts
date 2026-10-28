import { modeText } from '../../runtime/presentation-copy'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { validateCognitiveAnswersV2 } from '../../types/assessment-v2'
import type {
  AssessmentAnswerValueMapV2,
  CognitiveSpecialCareNeedV2,
  CognitiveSymptomV2,
} from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { getAssessmentBackText, navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { invalidateAssessmentPageAction, navigateAssessmentForwardWithCapacity, onHideAssessmentPhasePage, onUnloadAssessmentPhasePage, resetAssessmentPageNavigation } from '../../utils/assessment-phase-navigation'

type ChoiceOption = { value: string; label: string }
type CognitiveQuestionId = 'cognitive.symptoms' | 'cognitive.specialCareNeeds'

interface AssessmentCognitiveData {
  fontStyle: string
  backEnabled: boolean
  backText: string
  warmSwissHeaderHeight: number
  focusSpecialCare: boolean
  symptoms: CognitiveSymptomV2[]
  specialCareNeeds: CognitiveSpecialCareNeedV2[]
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
    fontStyle: '',
    backEnabled: true,
    backText: '返回上一页',
    warmSwissHeaderHeight: 0,
    focusSpecialCare: false,
    symptoms: [],
    specialCareNeeds: [],
    symptomsOptions,
    specialCareNeedsOptions,
    symptomsAnchorId,
    specialCareNeedsAnchorId,
    symptomsError: '',
    specialCareNeedsError: '',
    formError: '',
    saveStatus: modeText('选择后会尝试保存到本机开发态草稿'),
    persistenceFailed: false,
  } as AssessmentCognitiveData,

  onLoad(options: Record<string, string | undefined> = {}) {
    // Match UI-0 AppHeader geometry so the first-error anchor stays visible.
    const system = wx.getSystemInfoSync()
    this.setData({
      warmSwissHeaderHeight: (system.platform === 'android' ? 48 : 44) + system.safeArea.top,
      focusSpecialCare: options.focus === 'special-care',
    })
  },

  onReady() {
    if (this.data.focusSpecialCare) scrollToAssessmentQuestion('cognitive.specialCareNeeds')
  },

  onShow() {
    const fontStyle = readBrowseFontStyle()
    if (this.data.fontStyle !== fontStyle) this.setData({ fontStyle })
    resetAssessmentPageNavigation(this)
    this.setData({ backText: getAssessmentBackText('cognitive') })
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
    const symptoms = readMultiAnswer(answers, 'cognitive.symptoms') as CognitiveSymptomV2[]
    const specialCareNeeds = readMultiAnswer(answers, 'cognitive.specialCareNeeds') as CognitiveSpecialCareNeedV2[]
    this.setData({
      symptoms,
      specialCareNeeds,
      symptomsError: '',
      specialCareNeedsError: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: symptoms.length > 0 || specialCareNeeds.length > 0
        ? modeText('已从本机草稿恢复（开发态）')
        : modeText('选择后会尝试保存到本机开发态草稿'),
    })
  },

  applyPersistenceResult(result: AssessmentDraftMutationResult) {
    this.setData({
      persistenceFailed: !result.persistence.ok,
      saveStatus: result.persistence.ok
        ? modeText('已保存到本机（开发态），不会同步服务器')
        : modeText('本机保存失败，请重试；答案不会同步服务器'),
    })
  },

  onSymptomsChange(event: WechatMiniprogram.CustomEvent) {
    this.updateMultiAnswer(
      'cognitive.symptoms',
      (event.detail as { values: CognitiveSymptomV2[] }).values,
      'symptoms',
    )
  },

  onSpecialCareNeedsChange(event: WechatMiniprogram.CustomEvent) {
    this.updateMultiAnswer(
      'cognitive.specialCareNeeds',
      (event.detail as { values: CognitiveSpecialCareNeedV2[] }).values,
      'specialCareNeeds',
    )
  },

  updateMultiAnswer<K extends CognitiveQuestionId>(
    questionId: K,
    values: AssessmentAnswerValueMapV2[K],
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
    invalidateAssessmentPageAction(this)
    navigateBackFromAssessment('cognitive')
  },

  onNavigationFailure() {
    wx.showToast({ title: '暂时无法返回，请重试。', icon: 'none' })
  },

  onNext() {
    const validation = validateCognitiveAnswersV2(assessmentDraftStore.getDraft().answers)
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
        formError: modeText('本机保存失败，暂时无法进入下一步，请重新选择并保存后再试'),
        saveStatus: modeText('本机保存失败，请重试；答案不会同步服务器'),
      })
      return
    }

    navigateAssessmentForwardWithCapacity(
      this,
      'cognitive',
      'preference',
      'cognitive.next',
      () => {
        const result = assessmentDraftStore.setCurrentStep('preference')
        if (!result.persistence.ok) {
          this.setData({
            formError: modeText('本机保存失败，暂时无法进入下一步，请重试'),
            saveStatus: modeText('本机保存失败，请重试；答案不会同步服务器'),
            persistenceFailed: true,
          })
          return false
        }
        return true
      },
      () => this.setData({ formError: '暂时无法进入下一步，请重试' }),
    )
  },
})
