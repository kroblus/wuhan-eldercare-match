import {
  VISIT_EVALUATION_CONSIDERATION_OPTIONS,
  VISIT_EVALUATION_FEE_ANSWER_OPTIONS,
  VISIT_EVALUATION_FEE_TOPICS,
  VISIT_EVALUATION_HANDOVER_TOPICS,
  VISIT_EVALUATION_OBSERVATION_OPTIONS,
  VISIT_EVALUATION_TAGS,
  cloneVisitEvaluationDraft,
  countVisitEvaluationCharacters,
  createEmptyVisitEvaluationDraft,
  createVisitEvaluationChoiceViewModel,
  createVisitEvaluationFeeTopicViewModel,
  createVisitEvaluationRatingViewModel,
  setVisitEvaluationRating,
  setVisitEvaluationFeeTopic,
  toggleVisitEvaluationHandoverTopic,
  toggleVisitEvaluationTag,
  truncateVisitEvaluationComment,
  validateVisitEvaluationDraft,
} from './evaluation-view-model'
import type {
  VisitEvaluationConsiderationV1,
  VisitEvaluationDraftV1,
  VisitEvaluationFeeAnswerV1,
  VisitEvaluationFeeTopicKeyV1,
  VisitEvaluationHandoverTopicV1,
  VisitEvaluationObservationAnswerV1,
  VisitEvaluationRatingKeyV1,
  VisitEvaluationTagV1,
} from './evaluation-view-model'
import { createVisitEvaluationUiApplicationV1 } from './visit-evaluation-application'
import { createProductionVisitEvaluationProvidersV1 } from './visit-evaluation-production-context'
import type {
  TestOnlyVisitEvaluationContextV1,
} from './visit-evaluation-application'
import type { ProductionVisitEvaluationContextV1 } from './visit-evaluation-production-context'
import type { ProductionVisitEvaluationSubmitResultV1 } from './visit-evaluation-production-submit'
import { isolatedEvaluationProviders, readEvaluationSession, saveEvaluationSession, readEvaluationDisplay } from '../../runtime/evaluation-session'
import { readBrowseFontStyle } from '../../utils/browse-font'
import { formatChinaDateTime } from '../../utils/display-date'

type VisitEvaluationPageState =
  | 'loading_context'
  | 'not_completed'
  | 'denied'
  | 'auth_required'
  | 'already_submitted'
  | 'submission_conflict'
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
  footerReserve: number
  keyboardOpen: boolean
  fontStyle: string
  step: number
  sessionEpoch: number
  summaryGroups: Array<{ title: string; step: number; rows: Array<{ label: string; value: string }> }>
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
  feeTopicExplanations: ReturnType<typeof createVisitEvaluationFeeTopicViewModel>
  overallRatingValidationMessage: string
  considerationValidationMessage: string
  tagGroups: VisitEvaluationTagGroupViewModel[]
  commentLength: number
  commentRemaining: number
  serverEvaluationId: string
  serverSubmittedAt: string
  submittedAtLabel: string
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
  submitProduction(
    context: ProductionVisitEvaluationContextV1,
    draft: VisitEvaluationDraftV1,
  ): Promise<ProductionVisitEvaluationSubmitResultV1 | { kind: 'invalid_draft' }>
}

