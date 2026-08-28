import type { DataProvenance, MissingData } from './provenance'
import type { BasicGender, BasicRelationship, CompletedAssessment } from './assessment'
export type {
  AssessmentAnswerSnapshot,
  AssessmentAnswerValueMap,
  AssessmentDraft,
  AssessmentDraftAnswers,
  AssessmentEvidenceKind,
  AssessmentQuestionId,
  OptionalAssessmentQuestionId,
  RequiredAssessmentQuestionId,
  AssessmentStepId,
  CompletedAssessment,
  PreferenceRegionAnswer,
} from './assessment'

export type Identifier = string
export type Nullable<T> = T | MissingData

export interface User {
  id: Identifier
  isAnonymous: boolean
}

export interface Elder {
  id: Identifier
  userId: Nullable<Identifier>
  name: Nullable<string>
  relation: Nullable<BasicRelationship>
  gender: Nullable<BasicGender>
  age: Nullable<number>
  createdAt: Nullable<string>
  updatedAt: Nullable<string>
  dataProvenance: DataProvenance
}

/** 兼容旧领域引用；它严格等价于未来服务器返回的已完成历史评估。 */
export type Assessment = CompletedAssessment

export interface ElderProfile {
  id: Identifier
  elderId: Identifier
  assessmentId: Identifier
  summary: Nullable<string>
  tags: string[]
  /** 内部 ADL 结果仅供推荐服务使用，页面骨架不直接展示。 */
  adlLevel: Nullable<'自理' | '轻度照护' | '半失能' | '失能' | '重度失能'>
  dataProvenance: DataProvenance
}

export interface InstitutionService {
  key: string
  label: string
  status: 'supported' | 'needs_consultation' | 'not_supported' | 'unknown'
  dataProvenance: DataProvenance
}

export interface InstitutionMedia {
  id: Identifier
  kind: 'image' | 'vr_preview'
  label: Nullable<string>
  url: Nullable<string>
  dataProvenance: DataProvenance
}

export interface InstitutionVR {
  status: 'available' | 'unavailable' | 'unknown'
  url: Nullable<string>
  previewImageUrl: Nullable<string>
  dataProvenance: DataProvenance
}

export interface InstitutionPrice {
  monthlyRange: Nullable<string>
  deposit: Nullable<string>
  note: Nullable<string>
  dataProvenance: DataProvenance
}

export interface Institution {
  id: Identifier
  name: string
  regionCode: Nullable<string>
  regionDisplayName: Nullable<string>
  address: Nullable<string>
  institutionType: Nullable<string>
  coverImageUrl: Nullable<string>
  monthlyFee: Nullable<string>
  services: InstitutionService[]
  media: InstitutionMedia[]
  vr: InstitutionVR
  price: InstitutionPrice
  dataProvenance: DataProvenance
}

export interface RecommendationReason {
  code: string
  text: string
  kind: 'support' | 'caution' | 'unknown'
  dataProvenance: DataProvenance
}

export interface Recommendation {
  id: Identifier
  assessmentId: Identifier
  institutionId: Identifier
  rank: number
  displayLabel: '更适合' | '可以了解' | '暂不确定'
  reasons: RecommendationReason[]
  dataProvenance: DataProvenance
}

export interface Appointment {
  id: Identifier
  institutionId: Identifier
  elderId: Identifier
  visitDate: Nullable<string>
  visitTime: Nullable<'上午' | '下午' | '由顾问协调'>
  contactName: Nullable<string>
  phone: Nullable<string>
  status: 'draft' | 'submitted' | 'confirmed' | 'completed' | 'cancelled' | 'unknown'
  dataProvenance: DataProvenance
}
