# Assessment V1 to V2 Migration Contract

状态：`FROZEN_PHASE_V1_1_A`

版本：`assessment-draft-migration-v1-to-v2`

冻结日期：`2026-09-04`

```text
ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT = FROZEN_PHASE_V1_1_A
SOURCE_SCHEMA_VERSION = 1
TARGET_SCHEMA_VERSION = 2
MIGRATION_RUNTIME = NOT_IMPLEMENTED
PRODUCTION_CODE_CHANGE = 0
```

本文件只定义当前编辑中的 `AssessmentDraft` Schema V1 如何安全迁移为 Schema V2。它不修改历史 `ASSESSMENT_CONTRACT.md`，不迁移 `CompletedAssessment`，也不实现 storage、页面、画像或推荐。

## 1. Source and Target Contracts

- Source：`ASSESSMENT_CONTRACT.md`，文件头为 `assessment-schema-v1 / FROZEN_PHASE_2D`；Phase V1.1-A 将其用途分类为 `FROZEN_V1 / HISTORICAL_CONTRACT`，不修改历史文件头。
- Target：`ASSESSMENT_CONTRACT_V2.md`，`assessment-schema-v2`，`FROZEN_PHASE_V1_1_A`。
- 迁移对象：仅 `kind === 'assessment_draft' && schemaVersion === 1` 的当前编辑草稿。
- 禁止对象：`CompletedAssessment` V1、服务器 Assessment、ElderProfile、Recommendation。

## 2. Pure Migration Boundary

未来 runtime 必须表现为无副作用纯函数：

```ts
type AssessmentDraftMigrationErrorCode =
  | 'SOURCE_NOT_ASSESSMENT_DRAFT'
  | 'UNSUPPORTED_SOURCE_SCHEMA_VERSION'
  | 'INVALID_SOURCE_DRAFT'
  | 'COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN'
  | 'MIGRATION_INVARIANT_VIOLATION'

type AssessmentDraftMigrationResult =
  | {
      ok: true
      sourceSchemaVersion: 1
      targetSchemaVersion: 2
      draft: AssessmentDraftV2
    }
  | {
      ok: false
      code: AssessmentDraftMigrationErrorCode
    }

migrateAssessmentDraftV1ToV2(source: unknown): AssessmentDraftMigrationResult
```

纯函数禁止：

- 读写 `wx` storage 或其他 persistence；
- `Date.now()`、`new Date()`、随机数或网络；
- 修改 source object/array；
- 调用 ElderProfile、ADL、Institution 或 Recommendation derivation；
- 打印完整 Assessment answer。

同一合法输入必须得到 deep-equal 输出。

稳定 error precedence 为：

1. V1 completed discriminant/identity → `COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN`；
2. 非 Draft discriminant → `SOURCE_NOT_ASSESSMENT_DRAFT`；
3. Draft schema 不是 1 → `UNSUPPORTED_SOURCE_SCHEMA_VERSION`；
4. V1 Draft envelope、元数据或 answer 非法 → `INVALID_SOURCE_DRAFT`；
5. 内部生成结果违反已冻结 target invariant → `MIGRATION_INVARIANT_VIOLATION`。

同一输入不能因检查顺序变化返回不同 code。

## 3. Identity, Progress and Timestamp Preservation

成功迁移时以下元数据必须原样复制：

```text
localDraftId
persistence
currentStep
startedAt
updatedAt
```

不得创建或伪造：

```text
id
assessmentId
elderId
recommendationId
completedAt
```

`currentStep` 继续是最近一次已成功校验并保存的 V1 步骤进度标记。迁移不得改写它来假装新增 required question 已完成，也不得把它重新解释为 resume route。

首个未完成问题和候选 resume step 必须在迁移之后由 V2 required order 动态计算，不能保存成迁移默认事实。对原本完整的 V1 Draft，首个缺失 required question 必须是 `health.chewingAbility`。

## 4. Unchanged Answer Mapping

除 `preference.priorities` 外，以下 26 个 V1 question ID 与 V2 语义、类型和 option code 相同；合法且存在的 source answer 原样复制：

```text
basic.relationship
basic.elderName
basic.gender
basic.age
basic.livingStatus
basic.primaryCaregiver
basic.hasInstitutionExperience
basic.institutionExitReasons
health.conditions
health.recentEvents
health.rehabilitationNeed
adl.eating
adl.mobility
adl.toileting
adl.bathing
adl.dressing
adl.transfer
adl.stairs
cognitive.symptoms
cognitive.specialCareNeeds
preference.careType
preference.region
budget.monthlyRange
budget.upfrontCostAcceptance
budget.moveInTiming
budget.consultantSupport
```

