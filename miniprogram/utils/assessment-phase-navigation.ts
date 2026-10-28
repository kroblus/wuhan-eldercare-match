import { assessmentDraftStore } from '../store/assessment-draft'
import type { AssessmentDraftV2 } from '../types/assessment-v2'
import type { AssessmentStepId } from '../types/assessment'
import { scrollToAssessmentQuestion } from './assessment-validation'
import { validateAssessmentDraftForCompletionV2 } from '../types/assessment-v2'
import { getAssessmentResumeDestinationV2, getAssessmentResumeRouteV2 } from './assessment-resume'
import { getNavigationGuard } from './navigation-guard'

export type AssessmentPhaseIntentSource =
  | 'assessment-forward'
  | 'assessment-resume'
  | 'profile-edit'
  | 'profile-recovery'

export interface AssessmentPhaseIntentView {
  step: AssessmentStepId
  source: AssessmentPhaseIntentSource
}

type AssessmentStackPage = {
  route?: unknown
}

type CapacityNavigationApi = 'navigateTo' | 'redirectTo' | 'navigateBack' | 'reLaunch'

interface StackEntrySnapshot {
  page: object
  route: string
}

interface DraftStamp {
  localDraftId: string
  currentStep: AssessmentStepId
  updatedAt: string
}

interface PageActionLease {
  page: object
  action: string
  token: number
  active: boolean
}

interface SourceOperation {
  token: number
  page: object
  target: AssessmentStepId
  source: AssessmentPhaseIntentSource
  action: string
  lease: PageActionLease
  stack: StackEntrySnapshot[]
  draftStamp: DraftStamp
  beforeNavigate?: () => boolean
  onFailure?: () => void
  resetStarted: boolean
  active: boolean
}

// The cross-page handoff carries only an approved step/source pair and an
// unguessable in-module operation token. Draft identity/answers stay local to
// the source operation and are independently read again by Intro.
interface PendingHandoff extends AssessmentPhaseIntentView {
  token: number
}

interface PageNavigationCallbacks {
  success?: () => void
  fail?: () => void
  complete?: () => void
}

interface IntentCallbacks {
  onConsumed: () => void
  onFailure: () => void
  onChanged: (intent: AssessmentPhaseIntentView, message: string) => void
  onInvalid: (message: string) => void
}

const ASSESSMENT_STEPS: AssessmentStepId[] = [
  'basic', 'health', 'adl', 'cognitive', 'preference', 'budget',
]

const ASSESSMENT_ROUTES: Record<AssessmentStepId, string> = {
  basic: '/pages/assessment/basic',
  health: '/pages/assessment/health',
  adl: '/pages/assessment/adl',
  cognitive: '/pages/assessment/cognitive',
  preference: '/pages/assessment/preference',
  budget: '/pages/assessment/budget',
}

const ASSESSMENT_STEP_LABELS: Record<AssessmentStepId, string> = {
  basic: '老人基本情况',
  health: '健康情况',
  adl: '生活自理情况',
  cognitive: '认知与特殊护理',
  preference: '养老需求与偏好',
  budget: '预算与入住计划',
}

// The signed B01 analysis uses WeChat's existing ten-page stack ceiling. This
// local guard is not a product limit or a guarantee for every device/runtime.
const ASSESSMENT_STACK_CAPACITY = 10

const sourceOperations = new WeakMap<object, SourceOperation>()
const pageActions = new WeakMap<object, PageActionLease>()
const introIntents = new WeakMap<object, AssessmentPhaseIntentView & {
  token: number
  draftStamp: DraftStamp
}>()
let pendingHandoff: PendingHandoff | null = null
let nextOperationToken = 0

