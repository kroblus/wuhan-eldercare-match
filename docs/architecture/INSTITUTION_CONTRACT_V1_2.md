# Institution Contract V1.2

状态：`FROZEN_PHASE_V1_2_A1`

版本：`institution-contract-v1.2`

```text
INSTITUTION_CONTRACT_V1_2 = ADDITIVE_SUCCESSOR_OF_V1_1
PROJECT_OWNER_DECISIONS = APPROVED
CARE_PROCESS_RECORD_MODEL = EMBEDDED_VERSIONED_SUBRECORD
CANONICAL_INSTITUTION_IDENTITY = institutionId + recordRevision
FACT_AVAILABILITY_AXIS = provided / unknown / unavailable
STORED_VERIFICATION_AXIS = unverified / verified / expired
EFFECTIVE_DISPLAY_VERIFICATION = current_verified / unverified / expired
CARE_RECORD_FREQUENCY_MODEL = STABLE_CODE_SET
CARE_RECORD_COMPLETENESS = INDEPENDENT_FACT
CARE_RECORD_COMPLETENESS_REQUIRES_CRITERIA = TRUE
CARE_PROCESS_CHANGE_BUMPS_PARENT_REVISION = TRUE
PUBLIC_CARE_PROCESS_VERIFICATION_TIME_GRANULARITY = DATE_ONLY
SCHEMA_DISPATCH = EXPLICIT_FAIL_CLOSED
CONTRACT_INVENTORY = ONE_TOP_LEVEL_CONTRACT
CARE_PROCESS_MATCHING_ROLE = DISPLAY_EXPLAINABLE_ONLY
CARE_PROCESS_RECOMMENDATION_WEIGHT = NOT_APPLICABLE
CARE_QUALITY_SCORE = FORBIDDEN_V1_2
PUBLIC_CARE_PROCESS_EVIDENCE_RAW_ACCESS = FORBIDDEN
PRODUCTION_CODE_CHANGE = 0
```

本文件冻结 `institution-contract-v1.2` 及其内嵌 `InstitutionCareProcessV1` 的领域语义。V1.2 是
`institution-contract-v1.1` 的增量 successor，不原地修改 V1.1，不改变
`institution-capability-contract-v1`、Recommendation Contract V2 或 Recommendation Ruleset V2。本阶段仅冻结
Contract，不授权 TypeScript runtime、validator、projection、Mock、UI、Backend、Consultant、AI、Visit 或
VisitEvaluation 实现。

## 1. Source of Truth

按优先级，本 Contract 服从：

1. 项目负责人对 Phase V1.2-A1 Proposal 六项产品决策的正式批准；
2. `docs/product/README.md`；
3. `docs/product/武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`；
4. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`；
5. accepted `V1_2_CHANGE_IMPACT_ANALYSIS.md`；
6. frozen `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md`；
7. frozen `INSTITUTION_CONTRACT_V1_1.md` 与 `INSTITUTION_CAPABILITY_CONTRACT.md`；
8. frozen `RECOMMENDATION_CONTRACT_V2.md` 与 `RECOMMENDATION_RULE_CONTRACT_V2.md`；
9. `INSTITUTION_CONTRACT_V1_2_CARE_PROCESS_PROPOSAL.md`，仅作为设计与决策历史；
10. `MOCK_DATA_POLICY.md`、`FRONTEND_STRUCTURE.md` 与根目录 `AGENTS.md`。

如 Proposal、UI 文案、旧 DTO、Mock 或未来实现与本 Contract 冲突，以本 Contract 为准。V1.1、Capability V1、
Recommendation V2 的既有 frozen 语义仍由各自 Contract 管辖，不因本文件重新解释。

## 2. Frozen Product Decisions

| Decision | Frozen result |
|---|---|
| Version | `institution-contract-v1.2` 是 V1.1 additive successor |
| E1 ownership | `InstitutionCareProcessV1` 内嵌于 `InstitutionRecordV12`，无 child identity/revision |
| F1 frequency | `per_shift / daily / event_based / other` 组成稳定 code set，不是互斥单选 |
| C1 completeness | `complete / partial` 是独立事实，但必须绑定版本化 criteria；当前真实/生产值锁定为 unknown |
| R1 revision | 公开事实、verification、业务 evidence binding 或核验时间变化均 bump 父 record revision |
| H3 V1.1 history | 普通 current V1.1 Detail 隐藏；historical/pinned 可显示中性 schema-not-applicable |
| D1 public time | 最多公开日期粒度的核验日期，不公开精确时间或内部 evidence metadata |

以上不是实现建议，而是 V1.2 frozen 产品决策。

## 3. Version Strategy and Compatibility

正式版本关系：

```text
InstitutionRecordV11
  contractVersion = institution-contract-v1.1
  immutable historical contract

