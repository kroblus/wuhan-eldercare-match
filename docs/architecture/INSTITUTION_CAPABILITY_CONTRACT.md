# Institution Capability Contract V1

状态：`FROZEN_PHASE_4A_2`

版本：`institution-capability-contract-v1`

本文件冻结机构护理能力的稳定 code、四态值、字段级核验门槛、字段用途分类和 ElderProfile 覆盖矩阵。它不是 Recommendation Contract，不决定 hard filter、排序、分数、推荐理由或 `NO_EXACT_MATCH`。

## 1. CapabilityStatus

冻结状态：

```text
supported
requires_assessment
unsupported
unknown
```

| status | 业务语义 | 不能解释为 |
| --- | --- | --- |
| `supported` | 有当前有效、已核验事实证明机构支持该能力 | “可能支持”、页面有标签、机构类型暗示 |
| `requires_assessment` | 有当前有效、已核验事实证明必须结合老人情况逐案评估，不能承诺普遍支持 | supported、unsupported |
| `unsupported` | 有当前有效、已核验事实明确证明当前不支持 | 字段缺失、未回复、unknown |
| `unknown` | 平台没有足够当前资料形成结论 | false、unsupported、requires_assessment |

上表定义平台可声明的 effective 语义。导入层允许暂存同 code 的 raw candidate，但 raw determinate value 在 verification projection 前不得展示为确定事实或进入 future Matching。

禁止转换：

```text
unknown -> unsupported
requires_assessment -> supported
missing -> false
unverified assertion -> verified capability
```

### 1.1 CapabilityStatus is not VerificationStatus

两条轴必须同时存在：

```text
CapabilityStatus    = 机构能力值表达什么
VerificationStatus  = 平台是否接受了支撑该值的当前证据
```

持久化 raw value 与可供 future Matching 消费的 effective value 不同。例如导入材料可能暂时记录 raw `tube_feeding.status = supported`，但在 `verification.status = unverified` 时：

- 不能进入生产推荐；
- 不能显示为已核验支持；
- 不能生成 RecommendationReason；
- 只能等待核验或回退为不可用于决策的资料。

冻结 projection：`supported`、`requires_assessment`、`unsupported` 只有同时拥有截至显式 `evaluationAsOf` 当前有效的字段级 `verified`，effective status 才保留 raw 值；unverified、expired 或过期 validUntil 一律投影为 effective `unknown`。raw `unknown` 永远投影为 `unknown`。

## 2. Care Level Acceptance

ElderProfile 已冻结五档：

```text
independent
light_care
semi_disabled
disabled
severely_disabled
```

PRD 机构侧只明确列出自理、半失能、失能、重度失能，没有单列轻度照护。禁止：

```text
light_care = independent
light_care = semi_disabled
```

机构接收矩阵保存完整五档，并由运营逐家独立核验：

```text
capabilities.careLevelAcceptance.independent
capabilities.careLevelAcceptance.light_care
capabilities.careLevelAcceptance.semi_disabled
capabilities.careLevelAcceptance.disabled
capabilities.careLevelAcceptance.severely_disabled
```

每档独立使用 CapabilityStatus。没有轻度照护资料时必须为 unknown，不能 alias。

careLevel 只表达生活功能依赖，不证明疾病、认知症、鼻饲、导尿、压疮或机构最终接收承诺；具体专项能力必须继续单独核对。

## 3. Institution Type

类型 code 与 Assessment 偏好同名：

```text
active_aging
medical_nursing_integrated
disability_care
dementia_care
rehabilitation_care
```

但两侧含义不同：

- ElderProfile `preferredInstitutionType` 是用户单选偏好；
- Institution `primaryType` 是 optional display positioning；
- Institution `supportedTypes` 是多个经核验定位 code。

冻结 `supportedTypes` 为 future Matching 唯一类型事实；`primaryType` 可以 absent，存在时必须属于 supportedTypes，且默认只用于展示。任何 type 都不是护理能力 shortcut，例如：

```text
medical_nursing_integrated != tube_feeding supported
dementia_care != wandering_risk_support supported
rehabilitation_care != rehabilitation_training supported
```

## 4. Minimum Matching Capability Set

### 4.1 Care Acceptance

完整五档矩阵是 V1 最小集合的一部分。

### 4.2 Mobility / Functional Support

V1 `MATCHING_CRITICAL` 最小集合：

```text
wheelchair_support
bedbound_support
transfer_support
```

理由：

- wheelchair、bedbound 是 ElderProfile 明确 mobility fact；
- transfer_support 来自核心转移依赖，对实际照护资源有独立意义；
- 三者在 PRD 的“轮椅、卧床、日常护理/无障碍”中有依据。

暂不将下列 ADL care mode 逐项复制为 hard capability：

