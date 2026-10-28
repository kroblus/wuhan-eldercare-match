import { storyDisplayName } from '../demo/story-name'
import type { RecommendationResultPageViewModelV2 } from '../presentation/recommendation/result-v2-view-model'
type RecommendationCards = Pick<RecommendationResultPageViewModelV2, 'cards' | 'conditionalCards'>
export const institutionDisplayName = storyDisplayName
export const profileHeadline = (headline: string): string => {
  const separator = headline.lastIndexOf(' · ')
  if (separator < 0) return headline
  return headline.slice(0, separator).replace(/^合成老人/, '演示老人').replace(/[（(]TEST ONLY[）)]/g, '').trim() + headline.slice(separator)
}
// Only aliases on a fresh presentation object; no facts, rankings or frozen snapshots change.
export const presentRecommendationNames = <T extends RecommendationCards>(view: T): T => {
  const card = (item: RecommendationCards['cards'][number]) => ({ ...item,
    name: storyDisplayName(item.institutionId, item.name.replace(/^演示名称：/, '')),
    region: item.region.replace(/（Mock 演示目录）$/, ''),
  })
  return { ...view, cards: view.cards.map(card), conditionalCards: view.conditionalCards.map(card) }
}
