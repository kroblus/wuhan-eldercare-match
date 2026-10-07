import type {
  BasicGender,
  BasicInstitutionExperience,
  BasicInstitutionExitReason,
  BasicLivingStatus,
  BasicPrimaryCaregiver,
  BasicRelationship,
} from '../../types/assessment'
import { validateBasicAnswersV2 } from '../../types/assessment-v2'
import { assessmentDraftStore } from '../../store/assessment-draft'
import type { AssessmentDraftMutationResult } from '../../store/assessment-draft'
import { getAssessmentQuestionAnchorId, scrollToAssessmentQuestion } from '../../utils/assessment-validation'
import { navigateBackFromAssessment } from '../../utils/assessment-navigation'
import { navigateToWithGuard, resetNavigationGuard } from '../../utils/navigation-guard'

type ChoiceOption = { value: string; label: string }

interface AssessmentBasicData {
  warmSwissHeaderHeight: number
  backEnabled: boolean
  relationship: BasicRelationship | ''
  elderName: string
  gender: BasicGender | ''
  ageInput: string
  livingStatus: BasicLivingStatus | ''
  primaryCaregiver: BasicPrimaryCaregiver | ''
  hasInstitutionExperience: BasicInstitutionExperience | ''
  institutionExitReasons: BasicInstitutionExitReason[]
  relationshipOptions: ChoiceOption[]
  genderOptions: ChoiceOption[]
  livingStatusOptions: ChoiceOption[]
  caregiverOptions: ChoiceOption[]
  experienceOptions: ChoiceOption[]
  exitReasonOptions: ChoiceOption[]
  relationshipAnchorId: string
  genderAnchorId: string
  ageAnchorId: string
  relationshipError: string
  genderError: string
  formError: string
  ageError: string
  saveStatus: string
}

const relationshipOptions: ChoiceOption[] = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'paternal_grandfather', label: '祖父' },
  { value: 'paternal_grandmother', label: '祖母' },
  { value: 'maternal_grandfather', label: '外祖父' },
  { value: 'maternal_grandmother', label: '外祖母' },
  { value: 'spouse', label: '配偶' },
  { value: 'self', label: '本人' },
  { value: 'other', label: '其他' },
]

const genderOptions: ChoiceOption[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]

const livingStatusOptions: ChoiceOption[] = [
  { value: 'alone', label: '独居' },
  { value: 'with_spouse', label: '与配偶同住' },
  { value: 'with_children', label: '与子女同住' },
  { value: 'with_other_relatives', label: '与其他亲属同住' },
  { value: 'hospitalized', label: '当前住院' },
  { value: 'in_eldercare_institution', label: '已入住养老机构' },
  { value: 'other', label: '其他' },
]

const caregiverOptions: ChoiceOption[] = [
  { value: 'spouse', label: '配偶' },
  { value: 'children', label: '子女' },
  { value: 'nanny', label: '保姆' },
  { value: 'care_worker', label: '护工' },
  { value: 'community_care', label: '社区照护' },
  { value: 'no_fixed_caregiver', label: '暂无固定照护者' },
  { value: 'other', label: '其他' },
]

const experienceOptions: ChoiceOption[] = [
  { value: 'true', label: '有' },
  { value: 'false', label: '没有' },
]

const exitReasonOptions: ChoiceOption[] = [
  { value: 'poor_nursing', label: '护理不理想' },
  { value: 'poor_service_attitude', label: '服务态度问题' },
  { value: 'high_cost', label: '收费较高' },
  { value: 'too_far', label: '距离太远' },
  { value: 'insufficient_medical_capability', label: '医疗能力不足' },
  { value: 'unsatisfactory_environment', label: '环境不满意' },
  { value: 'unsatisfactory_food', label: '饮食不满意' },
  { value: 'elder_not_adapted', label: '老人不适应' },
  { value: 'other', label: '其他' },
]

const relationshipAnchorId = getAssessmentQuestionAnchorId('basic.relationship')
const genderAnchorId = getAssessmentQuestionAnchorId('basic.gender')
const ageAnchorId = getAssessmentQuestionAnchorId('basic.age')