InstitutionRecordV12
  contractVersion = institution-contract-v1.2
  all V1.1 fields with identical semantics
  + required careProcess
```

V1.2 只增加 CareProcess，不删除、重命名、补造或重解释任何 V1.1 字段。禁止：

- 原地给 `InstitutionRecordV11` 增加 `careProcess`；
- 让 V1.1 validator 静默接受 V1.2；
- 机械升级为 `institution-contract-v2`；
- 用 A0 Application Snapshot 类型名中的 `V12` 冒充 Domain Contract version；
- 以对象结构、字段存在性或 duck typing 猜版本；
- 将 V1.2 record 无验证地传入 V1.1 或 Recommendation V2。

正式兼容链路：

```text
InstitutionRecordV12
  -> exact V1.2 validation
  -> explicit allowlist projection
  -> InstitutionRecordV11
  -> exact V1.1 validation
  -> frozen Recommendation V2
```

## 4. Domain Ownership and Canonical Identity

`InstitutionCareProcessV1` 属于 Institution Domain。它不是 Recommendation Domain、VisitEvaluation Domain、
Consultant Domain、UI DTO 或独立业务聚合。

V1.2 继续使用唯一 canonical identity：

```text
institutionId + recordRevision
```

不得增加：

```text
careProcessId
careProcessRevision
careProcessRecordId
careProcessCurrentHead
```

CareProcess 的全部事实、verification 和 evidence 都属于父 `InstitutionRecordV12` 的不可变快照，并与同一个
`institutionId + recordRevision` 绑定。未来 Backend 可以规范化存储子表或附件，但 API/Domain 必须能重建同一
父 revision 下的原子记录，不得向客户端暴露第二条 revision 轴。

List、Detail、Recommendation source context 及未来 Appointment/Visit 仍按 canonical Institution identity
解析 exact snapshot；不得以机构名称、数组 index、display order、URL、child schema version 或 latest fallback
替代 identity。

## 5. Stable Code Inventory

| Family | Frozen codes | Business meaning | Unknown behavior | Matching impact |
|---|---|---|---|---|
| Institution version | `institution-contract-v1.2` | V1.1 additive successor | missing/unknown version fail closed | none after V11 projection |
| CareProcess schema | `institution-care-process-v1` | 内嵌结构版本，不是独立 identity | missing/unknown child version fails V12 | none |
| Field availability | `provided / unknown / unavailable` | 已有事实值 / 无明确事实 / 资料不可取得或不适用 | `unknown + null` | none |
| Stored verification | `unverified / verified / expired` | 持久化核验状态 | missing forbidden | none |
| Effective verification | `current_verified / unverified / expired` | 显式时间下的展示投影 | 不持久化 | none |
| Presence | `present / absent` | 明确存在 / 明确不存在 | outer availability=`unknown` | none |
| Completeness | `complete / partial` | approved criteria 范围内完整 / 部分 | 当前真实/生产只能 outer unknown | none |
| Frequency | `per_shift / daily / event_based / other` | 可组合的记录频率事实 | outer availability=`unknown` | none |
| Traceability | `traceable / not_traceable` | 授权范围内可定位 / 已确认不可定位 | outer availability=`unknown` | none |
| Handover content | `vital_signs / abnormal_events / interventions_recorded / follow_up / family_communication / medical_transfer` | 六项独立交接内容事实 | 每项 outer unknown | none |
| Detail schema state | `available_for_schema / not_applicable_for_schema` | V1.2 可展示 / V1.1 无该 schema | unknown root version不生成 snapshot | none |

不新增：`verified_positive`、`verification_unknown`、`frequency_unknown`、`care_quality_good`、
`timely_family_notification`、`treatment_capability`、任何 rating 或 score code。

## 6. Frozen Conceptual Record Shape

以下概念 shape 冻结字段边界；生产 TypeScript 在 A1-2 中实现，但不得改变语义或 exact-key 要求：

```ts
type InstitutionContractVersionV12 = 'institution-contract-v1.2'

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

