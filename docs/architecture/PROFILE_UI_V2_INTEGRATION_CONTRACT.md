# Elder Profile V2 Application Integration Contract

状态：`FROZEN_PHASE_V1_1_F1`

版本：`profile-ui-v2-application-integration-v1`

`PRODUCTION_CODE_CHANGE = 0`。本文冻结 Profile V2 application snapshot、ViewModel、页面
状态和版本边界设计，不修改 Page、Component、Store、Domain、Service、WXML 或 Less。

## 1. 目的与非目标

本契约把已冻结的 `ElderProfilePreviewV2` 接到现有老人画像页面，同时保留 Phase 3B 的页面交互和
用户表达边界：

```text
AssessmentDraftV2
  -> Profile application entry
  -> deriveElderProfilePreviewV2()
  -> ProfileApplicationSnapshotV2
  -> ProfilePageViewModelV2
  -> pages/assessment/profile WXML
```

本阶段只设计 contract，不实现 UI。以下内容仍然是 0：

- 不修改 `ELDER_PROFILE_CONTRACT_V2.md`、`ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md` 或 Assessment Contract；
- 不重新推导 ADL、careLevel、mobility、nutrition、cognition、special care 或 budget advisory；
- 不创建 `CompletedAssessment`、formal `ElderProfile`、`elderId`、`assessmentId`、`completedAt` 或任何 preview ID；
- 不读取 Institution Catalog，不执行 Recommendation，不解除 Institution List/Detail gate；
- 不持久化、缓存或写回 Preview；
- 不把 4C-2 的 dirty production implementation 当作 V2 的 source of truth。

## 2. Source of Truth

按优先级使用：

1. `docs/architecture/ELDER_PROFILE_CONTRACT_V2.md`；
2. `docs/architecture/ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md`；
3. `docs/architecture/ASSESSMENT_CONTRACT_V2.md` 及
   `docs/architecture/ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md`；
4. `docs/architecture/PROFILE_UI_CONTRACT.md`（Phase 3B 已冻结的交互、文案边界和展示原则）；
5. 最新产品资料 `docs/product/武汉养老机构精准匹配小程序_V1.1_页面级PRD_更新版.pdf`（老人画像页、推荐页、
   登录/隐私及推荐解释相关页面）和 `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.1_更新版.pdf`；
6. `AGENTS.md`、`FRONTEND_STRUCTURE.md`、`MOCK_DATA_POLICY.md` 与 `WECHAT_INTERACTION_CONTRACT.md`。

当前 `miniprogram/pages/assessment/profile.*` 与 `profile-view-model.ts` 只作为 Phase 3B 的实现基线进行
差异分析。它们不能覆盖 V2 Domain 的 stable code、unknown、clarification、证据或版本语义。

## 3. Application Snapshot

### 3.1 Snapshot 责任

Application 层负责读取一次当前 V2 Draft、调用唯一公开 V2 Preview adapter，并把成功的 Preview
包成页面可消费的最小快照。Page 不直接读取 Store、Domain 输入或 raw answer。

application 入口冻结为 `buildProfileApplicationSnapshotV2()`；以下名称与语义若需调整，必须先升级本契约：

- 每次调用只读取一次 Draft snapshot；
- 只接受 `schemaVersion = 2` 的合法 V2 Draft；
- 直接调用 `deriveElderProfilePreviewV2()`，不复制任何 derivation；
- 失败时返回 stable error，不返回 partial Preview；
- 成功时保留 Preview 的 `source.localDraftId`，但不把它改名为 formal ID；
- 不读取当前时间、不生成 timestamp、不写 storage、不建立 Preview Store。

`preview` 始终是语义与元数据的权威来源。Snapshot 根级 `source` / `versions` 只是方便 application
consumer 使用的不可变投影；构建时必须逐项等值校验，不能成为第二套可覆盖状态。任何不一致都以稳定
snapshot error 失败，不能选一边继续显示。

### 3.2 Frozen TypeScript shape

这是 application contract 的冻结类型边界；它不是对 Domain 类型的重新定义：

