# Institution Domain Contract V1

状态：`FROZEN_PHASE_4A_2`

版本：`institution-contract-v1`

TypeScript：`miniprogram/types/institution.ts`

本文件冻结 V1 机构事实、价格、动态运营信息、房型、媒体、VR、资质和字段级核验边界。护理能力稳定 code、覆盖矩阵与四态语义见 `INSTITUTION_CAPABILITY_CONTRACT.md`。

本 Contract 不授权 Recommendation Contract、hard filter、ranking、`NO_EXACT_MATCH`、机构正式业务 UI、后端、数据库或真实机构数据录入。`FROZEN_PHASE_4A_2` 只表示 Institution 输入域及验证语义稳定。

## 1. Source of Truth

本 Contract 依据：

1. `AGENTS.md` 的武汉精选机构池、真实数据、可解释推荐和 deterministic 约束；
2. `MOCK_DATA_POLICY.md` 与 `DOMAIN_CONTRACT.md`；
3. 冻结的 `ASSESSMENT_CONTRACT.md`、`ELDER_PROFILE_CONTRACT.md`、`ADL_RULE_CONTRACT.md`；
4. 《武汉养老机构精准匹配小程序 V1 页面级 PRD》中页面 10–13、机构详情护理/医疗康复/房型/收费/资质和机构后台字段建议；
5. 《武汉养老机构精准匹配小程序_MVP页面方案_V1》中页面 10–13 与机构详情内容规范；
6. 当前 Bootstrap `types/domain.ts`、Mock、Institution service、区域目录和页面 Skeleton。

PRD 的示例金额、机构标签和推荐理由只说明字段与展示需要，不是任何真实机构事实，也不是生产 fixture。

## 2. Domain Layers

机构侧必须分成以下层，禁止用一个 `tags: string[]` 替代：

| 层 | 责任 | 禁止推导 |
| --- | --- | --- |
| A. Identity / Basic Facts | 名称、区域、地址、经纬度、成立日期、床位规模、公开联系方式 | 地址不能证明区域 code；床位规模不能证明当前有床 |
| B. Institution Type | 主要类型与多个已核验类型 code | `medical_nursing_integrated` 不能证明鼻饲、导尿或护士站 |
| C. Care Acceptance | 五档生活功能接收矩阵 | care level 不能证明任何疾病或专项护理 |
| D. Mobility / Functional | 轮椅、卧床、转移支持及展示型日常护理 | 有无障碍设施不能自动证明卧床接收 |
| E. Cognitive | 认知症接收、走失风险支持 | 不能自动证明认知症专区 |
| F. Special Care | 九项专项护理能力 | 泛化“护理好”不能替代逐项能力 |
| G. Medical / Rehabilitation | 医生巡诊、护士、护士站、合作医院、紧急送医、康复事实 | 有康复室不能自动证明提供康复训练 |
| H. Price | 可验证参考月费、费用组成、押金和一次性费用 | 不能用自由文本参与预算匹配 |
| I. Operational Availability | 床位、接收新入住、等待时间、最早入住 | 不能与长期护理能力混为一体 |
| J. Rooms | 房型、面积、床型、配置、参考房费 | 房型缺失不能补默认值 |
| K. Media / VR | 真实图片、VR 地址、封面和场景 | Mock 图片或空链接不能升级为真实内容 |
| L. Qualifications | 证书类型、名称、资料、有效期 | `hasLicense=true` 不能替代证书事实 |
| M. Provenance / Verification | 字段路径、来源、核验时间、有效期和证据定位 | 记录级 `VERIFIED` 不能替代字段级核验 |

未来唯一允许的连接方向是：

```text
ElderProfile / ElderProfilePreview
            +
verified Institution facts and capabilities
            ↓ future Recommendation Contract
Recommendation
```

Recommendation 不得读取页面中文、Mock、自由文本标签或未经字段级核验的布尔值。

