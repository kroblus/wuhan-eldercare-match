import {
  ASSESSMENT_QUESTION_DEFINITIONS_V2,
  validateBudgetAnswersV2,
  validateAssessmentDraftForCompletionV2,
} from '../../types/assessment-v2'
import type {
  AssessmentAnswerValueMapV2,
  AssessmentStepIdV2,
  ConsultantSupportV2,
  MonthlyRangeV2,
  MoveInTimingV2,
  UpfrontCostAcceptanceV2,
} from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = { value: string; label: string }
type BudgetQuestionId =
  | 'budget.monthlyRange'
  | 'budget.upfrontCostAcceptance'
  | 'budget.moveInTiming'
  | 'budget.consultantSupport'

type BudgetQuestionValueMap = Pick<AssessmentAnswerValueMapV2, BudgetQuestionId>

interface AssessmentBudgetData {
  backEnabled: boolean
  monthlyRange: MonthlyRangeV2 | ''
  upfrontCostAcceptance: UpfrontCostAcceptanceV2 | ''
  moveInTiming: MoveInTimingV2 | ''
  consultantSupport: ConsultantSupportV2 | ''
  monthlyRangeOptions: ChoiceOption[]
  upfrontCostOptions: ChoiceOption[]
  moveInTimingOptions: ChoiceOption[]
  consultantSupportOptions: ChoiceOption[]
  monthlyRangeAnchorId: string
  upfrontCostAnchorId: string
  moveInTimingAnchorId: string
  consultantSupportAnchorId: string
  monthlyRangeError: string
  upfrontCostError: string
  moveInTimingError: string
  consultantSupportError: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
}

const monthlyRangeOptions: ChoiceOption[] = [
  { value: 'cny_3500_5000', label: '3500–5000 元/月' },
  { value: 'cny_5000_8000', label: '5000–8000 元/月' },
  { value: 'cny_8000_12000', label: '8000–12000 元/月' },
  { value: 'cny_12000_15000', label: '12000–15000 元/月' },
  { value: 'cny_15000_plus', label: '15000 元以上/月' },
  { value: 'unknown', label: '暂不确定' },
]

const upfrontCostOptions: ChoiceOption[] = [
  { value: 'acceptable', label: '可以接受' },
  { value: 'depends_on_amount', label: '视具体金额而定' },
  { value: 'avoid_high_one_time_fee', label: '不希望较高一次性费用' },
  { value: 'unknown', label: '不清楚' },
]

const moveInTimingOptions: ChoiceOption[] = [
  { value: 'as_soon_as_possible', label: '希望尽快入住' },
  { value: 'within_1_month', label: '1 个月以内' },
  { value: 'within_1_to_3_months', label: '1–3 个月' },
  { value: 'after_3_months', label: '3 个月以后' },
  { value: 'research_only', label: '目前只是提前了解' },
]

const consultantSupportOptions: ChoiceOption[] = [
  { value: 'request_contact', label: '希望顾问联系我' },
  { value: 'recommendation_first', label: '先看推荐结果' },
]

const assessmentStepLabels: Record<AssessmentStepIdV2, string> = {
  basic: '老人基本情况',
  health: '健康情况',
  adl: '日常生活能力',
  cognitive: '认知与特殊护理',
  preference: '养老需求与偏好',
  budget: '预算与入住计划',
}

const monthlyRangeAnchorId = getAssessmentQuestionAnchorId('budget.monthlyRange')
const upfrontCostAnchorId = getAssessmentQuestionAnchorId('budget.upfrontCostAcceptance')
const moveInTimingAnchorId = getAssessmentQuestionAnchorId('budget.moveInTiming')
const consultantSupportAnchorId = getAssessmentQuestionAnchorId('budget.consultantSupport')

type DraftAnswers = ReturnType<typeof assessmentDraftStore.getDraft>['answers']

const readBudgetAnswer = <K extends BudgetQuestionId>(
  answers: DraftAnswers,
  questionId: K,
): BudgetQuestionValueMap[K] | '' => {
  const value = answers[questionId]
  return value === undefined ? '' : value as BudgetQuestionValueMap[K]
}

const hasBudgetAnswers = (answers: DraftAnswers): boolean =>
  answers['budget.monthlyRange'] !== undefined
  || answers['budget.upfrontCostAcceptance'] !== undefined
  || answers['budget.moveInTiming'] !== undefined
  || answers['budget.consultantSupport'] !== undefined

