# Institution List / Detail V1.2 Integration Contract

状态：`FROZEN_PHASE_V1_2_A0`

```text
PROPOSAL_HISTORY_PRESERVED = TRUE
PROJECT_OWNER_DECISIONS = APPROVED
DOCS_ONLY = TRUE
PRODUCTION_CODE_CHANGE = 0
CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED
PUBLIC_INSTITUTION_RATING = DISABLED_V1_2
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
GATE_RELEASE = 0
```

本文件冻结 Institution List / Detail 的 canonical identity、Application Snapshot、展示投影、路由、错误和
Gate 解除条件。它不是实现，不发布 `institution-contract-v1.2`，不定义 CareProcess stable code，不实现
Consultant、Appointment、Visit、Evaluation、AI 或 Backend，也不解除当前 List / Detail 导航 Gate。

## 1. Source of Truth 与约束顺序

本 Contract 依据以下当前正式来源：

1. `docs/product/README.md` 与两份 V1.2 产品 PDF；
2. `V1_2_CHANGE_IMPACT_ANALYSIS.md`；
3. frozen `INSTITUTION_CONTRACT_V1_1.md`、`INSTITUTION_CAPABILITY_CONTRACT.md`；
4. frozen `RECOMMENDATION_CONTRACT_V2.md`、`RECOMMENDATION_RULE_CONTRACT_V2.md`；
5. frozen `RECOMMENDATION_RESULT_UI_V2_INTEGRATION_CONTRACT.md`、
   `PROFILE_UI_V2_INTEGRATION_CONTRACT.md`；
6. `WECHAT_INTERACTION_CONTRACT.md`、`MOCK_DATA_POLICY.md`、`ROUTES.md`、
   `FRONTEND_STRUCTURE.md` 与 `AGENTS.md`。

冲突时以上顺序生效；本 Contract 不覆盖任何 frozen Domain Contract。V1.2 Product Source 要求 Detail 成为
“了解 → 信任 → 咨询 → 带看”的事实展示页面，同时明确 unknown 不等于不支持、CareProcess 只展示解释、
VisitEvaluation 不参与排序、当前 Mock 不制造 VR。

## 2. 当前仓库事实

- Recommendation V2 当前使用 `InstitutionCatalogServiceV11`，先验证完整 catalog，再把同一批
  `InstitutionRecordV11` 送入 evaluator。
- `RecommendationResultApplicationSnapshotV2` 已用 `(institutionId, recordRevision)` 严格关联 candidate、
  pool manifest 与 `InstitutionDisplaySnapshotV11`；缺失、重复或 revision 不一致均安全失败。
- 当前 canonical catalog envelope 包含 `datasetVersion`、`datasetMode`、`records[]`；当前 Service 要求每个
  `institutionId` 唯一，所以它表达的是“每家机构当前选定的一条 record”，不是历史 revision 仓库。
- 当前真实 `InstitutionRecordStatus` 为 `draft | published | suspended | archived`。`published` 仅表示允许前台读取，
  不代表整条记录或所有字段均已核验。
- 当前 `InstitutionMedia` 已有稳定 `mediaId`、category、role、`sortOrder`、field-wrapped URL/caption/time；
  VR 是独立的 `InstitutionVr`，含自身 verification 和稳定 scene identity。
- `/pages/institution/index`、`/pages/institution/detail`、`/pages/institution/vr` 仍是 Bootstrap 骨架并通过
  `route-scaffold` 串联；它们尚未消费 canonical catalog。
- Home 当前仍存在 `/pages/institution/detail?id=<legacy id>` 的旧路径；它缺少 `recordRevision`，必须继续被
  `CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED` 隔离，后续不能原样复用。
- legacy `types/domain.ts::Institution` 及其 service 仍服务部分 Bootstrap 页面；它的 `id`、自由文本价格、
  legacy provenance 或数组位置不能成为本 Contract 的身份或事实来源。
- 当前开发目录共 8 条 `MOCK_DEVELOPMENT_ONLY` record，名称为示例机构，均无真实 VR。

## 3. Canonical Institution Identity

List、Detail、Recommendation 下游、VR、Consultant assignment 输入以及未来 Appointment / Visit / Evaluation
统一使用以下二元身份：

```ts
interface InstitutionCanonicalIdentity {
  institutionId: string
  recordRevision: number
}
```

约束：

- `institutionId` 必须通过现有 Institution stable identifier 规则；
- `recordRevision` 必须为正的安全整数；
- 二元组整体才标识一个不可替换的 Institution record snapshot；
- `institutionId` 只标识机构连续身份，不能单独标识某次事实快照；
- `recordRevision` 只在同一 `institutionId` 下有意义；
- 不以 name、array index、display order、legacy DTO `id`、URL 或 Page data index 查找记录；
- 不因为相同 name、地址或媒体 URL 合并两个 record；
- 不把 application `sourceContextRef`、list snapshot reference 或 route source 当成正式 Institution identity。

Identity 的相等规则为两个字段逐值相等。任何 candidate、display record、route、source manifest 或未来业务对象只要
其中一项不同，就不是同一个来源。

## 4. Catalog、当前版本与历史精确解析

### 4.1 两个最小读取能力

下一阶段必须在现有 Service/Provider 结构上增加两个彼此独立的小型能力，不建设 repository/DI framework：

```text
CURRENT_CATALOG_RESOLVER.loadCurrentCatalog()
  -> Provider 选择当前 catalog snapshot
  -> whole-envelope validation
  -> per-record version dispatch + validation
  -> 每个 institutionId 恰好一个当前选定 revision

HISTORICAL_REVISION_RESOLVER.resolveExactRevision({ institutionId, recordRevision })
  -> exact snapshot / not_found / revision_not_found / provider error
  -> per-record version dispatch + validation
  -> 返回 identity 必须与请求逐值相等
```

`CURRENT_CATALOG_RESOLVER != HISTORICAL_REVISION_RESOLVER`。“当前 revision”选择权属于 Current Provider/Application，
不属于 Page；当前 catalog 只能代表当前开发 dataset，不能声称拥有完整历史。`resolveExactRevision` 只解析请求的不可变
二元身份，禁止退回同机构的其他 revision 或 current/latest。当前静态开发 Provider 只能在已验证 current catalog 中
解析恰好存在的 current identity；找不到 exact revision 时必须返回 `revision_not_found`。未来生产 Provider 必须提供
不可变历史 revision 读取能力，不能只暴露 latest endpoint。

### 4.2 V1.1 / future V1.2 version dispatch

Application 层接收 version-discriminated validated record：

```text
contractVersion = institution-contract-v1.1
  -> validateInstitutionRecordV11
  -> V1.1 List/Detail projector

contractVersion = institution-contract-v1.2 (future, not defined here)
  -> future V1.2 validator
  -> future V1.2 List/Detail projector
```

未知 `contractVersion` 返回稳定 unsupported-version error。Page 不检查版本、不 object-spread raw record、不补缺失字段。
本 Contract 只为 future V1.2 projector 保留 adapter slot；CareProcess shape、code 和 validator 必须等
`INSTITUTION_CONTRACT_V1_2` 单独冻结。

