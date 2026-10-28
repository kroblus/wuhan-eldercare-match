import { modeText } from '../../runtime/presentation-copy'
import { readBrowseFontStyle } from '../../utils/browse-font'
import type {
  PreferenceRegionAnswer,
} from '../../types/assessment'
import {
  validatePreferenceAnswersV2,
} from '../../types/assessment-v2'
import type {
  ActivityPreference,
  MealSchedule,
  PreferencePriorityV2,
  PreferredCareTypeV2,
  RoomType,
} from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import {
  buildInstitutionRegionCatalog,
} from '../../services/institution-region-catalog'
import type { InstitutionRegionCatalogOption } from '../../services/institution-region-catalog'
import { institutionService } from '../../services/institution.service'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { getAssessmentBackText, navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { invalidateAssessmentPageAction, navigateAssessmentForwardWithCapacity, onHideAssessmentPhasePage, onUnloadAssessmentPhasePage, resetAssessmentPageNavigation } from '../../utils/assessment-phase-navigation'

type ChoiceOption = {
  value: string
  label: string
  description?: string
}

type RegionCatalogStatus = 'loading' | 'ready' | 'empty' | 'error'

interface AssessmentPreferenceData {
  fontStyle: string
  backEnabled: boolean
  backText: string
  warmSwissHeaderHeight: number
  careType: PreferredCareTypeV2 | ''
  roomType: RoomType | ''
  mealSchedule: MealSchedule | ''
  activityPreference: ActivityPreference | ''
  priorities: PreferencePriorityV2[]
  regionCode: string
  careTypeOptions: ChoiceOption[]
  roomTypeOptions: ChoiceOption[]
  mealScheduleOptions: ChoiceOption[]
  activityPreferenceOptions: ChoiceOption[]
  priorityOptions: ChoiceOption[]
  regionOptions: InstitutionRegionCatalogOption[]
  priorityMax: number
  regionCatalogStatus: RegionCatalogStatus
  regionCatalogVersion: string
  regionStatusMessage: string
  regionError: string
  careTypeError: string
  roomTypeError: string
  mealScheduleError: string
  activityPreferenceError: string
  prioritiesError: string
  priorityLimitMessage: string
  formError: string
  saveStatus: string
  persistenceFailed: boolean
  careTypeAnchorId: string
  roomTypeAnchorId: string
  mealScheduleAnchorId: string
  activityPreferenceAnchorId: string
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

const roomTypeOptions: ChoiceOption[] = [
  { value: 'no_preference', label: '不限制' },
  { value: 'single', label: '单人间' },
  { value: 'double', label: '双人间' },
  { value: 'triple_or_more', label: '三人及以上' },
]

const mealScheduleOptions: ChoiceOption[] = [
  { value: 'no_preference', label: '不特别要求' },
  { value: 'three_meals', label: '三餐' },
  { value: 'three_meals_one_snack', label: '三餐一点' },
  { value: 'three_meals_two_snacks', label: '三餐两点' },
]

const activityPreferenceOptions: ChoiceOption[] = [
  { value: 'no_preference', label: '不特别在意' },
  { value: 'indoor', label: '比较在意室内活动' },
  { value: 'outdoor', label: '比较在意户外活动' },
  { value: 'indoor_and_outdoor', label: '室内外活动都比较重要' },
]

const priorityOptions: ChoiceOption[] = [
  { value: 'care_capability', label: '护理能力' },
  { value: 'caregiver_quality', label: '护理人员质量' },
  { value: 'medical_conditions', label: '医疗条件' },
  { value: 'rehabilitation_capability', label: '康复条件' },
  { value: 'food_quality', label: '膳食质量' },
  { value: 'living_environment', label: '居住环境' },
  { value: 'room_facilities', label: '房间设施' },
  { value: 'activity_space', label: '活动空间' },
  { value: 'transportation', label: '交通便利' },
  { value: 'near_major_hospital', label: '靠近大型医院' },
  { value: 'price', label: '价格预算' },
  { value: 'region', label: '地理位置' },
]

const PRIORITY_CODES: readonly PreferencePriorityV2[] = priorityOptions.map(
  (option) => option.value as PreferencePriorityV2,
)

const careTypeAnchorId = getAssessmentQuestionAnchorId('preference.careType')
const roomTypeAnchorId = getAssessmentQuestionAnchorId('preference.roomType')
const mealScheduleAnchorId = getAssessmentQuestionAnchorId('preference.mealSchedule')
const activityPreferenceAnchorId = getAssessmentQuestionAnchorId('preference.activityPreference')
const prioritiesAnchorId = getAssessmentQuestionAnchorId('preference.priorities')

type DraftAnswers = ReturnType<typeof assessmentDraftStore.getDraft>['answers']

const readPriorities = (answers: DraftAnswers): PreferencePriorityV2[] => {
  const value = answers['preference.priorities']
  return Array.isArray(value) ? [...value] : []
}

const readRegionCode = (answers: DraftAnswers): string => {
  const value = answers['preference.region']
  return value && typeof value === 'object' && 'regionCode' in value ? value.regionCode : ''
}

const hasPreferenceAnswers = (answers: DraftAnswers): boolean =>
  answers['preference.careType'] !== undefined
  || answers['preference.roomType'] !== undefined
  || answers['preference.mealSchedule'] !== undefined
  || answers['preference.activityPreference'] !== undefined
  || answers['preference.priorities'] !== undefined
  || answers['preference.region'] !== undefined

const withNoPreference = (options: readonly InstitutionRegionCatalogOption[]): InstitutionRegionCatalogOption[] => [
  NO_PREFERENCE_OPTION,
  ...options.filter((option) => option.value !== NO_PREFERENCE_OPTION.value),
]

Page({
  data: {
    fontStyle: '',
    backEnabled: true,
    backText: '返回上一页',
    warmSwissHeaderHeight: 0,
    careType: '',
    roomType: '',
    mealSchedule: '',
    activityPreference: '',
    priorities: [],
    regionCode: '',
    careTypeOptions,
    roomTypeOptions,
    mealScheduleOptions,
    activityPreferenceOptions,
    priorityOptions,
    regionOptions: [],
    priorityMax: PRIORITY_MAX,
    regionCatalogStatus: 'loading',
    regionCatalogVersion: '',
    regionStatusMessage: '正在读取当前已核验合作机构的区域信息。',
    regionError: '',
    careTypeError: '',
    roomTypeError: '',
    mealScheduleError: '',
    activityPreferenceError: '',
    prioritiesError: '',
    priorityLimitMessage: '',
    formError: '',
    saveStatus: modeText('选择后会尝试保存到本机开发态草稿'),
    persistenceFailed: false,
    careTypeAnchorId,
    roomTypeAnchorId,
    mealScheduleAnchorId,
    activityPreferenceAnchorId,
    prioritiesAnchorId,
  } as AssessmentPreferenceData,

  onLoad() {
    // Match UI-0 AppHeader geometry so the first-error anchor stays visible.
    const system = wx.getSystemInfoSync()
    this.setData({
      warmSwissHeaderHeight: (system.platform === 'android' ? 48 : 44) + system.safeArea.top,
    })
  },

  onShow() {
    const fontStyle = readBrowseFontStyle()
    if (this.data.fontStyle !== fontStyle) this.setData({ fontStyle })
    resetAssessmentPageNavigation(this)
    this.setData({ backText: getAssessmentBackText('preference') })
    this.syncFromDraft()
    this.loadRegionCatalog()
  },

  onHide() {
    onHideAssessmentPhasePage(this)
  },

  onUnload() {
    onUnloadAssessmentPhasePage(this)
  },

  syncFromDraft() {
    const answers = assessmentDraftStore.getDraft().answers
    this.setData({
      careType: answers['preference.careType'] || '',
      roomType: answers['preference.roomType'] || '',
      mealSchedule: answers['preference.mealSchedule'] || '',
      activityPreference: answers['preference.activityPreference'] || '',
      priorities: readPriorities(answers),
      regionCode: readRegionCode(answers),
      careTypeError: '',
      roomTypeError: '',
      mealScheduleError: '',
      activityPreferenceError: '',
      prioritiesError: '',
      priorityLimitMessage: '',
      formError: '',
      persistenceFailed: false,
      saveStatus: hasPreferenceAnswers(answers)
        ? modeText('已从本机草稿恢复（开发态）')
        : modeText('选择后会尝试保存到本机开发态草稿'),
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
        ? modeText('已保存到本机（开发态），不会同步服务器')
        : modeText('本机保存失败，请重试；答案不会同步服务器'),
    })
  },

  onCareTypeChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: PreferredCareTypeV2 }).value
    const result = assessmentDraftStore.setAnswer('preference.careType', value)
    const answer = result.draft.answers['preference.careType'] || ''
    this.setData({ careType: answer, careTypeError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onRoomTypeChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: RoomType }).value
    const result = assessmentDraftStore.setAnswer('preference.roomType', value)
    const answer = result.draft.answers['preference.roomType'] || ''
    this.setData({ roomType: answer, roomTypeError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onMealScheduleChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: MealSchedule }).value
    const result = assessmentDraftStore.setAnswer('preference.mealSchedule', value)
    const answer = result.draft.answers['preference.mealSchedule'] || ''
    this.setData({ mealSchedule: answer, mealScheduleError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onActivityPreferenceChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: ActivityPreference }).value
    const result = assessmentDraftStore.setAnswer('preference.activityPreference', value)
    const answer = result.draft.answers['preference.activityPreference'] || ''
    this.setData({ activityPreference: answer, activityPreferenceError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onPrioritiesChange(event: WechatMiniprogram.CustomEvent) {
    const rawValues = (event.detail as { values?: unknown }).values
    const values = Array.isArray(rawValues)
      ? rawValues.filter((value): value is PreferencePriorityV2 =>
        typeof value === 'string' && PRIORITY_CODES.indexOf(value as PreferencePriorityV2) >= 0,
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
    invalidateAssessmentPageAction(this)
    navigateBackFromAssessment('preference')
  },

  onNavigationFailure() {
    wx.showToast({ title: '暂时无法返回，请重试。', icon: 'none' })
  },

  onNext() {
    const validation = validatePreferenceAnswersV2(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      careTypeError: validation.errors['preference.careType'] || '',
      roomTypeError: validation.errors['preference.roomType'] || '',
      mealScheduleError: validation.errors['preference.mealSchedule'] || '',
      activityPreferenceError: validation.errors['preference.activityPreference'] || '',
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
        formError: modeText('本机保存失败，暂时无法进入下一步，请重新选择并保存后再试'),
        saveStatus: modeText('本机保存失败，请重试；答案不会同步服务器'),
      })
      return
    }

    navigateAssessmentForwardWithCapacity(
      this,
      'preference',
      'budget',
      'preference.next',
      () => {
        const result = assessmentDraftStore.setCurrentStep('budget')
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
