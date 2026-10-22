import { MOCK_INSTITUTIONS } from '../../mock/institutions.mock'
import type { Institution } from '../../types/domain'
import type { InstitutionServiceContract } from '../contracts'

/** 仅供开发期页面壳层使用的本地 provider。 */
export class MockInstitutionService implements InstitutionServiceContract {
  listInstitutions(): Promise<Institution[]> {
    return Promise.resolve(MOCK_INSTITUTIONS)
  }

  getInstitution(id: string): Promise<Institution | null> {
    return Promise.resolve(MOCK_INSTITUTIONS.find((institution) => institution.id === id) || null)
  }
}

export const mockInstitutionService = new MockInstitutionService()
