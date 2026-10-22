import type { InstitutionDetailPageViewModelV12, InstitutionDetailFactRowViewModel } from './detail-view-model'

// Display grouping only: original facts, verification states and action gates stay in the ViewModel.
const pending = (row: InstitutionDetailFactRowViewModel): boolean =>
  row.effectiveVerification !== 'expired' && (row.availability === 'unknown'
    || row.value === '暂不明确' && row.verificationLabel === '资料待核验')
const group = (key: string, title: string, rows: readonly InstitutionDetailFactRowViewModel[]) => ({
  key, title, rows: rows.filter(row => !pending(row)),
  pendingLabels: Array.from(new Set(rows.filter(pending).map(row => row.label))).join('、'),
})
export const createDetailReading = (view: InstitutionDetailPageViewModelV12) => {
  const sections = view.overview.sections
  const rows = (key: string) => { const section = sections.find(item => item.key === key); return section ? section.rows : [] }
  const region = view.overview.regionAndType.find(row => row.key === 'basic.region')
  const info = group('info', '资料来源与核验说明', rows('info'))
  return {
    title: view.hasDisclosure ? view.title.replace(/^虚构示例[·・]/, '').replace(/（Mock 演示资料）$/, '') : view.title,
    region: region && region.availability === 'provided' && region.effectiveVerification === 'current_verified' ? region.value : '',
    groups: [group('fees', '费用与入住', rows('fees')), group('care', '照护与日常服务', [...rows('care'), ...rows('life'), ...rows('team')]), info],
    rooms: view.rooms.map(room => ({ ...room, ...group(room.key, room.name, room.rows) })),
  }
}