const normalizeRoute = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.split(/[?#]/, 1)[0].replace(/^\/+/, '').replace(/\/+$/, '')
}

const routeForStep = (step: AssessmentStepId): string => ASSESSMENT_ROUTES[step]

export const getAssessmentPhaseStepLabel = (step: AssessmentStepId): string =>
  ASSESSMENT_STEP_LABELS[step]

export const getAssessmentStepFromRoute = (route: string): AssessmentStepId | null => {
  const normalized = normalizeRoute(route)
  const match = ASSESSMENT_STEPS.find((step) => normalizeRoute(routeForStep(step)) === normalized)
  return match || null
}

export const getAssessmentPhaseIntentView = (page: object): AssessmentPhaseIntentView | null => {
  const intent = introIntents.get(page)
  return intent ? { step: intent.step, source: intent.source } : null
}

const getCurrentStack = (): AssessmentStackPage[] | null => {
  try {
    const pages = getCurrentPages() as AssessmentStackPage[]
    if (!Array.isArray(pages) || pages.length === 0) return null
    if (pages.some((page) => !page || typeof page !== 'object' || !normalizeRoute(page.route))) return null
    return pages
  } catch (_error) {
    return null
  }
}

const getDraftStamp = (): DraftStamp | null => {
  try {
    const draft = assessmentDraftStore.getDraft() as AssessmentDraftV2
    if (!draft || typeof draft.localDraftId !== 'string'
      || typeof draft.updatedAt !== 'string'
      || ASSESSMENT_STEPS.indexOf(draft.currentStep) < 0) {
      return null
    }
    return {
      localDraftId: draft.localDraftId,
      currentStep: draft.currentStep,
      updatedAt: draft.updatedAt,
    }
  } catch (_error) {
    return null
  }
}

const sameDraftStamp = (left: DraftStamp, right: DraftStamp | null): boolean => Boolean(
  right
  && left.localDraftId === right.localDraftId
  && left.currentStep === right.currentStep
  && left.updatedAt === right.updatedAt,
)

const snapshotStack = (pages: AssessmentStackPage[]): StackEntrySnapshot[] => pages.map((page) => ({
  page: page as object,
  route: normalizeRoute(page.route),
}))

const stackMatches = (snapshot: StackEntrySnapshot[]): boolean => {
  const pages = getCurrentStack()
  if (!pages || pages.length !== snapshot.length) return false
  return pages.every((page, index) =>
    page === snapshot[index].page && normalizeRoute(page.route) === snapshot[index].route)
}

const isCurrentPage = (page: object, expectedRoute?: string): boolean => {
  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page) return false
  return !expectedRoute || normalizeRoute(pages[pages.length - 1].route) === normalizeRoute(expectedRoute)
}

const getStepIndex = (step: AssessmentStepId): number => ASSESSMENT_STEPS.indexOf(step)

const requiredPeakDepth = (depthAfterEntry: number, target: AssessmentStepId): number =>
  depthAfterEntry + ASSESSMENT_STEPS.length - 1 - getStepIndex(target)

const sourceMatchesPage = (
  source: AssessmentPhaseIntentSource,
  route: string,
  target: AssessmentStepId,
): boolean => {
  if (source === 'assessment-forward') {
    const targetIndex = getStepIndex(target)
    return targetIndex > 0 && route === normalizeRoute(routeForStep(ASSESSMENT_STEPS[targetIndex - 1]))
  }
  if (source === 'assessment-resume') return route === 'pages/assessment/intro'
  return route === 'pages/assessment/profile'
}

const acquirePageAction = (page: object, action: string): PageActionLease | null => {
  const current = pageActions.get(page)
  if (current && current.active) return null
  const guard = getNavigationGuard(page)
  if (!guard.acquire(action)) return null
  const lease: PageActionLease = { page, action, token: ++nextOperationToken, active: true }
  pageActions.set(page, lease)
  return lease
}

const finishPageAction = (lease: PageActionLease, releaseGuard: boolean): void => {
  if (!lease.active) return
  lease.active = false
  if (pageActions.get(lease.page) === lease) pageActions.delete(lease.page)
  if (releaseGuard) getNavigationGuard(lease.page).release(lease.action)
}

/** Reserve one page-local interaction across different action names. */
export const beginAssessmentPageAction = (page: object, action: string): boolean =>
  acquirePageAction(page, action) !== null

/** Release a reservation made by beginAssessmentPageAction. */
export const endAssessmentPageAction = (page: object, action: string): void => {
  const lease = pageActions.get(page)
  if (lease && lease.action === action) finishPageAction(lease, true)
}

