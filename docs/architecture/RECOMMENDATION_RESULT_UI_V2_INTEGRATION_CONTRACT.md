# Recommendation Result V2 Application Integration Contract

状态：`FROZEN_PHASE_V1_1_F1`

版本：`recommendation-result-ui-v2-application-integration-v1`

`PRODUCTION_CODE_CHANGE = 0`。本文冻结 Recommendation Result V2 application snapshot、同源机构
展示快照、ViewModel、页面状态与 V1/V2 复用边界；不修改任何 WXML/Less/TS 生产代码。

## 1. 目的与非目标

本契约将 frozen Recommendation V2 Domain 接入现有 Result UI 的 application 边界：

```text
onShow
  -> one evaluationAsOf
  -> Recommendation Preview V2 application service
       -> one AssessmentDraftV2 snapshot
       -> deriveElderProfilePreviewV2()
       -> one complete validated InstitutionRecordV11 catalog
       -> evaluateRecommendationPreviewV2()
  -> same-source InstitutionDisplaySnapshotV11[]
  -> RecommendationResultApplicationSnapshotV2
  -> RecommendationResultPageViewModelV2
  -> pages/recommendation/result WXML
```

本阶段不实现页面、不修改 Recommendation/Institution/ElderProfile/Assessment Domain、不迁移 Institution
List/Detail、不实现 Backend、真实武汉机构、登录、手机号、预约、VR 或任何 persistence。

`RECOMMENDATION_RESULT_UI_CONTRACT.md` 的 Phase 4C-2 设计是复用基线；V2 frozen Contract、V2 Ruleset、
V1.1 Institution Contract 才是业务语义 source of truth。

## 2. Source of Truth

1. `docs/architecture/RECOMMENDATION_CONTRACT_V2.md`；
2. `docs/architecture/RECOMMENDATION_RULE_CONTRACT_V2.md`；
3. `docs/architecture/ELDER_PROFILE_CONTRACT_V2.md` 与
   `docs/architecture/ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md`；
4. `docs/architecture/INSTITUTION_CONTRACT_V1_1.md` 与
   `docs/architecture/INSTITUTION_CAPABILITY_CONTRACT.md`；
5. `docs/architecture/RECOMMENDATION_RESULT_UI_CONTRACT.md`（Phase 4C-2 UI/application 基线）；
6. `docs/architecture/RECOMMENDATION_PREVIEW_INTEGRATION_CONTRACT.md`、`FRONTEND_STRUCTURE.md`、
   `MOCK_DATA_POLICY.md`、`WECHAT_INTERACTION_CONTRACT.md` 与 `AGENTS.md`；
7. 最新 V1.1 产品 PDF 中的画像确认、评估结果与机构推荐、机构详情、空状态和无完全匹配页面。

当前 4C-2 dirty implementation 只能用于 KEEP/ADAPT/REPLACE/REMOVE 审计，不得反向修改 frozen V2
domain 语义。

## 3. Application Entry and Time Boundary

版本化入口冻结为 `buildRecommendationResultApplicationSnapshotV2({ evaluationAsOf })`；以下名称与语义
若需调整，必须先升级本契约：

1. Page/application entry 生成或接收一次带时区的 ISO `evaluationAsOf`；ViewModel 不读时间；
2. Service 只读取一次当前 AssessmentDraftV2；
3. 先调用唯一 V2 `deriveElderProfilePreviewV2()`，失败时不加载 Catalog、不调用 Recommendation；
4. 只加载一次完整 Institution Catalog，并通过正式 V1.1 validator；不按用户需求预筛、预排、截断或补卡；
5. 以同一份 Profile Preview、完整 validated catalog、同一 `evaluationAsOf` 调用
   `evaluateRecommendationPreviewV2()`；
6. 从同一次 validated catalog 为 `cards`、`conditionalCandidates` 与实际展示的
   `noExactMatch.nearMatches` 建立 display snapshot，并按 `(institutionId, recordRevision)` 关联 Domain candidate；
7. 返回 ephemeral application snapshot。禁止写回 Draft、storage、Recommendation Store 或 Catalog cache。

