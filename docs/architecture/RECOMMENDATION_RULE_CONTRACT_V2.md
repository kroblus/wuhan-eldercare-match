# Recommendation Ruleset V2

状态：`FROZEN_PHASE_V1_1_E`

版本：`recommendation-ruleset-v2`

Safety policy：`conservative-exact-with-conditional-v1`（不变）

本文件冻结 V2 life-fit、12 priorities、去重、Exact 与 lexicographic ordering。产品决策
`A1 / B2 / C1 / D1` 及 Institution V1.1 保守房型边界已经项目负责人批准；未选方案仅作为
`REJECTED_PRODUCT_ALTERNATIVE` 记录，不是可执行分支。

## 1. Immutable Safety and V1 Boundary

V2 必须先执行 frozen V1 Safety Core，再处理生活适配：

```text
validated V2 profile + validated V1.1 institution
  -> frozen care/cognition/special-care requirements
  -> conflict / institution unknown / conditional aggregation
  -> only when safety satisfied: V2 structured soft exactness and ranking
```

`conflict -> INELIGIBLE`、effective unknown -> `UNVERIFIED`、requires assessment -> `CONDITIONAL`；任何
生活适配不能补偿或升级这些 tier。V1 engine、V1 117 fixtures、V1 22-field projection 与 V1 tuple 完全不变。

## 2. ROOM_FIT

冻结稳定类型：

```ts
type RoomFitV2 = 'match' | 'unknown' | 'mismatch' | 'not_applicable'
```

正向兼容映射可由 stable code 唯一确定：

| Elder roomTypePreference | compatible Institution roomType |
|---|---|
| `no_preference` | `not_applicable`，不读取机构房型 |
| `single` | `single` |
| `double` | `double` |
| `triple_or_more` | `multi_bed` |

`suite` / `other` 不自动等价于 single/double/multi-bed。当前 verified compatible room fact 存在时可返回
`match`；任何未核验、expired、unknown/unavailable roomType 只能贡献 unresolved evidence。

`match` 只表示当前 verified 机构资料列出兼容房型，不表示该房型此刻有床、可立即入住或已为用户预留；
`operations.bedAvailability` 不能被拼接成房型库存结论。

存在一个阻断性事实边界：`INSTITUTION_CONTRACT_V1_1.md` §3 明确规定 child collection 为空只表示当前
revision 无可声明事实，不证明现实不存在；`rooms[]` 也没有“清单完整/目标房型明确不提供”的字段。因此
“当前数组未列出 compatible type”不能安全生成 `mismatch`。

在现有 frozen Institution V1.1 下的安全输出是：

- current verified compatible row 存在 -> `match`；
- `no_preference` -> `not_applicable`；
- 其他情况 -> `unknown`，文案只能表示“当前核验资料不足/未列出”，不能表示“机构不提供”。

`mismatch` 只有在未来存在 current verified 的排他房型集合/明确 requested type unavailable fact 后才可输出。
这不是可以由排序偏好决定的产品选项，而是 frozen Institution 输入的数据充分性边界；当前 V2 固定采用
保守的 `match / unknown / not_applicable`。`RoomFitV2` 为前向兼容保留 `mismatch`，但它在
`institution-contract-v1.1` 下不可达。若业务要求产生 mismatch，必须先版本化扩展 Institution Contract。

```text
ROOM_NEGATIVE_EVIDENCE_POLICY = CONSERVATIVE_CURRENT_INSTITUTION_V1_1
ROOM_TYPE_MISMATCH = NOT_PRODUCIBLE
```

## 3. MEAL_SCHEDULE_FIT

冻结稳定类型：

```ts
type MealScheduleFitV2 = 'match' | 'unknown' | 'mismatch' | 'not_applicable'
```

冻结 comparator：

```text
MEAL_SCHEDULE_COMPARATOR = EXACT_STABLE_CODE_ONLY
```

规则：

- Elder `no_preference` -> `not_applicable`；
- Institution field `availability=unavailable` -> `fit=unknown`，同时输出
  `MEAL_SCHEDULE_DATA_UNAVAILABLE` 并在 evidence ref 保留 `unavailable`；