export const isAssessmentPageActionActive = (page: object, action: string): boolean => {
  const lease = pageActions.get(page)
  return Boolean(lease && lease.active && lease.action === action)
}

/** Reset local and legacy action guards when a page becomes current again. */
export const resetAssessmentPageNavigation = (page: object): void => {
  const lease = pageActions.get(page)
  if (lease) finishPageAction(lease, false)
  getNavigationGuard(page).reset()
}

const sameOperationIsActive = (operation: SourceOperation): boolean =>
  operation.active && sourceOperations.get(operation.page) === operation

const finishSourceOperation = (operation: SourceOperation, releaseGuard: boolean): void => {
  operation.active = false
  if (sourceOperations.get(operation.page) === operation) sourceOperations.delete(operation.page)
  finishPageAction(operation.lease, releaseGuard)
}

/** Invalidate a pending confirmation/current local action before explicit Back. */
export const invalidateAssessmentPageAction = (page: object): void => {
  const operation = sourceOperations.get(page)
  if (operation && !operation.resetStarted) {
    finishSourceOperation(operation, true)
    return
  }
  if (operation && operation.resetStarted) return
  const lease = pageActions.get(page)
  if (lease) finishPageAction(lease, true)
}

/**
 * A confirmed reset is already in flight when its source hides. Retire the
 * source operation while leaving its one-slot handoff available to Intro.
 * Other unconfirmed prompts are invalidated, so late modal callbacks do no work.
 */
export const onHideAssessmentPhasePage = (page: object): void => {
  const route = normalizeRoute((page as AssessmentStackPage).route)
  const operation = sourceOperations.get(page)
  if (operation) {
    finishSourceOperation(operation, true)
  } else if (route === 'pages/assessment/intro') {
    const lease = pageActions.get(page)
    if (lease) finishPageAction(lease, true)
  }
  if (route === 'pages/assessment/intro') introIntents.delete(page)
}

export const onUnloadAssessmentPhasePage = (page: object): void => {
  const route = normalizeRoute((page as AssessmentStackPage).route)
  onHideAssessmentPhasePage(page)
  const lease = pageActions.get(page)
  if (lease) finishPageAction(lease, true)
  if (route === 'pages/assessment/intro') introIntents.delete(page)
}

const notifyCurrentPageFailure = (page: object, onFailure?: () => void): void => {
  if (onFailure && isCurrentPage(page)) onFailure()
}

const makeNavigationCallbacks = (
  page: object,
  action: string,
  onFailure?: () => void,
  onSuccess?: () => void,
): { callbacks: PageNavigationCallbacks, lease: PageActionLease } | null => {
  const lease = acquirePageAction(page, action)
  if (!lease) return null
  let succeeded = false
  let failureHandled = false
  const fail = () => {
    if (failureHandled || !lease.active) return
    failureHandled = true
    finishPageAction(lease, true)
    notifyCurrentPageFailure(page, onFailure)
  }
  return {
    lease,
    callbacks: {
      success: () => {
        if (succeeded || failureHandled || !lease.active) return
        succeeded = true
        if (onSuccess) onSuccess()
      },
      fail,
      complete: () => {
        if (!succeeded) fail()
      },
    },
  }
}

const invokeSingleNavigation = (
  page: object,
  action: string,
  api: CapacityNavigationApi,
  url: string,
  delta: number,
  onFailure?: () => void,
  onSuccess?: () => void,
): boolean => {
  const prepared = makeNavigationCallbacks(page, action, onFailure)
  if (!prepared) return false
  const callbacks = prepared.callbacks
  if (onSuccess) {
    // A source page may unload before navigateBack succeeds. The target-only
    // scroll must survive that lifecycle; business guard callbacks stay intact.
    const success = callbacks.success
    const fail = callbacks.fail
    const complete = callbacks.complete
    let settled = false
    callbacks.success = () => {
      if (settled) return
      settled = true
      if (success) success()
      onSuccess()
    }
    callbacks.fail = () => {
      if (settled) return
      settled = true
      if (fail) fail()
    }
    callbacks.complete = () => {
      settled = true
      if (complete) complete()
    }
  }
  const options = api === 'navigateBack'
    ? { delta, ...callbacks }
    : { url, ...callbacks }
  try {
    if (api === 'navigateBack') {
      wx.navigateBack(options as WechatMiniprogram.NavigateBackOption)
    } else if (api === 'redirectTo') {
      wx.redirectTo(options as WechatMiniprogram.RedirectToOption)
    } else if (api === 'reLaunch') {
      wx.reLaunch(options as WechatMiniprogram.ReLaunchOption)
    } else {
      wx.navigateTo(options as WechatMiniprogram.NavigateToOption)
    }
  } catch (_error) {
    callbacks.fail && callbacks.fail()
    return false
  }
  return true
}