V1.1→V1.2 display upgrade 如未来需要，只能显式执行：缺失 CareProcess 为 unknown/unverified，保持原
`institutionId + recordRevision`，不得生成 false、supported、0 或 VERIFIED。Recommendation V2 继续只接收已冻结
V1.1 projection，V1.2 extension 不得穿透。

## 5. Institution List Data Flow

正式链路冻结为：

```text
Institution List Page
  -> InstitutionListApplicationService.build({ evaluationAsOf, sourceContextRef? })
  -> InstitutionCatalogProvider.loadCurrentCatalog() 或同源 ephemeral catalog snapshot
  -> catalog envelope validation
  -> version-dispatch record validation（whole pool）
  -> record-status display policy
  -> versioned List projector
  -> InstitutionListApplicationSnapshotV12
  -> InstitutionListViewModel
  -> WXML
```

硬边界：

- Page 不 import Mock、Provider、raw validator、Recommendation Domain、Evidence 或 legacy Institution DTO；
- Provider 不决定中文文案；
- ViewModel 不读取 raw record，不判 verification，不生成 Institution facts；
- catalog 中任一无效 record 使整次 current catalog 构建安全失败，不能静默排除后继续显示；
- 合法但非 List 可见的 recordStatus 由明确 display policy 处理，不等同“无效 record”；
- 输入 catalog 必须完整验证后才做 status selection、排序与 projection。

## 6. Institution List Application Snapshot

冻结使用 integration versioned shape；`V12` 指 UI/Application Contract 版本，不声称 raw record 已发布 V1.2：

```ts
interface InstitutionListApplicationSnapshotV12 {
  kind: 'institution_list_application_snapshot_v1_2'
  snapshotVersion: 'institution-list-application-snapshot-v1.2'
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  sourceContextRef: string | null
  ordering: InstitutionListOrderingManifestV12
  displayInstitutions: readonly InstitutionListDisplayItemV12[]
}

interface InstitutionListDisplayItemV12 {
  institutionId: string
  recordRevision: number
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2'
  recordProvenance: 'PRODUCTION_CANDIDATE' | 'MOCK_DEVELOPMENT_ONLY'
  recordStatus: 'published'
  name: InstitutionPresentationFact<string>
  region: InstitutionPresentationFact<{ code: string; displayName: string }>
  institutionType: InstitutionPresentationFact<readonly string[]>
  referenceMonthlyPrice: InstitutionPresentationFact<ReferenceMonthlyPriceDisplay>
  cover: InstitutionCoverDisplay
  vr: InstitutionVrDisplayState
  verifiedDisplayTags: readonly InstitutionVerifiedDisplayTag[]
  recommendationPlacement: InstitutionRecommendationPlacement | null
}
```

`sourceContextRef = null` 表示无 Recommendation context 的 direct List。只有从 frozen Recommendation V2
Result 进入且 registry 已建立同源 context 时才为非空 opaque ref；不得用空字符串，也不得把 direct List 伪装成
Recommendation context。未来若 direct List 也需要固定 catalog snapshot，应另行命名 `catalogSnapshotRef`，不复用
Recommendation source ref 的语义。

List Snapshot 只展示当前 catalog 中 `recordStatus = published` 的 record，因此类型把该值收窄为 `published`；
`draft`、`suspended`、`archived` 均不进入本 Contract 的 List display item。历史 recommendation 的 record status
只在 Detail 的 revision context 中处理，不能借机建立未批准的“历史机构列表”。

每个 presentation fact 至少保留两条独立轴：

```ts
type PresentationAvailability = 'provided' | 'unknown' | 'unavailable'
type EffectiveVerification = 'current_verified' | 'unverified' | 'expired'
```

List Snapshot 不包含：完整 `InstitutionRecord`、Evidence、raw capability matrix、raw Recommendation、
ElderProfile、Assessment、内部来源 URL、评分或顾问联系方式。

实现阶段可为 WXML 另外投影 `renderKey = institutionId + '#' + recordRevision`。它只用于 presentation key，
不是第三个领域身份；不得继续只用 `institutionId` 或 array index 作为未来多 revision 场景的 `wx:key`。

### 6.1 verified display tags

- 只能从已通过 validator 和 verification projection 的 current-verified provided fact 生成；
- tag 必须携带稳定 display code 与源 field path，中文只由 ViewModel 映射；
- `recordStatus = published`、`recordProvenance = PRODUCTION_CANDIDATE` 均不能生成“已核验”标签；
- unverified/expired/unknown 不得包装成正向真实标签；
- 不生成 caregiverQualityScore、medicalScore、activityScore、transportScore、ratingScore 或“匹配度”。

## 7. List Ordering

### 7.1 无 Assessment / Recommendation context

`DIRECT_LIST_SCOPE = CURRENT_DISPLAYABLE_PARTNER_INSTITUTIONS`。禁止伪造匹配顺序。默认优先采用 catalog
presentation metadata 中的显式、稳定 `displayOrder`，该值属于 Dataset/Catalog 列表编排配置，不进入
`InstitutionRecord`、Evidence 或 Recommendation。冻结两种完整 ordering policy，禁止逐条混用：

```text
CURATED_DISPLAY_ORDER_V1
  -> 每个可见 identity 必须有唯一非负 displayOrder
  -> sort tuple = (displayOrder, institutionId, recordRevision)

CANONICAL_IDENTITY_ASC_V1
  -> catalog 未提供经批准的 curated order 时使用
  -> sort tuple = (institutionId ASCII ascending, recordRevision ascending)
```

Dataset/Application 必须声明本次采用哪一项。只有整个 dataset 未配置经批准的 curated `displayOrder` 时，才使用
`CANONICAL_IDENTITY_ASC_V1`。`CURATED_DISPLAY_ORDER_V1` 中缺失或重复 order 是 projection error，不得对个别 record
暗中退回数组原序。Provider 返回数组顺序本身不构成产品顺序。不得依据评分、CareProcess、AI、VisitEvaluation、
床位或 Recommendation-like heuristic 自行排序。

### 7.2 有 frozen Recommendation V2 context

List 不调用 Recommendation Engine。Recommendation-context List 冻结为两个顶层展示组：

1. 第一组消费 frozen Recommendation V2 candidates：`cards` 或 `noExactMatch.nearMatches` 严格保持原输出顺序；
   `conditionalCandidates` 仍保持其 frozen 独立 tier/group 与原顺序，不与已确认 candidate 混排；
2. 第二组是其余 current displayable partner institutions，按 direct-list ordering 展示为“其他合作机构”；
3. 不eligible、unverified pool entry 不得因出现在 catalog 中被标为推荐；
4. Recommendation context 不能先截取或重建完整 pool，不能新增分数，也不能用 availability、评价、AI、
   CareProcess 或顾问行为改序。

不得为了补满三家改变 Recommendation cards，也不得为第二组重新计算“匹配度”。

## 8. Recommendation Context Transport

禁止把完整 Recommendation、Institution pool、raw ElderProfile 或 Assessment 放入 query。冻结以下最小安全方案：

