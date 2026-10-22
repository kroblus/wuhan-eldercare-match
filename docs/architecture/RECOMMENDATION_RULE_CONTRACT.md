# Recommendation Ruleset V1

状态：FROZEN_V1

版本：recommendation-ruleset-v1

Policy：CONSERVATIVE_EXACT_WITH_CONDITIONAL

Policy version：conservative-exact-with-conditional-v1

本文由 Phase 4B-2 产品审批及 RESUME 的 matching_engine 审查增量形成。2026-08-31，matching_engine 落文与 backend_domain 身份/来源审查均最终只读 PASS 后冻结；此后才授权纯领域实现。A/B 决策历史保留在 RECOMMENDATION_RULE_PROPOSAL.md，不实现两套旧策略。实现与最终 QA 的 PASS 须另有运行证据。

## 1. Semantic inputs and scope

遵循 RECOMMENDATION_CONTRACT.md §19 的唯一输入/投影边界：合法 ElderProfile / ElderProfilePreview envelope、冻结的派生事实与偏好/财务原事实、完整 Institution pool、显式 evaluationAsOf 和版本。先 validateInstitutionRecord，再调用原 effective projection；core 只读取冻结的 22 个 matching-critical 字段。

不改变 Assessment、Interaction、ADL、ElderProfile、Preview、Profile UI、Institution 或 Capability。无原答案再推导、Page/Component/Store/Service、网络、LLM、当前时间、随机数、UUID、Backend、真实机构资料、百分比或总分。

## 2. Hard matrix and care mapping

| Elder requirement | effective supported | effective requires_assessment | effective unsupported | effective unknown |
|---|---|---|---|---|
| required | satisfied | conditional | conflict | unverified |
| not_required | not_applicable | not_applicable | not_applicable | not_applicable |
| not_reported | not_applicable | not_applicable | not_applicable | not_applicable |
| unknown / needs_confirmation | unresolved elder readiness | unresolved elder readiness | unresolved elder readiness | unresolved elder readiness |

not_reported 不是明确不需要。老人未解析状态不能形成确定 requirement，也不能冒充机构 unverified。多条已明确来源映射同一机构 fieldPath 时合并一项 hard constraint 并保留全部来源，不重复产生要求。

| 明确 Elder fact | Institution capability path（均加 `capabilities.` 前缀） |
|---|---|
| careLevel known independent / light_care / semi_disabled / disabled / severely_disabled | careLevelAcceptance 下同名档；五档独立，不继承 |
| mobility.level wheelchair 或 reported careMode wheelchair | mobilitySupport.wheelchair_support |
| mobility.level bedbound 或 reported careMode bedridden | mobilitySupport.bedbound_support |
| reported transfer_support / fully_dependent_transfer | mobilitySupport.transfer_support |
| reportedDiagnosis known reported | cognitiveSupport.dementia_acceptance；仅用户报告，不系统诊断 |
| wanderingRisk known present | cognitiveSupport.wandering_risk_support |
| specialCare capability required | specialCare 下同名能力 |

九项 special care 为 round_the_clock_care、one_to_one_caregiver、night_care、dementia_unit、rehabilitation_training、tube_feeding、catheter_care、pressure_injury_care、incontinence_care。只有其 required 状态形成对应 hard requirement。

认知 concern present 但无已报诊断只形成 unresolved mapping，不升级确诊；diagnosis 不自动要求 dementia unit。special_feeding / catheter_or_stoma 仅是原有 clarification，不推 tube/catheter required。walking_aid、transfer_minor、stairs、一般起居 care modes 无独立白名单目标，不创造 capability。context care modes 不生成 hard requirement。

## 3. Elder readiness and rehabilitation

`elderReadiness` 独立于 Institution eligibility：ready / blocked_by_required_clarification。所有影响护理分类/实际 hard 映射的 unknown、needs_confirmation 与 required_before_classification / required_before_hard_filter clarification 必须保留并检查，不把 candidateValue 当事实。

