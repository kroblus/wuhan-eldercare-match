import type { Institution } from '../types/domain'

export type ServiceState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export interface InstitutionServiceContract {
  listInstitutions(): Promise<Institution[]>
  getInstitution(id: string): Promise<Institution | null>
}
