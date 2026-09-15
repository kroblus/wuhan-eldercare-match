# Institution Contract V1.2 + InstitutionCareProcess Contract Proposal

状态：`PROPOSED_PHASE_V1_2_A1`

决策状态：`APPROVED_FOR_CONTRACT_FREEZE`

Frozen normative source：`INSTITUTION_CONTRACT_V1_2.md`（`FROZEN_PHASE_V1_2_A1`）

```text
ARCHITECTURE_PROPOSAL_ONLY = TRUE
PRODUCTION_CODE_CHANGE = 0
PROPOSAL_DECISION_STATUS = APPROVED
INSTITUTION_CONTRACT_V1_2 = FROZEN_PHASE_V1_2_A1
INSTITUTION_CARE_PROCESS = EMBEDDED_VERSIONED_SUBRECORD
INSTITUTION_CAPABILITY_CONTRACT_V1 = UNCHANGED
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
CARE_PROCESS_MATCHING_ROLE = DISPLAY_EXPLAINABLE_ONLY
CARE_QUALITY_SCORE = FORBIDDEN_V1_2
CARE_PROCESS_RECOMMENDATION_WEIGHT = 0 / NOT_APPLICABLE
```

本文件保留 V1.2 Institution successor 与 `InstitutionCareProcess` 的 Proposal、独立审查和产品决策历史。项目负责人已批准 §35 的六项决策；最终规范以 `INSTITUTION_CONTRACT_V1_2.md` 为准。本文件本身不替代 Frozen Contract，不修改任何 frozen V1/V1.1/V2 语义，也不授权 CareProcess UI、Consultant、AI、Appointment/Visit、VisitEvaluation、Backend、持久化或真实机构资料实现。

## 1. Source of Truth

按约束优先级，本 Proposal 读取并服从：

1. `docs/product/README.md`；
2. `docs/product/武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`，重点为 PDF p19–21、p38、p44、p50、p58、p60–61；
3. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`，重点为 PDF p9、p14、p20、p26–27；
4. accepted `V1_2_CHANGE_IMPACT_ANALYSIS.md`，包括其中最终双轴决策；
5. frozen `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md`；
6. frozen `INSTITUTION_CONTRACT_V1_1.md` 与 `INSTITUTION_CAPABILITY_CONTRACT.md`；
7. frozen `RECOMMENDATION_CONTRACT_V2.md` 与 `RECOMMENDATION_RULE_CONTRACT_V2.md`；
8. A0 canonical Institution types、catalog、resolver、application snapshot、display projection 和 navigation runtime；
9. `MOCK_DATA_POLICY.md`、`FRONTEND_STRUCTURE.md` 与根目录 `AGENTS.md`。

当前工程基线是 A0 final commit `19e5e33c62e4cec3e4e22814a1519a486b6d8f6f`。A0 已冻结 canonical identity 与 List/Detail 导航；其中类型名里的 `V12` 表示 Application Snapshot 版本，不能被误读为 raw `institution-contract-v1.2` 已经存在。

## 2. Non-negotiable Invariants

以下是后续任何方案都不能覆盖的前提：

```text
Institution Capability V1              = unchanged
Recommendation Contract V2             = unchanged
Recommendation Ruleset V2              = unchanged
Recommendation policy                  = conservative-exact-with-conditional-v1
Canonical Institution identity          = institutionId + recordRevision
CareProcess matching role               = DISPLAY_EXPLAINABLE_ONLY
CareProcess Recommendation participation = none
Public institution rating               = disabled
Raw CareProcess evidence in public UI    = forbidden
```

CareProcess 不得进入或改变：

- Recommendation eligibility；
- Safety Core；
- `EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE`；
- PriorityFitVector；
- Rank Tuple 或 tie-break；
- `NO_EXACT_MATCH`；
- reason/difference ranking；
- cards 上限、候选顺序或候选补足；
- Institution Capability V1 的任何 status。

## 3. Institution V1.2 Version Strategy

### 3.1 推荐版本

推荐发布：

```text
InstitutionRecordV11 -> institution-contract-v1.1  # immutable history
InstitutionRecordV12 -> institution-contract-v1.2  # additive successor
```

采用 `institution-contract-v1.2` 的原因：

- 它是与产品 V1.2 对齐的 additive successor；
- V1.1 exact shape、validator、fixtures 和历史 revision 可以保持不变；
- consumer 可通过 root `contractVersion` 做确定分派；
- CareProcess 可被 Detail 使用，又可经显式投影从 frozen Recommendation V2 隔离；
- Institution identity、Capability 与既有核心事实没有发生需要跳到 V2 的破坏性重定义。

拒绝：

- 原地给 `InstitutionRecordV11` 增字段；
- 让 V1.1 validator 静默接受 V1.2；
- 以 `'careProcess' in record` 做结构猜测；
- 机械跳到 `institution-contract-v2`；
- 用 UI/Application Snapshot 的 `V12` 名称代替 Domain Contract version。

### 3.2 概念类型

以下仅是 Proposal 级 shape，不是本阶段的生产 TypeScript：

```ts
type InstitutionContractVersionV12 = 'institution-contract-v1.2'

interface InstitutionRecordV12 extends Omit<InstitutionRecordV11, 'contractVersion'> {
  contractVersion: InstitutionContractVersionV12
  careProcess: InstitutionCareProcessV1
}
```

V1.2 只在 V1.1 完整结构上增加 `careProcess`。它不删除、不重命名、不重解释任何 V1.1 字段。

## 4. CareProcess Domain Ownership

`InstitutionCareProcess` 属于 Institution Domain。它不是：

- Recommendation Domain 输入；
- VisitEvaluation 或用户评价；
- Consultant 主档或顾问陈述；
- UI DTO；
- Institution Capability；
- 独立评分对象。

推荐方案是 **嵌入式、带 schema marker 的版本化子记录**：

```text
InstitutionRecordV12
  identity = institutionId + recordRevision
  careProcess
    schemaVersion = institution-care-process-v1
    no child identity
    no child recordRevision
```

理由：

1. Detail 的所有事实保持来自同一个不可变 Institution revision；
2. field evidence 已绑定父记录的 `institutionId + recordRevision + fieldPath`；
3. 不产生第二套 canonical identity，也不出现父/子 revision 混源；
4. 历史 Recommendation 仍可精确解析其原 Institution revision；
5. 未来数据库可内部拆成规范化表或 evidence attachment 表，但 API/Domain snapshot 必须重建为父 revision 下的原子嵌入结构。

不推荐独立 child entity/reference。CareProcess 更新频率较高不是建立第二种公共身份的充分理由；独立 child revision 会使 Recommendation-pinned Detail 面临“旧机构事实 + 新护理流程”的混合快照。若未来出现独立发布、授权或跨机构复用等真实需求，应另发 Contract successor，而不是在 MVP 预建复杂聚合。

## 5. Proposed Record Model

### 5.1 最小概念结构

```ts
type CareProcessPresenceCode = 'present' | 'absent'

type CareRecordCompletenessCode = 'complete' | 'partial'

type CareRecordFrequencyCode =
  | 'per_shift'
  | 'daily'
  | 'event_based'
  | 'other'

type CareRecordFrequencyCodeSet = readonly CareRecordFrequencyCode[]