interface EvaluationPageInstance {
  data: VisitEvaluationPageData
  setData(patch: Partial<VisitEvaluationPageData>): void
  selectComponent?(selector: string): WechatMiniprogram.Component.TrivialInstance | null
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

interface FeeTopicActionDataset {
  topic?: string
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

const isFeeTopic = (value: string): value is VisitEvaluationFeeTopicKeyV1 =>
  VISIT_EVALUATION_FEE_TOPICS.some((item) => item.key === value)

const isFeeAnswer = (value: string): value is VisitEvaluationFeeAnswerV1 => value === ''
  || VISIT_EVALUATION_FEE_ANSWER_OPTIONS.some((item) => item.key === value)

const isDraftEditable = (pageState: VisitEvaluationPageState): boolean =>
  pageState === 'editing' || pageState === 'submit_failed'

const reserveFooter = (page: EvaluationPageInstance): void => {
  if (typeof wx.nextTick !== 'function' || typeof wx.createSelectorQuery !== 'function') return
  wx.nextTick(() => {
    wx.createSelectorQuery().in(page as unknown as WechatMiniprogram.Component.TrivialInstance)
      .select('.evaluation-footer').boundingClientRect(rect => {
        if (rect && rect.height > 0) page.setData({ footerReserve: Math.ceil(rect.height) + 24 })
        else page.setData({ footerReserve: 24 })
      }).exec()
  })
}
const keyboards = new WeakMap<object, (event: { height: number }) => void>()
const observeKeyboard = (page: EvaluationPageInstance): void => {
  if (keyboards.has(page) || typeof wx.onKeyboardHeightChange !== 'function') return
  const listener = (event: { height: number }) => {
    page.setData({ keyboardOpen: event.height > 0 })
    if (!event.height) reserveFooter(page)
  }
  keyboards.set(page, listener)
  wx.onKeyboardHeightChange(listener)
}
const releaseKeyboard = (page: object): void => {
  const listener = keyboards.get(page)
  if (listener && typeof wx.offKeyboardHeightChange === 'function') wx.offKeyboardHeightChange(listener)
  keyboards.delete(page)
}

const createFormPatch = (draft: VisitEvaluationDraftV1): Partial<VisitEvaluationPageData> => {
  const ratingViewModel = createVisitEvaluationRatingViewModel(draft)
  const label = (options: ReadonlyArray<{ key: string; label: string }>, key: string) => {
    const found = options.find(o => o.key === key)
    return found ? found.label : '未填写'
  }
  return {
    summaryGroups: [
      { title: '总体体验', step: 1, rows: [{ label: '整体印象', value: draft.overallRating === null ? '未填写' : draft.overallRating + ' / 5' },
        { label: '继续考虑意愿', value: label(VISIT_EVALUATION_CONSIDERATION_OPTIONS, draft.consideration) }] },
      ...ratingViewModel.sections.map(s => ({ title: s.title, step: 2, rows: s.items.map(i => ({ label: i.label,
        value: draft.ratings[i.key] === null ? '未填写' : draft.ratings[i.key] + ' / 5' })) })),
      { title: '护理管理观察', step: 2, rows: [
        { label: '完整护理记录', value: label(VISIT_EVALUATION_OBSERVATION_OPTIONS, draft.careRecordLearned) },
        { label: '24小时交接', value: label(VISIT_EVALUATION_OBSERVATION_OPTIONS, draft.handoverLearned) },
        { label: '交接内容', value: draft.handoverTopics.map(k => label(VISIT_EVALUATION_HANDOVER_TOPICS, k)).join('、') || '未填写' }] },
      { title: '费用说明', step: 2, rows: [{ label: '收费介绍', value: draft.feeExplanationClear === 'clear' ? '清楚' : draft.feeExplanationClear === 'unclear' ? '不清楚' : '未填写' },
        ...VISIT_EVALUATION_FEE_TOPICS.map(t => ({ label: t.label, value: label(VISIT_EVALUATION_FEE_ANSWER_OPTIONS, draft.feeTopicExplanations[t.key]) }))] },
      { title: '标签与补充说明', step: 3, rows: [
        { label: '最满意', value: draft.likedTags.map(k => label(VISIT_EVALUATION_TAGS, k)).join('、') || '未选择' },
        { label: '最担心', value: draft.concernTags.map(k => label(VISIT_EVALUATION_TAGS, k)).join('、') || '未选择' },
        { label: '补充说明', value: draft.comment || '未填写' }] },
    ],
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
    feeTopicExplanations: createVisitEvaluationFeeTopicViewModel(draft),
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
  const providers = createProductionVisitEvaluationProvidersV1()
  const application = createVisitEvaluationUiApplicationV1({
    productionContextProvider: providers.contextProvider,
    productionSubmitProvider: providers.submitProvider,
    ...isolatedEvaluationProviders(),
  })
  page._visitEvaluationApplication = application
  return application
}

const loadContext = async (page: EvaluationPageInstance, visitId: string, preserveDraft = false): Promise<void> => {
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
      const saved = readEvaluationSession(visitId)
      const draft = saved ? saved.draft : preserveDraft ? cloneVisitEvaluationDraft(page.data.draft) : createEmptyVisitEvaluationDraft()
      page._visitEvaluationContext = result.context
      page.setData({
        ...createFormPatch(draft),
        pageState: saved && saved.submitted ? 'submitted' : 'editing',
        step: saved ? saved.step : 1,
        sessionEpoch: saved ? saved.epoch : -1,
        contextMode: 'test_only',
        contextMessage: (() => { const display = readEvaluationDisplay(visitId); return display ? display.institutionName + ' · ' + display.elderName : '本次演示看院记录' })(),
        statusMessage: '仅记录您的个人感受和现场观察。',
        submitButtonText: '提交看院评价',
        serverEvaluationId: saved && saved.submitted ? saved.evaluationId : '',
        serverSubmittedAt: '',
      })
      return
    }

    if (result.kind === 'eligible' && result.context.visitId === visitId && result.context.visitStatus === 'completed') {
      const draft = preserveDraft ? cloneVisitEvaluationDraft(page.data.draft) : createEmptyVisitEvaluationDraft()
      page._productionVisitEvaluationContext = result.context
      page.setData({
        ...createFormPatch(draft),
        pageState: 'editing',
        contextMode: 'production',
        contextMessage: '已确认该预约属于当前账号，且服务端记录的看院状态为已完成。',
        statusMessage: '评价仅记录本次用户观察，不会修改机构核验资料或推荐结果。',
        submitButtonText: '提交看院评价',
        feedbackMessage: '',
        serverEvaluationId: '',
        serverSubmittedAt: '',
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
    reserveFooter(page)
  }
}

const setDraft = (page: EvaluationPageInstance, draft: VisitEvaluationDraftV1): void => {
  if (page.data.contextMode === 'test_only' && !saveEvaluationSession(page.data.visitId, page.data.sessionEpoch, draft, page.data.step)) {
    page.setData({ pageState: 'unavailable', contextMode: 'none', contextMessage: '演示会话已重置，请返回预约列表重新进入。' })
    return
  }
  page.setData({
    ...createFormPatch(draft),
    pageState: page.data.pageState === 'submit_failed' ? 'editing' : page.data.pageState,
    submitButtonText: '提交看院评价',
    feedbackMessage: '',
    tagFeedbackGroup: '',
    tagFeedbackMessage: '',
    validationMessage: '',
    overallRatingValidationMessage: '',
    considerationValidationMessage: '',
  })
  reserveFooter(page)
}

// Presentation only: reveal the existing inline error below the fixed navigation bar.
const revealEvaluationError = (page: EvaluationPageInstance): void => {
  if (typeof wx.nextTick !== 'function' || typeof wx.createSelectorQuery !== 'function'
    || typeof wx.pageScrollTo !== 'function') return
  const selector = page.data.overallRatingValidationMessage
    ? '#evaluation-overall'
    : page.data.considerationValidationMessage ? '#evaluation-intent' : '#evaluation-confirmation'
  wx.nextTick(() => {
    const query = wx.createSelectorQuery()
    query.select(selector).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((results) => {
      const target = results[0] as { top: number } | null
      const viewport = results[1] as { scrollTop: number } | null
      if (!target || !viewport) return
      const scroll = (navigationHeight: number) => wx.pageScrollTo({
          scrollTop: Math.max(0, target.top + viewport.scrollTop - navigationHeight - 16),
          duration: 200,
          fail: () => { /* Inline errors remain available if scrolling is unsupported. */ },
        })
      const navigation = page.selectComponent && page.selectComponent('#evaluation-navigation')
      if (!navigation) return
      wx.createSelectorQuery().in(navigation)
        .select('.weui-navigation-bar__inner').boundingClientRect()
        .exec((rectangles) => {
          const rectangle = rectangles[0] as { height: number } | null
          if (rectangle) scroll(rectangle.height)
        })
    })
  })
}

Page({
  data: {
    footerReserve: 0,
    keyboardOpen: false,
    fontStyle: '',
    step: 1,
    sessionEpoch: -1,
    pageState: 'loading_context',
    contextMode: 'none',
    visitId: '',
    contextMessage: '正在检查预约评价条件。',
    statusMessage: '',
    feedbackMessage: '',
    tagFeedbackGroup: '',
    tagFeedbackMessage: '',
    validationMessage: '',
    overallRatingValidationMessage: '',
    considerationValidationMessage: '',
    submitButtonText: '提交看院评价',
    serverEvaluationId: '',
    serverSubmittedAt: '',
    submittedAtLabel: '',
    ...createFormPatch(createEmptyVisitEvaluationDraft()),
  } as VisitEvaluationPageData,

  onShow() {
    this.setData({ fontStyle: readBrowseFontStyle(), keyboardOpen: false })
    observeKeyboard(this)
    reserveFooter(this)
    if (this.data.contextMode !== 'test_only' || this.data.sessionEpoch < 0) return
    const saved = readEvaluationSession(this.data.visitId)
    if (!saved || saved.epoch !== this.data.sessionEpoch) {
      const page = this as unknown as EvaluationPageInstance
      page._visitEvaluationContext = undefined
      page._visitEvaluationApplication = undefined
      this.setData({ pageState: 'unavailable', contextMode: 'none', contextMessage: '演示会话已重置，请返回预约列表重新进入。' })
    } else if (saved.submitted) {
      this.setData({ ...createFormPatch(saved.draft), step: 3, pageState: 'submitted', serverEvaluationId: saved.evaluationId })
    }
  },
  onHide() { releaseKeyboard(this) },
  onUnload() { releaseKeyboard(this) },

  onPreviousStep() {
    if (!isDraftEditable(this.data.pageState) || this.data.step <= 1) return
    this.changeStep(this.data.step - 1)
  },
  onNextStep() {
    if (!isDraftEditable(this.data.pageState) || this.data.step >= 3) return
    if (this.data.step === 1) {
      const issues = validateVisitEvaluationDraft(this.data.draft)
      const overall = issues.some(i => i.path === 'overallRating'), consideration = issues.some(i => i.path === 'consideration')
      this.setData({ overallRatingValidationMessage: overall ? '请选择整体印象评分。' : '', considerationValidationMessage: consideration ? '请选择后续考虑。' : '' })
      if (overall || consideration) { revealEvaluationError(this); return }
    }
    this.changeStep(this.data.step + 1)
  },
  onEditGroup(event: DatasetEvent<{ step?: number }>) {
    if (!isDraftEditable(this.data.pageState)) return
    const step = Number(event.currentTarget.dataset.step)
    if ([1, 2, 3].includes(step)) this.changeStep(step)
  },
  changeStep(step: number) {
    this.setData({ step })
    reserveFooter(this)
    if (this.data.contextMode === 'test_only') saveEvaluationSession(this.data.visitId, this.data.sessionEpoch, this.data.draft, step)
    wx.pageScrollTo({ scrollTop: 0, duration: 0, fail: () => {} })
  },

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
    await loadContext(page, page.data.visitId, true)
  },

  onRatingTap(event: DatasetEvent<RatingActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const question = event.currentTarget.dataset.question || ''
    const value = Number(event.currentTarget.dataset.value)
    if (!isRatingQuestion(question)) return
    const nextDraft = setVisitEvaluationRating(page.data.draft, question, value)
    if (!nextDraft) return
    setDraft(page, nextDraft)
  },

  onConsiderationTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const value = event.currentTarget.dataset.value || ''
    if (!isConsideration(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.consideration = value
    setDraft(page, draft)
  },

  onObservationTap(event: DatasetEvent<ObservationActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const question = event.currentTarget.dataset.question
    const value = event.currentTarget.dataset.value || ''
    if ((question !== 'careRecordLearned' && question !== 'handoverLearned') || !isObservationAnswer(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    const selected = question === 'careRecordLearned' ? draft.careRecordLearned : draft.handoverLearned
    if (question === 'careRecordLearned') draft.careRecordLearned = selected === value ? '' : value
    else draft.handoverLearned = selected === value ? '' : value
    setDraft(page, draft)
  },

  onFeeClarityTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const value = event.currentTarget.dataset.value || ''
    if (!isFeeClarity(value)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.feeExplanationClear = draft.feeExplanationClear === value ? '' : value
    setDraft(page, draft)
  },

  onFeeTopicTap(event: DatasetEvent<FeeTopicActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const topic = event.currentTarget.dataset.topic || ''
    const value = event.currentTarget.dataset.value || ''
    if (!isFeeTopic(topic) || !isFeeAnswer(value) || value === '') return
    const selected = page.data.draft.feeTopicExplanations[topic]
    const next = setVisitEvaluationFeeTopic(page.data.draft, topic, selected === value ? '' : value)
    if (!next) return
    setDraft(page, next)
  },

  onHandoverTopicTap(event: DatasetEvent<StringActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
    const value = event.currentTarget.dataset.value || ''
    if (!isHandoverTopic(value)) return
    setDraft(page, toggleVisitEvaluationHandoverTopic(page.data.draft, value))
  },

  onTagTap(event: DatasetEvent<TagActionDataset>) {
    const page = this as unknown as EvaluationPageInstance
    if (!isDraftEditable(page.data.pageState)) return
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
    if (!isDraftEditable(page.data.pageState)) return
    const draft = cloneVisitEvaluationDraft(page.data.draft)
    draft.comment = truncateVisitEvaluationComment(typeof event.detail.value === 'string' ? event.detail.value : '')
    setDraft(page, draft)
  },

  async onSubmit() {
    const page = this as unknown as EvaluationPageInstance
    if ((page.data.pageState !== 'editing' && page.data.pageState !== 'submit_failed')
      || page._visitEvaluationSubmitLocked
      || (!page._visitEvaluationContext && !page._productionVisitEvaluationContext)) return
    const validationIssues = validateVisitEvaluationDraft(page.data.draft)
    if (validationIssues.length > 0) {
      page.setData({
        validationMessage: '请补全必填项，并检查评分、费用、标签、观察和补充说明。',
        overallRatingValidationMessage: validationIssues.some((issue) => issue.path === 'overallRating')
          ? '请选择整体印象评分。'
          : '',
        considerationValidationMessage: validationIssues.some((issue) => issue.path === 'consideration')
          ? '请选择后续考虑。'
          : '',
        feedbackMessage: '',
      })
      revealEvaluationError(page)
      return
    }

    page._visitEvaluationSubmitLocked = true
    const testContext = page._visitEvaluationContext
    const productionContext = page._productionVisitEvaluationContext
    const isTestOnly = Boolean(testContext)
    page.setData({
      pageState: 'submitting',
      submitButtonText: isTestOnly ? '正在提交评价' : '正在提交评价',
      validationMessage: '',
      feedbackMessage: '',
    })
    try {
      const application = getApplication(page)
      if (testContext) {
        const result = await application.submit(testContext, cloneVisitEvaluationDraft(page.data.draft))
        if (result.kind === 'submitted_test_only') {
          const saved = readEvaluationSession(page.data.visitId)
          page.setData({
            pageState: 'submitted',
            submitButtonText: '评价已保存',
            feedbackMessage: '演示评价已保存，可返回预约记录再次查看。',
            serverEvaluationId: saved ? saved.evaluationId : '',
          })
        } else {
          page.setData({
            pageState: 'submit_failed',
            submitButtonText: '重试提交',
            feedbackMessage: '暂未保存成功，已保留全部填写内容，可重试。',
          })
        }
        return
      }

      if (!productionContext) return
      const result = await application.submitProduction(productionContext, cloneVisitEvaluationDraft(page.data.draft))
      if (result.kind === 'submitted') {
        page.setData({
          pageState: 'submitted',
          submitButtonText: '评价已提交',
          serverEvaluationId: result.receipt.evaluationId,
          serverSubmittedAt: result.receipt.submittedAt,
          submittedAtLabel: formatChinaDateTime(result.receipt.submittedAt),
          feedbackMessage: result.replayed
            ? '已确认这份评价此前提交成功。'
            : '看院评价已提交。评价仅代表本次用户观察。',
        })
      } else if (result.kind === 'invalid_draft') {
        page.setData({
          pageState: 'editing',
          submitButtonText: '提交看院评价',
          validationMessage: '请补全必填项，并检查评价内容后重试。',
        })
        revealEvaluationError(page)
      } else if (result.kind === 'validation_failed') {
        page.setData({
          pageState: 'editing',
          submitButtonText: '提交看院评价',
          validationMessage: '服务端未接受这些评价内容，请检查表单并修正后重试。',
          overallRatingValidationMessage: result.fieldErrors.some((issue) => issue.field === 'overallRating')
            ? '请检查整体印象评分。'
            : '',
          considerationValidationMessage: result.fieldErrors.some((issue) => issue.field === 'consideration')
            ? '请检查后续考虑。'
            : '',
        })
        revealEvaluationError(page)
      } else if (result.kind === 'auth_required') {
        page._productionVisitEvaluationContext = undefined
        page.setData({
          pageState: 'auth_required',
          contextMode: 'none',
          contextMessage: '当前账号验证已失效。请重新验证账号后继续；本地填写内容会保留。',
          statusMessage: '',
        })
      } else if (result.kind === 'not_found') {
        page._productionVisitEvaluationContext = undefined
        page.setData({
          pageState: 'denied',
          contextMode: 'none',
          contextMessage: '无法读取这条预约记录。记录可能不存在，或当前账号无权查看。',
          statusMessage: '',
        })
      } else if (result.kind === 'not_completed') {
        page._productionVisitEvaluationContext = undefined
        page.setData({
          pageState: 'not_completed',
          contextMode: 'none',
          contextMessage: '服务端当前记录的预约状态不允许提交看院评价。',
          statusMessage: '',
        })
      } else if (result.kind === 'already_submitted') {
        page._productionVisitEvaluationContext = undefined
        page.setData({
          pageState: 'already_submitted',
          contextMode: 'none',
          contextMessage: '这条预约已有已提交的看院评价，不能再次提交。',
          statusMessage: '',
        })
      } else if (result.kind === 'idempotency_conflict') {
        page.setData({
          pageState: 'submission_conflict',
          contextMode: 'none',
          contextMessage: '本次提交状态与当前草稿不一致。为避免覆盖已提交内容，请返回预约列表后重新进入。',
          statusMessage: '',
        })
      } else {
        page.setData({
          pageState: 'submit_failed',
          submitButtonText: '重试提交评价',
          feedbackMessage: '暂时无法确认提交结果，已保留全部内容；可用相同内容重试。',
        })
      }
    } catch (_error) {
      page.setData({
        pageState: 'submit_failed',
        submitButtonText: isTestOnly ? '重试提交' : '重试提交评价',
        feedbackMessage: isTestOnly
          ? '暂未保存成功，已保留全部填写内容，可重试。'
          : '暂时无法确认提交结果，已保留全部内容；可用相同内容重试。',
      })
    } finally {
      page._visitEvaluationSubmitLocked = false
      reserveFooter(page)
    }
  },
})
