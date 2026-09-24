import {
  VISIT_EVALUATION_CONSIDERATION_OPTIONS,
  VISIT_EVALUATION_FEE_TOPICS,
  VISIT_EVALUATION_HANDOVER_TOPICS,
  VISIT_EVALUATION_OBSERVATION_OPTIONS,
  VISIT_EVALUATION_TAGS,
  cloneVisitEvaluationDraft,
  countVisitEvaluationCharacters,
  createEmptyVisitEvaluationDraft,
  createVisitEvaluationChoiceViewModel,
  createVisitEvaluationRatingViewModel,
  setVisitEvaluationRating,
  toggleVisitEvaluationHandoverTopic,
  toggleVisitEvaluationTag,
  truncateVisitEvaluationComment,
  validateVisitEvaluationDraft,
} from './evaluation-view-model'
import type {
  VisitEvaluationConsiderationV1,
  VisitEvaluationDraftV1,
  VisitEvaluationHandoverTopicV1,
  VisitEvaluationObservationAnswerV1,
  VisitEvaluationRatingKeyV1,
  VisitEvaluationTagV1,
} from './evaluation-view-model'
import { createVisitEvaluationUiApplicationV1 } from './visit-evaluation-application'
import { createProductionVisitEvaluationContextProviderV1 } from './visit-evaluation-production-context'
import type {
  TestOnlyVisitEvaluationContextV1,
} from './visit-evaluation-application'
import type { ProductionVisitEvaluationContextV1 } from './visit-evaluation-production-context'

type VisitEvaluationPageState =
  | 'loading_context'
  | 'not_completed'
  | 'denied'
  | 'unavailable'
  | 'load_error'
  | 'editing'
  | 'submitting'
  | 'submitted'
  | 'submit_failed'

interface VisitEvaluationTagGroupViewModel {
  key: 'likedTags' | 'concernTags'
  title: string
  items: Array<{ key: VisitEvaluationTagV1; label: string; selected: boolean }>
}

interface VisitEvaluationPageData {
  pageState: VisitEvaluationPageState
  contextMode: 'none' | 'test_only' | 'production'
  visitId: string
  contextMessage: string
  statusMessage: string
  feedbackMessage: string
  tagFeedbackGroup: string
  tagFeedbackMessage: string
  validationMessage: string
  submitButtonText: string
  draft: VisitEvaluationDraftV1
  overallOptions: Array<{ value: number; label: string; selected: boolean }>
  ratingSections: ReturnType<typeof createVisitEvaluationRatingViewModel>['sections']
  considerationOptions: Array<{ key: string; label: string; selected: boolean }>
  careRecordOptions: Array<{ key: string; label: string; selected: boolean }>
  handoverLearnedOptions: Array<{ key: string; label: string; selected: boolean }>
  handoverTopics: Array<{ key: VisitEvaluationHandoverTopicV1; label: string; selected: boolean }>
  feeClarityOptions: Array<{ key: string; label: string; selected: boolean }>
  feeTopics: string[]
  tagGroups: VisitEvaluationTagGroupViewModel[]
  commentLength: number
  commentRemaining: number
}

interface VisitEvaluationRouteData {
  visitId?: string
}

interface DatasetEvent<T> {
  currentTarget: { dataset: T }
}

interface InputEvent {
  detail: { value: string }
}

interface EvaluationPageApplication {
  loadContext(visitId: string): Promise<{
    kind: 'ready'
    context: TestOnlyVisitEvaluationContextV1
  } | {
    kind: 'eligible'
    context: ProductionVisitEvaluationContextV1
  } | {
    kind: 'not_completed' | 'denied' | 'unavailable' | 'load_error'
  }>
  submit(
    context: TestOnlyVisitEvaluationContextV1,
    draft: VisitEvaluationDraftV1,
  ): Promise<{ kind: 'submitted_test_only' } | { kind: 'submit_failed'; reason: string }>
}

interface EvaluationPageInstance {
  data: VisitEvaluationPageData
  setData(patch: Partial<VisitEvaluationPageData>): void
  _visitEvaluationApplication?: EvaluationPageApplication
  _visitEvaluationContext?: TestOnlyVisitEvaluationContextV1
  _productionVisitEvaluationContext?: ProductionVisitEvaluationContextV1
  _visitEvaluationSubmitLocked?: boolean
  _contextLoadLocked?: boolean
  _contextLoadSequence?: number
}