## 3. TypeScript and Runtime Boundary

`miniprogram/types/institution.ts` 保存生产 V1 shape；`miniprogram/domain/institution/**` 只实现 pure validation、verification projection 与冻结常量：

- 不含 service、Page、Store、持久化或 `wx.*`；
- 不导入 Recommendation；
- 不接入现有 Institution 页面或 Mock provider；
- 不创建 Spring Boot、Entity、Controller、Repository、migration 或 API；
- 所有 runtime helper 不读取全局时间、随机数、ElderProfile 或 Assessment。

现有 `miniprogram/types/domain.ts::Institution` 是 Bootstrap 页面壳层占位，存在自由文本价格、宽泛 type 与记录级 provenance。它暂时保持不变，避免本阶段牵动 Mock、Service 和 UI。后续迁移必须：

1. 本阶段冻结 Contract 并建立纯 validator；
2. 后续若迁移旧 DTO，必须使用版本化显式 adapter；
3. 将 `institution-region-catalog.ts` 从记录级 `dataProvenance === VERIFIED` 改为读取已核验 `identity.regionCode` 与 `identity.regionDisplayName`；
4. 最后才替换旧 `domain.ts` 占位和 Service 返回类型。

本阶段不实现 adapter、不修改 Region Catalog、Service、Mock provider 或页面；迁移边界见 `LEGACY_INSTITUTION_DTO_MIGRATION_PLAN.md`。

## 4. Identity, Region and Address

`InstitutionIdentityFacts` 冻结字段：

| field | usage | 语义 |
| --- | --- | --- |
| `name` | DISPLAY_SUPPORTING | 机构正式名称；Mock 名称必须显式含 Mock |
| `regionCode` | MATCHING_CRITICAL | 与 Assessment `preference.region.regionCode` 相容的稳定规范 code |
| `regionDisplayName` | DISPLAY_SUPPORTING | 当前展示名称；不能用于机器匹配 |
| `address` | DISPLAY_SUPPORTING | 真实地址；缺失保持 unknown/unavailable |
| `coordinates` | DISPLAY_SUPPORTING | 可选经纬度；不得从地址猜测 |
| `establishedDate` | DISPLAY_SUPPORTING | PRD 后台建议字段；可缺失 |
| `bedCapacity` | DISPLAY_SUPPORTING | 机构规模事实，不是当前床位状态 |
| `publicContact` | DISPLAY_SUPPORTING | 对外公开联系方式；不记录凭证或内部 Secret |
| `coverMediaId` | DISPLAY_SUPPORTING | 引用 `media[]` 中真实存在的封面媒体；不得保存悬空 ID |

区域不维护武汉全量行政区常量。`regionCode` 必须来自合作机构数据治理目录，并与 Assessment 已保存的 code 对齐；中文只用于显示和历史快照。经纬度缺失时必须为 unknown/unavailable，不能填 `0,0` 或中心点。

## 5. Institution Type Model

候选 code 与 Assessment `preference.careType` 对齐：

```text
active_aging
medical_nursing_integrated
disability_care
dementia_care
rehabilitation_care
```

机构可以同时符合多个类型。冻结结构：

```text
supportedTypes: core structured fact; verified non-empty code set or unknown
primaryType: optional display positioning field
```

约束：

1. `primaryType` 可以完全 absent；存在时必须是 provided、来自明确业务资料并包含在 `supportedTypes`；
2. code 对齐只降低映射错误，不表示把用户单选偏好复制成机构单值；
3. future Matching 只能读取当前有效 verified `supportedTypes`；`primaryType` 默认仅用于列表/详情定位；
4. 不得自动选择 `supportedTypes[0]` 作为 `primaryType`；
5. 类型不能推导具体护理、医疗、康复或特殊护理能力；
6. 中文标签不能成为业务输入。

## 6. Business Value and Missing Data

机构事实统一使用 `InstitutionField<T>`，明确分开：