Page({
  data: {
    backEnabled: true,
    monthlyRange: '',
    upfrontCostAcceptance: '',
    moveInTiming: '',
    consultantSupport: '',
    monthlyRangeOptions,
    upfrontCostOptions,
    moveInTimingOptions,
    consultantSupportOptions,
    monthlyRangeAnchorId,
    upfrontCostAnchorId,
    moveInTimingAnchorId,
    consultantSupportAnchorId,
    monthlyRangeError: '',
    upfrontCostError: '',
    moveInTimingError: '',
    consultantSupportError: '',
    formError: '',
    saveStatus: '选择后会尝试保存到本机开发态草稿',
    persistenceFailed: false,
  } as AssessmentBudgetData,

  onShow() {
    resetNavigationGuard(this)
    this.syncFromDraft()
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    this.setData({
      monthlyRange: readBudgetAnswer(answers, 'budget.monthlyRange'),
      upfrontCostAcceptance: readBudgetAnswer(answers, 'budget.upfrontCostAcceptance'),
      moveInTiming: readBudgetAnswer(answers, 'budget.moveInTiming'),
      consultantSupport: readBudgetAnswer(answers, 'budget.consultantSupport'),
      monthlyRangeError: '',
      upfrontCostError: '',
      moveInTimingError: '',
      consultantSupportError: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: hasBudgetAnswers(answers)
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

  updateSingleAnswer<K extends BudgetQuestionId>(
    questionId: K,
    value: AssessmentAnswerValueMapV2[K],
    dataKey: K extends 'budget.monthlyRange'
      ? 'monthlyRange'
      : K extends 'budget.upfrontCostAcceptance'
        ? 'upfrontCostAcceptance'
        : K extends 'budget.moveInTiming'
          ? 'moveInTiming'
          : 'consultantSupport',
  ) {
    const result = assessmentDraftStore.setAnswer(questionId, value)
    const answer = result.draft.answers[questionId] || ''
    this.setData({
      [dataKey]: answer,
      [`${dataKey}Error`]: '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onMonthlyRangeChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer(
      'budget.monthlyRange',
      (event.detail as { value: MonthlyRangeV2 }).value,
      'monthlyRange',
    )
  },

  onUpfrontCostChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer(
      'budget.upfrontCostAcceptance',
      (event.detail as { value: UpfrontCostAcceptanceV2 }).value,
      'upfrontCostAcceptance',
    )
  },

  onMoveInTimingChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer(
      'budget.moveInTiming',
      (event.detail as { value: MoveInTimingV2 }).value,
      'moveInTiming',
    )
  },

  onConsultantSupportChange(event: WechatMiniprogram.CustomEvent) {
    this.updateSingleAnswer(
      'budget.consultantSupport',
      (event.detail as { value: ConsultantSupportV2 }).value,
      'consultantSupport',
    )
  },

  onBack() {
    navigateBackFromAssessment('budget')
  },

  onNext() {
    const validation = validateBudgetAnswersV2(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      monthlyRangeError: validation.errors['budget.monthlyRange'] || '',
      upfrontCostError: validation.errors['budget.upfrontCostAcceptance'] || '',
      moveInTimingError: validation.errors['budget.moveInTiming'] || '',
      consultantSupportError: validation.errors['budget.consultantSupport'] || '',
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

    const completionValidation = validateAssessmentDraftForCompletionV2(
      assessmentDraftStore.getDraft().answers,
    )
    if (!completionValidation.valid) {
      const firstInvalidQuestionId = completionValidation.firstInvalidQuestionId
      const formError = firstInvalidQuestionId
        ? `${assessmentStepLabels[ASSESSMENT_QUESTION_DEFINITIONS_V2[firstInvalidQuestionId].step]}仍有未完成或无效的必填项，请返回补充后再继续`
        : '评估草稿包含无法识别的答案，请返回评估说明重新检查或开始评估'
      this.setData({
        formError,
      })
      return
    }

    const result = assessmentDraftStore.setCurrentStep('budget')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
        persistenceFailed: true,
      })
      return
    }
    navigateToWithGuard(
      this,
      'budget.next',
      '/pages/assessment/profile',
      undefined,
      () => {
        this.setData({
          formError: '暂时无法打开老人需求画像，请重试',
        })
      },
    )
  },
})