interface InstitutionRecordV12
  extends Omit<InstitutionRecordV11, 'contractVersion'> {
  contractVersion: 'institution-contract-v1.2'
  careProcess: InstitutionCareProcessV1
}
```

`CareRecordFrequencyCodeSet` 的 canonical provided representation 必须是非空、去重、按本 Contract 固定顺序
排列的 readonly code list。`frequency.availability !== 'provided'` 时 canonical wire value 仍遵守
`InstitutionField<T>`，即 `value = null`；其有效 frequency code set 等价为空，不允许在其他字段暗藏 codes。

PRD 字段映射：

| PRD field | Canonical path |
|---|---|
| `careRecordAvailability` | `careProcess.careRecord.presence` |
| `careRecordCompleteness` | `careProcess.careRecord.completeness` |
| completeness criteria reference | `careProcess.careRecord.completenessCriteriaRef` |
| `careRecordFrequency` | `careProcess.careRecord.frequency` |
| other frequency explanation | `careProcess.careRecord.otherFrequencyNote` |
| `careRecordTraceable` | `careProcess.careRecord.traceability` |
| `shiftHandover24h` | `careProcess.shiftHandover24h.presence` |
| handover process explanation | `careProcess.shiftHandover24h.processNote` |
| `handoverIncludesVitalSigns` | `careProcess.shiftHandover24h.contents.vital_signs` |
| `handoverIncludesAbnormalEvents` | `careProcess.shiftHandover24h.contents.abnormal_events` |
| `handoverIncludesInterventions` | `careProcess.shiftHandover24h.contents.interventions_recorded` |
| `handoverIncludesFollowUp` | `careProcess.shiftHandover24h.contents.follow_up` |
| `handoverIncludesFamilyCommunication` | `careProcess.shiftHandover24h.contents.family_communication` |
| `handoverIncludesMedicalTransfer` | `careProcess.shiftHandover24h.contents.medical_transfer` |

## 7. Fact, Availability and Verification Axes

所有 CareProcess 叶子事实复用 frozen `InstitutionField<T>`：

```text
availability = provided
  -> value 是该字段合法类型的明确业务事实

availability = unknown
  -> value = null
  -> 没有足够来源声明该事实

availability = unavailable
  -> value = null
  -> 资料项明确不可取得或对该场景不适用
  -> 不等于业务事实 absent
```

Stored verification 独立为：

```text
unverified | verified | expired
```

在显式 `evaluationAsOf` 下，display projector 产生：

```text
current_verified | unverified | expired
```

`current_verified` 不是 stored code。Domain validator 和 projector 不得读取 `Date.now()` 或 `new Date()` 获取
隐式当前时间。

### 7.1 Legal Combination Matrix

V1.2 validator 必须执行以下严格矩阵：

| Availability | Value | Allowed stored verification | Evidence requirement | Meaning |
|---|---|---|---|---|
| `provided` | 合法非空值 | `unverified` | evidenceIds 可空；非空必须闭包一致 | 来源给出事实，平台未核验 |
| `provided` | 合法非空值 | `verified` | non-empty，精确绑定本 revision | 历史或当前已核验事实 |
| `provided` | 合法非空值 | `expired` | non-empty，时间与闭包合法 | 历史事实核验已过期 |
| `unknown` | `null` | **仅 `unverified`** | evidenceIds 必须为空 | 没有可声明事实 |
| `unavailable` | `null` | `unverified` | 可空；非空必须闭包一致 | 来源称资料不可取得/不适用，未核验 |
| `unavailable` | `null` | `verified` | non-empty，snapshot=`unavailable` | 已核验资料不可取得/不适用 |
| `unavailable` | `null` | `expired` | non-empty，历史 snapshot=`unavailable` | 历史不可用断言已过期 |

明确拒绝：

```text
unknown + verified
unknown + expired
unknown + non-empty evidenceIds
non-provided + non-null value
provided + null value
expired without a historical provided value or unavailable assertion
```

核验未知不是新的 verification code。运营联系未果等过程信息可以进入未来内部 audit event，但不能把
`unknown` 包装成 verified Institution fact。

## 8. Canonical Negative-fact Policy

所有 presence-like 事实统一使用：

```text
affirmative = availability: provided, value: present
negative    = availability: provided, value: absent
unknown     = availability: unknown, value: null
data N/A    = availability: unavailable, value: null
```

明确否定不是 unknown、unavailable 或 unverified。只有 `provided + absent + current_verified` 可以在 public
display 表达为“已确认暂无”。`provided + absent + unverified` 只能表达“来源称暂无，待平台核验”。

`partial`、`not_traceable` 是各自事实值，不是质量分或 capability。不得根据空 evidence、空列表、UI 未展示、
用户没看到附件或字段缺失推导负面事实。

## 9. Parent and Dependent Field Policy

V1.2 当前没有声明“父事实不存在时仍有独立来源”的 dependent exception。必须遵守：

| Parent presence | Dependent raw fields |
|---|---|
| `provided + present` | child 可独立使用 §7.1 合法组合，并独立绑定 verification/evidence |
| `provided + absent` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |
| `unknown + null` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |
| `unavailable + null` | 所有 child 必须为 `unknown + null + unverified + empty evidenceIds` |

`careRecord.presence` 的 dependents：

```text
completeness
completenessCriteriaRef
frequency
otherFrequencyNote
traceability
```

`shiftHandover24h.presence` 的 dependents：

```text
processNote
contents.vital_signs
contents.abnormal_events
contents.interventions_recorded
contents.follow_up
contents.family_communication
contents.medical_transfer
```

Parent 不是 `provided + present` 时，只要任一 dependent 出现 provided value、unavailable assertion、
verified/expired status 或非空 evidenceIds，整条 V1.2 record 必须以稳定 relation error 失败；不得自动清理、
改值或补默认值。

Parent 为 `provided + present` 时，各 child verification 仍独立，不继承 parent verification。Display 不得合成
section-level “全部已核验”；parent/child 的 unverified、current_verified、expired 必须分别展示，避免把一个
字段的核验扩大到整个护理流程。

## 10. Nursing Record Contract

### 10.1 Presence

`careRecord.presence` 只回答机构是否存在护理记录制度或记录表流程。它不证明：

- 记录完整；
- 每位老人均按时记录；
- 记录可追溯；
- 护理质量高；
- 具备任何医疗或特殊护理能力。

### 10.2 Completeness and Criteria Lock

`careRecord.completeness` 是独立事实：

```text
complete
  = 在明确版本化 criteria、核验范围和样本范围内，所有 mandatory criteria 均满足

