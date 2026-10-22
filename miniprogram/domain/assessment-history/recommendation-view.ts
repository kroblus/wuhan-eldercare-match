import type { captureHistoricalRecommendationV1 } from './recommendation-display'
import { recommendationReasonLabelV2, recommendationDifferenceLabelV2,
  isRecommendationReasonVisibleV2, isRecommendationDifferenceVisibleV2 } from '../../pages/recommendation/recommendation-display-semantics'

export type HistoricalRecommendationDisplayV1 = Extract<ReturnType<typeof captureHistoricalRecommendationV1>, { ok: true }>['display']
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]): boolean => Object.keys(v).sort().join('|') === keys.sort().join('|')
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300
const list = (v: unknown, check: (row: unknown) => boolean): boolean => Array.isArray(v) && v.length <= 100 && v.every(check)
const difference = (v: unknown): boolean => object(v) && exact(v, ['differenceCode', 'differenceCategory', 'differenceType', 'severity'])
  && str(v.differenceCode) && ['HARD_CONFLICT', 'SOFT_DIFFERENCE', 'CONDITIONAL_REQUIREMENT', 'UNVERIFIED_DATA_GAP'].includes(String(v.differenceCategory))
  && str(v.differenceType) && ['blocking', 'important', 'advisory'].includes(String(v.severity))
const fact = (v: unknown): boolean => object(v) && exact(v, ['availability', 'value', 'effectiveVerification'])
  && ['current_verified', 'unverified', 'expired'].includes(String(v.effectiveVerification))
  && ((v.availability === 'provided' && v.value !== null) || (['unknown', 'unavailable'].includes(String(v.availability)) && v.value === null))
const display = (v: unknown, id: unknown, revision: unknown): boolean => object(v)
  && exact(v, ['kind', 'institutionId', 'recordRevision', 'recordProvenance', 'recordStatus', 'identity', 'type', 'price', 'media', 'roomFacts', 'mealFacts'])
  && v.kind === 'institution_display_snapshot_v1_1' && v.institutionId === id && v.recordRevision === revision && v.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
  && object(v.identity) && exact(v.identity, ['name', 'regionDisplayName']) && fact(v.identity.name) && fact(v.identity.regionDisplayName)
  && object(v.type) && exact(v.type, ['primaryType', 'supportedTypes']) && fact(v.type.primaryType) && fact(v.type.supportedTypes)
  && object(v.price) && exact(v.price, ['referenceMonthlyPrice']) && fact(v.price.referenceMonthlyPrice)
  && object(v.media) && exact(v.media, ['cover', 'vr'])
  && object(v.media.cover) && exact(v.media.cover, ['state', 'mediaId', 'url'])
  && object(v.media.vr) && exact(v.media.vr, ['state'])
  && list(v.roomFacts, room => object(room) && exact(room, ['roomId', 'roomType']) && str(room.roomId) && fact(room.roomType))
  && object(v.mealFacts) && exact(v.mealFacts, ['mealSchedule', 'easyChewSupport', 'modifiedFoodSupport'])
  && fact(v.mealFacts.mealSchedule) && fact(v.mealFacts.easyChewSupport) && fact(v.mealFacts.modifiedFoodSupport)
const candidate = (v: unknown): boolean => object(v) && exact(v, ['institutionId', 'recordRevision', 'matchTier', 'display', 'reasons', 'differences'])
  && str(v.institutionId) && Number.isInteger(v.recordRevision) && Number(v.recordRevision) > 0
  && ['EXACT', 'SOFT_NEAR', 'CONDITIONAL'].includes(String(v.matchTier)) && display(v.display, v.institutionId, v.recordRevision)
  && list(v.reasons, row => object(row) && exact(row, ['reasonCode', 'reasonType', 'polarity']) && str(row.reasonCode) && str(row.reasonType)
    && ['supported', 'conditional', 'unverified', 'difference', 'conflict'].includes(String(row.polarity))) && list(v.differences, difference)