- Institution field `availability=unknown`、current verified value=`unknown/other`，或 evidence
  expired/unverified -> `fit=unknown`，输出 `MEAL_SCHEDULE_UNKNOWN` 并保留原始 field/evidence 状态；
- `three_meals / three_meals_one_snack / three_meals_two_snacks` 只有 stable code 完全相同才 `match`；
- 已知另一个标准 code -> `mismatch`；
- known non-match 只影响 soft fit，不影响 Safety；
- 不能从餐次推断餐饮质量、营养质量或照护能力。

因此 `unavailable != unknown` 在稳定 output code 与 evidence 中始终成立；两者共享 `fit=unknown` 只表示
comparator 无法确认偏好满足，不表示来源事实相同，也不表示机构明确不提供该餐次。

额外点心不默认包含较低餐次偏好，禁止实现 minimum-service containment，也不引入
`matchBasis = minimum_schedule_satisfied`。

```text
A1 EXACT_STABLE_CODE_ONLY = SELECTED
A2 MINIMUM_SERVICE_CONTAINMENT = REJECTED_PRODUCT_ALTERNATIVE
```

## 4. ACTIVITY_FIT

Elder stable code：`no_preference / indoor / outdoor / indoor_and_outdoor`。唯一可比较的 Institution facts 是
current verified `activity.indoorSpace` 与 `activity.outdoorSpace` 的 `present/absent`；offerings、zones、图片和
描述不进入 comparator。

冻结为 B2 display-only：只允许把 current verified indoor/outdoor presence 作为可解释展示信息；
`activityFit.rankParticipation = not_scorable`，不进入 eligibility tier、Exact predicate、PriorityFitVector 或
rank tuple。`activity_space` priority 同样保持不可评分。

`ACTIVITY_SPACE_MATCH / ACTIVITY_SPACE_MISMATCH / ACTIVITY_SPACE_UNKNOWN` 在本 ruleset 中均为
`INACTIVE_IN_RULESET_V2`，不得输出为 ranking reason/difference。未来只有通过新 Contract/Ruleset version 才能
启用 comparator。

```text
B2 DISPLAY_ONLY_NOT_SCORABLE = SELECTED
B1 STRUCTURED_SOFT_COMPARATOR = REJECTED_PRODUCT_ALTERNATIVE
```

## 5. Nutrition Display Mapping

`MEAL_TEXTURE_MATCHING_ROLE = DISPLAY_EXPLAINABLE_V1_1`，始终 rank-neutral：

| Elder derived fact | Institution current verified service fact | V2 output |
|---|---|---|
| `easy_chew` | `available` | reason `EASY_CHEW_SUPPORT` |
| `easy_chew` | `unavailable` | difference `EASY_CHEW_SUPPORT_UNAVAILABLE` |
| `easy_chew` | `requires_inquiry` | gap `EASY_CHEW_SUPPORT_REQUIRES_INQUIRY` |
| `easy_chew` | unknown/unverified/expired | gap `EASY_CHEW_SUPPORT_UNKNOWN` |
| `modified_food` | `available` | reason `MODIFIED_FOOD_SUPPORT` |
| `modified_food` | `unavailable` | difference `MODIFIED_FOOD_SUPPORT_UNAVAILABLE` |
| `modified_food` | `requires_inquiry` | gap `MODIFIED_FOOD_SUPPORT_REQUIRES_INQUIRY` |
| `modified_food` | unknown/unverified/expired | gap `MODIFIED_FOOD_SUPPORT_UNKNOWN` |
| `standard` | any | not_applicable；不因机构提供特殊膳食加分 |

每条 positive reason 必须同时引用 Elder `nutrition.foodTextureSupport` evidence 与对应 Institution extension
evidence。Swallowing concern 不生成 tube feeding、ADL contribution、机构 capability outcome 或 rank factor；
但其 frozen `required_before_hard_filter` clarification 来自 `ELDER_PROFILE_CONTRACT_V2.md` §12，并由 Preview
V2 parity 继承；Recommendation 只消费该上游状态，不能重新定义或被机构 nutrition support 绕过。

```text
NUTRITION_READINESS_BOUNDARY = UPSTREAM_FROZEN_AND_INHERITED
```

## 6. Priority V2 Mapping Matrix

只有 `STRUCTURED_SCORABLE` 可以进入 PriorityFitVector；另两类始终 rank-neutral：