type CareRecordTraceabilityCode = 'traceable' | 'not_traceable'

type HandoverContentCode =
  | 'vital_signs'
  | 'abnormal_events'
  | 'interventions_recorded'
  | 'follow_up'
  | 'family_communication'
  | 'medical_transfer'

type HandoverContentFacts = {
  readonly [K in HandoverContentCode]: InstitutionField<CareProcessPresenceCode>
}

interface InstitutionCareRecordV1 {
  presence: InstitutionField<CareProcessPresenceCode>
  completeness: InstitutionField<CareRecordCompletenessCode>
  completenessCriteriaRef: InstitutionField<string>
  frequency: InstitutionField<CareRecordFrequencyCodeSet>
  otherFrequencyNote: InstitutionField<string>
  traceability: InstitutionField<CareRecordTraceabilityCode>
}

interface InstitutionShiftHandover24hV1 {
  presence: InstitutionField<CareProcessPresenceCode>
  processNote: InstitutionField<string>
  contents: HandoverContentFacts
}

interface InstitutionCareProcessV1 {
  schemaVersion: 'institution-care-process-v1'
  careRecord: InstitutionCareRecordV1
  shiftHandover24h: InstitutionShiftHandover24hV1
}
```

PRD 中的 `careRecordAvailability` 在此映射为 `careProcess.careRecord.presence`。避免命名为 `availability.availability`，也避免把事实存在性与 `InstitutionField.availability` 的资料可得性混在一个 enum。

产品字段与推荐 canonical path 的完整映射为：

| PRD / analysis field ID | Approved canonical field path |
|---|---|
| `careRecordAvailability` | `careProcess.careRecord.presence` |
| `careRecordCompleteness` | `careProcess.careRecord.completeness` |
| completeness criteria reference | `careProcess.careRecord.completenessCriteriaRef` |
| `careRecordFrequency` | `careProcess.careRecord.frequency` |
| `careRecordFrequencyNote` | `careProcess.careRecord.otherFrequencyNote` |
| `careRecordTraceable` / care record traceability | `careProcess.careRecord.traceability` |
| `shiftHandover24h` | `careProcess.shiftHandover24h.presence` |
| `handoverIncludesVitalSigns` | `careProcess.shiftHandover24h.contents.vital_signs` |
| `handoverIncludesAbnormalEvents` | `careProcess.shiftHandover24h.contents.abnormal_events` |
| `handoverIncludesInterventions` | `careProcess.shiftHandover24h.contents.interventions_recorded` |
| `handoverIncludesFollowUp` | `careProcess.shiftHandover24h.contents.follow_up` |
| `handoverIncludesFamilyCommunication` | `careProcess.shiftHandover24h.contents.family_communication` |
| `handoverIncludesMedicalTransfer` | `careProcess.shiftHandover24h.contents.medical_transfer` |

这些 mapping 已由 `INSTITUTION_CONTRACT_V1_2.md` 冻结。Flat PRD field ID 只用于产品资料对照；实现 Agent 不得同时保留 flat 与 nested 两套 Domain source of truth。

### 5.2 为什么不是单一布尔或标签集合

- `boolean` 无法区分明确否定、资料未知和未核验；
- 一个 `handoverContent[]` set 无法为六项内容分别绑定核验状态和 evidence；
- 自由文本无法稳定校验、迁移或展示；
- 一个整体 `careProcessVerified=true` 会错误扩大核验范围；
- 空数组不能表示“已确认没有”。

## 6. Fact / Availability / Verification Axes

V1.2 必须复用 V1.1 的三个既有 primitive：

```text
InstitutionField<T>
InstitutionFieldVerification
InstitutionEvidence (root evidence[])
```

### 6.1 原始事实与资料可得性

```text
InstitutionField.availability = provided
  -> value 必须存在；value 是业务事实

InstitutionField.availability = unknown
  -> value = null；当前没有足够来源说明该事实

InstitutionField.availability = unavailable
  -> value = null；该项资料本身明确不可取得/不适用
  -> 不等于业务事实 absent