export const validHistoricalRecommendationV1 = (v: unknown, item: { id: string; completedAt: string }): v is HistoricalRecommendationDisplayV1 => {
  if (!object(v) || !exact(v, ['kind', 'snapshotVersion', 'assessmentId', 'assessmentCompletedAt', 'assessmentSchemaVersion', 'versions', 'evaluationAsOf',
    'source', 'state', 'elderReadiness', 'exactMatch', 'noExactMatch', 'cards', 'conditionalCandidates', 'nearMatches', 'advisories', 'poolRevisions'])) return false
  if (v.kind !== 'historical_recommendation_display_v1' || v.snapshotVersion !== 1 || v.assessmentId !== item.id
    || v.assessmentCompletedAt !== item.completedAt || v.assessmentSchemaVersion !== 2 || !str(v.evaluationAsOf) || !Number.isFinite(Date.parse(v.evaluationAsOf))) return false
  if (!object(v.versions) || !exact(v.versions, ['recommendationContractVersion', 'recommendationRulesetVersion', 'policyVersion', 'elderProfileContractVersion',
    'elderProfileDerivationRulesetVersion', 'adlRulesetVersion', 'institutionContractVersion', 'institutionCapabilityContractVersion'])
    || v.versions.recommendationContractVersion !== 'recommendation-contract-v2' || v.versions.recommendationRulesetVersion !== 'recommendation-ruleset-v2'
    || v.versions.policyVersion !== 'conservative-exact-with-conditional-v1' || v.versions.elderProfileContractVersion !== 'elder-profile-contract-v2'
    || v.versions.elderProfileDerivationRulesetVersion !== 'elder-profile-ruleset-v2' || v.versions.adlRulesetVersion !== 'adl-ruleset-v1'
    || v.versions.institutionContractVersion !== 'institution-contract-v1.1' || v.versions.institutionCapabilityContractVersion !== 'institution-capability-contract-v1') return false
  if (!object(v.source) || !exact(v.source, ['kind', 'reference', 'digest', 'datasetVersion', 'datasetMode'])
    || v.source.kind !== 'SERVER_FORMAL_RECOMMENDATION_CAPTURE_TEST_ONLY_V1' || v.source.datasetMode !== 'MOCK_DEVELOPMENT_ONLY'
    || !str(v.source.reference) || !str(v.source.datasetVersion) || typeof v.source.digest !== 'string' || !/^[0-9a-f]{64}$/.test(v.source.digest)) return false
  if (!['ready_exact', 'ready_soft_near', 'ready_conditional', 'no_safe_recommendation'].includes(String(v.state)) || typeof v.exactMatch !== 'boolean'
    || !['ready', 'blocked_by_required_clarification'].includes(String(v.elderReadiness))) return false
  if (!list(v.cards, candidate) || !list(v.conditionalCandidates, candidate) || !list(v.nearMatches, candidate)
    || !list(v.advisories, row => object(row) && exact(row, ['code', 'role', 'rankParticipation']) && row.code === 'HIGH_CARE_LOW_BUDGET' && row.role === 'advisory_only' && row.rankParticipation === 'not_applicable')
    || !list(v.poolRevisions, row => object(row) && exact(row, ['institutionId', 'recordRevision', 'recordProvenance', 'recordStatus', 'disposition'])
      && str(row.institutionId) && Number.isInteger(row.recordRevision) && Number(row.recordRevision) > 0 && row.recordProvenance === 'MOCK_DEVELOPMENT_ONLY'
      && ['included', 'excluded'].includes(String(row.disposition)))) return false
  if (v.noExactMatch !== null && !(object(v.noExactMatch) && exact(v.noExactMatch, ['code', 'reasonCode', 'differences'])
    && v.noExactMatch.code === 'NO_EXACT_MATCH' && str(v.noExactMatch.reasonCode) && list(v.noExactMatch.differences, difference))) return false
  const cards = v.cards as Array<Record<string, unknown>>, conditional = v.conditionalCandidates as Array<Record<string, unknown>>
  if ((v.state === 'no_safe_recommendation' && (cards.length || conditional.length))
    || (v.state === 'ready_exact' && (!cards.length || conditional.length || cards.some(row => row.matchTier !== 'EXACT')))
    || (v.state === 'ready_soft_near' && (!cards.length || conditional.length || cards.some(row => row.matchTier !== 'SOFT_NEAR')))
    || (v.state === 'ready_conditional' && (cards.length || !conditional.length || conditional.some(row => row.matchTier !== 'CONDITIONAL')))) return false
  const pool = v.poolRevisions as Array<Record<string, unknown>>
  if (new Set(pool.map(row => row.institutionId)).size !== pool.length) return false
  for (const row of [...cards, ...conditional, ...(v.nearMatches as Array<Record<string, unknown>>)]) {
    const pinned = pool.find(entry => entry.institutionId === row.institutionId && entry.recordRevision === row.recordRevision)
    if (!pinned || pinned.disposition !== 'included' || pinned.recordStatus !== (row.display as Record<string, unknown>).recordStatus) return false
  }
  return true
}
const factText = (v: { availability: string; value: unknown; effectiveVerification: string }): string => {
  if (v.availability === 'unknown') return '当时资料未知'
  if (v.availability === 'unavailable') return '当时资料不可用'
  if (v.effectiveVerification === 'unverified') return '当时资料未核验'
  if (v.effectiveVerification === 'expired') return '当时资料已过期'
  return typeof v.value === 'string' ? v.value : '已保存结构化资料'
}
// Read-only projection. No engine, Draft, current Catalog or navigation imports at runtime.
export const historicalRecommendationViewV1 = (v: HistoricalRecommendationDisplayV1) => ({
  title: v.state === 'ready_exact' ? '当次 Exact 候选' : v.state === 'ready_soft_near' ? '当次偏好近似候选'
    : v.state === 'ready_conditional' ? '当次需进一步评估的候选' : '保存当时没有可确认的安全匹配',
  note: v.elderReadiness === 'blocked_by_required_clarification' ? '当时仍有关键老人信息待确认，未生成安全候选。'
    : v.noExactMatch ? `当次没有完全匹配；已保留原结果的差异与资料缺口。` : '候选顺序来自当次已保存结果。',
  version: `Recommendation V2 · 展示快照 V1 · ${v.evaluationAsOf}`,
  cards: [...v.cards, ...v.conditionalCandidates].map((card, index) => ({
    key: `${card.institutionId}:${card.recordRevision}`, order: `${index + 1}`,
    name: factText(card.display.identity.name), region: factText(card.display.identity.regionDisplayName),
    version: `机构 revision ${card.recordRevision} · ${card.matchTier}`,
    reasons: card.reasons.filter(row => isRecommendationReasonVisibleV2(row.reasonCode)).map(row => recommendationReasonLabelV2(row.reasonCode).replace(/当前/g, '当时')),
    differences: card.differences.filter(row => isRecommendationDifferenceVisibleV2(row.differenceCode)).map(row => recommendationDifferenceLabelV2(row.differenceCode).replace(/当前/g, '当时')),
  })),
  gaps: (v.noExactMatch ? v.noExactMatch.differences : []).filter(row => isRecommendationDifferenceVisibleV2(row.differenceCode)).map(row => recommendationDifferenceLabelV2(row.differenceCode)),
})
