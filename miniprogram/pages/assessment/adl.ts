import { validateAdlAnswersV2 } from '../../types/assessment-v2'
import type {
  AdlAssistanceV2,
  AdlEatingV2,
  AdlMobilityV2,
  AdlStairsV2,
  AdlToiletingV2,
  AdlTransferV2,
  AssessmentAnswerValueMapV2,
} from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = { value: string; label: string }
type AdlQuestionId =
  | 'adl.eating'
  | 'adl.mobility'
  | 'adl.toileting'
  | 'adl.bathing'
  | 'adl.dressing'
  | 'adl.transfer'
  | 'adl.stairs'

interface AssessmentAdlData {
  backEnabled: boolean
  warmSwissHeaderHeight: number
  eating: AdlEatingV2 | ''
  mobility: AdlMobilityV2 | ''
  toileting: AdlToiletingV2 | ''
  bathing: AdlAssistanceV2 | ''
  dressing: AdlAssistanceV2 | ''
  transfer: AdlTransferV2 | ''
  stairs: AdlStairsV2 | ''
  eatingOptions: ChoiceOption[]
  mobilityOptions: ChoiceOption[]
  toiletingOptions: ChoiceOption[]
  bathingOptions: ChoiceOption[]
  dressingOptions: ChoiceOption[]
  transferOptions: ChoiceOption[]
  stairsOptions: ChoiceOption[]
  eatingAnchorId: string
  mobilityAnchorId: string
  toiletingAnchorId: string
  bathingAnchorId: string
  dressingAnchorId: string
  transferAnchorId: string
  stairsAnchorId: string
  eatingError: string
  mobilityError: string
  toiletingError: string
  bathingError: string
  dressingError: string
  transferError: string
  stairsError: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
}

const eatingOptions: ChoiceOption[] = [
  { value: 'independent', label: '可以完全独立进食' },
  { value: 'minor_assistance', label: '需要少量协助' },
  { value: 'needs_feeding', label: '需要他人喂饭' },
  { value: 'special_feeding', label: '鼻饲或其他特殊进食方式' },
  { value: 'unknown', label: '暂不确定' },
]

const mobilityOptions: ChoiceOption[] = [
  { value: 'independent', label: '可以独立行走' },
  { value: 'walking_aid', label: '需要拐杖或助行器' },
  { value: 'wheelchair', label: '主要依靠轮椅' },
  { value: 'bedridden', label: '基本无法下床' },
  { value: 'unknown', label: '暂不确定' },
]

const toiletingOptions: ChoiceOption[] = [
  { value: 'independent', label: '可以完全自主完成' },
  { value: 'occasional_assistance', label: '偶尔需要帮助' },
  { value: 'frequent_incontinence', label: '经常失禁' },
  { value: 'full_assistance', label: '完全需要他人照护' },
  { value: 'catheter_or_stoma', label: '导尿或造瘘' },
  { value: 'unknown', label: '暂不确定' },
]

const bathingOptions: ChoiceOption[] = [
  { value: 'independent', label: '完全自主' },
  { value: 'partial_assistance', label: '需要部分协助' },
  { value: 'full_assistance', label: '完全需要他人协助' },
  { value: 'unknown', label: '暂不确定' },
]

const dressingOptions: ChoiceOption[] = [
  { value: 'independent', label: '完全自主' },
  { value: 'partial_assistance', label: '需要部分协助' },
  { value: 'full_assistance', label: '完全需要他人帮助' },
  { value: 'unknown', label: '暂不确定' },
]

const transferOptions: ChoiceOption[] = [
  { value: 'independent', label: '可以自主完成' },
  { value: 'minor_assistance', label: '需要少量帮助' },
  { value: 'needs_support', label: '需要他人搀扶' },
  { value: 'fully_dependent', label: '完全依赖他人' },
  { value: 'unknown', label: '暂不确定' },
]

const stairsOptions: ChoiceOption[] = [
  { value: 'independent', label: '可以独立完成' },
  { value: 'needs_assistance', label: '需要帮助' },
  { value: 'unable', label: '无法完成' },
  { value: 'no_stairs', label: '当前生活环境无楼梯' },
  { value: 'unknown', label: '暂不确定' },
]

const ADL_QUESTION_ORDER: readonly AdlQuestionId[] = [
  'adl.eating',
  'adl.mobility',
  'adl.toileting',
  'adl.bathing',
  'adl.dressing',
  'adl.transfer',
  'adl.stairs',
]

const eatingAnchorId = getAssessmentQuestionAnchorId('adl.eating')
const mobilityAnchorId = getAssessmentQuestionAnchorId('adl.mobility')
const toiletingAnchorId = getAssessmentQuestionAnchorId('adl.toileting')
const bathingAnchorId = getAssessmentQuestionAnchorId('adl.bathing')
const dressingAnchorId = getAssessmentQuestionAnchorId('adl.dressing')
const transferAnchorId = getAssessmentQuestionAnchorId('adl.transfer')
const stairsAnchorId = getAssessmentQuestionAnchorId('adl.stairs')

