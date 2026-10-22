export interface InstitutionSourceNote { key: string; title: string; url: string; fields: string; verifiedOn: string; validUntil: string }
export const readInstitutionSourceNotes = (_id: string, _revision: number): readonly InstitutionSourceNote[] => []