const capacityCopy = (target: AssessmentStepId, source: AssessmentPhaseIntentSource): string => {
  const label = ASSESSMENT_STEP_LABELS[target]
  const verb = source === 'profile-edit'
    ? '继续修改'
    : source === 'profile-recovery'
      ? '继续补充'
      : '继续填写'
  return `继续操作需要离开当前浏览路径。确认后只会打开“评估说明”；之后还要由您再次点击“${verb}：${label}”才会进入目标步骤。只有本机已成功保存的草稿会保留，未成功保存的内容不承诺保留。`
}

const issueIntroReset = (operation: SourceOperation): void => {
  if (!sameOperationIsActive(operation) || operation.resetStarted) return
  const currentRoute = operation.stack[operation.stack.length - 1].route
  if (!isCurrentPage(operation.page, currentRoute)
    || !stackMatches(operation.stack)
    || !sameDraftStamp(operation.draftStamp, getDraftStamp())
    || !sourceMatchesPage(operation.source, currentRoute, operation.target)) {
    finishSourceOperation(operation, true)
    notifyCurrentPageFailure(operation.page, operation.onFailure)
    return
  }

  operation.resetStarted = true
  if (operation.beforeNavigate && !operation.beforeNavigate()) {
    finishSourceOperation(operation, true)
    return
  }

  if (!isCurrentPage(operation.page, currentRoute) || !stackMatches(operation.stack)) {
    finishSourceOperation(operation, true)
    notifyCurrentPageFailure(operation.page, operation.onFailure)
    return
  }

  if (pendingHandoff) {
    finishSourceOperation(operation, true)
    notifyCurrentPageFailure(operation.page, operation.onFailure)
    return
  }

  const handoff: PendingHandoff = {
    token: operation.token,
    step: operation.target,
    source: operation.source,
  }
  pendingHandoff = handoff
  const query = `phaseStep=${operation.target}&phaseSource=${operation.source}`
  let navigationSucceeded = false
  let settled = false
  const fail = () => {
    if (settled) return
    settled = true
    if (pendingHandoff && pendingHandoff.token === operation.token) pendingHandoff = null
    const wasActive = sameOperationIsActive(operation)
    finishSourceOperation(operation, true)
    if (wasActive) notifyCurrentPageFailure(operation.page, operation.onFailure)
  }
  const success = () => {
    if (settled) return
    settled = true
    navigationSucceeded = true
    finishSourceOperation(operation, false)
  }

  try {
    wx.reLaunch({
      url: `/pages/assessment/intro?${query}`,
      success,
      fail,
      complete: () => {
        if (!navigationSucceeded) fail()
      },
    })
  } catch (_error) {
    fail()
  }
}