blocked 时：items/conditionalCandidates 为空；仍记录明确 hard constraint 的 satisfied/conditional/unverified/conflict；有明确 conflict 的候选为 INELIGIBLE，其余 matchTier=null，附 not_evaluated_due_to_elder_readiness。null 不是第六个 tier，也不能排序成安全候选。NO_EXACT_MATCH 单列 elder clarifications，使用 REQUIRED_CAPABILITY_UNRESOLVED；空准入池仍优先说明 NO_VERIFIED_INSTITUTION_POOL。

唯一经批准的 scoped 康复例外：health.rehabilitationNeed 为 known required/possible 且 specialCare rehabilitation_training 无 explicit required 时，仅由该健康线索产生的 specialCare needs_confirmation 以 soft_fit_data_gap 消费，不阻断 eligibility。原 Profile fact、clarification ID/priority/affectedDerivedFields 不删除或改写。specialCare 明确 unknown 或其他 unresolved 不利用该例外绕过。

| 康复来源 | Role | 对机构能力的消费 |
|---|---|---|
| explicit specialCare rehabilitation_training required | HARD | 完整 hard matrix，不再贡献软排序 |
| health known required，无 explicit training | STRONG_SOFT_FIT | supported 为正向；其余 soft 差异/资料缺口，不 hard conflict |
| health known possible，无 explicit training | SOFT_FIT | 同上，保留 possible 强度，不升级必须 |
| health unknown/needs_confirmation 或其他康复跨题冲突 | unresolved | 保留 readiness；explicit hard 的已知结果仍可审计 |
| health known not_required，无 explicit training | NOT_APPLICABLE | 不因机构有康复能力加分；selected rehab priority 可独立表达偏好 |

STRONG_SOFT_FIT 与 SOFT_FIT 是需求语义强度，不是数字乘数。对同一个老人只会有其中一类，不新增加权分数。康复房间、治疗师、rehabilitation_care 类型都不能证明 training 能力。

## 4. Baseline soft fit

预算使用 CNY 安全整数分；用户区间为 350000–500000、500000–800000、800000–1200000、1200000–1500000。cny_15000_plus 只有下界，无上界，不解释成无限预算。

顺序规则：用户 unknown / 开放上界 / institution effective price unknown → unknown；有限 [L,U] 与机构 bounded [a,b]：b<L → below_declared_range；a>U → above_budget；a>=L 且 b<=U → within_budget；其他 → partially_overlapping。边界相等按重叠。starting_at a>U → above_budget，否则 partially_overlapping，始终保留 PRICE_UPPER_BOUND_UNKNOWN。价格是参考，不是最终收费承诺。

Type 只看有效 supportedTypes，不读 primaryType；用户 unknown → not_applicable，其余为 match/unknown/mismatch。Region 指定 code 只比较有效 regionCode 的 same/unknown/different；no_preference 和 absent 都 not_applicable，但 snapshot 必须保留二者区别，不能推距离。

## 5. FINAL_LEXICOGRAPHIC_RANK_TUPLE

仅 ready 候选可拥有正式 rank tuple，依次比较：

```text
eligibilityTier
priorityFitVector
budgetFit
institutionTypeFit
regionFit
rehabilitationSoftFit
institutionId_ASCII
```

Tier 顺序：EXACT > SOFT_NEAR > CONDITIONAL > UNVERIFIED > INELIGIBLE。它是不可补偿分类，不是数字积分。UNVERIFIED/INELIGIBLE 即使参与内部审计也不进入推荐卡。

| Factor | 从优到劣的 ordinal categories |
|---|---|
| budgetFit | within_budget > partially_overlapping > below_declared_range > above_budget > unknown |
| institutionTypeFit | match > unknown > mismatch |
| regionFit | same > unknown > different |
| rehabilitationSoftFit | supported > requires_assessment > unknown > unsupported |

