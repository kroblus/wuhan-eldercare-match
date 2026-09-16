import {
  lookupApprovedFaqV1,
  validateAIApprovedFaqManifestV1,
} from '../domain/ai-consultation/index'
import type { AIApprovedFaqLookupResultV1 } from '../domain/ai-consultation/lookup-approved-faq'
import {
  AI_APPROVED_FAQ_MANIFEST_KIND_V1,
  AI_APPROVED_FAQ_MANIFEST_VERSION_V1,
} from '../types/ai-consultation-faq-v1'
import type {
  AIApprovedFaqEntryV1,
  AIApprovedFaqManifestV1,
} from '../types/ai-consultation-faq-v1'
import type {
  AIConsultationContextSourceInputV1,
  AIConsultationProviderPortV1,
  AIConsultationProviderRequestV1,
  AIConsultationProviderCandidateResultV1,
  AIValidationIssueV1,
} from '../types/ai-consultation-v1'

/**
 * There is no owner-approved production FAQ entry in the repository yet.
 * Keeping the manifest valid but empty preserves the B6 honest-unavailable
 * behavior until each entry has explicit approval evidence.
 */
export const AI_APPROVED_FAQ_PRODUCTION_MANIFEST_V1: AIApprovedFaqManifestV1 = {
  kind: AI_APPROVED_FAQ_MANIFEST_KIND_V1,
  manifestVersion: AI_APPROVED_FAQ_MANIFEST_VERSION_V1,
  entries: [],
}

export interface AIApprovedFaqProviderV1 extends AIConsultationProviderPortV1 {
  readonly manifest: AIApprovedFaqManifestV1
  lookup(input: string): AIApprovedFaqLookupResultV1
}

export type AIApprovedFaqProviderCreationResultV1 =
  | { ok: true; provider: AIApprovedFaqProviderV1 }
  | { ok: false; issues: readonly AIValidationIssueV1[] }

export const toAIConsultationContextSourceV1 = (
  entry: AIApprovedFaqEntryV1,
): AIConsultationContextSourceInputV1 => ({
  category: entry.category,
  publicLabel: entry.publicLabel,
  publicSummary: entry.answer,
  publicVersion: entry.publicVersion,
  publicRef: entry.publicRef,
})

const requestCandidate = (
  manifest: AIApprovedFaqManifestV1,
  input: AIConsultationProviderRequestV1,
): AIConsultationProviderCandidateResultV1 => {
  const lookup = lookupApprovedFaqV1(manifest, input.userInput)
  if (lookup.kind !== 'match') return { ok: false, failure: 'service_error' }
  return { ok: true, candidate: { kind: 'answer', content: lookup.entry.answer } }
}

export const createAIApprovedFaqProviderV1 = (
  manifest: unknown,
): AIApprovedFaqProviderCreationResultV1 => {
  const validated = validateAIApprovedFaqManifestV1(manifest)
  if (!validated.ok) return { ok: false, issues: validated.issues }
  const normalizedManifest = validated.value
  const provider: AIApprovedFaqProviderV1 = {
    responseProvenance: 'approved_faq',
    manifest: normalizedManifest,
    lookup(input: string): AIApprovedFaqLookupResultV1 {
      return lookupApprovedFaqV1(normalizedManifest, input)
    },
    requestCandidate(input: AIConsultationProviderRequestV1): AIConsultationProviderCandidateResultV1 {
      return requestCandidate(normalizedManifest, input)
    },
  }
  return { ok: true, provider }
}
