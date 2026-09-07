# ElderProfile Domain Contract V2

状态：`FROZEN_PHASE_V1_1_C`

Contract 版本：`elder-profile-contract-v2`

Derivation ruleset：`elder-profile-ruleset-v2`

ADL ruleset：`adl-ruleset-v1`

Assessment schema：`assessment-schema-v2`

提案日期：`2026-09-07`

本文件定义 `CompletedAssessmentV2 -> ElderProfileV2` 的纯领域语义。它与
`ELDER_PROFILE_CONTRACT.md` 的 V1 历史链路并存，不修改 V1 Assessment、V1 ElderProfile、
ADL、Institution、Recommendation、页面、后端或持久化语义。

```text
ELDER_PROFILE_V2_CONTRACT = FROZEN_PHASE_V1_1_C
ELDER_PROFILE_RULESET_V2 = FROZEN_PHASE_V1_1_C
ELDER_PROFILE_V2_RULESET = elder-profile-ruleset-v2
ADL_RULESET = adl-ruleset-v1
INSTITUTION_DEPENDENCY = 0
RECOMMENDATION_DEPENDENCY = 0
```

## 1. Source of Truth

1. `ASSESSMENT_CONTRACT_V2.md`；
2. `ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md`；
3. `V1_1_CHANGE_IMPACT_ANALYSIS.md` 的 Phase V1.1-A final decision override；
4. `ELDER_PROFILE_CONTRACT.md`、`ADL_RULE_CONTRACT.md` 与
   `ANONYMOUS_PROFILE_PREVIEW_CONTRACT.md` 的 frozen V1 语义；
5. 两份 V1.1 产品 PDF；
6. 根目录 `AGENTS.md` 的真实数据、隐私、确定性和微信真机兼容规则。

若早期 proposal code 与 Assessment V2 冲突，以 frozen Assessment V2 为准。V2 derivation 不得
补默认答案、读取 UI 文案、把 unknown 压成 false，或把任何生活偏好升级为护理安全事实。

## 2. Version Dispatch and Historical Preservation

```text
CompletedAssessmentV1 -> ElderProfile V1 / elder-profile-ruleset-v1
CompletedAssessmentV2 -> ElderProfileV2 / elder-profile-ruleset-v2
```

- V2 formal adapter 只接受 `schemaVersion = 2`；Schema 1 返回
  `UNSUPPORTED_ASSESSMENT_SCHEMA`。
- V1 adapter 继续只接受 Schema 1，V1 45-case runtime 必须原样通过。
- V2 不把 V1 historical record 升级、迁移、补题或重新解释。
- `elder-profile-ruleset-v2` 只拥有 nutrition、V2 preference provenance、V2 summary 和 budget
  advisory 新规则。既有 ADL 规则 ID 继续属于 `adl-ruleset-v1`；既有 mobility、rehabilitation、
  cognition 与 special-care 证据继续保留其 frozen V1 rule ID，不机械改名。

## 3. Input Gate and Stable Errors

成功输入必须同时满足：

- `kind = completed_assessment`、`status = completed`、`schemaVersion = 2`；
- `id`、`elderId` 为非空字符串；
- `completedAt` 通过 Assessment V2 的 deterministic ISO 8601 timestamp validator；
- 26 个 required question 完整合法；
- 已存在 optional/conditional answer 合法且条件有效；
- 不含 32 个 frozen question ID 之外的 key。

稳定 error code：

| code | meaning |
|---|---|
| `NOT_COMPLETED_ASSESSMENT` | 非完成态 envelope 或正式 identity 无效 |
| `UNSUPPORTED_ASSESSMENT_SCHEMA` | schema 不是 2 |
| `INVALID_COMPLETED_AT_TIMESTAMP` | completedAt 不是合法带时区 ISO timestamp |
| `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | required answer 缺失 |
| `INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE` | answer、未知 key 或条件关系非法 |

失败不返回 partial profile；error 不包含完整健康答案或 Profile dump。

## 4. Identity and Semantic Core

正式 identity 固定为：

```ts
interface ElderProfileIdentityV2 {
  elderId: string
  assessmentId: string
  assessmentSchemaVersion: 2
  assessmentCompletedAt: string
  profileContractVersion: 'elder-profile-contract-v2'
  derivationRulesetVersion: 'elder-profile-ruleset-v2'
}
```

唯一 V2 identity-free semantic core：

```text
deriveProfileSemanticsV2(AssessmentAnswerSnapshotV2)
  -> ElderProfileSemanticPayloadV2
