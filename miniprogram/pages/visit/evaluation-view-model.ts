export const VISIT_EVALUATION_MAX_TAGS = 3
export const VISIT_EVALUATION_MAX_COMMENT_CHARACTERS = 200
export const VISIT_EVALUATION_RATING_OPTIONS = [1, 2, 3, 4, 5]

export type VisitEvaluationTagV1 =
  | 'care'
  | 'medical'
  | 'room'
  | 'environment'
  | 'dining'
  | 'activities'
  | 'transport'
  | 'price'
  | 'staff_attitude'
  | 'other'

export type VisitEvaluationConsiderationV1 = '' | 'willing' | 'compare' | 'not_considering'
export type VisitEvaluationObservationAnswerV1 = '' | 'yes' | 'no' | 'unconfirmed'
export type VisitEvaluationHandoverTopicV1 =
  | 'vital_signs'
  | 'abnormal_events'
  | 'handling_method'
  | 'follow_up'
  | 'family_communication'
  | 'unconfirmed'

export const VISIT_EVALUATION_RATING_SECTIONS = [
  {
    key: 'environment',
    title: '环境与居住',
    items: [
      { key: 'hygiene', label: '环境卫生' },
      { key: 'room_comfort', label: '房间舒适' },
      { key: 'age_friendly_facilities', label: '适老设施' },
      { key: 'common_space', label: '公共空间' },
      { key: 'living_atmosphere', label: '居住氛围' },
    ],
  },
  {
    key: 'care',
    title: '护理体验',
    items: [
      { key: 'service_attitude', label: '服务态度' },
      { key: 'professional_impression', label: '专业感受' },
      { key: 'communication_with_elder', label: '与老人沟通' },
      { key: 'on_site_care_order', label: '现场护理秩序' },
    ],
  },
  {
    key: 'medical_safety',
    title: '医疗与安全',
    items: [
      { key: 'medical_support', label: '医疗配套' },
      { key: 'emergency_explanation', label: '紧急处理说明' },
      { key: 'rehabilitation_facilities', label: '康复设施' },
      { key: 'safety_management', label: '安全管理' },
    ],
  },
  {
    key: 'dining',
    title: '餐饮',
    items: [
      { key: 'dining_room_environment', label: '餐厅环境' },
      { key: 'meal_impression', label: '餐食观感' },
      { key: 'dietary_arrangement_explanation', label: '饮食安排说明' },
      { key: 'dietary_needs_fit', label: '是否满足老人饮食需要（主观感受）' },
    ],
  },
  {
    key: 'activities_life',
    title: '活动与生活',
    items: [
      { key: 'activity_space', label: '活动空间' },
      { key: 'activity_variety', label: '活动丰富度' },
      { key: 'daily_life_atmosphere', label: '生活氛围' },
      { key: 'common_area_use', label: '公共区域使用' },
    ],
  },
] as const

export type VisitEvaluationRatingKeyV1 =
  | 'hygiene'
  | 'room_comfort'
  | 'age_friendly_facilities'
  | 'common_space'
  | 'living_atmosphere'
  | 'service_attitude'
  | 'professional_impression'
  | 'communication_with_elder'
  | 'on_site_care_order'
  | 'medical_support'
  | 'emergency_explanation'
  | 'rehabilitation_facilities'
  | 'safety_management'
  | 'dining_room_environment'
  | 'meal_impression'
  | 'dietary_arrangement_explanation'
  | 'dietary_needs_fit'
  | 'activity_space'
  | 'activity_variety'
  | 'daily_life_atmosphere'
  | 'common_area_use'

export interface VisitEvaluationDraftV1 {
  overallRating: number | null
  consideration: VisitEvaluationConsiderationV1
  ratings: Record<VisitEvaluationRatingKeyV1, number | null>
  feeExplanationClear: '' | 'clear' | 'unclear'
  careRecordLearned: VisitEvaluationObservationAnswerV1
  handoverLearned: VisitEvaluationObservationAnswerV1
  handoverTopics: VisitEvaluationHandoverTopicV1[]
  likedTags: VisitEvaluationTagV1[]
  concernTags: VisitEvaluationTagV1[]
  comment: string
}

export interface VisitEvaluationRatingOptionViewModel {
  value: number
  label: string
  selected: boolean
}

export interface VisitEvaluationRatingItemViewModel {
  key: VisitEvaluationRatingKeyV1
  label: string
  options: VisitEvaluationRatingOptionViewModel[]
}

export interface VisitEvaluationRatingSectionViewModel {
  key: string
  title: string
  items: VisitEvaluationRatingItemViewModel[]
}