interface RatingActionDataset {
  question?: string
  value?: string
}

interface TagActionDataset {
  group?: string
  tag?: string
}

interface ObservationActionDataset {
  question?: string
  value?: string
}

interface StringActionDataset {
  value?: string
}

const isSafeVisitId = (value: unknown): value is string => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= 200
  && !/[\u0000-\u001f\u007f]/.test(value)

const isRatingQuestion = (value: string): value is 'overallRating' | VisitEvaluationRatingKeyV1 =>
  value === 'overallRating'
  || Object.prototype.hasOwnProperty.call(createEmptyVisitEvaluationDraft().ratings, value)

const isConsideration = (value: string): value is Exclude<VisitEvaluationConsiderationV1, ''> =>
  VISIT_EVALUATION_CONSIDERATION_OPTIONS.some((item) => item.key === value)

const isObservationAnswer = (value: string): value is Exclude<VisitEvaluationObservationAnswerV1, ''> =>
  VISIT_EVALUATION_OBSERVATION_OPTIONS.some((item) => item.key === value)

const isTag = (value: string): value is VisitEvaluationTagV1 =>
  VISIT_EVALUATION_TAGS.some((item) => item.key === value)

const isHandoverTopic = (value: string): value is VisitEvaluationHandoverTopicV1 =>
  VISIT_EVALUATION_HANDOVER_TOPICS.some((item) => item.key === value)

const isFeeClarity = (value: string): value is 'clear' | 'unclear' => value === 'clear' || value === 'unclear'

const createFormPatch = (draft: VisitEvaluationDraftV1): Partial<VisitEvaluationPageData> => {
  const ratingViewModel = createVisitEvaluationRatingViewModel(draft)
  return {
    draft,
    overallOptions: ratingViewModel.overallOptions,
    ratingSections: ratingViewModel.sections,
    considerationOptions: createVisitEvaluationChoiceViewModel(
      VISIT_EVALUATION_CONSIDERATION_OPTIONS,
      draft.consideration,
    ),
    careRecordOptions: createVisitEvaluationChoiceViewModel(
      VISIT_EVALUATION_OBSERVATION_OPTIONS,
      draft.careRecordLearned,
    ),
    handoverLearnedOptions: createVisitEvaluationChoiceViewModel(
      VISIT_EVALUATION_OBSERVATION_OPTIONS,
      draft.handoverLearned,
    ),
    handoverTopics: VISIT_EVALUATION_HANDOVER_TOPICS.map((item) => ({
      key: item.key,
      label: item.label,
      selected: draft.handoverTopics.includes(item.key),
    })),
    feeClarityOptions: createVisitEvaluationChoiceViewModel([
      { key: 'clear', label: '清楚' },
      { key: 'unclear', label: '不清楚' },
    ], draft.feeExplanationClear),
    feeTopics: VISIT_EVALUATION_FEE_TOPICS.slice(),
    tagGroups: [
      {
        key: 'likedTags',
        title: '最满意',
        items: VISIT_EVALUATION_TAGS.map((item) => ({
          key: item.key,
          label: item.label,
          selected: draft.likedTags.includes(item.key),
        })),
      },
      {
        key: 'concernTags',
        title: '最担心',
        items: VISIT_EVALUATION_TAGS.map((item) => ({
          key: item.key,
          label: item.label,
          selected: draft.concernTags.includes(item.key),
        })),
      },
    ],
    commentLength: countVisitEvaluationCharacters(draft.comment),
    commentRemaining: Math.max(0, 200 - countVisitEvaluationCharacters(draft.comment)),
  }
}

const getApplication = (page: EvaluationPageInstance): EvaluationPageApplication => {
  if (page._visitEvaluationApplication) return page._visitEvaluationApplication
  const application = createVisitEvaluationUiApplicationV1({
    productionContextProvider: createProductionVisitEvaluationContextProviderV1(),
  })
  page._visitEvaluationApplication = application
  return application
}

