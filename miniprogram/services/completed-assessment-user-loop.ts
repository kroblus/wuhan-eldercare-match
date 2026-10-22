import { readHistorySession, persistHistorySession } from './history-assessment-session'
import type { HistorySessionBinding } from './history-assessment-session'
import { defaultHistoryRecoveryStorage, readHistoryRecovery, persistHistoryRecovery, recoveryUuid } from './history-save-recovery'
import type { HistoryRecoveryStorage, HistoryRecoveryRecord } from './history-save-recovery'
import { createC5AuthenticatedBackendSessionClientV1, createC5AuthenticatedJsonHeadersV1, createDefaultWeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import type { WeChatC5BackendTransportV1, C5AuthenticatedBackendSessionV1 } from './c5-authenticated-backend-session'
import { isCompletedAssessmentHistoryMetadataV1 } from './completed-assessment-history'
import { HISTORY_API_CONTRACT_V1, HISTORY_SERVER_TEST_ONLY_SOURCE_V1 } from '../types/completed-assessment-history'
import type { CompletedAssessmentHistoryMetadataV1, HistoricalDetailReadV1, HistoricalProfileDisplayV1 } from '../types/completed-assessment-history'
import { validateAssessmentDraftV2, validateAssessmentAnswersV2 } from '../types/assessment-v2'
import type { AssessmentDraftV2 } from '../types/assessment-v2'
import { validHistoricalRecommendationV1 } from '../domain/assessment-history/recommendation-view'
import type { HistoricalRecommendationDisplayV1 } from '../domain/assessment-history/recommendation-view'
import { validTrustedAssessmentPreviewV1, trustedPreviewProjectionV1 } from './trusted-assessment-preview'
import type { TrustedAssessmentPreviewV1, TrustedPreviewProjectionV1 } from './trusted-assessment-preview'

export type HistoricalRecommendationRead = { state: 'READY'; display: HistoricalRecommendationDisplayV1 }
  | { state: 'UNAVAILABLE' | 'UNSUPPORTED_VERSION' | 'ERROR'; message: string }

export interface HistoryDraftPort {
  getDraft(): AssessmentDraftV2
  hasAnswers(): boolean
  requiresLegacyRecovery(): boolean
  prepareEmptyHistoryDraft?(): AssessmentDraftV2
  replaceSavedHistoryDraft?(expected: AssessmentDraftV2, candidate: AssessmentDraftV2): { draft: AssessmentDraftV2; persistence: { ok: boolean } }
}
export type SaveFeedback = { state: 'SUCCESS'; item: CompletedAssessmentHistoryMetadataV1; message: string }
  | { state: 'ERROR'; message: string }
export interface HistorySaveConfirmation { message: string }
interface TrustedProof { candidate: TrustedAssessmentPreviewV1; origin: string; fingerprint: string }
interface SaveProof { token: HistorySaveConfirmation; origin: string; scopeId: string; fingerprint: string; trusted?: TrustedProof }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]): boolean => Object.keys(v).sort().join('|') === keys.sort().join('|')
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const PROFILE_LABELS = ['照护需求', '行动能力', '康复需求', '食物质地支持', '吞咽关注', '认知关注']
const display = (v: unknown, item: CompletedAssessmentHistoryMetadataV1): v is HistoricalProfileDisplayV1 => object(v)
  && exact(v, ['kind', 'snapshotVersion', 'assessmentId', 'assessmentCompletedAt', 'assessmentSchemaVersion', 'profileContractVersion', 'derivationRulesetVersion', 'rows'])
  && v.kind === 'historical_profile_display_v1' && v.snapshotVersion === 1 && v.assessmentId === item.id
  && v.assessmentCompletedAt === item.completedAt && v.assessmentSchemaVersion === 2
  && v.profileContractVersion === 'elder-profile-contract-v2' && v.derivationRulesetVersion === 'elder-profile-ruleset-v2'
  && Array.isArray(v.rows) && v.rows.length === 6 && v.rows.every((row, index) => object(row)
    && exact(row, ['label', 'value']) && row.label === PROFILE_LABELS[index]
    && typeof row.value === 'string' && row.value.length > 0 && row.value.length <= 80)
export type HistoryDraftState = 'UNSAVED' | 'SAVING' | 'SAVE_UNCONFIRMED' | 'SAVED_UNCHANGED' | 'SAVED_WITH_LOCAL_CHANGES' | 'RECOVERY_REQUIRED' | 'STATE_UNKNOWN'
interface Intent { verifiedPayload: boolean; sessionId: string; fingerprint: string; body: Record<string, unknown>; record: HistoryRecoveryRecord; item?: CompletedAssessmentHistoryMetadataV1 }
// Raw retry payload stays in memory only; minimal recovery metadata survives process death.
// Entries are accessed only after the server resolves the current account's sole Elder binding.
const saveIntents = new Map<string, Intent>()
const saveOperations = new Map<string, Promise<SaveFeedback>>()
const transitionOperations = new Set<string>()

