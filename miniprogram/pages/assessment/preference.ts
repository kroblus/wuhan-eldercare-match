import {
  validatePreferenceAnswers,
  type PreferencePriority,
  type PreferenceRegionAnswer,
  type PreferredCareType,
} from '../../types/assessment'
import { assessmentDraftStore, type AssessmentDraftMutationResult } from '../../store/assessment-draft'
import {
  buildInstitutionRegionCatalog,
  type InstitutionRegionCatalogOption,
} from '../../services/institution-region-catalog'
import { institutionService } from '../../services/institution.service'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = {
  value: string
  label: string
  description?: string
}

type RegionCatalogStatus = 'loading' | 'ready' | 'empty' | 'error'

interface AssessmentPreferenceData {
  backEnabled: boolean
  careType: PreferredCareType | ''
  priorities: PreferencePriority[]
  regionCode: string
  careTypeOptions: ChoiceOption[]
  priorityOptions: ChoiceOption[]
  regionOptions: InstitutionRegionCatalogOption[]
  priorityMax: number
  regionCatalogStatus: RegionCatalogStatus
  regionCatalogVersion: string
  regionStatusMessage: string
  regionError: string
  careTypeError: string
  prioritiesError: string
  priorityLimitMessage: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
  careTypeAnchorId: string
  prioritiesAnchorId: string
}

const NO_PREFERENCE_OPTION: InstitutionRegionCatalogOption = {
  value: 'no_preference',
  label: '不限制',
}

const PRIORITY_MAX = 3

const careTypeOptions: ChoiceOption[] = [
  {
    value: 'active_aging',
    label: '活力型养老',
    description: '适合生活基本自理、重视生活品质的老人。',
  },
  {
    value: 'medical_nursing_integrated',
    label: '医养结合',
    description: '更重视医疗、护理和慢病管理。',
  },
  {
    value: 'disability_care',
    label: '失能护理',
    description: '适合半失能、失能老人。',
  },
  {
    value: 'dementia_care',
    label: '认知症照护',
    description: '适合认知障碍老人。',
  },
  {
    value: 'rehabilitation_care',
    label: '康复养老',
    description: '适合术后、慢病或功能恢复老人。',
  },
  {
    value: 'unknown',
    label: '不确定',
    description: '让系统根据老人情况判断。',
  },
]

const priorityOptions: ChoiceOption[] = [
  { value: 'medical_conditions', label: '医疗条件' },
  { value: 'nursing_professionalism', label: '护理专业程度' },
  { value: 'caregiver_attitude', label: '护理人员态度' },
  { value: 'rehabilitation_capability', label: '康复能力' },
  { value: 'food_quality', label: '餐饮质量' },
  { value: 'living_environment', label: '居住环境' },
  { value: 'overall_quality', label: '整体品质' },
  { value: 'recreational_activities', label: '文娱活动' },
  { value: 'close_to_family', label: '距离家人近' },
  { value: 'transportation', label: '交通方便' },
  { value: 'price', label: '价格' },
  { value: 'dementia_care', label: '认知症照护能力' },
]

const PRIORITY_CODES: readonly PreferencePriority[] = priorityOptions.map(
  (option) => option.value as PreferencePriority,
)

const careTypeAnchorId = getAssessmentQuestionAnchorId('preference.careType')
const prioritiesAnchorId = getAssessmentQuestionAnchorId('preference.priorities')

type DraftAnswers = ReturnType<typeof assessmentDraftStore.getDraft>['answers']

const readPriorities = (answers: DraftAnswers): PreferencePriority[] => {
  const value = answers['preference.priorities']
  return Array.isArray(value) ? [...value] : []
}

const readRegionCode = (answers: DraftAnswers): string => {
  const value = answers['preference.region']
  return value && typeof value === 'object' && 'regionCode' in value ? value.regionCode : ''
}

const hasPreferenceAnswers = (answers: DraftAnswers): boolean =>
  answers['preference.careType'] !== undefined
  || answers['preference.priorities'] !== undefined
  || answers['preference.region'] !== undefined

const withNoPreference = (options: readonly InstitutionRegionCatalogOption[]): InstitutionRegionCatalogOption[] => [
  NO_PREFERENCE_OPTION,
  ...options.filter((option) => option.value !== NO_PREFERENCE_OPTION.value),
]

