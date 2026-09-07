# Recommendation Contract V2

状态：`FROZEN_PHASE_V1_1_E`

Contract 版本：`recommendation-contract-v2`

Ruleset 版本：`recommendation-ruleset-v2`

Safety policy：`conservative-exact-with-conditional-v1`（保持不变）

冻结日期：`2026-09-08`

本文件冻结 `ElderProfileV2 + InstitutionRecordV11 -> Recommendation V2` 的公开边界。产品决策
`A1 / B2 / C1 / D1` 与 Institution V1.1 保守房型负面证据边界已经项目负责人批准；本 Contract 与
`RECOMMENDATION_RULE_CONTRACT_V2.md` 共同授权后续独立实现 Recommendation V2 runtime，但本阶段不实现
Engine、UI、Backend 或 persistence。

```text
RECOMMENDATION_V2_CONTRACT = FROZEN_PHASE_V1_1_E
RECOMMENDATION_RULESET_V2 = FROZEN_PHASE_V1_1_E
RECOMMENDATION_V2_IMPLEMENTATION_AUTHORIZED = TRUE
RECOMMENDATION_V2_ENGINE = NOT_IMPLEMENTED
RECOMMENDATION_RESULT_UI_CHANGE = 0
BACKEND_CHANGE = 0
PERSISTENCE_CHANGE = 0
```

## 1. Source of Truth and Scope

本 Contract 只组合以下已冻结输入：

1. `ASSESSMENT_CONTRACT_V2.md`；
2. `ELDER_PROFILE_CONTRACT_V2.md`；
3. `ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md`；
4. `INSTITUTION_CONTRACT_V1_1.md`；
5. `INSTITUTION_CAPABILITY_CONTRACT.md`；
6. `RECOMMENDATION_CONTRACT.md` 与 `RECOMMENDATION_RULE_CONTRACT.md` 的 V1 Safety Core；
7. `V1_1_CHANGE_IMPACT_ANALYSIS.md` 的 Phase V1.1-A final decision override；
8. 根目录 `AGENTS.md` 的真实数据、可解释、确定性、隐私与范围约束。

本阶段不得修改 Assessment、ADL、ElderProfile derivation、Institution V1/V1.1、Institution Capability V1、
Recommendation V1、安全政策、页面、服务接入、后端或持久化。本文若与这些 frozen Contract 冲突，以原
frozen Contract 为准并停止实现，而不是在 V2 中覆盖原语义。

## 2. V1 Preservation and Version Dispatch

V1 与 V2 必须并行存在，禁止静默升级或降级：

```text
ElderProfile / ElderProfilePreview V1
  + InstitutionRecord V1
  -> recommendation-contract-v1 / recommendation-ruleset-v1

ElderProfileV2 / ElderProfilePreviewV2
  + InstitutionRecordV11
  -> recommendation-contract-v2 / recommendation-ruleset-v2
```

- V1 evaluator 继续只接受 V1 Profile 与 V1 Institution；固定 117 fixtures 必须原样通过。
- V2 evaluator 拒绝 V1 Profile、V1 Institution、legacy DTO、raw Assessment/Draft 和 bare semantic payload。
- V1.1 extension fields 不得进入 V1 adapter、V1 priority vector、V1 exactness 或 V1 rank tuple。
- V2 不复用 `projectInstitutionRecordV11ToV1()` 作为完整输入；该投影只可为共享 Safety Core 提供已验证的
  V1 base fact view，V1.1 extension 仍由独立 V2 projection 消费。
- 不修改现有 `miniprogram/types/recommendation.ts` 或 `miniprogram/domain/recommendation/**` 的 V1 行为。

## 3. V2 Evaluation Input

冻结机器边界：

```ts
interface RecommendationVersionsV2 {
  recommendationContractVersion: 'recommendation-contract-v2'
  recommendationRulesetVersion: 'recommendation-ruleset-v2'
  policyVersion: 'conservative-exact-with-conditional-v1'
  elderProfileContractVersion: 'elder-profile-contract-v2'
  elderProfileDerivationRulesetVersion: 'elder-profile-ruleset-v2'
  adlRulesetVersion: 'adl-ruleset-v1'
  institutionContractVersion: 'institution-contract-v1.1'
  institutionCapabilityContractVersion: 'institution-capability-contract-v1'
}

interface RecommendationEvaluationInputV2<
  P extends ElderProfileV2 | ElderProfilePreviewV2
> {
  profile: P
  institutions: readonly InstitutionRecordV11[]
  datasetVersion: string
  datasetMode: 'PRODUCTION' | 'MOCK_DEVELOPMENT_ONLY'
  evaluationAsOf: string
  contractVersion: 'recommendation-contract-v2'
  rulesetVersion: 'recommendation-ruleset-v2'
  policyVersion: 'conservative-exact-with-conditional-v1'
}
```

