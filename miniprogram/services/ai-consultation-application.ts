import {
  evaluateAISafetyDispositionV1,
  projectAIPublicMessageV1,
  validateAIConversationV1,
  validateAIMessageV1,
  validateAISafetyPolicyInputV1,
  validateProviderAnswerCandidateV1,
} from '../domain/ai-consultation/index'
import {
  AI_CONSULTATION_CONTRACT_VERSION_V1,
  AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
} from '../types/ai-consultation-v1'
import { minimizeAIConsultationContextV1 } from './ai-consultation-context'
import type {
  AIConsultationApplicationRequestV1,
  AIConsultationApplicationServiceV1,
  AIConsultationProviderPortV1,
  AIConsultationPublicApplicationResultV1,
  AIConsultationPublicApplicationSnapshotV1,
  AIConversationV1,
  AIHandoffV1,
  AIMessageV1,
  AISafetyEvaluationV1,
} from '../types/ai-consultation-v1'

const SERVICE_ERROR_COPY = '养老咨询服务暂时不可用，请稍后重试。'
const NETWORK_ERROR_COPY = '网络连接失败，请稍后重试。'
const SAFE_REFUSAL_COPY = '这个问题超出了养老咨询助手可以安全回答的范围。'

const cloneHandoff = (handoff: AIHandoffV1): AIHandoffV1 => {
  const result: AIHandoffV1 = {
    level: handoff.level,
    reason: handoff.reason,
    publicExplanation: handoff.publicExplanation,
  }
  if (handoff.destination) result.destination = handoff.destination
  return result
}

const actionsForState = (
  state: AIConsultationPublicApplicationSnapshotV1['state'],
  messages: readonly AIMessageV1[],
): AIConsultationPublicApplicationSnapshotV1['actions'] => {
  const last = messages.length > 0 ? messages[messages.length - 1] : null
  return {
    canSend: state !== 'sending' && state !== 'need_human',
    canRetry: state === 'knowledge_unavailable' || state === 'network_error' || state === 'service_error',
    canOpenHumanHandoff: Boolean(last && last.handoff && last.handoff.destination === 'global_consultant_service'),
  }
}

const buildSnapshot = (
  conversation: AIConversationV1,
  state: AIConversationV1['state'],
  messages: readonly AIMessageV1[],
  responseProvenance: AIConsultationPublicApplicationSnapshotV1['responseProvenance'],
): AIConsultationPublicApplicationSnapshotV1 => ({
  kind: AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
  contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
  conversationRef: { ...conversation.ref },
  conversationCreatedAt: conversation.createdAt,
  state,
  messages: messages.map(projectAIPublicMessageV1),
  responseProvenance,
  actions: actionsForState(state, messages),
})

const technicalFailure = (
  conversation: AIConversationV1,
  userMessage: AIMessageV1 | null,
  responseMessageId: string,
  responseCreatedAt: string,
  code: 'NETWORK_ERROR' | 'SERVICE_ERROR',
): AIConsultationPublicApplicationResultV1 => {
  const state = code === 'NETWORK_ERROR' ? 'network_error' : 'service_error'
  const content = code === 'NETWORK_ERROR' ? NETWORK_ERROR_COPY : SERVICE_ERROR_COPY
  const occupiedIds = conversation.messages.map((message) => message.messageId)
  if (userMessage) occupiedIds.push(userMessage.messageId)
  let failureMessageId = responseMessageId
  let collisionIndex = 1
  while (occupiedIds.indexOf(failureMessageId) >= 0) {
    failureMessageId = `${responseMessageId}-technical-failure-${collisionIndex}`
    collisionIndex += 1
  }
  const failureMessage: AIMessageV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: failureMessageId,
    role: 'assistant',
    kind: 'technical_failure',
    content,
    sourceRefs: [],
    createdAt: responseCreatedAt,
  }
  const messages = userMessage ? conversation.messages.concat([userMessage, failureMessage]) : conversation.messages.concat([failureMessage])
  const snapshot = buildSnapshot(conversation, state, messages, 'unavailable')
  return {
    ok: false,
    error: { code, publicMessage: content, retryable: true, snapshot },
  }
}

const nonProviderMessage = (
  evaluation: Exclude<AISafetyEvaluationV1, { kind: 'answer' }>,
  responseMessageId: string,
  responseCreatedAt: string,
): AIMessageV1 | null => {
  if (evaluation.kind === 'knowledge_unavailable') return null
  const handoff = 'handoff' in evaluation ? evaluation.handoff : null
  const content = evaluation.kind === 'safe_refusal'
    ? (handoff ? handoff.publicExplanation : SAFE_REFUSAL_COPY)
    : evaluation.handoff.publicExplanation
  const message: AIMessageV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: responseMessageId,
    role: 'assistant',
    kind: evaluation.kind,
    content,
    sourceRefs: [],
    createdAt: responseCreatedAt,
  }
  if (handoff) message.handoff = cloneHandoff(handoff)
  return message
}

const readNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 4000 ? value : null

const isProviderPort = (value: unknown): value is AIConsultationProviderPortV1 => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (candidate.responseProvenance === 'approved_faq' || candidate.responseProvenance === 'live_backend')
    && typeof candidate.requestCandidate === 'function'
}

