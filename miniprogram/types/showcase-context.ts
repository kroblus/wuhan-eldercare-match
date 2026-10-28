/** UI-only resource context. It never supplies Institution facts or recommendation evidence. */
export type ShowcaseContext = {
  institutionId: string; recordRevision: number; name: string; detailUrl: string
  mapUrl: string; vrUrl: string; consultantUrl: string; appointmentUrl: string
  mediaAvailable: boolean; epoch: number
}