```text
availability = provided   + value = T
availability = unknown    + value = null
availability = unavailable + value = null
verification = independent verification state
```

- `unknown`：平台目前无法确认该事实；
- `unavailable`：当前来源没有提供/公开该字段；不等于业务值为 0、false 或“不支持”；
- `provided`：有一个业务值，但仍可能 `unverified`；
- `null` 只出现在 unknown/unavailable 分支；
- 字段缺失不得转成 `false`、`0`、`Infinity`、空字符串或猜测值。

业务值和核验状态不是同一枚举。`provided` 不等于 `verified`；同样，Capability `supported` 也不能替代 verification。

### 6.1 Time Semantics

不同时间字段不得互相代替：

| field | 语义 |
| --- | --- |
| `InstitutionField.asOf` / `Evidence.observedAt` | 该业务事实被观察、采集或适用的时间 |
| `verification.verifiedAt` | 平台完成并接受核验动作的时间 |
| `verification.validUntil` | 该次核验结论可继续作为当前证据使用的截止时间 |
| `qualification.validFrom/validUntil` | 证书本身的业务有效期，不等于平台核验有效期 |

所有 timestamp 必须是合法 ISO 8601 timestamp；日期型证书边界使用合法 ISO 8601 date。具体 freshness 周期由后续运营规则决定，不能从任一时间字段猜测。

## 7. Field-level Verification and Evidence

### 7.1 Verification Status

冻结状态：

```text
unverified
verified
expired
```

- `unverified`：没有完成并接受字段级人工核验；可能存在待审材料；
- `verified`：满足 §7.5 的 VERIFIED 条件，且若有 `validUntil` 尚未到期；
- `expired`：曾完成核验，但明确的有效期已过；不得继续作为当前推荐事实。

不使用记录级“整家机构 VERIFIED”。`recordProvenance` 只表达 `MOCK_DEVELOPMENT_ONLY` 或 `PRODUCTION_CANDIDATE`；future Matching 资格必须逐字段检查。

记录生命周期独立使用 `recordStatus = draft | published | suspended | archived`，并以正整数 `recordRevision` 支撑后续版本化 API/审计快照。`published` 只表示记录可被前台读取，不表示全部字段已核验。现有 `DataProvenance = 'MOCK_DEVELOPMENT_ONLY' | 'USER_PROVIDED' | 'VERIFIED' | 'UNKNOWN'` 属于旧页面壳层 DTO，后续必须经 adapter 迁移，不能与本 Contract 的 record provenance 或 field verification 混用。

### 7.2 Evidence Locator

每条 `InstitutionEvidence` 至少表达：

```text
evidenceId
institutionId
recordRevision
fieldPath
valueSnapshot (带 `valueType` discriminator 的 typed snapshot)
observedAt (来源观察/采集时间存在时)
verificationStatus
sourceType
verifiedAt (verified/expired 必填)
sourceReference or sourceNote (至少一个可审计来源说明)
validUntil (确有期限时)
```

`fieldPath` 是稳定机器定位，例如：

```text
capabilities.specialCare.night_care
price.referenceMonthlyPrice
operations.bedAvailability
qualifications.<arrayIndex>.validity
```

它不是 UI 文案。数组路径使用当前 revision 内的零基索引；实体本身仍保存稳定 ID。数组重排必须创建新 revision 并重建该 revision 的 evidence，不允许跨 revision 复用旧 locator。未来 RecommendationReason 可以引用 `institutionId + recordRevision + fieldPath + valueSnapshot + evidenceId`，但本阶段不定义 RecommendationReason。

Evidence integrity 由本阶段纯 validator 强制，并需在未来 API 入口复用：

