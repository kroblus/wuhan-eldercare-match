# V1.1 产品变更影响分析

状态：`REVIEWED_WITH_PHASE_V1_1_A_DECISION_OVERRIDE`

日期：`2026-09-04`

本文件只冻结“变更影响分析与迁移提案”，不修改任何现有业务 Contract，不授权 V1.1 生产实现、Android Gate、Phase 4C-2 Freeze 或 Git commit。

```text
PRODUCT_SOURCE_OF_TRUTH = V1.1
V1_PDF_STATUS = HISTORICAL_REFERENCE_ONLY
PRODUCT_V1_1_CHANGE_IMPACT_ANALYSIS = REVIEWED
PHASE_V1_1_A_PRODUCT_DECISIONS = APPROVED
SUPERSEDED_PROPOSAL_ROWS = HISTORICAL_ANALYSIS_ONLY
PHASE_4C_2_IMPLEMENTATION = FUNCTIONALLY_COMPLETE_AGAINST_V1_BASELINE
PHASE_4C_2_FREEZE = DEFERRED_BY_V1_1_PRODUCT_CHANGE
PRODUCTION_CODE_CHANGE = 0
GIT_STAGE = 0
GIT_COMMIT = 0
```

## 1. Source of Truth Update

当前产品最高依据：

1. `docs/product/武汉养老机构精准匹配小程序_V1.1_页面级PRD_更新版.pdf`
2. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.1_更新版.pdf`

旧 V1 PDF 只允许用于追溯原始决策与迁移来源，不再用于裁决新业务语义。若 V1.1 与冻结代码/Contract 冲突，先形成版本化 Contract 提案并审查，不得直接修改旧 stable code 的含义。

本次完整阅读两份 V1.1 文档，并与当前 Assessment、ADL、ElderProfile、Preview、Institution、Recommendation 及 UI Contract 对照。V1.1 的主变化是：

- 六步 Assessment 不变；Health 增加咀嚼/吞咽，Preference 增加房型/餐次/活动偏好并重构 12 个关注项；
- ADL 七题和 care-level ordinal 规则不变；进食能力与食物形态/吞咽能力保持分离；
- ElderProfile 需要新增营养/进食事实、澄清与生活偏好；
- Institution 需要扩充人员、医疗、监测、房间、膳食、活动、交通和医院距离等结构化、可核验事实；
- Recommendation 的安全层不变，新增生活适配与家庭偏好的候选输入；
- 费用继续位于安全之后，禁止用预算覆盖护理冲突，禁止输出伪精确匹配百分比。

### 1.1 Source manifest

| Role | Path | Key review pages |
|---|---|---|
| Current page-level source | `docs/product/武汉养老机构精准匹配小程序_V1.1_页面级PRD_更新版.pdf` | p16–18 Health/ADL；p21–26 Preference/Budget/Profile/Recommendation；p36–43 Institution；p63–68 rules/data objects |
| Current MVP source | `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.1_更新版.pdf` | p5–6 Health；p10–15 Preference/Budget/Profile/Recommendation；p17–20 Institution/detail |
| Historical page-level source | `docs/product/archive/武汉养老机构精准匹配小程序 V1 页面级 PRD.pdf` | `HISTORICAL_REFERENCE_ONLY` |
| Historical MVP source | `docs/product/archive/武汉养老机构精准匹配小程序_MVP页面方案_V1.pdf` | `HISTORICAL_REFERENCE_ONLY` |

页码按 PDF 页面序号记录。旧 V1 的删除/归档与两份新 PDF 当前属于用户工作树中的产品资料变更；本阶段不 stage、不 commit，也不改变其内容。

## 2. Assessment Impact

### 2.1 Six-step boundary

保留现有六步及路由：

```text
basic -> health -> adl -> cognitive -> preference -> budget
```

V1.1 不需要第七个问卷步骤。Health 从 3 题扩展为 5 题，Preference 从 3 题扩展为 6 题。当前 27 个 question ID 增至建议的 32 个；若下表五个新增题均按提案设为必填，required 总数从 21 增至 26。最终 required 数量必须随 Assessment Contract v2 一起批准。

### 2.2 ASSESSMENT_V1_TO_V1_1_MATRIX

| Step | V1 question ID | V1.1 question ID | 变化 | Required 提案 | V1.1 stable option code 提案 | 互斥/条件 | Draft migration | CompletedAssessment |
|---|---|---|---|---|---|---|---|---|
| basic | `basic.*` 共 8 个 | 原 ID 原 code | 不变 | 原规则 | 原规则 | 原条件题规则 | 原样保留 | V1 历史不可改写 |
| health | `health.conditions` | 原 ID | 不变 | 是 | 原 code | `none` / `unknown` 与具体疾病互斥 | 原样保留 | V1 解释不变 |
| health | `health.recentEvents` | 原 ID | 不变 | 是 | 原 code | `none` / `unknown` 与具体风险互斥 | 原样保留 | V1 解释不变 |
| health | `health.rehabilitationNeed` | 原 ID | 不变 | 是 | 原 code | 单选，`unknown` 为明确答案 | 原样保留 | V1 解释不变 |
| health | 无 | `health.chewingAbility` | 新增 | **建议是** | `normal` / `soft_or_easy_chew` / `food_modification_required` / `unknown` | 单选；无条件展开；`unknown` 不等于未回答 | key 缺失，要求用户补答；不得补 `normal` | 只进入新 schema completion |
| health | 无 | `health.swallowingAbility` | 新增 | **建议是** | `normal` / `occasional_difficulty_or_choking` / `significant_difficulty` / `unknown` | 单选；无条件展开；不推导鼻饲 | key 缺失，要求用户补答；不得补 `normal` | 只进入新 schema completion |
| adl | `adl.*` 共 7 个 | 原 ID 原 code | 不变 | 原规则 | 原 code | 原单选/unknown 规则 | 原样保留 | V1 解释不变 |
| cognitive | `cognitive.symptoms` | 原 ID | 不变 | 是 | 原 code | `none` / `unknown` 互斥 | 原样保留 | V1 解释不变 |
| cognitive | `cognitive.specialCareNeeds` | 原 ID | 不变 | 是 | 原 code | `none` / `unknown` 与具体需求互斥 | 原样保留 | 只有此题明确 `tube_feeding` 才产生鼻饲需求 |
| preference | `preference.careType` | 原 ID | 不变 | 是 | 原 code | 单选 | 原样保留 | V1 解释不变 |
| preference | 无 | `preference.roomType` | 新增 | **建议是** | `no_preference` / `single` / `double` / `multi_bed` | 单选；房型不是护理硬条件 | key 缺失，要求用户补答 | 只进入新 schema completion |
| preference | 无 | `preference.mealSchedule` | 新增 | **建议是** | `no_preference` / `three_meals` / `three_meals_one_snack` / `three_meals_two_snacks` | 单选；不重复询问食物形态 | key 缺失，要求用户补答 | 只进入新 schema completion |
| preference | 无 | `preference.activityPreference` | 新增 | **建议是** | `no_preference` / `indoor` / `outdoor` / `indoor_and_outdoor` | 单选 | key 缺失，要求用户补答 | 只进入新 schema completion |
| preference | `preference.priorities` | 原 ID | option set 重构 | 是，1–3 项 | 见 §8 | 最多 3 项，无 none/unknown | 只安全迁移一一等价 code；有歧义则整题待重答 | V1 原答案按 V1 ruleset 解释 |
| preference | `preference.region` | 原 ID | 问题本身不变 | 否 | 原动态区域快照 | 只读已核验目录；`no_preference` 合法 | 原样保留 | V1 快照不可重写 |
| budget | `budget.*` 共 4 个 | 原 ID 原 code | 答案不变；新增非阻断提醒 | 原规则 | 原 code | 不新增答案字段 | 原样保留 | V1 答案不重写 |

“未回答”和“明确 unknown/no_preference”继续是不同状态。迁移器不得用 `normal`、`no_preference`、空数组或任意默认值替用户回答新增问题。

## 3. Question ID Proposal

建议沿用现有 `step.camelCaseSemanticName` 命名：

| Stable question ID | 类型 | 建议 Required | Unknown/neutral | 后续语义 |
|---|---|---:|---|---|
| `health.chewingAbility` | `single_choice` | 是 | `unknown` | 原始咀嚼事实；食物形态支持线索；不影响 ADL ordinal |
| `health.swallowingAbility` | `single_choice` | 是 | `unknown` | 原始吞咽事实；可能产生澄清；不自动生成鼻饲 |
| `preference.roomType` | `single_choice` | 是 | `no_preference` | 生活偏好、房型 fit 与解释；不是护理硬条件 |
| `preference.mealSchedule` | `single_choice` | 是 | `no_preference` | 餐次 fit；与咀嚼/吞咽事实分离 |
| `preference.activityPreference` | `single_choice` | 是 | `no_preference` | 室内/室外活动空间 fit |

上述 ID、code 和 required 仅为提案。必须先进入 Assessment Contract v2 review，才能修改 TypeScript、Draft、页面或 fixtures。

## 4. ADL Impact

```text
ADL_QUESTION_SET_CHANGE = FALSE
ADL_RULESET_VERSION_BUMP_REQUIRED = FALSE
ADL_RULESET = adl-ruleset-v1
```

V1.1 没有改变 `adl.eating` 等七题的 ordinal code 或 Proposal C care-level derivation。边界继续为：

- `adl.eating` 回答是否能自主完成进食；
- `health.chewingAbility` 回答食物是否需要软化/特殊处理；
- `health.swallowingAbility` 回答吞咽是否顺畅；
- `special_feeding` 继续是非 ordinal 澄清线索，不得自动增加 careLevel；
- 咀嚼或吞咽困难不得自动生成 `tube_feeding`；
- 只有 `cognitive.specialCareNeeds` 明确选择 `tube_feeding` 才产生鼻饲 hard requirement。

现有 ElderProfile clue 表若以 `tube_feeding` 作为 `special_feeding` 的 `targetOptionCode`，该 code 只表示“要向用户澄清的目标选项”，不是 direct requirement、verified tube feeding 或可直接满足/冲突的机构需求。

因此 ADL Rule Contract 为 `UNCHANGED`。ElderProfile derivation ruleset 可因新增非 ADL 派生事实升级，但不得借此改变 ADL 结果。

## 5. ElderProfile Impact

### 5.1 Proposed data placement

建议在 ElderProfile v2 新增独立 `nutrition` 语义区，而不是把生活适配事实塞进 ADL 或 `specialCare`：

| Layer | Proposed fact | Source | 约束 |
|---|---|---|---|
| Raw Fact | `nutrition.rawFacts.chewingAbilityAnswer` | `health.chewingAbility` | exact copy |
| Raw Fact | `nutrition.rawFacts.swallowingAbilityAnswer` | `health.swallowingAbility` | exact copy |
| Derived Fact | `nutrition.foodTextureSupportNeed` | 咀嚼答案；必要时结合吞咽澄清 | 可表达 standard/easy-chew/modified/needs-confirmation/unknown；不得表达 tube feeding |
| Clarification | `nutrition.swallowingSupportClarification` | `significant_difficulty`、`unknown` 或冲突事实 | stable clarification code + source evidence；是否阻断 classification 待产品批准 |
| Raw Fact | `preference.rawFacts.roomTypePreference` | `preference.roomType` | exact copy |
| Raw Fact | `preference.rawFacts.mealSchedulePreference` | `preference.mealSchedule` | exact copy |
| Raw Fact | `preference.rawFacts.activityPreference` | `preference.activityPreference` | exact copy |
| User-facing Summary | 进食与饮食、养老偏好两组 summary items | 上述 raw/derived facts | unknown/clarification 必须按不确定状态呈现 |

ElderProfile v2 仍须保持 `Raw Fact -> Derived Fact -> Evidence -> Clarification -> UserFacing Summary` 的分层。careLevel、mobility、cognition 和 special-care 的既有证据链不应被新字段覆盖。

### 5.2 Contract consequence

- raw mapping 从 27/27 变为 32/32；
- summary schema 需要新增 nutrition items 与三项 preference items；
- formal CompletedAssessment v1 继续走 v1 derivation；v2 才走新 derivation；
- anonymous preview 复用同一 identity-free semantic core，不得伪造 Assessment/Elder identity；
- Preview 继续不持久化，Draft 改变后实时重算。

## 6. Institution Impact

### 6.1 Gap classification meanings

- `ALREADY_SUPPORTED`：当前 Institution v1 已有足够结构与字段级 verification。
- `STRUCTURE_EXTENSION`：必须新增 typed field/object、runtime validation、snapshot/evidence path。
- `NEW_DISPLAY_FIELD`：V1.1 UI 应展示，但不表示可进入 Matching。
- `NEW_MATCHING_CANDIDATE`：具备成为 soft fit 输入的业务价值；仍需稳定 comparator 与有效 verification。
- `NOT_RECOMMENDED_FOR_V1`：当前数据定义不足以客观排序，V1.1 不应造分。

### 6.2 INSTITUTION_V1_TO_V1_1_GAP_MATRIX

| Area / Fact | Current V1 support | Classification | V1.1 proposal / matching boundary |
|---|---|---|---|
| caregiver count | `staffing.counts[caregiver]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 只展示已核验数量；不直接等于质量 |
| caregiver certification | 无人员级结构 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NOT_RECOMMENDED_FOR_V1` | 需证书类别/覆盖比例/核验时间；不凭“持证”自由文本打分 |
| caregiver experience | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NOT_RECOMMENDED_FOR_V1` | 需客观区间或可核验分布；不按“年轻/资深”主观排序 |
| caregiver/resident ratio | `staffing.caregiverResidentRatio` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD`, `NOT_RECOMMENDED_FOR_V1` | 可展示；在口径、班次、入住人数和阈值未冻结前不评分 |
| response time | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NOT_RECOMMENDED_FOR_V1` | 必须先定义计量场景和统计口径 |
| doctor count | `staffing.counts[doctor]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 只显示已核验事实 |
| nurse count | `staffing.counts[nurse]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 只显示已核验事实 |
| clinic / nurse station | nurse station 已支持；clinic/medical office 缺失 | `ALREADY_SUPPORTED`（nurse station）, `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 分字段保存，不能由机构类型推导 |
| 24h medical duty | 无独立字段 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 与 24h care 分离；不可互相推导 |
| hospital relationship | `medicalSupport.partnerHospitals` 有 name/note | `ALREADY_SUPPORTED`, `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 建议增加结构化 relationship type；不从名称推断合作级别 |
| major hospital distance | 无距离/医院级别 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 需明确“重大/三甲”定义、坐标/距离口径及阈值后才可评分 |
| health monitoring | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 血压/血氧/按需血糖及频率分开；缺失保持 unknown |
| room type | `rooms[].roomType` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 可与明确 room preference 比较；需 record-level validated inventory |
| accessibility | `rooms[].features.accessibility` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 只解释真实房型事实 |
| call system | `rooms[].features.callSystem` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 只解释真实房型事实 |
| refrigerator | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | typed presence + availability + field verification；不作为 care safety |
| electric curtain | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 同上 |
| assistive equipment | 无统一 typed set | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 以 stable equipment code 保存；不从图片推断 |
| meal schedule: three meals | 无 structured meal object | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 与 meal schedule preference 做 exact/known comparison |
| meal schedule: three meals + snack | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 同上 |
| meal schedule: three meals + two snacks | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 同上 |
| easy-chew / soft meal support | 无 matching-grade field | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 建议在 Institution Contract 内定义 meal-service support status + field verification；不进入护理 hard capability，不等于 tube feeding |
| modified diet support | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 必须明确服务边界；不由普通 meal service 推导 |
| indoor activity space | 只有 media category，不能证明存在 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | typed presence/space facts；图片不自动转事实 |
| outdoor activity space | 同上 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD`, `NEW_MATCHING_CANDIDATE` | 同上 |
| dance/calligraphy/arts/chess/music/fitness | 无稳定 activity catalog | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 真实提供再记录；内容“质量”不评分 |
| metro | 只有地址/坐标 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 需站点、距离或步行口径；当前不评分 |
| bus | 只有地址/坐标 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 需站点/线路事实；当前不评分 |
| vehicle access | 无 | `STRUCTURE_EXTENSION`, `NEW_DISPLAY_FIELD` | 明确停车/接驳/车辆到达语义；当前不评分 |
| bed fee | `price.recurringComponents[bed_fee]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 保留 unknown，不以 0 代替 |
| meal fee | `price.recurringComponents[meal_fee]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 特殊饮食调整需另建真实事实 |
| care fee | `price.recurringComponents[care_fee]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 不计算最终报价 |
| special care fee | `price.recurringComponents[special_care_fee]` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 不把缺失当免费 |
| deposit | `price.deposit` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 继续与月费分离 |
| one-time fees | `price.oneTimeFees` | `ALREADY_SUPPORTED`, `NEW_DISPLAY_FIELD` | 继续逐项保存、核验 |

