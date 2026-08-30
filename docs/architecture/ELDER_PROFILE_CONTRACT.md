# ElderProfile Domain Contract

状态：`FROZEN_PHASE_3A_2`

Contract 版本：`elder-profile-contract-v1`

Derivation ruleset：`elder-profile-ruleset-v1`

ADL ruleset：`adl-ruleset-v1`

本文件冻结 `CompletedAssessment → ElderProfile` 的 V1 领域语义。它授权纯、确定性的领域推导，但不授权 Profile UI、机构能力、推荐、后端或持久化实现。

## 1. Purpose and Boundary

```text
CompletedAssessment
        ↓ pure deterministic derivation
ElderProfile
        ↓ future matching input (not implemented here)
Recommendation
```

`ElderProfile` 保存：

- 当次 Completed Assessment 的 27/27 字段映射；
- 版本化的 ADL、行动能力、康复、认知风险和特殊护理派生事实；
- 每个重要派生事实的 evidence；
- unknown、other、非序数答案、跨题冲突和风险线索的 clarification；
- 仅含稳定 code 与来源的展示摘要输入。

它不得读取 Page、Component、Store、`wx.*`、登录态、当前时间、网络、机构目录、Recommendation 或 LLM。

生产模块固定在：

```text
miniprogram/domain/elder-profile/
```

这是最小 pure domain module，不是通用表单或规则框架。

该目录尚未接入 Page 时，必须运行 `npm run check:wechat-ts-targeted-compat`：使用微信开发者工具当前内置 TypeScript 对领域入口做完整 diagnostics 与内存 emit，并检查输出没有 class-field、外部 runtime import 或新增 polyfill 假设。不得为了生成普通 DevTools 产物把领域模块临时接入生产页面。

## 2. Source of Truth

1. `docs/architecture/ASSESSMENT_CONTRACT.md`：question ID、stable option code、required/optional、none/unknown、Completed Assessment；
2. `docs/architecture/ADL_RULE_CONTRACT.md`：已批准 Proposal C 的正式 V1 规则；
3. `miniprogram/types/assessment.ts` 与 `miniprogram/types/elder-profile.ts`；
4. 两份正式 PRD；
5. 根目录 `AGENTS.md` 的 deterministic、真实数据、医学边界和历史不可覆盖约束。

本文不修改冻结 Assessment Contract。发生不一致时必须停止推导，不得在 Profile 层补问卷默认值。

## 3. Input Gate and Error Contract

唯一可成功推导的输入必须同时满足：

- `kind = completed_assessment`；
- `status = completed`；
- `schemaVersion = 1`；
- `id` 与 `elderId` 为非空字符串；
- `completedAt` 是带时区的、日历值有效的 ISO 8601 timestamp：`YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)`；
- 21 个 required question 全部存在并通过 `isValidAnswerForQuestion`；
- optional question 存在时也必须合法；
- 不包含 27 个冻结 question ID 之外的 answer key；
- `basic.hasInstitutionExperience !== true` 时不得残留 `basic.institutionExitReasons`。

拒绝结果使用：