export interface VisitEvaluationChoiceViewModel {
  key: string
  label: string
  selected: boolean
}

export const VISIT_EVALUATION_CONSIDERATION_OPTIONS = [
  { key: 'willing', label: '愿意进一步考虑' },
  { key: 'compare', label: '可以继续比较' },
  { key: 'not_considering', label: '暂不考虑' },
]

export const VISIT_EVALUATION_OBSERVATION_OPTIONS = [
  { key: 'yes', label: '是' },
  { key: 'no', label: '否' },
  { key: 'unconfirmed', label: '未确认' },
]

export const VISIT_EVALUATION_TAGS: Array<{ key: VisitEvaluationTagV1; label: string }> = [
  { key: 'care', label: '护理' },
  { key: 'medical', label: '医疗' },
  { key: 'room', label: '房间' },
  { key: 'environment', label: '环境' },
  { key: 'dining', label: '饮食' },
  { key: 'activities', label: '活动' },
  { key: 'transport', label: '交通' },
  { key: 'price', label: '价格' },
  { key: 'staff_attitude', label: '工作人员态度' },
  { key: 'other', label: '其他' },
]

export const VISIT_EVALUATION_FEE_TOPICS = [
  '床位费', '餐费', '护理费', '管理费', '特殊护理费', '押金', '其他一次性费用',
]

export const VISIT_EVALUATION_HANDOVER_TOPICS: Array<{
  key: VisitEvaluationHandoverTopicV1
  label: string
}> = [
  { key: 'vital_signs', label: '生命体征' },
  { key: 'abnormal_events', label: '异常情况' },
  { key: 'handling_method', label: '处理方法' },
  { key: 'follow_up', label: '后续跟踪' },
  { key: 'family_communication', label: '家属沟通' },
  { key: 'unconfirmed', label: '未确认' },
]

const createEmptyRatings = (): VisitEvaluationDraftV1['ratings'] => ({
  hygiene: null,
  room_comfort: null,
  age_friendly_facilities: null,
  common_space: null,
  living_atmosphere: null,
  service_attitude: null,
  professional_impression: null,
  communication_with_elder: null,
  on_site_care_order: null,
  medical_support: null,
  emergency_explanation: null,
  rehabilitation_facilities: null,
  safety_management: null,
  dining_room_environment: null,
  meal_impression: null,
  dietary_arrangement_explanation: null,
  dietary_needs_fit: null,
  activity_space: null,
  activity_variety: null,
  daily_life_atmosphere: null,
  common_area_use: null,
})

export const createEmptyVisitEvaluationDraft = (): VisitEvaluationDraftV1 => ({
  overallRating: null,
  consideration: '',
  ratings: createEmptyRatings(),
  feeExplanationClear: '',
  careRecordLearned: '',
  handoverLearned: '',
  handoverTopics: [],
  likedTags: [],
  concernTags: [],
  comment: '',
})

export const cloneVisitEvaluationDraft = (draft: VisitEvaluationDraftV1): VisitEvaluationDraftV1 => ({
  overallRating: draft.overallRating,
  consideration: draft.consideration,
  ratings: { ...draft.ratings },
  feeExplanationClear: draft.feeExplanationClear,
  careRecordLearned: draft.careRecordLearned,
  handoverLearned: draft.handoverLearned,
  handoverTopics: draft.handoverTopics.slice(),
  likedTags: draft.likedTags.slice(),
  concernTags: draft.concernTags.slice(),
  comment: draft.comment,
})

export const countVisitEvaluationCharacters = (value: string): number => Array.from(value).length

export const truncateVisitEvaluationComment = (value: string): string =>
  Array.from(value).slice(0, VISIT_EVALUATION_MAX_COMMENT_CHARACTERS).join('')

export const createVisitEvaluationChoiceViewModel = (
  options: ReadonlyArray<{ key: string; label: string }>,
  selectedKey: string,
): VisitEvaluationChoiceViewModel[] => options.map((option) => ({
  key: option.key,
  label: option.label,
  selected: option.key === selectedKey,
}))

export const createVisitEvaluationRatingViewModel = (
  draft: VisitEvaluationDraftV1,
): {
  overallOptions: VisitEvaluationRatingOptionViewModel[]
  sections: VisitEvaluationRatingSectionViewModel[]
} => {
  const makeOptions = (selected: number | null): VisitEvaluationRatingOptionViewModel[] =>
    VISIT_EVALUATION_RATING_OPTIONS.map((value) => ({
      value,
      label: String(value),
      selected: selected === value,
    }))

  return {
    overallOptions: makeOptions(draft.overallRating),
    sections: VISIT_EVALUATION_RATING_SECTIONS.map((section) => ({
      key: section.key,
      title: section.title,
      items: section.items.map((item) => ({
        key: item.key,
        label: item.label,
        options: makeOptions(draft.ratings[item.key]),
      })),
    })),
  }
}