1. `evidenceId` 在机构记录内唯一，所有 `verification.evidenceIds` 都能解析；
2. evidence 的 `institutionId` 必须等于所属记录，`fieldPath` 必须定位当前 Contract 字段；
3. evidence 的 `recordRevision` 必须等于其所核验的记录 revision；typed `valueSnapshot` 必须与该 revision 的字段值一致；
4. `verified/expired` evidence 必须有合法 `verifiedAt`，`expired` 必须有合法且已到期的 `validUntil`；
5. `sourceReference` 与非敏感 `sourceNote` 至少一个非空；
6. 生产前台或匹配使用的非 unknown capability 不得只有 `unverified/expired` evidence；
7. 所有 room、cover、VR scene 的媒体引用都必须解析到同一机构的真实媒体记录。

同一字段的 verification 与它引用的 evidence 表示同一次已接受核验结论，`status`、`verifiedAt`、`validUntil` 必须一致（时间使用相同 ISO 字符串）。不同来源观察时间单独保存为 `observedAt`。`unverified` 不携带核验完成时间或核验有效期。validator 检查结构和对齐；“当前未失效”由显式 `evaluationAsOf` 的 projection 判断，不读取设备当前时间。

### 7.3 Typed Value Snapshot

```text
JCS_CANONICALIZATION_V1 = NOT_REQUIRED
```

V1 不使用 RFC 8785、hash、签名或 canonical JSON runtime dependency。`valueSnapshot` 必须使用 `valueType` discriminator 保存明确类型：stable code、stable code list、text、integer、boolean、ISO date/timestamp、numeric range、money range、reference monthly price，以及 coordinates、partner hospital list、staff count list、caregiver/resident ratio、price adjustment factor list、estimated wait range。

- snapshot 不能使用 UI 文案代替 stable code；
- 数字必须有限，金额继续使用整数 `amountMinor`；
- unknown/unavailable 且没有业务值时，不得伪造零值或 `null` snapshot；
- snapshot 必须对应同一 record revision 的字段值；
- 所有字段（不只 matching-critical）的 snapshot 都检查 discriminator 与结构化值一致；列表保持记录中的顺序，对象键顺序不影响等价判断；unknown/unavailable 使用对应 stable code snapshot，不伪造具体事实；
- snapshot 只包含目标机构字段的最小事实，不得包含 Secret、内部凭证或无关个人信息。

未来若需要 evidence hash、签名或跨系统审计，再单独升级 Evidence Contract。

### 7.4 Source Type

V1 保留五种来源：

```text
institution_provided
platform_manual_verification
official_document
contract_material
on_site_verification
```

- 机构表单或盖章资料属于 `institution_provided`；
- 平台人员电话/视频/人工复核属于 `platform_manual_verification`；
- 主管部门或合法公开材料属于 `official_document`；
- 合作合同/附件中明确的能力承诺属于 `contract_material`；
- 实地核查属于 `on_site_verification`。

`sourceReference` 应是受控文档 ID、内部记录 ID 或合规 URL，不能保存 AppSecret、token、账号密码或其他凭证。`sourceNote` 只保存最小必要的非敏感说明。

### 7.5 VERIFIED Definition

字段只有同时满足以下条件才可标记 `verified`：

1. 不是 Mock，且指向明确生产候选机构；
2. `fieldPath` 与当前业务值/能力 status 一致；
3. 有明确业务来源，`sourceType` 合法；
4. 有人工核验动作和合法 ISO 8601 `verifiedAt`；
5. 至少存在可审计的 `sourceReference` 或非敏感 `sourceNote`；
6. 有期限的材料未超过 `validUntil`；
7. 没有未解决的冲突证据；
8. 不是“页面有值”“看起来合理”“从 Mock 复制”或记录级标签。

只有 `verified` 且截至显式 evaluation time 仍有效的字段，未来才有资格支撑 hard constraint、排序事实或 RecommendationReason。

### 7.6 Effective Matching Projection

```text
FIELD_LEVEL_VERIFICATION_REQUIRED_FOR_MATCHING = TRUE
RAW_VALUE != EFFECTIVE_MATCHING_VALUE
```