const beginCapacityReset = (
  page: object,
  target: AssessmentStepId,
  source: AssessmentPhaseIntentSource,
  action: string,
  pages: AssessmentStackPage[],
  onFailure?: () => void,
  beforeNavigate?: () => boolean,
): boolean => {
  const route = normalizeRoute(pages[pages.length - 1].route)
  if (!sourceMatchesPage(source, route, target) || pendingHandoff) {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }

  const existing = sourceOperations.get(page)
  if (existing) return false

  const lease = acquirePageAction(page, action)
  if (!lease) return false
  const draftStamp = getDraftStamp()
  if (!draftStamp) {
    finishPageAction(lease, true)
    notifyCurrentPageFailure(page, onFailure)
    return false
  }

  const operation: SourceOperation = {
    token: ++nextOperationToken,
    page,
    target,
    source,
    action,
    lease,
    stack: snapshotStack(pages),
    draftStamp,
    beforeNavigate,
    onFailure,
    resetStarted: false,
    active: true,
  }
  sourceOperations.set(page, operation)

  try {
    wx.showModal({
      title: '需要重新进入评估',
      content: capacityCopy(target, source),
      confirmText: '前往说明',
      cancelText: '暂不离开',
      success: (result) => {
        if (!sameOperationIsActive(operation) || operation.resetStarted) return
        if (!result.confirm) {
          finishSourceOperation(operation, true)
          return
        }
        issueIntroReset(operation)
      },
      fail: () => {
        if (!sameOperationIsActive(operation)) return
        finishSourceOperation(operation, true)
        notifyCurrentPageFailure(page, onFailure)
      },
    })
  } catch (_error) {
    if (sameOperationIsActive(operation)) finishSourceOperation(operation, true)
    notifyCurrentPageFailure(page, onFailure)
    return false
  }
  return true
}

export const navigateAssessmentForwardWithCapacity = (
  page: object,
  currentStep: AssessmentStepId,
  targetStep: AssessmentStepId,
  action: string,
  beforeNavigate: () => boolean,
  onFailure: () => void,
): boolean => {
  const currentIndex = getStepIndex(currentStep)
  const targetIndex = getStepIndex(targetStep)
  if (targetIndex !== currentIndex + 1) return false

  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page
    || normalizeRoute(pages[pages.length - 1].route) !== normalizeRoute(routeForStep(currentStep))) {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }

  const depthAfterEntry = pages.length + 1
  if (requiredPeakDepth(depthAfterEntry, targetStep) <= ASSESSMENT_STACK_CAPACITY) {
    const prepared = makeNavigationCallbacks(page, action, onFailure)
    if (!prepared) return false
    if (!beforeNavigate()) {
      finishPageAction(prepared.lease, true)
      return false
    }
    try {
      wx.navigateTo({ url: routeForStep(targetStep), ...prepared.callbacks })
      return true
    } catch (_error) {
      prepared.callbacks.fail && prepared.callbacks.fail()
      return false
    }
  }

  return beginCapacityReset(
    page,
    targetStep,
    'assessment-forward',
    action,
    pages,
    onFailure,
    beforeNavigate,
  )
}

export const navigateAssessmentFromIntroWithCapacity = (
  page: object,
  targetStep: AssessmentStepId,
  action: string,
  onFailure: () => void,
): boolean => {
  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page
    || normalizeRoute(pages[pages.length - 1].route) !== 'pages/assessment/intro') {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }

  // Preserve the ordinary root Intro redirect. The one-time reset intent uses
  // a separate explicit navigateTo path below.
  const api: CapacityNavigationApi = pages.length <= 1 ? 'redirectTo' : 'navigateTo'
  const depthAfterEntry = api === 'redirectTo' ? pages.length : pages.length + 1
  if (requiredPeakDepth(depthAfterEntry, targetStep) <= ASSESSMENT_STACK_CAPACITY) {
    return invokeSingleNavigation(page, action, api, routeForStep(targetStep), 0, onFailure)
  }

  return beginCapacityReset(page, targetStep, 'assessment-resume', action, pages, onFailure)
}

const isLegalAssessmentAncestor = (
  pages: AssessmentStackPage[],
  targetIndex: number,
  profileIndex: number,
  targetStep: AssessmentStepId,
): boolean => {
  const expected = ASSESSMENT_STEPS.slice(getStepIndex(targetStep))
    .map((step) => normalizeRoute(routeForStep(step)))
  expected.push('pages/assessment/profile')
  const actual = pages.slice(targetIndex, profileIndex + 1)
    .map((page) => normalizeRoute(page.route))
  return actual.length === expected.length
    && actual.every((route, index) => route === expected[index])
}

const findLegalStepAncestor = (
  pages: AssessmentStackPage[],
  targetStep: AssessmentStepId,
): number => {
  const profileIndex = pages.length - 1
  const targetRoute = normalizeRoute(routeForStep(targetStep))
  for (let index = profileIndex - 1; index >= 0; index -= 1) {
    if (normalizeRoute(pages[index].route) === targetRoute
      && isLegalAssessmentAncestor(pages, index, profileIndex, targetStep)) {
      return index
    }
  }
  return -1
}