```

Presence-like 事实只使用：

```text
provided + present
provided + absent
unknown + null
unavailable + null
```

Proposal 不在 presence、frequency、completeness 或 traceability value enum 内再放一个 `unknown`。未知统一由 `InstitutionField.availability = unknown` 表达，避免双重 unknown。

### 6.2 存储核验与展示有效核验

存储状态继续逐字复用 V1.1：

```text
verification.status = unverified | verified | expired
```

展示投影在显式 `evaluationAsOf` 下计算：

```text
effectiveVerification = current_verified | unverified | expired
```

`current_verified` 不是新的持久化 status；它是现有 `verified + verifiedAt/validUntil + evaluationAsOf` 的确定性投影。不得把 PRD 中的 `verified` 复制到 availability enum，也不得把 `unverified` 当作 fact unknown。

### 6.3 合法组合示例

V1.2 validator 必须执行以下完整组合矩阵；不能因为底层通用 TypeScript primitive 能表达更多组合就全部接受：

| Field availability | Value | 允许的 stored verification | Evidence requirement | 语义 |
|---|---|---|---|---|
| `provided` | 对应类型的合法非空 value | `unverified` | evidenceIds 可空；非空时必须闭包一致 | 来源给出一项事实，平台尚未核验 |
| `provided` | 对应类型的合法非空 value | `verified` | non-empty、当前 record 精确绑定 | 已核验的历史/当前事实；是否 current 由时间投影 |
| `provided` | 对应类型的合法非空 value | `expired` | non-empty、`verifiedAt + validUntil` 合法 | 有历史事实值，但核验已过期 |
| `unknown` | `null` | **仅 `unverified`** | evidenceIds 必须为空 | 没有可声明的来源事实；不能“核验未知” |
| `unavailable` | `null` | `unverified` | evidenceIds 可空；非空时必须闭包一致 | 来源称该资料项不可取得/不适用，尚未核验 |
| `unavailable` | `null` | `verified` | non-empty，snapshot 明确绑定 stable code `unavailable` | 平台已核验资料项不可取得/不适用，不等于业务事实 absent |
| `unavailable` | `null` | `expired` | non-empty，历史 snapshot 绑定 `unavailable` | 此前核验为资料不可用，但该核验已过期 |

明确拒绝：

```text
unknown + verified
unknown + expired
unknown + non-empty evidenceIds
non-provided + non-null value
provided + null value
expired without a historical provided value or historical unavailable assertion
```

因此 `expired` 保留的历史断言可以是 `provided + value`，也可以是当时已核验的 `unavailable` availability；它不能绑定没有历史断言的 `unknown`。运营“尝试联系但仍无资料”的过程可进入未来内部 audit event，不把 `unknown` 包装成 verified Institution fact。

合法业务示例：

| 原始组合 | 语义 | 可否成为确定公开事实 |
|---|---|---|
| `provided + present + verified(current)` | 平台当前有效核验为存在 | 可以，范围只限该字段 |
| `provided + present + unverified` | 来源称存在，平台尚未核验 | 不可以当作平台确认 |
| `provided + absent + verified(current)` | 平台当前有效核验为明确没有 | 可以表达否定，不得扩大到 Capability |
| `unknown + null + unverified` | 没有明确资料 | 只能显示未知 |
| `unavailable + null + verified(current)` | 已核验该资料项不可取得/不适用 | 只能显示资料不可用，不等于事实 absent |
| `provided/unavailable + expired` | 历史断言保留但已过有效期 | 不可当作当前事实 |

## 7. Field-level Evidence Model

CareProcess 不建立第二套 evidence 数组。每个叶子事实继续通过其 `verification.evidenceIds` 引用 `InstitutionRecordV12.evidence[]`，并满足：

```text
same institutionId
same recordRevision
exact fieldPath
typed valueSnapshot
same verificationStatus
same verifiedAt / validUntil
valid source locator
```

建议 field path 固定从 `careProcess` 开始，例如：

```text
careProcess.careRecord.presence
careProcess.careRecord.completeness
careProcess.careRecord.completenessCriteriaRef
careProcess.careRecord.frequency
careProcess.careRecord.otherFrequencyNote
careProcess.careRecord.traceability
careProcess.shiftHandover24h.presence
careProcess.shiftHandover24h.processNote
careProcess.shiftHandover24h.contents.vital_signs
careProcess.shiftHandover24h.contents.abnormal_events
careProcess.shiftHandover24h.contents.interventions_recorded
careProcess.shiftHandover24h.contents.follow_up
careProcess.shiftHandover24h.contents.family_communication
careProcess.shiftHandover24h.contents.medical_transfer
```

现有 `stable_code` 和 `text` value snapshot 已足以表达本 Proposal 的字段，不需要新的 hash/JCS runtime dependency。verified/expired 字段必须有非空 evidence；unverified 可保留来源 evidence，也可为空，但不能被当作 current verified。孤立、跨 revision、跨机构、路径不匹配或 snapshot 不一致的 evidence 必须使整条 V1.2 record 校验失败。

### 7.1 允许与禁止的来源

优先复用现有 source type：

| 业务来源 | 现有 evidence source type | 边界 |
|---|---|---|
| 机构提供的制度/表单说明 | `institution_provided` | 默认只是来源陈述，不自动成为 verified |
| 平台授权运营人员复核 | `platform_manual_verification` | 需 actor/audit 在未来后端保存；公共 projection 不暴露 actor |
| 现场核验 | `on_site_verification` | 需明确核验范围与时间 |
| 正式制度或官方文件 | `official_document` | 文件真实性、适用机构与有效期仍需核验 |
| 合同或合作材料 | `contract_material` | 不因合同出现就扩大为护理能力 |

普通 Consultant 口述不是新的 verified source code。只有被授权执行平台人工核验或现场核验，并完成未来审计流程，才可使用对应现有 source type。用户问卷、AI 回答和 VisitEvaluation 均不得成为 Institution verified source。

### 7.2 Evidence media

未来内部核验可以在受控 persistence 中保存文档、护理记录表样张或现场照片，并用现有 `sourceReference` 绑定不透明内部附件引用。默认不复用消费者公开 `InstitutionMedia.mediaId`，也不在 public projection 返回 `sourceReference`、原图 URL、原文或内部备注。若未来确需公开已脱敏证据媒体，必须单独冻结媒体分类、脱敏、授权和失效规则。

## 8. Nursing Record Semantics

### 8.1 Presence

`careRecord.presence` 只回答“机构是否存在可核验的护理记录制度/记录表流程”。它不证明：

- 每份记录完整；
- 每位老人均按时记录；
- 护理质量高；
- 具备任何医疗或特殊护理能力。

### 8.2 Completeness

项目负责人批准把 `careRecord.completeness` 作为独立事实，stable code 为：

```text
complete
partial
```

它不能从 presence、frequency 或 traceability 推导。`complete/partial` 必须绑定非空、版本化且已由产品批准的 `completenessCriteriaRef`；不能仅凭机构口头声称。未来定义为：`complete` 表示在批准 criteria、声明样本/期间和核验范围内所有 mandatory criteria 均满足；`partial` 表示同一范围内至少一个 mandatory criterion 未满足。它不宣称所有历史记录、所有老人或临床内容正确，也不是护理质量结论。

当前 Product Source 尚未提供足够细的 completeness checklist，本 Proposal 不自行发明。未来 criteria manifest 冻结前，真实/生产数据的 `completeness` 与 `completenessCriteriaRef` 都必须为 `unknown + null + unverified + empty evidenceIds`；A1-2 初始 validator 必须拒绝没有 approved criteria 的 provided completeness。

### 8.3 Traceability

候选 code：

```text
traceable
not_traceable
```

`traceable` 只表示授权人员能按老人、时间/班次或事件定位到相应记录；不表示公众可访问、内容完整、记录真实或护理优质。`not_traceable` 必须是明确事实，不能由“没有看到附件”推断。

## 9. Care Record Frequency

项目负责人批准以下 stable codes 组成可组合的记录频率 code set，而不是强制互斥单选：

| Code | 业务语义 | unknown 行为 | Matching impact |
|---|---|---|---|
| `per_shift` | 已成文流程要求每个护理班次形成相应常规记录 | 无明确来源时 field availability=`unknown` | none |
| `daily` | 已成文流程按服务日形成相应常规记录 | 同上 | none |
| `event_based` | 由定义的护理/异常事件触发记录 | 同上 | none |
| `other` | 来源明确给出但无法映射到上述 code；note 必填 | 同上 | none |

不加入语义宽泛的 `periodic`：当前 PRD 没有定义其间隔、周期单位或与 `daily` 的边界。其他明确制度使用 `other + otherFrequencyNote`；未来只有通过 Contract successor 才能增加 code。

不把 `unknown` 放入 frequency code inventory；它由外层 `InstitutionField.availability='unknown'` 表达。Provider ingestion 或 Domain constructor 必须用纯 canonicalizer 对 provided set 校验 code、去重，并按 `per_shift, daily, event_based, other` 稳定排序；任意输入 permutation 产生同一 canonical set。进入不可变 record 后，exact validator 不静默修复，仍含 duplicate 或非 canonical order 的记录直接失败。`other` 可以与其他 code 组合，但必须有 provided、非空的 `otherFrequencyNote`。不含 `other` 时 note 必须是 unknown-only。自由文本不参与匹配，也不被解析为 code。

合法示例包括 `[per_shift]`、`[daily]`、`[event_based]`、`[per_shift, event_based]`、`[daily, event_based]` 及合法 `other` 组合。各 code 不表达质量高低，也不默认互斥或覆盖。Availability 非 provided 时 canonical wire value 为 null，有效 code set 为空；不得在其他字段暗藏 code。

## 10. 24-hour Shift Handover

`shiftHandover24h.presence = provided + present` 只表示机构存在覆盖全天班次衔接的护理交接制度/流程，并有对应来源。它明确不等于：

- `round_the_clock_care` capability；
- 每位老人接受一对一或 24 小时持续照护；
- `medicalDuty24h`；
- 夜间必有医生/护士；
- 急救、转医或任何特殊护理能力；
- 任何 Safety、Tier 或 rank 信号。

明确没有该制度时使用 `provided + absent`；资料未知用 `unknown`；资料项不可取得/不适用用 `unavailable`；核验轴仍独立。

## 11. Handover Content Model

推荐固定、独立字段 map，而不是单一 set。六项内容都可分别为 present、absent、unknown、unavailable，并分别绑定 evidence：

| Code | Canonical semantic | 明确禁止的推导 |
|---|---|---|
| `vital_signs` | 交接记录/流程包含生命体征这一信息类别 | 连续监测、医生在场、医疗机构级监测能力 |
| `abnormal_events` | 交接记录/流程包含异常事件记录 | 异常处理一定完善、Safety score |
| `interventions_recorded` | 交接记录包含已采取处理措施的记录 | treatment capability、医疗资质、特殊护理支持 |
| `follow_up` | 交接记录包含后续观察/跟进事项 | 已完成跟进、保证跟进时效 |
| `family_communication` | 流程可记录是否/如何与家属沟通 | 一定实时通知、及时通知、家属已知情 |
| `medical_transfer` | 流程可记录必要转医事项或转医信息 | 合作医院、急救能力、120 响应、医疗资质 |

`follow_up` 的 canonical owner 是 handover content。本版本不再建立一个语义相近的 `careRecord.followUp`；护理记录整体可包含交接记录，但不得重复两个无法区分的事实。若未来要记录非交接场景的护理随访，必须以新字段和新定义进入 Contract successor。

父子适用性必须由 validator 确定执行：

| Parent presence | Dependent raw fields |
|---|---|
| `provided + present` | 每个 child 可独立使用 §6.3 任一合法组合，并独立绑定 verification/evidence |
| `provided + absent` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |
| `unknown + null` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |
| `unavailable + null` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |

对 `careRecord.presence`，dependent 是 completeness、completenessCriteriaRef、frequency、otherFrequencyNote、traceability。对 `shiftHandover24h.presence`，dependent 是 processNote 和全部六项 contents。V1.2 当前没有独立来源 exception。只要 parent 不是 `provided + present`，任一 child 出现 `provided` value、`unavailable` assertion、verified/expired status 或非空 evidenceIds，整条 V1.2 record 都必须以稳定 relation error 拒绝；不得自动清理。

Detail 可依据 parent 状态派生 `not_applicable_due_to_parent` 或 `blocked_by_parent_state` 并隐藏 child 行，但这些只属于 display projection，不得回写为 Institution fact、availability 或 verification。当 parent 是 `provided + absent` 但未核验/已过期时，display 必须同时保留该 parent 的 unverified/expired 提示，不能把派生的 not-applicable 写成已确认没有。

## 12. Canonical Negative-fact Policy

CareProcess 所有 presence-like 事实统一使用：

```text
affirmative = availability: provided, value: present
negative    = availability: provided, value: absent
unknown     = availability: unknown, value: null
data N/A    = availability: unavailable, value: null
```

禁止使用裸 `true/false`。明确否定不是 `unavailable`，因为现有 A0 display contract 把 unavailable 定义为“资料明确不可用”；也不是 `unknown`；更不是 `unverified`。否定事实是否可作为“平台已确认暂无”，仍由独立 verification 轴决定：只有 `absent + current_verified` 才能这样表达。

Completeness 与 traceability 使用自己的正/负 stable code，遵守同一规则：

```text
provided + partial
provided + not_traceable
```

不得由缺少截图、空 evidence array、空 child collection、用户未看到或 UI 未展示推断负面事实。

## 13. Expiry Policy

expired verification 保留历史 `provided + value` 或历史 `unavailable` assertion、`verifiedAt`、`validUntil` 和 evidence binding，但在显式 `evaluationAsOf` 下只能投影为 `expired`：

```text
historical value retained
current truth claim forbidden
unsupported / unavailable / absent coercion forbidden
```

推荐显示“此前资料已过核验有效期，需重新确认”，并可显示历史值但必须同一视觉单元内带过期状态。不得只显示旧值，也不得因过期自动清空为 unknown；历史审计需要保留原值。

Domain validator 只校验 ISO 时间、status shape、evidence closure 和时间关系；当前有效性由 projector 在调用方显式传入的 `evaluationAsOf` 上确定。Domain 不读当前时间。

## 14. Revision Bump Policy

推荐延续 V1.1 的不可变 record revision：只要公开 Domain snapshot 或其核验闭包改变，就创建新的 Institution `recordRevision`。consumer 仍只比较 identity 是否相等，不通过数字大小猜“更新”。

| 变更 | 是否新 Institution revision | 理由 |
|---|---|---|
| care record presence/completeness/frequency/traceability 改变 | 是 | 公开事实改变 |
| 24h handover presence 或任一 content 改变 | 是 | 公开事实改变 |
| availability、value、asOf 改变 | 是 | 字段快照改变 |
| verification status 改变 | 是 | 可公开断言的有效性改变 |
| evidenceIds、source locator、valueSnapshot 改变 | 是 | field evidence closure 改变 |
| verifiedAt 或 validUntil 改变 | **是（R1 已批准）** | V1.1 evidence 与 recordRevision 精确绑定，且 public verification 语义改变 |
| 事实不变但重新核验 | **是（R1 已批准）** | 新核验事件必须生成新的不可变 evidence closure |
| 仅时间经过 `validUntil`，存储内容未改 | 否 | 同一 revision 在不同 `evaluationAsOf` 下确定性投影为 expired；不伪造写入事件 |
| 仅 UI 中文 mapper、排版或色彩改变 | 否 | 不属于 Institution record |
| catalog displayOrder、页面 section order 改变 | 否 | 不属于 Institution fact snapshot |
| 后端不影响公开值/核验闭包的内部审计注记 | 否 | 由未来内部 audit revision 保存，不污染公共 identity |

不建议为 CareProcess 新建与父记录并行的 public `verificationMetadataRevision`。那会与 A0 pinned revision、same-source Detail 和 V1.1 evidence binding 冲突。若后端需要记录每次检查尝试，可使用内部 audit event；只有选定的新核验结果进入公开 record 时才产生新 Institution revision。

## 15. V1.2 to V1.1 Projection

### 15.1 概念 Contract

未来应新增纯函数：

```ts
projectInstitutionRecordV12ToV11(
  record: InstitutionRecordV12,
): InstitutionRecordV11
```

固定顺序：

```text
validate exact InstitutionRecordV12
  -> exact whitelist-copy every V1.1 field
  -> contractVersion = institution-contract-v1.1
  -> preserve institutionId + recordRevision
  -> preserve capabilityContractVersion
  -> preserve every V1.1 raw field without reinterpretation
  -> copy only evidence bound to V1.1 field paths
  -> drop careProcess and careProcess evidence
  -> validate projected InstitutionRecordV11
  -> return detached immutable-compatible value
