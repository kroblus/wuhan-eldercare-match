import type { AssessmentQuestionIdV2 } from '../../types/assessment-v2'
import type { DerivedFact, RehabilitationRequirement } from '../../types/elder-profile'
import type {
  ElderProfilePreviewV2,
  ProfileClarificationV2,
} from '../../types/elder-profile-v2'
import type {
  ProfileClarificationViewModel,
  ProfileDisplayRow,
  ProfileEditSection,
  ProfilePageViewModel,
  ProfileTagViewModel,
} from './profile-view-model'

export interface ProfileAdvisoryViewModelV2 {
  code: 'HIGH_CARE_LOW_BUDGET'
  text: string
  tone: 'warning'
}

export interface ProfilePageViewModelV2 extends Omit<ProfilePageViewModel, 'healthRows' | 'preferenceRows' | 'financialRows'> {
  healthRows: readonly ProfileDisplayRow[]
  nutritionRows: readonly ProfileDisplayRow[]
  preferenceRows: readonly ProfileDisplayRow[]
  financialRows: readonly ProfileDisplayRow[]
  budgetAdvisory?: ProfileAdvisoryViewModelV2
  actions: {
    canOpenRecommendation: boolean
    editTargets: Readonly<Record<ProfileEditSection, string>>
  }
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: '父亲',
  mother: '母亲',
  paternal_grandfather: '祖父',
  paternal_grandmother: '祖母',
  maternal_grandfather: '外祖父',
  maternal_grandmother: '外祖母',
  spouse: '配偶',
  self: '本人',
  other: '其他',
}

const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
}

const LIVING_STATUS_LABELS: Record<string, string> = {
  alone: '独居',
  with_spouse: '与配偶同住',
  with_children: '与子女同住',
  with_other_relatives: '与其他亲属同住',
  hospitalized: '当前住院',
  in_eldercare_institution: '已入住养老机构',
  other: '其他',
}

const CAREGIVER_LABELS: Record<string, string> = {
  spouse: '配偶',
  children: '子女',
  nanny: '保姆',
  care_worker: '护工',
  community_care: '社区照护',
  no_fixed_caregiver: '暂无固定照护者',
  other: '其他',
}

const HEALTH_CONDITION_LABELS: Record<string, string> = {
  hypertension: '高血压',
  diabetes: '糖尿病',
  coronary_heart_disease: '冠心病',
  stroke_sequelae: '脑卒中后遗症',
  parkinson_disease: '帕金森',
  alzheimers_disease: '阿尔茨海默症（用户已报告）',
  other_cognitive_impairment: '其他认知障碍（用户已报告）',
  chronic_respiratory_disease: '慢性呼吸疾病',
  osteoarticular_disease: '骨关节疾病',
  tumor: '肿瘤',
  other_chronic_disease: '其他慢性疾病',
  none: '暂无明显慢性疾病',
  unknown: '暂不清楚',
}

const RECENT_EVENT_LABELS: Record<string, string> = {
  fall_within_6_months: '近半年发生过跌倒',
  fracture_within_6_months: '近半年发生过骨折',
  frequent_hospitalization_within_6_months: '近半年频繁住院',
  recently_discharged: '近期刚出院',
  postoperative_recovery: '术后恢复中',
  long_term_bedridden: '长期卧床',
  pressure_injury: '存在压疮',
  none: '以上均无',
  unknown: '暂不清楚',
}

const CARE_LEVEL_LABELS: Record<string, string> = {
  independent: '自理',
  light_care: '轻度照护',
  semi_disabled: '半失能',
  disabled: '失能',
  severely_disabled: '重度失能',
}

const MOBILITY_LABELS: Record<string, string> = {
  independent: '可独立行走',
  walking_aid: '需要拐杖或助行器',
  wheelchair: '轮椅辅助',
  bedbound: '基本无法下床',
}

const EATING_LABELS: Record<string, string> = {
  independent: '可以完全独立进食',
  minor_assistance: '需要少量协助',
  needs_feeding: '需要他人喂饭',
  special_feeding: '特殊进食方式 · 具体情况待确认',
  unknown: '暂不确定',
}