```text
Recommendation Result Application Snapshot
  -> 建立窄化、进程内、不可持久化的 InstitutionNavigationSourceContext
  -> 返回不含个人数据的 opaque sourceContextRef
  -> route 只携带 canonical identity + source + sourceContextRef
  -> List/Detail Application Service 解析 ref 并验证 same-source
```

`InstitutionNavigationSourceContext` 只保留：

- `datasetVersion`、`datasetMode`、`evaluationAsOf`；
- frozen pool manifest 的 Institution identity/provenance/status；
- candidate identity、tier/group、原始顺序、frozen reason/difference code/reference 的窄化 projection；
- exact validated Institution source snapshot 或可 exact-resolve 的 immutable reference；
- 不保留完整 Draft、ElderProfile、Assessment answers 或正式 Recommendation identity。

`sourceContextRef` 与 source registry：

- 是 application correlation token，不是 `recommendationId`、`assessmentId` 或持久化身份；
- 第一版允许 `SESSION_ONLY_IMMUTABLE_SOURCE_REGISTRY`；ref 仅当前小程序进程/导航链有效，不写 storage、不写 Draft、
  不放日志大对象；
- query 中只传 opaque ref，不传其内容；
- `SOURCE_CONTEXT_LOSS_POLICY = FAIL_CLOSED`；进程重启、registry 丢失、ref 缺失/过期或 source manifest 不匹配时，
  不得从 Draft、当前 ElderProfile 或 current Catalog 重建旧 Recommendation context；
- List 应显示 `source_context_error`，允许用户通过明确操作切换到 direct browse；不得静默降级；
- route 明确声明 `source=recommendation` 而 ref/context 不可用时，Detail 必须进入 `source_context_error` 并明确显示
  “Recommendation context unavailable”，不得以 `ready` 或 direct Detail 静默继续；
- 只有 route identity 本身来自合法 direct browse context 时，Detail 才能不带 Recommendation context 正常打开；
  此时 recommendation-specific section 必须为空/不可用。

实现可用小型 module-level registry 或等价的 current-stack context carrier；不建设持久化 Store、repository framework
或全局状态机。不得把整个 snapshot 通过 URL/EventChannel 直接交给 Page。

## 9. Institution Detail Route Identity

Canonical Detail route 至少包含：

```text
/pages/institution/detail
  ?institutionId=<percent-encoded stable id>
  &recordRevision=<canonical positive decimal>
```

可选 navigation provenance：

```text
source=direct_list | recommendation | direct_link
sourceContextRef=<opaque application ref>
```

Recommendation Result→Detail 的规范值为 `source=recommendation`；route parser 不得发出或接受含义重复的
`recommendation_v2` 别名。Direct source 使用 `direct_list | direct_link`。

规则：

- `institutionId` 与 `recordRevision` 缺一即 `ROUTE_IDENTITY_MISSING`；
- ID 未通过 frozen stable identifier 即 `ROUTE_INSTITUTION_ID_INVALID`；
- revision 只接受 `/^[1-9][0-9]*$/` 且转换后为正安全整数，否则
  `ROUTE_RECORD_REVISION_INVALID`；
- producer 对每个值调用 `encodeURIComponent`；consumer 只接受一次合法解码后的值，不拼接未校验输入；
- 非法 `source` 或非法 `sourceContextRef` 返回稳定 route/context error；
- 不按 name、index、legacy id、display order 查找；
- 不 fallback first institution、latest mock 或“同 institutionId 的最新版”；
- query 不传 name、price、media URL、reason、Recommendation object、Profile 或 catalog；
- route source 只用于选择 context policy，不改变 canonical identity，也不授予权限。

从 Recommendation card 进入 Detail 时，必须传播 candidate 的原始 `(institutionId, recordRevision)`、
`source=recommendation` 与非空 opaque `sourceContextRef`；从普通 List 进入时，必须使用 List Application Snapshot item
已给出的二元身份。Page 不自行 load latest。任何 route 都不得传播 Recommendation object、ElderProfile、reason/difference
文本、raw Institution、catalog 或 media URL。

## 10. Institution Detail Data Flow

```text
Detail Page onLoad(options)
  -> parseInstitutionDetailRoute(options)
  -> InstitutionDetailApplicationService.build({ identity, source, sourceContextRef, evaluationAsOf })
  -> same-source context lookup（存在时）
  -> exact record resolve
  -> contract-version dispatch + runtime validation
  -> exact identity re-check
  -> optional current-head metadata lookup（只用于 drift 提示）
  -> versioned InstitutionDetail projector
  -> InstitutionDetailApplicationSnapshotV12
  -> InstitutionDetailViewModel
  -> WXML
```

Page 不访问 Mock、不读取 raw Institution、不拼 Evidence、不推 capability、不判断 verification、不重算推荐。
Application Service 只负责读取、验证、同源关联和调用 projector；它不拥有 matching、ADL、Profile 或业务评分。

## 11. Institution Detail Application Snapshot

提议的 presentation-oriented shape：

```ts
interface InstitutionDetailApplicationSnapshotV12 {
  kind: 'institution_detail_application_snapshot_v1_2'
  snapshotVersion: 'institution-detail-application-snapshot-v1.2'
  identity: InstitutionCanonicalIdentity
  sourceContractVersion: 'institution-contract-v1.1' | 'institution-contract-v1.2'
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  recordProvenance: 'PRODUCTION_CANDIDATE' | 'MOCK_DEVELOPMENT_ONLY'
  recordStatus: 'published' | 'suspended' | 'archived'
  revisionContext: InstitutionRevisionDisplayContext
  recommendationContext: InstitutionRecommendationDisplayContextV2 | null
  sections: InstitutionDetailSectionsV12
  actions: InstitutionDetailActionAvailability
}
```

`sections` 规划为：

1. `basic`：name、region、address、type、record status；
2. `recommendation`：同源 V2 candidate reason/difference/gap，只在合法 context 下存在；
3. `media`：cover、gallery 与 VR display state；
4. `careCapability`：五档照护接收、mobility、cognition、special care 的已投影语义；
5. `careProcess`：future V1.2 extension slot；
6. `staffing`；
7. `medicalRehabilitationMonitoring`；
8. `rooms`；
9. `meals`；
10. `activity`；
11. `transportHospital`；
12. `price`；
13. `qualifications`；
14. `consultantVisit`：future separate service slot。

每个 section 只含 display-safe field/capability projection、稳定 display code、availability、effective verification、
必要的 `asOf` 和合法 public media reference。它不含 raw Evidence、合同内部材料、运营备注、完整 raw record 或评分。

V1.1 record 的 `careProcess` 与 `consultantVisit` slot 为 `not_integrated` / `not_in_source_contract`，ViewModel 默认不展示；
不能写成“机构没有护理记录/没有顾问”。Future V1.2 projector 只能在各自 Contract 冻结后填充。

## 12. Same-source Recommendation Context

“为什么推荐给您”只允许来自 frozen Recommendation V2 candidate，且必须同时满足：

```text
candidate.institutionId == detail.identity.institutionId
candidate.recordRevision == detail.identity.recordRevision
candidate identity exists exactly once in source pool manifest
context.datasetVersion == source result datasetVersion
context.datasetMode == source result datasetMode
context.evaluationAsOf == source result evaluationAsOf
Recommendation Contract / Ruleset / Policy versions match the frozen result
```

