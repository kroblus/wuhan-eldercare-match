import type { RecommendationResultPageViewModelV2 } from '../presentation/recommendation/result-v2-view-model'
export type RecommendationCards = Pick<RecommendationResultPageViewModelV2, 'cards' | 'conditionalCards'>
export const institutionDisplayName = (_id: string, fallback: string): string => fallback
export const profileHeadline = (headline: string): string => headline
export const presentRecommendationNames = <T extends RecommendationCards>(view: T): T => view
