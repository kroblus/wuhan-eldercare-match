import { institutionDetailApplicationV12 } from '../../services/institution-list-detail-page'
import { readInstitutionDirectoryInfo } from '../../runtime/institution-source-notes'
import { createInstitutionDetailPageViewModel } from './detail-view-model'
import type { InstitutionListItemViewModel } from './list-view-model'

// Ordinary directory display only. Reuse the exact revision and evaluation time
// through the existing application projector; never read raw provider facts here.
export const decorateDirectoryCards = async (
  items: readonly InstitutionListItemViewModel[], evaluationAsOf: string,
): Promise<readonly InstitutionListItemViewModel[]> => Promise.all(items.map(async item => {
  const card = { ...item.card }
  try {
    const info = readInstitutionDirectoryInfo(item.institutionId, item.recordRevision)
    card.nature = info.natureLabel || item.card.nature
    card.notes = Array.from(new Set(item.card.notes.concat(info.notes)))
    const result = await institutionDetailApplicationV12.build({
      identity: { institutionId: item.institutionId, recordRevision: item.recordRevision },
      source: 'direct', sourceContextRef: null, evaluationAsOf,
    })
    if (!result.ok) return { ...item, card }
    const detail = createInstitutionDetailPageViewModel(result.value)
    // Frozen List scope permits state summaries, not the Detail's full address.
    card.address = detail.location.addressState === 'ready'
      ? '地址资料已提供 · 详情可查' : detail.location.addressStatus
    card.addressStatus = ''
    const phoneStates = Array.from(new Set(detail.officialContact.phones.map(phone =>
      phone.state === 'verified' && !!phone.displayValue
        ? '有公开电话记录 · 未实拨' : phone.statusLabel)))
    card.phone = item.card.isDemo ? '演示资料 · 不提供真实联系'
      : phoneStates.length > 0 ? phoneStates.join('；') : detail.officialContact.statusLabel
    return { ...item, card }
  } catch (_error) {
    // Supplemental display failure does not hide the basic directory or risks.
    return { ...item, card }
  }
}))
