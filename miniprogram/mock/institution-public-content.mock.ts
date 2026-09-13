/**
 * MOCK_DEVELOPMENT_ONLY / SYNTHETIC_DEVELOPMENT_ONLY
 *
 * These introductions are generic development copy for the eight example
 * records. They are not statements about real Wuhan institutions and contain
 * no phone, address, map, capability, price, rating, or VR facts.
 */
import type {
  InstitutionPublicContentCatalogV1,
  InstitutionPublicContentCurrentHeadV1,
} from '../types/institution-public-content-v1'
import type { InstitutionPublicContentV1 } from '../types/institution-v1-2-1'

const UPDATED_AT = '2026-08-30T09:00:00.000Z'

const developmentIntroduction = (letter: string): InstitutionPublicContentV1 => ({
  schemaVersion: 'institution-public-content-v1',
  institutionId: `institution-${letter.toLowerCase()}-mock`,
  contentRevision: 1,
  publicationStatus: 'published',
  introduction: {
    availability: 'provided',
    text: `开发演示资料：示例机构 ${letter}（Mock）用于展示机构信息页面结构，具体服务与入住信息需以正式核验资料为准。`,
    sourceType: 'platform_edited',
  },
  updatedAt: UPDATED_AT,
})

export const MOCK_INSTITUTION_PUBLIC_CONTENT_RECORDS: readonly InstitutionPublicContentV1[] = [
  developmentIntroduction('A'),
  developmentIntroduction('B'),
  developmentIntroduction('C'),
  developmentIntroduction('D'),
  developmentIntroduction('E'),
  developmentIntroduction('F'),
  developmentIntroduction('G'),
  developmentIntroduction('H'),
]

/** Explicit current heads. Do not replace with latest/max revision lookup. */
export const MOCK_INSTITUTION_PUBLIC_CONTENT_CURRENT_HEADS: readonly InstitutionPublicContentCurrentHeadV1[] = [
  { institutionId: 'institution-a-mock', contentRevision: 1 },
  { institutionId: 'institution-b-mock', contentRevision: 1 },
  { institutionId: 'institution-c-mock', contentRevision: 1 },
  { institutionId: 'institution-d-mock', contentRevision: 1 },
  { institutionId: 'institution-e-mock', contentRevision: 1 },
  { institutionId: 'institution-f-mock', contentRevision: 1 },
  { institutionId: 'institution-g-mock', contentRevision: 1 },
  { institutionId: 'institution-h-mock', contentRevision: 1 },
]

export const MOCK_INSTITUTION_PUBLIC_CONTENT_CATALOG: InstitutionPublicContentCatalogV1 = {
  records: MOCK_INSTITUTION_PUBLIC_CONTENT_RECORDS,
  currentHeads: MOCK_INSTITUTION_PUBLIC_CONTENT_CURRENT_HEADS,
}
