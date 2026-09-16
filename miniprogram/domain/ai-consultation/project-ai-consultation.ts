import type {
  AIConsultationContextSourceInputV1,
  AIConsultationProviderContextV1,
  AIHandoffV1,
  AIMessagePublicProjectionV1,
  AIMessageV1,
  AISourceRefV1,
} from '../../types/ai-consultation-v1'

export const projectAIProviderContextV1 = (
  sources: readonly AIConsultationContextSourceInputV1[],
): readonly AIConsultationProviderContextV1[] => sources.map((source) => {
  const projected: AIConsultationProviderContextV1 = {
    category: source.category,
    publicSummary: source.publicSummary,
  }
  if (source.publicVersion !== undefined) projected.publicVersion = source.publicVersion
  if (source.publicRef !== undefined) projected.publicRef = source.publicRef
  return projected
})

export const projectAISourceRefsV1 = (
  sources: readonly AIConsultationContextSourceInputV1[],
): readonly AISourceRefV1[] => sources.map((source) => {
  const projected: AISourceRefV1 = {
    category: source.category,
    publicLabel: source.publicLabel,
  }
  if (source.publicVersion !== undefined) projected.publicVersion = source.publicVersion
  if (source.publicRef !== undefined) projected.publicRef = source.publicRef
  return projected
})

export const projectAIPublicMessageV1 = (message: AIMessageV1): AIMessagePublicProjectionV1 => {
  const projected: AIMessagePublicProjectionV1 = {
    messageId: message.messageId,
    role: message.role,
    kind: message.kind,
    content: message.content,
    sourceRefs: message.sourceRefs.map((source) => ({ ...source })),
    createdAt: message.createdAt,
  }
  if (message.handoff) {
    const handoff: AIHandoffV1 = {
      level: message.handoff.level,
      reason: message.handoff.reason,
      publicExplanation: message.handoff.publicExplanation,
    }
    if (message.handoff.destination) handoff.destination = message.handoff.destination
    projected.handoff = handoff
  }
  return projected
}
