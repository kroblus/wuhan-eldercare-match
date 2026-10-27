// Public, explanatory sidecar. Not an Institution fact or matching input.
export interface InstitutionCapabilityReview {
  reviewedOn: string; summary: string; stateLabel: string; questions: readonly string[]
  sources: readonly { key: string; title: string; publisher: string; url: string; publishedOn: string | null; publicationNote: string }[]
}