```ts
type ProfileApplicationDisplayStateV2 = 'ready'

interface ProfileApplicationSnapshotV2 {
  kind: 'profile_application_snapshot_v2'
  preview: ElderProfilePreviewV2
  displayState: ProfileApplicationDisplayStateV2
  source: {
    kind: 'local_assessment_preview'
    localDraftId: string
    assessmentSchemaVersion: 2
  }
  versions: {
    assessmentSchemaVersion: 2
    profileContractVersion: 'elder-profile-contract-v2'
    derivationRulesetVersion: 'elder-profile-ruleset-v2'
    adlRulesetVersion: 'adl-ruleset-v1'
    summarySchemaVersion: 'elder-profile-summary-input-v2'
  }
}

type ProfileApplicationErrorCodeV2 =
  | 'PROFILE_APPLICATION_V2_ERROR'

type ProfileApplicationErrorCauseCodeV2 =
  | 'DRAFT_READ_FAILED'
  | ElderProfilePreviewDerivationErrorCodeV2
  | 'SNAPSHOT_METADATA_MISMATCH'

type ProfileApplicationResultV2 =
  | { ok: true, value: ProfileApplicationSnapshotV2 }
  | {
      ok: false
      error: {
        code: ProfileApplicationErrorCodeV2
        causeCode: ProfileApplicationErrorCauseCodeV2
        questionIds?: readonly AssessmentQuestionIdV2[]
      }
    }
```

`source` 与 `versions` 的固定投影路径为：

| Snapshot 字段 | 唯一来源 |
|---|---|
| `source` | `preview.source` |
| `versions.assessmentSchemaVersion` | `preview.source.assessmentSchemaVersion` |
| `versions.profileContractVersion` | `preview.profileContractVersion` |
| `versions.derivationRulesetVersion` | `preview.derivationRulesetVersion` |
| `versions.adlRulesetVersion` | `preview.adl.derivedFacts.rulesetVersion` |
| `versions.summarySchemaVersion` | `preview.userFacingSummary.summarySchemaVersion` |

Application 不得自行拼接版本、生成身份或根据字符串文案推断答案。Snapshot 只能存在于当前页面调用链
的内存中，调用结束后没有持久化义务。

### 3.3 Error and privacy boundary

错误可包含稳定 code、stable cause code 和用于恢复的 question ID，但不得包含完整答案、完整 Profile、evidence 内容、
内部 rule ID、secret 或 raw payload。`INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` 必须保留 Preview adapter
返回的第一个缺失 question ID，以供恢复到对应问卷步骤；Application 不可静默补答案。

## 4. ProfilePageViewModelV2

### 4.1 ViewModel 责任

V2 ViewModel 只做 presentation projection：

- 将 V2 stable code 映射成面向用户的中文 label；
- 按产品顺序组合 section 和 row；
- 将 `preview.userFacingSummary` 的 section/code 变成展示清单；
- 显示已确认事实、unknown、needs-confirmation 和 not-reported 的不同状态；
- 将 `preview.clarifications` 转成友好提示并绑定回原始编辑步骤；
- 展示 `HIGH_CARE_LOW_BUDGET` advisory 一次；
- 提供编辑路由、CTA 可用性和页面操作文案。

ViewModel 明确不负责：

- 重新计算 ADL 等级、行动方式、康复、认知或特殊护理；
- 根据 raw answer 产生新的 nutrition 或 budget 结论；
- 根据 clarification 文案反推 question/option code；
- 从机构目录、Recommendation 或媒体资料生成任何内容；
- 过滤、排序或修改未来推荐候选；
- 展示 `evidenceId`、`fieldPath`、`ruleId`、版本号、question ID、option code 或 localDraftId。

### 4.2 Suggested ViewModel shape

具体字段可以复用 Phase 3B 的 `ProfileDisplayRow`、`ProfileTagViewModel` 和
`ProfileClarificationViewModel`，但 V2 应使用 versioned adapter，不把 V2 字段全部塞入 V1 类型的
大量 optional 属性：