```

禁止使用 broad object spread 后再删除一个字段。投影应按 frozen V1.1 root/child manifest 白名单复制，避免未来 V1.2 extension 泄漏。CareProcess root section 和所有 `fieldPath` 以 `careProcess.` 开头的 evidence 都必须被明确排除；否则 V1.1 validator 会得到 orphan extension evidence 或未知字段。

### 15.2 Safety preservation

投影必须逐值保留 V1.1：

- capability matrix 及所有 verification/evidence；
- care level、mobility、cognition、special care；
- price、region、type、rehabilitation；
- rooms、meal、activity 及 V2 当前批准的 life-fit facts；
- staffing、medical、operations、media、VR、qualifications；
- record provenance/status；
- identity 与 revision。

投影不得补造 capability、删除 hard conflict、把 unknown 改为 unavailable、把 unverified/expired 升为 verified、解析 note 或把 CareProcess 变成 Recommendation reason。

## 16. Recommendation V2 Parity

Frozen Recommendation V2 的 application boundary 继续只接收 `InstitutionRecordV11[]`：

```text
InstitutionRecordV12
  -> validate V1.2
  -> projectInstitutionRecordV12ToV11
  -> validate V1.1
  -> frozen Recommendation V2
```

禁止直接放宽 Recommendation V2 input 为 union，禁止 Recommendation Domain import V1.2/CareProcess types，禁止 service 预筛选或预排序。

未来 Gate 必须分清两种 parity：

1. **同 identity 投影 parity**：某 V12 与手写的等价 V11 具有相同 `institutionId + recordRevision` 和 V1.1 facts 时，投影值以及 Recommendation V2 全结果必须 deep-equal。
2. **CareProcess semantic isolation**：在测试用 counterfactual 中仅改变 CareProcess、保持 V1.1 projection 与 identity 不变时，eligibility、tier、priority fit、rank tuple、reason/difference、candidate order、cards 和 `NO_EXACT_MATCH` 必须完全相同。
3. **真实发布 revision**：生产中 CareProcess 改变会按 §14 产生新 `recordRevision`。此时 Recommendation source identity/pool manifest 合法变化；匹配语义仍必须相同，但不能伪称包含 provenance identity 的整个结果 deep-equal。

第三点避免两个 Contract 自相矛盾：CareProcess 不影响匹配，不代表 Recommendation 可以隐藏其实际输入 revision。

## 17. Canonical Identity Compatibility

V1.2 不建立 CareProcess ID、CareProcess revision 或第二种 Institution route identity。全链继续使用：

```text
institutionId + recordRevision
```

List、Detail、Recommendation source context、未来 Appointment/Visit 均按该二元组解析 exact snapshot。不得以 name、legacy id、数组 index、display order、URL、CareProcess schema version 或“最新版”fallback 查找。

Recommendation-pinned Detail 继续优先解析原 candidate revision。若 current revision 因 CareProcess 更新而变化，页面只能按 A0 revision drift policy提示并由用户显式打开当前资料；不得把新 CareProcess 拼到旧 Recommendation reasons 对应的旧 record 上。

## 18. A0 Compatibility

Page/ViewModel 不应理解 raw V1.1/V1.2 schema。未来链路应为：

```text
Provider unknown payload
  -> root contractVersion dispatcher
  -> V1.1 or V1.2 exact validator
  -> version-specific List/Detail projector
  -> stable InstitutionList/Detail Application Snapshot
  -> ViewModel/Page