Detail 不读取当前 Draft，不 derive ElderProfile，不重新调用 `evaluateRecommendationPreviewV2()`，不从 raw Institution
facts 临时生成理由，也不补满候选。Recommendation section 建议复用 Result V2 的单一 reason/difference 中文 mapper，
或消费由同一 mapper 生成的窄化 display projection，避免两个页面对相同 code 给出不同解释。

如果 route 明确声明 `source=recommendation`，但 identity/source metadata 不匹配或 context 不可用，返回相应稳定
`INSTITUTION_SOURCE_CONTEXT_ERROR`，整页进入 `source_context_error`。不得即使 exact record 可解析也静默转成 direct
Detail；用户只能通过新的、明确的 direct browse action 进入不带 Recommendation section 的合法 direct context。

## 13. Revision Drift Policy

正式冻结：

```text
RECOMMENDATION_DETAIL_REVISION_POLICY = PIN_ORIGINAL_REVISION
REVISION_DRIFT_POLICY = PIN_ORIGINAL_AND_DISCLOSE_DRIFT_V1
USER_CAN_OPEN_CURRENT_REVISION = TRUE_EXPLICIT_ONLY
```

1. **A — 保持原 revision**：Recommendation→Detail 永远先解析当次 candidate 的 exact revision，并用当次
   `evaluationAsOf` 解释其 verification；
2. **B — 提示资料变化**：Application 可独立查询 Provider 当前选定 identity。只要当前 identity 与原 identity 不同，
   `revisionContext` 标为 `different_current_revision_available`，显示“机构资料已有更新”；不比较 revision 数字来猜先后；
3. **C — 重新计算是新动作**：用户需要基于最新机构资料获得推荐时，必须发起一次全新的 Recommendation V2 构建。
   新结果有新的 catalog manifest 与
   evaluationAsOf，不能覆盖旧 context；
4. 禁止把当前 revision facts 与原 candidate reasons 拼在一个 recommendation section；
5. “查看当前机构资料”只允许由用户明确点击。新 Detail 使用 Provider 选定的完整 current 二元身份，并进入新的
   `CURRENT_INSTITUTION_CONTEXT`；必须清除旧 candidate、reason、difference、gap 与 tier explanation，不再展示
   “为什么推荐给您”，并显示“当前资料不等于本次推荐所依据版本”；
6. Detail 内不得局部重算 Recommendation；
7. exact old revision 不存在时进入 `revision_not_found`，可以提供“查看当前机构资料”的明确操作，但不自动跳转。

### 13.1 Record status policy

| 场景 | `published` | `suspended` | `archived` | `draft` |
|---|---|---|---|---|
| 普通 List | 展示 | 不展示 | 不展示 | 永不展示 |
| 普通 List→Detail | 正常 | 不应由 current List 产生 | 不应由 current List 产生 | 拒绝 |
| 历史 Recommendation→Detail | 正常 | 仅从合法历史 context 只读 + 醒目提示 + 禁止预约/当前 VR 等事实性 CTA | 仅从合法历史 context 只读 + 历史提示 + 禁止预约/当前 VR 等事实性 CTA | 拒绝 |
| 顾问联系 | 可用性由 future Consultant Contract 决定 | 可保留通用顾问入口，不承诺机构可预约 | 可保留通用顾问入口，不承诺机构可预约 | 不携带 draft record 给用户 |

`HISTORICAL_REVISION_READ_POLICY = READ_ONLY_FROM_VALID_HISTORICAL_CONTEXT`。历史 Recommendation 只有在合法 context
引用 exact revision 且 historical resolver 能精确解析时，才可只读打开 suspended/archived revision，以保留推荐解释链。
Snapshot/ViewModel 必须明确“这是当时推荐所依据的历史机构资料”及适当的当前状态说明，并包含 recordRevision、record
status、historical/current relationship 与合法可知的 current revision availability。不得把 `archived` 翻译成“机构倒闭”，
也不得把 `suspended` 翻译成“机构停止营业”，除非 Domain 有这样的明确事实。

历史 suspended/archived revision 不得出现在 Direct List，不得作为当前可预约版本、不得直接创建 AppointmentRequest，
也不得显示当前可用 VR CTA，除非未来 Contract 明确冻结合法 historical-media policy。可以保留通用“联系养老顾问”入口，
但不得暗示当前可预约、有床或可入住；若合法得知 active current revision，只能提供显式“查看当前机构资料”，不得自动跳转。

## 14. Verification Display

Detail/List 均必须保持事实值、availability 和 verification 三者分离：

| availability | effective verification | 页面可表达 | 禁止表达 |
|---|---|---|---|
| `provided` | `current_verified` | 展示该事实，并可标“资料已核验/截至…” | 把 verified 扩大到整家机构 |
| `provided` | `unverified` | “机构提供/资料待核验”或“需咨询” | 当作平台已确认事实 |
| `provided` | `expired` | 展示为“资料已过有效期，需重新确认” | 当作当前有效或“不支持” |
| `unknown` | 任意 | “暂未提供/暂不清楚” | “没有/不支持” |
| `unavailable` | 任意 | “当前资料明确不可用”，同时展示核验状态 | 与 unknown/unverified 混为一类 |

Capability 继续使用 frozen field-level verification projection。Page/ViewModel 不得将 `expired` 推成 `unsupported`，
也不得把 `requires_assessment` 写成 supported/unsupported。空 child array 只表示当前 revision 没有可声明 child fact，
不表示现实中已确认没有该房型、服务、交通、医院、活动或资质。

## 15. Media、VR 与 URL Boundary

### 15.1 cover / gallery

- 复用 V1/V1.1 `InstitutionMedia` 的 stable `mediaId`、role、category、sortOrder 与 field-wrapped URL；
- projector 先验证 record/evidence，再只输出 display-safe media item；
- cover 必须由 `identity.coverMediaId` exact 引用 role=`cover` 的同 revision media；
- gallery 只按 verified display sort projection 输出，Page 不使用 raw array index 作为 media identity；
- URL 必须由 frozen URL/verification gate 判定，不能直接把 query 或任意字符串交给 image/web-view；
- unavailable/unknown/unverified/expired 采用 placeholder/状态文案，不生成假图片。

建议 display projection 保留媒体身份与双轴状态，而不是只交给 Page 一个 URL：

```ts
interface InstitutionMediaDisplayItem {
  mediaId: string
  role: 'cover' | 'gallery'
  category: string
  availability: 'provided' | 'unknown' | 'unavailable'
  effectiveVerification: 'current_verified' | 'unverified' | 'expired'
  displayUrl: string | null
  caption: string | null
  sortOrder: number | null
}
```

只有 `provided + current_verified + valid URL` 才能产生非空 `displayUrl`。`mediaId` 是媒体身份；URL 可变化且不是
route identity。Gallery 的 child order 由 validated `sortOrder` 加 `mediaId` deterministic fallback 决定，不能依赖
Provider 原始数组次序。

### 15.2 VR

VR CTA 只有以下条件同时成立才可用：