```ts
interface ProfilePageViewModelV2 {
  headline: string
  relationshipLine: string
  overviewTags: readonly ProfileTagViewModel[]
  basicRows: readonly ProfileDisplayRow[]
  healthRows: readonly ProfileDisplayRow[]
  nutritionRows: readonly ProfileDisplayRow[]
  dailyRows: readonly ProfileDisplayRow[]
  careModeTags: readonly ProfileTagViewModel[]
  cognitionRows: readonly ProfileDisplayRow[]
  specialCareTags: readonly ProfileTagViewModel[]
  preferenceRows: readonly ProfileDisplayRow[]
  financialRows: readonly ProfileDisplayRow[]
  budgetAdvisory?: ProfileAdvisoryViewModel
  clarifications: readonly ProfileClarificationViewModel[]
  actions: {
    canOpenRecommendation: boolean
    editTargets: Readonly<Record<ProfileEditSection, string>>
  }
}

interface ProfileAdvisoryViewModel {
  code: 'HIGH_CARE_LOW_BUDGET'
  text: string
  tone: 'warning'
}
```

这里的 `ProfileDisplayRow` 等是页面展示 primitive 的概念；若现有类型不能安全容纳 V2，应该新增
最小的 `profile-v2-view-model.ts` adapter，而不是改变 frozen V1 historical adapter。

## 5. V1.1 Profile Source Mapping

所有映射都是单向的 stable code -> label，不允许中文文案反向成为业务输入。

| 页面区域 | 唯一来源 | V2 展示规则 | 禁止 |
|---|---|---|---|
| 核心画像概览 | `preview.basic.rawFacts`、`preview.adl.derivedFacts.careLevel`、`preview.mobility.derivedFacts`、`userFacingSummary` | 关系、年龄、照护等级、行动方式按已有 Profile 语义展示 | 页面重算照护等级；把 careLevel 当医学或长护险等级 |
| 健康情况 | `preview.health.rawFacts`、`preview.health.derivedFacts` | 只展示已报告疾病、近期风险、康复状态 | 症状升级为诊断；把 unknown 当无 |
| 进食与饮食 | `preview.nutrition.rawFacts`、`preview.nutrition.derivedFacts`、对应 clarification | 作为独立“饮食提示/生活适配”区块；保留正常、易咀嚼、特殊处理、待确认 | `modified_food` 写成鼻饲；吞咽困难写成医学诊断或 tube feeding |
| 日常生活与照护 | `preview.adl.rawAnswers`、`adl.derivedFacts`、`mobility` | 保持七项 ADL、careLevel、mobility、careModes 分开展示 | 在页面生成 ADL score 或 classification |
| 认知与特殊护理 | `preview.cognition`、`preview.specialCare` | 已报告情况、走失/行为 clarification、明确护理需求分别表达 | 由单个症状推断认知症；把待确认能力显示为 required |
| 仍有信息需要确认 | `preview.clarifications` | 优先级只影响视觉层级；显示“需要补充/确认”，提供对应编辑入口 | 显示内部 ID；把 clarification 变成机构不适合结论 |
| 养老偏好 | `preview.preference.rawFacts` 与已保存的 region snapshot | 展示 care type、room、meal、activity、最多 3 项 V2 priorities、region | 读取当前目录重写 region；把 priority 当机构能力 |
| 预算与入住计划 | `financial.rawFacts`、`intent.rawFacts` | 保留预算、一次性费用接受度、入住时间、顾问意向 | 计算最终价格；触发登录/手机号 |
| 高照护低预算 | `financial.derivedFacts.budgetAdvisories` | `HIGH_CARE_LOW_BUDGET` 只显示一次、友好提醒 | 页面重新判断触发条件、补市场价格或改变照护结论 |

### 5.1 Nutrition wording table

| Stable code / state | 推荐中文 | 说明 |
|---|---|---|
| `chewingAbilityAnswer = normal` | 咀嚼情况正常 | 只描述本次回答 |
| `foodTextureSupport = easy_chew` | 更适合软食 / 易咀嚼食物 | 生活适配事实，不是护理等级 |
| `foodTextureSupport = modified_food` | 需要特殊处理的饮食形式 | 不等于鼻饲 |
| chewing `unknown` | 咀嚼情况仍需确认 | 绑定原始 clarification |
| swallowing `normal` | 吞咽情况正常 | 只描述本次回答 |
| swallowing `occasional_difficulty` / `significant_difficulty` | 吞咽情况需要进一步确认 | 不形成医学诊断，不生成 tube feeding |
| swallowing `unknown` | 吞咽情况仍需确认 | 保留 `required_before_hard_filter` 语义 |