所有 `MATCHING_CRITICAL` 字段必须先经过 pure verification projection：

| raw value | verification | effective value |
| --- | --- | --- |
| determinate | current verified | 原 determinate value |
| determinate | unverified / expired / past validUntil | unknown |
| unknown | any | unknown |

Capability 的 determinate 值是 `supported / requires_assessment / unsupported`。Projection 不读取 ElderProfile，不产生 compatibility、filter、score 或 Recommendation；需要判断 `validUntil` 时必须显式传入 `evaluationAsOf`，禁止内部调用 `Date.now()`。

调用顺序必须是 `validateInstitutionRecord -> 字段级 projection`：helper 不自行加载 evidence，不能替代记录级引用、值和 revision 一致性检查。`validUntil` 当时刻相等仍有效，超过即 unknown；晚于 evaluationAsOf 的 verifiedAt 不能用于该时点。结构验证通过也不证明资料真实；生产消费仍必须排除 MOCK_DEVELOPMENT_ONLY 并执行人工核验。

## 8. Price Contract

### 8.1 Reference Monthly Price

禁止：

```text
price: "5000左右"
min: 0
max: Infinity
根据机构类型猜价格
```

`referenceMonthlyPrice` 包含：

```text
range.kind = bounded | starting_at
range.min.amountMinor
range.max.amountMinor | null
currency = CNY
period = month
basis = reference_total
InstitutionField.asOf
InstitutionField.verification
```

规范约束：本 V1 已提供参考金额使用人民币最小单位的正安全整数（`amountMinor > 0`）；0 不能作为未知费用占位，所有提供的区间统一拒绝 0、负数、NaN、Infinity、小数与超出安全整数的值。`bounded` 必须 `min <= max`；上限未知但有起价资料时可保存 `starting_at` 原始值，此时 `max = null`，只有通过 verification gate 后才可对外作为已核验起价使用。月费分支 period 必须为 `month`；一次性费用必须为 `one_time`。外层 `InstitutionField.asOf` 是该价格适用/采集时点，`verifiedAt` 是平台核验动作时点，两者不可混用。

它必须显示和命名为“参考费用/参考总费用”，不是报价承诺。最终费用可能受护理等级、房型和特殊护理影响；本阶段不建立费用计算器。

### 8.2 Unknown Price

原始费用未知或来源未提供时使用（已有原始费用但未核验时可保留 provided + unverified；effective 仍为 unknown）：

```text
availability = unknown | unavailable
value = null
```

不得补零、无限大或估算。未来 Budget Matching 如何处理 unknown price 由 Recommendation Contract 决定，本阶段不提前过滤。

### 8.3 Components and Upfront Cost

月度费用组成只覆盖 PRD 字段：

```text
bed_fee
care_fee
meal_fee
management_fee
special_care_fee
other_fee
```

每项独立保存参考区间与 verification；缺失不影响总参考价格字段存在，但不能伪造拆分。

一次性费用分成：

- `deposit`：结构化金额区间或 unknown/unavailable；
- `oneTimeFees[]`：机构确有的其他一次性项目，名称和金额分别保存。

月费不能推导押金。何为“较高一次性费用”属于未来 Recommendation/Product 规则，不在本 Contract 写阈值。

价格还可显式保存 `adjustmentFactors = care_level | room_type | special_care`，只用于说明最终价格为什么可能变化，不计算最终报价，也不得把 factor 自行转换成金额。

## 9. Operational Availability

床位是 `OPERATIONAL_DYNAMIC`，不是长期 capability。冻结状态：

```text
available
limited
unavailable
inquiry_required
unknown
```

语义：

- `available`：已核验存在可接收入住的床位；
- `limited`：已核验仅余少量，数量可以不公开；
- `unavailable`：已核验当前无可接收床位；
- `inquiry_required`：机构要求逐次咨询或平台无法实时同步；
- `unknown`：没有足够当前资料。