```text
exact Institution identity resolved
vr.status = available
vr verification current at snapshot evaluationAsOf
root URL / cover / at least one scene 通过 frozen validator 与 display projection
```

Detail→VR 只传同一 `(institutionId, recordRevision)` 和可选 opaque sourceContextRef；禁止在 route 传 VR URL。
VR Application Service 必须再次 exact-resolve 同源 record/VR snapshot。当前 Mock 没有真实 VR；实际 record 为
`status = unknown`，URL/scene 均为空。“VR = none”只可作为产品口语，不是新的 stable enum。因此 List/Detail/VR CTA
都必须保持 unavailable/hidden；不得为测试添加 fake panorama、占位 URL 或假 scene。

VR display projection 至少分别保留 `availability = available | unknown | unavailable`、effective verification、
`canNavigate` 和 scene count；只有 truth gate 通过时 `canNavigate = true`。Root URL/scene URL 留在 VR Application
Snapshot 内，不进入 Detail route query，也不由 Detail Page 自行拼装。

## 16. Price、Room、Meal 与其他事实边界

### 16.1 Price

- List 只展示 `referenceMonthlyPrice` 的 bounded、starting_at 或 unknown；unknown 绝不显示 `¥0`；
- Detail 可展示 V1.1 已有 recurring components、deposit、one-time fees、adjustment factors 和 note；
- 不自动把 components 相加为总价，不把参考价写成最终报价，不推导武汉市场最低价；
- operational current price 仍需真实来源和相应 verification。

### 16.2 Room

- Detail 可展示合法 room facts 与 stable `roomId`；
- 缺少 single-room row 不能显示“不提供单人间”；
- empty rooms/feature child collections 不形成负面事实；
- 不从房间设施生成 roomScore 或机构综合评分。

### 16.3 Meal

- 分别展示 meal schedule、easy-chew、modified-food、meal fee 与 extra fee 的 availability/verification；
- `modified_food != tube_feeding`；
- meal 缺失不生成护理 capability。

### 16.4 Staffing / Medical / Rehabilitation / Monitoring / Activity / Transport

- 只展示 validated、display-safe facts；
- 数量、比例、响应时间、医院距离和交通事实必须保留单位与验证状态；
- 不生成 caregiverQualityScore、medicalScore、rehabilitationScore、activityScore、transportScore；
- 不用设施存在推导特殊护理已支持。

### 16.5 Qualifications 与 Public Rating

- Qualification 只展示合法公开 projection，不暴露 raw evidence/内部 document reference；
- `PUBLIC_INSTITUTION_RATING = DISABLED_V1_2`；List/Detail 不规划星级、评价数、好评率、公开评论、评价排序；
- Institution qualification 中的真实机构评级事实与“用户公开评分”不是同一对象，不能互相替代。

## 17. Care Capability Boundary

`INSTITUTION_CAPABILITY_CONTRACT = institution-capability-contract-v1 / UNCHANGED`。

Detail 可以显示五档 care-level acceptance、mobility、cognition 与九项 special care 的 Domain projection；不得：

- 在 Page/ViewModel 重新计算 effective status；
- 从 CareProcess、staffing、医疗设施、meal、VisitEvaluation 或 AI 推导 capability；
- 把 unknown/unverified/expired 显示为 supported/unsupported；
- 生成“护理能力分”或改写 Recommendation Safety/Tier/Rank。

## 18. Future CareProcess Slot

Detail Snapshot 保留 `careProcess` extension section boundary，但 A0 不定义其中 code、字段或验证逻辑：

```text
owner = future institution-contract-v1.2
matchingRole = DISPLAY_EXPLAINABLE_ONLY
recommendationV2Input = FORBIDDEN
v1.1 default = not_in_source_contract（不渲染为负面事实）
```

后续 A1 必须继续双轴建模：事实值/availability 与 verification status 分开；不能把
`verified/unverified/expired` 塞入 `available/unavailable/unknown` 的事实 enum。所有 CareProcess 字段需 field-level
verification/evidence；VisitEvaluation observation 不得直接写入。

## 19. Future Consultant Slot

顾问资料不进入 `InstitutionRecord`。Future relationship 固定为：

```text
InstitutionCanonicalIdentity
  -> ConsultantAssignmentService.resolveForInstitution(identity)
  -> ConsultantProfile public projection
  -> Detail consultant/visit action slot
```

具体 `consultantId`、assignment version、service status、电话和 QR media contract 由后续 Consultant Contract 冻结。
A0 只冻结：输入必须是 canonical Institution identity；输出来自独立 service；平台顾问电话明确标注“养老顾问/带看顾问”，
不得写成机构官方电话，也不得把朋友号码、个人临时二维码或假媒体硬编码到 Institution record/Page。未来 MVP 可以由
Consultant Contract 明确 `all current institutions -> DEFAULT_CONSULTANT`，但 A0 不定义 Consultant 数据结构或运行时；
institution official contact 与 platform consultant contact 必须始终是不同数据对象。

## 20. Appointment / Visit / Evaluation Identity

Detail 发起任何后续动作时必须携带当前 canonical identity：

```text
AppointmentRequest.institutionId
AppointmentRequest.institutionRecordRevision

InstitutionVisit.institutionId
InstitutionVisit.institutionRecordRevision

VisitEvaluation.institutionId
VisitEvaluation.institutionRecordRevision
```

未来 Evaluation 还必须绑定真实 `visitId`，且 Visit 后端状态为 `completed`；Page 不按时间推断 completed。
这些业务对象不能只保存 institution name，也不能在保存/打开时自动换成 latest revision。Consultant identity、user/elder
identity、登录、手机号 consent、提交幂等与 persistence 等待各自 Contract；A0 不伪造任何 ID 或成功状态。

从 historical、suspended 或 archived revision 发起 `APPOINTMENT_CREATION = FORBIDDEN`。用户只有通过明确动作切换到
current revision 后，未来 Appointment Contract 才能再判断该 revision 是否 appointment-eligible；A0 不预判实际资格。

## 21. Navigation Source Identity Matrix

所有 action 继续遵守 `1 physical tap -> 1 custom action -> 1 page handler -> at most 1 navigation`、明确
`bubbles:false/composed:false`、NavigationGuard 第二层防御、Back fallback 和可见 fail feedback。

| 跳转 | 必须携带/预置 | 目标解析 | 禁止 |
|---|---|---|---|
| List → Detail | item 的 `institutionId + recordRevision`；推荐上下文模式再带非空 `sourceContextRef` | exact record；direct list ref=null 且无推荐理由 | index/name/latest lookup |
| Result → Detail | candidate 的相同二元身份 + `source=recommendation` + recommendation context ref | exact source record + exact candidate context | Detail 重跑 engine/换 revision |
| Detail → VR | Detail 的相同二元身份 + safe context ref | VR service exact projection | query 传 raw URL/假 VR |
| Detail → Consultant tab | 先向 future Consultant context service 写入窄化 canonical identity ref；无 ref 时打开通用顾问页 | assignment service | 把电话/QR 放 query；伪装官方电话 |
| Detail → Appointment | 当前二元身份；future appointment launch context | Appointment service 再校验 | 只传 name/本地假 appointmentId |
| Detail → Evaluation（future） | 真实 completed `visitId` + visit 已绑定的二元身份 | Visit/Evaluation service | 直接从 Detail 自称已带看 |

