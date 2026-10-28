import { institutionDirectoryReadService } from '../../services/institution-directory-read'
import { readInstitutionDirectoryInfo } from '../../runtime/institution-source-notes'
import { addressViewModel, officialContactViewModel } from '../../presentation/institution/contact-location'
import type { InstitutionListItemViewModel } from './list-view-model'
import type { InstitutionDetailApplicationSnapshotV12, InstitutionListDisplayItemV12 } from '../../types/institution-list-detail'
import type { InstitutionDirectoryReadContext, InstitutionDirectoryContactFacts, InstitutionDirectoryReadResult } from '../../types/institution-directory-read'

// Allocate the existing evidence-gated nature label once, never infer from name/type.
export const presentDirectoryNature = (nature: string): { nature: string; factTags: readonly string[] } =>
  ['公办', '民办', '公建民营'].indexOf(nature) >= 0
    ? { nature: '', factTags: [nature] } : { nature, factTags: [] }

export const directorySnapshotMatches = (snapshot: InstitutionDirectoryReadContext,
  item: InstitutionListItemViewModel, evaluationAsOf: string): boolean =>
  snapshot.identity.institutionId === item.institutionId && snapshot.identity.recordRevision === item.recordRevision
  && snapshot.source === 'direct' && snapshot.contextKind === 'DIRECT_CURRENT' && !snapshot.recommendationContext
  && snapshot.recordStatus === 'published' && snapshot.evaluationAsOf === evaluationAsOf
  && snapshot.datasetMode === (item.card.isDemo ? 'MOCK_DEVELOPMENT_ONLY' : 'PRODUCTION')
  && snapshot.recordProvenance === (item.card.isDemo ? 'MOCK_DEVELOPMENT_ONLY' : 'PRODUCTION_CANDIDATE')

export const directoryPhone = (snapshot: { sections: { futureV121?: Pick<InstitutionDirectoryContactFacts, 'officialContact'> } },
  detail?: { officialContact: ReturnType<typeof officialContactViewModel> }) => {
  const contact = snapshot.sections.futureV121 && snapshot.sections.futureV121.officialContact
  if (!contact || contact.status !== 'provided' || contact.directory.availability !== 'provided'
    || contact.directory.effectiveVerification !== 'current_verified' || contact.directory.value !== 'present') return undefined
  return (detail ? detail.officialContact : officialContactViewModel(contact)).phones.find(phone =>
    phone.state === 'verified' && phone.callAction.available && !!phone.callAction.dialValue)
}

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

// Ordinary directory only. One bounded read supplies exact, application-safe facts;
// the same address/contact projectors are also used by Detail. No raw records here.
export const decorateDirectoryCards = async (
  items: readonly InstitutionListItemViewModel[], evaluationAsOf: string,
): Promise<readonly InstitutionListItemViewModel[]> => {
  const prepared = items.map(item => {
    if (item.navigationIntent.source !== 'direct_list' || item.navigationIntent.sourceContextRef) return { item, card: null, read: false }
    const card = { ...item.card, compact: true, address: '', addressStatus: '', price: '', phone: '', phoneKey: '' }
    try {
      const info = readInstitutionDirectoryInfo(item.institutionId, item.recordRevision)
      Object.assign(card, presentDirectoryNature(info.natureLabel || item.card.nature))
      card.notes = Array.from(new Set(item.card.notes.concat(info.notes)))
      return { item, card, read: true }
    } catch (_) { return { item, card, read: false } }
  })
  const requested = prepared.filter(entry => entry.read)
  let results: readonly InstitutionDirectoryReadResult[] = []
  if (requested.length) {
    try {
      results = await institutionDirectoryReadService.read(requested.map(({ item }) => ({ institutionId: item.institutionId, recordRevision: item.recordRevision })), evaluationAsOf)
    } catch (_) { /* Optional fields fail closed; retain the basic directory and its risks. */ }
  }
  let resultIndex = 0
  return prepared.map(({ item, card, read }) => {
    if (card === null) return item
    if (!read) return { ...item, card }
    const result = results[resultIndex++]
    if (!result || !result.ok) return { ...item, card }
    try {
      const snapshot = result.value
      if (!directorySnapshotMatches(snapshot, item, evaluationAsOf)) return { ...item, card }
      const location = addressViewModel(snapshot.sections.futureV121.officialAddress)
      card.address = location.addressState === 'ready' ? location.address : ''
      if (location.addressState === 'address_expired' || location.addressState === 'address_unverified') {
        card.notes = Array.from(new Set(card.notes.concat(location.addressStatus)))
      }
      const contact = officialContactViewModel(snapshot.sections.futureV121.officialContact)
      const contactRisks = contact.phones.filter(phone => phone.state !== 'verified').map(phone =>
        phone.state === 'pending' ? `官方电话：${phone.statusLabel}` : phone.statusLabel)
      if (contact.state === 'unavailable') contactRisks.push(contact.statusLabel)
      card.notes = Array.from(new Set(card.notes.concat(contactRisks)))
      card.price = presentDirectoryPrice(snapshot.sections.price)
      const phone = directoryPhone(snapshot, { officialContact: contact })
      card.phoneKey = !card.isDemo && phone ? phone.key : ''
    } catch (_) { /* A failed supplemental projection never hides basic facts or source risks. */ }
    return { ...item, card }
  })
}
