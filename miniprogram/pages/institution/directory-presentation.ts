import { institutionDetailApplicationV12 } from '../../services/institution-list-detail-page'
import { readInstitutionDirectoryInfo } from '../../runtime/institution-source-notes'
import { createInstitutionDetailPageViewModel } from './detail-view-model'
import type { InstitutionListItemViewModel } from './list-view-model'
import type { InstitutionDetailApplicationSnapshotV12, InstitutionListDisplayItemV12 } from '../../types/institution-list-detail'

// Allocate the existing evidence-gated nature label once, never infer from name/type.
export const presentDirectoryNature = (nature: string): { nature: string; factTags: readonly string[] } =>
  ['公办', '民办', '公建民营'].indexOf(nature) >= 0
    ? { nature: '', factTags: [nature] } : { nature, factTags: [] }

// Only the existing application-safe reference total; qualifiers stay in Detail.
export const presentDirectoryPrice = (price: InstitutionDetailApplicationSnapshotV12['sections']['price']): string => {
  const fact = price.referenceMonthlyPrice as InstitutionListDisplayItemV12['referenceMonthlyPrice']
  const value = fact && fact.value
  if (!fact || fact.availability !== 'provided' || fact.effectiveVerification !== 'current_verified'
    || !value || value.currency !== 'CNY' || value.period !== 'month' || value.basis !== 'reference_total') return ''
  for (const key of ['priceNote', 'adjustmentFactors', 'deposit']) {
    const qualifier = price[key] as { availability?: string; value?: unknown } | undefined
    if (qualifier && qualifier.availability === 'provided' && qualifier.value !== null
      && qualifier.value !== '' && (!Array.isArray(qualifier.value) || qualifier.value.length > 0)) return ''
  }
  if ((price.oneTimeFees as readonly unknown[] || []).length
    || (price.recurringComponents as readonly { referenceAmount: { availability: string } }[] || [])
      .some(row => row.referenceAmount.availability === 'provided')) return ''
  const amount = (minor: number): string => Number.isSafeInteger(minor) && minor > 0
    ? (minor / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
  const min = amount(value.minAmountMinor)
  if (!min) return ''
  if (value.kind === 'starting_at' && value.maxAmountMinor === null) return `参考月费 ¥${min}起/月`
  const max = value.maxAmountMinor === null ? '' : amount(value.maxAmountMinor)
  return value.kind === 'bounded' && max && (value.maxAmountMinor as number) >= value.minAmountMinor
    ? `参考月费 ¥${min}–${max}/月` : ''
}

// Ordinary directory display only. Reuse the exact revision and evaluation time
// through the existing application projector; never read raw provider facts here.
export const decorateDirectoryCards = async (
  items: readonly InstitutionListItemViewModel[], evaluationAsOf: string,
): Promise<readonly InstitutionListItemViewModel[]> => Promise.all(items.map(async item => {
  if (item.navigationIntent.source !== 'direct_list' || item.navigationIntent.sourceContextRef) return item
  const card = { ...item.card, compact: true, address: '', addressStatus: '', price: '', phone: '' }
  try {
    const info = readInstitutionDirectoryInfo(item.institutionId, item.recordRevision)
    Object.assign(card, presentDirectoryNature(info.natureLabel || item.card.nature))
    card.notes = Array.from(new Set(item.card.notes.concat(info.notes)))
    const result = await institutionDetailApplicationV12.build({
      identity: { institutionId: item.institutionId, recordRevision: item.recordRevision },
      source: 'direct', sourceContextRef: null, evaluationAsOf,
    })
    if (!result.ok) return { ...item, card }
    const snapshot = result.value
    if (snapshot.identity.institutionId !== item.institutionId || snapshot.identity.recordRevision !== item.recordRevision
      || snapshot.source !== 'direct' || snapshot.contextKind !== 'DIRECT_CURRENT'
      || snapshot.recordStatus !== 'published' || snapshot.evaluationAsOf !== evaluationAsOf
      || (snapshot.datasetMode === 'MOCK_DEVELOPMENT_ONLY') !== card.isDemo
      || (snapshot.recordProvenance === 'MOCK_DEVELOPMENT_ONLY') !== card.isDemo) return { ...item, card }
    const detail = createInstitutionDetailPageViewModel(snapshot)
    // institution-ordinary-directory-display-v1; Recommendation remains unchanged.
    card.address = detail.location.addressState === 'ready' ? detail.location.address : ''
    if (detail.location.addressState === 'address_expired' || detail.location.addressState === 'address_unverified') {
      card.notes = Array.from(new Set(card.notes.concat(detail.location.addressStatus)))
    }
    // Keep concrete contact warnings, not a generic unknown/no-call row on every card.
    const contact = detail.officialContact
    const contactRisks = contact.phones.filter(phone => phone.state !== 'verified').map(phone =>
      phone.state === 'pending' ? `官方电话：${phone.statusLabel}` : phone.statusLabel)
    if (contact.state === 'unavailable') contactRisks.push(contact.statusLabel)
    card.notes = Array.from(new Set(card.notes.concat(contactRisks)))
    card.price = presentDirectoryPrice(snapshot.sections.price)
    return { ...item, card }
  } catch (_error) {
    // Supplemental display failure does not hide the basic directory or risks.
    return { ...item, card }
  }
}))
