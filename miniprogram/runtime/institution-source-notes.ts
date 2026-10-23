import type { InstitutionSourceNote } from './institution-source-note-types'
import type { InstitutionCapabilityReview } from './institution-capability-review-types'
export const readInstitutionCapabilityReview = (_id: string, _revision: number): InstitutionCapabilityReview | null => null
export const readInstitutionSourceNotes = (_id: string, _revision: number): readonly InstitutionSourceNote[] => []
export const readInstitutionDirectoryInfo = (_id: string, _revision: number): { natureLabel: string; notes: readonly string[] } => ({ natureLabel: '', notes: [] })