```text
walking_aid
feeding_assistance
toileting_assistance
bathing_assistance
dressing_assistance
stairs_assistance
```

其中 feeding/toileting/bathing 等仍可作为 `services[] / InstitutionServiceOffering` 的 `DISPLAY_SUPPORTING` 事实；walking aid 由房屋无障碍、照护等级和现场评估共同影响，当前没有独立 hard-acceptance PRD 证据。未来出现真实业务拒收条件时再走 Contract 变更，不能为了字段对称扩张。

### 4.3 Cognitive Support

必须分开：

```text
capabilities.cognitiveSupport.dementia_acceptance
capabilities.cognitiveSupport.wandering_risk_support
capabilities.specialCare.dementia_unit
```

- `dementia_acceptance`：机构是否接收已报告/已确诊认知症老人；
- `wandering_risk_support`：是否具备接收和照护高走失风险老人的明确能力；
- `dementia_unit`：是否提供认知症专区这一具体服务/空间能力。

“能接收认知症”不等于有专区，也不等于能安全接收高走失风险。

### 4.4 Special Care

机构 code 与 ElderProfile 九项 requirement code 一一对齐：

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

对齐只复用 stable code，不复用对象类型：

```text
ElderProfile status = required | not_required | not_reported | unknown | needs_confirmation
Institution status  = supported | requires_assessment | unsupported | unknown
```

两者不能互相赋值，也不能由 TypeScript structural coincidence 冒充同一对象。

## 5. Special Feeding and Catheter Boundaries

冻结边界继续有效：

```text
ADL special_feeding != tube_feeding
ADL catheter_or_stoma != catheter_care
```

- `special_feeding` 只产生进一步确认线索；不能要求或证明机构鼻饲能力；
- `catheter_or_stoma` 可能包含造瘘等不同情况；不能直接等同导尿护理；
- 只有 ElderProfile `specialCare` 中对应 capability `required` 才是明确 requirement；
- Institution 不增加 `special_feeding_support = tube_feeding` shortcut。

当前 PRD 没有足够语义定义一个更广义 `special_feeding_support`。V1 不增加该字段，避免掩盖鼻饲与其他进食方式差异。

## 6. Medical Support

PRD 支持保存以下可核验事实：

```text
doctorRounds
nurseStaff
nurseStation
partnerHospitals
emergencyTransferSupport
```

建议结构：

- 医生巡诊、护士、护士站使用 provided/unknown/unavailable + present/absent + verification；
- 合作医院保存名称/关系说明及 verification；
- 紧急送医使用独立 CapabilityStatus；
- 人员数量、护理员比例只有真实数据时保存，并保留 asOf。

不提案 `medical_support_level`。没有产品规则时，“有护士站”“有合作医院”不能合成 `advanced` 等模糊等级。当前这些字段是 `DISPLAY_SUPPORTING`，尚无 ElderProfile 直接医疗 hard requirement；未来用于偏好排序也必须由 Recommendation Contract 明确批准。

## 7. Rehabilitation

matching-critical 能力：

```text
capabilities.specialCare.rehabilitation_training
```

展示型康复事实：

```text
rehabilitation_therapist
rehabilitation_room
postoperative_rehabilitation
limb_function_training
cognitive_training
```

禁止：

```text
rehabilitation_room present -> rehabilitation_training supported
rehabilitation_therapist present -> all rehabilitation supported
institution type rehabilitation_care -> capability supported
```

`rehabilitation_training` 必须有自己的 fieldPath 和 verified evidence。其它事实用于页面说明或未来证据交叉核查，不自动生成该能力。

## 8. Daily Care Services

PRD 的起居、洗澡、翻身、喂饭、如厕、夜间巡查、陪诊、紧急处理映射为：

```text
daily_living_support
bathing_assistance
turning_assistance
feeding_assistance
toileting_assistance
night_rounds
medical_escort
emergency_response
```

这些默认 `DISPLAY_SUPPORTING`。`night_rounds` 不等于 `night_care`；`emergency_response` 不等于有合作医院或可以紧急送医。字段存在是为了真实详情和解释，不代表 matching 可以自动读取。

日常服务与护理能力必须保持两套语义：`InstitutionServiceOffering.availability` 描述某项服务是否提供；`InstitutionCapability.status` 描述机构是否具备某项接收/专项照护能力。服务标签不能自动生成 capability，capability 也不能自动生成服务项目。

## 9. Matching-critical Field Allowlist

