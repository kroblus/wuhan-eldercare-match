import type { CompletedAssessmentBySchema, AssessmentPersistenceV2 } from '../../types/assessment-v2'
import { HISTORY_SERVER_TEST_ONLY_SOURCE_V1 } from '../../types/completed-assessment-history'

// Presentation metadata only, not a CompletedAssessment or a persistence/API contract.
// A future authorized reader must validate completion and ownership before projection.
export type HistoryPresentationSnapshot = Pick<CompletedAssessmentBySchema,
  'kind' | 'id' | 'status' | 'schemaVersion' | 'completedAt'> & {
  source: 'TEST_ONLY' | AssessmentPersistenceV2 | typeof HISTORY_SERVER_TEST_ONLY_SOURCE_V1
}

export interface HistoryRow {
  id: string
  number: string
  completedAtLabel: string
  versionLabel: string
  sourceLabel: string
  resultDisabled: boolean
}

export interface HistoryViewModel {
  historyState: 'EMPTY' | 'UNAVAILABLE' | 'ERROR' | 'READY'
  panelState: string
  stateTitle: string
  stateMessage: string
  records: HistoryRow[]
  testOnly: boolean
  invalidRecordsMessage: string
  newAssessmentDisabled: boolean
  actionMessage: string
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const completionTime = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return undefined
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, day)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return undefined
  const zone = match[7]
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : undefined
}

const stateModel = (state: HistoryViewModel['historyState']): HistoryViewModel => {
  const messages = {
    UNAVAILABLE: ['历史记录暂不可用', '当前尚未配置历史记录读取能力，无法据此判断是否已有历史记录。'],
    EMPTY: ['暂无已完成的评估记录', '历史记录读取已完成，返回的记录列表为空。正在填写的问卷不属于历史记录。'],
    ERROR: ['历史记录读取失败', '暂时无法安全展示历史记录，请稍后再试。当前草稿不受影响。'],
    READY: ['历史评估', '历史记录按有效完成时间倒序展示。'],
  }
  return {
    historyState: state,
    panelState: state.toLowerCase(),
    stateTitle: messages[state][0],
    stateMessage: messages[state][1],
    records: [],
    testOnly: false,
    invalidRecordsMessage: '',
    newAssessmentDisabled: true,
    actionMessage: '',
  }
}

// No Provider, storage, Draft reads or TEST_ONLY fixture imports here.
// input is a local display boundary, never a server response or completion validator.
export const createHistoryViewModel = (input?: unknown): HistoryViewModel => {
  if (input === undefined || (object(input) && input.state === 'UNAVAILABLE')) return stateModel('UNAVAILABLE')
  if (object(input) && input.state === 'ERROR') {
    const model = stateModel('ERROR')
    if (input.reason === 'identity') model.stateMessage = '请先确认账号身份，再查看评估记录。当前草稿不受影响。'
    if (input.reason === 'permission') model.stateMessage = '当前账号暂时无权读取评估历史。当前草稿不受影响。'
    return model
  }
  if (!object(input) || input.state !== 'READY' || !Array.isArray(input.records)) return stateModel('ERROR')
  if (input.records.length === 0) return stateModel('EMPTY')

  const accepted: Array<{ snapshot: HistoryPresentationSnapshot; time: number; position: number }> = []
  const ids = new Set<string>()
  input.records.forEach((record: unknown, position: number) => {
    if (!object(record) || record.kind !== 'completed_assessment' || record.status !== 'completed'
      || 'localDraftId' in record || typeof record.id !== 'string' || !record.id.trim()
      || ids.has(record.id) || (record.schemaVersion !== 1 && record.schemaVersion !== 2)
      || (record.source !== 'TEST_ONLY' && record.source !== 'LOCAL_DEVICE_DEVELOPMENT_ONLY' && record.source !== HISTORY_SERVER_TEST_ONLY_SOURCE_V1)) return
    if (record.source === HISTORY_SERVER_TEST_ONLY_SOURCE_V1 && (record.schemaVersion !== 2
      || record.assessmentContractVersion !== 'assessment-schema-v2' || record.snapshotRevision !== 1)) return
    const time = completionTime(record.completedAt)
    if (time === undefined) return
    ids.add(record.id)
    accepted.push({ snapshot: {
      kind: 'completed_assessment', id: record.id, status: 'completed',
      schemaVersion: record.schemaVersion, completedAt: record.completedAt as string,
      source: record.source,
    }, time, position })
  })
  if (accepted.length === 0) return stateModel('ERROR')
  // Never combine synthetic and development records into one apparent history.
  if (accepted.some(item => item.snapshot.source !== accepted[0].snapshot.source)) return stateModel('ERROR')
  accepted.sort((a, b) => b.time - a.time || a.position - b.position)
  const model = stateModel('READY')
  model.testOnly = accepted[0].snapshot.source !== 'LOCAL_DEVICE_DEVELOPMENT_ONLY'
  model.invalidRecordsMessage = accepted.length < input.records.length ? '部分记录资料不完整或重复，已暂不展示。' : ''
  model.records = accepted.map(({ snapshot }, index) => ({
    id: snapshot.id,
    number: index < 9 ? `0${index + 1}` : String(index + 1),
    // Keep the supplied timestamp and offset; do not manufacture a completion date.
    completedAtLabel: snapshot.completedAt,
    versionLabel: `Assessment Schema ${snapshot.schemaVersion}`,
    sourceLabel: snapshot.source === HISTORY_SERVER_TEST_ONLY_SOURCE_V1 ? 'TEST_ONLY · 隔离环境已保存评估'
      : snapshot.source === 'TEST_ONLY' ? 'TEST_ONLY · 合成验收' : '本机开发记录 · 非正式历史',
    resultDisabled: true,
  }))
  return model
}

export const historyActionMessage = (action: 'VIEW_RESULT' | 'NEW_ASSESSMENT'): string =>
  action === 'VIEW_RESULT'
    ? '历史结果暂不可查看。当前未接入当次评估的只读结果入口。'
    : '重新评估暂不可用。须先支持保留当前草稿并创建独立的新评估。'