“原样复制”不等于跳过校验：source answer 的类型与 option code 必须符合冻结 V1 Contract，target answer 必须符合 V2 Contract。数组必须创建新实例；object answer 必须创建不共享可变引用的等价值。

迁移必须在 cloned answers 上重新应用冻结的条件清理：当 `basic.hasInstitutionExperience !== 'true'` 时，target 必须不存在 `basic.institutionExitReasons`。这是唯一允许从结构正确但处于 inactive 状态的 source answer 中执行的 canonical cleanup；它不修改原 source。其他非法类型、未知 code、非法互斥或非法 active conditional answer 必须返回 `INVALID_SOURCE_DRAFT`。迁移不得用 `none`、`unknown`、空数组、空字符串或其他默认值替代被清理/未回答答案。

## 5. Five New Required Answers

以下五个 V2 required question 在 V1 中不存在，迁移时必须保持 UNANSWERED，即 target `answers` 中不创建对应 key：

```text
health.chewingAbility
health.swallowingAbility
preference.roomType
preference.mealSchedule
preference.activityPreference
```

禁止根据旧 health、ADL、care type、priority 或任何其他答案推测这些值。特别是：

- `adl.eating = special_feeding` 不能生成 chewing/swallowing answer；
- `cognitive.specialCareNeeds = tube_feeding` 不能生成 swallowing answer；
- 旧 preference 不能生成 room、meal 或 activity answer。

## 6. V1 Priority Classification

### 6.1 Safe direct mappings

以下 V1 code 在 V2 中保持完全相同的 stable code 与语义，可以逐项保留：

```text
medical_conditions
rehabilitation_capability
food_quality
living_environment
transportation
price
```

### 6.2 Ambiguous mappings

以下 V1 code 不得静默映射、拆分、合并、别名转换或凭上下文猜测为 V2 priority：

```text
nursing_professionalism
caregiver_attitude
overall_quality
recreational_activities
close_to_family
dementia_care
```

可能看似接近的 V2 code（例如 `care_capability`、`caregiver_quality`、`activity_space`、`region`）仍不是等价映射。

## 7. Priority Migration Algorithm

迁移 `preference.priorities` 时必须按以下互斥分支执行：

1. Source key 不存在：target key 也不存在，不产生 notice。
2. Source 只包含第 6.1 节 safe code：保留这些 code，并按 V2 priority manifest 顺序规范化；不得增加或删除语义。
3. Source 包含至少一个第 6.2 节 ambiguous code：整个 target `preference.priorities` 保持 UNANSWERED；即使同一数组还包含 safe code，也不得部分迁移为一个看似已完成的答案。
4. Source priorities 非法：迁移失败并返回 `INVALID_SOURCE_DRAFT`，不得 best-effort 修补。

第 3 种分支必须附带 migration notice：

```ts
interface AssessmentMigrationNoticeV2 {
  originalQuestionId: 'preference.priorities'
  originalOptionCodes: readonly PreferencePriorityV1[]
  sourceSchemaVersion: 1
  targetSchemaVersion: 2
  reasonCode: 'PRIORITIES_REQUIRE_RESELECTION_V2'
}
```

`originalOptionCodes` 保存 source 中完整、合法的原 priority code 集合（safe 与 ambiguous 都保留），并按冻结 V1 priority manifest 顺序规范化，使输出 deterministic。Notice 仅用于解释为什么需要重新选择，不得作为活跃 V2 answer、画像事实或推荐输入。

```text
AMBIGUOUS_PRIORITY_POLICY = CLEAR_ACTIVE_ANSWER_AND_REQUIRE_RESELECTION
PARTIAL_SAFE_PRIORITY_MIGRATION_WHEN_AMBIGUOUS_PRESENT = FORBIDDEN
```

## 8. Target V2 Priority Manifest

迁移 validator 必须识别完整 V2 priority 集合，但不得从 V1 推导新增 code：

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

V2 priority 仍是 required、1–3 项。迁移后为空是合法的 Draft 状态，但不能通过 V2 completion validation。

## 9. Non-destructive Persistence Boundary

