import type { DataProvenance, MissingData } from './provenance'

export type Identifier = string
export type Nullable<T> = T | MissingData
export type AnswerValue = string | number | boolean | string[] | null

export interface User {
  id: Identifier
  isAnonymous: boolean
}

export interface Elder {
  id: Identifier
  userId: Nullable<Identifier>
  name: Nullable<string>
  relation: Nullable<string>
  gender: Nullable<'男' | '女'>
  age: Nullable<number>
  createdAt: Nullable<string>
  updatedAt: Nullable<string>
  dataProvenance: DataProvenance
}

export interface AssessmentAnswer {
  questionKey: string
  value: AnswerValue
  isUncertain?: boolean
}

export interface AssessmentDraft {
  id: Nullable<Identifier>
  elderId: Nullable<Identifier>
  status: 'draft'
  answers: AssessmentAnswer[]
  updatedAt: string
  dataProvenance: 'USER_PROVIDED'
}

export interface Assessment {
  id: Identifier
  elderId: Identifier
  status: 'draft' | 'submitted' | 'completed'
  answers: AssessmentAnswer[]
  profileId: Nullable<Identifier>
  createdAt: string
  updatedAt: string
  dataProvenance: DataProvenance
}

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
  region: Nullable<string>
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
