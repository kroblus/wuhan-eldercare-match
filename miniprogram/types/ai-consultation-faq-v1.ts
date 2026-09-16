export const AI_APPROVED_FAQ_MANIFEST_KIND_V1 = 'ai_approved_faq_manifest_v1' as const
export const AI_APPROVED_FAQ_MANIFEST_VERSION_V1 = 'ai-faq-manifest-v1' as const

export type AIApprovedFaqCategoryV1 = 'product_faq' | 'visit_faq'

export type AIApprovedFaqApprovalStatusV1 = 'approved' | 'pending' | 'rejected'

/**
 * Internal production-content shape.  Approval fields are never projected to
 * the public Application result.
 */
export interface AIApprovedFaqEntryV1 {
  contentId: string
  category: AIApprovedFaqCategoryV1
  question: string
  aliases: readonly string[]
  answer: string
  manifestVersion: string
  approvalStatus: AIApprovedFaqApprovalStatusV1
  approvalAuthority: string
  approvalEvidenceRef: string
  publicLabel: string
  publicVersion: string
  publicRef: string
}

export interface AIApprovedFaqManifestV1 {
  kind: typeof AI_APPROVED_FAQ_MANIFEST_KIND_V1
  manifestVersion: string
  entries: readonly AIApprovedFaqEntryV1[]
}