`evaluationAsOf` 不是 `completedAt`，也不能生成任何 formal identity。

## 4. RecommendationResultApplicationSnapshotV2

### 4.1 Frozen type shape

```ts
type EffectiveVerificationStateV11 =
  | 'current_verified'
  | 'unverified'
  | 'expired'

type InstitutionDisplayFactV11<T> = {
  availability: 'provided'
  value: T
  effectiveVerification: EffectiveVerificationStateV11
} | {
  availability: 'unknown' | 'unavailable'
  value: null
  effectiveVerification: EffectiveVerificationStateV11
}

type ReferenceMonthlyPriceDisplayValueV11 = {
  kind: 'bounded'
  minAmountMinor: number
  maxAmountMinor: number
  currency: 'CNY'
  period: 'month'
  basis: 'reference_total'
} | {
  kind: 'starting_at'
  minAmountMinor: number
  currency: 'CNY'
  period: 'month'
  basis: 'reference_total'
}

interface InstitutionRoomDisplayFactV11 {
  roomId: string
  roomType: InstitutionDisplayFactV11<InstitutionRoomTypeCode>
}

interface InstitutionMealDisplayFactsV11 {
  mealSchedule: InstitutionDisplayFactV11<InstitutionMealScheduleCodeV11>
  easyChewSupport: InstitutionDisplayFactV11<InstitutionServiceAvailabilityV11>
  modifiedFoodSupport: InstitutionDisplayFactV11<InstitutionServiceAvailabilityV11>
}

interface InstitutionOperationalDisplayAdvisoryV11 {
  institutionId: string
  recordRevision: number
  code: 'AVAILABILITY_DISPLAY_ONLY'
}

interface InstitutionDisplaySnapshotV11 {
  kind: 'institution_display_snapshot_v1_1'
  institutionId: string
  recordRevision: number
  recordProvenance: InstitutionRecordV11['recordProvenance']
  recordStatus: InstitutionRecordV11['recordStatus']
  identity: {
    name: InstitutionDisplayFactV11<string>
    regionDisplayName: InstitutionDisplayFactV11<string>
  }
  type: {
    primaryType: InstitutionDisplayFactV11<InstitutionTypeCode>
    supportedTypes: InstitutionDisplayFactV11<readonly InstitutionTypeCode[]>
  }
  price: {
    referenceMonthlyPrice: InstitutionDisplayFactV11<ReferenceMonthlyPriceDisplayValueV11>
  }
  media: {
    cover: {
      state: 'current_verified' | 'placeholder'
      mediaId: string | null
      url: string | null
    }
    vr: {
      state: 'current_verified_available' | 'unavailable' | 'unknown'
    }
  }
  roomFacts: readonly InstitutionRoomDisplayFactV11[]
  mealFacts: InstitutionMealDisplayFactsV11
}

interface RecommendationResultSourceContextV2 {
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

interface RecommendationResultApplicationSnapshotV2 {
  kind: 'recommendation_result_application_snapshot_v2'
  preview: RecommendationPreviewV2
  institutionDisplays: readonly InstitutionDisplaySnapshotV11[]
  operationalDisplayAdvisories: readonly InstitutionOperationalDisplayAdvisoryV11[]
  sourceContext: RecommendationResultSourceContextV2
  source: ElderProfilePreviewV2['source']
}
```

`InstitutionRoomDisplayFactV11` / `InstitutionMealDisplayFactsV11` 只保存 Result 页面需要的 structured
display facts 和 availability；它们不是新的 matching input，也不包含完整 InstitutionRecord、内部
evidence、rule ID 或 raw source dump。具体 field 取舍应以 Result card 真实需要为准，完整 room/meal/medical
详情留给未来 Institution Detail。

每个 display fact 必须同时保留 field availability 与相对本次 `evaluationAsOf` 的 effective verification；
`provided + unverified`、`expired`、`unknown` 与 `unavailable` 不得合并。只有 `provided + current_verified`
才能作为当前已核验展示事实；Development Mock 仍必须同时受 record provenance 与页面 Mock Banner 约束。

