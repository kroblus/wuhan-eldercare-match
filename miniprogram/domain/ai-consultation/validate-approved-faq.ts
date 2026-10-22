import type {
  AIApprovedFaqEntryV1,
  AIApprovedFaqManifestV1,
} from '../../types/ai-consultation-faq-v1'
import {
  AI_APPROVED_FAQ_MANIFEST_KIND_V1,
  AI_APPROVED_FAQ_MANIFEST_VERSION_V1,
} from '../../types/ai-consultation-faq-v1'
import type { AIValidationIssueV1, AIValidationResultV1 } from '../../types/ai-consultation-v1'

const FAQ_CATEGORIES = ['product_faq', 'visit_faq'] as const
const APPROVAL_STATUSES = ['approved', 'pending', 'rejected'] as const

const issue = <T>(code: AIValidationIssueV1['code'], path: string): AIValidationResultV1<T> => ({
  ok: false,
  issues: [{ code, path }],
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const hasExactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const allowed = required.concat(optional)
  const keys = Object.keys(value)
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.indexOf(key) >= 0)
}

const isNonEmptyString = (value: unknown, maximumLength: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength

const isSafeOpaqueRef = (value: unknown, maximumLength = 160): value is string =>
  isNonEmptyString(value, maximumLength) && /^[A-Za-z0-9._:-]+$/.test(value)

const normalizeWidth = (value: string): string => value.split('').map((character) => {
  const code = character.charCodeAt(0)
  if (code === 0x3000) return ' '
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0)
  return character
}).join('')

/** Non-semantic normalization only; never performs intent or fuzzy matching. */
export const normalizeApprovedFaqQueryV1 = (value: string): string => normalizeWidth(value)
  .trim()
  .toLowerCase()
  .replace(/[\s\u3000]+/g, ' ')
  .replace(/[，。！？、；：,.!?;:()[\]{}"'“”‘’]/g, '')
  .trim()

const validateEntry = (value: unknown, index: number): AIValidationResultV1<AIApprovedFaqEntryV1> => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'contentId', 'category', 'question', 'aliases', 'answer', 'manifestVersion',
    'approvalStatus', 'approvalAuthority', 'approvalEvidenceRef', 'publicLabel',
    'publicVersion', 'publicRef',
  ])) return issue('INVALID_SHAPE', `entries[${index}]`)
  if (!isSafeOpaqueRef(value.contentId) || !isSafeOpaqueRef(value.manifestVersion)
    || value.manifestVersion !== AI_APPROVED_FAQ_MANIFEST_VERSION_V1) {
    return issue('INVALID_SHAPE', `entries[${index}].identity`)
  }
  if (typeof value.category !== 'string' || (FAQ_CATEGORIES as readonly string[]).indexOf(value.category) < 0) {
    return issue('INVALID_CONTEXT', `entries[${index}].category`)
  }
  if (!isNonEmptyString(value.question, 300) || !Array.isArray(value.aliases) || value.aliases.length === 0
    || !isNonEmptyString(value.answer, 4000)
    || !isSafeOpaqueRef(value.approvalAuthority)
    || !isSafeOpaqueRef(value.approvalEvidenceRef)
    || !isNonEmptyString(value.publicLabel, 120)
    || !isSafeOpaqueRef(value.publicVersion)
    || !isSafeOpaqueRef(value.publicRef)
    || typeof value.approvalStatus !== 'string'
    || (APPROVAL_STATUSES as readonly string[]).indexOf(value.approvalStatus) < 0) {
    return issue('INVALID_SHAPE', `entries[${index}]`)
  }
  if (value.approvalStatus !== 'approved') return issue('INVALID_POLICY', `entries[${index}].approvalStatus`)
  if (/https?:\/\//i.test(value.publicLabel)) return issue('INVALID_SOURCE_REF', `entries[${index}].publicLabel`)
  const aliases: string[] = []
  for (let aliasIndex = 0; aliasIndex < value.aliases.length; aliasIndex += 1) {
    const alias = value.aliases[aliasIndex]
    if (!isNonEmptyString(alias, 300) || normalizeApprovedFaqQueryV1(alias).length === 0) {
      return issue('INVALID_SHAPE', `entries[${index}].aliases[${aliasIndex}]`)
    }
    aliases.push(alias)
  }
  const question = value.question as string
  if (normalizeApprovedFaqQueryV1(question).length === 0) return issue('INVALID_SHAPE', `entries[${index}].question`)
  return {
    ok: true,
    value: {
      contentId: value.contentId as string,
      category: value.category as AIApprovedFaqEntryV1['category'],
      question,
      aliases,
      answer: value.answer as string,
      manifestVersion: value.manifestVersion as string,
      approvalStatus: 'approved',
      approvalAuthority: value.approvalAuthority as string,
      approvalEvidenceRef: value.approvalEvidenceRef as string,
      publicLabel: value.publicLabel as string,
      publicVersion: value.publicVersion as string,
      publicRef: value.publicRef as string,
    },
  }
}

export const validateAIApprovedFaqManifestV1 = (
  value: unknown,
): AIValidationResultV1<AIApprovedFaqManifestV1> => {
  if (!isRecord(value) || !hasExactKeys(value, ['kind', 'manifestVersion', 'entries'])
    || value.kind !== AI_APPROVED_FAQ_MANIFEST_KIND_V1
    || !isSafeOpaqueRef(value.manifestVersion)
    || value.manifestVersion !== AI_APPROVED_FAQ_MANIFEST_VERSION_V1
    || !Array.isArray(value.entries)) {
    return issue('INVALID_SHAPE', 'manifest')
  }
  const entries: AIApprovedFaqEntryV1[] = []
  const contentIds: string[] = []
  const normalizedQuestions = new Map<string, string>()
  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = validateEntry(value.entries[index], index)
    if (!entry.ok) return entry
    if (contentIds.indexOf(entry.value.contentId) >= 0) return issue('INVALID_SHAPE', `entries[${index}].contentId`)
    contentIds.push(entry.value.contentId)
    const phrases = [entry.value.question].concat(entry.value.aliases as string[])
    for (const phrase of phrases) {
      const normalized = normalizeApprovedFaqQueryV1(phrase)
      const previous = normalizedQuestions.get(normalized)
      if (previous) return issue('INVALID_CONTEXT', `entries[${index}].question_or_alias:${previous}`)
      normalizedQuestions.set(normalized, entry.value.contentId)
    }
    entries.push(entry.value)
  }
  return { ok: true, value: { kind: AI_APPROVED_FAQ_MANIFEST_KIND_V1, manifestVersion: value.manifestVersion as string, entries } }
}
