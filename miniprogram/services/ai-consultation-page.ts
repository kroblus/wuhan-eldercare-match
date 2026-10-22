import {
  validateAIApplicationResultV1,
  validateAIConversationV1,
  evaluateApprovedFaqSafetyPreflightV1,
} from '../domain/ai-consultation/index'
import { createAIConsultationApplicationServiceV1 } from './ai-consultation-application'
import {
  AI_APPROVED_FAQ_PRODUCTION_MANIFEST_V1,
  createAIApprovedFaqProviderV1,
  toAIConsultationContextSourceV1,
} from './ai-consultation-approved-faq'
import type { AIApprovedFaqProviderV1 } from './ai-consultation-approved-faq'
import {
  AI_CONSULTATION_CONTRACT_VERSION_V1,
  AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1,
} from '../types/ai-consultation-v1'
import type {
  AIApprovedFaqManifestV1,
} from '../types/ai-consultation-faq-v1'
import type {
  AIConsultationPublicApplicationResultV1,
  AIConsultationPublicApplicationSnapshotV1,
  AIMessagePublicProjectionV1,
  AIConversationV1,
} from '../types/ai-consultation-v1'

/**
 * B6 production capability boundary.
 *
 * The facade deliberately exposes only the already-frozen public Application
 * result.  The default production manifest is currently empty because no
 * per-entry owner approval evidence has been supplied; that keeps the honest
 * unavailable path until approved content is added.
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

const stateForConversationMessages = (
  messages: readonly AIMessagePublicProjectionV1[],
): AIConversationV1['state'] => {
  if (messages.length === 0) return 'idle'
  const last = messages[messages.length - 1]
  if (last.kind === 'answer' || (last.kind === 'safe_refusal' && !last.handoff)) return 'answer_ready'
  if (last.kind === 'human_handoff' || (last.kind === 'safe_refusal' && Boolean(last.handoff))) return 'need_human'
  if (last.kind === 'technical_failure') return 'service_error'
  return 'knowledge_unavailable'
}

const toConversationBeforeSending = (
  snapshot: AIConsultationPublicApplicationSnapshotV1,
): AIConversationV1 | null => {
  const userIndex = snapshot.messages.length - 1
  const latest = snapshot.messages[userIndex]
  if (!latest || latest.role !== 'user' || latest.kind !== 'user_input') return null
  const messages = snapshot.messages.slice(0, userIndex).map((message) => ({
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: message.messageId,
    role: message.role,
    kind: message.kind,
    content: message.content,
    sourceRefs: message.sourceRefs,
    ...(message.handoff ? { handoff: message.handoff } : {}),
    createdAt: message.createdAt,
  }))
  const candidate: AIConversationV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    ref: { ...snapshot.conversationRef },
    createdAt: snapshot.conversationCreatedAt,
    state: stateForConversationMessages(snapshot.messages.slice(0, userIndex)),
    messages,
  }
  const validated = validateAIConversationV1(candidate)
  return validated.ok ? validated.value : null
}

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

const completeUnavailableSend = (
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

const createPageApplication = (
  provider: AIApprovedFaqProviderV1 | null,
): AIConsultationPageApplicationV1 => {
  const safetyProvider = provider || {
    responseProvenance: 'approved_faq' as const,
    requestCandidate() {
      return { ok: false as const, failure: 'service_error' as const }
    },
  }
  const application = createAIConsultationApplicationServiceV1(safetyProvider)

  const completeSend = (
    sending: AIConsultationPublicApplicationResultV1,
  ): Promise<AIConsultationPublicApplicationResultV1> => {
    const snapshot = readSnapshot(sending)
    const latest = snapshot.messages[snapshot.messages.length - 1]
    if (!latest || latest.role !== 'user' || latest.kind !== 'user_input') return completeUnavailableSend(sending)
    const preflight = evaluateApprovedFaqSafetyPreflightV1(latest.content)
    const conversation = toConversationBeforeSending(snapshot)
    if (!conversation) return completeUnavailableSend(sending)
    if (preflight.kind === 'blocked') {
      return Promise.resolve(application.consult({
        conversation,
        userInput: latest.content,
        userMessageId: latest.messageId,
        userMessageCreatedAt: latest.createdAt,
        responseMessageId: nextId('ai-assistant-message'),
        responseCreatedAt: now(),
        policy: preflight.policy,
        contextSources: [],
      }))
    }
    if (!provider) return completeUnavailableSend(sending)
    const lookup = provider.lookup(latest.content)
    if (lookup.kind !== 'match') return completeUnavailableSend(sending)
    const result = application.consult({
      conversation,
      userInput: latest.content,
      userMessageId: latest.messageId,
      userMessageCreatedAt: latest.createdAt,
      responseMessageId: nextId('ai-assistant-message'),
      responseCreatedAt: now(),
      policy: {
        requestCategory: 'allowlisted_explanation',
        userRequestedHuman: false,
        consecutiveAllowedKnowledgeInsufficiencyCount: 0,
        hasSufficientAllowedKnowledge: true,
      },
      contextSources: [toAIConsultationContextSourceV1(lookup.entry)],
    })
    return Promise.resolve(result)
  }

  return {
    createInitialResult,
    beginSend,
    completeSend,
    recoverSendFailure,
  }
}

export const createAIConsultationPageApplicationV1 = (): AIConsultationPageApplicationV1 => {
  const result = createAIApprovedFaqProviderV1(AI_APPROVED_FAQ_PRODUCTION_MANIFEST_V1)
  return createPageApplication(result.ok ? result.provider : null)
}

/** Test-only composition seam; production Page code calls the no-argument factory above. */
export const createAIConsultationPageApplicationForTestV1 = (
  manifest: AIApprovedFaqManifestV1,
): AIConsultationPageApplicationV1 => {
  const result = createAIApprovedFaqProviderV1(manifest)
  return createPageApplication(result.ok ? result.provider : null)
}