| path | usage | 说明 |
| --- | --- | --- |
| `identity.regionCode` | MATCHING_CRITICAL | 稳定区域 code；展示名不参与匹配 |
| `typeProfile.supportedTypes` | MATCHING_CRITICAL | 仅消费当前有效 verified 集合；不能替代能力 |
| `typeProfile.primaryType` | DISPLAY_SUPPORTING | optional display positioning，不参与 V1 matching |
| `capabilities.careLevelAcceptance.*` | MATCHING_CRITICAL | 五档逐项 |
| `capabilities.mobilitySupport.*` | MATCHING_CRITICAL | wheelchair/bedbound/transfer |
| `capabilities.cognitiveSupport.*` | MATCHING_CRITICAL | dementia acceptance/wandering |
| `capabilities.specialCare.*` | MATCHING_CRITICAL | 九项逐项 |
| `price.referenceMonthlyPrice` | MATCHING_CRITICAL | 结构化参考区间，unknown 处理延后 |
| `operations.*` | OPERATIONAL_DYNAMIC | 当前不进入默认 matching allowlist |
| `medicalSupport.*` | DISPLAY_SUPPORTING | 当前没有直接 hard requirement |
| `rehabilitationSupport.features.*` | DISPLAY_SUPPORTING | 不替代 rehabilitation_training |
| `rooms/media/vr/qualifications` | DISPLAY_SUPPORTING | 不作为护理 hard constraint |
| `evidence/*` | AUDIT_ONLY | 用于证明匹配事实，不直接成为权重 |

未来 Recommendation 不得遍历全部字段或解析中文标签；必须使用冻结版本化 allowlist。`InstitutionMatchingCriticalFieldPath` 与 `INSTITUTION_MATCHING_CRITICAL_FIELD_PATHS` 是 V1 唯一集合；记录数据不能自行把任意字段标记成 `MATCHING_CRITICAL`。

## 10. Capability Coverage Matrix

状态定义：

- `DIRECT`：两侧有同义稳定 code/明确字段，可直接形成未来规则输入，但仍需 Recommendation Contract；
- `REQUIRES_MAPPING`：需要一个显式、版本化映射，不能靠结构猜测；
- `MISSING`：机构侧没有可承载字段；
- `NOT_APPLICABLE`：该 ElderProfile 事实不是机构 capability，禁止 shortcut。

| ElderProfile requirement / fact | Institution field | coverage | 边界 |
| --- | --- | --- | --- |
| `careLevel=independent` | `careLevelAcceptance.independent` | DIRECT | 必须 verified |
| `careLevel=light_care` | `careLevelAcceptance.light_care` | DIRECT | 新增运营字段，禁止 alias |
| `careLevel=semi_disabled` | `careLevelAcceptance.semi_disabled` | DIRECT | - |
| `careLevel=disabled` | `careLevelAcceptance.disabled` | DIRECT | - |
| `careLevel=severely_disabled` | `careLevelAcceptance.severely_disabled` | DIRECT | 不代表专项护理 |
| `mobility=wheelchair` | `mobilitySupport.wheelchair_support` | REQUIRES_MAPPING | Elder fact 与机构 capability code 不同；与 careLevel 分开 |
| `mobility=bedbound` | `mobilitySupport.bedbound_support` | REQUIRES_MAPPING | Elder fact 与机构 capability code 不同；与重度失能分开 |
| `careMode=transfer_support/fully_dependent_transfer` | `mobilitySupport.transfer_support` | REQUIRES_MAPPING | 规则强度由 Recommendation Contract 决定 |
| rehabilitation `required/possible` | `specialCare.rehabilitation_training` | REQUIRES_MAPPING | required 与 possible 不能相同处理 |
| reported dementia diagnosis | `cognitiveSupport.dementia_acceptance` | REQUIRES_MAPPING | 用户报告不等于系统诊断，需版本化映射 |
| cognitive concern without diagnosis | `cognitiveSupport.dementia_acceptance` | REQUIRES_MAPPING | 不得直接升级为确诊 |
| wandering risk present | `cognitiveSupport.wandering_risk_support` | REQUIRES_MAPPING | Elder risk fact 与机构 capability code 不同 |
| `round_the_clock_care` | `specialCare.round_the_clock_care` | DIRECT | - |
| `one_to_one_caregiver` | `specialCare.one_to_one_caregiver` | DIRECT | - |
| `night_care` | `specialCare.night_care` | DIRECT | sleep signal 仍是 needs confirmation |
| `dementia_unit` | `specialCare.dementia_unit` | DIRECT | 不等于 dementia acceptance |
| `rehabilitation_training` | `specialCare.rehabilitation_training` | DIRECT | - |
| `tube_feeding` | `specialCare.tube_feeding` | DIRECT | - |
| `catheter_care` | `specialCare.catheter_care` | DIRECT | - |
| `pressure_injury_care` | `specialCare.pressure_injury_care` | DIRECT | - |
| `incontinence_care` | `specialCare.incontinence_care` | DIRECT | - |
| ADL `special_feeding` clue | none | NOT_APPLICABLE | 必须先澄清，不能映射 tube feeding |
| ADL `catheter_or_stoma` clue | none | NOT_APPLICABLE | 必须先澄清，不能映射 catheter care |