### 6.3 Data and verification rule

所有新增 Institution facts 必须使用与当前 Contract 等价的三层语义：业务值、字段可用性、verification/evidence。缺失保持 `unknown` 或 `unavailable`，不得补 `false`、0、`supported`。Development Catalog 继续是 `MOCK_DEVELOPMENT_ONLY`；新增字段默认 `unknown/unverified`，只有合成测试场景才允许 synthetic verification，且不得伪装武汉真实机构。

## 7. Recommendation Impact

### 7.1 Safety semantics remain frozen

V1.1 不改变安全 eligibility：

| Elder requirement + effective institution capability | Result |
|---|---|
| required + supported | `satisfied`，可继续判断 Exact/SoftNear |
| required + requires_assessment | `conditional`，只能进入 `CONDITIONAL` |
| required + unsupported | hard conflict，`INELIGIBLE` |
| required + unknown/unverified | unresolved，`UNVERIFIED`，不得渲染为支持 |

`EXACT / SOFT_NEAR / CONDITIONAL / UNVERIFIED / INELIGIBLE` 五档保持，未核验记录不得绕过 verification projection。预算、区域、房型、环境或任何 priority 都不能覆盖 hard conflict；安全结果不能用总分抵消。

`NO_EXACT_MATCH` 的触发语义、stable reason priority、完整机构池 provenance、逐机构 revision/evidence 和未解析护理摘要同样保持冻结。新增 soft fit 只能在安全结果之后排序或解释，不能把 `INELIGIBLE/UNVERIFIED/CONDITIONAL` 提升为安全卡，也不能改变“是否存在 Exact”的安全判定。