const MOBILITY_ANSWER_LABELS: Record<string, string> = {
  independent: '可以独立行走',
  walking_aid: '需要拐杖或助行器',
  wheelchair: '需要轮椅辅助',
  bedridden: '基本无法下床',
  unknown: '暂不确定',
}

const TOILETING_LABELS: Record<string, string> = {
  independent: '可以完全自主完成',
  occasional_assistance: '偶尔需要帮助',
  frequent_incontinence: '经常失禁',
  full_assistance: '完全需要他人照护',
  catheter_or_stoma: '导尿/造瘘情况 · 具体护理需求待确认',
  unknown: '暂不确定',
}

const ASSISTANCE_LABELS: Record<string, string> = {
  independent: '完全自主',
  partial_assistance: '需要部分协助',
  full_assistance: '完全需要他人协助',
  unknown: '暂不确定',
}

const TRANSFER_LABELS: Record<string, string> = {
  independent: '可以独立完成',
  minor_assistance: '需要少量协助',
  needs_support: '需要搀扶或支持',
  fully_dependent: '完全依赖他人',
  unknown: '暂不确定',
}

const STAIRS_LABELS: Record<string, string> = {
  independent: '可以独立上下楼',
  needs_assistance: '上下楼需要帮助',
  unable: '无法上下楼',
  no_stairs: '当前生活环境无楼梯',
  unknown: '暂不确定',
}

const CARE_MODE_LABELS: Record<string, string> = {
  feeding_minor: '进食时需要少量协助',
  feeding_dependence: '进食依赖他人',
  special_feeding_review: '特殊进食方式 · 具体情况待确认',
  walking_aid: '助行器或拐杖辅助',
  wheelchair: '轮椅辅助',
  bedridden: '长期卧床照护',
  toileting_minor: '如厕时需要少量协助',
  incontinence: '失禁照护情况',
  toileting_full_assistance: '如厕完全需要协助',
  catheter_or_stoma_review: '导尿/造瘘情况 · 具体护理需求待确认',
  bathing_partial: '洗澡需要部分协助',
  bathing_full_assistance: '洗澡完全需要协助',
  dressing_partial: '穿衣需要部分协助',
  dressing_full_assistance: '穿衣完全需要协助',
  transfer_minor: '床椅转移需要少量协助',
  transfer_support: '床椅转移需要搀扶',
  fully_dependent_transfer: '床椅转移完全依赖他人',
  stairs_assistance: '上下楼需要帮助',
  stairs_unable: '无法上下楼',
  no_stairs_context: '当前生活环境无楼梯',
}

const COGNITIVE_SYMPTOM_LABELS: Record<string, string> = {
  memory_decline: '记忆力明显下降',
  repetitive_questioning: '经常重复询问',
  gets_lost: '容易迷路',
  wandering_risk: '有走失风险',
  sleep_wake_disorder: '昼夜作息混乱',
  mood_instability: '情绪波动明显',
  agitation: '容易躁动',
  aggression: '有攻击行为',
  diagnosed_dementia: '已报告认知症诊断',
  none: '无以上情况',
  unknown: '暂不确定',
}

const CARE_CAPABILITY_LABELS: Record<string, string> = {
  round_the_clock_care: '24 小时照护',
  one_to_one_caregiver: '一对一护工',
  night_care: '夜间重点照护',
  dementia_unit: '认知症专区',
  rehabilitation_training: '康复训练',
  tube_feeding: '鼻饲护理',
  catheter_care: '导尿护理',
  pressure_injury_care: '压疮护理',
  incontinence_care: '失禁护理',
}

const PREFERRED_CARE_TYPE_LABELS: Record<string, string> = {
  active_aging: '活力型养老',
  medical_nursing_integrated: '医养结合',
  disability_care: '失能护理',
  dementia_care: '认知症照护',
  rehabilitation_care: '康复养老',
  unknown: '暂不确定',
}

const ROOM_LABELS: Record<string, string> = {
  no_preference: '暂无限定',
  single: '单人间',
  double: '双人间',
  triple_or_more: '多人间',
}

const MEAL_LABELS: Record<string, string> = {
  no_preference: '暂无限定',
  three_meals: '一日三餐',
  three_meals_one_snack: '一日三餐加一次加餐',
  three_meals_two_snacks: '一日三餐加两次加餐',
}