调用方不能另传：预计算 tier、priority vector、effective capability、rank tuple、manifest、reason、difference
或 identity override。`evaluationAsOf` 必须是显式、合法、带时区的 ISO timestamp；Domain 不调用
`Date.now()` / `new Date()`。相同输入和同一 `evaluationAsOf` 必须 deep-equal。

## 4. V2 Adapter and Institution Validation Gate

顺序固定为：

```text
validate full Profile V2 envelope and evidence closure
  -> validate every InstitutionRecordV11
  -> enforce dataset mode / provenance / status
  -> project frozen V1 safety facts at explicit evaluationAsOf
  -> project approved V1.1 life-fit/display facts at the same evaluationAsOf
  -> build complete pool manifest
  -> shared V2 semantic core
```

安全默认是整池失败：任一记录 shape、版本、revision、evidence、重复 institutionId 或 field binding 非法时，
返回稳定 input error，不排除坏记录后悄悄改变候选池。`NO_EXACT_MATCH` 不是数据校验错误。

生产 dataset 仍只允许 `published + PRODUCTION_CANDIDATE`；开发 dataset 只允许显式
`MOCK_DEVELOPMENT_ONLY`。开发 synthetic verified evidence 仍必须携带既有 Mock/非真实说明；它不证明现实
武汉机构能力。

所有 Matching 或 display explanation 使用的机构值必须来自：

1. 同一条已通过 `validateInstitutionRecordV11()` 的记录；
2. 同一 `institutionId + recordRevision`；
3. 当前 `evaluationAsOf` 下仍有效的 verified field/evidence；
4. frozen field path 与 typed value snapshot。

`provided + unverified`、expired、field unknown/unavailable、value enum `unknown` 都不得生成正向 reason。
所有 V2 projection/evidence 必须保留上游 field availability；即使 comparator 同样得到 `unknown`，也不能把
`unavailable` 与 `unknown` 压平成同一个来源事实，更不能把 unknown 写成“不提供”。

## 5. Pool Manifest and Revision Provenance

V2 manifest 延续 V1 的完整池与稳定排序语义，并把被 V2 实际消费的 extension projection 加入审计快照：

- base Safety/预算/类型/区域/康复字段仍按原 22-field 顺序保存；
- extension 只允许保存最终 Contract 批准的 room、meal、nutrition 与 activity 字段；
- 每个 ref 带 `institutionId`、`recordRevision`、`fieldPath`、raw/effective snapshot、verification metadata、
  evidence IDs 与 `evaluationAsOf`；
- manifest entry 按 institutionId ASCII 排序；evidence 按 evidenceId ASCII 排序；
- included entry 与 `candidateEvaluations` 一一对应；excluded entry 不运行老人匹配；
- Service/Page 不允许先筛选、预排序或截断 top 3 后再送 Domain。

Manifest 只能证明“本次调用数组完整进入引擎”，不能证明覆盖武汉所有机构，也不能证明外部 provider 未遗漏
记录。只改变运营 availability 不得改变 Safety tier、life-fit 或 ranking。

## 6. Elder Snapshot and Readiness Boundary

V2 快照只包含 Recommendation 所需的已派生事实/原始偏好及其真实 evidence/clarification：

```text
adl / mobility / health / cognition / specialCare
nutrition.foodTextureSupport / nutrition.swallowingConcern
preference preferred type / room / meal / activity / V2 priorities / region
financial monthly budget / deposit tolerance / budget advisories
intent move-in / consultant intent
evidence / clarifications
```

排除姓名、basic 展示资料、完整 32 answers 与 userFacingSummary。Adapter 不读取 Draft、UI label 或原答案重新
推导 Profile。