`preview.semantics` 是 dataset、time 与版本语义的权威来源；`sourceContext` / `source` 只是不可变投影，
构建时必须 equality-check，不能成为第二套可覆盖状态。快照必须是同一次 validated catalog 的 projection。
任何 `institutionId + recordRevision` 在 `preview.semantics.cards`、`conditionalCandidates` 或实际展示的
`noExactMatch.nearMatches` 中出现却无法在 `institutionDisplays` 找到，都是稳定 application error，不能
静默漏卡、从 legacy 目录补卡或按名称兜底。

Operational advisory policy 同时冻结为：

```text
BED_AVAILABILITY_ADVISORY = KEEP_OPERATIONAL_DISPLAY_ONLY
UPFRONT_COST_MATCH_ADVISORY = DEFERRED_NOT_DEFINED_IN_RECOMMENDATION_V2
```

`operationalDisplayAdvisories` 只允许保存同源、当前有效的床位可用性提示，且不参与 matching、tier、Exact
或 ranking。押金与一次性费用即使作为 V1.1 verified display fact 存在，也不得在 Result application 或
ViewModel 中推导“是否超出接受度”、匹配状态、风险等级、reason 或 difference；其未来展示属于 Institution
Detail 或新的 Recommendation ruleset/contract。

### 4.2 Same-source identity invariant

定义结构化关联键：

```text
InstitutionSourceKey = {
  institutionId: string,
  recordRevision: positive integer
}
```

以下条件必须同时成立：

- `candidate.institutionId === display.institutionId`；
- `candidate.recordRevision === display.recordRevision`；
- display 来自本次 Recommendation evaluator 使用的同一条 V1.1 validated record；
- `datasetVersion`、`datasetMode`、`evaluationAsOf` 属于同一次 application snapshot；
- display 的 `recordProvenance`、`recordStatus` 与被 evaluator 消费的 record 完全一致；
- 不使用数组下标、机构名称、`institutionId` 单独值或临时 ID 作为 join key；
- 不把 V1 projection、legacy DTO 或另一 record revision 的名称/价格/封面拼进 V2 卡片。

同一 `institutionId` 出现不同 revision 时，若不属于当前 evaluator 合法输入，必须在 application boundary
失败；不能选“最新”或第一条静默修复。

稳定关联 cause code 冻结为：

```text
DISPLAY_SOURCE_MISSING
DISPLAY_SOURCE_DUPLICATE
DISPLAY_SOURCE_REVISION_MISMATCH
DISPLAY_SOURCE_CONTEXT_MISMATCH
DISPLAY_SOURCE_PROVENANCE_MISMATCH
DISPLAY_SOURCE_PROJECTION_INVALID
```

任一展示候选关联失败时，整个 Result Snapshot 失败。错误最多携带 bounded candidate index；不得携带
完整 Draft、Profile、Institution record、evidence、sourceNote 或原始异常 message。

## 5. Result ViewModel V2 Boundary

### 5.1 Responsibilities

`RecommendationResultPageViewModelV2` 只负责：

- stable code -> 中文 label；
- 按结果状态组合标题、摘要、focus tags、已匹配卡、Conditional 卡和看院建议；
- 从 candidate 自带的 `reasons` / `differences` 映射文案；
- 从 candidate evaluation 的 `roomFit`、`mealScheduleFit`、`nutrition` 展示生活适配事实；
- 从同源 InstitutionDisplaySnapshot 读取名称、区域、类型、参考费用、封面、VR 状态；
- 展示 `RecommendationAdvisoryV2` 与同源 bed-availability operational advisory；
- 保留 Domain 的卡片数量、顺序、tier 与 `NO_EXACT_MATCH` 语义；
- 提供 Retry、返回 Profile、Consultant 和被 identity gate 阻断的详情/列表位置。

ViewModel 不负责：

- 重新 filter、sort、top 3、计算 global score/percentage；
- 根据 InstitutionRecord raw capability 生成新的 reason/difference；
- 把 Conditional 混入 Exact，把 unknown/unverified 当 supported；
- 重新判断 room/meal/nutrition、budget 或 readiness；
- 从页面文案反向生成 Domain code；
- 暴露 evidence ID、fieldPath、rank tuple、tier code、localDraftId、版本或正式 identity。