| V2 priority | Institution fact(s) | Role | Verification | Rank owner / dedup |
|---|---|---|---|---|
| `care_capability` | frozen Safety constraint results | `DISPLAY_EXPLAINABLE` | frozen current effective capability | Safety Core 唯一 owner；不再 soft score |
| `caregiver_quality` | staffing certification/experience/response facts | `DISPLAY_EXPLAINABLE` + `NOT_YET_SCORABLE` | field-level current verified | 无统一质量阈值；不进 vector |
| `medical_conditions` | clinic/relationship/duty/monitoring display facts | `DISPLAY_EXPLAINABLE` + `NOT_YET_SCORABLE` | field-level current verified | 具体 dementia/rehab Safety mapping仍由原 owner；不泛化评分 |
| `rehabilitation_capability` | frozen rehabilitation training effective capability | `STRUCTURED_SCORABLE` | Capability V1 projection | explicit hard 时 consumed_by_hard；否则 selected priority 消费 rehab baseline |
| `food_quality` | meal service/display facts | `DISPLAY_EXPLAINABLE` + `NOT_YET_SCORABLE` | field-level current verified | meal schedule/texture 不等于 food quality；不进 vector |
| `living_environment` | 无批准 comparator | `NOT_YET_SCORABLE` | N/A | 不读图片/描述造分 |
| `room_facilities` | room feature facts | `DISPLAY_EXPLAINABLE` + `NOT_YET_SCORABLE` | field-level current verified | 与 room type 是不同语义；不得消费/重复 roomFit |
| `activity_space` | indoor/outdoor presence | `NOT_YET_SCORABLE` | field-level current verified | B2 display-only；priority 与 direct preference 均不评分 |
| `transportation` | metro/bus/vehicle facts | `NOT_YET_SCORABLE` | 可展示时仍需 current verified | 无用户起点/comparator；不进 vector |
| `near_major_hospital` | hospital category/distance facts | `NOT_YET_SCORABLE` | 可展示时仍需 current verified | 无大型医院定义/距离阈值；不进 vector |
| `price` | frozen referenceMonthlyPrice -> budgetFit | `STRUCTURED_SCORABLE` | V1 current effective price | selected priority 消费 budget baseline |
| `region` | frozen identity.regionCode -> regionFit | `STRUCTURED_SCORABLE` | V1 current effective region | selected priority 消费 region baseline |

Display fact 只在证据 current verified 时产生正向 explanation；unknown 不能写成 negative fact。选择不可评分
priority 只保留 `not_scorable/informational`，不得伪造 mismatch 或降低所有机构。

## 7. RANK_FACTOR_DEDUP_RULES

每项 factor 必须输出显式 rank participation：`baseline / selected_priority / consumed_by_priority /
consumed_by_hard / not_applicable / not_scorable`。唯一 owner 如下：

| Potential duplicate | V2 rule |
|---|---|
| price priority + budget fit | priority vector 消费 budget；baseline budget slot neutral；exactness 仍检查原 budget fit |
| region priority + region fit | priority vector 消费 region；baseline region slot neutral；exactness 仍检查原 region fit |
| rehab priority + rehab soft fit | 无 hard 时 priority 消费 rehab；有 explicit hard 时两者均不重复 rank |
| room_facilities priority + roomFit | 两者不是同一事实；priority 不评分，roomFit 仅保留一个 baseline owner |
| activity_space priority + activityPreference | B2 下两者都不评分；只保留 current verified display facts |
| care_capability priority + Safety Core | Safety Core 唯一 owner；priority 只解释，不增加 rank |
| food_quality priority + meal schedule/texture | 不同语义；food quality 不评分，mealFit 独立 baseline，texture display-only |
| medical_conditions + dementia/rehab safety | 已冻结的具体 mapping 保持原 owner；generic priority 不重复 |

去重只使 rank slot neutral，不删除原始 fit、reason、difference、evidence 或 exactness 检查。

## 8. PriorityFitVector V2

合法 priority 为 1–3 个 V2 stable code；重复、空、未知或 V1 code 均为 invalid input。合法集合先按 frozen
V2 code order canonicalize，不修改 Profile。