partial
  = 已确认存在护理记录，且同一明确范围内至少一个 mandatory criterion 未满足
```

它不能由 presence、frequency、traceability、机构口头声称、AI、UI 或 Developer 推导，也不能表示所有历史
记录正确、临床内容正确或护理质量高。

强制约束：

```text
CARE_RECORD_COMPLETENESS_REQUIRES_CRITERIA = TRUE
```

任何 provided `complete/partial` 必须同时具有 non-empty、版本化且被当前 Contract addendum/criteria manifest
明确批准的 `completenessCriteriaRef`。Criteria ref 不能是自由生成的说明、文件名或任意 URL。

当前 Product Source 未提供足够细的 mandatory checklist，且本 Contract 不发明 checklist。因此在未来显式
criteria manifest 被产品批准并冻结前：

```text
careRecord.completeness = unknown + null + unverified + empty evidenceIds
careRecord.completenessCriteriaRef = unknown + null + unverified + empty evidenceIds
```

该锁定至少适用于所有真实/生产候选数据。A1-2 初始 validator 必须拒绝没有 approved criteria manifest 的
provided completeness。Mock 也不得伪造 criteria 或把 synthetic completeness 冒充现实核验。

### 10.3 Frequency Code Set

正式模型：

```text
CARE_RECORD_FREQUENCY_MODEL = STABLE_CODE_SET
```

Codes：

| Code | Frozen meaning |
|---|---|
| `per_shift` | 已成文流程要求每个护理班次形成相应常规记录 |
| `daily` | 已成文流程按服务日形成相应常规记录 |
| `event_based` | 定义的护理或异常事件会触发记录 |
| `other` | 存在上述 codes 未覆盖的明确频率制度，必须配套说明 |

这些 code 是可组合事实，不是单选 enum，也没有隐含优劣关系。合法集合包括但不限于：

```text
[per_shift]
[daily]
[event_based]
[per_shift, event_based]
[daily, event_based]
[other]
[per_shift, other]
```

`per_shift` 与 `daily` 不被 Contract 声明为质量等级或互斥关系；若同一机构存在不同记录流程，只要每个 code
都有真实语义和 evidence，可以同时出现。Validator 不得用“更高频覆盖较低频”的方式删除 code。

Canonicalization：

```text
allowed order = per_shift, daily, event_based, other
provided value = non-empty unique list in allowed order
duplicate = validation failure
non-canonical order = validation failure
unknown/unavailable = value null; effective code set empty
```

禁止依赖输入数组顺序产生不同 output。Provider ingestion 或 Domain constructor 必须先通过纯、非变异的
canonicalizer 校验 code、去重并按固定 manifest 排序；任意输入 permutation 产生相同 canonical set。进入不可变
`InstitutionRecordV12` 后，exact validator 不静默修复，直接拒绝仍含 duplicate 或非 canonical order 的记录。

若集合包含 `other`：

```text
otherFrequencyNote = provided + non-empty trimmed text
```

若集合不包含 `other`，`otherFrequencyNote` 必须为
`unknown + null + unverified + empty evidenceIds`，不得把普通运营说明塞入该字段。Unknown 不进入 frequency
code inventory。Frequency 和 note 均不参与 Recommendation。

### 10.4 Traceability

```text
traceable
  = 授权人员可按明确索引维度定位相应护理记录

not_traceable
  = 经明确来源确认，在核验范围内不能按上述方式定位