非 unknown 状态必须携带 `asOf`；所有状态仍保留 verification。`bedCapacity` 不能替代 `bedAvailability`。

### 9.1 Freshness

护理能力、价格、床位、资质的有效期不同。本 Contract 只支持显式 `validUntil`，不写 7 天、30 天等魔法期限。没有运营规则时：

- 不自动计算过期时间；
- 动态事实不能仅因历史 `verifiedAt` 被默认为当前；
- UI 可以退回 `inquiry_required`/unknown；
- 具体刷新频率与自动过期规则标记 `OPERATIONS_DECISION_REQUIRED`。

### 9.2 Move-in and Waitlist

可选结构：

```text
acceptingNewResidents
estimatedWait
earliestMoveInDate
```

当前 PRD 没有证明 7–8 家机构都能持续提供这些数据，因此：

```text
NOT_REQUIRED_FOR_V1_MATCHING
OPERATIONS_DATA_GAP
```

字段可保存真实数据，但不得以默认值假装可用。

```text
AVAILABILITY_MATCHING_ROLE = DISPLAY_ONLY_DYNAMIC
```

V1 Availability 不进入 hard filter、matching score、ranking 或 care compatibility。未来结果可以并列显示护理适配与“当前床位需咨询”，但 `unavailable` 不能把护理能力改写成不匹配。

## 10. Rooms

`InstitutionRoom` 支持：

```text
roomId
name
roomType
areaSquareMeters
bedType
privateBathroom
airConditioner
wardrobe
television
callSystem
balcony
accessibility
referencePrice
mediaIds
```

每个事实允许 unknown/unavailable，不要求每家机构全部填满。房间参考价格是月度展示和总价解释字段，不是当前 hard constraint。面积、价格范围必须满足 min <= max；图片只能引用同一机构中真实、可审计且可解析的媒体记录。动态房间价格通过外层 `InstitutionField.asOf` 保存采集/适用时间。

## 11. Media and VR

### 11.1 Media

图片分类提案与 PRD 对齐：

```text
exterior
lobby
room
restaurant
bathroom
rehabilitation
activity
outdoor
```

每个媒体记录保存稳定 `mediaId`、分类、`role = cover | gallery`、排序、真实 URL、说明、合法拍摄时间和字段级 verification。`identity.coverMediaId` 必须解析到该机构的 `role=cover` 媒体。存在 VR 也不能自动生成普通图片；Mock 图片不能升级为 verified。

### 11.2 VR

`InstitutionVr` 状态：

```text
available
unavailable
unknown
```

只有 `available` 才允许非空真实 URL、封面和至少一个真实 scene。场景保存 `sceneId`、稳定 `sceneCode`、名称、URL、封面引用与 verification；候选 scene code 为 `exterior/lobby/room/bathroom/restaurant/rehabilitation/activity/garden`。没有真实已核验 VR 时：

```text
url = null
coverMediaId = null
scenes = []
```

不得创建假链接、假 Viewer 或假场景。VR 只用于信任与看院体验，`DISPLAY_SUPPORTING`，不是护理 hard constraint。

## 12. Qualifications

`InstitutionQualification` 至少支持：

```text
qualificationId
type
certificateName
documentUrl
validity = valid | expired | unknown
validFrom
validUntil
verification
```

候选 type 只覆盖 PRD：营业执照、民政备案、养老机构评级、医保资格、医疗资质、其他认证。合作医院属于医疗事实，不伪装成资质证书。

过期证书必须显示 `expired`，不能永久保留 valid；证书 `validUntil` 与平台核验 `verification.validUntil` 是两条不同时间轴，并必须保持一致性（例如证书已过期时不能继续显示 validity=valid）。`hasLicense=true` 不满足 Contract。文档/图片缺失时不得伪造链接。

## 13. Medical, Rehabilitation and Staffing Facts