Page({
  data: {
    warmSwissHeaderHeight: 0,
    backEnabled: true,
    relationship: '',
    elderName: '',
    gender: '',
    ageInput: '',
    livingStatus: '',
    primaryCaregiver: '',
    hasInstitutionExperience: '',
    institutionExitReasons: [],
    relationshipOptions,
    genderOptions,
    livingStatusOptions,
    caregiverOptions,
    experienceOptions,
    exitReasonOptions,
    relationshipAnchorId,
    genderAnchorId,
    ageAnchorId,
    relationshipError: '',
    genderError: '',
    formError: '',
    ageError: '',
    saveStatus: '填写后会尝试保存到本机开发态草稿',
  } as AssessmentBasicData,

  onLoad() {
    // Same safe-top/header measurement as NavigationBar. Only the visual
    // anchor box changes; question IDs and the first-error scroll stay intact.
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
      relationship: answers['basic.relationship'] || '',
      elderName: answers['basic.elderName'] || '',
      gender: answers['basic.gender'] || '',
      ageInput: typeof answers['basic.age'] === 'number' ? String(answers['basic.age']) : '',
      livingStatus: answers['basic.livingStatus'] || '',
      primaryCaregiver: answers['basic.primaryCaregiver'] || '',
      hasInstitutionExperience: answers['basic.hasInstitutionExperience'] || '',
      institutionExitReasons: answers['basic.institutionExitReasons'] || [],
      relationshipError: '',
      genderError: '',
      ageError: '',
      formError: '',
      saveStatus: Object.keys(answers).length > 0
        ? '已从本机草稿恢复（开发态）'
        : '填写后会尝试保存到本机开发态草稿',
    })
  },

  applyPersistenceResult(result: AssessmentDraftMutationResult) {
    this.setData({
      saveStatus: result.persistence.ok
        ? '已保存到本机（开发态），不会同步服务器'
        : '本机保存失败，请重试；答案不会同步服务器',
    })
  },

  onRelationshipChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: BasicRelationship }).value
    const result = assessmentDraftStore.setAnswer('basic.relationship', value)
    this.setData({ relationship: value, relationshipError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onNameInput(event: WechatMiniprogram.Input) {
    const value = event.detail.value
    const result = value.trim()
      ? assessmentDraftStore.setAnswer('basic.elderName', value)
      : assessmentDraftStore.clearAnswer('basic.elderName')
    this.setData({ elderName: value })
    this.applyPersistenceResult(result)
  },

  onGenderChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: BasicGender }).value
    const result = assessmentDraftStore.setAnswer('basic.gender', value)
    this.setData({ gender: value, genderError: '', formError: '' })
    this.applyPersistenceResult(result)
  },

  onAgeInput(event: WechatMiniprogram.Input) {
    const value = event.detail.value
    const isIntegerText = /^\d+$/.test(value)
    const age = Number(value)
    const isValidAge = isIntegerText && Number.isInteger(age) && age >= 50 && age <= 110
    if (isValidAge) {
      const result = assessmentDraftStore.setAnswer('basic.age', age)
      this.setData({ ageInput: value, ageError: '', formError: '' })
      this.applyPersistenceResult(result)
    } else {
      const result = assessmentDraftStore.clearAnswer('basic.age')
      this.setData({ ageInput: value, ageError: value ? '请输入 50–110 岁的整数' : '', formError: '' })
      this.applyPersistenceResult(result)
    }
  },

  onLivingStatusChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: BasicLivingStatus }).value
    const result = assessmentDraftStore.setAnswer('basic.livingStatus', value)
    this.setData({ livingStatus: value })
    this.applyPersistenceResult(result)
  },

  onCaregiverChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: BasicPrimaryCaregiver }).value
    const result = assessmentDraftStore.setAnswer('basic.primaryCaregiver', value)
    this.setData({ primaryCaregiver: value })
    this.applyPersistenceResult(result)
  },

  onExperienceChange(event: WechatMiniprogram.CustomEvent) {
    const value = (event.detail as { value: BasicInstitutionExperience }).value
    const result = assessmentDraftStore.setAnswer('basic.hasInstitutionExperience', value)
    const answers = result.draft.answers
    this.setData({
      hasInstitutionExperience: answers['basic.hasInstitutionExperience'] || '',
      institutionExitReasons: answers['basic.institutionExitReasons'] || [],
    })
    this.applyPersistenceResult(result)
  },

  onExitReasonChange(event: WechatMiniprogram.CustomEvent) {
    const values = (event.detail as { values: BasicInstitutionExitReason[] }).values
    const result = values.length > 0
      ? assessmentDraftStore.setAnswer('basic.institutionExitReasons', values)
      : assessmentDraftStore.clearAnswer('basic.institutionExitReasons')
    this.setData({ institutionExitReasons: values })
    this.applyPersistenceResult(result)
  },

  onBack() {
    navigateBackFromAssessment('basic')
  },

  onNext() {
    const validation = validateBasicAnswersV2(assessmentDraftStore.getDraft().answers)
    const firstErrorQuestionId = validation.firstErrorQuestionId
    this.setData({
      relationshipError: validation.errors['basic.relationship'] || '',
      genderError: validation.errors['basic.gender'] || '',
      ageError: validation.errors['basic.age'] || '',
      formError: '',
    }, () => {
      if (!validation.valid && firstErrorQuestionId) {
        scrollToAssessmentQuestion(firstErrorQuestionId)
      }
    })
    if (!validation.valid) {
      return
    }
    const result = assessmentDraftStore.setCurrentStep('health')
    if (!result.persistence.ok) {
      this.setData({
        formError: '本机保存失败，暂时无法进入下一步，请重试',
        saveStatus: '本机保存失败，请重试；答案不会同步服务器',
      })
      return
    }
    navigateToWithGuard(this, 'basic.next', '/pages/assessment/health')
  },
})
