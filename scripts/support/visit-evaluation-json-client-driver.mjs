import assert from 'node:assert/strict'
import path from 'node:path'
import { createWechatTsRuntime, loadWechatTypeScript } from './load-wechat-ts-runtime.mjs'

const SOURCE_PATHS = Object.freeze([
  'miniprogram/pages/visit/evaluation-view-model.ts',
  'miniprogram/pages/visit/visit-evaluation-write-content.ts',
  'miniprogram/pages/visit/visit-evaluation-production-submit.ts',
  'miniprogram/pages/visit/visit-evaluation-production-context.ts',
  'miniprogram/services/c5-authenticated-backend-session.ts',
  'scripts/support/load-wechat-ts-runtime.mjs',
])

const createBlockedIo = (attempts, name) => (..._args) => {
  attempts.push({ operation: name })
  const error = new Error(`Offline JSON gate blocked ${name}`)
  error.name = 'OfflineIoForbiddenError'
  throw error
}

const createBlockedConstructor = (attempts, name) => new Proxy(function blockedIoConstructor() {}, {
  apply(_target, _thisArg, args) {
    return createBlockedIo(attempts, name)(...args)
  },
  construct(_target, args) {
    return createBlockedIo(attempts, name)(...args)
  },
})

const createWxGuard = (attempts) => new Proxy(Object.create(null), {
  get(_target, property) {
    const operation = `wx.${String(property)}`
    return createBlockedIo(attempts, operation)
  },
  set(_target, property) {
    const operation = `wx.${String(property)} assignment`
    createBlockedIo(attempts, operation)()
    return false
  },
})

const verifyOfflineIoGuards = () => {
  const attempts = []
  const wx = createWxGuard(attempts)
  const fetch = createBlockedIo(attempts, 'fetch')
  const XMLHttpRequest = createBlockedConstructor(attempts, 'XMLHttpRequest')
  const WebSocket = createBlockedConstructor(attempts, 'WebSocket')
  const checks = [
    ['wx.request', () => wx.request({ url: 'https://synthetic.invalid', method: 'GET' })],
    ['wx.login', () => wx.login({})],
    ['wx.getStorageSync', () => wx.getStorageSync('__synthetic_offline_gate__')],
    ['wx.setStorageSync', () => wx.setStorageSync('__synthetic_offline_gate__', 'synthetic')],
    ['fetch', () => fetch('https://synthetic.invalid')],
    ['XMLHttpRequest', () => new XMLHttpRequest()],
    ['WebSocket', () => new WebSocket('wss://synthetic.invalid')],
  ]
  const outcomes = checks.map(([operation, invoke]) => {
    let errorName = null
    try {
      invoke()
    } catch (error) {
      errorName = error instanceof Error ? error.name : 'Error'
    }
    assert.equal(errorName, 'OfflineIoForbiddenError', `${operation} must be stopped by the offline guard`)
    return { operation, blocked: true, errorName }
  })
  assert.equal(attempts.length, checks.length, 'Every canary must be intercepted before I/O')
  return {
    status: 'PASS',
    blockedCount: outcomes.filter((outcome) => outcome.blocked).length,
    attempts,
  }
}

const firstKey = (values, description) => {
  assert.ok(Array.isArray(values) && values.length > 0, `Missing production ${description}`)
  return values[0].key
}

const setEveryDraftRating = (draft, viewModel, value) => {
  for (const section of viewModel.VISIT_EVALUATION_RATING_SECTIONS) {
    for (const item of section.items) draft.ratings[item.key] = value
  }
}

const makeDraft = (viewModel, caseId) => {
  const draft = viewModel.createEmptyVisitEvaluationDraft()
  draft.overallRating = viewModel.VISIT_EVALUATION_RATING_OPTIONS[
    viewModel.VISIT_EVALUATION_RATING_OPTIONS.length - 1
  ]
  draft.consideration = firstKey(viewModel.VISIT_EVALUATION_CONSIDERATION_OPTIONS, 'consideration option')

  if (caseId === 'complete-optional-content') {
    setEveryDraftRating(draft, viewModel, viewModel.VISIT_EVALUATION_RATING_OPTIONS[3])
    draft.feeExplanationClear = 'clear'
    const feeAnswer = firstKey(viewModel.VISIT_EVALUATION_FEE_ANSWER_OPTIONS, 'fee answer option')
    for (const topic of viewModel.VISIT_EVALUATION_FEE_TOPICS) {
      draft.feeTopicExplanations[topic.key] = feeAnswer
    }
    draft.careRecordLearned = viewModel.VISIT_EVALUATION_OBSERVATION_OPTIONS[0].key
    draft.handoverLearned = viewModel.VISIT_EVALUATION_OBSERVATION_OPTIONS[1].key
    draft.handoverTopics = viewModel.VISIT_EVALUATION_HANDOVER_TOPICS
      .filter((topic) => topic.key !== 'unconfirmed')
      .slice(0, 2)
      .map((topic) => topic.key)
    const tagKeys = viewModel.VISIT_EVALUATION_TAGS.map((tag) => tag.key)
    draft.likedTags = tagKeys.slice(0, viewModel.VISIT_EVALUATION_MAX_TAGS)
    draft.concernTags = [tagKeys[0], ...tagKeys.slice(3, 3 + viewModel.VISIT_EVALUATION_MAX_TAGS - 1)]
    draft.comment = 'Synthetic offline JSON gate only.'
  } else if (caseId === 'partial-optional-content') {
    const firstRating = viewModel.VISIT_EVALUATION_RATING_SECTIONS[0].items[0]
    draft.ratings[firstRating.key] = viewModel.VISIT_EVALUATION_RATING_OPTIONS[1]
    draft.feeTopicExplanations[viewModel.VISIT_EVALUATION_FEE_TOPICS[0].key] =
      viewModel.VISIT_EVALUATION_FEE_ANSWER_OPTIONS[1].key
    draft.likedTags = [viewModel.VISIT_EVALUATION_TAGS[0].key]
    draft.concernTags = [viewModel.VISIT_EVALUATION_TAGS[0].key]
  } else if (caseId === 'unconfirmed-exclusive') {
    draft.careRecordLearned = viewModel.VISIT_EVALUATION_OBSERVATION_OPTIONS[2].key
    draft.handoverLearned = viewModel.VISIT_EVALUATION_OBSERVATION_OPTIONS[2].key
    draft.handoverTopics = [viewModel.VISIT_EVALUATION_HANDOVER_TOPICS
      .find((topic) => topic.key === 'unconfirmed').key]
  } else if (caseId === 'empty-comment-omitted') {
    draft.feeExplanationClear = 'unclear'
    draft.careRecordLearned = viewModel.VISIT_EVALUATION_OBSERVATION_OPTIONS[0].key
    draft.comment = ''
  } else if (caseId === 'comment-at-200-characters') {
    draft.comment = 'x'.repeat(viewModel.VISIT_EVALUATION_MAX_COMMENT_CHARACTERS)
  } else if (caseId !== 'minimal-required-only') {
    throw new TypeError(`Unknown client request case: ${caseId}`)
  }

  return draft
}