医疗事实保存：医生巡诊、护士、护士站、合作医院、紧急送医。当前不提案 `medical_support_level`，因为 PRD 没有“基础/高级”等可审计规则；有护士站不能推导模糊高级等级。

康复展示事实保存：康复治疗师、康复室、术后康复、肢体功能训练、认知训练。独立的 `rehabilitation_training` capability 位于能力 Contract；任何单一设施/人员事实都不能自动把它设为 supported。

人员配置只在真实资料存在时保存角色人数和核验时点。护理员与老人比例必须保存原始人数、`asOf` 和 verification；不得只存营销字符串。以上均默认 `DISPLAY_SUPPORTING`，未来若要进入匹配必须另行审批。

日常生活服务独立建模为 `services[] / InstitutionServiceOffering`：服务的 `available/requires_assessment/unavailable/unknown` 表达具体服务供给，不等于机构的护理接收 capability。起居、洗澡、翻身、喂饭、如厕、夜间巡查、陪诊和紧急处理均保持 `DISPLAY_SUPPORTING`，禁止用服务标签反推 matching-critical capability。

## 14. Field Usage Classes

| class | 当前字段 | 约束 |
| --- | --- | --- |
| `MATCHING_CRITICAL` | regionCode、verified supportedTypes、五档接收、轮椅/卧床/转移、认知症接收、走失支持、九项特殊护理、referenceMonthlyPrice | 只允许 future Recommendation 读取冻结白名单；必须先做 verification projection |
| `DISPLAY_SUPPORTING` | 名称/地址、日常护理、医疗描述、康复设施、人员、房型、媒体、VR、资质 | 用于建立信任和解释，不自动成为 hard constraint |
| `OPERATIONAL_DYNAMIC` | 床位、接收新入住、等待时间、最早入住 | 必须携带 asOf/freshness；不能当长期能力 |
| `AUDIT_ONLY` | evidence、sourceReference、verifiedAt、validUntil、内部核验说明 | 不直接展示、不作为权重 |

Recommendation 将来不得扫描整个 Institution 对象；只能读取 `InstitutionMatchingCriticalFieldPath` 与 `INSTITUTION_MATCHING_CRITICAL_FIELD_PATHS` 冻结白名单。`primaryType`、availability、rooms、media、VR、qualification 和描述性医疗事实均不在白名单；数据记录不能自行声明 usage class。

## 15. Reviews

```text
REVIEW_CONTRACT = DEFERRED
```

PRD 将真实评价列为“有数据再上/P1”。本阶段不创建 Review schema、评分、trust score 或排序输入；现有/未来 Mock review 均不得用于推荐。

## 16. Mock Fixture Policy

本阶段不创建生产 Institution fixture，也不录入任何真实武汉机构能力。

Contract runtime fixture 可以覆盖四态，但必须同时满足：

1. 文件级 `MOCK_DEVELOPMENT_ONLY` 声明；
2. 记录级 `recordProvenance = MOCK_DEVELOPMENT_ONLY`；
3. UI 若展示，必须可见“开发 Mock 数据”；
4. 使用“示例机构 A（Mock）”类名称，不使用真实品牌；
5. 价格、床位、能力、资质、媒体和 VR 不得被描述为真实合作数据；
6. Mock evidence 不能使用 `verified` 支撑生产推荐；测试 verified 分支必须同时标记 `TEST_SYNTHETIC_VERIFIED` 与 `NOT_REAL_INSTITUTION_DATA`，且只能位于 test harness。

现有 Bootstrap Mock 继续只服务页面壳层；不能因本 Contract 存在而升级为生产资料。

## 17. Approved Product Decisions

Phase 4A-1 决策记录：