const loadContext = async (page: EvaluationPageInstance, visitId: string): Promise<void> => {
  if (page._contextLoadLocked) return
  page._contextLoadLocked = true
  page._contextLoadSequence = (page._contextLoadSequence || 0) + 1
  const requestSequence = page._contextLoadSequence
  page._visitEvaluationContext = undefined
  page._productionVisitEvaluationContext = undefined
  page.setData({
    pageState: 'loading_context',
    contextMode: 'none',
    visitId,
    contextMessage: '正在通过当前账号确认这条预约记录。',
    statusMessage: '',
    feedbackMessage: '',
    tagFeedbackGroup: '',
    tagFeedbackMessage: '',
    validationMessage: '',
  })

  try {
    const result = await getApplication(page).loadContext(visitId)
    if (requestSequence !== page._contextLoadSequence || page.data.visitId !== visitId) return

    if (result.kind === 'ready' && result.context.visitId === visitId) {
      const draft = createEmptyVisitEvaluationDraft()
      page._visitEvaluationContext = result.context
      page.setData({
        ...createFormPatch(draft),
        pageState: 'editing',
        contextMode: 'test_only',
        contextMessage: `开发测试上下文 · ${result.context.institutionId} · ${result.context.institutionRecordRevision}`,
        statusMessage: '开发测试流程不会写入真实评价、机构资料或推荐结果。',
        submitButtonText: '提交测试评价',
      })
      return
    }

    if (result.kind === 'eligible' && result.context.visitId === visitId && result.context.visitStatus === 'completed') {
      const draft = createEmptyVisitEvaluationDraft()
      page._productionVisitEvaluationContext = result.context
      page.setData({
        ...createFormPatch(draft),
        pageState: 'editing',
        contextMode: 'production',
        contextMessage: '已确认该预约属于当前账号，且服务端记录的看院状态为已完成。',
        statusMessage: '当前可填写本地评价草稿；评价提交服务尚未接入，内容不会发送或保存。',
        submitButtonText: '',
      })
      return
    }

    if (result.kind === 'not_completed') {
      page.setData({
        pageState: 'not_completed',
        contextMode: 'none',
        contextMessage: '该预约尚未处于已完成状态，暂不能填写看院评价。',
        statusMessage: '',
      })
      return
    }

    if (result.kind === 'denied') {
      page.setData({
        pageState: 'denied',
        contextMode: 'none',
        contextMessage: '无法读取这条预约记录。记录可能不存在，或当前账号无权查看。',
        statusMessage: '',
      })
      return
    }

    if (result.kind === 'load_error') {
      page.setData({
        pageState: 'load_error',
        contextMode: 'none',
        contextMessage: '读取评价上下文失败，请检查网络后重试。',
        statusMessage: '',
      })
      return
    }

    page.setData({
      pageState: 'unavailable',
      contextMode: 'none',
      contextMessage: '当前评价上下文服务暂不可用，请稍后重试。',
      statusMessage: '',
    })
  } catch (_error) {
    if (requestSequence === page._contextLoadSequence && page.data.visitId === visitId) {
      page.setData({
        pageState: 'load_error',
        contextMode: 'none',
        contextMessage: '读取评价上下文失败，请检查网络后重试。',
        statusMessage: '',
      })
    }
  } finally {
    if (requestSequence === page._contextLoadSequence) page._contextLoadLocked = false
  }
}

const setDraft = (page: EvaluationPageInstance, draft: VisitEvaluationDraftV1): void => {
  page.setData({
    ...createFormPatch(draft),
    feedbackMessage: '',
    tagFeedbackGroup: '',
    tagFeedbackMessage: '',
    validationMessage: '',
  })
}