V1 Safety readiness 的阻断规则与 Profile clarification priority 均不得放宽。Nutrition clarification 在
`ELDER_PROFILE_CONTRACT_V2.md` §12 已冻结为 `required_before_hard_filter`，并由
`ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md` §5–6 要求 Formal/Preview 语义一致。因此该边界是上游 frozen
事实，本层只继承，不重新定义。Chewing/swallowing unknown 或吞咽风险线索未
澄清时，V2 `elderReadiness` 必须保持 blocked、不得输出推荐卡。该阻断属于 Elder-side readiness，不得伪装成
机构 `UNVERIFIED`、护理 capability requirement 或 `tube_feeding`。Nutrition 机构事实即使 verified available
也不能绕过该阻断；未来若改变 clarification priority，必须先发布新的 ElderProfile ruleset，而不能由
Recommendation 层静默放宽。

```text
NUTRITION_READINESS_BOUNDARY = UPSTREAM_FROZEN_AND_INHERITED
```

## 7. Safety Core Preservation

Safety policy 版本和值逐字保持：

```text
conservative-exact-with-conditional-v1
CONSERVATIVE_EXACT_WITH_CONDITIONAL
```

所有 V1 care/cognition/special-care mapping 与矩阵原样复用：

| Elder requirement | current verified supported | requires_assessment | unsupported | unknown |
|---|---|---|---|---|
| required | satisfied | conditional | conflict | unverified |

Eligibility 仍为 `EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE`。任一 hard conflict 永远优先于
所有 room/meal/activity/nutrition/budget soft fact；`UNVERIFIED` 与 `INELIGIBLE` 永不进入默认 cards。

V2 新字段不得改变 care-level、wheelchair、bedbound、transfer、dementia acceptance、wandering support、
dementia unit 或九项 special care。`modified_food` 永不等于 `tube_feeding`；room/activity/hospital/meal 文本
不能证明护理能力。

## 8. V2 Semantic Result

V2 延续 V1 的结果层次：versions、policy、显式时间、dataset/manifest、elder snapshot/readiness、完整
candidate evaluations、cards、conditional candidates、exact flag 与 `NO_EXACT_MATCH`。新增内容只包括：

- structured `roomFit`、`mealScheduleFit`；
- rank-neutral、Exact-neutral 的 activity display facts，`activityFit.rankParticipation = not_scorable`；
- 12 项 V2 priority result 与明确 rank participation；
- V2 reason/difference code；
- rank-neutral nutrition explanation；
- rank-neutral `HIGH_CARE_LOW_BUDGET` result-level advisory。

Cards 仍是 `MAX_3`，不是 always 3；Engine 必须先评估完整池，再按最高可展示 tier 取最多 3 条。不得输出
全局分数、匹配百分比、隐藏权重或用低 tier 补足三张。

## 9. Evidence, Reasons and Differences

每个 V2 reason/difference 必须由 stable code 驱动；文案不是 truth source。需要机构事实时，必须带 current
verified institution ref；需要老人事实时，必须带对应 V2 Profile raw/derived evidence ref。不得通过机构
名称、描述、图片、Mock label 或自由文本造 reason。

候选级新增 reason codes：

```text
ROOM_TYPE_MATCH
MEAL_SCHEDULE_MATCH
EASY_CHEW_SUPPORT
MODIFIED_FOOD_SUPPORT
```

候选级新增 difference codes：

```text
ROOM_TYPE_MISMATCH            # 类型前向兼容；institution-contract-v1.1 下不可产生
ROOM_TYPE_UNKNOWN
MEAL_SCHEDULE_MISMATCH
MEAL_SCHEDULE_DATA_UNAVAILABLE
MEAL_SCHEDULE_UNKNOWN
EASY_CHEW_SUPPORT_UNAVAILABLE
EASY_CHEW_SUPPORT_REQUIRES_INQUIRY
EASY_CHEW_SUPPORT_UNKNOWN
MODIFIED_FOOD_SUPPORT_UNAVAILABLE
MODIFIED_FOOD_SUPPORT_REQUIRES_INQUIRY
MODIFIED_FOOD_SUPPORT_UNKNOWN
```

`ACTIVITY_SPACE_MATCH / ACTIVITY_SPACE_MISMATCH / ACTIVITY_SPACE_UNKNOWN` 保留为未来 Contract 的 stable
code reservation，但在 `recommendation-ruleset-v2` 中均为 `INACTIVE_IN_RULESET_V2`，不得由 Engine 输出，
也不得作为 ranking reason。Activity 只允许以 current verified indoor/outdoor facts 形成 rank-neutral 展示信息。

