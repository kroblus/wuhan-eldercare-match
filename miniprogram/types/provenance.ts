/** 数据缺失与来源语义，禁止把未知数据渲染成业务事实。 */
export type DataProvenance =
  | 'MOCK_DEVELOPMENT_ONLY'
  | 'USER_PROVIDED'
  | 'VERIFIED'
  | 'UNKNOWN'

export type MissingData = null | 'unknown' | '需咨询'

export const UNKNOWN_DATA: MissingData = 'unknown'
export const NEEDS_CONSULTATION: MissingData = '需咨询'
