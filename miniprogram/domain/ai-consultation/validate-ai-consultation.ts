import {
  AI_CONSULTATION_CONTRACT_VERSION_V1,
} from '../../types/ai-consultation-v1'
import type {
  AIConsultationContextSourceInputV1,
  AIConsultationPublicApplicationResultV1,
  AIConsultationPublicApplicationSnapshotV1,
  AIConsultationSafetyPolicyInputV1,
  AIConversationRefV1,
  AIConversationV1,
  AIHandoffReasonV1,
  AIHandoffV1,
  AIMessageV1,
  AISourceCategoryV1,
  AISourceRefV1,
  AIValidationIssueCodeV1,
  AIValidationIssueV1,
  AIValidationResultV1,
} from '../../types/ai-consultation-v1'

const SOURCE_CATEGORIES: readonly AISourceCategoryV1[] = [
  'product_faq',
  'profile_display_snapshot',
  'recommendation_display_snapshot',
  'institution_display_snapshot',
  'visit_faq',
]

const HANDOFF_REASONS: readonly AIHandoffReasonV1[] = [
  'user_requested_human',
  'allowed_knowledge_insufficient',
  'institution_confirmation_required',
  'realtime_business_fact_required',
  'contract_payment_or_complaint',
  'appointment_or_complex_care',
  'medical_professional_required',
  'consultant_guidance_suggested',
]

const STATES = [
  'idle',
  'sending',
  'answer_ready',
  'need_human',
  'knowledge_unavailable',
  'network_error',
  'service_error',
] as const

const REQUEST_CATEGORIES = [
  'allowlisted_explanation',
  'prohibited_nonmedical',
  'medical_professional_judgment',
  'institution_confirmation',
  'realtime_business_fact',
  'contract_payment_or_complaint',
  'appointment_or_complex_care',
] as const

const issue = <T>(code: AIValidationIssueCodeV1, path: string): AIValidationResultV1<T> => ({
  ok: false,
  issues: [{ code, path }],
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const hasExactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = required.concat(optional)
  const keys = Object.keys(value)
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.indexOf(key) >= 0)
}
const isNonEmptyString = (value: unknown, maximumLength = 4000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength

const isSafeOpaquePublicRef = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0
  && value.length <= 160
  && /^[A-Za-z0-9._:-]+$/.test(value)

export const isAllowedAISourceCategoryV1 = (value: unknown): value is AISourceCategoryV1 =>
  typeof value === 'string' && (SOURCE_CATEGORIES as readonly string[]).indexOf(value) >= 0

export const validateAIConversationRefV1 = (value: unknown): AIValidationResultV1<AIConversationRefV1> => {
  if (!isRecord(value) || typeof value.kind !== 'string') return issue('INVALID_IDENTITY', 'ref')
  if (value.kind === 'service_conversation'
    && hasExactKeys(value, ['kind', 'conversationId'])
    && isNonEmptyString(value.conversationId, 160)) {
    return { ok: true, value: { kind: 'service_conversation', conversationId: value.conversationId } }
  }
  if (value.kind === 'local_session'
    && hasExactKeys(value, ['kind', 'localSessionId'])
    && isNonEmptyString(value.localSessionId, 160)) {
    return { ok: true, value: { kind: 'local_session', localSessionId: value.localSessionId } }
  }
  return issue('INVALID_IDENTITY', 'ref')
}

export const validateAISourceRefV1 = (value: unknown): AIValidationResultV1<AISourceRefV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, ['category', 'publicLabel'], ['publicVersion', 'publicRef'])
    || !isAllowedAISourceCategoryV1(value.category)
    || !isNonEmptyString(value.publicLabel, 120)
    || /https?:\/\//i.test(value.publicLabel)) {
    return issue('INVALID_SOURCE_REF', 'sourceRef')
  }
  if (value.publicVersion !== undefined && !isSafeOpaquePublicRef(value.publicVersion)) {
    return issue('INVALID_SOURCE_REF', 'sourceRef.publicVersion')
  }
  if (value.publicRef !== undefined && !isSafeOpaquePublicRef(value.publicRef)) {
    return issue('INVALID_SOURCE_REF', 'sourceRef.publicRef')
  }
  const result: AISourceRefV1 = { category: value.category, publicLabel: value.publicLabel }
  if (typeof value.publicVersion === 'string') result.publicVersion = value.publicVersion
  if (typeof value.publicRef === 'string') result.publicRef = value.publicRef
  return { ok: true, value: result }
}