Ordinal 可用从 0 开始的命名整数表示顺序，但不能相加或乘权重。not_applicable / consumed_by_priority / consumed_by_hard 的 rank slot 为 neutral/null，不参与比较；不是“比支持更好”。是否 neutral 仅由同一 Elder 输入和 dedup 规则决定，不可随某机构资料是否缺失而切换。

最后 tie-break 为合法 institutionId 的 ASCII 升序，不用 localeCompare、名称、输入数组顺序或运营状态。candidate audit 也必须稳定排序，不能残留输入顺序。

## 6. PriorityFitVector and RANK_FACTOR_DEDUP_RULES

priority 合法集合一至三项；空集合、重复或未知 code 的输入拒绝。Adapter 仅对合法集合按 stable code ASCII 排序，不修改原输入。Vector 顺序严格为：

```text
matchedCount descending
partialCount descending
knownMismatchCount ascending
unknownCount ascending
```

各 count 是 active structured selected-priority 的数量，单个 priority 最多贡献一个桶；无浮点权重/总分。not_scorable、not_applicable、consumed_by_hard 不计数。

| Selected priority | Structured fact / 四桶映射 | 排序所有权 |
|---|---|---|
| price | budget within→match；partial→partial；below/above→mismatch；unknown→unknown | priority 消费 budget；固定 budget rank slot neutral。Exact/reason 仍使用完整 BudgetFit |
| close_to_family | 指定 region same→match；different→mismatch；unknown→unknown | priority 消费 region；固定 region rank slot neutral。无指定 region 时不评分，保留 context gap；不声称离家距离 |
| rehabilitation_capability | training supported→match；requires_assessment→partial；unknown→unknown；unsupported→mismatch | 无 direct hard 时 priority 消费该 capability，固定 rehab slot neutral；有 direct hard 时 priority 和 rehab slot 都不重复消费 |
| dementia_care | acceptance 与 dementia_unit 分开保留 sub-status/evidence，对未被 hard 消费的子项取最弱状态：unsupported→mismatch；否则 unknown→unknown；否则 requires_assessment→partial；否则全 supported→match | 已作为明确 hard requirement 的 capability 不再贡献 priority；全被 hard 消费则 neutral。supportedTypes 是不同事实，固定 type fit 不因同名 dementia_care 而 neutral |

price 的 below/above 在 priority 桶折叠为已知 mismatch 后，不能再用被消费的 budget slot 打破平手；完整原 fit 仍供差异解释。去重不是删事实，只是定义唯一 rank owner。

其余八项 medical_conditions、nursing_professionalism、caregiver_attitude、food_quality、living_environment、overall_quality、recreational_activities、transportation 均 NOT_YET_SCORABLE，不读文本、图片、staffing、Mock description 或 primaryType 造分。只记录 display/data gap；新增/移除这些项目不改变排序。

每项 factor 必须输出可审计的 rankParticipation（或同义字段）：baseline / selected_priority / consumed_by_priority / consumed_by_hard / not_applicable / not_scorable，以及其实际 rank slot。不能靠实现顺序暗中去重。

## 7. Exact / SoftNear machine boundary

先 readiness，再 hard aggregation：任一 conflict→INELIGIBLE；否则 required 的 effective unknown→UNVERIFIED；否则任一 conditional→CONDITIONAL；否则所有适用 hard 为 satisfied，才评价 Exact/SoftNear。

Exact predicate 同时要求：

1. elderReadiness=ready；
2. 全部适用 hard satisfied，其余 not_applicable；
3. BudgetFit=within_budget；
4. 指定 region 时 same，未指定/不限制中性；
5. 指定 type 时 match，用户 unknown 中性；
6. 适用 health STRONG_SOFT/SOFT 康复目标时 capability=supported。

3–6 任一差异或 unknown → SOFT_NEAR，不改变 care safety。budget unknown、开放上界、starting_at 非完整总价均不能 Exact。