### 7.2 New soft-fit classification

| Soft fit | Current classification | Conditions before ranking | Initial V1.1 behavior |
|---|---|---|---|
| room fit | `STRUCTURED_SCORABLE` | room preference + validated room inventory + verified room type | exact/known comparison；不影响 care eligibility |
| meal schedule fit | `STRUCTURED_SCORABLE` | stable schedule code + verified InstitutionMeal fact | exact/known comparison |
| texture/eating support | `DISPLAY_EXPLAINABLE`; eligible for later `STRUCTURED_SCORABLE` | nutrition derived fact + verified meal-service support status + approved comparator | 先保留 clarification/差异，不推导 tube feeding |
| activity fit | `NOT_YET_SCORABLE` | 尚无 typed space contract、可用性语义和 approved comparator | 可展示真实室内/室外空间；未来满足条件后再升级 |
| staffing quality | `DISPLAY_EXPLAINABLE` | 尚无口径、阈值与可比 ordinal | 展示人数/证书/经验/比例/响应事实，不合成质量分 |
| medical configuration | `DISPLAY_EXPLAINABLE` | specific verified facts | 不合成“医疗质量”或高级等级 |
| transportation | `NOT_YET_SCORABLE` | generic priority 缺少用户出发点和 approved comparator | 可展示地铁/公交/车辆事实；暂不排序 |
| major hospital proximity | `NOT_YET_SCORABLE` | “大型医院”定义、distance method、freshness、threshold 尚未批准 | 可显示已核验距离；未批准前不因公里数自动加分 |
| living environment | `NOT_YET_SCORABLE` | 无客观 frozen ordinal | 只展示结构化事实和真实媒体 |
| meal quality | `NOT_YET_SCORABLE` | 无客观 frozen ordinal | 餐次/形态可比，主观“质量”不可打分 |
| cost fit | existing `STRUCTURED_SCORABLE` | verified reference monthly price | 保留现有 budget fit 与 difference |

