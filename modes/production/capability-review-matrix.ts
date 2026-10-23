import { capabilityResearchCases, capabilitySources, capabilityReviewDate } from './capability-reviews'
import { capabilityFieldPaths } from './capability-evidence'
import type { InstitutionCapabilityReview } from '../runtime/institution-capability-review-types'

// Every field is considered independently. Absence in the documents inspected
// means no conclusion, not a negative capability. No row is a Domain patch.
export const readCapabilityReviewMatrix = () => capabilityResearchCases.flatMap(review => {
  const fields = Array.from(new Set([...capabilityFieldPaths.filter(path => path.startsWith('capabilities.')), ...review.observations.reduce<string[]>((all, row) => all.concat(row.fieldPaths), [])]))
  return fields.map(fieldPath => {
    const observation = review.observations.find(row => row.fieldPaths.indexOf(fieldPath) >= 0)
    return { institutionId: review.institutionId, recordRevision: review.recordRevision, institutionName: review.name,
      fieldPath, status: 'unknown' as const, verificationStatus: 'unverified' as const,
      reviewMethod: review.reviewMethod, reviewedOn: capabilityReviewDate,
      sourceKeys: observation ? observation.sourceKeys : Array.from(new Set(review.observations.reduce<string[]>((all, row) => all.concat(row.sourceKeys), []))),
      originalStatement: observation ? observation.originalStatement : null,
      conclusion: observation ? observation.conclusion : '本轮核对的资料未直接说明此项具体能力，保持未知；不代表机构不提供。',
      question: observation ? observation.question : '请机构分别确认此项能力的当前服务范围、限制、是否需要个案评估，并提供有效书面资料。',
      sufficientForCurrentConclusion: false as const, entersMatching: false as const }
  })
})

export const readCapabilityReview = (id: string, revision: number, asOf = Date.now()): InstitutionCapabilityReview | null => {
  const review = capabilityResearchCases.find(row => row.institutionId === id && row.recordRevision === revision)
  if (!review) return null
  const keys = Array.from(new Set(review.observations.reduce<string[]>((all, row) => all.concat(row.sourceKeys), [])))
  const sources = keys.map(key => capabilitySources[key])
  const expired = sources.some(source => Date.parse(source.reviewDueOn + 'T23:59:59.000Z') < asOf)
  const unavailable = sources.some(source => source.reviewState !== 'available')
  return { reviewedOn: capabilityReviewDate,
    stateLabel: unavailable ? '部分资料暂不可用，仍待确认' : expired ? '公开资料核查已到复核期限' : '已查看公开资料，护理条件仍待确认',
    summary: '本轮仅核对公开文件，未电话或现场确认。现有说明不足以确认当前具体护理能力或接收条件，不能视为已适合入住。',
    questions: Array.from(new Set(review.observations.map(row => row.question))),
    sources: keys.map(key => { const source = capabilitySources[key]; return { key, title: source.title, publisher: source.publisher, url: source.url, publishedOn: source.publishedOn, publicationNote: source.publicationNote || '' } }) }
}
