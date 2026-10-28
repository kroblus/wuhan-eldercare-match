import type { InstitutionCanonicalIdentity, InstitutionDetailApplicationSnapshotV12, InstitutionDetailFutureSectionsV121, InstitutionDetailSectionsV12 } from './institution-list-detail'

/** Application-only read result, not a new Institution/domain or history version. */
export type InstitutionDirectoryReadContext = Pick<InstitutionDetailApplicationSnapshotV12,
  'identity' | 'datasetVersion' | 'datasetMode' | 'evaluationAsOf' | 'recordStatus' | 'recordProvenance' | 'source' | 'contextKind' | 'recommendationContext'>

export type InstitutionDirectoryContactFacts = Pick<InstitutionDetailFutureSectionsV121, 'officialAddress' | 'officialContact'>

export interface InstitutionDirectoryReadSnapshot extends InstitutionDirectoryReadContext {
  kind: 'institution_directory_read_snapshot_v1'
  source: 'direct'
  contextKind: 'DIRECT_CURRENT'
  recommendationContext: null
  sections: {
    price: InstitutionDetailSectionsV12['price']
    futureV121: InstitutionDirectoryContactFacts
  }
}

export type InstitutionDirectoryReadResult =
  | { ok: true; value: InstitutionDirectoryReadSnapshot }
  | { ok: false; error: { code: string } }

export interface InstitutionDirectoryReadService {
  read(identities: readonly InstitutionCanonicalIdentity[], evaluationAsOf: string): Promise<readonly InstitutionDirectoryReadResult[]>
}