只有 `specialCare.requiredCareCapabilities` 中明确的 `tube_feeding = required` 才能展示“鼻饲护理”。

### 5.2 V2 preference labels

`roomTypePreference`、`mealSchedulePreference`、`activityPreference` 和 12 项 V2 priorities 必须由
Assessment V2 的 stable code 表驱动。特别是 V2 priorities 只显示用户关注项，例如“您比较关注：价格、
康复能力、交通方便”，不显示成“机构在此项表现优秀”。未评分项仍可作为用户事实展示，不能进入
Profile 页面自己的评分。

## 6. Page State and Recovery

Profile 继续复用 Phase 3B 的四个页面状态，不为单个新字段新增状态：

| 状态 | 进入条件 | 用户表达 | 可用操作 |
|---|---|---|---|
| `loading` | onShow 正在读取/派生 | 正在整理本次评估 | 不显示旧 ViewModel；Back 仍可用 |
| `ready` | Snapshot 成功 | 展示 V2 画像 | 修改对应步骤、查看推荐 |
| `incomplete` | V2 required 未完成 | 请先补充/确认老人信息 | 回第一个缺失步骤；没有答案则回 Intro |
| `error` | Draft shape/schema/adapter 失败 | 当前评估暂时无法读取 | 回 Intro，走 Continue/Restart |

`ready` 之外不得显示旧 V1/V2 ViewModel，也不得创建 partial Profile。`onShow` 每次重新读取当前
Draft 并原子替换内存 Snapshot；不使用 Preview cache。

`required_before_hard_filter` 的 clarification 在 Profile 中只能表示“需要先补充/确认老人相关信息”，
不能提前说“机构都不符合”或“机构资料未核验”。

成功生成 `ready` Profile 时，`actions.canOpenRecommendation = true`；这包括存在
`required_before_hard_filter` clarification 的成功 Preview。CTA 不在 Profile 层重新判断 readiness，后续 Result
只消费 Recommendation V2 已返回的 blocked 语义并给出补充/确认入口。`incomplete` / `error` 时 CTA 为 false。

## 7. Interaction Preservation Matrix

V2 页面必须继续满足：

```text
1 physical tap -> 1 custom action -> 1 page handler -> at most 1 navigation
```

| Action | 初始条件 | 校验/副作用 | 导航 | 快速点击/失败 |
|---|---|---|---|---|
| Back | 所有状态可点击 | 不改 Draft，不清空 Snapshot | 栈返回；根栈 fallback Budget | 沿用已验证 Back 行为；fail 显示 inline feedback |
| 修改 Basic/Health/ADL/Cognitive/Preference/Budget | `ready` | 不改 Draft，不重算 | 回当前栈中的对应步骤；深链才 redirect | 同一 action pending 忽略后续；失败在本区块可见 |
| 画像确认后查看推荐 | `ready` | 不登录、不写回、不生成正式身份 | 打开 Recommendation Result V2 入口 | guard 最多一次；失败显示当前操作区提示 |
| incomplete recovery | `incomplete` | 不补答案、不生成 partial Profile | 第一个缺失步骤或 Intro | 最多一次导航；失败可重试 |
| onShow refresh | 页面生命周期 | 清旧快照，重新读取最新 Draft | 无 | 只采用当前最新结果 |

所有公共组件仍使用明确的 `action` / `back` / `next` custom event，显式 `bubbles: false`、
`composed: false`；NavigationGuard 只能作为第二层保护。

## 8. Phase 3B Preservation Matrix

