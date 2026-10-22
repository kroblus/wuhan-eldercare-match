import type { InstitutionSourceNote } from './institution-source-note-types'
export const readInstitutionSourceNotes = (_id: string, _revision: number): readonly InstitutionSourceNote[] => []
export const readInstitutionDirectoryInfo = (_id: string, _revision: number): { natureLabel: string; notes: readonly string[] } => ({ natureLabel: '', notes: [] })