Page({
  data: {
    backEnabled: true,
    careType: '',
    priorities: [],
    regionCode: '',
    careTypeOptions,
    priorityOptions,
    regionOptions: [],
    priorityMax: PRIORITY_MAX,
    regionCatalogStatus: 'loading',
    regionCatalogVersion: '',
    regionStatusMessage: '正在读取当前已核验合作机构的区域信息。',
    regionError: '',
    careTypeError: '',
    prioritiesError: '',
    priorityLimitMessage: '',
    formError: '',
    saveStatus: '选择后会尝试保存到本机开发态草稿',
    persistenceFailed: false,
    careTypeAnchorId,
    prioritiesAnchorId,
  } as AssessmentPreferenceData,

  onShow() {
    resetNavigationGuard(this)
    this.syncFromDraft()
    this.loadRegionCatalog()
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    this.setData({
      careType: answers['preference.careType'] || '',
      priorities: readPriorities(answers),
      regionCode: readRegionCode(answers),
      careTypeError: '',
      prioritiesError: '',
      priorityLimitMessage: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: hasPreferenceAnswers(answers)
        ? '已从本机草稿恢复（开发态）'
        : '选择后会尝试保存到本机开发态草稿',
    })
  },

  loadRegionCatalog() {
    this.setData({
      regionCatalogStatus: 'loading',
      regionError: '',
      regionStatusMessage: '正在读取当前已核验合作机构的区域信息。',
    })
    Promise.resolve()
      .then(() => institutionService.listInstitutions())
      .then((institutions) => {
        const result = buildInstitutionRegionCatalog(institutions)
        if (!result.ok) {
          this.setData({
            regionOptions: [],
            regionCatalogStatus: 'error',
            regionCatalogVersion: '',
            regionStatusMessage: '区域信息暂时不可用，本题可暂不选择。',
            regionError: `已核验机构的区域资料存在冲突（${result.regionCode}），请稍后重试。`,
          })
          return
        }

        const { catalog } = result
        this.setData({
          regionOptions: withNoPreference(catalog.options),
          regionCatalogStatus: catalog.options.length > 0 ? 'ready' : 'empty',
          regionCatalogVersion: catalog.catalogVersion,
          regionStatusMessage: catalog.options.length > 0
            ? '区域选项来自当前已核验合作机构数据。'
            : '当前没有已核验的合作机构区域，可选择“不限制”。',
          regionError: '',
        })
      })
      .catch(() => {
        this.setData({
          regionOptions: [],
          regionCatalogStatus: 'error',
          regionCatalogVersion: '',
          regionStatusMessage: '区域信息暂时无法加载，本题可暂不选择。',
          regionError: '加载区域信息失败，请稍后重试。',
        })
      })
  },

  onRetryRegionCatalog() {
    this.loadRegionCatalog()
  },

  applyPersistenceResult(result: AssessmentDraftMutationResult) {
    this.setData({
      persistenceFailed: !result.persistence.ok,
      saveStatus: result.persistence.ok
        ? '已保存到本机（开发态），不会同步服务器'
        : '本机保存失败，请重试；答案不会同步服务器',
    })
  },

  onCareTypeChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: PreferredCareType }).value
    const result = assessmentDraftStore.setAnswer('preference.careType', value)
    const answer = result.draft.answers['preference.careType'] || ''
    this.setData({ careType: answer, careTypeError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onPrioritiesChange(event: WechatMiniprogram.CustomEvent) {
    const rawValues = (event.detail as { values?: unknown }).values
    const values = Array.isArray(rawValues)
      ? rawValues.filter((value): value is PreferencePriority =>
        typeof value === 'string' && PRIORITY_CODES.indexOf(value as PreferencePriority) >= 0,
      )
      : []
    const safeValues = values.slice(0, PRIORITY_MAX)
    const result = safeValues.length > 0
      ? assessmentDraftStore.setAnswer('preference.priorities', safeValues)
      : assessmentDraftStore.clearAnswer('preference.priorities')
    const answer = result.draft.answers['preference.priorities'] || []
    this.setData({
      priorities: [...answer],
      prioritiesError: '',
      priorityLimitMessage: Array.isArray(rawValues) && rawValues.length > PRIORITY_MAX
        ? `最多选择 ${PRIORITY_MAX} 项`
        : '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onPriorityLimit(event: WechatMiniprogram.CustomEvent) {
    const max = (event.detail as { max?: number }).max || PRIORITY_MAX
    this.setData({ priorityLimitMessage: `最多选择 ${max} 项` })
  },

  onRegionChange(event: WechatMiniprogram.CustomEvent) {
    if ((this.data.regionCatalogStatus !== 'ready' && this.data.regionCatalogStatus !== 'empty')
      || !this.data.regionCatalogVersion) {
      return
    }
    const value = (event.detail as { value?: unknown }).value
    if (typeof value !== 'string') {
      return
    }
    const option = this.data.regionOptions.find((item) => item.value === value)
    if (!option) {
      return
    }

    const regionAnswer: PreferenceRegionAnswer = value === NO_PREFERENCE_OPTION.value
      ? {
        kind: 'no_preference',
        regionCode: 'no_preference',
        regionLabelSnapshot: '不限制',
        catalogVersion: this.data.regionCatalogVersion,
      }
      : {
        kind: 'institution_region',
        regionCode: option.value,
        regionLabelSnapshot: option.label,
        catalogVersion: this.data.regionCatalogVersion,
      }
    const result = assessmentDraftStore.setAnswer('preference.region', regionAnswer)
    const answer = result.draft.answers['preference.region'] as PreferenceRegionAnswer | undefined
    this.setData({
      regionCode: answer ? answer.regionCode : '',
      formError: '',
    })
    this.applyPersistenceResult(result)
  },

  onBack() {
    navigateBackFromAssessment('preference')
  },

  onNext() {
    const validation = validatePreferenceAnswers(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      careTypeError: validation.errors['preference.careType'] || '',
      prioritiesError: validation.errors['preference.priorities'] || '',
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

    const result = assessmentDraftStore.setCurrentStep('budget')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
        persistenceFailed: true,
      })
      return
    }
    navigateToWithGuard(this, 'preference.next', '/pages/assessment/budget')
  },
})