```

未来实现预计最小涉及以下模块；本阶段不修改：

| 模块 | 后续最小变化 |
|---|---|
| `miniprogram/types/institution-v1-2.ts`（新） | V12/CareProcess types 与 stable codes |
| `miniprogram/domain/institution/v1-2/**`（新） | exact validator、V12→V11 projector、schema dispatch helper |
| `miniprogram/types/institution-catalog-v1-2.ts`（新或等价） | versioned Provider/Service envelope，不放宽 V1.1 service |
| `miniprogram/services/institution-record-resolver.ts` | 当前/历史 resolver 对 root version 显式分派，仍 exact identity、整池失败 |
| `miniprogram/types/institution-list-detail.ts` | 将 raw resolver boundary 版本化；CareProcess section 使用 discriminated display union |
| `miniprogram/services/institution-list-detail-application.ts` | 消费 validated union，不在 Service 重解释 CareProcess |
| `miniprogram/services/institution-presentation.ts` | 保留 V1.1 projector；新增 V1.2 projector 与 CareProcess public projection |
| `miniprogram/services/institution-list-detail-page.ts` | 注入 versioned resolver；Page contract 不变 |
| `miniprogram/pages/institution/detail-view-model.ts` | 后续 A1-4 增加专用 CareProcess mapper，不使用通用递归推断 |
| `miniprogram/pages/institution/detail.*` | 后续 A1-4 只渲染 display snapshot，维持 single Action/Back/scroll |
| `miniprogram/mock/institution-catalog.mock.ts` | 后续 A1-3 明确迁移为 V12 Mock；无真实数据 |

保持零业务变化：

```text
miniprogram/domain/recommendation/**
miniprogram/types/recommendation-v2.ts
miniprogram/services/recommendation-preview-v2.ts
miniprogram/pages/recommendation/**
```

当前 `InstitutionNavigationSourceContext.institutionContractVersion='institution-contract-v1.1'` 继续表示 frozen Recommendation 实际输入版本。若未来 Recommendation-pinned Detail 需要同源 V1.2 CareProcess，只能让 source context 额外引用原 V12 canonical identity/dataset version，并由 resolver 解析同一 revision；不得把 raw V12 或 CareProcess 大对象存入 navigation context，也不得改写 Recommendation manifest。

## 19. Detail CareProcess Projection

建议未来 `sections.careProcess` 使用 schema/fact 分离的 union：

```ts
type InstitutionCareProcessSectionDisplay =
  | {
      state: 'available_for_schema'
      sourceContractVersion: 'institution-contract-v1.2'
      careRecord: CareRecordDisplay
      shiftHandover24h: ShiftHandoverDisplay
    }
  | {
      state: 'not_applicable_for_schema'
      sourceContractVersion: 'institution-contract-v1.1'
    }
```

未知 future root version 不进入 snapshot；它应在 validator/dispatcher 处返回 `UNSUPPORTED_INSTITUTION_CONTRACT_VERSION`，而不是构造 `unsupported_schema` 页面事实。

V1.2 CareProcess display 至少包含：

- 护理记录 presence；
- 完整性（若产品批准）；
- 记录频率与补充 note；
- 可追溯性；
- 24h 交接 presence；
- 六项独立交接内容；
- 每项 availability、value、effective verification；
- 可选 `asOf`；
- 产品批准后的 field-level verified date。

Snapshot 不包含 raw `InstitutionEvidence`、evidence IDs、source URL/reference、内部文件、原始护理记录、运营备注或任何质量分。全 unknown 的合法 V1.2 section 仍是 ready display state，不是错误，也不是“机构没有”。

## 20. Display Semantics

以下是 Domain→Display 的语义底线；最终中文可在 UI Freeze 微调，但不得改变含义：

| Domain state | 建议中文语义 | 禁止文案 |
|---|---|---|
| `provided + present + current_verified` | 已核验存在 | 护理质量高、绝对保障 |
| `provided + present + unverified` | 机构资料称有，待平台核验 | 已核验、平台确认 |
| `provided + present + expired` | 此前资料称有，核验已过期 | 当前仍确定具备 |
| `provided + absent + current_verified` | 已确认暂无 | 暂未提供（会掩盖明确否定） |
| `provided + absent + unverified` | 机构资料称暂无，待平台核验 | 已确认没有 |
| `unknown + null + unverified` | 暂未获得明确资料 | 没有、不支持、已核验未知 |
| `unavailable + null + unverified` | 机构资料称该资料项不可取得/不适用，待核验 | 已确认没有、已核验 |
| `unavailable + null + current_verified` | 已核验该资料项不可取得/不适用 | 机构明确没有该流程 |
| `provided + value + expired` | 此前事实资料已过核验有效期，需重新确认 | unsupported、false、当前事实 |
| `unavailable + null + expired` | 此前核验为资料不可用，核验已过期 | 机构明确没有、当前资料状态 |
| V1.1 schema | 该版本不含 CareProcess 结构（按 §27 展示策略） | 机构暂无护理记录 |

必须分别标注事实状态和核验状态；不能用单个绿色“已认证”覆盖整个 section。`asOf` 是事实适用时间，`verifiedAt` 是核验动作时间，两者不得合成模糊“更新时间”。不得从 `family_communication` 写成“及时通知”，不得从 `medical_transfer` 写成“绿色通道”，不得从 `vital_signs` 写成“实时监护”。

## 21. Care Quality Score Policy

正式建议冻结：

```text
CARE_QUALITY_SCORE = FORBIDDEN_V1_2
CARE_PROCESS_RECOMMENDATION_WEIGHT = 0 / NOT_APPLICABLE
```

不得根据 presence、completeness、frequency、traceability、handover 或 contents 自动生成：

- 护理质量分；
- 透明度分；
- 安全分；
- 专业度分；
- 综合分、匹配百分比或星级；
- bonus、penalty、priority boost、tie-break、filter 或 eligibility gate。

CareProcess 的价值是让用户理解可核验流程事实，而不是用未经批准的阈值替用户判断质量。未来若产品希望其参与推荐，必须发布 Recommendation Contract/Ruleset successor，并重新执行完整 Safety、evidence、determinism 和真机 Gate；不得修改 frozen V2。

## 22. VisitEvaluation Boundary

未来看院评价中的“是否了解到护理记录/交接班”等属于：

```text
USER_REPORTED_VISIT_OBSERVATION
```

它只能进入 VisitEvaluation：

```text
VisitEvaluation observation
  -> optional future VerificationLead
  -> authorized human review + institution evidence
  -> new Institution revision
```

禁止用户回答直接 patch CareProcess、Capability 或 Recommendation。`VERIFICATION_LEAD_V1_2_MVP` 继续是 `FUTURE_OPTIONAL`；本 Proposal 不创建其 Contract、状态机或持久化。

## 23. Privacy Boundary

护理记录样张可能包含老人姓名、病情、生命体征、护理事件、家属信息和员工信息，属于高风险 PII/PHI/机构内部材料。建议冻结：

- 消费者 Detail 只接收核验后的结构化 public projection；
- 原始记录图片、文件、截图和内部附件默认不公开；
- 内部 evidence 必须受角色授权、最小访问、审计、脱敏和留存策略约束；
- evidence locator 不进入 route、Page data、console、错误 payload 或 Recommendation；
- 不在 Mock、fixture、Git 或日志写真实老人/员工姓名、健康记录、电话或内部制度材料；
- 公共错误只含 stable code 和最小安全 field path，不返回 raw record/evidence；
- AI 不读取原始 CareProcess evidence；后续 AI Contract 也不能绕过 public projection。

未来 Backend Contract 必须另行冻结加密、访问角色、附件存储、审计、retention、删除和脱敏规则。本 Proposal 不把“运营可查看”误写成已存在权限系统。

## 24. Mock Policy

当前 8 条 catalog record 继续是 `MOCK_DEVELOPMENT_ONLY`，本阶段不改数据。后续迁移遵守三层标识：

1. 文件声明仅开发演示；
2. record 保持 `recordProvenance=MOCK_DEVELOPMENT_ONLY`；
3. Detail 持续显示“开发 Mock 数据/不代表真实机构资料”。

迁移缺失 CareProcess 时的安全初值是：

```text
all CareProcess facts = availability: unknown, value: null
all verification      = unverified
evidenceIds            = []
```

这只表示“旧开发记录没有该类资料”，不表示机构没有流程。不得默认 absent、unavailable、false、supported、0 或 verified。

后续 UI 场景开发可以建立少量明确标注的 synthetic CareProcess values，但必须：

- 只使用“示例机构 X（Mock）”；
- 不仿造武汉真实机构制度、价格或能力；
- 不创建真实感护理记录截图、真实员工或老人姓名；
- synthetic verified evidence 明示 `DEVELOPMENT_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA`；
- fixture 与 App Mock 分开 ownership；生产 App 不 import `scripts/fixtures/**`；
- VR 继续为空/不可用。

## 25. Dataset Migration

必须区分两种动作：

1. **只读兼容展示**：V1.1 historical/current record 仍是 V1.1；Application 可返回 `not_applicable_for_schema`，不得把它伪装成 raw V12。
2. **canonical catalog migration**：若开发 catalog 正式发布 V12 shape，应保留旧 V1.1 snapshot，并创建新的 Institution revision；新增 CareProcess 按 §24 为 unknown/unverified。不能原地改旧 revision 的 contractVersion。

若后续为过渡工具建立 `upgradeV11ToV12Unknown`，其输出必须明确标为 migration candidate，经过 V12 validator 后才能进入新 catalog；它不能成为 historical resolver 对旧 identity 的替代，也不能给旧 Recommendation 自动换 revision。

## 26. Historical V1.1 Compatibility

历史 V1.1 record：

- 永远保留 `institution-contract-v1.1`；
- 保留原 `institutionId + recordRevision`；
- 不原地补 `careProcess`；
- 不把缺字段解释为 absent/unavailable；
- Recommendation V2 继续按原 V1.1 记录解释；
- current V12 存在时也不能自动替换 pinned V1.1 revision；
- CareProcess display state 是 `not_applicable_for_schema`，不是机构负面事实。

推荐的消费者呈现策略见产品决策 H3：普通 current V1.1 direct Detail 保持隐藏；明确的 historical/pinned Detail 可显示一条中性说明“该版本资料尚未包含护理管理与交接信息”。两种场景都禁止“机构暂无护理记录”。

## 27. Schema Version Dispatch

必须依据 root discriminator 精确分派：

```text
contractVersion = institution-contract-v1.1
  -> validateInstitutionRecordV11
  -> V1.1 projector

contractVersion = institution-contract-v1.2
  -> validateInstitutionRecordV12
  -> V1.2 projector
  -> Recommendation path only: project V12 to V11

unknown / missing / malformed contractVersion
  -> UNSUPPORTED_INSTITUTION_CONTRACT_VERSION or INVALID_INSTITUTION_RECORD
  -> fail closed
```

禁止 structural duck typing、fallback V1.1、fallback latest、部分接受或 silently exclude invalid record。Current catalog 任一 record 不合法时整池失败；historical resolver 返回 unsupported/invalid version 时该 exact lookup 失败，不用其他 revision 替代。

建议未来 V12 stable error family：

```text
INVALID_V12_RECORD_SHAPE
INVALID_CARE_PROCESS_SHAPE
INVALID_CARE_PROCESS_FACT
INVALID_CARE_PROCESS_RELATION
INVALID_CARE_PROCESS_EVIDENCE
UNSUPPORTED_INSTITUTION_CONTRACT_VERSION
V12_TO_V11_PROJECTION_FAILED
```

具体 path 可用于定位，但调用方不得依赖自由文本判断。

## 28. Stable Code Inventory

以下是本 Proposal 提出的最小 inventory；相关产品决策现已批准，最终 frozen 定义以 `INSTITUTION_CONTRACT_V1_2.md` 为准。

| Family | Proposed codes | Business meaning | Unknown behavior | Display impact | Matching impact |
|---|---|---|---|---|---|
| Institution version | `institution-contract-v1.2` | V1.1 additive successor | missing/unknown version fail closed | 选择 V1.2 projector | none after V11 projection |
| CareProcess schema | `institution-care-process-v1` | V12 内嵌结构版本，不是独立 identity | missing invalid V12 | 选择 CareProcess mapper | none |
| Field availability（复用） | `provided / unknown / unavailable` | 值已提供 / 无明确资料 / 资料不可用或不适用 | `unknown + null` | 三态分别显示 | none |
| Stored verification（复用） | `unverified / verified / expired` | 原始核验状态 | 不用 missing 代替 | projector 结合时间 | none |
| Effective verification（投影） | `current_verified / unverified / expired` | 显式 evaluationAsOf 下状态 | 无合法时间不得 current verified | 分别标识 | none |
| Presence | `present / absent` | 明确存在 / 明确不存在 | outer availability=`unknown` | 正/负事实 | none |
| Completeness | `complete / partial` | 定义范围内完整 / 部分 | outer unknown | 中性事实说明 | none |
| Frequency | `per_shift / daily / event_based / other` | 可组合、去重、稳定排序的记录频率事实 | outer unknown | code-set-to-label + other note | none |
| Traceability | `traceable / not_traceable` | 授权内可定位 / 已确认不可定位 | outer unknown | 中性事实说明 | none |
| Handover content | `vital_signs / abnormal_events / interventions_recorded / follow_up / family_communication / medical_transfer` | 固定内容类别，每项独立 presence fact | 每项 outer unknown | 固定顺序逐项显示 | none |
| Detail schema state | `available_for_schema / not_applicable_for_schema` | V12 可展示 / V1.1 无此结构 | unknown root version 不生成 snapshot | 展示 section 或中性提示 | none |

不新增 `verified_positive`、`verification_unknown`、`care_quality_good`、`timely_family_notification`、`treatment_capability` 或任何 score code。

## 29. Required / Optional Policy

推荐 V12 exact shape：

- root `careProcess` required；
- `careProcess.schemaVersion` required；
- `careRecord`、`shiftHandover24h` 与 `contents` objects required；
- 所有事实 wrapper required；无法得知时显式 `unknown + null + unverified`；
- `completenessCriteriaRef`、`otherFrequencyNote`、`processNote` 的 **wrapper required**，业务内容可 unknown；不使用 optional property 隐藏“缺失”与“未知”的差异；
- `InstitutionField.asOf` 延续现有 optional；
- verified 的 `validUntil` 延续现有 optional，expired 的 `validUntil` required；
- evidence entry 按现有 union 要求 sourceReference/sourceNote 至少一项；
- verified/expired evidenceIds non-empty；unverified 允许 empty；
- 不允许额外未知 key。

Conditional invariants：

1. care record presence 不是 `provided + present` 时，completeness/completenessCriteriaRef/frequency/otherFrequencyNote/traceability 必须统一为 `unknown + null + unverified + empty evidenceIds`；不得出现任何 provided/unavailable、verified/expired 或非空 evidence；
2. handover presence 不是 `provided + present` 时，processNote 与全部 content 必须遵守同一 unknown-only dependent 规则；
3. provided frequency set 必须非空、unique、按固定 manifest 排序；含 `other` 时 `otherFrequencyNote` 必须 provided、非空，不含 `other` 时 note 必须 unknown-only；
4. 当前没有 approved completeness criteria manifest，真实/生产 completeness 与 criteria ref 必须 unknown-only；
5. 每个 verified/expired fact，以及任何 evidenceIds 非空的 fact，其 evidence closure 必须完整；`provided + unverified` 允许 empty evidenceIds；
6. `schemaVersion` 与 root V12 version 的组合固定，不接受 future child schema；
7. `unknown` 只允许 `unverified + empty evidenceIds`；verified/expired 只允许 provided value 或 unavailable assertion；
8. contradictions fail entire record，不自动清理、排序、去重或补默认值。

## 30. Contract Inventory Recommendation

推荐 **方案 A：一个统一的 `INSTITUTION_CONTRACT_V1_2.md`**，在同一文档中冻结 V1.2 successor、CareProcess shape、evidence、revision、V12→V11 projection、migration 与 display boundary。

不建议在 MVP 同时创建独立顶级 `INSTITUTION_CARE_PROCESS_CONTRACT_V1.md`，因为：

- CareProcess 不拥有独立 identity/revision；
- evidence 和 persistence boundary 服从 Institution Record；
- 两份 Contract 容易重复 availability/verification/revision 规则并发生漂移。

工程上可以使用单独 `institution-care-process.ts` 类型/validator 文件以控制文件大小，但 ownership 仍属于 `institution-contract-v1.2`。`schemaVersion='institution-care-process-v1'` 只用于嵌入结构分派，不代表第二个业务聚合。

## 31. Proposed Implementation Sequence

本 Proposal 批准后，建议：

1. **A1-1 — Contract Freeze**：项目负责人先批准 §35 六项产品决策；再形成 `INSTITUTION_CONTRACT_V1_2.md` 与 fixture manifest，独立 QA 后冻结。
2. **A1-2 — Domain runtime**：只实现 V12 types、validator、evidence closure、explicit dispatch、V12→V11 projection；建立 parity/isolation gates；不做 UI。
3. **A1-3 — Catalog/Application migration**：versioned Provider/Service/resolver；8 条 Mock 安全迁移；CareProcess public projection；不接 Backend。
4. **A1-4 — Detail CareProcess UI**：专用 ViewModel/WXML/Less；只读展示；保持 A0 navigation、Back、source context、Mock banner 和长页触控。
5. **A1-5 — Freeze gates**：全量 regression、DevTools 路径、Android 17 人工真机、独立 QA；证据类型分别记录。

每一步独立 diff/commit；不得把 Contract、Domain runtime、Mock/UI 和 Backend 混成一个大提交。

## 32. Regression Plan

### 32.1 新增 Domain Gate

至少覆盖：

1. valid V12 full facts；
2. all unknown/unverified V12；
3. positive、negative、unknown、unavailable 四种事实状态；
4. verified/current、unverified、stored expired、time-expired；
5. invalid root/child version；
6. exact-key violation；
7. contradictory parent/child；
8. invalid frequency set、duplicate/non-canonical order、`other` without note；
9. each handover content independent evidence；
10. evidence wrong institution/revision/path/value/status/time；
11. orphan/missing/duplicate evidence；
12. deterministic repeated deepEqual；
13. input immutability；
14. explicit unknown-version dispatch；
15. V1.1 historical record unchanged；
16. Mock migration never yields absent/unavailable/verified by default。

### 32.2 Projection / Recommendation Isolation Gate

至少覆盖：

- V12→V11 expected shape and exact V11 validation；
- CareProcess and its evidence absent from projection；
- all V1.1 facts/evidence/identity deep-equal；
- equivalent V11 vs projected V12 Recommendation V2 deepEqual at same identity/time；
- CareProcess value/status/evidence permutation does not change matching semantics；
- pool permutation/determinism unchanged；
- Recommendation V2 68/68、V1 117/117、V2 integration、Formal/Preview parity 全部保持；
- forbidden import/identifier scan for CareProcess in Recommendation Domain；
- no `careProcessScore/ratingScore/reviewWeight/popularityScore`。

### 32.3 A0 / UI Regression

- Institution V1/V1.1 gates；
- A0-2 canonical resolver/service/runtime；
- A0-3 List/Detail UI/runtime；
- A0-4 Home/List/Result→Detail navigation 与 rapid actions；
- pinned original revision、drift disclosure、explicit current action；
- V1.1 schema-not-applicable display；
- V1.2 all-unknown、negative、unverified、expired display；
- Mock banner、VR truth、Back、long-page touch/scroll；
- Assessment/Profile/Recommendation 主链；
- TypeScript 5.9、WeChat TS 4.1.2 targeted、generated JS compatibility/self-test、JSON、Less、diff check；
- DevTools 与 Android 人工证据分别标注。

## 33. Independent Agent Review Inputs

### 33.1 backend_domain review

结论：`PASS_WITH_REQUIRED_CONTRACTS`。只读审查支持 `institution-contract-v1.2` successor、嵌入式 CareProcess、父 revision/evidence 原子闭包与显式 V12→V11 allowlist projection。其重点风险是不要引入 `careProcessRevision`，verification refresh 应创建父 revision，未来数据库即使规范化存储也必须可重建不可变父 snapshot；内部 evidence attachment 不得进入 public projection。

### 33.2 wechat_frontend review

结论：`PASS_WITH_MIGRATION_GATES`。只读审查确认 A0 当前 resolver/catalog/application 为 V1.1-only，未来必须由 Service 层做显式 version dispatch，并新增专用 CareProcess display snapshot/mapper；Page 不读 raw record。V1.1 history 必须是 schema state 而非负面事实，pinned Detail 不能混入 current CareProcess，后续长页仍需保持 Back、single Action 与真机触控规则。

### 33.3 matching_engine review

结论：`PASS_WITH_REQUIRED_FOLLOW_UP`。现有 Recommendation V2 allowlist 不含 CareProcess，Domain 当前也不读取该对象。只要 V12 先完整校验、再显式投影并剔除 CareProcess/evidence，Recommendation V2 可保持语义 parity。未来必须新增 projection/isolation runtime；实际发布的新 revision 只允许改变 source identity/provenance，不允许改变匹配结论。

### 33.4 qa_reviewer review

结论：`PASS_WITH_RISKS`，当前 blocker 为 0。首轮审查指出的两处契约缺口已经闭环：§6.3 明确了 availability × stored verification 的完整合法组合与拒绝矩阵；§11 和 §29 明确了 parent 不是 `provided + present` 时，所有 dependent 必须归一为 `unknown + null + unverified + empty evidenceIds`，任何矛盾 child 都使整条 V1.2 record 以稳定 relation error 失败。第二轮独立只读复核同时确认：双轴模型、negative policy、evidence closure、no quality score、no Recommendation influence、no VisitEvaluation contamination、no sensitive public evidence、explicit version dispatch、migration/history semantics以及本阶段 production diff=0 均已在 Proposal 中形成明确约束。

该结论记录的是 Proposal 阶段审查。此后项目负责人已批准六项产品决策，并由 `INSTITUTION_CONTRACT_V1_2.md` 冻结最终规范。Parent 为 present 但 unverified/expired 时，各 child verification 保持独立并逐字段展示，不合成 section-level verified。当前仍无 V1.2 runtime validator，因此文档 PASS 不能误报为实现证据。

## 34. Risks and Non-blocking Constraints

1. Completeness 已批准为独立事实，但当前没有 criteria manifest；在 manifest 冻结前，真实/生产值必须保持 unknown。
2. Frequency 已批准为稳定 code set；后续 validator 必须拒绝重复或非 canonical 顺序，不能静默修复。
3. A0 当前 resolver/catalog/application 是 V1.1-only，后续必须版本化，不能粗暴 widen type。
4. A0 Application Snapshot 名称已有 `V12`，与 future raw `InstitutionRecordV12` 容易混淆；文档与代码注释需持续区分 Application version 和 Domain version。
5. CareProcess-only fact change会合法改变 `recordRevision`，因此“匹配语义不变”不能错误宣称完整 Recommendation provenance object 跨 revision deepEqual。
6. 当前无真实 CareProcess evidence；Contract Freeze 后也不能把 Mock 当作现实核验。

## 35. Approved Product Decision Record

项目负责人已经批准以下六项产品决策；normative 结果已冻结在 `INSTITUTION_CONTRACT_V1_2.md`：

### Decision 1 — Ownership / version unit

- **E1（已批准）**：`InstitutionRecordV12` 内嵌 `InstitutionCareProcessV1`；无 child identity/revision；父 record 原子版本化。

### Decision 2 — Care record frequency codes

- **F1（已批准并修订）**：`per_shift / daily / event_based / other` 组成可组合 stable code set；unknown 由 field availability 表达；set 去重并稳定排序；`other` 要求 `otherFrequencyNote`。不加入 `periodic`。

### Decision 3 — Completeness as an independent fact

- **C1（已批准）**：保留 `complete / partial` 独立事实；provided 值必须绑定 approved `completenessCriteriaRef`。Criteria manifest 尚未冻结前，真实/生产数据保持 unknown；不产生质量分。

### Decision 4 — Verification refresh and revision

- **R1（已批准）**：事实不变但重新核验、`verifiedAt/validUntil` 或业务 evidence binding 改变时也创建新 Institution revision；纯技术存储维护不 bump。

### Decision 5 — Historical V1.1 Detail

- **H3（已批准）**：普通 current V1.1 direct Detail 隐藏 CareProcess；historical/pinned Detail 可显示中性 `not_applicable_for_schema` 说明。

任一方案都禁止显示“机构暂无护理记录”。

### Decision 6 — Public verification date

- **D1（已批准）**：对 current-verified/expired 的 CareProcess 字段最多显示日期粒度的核验日期；不显示 evidence source、附件或精确时间；不合成 section-level “最近更新”。

无论选哪项，`asOf` 与 `verifiedAt` 都不能混写。

## 36. Contract Freeze Result and Implementation Boundary

Phase V1.2-A1-1 的 docs-only 结果是新增 frozen `INSTITUTION_CONTRACT_V1_2.md` 并保留本 Proposal 作为 decision history。当前实现仍明确为 0：

```text
production TypeScript
CareProcess validator/runtime
CareProcess UI / WXML / Less
Mock catalog migration
Recommendation change
Institution Capability change
Consultant / AI
Appointment / Visit / VisitEvaluation
Backend / persistence / API
real Wuhan institution records
wx.request / login / phone authorization
```

本 Proposal 的旧建议若与 Frozen Contract 冲突，以 `INSTITUTION_CONTRACT_V1_2.md` 为准。后续只有另行批准 Phase V1.2-A1-2 后才能实现 Domain runtime；本次 Freeze 不授权自动进入实现。