微信 `switchTab` 不承载 query 的业务上下文时，应使用窄化、短生命周期 application context，而不是全局 raw Institution
或 Profile Store。每条导航的 `wx.*` 参数、fail/complete 和 guard 释放继续按现有 WeChat API/Interaction Contract 审查。

## 22. Page States 与稳定错误

### 22.1 Institution List

```text
loading
ready
empty
catalog_error
source_context_error
projection_error
```

- `empty` 文案：“当前暂无可展示的合作机构资料。”不能写“武汉暂无养老院”；
- `catalog_error`：Provider/envelope/record validation 失败，不显示部分未验证列表；
- `source_context_error`：推荐上下文无效，不静默套用 direct/recommendation order；提供明确“按当前合作机构资料浏览”；
- field unknown 不是 Page state。

### 22.2 Institution Detail

```text
loading
ready
route_error
not_found
revision_not_found
catalog_error
source_context_error
projection_error
```

- `route_error`：必需 query 缺失/非法；
- `not_found`：合法 institutionId 没有任何可读取记录；
- `revision_not_found`：institutionId 存在，但指定 revision 无法精确读取；不得打开其他 revision；
- `catalog_error`：Provider/validator/unsupported contract version；
- `source_context_error`：route 明确为 Recommendation 来源，但 opaque ref/context 缺失、过期或不匹配；不得静默降级为
  direct Detail，也不得从 Draft/Profile/current Catalog 重建；
- `projection_error`：合法 record 无法形成 display-safe projection；
- 合法 direct browse context 可以不带 Recommendation context 保持 `ready`，但 recommendation section 必须为空/不可用；
- suspended/archived historical display status 属于合法 `ready` snapshot 内的状态，不新增 `archived_page` 或
  `suspended_page`；
- field-level unknown/unavailable/unverified/expired 都属于 section display，不新增整页状态。

### 22.3 Stable application errors

建议 A0 implementation 至少使用下列稳定 code family：

```text
INSTITUTION_ROUTE_ERROR
  ROUTE_IDENTITY_MISSING
  ROUTE_INSTITUTION_ID_INVALID
  ROUTE_RECORD_REVISION_INVALID
  ROUTE_SOURCE_INVALID
  ROUTE_CONTEXT_REF_INVALID

INSTITUTION_CATALOG_ERROR
  PROVIDER_LOAD_FAILED
  INVALID_CATALOG_ENVELOPE
  UNSUPPORTED_INSTITUTION_CONTRACT_VERSION
  INVALID_INSTITUTION_RECORD
  DUPLICATE_CURRENT_INSTITUTION_ID
  DUPLICATE_CANONICAL_IDENTITY
  INVALID_LIST_ORDER_METADATA

INSTITUTION_DETAIL_ERROR
  INSTITUTION_NOT_FOUND
  INSTITUTION_REVISION_NOT_FOUND
  EXACT_IDENTITY_MISMATCH
  DETAIL_PROJECTION_FAILED

INSTITUTION_SOURCE_CONTEXT_ERROR
  SOURCE_CONTEXT_NOT_FOUND
  SOURCE_CONTEXT_EXPIRED
  SOURCE_CONTEXT_IDENTITY_MISMATCH
  SOURCE_CONTEXT_DATASET_MISMATCH
  RECOMMENDATION_CONTEXT_SOURCE_MISMATCH
```

Error payload 只含 stable code、必要的安全 index/field path 或二元 identity；不包含 raw Institution、Evidence、
Assessment、Profile、Recommendation、Secret 或用户健康数据。

## 23. Mock Disclosure

当 `datasetMode = MOCK_DEVELOPMENT_ONLY` 或任一展示 record provenance 为该值时：

1. **FILE**：Provider/fixture 文件声明 development only；
2. **RECORD**：每条 record 保持 `recordProvenance = MOCK_DEVELOPMENT_ONLY`；
3. **UI**：List 与 Detail 顶部持续可见：

> 开发演示数据
>
> 以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。

名称继续使用“示例机构 X（Mock）”。不得添加真实武汉品牌、真实/猜测价格、床位、资质、护理能力、CareProcess、
电话、QR、评价或 VR。Mock `published` 只表示开发页面可读，不表示 production VERIFIED。

## 24. Recommendation V2 Isolation

List/Detail migration 对以下内容必须保持 observable business diff = 0：

- Recommendation Contract V2 / Ruleset V2 / policy version；
- Safety Core、Eligibility、EXACT/SOFT_NEAR/CONDITIONAL/UNVERIFIED/INELIGIBLE；
- PriorityFitVector、Rank Tuple、NO_EXACT_MATCH、cards max 3；
- reasons/differences、pool manifest、determinism/permutation；
- complete catalog input 与 verification gate。

List/Detail 只能读 Recommendation output。禁止：

- 在 List/Detail Service 或 ViewModel 调用 evaluator；
- 用 current Detail record 替换 candidate source revision；
- 用 List filters/preference/availability/评价重新 rank；
- 把 CareProcess、AI、Consultant、Appointment、Visit、Evaluation、public rating 送入 Recommendation V2；
- 让 Institution Detail 成为 Recommendation input owner；
- 修改 frozen Recommendation files 来方便导航。

未来 V1.2 raw record 进入 Recommendation V2 必须先经单独冻结的显式 V1.2→V1.1 projection，移除
CareProcess extension，同时保持原 identity/evidence/capability 语义。

## 25. Gate Release Preconditions

本 Contract Freeze 不解除任何 Gate；`GATE_RELEASE = 0`。

### 25.1 `CARD_DETAIL_NAVIGATION`

只有以下全部具备证据后才可提请解除：

1. 本 canonical route identity 与 5 项产品决策已批准/frozen；
2. Detail Application Snapshot、version dispatcher 和 projector 已实现；
3. exact same-revision resolver 与 no-latest-fallback runtime 通过；
4. V1.1 validator 已覆盖，V1.2 上线时其 validator/projection 也已冻结；
5. Recommendation candidate/context same-source runtime 通过；
6. Mock disclosure、verification axes、price/room/meal negative-absence boundary 通过；
7. VR truth gate 通过，当前 Mock VR CTA = 0；
8. route missing/invalid/not-found/revision-not-found/drift/status runtime fixtures 通过；
9. TypeScript 5.9 application、WeChat TS 4.1.2 targeted、generated JS compatibility、JSON、Less 通过；
10. DevTools 实际 Result→Detail/List→Detail 导航、Back/fail/rapid action 通过；
11. Android 真机后续人工验证通过并明确标注证据类型；
12. 独立 qa_reviewer 无 blocker，Recommendation V2 frozen regressions 全部通过。

### 25.2 `INSTITUTION_LIST_NAVIGATION`

至少以下全部通过后才可提请解除：