export const validateAIHandoffV1 = (value: unknown): AIValidationResultV1<AIHandoffV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, ['level', 'reason', 'publicExplanation'], ['destination'])
    || (value.level !== 'required' && value.level !== 'suggested')
    || typeof value.reason !== 'string'
    || (HANDOFF_REASONS as readonly string[]).indexOf(value.reason) < 0
    || !isNonEmptyString(value.publicExplanation, 300)) {
    return issue('INVALID_HANDOFF', 'handoff')
  }
  if (value.destination !== undefined && value.destination !== 'global_consultant_service') {
    return issue('INVALID_HANDOFF', 'handoff.destination')
  }
  if (value.reason === 'medical_professional_required'
    && (value.level !== 'required' || value.destination !== undefined)) {
    return issue('INVALID_HANDOFF', 'handoff')
  }
  if (value.reason === 'consultant_guidance_suggested' && value.level !== 'suggested') {
    return issue('INVALID_HANDOFF', 'handoff.level')
  }
  if (value.reason !== 'consultant_guidance_suggested'
    && value.reason !== 'medical_professional_required'
    && value.level !== 'required') {
    return issue('INVALID_HANDOFF', 'handoff.level')
  }
  const handoff: AIHandoffV1 = {
    level: value.level,
    reason: value.reason as AIHandoffReasonV1,
    publicExplanation: value.publicExplanation,
  }
  if (value.destination === 'global_consultant_service') handoff.destination = value.destination
  return { ok: true, value: handoff }
}

export const validateAIMessageV1 = (value: unknown): AIValidationResultV1<AIMessageV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, ['contractVersion', 'messageId', 'role', 'kind', 'content', 'sourceRefs', 'createdAt'], ['handoff'])
    || value.contractVersion !== AI_CONSULTATION_CONTRACT_VERSION_V1
    || !isNonEmptyString(value.messageId, 160)
    || !isNonEmptyString(value.content)
    || !isNonEmptyString(value.createdAt, 80)
    || !Array.isArray(value.sourceRefs)) {
    return issue('INVALID_SHAPE', 'message')
  }
  const validRoleKind = (value.role === 'user' && value.kind === 'user_input')
    || (value.role === 'assistant'
      && ['answer', 'safe_refusal', 'human_handoff', 'technical_failure'].indexOf(String(value.kind)) >= 0)
  if (!validRoleKind) return issue('INVALID_ROLE_KIND', 'message.role/kind')
  const refs: AISourceRefV1[] = []
  for (let index = 0; index < value.sourceRefs.length; index += 1) {
    const validated = validateAISourceRefV1(value.sourceRefs[index])
    if (!validated.ok) return issue('INVALID_SOURCE_REF', `message.sourceRefs[${index}]`)
    refs.push(validated.value)
  }
  let handoff: AIHandoffV1 | undefined
  if (value.handoff !== undefined) {
    const validated = validateAIHandoffV1(value.handoff)
    if (!validated.ok) return validated
    handoff = validated.value
  }
  if (value.kind === 'user_input' && (refs.length > 0 || handoff !== undefined)) {
    return issue('INVALID_ROLE_KIND', 'message.user_input')
  }
  if (value.kind === 'answer'
    && (refs.length === 0 || (handoff !== undefined && handoff.reason !== 'consultant_guidance_suggested'))) {
    return issue('INVALID_ROLE_KIND', 'message.answer')
  }
  if ((value.kind === 'human_handoff' && handoff === undefined)
    || (value.kind === 'technical_failure' && (refs.length > 0 || handoff !== undefined))
    || (value.kind === 'safe_refusal' && refs.length > 0)) {
    return issue('INVALID_ROLE_KIND', `message.${String(value.kind)}`)
  }
  if ((value.kind === 'safe_refusal' && handoff !== undefined && handoff.reason !== 'medical_professional_required')
    || (value.kind === 'human_handoff' && handoff !== undefined
      && (handoff.level !== 'required'
        || handoff.reason === 'medical_professional_required'
        || handoff.reason === 'consultant_guidance_suggested'))) {
    return issue('INVALID_ROLE_KIND', `message.${String(value.kind)}.handoff`)
  }
  const message: AIMessageV1 = {
    contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
    messageId: value.messageId,
    role: value.role as 'user' | 'assistant',
    kind: value.kind as AIMessageV1['kind'],
    content: value.content,
    sourceRefs: refs,
    createdAt: value.createdAt,
  }
  if (handoff) message.handoff = handoff
  return { ok: true, value: message }
}