### 5.2 Proposed display shape

```ts
type RecommendationResultPageStateV2 =
  | 'loading'
  | 'ready_exact'
  | 'ready_soft_near'
  | 'ready_conditional'
  | 'no_safe_recommendation'
  | 'assessment_error'
  | 'catalog_error'
  | 'recommendation_error'

interface RecommendationResultPageViewModelV2 {
  state: RecommendationResultPageStateV2
  headline: string
  summary: string
  focusTags: readonly ResultTagViewModel[]
  cards: readonly RecommendationInstitutionCardViewModelV2[]
  conditionalCards: readonly RecommendationInstitutionCardViewModelV2[]
  resultAdvisories: readonly string[]
  visitAdvice: readonly string[]
  mockDisclosure: string | null
  emptyReason: 'ELDER_READINESS_BLOCKED' | 'NO_SAFE_RECOMMENDATION' | null
  actions: {
    canRetry: boolean
    canAdjustNeeds: boolean
    canContactConsultant: boolean
    detailLabel: string
    listLabel: string
  }
}
```

`cards` 必须严格来自 `semantics.cards`；如产品仍需展示 near matches，只能消费 Domain 已定义的
`noExactMatch.nearMatches`，不能由 ViewModel 另选候选。`conditionalCards` 严格来自
`semantics.conditionalCandidates`，不能与已匹配卡合并。

## 6. V1.1 Page Source Mapping

| PRD 显示 | 唯一合法 V2 来源 | 页面允许做的事 | 禁止 |
|---|---|---|---|
| 综合建议 | `elderReadiness`、`exactMatch`、`noExactMatch`、cards/conditionalCandidates | 使用静态用户可读模板说明当前状态 | 生成新的个性化护理结论或机构类型推断 |
| 筛选重点 | `semantics.elderSnapshot` derived facts | stable code 中文映射，最多 3 个展示标签 | 由标签再产生 reason、排序或硬条件 |
| 已匹配机构 | `semantics.cards` 原顺序 | 原样保留数量和顺序 | 预筛、补足到 3 家、调整 tier |
| 接近候选 | `noExactMatch.nearMatches` | 展示每张 Domain difference | 将接近候选写为 Exact |
| 需机构评估 | `semantics.conditionalCandidates` | 独立标题和卡片区 | 混入已匹配机构，写成已支持 |
| 名称/区域/类型 | 同源 `InstitutionDisplaySnapshotV11` | 读取同 key 的字段并显示 unknown/未提供 | 按名字、地址或 ID 猜测 |
| 参考费用 | 同源 display `referenceMonthlyPrice` | 显示 bounded/starting_at/unknown | 显示 ¥0、免费或最终价格 |
| 推荐理由 | `candidate.reasons` | 只按 reason code 做稳定中文映射；evidence 仅作为 Domain 已验证的 provenance | 从 raw capability 追加理由、读取或展示内部 evidence |
| 主要差异 | `candidate.differences` | 全部保留，按 category 显示层级 | 丢弃 conditional/unverified 差异或改 severity |
| 房型 | `candidate.roomFit` + 自带 refs | `match` 显示“符合所选房型偏好”；`unknown` 显示资料不足 | 当前 ruleset 下显示“机构没有该房型”；正常展示 mismatch |
| 餐次 | `candidate.mealScheduleFit` | 区分 match、known mismatch、data unavailable、unknown/unverified | 把 unavailable 和 unknown 混为一个事实 |
| 饮食提示 | `candidate.nutrition` | 展示易咀嚼/特殊处理与 inquiry/unknown 状态 | 作为护理安全条件或排名优势 |
| 活动空间 | `candidate.activityFit.displayFacts` | 作为生活环境事实展示 | 生成 activity score/reason |
| 用户关注项 | `semantics.elderSnapshot.preference.priorities` 与合法 candidate reason | 显示“您比较关注……” | 伪造机构在该项表现优秀 |
| 高照护低预算 | `semantics.advisories` | 结果级只显示一次友好提醒 | 每张卡重复、改价格、推算预算 |
| 床位可用性 | 同源 `operationalDisplayAdvisories` 中的 `AVAILABILITY_DISPLAY_ONLY` | 只作 operation/display 提示 | 改变排序、Exact、eligibility；把 availability 写成床位承诺 |
| 押金/一次性费用匹配 | `DEFERRED_NOT_DEFINED_IN_RECOMMENDATION_V2` | Result 当前不新增机构级 fit/difference；已核验金额留待 Institution Detail | 在 Application/ViewModel 偷偷比较用户接受度、生成风险等级或复用 V1 Profile adapter |
| 封面/VR | 同源 display media/vr | 合法 available 才展示；无 VR 则不显示 badge/CTA | 拉 stock image、伪造 VR 或从 Mock 推断 |
| 看院建议 | PRD 静态 checklist | 写成“建议实地确认” | 冒充机构事实 |
| Mock disclosure | `datasetMode` | 顶部持续显示完整 Mock 文案 | 只放日志或隐藏在 About |