仅 priority 自身的 mismatch/unknown/not_scorable 不改 Exact predicate；其完整差异仍输出，EXACT 不能渲染为“全部关注项都已满足”。若 priority 复用 budget/region/health rehab，则由该 baseline 的 predicate 决定 Exact，不能因 rank slot neutral 而跳过 exactness。RATIONALE：priority 是关注项，不是全部硬化的偏好约束；避免不可评分项目让当前全部机构永远降级。

## 8. Cards and NO_EXACT_MATCH

RECOMMENDATION_CARD_LIMIT = MAX_3，不是 ALWAYS_3。

- ready 且 Exact 非空：只取该层 top3，不以低层补足。
- Exact=0 且 SoftNear 非空：NO_EXACT_MATCH，只取该层 top3，保留逐项差异。
- 两者为空且 Conditional 非空：NO_EXACT_MATCH，独立 conditionalCandidates top3；不得混在 Exact/items 中称完全匹配，必须说明关键护理需机构评估。
- Unverified/Ineligible 永不进卡；空池/无可展示候选/老人待澄清时均不凑数。

稳定 no-exact reason 优先级：空准入池 NO_VERIFIED_INSTITUTION_POOL；readiness blocked REQUIRED_CAPABILITY_UNRESOLVED；全部 conflict ALL_CANDIDATES_HAVE_HARD_CONFLICT；存在 SoftNear ONLY_SOFT_NEAR_MATCHES；只有可展示 Conditional ONLY_CONDITIONAL_CANDIDATES；其余 REQUIRED_CAPABILITY_UNRESOLVED。

NO_EXACT_MATCH 保留逐机构 hard conflict、conditional、institution-unverified summaries，单列 elder-side clarifications，不将它们混成同一种未知。exact 存在时不得附 NO_EXACT_MATCH。候选裁剪不删除完整 candidateEvaluations 和 pool manifest。

## 9. Reasons, differences and provenance

Reason 必须是稳定 code + type/polarity + 适用双侧 refs。Hard 支持/conditional/unverified/conflict 及预算、区域、类型、priority、rehab 分别保留语义；reason 的 institutionId/revision 必须与所属 item 相等。正向 capability reason 只能由 current effective supported 产生；不能将 raw supported/unverified 当支持。

Core differences 区分 HARD_CONFLICT、SOFT_DIFFERENCE、CONDITIONAL_REQUIREMENT、UNVERIFIED_DATA_GAP；unknown soft data 不能伪装护理 unverified。每条保存具体 factor/constraint code 与 refs。OPERATIONAL_ADVISORY 为独立 post-core attachment，只用于 availability/upfront，不进匹配理由或排序。所有公开渲染文案为后续 UI 范围，不以自由文本驱动决策。

Context / pool manifest / evidence 按 Recommendation Contract §19。相同输入重复 deepEqual；Institution 数组任意重排、priority 合法集合任意重排均不改变输出；不修改调用方输入。

## 10. Runtime and compatibility gate

固定历史 A01–A20/B01–B20 共 40 个输入场景，断言最终 V1，而非实现旧 A/B。额外审批矩阵和 RANK-001–RANK-014 必须实际运行，不能只给文档推演。

Harness 必须有显式 expected case manifest、唯一 ID、每例固定 assertion count、已执行 ID 对照；fixture 缺失、重复、意外跳过或 assertion-count 偏离均 FAIL。另验证反假绿机制本身能够拒绝这些变体。不从“当前存在的 fixtures”动态生成 expected 清单。

运行 Recommendation / Institution / ElderProfile / Preview / Profile / Assessment / Interaction runtime、TS 5.9 application、实际微信 TS 4.1.2 targeted（包含新 recommendation roots 和 emitted JS）、既有 WeChat JS/self-test、JSON 和 diff check。新域无 Page 引用，不能以旧 cache 作新域编译证据；本阶段 Android 不适用。

最终由 qa_reviewer 独立只读验收。无 UI、Backend、真实机构、LLM、百分比或持久化；不自动 commit。