迁移纯函数与 persistence transaction 必须分离。未来 storage orchestration 的最低安全顺序为：

```text
read source V1 Draft
-> validate source
-> pure migrate to V2 in memory
-> validate target Draft shape
-> persist complete V2 Draft successfully
-> read back / verify persisted V2 envelope
-> only then retire or replace source V1 Draft
```

在 V2 persistence 成功且验证前：

- 不删除、覆盖或改变 source V1 Draft；
- 不修改 source `schemaVersion`；
- 不把部分写入当作迁移成功；
- 不因 migration notice 而丢弃原 priority provenance。

任何 storage failure 必须保留 source V1 Draft，并以稳定 application error 结束；本 Contract 不规定具体 storage API 或 UI 文案。

```text
SOURCE_V1_PRESERVATION = REQUIRED_UNTIL_VERIFIED_V2_PERSISTENCE
MIGRATION_PERSISTENCE_RUNTIME = NOT_IMPLEMENTED
```

## 10. CompletedAssessment V1 Policy

如果输入是任何 `CompletedAssessment` V1 或具有 completed identity 的对象，迁移必须拒绝：

```text
errorCode = COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN
COMPLETED_ASSESSMENT_V1_POLICY = IMMUTABLE_HISTORICAL_RECORD
```

历史 V1 record 必须继续按照其 schema/ruleset 重放。需要 V2 数据时创建新的 Assessment V2；禁止把历史 record 降格为 Draft、填补新题、覆盖 completedAt 或重用 identity。

## 11. Failure and Privacy Semantics

- 失败必须返回稳定 error code；测试与调用方不得依赖自由文本判断。
- error/telemetry 不得包含完整健康、认知、ADL、priority answer 或完整 Draft dump。
- `INVALID_SOURCE_DRAFT` 不得自动把未知 code 当作 UNANSWERED 后继续。
- unsupported schema 必须安全失败，不能假定它等于 V1。
- migration notice 只存在于成功迁移且 priority 需要重选的 V2 Draft 中。

## 12. Required Phase V1.1-B Fixture Matrix

本阶段不实现 runtime，但后续实现至少必须覆盖：

| Fixture ID | Input | Expected |
|---|---|---|
| `MIGRATION-001` | valid partial V1 Draft without priorities | success; preserve answers/meta; five new keys absent; no notice |
| `MIGRATION-002` | otherwise complete V1 Draft with safe priorities only | success; safe priorities preserved; first V2 error `health.chewingAbility` |
| `MIGRATION-003` | V1 priorities contain one ambiguous code | success; target priorities absent; full original codes in notice |
| `MIGRATION-004` | V1 priorities mix safe and ambiguous codes | success; no partial active answer; full original codes in notice |
| `MIGRATION-005` | same valid input repeated | deep-equal output |
| `MIGRATION-006` | valid arrays/region object | deep-equal values without shared mutable references |
| `MIGRATION-007` | inactive institution-exit answer remains in source | target conditional cleanup applied without default |
| `MIGRATION-008` | invalid/unknown V1 option code | `INVALID_SOURCE_DRAFT` |
| `MIGRATION-009` | unsupported source schema | `UNSUPPORTED_SOURCE_SCHEMA_VERSION` |
| `MIGRATION-010` | CompletedAssessment V1 | `COMPLETED_ASSESSMENT_MIGRATION_FORBIDDEN` |
| `MIGRATION-011` | simulated V2 persistence failure | source V1 remains byte-for-byte available |
| `MIGRATION-012` | successful V2 persistence and read-back | source may be retired only after verification |

Runtime test must additionally prove source object is unchanged, output includes no formal identity, no current time is read, and no migration path calls profile/recommendation semantics.

## 13. Frozen Boundaries

```text
ASSESSMENT_V1_CONTRACT_CHANGE = 0
ASSESSMENT_V2_RUNTIME = 0
MIGRATION_RUNTIME = 0
PAGE_COMPONENT_STORE_SERVICE_CHANGE = 0
ELDER_PROFILE_CHANGE = 0
ADL_RULESET_CHANGE = 0
INSTITUTION_CHANGE = 0
RECOMMENDATION_CHANGE = 0
BACKEND_CHANGE = 0
```

Phase V1.1-A 结束时只能将本迁移 Contract 标记为 frozen；不得宣称 V1 Draft 已实际迁移，也不得把 Phase 4C-2 Recommendation UI 视为 V1.1 runtime。