const ACTIVITY_LABELS: Record<string, string> = {
  no_preference: '暂无限定',
  indoor: '室内活动',
  outdoor: '室外活动',
  indoor_and_outdoor: '室内外活动',
}

const PRIORITY_LABELS: Record<string, string> = {
  care_capability: '照护能力',
  caregiver_quality: '护理人员质量',
  medical_conditions: '医疗条件',
  rehabilitation_capability: '康复能力',
  food_quality: '餐饮质量',
  living_environment: '居住环境',
  room_facilities: '房间设施',
  activity_space: '活动空间',
  transportation: '交通方便',
  near_major_hospital: '距离大型医院近',
  price: '价格',
  region: '区域',
}

const MONTHLY_RANGE_LABELS: Record<string, string> = {
  cny_3500_5000: '3500–5000 元/月',
  cny_5000_8000: '5000–8000 元/月',
  cny_8000_12000: '8000–12000 元/月',
  cny_12000_15000: '12000–15000 元/月',
  cny_15000_plus: '15000 元以上/月',
  unknown: '暂不确定',
}

const UPFRONT_COST_LABELS: Record<string, string> = {
  acceptable: '可以接受',
  depends_on_amount: '视具体金额而定',
  avoid_high_one_time_fee: '不希望较高一次性费用',
  unknown: '暂不清楚',
}

const MOVE_IN_TIMING_LABELS: Record<string, string> = {
  as_soon_as_possible: '希望尽快入住',
  within_1_month: '1 个月以内',
  within_1_to_3_months: '1–3 个月',
  after_3_months: '3 个月以后',
  research_only: '目前只是提前了解',
}

const CONSULTANT_INTENT_LABELS: Record<string, string> = {
  request_contact: '希望顾问后续协助（仅记录意向，尚未发起联系）',
  recommendation_first: '先查看推荐结果',
}

const QUESTION_LABELS: Record<string, string> = {
  'health.conditions': '慢性疾病情况',
  'health.recentEvents': '近期健康风险',
  'health.rehabilitationNeed': '康复需求',
  'health.chewingAbility': '咀嚼情况',
  'health.swallowingAbility': '吞咽情况',
  'adl.eating': '进食能力',
  'adl.mobility': '行走能力',
  'adl.toileting': '如厕能力',
  'adl.bathing': '洗澡能力',
  'adl.dressing': '穿衣能力',
  'adl.transfer': '起床与床椅转移',
  'adl.stairs': '上下楼能力',
  'cognitive.symptoms': '认知与精神状态',
  'cognitive.specialCareNeeds': '特殊护理需求',
  'preference.careType': '养老机构类型',
  'preference.roomType': '房型偏好',
  'preference.mealSchedule': '餐次偏好',
  'preference.activityPreference': '活动偏好',
  'preference.priorities': '关注重点',
  'preference.region': '区域偏好',
  'budget.monthlyRange': '月度预算',
  'budget.upfrontCostAcceptance': '一次性费用接受度',
}

const EDIT_LABELS: Record<ProfileEditSection, string> = {
  basic: '修改基本情况',
  health: '修改健康情况',
  adl: '修改生活能力',
  cognitive: '修改认知与护理',
  preference: '修改养老偏好',
  budget: '修改预算计划',
}

const EDIT_ROUTES: Readonly<Record<ProfileEditSection, string>> = {
  basic: '/pages/assessment/basic',
  health: '/pages/assessment/health',
  adl: '/pages/assessment/adl',
  cognitive: '/pages/assessment/cognitive',
  preference: '/pages/assessment/preference',
  budget: '/pages/assessment/budget',
}

const row = (
  label: string,
  value: string,
  tone: ProfileDisplayRow['tone'] = 'normal',
): ProfileDisplayRow => ({ label, value, tone })

const valueLabel = (value: string, labels: Record<string, string>, fallback = '暂不确定'): string =>
  labels[value] || fallback

const mapValues = (values: readonly string[], labels: Record<string, string>): string =>
  values.map((value) => valueLabel(value, labels)).join('、')

