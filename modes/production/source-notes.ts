import { readModeCatalog } from './catalog'
import { publicSources } from './sources'
import { publicDirectoryEntries } from './directory-data'
import { buildPublicDirectoryEntry } from './record-builder'
import { readDirectoryMetadata } from './directory-metadata'
import type { InstitutionSourceNote } from '../runtime/institution-source-note-types'

// Exact identity/revision only; current sources must never replace a historical institution revision.
export const readInstitutionSourceNotes = (id: string, revision: number): readonly InstitutionSourceNote[] => {
  const record = readModeCatalog().records.find(row => row.institutionId === id && row.recordRevision === revision)
  if (!record) return []
  const entry = publicDirectoryEntries.find(row => row.institutionId === id && row.recordRevision === revision)
  const evidence = [...record.evidence, ...(entry ? buildPublicDirectoryEntry(entry).natureEvidence : [])]
  const notes: InstitutionSourceNote[] = []
  for (const item of evidence) {
    if (typeof item.sourceReference !== 'string' || !item.sourceReference.startsWith('https://')) continue
    const document = Object.values(publicSources).find(source => source.url === item.sourceReference)
    const field = item.fieldPath === 'identity.name' ? '机构名称' : item.fieldPath.startsWith('identity.region') ? '所在区域' : item.fieldPath === 'publicLocation.address' ? '地址' : item.fieldPath.startsWith('officialContact.') ? '联系方式' : item.fieldPath === 'directory.nature' ? '机构性质' : ''
    if (!field) continue
    const verifiedOn = (item.verifiedAt || '').slice(0, 10), validUntil = (item.validUntil || '').slice(0, 10)
    const prior = notes.find(note => note.url === item.sourceReference && note.verifiedOn === verifiedOn && note.validUntil === validUntil)
    if (prior) { if (!prior.fields.split('、').includes(field)) prior.fields += '、' + field; continue }
    notes.push({ key: item.sourceReference + '#' + verifiedOn + '#' + validUntil, title: document ? document.title : '公开资料来源', publisher: document ? document.publisher : '来源页面', publishedOn: document ? document.publishedOn : null, publicationNote: document && document.publicationNote || '', url: item.sourceReference, fields: field, verifiedOn, validUntil })
  }
  return notes
}
export const readInstitutionDirectoryInfo = (id: string, revision: number): { natureLabel: string; notes: readonly string[] } => {
  const record = readModeCatalog().records.find(row => row.institutionId === id && row.recordRevision === revision)
  if (!record) return { natureLabel: '', notes: [] }
  const metadata = readDirectoryMetadata().find(row => row.institutionId === id && row.recordRevision === revision)
  const entry = publicDirectoryEntries.find(row => row.institutionId === id && row.recordRevision === revision)
  return { natureLabel: metadata ? metadata.natureLabel : '', notes: entry && entry.notes || [] }
}