type DraftAnswers = ReturnType<typeof assessmentDraftStore.getDraft>['answers']

const readStringAnswer = <K extends AdlQuestionId>(
  answers: DraftAnswers,
  questionId: K,
): AssessmentAnswerValueMapV2[K] | '' => {
  const value = answers[questionId]
  return value === undefined ? '' : value as AssessmentAnswerValueMapV2[K]
}

Page({
  data: {
    backEnabled: true,
    warmSwissHeaderHeight: 0,
    eating: '',
    mobility: '',
    toileting: '',
    bathing: '',
    dressing: '',
    transfer: '',
    stairs: '',
    eatingOptions,
    mobilityOptions,
    toiletingOptions,
    bathingOptions,
    dressingOptions,
    transferOptions,
    stairsOptions,
    eatingAnchorId,
    mobilityAnchorId,
    toiletingAnchorId,
    bathingAnchorId,
    dressingAnchorId,
    transferAnchorId,
    stairsAnchorId,
    eatingError: '',
    mobilityError: '',
    toiletingError: '',
    bathingError: '',
    dressingError: '',
    transferError: '',
    stairsError: '',
    formError: '',
    saveStatus: '选择后会尝试保存到本机开发态草稿',
    persistenceFailed: false,
  } as AssessmentAdlData,

  onLoad() {
    // Match UI-0 AppHeader geometry so the first-error anchor stays visible.
    const system = wx.getSystemInfoSync()
    this.setData({
      warmSwissHeaderHeight: (system.platform === 'android' ? 48 : 44) + system.safeArea.top,
    })
  },

  onShow() {
    resetNavigationGuard(this)
    this.syncFromDraft()
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    this.setData({
      eating: readStringAnswer(answers, 'adl.eating'),
      mobility: readStringAnswer(answers, 'adl.mobility'),
      toileting: readStringAnswer(answers, 'adl.toileting'),
      bathing: readStringAnswer(answers, 'adl.bathing'),
      dressing: readStringAnswer(answers, 'adl.dressing'),
      transfer: readStringAnswer(answers, 'adl.transfer'),
      stairs: readStringAnswer(answers, 'adl.stairs'),
      eatingError: '',
      mobilityError: '',
      toiletingError: '',
      bathingError: '',
      dressingError: '',
      transferError: '',
      stairsError: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: ADL_QUESTION_ORDER.some((questionId) => answers[questionId] !== undefined)
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

  onEatingChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.eating', (event.detail as { value: AdlEatingV2 }).value, 'eating')
  },

  onMobilityChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.mobility', (event.detail as { value: AdlMobilityV2 }).value, 'mobility')
  },

  onToiletingChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.toileting', (event.detail as { value: AdlToiletingV2 }).value, 'toileting')
  },

  onBathingChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.bathing', (event.detail as { value: AdlAssistanceV2 }).value, 'bathing')
  },

  onDressingChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.dressing', (event.detail as { value: AdlAssistanceV2 }).value, 'dressing')
  },

  onTransferChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.transfer', (event.detail as { value: AdlTransferV2 }).value, 'transfer')
  },

  onStairsChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer('adl.stairs', (event.detail as { value: AdlStairsV2 }).value, 'stairs')
  },

  updateSingleAnswer<K extends AdlQuestionId>(
    questionId: K,
    value: AssessmentAnswerValueMapV2[K],
    dataKey: keyof Pick<AssessmentAdlData, 'eating' | 'mobility' | 'toileting' | 'bathing' | 'dressing' | 'transfer' | 'stairs'>,
  ) {
    const result = assessmentDraftStore.setAnswer(questionId, value)
    const answers = result.draft.answers
    this.setData({
      [dataKey]: answers[questionId] || '',
      [`${dataKey}Error`]: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onBack() {
    navigateBackFromAssessment('adl')
  },

  onNext() {
    const validation = validateAdlAnswersV2(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      eatingError: validation.errors['adl.eating'] || '',
      mobilityError: validation.errors['adl.mobility'] || '',
      toiletingError: validation.errors['adl.toileting'] || '',
      bathingError: validation.errors['adl.bathing'] || '',
      dressingError: validation.errors['adl.dressing'] || '',
      transferError: validation.errors['adl.transfer'] || '',
      stairsError: validation.errors['adl.stairs'] || '',
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

    const result = assessmentDraftStore.setCurrentStep('cognitive')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
        persistenceFailed: true,
      })
      return
    }
    navigateToWithGuard(this, 'adl.next', '/pages/assessment/cognitive')
  },
})