```text
matchedCount descending
partialCount descending
knownMismatchCount ascending
unknownCount ascending
```

每个 active structured priority 最多进入一个桶。`not_scorable / informational / not_applicable /
consumed_by_hard` 不计数。若用户三个 priority 中只有一个可评分，vector 只包含该一项；另两项不被伪造为
mismatch/unknown，也不破坏 Exact。

## 9. FINAL_LEXICOGRAPHIC_RANK_TUPLE V2

冻结 C1 Preserve-established-factors-first；禁止 global score、求和、乘权、浮点权重、隐藏 score 和输入顺序
tie-break：

```text
eligibilityTier
-> PriorityFitVectorV2
-> budgetFit
-> institutionTypeFit
-> regionFit
-> rehabilitationSoftFit
-> roomFit
-> mealScheduleFit
-> institutionId_ASCII
```

理由：先保留 V1 已冻结且更接近可负担性/机构类型/地域/康复的稳定比较，再加入生活适配；房型通常比餐次
更难调整，因此 room 在 meal 之前。B2 下不存在 activity rank slot，V1 tuple 本身不变。

```text
C1 PRESERVE_ESTABLISHED_FACTORS_FIRST = SELECTED
C2 LIFE_FIT_BEFORE_ESTABLISHED_BASELINE = REJECTED_PRODUCT_ALTERNATIVE
```

Ordinal 候选均为 `match > unknown > mismatch`；`not_applicable` 或被 priority/hard 消费时 slot 为 neutral/null。
`unknown` 优于已知 mismatch 只用于同 tier 排序，不代表资料缺失是正向事实。

## 10. Exact Boundary V2

先依次判定 readiness、hard conflict、hard unverified、hard conditional；只有全部 applicable Safety constraint
satisfied 才进入 Exact/SoftNear。V1 budget/type/region/rehab Exact predicate 原样保持。

新增 structured factor 的候选规则：

- Elder 明确指定且 factor `match`：允许 Exact；
- `mismatch`：SoftNear，不改变 care safety；
- `not_applicable`：中性；
- `DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE`：中性，不破坏 Exact；
- 用户指定 room/meal 且 effective fact `unknown`：`EXACT -> SOFT_NEAR`，同时输出对应 soft data gap。

Activity B2、nutrition display mapping 与不可评分 priority 均对 Exact 中性。D1 保持事实完备边界：Exact 不得
声称一个明确 room/meal 偏好已满足而没有 current verified 资料。

```text
D1 UNKNOWN_DOWNGRADES_EXACT_TO_SOFT_NEAR = SELECTED
D2 UNKNOWN_REMAINS_EXACT_ELIGIBLE = REJECTED_PRODUCT_ALTERNATIVE
```

Priority-only 的 mismatch/unknown/not-scorable 仍不单独改变 Exact；若 priority 复用 budget/region/rehab/activity
基础 factor，则由该基础 factor 的 Exact predicate 决定，不能因 rank slot neutral 而跳过。

## 11. Reasons, Differences and NO_EXACT_MATCH

V1 reason/difference/code、卡片上限与 `NO_EXACT_MATCH` 优先级全部保留。V2 只增加 Contract V2 §9 的 stable
codes。正向 reason 要求双侧 evidence；rank-neutral explanation 不得伪装为排名原因。

`NO_EXACT_MATCH` 仍优先：空准入池、Elder Safety readiness 阻断、全部 hard conflict、只有 SoftNear、只有
Conditional。Room/meal difference 可解释为什么候选是 SoftNear；activity 仅展示。它们都不能改变硬冲突或
让 Unverified/Ineligible 进卡。

## 12. Representative Runtime Scenarios

以下是后续 runtime fixture 的最低 frozen expectation；当前只冻结规则，不声称 engine 已执行：