推荐引擎仍接收完整机构池，先安全评估再按冻结 tuple 排序，最多输出 3 张卡片，不为凑数量放宽安全条件。新增 factor 必须有 stable code、rank participation 和 evidence；禁止 global matching score 或 percentage。

## 8. Priority Mapping

### 8.1 V1.1 stable priority code proposal

| V1.1 Priority | Proposed stable code | Institution facts | Matching role | Current data availability | Verification requirement |
|---|---|---|---|---|---|
| 护理能力 | `care_capability` | care-level/mobility/cognitive/special-care matrices | hard semantics 已由 elder need 消费；priority 只作关注主题并防重复计权 | 已结构化 | matching-critical 字段必须 current verified/effective |
| 护理人员质量 | `caregiver_quality` | count, certification, experience, ratio, response time | `NOT_YET_SCORABLE`；只解释 | 部分存在 | 每个数字/资格及统计口径单独核验 |
| 医疗条件 | `medical_conditions` | doctor/nurse, clinic/station, 24h duty, hospital, monitoring | `DISPLAY_EXPLAINABLE` | 部分存在 | 字段级核验；不能由机构类型推导 |
| 康复条件 | `rehabilitation_capability` | rehabilitation capability/features | existing structured fit，遵守 hard/priority dedup | 已结构化 | capability projection + evidence |
| 膳食质量 | `food_quality` | meal schedule, texture, fee | “质量”`NOT_YET_SCORABLE`；schedule/texture 可独立 fit | 缺结构 | meal facts/capability 单独核验 |
| 居住环境 | `living_environment` | room/accessibility/media/environment facts | `NOT_YET_SCORABLE` | 部分存在 | 展示事实需核验；媒体不生成 score |
| 房间设施 | `room_facilities` | room inventory/features | room type 可 structured fit，其余 `DISPLAY_EXPLAINABLE` | 部分存在 | room-level verification |
| 活动空间 | `activity_space` | indoor/outdoor spaces, activity catalog | indoor/outdoor preference 可 structured fit；内容只解释 | 缺结构 | presence/content 分别核验 |
| 交通便利 | `transportation` | metro/bus/vehicle access | `DISPLAY_EXPLAINABLE`，暂不评分 | 缺结构 | location/distance/method 必须可审计 |
| 靠近大型医院 | `near_major_hospital` | qualified hospital ref + distance | 候选 structured fit；阈值未定前只解释 | 缺结构 | hospital classification、distance 与 as-of 均核验 |
| 价格预算 | `price` | reference monthly price/components | existing structured budget fit，priority 消费同一 rank owner | 已结构化 | current verified price |
| 地理位置 | `region` | institution regionCode + selected region | existing structured region fit，priority 消费同一 rank owner | 已结构化 | verified region catalog snapshot |

priority 只表达“关注主题”，不自动证明用户把该主题设为 hard requirement。特别是 `caregiver_quality`、`medical_conditions`、`food_quality` 和 `living_environment`，不能从人数多、人员年轻、经验描述、图片或营销文案合成主观高分。

### 8.2 Legacy priority migration

| V1 code | V1.1 handling proposal | Reason |
|---|---|---|
| `medical_conditions` | 保留 | 一一等价 |
| `rehabilitation_capability` | 保留 | 一一等价 |
| `food_quality` | 保留 | 一一等价，但仍不可主观评分 |
| `living_environment` | 保留 | 一一等价 |
| `transportation` | 保留 | 一一等价 |
| `price` | 保留 | 一一等价 |
| `nursing_professionalism` | 候选映射至 `caregiver_quality`，需产品批准 | 新项合并了专业/质量语义，存在信息压缩 |
| `caregiver_attitude` | 候选映射至 `caregiver_quality`，需产品批准 | 同上；两项同时选中会发生去重 |
| `overall_quality` | 不自动映射，要求重答 | V1.1 明确删除笼统项 |
| `recreational_activities` | 不自动映射，要求重答 | “活动内容”不等同“活动空间” |
| `close_to_family` | 不自动映射，要求重答 | “离家近”不等同所选行政区或交通便利 |
| `dementia_care` | 不自动映射，要求重答 | 明确认知症需求由健康/认知 hard semantics 表达，不能转成通用护理 priority |