export type ProfileAssessmentEntryResult = 'navigateBack' | 'navigateTo' | 'capacityConfirmation' | null

export const navigateProfileToAssessmentStep = (
  page: object,
  targetStep: AssessmentStepId,
  source: 'profile-edit' | 'profile-recovery',
  action: string,
  onFailure: () => void,
  focusSpecialCare = false,
): ProfileAssessmentEntryResult => {
  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page
    || normalizeRoute(pages[pages.length - 1].route) !== 'pages/assessment/profile') {
    notifyCurrentPageFailure(page, onFailure)
    return null
  }

  const ancestorIndex = findLegalStepAncestor(pages, targetStep)
  if (ancestorIndex >= 0) {
    const depthAfterBack = ancestorIndex + 1
    if (requiredPeakDepth(depthAfterBack, targetStep) <= ASSESSMENT_STACK_CAPACITY) {
      const delta = pages.length - 1 - ancestorIndex
      const focusTarget = focusSpecialCare && targetStep === 'cognitive'
        ? () => {
          const current = getCurrentStack()
          if (current && current[current.length - 1] === pages[ancestorIndex]
            && normalizeRoute(current[current.length - 1].route) === 'pages/assessment/cognitive') {
            scrollToAssessmentQuestion('cognitive.specialCareNeeds')
          }
        }
        : undefined
      const invoked = invokeSingleNavigation(page, action, 'navigateBack', '', delta, onFailure, focusTarget)
      return invoked ? 'navigateBack' : null
    }
    const prompted = beginCapacityReset(page, targetStep, source, action, pages, onFailure)
    return prompted ? 'capacityConfirmation' : null
  }

  const depthAfterPush = pages.length + 1
  if (requiredPeakDepth(depthAfterPush, targetStep) <= ASSESSMENT_STACK_CAPACITY) {
    const url = routeForStep(targetStep) + (focusSpecialCare && targetStep === 'cognitive' ? '?focus=special-care' : '')
    const invoked = invokeSingleNavigation(page, action, 'navigateTo', url, 0, onFailure)
    return invoked ? 'navigateTo' : null
  }
  const prompted = beginCapacityReset(page, targetStep, source, action, pages, onFailure)
  return prompted ? 'capacityConfirmation' : null
}

/** Profile may return to Intro when no valid step is known; never reset that path silently. */
export const navigateProfileToIntro = (
  page: object,
  action: string,
  onFailure: () => void,
): boolean => {
  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page
    || normalizeRoute(pages[pages.length - 1].route) !== 'pages/assessment/profile') {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }
  if (pages.length >= ASSESSMENT_STACK_CAPACITY) {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }
  return invokeSingleNavigation(page, action, 'navigateTo', '/pages/assessment/intro', 0, onFailure)
}

export const reLaunchAssessmentProfileWithGuard = (
  page: object,
  action: string,
  onFailure: () => void,
): boolean => {
  const pages = getCurrentStack()
  if (!pages || pages[pages.length - 1] !== page
    || normalizeRoute(pages[pages.length - 1].route) !== 'pages/assessment/budget') {
    notifyCurrentPageFailure(page, onFailure)
    return false
  }
  return invokeSingleNavigation(page, action, 'reLaunch', '/pages/assessment/profile', 0, onFailure)
}

const isAssessmentStep = (value: unknown): value is AssessmentStepId =>
  typeof value === 'string' && ASSESSMENT_STEPS.indexOf(value as AssessmentStepId) >= 0

const isIntentSource = (value: unknown): value is AssessmentPhaseIntentSource =>
  value === 'assessment-forward'
  || value === 'assessment-resume'
  || value === 'profile-edit'
  || value === 'profile-recovery'

const isValidIntentPair = (step: AssessmentStepId, source: AssessmentPhaseIntentSource): boolean =>
  source !== 'assessment-forward' || getStepIndex(step) > 0

export interface AssessmentPhaseIntentAcceptance {
  intent: AssessmentPhaseIntentView | null
  invalid: boolean
}

