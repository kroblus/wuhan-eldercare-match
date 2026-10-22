import { readRecommendationSaveBuildV1 } from './recommendation-save-build'
import type { RecommendationSaveBuildV1 } from './recommendation-save-build'
import { createCompletedAssessmentUserLoopV1 } from './completed-assessment-user-loop'
import { createDefaultWeChatC5BackendTransportV1 } from './c5-authenticated-backend-session'
import { assessmentDraftStore } from '../store/assessment-draft'
import type { RecommendationResultApplicationSnapshotV2 } from '../types/recommendation-result-v2'
import { trustedPreviewViewV1 } from './trusted-assessment-preview'
import type { TrustedPreviewProjectionV1 } from './trusted-assessment-preview'
import type { HistorySaveConfirmation } from './completed-assessment-user-loop'

export const emptyRecommendationSaveView = () => ({
  resultSaveVisible: false, resultSavePending: false, resultSaveDialog: false,
  resultSaveConfirmDisabled: true, resultSaveMessage: '', resultSaveCanReconcile: false, resultSaveAdmissionReady: false,
  resultSaveTrustedView: null as ReturnType<typeof trustedPreviewViewV1> | null,
})
interface Host { data?: {resultSaveVisible?: boolean; resultSaveTrustedView?: unknown}; setData(patch: Record<string, unknown>): void }
type Loop = ReturnType<typeof createCompletedAssessmentUserLoopV1>
export type ResultSaveReadPort = Pick<Loop, 'capability' | 'currentAuthorizedScope' | 'requestSaveConfirmation' | 'cancelSaveConfirmation' | 'recoverPending'
  | 'createTrustedPreview' | 'requestTrustedSaveConfirmation' | 'saveCurrent'>
