import type { AIApprovedFaqEntryV1, AIApprovedFaqManifestV1 } from '../../types/ai-consultation-faq-v1'
import { normalizeApprovedFaqQueryV1, validateAIApprovedFaqManifestV1 } from './validate-approved-faq'
import type { AIValidationIssueV1 } from '../../types/ai-consultation-v1'

export type AIApprovedFaqLookupResultV1 =
  | { kind: 'match'; entry: AIApprovedFaqEntryV1 }
  | { kind: 'no_match' }
  | { kind: 'ambiguous'; contentIds: readonly string[] }
  | { kind: 'invalid_manifest'; issues: readonly AIValidationIssueV1[] }

/** Lookup over a manifest that has already passed validation. */
export const lookupValidatedApprovedFaqV1 = (
  manifest: AIApprovedFaqManifestV1,
  input: string,
): AIApprovedFaqLookupResultV1 => {
  const normalizedInput = normalizeApprovedFaqQueryV1(input)
  if (normalizedInput.length === 0) return { kind: 'no_match' }
  const matches: AIApprovedFaqEntryV1[] = []
  manifest.entries.forEach((entry) => {
    const phrases = [entry.question].concat(entry.aliases as string[])
    if (phrases.some((phrase) => normalizeApprovedFaqQueryV1(phrase) === normalizedInput)) matches.push(entry)
  })
  if (matches.length === 0) return { kind: 'no_match' }
  if (matches.length > 1) return { kind: 'ambiguous', contentIds: matches.map((entry) => entry.contentId) }
  return { kind: 'match', entry: matches[0] }
}

export const lookupApprovedFaqV1 = (
  manifest: unknown,
  input: string,
): AIApprovedFaqLookupResultV1 => {
  const validated = validateAIApprovedFaqManifestV1(manifest)
  if (!validated.ok) return { kind: 'invalid_manifest', issues: validated.issues }
  return lookupValidatedApprovedFaqV1(validated.value, input)
}