## 7. Result State Mapping

优先复用 4C-2 的状态集合，不为新 reason code 增加页面 state。若需要更具体表达，使用同一 state
下的稳定 `emptyReason`/文案分支，不改变状态枚举：

| 页面状态 | V2 条件 | 用户表达 |
|---|---|---|
| `loading` | onShow refresh in-flight | 清空旧结果，正在整理推荐预览 |
| `ready_exact` | `cards.length > 0 && exactMatch = true` | 关键护理需求已找到可确认匹配的候选机构 |
| `ready_soft_near` | cards 有结果但 `exactMatch = false` | 暂时没有完全符合全部偏好条件；逐卡说明差异 |
| `ready_conditional` | 无已匹配卡且 conditionalCandidates 有结果 | 需要机构进一步评估的候选 |
| `no_safe_recommendation` | 无 cards、无 conditional，或 readiness 被阻断 | 安全空态；不凑卡 |
| `assessment_error` | Draft/Preview V2 失败 | 请先补充/确认老人相关信息或返回画像 |
| `catalog_error` | Catalog load/envelope/record validation 失败或为空 | 机构资料暂时不可用；不显示未经核验卡片 |
| `recommendation_error` | V2 evaluator/application 失败 | 推荐暂时无法生成，可重试或调整需求 |

当 `elderReadiness = blocked_by_required_clarification` 导致无 cards 时，复用
`no_safe_recommendation`，但必须设置 `emptyReason = ELDER_READINESS_BLOCKED`，子文案明确“需要先补充或
确认老人相关信息；完成确认后系统才能继续评估机构，当前未生成机构推荐卡片”，操作为“返回画像”。不得
写“机构都不符合”或“机构资料未核验”。这是对现有状态的诚实解释，不新增页面状态；若实现阶段发现现有
WXML 尚不能按 `emptyReason` 诚实分支，F2 必须最小增量适配现有分支；不得新增 readiness 专用 top-level
state。未来若确需改变八态集合，必须先升级本契约。

## 8. V2-specific Presentation Rules

### 8.1 Room

当前 V1.1 room rule 只有 `match`、`unknown`、`not_applicable` 可达：

- `match`：`符合所选房型偏好`；
- `unknown`：`当前核验资料不足，需要进一步确认`；
- `not_applicable`：不显示房型匹配结论；
- `mismatch`：保留前向兼容 code，但标记 `INACTIVE_CURRENT_RULESET`，当前 UI 不作为正常可达状态。

不得把“数组没有一行目标房型”解释成“机构没有该房型”。

### 8.2 Meal schedule

`MEAL_SCHEDULE_COMPARATOR = EXACT_STABLE_CODE_ONLY`。Result UI 必须保持：

- `match`：餐次安排与所选偏好一致；
- `mismatch`：该项安排与您的偏好存在差异（仅 soft difference）；
- `sourceState = data_unavailable`：当前资料显示该项服务暂不可用；
- `sourceState = unknown` 或 unverified/expired：当前核验资料不足，需进一步确认；
- `not_applicable`：用户未指定餐次，不渲染匹配结论。