room/meal mismatch 属于 `SOFT_DIFFERENCE`；unknown 属于 soft-data `UNVERIFIED_DATA_GAP`，不能与 Safety
`UNVERIFIED` 混淆。Meal field `availability=unavailable` 虽按批准 comparator 得到 `fit=unknown`，但必须输出
`MEAL_SCHEDULE_DATA_UNAVAILABLE` 并保留原始 availability；真正 unknown/other/unverified/expired 才输出
`MEAL_SCHEDULE_UNKNOWN`。两者都按 D1 降级 Exact，且都不冒充已知 mismatch。Nutrition unavailable/unknown
只作 display difference/gap，不改变 Exact、tier 或 rank。

## 10. Budget Advisory Consumption

`financial.derivedFacts.budgetAdvisories` 中的 `HIGH_CARE_LOW_BUDGET` 只复制为 result-level
Recommendation advisory，保留全部 Elder evidence：

```text
code = HIGH_CARE_LOW_BUDGET
role = advisory_only
rankParticipation = not_applicable
institutionEvidenceRefs = []
```

它不逐机构复制成能力差异，不重新计算 high care，不改变 eligibility/exactness/rank，不提高 price penalty，
不生成最低建议预算或市场价格结论。

## 11. Formal and Anonymous V2 Boundary

Formal V2 只复制合法 `ElderProfileV2.identity`；它不生成 Recommendation ID，也不冒充服务端 ownership
verification。未来正式持久化与授权属于 Backend 阶段。

Anonymous V2 只允许：

```text
ElderProfilePreviewV2
  + validated full InstitutionRecordV11 pool
  + explicit evaluationAsOf
  -> RecommendationPreviewV2
```

`RecommendationPreviewV2` 复制真实 `source.localDraftId` 和 V2 versions，禁止：

```text
assessmentId / elderId / recommendationId / generatedAt / completedAt / previewId
```

Formal 与 Preview 必须调用唯一 V2 semantic core；相同 semantic payload 与 catalog/time 得到 deep-equal
semantics。Preview persistence、Recommendation Store、写回 Draft、localStorage 与历史记录继续禁止。

## 12. Stable Input Errors

V2 runtime 必须实现以下稳定 error family；具体 TypeScript declaration 只能按这些 code 收口：

```text
UNSUPPORTED_RECOMMENDATION_CONTRACT
UNSUPPORTED_RECOMMENDATION_RULESET
UNSUPPORTED_PROFILE_VERSION
UNSUPPORTED_INSTITUTION_VERSION
INVALID_EVALUATION_AS_OF
INVALID_PROFILE_SNAPSHOT
INVALID_PROFILE_EVIDENCE
INVALID_PROFILE_CLARIFICATION
INVALID_INSTITUTION_RECORD
DUPLICATE_INSTITUTION_ID
INVALID_DATASET_MODE_OR_PROVENANCE
INVALID_ROOM_MATCHING_INPUT
```

错误只返回 stable code 与最小 paths；不返回完整健康答案、Profile dump、机构内部来源说明或 Secret。

## 13. Freeze Status and Implementation Boundary

产品决策与 Contract Freeze Gate 已关闭：

```text
MEAL_SCHEDULE_COMPARATOR = EXACT_STABLE_CODE_ONLY
ACTIVITY_MATCHING_ROLE = DISPLAY_ONLY_NOT_SCORABLE
RANK_TUPLE_POLICY = PRESERVE_ESTABLISHED_FACTORS_FIRST
STRUCTURED_UNKNOWN_EXACT_POLICY = UNKNOWN_DOWNGRADES_EXACT_TO_SOFT_NEAR
ROOM_NEGATIVE_EVIDENCE_POLICY = CONSERVATIVE_CURRENT_INSTITUTION_V1_1
```

后续可以独立创建 V2 types/domain/runtime fixtures，但必须遵守本 Contract，并通过 runtime/permutation、
Formal/Preview parity、V1-117、Institution/ElderProfile regression、WeChat targeted compatibility 与独立 QA。
文档批准不能替代运行证据，也不授权本阶段进入 Recommendation Result UI、Application integration、Backend
或 persistence。