interface Dependencies {
  build(): RecommendationSaveBuildV1 | null
  account(): { appId: string; envVersion: string }
  client(build: RecommendationSaveBuildV1): ResultSaveReadPort
}
const currentBuild = (deps: Dependencies): RecommendationSaveBuildV1 | null => {
  try {
    const build = deps.build(), account = deps.account()
    return build && build.kind === 'recommendation_save_test_only_build_v1'
      && /^wx[0-9a-f]{16}$/.test(build.independentAppId) && /^wx[0-9a-f]{16}$/.test(build.standardAppId)
      && build.independentAppId !== build.standardAppId && account.appId === build.independentAppId
      && account.envVersion === 'develop' && /^https:\/\/[^/?#\s]+$/.test(build.backendOrigin)
      && build.approvalReference.trim().length > 0 && build.artifactReference.trim().length > 0 ? build : null
  } catch (_error) { return null }
}
const sameBuild = (left: RecommendationSaveBuildV1, right: RecommendationSaveBuildV1 | null): boolean =>
  right !== null && JSON.stringify(left) === JSON.stringify(right)
const blockedMessage = '本页是当前匿名推荐预览，缺少服务器绑定的评估会话与当次展示版本凭证。尚不能证明画像、机构来源及排序与历史保存一致，已暂停提交。当前草稿保留。'

/** Gate A remains a build prerequisite. Trusted saves use the existing one-intent service. */
export const createRecommendationResultSaveControllerV1 = (host: Host, deps: Dependencies) => {
  let generation = 0, active = false, pending = false, admitted = false
  let client: ResultSaveReadPort | undefined, build: RecommendationSaveBuildV1 | undefined, scope = ''
  let snapshot: RecommendationResultApplicationSnapshotV2 | undefined
  let projection: TrustedPreviewProjectionV1 | undefined, expectedView: ReturnType<typeof trustedPreviewViewV1> | undefined
  let confirmation: HistorySaveConfirmation | undefined
  const displayMatches = (): boolean => !!expectedView && !!host.data && host.data.resultSaveVisible === true
    && JSON.stringify(host.data.resultSaveTrustedView) === JSON.stringify(expectedView)
  const valid = (epoch: number): boolean => active && epoch === generation && !!build && sameBuild(build, currentBuild(deps))
  const close = (): void => {
    generation += 1; active = false; pending = false; admitted = false; if (client) client.cancelSaveConfirmation()
    client = undefined; build = undefined; scope = ''; snapshot = undefined
    projection = undefined; expectedView = undefined; confirmation = undefined
    host.setData(emptyRecommendationSaveView())
  }
  const authorized = async (epoch: number): Promise<boolean> => {
    if (!valid(epoch) || !client) { if (active && epoch === generation) close(); return false }
    const now = await client.currentAuthorizedScope()
    if (!valid(epoch)) { if (active && epoch === generation) close(); return false }
    if (!now || now !== scope) { close(); return false }
    return true
  }
  return {
    close,
    async activate(value?: RecommendationResultApplicationSnapshotV2): Promise<void> {
      close()
      if (!value) return // Loading/errors/V1 cannot be completed V2 results.
      const candidate = currentBuild(deps)
      if (!candidate) return // Normal build performs no C5/History request or new storage read.
      build = { ...candidate }; snapshot = value; active = true
      host.setData({ resultSaveVisible: true, resultSaveMessage: '测试身份与保存条件尚未核验，保存不可用。' + blockedMessage })
    },
    async verify(): Promise<void> {
      // Explicit user action only: anonymous result viewing never logs in or probes History.
      if (!active || pending || !build) return
      const epoch = generation; pending = true; admitted = false; scope = ''
      projection = undefined; expectedView = undefined; confirmation = undefined
      if (client) client.cancelSaveConfirmation()
      host.setData({ resultSavePending: true, resultSaveAdmissionReady: false, resultSaveCanReconcile: false, resultSaveDialog: false, resultSaveConfirmDisabled: true, resultSaveTrustedView: null })
      try {
        if (!valid(epoch)) { close(); return }
        client = deps.client(build)
        if (!await client.capability() || !valid(epoch)) {
          if (valid(epoch)) host.setData({ resultSaveMessage: '隔离测试保存能力未开放；本页未提交。' })
          else if (epoch === generation) close()
          return
        }
        const first = await client.currentAuthorizedScope()
        if (!first || !valid(epoch)) {
          if (valid(epoch)) host.setData({ resultSaveMessage: '测试账号或合法老人绑定无法确认，保存未启用。草稿保留。' })
          else if (epoch === generation) close()
          return
        }
        scope = first
        if (!await authorized(epoch)) return
        admitted = true
        host.setData({ resultSaveAdmissionReady: true, resultSaveMessage: blockedMessage, resultSaveCanReconcile: true })
      } catch (_error) { if (valid(epoch)) host.setData({ resultSaveMessage: '测试条件核验失败，未提交。请稍后重试。' }) }
      finally { if (valid(epoch)) { pending = false; host.setData({ resultSavePending: false }) } }
    },
    async obtainPreview(): Promise<void> {
      if (!active || !admitted || pending || !client) return
      const epoch = generation, captured = client; pending = true; confirmation = undefined; projection = undefined; expectedView = undefined
      captured.cancelSaveConfirmation()
      host.setData({resultSavePending:true,resultSaveDialog:false,resultSaveConfirmDisabled:true,resultSaveTrustedView:null})
      try {
        if (!await authorized(epoch)) return
        const result = await captured.createTrustedPreview()
        if (!await authorized(epoch)) return
        if (result.state !== 'READY') {host.setData({resultSaveMessage:result.message});return}
        projection = JSON.parse(JSON.stringify(result.projection)); expectedView = trustedPreviewViewV1(projection as TrustedPreviewProjectionV1)
        host.setData({resultSaveTrustedView:JSON.parse(JSON.stringify(expectedView)),resultSaveMessage:'请查看下方服务器核验结果；保存对象是这份合成画像和推荐，上方匿名预览不作为历史快照。尚未保存。'})
      } catch (_error) {if (valid(epoch)) host.setData({resultSaveMessage:'服务器核验暂不可用，未保存；草稿保留。'})}
      finally {if(valid(epoch)){pending=false;host.setData({resultSavePending:false})}}
    },
    async begin(): Promise<void> {
      if (!active || !admitted || pending || !client || !snapshot) return
      pending = true; const epoch = generation, captured = client
      host.setData({ resultSavePending: true, resultSaveDialog: false })
      try {
        if (!await authorized(epoch)) return
        if (projection) {
          if (!displayMatches()) {host.setData({resultSaveMessage:'展示内容变化，请重新获取并查看服务器核验结果。',resultSaveConfirmDisabled:true});return}
          const prepared = await captured.requestTrustedSaveConfirmation()
          if (!await authorized(epoch)) return
          if (!displayMatches()) {captured.cancelSaveConfirmation();host.setData({resultSaveMessage:'确认期间展示发生变化，已取消提交。'});return}
          confirmation = prepared.state === 'CONFIRM' ? prepared.confirmation : undefined
          host.setData({resultSaveDialog:!!confirmation,resultSaveConfirmDisabled:!confirmation,
            resultSaveMessage:prepared.state === 'CONFIRM' ? prepared.confirmation.message : prepared.message})
          return
        }
        // Reuse D02 complete-input/Session preflight. This method creates no SaveIntent or upload.
        const prepared = await captured.requestSaveConfirmation()
        captured.cancelSaveConfirmation() // No trusted seen/saved proof: never retain an executable token.
        if (!await authorized(epoch)) return
        host.setData({ resultSaveDialog: prepared.state === 'CONFIRM', resultSaveConfirmDisabled: true,
          resultSaveMessage: prepared.state === 'CONFIRM'
            ? blockedMessage + ' 此保存确认不代表敏感信息单独同意。'
            : prepared.message })
      } catch (_error) {
        if (valid(epoch)) host.setData({ resultSaveMessage: '保存条件无法核验，未提交；当前草稿保留。' })
      } finally {
        if (valid(epoch)) { pending = false; host.setData({ resultSavePending: false }) }
      }
    },
    cancel(): void {
      generation += 1; pending = false; confirmation = undefined; if (client) client.cancelSaveConfirmation()
      host.setData({ resultSaveDialog: false, resultSavePending: false, resultSaveConfirmDisabled: true })
    },
    async confirm(): Promise<void> {
      if (pending) return // A second tap must not cancel the first tap's private one-use proof.
      if (!active || !admitted || pending || !client || !confirmation || !projection || !displayMatches()) {
        confirmation = undefined; if(client) client.cancelSaveConfirmation()
        if(active) host.setData({resultSaveDialog:false,resultSaveConfirmDisabled:true,resultSaveMessage:blockedMessage})
        return
      }
      const epoch=generation,captured=client,token=confirmation; confirmation=undefined;pending=true
      host.setData({resultSavePending:true,resultSaveDialog:false,resultSaveConfirmDisabled:true})
      try {
        if (!await authorized(epoch) || !displayMatches()) {captured.cancelSaveConfirmation();return}
        const result=await captured.saveCurrent(token)
        if (!await authorized(epoch)) return
        host.setData({resultSaveMessage:result.message,resultSaveCanReconcile:true})
      } catch (_error) {if(valid(epoch)) host.setData({resultSaveMessage:'保存结果待确认；请核对原意图，草稿保留。'})}
      finally {if(valid(epoch)){pending=false;host.setData({resultSavePending:false})}}
    },
    async reconcile(): Promise<void> {
      if (!active || !admitted || pending || !client) return
      pending = true; const epoch = generation, captured = client
      host.setData({ resultSavePending: true, resultSaveDialog: false })
      captured.cancelSaveConfirmation()
      confirmation = undefined
      try {
        if (!await authorized(epoch)) return
        const result = await captured.recoverPending()
        if (!await authorized(epoch)) return
        host.setData({ resultSaveMessage: result && result.state === 'SUCCESS'
          ? '已确认原历史记录保存。本页仍是当前匿名预览，不代表该历史结果；请到我的评估查看当次快照。'
          : result && result.message || '没有可确认的原保存结果；本页未提交，草稿保留。' })
      } catch (_error) {
        if (valid(epoch)) host.setData({ resultSaveMessage: '保存结果待确认。请保留原意图与草稿，稍后重新核对。' })
      } finally {
        if (valid(epoch)) { pending = false; host.setData({ resultSavePending: false }) }
      }
    },
    async canOpenHistory(): Promise<boolean> { return admitted && !pending && await authorized(generation) },
  }
}

const controllers = new WeakMap<object, ReturnType<typeof createRecommendationResultSaveControllerV1>>()
export const recommendationResultSaveController = (host: Host) => {
  const existing = controllers.get(host)
  if (existing) return existing
  const controller = createRecommendationResultSaveControllerV1(host, {
    build: readRecommendationSaveBuildV1,
    account: () => wx.getAccountInfoSync().miniProgram,
    client: build => {
      const original = createDefaultWeChatC5BackendTransportV1()
      // The build pins its origin; a storage/route flag cannot redirect this controller.
      const transport = { ...original, developmentBackendOrigin: () => build.backendOrigin }
      return createCompletedAssessmentUserLoopV1(() => assessmentDraftStore, transport)
    },
  })
  controllers.set(host, controller); return controller
}
