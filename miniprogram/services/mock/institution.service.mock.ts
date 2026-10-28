import { legacyInstitutions } from '../../runtime/legacy-institution-data'
import type { Institution } from '../../types/domain'
import type { InstitutionServiceContract } from '../contracts'

/** 仅供开发期页面壳层使用的本地 provider。 */
export class MockInstitutionService implements InstitutionServiceContract {
  listInstitutions(): Promise<Institution[]> {
    return Promise.resolve(legacyInstitutions)
  }

  getInstitution(id: string): Promise<Institution | null> {
    return Promise.resolve(legacyInstitutions.find((institution) => institution.id === id) || null)
  }
}

export const mockInstitutionService = new MockInstitutionService()