```text
MISSING = 0
```

该结论只证明 Institution Contract 能保存未来规则需要的事实，不证明推荐规则已设计。

### 10.1 Frozen Mapping Intent

下表只冻结 future target，不执行比较或产生结果：

| ElderProfile source intent | Institution future target |
| --- | --- |
| `mobility.level = wheelchair` | `capabilities.mobilitySupport.wheelchair_support` |
| `mobility.level = bedbound` | `capabilities.mobilitySupport.bedbound_support` |
| `adl.careModes = transfer_support / fully_dependent_transfer` | `capabilities.mobilitySupport.transfer_support` |
| health rehabilitation `required / possible` | `capabilities.specialCare.rehabilitation_training` |
| reported cognitive diagnosis/concern | `capabilities.cognitiveSupport.dementia_acceptance` |
| `cognition.wanderingRisk = present` | `capabilities.cognitiveSupport.wandering_risk_support` |

本阶段禁止实现 `if elder requirement + institution status -> reject/score/rank`。`special_feeding` 与 `catheter_or_stoma` 仍是 `NOT_APPLICABLE` clarification 边界，不能自动生成 tube feeding/catheter care requirement。

## 11. Unknown Matrix

本阶段只保存信息对，不决定匹配结果：

| Elder requirement | Institution CapabilityStatus | 本阶段可表达的信息 | future outcome |
| --- | --- | --- | --- |
| `required` | `supported` | 机构声明支持；仍检查 field-level verification | DEFERRED_TO_RECOMMENDATION_CONTRACT |
| `required` | `requires_assessment` | 需要个案评估，不能当 supported | DEFERRED_TO_RECOMMENDATION_CONTRACT |
| `required` | `unsupported` | 机构明确不支持；负向事实仍需 verified | DEFERRED_TO_RECOMMENDATION_CONTRACT |
| `required` | `unknown` | 机构资料不足，不等于不支持 | DEFERRED_TO_RECOMMENDATION_CONTRACT |
| `needs_confirmation` | any | 老人侧需求尚未澄清 | DEFERRED_TO_RECOMMENDATION_CONTRACT |
| `unknown` | any | 老人侧没有可确定 requirement | DEFERRED_TO_RECOMMENDATION_CONTRACT |

特别是：

```text
required + unknown -> ?
required + requires_assessment -> ?
```

必须由 Recommendation Contract 明确 hard-filter、近似匹配、顾问确认或差异提示策略。本 Contract 不做选择。

## 12. Evidence Locator for Future Reasons

每个确定能力必须能定位：

```text
institutionId
recordRevision
fieldPath
typed valueSnapshot
evidenceId
verifiedAt
validUntil (如有)
```

示例仅说明 locator，不是 RecommendationReason：

```text
institutionId = <real id>
recordRevision = <positive integer>
fieldPath = capabilities.specialCare.night_care
valueSnapshot = { valueType: stable_code, value: supported }
evidenceId = <auditable evidence id>
```

未来“为什么说该机构支持夜间护理”必须解析到上述 evidence，而不是“机构标签含夜护”或 Mock 文案。

runtime validator/API gate 必须同时保证：evidence ID 唯一且可解析、`institutionId` 与所属记录一致、`recordRevision` 精确绑定被核验版本、`fieldPath` 能定位该 revision、typed `valueSnapshot` 与该版本当前值一致、来源定位非空，以及 verified/expired 时间状态合法。V1 不依赖 JCS。只有 `supported/requires_assessment/unsupported + 当前有效 verified evidence` 才能成为 effective 确定事实；raw 结构允许导入待核验资料，不代表允许其进入推荐。

## 13. Frozen Decisions

```text
CAPABILITY_STATUS_MODEL = FROZEN
CARE_LEVEL_ACCEPTANCE = FIVE_LEVEL
PRIMARY_TYPE = OPTIONAL
AVAILABILITY_MATCHING_ROLE = DISPLAY_ONLY_DYNAMIC
FIELD_LEVEL_VERIFICATION_REQUIRED_FOR_MATCHING = TRUE
JCS_CANONICALIZATION_V1 = NOT_REQUIRED
```

Phase 4A-1 的候选分析与独立能力设计理由保留在上述各节；以上为 V1 唯一生效语义。

## 14. Explicitly Deferred

- hard filter 与 soft preference；
- 权重、排序、匹配百分比；
- required + unknown / requires_assessment 的最终处理；
- `NO_EXACT_MATCH`；
- RecommendationReason code 与中文；
- Institution UI、Backend/API/DB；
- 真实 Institution capability 录入。