export const setVisitEvaluationRating = (
  draft: VisitEvaluationDraftV1,
  question: 'overallRating' | VisitEvaluationRatingKeyV1,
  value: number,
): VisitEvaluationDraftV1 | null => {
  if (!Number.isInteger(value) || value < 1 || value > 5) return null
  const next = cloneVisitEvaluationDraft(draft)
  if (question === 'overallRating') next.overallRating = value
  else next.ratings[question] = value
  return next
}

export const toggleVisitEvaluationTag = (
  draft: VisitEvaluationDraftV1,
  group: 'likedTags' | 'concernTags',
  tag: VisitEvaluationTagV1,
): { draft: VisitEvaluationDraftV1; limitReached: boolean } => {
  const next = cloneVisitEvaluationDraft(draft)
  const current = next[group]
  if (current.includes(tag)) {
    next[group] = current.filter((item) => item !== tag)
    return { draft: next, limitReached: false }
  }
  if (current.length >= VISIT_EVALUATION_MAX_TAGS) return { draft, limitReached: true }
  next[group] = current.concat(tag)
  return { draft: next, limitReached: false }
}

export const toggleVisitEvaluationHandoverTopic = (
  draft: VisitEvaluationDraftV1,
  topic: VisitEvaluationHandoverTopicV1,
): VisitEvaluationDraftV1 => {
  const next = cloneVisitEvaluationDraft(draft)
  if (topic === 'unconfirmed') {
    next.handoverTopics = next.handoverTopics.includes(topic) ? [] : [topic]
    return next
  }
  const selected = next.handoverTopics.filter((item) => item !== 'unconfirmed')
  next.handoverTopics = selected.includes(topic)
    ? selected.filter((item) => item !== topic)
    : selected.concat(topic)
  return next
}

export interface VisitEvaluationValidationIssue {
  path: string
  code: 'invalid_rating' | 'too_many_tags' | 'invalid_tag' | 'invalid_observation' | 'invalid_comment'
}

const isRating = (value: unknown): value is number | null => value === null
  || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5)

const isObservationAnswer = (value: unknown): value is VisitEvaluationObservationAnswerV1 =>
  value === '' || value === 'yes' || value === 'no' || value === 'unconfirmed'

export const validateVisitEvaluationDraft = (
  draft: VisitEvaluationDraftV1,
): VisitEvaluationValidationIssue[] => {
  const issues: VisitEvaluationValidationIssue[] = []
  if (!isRating(draft.overallRating)) issues.push({ path: 'overallRating', code: 'invalid_rating' })
  Object.keys(draft.ratings).forEach((key) => {
    if (!isRating(draft.ratings[key as VisitEvaluationRatingKeyV1])) {
      issues.push({ path: `ratings.${key}`, code: 'invalid_rating' })
    }
  })
  if (draft.likedTags.length > VISIT_EVALUATION_MAX_TAGS) issues.push({ path: 'likedTags', code: 'too_many_tags' })
  if (draft.concernTags.length > VISIT_EVALUATION_MAX_TAGS) issues.push({ path: 'concernTags', code: 'too_many_tags' })
  const validTags = VISIT_EVALUATION_TAGS.map((item) => item.key)
  draft.likedTags.forEach((tag) => {
    if (!validTags.includes(tag)) issues.push({ path: 'likedTags', code: 'invalid_tag' })
  })
  draft.concernTags.forEach((tag) => {
    if (!validTags.includes(tag)) issues.push({ path: 'concernTags', code: 'invalid_tag' })
  })
  if (draft.consideration !== '' && draft.consideration !== 'willing'
    && draft.consideration !== 'compare' && draft.consideration !== 'not_considering') {
    issues.push({ path: 'consideration', code: 'invalid_observation' })
  }
  if (!isObservationAnswer(draft.careRecordLearned)) issues.push({ path: 'careRecordLearned', code: 'invalid_observation' })
  if (!isObservationAnswer(draft.handoverLearned)) issues.push({ path: 'handoverLearned', code: 'invalid_observation' })
  if (draft.comment !== truncateVisitEvaluationComment(draft.comment)) {
    issues.push({ path: 'comment', code: 'invalid_comment' })
  }
  return issues
}