`unavailable` 和 `unknown` 在用户文案上可以使用相近的克制语气，但 ViewModel 内的 source state 和
Domain output 绝不能合并。

全页稳定语义映射冻结为：

| Stable semantic | 用户表达 |
|---|---|
| `unavailable` / `data_unavailable` | 当前资料显示该项服务暂不可用 |
| `unknown` / unverified / expired | 当前核验资料不足，需进一步确认 |
| known `mismatch` | 该项安排与您的偏好存在差异 |
| `requires_inquiry` | 该项服务需要进一步向机构确认 |

具体卡片可做不损失含义的短文案，但 ViewModel 不允许把上述四类压平成“不支持”“不匹配”或“资料不足”。

### 8.3 Nutrition and activity

易咀嚼/特殊处理支持属于生活适配、rank-neutral。只有 candidate 自带合法 V2 reason 时才显示“相关支持
信息”；仅有机构事实不足以制造推荐理由。展示语义固定区分“已核验支持”“当前资料显示暂不可用”
“该项服务需要进一步向机构确认”和“当前核验资料不足，需进一步确认”。`swallowingConcern` 只沿用
上游 clarification，不生成 tube feeding 或护理硬条件。

Activity B2 是 `DISPLAY_ONLY_NOT_SCORABLE`：已核验室内/室外活动空间可作为“机构资料”展示，但不写成
“为什么推荐”、排名优势或 Exact 满足条件。

### 8.4 Priority and budget

Profile 的 V2 priority 在 Result 页面最多显示 3 项用户关注事实。只有 frozen Domain `reasons`/
`differences` 可形成机构级结论；not-scorable priority 只能写“您比较关注……”。

`HIGH_CARE_LOW_BUDGET` 是 result-level advisory，只显示一次；它不改变任何机构价格、tier、eligibility、
排序或卡片数量。

## 9. Mock, Price and VR Disclosure

当 `datasetMode = MOCK_DEVELOPMENT_ONLY` 时，页面顶部持续显示：

> 开发演示数据
>
> 以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。

机构名称必须保留 `示例机构 X（Mock）` 形式。Price 只显示 validated reference monthly price 的 bounded、
starting_at 或“参考费用暂未提供”；不得使用 0 或把合成值说成市场事实。

只有同源 `vr.status = available` 且 URL、封面/场景满足 frozen validator 时才出现 VR 标识；当前 Development
Catalog 的 VR 为空，所以 V2 Result 的 VR badge/CTA 预期为 0。无真实 VR 时不创建占位假全景。

## 10. Downstream Identity and Navigation Gate

本阶段不解除既有：

```text
CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED
```

原因是 Institution List/Detail 尚未消费同一 V1.1 canonical identity。Result 卡的“查看详情”位置只显示
“机构详情接入中”；“查看全部合作机构”只显示“合作机构列表接入中”。禁止用 index、name、institutionId
单独值或 legacy DTO 导航到另一个机构记录。

Consultant 仍可使用已存在的稳定 tab route，但查看结果不以登录、手机号或网络请求为前置条件；如未来
动作需要提交联系信息，必须另行冻结授权 contract。

## 11. Interaction Matrix

| Action | 初始条件 | 校验/副作用 | 导航 | rapid/失败 |
|---|---|---|---|---|
| Back | 所有状态可点 | 不改 Draft/Preview；不重复刷新 | 正常返回 Profile；根栈 fallback Profile | 遵守 Interaction Contract；fail 显示 inline error |
| Retry | 非 loading error state | 清旧 ViewModel，重新跑同一 V2 application flow | 当前页不 push 新 Result | in-flight 忽略；失败状态可再次点击 |
| Adjust Needs | ready/no-safe/error | 不改 Draft | 回现有 Profile 栈；深链才 redirect | NavigationGuard 只作第二层；fail 可见 |
| Consultant | 可见 CTA | 不自动登录/手机号、不提交联系人 | switchTab Consultant | 一次 action/一次导航；fail 可见 |
| Detail/List | 当前 identity gate 未通过 | 无业务副作用 | 不导航，显示接入中 | 不产生导航 |
| Conditional card | ready_conditional | 只读，明确需机构评估 | 当前阶段不进 Detail | 不作为已匹配操作 |
| onShow refresh | 页面生命周期 | 先清空旧 Snapshot，生成一次 evaluationAsOf | 无 | 只接受最新 generation |