| ID | Scenario | Frozen expected outcome |
|---|---|---|
| `REC-V2-PROP-001` | single + current verified single room | room match；双侧 refs；其他 factor 满足时可 Exact |
| `REC-V2-PROP-002` | single + verified nonmatching rows only | 现 Contract 下 room unknown；只有 E2 完备事实后才 mismatch |
| `REC-V2-PROP-003` | specified room + empty/unverified room facts | room unknown；不得写“不提供” |
| `REC-V2-PROP-004` | meal stable code exact equal | meal match |
| `REC-V2-PROP-005` | specified meal + unknown/unverified field | meal unknown；SoftNear + data gap |
| `REC-V2-PROP-006` | known unequal meal schedules | exact-code comparator mismatch；SoftNear |
| `REC-V2-PROP-007` | easy_chew + verified available | display reason；rank/tier 不变 |
| `REC-V2-PROP-008` | easy_chew + unknown | display gap；rank/tier 不变 |
| `REC-V2-PROP-009` | modified_food + verified available | display reason；不生成 tube feeding |
| `REC-V2-PROP-010` | modified_food + verified unavailable | display difference；不变为 INELIGIBLE |
| `REC-V2-PROP-011` | indoor + verified indoor present | display-only fact；不进入 Exact/vector/rank |
| `REC-V2-PROP-012` | indoor_and_outdoor + one unresolved | 只展示 current verified 部分；不产生 ranking fit |
| `REC-V2-PROP-013` | caregiver_quality priority, no approved metric | not_scorable/informational；vector 不计数 |
| `REC-V2-PROP-014` | near_major_hospital + verified distance | 保留 fact；无阈值，不评分 |
| `REC-V2-PROP-015` | transportation + metro/bus facts | 保留 fact；无用户起点/comparator，不评分 |
| `REC-V2-PROP-016` | price priority | budget 只由 vector 排一次；baseline neutral；Exact 仍检查 budget |
| `REC-V2-PROP-017` | region priority | region 只由 vector 排一次；baseline neutral；Exact 仍检查 region |
| `REC-V2-PROP-018` | rehab priority | hard/priority/baseline 按唯一 owner，不重复 |
| `REC-V2-PROP-019` | safety conflict + perfect room/meal/activity | INELIGIBLE；不进 cards；soft fit 不补偿 |
| `REC-V2-PROP-020` | same input repeated / institution permutation | deepEqual；candidate audit 和 cards 顺序一致 |

冻结后还必须增加 formal/preview parity、max-3、Unverified/Ineligible exclusion、no fake identity、no persistence、
V1 117-case regression 与 anti-fake-green manifest；不能用本表代替 runtime evidence。

## 13. Approved Product Decisions

| Decision | Selected policy | Rejected alternative | Status |
|---|---|---|---|
| A. Meal comparator | A1 `EXACT_STABLE_CODE_ONLY` | A2 containment | `APPROVED` |
| B. Activity role | B2 `DISPLAY_ONLY_NOT_SCORABLE` | B1 structured comparator | `APPROVED` |
| C. Rank tuple | C1 `PRESERVE_ESTABLISHED_FACTORS_FIRST` | C2 life-fit first | `APPROVED` |
| D. Structured unknown | D1 `UNKNOWN_DOWNGRADES_EXACT_TO_SOFT_NEAR` | D2 Exact eligible | `APPROVED` |

独立数据边界（不是第五项产品偏好决策）：当前 Institution V1.1 没有 verified exhaustive room inventory，
所以 V2 evaluator 不得产生 room mismatch，`REC-V2-PROP-002` 必须断言 unknown。`RoomFitV2` 可为前向兼容
保留 `mismatch` code，但启用该值前必须先有新的 Institution Contract/version 提供充分负面证据。

```text
PRODUCT_DECISION_GATE = CLOSED
RECOMMENDATION_V2_IMPLEMENTATION_AUTHORIZED = TRUE
RECOMMENDATION_V2_FREEZE = FROZEN_PHASE_V1_1_E
```

## 14. Determinism and Runtime Implementation Gate

后续实现必须为 pure domain：不读 Store/Page/Service、当前时间、随机数、网络、LLM 或 UI 文案，不修改
输入，不持久化 Preview。所有集合使用 frozen stable order/ASCII tie-break。

未来退出 Gate 至少包括：V2 expected-ID manifest、固定 assertion count、20 个代表场景及边界扩展、输入 permutation、
同输入 deepEqual、Formal/Preview parity、V1 117 fixtures、Institution V1/V1.1、ElderProfile V1/V2、Assessment
V1/V2、TypeScript 5.9、WeChat TS 4.1.2 targeted、generated JS compatibility、JSON、diff check 与独立 QA。
