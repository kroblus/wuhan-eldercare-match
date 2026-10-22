/** Owner-approved APPOINTMENT_PHONE_FORMAT_V1; format is not authorization evidence. */
export const normalizeAppointmentPhoneV1 = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  let start = 0
  let end = value.length
  while (start < end && value.charCodeAt(start) === 0x20) start += 1
  while (end > start && value.charCodeAt(end - 1) === 0x20) end -= 1
  const phone = value.slice(start, end)
  // Length also excludes a final line terminator accepted by JavaScript's `$` anchor.
  return phone.length === 11 && /^1[3-9][0-9]{9}$/.test(phone) ? phone : null
}
