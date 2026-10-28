import type {
  AdlAssistance,
  AdlEating,
  AdlToileting,
  AssessmentQuestionId,
  BasicGender,
  BasicLivingStatus,
  BasicPrimaryCaregiver,
  BasicRelationship,
  CognitiveSymptom,
  ConsultantSupport,
  HealthCondition,
  HealthRecentEvent,
  MonthlyRange,
  MoveInTiming,
  PreferencePriority,
  PreferredCareType,
  UpfrontCostAcceptance,
} from '../../types/assessment'
import type {
  AdlCareLevel,
  AdlCareModeCode,
  CareCapabilityCode,
  ClarificationPriority,
  ElderProfilePreview,
  MobilityLevel,
  ProfileClarification,
  ProfileSummaryCode,
  RehabilitationRequirement,
} from '../../types/elder-profile'

export type ProfileEditSection =
  | 'basic'
  | 'health'
  | 'adl'
  | 'cognitive'
  | 'preference'
  | 'budget'

export interface ProfileDisplayRow {
  label: string
  value: string
  tone: 'normal' | 'muted' | 'attention'
}

export interface ProfileTagViewModel {
  text: string
  tone: 'brand' | 'neutral' | 'warning'
}

export interface ProfileClarificationViewModel {
  text: string
  priorityLabel: string
  tone: 'important' | 'normal'
  editSection: ProfileEditSection
  editLabel: string
  errorKey: string
}

export interface ProfilePageViewModel {
  headline: string
  relationshipLine: string
  overviewTags: ProfileTagViewModel[]
  basicRows: ProfileDisplayRow[]
  healthRows: ProfileDisplayRow[]
  dailyRows: ProfileDisplayRow[]
  careModeTags: ProfileTagViewModel[]
  careLevelNote: string
  cognitionRows: ProfileDisplayRow[]
  specialCareTags: ProfileTagViewModel[]
  specialCareNote: string
  clarifications: ProfileClarificationViewModel[]
  preferenceRows: ProfileDisplayRow[]
  financialRows: ProfileDisplayRow[]
}