1. canonical List Application Snapshot 与 approved ordering policy；
2. full-catalog validation、published-only direct display 与 empty/catalog/context errors；
3. Mock disclosure 和真实 verified tag projection；
4. direct/recommendation context ordering runtime，不重算/重排 Recommendation；
5. List→Detail 二元 identity 精确传播；Recommendation context 模式额外验证非空 `sourceContextRef`；
6. list permutation/determinism、invalid catalog、no-partial-display runtime；
7. TypeScript/WeChat compatibility/JSON/Less；
8. DevTools 实际 Home/Result→List→Detail 导航、Back/fail/rapid action；
9. 独立 QA 无 blocker，Recommendation V2 frozen regressions business diff = 0。

Android 后续真机验证仍是正式 production freeze 必需证据；上列为“允许开发导航 Gate 进入候选解除”的最低项，
不能把 DevTools 当真机。

## 26. Frozen Runtime / QA Gate for A0-2 Implementation

下一阶段实现时至少建立以下 fixture/gate；本阶段不创建：

### List

- valid 8-record Mock current catalog → 8 个 display item，三层 Mock disclosure；
- invalid one record → entire catalog error，0 partial items；
- empty published set → `empty` 与限定文案；
- draft/suspended/archived 不进入 direct List；
- provider permutation → direct order deterministic；
- curated order missing/duplicate → stable error；
- recommendation context → cards/near/conditional 原序不变，其他 record 独立分组；
- invalid/expired/mismatched context → no silent recommendation order；
- Page/App code import legacy DTO/Mock/scripts fixtures = 0。

### Detail / Route

- canonical query round-trip 与 percent encoding；
- missing/invalid ID、zero/negative/decimal/exponent/overflow revision → route error；
- exact identity found → ready；
- institution missing vs revision missing 分开；
- resolver 返回 other revision → `EXACT_IDENTITY_MISMATCH`；
- Result candidate/source manifest/detail identity exact join；
- drift → original facts/reasons retained + visible update state；
- context unavailable → no recommendation reason regeneration；
- explicit current revision action → `CURRENT_INSTITUTION_CONTEXT` + new identity + no old candidate/reason/difference/gap/tier；
- field availability/verification cross-product display；
- empty room/child collection 不渲染负面事实；
- bounded/starting_at/unknown price；
- current Mock VR CTA = 0；
- suspended/archived exact history read policy、history copy 与 CTA 收紧；
- explicit `source=recommendation` + missing/expired/mismatched ref → `source_context_error`，0 direct fallback；
- direct source without Recommendation context → ready，0 recommendation-specific section。

### Regression / Compatibility

- Institution V1/V1.1、Recommendation V1/V2、Recommendation Preview/Result V1/V2 全量回归；
- Recommendation V2 input/output deepEqual isolation fixture；
- Assessment/Profile frozen regressions；
- TypeScript 5.9、WeChat TS 4.1.2 targeted roots 覆盖新增 type/service/viewmodel/page；
- WeChat generated JS class-field compatibility、自测、JSON、Less、interaction runtime；
- forbidden API/Secret/logging scan；
- DevTools 与后续 Android 证据分开记录。

## 27. A0-2 / A2 Implementation File Proposal

以下只列出下一阶段候选 ownership，不在 A0 创建：

```text
miniprogram/types/institution-list-detail.ts
miniprogram/types/institution-navigation-context.ts
miniprogram/services/institution-source-context.ts
miniprogram/services/institution-list-application.ts
miniprogram/services/institution-detail-application.ts
miniprogram/services/institution-record-resolver.ts
miniprogram/pages/institution/index-view-model.ts
miniprogram/pages/institution/detail-view-model.ts
scripts/fixtures/institution-list-detail-fixtures.mjs
scripts/check-institution-list-detail-runtime.mjs
scripts/check-institution-list-detail-interactions.mjs
```

现有 `miniprogram/services/institution-catalog-v1-1.ts` 可做最小 adapter/reuse，但不得破坏 Recommendation V2 当前
Service contract。Future V1.2 validator/projector 文件只有 A1 Contract Freeze 后才能加入。A0-2 建议先实现 types、
exact resolver、context、List/Detail snapshots 和 runtime，不解除页面导航；A2 再替换骨架 Page、WXML/Less，完成
DevTools/Android/QA 后评估 Gate。

## 28. Agent Review Record

### 28.1 wechat_frontend

状态：`PASS_WITH_MIGRATION_GATES / READ_ONLY`

确认 route、snapshot、ViewModel、Page state 与导航分层可行；强调 `revision_not_found` 必须与 institution not found
分开、current catalog 与历史 resolver 不能混合。可复用 `institutionCatalogServiceV11`、基础组件与 Less token；
`projectInstitutionDisplaySnapshotV11` 只能作为投影参考，不能代替完整 Detail snapshot。正式页面不能继续使用
legacy service/DTO 或未经改造的 `route-scaffold`。发现 Home `id`-only path、List/Detail 无 identity、Consultant
`switchTab` context 尚未冻结；本 Proposal 已将其列为后续 Gate。

只读回归证据：Institution V1.1 47、Recommendation V2 68 + parity 6、V2 Preview Integration 20、Result V2
snapshot 18/UI 30、Result Page 30、generated JS 87 modules 均 PASS。本轮未运行新 DevTools 编译或 Android，不能
用这些结果解除 A0 Gate。

### 28.2 backend_domain

状态：`PASS_WITH_REQUIRED_CONTRACTS / READ_ONLY`

确认 current catalog 与 exact immutable-history resolver 必须分开；未来数据库可用内部 surrogate key，但必须对
`(institutionId, recordRevision)` 建立唯一约束/复合引用，历史业务对象保存原二元身份。建议 A+B drift policy，
Consultant assignment 独立于 Institution record，AppointmentRequest 与 operational Visit 分离，Evaluation 绑定真实
completed Visit。当前 `server/` 仍为空壳，未提供 revision history、ownership、auth、idempotency 或 persistence 证据。

只读回归证据：Institution V1 96、Institution V1.1 47、Recommendation V2 68、V2 Integration 20、Result V2
snapshot 18/UI 30 均 PASS。Agent 未修改/暂存/提交文件。`recordRevision` 的单调性尚未由现有 frozen Contract 明确，
因此本 Proposal 不以数值大小判断“更新”，只比较 Provider 指定 current identity 是否不同。

### 28.3 matching_engine

状态：`PASS_WITH_REQUIRED_FOLLOW_UP / READ_ONLY`

确认当前 V2 对完整 8 条 catalog 先验证后求值，provider permutation 不改变语义，candidate/display/pool manifest
按二元身份、revision、provenance/context 严格关联；Result VM 不重算、不筛选、不排序、不生成新理由。推荐使用
session-only immutable source registry，且 ref 必须绑定完整 source snapshot/manifest，而不能只靠 datasetVersion/time。
List/Detail 只读复用既有 candidate 顺序与 reason/difference；CareProcess、AI、Consultant、Visit、Evaluation、评分
继续完全隔离。

只读回归证据：Recommendation V2 68 + parity 6、V2 Preview Integration 20、Result V2 snapshot 18/UI 30、
Result Page 30、V1 Integration 24、Institution V1/V1.1 96/47、WeChat TS targeted 与 generated JS compatibility
均 PASS。`Recommendation V2 observable semantics = 0 change`。