安全迁移规则：若整个旧数组都能一一等价映射，则保留 mapped set；只要包含歧义/删除项，就移除 v2 的 `preference.priorities` answer，让用户重新选择全部 1–3 项，避免产生“半静默迁移”的偏好。是否批准两个 caregiver legacy code 合并是产品决策。

## 9. High-care + Low-budget Advisory

建议只有一套共享、确定性 advisory rule，职责分层如下：

1. **Domain owner：ElderProfile/Preview advisory semantic**。输入只来自已派生的高照护事实与 `budget.monthlyRange`，输出 stable advisory code；不写回 Assessment 答案。
2. **Assessment Budget UI：可选首个展示点**。在本步答案已具备时展示非阻断提示；不改变 required validation、不阻止提交、不改预算。
3. **Profile UI：主要确认展示点**。把它作为“费用需进一步确认”的画像提醒，不作为医学/护理结论。
4. **Recommendation：默认不重复通用提醒**。它绝不能成为 `RecommendationDifference`；只有实际机构参考价与预算比较时，才生成现有 price difference。若产品以后要求结果页复述，也只能作为独立 advisory，不改变 care eligibility 或 ranking。

V1.1 文档给出了“失能/重度失能或明确一对一、鼻饲、压疮、24 小时照护”等高照护示例，但没有冻结“较低预算”的机器阈值。建议候选阈值为最低已声明预算档 `cny_3500_5000`，必须经产品批准后才能编码；这只是用户已选预算档，不是武汉市场最低价。

## 10. Frozen Contract Impact Matrix

| Contract | Current status/version | Impact | Proposed version/action | Reason |
|---|---|---|---|---|
| `ASSESSMENT_CONTRACT` | `FROZEN_PHASE_2D`, schema 1 | `VERSION_BUMP_REQUIRED` | assessment schema 2；保留 v1 reader | 新增 5 required-candidate IDs，priority option set 改义 |
| `ADL_RULE_CONTRACT` | `FROZEN_V1`, `adl-ruleset-v1` | `UNCHANGED` | 继续 v1 | 七题、ordinal、care-level 规则无变化 |
| `ELDER_PROFILE_CONTRACT` | `FROZEN_PHASE_3A_2`, `elder-profile-contract-v1` | `VERSION_BUMP_REQUIRED` | `elder-profile-contract-v2`; derivation `v1.1` | public semantic payload 从 27/27 扩为 32/32，并新增 nutrition/preference facts |
| `ANONYMOUS_PROFILE_PREVIEW_CONTRACT` | `FROZEN_PHASE_3A_3`, preview schema 1 | `VERSION_BUMP_REQUIRED` | preview schema 2；identity/persistence policy 不变 | validated snapshot 和 semantic payload 版本变化 |
| `PROFILE_UI_CONTRACT` | `PROFILE_UI_PHASE_3B = FROZEN` | `COMPATIBLE_EXTENSION` | V1.1 amendment 后重新验收 | 新增展示 section/items，不需重写 state、navigation 或 action 模型 |
| `INSTITUTION_CONTRACT` | `FROZEN_PHASE_4A_2`, `institution-contract-v1` | `VERSION_BUMP_REQUIRED` | 建议 `institution-contract-v1.1` + v1 adapter | 大量 additive typed facts、validation 与 evidence path；核心 unknown/verification 语义不变 |
| `INSTITUTION_CAPABILITY_CONTRACT` | `FROZEN_PHASE_4A_2`, `institution-capability-contract-v1` | `UNCHANGED` | 继续 v1 | V1.1 不新增护理 hard capability；meal texture 属于 Institution life-fit/service fact，不扩张安全矩阵 |
| `RECOMMENDATION_CONTRACT` | `FROZEN_PHASE_4B_2`, `recommendation-contract-v1` | `VERSION_BUMP_REQUIRED` | 建议 `recommendation-contract-v1.1` | 新 elder/institution soft facts、stable reason/difference/evidence family |
| `RECOMMENDATION_RULE_CONTRACT` | `FROZEN_V1`, `recommendation-ruleset-v1` | `VERSION_BUMP_REQUIRED` | 建议 `recommendation-ruleset-v1.1`; safety policy 仍 v1 | priority set/rank vector 扩展；hard tier semantics 不变 |
| `RECOMMENDATION_PREVIEW_INTEGRATION_CONTRACT` | `FROZEN_PHASE_4C_1`, integration v1 | `COMPATIBLE_EXTENSION` | 建议文档/manifest v1.1 amendment | Draft→Preview、完整 catalog、显式时间、错误和无持久化边界均可复用；增加 version dispatch |
| `RECOMMENDATION_RESULT_UI_CONTRACT` | `PROPOSED_PHASE_4C_2`, UI v1 | `COMPATIBLE_EXTENSION` | 冻结前修订为 proposed UI v1.1 | 当前尚未 frozen；保留页面状态与交互，扩展内容/文案/code map |

在 side-by-side version reader、迁移器和 adapter 存在的前提下，本轮没有必须标记为 `BREAKING_CHANGE` 的 Contract。若选择原地改变 v1 stable code 含义或拒绝读取所有 v1 Draft/历史记录，则会变成 breaking，当前不建议。

## 11. Data Migration

### 11.1 AssessmentDraft

建议 `schemaVersion: 1 -> 2`，提供 deterministic local Draft migrator：