const stateMatchesMessages = (state: AIConversationV1['state'], messages: readonly AIMessageV1[]): boolean => {
  if (messages.length === 0) return state === 'idle' || state === 'knowledge_unavailable'
  const last = messages[messages.length - 1]
  if (state === 'sending') return last.kind === 'user_input'
  if (state === 'answer_ready') return last.kind === 'answer' || (last.kind === 'safe_refusal' && !last.handoff)
  if (state === 'need_human') return last.kind === 'human_handoff' || (last.kind === 'safe_refusal' && Boolean(last.handoff))
  if (state === 'network_error' || state === 'service_error') return last.kind === 'technical_failure'
  if (state === 'knowledge_unavailable') return last.kind === 'user_input'
  return state === 'idle'
}

export const validateAIConversationV1 = (value: unknown): AIValidationResultV1<AIConversationV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, ['contractVersion', 'ref', 'createdAt', 'state', 'messages'])
    || value.contractVersion !== AI_CONSULTATION_CONTRACT_VERSION_V1
    || !isNonEmptyString(value.createdAt, 80)
    || typeof value.state !== 'string'
    || (STATES as readonly string[]).indexOf(value.state) < 0
    || !Array.isArray(value.messages)) {
    return issue('INVALID_SHAPE', 'conversation')
  }
  const ref = validateAIConversationRefV1(value.ref)
  if (!ref.ok) return ref
  const messages: AIMessageV1[] = []
  const ids: string[] = []
  for (let index = 0; index < value.messages.length; index += 1) {
    const validated = validateAIMessageV1(value.messages[index])
    if (!validated.ok) return issue('INVALID_SHAPE', `conversation.messages[${index}]`)
    if (ids.indexOf(validated.value.messageId) >= 0) return issue('INVALID_SHAPE', `conversation.messages[${index}].messageId`)
    ids.push(validated.value.messageId)
    messages.push(validated.value)
  }
  const state = value.state as AIConversationV1['state']
  if (!stateMatchesMessages(state, messages)) return issue('INVALID_STATE', 'conversation.state')
  return {
    ok: true,
    value: {
      contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
      ref: ref.value,
      createdAt: value.createdAt,
      state,
      messages,
    },
  }
}

export const validateAISafetyPolicyInputV1 = (value: unknown): AIValidationResultV1<AIConsultationSafetyPolicyInputV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'requestCategory',
      'userRequestedHuman',
      'consecutiveAllowedKnowledgeInsufficiencyCount',
      'hasSufficientAllowedKnowledge',
    ])
    || typeof value.requestCategory !== 'string'
    || (REQUEST_CATEGORIES as readonly string[]).indexOf(value.requestCategory) < 0
    || typeof value.userRequestedHuman !== 'boolean'
    || !Number.isInteger(value.consecutiveAllowedKnowledgeInsufficiencyCount)
    || (value.consecutiveAllowedKnowledgeInsufficiencyCount as number) < 0
    || typeof value.hasSufficientAllowedKnowledge !== 'boolean') {
    return issue('INVALID_POLICY', 'policy')
  }
  return { ok: true, value: value as unknown as AIConsultationSafetyPolicyInputV1 }
}