const buildOverviewTags = (preview: ElderProfilePreviewV2): ProfileTagViewModel[] => {
  const tags: ProfileTagViewModel[] = []
  const careLevel = preview.adl.derivedFacts.careLevel
  tags.push(careLevel.status === 'known'
    ? { text: valueLabel(careLevel.value, CARE_LEVEL_LABELS), tone: 'brand' }
    : { text: '自理能力待确认', tone: 'warning' })

  const mobility = preview.mobility.derivedFacts.level
  tags.push(mobility.status === 'known'
    ? { text: valueLabel(mobility.value, MOBILITY_LABELS), tone: 'neutral' }
    : { text: '行动能力待确认', tone: 'warning' })

  const rehabilitation = preview.health.derivedFacts.rehabilitationNeed
  if (rehabilitation.status === 'known' && rehabilitation.value === 'required') {
    tags.push({ text: '有康复需求', tone: 'brand' })
  } else if (rehabilitation.status === 'known' && rehabilitation.value === 'possible') {
    tags.push({ text: '可能需要康复', tone: 'warning' })
  }

  const cognition = preview.cognition.derivedFacts.cognitiveConcern
  if (cognition.status === 'known' && cognition.value === 'present') {
    tags.push({ text: '已报告认知相关情况', tone: 'warning' })
  } else if (cognition.status !== 'known') {
    tags.push({ text: '认知情况待确认', tone: 'warning' })
  }

  preview.specialCare.derivedFacts.requiredCareCapabilities.forEach((capability) => {
    if (tags.length >= 5 || capability.status !== 'required') return
    const label = CARE_CAPABILITY_LABELS[capability.capability]
    if (label) tags.push({ text: label, tone: 'brand' })
  })
  return tags
}

const buildBasicRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const facts = preview.basic.rawFacts
  const rows: ProfileDisplayRow[] = [
    row('与您的关系', valueLabel(facts.relation, RELATIONSHIP_LABELS)),
    row('性别与年龄', `${valueLabel(facts.sex, GENDER_LABELS)} · ${facts.age} 岁`),
  ]
  if (facts.livingStatus !== undefined) {
    rows.push(row('目前居住状态', valueLabel(facts.livingStatus, LIVING_STATUS_LABELS)))
  }
  if (facts.primaryCaregiver !== undefined) {
    rows.push(row('主要照护者', valueLabel(facts.primaryCaregiver, CAREGIVER_LABELS)))
  }
  return rows
}

const rehabilitationText = (fact: DerivedFact<RehabilitationRequirement>): ProfileDisplayRow => {
  if (fact.status !== 'known') return row('康复需求', '仍需进一步确认', 'attention')
  const labels: Record<string, string> = {
    required: '明确需要康复支持',
    possible: '可能需要康复支持',
    not_required: '本次明确选择不需要康复支持',
  }
  return row('康复需求', valueLabel(fact.value, labels))
}

const buildHealthRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const facts = preview.health.rawFacts
  const rows: ProfileDisplayRow[] = []
  if (facts.reportedDiseases.indexOf('none') >= 0) {
    rows.push(row('已报告健康情况', '本次明确选择暂无明显慢性疾病', 'muted'))
  } else if (facts.reportedDiseases.indexOf('unknown') >= 0) {
    rows.push(row('已报告健康情况', '慢性疾病情况暂不清楚', 'attention'))
  } else {
    rows.push(row('已报告健康情况', mapValues(facts.reportedDiseases, HEALTH_CONDITION_LABELS)))
  }
  if (facts.recentHealthRisks.indexOf('none') >= 0) {
    rows.push(row('近期健康风险', '本次明确选择以上均无', 'muted'))
  } else if (facts.recentHealthRisks.indexOf('unknown') >= 0) {
    rows.push(row('近期健康风险', '近期情况暂不清楚', 'attention'))
  } else {
    rows.push(row('近期健康风险', mapValues(facts.recentHealthRisks, RECENT_EVENT_LABELS)))
  }
  rows.push(rehabilitationText(preview.health.derivedFacts.rehabilitationNeed))
  return rows
}

const buildNutritionRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const raw = preview.nutrition.rawFacts
  const derived = preview.nutrition.derivedFacts
  const rows: ProfileDisplayRow[] = []
  const foodTexture = derived.foodTextureSupport
  if (foodTexture.status === 'known') {
    const textureLabels: Record<string, string> = {
      standard: '咀嚼情况正常',
      easy_chew: '更适合软食、易咀嚼食物',
      modified_food: '需要特殊处理的饮食形式',
    }
    rows.push(row('饮食适配', valueLabel(foodTexture.value, textureLabels)))
  } else {
    rows.push(row('饮食适配', raw.chewingAbilityAnswer === 'unknown' ? '咀嚼情况仍需确认' : '饮食适配情况仍需确认', 'attention'))
  }

  const swallowing = derived.swallowingConcern
  if (swallowing.status === 'known' && swallowing.value === 'normal') {
    rows.push(row('吞咽情况', '吞咽情况正常'))
  } else if (swallowing.status === 'needs_confirmation') {
    rows.push(row('吞咽情况', '吞咽情况需要进一步确认', 'attention'))
  } else {
    rows.push(row('吞咽情况', '吞咽情况仍需确认', 'attention'))
  }
  return rows
}

const buildDailyRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const answers = preview.adl.rawAnswers
  const careLevel = preview.adl.derivedFacts.careLevel
  const mobility = preview.mobility.derivedFacts.level
  const rows: ProfileDisplayRow[] = [
    careLevel.status === 'known'
      ? row('照护等级', valueLabel(careLevel.value, CARE_LEVEL_LABELS))
      : row('照护等级', '自理能力等级暂无法确定', 'attention'),
    mobility.status === 'known'
      ? row('行动方式', valueLabel(mobility.value, MOBILITY_LABELS))
      : row('行动方式', '行动能力暂无法确定', 'attention'),
    row('进食', valueLabel(answers.eating, EATING_LABELS), answers.eating === 'unknown' || answers.eating === 'special_feeding' ? 'attention' : 'normal'),
    row('行走', valueLabel(answers.mobility, MOBILITY_ANSWER_LABELS), answers.mobility === 'unknown' ? 'attention' : 'normal'),
    row('如厕', valueLabel(answers.toileting, TOILETING_LABELS), answers.toileting === 'unknown' || answers.toileting === 'catheter_or_stoma' ? 'attention' : 'normal'),
    row('洗澡', valueLabel(answers.bathing, ASSISTANCE_LABELS), answers.bathing === 'unknown' ? 'attention' : 'normal'),
    row('穿衣', valueLabel(answers.dressing, ASSISTANCE_LABELS), answers.dressing === 'unknown' ? 'attention' : 'normal'),
    row('床椅转移', valueLabel(answers.transfer, TRANSFER_LABELS), answers.transfer === 'unknown' ? 'attention' : 'normal'),
    row('上下楼', valueLabel(answers.stairs, STAIRS_LABELS), answers.stairs === 'unknown' ? 'attention' : 'normal'),
  ]
  return rows
}

const buildCareModeTags = (preview: ElderProfilePreviewV2): ProfileTagViewModel[] =>
  preview.adl.derivedFacts.careModes.map((mode) => ({
    text: CARE_MODE_LABELS[mode.code] || '照护方式待确认',
    tone: mode.status === 'needs_confirmation' ? 'warning' : 'neutral',
  }))

const buildCognitionRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const symptoms = preview.cognition.rawFacts.reportedSymptoms
  const derived = preview.cognition.derivedFacts
  const rows: ProfileDisplayRow[] = []
  if (symptoms.indexOf('none') >= 0 && derived.cognitiveConcern.status === 'known') {
    rows.push(row('评估中了解到', '本次明确选择无以上认知与精神情况', 'muted'))
  } else if (symptoms.indexOf('none') >= 0) {
    rows.push(row('评估中了解到', '相关回答存在需要进一步核对的信息', 'attention'))
  } else if (symptoms.indexOf('unknown') >= 0) {
    rows.push(row('评估中了解到', '认知与精神状态暂不确定', 'attention'))
  } else {
    rows.push(row('评估中了解到', mapValues(symptoms, COGNITIVE_SYMPTOM_LABELS)))
  }
  if (derived.reportedDiagnosis.status === 'known' && derived.reportedDiagnosis.value === 'reported') {
    rows.push(row('认知症诊断', '用户已报告相关诊断；此处不是系统医学诊断'))
  }
  if (derived.wanderingRisk.status === 'known' && derived.wanderingRisk.value === 'present') {
    rows.push(row('走失风险', '评估中已报告走失相关风险', 'attention'))
  } else if (derived.wanderingRisk.status === 'needs_confirmation') {
    rows.push(row('走失风险', '已报告容易迷路，是否存在走失风险仍需确认', 'attention'))
  }
  if (derived.behavioralRisk.status === 'known' && derived.behavioralRisk.value === 'present') {
    rows.push(row('行为情况', '评估中已报告躁动或攻击行为', 'attention'))
  } else if (derived.behavioralRisk.status === 'needs_confirmation') {
    rows.push(row('行为情况', '已报告情绪波动，相关行为情况仍需确认', 'attention'))
  }
  if (derived.sleepCycleIssue.status === 'known' && derived.sleepCycleIssue.value === 'present') {
    rows.push(row('昼夜作息', '评估中已报告昼夜作息混乱', 'attention'))
  }
  if (derived.cognitiveConcern.status !== 'known') {
    rows.push(row('认知情况总结', '相关答案仍需进一步确认', 'attention'))
  }
  return rows
}

