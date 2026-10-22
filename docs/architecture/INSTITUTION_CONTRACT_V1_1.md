# Institution Contract V1.1

状态：`FROZEN_PHASE_V1_1_D`

```text
INSTITUTION_CONTRACT_V1_1 = institution-contract-v1.1
INSTITUTION_CAPABILITY_CONTRACT = institution-capability-contract-v1
RECOMMENDATION_CHANGE = 0
UI_CHANGE = 0
BACKEND_CHANGE = 0
REAL_WUHAN_INSTITUTION_DATA = 0
```

本文件冻结 V1.1 Institution Record 的增量事实、运行时校验、证据与版本兼容边界。它不修改
`INSTITUTION_CONTRACT.md` 的 V1 历史语义，不修改护理安全 Capability，不授权 Recommendation、
Institution UI、后端、真实机构资料或持久化实现。

## 1. Source of Truth

1. `docs/product/武汉养老机构精准匹配小程序_V1.1_页面级PRD_更新版.pdf`，重点为 PDF p36–41、p63–67；
2. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.1_更新版.pdf`，重点为 PDF p17–20；
3. frozen `INSTITUTION_CONTRACT.md`；
4. frozen `INSTITUTION_CAPABILITY_CONTRACT.md`；
5. `V1_1_CHANGE_IMPACT_ANALYSIS.md`；
6. frozen `ELDER_PROFILE_CONTRACT_V2.md`；
7. `MOCK_DATA_POLICY.md` 与根目录 `AGENTS.md`。

若 UI 文案、自由文本、旧 DTO 或测试数据与本 Contract 冲突，以本文件的 stable code、unknown、
verification 和版本边界为准。V1.1 只增加可核验机构事实，不把产品关注项直接变成评分。

## 2. Versioning and Record Shape

V1 与 V1.1 并行存在：

```text
InstitutionRecord      -> institution-contract-v1
InstitutionRecordV11   -> institution-contract-v1.1
```

V1.1 复用以下 V1 section，不改变业务含义：

```text
identity / typeProfile / capabilities / services / rehabilitationSupport
price / operations / media / vr / qualifications / evidence
```

V1.1 扩展或新增：

```text
staffing
medicalSupport
healthMonitoring
rooms.features
meal
activity
transportation
majorHospitalAccess
```

V1 validator 继续只接受 V1；V1.1 validator 继续只接受 V1.1。禁止让 V1 validator 静默接受新版本。
V1.1 validator 先形成只含 V1 字段的显式投影并通过 frozen V1 validator，再校验所有 extension 和
extension evidence。

## 3. Universal Field Semantics

所有新增叶子事实使用 frozen `InstitutionField<T>`：

```text
provided    -> value = T
unknown     -> value = null
unavailable -> value = null
```

`verification` 是独立轴。`provided + unverified` 表示来源提供过值但尚不能作为已核验事实；它不等于
unknown，也不得冒充 matching-grade verified。`present/absent` 只可表达来源明确陈述的事实，字段缺失
不能自动变成 `absent`、`false`、0、`unsupported` 或空字符串。

当 value enum 自身含 `unknown` 时，两层语义不得压平：`InstitutionField.availability = unknown` 表示来源
未提供该字段；`availability = provided, value = unknown` 只表示来源明确给出了“状态未知”，并保留其
独立 verification/evidence。二者都不能被转换成 0、false、unavailable 或 supported。

空的 child collection（例如 `relationships[]`、`offerings[]`、`busStops[]`、`majorHospitalAccess[]`）只表示
当前 revision 没有可声明的 child fact，不表示已经核验现实中“不存在”。只有字段级
`provided + absent`，或明确的 `availability = unavailable`，才能陈述对应事实的明确缺失；未来 UI
不得把空数组渲染成“确认没有”。

## 4. Staffing Model

`InstitutionStaffingV11` 保留 V1：

- `counts`：按 `doctor / nurse / caregiver / rehabilitation_therapist / nutritionist / social_worker`
  保存唯一角色数量；这是医生、护士、护理员与康复治疗师人数的唯一 canonical count source；
- `caregiverResidentRatio`：保存分子与分母，不只保存浮点比值。

新增：

- `caregiverCertification.certifiedCaregiverCount`；
- `caregiverCertification.observedCaregiverCount`；
- `caregiverCertification.certifiedRatioBasisPoints`，0–10000；
- `caregiverCertification.certificateTypes`；
- `caregiverCertification.rawStatement`，仅展示；
- `caregiverExperienceDistribution` 四档人数；
- `caregiverExperienceStatement`，仅展示原始陈述；
- `nurseResponseTime` 与 `caregiverResponseTime`；
- `dutyStaffing24h`。

Certification 支持 partial known facts，不要求机构同时提供人数、分母、比例和证书类别。已知持证人数
不得大于已观察人数。经验自由文本不得解析成分布或年限。

响应时间固定保存 `responseTimeMinutes + scenario + statistic + measurementNote` 四个独立字段。没有
统一测量场景或统计口径时保持 unknown，禁止把“响应及时”转换为分钟数。

`dutyStaffing24h`、`medicalSupport.medicalDuty24h` 与
`capabilities.specialCare.round_the_clock_care` 是三个不同事实，禁止互相推导。

## 5. Medical Model

V1 字段 `doctorRounds / nurseStaff / nurseStation / partnerHospitals /
emergencyTransferSupport` 原样保留。V1.1 新增：

- `clinic`；
- `relationships[]`，每项具有 stable `relationshipId`、字段级 `relationshipType`、
  `organizationName` 与 `relationshipNote`；
- relationship type：`community_health_center / owned_hospital / partner_hospital`；
- `medicalDuty24h` 与 `medicalDuty24hNote`。

医生/护士数量来自 `staffing.counts`，避免第二套重复 source。合作医院不能推导 24 小时医生；护士站、
医务室、医疗关系、医疗值守和紧急送医彼此独立。V1 的 `emergencyTransferSupport` 形状保持不变，
不得借本阶段将全部医疗事实升级为护理安全能力。

## 6. Health Monitoring Model

`InstitutionHealthMonitoringV11` 固定三项：

```text
bloodPressure
bloodOxygen
bloodGlucose
```

每项包含：

```text
availability: available | unavailable | requires_inquiry | unknown
frequency: daily | weekly | on_demand | other | unknown
serviceNote
```

外层 `InstitutionField` 仍区分“资料未提供”和“来源明确表示 unknown”。检测频率只描述事实；`daily`
不得推导医疗水平、护理能力或排序优势。

## 7. Room Extension

每个 `InstitutionRoomV11` 保留 V1 房型、面积、床型、独卫、空调、衣柜、电视、呼叫系统、阳台、
无障碍、参考房费和媒体引用。新增设施：

```text
electricCurtain
refrigerator
bedsideTableOrFoldBoard
wheelchairOrAssistiveEquipment
smartSpeakerOrRadio
magnifier
calligraphyOrPersonalItems
```

每项是 `InstitutionField<present | absent>`。缺失必须为 unknown/unavailable + null，不得为了页面完整
补 present/absent。房间设施不得推导轮椅、转移或失能护理能力。

## 8. Meal Model

`InstitutionMealV11`：

- `mealSchedule`：`three_meals / three_meals_one_snack / three_meals_two_snacks / other / unknown`；
- `easyChewSupport`；
- `modifiedFoodSupport`；
- `mealFee`；
- `specialDietExtraFee`；
- `serviceNote`。

服务可用性使用独立 `available / unavailable / requires_inquiry / unknown`，不复用护理 CapabilityStatus。
`easyChewSupport` 与 `modifiedFoodSupport` 为生活服务事实，当前仅可解释展示；二者永不等于或推导
`tube_feeding`。费用分别核验，不补 0，也不自动写入参考总价。

## 9. Activity and Zone Model

`InstitutionActivityV11` 包含 `indoorSpace`、`outdoorSpace`、稳定 ID 的 `offerings[]` 及 zones。
活动 code 固定为：

```text
dance / calligraphy / arts_crafts / chess_cards / general_activity / music / fitness
```

zone 固定为：

```text
publicActivityZone / activeAgingZone / careZone / dementiaZone
```

`dementiaZone` 是空间展示事实，不替代或证明 frozen
`capabilities.specialCare.dementia_unit`。本 Contract 不存在 `activityScore` 或 `environmentScore`。

## 10. Transportation Model

`InstitutionTransportationV11`：

- `metro.nearestStationName / distanceMeters / routeNote`；
- `busStops[]`：stable `busStopId`、stop name、distance 与 route summary；
- `vehicleAccess.availability / accessNote`。

交通距离必须是 finite positive safe integer；unknown 使用 null，不能用 0 占位。metro/bus 结构没有
同址 method/source，因此不接受 0；真实同址距离只能使用下节可核验的 hospital `co_located` 结构。
交通尚无用户出发点、统一步行/道路口径或 comparator，本阶段不存在 `transportScore`。

## 11. Major Hospital Access

每项 `InstitutionMajorHospitalAccessV11` 具有 stable `hospitalAccessId`：

```text
hospitalName
hospitalCategory
distanceMeters
distanceMethod
distanceSource
travelTimeMinutes
travelMode
```

Category 只能为 `tertiary_grade_a / other_tertiary / other_documented_category` 或 field unknown。
Distance method 只能为 `straight_line / road_route / co_located / other_documented_method`。

提供 `distanceMeters` 时必须同时提供 method 与 source。0 仅在 method=`co_located` 时合法；正距离不得
使用 `co_located`。Travel time 独立核验，不由距离推导。V1.1 不冻结“大型医院”阈值或好/中/差，
`NEAR_MAJOR_HOSPITAL_PRIORITY = NOT_YET_SCORABLE`。

## 12. Price Component Model

V1 已完整支持并由 V1.1 继续复用：

- `referenceMonthlyPrice`：bounded 或 starting_at 的 reference total；
- monthly components：`bed_fee / care_fee / meal_fee / management_fee /
  special_care_fee / other_fee`；
- `deposit`；
- stable-ID `oneTimeFees[]`；
- `adjustmentFactors` 与 `priceNote`。

所有已提供金额为 CNY minor-unit positive safe integer；unknown/unavailable 值为 null，禁止用 0。
月费与一次性费用 period 必须分开。Validator 只验证结构与证据，绝不执行：

```text
referenceMonthlyPrice = sum(recurringComponents)
```

参考总价、component、room reference price、meal fee 与 special diet fee 分别保留来源和 verification。

## 13. Verification and Evidence

V1.1 继续使用 root `evidence[]`，每个新增叶子字段绑定：

```text
institutionId
recordRevision
fieldPath
typed valueSnapshot
verificationStatus
observedAt / verifiedAt / validUntil
source locator
```

Extension 使用现有 primitive snapshot discriminator：`stable_code / stable_code_list / text /
integer / money_range`。Evidence ID 全记录唯一；revision、status、时间、fieldPath 和 snapshot 值必须与
字段一致。verified/expired 必须有非空 evidence，孤立 extension evidence 被拒绝。

生产持久化未来应保留 stable child ID 与不可变 record revision。数组 index 只用于当前 snapshot 的
fieldPath，不得作为数据库实体身份。`recordRevision` 变化时 evidence 必须随新 revision 重建。

## 14. V1.1 Institution Field Matching Role Matrix

| Field | Role | Current boundary |
|---|---|---|
| `rooms.*.roomType` | `MATCHING_CANDIDATE` | 未来经核验的 room preference 比较；非护理硬条件 |
| `meal.mealSchedule` | `MATCHING_CANDIDATE` | 未来经核验的 meal schedule 比较 |
| `meal.easyChewSupport / modifiedFoodSupport` | `DISPLAY_EXPLAINABLE` | 生活适配说明；不等于鼻饲 |
| `meal.mealFee / specialDietExtraFee / serviceNote` | `DISPLAY_EXPLAINABLE` | 分项展示并独立核验；不自动合计或解析能力 |
| certification / experience / response / staffing duty | `NOT_YET_SCORABLE` | 无统一口径与阈值，不得生成质量分 |
| clinic / medical relationship / medical duty | `DISPLAY_EXPLAINABLE` | 分项事实，不合成医疗质量等级 |
| health monitoring | `DISPLAY_EXPLAINABLE` | 检测事实与频率，不作为质量排序 |
| extended room facilities | `DISPLAY_EXPLAINABLE` | 展示，不推导护理能力 |
| indoor/outdoor activity space | `NOT_YET_SCORABLE` | 尚无 approved comparator |
| activity offering / zone | `DISPLAY_EXPLAINABLE` | 真实存在再展示；不生成 activity/environment score |
| metro / bus / vehicle | `NOT_YET_SCORABLE` | 不生成 transport score |
| hospital distance | `NOT_YET_SCORABLE` | 无医院定义与距离阈值 |
| detailed price components | `DISPLAY_EXPLAINABLE` | 解释费用，不覆盖 reference total |
| operations | `OPERATIONAL_ONLY` | 动态床位等不改变 capability |
| evidence / revision metadata | `AUDIT_ONLY` | 审计，不参与排序 |

以上 role 只分类事实，不是 Recommendation 输入 allowlist。只有未来 Recommendation V2 Contract 明确
批准后，`MATCHING_CANDIDATE` 才能进入 comparator。当前 Recommendation V1/V2 实现变化为 0。

## 15. Capability V1 Preservation

以下全部逐字节语义保持：

- `institution-capability-contract-v1`；
- `supported / requires_assessment / unsupported / unknown`；
- 五档 care-level acceptance；
- wheelchair / bedbound / transfer；
- dementia acceptance / wandering risk；
- 九项 special-care code；
- verification-current projection；
- V1 `INSTITUTION_MATCHING_CRITICAL_FIELD_PATHS`。

新增字段不能进入 capability matrix。特别禁止：dementiaZone→dementia_unit、modifiedFood→tube_feeding、
康复师/康复室→rehabilitation_training、partner hospital→24h medical duty。

## 16. Development Catalog Migration

`miniprogram/mock/institution-catalog.mock.ts` 内 8 条 App Development Catalog 的 canonical record 已迁移
为 V1.1。所有新增 section 均显式存在，默认使用 unknown/unavailable + null 与 unverified；不创建人员、
膳食、医院、活动、交通、房间、媒体或 VR 的漂亮假数据。

当前冻结 Recommendation V1 不能接收 `institution-contract-v1.1`。过渡期只允许：

```text
canonical V1.1 development record
  -> validateInstitutionRecordV11
  -> projectInstitutionRecordV11ToV1
  -> existing V1 catalog service / Recommendation V1
