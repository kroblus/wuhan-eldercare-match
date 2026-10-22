import {
  evaluateAIKnowledgeAllowlistV1,
  projectAIProviderContextV1,
  projectAISourceRefsV1,
} from '../domain/ai-consultation/index'
import type {
  AIConsultationContextSourceInputV1,
  AIConsultationProviderContextV1,
  AISourceRefV1,
  AIValidationResultV1,
} from '../types/ai-consultation-v1'

export interface AIMinimizedConsultationContextV1 {
  sources: readonly AIConsultationContextSourceInputV1[]
  providerContext: readonly AIConsultationProviderContextV1[]
  sourceRefs: readonly AISourceRefV1[]
}

/**
 * Application-owned allowlist construction. Raw upstream objects are never
 * copied and then redacted; only validated public fields are projected.
 */
export const minimizeAIConsultationContextV1 = (
  input: unknown,
): AIValidationResultV1<AIMinimizedConsultationContextV1> => {
  const allowlist = evaluateAIKnowledgeAllowlistV1(input)
  if (!allowlist.allowed) return { ok: false, issues: allowlist.issues }
  return {
    ok: true,
    value: {
      sources: allowlist.sources,
      providerContext: projectAIProviderContextV1(allowlist.sources),
      sourceRefs: projectAISourceRefsV1(allowlist.sources),
    },
  }
}