```

Formal 与 Preview adapter 必须调用同一个 core。Core 不接收 identity，不读当前时间，不访问
Store/Page/Service/Institution/Recommendation，也不产生 UUID、profileId 或 generatedAt。

## 5. Raw Facts: 32/32

V1 已有 27 个 question 的 raw mapping 保持同一 stable code 与结构；V2 将原
`preference.priorities` 位置改为 V2 code set，并增加：

| Assessment V2 question | ElderProfileV2 target |
|---|---|
| `health.chewingAbility` | `nutrition.rawFacts.chewingAbilityAnswer` |
| `health.swallowingAbility` | `nutrition.rawFacts.swallowingAbilityAnswer` |
| `preference.roomType` | `preference.rawFacts.roomTypePreference` |
| `preference.mealSchedule` | `preference.rawFacts.mealSchedulePreference` |
| `preference.activityPreference` | `preference.rawFacts.activityPreference` |
| `preference.priorities` | `preference.rawFacts.priorities`，仅 V2 12-code set |

`preference.region` 继续原样复制 `kind / regionCode / regionLabelSnapshot / catalogVersion`，不读取
当前 catalog 重写 snapshot。所有数组创建独立快照；输出不得与输入共享可变引用。

## 6. Semantic Payload

V2 payload 固定包含：

```text
basic
health
nutrition
adl
mobility
cognition
specialCare
preference
financial
intent
userFacingSummary
evidence
clarifications
```

`basic / health / adl / mobility / cognition / specialCare / financial.rawFacts / intent` 的既有事实和
派生含义与 V1 相同。新增语义只允许位于本文件明确列出的 V2 section。

## 7. Nutrition Model

```ts
nutrition.rawFacts = {
  chewingAbilityAnswer: ChewingAbility
  swallowingAbilityAnswer: SwallowingAbility
}