1. 先按 v1 validator 验证；损坏的 v1 Draft 继续走现有 invalid-storage 规则；
2. 保留 `localDraftId`、原创建时间和全部未改义答案；迁移更新时间可更新，但不能伪装 server identity；
3. 五个新增 question key 保持缺失（UNANSWERED），不得补业务默认值；
4. priority 全部安全可映射时保存 v1.1 code；包含任何歧义/删除 code 时，v2 active answer 不得保留半套映射，整题要求重答；
5. `currentStep` 指向最早受影响且未完成的 step，通常为 `health`，保证 Continue 引导补齐；
6. 对整题重答场景，在 v2 Draft 的非业务 `migrationNotice`（命名待 Contract 冻结）中仅保留 `fromSchemaVersion`、原 stable priority codes 和 `requiresReselection=true`，供 UI 显示“产品选项已更新，请重新选择”；这些 legacy codes 不进入 Profile/Recommendation；
7. 用户完成重答后清除该 notice；清理 Draft 时一并清理，不形成第二套 Draft store、服务器记录或长期历史；
8. v2 事务性写入成功前不得删除唯一 v1 source；迁移失败继续恢复原 v1 Draft。旧 Draft 不是“全部作废”，歧义偏好也不是静默丢弃。

### 11.2 CompletedAssessment and history

- CompletedAssessment v1 永久保持 schema 1 和原始答案，不回写、不补问题、不改 priorities；
- v1 历史必须用 v1 ElderProfile/Recommendation rules 解释，避免重新派生后结果漂移；
- 新 completion 使用 schema 2；正式历史持久化未来必须按 schema/ruleset version dispatch；
- 不得把 localDraftId 当 assessmentId，也不得创建 fake elderId/completedAt。

### 11.3 Fixtures and development data

| Asset | Migration proposal |
|---|---|
| Mock Draft | 保留 v1 migration fixtures；新增 v2 complete/incomplete/unknown/priority-remap fixtures |
| ElderProfile fixtures | 保留 v1 regression；新增 32/32 v2 raw mapping、nutrition/evidence/clarification cases |
| Preview fixtures | 保留 no-identity/no-persistence gates；新增 v2 snapshot/version mismatch cases |
| Recommendation fixtures | 保留现有 V1 safety/ranking oracle；新增 v1.1 soft-fit、priority、unknown/evidence/permutation cases |
| Development Institution Catalog | 7–8 家数量不变；新增 facts 默认 unknown/unverified；只在明确 synthetic scenario 下给值；名称/Mock banner/VR null 不变 |

测试 fixture 与 `miniprogram/mock/` 继续分离，App 不得 import `scripts/fixtures/**`。

## 12. Versioning Proposal

| Layer | Current | Proposed | Rationale |
|---|---|---|---|
| Assessment schema | `1` | `2` | question set 与 priority enum 是 persisted public schema change |
| ADL ruleset | `adl-ruleset-v1` | 不变 | ADL 规则未变 |
| ElderProfile contract | `elder-profile-contract-v1` | `elder-profile-contract-v2` | public payload shape 与 raw coverage 改变 |
| ElderProfile derivation ruleset | `elder-profile-ruleset-v1` | `elder-profile-ruleset-v1.1` | 新增 nutrition/preference derivation，但不改 ADL |
| Profile summary schema | `elder-profile-summary-input-v1` | `elder-profile-summary-input-v2` | 新 section/item code |
| Anonymous preview schema | `1` | `2` | validated snapshot 与 payload version 改变 |
| Institution contract | `institution-contract-v1` | `institution-contract-v1.1` | additive structured facts，核心 identity/verification 语义不变 |
| Institution capability contract | `institution-capability-contract-v1` | 不变 | meal texture 作为 Institution life-fit/service fact，不改护理 hard capability |
| Recommendation contract | `recommendation-contract-v1` | `recommendation-contract-v1.1` | 新 soft facts/reasons/differences；identity/manifest 不变 |
| Recommendation ruleset | `recommendation-ruleset-v1` | `recommendation-ruleset-v1.1` | priorities/rank factors 改变，结果可能合法变化 |
| Recommendation safety policy | `conservative-exact-with-conditional-v1` | 不变 | eligibility/tier 安全语义不变 |
| Preview integration | integration v1 | compatible v1.1 amendment | data flow/time/error/persistence 不变，只做 version routing |
| Result UI contract | proposed UI v1 | proposed UI v1.1 | 尚未冻结，可直接按 V1.1 完成修订后验收 |

版本字符串只是建议。正式实施前必须一次批准，避免各层各自命名。

## 13. Profile UI Impact

现有 Profile 页面状态、Draft snapshot 获取、实时 derive、错误路由、Back/修改入口、Primary CTA、单 Action 通道和 NavigationGuard 均可保留。V1.1 只需局部扩展：

- 新增“进食与饮食”模块：咀嚼、吞咽、食物形态支持和澄清；
- Preference 模块新增房型、餐次、活动/社交偏好；
- unknown/clarification 继续以不确定文案展示，不能渲染成确定护理事实；
- 高照护+较低预算作为非阻断 advisory；
- `special_feeding` 仍不得显示为 tube feeding，`catheter_or_stoma` 仍不得显示为 catheter care；
- 修改入口仍回现有 `health` 或 `preference` 页面，不新增 step。

这属于 `COMPATIBLE_EXTENSION`，不授权推倒 Phase 3B 页面。

## 14. Recommendation UI Impact

Phase 4C-2 以下实现资产应最大化保留：

- page state / loading / error / empty/no-safe；
- development Mock banner；
- Exact、SoftNear、Conditional 分组与 Unverified/Ineligible 不进卡规则；
- reason/difference 的稳定 code 驱动渲染；
- price/availability advisory；
- institution identity gate；
- interaction、快速 CTA guard、Back 和错误恢复；
- 最多 3 张卡、不补齐、不显示百分比。

V1.1 后只做局部更新：

- ViewModel 增加 nutrition/life-fit、room/meal/activity 的 reason/difference label；
- 评估摘要增加进食/吞咽提醒，但未确认线索不得写成结论；
- “选择机构时重点确认”增加护理团队、膳食形态、医疗值守和医院距离等真实资料项；
- institution snapshot/manifest 兼容新 contract version；
- generic high-care/low-budget reminder 保持 advisory，不伪装 institution-specific difference；
- 不改变下游 detail identity gate，不添加真实武汉记录或假 VR。

```text
PHASE_4C_2_REWRITE_REQUIRED = FALSE
PHASE_4C_2_ANDROID_GATE = DEFERRED_UNTIL_V1_1_UPDATE
```