const buildSpecialCareTags = (preview: ElderProfilePreviewV2): ProfileTagViewModel[] => {
  const tags: ProfileTagViewModel[] = []
  preview.specialCare.derivedFacts.requiredCareCapabilities.forEach((item) => {
    const label = CARE_CAPABILITY_LABELS[item.capability]
    if (!label) return
    if (item.status === 'required') {
      tags.push({ text: label, tone: 'brand' })
    } else if (item.status === 'needs_confirmation' && item.capability !== 'tube_feeding' && item.capability !== 'catheter_care') {
      tags.push({ text: `${label}需求待确认`, tone: 'warning' })
    }
  })
  return tags
}

const specialCareNote = (preview: ElderProfilePreviewV2): string => {
  const answers = preview.specialCare.rawFacts.answers
  if (answers.indexOf('none') >= 0) {
    const needsConfirmation = preview.specialCare.derivedFacts.requiredCareCapabilities.some(
      (item) => item.status === 'needs_confirmation' || item.status === 'unknown',
    )
    return needsConfirmation
      ? '本次问卷选择了无以上特殊护理需求，但部分相关情况仍需结合提示确认。'
      : '本次明确选择无以上特殊护理需求。'
  }
  if (answers.indexOf('unknown') >= 0) return '特殊护理需求暂不确定，相关内容不会被当作确定事实。'
  return ''
}

const regionText = (preview: ElderProfilePreviewV2): string => {
  const region = preview.preference.rawFacts.regionPreference
  if (region === undefined || region.kind === 'no_preference') return '不限区域'
  return region.regionLabelSnapshot
}

const buildPreferenceRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => {
  const facts = preview.preference.rawFacts
  const rows: ProfileDisplayRow[] = [
    row('机构类型', valueLabel(facts.preferredInstitutionType, PREFERRED_CARE_TYPE_LABELS)),
    row('房型偏好', valueLabel(facts.roomTypePreference, ROOM_LABELS)),
    row('餐次偏好', valueLabel(facts.mealSchedulePreference, MEAL_LABELS)),
    row('活动偏好', valueLabel(facts.activityPreference, ACTIVITY_LABELS)),
    row('区域偏好', regionText(preview)),
  ]
  if (facts.priorities.length > 0) {
    rows.push(row('关注重点', facts.priorities.map((priority) => valueLabel(priority, PRIORITY_LABELS)).join('、')))
  }
  return rows
}

const buildFinancialRows = (preview: ElderProfilePreviewV2): ProfileDisplayRow[] => [
  row('月度预算', valueLabel(preview.financial.rawFacts.monthlyBudget, MONTHLY_RANGE_LABELS)),
  row('一次性费用接受度', valueLabel(preview.financial.rawFacts.depositTolerance, UPFRONT_COST_LABELS)),
  row('入住计划', valueLabel(preview.intent.rawFacts.moveInTiming, MOVE_IN_TIMING_LABELS)),
  row('顾问协助意向', valueLabel(preview.intent.rawFacts.consultantIntent, CONSULTANT_INTENT_LABELS)),
]