const RELATIONSHIP_LABELS: Record<BasicRelationship, string> = {
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

const GENDER_LABELS: Record<BasicGender, string> = {
  male: '男',
  female: '女',
}

const LIVING_STATUS_LABELS: Record<BasicLivingStatus, string> = {
  alone: '独居',
  with_spouse: '与配偶同住',
  with_children: '与子女同住',
  with_other_relatives: '与其他亲属同住',
  hospitalized: '当前住院',
  in_eldercare_institution: '已入住养老机构',
  other: '其他',
}

const CAREGIVER_LABELS: Record<BasicPrimaryCaregiver, string> = {
  spouse: '配偶',
  children: '子女',
  nanny: '保姆',
  care_worker: '护工',
  community_care: '社区照护',
  no_fixed_caregiver: '暂无固定照护者',
  other: '其他',
}

const HEALTH_CONDITION_LABELS: Record<HealthCondition, string> = {
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

const RECENT_EVENT_LABELS: Record<HealthRecentEvent, string> = {
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

const CARE_LEVEL_LABELS: Record<AdlCareLevel, string> = {
  independent: '自理',
  light_care: '轻度照护',
  semi_disabled: '半失能',
  disabled: '失能',
  severely_disabled: '重度失能',
}

const MOBILITY_LABELS: Record<MobilityLevel, string> = {
  independent: '可独立行走',
  walking_aid: '需要拐杖或助行器',
  wheelchair: '轮椅辅助',
  bedbound: '基本无法下床',
}

const EATING_LABELS: Record<AdlEating, string> = {
  independent: '可以完全独立进食',
  minor_assistance: '需要少量协助',
  needs_feeding: '需要他人喂饭',
  special_feeding: '特殊进食方式 · 具体情况待确认',
  unknown: '暂不确定',
}

const TOILETING_LABELS: Record<AdlToileting, string> = {
  independent: '可以完全自主完成',
  occasional_assistance: '偶尔需要帮助',
  frequent_incontinence: '经常失禁',
  full_assistance: '完全需要他人照护',
  catheter_or_stoma: '导尿/造瘘情况 · 具体护理需求待确认',
  unknown: '暂不确定',
}

const ASSISTANCE_LABELS: Record<AdlAssistance, string> = {
  independent: '完全自主',
  partial_assistance: '需要部分协助',
  full_assistance: '完全需要他人协助',
  unknown: '暂不确定',
}

const CARE_MODE_LABELS: Record<AdlCareModeCode, string> = {
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

const COGNITIVE_SYMPTOM_LABELS: Record<CognitiveSymptom, string> = {
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

const CARE_CAPABILITY_LABELS: Record<CareCapabilityCode, string> = {
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

const PREFERRED_CARE_TYPE_LABELS: Record<PreferredCareType, string> = {
  active_aging: '活力型养老',
  medical_nursing_integrated: '医养结合',
  disability_care: '失能护理',
  dementia_care: '认知症照护',
  rehabilitation_care: '康复养老',
  unknown: '暂不确定',
}

const PRIORITY_LABELS: Record<PreferencePriority, string> = {
  medical_conditions: '医疗条件',
  nursing_professionalism: '护理专业程度',
  caregiver_attitude: '护理人员态度',
  rehabilitation_capability: '康复能力',
  food_quality: '餐饮质量',
  living_environment: '居住环境',
  overall_quality: '整体品质',
  recreational_activities: '文娱活动',
  close_to_family: '距离家人近',
  transportation: '交通方便',
  price: '价格',
  dementia_care: '认知症照护能力',
}

const MONTHLY_RANGE_LABELS: Record<MonthlyRange, string> = {
  cny_3500_5000: '3500–5000 元/月',
  cny_5000_8000: '5000–8000 元/月',
  cny_8000_12000: '8000–12000 元/月',
  cny_12000_15000: '12000–15000 元/月',
  cny_15000_plus: '15000 元以上/月',
  unknown: '暂不确定',
}

const UPFRONT_COST_LABELS: Record<UpfrontCostAcceptance, string> = {
  acceptable: '可以接受',
  depends_on_amount: '视具体金额而定',
  avoid_high_one_time_fee: '不希望较高一次性费用',
  unknown: '暂不清楚',
}

const MOVE_IN_TIMING_LABELS: Record<MoveInTiming, string> = {
  as_soon_as_possible: '希望尽快入住',
  within_1_month: '1 个月以内',
  within_1_to_3_months: '1–3 个月',
  after_3_months: '3 个月以后',
  research_only: '目前只是提前了解',
}

const CONSULTANT_INTENT_LABELS: Record<ConsultantSupport, string> = {
  request_contact: '希望顾问后续协助（仅记录意向，尚未发起联系）',
  recommendation_first: '先查看推荐结果',
}

const QUESTION_LABELS: Partial<Record<AssessmentQuestionId, string>> = {
  'health.conditions': '慢性疾病情况',
  'health.recentEvents': '近期健康风险',
  'health.rehabilitationNeed': '康复需求',
  'adl.eating': '进食能力',
  'adl.mobility': '行走能力',
  'adl.toileting': '如厕能力',
  'adl.bathing': '洗澡能力',
  'adl.dressing': '穿衣能力',
  'adl.transfer': '起床与床椅转移',
  'adl.stairs': '上下楼能力',
  'cognitive.symptoms': '认知与精神状态',
  'cognitive.specialCareNeeds': '特殊护理需求',
}

const EDIT_LABELS: Record<ProfileEditSection, string> = {
  basic: '修改基本情况',
  health: '修改健康情况',
  adl: '修改生活能力',
  cognitive: '修改认知与护理',
  preference: '修改养老偏好',
  budget: '修改预算计划',
}

const row = (
  label: string,
  value: string,
  tone: ProfileDisplayRow['tone'] = 'normal',
): ProfileDisplayRow => ({ label, value, tone })

const summaryHasCode = (preview: ElderProfilePreview, code: ProfileSummaryCode): boolean => {
  const sections = preview.userFacingSummary.sections
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const items = sections[sectionIndex].items
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      if (items[itemIndex].summaryCode === code) {
        return true
      }
    }
  }
  return false
}

const mapValues = <T extends string>(values: readonly T[], labels: Record<T, string>): string =>
  values.map((value) => labels[value]).join('、')

const getCareLevelText = (preview: ElderProfilePreview): ProfileDisplayRow => {
  const careLevel = preview.adl.derivedFacts.careLevel
  if (careLevel.status === 'known') {
    return row('照护等级', CARE_LEVEL_LABELS[careLevel.value])
  }
  return row('照护等级', '自理能力等级暂无法确定', 'attention')
}

const getMobilityText = (preview: ElderProfilePreview): ProfileDisplayRow => {
  const mobility = preview.mobility.derivedFacts.level
  if (mobility.status === 'known') {
    return row('行动方式', MOBILITY_LABELS[mobility.value])
  }
  return row('行动方式', '行动能力暂无法确定', 'attention')
}

const getRehabilitationText = (preview: ElderProfilePreview): ProfileDisplayRow => {
  const rehabilitation = preview.health.derivedFacts.rehabilitationNeed
  if (rehabilitation.status !== 'known') {
    return row('康复需求', '仍需进一步确认', 'attention')
  }
  const labels: Record<RehabilitationRequirement, string> = {
    required: '明确需要康复支持',
    possible: '可能需要康复支持',
    not_required: '本次明确选择不需要康复支持',
  }
  return row('康复需求', labels[rehabilitation.value])
}

const buildOverviewTags = (preview: ElderProfilePreview): ProfileTagViewModel[] => {
  const tags: ProfileTagViewModel[] = []
  const careLevel = preview.adl.derivedFacts.careLevel
  if (careLevel.status === 'known') {
    tags.push({ text: CARE_LEVEL_LABELS[careLevel.value], tone: 'brand' })
  } else {
    tags.push({ text: '自理能力待确认', tone: 'warning' })
  }

  const mobility = preview.mobility.derivedFacts.level
  if (mobility.status === 'known') {
    tags.push({ text: MOBILITY_LABELS[mobility.value], tone: 'neutral' })
  } else {
    tags.push({ text: '行动能力待确认', tone: 'warning' })
  }

  const rehabilitation = preview.health.derivedFacts.rehabilitationNeed
  if (rehabilitation.status === 'known' && rehabilitation.value === 'required') {
    tags.push({ text: '有康复需求', tone: 'brand' })
  } else if (rehabilitation.status === 'known' && rehabilitation.value === 'possible') {
    tags.push({ text: '可能需要康复', tone: 'warning' })
  }

  const cognition = preview.cognition.derivedFacts.cognitiveConcern
  if (cognition.status === 'known' && cognition.value === 'present') {
    tags.push({ text: '已报告认知相关情况', tone: 'warning' })
  } else if (cognition.status === 'known' && cognition.value === 'absent') {
    tags.push({ text: '本次未报告明显认知情况', tone: 'neutral' })
  } else if (cognition.status !== 'known') {
    tags.push({ text: '认知情况待确认', tone: 'warning' })
  }

  const capabilities = preview.specialCare.derivedFacts.requiredCareCapabilities
  for (let index = 0; index < capabilities.length && tags.length < 5; index += 1) {
    const capability = capabilities[index]
    if (capability.status === 'required') {
      tags.push({ text: CARE_CAPABILITY_LABELS[capability.capability], tone: 'brand' })
    }
  }
  return tags
}

const buildBasicRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => {
  const facts = preview.basic.rawFacts
  const rows: ProfileDisplayRow[] = [
    row('与您的关系', RELATIONSHIP_LABELS[facts.relation]),
    row('性别与年龄', `${GENDER_LABELS[facts.sex]} · ${facts.age} 岁`),
  ]
  if (facts.livingStatus && summaryHasCode(preview, 'basic.living_status')) {
    rows.push(row('目前居住状态', LIVING_STATUS_LABELS[facts.livingStatus]))
  }
  if (facts.primaryCaregiver && summaryHasCode(preview, 'basic.primary_caregiver')) {
    rows.push(row('主要照护者', CAREGIVER_LABELS[facts.primaryCaregiver]))
  }
  return rows
}

const buildHealthRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => {
  const facts = preview.health.rawFacts
  const rows: ProfileDisplayRow[] = []
  if (summaryHasCode(preview, 'health.reported_diseases')) {
    if (facts.reportedDiseases.indexOf('none') >= 0) {
      rows.push(row('已报告健康情况', '本次明确选择暂无明显慢性疾病', 'muted'))
    } else if (facts.reportedDiseases.indexOf('unknown') >= 0) {
      rows.push(row('已报告健康情况', '慢性疾病情况暂不清楚', 'attention'))
    } else {
      rows.push(row('已报告健康情况', mapValues(facts.reportedDiseases, HEALTH_CONDITION_LABELS)))
    }
  }
  if (summaryHasCode(preview, 'health.recent_risks')) {
    if (facts.recentHealthRisks.indexOf('none') >= 0) {
      rows.push(row('近期健康风险', '本次明确选择以上均无', 'muted'))
    } else if (facts.recentHealthRisks.indexOf('unknown') >= 0) {
      rows.push(row('近期健康风险', '近期情况暂不清楚', 'attention'))
    } else {
      rows.push(row('近期健康风险', mapValues(facts.recentHealthRisks, RECENT_EVENT_LABELS)))
    }
  }
  if (summaryHasCode(preview, 'health.rehabilitation_need')) {
    rows.push(getRehabilitationText(preview))
  }
  return rows
}

const buildDailyRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => {
  const answers = preview.adl.rawAnswers
  const rows = [getCareLevelText(preview), getMobilityText(preview)]
  rows.push(
    row('进食', EATING_LABELS[answers.eating], answers.eating === 'unknown' || answers.eating === 'special_feeding' ? 'attention' : 'normal'),
    row('如厕', TOILETING_LABELS[answers.toileting], answers.toileting === 'unknown' || answers.toileting === 'catheter_or_stoma' ? 'attention' : 'normal'),
    row('洗澡', ASSISTANCE_LABELS[answers.bathing], answers.bathing === 'unknown' ? 'attention' : 'normal'),
  )
  return rows
}

const buildCareModeTags = (preview: ElderProfilePreview): ProfileTagViewModel[] =>
  preview.adl.derivedFacts.careModes.map((mode) => ({
    text: CARE_MODE_LABELS[mode.code],
    tone: mode.status === 'needs_confirmation' ? 'warning' : 'neutral',
  }))

const buildCognitionRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => {
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

const buildSpecialCareTags = (preview: ElderProfilePreview): ProfileTagViewModel[] => {
  const tags: ProfileTagViewModel[] = []
  preview.specialCare.derivedFacts.requiredCareCapabilities.forEach((item) => {
    if (item.status === 'required') {
      tags.push({ text: CARE_CAPABILITY_LABELS[item.capability], tone: 'brand' })
      return
    }
    if (item.status === 'needs_confirmation'
      && item.capability !== 'tube_feeding'
      && item.capability !== 'catheter_care') {
      tags.push({ text: `${CARE_CAPABILITY_LABELS[item.capability]}需求待确认`, tone: 'warning' })
    }
  })
  return tags
}

const getSpecialCareNote = (preview: ElderProfilePreview): string => {
  const answers = preview.specialCare.rawFacts.answers
  if (answers.indexOf('none') >= 0) {
    const needsConfirmation = preview.specialCare.derivedFacts.requiredCareCapabilities.some(
      (item) => item.status === 'needs_confirmation' || item.status === 'unknown',
    )
    return needsConfirmation
      ? '本次问卷选择了无以上特殊护理需求，但部分相关情况仍需结合下方提示确认。'
      : '本次明确选择无以上特殊护理需求。'
  }
  if (answers.indexOf('unknown') >= 0) {
    return '特殊护理需求暂不确定，请结合下方需要确认项补充。'
  }
  if (answers.indexOf('other') >= 0) {
    return '已报告其他特殊护理情况，具体内容仍需进一步确认。'
  }
  return ''
}

const editSectionForQuestion = (questionId: AssessmentQuestionId): ProfileEditSection => {
  if (questionId.indexOf('basic.') === 0) return 'basic'
  if (questionId.indexOf('health.') === 0) return 'health'
  if (questionId.indexOf('adl.') === 0) return 'adl'
  if (questionId.indexOf('cognitive.') === 0) return 'cognitive'
  if (questionId.indexOf('preference.') === 0) return 'preference'
  return 'budget'
}

const clarificationQuestionId = (clarification: ProfileClarification): AssessmentQuestionId =>
  clarification.sources[0].sourceQuestionId

const clarificationText = (clarification: ProfileClarification): string => {
  const questionId = clarificationQuestionId(clarification)
  const affected = clarification.affectedDerivedFields
  if (clarification.reasonCode === 'unknown_answer') {
    return `${QUESTION_LABELS[questionId] || '相关情况'}暂不确定，建议补充后再确认画像。`
  }
  if (clarification.reasonCode === 'non_ordinal_adl_answer') {
    if (questionId === 'adl.eating') {
      return '已报告特殊进食方式，具体方式及护理需求仍需确认。'
    }
    if (questionId === 'adl.toileting') {
      return '已报告导尿/造瘘情况，具体护理需求仍需确认。'
    }
    return '该项生活能力答案不能直接确定照护等级，仍需补充具体情况。'
  }
  if (clarification.reasonCode === 'cross_answer_conflict') {
    if (affected.indexOf('cognition.cognitiveConcern') >= 0) {
      return '健康情况与认知问卷的相关回答不一致，请进一步核对。'
    }
    if (affected.indexOf('health.rehabilitationNeed') >= 0) {
      return '康复需求在不同回答中不一致，请进一步核对。'
    }
    return '不同评估回答之间存在需要核对的信息。'
  }
  if (clarification.reasonCode === 'risk_signal_needs_confirmation') {
    if (affected.indexOf('cognition.wanderingRisk') >= 0) {
      return '已报告容易迷路，是否存在走失风险仍需进一步确认。'
    }
    if (affected.indexOf('cognition.behavioralRisk') >= 0) {
      return '已报告情绪波动，相关行为情况仍需进一步确认。'
    }
    if (affected.indexOf('specialCare.requiredCareCapabilities.tube_feeding') >= 0) {
      return '已报告特殊进食方式，具体方式及护理需求仍需确认。'
    }
    if (affected.indexOf('specialCare.requiredCareCapabilities.catheter_care') >= 0) {
      return '已报告导尿/造瘘情况，具体护理需求仍需确认。'
    }
    if (affected.indexOf('specialCare.requiredCareCapabilities.pressure_injury_care') >= 0) {
      return '已报告压疮情况，是否需要专项压疮护理仍需确认。'
    }
    if (affected.indexOf('specialCare.requiredCareCapabilities.incontinence_care') >= 0) {
      return '已报告失禁情况，具体失禁护理需求仍需确认。'
    }
    return '已报告相关风险信号，具体情况仍需确认。'
  }
  if (questionId === 'cognitive.specialCareNeeds') {
    return '已选择其他特殊护理需求，请补充具体情况。'
  }
  if (questionId === 'health.conditions') {
    return '已选择其他慢性疾病，请补充具体情况。'
  }
  return '已选择“其他”，建议补充具体情况。'
}

const priorityPresentation = (
  priority: ClarificationPriority,
): { label: string, tone: ProfileClarificationViewModel['tone'] } => {
  if (priority === 'required_before_classification') {
    return { label: '照护等级确认', tone: 'important' }
  }
  if (priority === 'required_before_hard_filter') {
    return { label: '后续匹配前确认', tone: 'important' }
  }
  if (priority === 'recommended') {
    return { label: '建议补充', tone: 'normal' }
  }
  return { label: '补充信息', tone: 'normal' }
}

const buildClarifications = (preview: ElderProfilePreview): ProfileClarificationViewModel[] => {
  const items: ProfileClarificationViewModel[] = []
  preview.clarifications.forEach((clarification) => {
    const text = clarificationText(clarification)
    if (items.some((item) => item.text === text)) {
      return
    }
    const editSection = editSectionForQuestion(clarificationQuestionId(clarification))
    const presentation = priorityPresentation(clarification.priority)
    items.push({
      text,
      priorityLabel: presentation.label,
      tone: presentation.tone,
      editSection,
      editLabel: EDIT_LABELS[editSection],
      errorKey: `edit-${editSection}`,
    })
  })
  return items
}

const buildPreferenceRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => {
  const facts = preview.preference.rawFacts
  const rows: ProfileDisplayRow[] = [
    row('倾向类型', PREFERRED_CARE_TYPE_LABELS[facts.preferredInstitutionType], facts.preferredInstitutionType === 'unknown' ? 'attention' : 'normal'),
    row('最关注', mapValues(facts.priorities, PRIORITY_LABELS)),
  ]
  if (facts.regionPreference && summaryHasCode(preview, 'preference.region')) {
    rows.push(row('区域偏好', facts.regionPreference.regionLabelSnapshot))
  }
  return rows
}

const buildFinancialRows = (preview: ElderProfilePreview): ProfileDisplayRow[] => [
  row('月度预算', MONTHLY_RANGE_LABELS[preview.financial.rawFacts.monthlyBudget], preview.financial.rawFacts.monthlyBudget === 'unknown' ? 'attention' : 'normal'),
  row('押金或一次性费用', UPFRONT_COST_LABELS[preview.financial.rawFacts.depositTolerance], preview.financial.rawFacts.depositTolerance === 'unknown' ? 'attention' : 'normal'),
  row('入住计划', MOVE_IN_TIMING_LABELS[preview.intent.rawFacts.moveInTiming]),
  row('顾问协助意向', CONSULTANT_INTENT_LABELS[preview.intent.rawFacts.consultantIntent]),
]

/** Pure display mapping. All business conclusions already exist in ElderProfilePreview. */
export const createProfilePageViewModel = (preview: ElderProfilePreview): ProfilePageViewModel => {
  const facts = preview.basic.rawFacts
  const relationship = RELATIONSHIP_LABELS[facts.relation]
  const displayName = facts.name ? facts.name : relationship
  return {
    headline: `${displayName} · ${facts.age} 岁`,
    relationshipLine: facts.name ? `与您的关系：${relationship}` : '根据本次评估生成',
    overviewTags: buildOverviewTags(preview),
    basicRows: buildBasicRows(preview),
    healthRows: buildHealthRows(preview),
    dailyRows: buildDailyRows(preview),
    careModeTags: buildCareModeTags(preview),
    careLevelNote: '照护等级基于本次生活能力问卷生成，不是医学诊断、官方失能鉴定或长护险等级。',
    cognitionRows: buildCognitionRows(preview),
    specialCareTags: buildSpecialCareTags(preview),
    specialCareNote: getSpecialCareNote(preview),
    clarifications: buildClarifications(preview),
    preferenceRows: buildPreferenceRows(preview),
    financialRows: buildFinancialRows(preview),
  }
}