export const validateAIContextSourcesV1 = (value: unknown): AIValidationResultV1<readonly AIConsultationContextSourceInputV1[]> => {
  if (!Array.isArray(value)) return issue('INVALID_CONTEXT', 'contextSources')
  const sources: AIConsultationContextSourceInputV1[] = []
  const identities: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (!isRecord(item)
      || !hasExactKeys(item, ['category', 'publicLabel', 'publicSummary'], ['publicVersion', 'publicRef'])
      || !isAllowedAISourceCategoryV1(item.category)
      || !isNonEmptyString(item.publicLabel, 120)
      || !isNonEmptyString(item.publicSummary, 1200)
      || /https?:\/\//i.test(item.publicLabel)) {
      return issue('INVALID_CONTEXT', `contextSources[${index}]`)
    }
    if (item.publicVersion !== undefined && !isSafeOpaquePublicRef(item.publicVersion)) {
      return issue('INVALID_CONTEXT', `contextSources[${index}].publicVersion`)
    }
    if (item.publicRef !== undefined && !isSafeOpaquePublicRef(item.publicRef)) {
      return issue('INVALID_CONTEXT', `contextSources[${index}].publicRef`)
    }
    const identity = `${item.category}|${String(item.publicVersion || '')}|${String(item.publicRef || '')}`
    if (identities.indexOf(identity) >= 0) return issue('INVALID_CONTEXT', `contextSources[${index}]`)
    identities.push(identity)
    const source: AIConsultationContextSourceInputV1 = {
      category: item.category,
      publicLabel: item.publicLabel,
      publicSummary: item.publicSummary,
    }
    if (typeof item.publicVersion === 'string') source.publicVersion = item.publicVersion
    if (typeof item.publicRef === 'string') source.publicRef = item.publicRef
    sources.push(source)
  }
  return { ok: true, value: sources }
}

export type AIKnowledgeAllowlistEvaluationV1 =
  | { allowed: true; sources: readonly AIConsultationContextSourceInputV1[] }
  | { allowed: false; issues: readonly AIValidationIssueV1[] }

export const evaluateAIKnowledgeAllowlistV1 = (value: unknown): AIKnowledgeAllowlistEvaluationV1 => {
  const validation = validateAIContextSourcesV1(value)
  return validation.ok
    ? { allowed: true, sources: validation.value }
    : { allowed: false, issues: validation.issues.slice() }
}

export const validateAIApplicationSnapshotV1 = (
  value: unknown,
): AIValidationResultV1<AIConsultationPublicApplicationSnapshotV1> => {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'kind', 'contractVersion', 'conversationRef', 'conversationCreatedAt', 'state', 'messages',
      'responseProvenance', 'actions',
    ])
    || value.kind !== 'ai_consultation_public_application_snapshot_v1'
    || value.contractVersion !== AI_CONSULTATION_CONTRACT_VERSION_V1
    || !isNonEmptyString(value.conversationCreatedAt, 80)
    || typeof value.state !== 'string'
    || (STATES as readonly string[]).indexOf(value.state) < 0
    || !Array.isArray(value.messages)
    || !['approved_faq', 'live_backend', 'unavailable'].includes(String(value.responseProvenance))
    || !isRecord(value.actions)
    || !hasExactKeys(value.actions, ['canSend', 'canRetry', 'canOpenHumanHandoff'])
    || typeof value.actions.canSend !== 'boolean'
    || typeof value.actions.canRetry !== 'boolean'
    || typeof value.actions.canOpenHumanHandoff !== 'boolean') {
    return issue('INVALID_SHAPE', 'applicationSnapshot')
  }
  const ref = validateAIConversationRefV1(value.conversationRef)
  if (!ref.ok) return ref
  const internalMessages: AIMessageV1[] = []
  const publicMessages: AIConsultationPublicApplicationSnapshotV1['messages'][number][] = []
  const messageIds: string[] = []
  for (let index = 0; index < value.messages.length; index += 1) {
    const raw = value.messages[index]
    if (!isRecord(raw)
      || !hasExactKeys(raw, ['messageId', 'role', 'kind', 'content', 'sourceRefs', 'createdAt'], ['handoff'])) {
      return issue('INVALID_SHAPE', `applicationSnapshot.messages[${index}]`)
    }
    const internal = validateAIMessageV1({
      contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
      ...raw,
    })
    if (!internal.ok) return issue('INVALID_SHAPE', `applicationSnapshot.messages[${index}]`)
    if (messageIds.indexOf(internal.value.messageId) >= 0) {
      return issue('INVALID_SHAPE', `applicationSnapshot.messages[${index}].messageId`)
    }
    messageIds.push(internal.value.messageId)
    internalMessages.push(internal.value)
    const projected = {
      messageId: internal.value.messageId,
      role: internal.value.role,
      kind: internal.value.kind,
      content: internal.value.content,
      sourceRefs: internal.value.sourceRefs,
      createdAt: internal.value.createdAt,
    } as AIConsultationPublicApplicationSnapshotV1['messages'][number]
    if (internal.value.handoff) projected.handoff = internal.value.handoff
    publicMessages.push(projected)
  }
  const state = value.state as AIConversationV1['state']
  if (!stateMatchesMessages(state, internalMessages)) return issue('INVALID_STATE', 'applicationSnapshot.state')
  const lastMessage = internalMessages.length > 0 ? internalMessages[internalMessages.length - 1] : null
  const expectedCanSend = state !== 'sending' && state !== 'need_human'
  const expectedCanRetry = state === 'knowledge_unavailable' || state === 'network_error' || state === 'service_error'
  const expectedCanOpenHumanHandoff = Boolean(
    lastMessage && lastMessage.handoff && lastMessage.handoff.destination === 'global_consultant_service',
  )
  if (value.actions.canSend !== expectedCanSend
    || value.actions.canRetry !== expectedCanRetry
    || value.actions.canOpenHumanHandoff !== expectedCanOpenHumanHandoff) {
    return issue('INVALID_STATE', 'applicationSnapshot.actions')
  }
  return {
    ok: true,
    value: {
      kind: 'ai_consultation_public_application_snapshot_v1',
      contractVersion: AI_CONSULTATION_CONTRACT_VERSION_V1,
      conversationRef: ref.value,
      conversationCreatedAt: value.conversationCreatedAt,
      state,
      messages: publicMessages,
      responseProvenance: value.responseProvenance as AIConsultationPublicApplicationSnapshotV1['responseProvenance'],
      actions: {
        canSend: value.actions.canSend,
        canRetry: value.actions.canRetry,
        canOpenHumanHandoff: value.actions.canOpenHumanHandoff,
      },
    },
  }
}

