// Demo presentation only. No Institution facts, recommendation or public contacts are written.
import { readDemo } from './session'
import directory from './directory.json'
import { parseInstitutionDetailRouteQuery, serializeInstitutionDetailRoute } from '../services/institution-detail-route'
import type { InstitutionDetailRoute } from '../services/institution-detail-route'
import { buildInstitutionDetailPageSnapshot } from '../services/institution-list-detail-page'
import { assessmentSummary } from './record-presentation'
import { getNavigationGuard } from '../utils/navigation-guard'

import { storyInstitutionId, storyDisplayName } from './story-name'
export { storyInstitutionId, storyDisplayName } from './story-name'
export const storyDestination = (route: InstitutionDetailRoute | undefined, page: string): string => {
  if (!route) return ''
  const url = serializeInstitutionDetailRoute(route.identity, route.source === 'recommendation' ? 'recommendation' : 'direct_link', route.sourceContextRef)
  return url ? url.replace('/pages/institution/detail', page) : ''
}
export type StoryContext = { institutionId: string; recordRevision: number; name: string; detailUrl: string; mapUrl: string; vrUrl: string; consultantUrl: string; appointmentUrl: string; mediaAvailable: boolean; epoch: number }
export const isStoryCurrent = (context: StoryContext | null): boolean => { const state = readDemo(); return !!context && state.ready && state.epoch === context.epoch }
export async function resolveStory(query: Record<string, string | undefined>): Promise<StoryContext | null> {
  const parsed = parseInstitutionDetailRouteQuery(query)
  const state = readDemo()
  if (!parsed.ok || !state.ready) return null
  const route = parsed.value, row = directory.find(r => r.institutionId === route.identity.institutionId)
  if (!row) return null
  const detail = await buildInstitutionDetailPageSnapshot(route)
  if (!detail.ok || readDemo().epoch !== state.epoch || !readDemo().ready
    || detail.value.datasetMode !== 'MOCK_DEVELOPMENT_ONLY' || detail.value.contextKind === 'HISTORICAL_READ_ONLY') return null
  return { ...route.identity, name: storyDisplayName(row.institutionId, row.displayName), epoch: state.epoch,
    detailUrl: storyDestination(route, '/pages/institution/detail'), mapUrl: storyDestination(route, '/pages/showcase/map-real'),
    vrUrl: storyDestination(route, '/pages/showcase/vr-real'), consultantUrl: storyDestination(route, '/pages/consultant/consultation'),
    appointmentUrl: storyDestination(route, '/pages/appointment/create'), mediaAvailable: row.institutionId === storyInstitutionId && route.identity.recordRevision === 1 }
}
export function queryFromUrl(url: string): Record<string, string> {
  const query: Record<string, string> = {}
  ;(url.split('?')[1] || '').split('&').forEach(pair => { const [key, value] = pair.split('='); if (key && value) query[key] = value })
  return query
}
export const storyNeeds = () => {
  const state = readDemo(), elder = state.elders[0]
  const assessment = elder && state.assessments.filter(a => a.elderId === elder.elderId).slice(-1)[0]
  return elder && assessment ? { name: elder.name.replace(/^演示老人[·・]/, ''), summary: assessmentSummary(assessment) } : null
}
export function backFromStory(page: object, context: StoryContext | null, fail: () => void): void {
  const guard = getNavigationGuard(page)
  if (!guard.acquire('story.back')) return
  const callbacks = { fail, complete: () => guard.release('story.back') }
  try {
    if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1, ...callbacks })
    else wx.redirectTo({ url: context ? context.detailUrl : '/pages/showcase/index', ...callbacks })
  } catch (_) { guard.release('story.back'); fail() }
}