```

Traceability 不等于公众可访问、记录完整、记录真实或护理质量高；不能由“页面没有附件”推导。

## 11. 24-hour Shift Handover Contract

`shiftHandover24h.presence = provided + present` 只表示存在覆盖全天班次连续衔接的护理交接制度或流程。它不
表示或推导：

- `round_the_clock_care` capability；
- 一对一护理；
- 夜间医生或 24h medical service；
- continuous vital monitoring；
- treatment、emergency 或特殊护理能力；
- 六项 handover content 自动全部 present。

六项内容是固定、独立事实：

| Code | Frozen semantic | Forbidden inference |
|---|---|---|
| `vital_signs` | 交接记录/流程包含生命体征信息类别 | 连续监测、医生在场、医疗级监测能力 |
| `abnormal_events` | 包含异常事件记录类别 | 异常处理一定完善、安全分 |
| `interventions_recorded` | 包含已采取处理措施的记录 | treatment/medical/emergency capability |
| `follow_up` | 包含后续观察或跟进事项 | 已完成跟进、保证时效 |
| `family_communication` | 包含家属沟通记录事实 | 实时、立即或每次通知 |
| `medical_transfer` | 包含必要转医事项或流程记录 | 合作医院质量、救护能力、120 时间、医疗资质 |

`follow_up` 的 canonical owner 是 handover content。V1.2 不再建立语义重复的
`careRecord.followUp`。每项 content 独立拥有 availability、value、verification 和 evidence；不得从 parent
或其他 content 推导。

## 12. Evidence and Verification Contract

CareProcess 复用：

```text
InstitutionField<T>
InstitutionFieldVerification
InstitutionEvidence[]
```

每个 evidence 必须闭包绑定：

```text
same institutionId
same recordRevision
exact fieldPath
typed valueSnapshot
same verificationStatus
same verifiedAt / validUntil
valid source locator
```

Canonical CareProcess field paths：

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

Presence、completeness、traceability、handover content 使用 `stable_code` snapshot；frequency 使用按 canonical
顺序保存的 `stable_code_list`；criteria ref、other note、process note 使用 `text`。Unavailable assertion 的
snapshot 使用 stable code `unavailable`。Verified/expired 必须具有 non-empty evidence；孤立、重复、跨机构、
跨 revision、路径错误、snapshot 不一致或时间不一致的 evidence 使整条 V1.2 record 失败。

允许来源沿用现有 Institution evidence source type：

- `institution_provided`；
- `platform_manual_verification`；
- `official_document`；
- `contract_material`；
- `on_site_verification`。

机构材料本身不自动等于平台 verified。普通 Consultant 口述、用户问卷、AI 回答和 VisitEvaluation 都不能
成为 verified Institution source。

## 13. Expiry and Effective Verification

Expired verification 保留历史 provided value 或历史 unavailable assertion、`verifiedAt`、`validUntil` 与
evidence binding，但 public display 必须明确“此前资料已过核验有效期”或后续 UI Contract 冻结的等价文案。

禁止把 expired 转换为：

```text
false
unknown
unavailable
unsupported
current verified
```

Domain validator 只验证 ISO timestamp、stored status shape、evidence closure 和时间关系。Display projector 在
调用方显式传入的 `evaluationAsOf` 下确定 `current_verified / unverified / expired`。仅时间自然经过
`validUntil` 不修改 stored record，也不产生新 revision。

## 14. Parent Revision and Evidence Maintenance

`InstitutionRecordV12` 是不可变、可审计的完整业务快照。以下持久化变化必须创建新的父
`recordRevision`：

| Change | Bump parent revision |
|---|---|
| CareProcess fact value | yes |
| availability | yes |
| stored verification status | yes |
| business evidence ID/binding/source/valueSnapshot | yes |
| `verifiedAt` / `validUntil` | yes |
| fact unchanged but formally reverified | yes |
| only time passes beyond `validUntil` | no |
| UI wording, display order or formatting | no |
| internal storage migration with identical semantic binding | no |

内部文件位置迁移、附件存储迁移或不影响业务 binding 的 metadata 修复不 bump Institution revision。只要
evidence semantic binding、valueSnapshot、verification、`verifiedAt` 或 `validUntil` 改变，就属于业务快照
变化并必须 bump。

旧 revision 不覆盖、不重写；consumer 不能通过最大 revision 数字猜 current head，current dataset/head 必须
显式提供。

## 15. V1.2 to V1.1 Projection

正式概念函数：

```text
projectInstitutionRecordV12ToV11(record)
```

投影必须：

1. 先通过 exact `InstitutionRecordV12` validator；
2. 按 frozen V1.1 root/child manifest 显式 allowlist 复制；
3. 输出 `contractVersion = institution-contract-v1.1`；
4. 保留完全相同的 `institutionId + recordRevision`；
5. 保留全部 V1.1 facts、Capability V1、operations 与合法 V1.1 evidence；
6. 明确排除 `careProcess`；
7. 明确排除所有 `fieldPath` 以 `careProcess.` 开头的 evidence；
8. 不修改输入；
9. 不补默认值、不重解释 unknown/unavailable、不推导 Capability；
10. 结果重新通过 exact V1.1 validator；
11. 任何一步失败则整体返回稳定 projection error，不返回部分对象。

禁止实现方式：

```text
spread record then delete careProcess
JSON clone/filter
structural duck typing
silent downgrade
fallback latest revision
```

Projection 不能删除 V1.1 hard-conflict 信息，不能补造 capability、room、meal、medical、price 或其他 Safety
fact，也不能将 CareProcess evidence 留成 V1.1 orphan evidence。

## 16. Recommendation V2 Isolation and Parity

冻结：

```text
CARE_PROCESS_MATCHING_ROLE = DISPLAY_EXPLAINABLE_ONLY
CARE_PROCESS_RECOMMENDATION_WEIGHT = NOT_APPLICABLE
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
```

CareProcess 不得进入或改变：

- eligibility / hard filter；
- Safety Core；
- `EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE`；
- PriorityFitVector；
- Rank Tuple、tie-break 或 candidate ordering；
- reason/difference selection 或排序；
- `NO_EXACT_MATCH`；
- cards 上限或候选补足；
- Institution Capability V1 status。

未来 A1-2 必须证明：同一 ElderProfile、相同 `evaluationAsOf`、相同 dataset/policy 下，等价 V11 与
`projectInstitutionRecordV12ToV11(V12)` 的匹配业务结果一致，包括 eligibility、tier、priority fit、rank
tuple、reason、difference 和 candidate order。

同 identity/revision 的 parity fixture 应全结果 deep-equal。真实 CareProcess 变化会按 §14 创建新
`recordRevision`，此时 Recommendation source identity/manifest 可合法变化，但匹配业务语义仍须一致；不得
错误宣称含 provenance identity 的完整对象跨 revision deep-equal。

若未来产品希望 CareProcess 参与推荐，必须发布新的 Recommendation Contract/Ruleset successor并重新执行
Safety、evidence、determinism 与真机 Gate，不能修改 frozen V2。

## 17. Explicit Schema Dispatch

必须依据 root `contractVersion` 精确分派：

```text
institution-contract-v1.1
  -> validateInstitutionRecordV11
  -> V1.1 projector