/** Accept only a one-time local handoff created immediately before an authorized reLaunch. */
export const acceptAssessmentPhaseIntent = (
  page: object,
  options: Record<string, unknown> | undefined,
): AssessmentPhaseIntentAcceptance => {
  const hasIntentQuery = Boolean(options
    && (Object.prototype.hasOwnProperty.call(options, 'phaseStep')
      || Object.prototype.hasOwnProperty.call(options, 'phaseSource')))
  const handoff = pendingHandoff
  pendingHandoff = null
  if (!hasIntentQuery) return { intent: null, invalid: Boolean(handoff) }

  const queryStep = options && options.phaseStep
  const querySource = options && options.phaseSource
  const keys = options ? Object.keys(options).sort() : []
  const exactQueryShape = keys.length === 2 && keys[0] === 'phaseSource' && keys[1] === 'phaseStep'
  const pages = getCurrentStack()
  const authorized = Boolean(
    exactQueryShape
    && isAssessmentStep(queryStep)
    && isIntentSource(querySource)
    && isValidIntentPair(queryStep, querySource)
    && handoff
    && handoff.step === queryStep
    && handoff.source === querySource
    && handoff.token > 0
    && pages
    && pages.length === 1
    && pages[0] === page
    && normalizeRoute(pages[0].route) === 'pages/assessment/intro',
  )
  const draftStamp = authorized ? getDraftStamp() : null
  if (!authorized || !handoff || !draftStamp) return { intent: null, invalid: true }

  introIntents.set(page, {
    step: handoff.step,
    source: handoff.source,
    token: handoff.token,
    draftStamp,
  })
  return { intent: { step: handoff.step, source: handoff.source }, invalid: false }
}

const firstMissingStep = (draft: AssessmentDraftV2): AssessmentStepId | null => {
  const destination = getAssessmentResumeDestinationV2(draft)
  return destination ? destination.step : null
}

const stepForDraftResume = (draft: AssessmentDraftV2): AssessmentStepId => {
  const route = getAssessmentResumeRouteV2(draft)
  return getAssessmentStepFromRoute(route) || 'basic'
}

const updateIntentTarget = (
  page: object,
  intent: AssessmentPhaseIntentView & { token: number, draftStamp: DraftStamp },
  target: AssessmentStepId | null,
  source: AssessmentPhaseIntentSource,
  draftStamp: DraftStamp,
  callbacks: IntentCallbacks,
): false => {
  if (!target) {
    introIntents.delete(page)
    callbacks.onInvalid('评估内容已更新，原来的进入目标已失效。请返回首页后重新开始或继续评估。')
    return false
  }
  const nextIntent = { step: target, source, token: intent.token, draftStamp }
  introIntents.set(page, nextIntent)
  callbacks.onChanged(
    { step: target, source },
    `草稿状态已更新，建议先进入“${ASSESSMENT_STEP_LABELS[target]}”。请确认后再次点击继续。`,
  )
  return false
}

const revalidatedIntentTarget = (
  intent: AssessmentPhaseIntentView & { token: number, draftStamp: DraftStamp },
  draft: AssessmentDraftV2,
): { step: AssessmentStepId | null, source: AssessmentPhaseIntentSource } => {
  const completion = validateAssessmentDraftForCompletionV2(draft.answers)
  if (intent.source === 'profile-edit') {
    if (completion.valid) return { step: intent.step, source: intent.source }
    return { step: firstMissingStep(draft), source: 'profile-recovery' }
  }
  if (intent.source === 'profile-recovery') {
    return { step: completion.valid ? null : firstMissingStep(draft), source: intent.source }
  }
  if (intent.source === 'assessment-forward' && completion.valid) {
    return { step: intent.step, source: intent.source }
  }
  const resumeStep = stepForDraftResume(draft)
  if (intent.source === 'assessment-forward' && resumeStep === intent.step) {
    return { step: intent.step, source: intent.source }
  }
  return { step: resumeStep, source: 'assessment-resume' }
}