## 15. Recommendation Preview Integration Impact

Application data flow 保持：

```text
AssessmentDraft snapshot
  -> versioned validate/migrate
  -> deriveElderProfilePreview

full Institution Catalog
  -> provider
  -> versioned runtime validation/adapter

ElderProfilePreview + full validated pool + explicit evaluationAsOf
  -> versioned deriveRecommendationPreview
```

Service 不预筛、不预排序、不截断 top 3，不重写 matching，不持久化 Preview。需增加的只是明确 version dispatch、v1/v1.1 catalog adapter 和稳定的 version-mismatch integration error；`evaluationAsOf` 继续由 application boundary 一次性显式传入。

## 16. Implementation Sequence

| Phase | Scope | Required reviews / exit gate |
|---|---|---|
| V1.1-A | 产品决策闭环；Assessment Contract v2 proposal；question IDs/codes/required/priority migration 冻结 | 主 SOL + wechat_frontend + matching_engine + qa_reviewer；不先改页面 |
| V1.1-B | Draft v1→v2 migrator；Assessment types/validators/runtime fixtures；Health/Preference/预算提醒 UI | wechat_frontend 写入；qa_reviewer 独立检查；Android 暂不做总 Freeze |
| V1.1-C | ElderProfile v2 + Preview v2，nutrition/evidence/clarification/summary；ADL v1 regression | matching_engine 语义审查；qa_reviewer；targeted WeChat TS |
| V1.1-D | Institution v1.1 types、verification、runtime validation、legacy adapter、development catalog 与 fixtures | backend_domain 只读 persistence review + matching_engine allowlist review + qa_reviewer |
| V1.1-E | Recommendation contract/ruleset v1.1、soft-fit/dedup/reason/difference/manifest 与 integration | matching_engine 负责语义；全量 deterministic/permutation/regression Gate；qa_reviewer |
| V1.1-F | Profile UI + Recommendation Result UI 局部更新；保持 Phase 4C-2 interaction/identity/error 资产 | wechat_frontend；DevTools compile；交互 runtime；qa_reviewer |
| V1.1-G | 综合回归、Mock 真值审计、WeChat compatibility、DevTools、Android 17 人工真机 | 明确区分 AUTOMATED / DEVTOOLS / MANUAL_ANDROID_REAL_DEVICE_VERIFICATION；通过后才允许 Freeze/commit |

依赖原则：Assessment IDs 先冻结；ElderProfile 和 Institution 可在不改同一文件的前提下并行；Recommendation 必须等待两侧 Contract；UI 必须等待 Domain code/summary contract。任何重要功能完成后均由 qa_reviewer 独立检查，再由主 SOL 最终验收。

## 17. Independent Agent Reviews

### 17.1 matching_engine

`MATCHING_ENGINE_REVIEW = PASS_WITH_GAPS`

- 确认 ADL 七题、`adl-ruleset-v1`、五档 tier、安全硬条件与 NO_EXACT_MATCH 原则不变；
- 确认 chewing/swallowing 不改变 ADL ordinal、careLevel 或 tube-feeding requirement；
- 房型和膳食具备未来 structured fit 基础，但必须先冻结房型可用性/价格关系、meal service status 与 comparator；
- 活动、交通、医院距离当前 `NOT_YET_SCORABLE`；staffing/medical 只允许 `DISPLAY_EXPLAINABLE`；
- Recommendation Contract 因 priority/public factor 改动必须版本化；Ruleset 只有在新排序规则与 fixtures 正式冻结时才能发布新版本；
- 其余 gap 是新增字段 required、priority migration、距离口径和预算提醒阈值，均已列入 §18。

### 17.2 wechat_frontend

`WECHAT_FRONTEND_REVIEW = PASS_WITH_GAPS`

- 确认六步路由、AssessmentDraft 单 store、QuestionSection/choice/footer、首错定位与交互契约可复用；
- 确认 Health/Preference 是增量 QuestionSection，Budget 只增非阻断提示；
- 确认 Profile/Recommendation Result 无需推倒重写，Phase 4C-2 state、Mock disclosure、tier、identity gate 和 action/guard 可保留；
- 建议 PRD 未明确的五个新问题先视为 required/optional 产品决策；该 Agent 倾向 optional，本文件倾向借助 explicit unknown/no_preference 设为 required，两者均禁止补默认答案；
- 确认 Android Gate 和 Phase 4C-2 Freeze 继续暂停。

### 17.3 backend_domain

`BACKEND_DOMAIN_REVIEW = PASS_WITH_GAPS`

- 确认 staff counts、caregiver/resident ratio、nurse station、partner hospitals、rehabilitation、既有房型/设施及全部主要价格组成已经由 V1 支持；
- 确认人员资质/经验/响应、24h medical duty、monitoring、扩展房间设备、meal/activity/transport/hospital distance 需要 typed structure + field verification；
- 确认 Institution Capability v1 的护理 hard matrix不应因生活适配资料改变；
- 建议不可变 `recordRevision`、子事实与 evidence 同 revision，缺失不得补 false/0/supported；
- 确认当前 8 条 Development Catalog 继续仅为 `MOCK_DEVELOPMENT_ONLY`，不实现 Backend、HTTP 或数据库。

### 17.4 qa_reviewer final review

```text
QA_PRE_REVIEW = PASS_WITH_RISKS
QA_FINAL_REVIEW = PASS_WITH_RISKS
DOCUMENT_BLOCKER = 0
```

独立 QA 确认本文应覆盖的来源、11 个 Contract、Assessment migration、ADL 边界、ElderProfile 分层、Institution verification、soft-fit gate、4C-1/4C-2 preservation 和 Mock 真值边界均已纳入。预审提出的三项非阻断改进也已闭环：

- 增加 V1.1/current 与 V1/historical source manifest、关键页码和 archive 路径；
- 显式冻结 NO_EXACT_MATCH reason/provenance，并禁止 soft fit 改变安全/Exact 判定；
- 为歧义 legacy priorities 增加可审计 migration notice 与事务性 source 保留，避免静默丢失。

