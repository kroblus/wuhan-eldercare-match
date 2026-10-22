import { readModeCatalog } from './catalog'
// Only the exact displayed identity/revision: never substitute current evidence for a historical page.
export const readInstitutionSourceNotes = (id: string, revision: number) => {
  const record = readModeCatalog().records.find(row => row.institutionId === id && row.recordRevision === revision)
  if (!record) return []
  const notes: { key: string; title: string; url: string; fields: string; verifiedOn: string; validUntil: string }[] = []
  for (const evidence of record.evidence) {
    if (typeof evidence.sourceReference !== 'string' || !evidence.sourceReference.startsWith('https://')) continue
    const url = evidence.sourceReference
    const field = evidence.fieldPath === 'identity.name' ? '机构名称' : evidence.fieldPath.startsWith('identity.region') ? '所在区域' : evidence.fieldPath === 'publicLocation.address' ? '地址' : evidence.fieldPath.startsWith('officialContact.') ? '联系方式' : ''
    if (!field) continue
    const verifiedOn = (evidence.verifiedAt || '').slice(0, 10), validUntil = (evidence.validUntil || '').slice(0, 10)
    const prior = notes.find(note => note.url === url && note.verifiedOn === verifiedOn && note.validUntil === validUntil)
    if (prior) { if (!prior.fields.split('、').includes(field)) prior.fields += '、' + field; continue }
    notes.push({ key: url + '#' + verifiedOn + '#' + validUntil, title: url.startsWith('https://zrzyhcxjs.wuhan.gov.cn/') ? '武汉市官方行政区划资料' : url.startsWith('https://mzj.wuhan.gov.cn/') ? '武汉市民政局公开资料' : '公开资料来源', url, fields: field,
      verifiedOn, validUntil })
  }
  return notes
}