| 处理 | 继续保留 | V2 最小调整 |
|---|---|---|
| KEEP | 页面纵向叙事、SectionCard、Tag、StatePanel、PageContainer、Less tokens、长页面留白、触控尺寸 | 无业务变化 |
| KEEP | Basic/Health/ADL/Cognitive/Preference/Budget 编辑入口与 Back/CTA 交互 | 只替换 data source，不改变交互语义 |
| KEEP | careLevel 与 mobility/careModes 分开；unknown/clarification 友好表达 | 增加 V2 nutrition、priority、advisory 的展示 primitive |
| ADAPT | `onShow -> derive -> ViewModel` | 改为 Application Snapshot V2 -> versioned VM adapter |
| ADAPT | 既有 section row/tag 类型 | 为 V2 增加 nutrition、V2 priority、budget advisory 字段；共享 primitive 不携带业务推导 |
| ADAPT | incomplete/error recovery | 映射 V2 stable error/questionIds，保留首缺步骤恢复 |
| REPLACE | Page 直接读 `assessmentDraftStore` 并调用 V1 `deriveElderProfilePreview` | 由 Profile application entry 读取并调用 V2 adapter；Page 只消费 snapshot/VM |
| REPLACE | V1-only `createProfilePageViewModel` 作为 live V2 source | 新增 V2 adapter；V1 adapter 继续服务历史记录 |
| REMOVE | 在页面、VM 或组件中复制 Domain derivation/priority/advisory 判断 | 不允许以“显示方便”为理由保留第二套规则 |
| REMOVE | V2 UI 依赖 Institution/Recommendation/raw catalog | Profile 阶段保持 `Institution dependency = 0` |

## 9. V1 / V2 UI Boundary

历史 V1 Assessment/Profile 结果必须继续由 V1 contract 和 V1 adapter 解释；V2 live path 使用 schema
dispatch：

```text
historical V1 -> V1 Profile adapter -> V1 ViewModel
live V2       -> V2 Preview application -> V2 ViewModel
```

不把 V1 ViewModel 改成含大量 optional V2 字段的联合对象，不把 V1 priority 迁移成 V2 priority，
不让 V2 Page 通过“缺字段就默认 V1”运行。Migration Contract 只负责 Draft schema migration，不能被
Profile Page 用来静默升级历史结果。

## 10. Approved Product Decisions

以下决策已由项目负责人批准，后续实现不得在 Page/ViewModel 中改写：

1. **Profile route（已批准）**：V2 live Profile 继续使用 `/pages/assessment/profile`，通过 schema
   dispatch 选择 V1/V2 adapter，而不是新增第二个公开页面路由。
2. **Nutrition section（已批准）**：在现有健康区块后增加“进食与饮食”紧凑区块；易咀嚼/特殊处理只作
   生活适配信息，吞咽风险始终显示“需要确认”。
3. **Budget advisory placement（已批准）**：Profile 的预算区块内显示一次友好提醒，Recommendation
   结果再独立显示一次；同一页面不重复渲染多个触发原因。
4. **Preview refresh（已批准）**：每次 `onShow` 重新派生，允许用户修改 Draft 后返回 Profile 立即看到
   最新结果，不引入本地 Preview persistence。
5. **Readiness CTA（已批准可用）**：Profile Preview 已成功时仍允许进入 Result；若存在
   `required_before_hard_filter`，由 Recommendation V2 返回 readiness blocked，并在 Result 提供“返回画像/修改需求”，
   不由 Profile 预演 Recommendation 结论。

## 11. Future Gate

本冻结契约仍不能证明 Profile V2 已实现。未来实现必须至少验证：

- V2 Preview runtime 与 Formal/Preview semantic parity 不被页面改写；
- 32/32 Assessment answer、26 required、V1 historical semantics 均保持；
- nutrition、priority、budget advisory 与 clarification 显示映射正确；
- no fake identity、no Preview persistence、no Institution/Recommendation dependency；
- Basic/Health/ADL/Cognitive/Assessment Interaction 回归、TypeScript、Less、JSON、WeChat targeted/JS compatibility；
- 微信开发者工具最新产物和可获得的 Android 真机证据按 `AUTOMATED`、`DEVTOOLS`、
  `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION` 分开记录。

## 12. Scope Declaration

```text
PROFILE_V2_UI_IMPLEMENTATION = NOT_STARTED
PROFILE_V2_APPLICATION_CONTRACT = FROZEN_PHASE_V1_1_F1
PRODUCTION_CODE_CHANGE = 0
INSTITUTION_DEPENDENCY = 0
RECOMMENDATION_DEPENDENCY = 0
PERSISTENCE = FORBIDDEN
```