nutrition.derivedFacts = {
  foodTextureSupport: DerivedFact<'standard' | 'easy_chew' | 'modified_food'>
  swallowingConcern: DerivedFact<'normal' | 'occasional_difficulty' | 'significant_difficulty'>
}
```

### 7.1 Chewing

| raw answer | foodTextureSupport | clarification |
|---|---|---|
| `normal` | known `standard` / high | none |
| `easy_chew` | known `easy_chew` / high | none |
| `modified_food` | known `modified_food` / high | none |
| `unknown` | unknown / needs_confirmation | `cl:unknown_answer:health.chewingAbility` |

Chewing 不进入 ADL contribution，不提高 careLevel，不生成任何 special-care capability。
`modified_food` 永不等于 `tube_feeding`。

### 7.2 Swallowing

| raw answer | swallowingConcern | clarification |
|---|---|---|
| `normal` | known `normal` / high | none |
| `occasional_difficulty` | needs_confirmation，candidate 同 code | `cl:risk_signal_needs_confirmation:nutrition.swallowingConcern` |
| `significant_difficulty` | needs_confirmation，candidate 同 code | 同一 deterministic field ID |
| `unknown` | unknown / needs_confirmation | `cl:unknown_answer:health.swallowingAbility` |

以上都不改变 ADL/careLevel。只有 `cognitive.specialCareNeeds` 明确包含 `tube_feeding`，
`specialCare.requiredCareCapabilities.tube_feeding` 才能为 `required`。吞咽答案不能作为 direct
requirement，也不能把 ADL `special_feeding` 的 clue 升格。

```text
MEAL_TEXTURE_MATCHING_ROLE = DISPLAY_EXPLAINABLE_V1_1
SWALLOWING_HARD_FILTER = NOT_IMPLEMENTED_V1_1
```

## 8. ADL Freeze

- 七个 input ID/code 与 Proposal C 顺序不变；
- V2 直接复用 `classifyAdl` 与 `adl-ruleset-v1`；
- 同一七项 ADL answers 在 V1/V2 的 `rawAnswers`、`careLevel`、`careModes`、
  `observationCoverage`、`unknownQuestionIds` 必须 deep-equal；
- nutrition、preference 和 budget advisory 不得进入 ADL ordinal；
- `special_feeding` / `catheter_or_stoma` / `no_stairs` 的 V1 边界不变。

## 9. Preference V2

`preference.rawFacts` 保存：

```text
preferredInstitutionType
roomTypePreference
mealSchedulePreference
activityPreference
priorities (1-3 V2 stable codes)
regionPreference? (existing dynamic snapshot)
```

room、meal、activity 和 priorities 均有基于真实 Assessment option 的稳定 evidence。V2 priority
只保存用户关注事实；不得评分、排序、生成 Institution capability 或转换回 V1 priority。以下 12 项
完整保留用户选择：

```text
care_capability
caregiver_quality
medical_conditions
rehabilitation_capability
food_quality
living_environment
room_facilities
activity_space
transportation
near_major_hospital
price
region
```

`roomType` 不是护理硬条件。`transportation` 与 `near_major_hospital` 继续
`NOT_YET_SCORABLE_V1_1`。Meal texture 只是可解释生活适配事实，不新增 frozen 九项护理 capability。

## 10. High-care + Low-budget Advisory

LOW_BUDGET 只有：

```text
budget.monthlyRange === cny_3500_5000
```

HIGH_CARE 只有以下已派生、已确认事实：

```text
careLevel known disabled
careLevel known severely_disabled
specialCare round_the_clock_care required
specialCare one_to_one_caregiver required
specialCare tube_feeding required
specialCare pressure_injury_care required
```

二者同时成立时，`financial.derivedFacts.budgetAdvisories` 产生唯一项目：

```text
code = HIGH_CARE_LOW_BUDGET
role = advisory_only
status = present
```

该 advisory：

- 不改变 Assessment completion、ADL、careLevel、special-care requirement、eligibility、hard
  conflict 或 ranking；
- 不包含市场最低价或建议预算数字；
- budget `unknown` 不触发；低预算+低照护或高照护+其他预算不触发；
- 保存固定顺序 `triggerCodes` 与 `triggerEvidenceIds`；
- evidence 同时包含 `budget.monthlyRange=cny_3500_5000` 及每个触发 careLevel/special-care
  evidence 的真实 sources；多个触发原因不得丢失。

## 11. Evidence

继续使用 frozen `assessment_option` / `assessment_answer_set` source 模型：

- source 只引用 Schema 2 的真实 question ID、option code 或完整 answer set；
- 不引用 UI label；
- V1 未改变语义的 derived evidence 与 rule ID 原样保留；
- 新 evidence ID 固定为 `ev:<derivedField>`；
- nutrition rule 为 `NUTRITION_FOOD_TEXTURE` / `NUTRITION_SWALLOWING_CONCERN`；
- preference provenance rule 为 `PREFERENCE_FACT`；
- budget rule 为 `HIGH_CARE_LOW_BUDGET_ADVISORY`；
- 每个新增重要 field 最多且正好一条 final evidence。

## 12. Clarifications

V1 clarification 保留，V2 至少新增/覆盖：

| condition | deterministic ID | priority |
|---|---|---|
| chewing unknown | `cl:unknown_answer:health.chewingAbility` | `required_before_hard_filter` |
| swallowing unknown | `cl:unknown_answer:health.swallowingAbility` | `required_before_hard_filter` |
| occasional/significant swallowing | `cl:risk_signal_needs_confirmation:nutrition.swallowingConcern` | `required_before_hard_filter` |

既有 `other_without_detail`、ADL nonordinal、cross-answer conflict 和 care clue clarifications 保持。
Clarification 只是待确认语义，不触发登录、手机号、顾问或网络。

## 13. User-facing Summary Input V2

`summarySchemaVersion = elder-profile-summary-input-v2`。固定 section 顺序：

```text
basic -> health -> nutrition -> adl -> mobility -> cognition
-> special_care -> preference -> financial_intent
```

新增 stable summary code：

```text
nutrition.chewing_ability
nutrition.swallowing_ability
nutrition.food_texture_support
nutrition.swallowing_concern
preference.room_type
preference.meal_schedule
preference.activity_preference
financial.budget_advisory.high_care_low_budget
```

`preference.priorities` 在 V2 summary 只指向 V2 answer。Summary 是 presentation input，不得反向
解析成为业务事实、护理结论或 Recommendation input。

## 14. Determinism, Privacy and Dependencies

相同合法 input 重复运行必须 deep-equal，固定输出顺序包括 evidence、clarification、priority、
capability、advisory triggers 与 summary。生产 domain 禁止：

```text
wx.* / Store / storage / Page / Component / Service
Date.now / new Date / Math.random / UUID / crypto
Institution / Recommendation / Ranking / LLM
完整 Assessment/Profile console logging
```

Preview persistence、formal persistence、server identity creation 都不在本阶段。

## 15. Required Runtime Evidence

- `PROFILE-V2-001..018` 全部 PASS；
- 至少五组 Formal V2 / Preview V2 semantic deep equality；
- V1 ElderProfile 45 cases 与 V1 Preview 20 cases 全部 PASS；
- Proposal C 全部 ADL cases 跨 V1/V2 parity；
- V1/V2 schema rejection、no fake identity、no persistence、no Institution/Recommendation dependency；
- Assessment V1/V2、migration、interaction 与现有 Institution/Recommendation/UI regression；
- TypeScript 5.9 与微信 TypeScript 4.1.2 targeted compatibility。

上述证据和独立 QA 通过后，状态才可更新为 `FROZEN_PHASE_V1_1_C`。