export const createClientDriver = (repoRoot) => {
  const root = path.resolve(repoRoot)
  const attempts = []
  const { ts, file: typescriptPath } = loadWechatTypeScript()
  const blockedFunction = (name) => createBlockedIo(attempts, name)
  const runtime = createWechatTsRuntime(ts, {
    wx: createWxGuard(attempts),
    fetch: blockedFunction('fetch'),
    XMLHttpRequest: createBlockedConstructor(attempts, 'XMLHttpRequest'),
    WebSocket: createBlockedConstructor(attempts, 'WebSocket'),
    EventSource: createBlockedConstructor(attempts, 'EventSource'),
    setTimeout: blockedFunction('setTimeout'),
    setInterval: blockedFunction('setInterval'),
  })

  const viewModel = runtime.load(path.join(root, SOURCE_PATHS[0]))
  const writeContent = runtime.load(path.join(root, SOURCE_PATHS[1]))
  const submit = runtime.load(path.join(root, SOURCE_PATHS[2]))
  const context = runtime.load(path.join(root, SOURCE_PATHS[3]))
  const guardCanary = verifyOfflineIoGuards()

  const generateRequests = (scenario) => {
    assert.ok(scenario && typeof scenario === 'object', 'A synthetic scenario is required')
    assert.equal(typeof scenario.visitId, 'string')
    assert.equal(typeof scenario.idempotencyKey, 'string')

    const cases = [
      'minimal-required-only',
      'complete-optional-content',
      'partial-optional-content',
      'unconfirmed-exclusive',
      'empty-comment-omitted',
      'comment-at-200-characters',
    ]
    return cases.map((caseId) => {
      const draft = makeDraft(viewModel, caseId)
      const mapping = writeContent.mapVisitEvaluationDraftToWriteContentV1(draft)
      assert.equal(mapping.kind, 'valid', `${caseId} must pass the production draft mapper`)
      const body = submit.createVisitEvaluationSubmissionBodyV1({
        visitId: scenario.visitId,
        idempotencyKey: scenario.idempotencyKey,
        content: mapping.content,
      })
      const jsonText = JSON.stringify(body)
      assert.equal(typeof jsonText, 'string')
      return {
        caseId,
        jsonText,
        routePath: `/api/v1/visits/${encodeURIComponent(scenario.visitId)}/evaluation`,
        expectedContent: mapping.content,
      }
    })
  }

  const consumeResponse = (jsonText, expectedVisitId, responseType = 'submission') => {
    if (typeof jsonText !== 'string') {
      return {
        parsed: null,
        result: null,
        rejectionPoint: 'JSON.parse',
        error: { name: 'TypeError', message: 'JSON response must be supplied as text' },
      }
    }
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (error) {
      return {
        parsed: null,
        result: null,
        rejectionPoint: 'JSON.parse',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }

    if (responseType === 'submission') {
      return {
        parsed,
        result: submit.readVisitEvaluationSubmissionResultV1(parsed, expectedVisitId),
        rejectionPoint: 'readVisitEvaluationSubmissionResultV1',
      }
    }
    if (responseType === 'context') {
      return {
        parsed,
        result: context.readProductionVisitEvaluationContextResponseV1(parsed, expectedVisitId),
        rejectionPoint: 'readProductionVisitEvaluationContextResponseV1',
      }
    }
    throw new TypeError(`Unsupported production response parser: ${responseType}`)
  }

  return {
    generateRequests,
    consumeResponse,
    sourcePaths: SOURCE_PATHS.map((sourcePath) => path.join(root, sourcePath)),
    runtimeEnvironment: {
      nodeVersion: process.version,
      typescriptVersion: ts.version,
      typescriptPath,
      guardCanary,
    },
    ioGuardAttempts: attempts,
  }
}