export const createCompletedAssessmentUserLoopV1 = (
  draftSource: () => HistoryDraftPort,
  transport: WeChatC5BackendTransportV1 = createDefaultWeChatC5BackendTransportV1(),
  recoveryStorage: HistoryRecoveryStorage = defaultHistoryRecoveryStorage(),
) => {
  const auth = createC5AuthenticatedBackendSessionClientV1(transport)
  let intent: Intent | undefined
  let pending: Promise<SaveFeedback> | undefined
  let feedback = ''
  let saveConfirmation: SaveProof | undefined
  let preparingConfirmation = false
  let confirmationGeneration = 0
  let trusted: TrustedProof | undefined, preparingPreview = false
  const error = (message: string): SaveFeedback => ({ state: 'ERROR', message })
  const capability = async (): Promise<boolean> => {
    try {
      if (transport.environment() !== 'develop') return false
      const origin = auth.resolveBackendOrigin()
      if (!origin) return false
      const response = await transport.request({ url: `${origin}/api/v1/completed-assessments/user-loop-capability`, method: 'GET', timeout: 15000, header: { Accept: 'application/json' } })
      const v = response.data
      return response.statusCode === 200 && object(v) && exact(v, ['contractVersion', 'kind', 'availability', 'source'])
        && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'completed_assessment_user_loop_capability_v1'
        && v.availability === 'ready' && v.source === HISTORY_SERVER_TEST_ONLY_SOURCE_V1
    } catch (_error) { return false }
  }
  const session = async (): Promise<C5AuthenticatedBackendSessionV1 | null> => {
    const result = await auth.acquireSession(auth.resolveBackendOrigin())
    return result.kind === 'authenticated' ? result.session : null
  }
  const request = (s: C5AuthenticatedBackendSessionV1, path: string, method: 'GET' | 'POST', data?: Record<string, unknown>) =>
    transport.request({ url: s.origin + path, method, data, timeout: 15000, header: createC5AuthenticatedJsonHeadersV1(s) })
  const recoveryEnvelope = (v: unknown): v is Record<string, unknown> => object(v)
    && exact(v, ['contractVersion', 'kind', 'scopeId', 'intentId', 'createdAt', 'state', 'item', 'sessionId'])
    && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'history_save_recovery_v1'
  const currentScope = async (s: C5AuthenticatedBackendSessionV1): Promise<string | null> => {
    const response = await request(s, '/api/v1/completed-assessments/save-intents/scope', 'GET')
    return response.statusCode === 200 && recoveryEnvelope(response.data) && response.data.state === 'SCOPE'
      && recoveryUuid(response.data.scopeId) ? response.data.scopeId : null
  }
  const inspectContext = async (s: C5AuthenticatedBackendSessionV1, scope: string, context: string): Promise<string | null> => {
    const r = await request(s, '/api/v1/completed-assessments/assessment-sessions/inspect-context', 'POST', { draftContext: context }), v = r.data
    return r.statusCode === 200 && object(v) && exact(v, ['contractVersion','kind','scopeId','draftContext','state'])
      && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'history_assessment_session_inspection_v1'
      && v.scopeId === scope && v.draftContext === context && ['UNREGISTERED','UNSAVED','PENDING_OR_UNCERTAIN','CONFIRMED'].includes(String(v.state)) ? String(v.state) : null
  }
  const assist = '请保留草稿。受控人工核验流程尚待批准，可由项目负责人安排核验；不会自动放弃或重建原意图。'
  const freshReadScope = async (): Promise<{ session: C5AuthenticatedBackendSessionV1; scope: string } | null> => {
    auth.clearSession(); const s = await session(); if (!s) return null
    const scope = await currentScope(s); return scope ? { session: s, scope } : null
  }
  const readScopeUnchanged = async (s: C5AuthenticatedBackendSessionV1, scope: string): Promise<boolean> => {
    const current = await freshReadScope(); return current !== null && current.session.origin === s.origin && current.scope === scope
  }
  const confirm = async (s: C5AuthenticatedBackendSessionV1, record: HistoryRecoveryRecord): Promise<SaveFeedback> => {
    const response = await request(s, '/api/v1/completed-assessments/save-intents/reconcile', 'POST', { scopeId: record.scopeId, intentId: record.intentId })
    const v = response.data
    if (response.statusCode === 200 && recoveryEnvelope(v) && v.state === 'CONFIRMED' && v.scopeId === record.scopeId && v.intentId === record.intentId && isCompletedAssessmentHistoryMetadataV1(v.item)) {
      auth.clearSession()
      const current = await session()
      if (!current || current.origin !== record.origin || await currentScope(current) !== record.scopeId)
        return error('核对期间账号或老人绑定已变化，停止展示。原恢复标识和草稿保持不变。')
      const existing = typeof v.sessionId === 'string' ? saveIntents.get(record.scopeId + '|' + v.sessionId) : undefined
      if (existing && existing.record.intentId === record.intentId) { existing.item = { ...v.item } }
      // A failed confirmation-marker write still leaves the original pending record for another query.
      try { persistHistoryRecovery(recoveryStorage, { ...record, state: 'confirmed' }) } catch (_error) { /* never resend based on this failure */ }
      return { state: 'SUCCESS', item: v.item, message: `保存成功 · 已核对原保存记录 ${v.item.id.slice(0, 8)}。当前草稿保持不变。` }
    }
    return error('保存结果仍待确认。可重新核对；不会自动新建或重新提交。' + assist)
  }
  const recover = async (): Promise<SaveFeedback | null> => {
    try {
      if (!await capability()) return null
      auth.clearSession()
      const s = await session()
      if (!s) return error('身份无法确认，停止恢复。' + assist)
      const scope = await currentScope(s)
      if (!scope) return error('合法老人绑定无法确认，停止恢复。' + assist)
      const record = readHistoryRecovery(recoveryStorage)
      if (!record) {
        const binding = readHistorySession(recoveryStorage), draft = draftSource().getDraft()
        if (binding && (binding.origin !== s.origin || binding.scopeId !== scope)) return error('遗留草稿的会话不属于当前账号、老人或环境；停止恢复。' + assist)
        const state = await inspectContext(s, scope, draft.localDraftId)
        return state === 'UNREGISTERED' || state === 'UNSAVED' ? null : error('保存恢复标识缺失，服务器状态不能作为当前答案一致的证明。' + assist)
      }
      if (record.origin !== s.origin) return error('保存结果待确认，测试环境不一致。已保留恢复标识和草稿。')
      if (scope !== record.scopeId) return error('账号或老人绑定不一致，停止核对。已保留原恢复标识和草稿。')
      return await confirm(s, record)
    } catch (_error) { return error('恢复标识损坏或服务暂不可用；禁止新保存。' + assist) }
  }
  const sessionEnvelope = (v: unknown): v is Record<string, unknown> => object(v)
    && exact(v, ['contractVersion','kind','scopeId','sessionId','draftContext','createdAt'])
    && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'history_assessment_session_v1'
    && recoveryUuid(v.scopeId) && recoveryUuid(v.sessionId) && typeof v.draftContext === 'string'
  const checkedBinding = async (s: C5AuthenticatedBackendSessionV1, scope: string, binding: HistorySessionBinding): Promise<boolean> => {
    if (binding.origin !== s.origin || binding.scopeId !== scope) return false
    if (await currentScope(s) !== scope) return false
    const r = await request(s, '/api/v1/completed-assessments/assessment-sessions/check', 'POST', { sessionId: binding.sessionId })
    return r.statusCode === 200 && sessionEnvelope(r.data) && r.data.scopeId === scope && r.data.sessionId === binding.sessionId && r.data.draftContext === binding.draftContext
  }
  const bindCurrent = async (s: C5AuthenticatedBackendSessionV1, scope: string, context: string): Promise<HistorySessionBinding | null> => {
    let binding = readHistorySession(recoveryStorage)
    if (binding && binding.state === 'switch_requested') return null
    if (binding && binding.state === 'switch_prepared') {
      // A crash after the one-slot write can finish metadata activation; never replace old contents here.
      if (context !== binding.nextDraftContext) return null
      const next: HistorySessionBinding = { version: 1, origin: binding.origin, scopeId: binding.scopeId,
        sessionId: binding.nextSessionId as string, draftContext: binding.nextDraftContext as string, state: 'active' }
      if (!await checkedBinding(s, scope, next)) return null
      persistHistorySession(recoveryStorage, next); binding = next
    }
    if (binding) return binding.draftContext === context && await checkedBinding(s, scope, binding) ? binding : null
    // Old unresolved operation must never be converted to a fresh session.
    if (readHistoryRecovery(recoveryStorage)) return null
    const r = await request(s, '/api/v1/completed-assessments/assessment-sessions/register', 'POST', { intent: 'REGISTER_CURRENT_ASSESSMENT', draftContext: context })
    if (r.statusCode !== 200 || !sessionEnvelope(r.data) || r.data.scopeId !== scope || r.data.draftContext !== context) return null
    const created: HistorySessionBinding = { version: 1, origin: s.origin, scopeId: scope, sessionId: r.data.sessionId as string, draftContext: context, state: 'active' }
    persistHistorySession(recoveryStorage, created); return created
  }
  const fingerprint = (draft: AssessmentDraftV2): string => JSON.stringify({ localDraftId: draft.localDraftId, answers: draft.answers })
  const checkTrusted = async (proof: TrustedProof): Promise<boolean> => {
    const fresh = await freshReadScope(), binding = readHistorySession(recoveryStorage)
    if (!fresh || fresh.session.origin !== proof.origin || fresh.scope !== proof.candidate.scopeId || !binding
      || binding.sessionId !== proof.candidate.sessionId || binding.state !== 'active'
      || fingerprint(draftSource().getDraft()) !== proof.fingerprint || !await checkedBinding(fresh.session, fresh.scope, binding)) return false
    const c = proof.candidate
    const r = await request(fresh.session, '/api/v1/completed-assessments/trusted-previews/check', 'POST', { sessionId: c.sessionId, previewId: c.previewId, displayBinding: c.displayBinding }), v = r.data
    return r.statusCode === 200 && object(v) && exact(v,['contractVersion','kind','sessionId','previewId','state'])
      && v.contractVersion === HISTORY_API_CONTRACT_V1 && v.kind === 'trusted_recommendation_preview_inspection_v1'
      && v.sessionId === c.sessionId && v.previewId === c.previewId && v.state === 'READY'
      && fingerprint(draftSource().getDraft()) === proof.fingerprint && await readScopeUnchanged(fresh.session,fresh.scope)
  }
  const createTrustedPreview = async (): Promise<{ state: 'READY'; projection: TrustedPreviewProjectionV1 } | { state: 'ERROR'; message: string }> => {
    if (preparingPreview || preparingConfirmation || pending || saveOperations.has(auth.resolveBackendOrigin()) || transitionOperations.has(auth.resolveBackendOrigin()))
      return { state:'ERROR', message:'已有保存或核验处理中，请先核对原操作。草稿保留。' }
    preparingPreview = true; trusted = undefined; saveConfirmation = undefined
    const generation = ++confirmationGeneration
    try {
      if (!await capability()) return { state:'ERROR',message:'隔离测试能力未开放。' }
      const fresh = await freshReadScope(), store = draftSource(), draft = store.getDraft()
      if (!fresh || store.requiresLegacyRecovery() || !validateAssessmentDraftV2(draft).valid || !validateAssessmentAnswersV2(draft.answers,true).valid)
        return {state:'ERROR',message:'身份、老人绑定或完整合成问卷无法核验。草稿保留。'}
      const record = readHistoryRecovery(recoveryStorage)
      if (record && (record.origin !== fresh.session.origin || record.scopeId !== fresh.scope || record.draftContext === draft.localDraftId))
        return {state:'ERROR',message:'原保存需要核对，不能为同一会话另建候选。请核对原历史。'}
      const state = await inspectContext(fresh.session,fresh.scope,draft.localDraftId)
      if (!state || !['UNREGISTERED','UNSAVED'].includes(state)) return {state:'ERROR',message:'服务器存在原保存状态，已停止新核验；请核对原意图。'}
      const binding = await bindCurrent(fresh.session,fresh.scope,draft.localDraftId)
      if (!binding) return {state:'ERROR',message:'会话无法可靠绑定，草稿保留。'}
      const elder = await request(fresh.session,'/api/v1/elder-record','GET'), e = elder.data
      if (elder.statusCode !== 200 || !object(e) || e.availability !== 'bound' || typeof e.elderId !== 'string') return {state:'ERROR',message:'合法老人绑定不可用。'}
      if (generation !== confirmationGeneration || fingerprint(store.getDraft()) !== fingerprint(draft) || !await readScopeUnchanged(fresh.session,fresh.scope))
        return {state:'ERROR',message:'核验期间答案、身份或会话变化，请重新核验。'}
      const r = await request(fresh.session,'/api/v1/completed-assessments/trusted-previews','POST',{
        kind:'trusted_recommendation_preview_request_v1',sessionId:binding.sessionId,assessmentContractVersion:'assessment-schema-v2',schemaVersion:2,
        elderId:e.elderId,answers:JSON.parse(JSON.stringify(draft.answers)),
      })
      if (r.statusCode !== 200 || !validTrustedAssessmentPreviewV1(r.data) || r.data.scopeId !== fresh.scope || r.data.sessionId !== binding.sessionId
        || generation !== confirmationGeneration || fingerprint(store.getDraft()) !== fingerprint(draft) || !await readScopeUnchanged(fresh.session,fresh.scope))
        return {state:'ERROR',message:'未收到当前合法会话的可信展示；已停止保存。草稿保留。'}
      trusted = {candidate:JSON.parse(JSON.stringify(r.data)),origin:fresh.session.origin,fingerprint:fingerprint(draft)}
      return {state:'READY',projection:trustedPreviewProjectionV1(trusted.candidate)}
    } catch (_error) {return {state:'ERROR',message:'服务器核验失败；原意图和草稿保留，请稍后核对。'}}
    finally {preparingPreview = false}
  }
  const requestSaveConfirmation = async (previewProof?: TrustedProof): Promise<{ state: 'CONFIRM'; confirmation: HistorySaveConfirmation } | { state: 'ERROR'; message: string }> => {
    if (preparingConfirmation || pending || saveOperations.has(auth.resolveBackendOrigin()) || transitionOperations.has(auth.resolveBackendOrigin()))
      return { state: 'ERROR', message: '已有保存或切换处理中，请等待核对；草稿保持不变。' }
    preparingConfirmation = true; saveConfirmation = undefined
    const generation = ++confirmationGeneration
    try {
      if (!await capability()) return { state: 'ERROR', message: 'TEST_ONLY 保存能力未开放。' }
      const fresh = await freshReadScope()
      if (!fresh) return { state: 'ERROR', message: '身份或合法老人绑定无法确认。' + assist }
      const s = fresh.session, scope = fresh.scope, store = draftSource(), draft = store.getDraft()
      const original = previewProof && saveIntents.get(scope + '|' + previewProof.candidate.sessionId)
      const originalRetry = previewProof && original && !original.item && original.fingerprint === fingerprint(draft)
        && original.body.previewId === previewProof.candidate.previewId && original.body.displayBinding === previewProof.candidate.displayBinding
        && previewProof.origin === s.origin && previewProof.candidate.scopeId === scope
      if (previewProof && !originalRetry && !await checkTrusted(previewProof)) return {state:'ERROR',message:'可信展示已失效或内容、身份、会话变化，请重新查看并核验；未提交。'}
      const record = readHistoryRecovery(recoveryStorage), binding = readHistorySession(recoveryStorage)
      if (record && (record.origin !== s.origin || record.scopeId !== scope)) return { state: 'ERROR', message: '原意图属于其他账号、老人或环境；不能用设备草稿推定归属。' + assist }
      if (binding && (binding.state !== 'active' || binding.draftContext !== draft.localDraftId || !await checkedBinding(s, scope, binding)))
        return { state: 'ERROR', message: '草稿会话归属或切换状态无法确认。' + assist }
      const state = await inspectContext(s, scope, draft.localDraftId)
      if (!state || ((!record || record.draftContext !== draft.localDraftId) && !['UNREGISTERED','UNSAVED'].includes(state)))
        return { state: 'ERROR', message: '恢复标识缺失或服务器已有原保存意图；已阻止新意图和提交。' + assist }
      if (store.requiresLegacyRecovery() || !validateAssessmentDraftV2(draft).valid
        || ((!record || record.draftContext !== draft.localDraftId) && !validateAssessmentAnswersV2(draft.answers, true).valid))
        return { state: 'ERROR', message: '问卷尚未完整或草稿需要恢复，请继续编辑；当前草稿保持不变。' }
      if (fingerprint(store.getDraft()) !== fingerprint(draft) || !await readScopeUnchanged(s, scope))
        return { state: 'ERROR', message: '确认准备期间答案或归属发生变化，请重新检查。' }
      const token = { message: previewProof ? '将下方服务器核验的本次画像与推荐保存为历史；原来源、候选顺序与资料版本固定。当前草稿保留。此确认不是敏感信息单独同意或现实合法同意证据。' : (record && record.draftContext === draft.localDraftId
        ? '将核对或重试当前合法范围内的原保存；后续编辑不会替换原提交。'
        : '将当前设备的完整合成问卷保存给当前验证账号合法绑定的合成老人，用于查看评估历史。设备草稿本身不证明账号归属。')
        + ' 当前草稿保留。服务器按保存时受控合成来源生成画像与推荐，不代表与当前匿名预览完全相同。此确认不是敏感信息单独同意，也不是现实合法同意证据。' }
      if (generation !== confirmationGeneration) return { state: 'ERROR', message: '本次确认已取消；草稿保持不变。' }
      saveConfirmation = { token, origin: s.origin, scopeId: scope, fingerprint: fingerprint(draft), trusted: previewProof }
      return { state: 'CONFIRM', confirmation: token }
    } catch (_error) { return { state: 'ERROR', message: '恢复标识或身份无法可靠核验，停止提交。' + assist } }
    finally { preparingConfirmation = false }
  }
  const lifecycle = async (): Promise<{ state: HistoryDraftState; message: string; binding?: HistorySessionBinding; draft?: AssessmentDraftV2 }> => {
    try {
      if (pending || saveOperations.has(auth.resolveBackendOrigin())) return { state: 'SAVING', message: '保存处理中，不能切换评估。' }
      if (!await capability()) return { state: 'STATE_UNKNOWN', message: 'TEST_ONLY 会话能力不可用，草稿保持不变。' }
      auth.clearSession(); const s = await session(); if (!s) return { state: 'STATE_UNKNOWN', message: '身份不可确认，草稿保持不变。' }
      const scope = await currentScope(s); if (!scope) return { state: 'STATE_UNKNOWN', message: '老人绑定不可确认，草稿保持不变。' }
      const binding = readHistorySession(recoveryStorage), record = readHistoryRecovery(recoveryStorage), store = draftSource(), draft = store.getDraft()
      if (store.requiresLegacyRecovery() || !validateAssessmentDraftV2(draft).valid || binding && binding.state === 'switch_prepared')
        return { state: 'RECOVERY_REQUIRED', message: '评估上下文需要恢复，不能替换当前草稿。' }
      if (binding && (!await checkedBinding(s,scope,binding) || binding.draftContext !== draft.localDraftId))
        return { state: 'STATE_UNKNOWN', message: '账号、老人或草稿会话不一致，停止切换。' }
      if (!record || record.draftContext !== draft.localDraftId) {
        const inspected = await inspectContext(s, scope, draft.localDraftId)
        if (!inspected || !['UNREGISTERED','UNSAVED'].includes(inspected)) return { state: 'RECOVERY_REQUIRED', message: '保存标识缺失但服务器存在原状态，不能把未知当未保存。' + assist }
      }
      if (!binding) return record ? { state: 'RECOVERY_REQUIRED', message: '旧保存标识尚不能证明当前草稿内容一致。' }
        : { state: 'UNSAVED', message: '当前评估尚未保存。', draft }
      const memory = saveIntents.get(scope + '|' + binding.sessionId)
      if (!record || record.draftContext !== binding.draftContext) return { state: 'UNSAVED', message: '当前新会话尚未保存。', binding, draft }
      const result = await confirm(s, record)
      if (result.state !== 'SUCCESS') return { state: 'SAVE_UNCONFIRMED', message: result.message }
      if ((!memory || !memory.verifiedPayload) || !memory.item || memory.item.id !== result.item.id) return { state: 'RECOVERY_REQUIRED', message: '已确认历史保存；冷启动后无法证明当前答案未改变，已保留草稿并阻止替换。' }
      if (fingerprint(draftSource().getDraft()) !== fingerprint(draft)) return { state: 'STATE_UNKNOWN', message: '检查期间草稿发生变化，请重新检查。' }
      return fingerprint(draft) === memory.fingerprint
        ? { state: 'SAVED_UNCHANGED', message: '已确认本次评估保存且当前答案未修改，可经明确确认创建新评估。', binding, draft }
        : { state: 'SAVED_WITH_LOCAL_CHANGES', message: '已保存的会话有未保存修改，请继续当前编辑；不能覆盖或转移这些答案。' }
    } catch (_error) { return { state: 'STATE_UNKNOWN', message: '保存状态无法可靠判断，草稿保持不变。' } }
  }
  let transitionPending = false
  const newSession = async (): Promise<{ state: 'EMPTY_CONTEXT' | 'CONFLICT' | 'UNAVAILABLE'; message: string }> => {
    const operationOrigin = auth.resolveBackendOrigin()
    if (transitionPending || transitionOperations.has(operationOrigin)) return { state: 'CONFLICT', message: '评估切换正在处理，请等待核对。' }
    transitionPending = true; transitionOperations.add(operationOrigin)
    try {
      const proof = await lifecycle()
      if (proof.state !== 'SAVED_UNCHANGED' || !proof.binding || !proof.draft) return { state: 'CONFLICT', message: proof.message }
      const store = draftSource()
      if (!store.prepareEmptyHistoryDraft || !store.replaceSavedHistoryDraft) return { state: 'CONFLICT', message: '当前草稿未提供安全比较替换能力，已保留。' }
      const candidate = store.prepareEmptyHistoryDraft()
      if (proof.binding.state === 'switch_requested') candidate.localDraftId = proof.binding.nextDraftContext as string
      auth.clearSession(); const s = await session()
      if (!s || !await checkedBinding(s, proof.binding.scopeId, proof.binding)) return { state: 'CONFLICT', message: '确认期间账号或老人绑定变化，已保留草稿。' }
      // The candidate context must survive a lost receipt/process death before the server creates B.
      persistHistorySession(recoveryStorage, { version: 1, origin: s.origin, scopeId: proof.binding.scopeId,
        sessionId: proof.binding.sessionId, draftContext: proof.binding.draftContext, state: 'switch_requested', nextDraftContext: candidate.localDraftId })
      const r = await request(s, '/api/v1/completed-assessments/assessment-sessions/new', 'POST', { intent: 'CONFIRMED_NEW_ASSESSMENT', fromSessionId: proof.binding.sessionId, draftContext: candidate.localDraftId })
      if (r.statusCode !== 200 || !sessionEnvelope(r.data) || r.data.scopeId !== proof.binding.scopeId || r.data.draftContext !== candidate.localDraftId || r.data.sessionId === proof.binding.sessionId)
        return { state: 'CONFLICT', message: '未收到合法新会话证据，原草稿保持不变。' }
      auth.clearSession(); const current = await session()
      if (!current || !await checkedBinding(current, proof.binding.scopeId, proof.binding)) return { state: 'CONFLICT', message: '返回期间身份发生变化，停止草稿切换。' }
      persistHistorySession(recoveryStorage, { ...proof.binding, state: 'switch_prepared', nextSessionId: r.data.sessionId as string, nextDraftContext: candidate.localDraftId })
      const replaced = store.replaceSavedHistoryDraft(proof.draft, candidate)
      if (!replaced.persistence.ok) return { state: 'CONFLICT', message: '草稿切换未可靠完成，保留恢复标识；请核对，不自动清空。' }
      persistHistorySession(recoveryStorage, { version: 1, origin: current.origin, scopeId: proof.binding.scopeId, sessionId: r.data.sessionId as string, draftContext: candidate.localDraftId, state: 'active' })
      return { state: 'EMPTY_CONTEXT', message: '已确认创建独立空白评估会话；旧历史保持不变。' }
    } catch (_error) { return { state: 'CONFLICT', message: '切换状态需要恢复，请保留当前草稿并核对。' } }
    finally { transitionPending = false; transitionOperations.delete(operationOrigin) }
  }
  const save = async (proof: SaveProof): Promise<SaveFeedback> => {
    try {
      if (!await capability()) return error('TEST_ONLY 保存能力未开放。当前草稿保持不变。')
      // Refresh trusted identity before each explicit save/reconciliation, including account switches.
      auth.clearSession()
      const s = await session()
      if (!s) return error('身份确认失败，尚未保存。当前草稿保持不变。')
      const scope = await currentScope(s)
      if (!scope) return error('账号或老人绑定不可用，尚未保存。当前草稿保持不变。')
      if (s.origin !== proof.origin || scope !== proof.scopeId || fingerprint(draftSource().getDraft()) !== proof.fingerprint)
        return error('确认后答案、账号、老人或环境变化，已取消本次提交；请重新确认。')
      let record = readHistoryRecovery(recoveryStorage)
      const draftNow = draftSource().getDraft()
      if (!record || record.draftContext !== draftNow.localDraftId) {
        const state = await inspectContext(s, scope, draftNow.localDraftId)
        if (!state || !['UNREGISTERED','UNSAVED'].includes(state)) return error('无法证明原保存标识完整，已停止新意图和重复提交。' + assist)
      }
      const binding = await bindCurrent(s, scope, draftNow.localDraftId)
      if (!binding) return error('当前会话关联无法可靠确认；请核对原保存，草稿保持不变。')
      if (record && (record.origin !== s.origin || record.scopeId !== scope))
        return error('账号、老人绑定或环境已变化，停止恢复及保存。旧恢复标识和草稿保持不变。')
      intent = saveIntents.get(scope + '|' + binding.sessionId)
      if (record && (!intent || intent.record.intentId !== record.intentId || intent.item || record.state === 'confirmed')) {
        const result = await confirm(s, record)
        if (result.state !== 'SUCCESS') return result
        // New session is only the explicitly confirmed successor, never inferred from edited contents.
        if (binding.draftContext === record.draftContext) return { ...result, message: intent && intent.verifiedPayload && fingerprint(draftNow) !== intent.fingerprint
          ? `原记录保存成功 · 当前修改尚未保存，已保留草稿；不会覆盖旧历史。`
          : `原记录保存成功 · 已核对原历史记录；当前草稿未重新提交。` }
        intent = undefined; record = null
      }
      const retryingOriginal = intent !== undefined && intent.item === undefined
      if (!intent) {
        if (proof.trusted && (!await checkTrusted(proof.trusted) || proof.trusted.candidate.sessionId !== binding.sessionId))
          return error('可信展示已失效，未创建保存意图；请重新核验。草稿保留。')
        const store = draftSource()
        if (store.requiresLegacyRecovery()) return error('当前草稿需要恢复，尚未保存。')
        const draft = store.getDraft()
        if (!validateAssessmentDraftV2(draft).valid || !validateAssessmentAnswersV2(draft.answers, true).valid)
          return error('当前问卷尚未完整或包含无效答案，请继续填写。草稿保持不变。')
        const elder = await request(s, '/api/v1/elder-record', 'GET'), elderData = elder.data
        if (elder.statusCode !== 200 || !object(elderData) || elderData.availability !== 'bound' || typeof elderData.elderId !== 'string')
          return error('当前账号没有可用的老人绑定，尚未保存。草稿保持不变。')
        if (fingerprint(store.getDraft()) !== proof.fingerprint) return error('确认后问卷发生变化，未创建保存意图；请重新确认。')
        const trustedBinding = proof.trusted ? {previewId:proof.trusted.candidate.previewId,displayBinding:proof.trusted.candidate.displayBinding} : {}
        const prepared = await request(s, '/api/v1/completed-assessments/save-intents', 'POST', { sessionId: binding.sessionId, ...trustedBinding }), v = prepared.data
        if (prepared.statusCode !== 200 || !recoveryEnvelope(v) || v.state !== 'PREPARED' || v.scopeId !== scope || v.sessionId !== binding.sessionId
          || !recoveryUuid(v.intentId) || typeof v.createdAt !== 'string') return error('无法新建可靠保存意图或已有旧意图；停止提交。' + assist)
        record = { version: 1, origin: s.origin, scopeId: scope, intentId: v.intentId, createdAt: v.createdAt, draftContext: draft.localDraftId, state: 'pending' }
        // Must write AND read back successfully before any health payload leaves this process.
        persistHistoryRecovery(recoveryStorage, record)
        intent = { verifiedPayload: false, sessionId: binding.sessionId, record, fingerprint: fingerprint(draft), body: {
          kind: proof.trusted ? 'completed_assessment_save_with_trusted_preview_request_v1' : 'completed_assessment_save_request_v1', intent: 'SAVE_COMPLETED_ASSESSMENT', assessmentContractVersion: 'assessment-schema-v2',
          schemaVersion: 2, elderId: elderData.elderId, idempotencyKey: `recover_${record.intentId}`,
          answers: JSON.parse(JSON.stringify(draft.answers)),
          ...trustedBinding,
        } }
        saveIntents.set(scope + '|' + binding.sessionId, intent)
      }
      // Revalidate persisted metadata even for an in-memory retry. Corruption never permits a POST.
      const verified = readHistoryRecovery(recoveryStorage)
      if (!verified || verified.intentId !== intent.record.intentId || verified.scopeId !== scope || verified.origin !== s.origin)
        return error('恢复标识无法可靠读取，已阻止提交。当前草稿保持不变。')
      const response = await request(s, '/api/v1/completed-assessments', 'POST', intent.body)
      const v = response.data
      if (![200, 201].includes(response.statusCode) || !object(v)
        || !exact(v, ['contractVersion', 'kind', 'availability', 'item']) || v.contractVersion !== HISTORY_API_CONTRACT_V1
        || v.kind !== 'completed_assessment_save_result_v1' || !['created', 'replayed'].includes(String(v.availability))
        || !isCompletedAssessmentHistoryMetadataV1(v.item)) return error('尚未确认保存成功。可重试同一保存请求；当前草稿保持不变。')
      try { persistHistoryRecovery(recoveryStorage, { ...intent.record, state: 'confirmed' }) } catch (_error) { /* pending marker remains safe to reconcile */ }
      intent.verifiedPayload = true
      intent.item = { ...v.item }
      intent.body = {} // Acknowledged payload is no longer needed for network retry.
      auth.clearSession()
      const current = await session()
      if (!current || current.origin !== s.origin || await currentScope(current) !== scope)
        return error('回执期间账号或老人绑定已变化，停止展示。请在原合法账号核对保存结果。草稿保持不变。')
      return { state: 'SUCCESS', item: intent.item, message: `保存成功 · ${retryingOriginal ? '重试确认的是原请求；后续修改请另行保存。' : ''}记录 ${intent.item.id.slice(0, 8)} · ${intent.item.completedAt}` }
    } catch (_error) { return error('未收到明确保存回执或无法持久化恢复标识。请核对保存结果；当前草稿保持不变。') }
  }
  return {
    capability,
    async currentAuthorizedScope(): Promise<string | null> {
      try {
        if (!await capability()) return null
        const fresh = await freshReadScope()
        return fresh && await readScopeUnchanged(fresh.session, fresh.scope) ? fresh.scope : null
      } catch (_error) { return null }
    },
    requestSaveConfirmation,
    createTrustedPreview,
    async requestTrustedSaveConfirmation() {
      if (!trusted) return {state:'ERROR' as const,message:'请先明确获取并查看服务器核验结果。'}
      return requestSaveConfirmation(trusted)
    },
    cancelSaveConfirmation(): void { confirmationGeneration += 1; saveConfirmation = undefined },
    lifecycle,
    confirmNewSession: newSession,
    async recoverPending(): Promise<SaveFeedback | null> { const result = await recover(); if (result) feedback = result.message; return result },
    isSaving: () => pending !== undefined,
    feedback: () => feedback,
    async readRecommendation(id: string): Promise<HistoricalRecommendationRead> {
      try {
        if (!uuid(id) || !await capability()) return { state: 'UNAVAILABLE', message: '历史推荐读取能力暂不可用。' }
        const fresh = await freshReadScope()
        if (!fresh) return { state: 'ERROR', message: '身份或老人归属确认失败，请重试。' }
        const s = fresh.session
        const response = await request(s, `/api/v1/completed-assessments/${id}/recommendation`, 'GET')
        if (!await readScopeUnchanged(s, fresh.scope)) return { state: 'ERROR', message: '读取期间账号、老人或环境变化，停止展示。' }
        if (response.statusCode === 404) return { state: 'ERROR', message: '记录不存在或当前账号无权查看。' }
        const v = response.data
        if (response.statusCode !== 200 || !object(v) || !exact(v, ['contractVersion', 'kind', 'item', 'availability', 'display'])
          || v.contractVersion !== HISTORY_API_CONTRACT_V1 || v.kind !== 'historical_recommendation_result_v1'
          || !isCompletedAssessmentHistoryMetadataV1(v.item) || v.item.id !== id) return { state: 'ERROR', message: '历史推荐读取失败，请重试。' }
        if (v.availability === 'unavailable' && v.display === null) return { state: 'UNAVAILABLE', message: '这条记录没有保存当次推荐快照。不会用当前问卷或机构资料补算。' }
        if (v.availability === 'unsupported_version' && v.display === null) return { state: 'UNSUPPORTED_VERSION', message: '历史快照版本暂无法安全解释，原记录保持不变。' }
        if (v.availability !== 'ready' || !validHistoricalRecommendationV1(v.display, v.item)) return { state: 'ERROR', message: '历史快照内容无法安全展示，请重试。' }
        return { state: 'READY', display: v.display }
      } catch (_error) { return { state: 'ERROR', message: '网络或服务暂不可用，请重试读取历史推荐。' } }
    },
    saveCurrent(confirmation?: HistorySaveConfirmation): Promise<SaveFeedback> {
      const proof = saveConfirmation
      if (!proof || confirmation !== proof.token) return Promise.resolve(error('请先明确确认本次保存；尚未提交。当前草稿保持不变。'))
      saveConfirmation = undefined
      // Do not share an in-flight result with a possibly switched account or another client.
      if (pending) return Promise.resolve(error('已有保存正在处理，请等待后核对结果。当前草稿保持不变。'))
      const origin = auth.resolveBackendOrigin()
      const active = saveOperations.get(origin)
      if (active || transitionOperations.has(origin)) return Promise.resolve(error('已有保存正在处理，请等待后在当前账号核对。当前草稿保持不变。'))
      pending = save(proof).then(result => { feedback = result.message; return result }).finally(() => { pending = undefined })
      if (!active) { const operation = pending; saveOperations.set(origin, operation); void operation.then(() => { if (saveOperations.get(origin) === operation) saveOperations.delete(origin) }) }
      return pending
    },
    async readDetail(id: string): Promise<HistoricalDetailReadV1> {
      try {
        if (!uuid(id) || !await capability()) return { state: 'ERROR', message: '历史详情能力暂不可用。' }
        const fresh = await freshReadScope()
        if (!fresh) return { state: 'ERROR', message: '请先确认账号和合法老人归属。' }
        const s = fresh.session
        const response = await request(s, `/api/v1/completed-assessments/${id}`, 'GET')
        if (!await readScopeUnchanged(s, fresh.scope)) return { state: 'ERROR', message: '读取期间账号、老人或环境变化，停止展示。' }
        if (response.statusCode === 404) return { state: 'ERROR', message: '记录不存在或当前账号无权查看。' }
        if ([401, 403].includes(response.statusCode)) return { state: 'ERROR', message: '身份或读取权限不可用，请重新确认。' }
        const v = response.data
        if (response.statusCode !== 200 || !object(v)
          || !exact(v, ['contractVersion', 'kind', 'item', 'profileAvailability', 'profileDisplay', 'recommendationAvailability'])
          || v.contractVersion !== HISTORY_API_CONTRACT_V1 || v.kind !== 'completed_assessment_detail_v1'
          || !isCompletedAssessmentHistoryMetadataV1(v.item) || v.item.id !== id || v.recommendationAvailability !== 'unavailable'
          || !((v.profileAvailability === 'unavailable' && v.profileDisplay === null)
            || (v.profileAvailability === 'ready' && display(v.profileDisplay, v.item))))
          return { state: 'ERROR', message: '历史结果读取失败，请重试。' }
        return { state: 'READY', item: v.item, profile: v.profileDisplay as HistoricalProfileDisplayV1 | null }
      } catch (_error) { return { state: 'ERROR', message: '网络或服务暂不可用，请重试。' } }
    },
    async reassessment(): Promise<{ state: 'EMPTY_CONTEXT' | 'CONFIRM_REQUIRED' | 'CONFLICT' | 'UNAVAILABLE'; message: string }> {
      const proof = await lifecycle()
      if (proof.state === 'SAVED_UNCHANGED') return { state: 'CONFIRM_REQUIRED', message: proof.message }
      if (proof.state === 'UNSAVED' && proof.draft && !Object.keys(proof.draft.answers).length && proof.draft.currentStep === 'basic')
        return { state: 'EMPTY_CONTEXT', message: '已确认安全空草稿，将进入既有评估说明。' }
      if (!await capability()) return { state: 'UNAVAILABLE', message: 'TEST_ONLY 新评估能力未开放。' }
      return { state: 'CONFLICT', message: proof.message }

    },
  }
}