const isExactProviderPortResult = (
  value: unknown,
): value is ReturnType<AIConsultationProviderPortV1['requestCandidate']> => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate).sort().join('|')
  if (candidate.ok === true) return keys === 'candidate|ok'
  return candidate.ok === false
    && keys === 'failure|ok'
    && (candidate.failure === 'network_error' || candidate.failure === 'service_error')
}

const resolveConsultation = (
  provider: AIConsultationProviderPortV1,
  input: AIConsultationApplicationRequestV1,
): AIConsultationPublicApplicationResultV1 => {
  const conversationResult = validateAIConversationV1(input && input.conversation)
  const policyResult = validateAISafetyPolicyInputV1(input && input.policy)
  const contextResult = minimizeAIConsultationContextV1(input && input.contextSources)
  const userInput = readNonEmptyString(input && input.userInput)
  const userMessageId = readNonEmptyString(input && input.userMessageId)
  const userMessageCreatedAt = readNonEmptyString(input && input.userMessageCreatedAt)
  const responseMessageId = readNonEmptyString(input && input.responseMessageId)
  const responseCreatedAt = readNonEmptyString(input && input.responseCreatedAt)
  if (!conversationResult.ok || !policyResult.ok || !contextResult.ok
    || !userInput || !userMessageId || !userMessageCreatedAt || !responseMessageId || !responseCreatedAt
    || !isProviderPort(provider)
    || userMessageId === responseMessageId
    || conversationResult.value.messages.some((message) => message.messageId === userMessageId || message.messageId === responseMessageId)) {
    const fallbackConversation: AIConversationV1 = conversationResult.ok
      ? conversationResult.value
      : {
          contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
          ref: { kind: 'local_session', localSessionId: 'invalid-request' },
          createdAt: responseCreatedAt || userMessageCreatedAt || 'invalid-request',
          state: 'idle',
          messages: [],
        }
    return technicalFailure(
      fallbackConversation,
      null,
      responseMessageId || 'invalid-response',
      responseCreatedAt || 'invalid-response',
      'SERVICE_ERROR',
    )
  }

  const conversation = conversationResult.value
  const userMessage: AIMessageV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: userMessageId,
    role: 'user',
    kind: 'user_input',
    content: userInput,
    sourceRefs: [],
    createdAt: userMessageCreatedAt,
  }
  const evaluation = evaluateAISafetyDispositionV1(policyResult.value)
  if (evaluation.kind === 'knowledge_unavailable') {
    const messages = conversation.messages.concat([userMessage])
    return {
      ok: true,
      value: buildSnapshot(conversation, evaluation.state, messages, 'unavailable'),
    }
  }
  if (evaluation.kind !== 'answer') {
    const response = nonProviderMessage(evaluation, responseMessageId, responseCreatedAt)
    const messages = response
      ? conversation.messages.concat([userMessage, response])
      : conversation.messages.concat([userMessage])
    return { ok: true, value: buildSnapshot(conversation, evaluation.state, messages, 'unavailable') }
  }
  if (contextResult.value.sources.length === 0) {
    const messages = conversation.messages.concat([userMessage])
    return { ok: true, value: buildSnapshot(conversation, 'knowledge_unavailable', messages, 'unavailable') }
  }
  let providerResult
  try {
    providerResult = provider.requestCandidate({
      contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
      userInput,
      context: contextResult.value.providerContext,
    })
  } catch (_error) {
    return technicalFailure(conversation, userMessage, responseMessageId, responseCreatedAt, 'SERVICE_ERROR')
  }
  if (!isExactProviderPortResult(providerResult)) {
    return technicalFailure(conversation, userMessage, responseMessageId, responseCreatedAt, 'SERVICE_ERROR')
  }
  if (providerResult.ok !== true) {
    const code = providerResult && providerResult.failure === 'network_error' ? 'NETWORK_ERROR' : 'SERVICE_ERROR'
    return technicalFailure(conversation, userMessage, responseMessageId, responseCreatedAt, code)
  }
  const candidate = validateProviderAnswerCandidateV1(providerResult.candidate)
  if (!candidate.ok) {
    return technicalFailure(conversation, userMessage, responseMessageId, responseCreatedAt, 'SERVICE_ERROR')
  }
  const answer: AIMessageV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: responseMessageId,
    role: 'assistant',
    kind: 'answer',
    content: candidate.value.content,
    sourceRefs: contextResult.value.sourceRefs,
    createdAt: responseCreatedAt,
  }
  const validatedAnswer = validateAIMessageV1(answer)
  if (!validatedAnswer.ok) {
    return technicalFailure(conversation, userMessage, responseMessageId, responseCreatedAt, 'SERVICE_ERROR')
  }
  const messages = conversation.messages.concat([userMessage, validatedAnswer.value])
  return {
    ok: true,
    value: buildSnapshot(conversation, 'answer_ready', messages, provider.responseProvenance),
  }
}

export const createAIConsultationApplicationServiceV1 = (
  provider: AIConsultationProviderPortV1,
): AIConsultationApplicationServiceV1 => ({
  consult(input: AIConsultationApplicationRequestV1): AIConsultationPublicApplicationResultV1 {
    return resolveConsultation(provider, input)
  },
})