Page({
  data: {
    pageState: 'loading_context',
    contextMode: 'none',
    visitId: '',
    contextMessage: '正在检查预约评价条件。',
    statusMessage: '',
    feedbackMessage: '',
    tagFeedbackGroup: '',
    tagFeedbackMessage: '',
    validationMessage: '',
    submitButtonText: '提交测试评价',
    ...createFormPatch(createEmptyVisitEvaluationDraft()),
  } as VisitEvaluationPageData,

  async onLoad(query: VisitEvaluationRouteData) {
    const page = this as unknown as EvaluationPageInstance
    page._visitEvaluationContext = undefined
    page._productionVisitEvaluationContext = undefined
    page._visitEvaluationSubmitLocked = false
    page._contextLoadLocked = false
    page._contextLoadSequence = (page._contextLoadSequence || 0) + 1
    const visitId = query && query.visitId
    if (!isSafeVisitId(visitId)) {
      page.setData({
        pageState: 'unavailable',
        contextMode: 'none',
        visitId: '',
        contextMessage: '未找到有效的预约记录，请从预约入口返回。',
        statusMessage: '',
      })
      return
    }

    await loadContext(page, visitId)
  },

  async onRetryContext() {
    const page = this as unknown as EvaluationPageInstance
    if (!isSafeVisitId(page.data.visitId) || page._contextLoadLocked) return
    await loadContext(page, page.data.visitId)
  },

  onRatingTap(event: DatasetEvent<RatingActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const question = event.currentTarget.dataset.question || ''
    const value = Number(event.currentTarget.dataset.value)
    if (!isRatingQuestion(question)) return
    const nextDraft = setVisitEvaluationRating(page.data.draft, question, value)
    if (!nextDraft) return
    setDraft(page, nextDraft)
  },

  onConsiderationTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const value = event.currentTarget.dataset.value || ''
    if (!isConsideration(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.consideration = value
    setDraft(page, draft)
  },

  onObservationTap(event: DatasetEvent<ObservationActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const question = event.currentTarget.dataset.question
    const value = event.currentTarget.dataset.value || ''
    if ((question !== 'careRecordLearned' && question !== 'handoverLearned') || !isObservationAnswer(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    if (question === 'careRecordLearned') draft.careRecordLearned = value
    else draft.handoverLearned = value
    setDraft(page, draft)
  },

  onFeeClarityTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const value = event.currentTarget.dataset.value || ''
    if (!isFeeClarity(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.feeExplanationClear = value
    setDraft(page, draft)
  },

  onHandoverTopicTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const value = event.currentTarget.dataset.value || ''
    if (!isHandoverTopic(value)) return
    setDraft(page, toggleVisitEvaluationHandoverTopic(page.data.draft, value))
  },

  onTagTap(event: DatasetEvent<TagActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const group = event.currentTarget.dataset.group
    const tag = event.currentTarget.dataset.tag || ''
    if ((group !== 'likedTags' && group !== 'concernTags') || !isTag(tag)) return
    const result = toggleVisitEvaluationTag(page.data.draft, group, tag)
    if (result.limitReached) {
      const title = group === 'likedTags' ? '最满意' : '最担心'
      page.setData({
        tagFeedbackGroup: group,
        tagFeedbackMessage: `${title}最多选择3项，请先取消已选项。`,
      })
      return
    }
    setDraft(page, result.draft)
  },

  onCommentInput(event: InputEvent) {
    const page = this as unknown as EvaluationPageInstance
    if (page.data.pageState !== 'editing') return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.comment = truncateVisitEvaluationComment(typeof event.detail.value === 'string' ? event.detail.value : '')
    setDraft(page, draft)
  },

  async onSubmit() {
    const page = this as unknown as EvaluationPageInstance
    if ((page.data.pageState !== 'editing' && page.data.pageState !== 'submit_failed')
      || page._visitEvaluationSubmitLocked || !page._visitEvaluationContext) return
    const validationIssues = validateVisitEvaluationDraft(page.data.draft)
    if (validationIssues.length > 0) {
      page.setData({
        validationMessage: '评价内容格式有误，请检查评分、标签和补充说明。',
        feedbackMessage: '',
      })
      return
    }

    page._visitEvaluationSubmitLocked = true
    const context = page._visitEvaluationContext
    page.setData({
      pageState: 'submitting',
      submitButtonText: '正在提交测试评价',
      validationMessage: '',
      feedbackMessage: '',
    })
    try {
      const result = await getApplication(page).submit(context, cloneVisitEvaluationDraft(page.data.draft))
      if (result.kind === 'submitted_test_only') {
        page.setData({
          pageState: 'submitted',
          submitButtonText: '测试流程已完成',
          feedbackMessage: '测试提交已完成；内容未写入真实评价，也不是机构确认。',
        })
      } else {
        page.setData({
          pageState: 'submit_failed',
          submitButtonText: '重试测试提交',
          feedbackMessage: '测试提交暂未成功，已保留全部填写内容，可重试。',
        })
      }
    } catch (_error) {
      page.setData({
        pageState: 'submit_failed',
        submitButtonText: '重试测试提交',
        feedbackMessage: '测试提交暂未成功，已保留全部填写内容，可重试。',
      })
    } finally {
      page._visitEvaluationSubmitLocked = false
    }
  },
})