```

投影只复制 V1 字段、把 contract version 标为 V1，并过滤 V1.1 extension evidence；它不推导、不补值、
不把 extension 变成 capability、price 或 reason。V1.1 canonical catalog 与 V1 compatibility view 分别导出，
避免未版本化 service type 掩盖 incompatibility。

所有记录继续满足文件、记录与未来 UI 三重 Mock 标识：名称含“（Mock）”、
`recordProvenance=MOCK_DEVELOPMENT_ONLY`、dataset mode 为 development only。Synthetic verified base facts
继续带 `DEVELOPMENT_SYNTHETIC_VERIFICATION; NOT_REAL_INSTITUTION_DATA`；它们不是现实核验。

## 17. Runtime Validator and Fixture Gate

`validateInstitutionRecordV11()` 是 pure、deterministic、identity-free validator，不读时间、不访问 wx、
Store、Service、Page、网络、后端或 Recommendation。稳定错误 code 覆盖：

```text
INVALID_V11_RECORD_SHAPE
INVALID_V11_STAFFING
INVALID_V11_MEDICAL_SUPPORT
INVALID_HEALTH_MONITORING
INVALID_V11_ROOM
INVALID_MEAL_SERVICE
INVALID_ACTIVITY_FACT
INVALID_TRANSPORTATION_FACT
INVALID_MAJOR_HOSPITAL_ACCESS
INVALID_V11_EVIDENCE
```

并保留 V1 的 stable error code，用于 base record、capability、price、money、time、duplicate ID、evidence
revision/status/value/reference 等错误。

独立 fixture 仅位于 `scripts/fixtures/**`，生产 `miniprogram/**` 禁止 import 测试 fixture。Gate 固定覆盖
`INST-V11-001..020` 与 anti-fake-green manifest，包括完整/unknown facts、三种 meal schedule、texture、
activity、transport、hospital distance、price breakdown、negative count/distance/invalid money，以及 V1
capability exact preservation。

## 18. Scope Boundary

本阶段明确为 0：

```text
Institution List/Detail UI
Recommendation V1/V2 implementation change
matching score / percentage / threshold
real Wuhan Institution data
Spring Boot / MySQL / API / persistence
wx.request / login / phone authorization
Android runtime change
```

未来 UI 必须通过 Page → Service → Provider 消费 record，并将 provided+unverified、unknown、unavailable、
expired 分开展示；不得直接 import Mock 或在页面重新解释 verification。未来后端必须保存
minor-unit money、meter distance、stable child ID、field evidence 和不可变 revision，不能只用数据库 NULL
压平 unknown/unavailable。