| error code | 语义 |
|---|---|
| `NOT_COMPLETED_ASSESSMENT` | Draft、错误 kind/status、非对象输入，或缺少有效 `id` / `elderId` |
| `UNSUPPORTED_ASSESSMENT_SCHEMA` | schema 不是冻结版本 1 |
| `INVALID_COMPLETED_AT_TIMESTAMP` | `completedAt` 为空、格式错误、日期/时间不可能，或缺少合法时区 |
| `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | required key 缺失 |
| `INVALID_ASSESSMENT_ANSWER_NOT_DERIVABLE` | 已存在答案、optional 条件或 answer key 非法 |

拒绝时不创建部分 ElderProfile。ADL classifier 对非法 ADL 值使用 `INVALID_ADL_ANSWER_NOT_DERIVABLE`，对缺 key 使用完全相同的 `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE`。

## 4. Identity and Deterministic Versions

`identity` 固定包含：

| 字段 | 值 |
|---|---|
| `elderId` | `CompletedAssessment.elderId` |
| `assessmentId` | `CompletedAssessment.id` |
| `assessmentSchemaVersion` | `CompletedAssessment.schemaVersion` |
| `assessmentCompletedAt` | 通过 ISO 8601 timestamp gate 后原样复制 `CompletedAssessment.completedAt` |
| `profileContractVersion` | `elder-profile-contract-v1` |
| `derivationRulesetVersion` | `elder-profile-ruleset-v1` |

ADL derived facts 另保存 `rulesetVersion = adl-ruleset-v1`。

核心语义唯一键为：

```text
(assessmentId, profileContractVersion, derivationRulesetVersion)
```

核心结果不生成 `profileId`、`generatedAt`、随机 UUID 或当前时间。重新评估必须形成新 Assessment 和新 Profile，不覆盖历史结果。

## 5. Raw Facts: 27/27 Mapping

所有值逐值复制 stable code；数组保留当次快照顺序；optional key 不存在时继续 absent。

| # | Assessment question | ElderProfile target | 策略 |
|---:|---|---|---|
| 1 | `basic.relationship` | `basic.rawFacts.relation` | required copy |
| 2 | `basic.elderName` | `basic.rawFacts.name` | optional copy/absent |
| 3 | `basic.gender` | `basic.rawFacts.sex` | required copy |
| 4 | `basic.age` | `basic.rawFacts.age` | required copy |
| 5 | `basic.livingStatus` | `basic.rawFacts.livingStatus` | optional copy/absent |
| 6 | `basic.primaryCaregiver` | `basic.rawFacts.primaryCaregiver` | optional copy/absent |
| 7 | `basic.hasInstitutionExperience` | `basic.rawFacts.hasInstitutionExperience` | optional copy/absent |
| 8 | `basic.institutionExitReasons` | `basic.rawFacts.institutionExitReasons` | conditional optional copy/absent |
| 9 | `health.conditions` | `health.rawFacts.reportedDiseases` | required exact array |
| 10 | `health.recentEvents` | `health.rawFacts.recentHealthRisks` | required exact array |
| 11 | `health.rehabilitationNeed` | `health.rawFacts.rehabilitationNeedAnswer` | required copy |
| 12 | `adl.eating` | `adl.rawAnswers.eating` | required copy |
| 13 | `adl.mobility` | `adl.rawAnswers.mobility` | required copy |
| 14 | `adl.toileting` | `adl.rawAnswers.toileting` | required copy |
| 15 | `adl.bathing` | `adl.rawAnswers.bathing` | required copy |
| 16 | `adl.dressing` | `adl.rawAnswers.dressing` | required copy |
| 17 | `adl.transfer` | `adl.rawAnswers.transfer` | required copy |
| 18 | `adl.stairs` | `adl.rawAnswers.stairs` | required copy |
| 19 | `cognitive.symptoms` | `cognition.rawFacts.reportedSymptoms` | required exact array |
| 20 | `cognitive.specialCareNeeds` | `specialCare.rawFacts.answers` | required exact array |
| 21 | `preference.careType` | `preference.rawFacts.preferredInstitutionType` | required copy |
| 22 | `preference.priorities` | `preference.rawFacts.priorities` | required exact array |
| 23 | `preference.region` | `preference.rawFacts.regionPreference` | optional snapshot copy/absent |
| 24 | `budget.monthlyRange` | `financial.rawFacts.monthlyBudget` | required copy |
| 25 | `budget.upfrontCostAcceptance` | `financial.rawFacts.depositTolerance` | required copy |
| 26 | `budget.moveInTiming` | `intent.rawFacts.moveInTiming` | required copy |
| 27 | `budget.consultantSupport` | `intent.rawFacts.consultantIntent` | required copy |

禁止翻译 label 作为业务值，禁止读取今天的区域目录重写 `regionCode`、`regionLabelSnapshot` 或 `catalogVersion`。`request_contact` 只是一项意愿事实，不触发登录、手机号、网络或顾问任务。

## 6. ADL Derived Facts

ADL 使用 `ADL_RULE_CONTRACT.md` 中冻结的 Proposal C：功能轴与 care mode 轴并行。输出：

- `careLevel`；
- `careModes`；
- `observationCoverage`；
- `unknownQuestionIds`；
- evidence；
- clarifications。

care level 只允许 `independent | light_care | semi_disabled | disabled | severely_disabled`。它不得吞掉 careModes，也不得成为疾病、机构接收能力或护理资格证明。

任一 ADL `unknown`：

- `careLevel.status = unknown`；
- `confidence = needs_confirmation`；
- 不得提供 candidateValue；
- 已知 raw facts/careModes 保留；
- 每个 unknown 生成 clarification。

`special_feeding`、`catheter_or_stoma`、`no_stairs` 均不参与等级贡献；前两者生成 needs-confirmation care mode，后者生成 context care mode。三者使 coverage limited、careLevel confidence medium；具体中文模板留到 Profile UI 阶段。

## 7. Mobility and Rehabilitation

### 7.1 Mobility

| `adl.mobility` | `mobility.level` |
|---|---|
| `independent` | known `independent` |
| `walking_aid` | known `walking_aid` |
| `wheelchair` | known `wheelchair` |
| `bedridden` | known `bedbound` |
| `unknown` | unknown，无 value |

Mobility 只直接读取 raw mobility，不从 careLevel 反推。

### 7.2 Rehabilitation

基础映射：`definite → required`、`possible → possible`、`none → not_required`、`unknown → unknown`。

若 `cognitive.specialCareNeeds` 明确包含 `rehabilitation_training`：

- health 为 `definite` 或 `possible`：derived rehabilitation 为 known `required`；明确专项需求优先，保留双方 evidence；
- health 为 `none` 或 `unknown`：derived rehabilitation 为 `needs_confirmation`，candidate 可为 `required`，生成 `cross_answer_conflict`；不得静默覆盖。

Special-care capability 的 `rehabilitation_training` 仍为 `required`，因为用户直接选择了该能力；冲突只阻止把跨题总体康复事实伪装成无歧义。

## 8. Cognition and Risk Semantics

### 8.1 Direct semantics

- `memory_decline`、`repetitive_questioning`、`gets_lost`、`wandering_risk`、`diagnosed_dementia`、health 中 `alzheimers_disease` / `other_cognitive_impairment` 支持 `cognitiveConcern=present`。
- `[none]` 且 health 无认知线索/unknown 时支持 `cognitiveConcern=absent`。
- health conditions 已明确回答且不含认知线索时，只有睡眠、情绪或行为 signal 的 `cognitiveConcern` 为 `not_reported`，不能升级为认知症；health `[unknown]` 时改按 §8.2 的 unknown 优先级。
- 只有 `diagnosed_dementia` 或 health `alzheimers_disease` 支持 `reportedDiagnosis=reported`；`reported` 仅表示用户报告，不是系统诊断。
- `wandering_risk → present`；只有 `gets_lost → needs_confirmation`。
- `aggression` / `agitation → behavioralRisk=present`；只有 `mood_instability → needs_confirmation`。
- `sleep_wake_disorder → sleepCycleIssue=present`。

### 8.2 Unknown and conflicts

- `cognitive.symptoms=[unknown]` 时，wandering/behavior/sleep 为 unknown；若 health 有明确认知线索，cognitiveConcern 仍可由该直接事实支持 present；否则 cognitiveConcern unknown。
- health `[unknown]` 且 cognitive 没有明确认知/诊断 signal 时，cognitiveConcern 与 reportedDiagnosis 为 unknown；不得用“未选择”压成 false。
- 任一直接报告 `diagnosed_dementia` 或 `alzheimers_disease` 时，reportedDiagnosis 可保持 known `reported`，即使另一题 unknown。
- health 报告 Alzheimer/other cognitive impairment 但 cognitive `[none]` 时，cognitiveConcern 为 `needs_confirmation` 并生成跨题冲突；Alzheimer 的 reportedDiagnosis 仍为 known `reported`。
- 明确认知 signal 与 `[none]` 不会同时存在于同一合法 multi-choice answer；非法互斥集合在 Input Gate 拒绝。

症状不得推导 Alzheimer，`other_cognitive_impairment` 不得被具体化为某种诊断。

## 9. Special-care Capability Requirements

V1 固定、按此顺序输出九项：

```text
round_the_clock_care
one_to_one_caregiver
night_care
dementia_unit
rehabilitation_training
tube_feeding
catheter_care
pressure_injury_care
incontinence_care
```

基础规则：

1. special-care 明确选择同 code → `required`；
2. `[none]` 且无跨题线索 → `not_required`；
3. `[unknown]` → `unknown`；即使存在 clue 也保持 unknown，并把 clue 加入 clarification；
4. 具体 answer set 中未选择且无 clue → `not_reported`，必须使用完整 answer-set evidence；
5. `other` 保留在 raw facts，并生成 `other_without_detail`；不创建新 capability；
6. direct requirement 永远优先于 clue；clue 不能把 required 降级。

只允许下列 observation → needs-confirmation 线索：

| 线索 | capability | 结果（无 direct requirement 时） |
|---|---|---|
| `sleep_wake_disorder` | `night_care` | `needs_confirmation` |
| raw `diagnosed_dementia` / `wandering_risk` / `gets_lost`，或 health `alzheimers_disease` / `other_cognitive_impairment` | `dementia_unit` | `needs_confirmation` |
| health rehab `definite` / `possible` | `rehabilitation_training` | `needs_confirmation` |
| ADL `special_feeding` | `tube_feeding` | `needs_confirmation` |
| ADL `catheter_or_stoma` | `catheter_care` | `needs_confirmation` |
| health `pressure_injury` | `pressure_injury_care` | `needs_confirmation` |
| ADL `frequent_incontinence` | `incontinence_care` | `needs_confirmation` |

`round_the_clock_care` 与 `one_to_one_caregiver` 只能来自直接选择。careLevel、卧床、年龄或独居不得自动生成这两项。认知症/走失也不得自动把 dementia unit 设为 required。Capability clue 只读取上表列出的 raw stable code；derived cognition 的 `unknown` / `needs_confirmation` 状态本身不是 clue。

`special_feeding` 不等于 tube feeding；`catheter_or_stoma` 不等于 catheter care。无论是否另有直接 capability，它们的非序数 ADL care mode 和 clarification 都必须保留。

## 10. Evidence Set Model

每个重要 derived fact 必须拥有非空 `evidenceIds`；每条 evidence 包含稳定 `evidenceId`、derived field、outcome code、rule ID 和非空 sources。Evidence 位于单一 ElderProfile 内，并由 `identity.assessmentId` 统一绑定当前 Assessment；不得在每条 evidence 冗余另一个可能漂移的 assessment ID。

Evidence source 只有两个通道：

### 10.1 Positive option evidence

用户实际选择的具体 option 使用：

```yaml
sourceKind: assessment_option
sourceQuestionId: cognitive.specialCareNeeds
sourceOptionCode: night_care
contribution: supports
```

option code 必须真实存在于对应 raw answer。不得引用 UI label。

### 10.2 Complete answer-set evidence

基于“未选择”的 `not_reported` 只能使用：

```yaml
sourceKind: assessment_answer_set
sourceQuestionId: cognitive.specialCareNeeds
sourceOptionCodes: [night_care, rehabilitation_training]
targetOptionCode: tube_feeding
contribution: establishes_not_reported
```

统一不变量：

1. 仅用于冻结的 multi-choice questions；
2. `sourceOptionCodes` 与 Completed Assessment 中该题数组逐项深度一致，包含原顺序；
3. `targetOptionCode` 是该题合法 code，且不在 answer set 中；
4. `[unknown]` 不得建立 not-reported absence；
5. `[none]` 使用显式 option evidence 表达 `absent` / `not_required`，不伪装成 answer-set absence；
6. optional multi-choice 未作答时不存在完整 set，不得构造 answer-set evidence；
7. ID 不依赖数组顺序；source snapshot 则必须保留数组顺序；
8. 该模型统一适用于 cognition、health、special care 及未来所有 multi-choice absence claim，不允许 special-care 私有硬编码。

每个 derived field 正好一条最终 evidence，允许一条 evidence 聚合多个真实 sources：

```text
evidenceId = ev:<derivedField>
```

`outcomeCode` 固定为最终 value；unknown/needs-confirmation 分别为 `unknown` / `needs_confirmation`；careMode 使用 `reported | context | needs_confirmation`；capability 使用其 status。

非 ADL rule ID 固定为：

```text
elder-profile-ruleset-v1:MOBILITY_DIRECT
elder-profile-ruleset-v1:REHABILITATION
elder-profile-ruleset-v1:COGNITIVE_CONCERN
elder-profile-ruleset-v1:REPORTED_DIAGNOSIS
elder-profile-ruleset-v1:WANDERING_RISK
elder-profile-ruleset-v1:BEHAVIORAL_RISK
elder-profile-ruleset-v1:SLEEP_CYCLE
elder-profile-ruleset-v1:CARE_CAPABILITY
```

ADL rule ID 使用 `ADL_RULE_CONTRACT.md` 的冻结 ID。非 ADL contribution 固定为：直接 option=`supports`；unknown/冲突/clue=`requires_clarification`；明确 none=`supports`；具体 answer set 的 absence=`establishes_not_reported`。ID 不使用时间、随机数或展示文案。Profile 内 ID 唯一，所有引用可解析。

## 11. Clarifications

reason code 固定为：

```text
other_without_detail
unknown_answer
non_ordinal_adl_answer
cross_answer_conflict
risk_signal_needs_confirmation
```

所有 `unknown` / `needs_confirmation` derived facts 和 care modes 必须引用 clarification。跨题冲突的 sources 同时包含冲突双方，`affectedDerivedFields` 精确列出受影响字段。

Clarification ID 固定模板：

```text
cl:unknown_answer:<questionId>
cl:non_ordinal_adl_answer:<questionId>
cl:other_without_detail:<questionId>
cl:cross_answer_conflict:<derivedField>
cl:risk_signal_needs_confirmation:<derivedField>
```

同一 derived field 的多个风险线索合并到一条 clarification 的 sources 中。

优先级：

- ADL `unknown_answer` → `required_before_classification`；
- 非 ADL `unknown_answer` → `required_before_hard_filter`；
- `non_ordinal_adl_answer` → `required_before_hard_filter`；
- `cross_answer_conflict` → `required_before_hard_filter`；
- `risk_signal_needs_confirmation` → `required_before_hard_filter`；
- `other_without_detail` → `recommended`。

Clarification 不触发顾问、登录、手机号或网络请求。

## 12. Summary Input, Not UI Copy

`userFacingSummary` 固定包含以下八个 section，顺序不可变且每个 section 非空：

| order | section | item 顺序 |
|---:|---|---|
| 1 | `basic` | relationship；name（存在时）；gender；age；living status（存在时）；primary caregiver（存在时）；institution experience（存在时）；exit reasons（存在时） |
| 2 | `health` | reported diseases；recent risks；derived rehabilitation need |
| 3 | `adl` | derived care level；随后按 classifier 固定顺序列出已存在 care mode |
| 4 | `mobility` | derived mobility level |
| 5 | `cognition` | concern；reported diagnosis；wandering；behavior；sleep cycle |
| 6 | `special_care` | 九项 capability 固定顺序 |
| 7 | `preference` | care type；priorities；region（存在时） |
| 8 | `financial_intent` | monthly budget；deposit tolerance；move-in timing；consultant support |

固定 summary code：

```text
basic.relationship / basic.name / basic.gender / basic.age
basic.living_status / basic.primary_caregiver
basic.institution_experience / basic.institution_exit_reasons
health.reported_diseases / health.recent_risks / health.rehabilitation_need
adl.care_level / adl.care_mode.<AdlCareModeCode>
mobility.level
cognition.concern / cognition.reported_diagnosis
cognition.wandering_risk / cognition.behavioral_risk / cognition.sleep_cycle_issue
special_care.capability.<CareCapabilityCode>
preference.care_type / preference.priorities / preference.region
financial.monthly_budget / financial.deposit_tolerance
intent.move_in_timing / intent.consultant_support
```

每个 raw item 只引用对应 Assessment question；每个 derived item 只引用对应 derived field 及其最终 evidence ID。除此之外，本阶段只冻结：

- `summarySchemaVersion = elder-profile-summary-input-v1`；
- 固定 section 与 item 顺序；
- stable `summaryCode`；
- 非空 raw/derived sources。

本阶段不生成或冻结中文营销/医学文案，不包含 `textSnapshot`。Profile UI 后续根据 code 与证据冻结可访问的中文模板；业务逻辑不得反向解析展示文案。

## 13. Medical and Institution Boundaries

禁止：

- 症状 → Alzheimer diagnosis；
- `special_feeding` → tube feeding；
- `catheter_or_stoma` → catheter care；
- careLevel → 疾病、机构接收、压疮、认知症或长护险等级；
- 独居/年龄/预算 → 必须入住；
- 将 `not_reported` / `unknown` / `needs_confirmation` 压成 false。

生产 derivation 的依赖图必须保持：

```text
Assessment types + ElderProfile types + pure sibling modules
```

以下依赖数必须为 0：`Institution`、`InstitutionService`、`InstitutionProvider`、`InstitutionCapability`、`Recommendation`、`Ranking`。唯一允许的 catalog 相关事实是 Assessment 已冻结的 region snapshot，且只能原样复制。

## 14. Determinism and Validation Gate

相同 CompletedAssessment 与相同三个版本运行两次，结果必须 deep-equal。固定输出顺序至少包括：ADL question、care mode、coverage issue、capability、evidence、clarification、summary section。

Runtime fixtures 必须验证：

1. Proposal C C01-C21；
2. missing/illegal/unknown/nonordinal/no-stairs；
3. 27/27 raw mapping与 optional absent；
4. 康复冲突、Alzheimer + cognition none；
5. direct tube/catheter 与非序数 clue 分离；
6. important derived fact evidence 非空；
7. option/answer-set evidence 与当前 Assessment snapshot 一致；
8. clarification 引用完整；
9. repeated derivation deep equality；
10. Institution/Recommendation/runtime side-effect dependency 为 0。

## 15. Frozen Assessment Status

`ASSESSMENT_INPUT_SYSTEM_FROZEN = TRUE`

`ASSESSMENT_INTERACTION_SYSTEM_FROZEN = TRUE`

Phase 3A-2 不修改 `ASSESSMENT_CONTRACT.md` 或 `WECHAT_INTERACTION_CONTRACT.md` 的业务语义。Profile derivation 是只读消费者，不能把派生值写回 AssessmentDraft 或 CompletedAssessment。