```text
CAPABILITY_STATUS_MODEL = FROZEN
CARE_LEVEL_ACCEPTANCE = FIVE_LEVEL
PRIMARY_TYPE = OPTIONAL
AVAILABILITY_MATCHING_ROLE = DISPLAY_ONLY_DYNAMIC
FIELD_LEVEL_VERIFICATION_REQUIRED_FOR_MATCHING = TRUE
JCS_CANONICALIZATION_V1 = NOT_REQUIRED
```

Phase 4A-1 的来源、备选方案与设计边界保留在以上决策记录和各字段说明中；本节记录最终批准结果。

## 18. Deferred Work and Exit Gate

本阶段明确不做：

- Recommendation Contract / Engine；
- hard filter、ranking、score、reason generation、`NO_EXACT_MATCH`；
- Institution list/detail/VR 正式 UI；
- 旧 DTO/Region Catalog/Service/Mock provider 迁移；
- Spring Boot、MySQL、API；
- 真实机构数据、资质、价格、床位或 VR 录入。

本 Contract 的退出 Gate 是 pure validator、runtime fixture、微信 TypeScript targeted compatibility、backend_domain/matching_engine 只读复核及独立 QA 全部通过。该 Gate 不授权自动进入 Recommendation。

## 19. Phase 4A-2 Verification Record

```text
INSTITUTION_CONTRACT = FROZEN_PHASE_4A_2
INSTITUTION_CAPABILITY_CONTRACT = FROZEN_PHASE_4A_2
```

2026-08-31 验收：backend_domain=`PASS`，matching_engine=`PASS`；本轮 baseline 最终独立 qa_reviewer=`PASS_WITH_RISKS`，无未关闭的本阶段 blocker，唯一风险为下述已批准的上游 typings 非阻断问题。

- Institution runtime：96 cases PASS，包含 Mock 名称标识与双零坐标占位的反例回归。
- Assessment：12；Interaction：38 runtime + 2 structural；ElderProfile：45；Preview：20；Profile：17，均 PASS。
- TS 5.9 应用源码检查（沿用既有 `--skipLibCheck` Gate）PASS；不跳过声明文件的全量 `tsc --noEmit` 仍在既有 `typings/types/wx/lib.wx.app.d.ts:265` 报 TS2344。产品负责人正式将该既有问题记录为 `KNOWN_UPSTREAM_TYPINGS_COMPATIBILITY_ISSUE` / `NON_BLOCKING`，不宣称全仓 TS 5.9 clean。不得修改官方 typings、patch node_modules/typings、修改 tsconfig、降低应用源码 Gate，或抑制新的项目错误。当前有效 Gate 保持为 Application TypeScript、实际微信 TS 4.1.2 targeted、DevTools compile 与 WeChat generated JS compatibility。
- 实际微信 TS 4.1.2 targeted：16 targets / 17 内存 emit 模块，diagnostic/class fields/external runtime imports 均 0。新 Institution 域没有为制造产物而接入 Page。
- DevTools compile：Stable v2.01.2510290 本轮重新执行项目编译，Budget 正常加载，Console 无错误；仅保留 Chromium SharedArrayBuffer deprecation warning。未修改编译配置。
- WeChat JS compatibility：最新 DevTools 编译后检查既有 50-module 实际缓存 PASS；self-test PASS。它不代表新 Institution 域已被生产 Page 加载；新纯域编译证据是前述实际微信 TS 4.1.2 targeted 内存 emit。
- JSON：34 个 miniprogram + 3 个公共根配置，共 37 个 PASS；diff/新增文件 whitespace 检查 PASS。
- 本轮无新 Page，Android Gate 不适用；无真实机构/媒体/VR 核验、API/DB 或生产 provider 集成。结构校验不等于数据真实性核验。
- Git：产品负责人已审阅通过 Phase 4A-2，并授权在正式 Gate 与最后独立只读 QA 通过后，精确提交本阶段文件，里程碑为 `feat: freeze institution capability and verification contracts`。不包含 optional/prompts/private config/tmp/cache/Secret 或无关文件；提交后停止，不自动进入 Recommendation。