institution-contract-v1.2
  -> validateInstitutionRecordV12
  -> V1.2 projector
  -> Recommendation path only: project V12 to V11

unknown / missing / malformed
  -> fail closed with stable error
```

禁止 `'careProcess' in record`、字段存在推断、latest fallback、silent downgrade、部分接受或自动排除 invalid
record。Current catalog 任一 record 不合法时整池失败；historical exact lookup 失败时不得用其他 revision
替代。

## 18. A0 Application and Navigation Compatibility

A0 canonical identity、List/Detail route parameters、rapid-action guard、Back 行为和 exact resolver 语义保持
不变。未来链路必须为：

```text
Provider
  -> explicit contractVersion dispatch
  -> exact version validator
  -> version projector
  -> stable application snapshot
  -> Page/ViewModel
```

Page/ViewModel 不读取 raw Institution V1.1/V1.2 record，不判断 schema，不访问 Mock，不解释 verification，
不做 latest fallback。A0 Application Snapshot 名称中的 `V12` 是应用 snapshot version；实现注释和类型命名
必须避免与 Domain `InstitutionRecordV12` 混淆。

本 Contract 不修改任何 A0 type、service、resolver、Page、WXML、Less 或 navigation 文件。后续 A1-3/A1-4
必须分别完成 application migration 与 UI regression。

## 19. V1.1 Current and Historical Detail Policy

V1.1 record 保留原 contractVersion、identity、revision 与原始 shape，不原地补 `careProcess`。

冻结 H3：

- 普通 current V1.1 direct Detail：CareProcess section `HIDDEN`；
- historical/pinned V1.1 Detail：若需要解释版本差异，可显示
  `not_applicable_for_schema`；
- 推荐中性语义：“该版本机构资料尚未包含护理管理信息”；
- 禁止显示“机构暂无护理记录”“机构未实行交接班”或任何负面事实；
- current V1.2 record 不得自动替换历史/pinned V1.1 identity。

V1.2 全部事实 unknown 仍是合法 `available_for_schema` section，不是“机构没有”。

## 20. Public Detail Projection and Display Semantics

未来 Detail application snapshot 可以增加稳定 CareProcess section，但本阶段不冻结具体视觉 UI。Public
projection 最多包含：

- 护理记录存在性；
- 完整性及 criteria 状态；
- 频率 code set；
- 可追溯性；
- 24h交接存在性；
- 六项交接内容；
- 每个字段的 availability/effective verification display state；
- 产品批准的 date-only verification date。

建议的事实语义边界：

| Domain state | Required meaning | Forbidden wording |
|---|---|---|
| provided + present + current_verified | 已核验存在 | 保证质量、能力更强 |
| provided + present + unverified | 机构资料称存在，待平台核验 | 已核验存在 |
| provided + present + expired | 此前资料称存在，核验已过期 | 当前仍然存在 |
| provided + absent + current_verified | 已确认暂无 | 暂未提供 |
| provided + absent + unverified | 机构资料称暂无，待平台核验 | 已确认没有 |
| unknown + null + unverified | 暂未获得明确资料 | 没有、不支持 |
| unavailable + null + current_verified | 已核验该资料项不可取得/不适用 | 机构没有 |
| provided/unavailable + expired | 历史断言已过核验有效期 | current verified |

各叶子字段独立显示 verification；不得从一个 verified 字段合成 section-level “护理管理已核验”。

### 20.1 Public Verification Date

冻结 D1：消费者 Detail 对 current-verified 或 expired CareProcess 字段最多显示日期粒度核验日期。禁止公开：

- 小时、分钟、秒；
- evidence source locator；
- 内部核验人员；
- 附件位置、原始文件名；
- 敏感 evidence metadata。

日期必须由相应字段已通过 ISO timestamp validator 的 `verifiedAt` 确定性投影，不得以 `asOf`、页面打开时间
或 section 内其他字段时间代替。Canonical public date 取 validated `verifiedAt` 自身携带时区/offset 下的
`YYYY-MM-DD` calendar-date segment；不得按设备 locale/timezone 二次换日。具体中文排版可在 A1-4 UI Contract
冻结，但不得改变该日期值，也不得合成一个无来源的 section-level “最近更新”。

## 21. Care Quality and Rating Prohibition

冻结：

```text
CARE_QUALITY_SCORE = FORBIDDEN_V1_2
PUBLIC_INSTITUTION_RATING = DISABLED
```

不得根据护理记录、完整性、频率、可追溯性、交接班、生命体征、异常事件、处理措施、后续跟进或家属沟通
生成护理质量分、透明度分、安全分、专业度分、综合分、星级或公开评价排序。

## 22. Privacy and Evidence Media Boundary

护理记录可能包含真实老人姓名、病情、生命体征、护理事件、员工信息、原始照片或记录表。冻结：

```text
PUBLIC_CARE_PROCESS_EVIDENCE_RAW_ACCESS = FORBIDDEN
```

运营可以在未来受控 persistence 中保留内部 evidence；Public projection 只能输出结构化核验结论和被批准的
date-only 状态，不返回：

- raw InstitutionEvidence；
- evidence ID 或 sourceReference；
- 原图、原文、附件 URL、内部文件名；
- 老人 PII/PHI；
- 员工个人信息或内部运营备注。

若未来要公开已脱敏证据媒体，必须另行冻结媒体分类、授权、脱敏、审计和失效规则。本 Contract 不授权。

## 23. VisitEvaluation and Consultant Boundary

未来用户看院时观察到护理记录、交接、生命体征或异常处理，只能进入：

```text
USER_REPORTED_VISIT_OBSERVATION
```

它不得直接 patch `InstitutionCareProcessV1`、改变 verification/evidence、改变 Recommendation 或覆盖已发布
Institution revision。唯一合法未来路径：

```text
VisitEvaluation
  -> authorized manual verification
  -> optional future VerificationLead
  -> new Institution recordRevision