必须保持 `1 physical tap -> 1 component event -> 1 page handler -> at most 1 navigation`。公共按钮使用
`action`，导航使用显式 `back`/`next` 语义事件，`bubbles=false`、`composed=false`；不能恢复
`native tap + triggerEvent('tap')` 双通道。

## 12. Phase 4C-2 Preservation Matrix

| 处理 | Phase 4C-2 可复用 | V2 必须调整 |
|---|---|---|
| KEEP | 纵向结果布局、Mock Banner、Exact/SoftNear/Conditional/No-safe 状态骨架 | 状态内容以 V2 semantics 为源 |
| KEEP | reason/difference 分组、价格展示、error recovery | 增加 V2 room/meal/nutrition/priority/advisory 映射 |
| KEEP | NavigationBar、PageContainer、SectionCard、Tag、StatePanel、PrimaryButton、Less tokens | 不改组件事件模型 |
| KEEP | NavigationGuard、Back/Retry/Adjust/Consultant 交互 | 保留单一 Action 和失败反馈 |
| KEEP | Detail/List downstream identity gates | V2 不得顺手解除 |
| ADAPT | `buildRecommendationResultSnapshot` application shape | 改为 V2 versioned entry，保留一次 Draft/Catalog/time 读取 |
| ADAPT | Result card structure | card display 由 `(institutionId, recordRevision)` same-source join 填充 |
| ADAPT | reason/difference formatting | 只消费 V2 candidate 自带 code/refs；新增 room/meal/nutrition code label |
| ADAPT | no-safe/error 文案 | readiness blocked 显示需补充老人信息，不伪装成机构不匹配 |
| ADAPT | bed-availability operational advisory | 保留为同源、rank-neutral display-only projection；不能复用 V1 Profile adapter 生成 V2 语义 |
| REMOVE | upfront-cost match advisory | Recommendation V2 未定义 comparator；不得在 Application/ViewModel 隐式实现 |
| ADAPT | V1 service/ViewModel primitives | 抽取无业务的 shared presentation primitive，V1/V2 adapter 分开 |
| REPLACE | V1 `RecommendationPreview` 作为 live V1.1 source | 使用 `RecommendationPreviewV2` + V1.1 validated catalog |
| REPLACE | `institutionId`/array position/name 的宽松关联 | 使用 exact `(institutionId, recordRevision)`；缺失即 stable error |
| REPLACE | 由 ViewModel 自行从 raw Institution capability 加理由 | 只接受 Domain `reasons` 与 evidence ref |
| REMOVE | global score、percentage、dashboard/radar/probability | V2 继续无伪精确匹配度 |
| REMOVE | V1 Result 的 legacy detail/list 假导航、补满 3 家 | 保留 blocked label，不产生下游 identity drift |

## 13. V1 / V2 Boundary

历史 V1 Recommendation/Result 仍必须依据 V1 Assessment、ElderProfile、Institution 和 Recommendation
contract 解释；live V1.1 Assessment 只能走 V2 application path：

```text
V1 historical result -> V1 result adapter -> V1 ViewModel
V2 live assessment  -> V2 Preview Service -> V2 Result Snapshot -> V2 ViewModel
```

不得把现有 V1 ViewModel 改成一组大量 optional V2 fields，也不得让 V2 Result 从 V1 service 的 projected
record、legacy Mock 或旧 result cache 取字段。V1/V2 版本 dispatch 必须在 Application 边界显式完成；页面
只消费对应版本的 ViewModel。

## 14. Application Error Contract

V2 Result snapshot 应保留当前 `RecommendationPreviewApplicationErrorCodeV2`，并新增一个只表示同源
join/projection 失败的 code；不得把 V2 error 重命名成 V1 application code：