### 28.4 qa_reviewer

状态：`PASS / INDEPENDENT_READ_ONLY_REVIEW`

独立 QA 确认：identity drift=0、silent latest fallback=0、fake facts/VR=0、public rating=0、Recommendation V2
business change=0、production code change=0，当前唯一工作树变更为本 Proposal，index 为空。首次审查指出 direct List
的 `sourceContextRef` optionality 和 Mock VR `none` 口语可能产生歧义；已分别修订为 direct=`null` / Recommendation
context=non-empty ref，以及真实 `status=unknown`、URL/scene 为空。第二次只读复核结论为 `QA_VERDICT = PASS`，无 blocker。

### 28.5 A0-FREEZE role re-review

项目负责人批准五项产品决策并将本文更新为 frozen 后，三个领域 Agent 对最终规范重新进行了独立只读复核：

- `wechat_frontend = PASS`：确认 canonical route、`source=recommendation`、opaque ref、fail-closed、Direct/Recommendation
  ordering、List/Detail page states、explicit current switch 与后续导航边界完整，两个 Gate 未解除；
- `backend_domain = PASS`：确认 current/history resolver 分离、immutable exact revision、历史 suspended/archived 只读、
  history status 文案、Appointment/Visit/Evaluation 二元身份与 historical appointment 禁令完整；
- `matching_engine = PASS`：确认 Recommendation V2 observable business behavior diff = 0，完整 frozen order/reason/context
  只读消费，无 prefilter、rerank、recompute、context reconstruction 或 current revision 语义串接。

三个 Agent 均未修改、创建、暂存或提交文件。以上为 docs-only Contract review，不是 List/Detail runtime、DevTools 或
Android 真机证据，不能用于解除导航 Gate。

## 29. Frozen Product Decision Record

### 29.1 Proposal history

本文件最初以 `PROPOSED_PHASE_V1_2_A0` 提交只读多角色审查。Proposal review 记录保留在第 28 节；其中五项待定产品
行为已由项目负责人在 Phase V1.2-A0-FREEZE 全部批准。当前规范状态为：

```text
PROJECT_OWNER_DECISIONS = APPROVED
PRODUCT_DECISIONS_REQUIRED = 0
CONTRACT_STATUS = FROZEN_PHASE_V1_2_A0
```

### 29.2 Approved decisions

1. **Recommendation→Detail revision pinning**
   `RECOMMENDATION_DETAIL_REVISION_POLICY = PIN_ORIGINAL_REVISION`。必须固定 candidate 原始
   `(institutionId, recordRevision)`；reason/difference/gap 只能属于同一 revision，current/latest 不得静默替换。
2. **Revision drift disclosure**
   `REVISION_DRIFT_POLICY = PIN_ORIGINAL_AND_DISCLOSE_DRIFT_V1`。原 revision 与原理由继续展示；合法得知 current
   identity 不同时可显示“机构资料已有更新”，但不得自动替换。
3. **Inactive historical record access**
   `HISTORICAL_REVISION_READ_POLICY = READ_ONLY_FROM_VALID_HISTORICAL_CONTEXT`。suspended/archived exact revision
   只从合法历史 Recommendation context 只读打开；不进入 Direct List，不创建 AppointmentRequest，不显示当前 VR CTA。
   通用顾问入口不得暗示当前可预约、有床或可入住；draft 永不展示。
4. **List scope and ordering**
   `DIRECT_LIST_SCOPE = CURRENT_DISPLAYABLE_PARTNER_INSTITUTIONS`。Direct List 优先使用 Catalog presentation metadata
   的 curated `displayOrder`；整个 dataset 未配置时才按 canonical identity deterministic ordering。Recommendation-context
   List 先严格保持 frozen V2 candidate/group/order，再展示其余 current displayable partners；不得重算、补满或启用
   rating/CareProcess/AI/VisitEvaluation/bed/recommendation-like heuristic 排序。
5. **Explicit switch to current revision**
   `USER_CAN_OPEN_CURRENT_REVISION = TRUE_EXPLICIT_ONLY`。明确点击后进入新的 `CURRENT_INSTITUTION_CONTEXT`，清除旧
   candidate/reason/difference/gap/tier explanation。基于最新资料的推荐必须重新构建新的 Recommendation V2 result，
   不得在 Detail 内局部重算。

同时批准：

```text
SESSION_ONLY_IMMUTABLE_SOURCE_REGISTRY = ALLOWED_V1
SOURCE_CONTEXT_LOSS_POLICY = FAIL_CLOSED
CURRENT_CATALOG_RESOLVER != HISTORICAL_REVISION_RESOLVER
APPOINTMENT_CREATION_FROM_HISTORICAL_OR_INACTIVE_REVISION = FORBIDDEN
CURRENT_MOCK_VR_STABLE_STATUS = unknown
RECOMMENDATION_V2_CONSUMER_ONLY = TRUE
CARE_PROCESS_STABLE_CODE = NOT_DEFINED
GATE_RELEASE = 0
```

两个导航 Gate 在 Contract Freeze 后仍保持 `DEVELOPMENT_BLOCKED`。

## 30. Blockers、Risks 与 Next Recommendation

### Blockers

- `FREEZE_BLOCKERS = 0`，`PRODUCT_DECISIONS_REQUIRED = 0`；
- `INSTITUTION_CONTRACT_V1_2` / CareProcess 尚未冻结；
- List/Detail canonical Application Snapshot、exact resolver、route parser 和 runtime 尚未实现；
- DevTools/Android 尚无本链路证据；
- production immutable revision provider/backend 尚不存在。

后四项是后续实现和 Gate 解除 blocker，不阻碍本 Contract 完成 docs-only Freeze。

### Risks

- 当前 V1.1 current catalog 按 institutionId 唯一，不能替代生产历史 revision resolver；
- Home 仍有 `?id=` legacy Detail route，List/Detail/VR 仍由无 identity 的 scaffold 串联；
- ephemeral context 在小程序进程重启后必然失效，必须显式 fail closed，并禁止伪造持久化 Recommendation identity；
- result reason 中文 mapper 当前位于 Result ViewModel，后续复用若处理不当会导致 Detail 文案漂移；
- `recordStatus` 与“current head”需要 Backend/Provider 的明确版本历史语义，不能用 revision 数字大小猜测；
- curated `displayOrder` 尚无现有字段，必须作为 catalog presentation metadata 单独冻结，不能污染 Institution facts；
- switchTab 到 Consultant 不能依赖 URL query 传上下文，需后续窄化 application context contract；
- 没有真实机构/媒体/VR/顾问/预约数据，开发阶段只能继续明确 Mock/Unavailable。

### Next Recommendation

本 docs-only Freeze 通过并形成独立 baseline 后，可进入 `Phase V1.2-A0-2`，只实现 canonical
types/service/route parser/exact resolver/source context registry/snapshot/projection/runtime gates，仍不加 CareProcess、
Consultant、Appointment、Visit、Evaluation、AI、Backend，也不直接解除 List/Detail 导航。A1 冻结 Institution
V1.2/CareProcess，A2 再完成页面接入与 DevTools/真机 Gate。