export const validateAIApplicationResultV1 = (
  value: unknown,
): AIValidationResultV1<AIConsultationPublicApplicationResultV1> => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return issue('INVALID_SHAPE', 'applicationResult')
  if (value.ok) {
    if (!hasExactKeys(value, ['ok', 'value'])) return issue('INVALID_SHAPE', 'applicationResult')
    const snapshot = validateAIApplicationSnapshotV1(value.value)
    return snapshot.ok ? { ok: true, value: { ok: true, value: snapshot.value } } : snapshot
  }
  if (!hasExactKeys(value, ['ok', 'error']) || !isRecord(value.error)
    || !hasExactKeys(value.error, ['code', 'publicMessage', 'retryable', 'snapshot'])
    || (value.error.code !== 'NETWORK_ERROR' && value.error.code !== 'SERVICE_ERROR')
    || !isNonEmptyString(value.error.publicMessage, 300)
    || typeof value.error.retryable !== 'boolean') {
    return issue('INVALID_SHAPE', 'applicationResult.error')
  }
  const snapshot = validateAIApplicationSnapshotV1(value.error.snapshot)
  if (!snapshot.ok) return snapshot
  const expectedState = value.error.code === 'NETWORK_ERROR' ? 'network_error' : 'service_error'
  if (snapshot.value.state !== expectedState) return issue('INVALID_STATE', 'applicationResult.error.snapshot.state')
  return {
    ok: true,
    value: {
      ok: false,
      error: {
        code: value.error.code,
        publicMessage: value.error.publicMessage,
        retryable: value.error.retryable,
        snapshot: snapshot.value,
      },
    },
  }
}

export const validateProviderAnswerCandidateV1 = (value: unknown): AIValidationResultV1<{ kind: 'answer'; content: string }> => {
  if (!isRecord(value)
    || !hasExactKeys(value, ['kind', 'content'])
    || value.kind !== 'answer'
    || !isNonEmptyString(value.content, 4000)) {
    return issue('INVALID_PROVIDER_CANDIDATE', 'providerCandidate')
  }
  return { ok: true, value: { kind: 'answer', content: value.content } }
}
