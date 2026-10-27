// Presentation only. Parse an explicit timestamp, then render China time
// independently of the device timezone. Never infer a business state from it.
export const formatChinaDateTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '时间待确认'
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) return '时间待确认'
  const china = new Date(instant + 8 * 60 * 60 * 1000)
  const pad = (part: number) => String(part).padStart(2, '0')
  return china.getUTCFullYear() + '年' + (china.getUTCMonth() + 1) + '月' + china.getUTCDate() + '日 '
    + pad(china.getUTCHours()) + ':' + pad(china.getUTCMinutes())
}