const questionIdFromClarification = (clarification: ProfileClarificationV2): AssessmentQuestionIdV2 | undefined => {
  for (let index = 0; index < clarification.sources.length; index += 1) {
    const source = clarification.sources[index] as unknown as Record<string, unknown>
    if (typeof source.sourceQuestionId === 'string') {
      return source.sourceQuestionId as AssessmentQuestionIdV2
    }
  }
  return undefined
}

const editSectionForQuestion = (questionId: AssessmentQuestionIdV2 | undefined): ProfileEditSection => {
  if (questionId === undefined) return 'health'
  const step = questionId.split('.')[0]
  if (step === 'basic' || step === 'health' || step === 'adl' || step === 'cognitive' || step === 'preference' || step === 'budget') {
    return step
  }
  return 'health'
}

const clarificationText = (clarification: ProfileClarificationV2): string => {
  const questionId = questionIdFromClarification(clarification)
  const questionLabel = questionId === undefined ? '相关信息' : (QUESTION_LABELS[questionId] || '相关信息')
  if (questionId === 'health.swallowingAbility') return '吞咽情况需要进一步确认，暂不形成确定结论。'
  if (clarification.reasonCode === 'unknown_answer') return `${questionLabel}暂不确定，请补充或确认。`
  if (clarification.reasonCode === 'risk_signal_needs_confirmation') return `${questionLabel}存在需要进一步确认的情况。`
  if (clarification.reasonCode === 'non_ordinal_adl_answer') return `${questionLabel}需要结合实际照护情况进一步确认。`
  if (clarification.reasonCode === 'cross_answer_conflict') return '健康情况与认知问卷的相关回答不一致，请重新确认。'
  return `${questionLabel}仍需补充或确认。`
}

const buildClarifications = (preview: ElderProfilePreviewV2): ProfileClarificationViewModel[] =>
  preview.clarifications.map((clarification) => {
    const questionId = questionIdFromClarification(clarification)
    const editSection = editSectionForQuestion(questionId)
    const priorityLabel = clarification.priority === 'required_before_hard_filter'
      ? '优先确认'
      : clarification.priority === 'required_before_classification'
        ? '建议先确认'
        : '提示'
    return {
      text: clarificationText(clarification),
      priorityLabel,
      tone: clarification.priority === 'required_before_hard_filter' || clarification.priority === 'required_before_classification'
        ? 'important'
        : 'normal',
      editSection,
      editLabel: EDIT_LABELS[editSection],
      errorKey: `clarification-${questionId || editSection}`,
    }
  })

const budgetAdvisory = (preview: ElderProfilePreviewV2): ProfileAdvisoryViewModelV2 | undefined => {
  if (preview.financial.derivedFacts.budgetAdvisories.length === 0) return undefined
  return {
    code: 'HIGH_CARE_LOW_BUDGET',
    text: '实际费用可能受护理等级、特殊护理和房型影响，建议预留一定预算空间。',
    tone: 'warning',
  }
}

export const createProfilePageViewModelV2 = (
  preview: ElderProfilePreviewV2,
): ProfilePageViewModelV2 => {
  const facts = preview.basic.rawFacts
  const relationship = valueLabel(facts.relation, RELATIONSHIP_LABELS)
  const displayName = facts.name ? facts.name : relationship
  return {
    headline: `${displayName} · ${facts.age} 岁`,
    relationshipLine: facts.name ? `与您的关系：${relationship}` : '根据本次评估生成',
    overviewTags: buildOverviewTags(preview),
    basicRows: buildBasicRows(preview),
    healthRows: buildHealthRows(preview),
    nutritionRows: buildNutritionRows(preview),
    dailyRows: buildDailyRows(preview),
    careModeTags: buildCareModeTags(preview),
    careLevelNote: '照护等级基于本次生活能力问卷生成，不是医学诊断、官方失能鉴定或长护险等级。',
    cognitionRows: buildCognitionRows(preview),
    specialCareTags: buildSpecialCareTags(preview),
    specialCareNote: specialCareNote(preview),
    clarifications: buildClarifications(preview),
    preferenceRows: buildPreferenceRows(preview),
    financialRows: buildFinancialRows(preview),
    budgetAdvisory: budgetAdvisory(preview),
    actions: {
      canOpenRecommendation: true,
      editTargets: EDIT_ROUTES,
    },
  }
}