```

普通 Consultant 反馈同样不自动成为 verified source。VerificationLead 仍为 FUTURE_OPTIONAL，本阶段不实现。

## 24. Mock and Dataset Migration Policy

未来 V1.2 development catalog 只能使用 `SYNTHETIC_DEVELOPMENT_ONLY` CareProcess，继续满足文件、记录、UI
三层 Mock disclosure。不得：

- 使用真实武汉机构护理制度或品牌事实；
- 伪造真实护理记录表、照片或文档；
- 伪造员工、老人姓名或健康数据；
- 伪造 production VERIFIED evidence；
- 为展示效果把 unknown 填成 present/absent/unavailable；
- 生成 CareProcess quality/recommendation 标记；
- 添加虚构 VR。

V1.1 的 8 条 development records 迁移到 V1.2 时必须创建新的 canonical V1.2 revision；不能原地改旧 V1.1
revision。新增结构 required，但没有事实来源时全部使用 `unknown + null + unverified + empty evidenceIds`。
这表示“没有明确资料”，不是“机构没有”。Completeness 继续受 §10.2 criteria lock。

## 25. Required, Conditional and Exact-shape Policy

V1.2 exact shape 要求：

- root `careProcess` required；
- `careProcess.schemaVersion` required；
- `careRecord`、`shiftHandover24h`、`contents` required；
- 所有事实 wrapper required；
- `completenessCriteriaRef`、`otherFrequencyNote`、`processNote` wrapper required；
- unknown 使用显式 `unknown + null + unverified + empty evidenceIds`，不使用 missing property；
- `InstitutionField.asOf` 延续 V1.1 optional；
- verified 的 `validUntil` 延续 optional；expired 的 `validUntil` required；
- verified/expired evidenceIds non-empty；
- 不接受额外未知 key。

Conditional invariants：

1. parent 不是 `provided + present` 时，所有 dependents 遵守 §9 unknown-only 规则；
2. provided frequency code set 必须非空、唯一、canonical ordered；
3. non-provided frequency 的 `value` 必须为 null，有效 codes 为空；
4. frequency 含 `other` 时 `otherFrequencyNote` 必须 provided、trim 后非空；
5. frequency 不含 `other` 时 note 必须 unknown-only；
6. 当前没有 approved completeness criteria manifest，真实/生产 completeness 与 criteria ref 必须 unknown-only；
7. 每个 verified/expired fact，以及任何 `evidenceIds` 非空的 fact，都必须具有精确 evidence closure；
   `provided + unverified` 继续允许 empty evidenceIds；
8. `unknown` 只允许 unverified + empty evidenceIds；
9. child schema 与 root V1.2 组合固定；
10. contradiction 使整条 record 失败，validator 不自动修复、排序、去重或补默认值。

## 26. Stable Error Families

未来 A1-2 validator/projector 至少使用稳定 code：

```text
INVALID_V12_RECORD_SHAPE
INVALID_CARE_PROCESS_SHAPE
INVALID_CARE_PROCESS_FACT
INVALID_CARE_PROCESS_RELATION
INVALID_CARE_RECORD_FREQUENCY
INVALID_CARE_RECORD_COMPLETENESS_CRITERIA
INVALID_CARE_PROCESS_EVIDENCE
UNSUPPORTED_INSTITUTION_CONTRACT_VERSION
V12_TO_V11_PROJECTION_FAILED
```

Field path 可用于定位，但调用方不得依赖自由文本判断。错误不得泄露完整 Institution record、原始 evidence、
PII/PHI 或内部 source locator。

## 27. Implementation Sequence

本 Contract 冻结后，依赖顺序为：

1. **A1-2 — Domain runtime**：V1.2 types、exact validator、evidence closure、schema dispatch、V12→V11
   projector、parity/isolation gates；不做 UI。
2. **A1-3 — Development catalog/application**：synthetic V1.2 Mock migration、provider/catalog、stable
   application projection；不接 Backend。
3. **A1-4 — Detail projection/UI**：在独立 UI Contract 下实现 CareProcess section；不改 Recommendation。
4. **A1-5 — Final validation**：完整 runtime regression、DevTools、Android 真机和 QA。

禁止跳过 A1-2 直接实现 UI。

## 28. Required Future Regression Gates

A1-2 至少新增：

1. valid V1.2 exact record；
2. all-unknown/unverified CareProcess；
3. positive/negative/unknown/unavailable matrix；
4. stored verified/expired 与 time-expired projection；
5. invalid root/child version；
6. exact-key violations；
7. all parent/dependent contradictions；
8. frequency single/multiple code combinations；
9. duplicate、non-canonical order、empty provided frequency；
10. `other` with/without note；
11. completeness locked without approved criteria；
12. six independent handover facts；
13. evidence institution/revision/path/value/status/time errors；
14. orphan/missing/duplicate CareProcess evidence；
15. deterministic repeated deepEqual and input immutability；
16. explicit unsupported-version failure；
17. V1.1 historical record unchanged；
18. V12→V11 exact output and V1.1 validation；
19. CareProcess/evidence completely absent from projection；
20. equivalent V11/V12 Recommendation V2 parity；
21. CareProcess mutation isolation from matching semantics；
22. forbidden import/identifier scan in Recommendation Domain；
23. Mock migration never defaults unknown to negative/verified；
24. no quality/rating/recommendation score identifiers。

既有 Institution V1/V1.1、Recommendation V1/V2、Assessment、ElderProfile、Preview、Profile、A0 canonical
resolver/List/Detail/navigation 与 V1.1 main flow gates 必须继续 PASS。DevTools、Android 人工验证与 automated
evidence 必须分别标注。

## 29. Frozen Scope Boundary

本次 Freeze 明确为 0：

```text
InstitutionRecordV12 production TypeScript
V1.2 runtime validator or projector
schema dispatch implementation
CareProcess Mock or catalog migration
CareProcess application snapshot or UI
Recommendation V2 change
Institution Capability V1 change
Care quality score or public rating
Consultant / AI
Appointment / Visit / VisitEvaluation implementation
Backend / persistence / API
real Wuhan Institution data
wx.request / login / phone authorization
```

`INSTITUTION_CONTRACT_V1_2 = FROZEN_PHASE_V1_2_A1` 只授权按 §27 顺序进入下一阶段；不代表任何 runtime、
DevTools 或 Android 实现已经完成。
