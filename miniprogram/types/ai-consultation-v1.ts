export const AI_CONSULTATION_CONTRACT_VERSION_V1 = 'ai-consultation-contract-v1' as const
export const AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1 = 'ai_consultation_public_application_snapshot_v1' as const

export type AIConsultationContractVersionV1 = typeof AI_CONSULTATION_CONTRACT_VERSION_V1

export type AIConversationRefV1 =
  | { kind: 'service_conversation'; conversationId: string }
  | { kind: 'local_session'; localSessionId: string }

export type AIConsultationStateV1 =
  | 'idle'
  | 'sending'
  | 'answer_ready'
  | 'need_human'
  | 'knowledge_unavailable'
  | 'network_error'
  | 'service_error'

export type AIMessageRoleV1 = 'user' | 'assistant'

export type AIMessageKindV1 =
  | 'user_input'
  | 'answer'
  | 'safe_refusal'
  | 'human_handoff'
  | 'technical_failure'

export type AISourceCategoryV1 =
  | 'product_faq'
  | 'profile_display_snapshot'
  | 'recommendation_display_snapshot'
  | 'institution_display_snapshot'
  | 'visit_faq'

export interface AISourceRefV1 {
  category: AISourceCategoryV1
  publicLabel: string
  publicVersion?: string
  publicRef?: string
}

export type AIHandoffLevelV1 = 'required' | 'suggested'

export type AIHandoffReasonV1 =
  | 'user_requested_human'
  | 'allowed_knowledge_insufficient'
  | 'institution_confirmation_required'
  | 'realtime_business_fact_required'
  | 'contract_payment_or_complaint'
  | 'appointment_or_complex_care'
  | 'medical_professional_required'
  | 'consultant_guidance_suggested'

export interface AIHandoffV1 {
  level: AIHandoffLevelV1
  reason: AIHandoffReasonV1
  publicExplanation: string
  destination?: 'global_consultant_service'
}

export interface AIMessageV1 {
  contractVersion: AIConsultationContractVersionV1
  messageId: string
  role: AIMessageRoleV1
  kind: AIMessageKindV1
  content: string
  sourceRefs: readonly AISourceRefV1[]
  handoff?: AIHandoffV1
  createdAt: string
}

export interface AIConversationV1 {
  contractVersion: AIConsultationContractVersionV1
  ref: AIConversationRefV1
  createdAt: string
  state: AIConsultationStateV1
  messages: readonly AIMessageV1[]
}

export interface AIMessagePublicProjectionV1 {
  messageId: string
  role: AIMessageRoleV1
  kind: AIMessageKindV1
  content: string
  sourceRefs: readonly AISourceRefV1[]
  handoff?: AIHandoffV1
  createdAt: string
}

export interface AIConsultationPublicApplicationSnapshotV1 {
  kind: typeof AI_CONSULTATION_PUBLIC_SNAPSHOT_KIND_V1
  contractVersion: AIConsultationContractVersionV1
  conversationRef: AIConversationRefV1
  conversationCreatedAt: string
  state: AIConsultationStateV1
  messages: readonly AIMessagePublicProjectionV1[]
  responseProvenance: 'approved_faq' | 'live_backend' | 'unavailable'
  actions: {
    canSend: boolean
    canRetry: boolean
    canOpenHumanHandoff: boolean
  }
}

export type AIConsultationPublicApplicationResultV1 =
  | { ok: true; value: AIConsultationPublicApplicationSnapshotV1 }
  | {
      ok: false
      error: {
        code: 'NETWORK_ERROR' | 'SERVICE_ERROR'
        publicMessage: string
        retryable: boolean
        snapshot: AIConsultationPublicApplicationSnapshotV1
      }
    }

/** B5 internal policy input. It is not a provider prompt or a Page contract. */
export type AIConsultationRequestCategoryV1 =
  | 'allowlisted_explanation'
  | 'prohibited_nonmedical'
  | 'medical_professional_judgment'
  | 'institution_confirmation'
  | 'realtime_business_fact'
  | 'contract_payment_or_complaint'
  | 'appointment_or_complex_care'

export interface AIConsultationSafetyPolicyInputV1 {
  requestCategory: AIConsultationRequestCategoryV1
  userRequestedHuman: boolean
  consecutiveAllowedKnowledgeInsufficiencyCount: number
  hasSufficientAllowedKnowledge: boolean
}

/**
 * Already-authorized display/application-safe input. Exact-shape validation is
 * required before this value can become provider-facing context.
 */
export interface AIConsultationContextSourceInputV1 {
  category: AISourceCategoryV1
  publicLabel: string
  publicSummary: string
  publicVersion?: string
  publicRef?: string
}

export interface AIConsultationProviderContextV1 {
  category: AISourceCategoryV1
  publicSummary: string
  publicVersion?: string
  publicRef?: string
}

export interface AIConsultationProviderRequestV1 {
  contractVersion: AIConsultationContractVersionV1
  userInput: string
  context: readonly AIConsultationProviderContextV1[]
}

export type AIConsultationProviderCandidateResultV1 =
  | { ok: true; candidate: unknown }
  | { ok: false; failure: 'network_error' | 'service_error' }

export interface AIConsultationProviderPortV1 {
  readonly responseProvenance: 'approved_faq' | 'live_backend'
  requestCandidate(input: AIConsultationProviderRequestV1): AIConsultationProviderCandidateResultV1
}

export interface AIConsultationApplicationRequestV1 {
  conversation: unknown
  userInput: unknown
  userMessageId: unknown
  userMessageCreatedAt: unknown
  responseMessageId: unknown
  responseCreatedAt: unknown
  policy: unknown
  contextSources: unknown
}

export interface AIConsultationApplicationServiceV1 {
  consult(input: AIConsultationApplicationRequestV1): AIConsultationPublicApplicationResultV1
}

export type AIValidationIssueCodeV1 =
  | 'INVALID_SHAPE'
  | 'INVALID_CONTRACT_VERSION'
  | 'INVALID_IDENTITY'
  | 'INVALID_STATE'
  | 'INVALID_ROLE_KIND'
  | 'INVALID_SOURCE_REF'
  | 'INVALID_HANDOFF'
  | 'INVALID_POLICY'
  | 'INVALID_CONTEXT'
  | 'INVALID_PROVIDER_CANDIDATE'

export interface AIValidationIssueV1 {
  code: AIValidationIssueCodeV1
  path: string
}

export type AIValidationResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly AIValidationIssueV1[] }

export type AISafetyEvaluationV1 =
  | { kind: 'answer'; state: 'answer_ready' }
  | { kind: 'safe_refusal'; state: 'answer_ready'; handoff: null }
  | { kind: 'safe_refusal'; state: 'need_human'; handoff: AIHandoffV1 }
  | { kind: 'human_handoff'; state: 'need_human'; handoff: AIHandoffV1 }
  | { kind: 'knowledge_unavailable'; state: 'knowledge_unavailable' }