| code | 语义 |
|---|---|
| `ASSESSMENT_PROFILE_V2_ERROR` | Draft 读取或 V2 Preview derivation 失败；不调用 Recommendation |
| `INSTITUTION_CATALOG_V11_ERROR` | Provider/envelope/load/record validation/合法空目录失败；默认整池失败 |
| `RECOMMENDATION_V2_ERROR` | V2 evaluator 以 stable cause code 拒绝输入 |
| `RESULT_SOURCE_ASSOCIATION_ERROR` | candidate key 无法与同一 validated catalog snapshot 精确关联 |

页面只映射稳定 code 和有限的恢复动作，不输出完整 Draft/Profile/Catalog、内部 evidence、异常 message 或
Secret。`RESULT_SOURCE_ASSOCIATION_ERROR` 不得降级成“没有机构”或静默删卡。

## 15. Approved Product Decisions

以下决策已由项目负责人批准，后续实现不得自行改写：

1. **Result route（已批准）**：V2 live Result 继续使用 `/pages/recommendation/result`，由 Application
   dispatch V1/V2，避免新增页面路由。
2. **Card compact facts（已批准最小化）**：Result card 只展示来自 candidate evaluation 的 room/meal/nutrition
   适配状态和同源机构基本资料；完整 V1.1 staff/medical/room/meal breakdown 留给 Institution Detail。
3. **Readiness wording（已批准）**：复用 `no_safe_recommendation` state，通过
   `emptyReason = ELDER_READINESS_BLOCKED`
   显示“需要先补充/确认老人相关信息”，不新增页面状态。
4. **Same-source failure（已批准整次失败）**：任何 candidate/display join 缺失都进入
   `RESULT_SOURCE_ASSOCIATION_ERROR`，不允许显示缺少机构事实的半张卡。
5. **Downstream gate（已批准继续阻断）**：在 Institution List/Detail V1.1 canonical identity 迁移完成前，不开放
   “查看详情/查看全部合作机构”真实导航。
6. **Operational display advisories（已批准拆分）**：床位可用性保留为同源 display-only；upfront-cost
   matching 未在 Recommendation V2 定义，当前禁止推导。
7. **Unavailable / unknown 中文（已批准差异化）**：unavailable 显示“当前资料显示该项服务暂不可用”；
   unknown/unverified 显示“当前核验资料不足，需进一步确认”；known mismatch 显示“该项安排与您的偏好
   存在差异”；requires inquiry 显示“该项服务需要进一步向机构确认”。

## 16. Future Gate

本冻结契约不是 UI 完成证明。未来实现必须至少验证：

- Recommendation V2 68 cases、Preview V2 Integration 20 cases、Formal/Preview parity、permutation/determinism；
- V1 Recommendation 117、Institution V1/V1.1、ElderProfile/Preview V1/V2、Assessment/Interaction 回归；
- 完整 catalog 进入 Domain，ViewModel 不预筛/预排/截断，不改变 card 数量、顺序、tier、reason/difference；
- `(institutionId, recordRevision)` same-source 关联、revision/provenance 保留、join 缺失安全失败；
- Mock disclosure、price/VR/unknown/unavailable/conditional/no-exact 文案边界；
- no persistence、no fake identity、no legacy source drift、no Detail/List bypass、no wx.request/login/phone；
- TypeScript 5.9、微信 TypeScript 4.1.2 targeted、生成 JS compatibility、JSON、diff check、DevTools compile；
- qa_reviewer、matching_engine 与 backend_domain 按只读职责独立审查；Android 证据仍需另行人工记录。

## 17. Scope Declaration

```text
RECOMMENDATION_RESULT_V2_UI_IMPLEMENTATION = NOT_STARTED
RECOMMENDATION_RESULT_V2_APPLICATION_CONTRACT = FROZEN_PHASE_V1_1_F1
PRODUCTION_CODE_CHANGE = 0
RECOMMENDATION_DOMAIN_CHANGE = 0
INSTITUTION_DOMAIN_CHANGE = 0
BACKEND_CHANGE = 0
PERSISTENCE = FORBIDDEN
INSTITUTION_LIST_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
```
