import { validateAIApplicationResultV1 } from '../domain/ai-consultation/index'
import {
  AI_CONSULTATION_CONTRACT_VERSION_V1,
  AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
} from '../types/ai-consultation-v1'
import type {
  AIConsultationPublicApplicationResultV1,
  AIConsultationPublicApplicationSnapshotV1,
  AIMessagePublicProjectionV1,
} from '../types/ai-consultation-v1'

/**
 * B6 production capability boundary.
 *
 * There is currently no approved FAQ adapter or live Backend provider.  This
 * facade deliberately exposes only the already-frozen public Application
 * result.  It never pretends that an unavailable capability is a provider.
 */
export interface AIConsultationPageApplicationV1 {
  createInitialResult(): AIConsultationPublicApplicationResultV1
  beginSend(
    current: AIConsultationPublicApplicationResultV1,
    userInput: string,
  ): AIConsultationPublicApplicationResultV1
  completeSend(
    sending: AIConsultationPublicApplicationResultV1,
  ): Promise<AIConsultationPublicApplicationResultV1>
  recoverSendFailure(
    current: AIConsultationPublicApplicationResultV1,
  ): AIConsultationPublicApplicationResultV1
}

let sessionSequence = 0
let messageSequence = 0

const nextId = (prefix: string): string => {
  messageSequence += 1
  return `${prefix}-${messageSequence}`
}

const now = (): string => new Date().toISOString()

const snapshotFrom = (
  snapshot: AIConsultationPublicApplicationSnapshotV1,
  state: AIConsultationPublicApplicationSnapshotV1['state'],
  messages: readonly AIMessagePublicProjectionV1[],
): AIConsultationPublicApplicationSnapshotV1 => {
  const last = messages.length > 0 ? messages[messages.length - 1] : null
  const hasGlobalHandoff = Boolean(
    last
    && last.handoff
    && last.handoff.destination === 'global_consultant_service',
  )
  return {
    kind: AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    conversationRef: { ...snapshot.conversationRef },
    conversationCreatedAt: snapshot.conversationCreatedAt,
    state,
    messages: messages.map((message) => ({
      messageId: message.messageId,
      role: message.role,
      kind: message.kind,
      content: message.content,
      sourceRefs: message.sourceRefs.map((source) => ({ ...source })),
      ...(message.handoff ? { handoff: { ...message.handoff } } : {}),
      createdAt: message.createdAt,
    })),
    responseProvenance: 'unavailable',
    actions: {
      canSend: state !== 'sending' && state !== 'need_human',
      canRetry: state === 'knowledge_unavailable'
        || state === 'network_error'
        || state === 'service_error',
      canOpenHumanHandoff: hasGlobalHandoff,
    },
  }
}

const validateResult = (
  result: AIConsultationPublicApplicationResultV1,
): AIConsultationPublicApplicationResultV1 => {
  const validated = validateAIApplicationResultV1(result)
  if (validated.ok) return validated.value
  // The constructors below are deliberately exact and should always validate.
  // Fail closed if a future Contract change makes that assumption invalid.
  return {
    ok: false,
    error: {
      code: 'SERVICE_ERROR',
      publicMessage: '养老咨询服务暂时不可用，请稍后重试。',
      retryable: true,
      snapshot: {
        kind: AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
        contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
        conversationRef: { kind: 'local_session', localSessionId: 'invalid-page-result' },
        conversationCreatedAt: 'invalid-page-result',
        state: 'service_error',
        messages: [{
          messageId: 'invalid-page-result-message',
          role: 'assistant',
          kind: 'technical_failure',
          content: '养老咨询服务暂时不可用，请稍后重试。',
          sourceRefs: [],
          createdAt: 'invalid-page-result',
        }],
        responseProvenance: 'unavailable',
        actions: { canSend: true, canRetry: true, canOpenHumanHandoff: false },
      },
    },
  }
}

const readSnapshot = (
  result: AIConsultationPublicApplicationResultV1,
): AIConsultationPublicApplicationSnapshotV1 => result.ok ? result.value : result.error.snapshot

const createInitialResult = (): AIConsultationPublicApplicationResultV1 => {
  sessionSequence += 1
  const snapshot: AIConsultationPublicApplicationSnapshotV1 = {
    kind: AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    conversationRef: { kind: 'local_session', localSessionId: `ai-local-session-${sessionSequence}` },
    conversationCreatedAt: now(),
    state: 'idle',
    messages: [],
    responseProvenance: 'unavailable',
    actions: { canSend: true, canRetry: false, canOpenHumanHandoff: false },
  }
  return validateResult({ ok: true, value: snapshot })
}

const beginSend = (
  current: AIConsultationPublicApplicationResultV1,
  userInput: string,
): AIConsultationPublicApplicationResultV1 => {
  const snapshot = readSnapshot(current)
  const message: AIMessagePublicProjectionV1 = {
    messageId: nextId('ai-user-message'),
    role: 'user',
    kind: 'user_input',
    content: userInput.trim(),
    sourceRefs: [],
    createdAt: now(),
  }
  return validateResult({
    ok: true,
    value: snapshotFrom(snapshot, 'sending', snapshot.messages.concat([message])),
  })
}

const completeSend = (
  sending: AIConsultationPublicApplicationResultV1,
): Promise<AIConsultationPublicApplicationResultV1> => {
  const snapshot = readSnapshot(sending)
  const result: AIConsultationPublicApplicationResultV1 = {
    ok: true,
    value: snapshotFrom(snapshot, 'knowledge_unavailable', snapshot.messages),
  }
  return Promise.resolve(validateResult(result))
}

const recoverSendFailure = (
  current: AIConsultationPublicApplicationResultV1,
): AIConsultationPublicApplicationResultV1 => {
  const snapshot = readSnapshot(current)
  const publicMessage = '养老咨询服务暂时不可用，请稍后重试。'
  const failureMessage: AIMessagePublicProjectionV1 = {
    messageId: nextId('ai-technical-failure'),
    role: 'assistant',
    kind: 'technical_failure',
    content: publicMessage,
    sourceRefs: [],
    createdAt: now(),
  }
  const failureSnapshot = snapshotFrom(
    snapshot,
    'service_error',
    snapshot.messages.concat([failureMessage]),
  )
  return validateResult({
    ok: false,
    error: {
      code: 'SERVICE_ERROR',
      publicMessage,
      retryable: true,
      snapshot: failureSnapshot,
    },
  })
}

export const createAIConsultationPageApplicationV1 = (): AIConsultationPageApplicationV1 => ({
  createInitialResult,
  beginSend,
  completeSend,
  recoverSendFailure,
})