`PASS_WITH_RISKS` 只表示 §18 的产品决策仍阻断生产实现，不表示本文存在缺失项或代码 blocker。

## 18. Product Decisions Required

以下是影响分析形成时的九项待决策记录；其最终裁决已由项目负责人在 Phase V1.1-A 批准，并由 §18.1 覆盖。为保留决策过程，本节不回写早期 proposal code，但它们不再是 active contract：

1. 五个新增问题是否全部 required；本文建议“是”，并通过 `unknown/no_preference` 提供诚实中性答案。
2. §3 的 option code 与 §8 的 12 个 priority code 是否批准。
3. `nursing_professionalism` / `caregiver_attitude` 是否允许合并迁移至 `caregiver_quality`；若不批准，含这些项的 priority 整题重答。
4. `significant_difficulty` 的 clarification priority：仅 advisory，还是 `required_before_classification`；无论如何都不得自动产生 tube feeding。
5. high-care/low-budget advisory 的“较低预算”阈值；候选为 `cny_3500_5000`，不代表市场最低价。
6. easy-chew/modified-diet 的 life-fit service status 是否首版即可进入 soft fit，还是先作 display fact；无论哪种选择都不扩张 Institution 护理 hard capability 矩阵。
7. “大型医院”的资格定义、distance 算法/单位、freshness 和排名阈值；未批准前只展示。
8. transportation 是否有可比较口径；没有用户出发点时不得把“交通便利”主观量化。
9. Institution/Recommendation 采用 `v1.1` 字符串还是 major `v2`；本文建议 additive v1.1，保留 v1 reader/adapter。

### 18.1 Phase V1.1-A Final Decision Override

```text
DECISION_OVERRIDE_STATUS = APPROVED
ACTIVE_ASSESSMENT_CONTRACT = ASSESSMENT_CONTRACT_V2.md
ACTIVE_DRAFT_MIGRATION_CONTRACT = ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md
```

本节取代本文所有冲突的“建议”“候选”“命名待冻结”和“待产品批准”内容，但不改写其历史分析上下文：

1. 五个新增 question 均为 required；Assessment V2 共 32 题、26 required、6 optional/conditional，仍为六步。
2. 最终 option code 覆盖关系：
   - `soft_or_easy_chew` → **不采用**；正式 code 为 `easy_chew`；
   - `food_modification_required` → **不采用**；正式 code 为 `modified_food`；
   - `occasional_difficulty_or_choking` → **不采用**；正式 code 为 `occasional_difficulty`；
   - `multi_bed` → **不采用**；正式 code 为 `triple_or_more`；
   - 其余五题 code 以 `ASSESSMENT_CONTRACT_V2.md` 的完整清单为准。
3. `preference.priorities` 的 12 个 V2 code 已冻结。六个无歧义 V1 code 可保留；只要存在任一歧义 code，整个 V2 answer 保持 UNANSWERED，禁止静默或部分映射。
4. 正式 migration notice 字段为 `originalQuestionId`、`originalOptionCodes`、`sourceSchemaVersion`、`targetSchemaVersion`、`reasonCode`，且 `reasonCode = PRIORITIES_REQUIRE_RESELECTION_V2`。本文早期 `fromSchemaVersion` / `requiresReselection` 提案不采用。
5. `significant_difficulty` 不阻止 Assessment completion、ElderProfile、ADL 或 careLevel derivation；只形成 nutrition/swallowing fact 与 clarification，永不自动生成 `tube_feeding`。
6. high-care + low-budget 只产生 advisory candidate；低预算规范化为 `budget.monthlyRange === 'cny_3500_5000'`，unknown/UNANSWERED 不触发，不改变 completion、careLevel 或 Recommendation eligibility。
7. meal texture 为 `DISPLAY_EXPLAINABLE_V1_1`；不得在 Assessment Contract 中建立 matching score。
8. `near_major_hospital` 与 `transportation` 均为 `NOT_YET_SCORABLE_V1_1`。
9. 未来公开版本名为 `recommendation-contract-v2` 与 `recommendation-ruleset-v2`；`recommendation-contract-v1.1` / `recommendation-ruleset-v1.1` 提案不采用，safety policy `conservative-exact-with-conditional-v1` 保持不变。

历史 CompletedAssessment V1 保持 immutable，ADL 七题与 `adl-ruleset-v1` 不变。以上仅批准 Contract；V1.1 production implementation 仍未开始。

## 19. Blockers and Risks

### Blockers

- 本分析文档无代码 blocker。
- §18 的九项产品决策已经由 §18.1 闭环；后续实现只能读取两份 Phase V1.1-A frozen Contract，不得读取早期 proposal row 作为机器语义。
- Phase 4C-2 不得 Freeze、commit 或开始 Android Gate。

### Risks

- 若原地改 `preference.priorities` 的 v1 code 含义，会破坏历史 Recommendation determinism。
- 若 Draft migrator补默认答案，会把“用户未回答”伪造成事实。
- 若把吞咽困难等同鼻饲，会错误制造高风险 hard requirement。
- 若新增 Institution 字段只有展示值、没有 availability/verification/evidence，会把资料缺失误判成能力不足或支持。
- 若把人员数量、经验文案、餐食图片或环境文案变成分数，会重新引入不可解释的 fake ranking。
- 若 result UI 先于 Domain/Contract 更新，会在页面层重做 derivation 或匹配。
- 当前 V1-based Phase 4C-2 工作树仍未提交；迁移期间必须保持来源边界，防止与 V1.1 修改混杂。

## 20. Next Recommendation

Phase V1.1-A 只冻结 Assessment V2 与 Draft migration Contract。当前保持：

```text
PRODUCT_V1_1_CHANGE_IMPACT_ANALYSIS = REVIEWED
ASSESSMENT_V2_CONTRACT = FROZEN_PHASE_V1_1_A
ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT = FROZEN_PHASE_V1_1_A
V1_1_IMPLEMENTATION = NOT_STARTED
PHASE_4C_2_FREEZE = DEFERRED_BY_V1_1_PRODUCT_CHANGE
```

等待项目负责人审阅 Phase V1.1-A；未经下一阶段授权，不得开始 V1.1 页面、Domain、Institution、Recommendation 或 Backend 实现。