const validateRetryableIntroIntent = (
  page: object,
  intent: AssessmentPhaseIntentView & { token: number, draftStamp: DraftStamp },
  callbacks: IntentCallbacks,
): boolean => {
  if (!isCurrentPage(page, '/pages/assessment/intro')) return false
  const pages = getCurrentStack()
  if (!pages || pages.length !== 1 || pages[0] !== page) return false
  const draft = assessmentDraftStore.getDraft() as AssessmentDraftV2
  const stamp = getDraftStamp()
  if (!stamp) return false
  const refreshed = revalidatedIntentTarget(intent, draft)
  if (refreshed.step !== intent.step || refreshed.source !== intent.source) {
    updateIntentTarget(page, intent, refreshed.step, refreshed.source, stamp, callbacks)
    return false
  }
  return true
}

/** Revalidate and explicitly enter a reset target. It never auto-runs on Intro load. */
export const navigateAssessmentIntentFromIntro = (
  page: object,
  action: string,
  callbacks: IntentCallbacks,
): boolean => {
  const intent = introIntents.get(page)
  if (!intent) return false
  const pages = getCurrentStack()
  if (!pages || pages.length !== 1 || pages[0] !== page
    || normalizeRoute(pages[0].route) !== 'pages/assessment/intro') {
    introIntents.delete(page)
    callbacks.onInvalid('本次评估入口已失效，请从首页重新进入评估。')
    return false
  }

  let draft: AssessmentDraftV2
  let draftStamp: DraftStamp | null
  try {
    draft = assessmentDraftStore.getDraft() as AssessmentDraftV2
    draftStamp = getDraftStamp()
  } catch (_error) {
    introIntents.delete(page)
    callbacks.onInvalid('当前草稿暂时无法读取，请返回首页后重新进入评估。')
    return false
  }
  if (!draftStamp) {
    introIntents.delete(page)
    callbacks.onInvalid('当前草稿暂时无法读取，请返回首页后重新进入评估。')
    return false
  }

  const refreshed = revalidatedIntentTarget(intent, draft)
  if (refreshed.step !== intent.step || refreshed.source !== intent.source) {
    return updateIntentTarget(page, intent, refreshed.step, refreshed.source, draftStamp, callbacks)
  }

  const target = refreshed.step
  if (!target) {
    introIntents.delete(page)
    callbacks.onInvalid('本次评估进入目标已失效，请返回首页重新进入。')
    return false
  }

  const depthAfterEntry = pages.length + 1
  if (requiredPeakDepth(depthAfterEntry, target) > ASSESSMENT_STACK_CAPACITY) {
    callbacks.onFailure()
    return false
  }

  const lease = acquirePageAction(page, action)
  if (!lease) return false
  const latestPages = getCurrentStack()
  const latestStamp = getDraftStamp()
  if (!latestPages || latestPages.length !== 1 || latestPages[0] !== page
    || !sameDraftStamp(draftStamp, latestStamp)) {
    finishPageAction(lease, true)
    if (latestStamp) {
      const latestDraft = assessmentDraftStore.getDraft() as AssessmentDraftV2
      const current = revalidatedIntentTarget(intent, latestDraft)
      return updateIntentTarget(page, intent, current.step, current.source, latestStamp, callbacks)
    }
    introIntents.delete(page)
    callbacks.onInvalid('当前草稿暂时无法读取，请返回首页后重新进入评估。')
    return false
  }

  let succeeded = false
  let settled = false
  const fail = () => {
    if (settled) return
    settled = true
    if (!lease.active) return
    const retryable = introIntents.get(page) === intent
      && validateRetryableIntroIntent(page, intent, callbacks)
    finishPageAction(lease, true)
    if (retryable) callbacks.onFailure()
    else introIntents.delete(page)
  }
  try {
    wx.navigateTo({
      url: routeForStep(target),
      success: () => {
        if (settled) return
        settled = true
        succeeded = true
        if (!lease.active) return
        if (introIntents.get(page) === intent && isCurrentPage(page, '/pages/assessment/intro')) {
          introIntents.delete(page)
          callbacks.onConsumed()
        }
        finishPageAction(lease, true)
      },
      fail,
      complete: () => {
        if (!succeeded) fail()
      },
    })
  } catch (_error) {
    fail()
    return false
  }
  return true
}

export const clearAssessmentPhaseIntent = (page: object): void => {
  introIntents.delete(page)
}
