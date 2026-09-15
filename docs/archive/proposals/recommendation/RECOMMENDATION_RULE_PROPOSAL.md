# Recommendation Rule Proposal

状态：DECISION_HISTORY_PHASE_4B_1_WITH_PHASE_4B_2_APPROVAL

最终产品策略：CONSERVATIVE_EXACT_WITH_CONDITIONAL

适用范围：保留 Phase 4B-1 的 A/B 提案和后续产品决策历史。下面 §1–21 是原始提案存档，其中的待审批措辞、旧 tier/readiness、权重命名、旧状态和 A/B 展示规则不是最终 V1 实现依据；已批准内容以 §0 和正式冻结 Contract 为准。本文件本身不宣告正式 Recommendation Contract / Ruleset 已冻结，也不以历史状态代表当前 runtime 验收结果。

## 0. Phase 4B-2 product approval and handoff

Phase 4A-2 独立 Git 基线已经核实：

```text
PHASE_4A_2_BASELINE_COMMIT = 22088454742d9265a038b31a06366fa77cefbd86
RECOMMENDATION_POLICY_V1 = CONSERVATIVE_EXACT_WITH_CONDITIONAL
CARE_LEVEL_MONOTONIC_INHERITANCE = FALSE
REGION_HARD_CONSTRAINT = FALSE
BUDGET_HARD_CONSTRAINT = FALSE
MATCHING_PERCENTAGE_V1 = DISABLED
V1_RANKING_MODEL = LEXICOGRAPHIC
ANONYMOUS_RECOMMENDATION_PREVIEW = TRUE
```

项目负责人已批准下列最终决策，取代历史 Policy A/B 的对应建议：

1. 明确 required 与机构 effective supported / requires_assessment / unsupported / unknown 分别产生 satisfied / conditional / conflict / unverified。not_required 和 not_reported 都不形成 hard requirement，但后者不能解释为用户明确无需。老人 unknown / needs_confirmation 保持未解析，不生成确定 requirement。
2. 五个展示资格 tier 为 EXACT、SOFT_NEAR、CONDITIONAL、UNVERIFIED、INELIGIBLE。先护理、后软适配；任何硬冲突均不能被预算、区域、类型或 priority 抵消。UNVERIFIED 专指明确 required 对应机构 effective unknown，不包装为推荐卡；INELIGIBLE 也不进入卡片。
3. 优先 Exact；无 Exact 时可返回 1–3 SoftNear 并逐项说明软差异；两者均无时允许独立 Conditional Candidates，明确关键护理需机构评估。只有 Unverified/Ineligible 时不凑数，返回 NO_EXACT_MATCH 与资料缺口说明。
4. 五档 care level 各自读取同档能力，不继承。明确 wheelchair / bedbound / transfer dependence 使用独立 mobility capability，不用 care level 替代。
5. dementia acceptance、wandering-risk support、dementia unit 三者独立。明确 wandering risk 形成走失支持需求；仅 explicit specialCare dementia_unit=required 形成专区 hard requirement，不从诊断直接推专区。
6. explicit rehabilitation_training=required 为 HARD；只有 health rehabilitationNeed=required 时为 STRONG_SOFT_FIT；possible 为 SOFT_FIT。后两者不产生 hard conflict。不得删除已有 Profile 康复事实、evidence 或 clarification。
7. special_feeding 不等于 tube_feeding；catheter_or_stoma 不等于 catheter_care。两种 care mode clue 只形成 clarification / information gap；专项 hard requirement 只来自对应 explicit required。
8. Region 和 Budget 均为 soft。区域缺失与 no_preference 不混同；unknown price 不当作 0；starting_at 不当作最终总价；参考价不构成收费承诺。
9. 相同可展示 tier 内的最终命名 rank tuple 至少包含 structured priority、budget、type、region、rehabilitation、stable institution ID。matching_engine 必须在实现前给出每个 ordinal category 及重复因子去重规则，并写入正式 Contract。禁止 global score、隐藏权重、随机数、输入顺序排名和对不可评分 priority 造分。
10. Reason 使用稳定语义 code 和适用的双侧证据；Difference 区分软差异、条件性要求、未核验资料缺口。availability 只能走独立 OPERATIONAL ADVISORY，不改变核心 eligibility/ranking。
11. Formal 与 Preview 共用唯一 semantic core；身份仅在 adapter 外层区分。Preview 不持久化、不产生假 Recommendation/Assessment/Elder ID、CompletedAssessment 或 generatedAt。
12. 每次评估绑定显式 evaluationAsOf、ruleset/policy version、全池 revision/input manifest、institutionId/recordRevision 与证据快照。不使用隐式当前时间、随机数、UUID、网络或 LLM。
13. 40 个历史场景需要按最终 V1 策略转成 runtime fixtures，而不是分别实现旧 A/B 引擎；还必须覆盖本次审批列出的额外矩阵、排序、康复、确定性和 availability 场景。所有机构 fixtures 只使用 MOCK_DEVELOPMENT_ONLY / TEST_SYNTHETIC_VERIFIED 标签，不冒充真实武汉机构。

### 0.1 Elder-side readiness design direction

产品审批没有把老人侧未知状态定义成机构 UNVERIFIED。主 SOL 在本轮明确提出独立 readiness 边界后，项目负责人回复“继续”，据此继续细化：

- 关键护理需求仍未澄清时，独立 readiness 阻断推荐卡，保留已知 hard constraint 的审计结果；不把老人 unknown 改成 required，也不把它冒充机构 UNVERIFIED。
- 健康侧康复软需求按上述明确批准的角色单独处理，原有康复 clarification 保留，不因此建立康复 hard requirement。
- 不重新定义 ElderProfile 原始 status、clarification priority、affectedDerivedFields 或 evidence。完整输出类型、readiness 与候选 tier 的关系尚需 matching_engine 在正式 Contract 中完成一致性定义。

### 0.2 Current execution checkpoint

本轮先完成基线与冻结语义核对，尚未开始引擎写入。matching_engine 的排序/语义只读预审及 backend_domain 的身份/来源只读预审均被工具返回的账户用量限制中断，没有可采纳的 Agent 结论；不能将调用失败记作 PASS。正式 Contract / Ruleset 未冻结，Recommendation runtime 未实现，最终 qa_reviewer 验收尚未开始。

2026-08-31 本轮重跑的既有基线检查：Institution 96、ElderProfile 45、Preview 20、Profile 17、Assessment 12、Interaction 38 runtime + 2 structural 均 PASS；既有 TS 5.9.3 application gate（沿用 `--noEmit --skipLibCheck`）PASS；实际微信 TS 4.1.2 targeted 为 16 targets / 17 内存 emit 模块 PASS；既有 DevTools 项目缓存 50 个 JS 的 class-field 检查和 compatibility self-test PASS；JSON 为 34 个 miniprogram + 3 个公共根配置，共 37 个 PASS。这些只证明当前既有代码基线，不是尚不存在的 Recommendation 模块编译/运行证据，也不是本轮新 DevTools 编译或 Android 验证。上游官方 typings TS2344 继续沿用已批准的非阻断记录，不修改 typings/tsconfig，不降低 Gate。

后续目录所有权计划：matching_engine 主写 `miniprogram/domain/recommendation/**`、`miniprogram/types/recommendation.ts` 及专用合成 fixture/runtime；主 SOL 负责正式文档、既有 Gate 的最小扩展和集成；backend_domain 与 qa_reviewer 仅只读审查。不启动 frontend，不改 Page/Component/Store/Service，不进入 Backend，不自动 commit。

### 0.3 Quota interruption resume

后续 RESUME 指令明确从 Phase 4B-2 检查点恢复，不重新开启 A/B 产品审批。原 §0.2 保留为中断历史，不代表恢复后的最终状态。

- 恢复时 HEAD 仍为上述 Phase 4A-2 baseline；两份 Recommendation 文档均未跟踪，因此普通 `git diff -- <path>` 为空不代表文档不存在；暂存为空，没有 Recommendation production code 或无关 tracked diff。
- matching_engine 先完成 FINAL LEXICOGRAPHIC RANK TUPLE、各 ordinal、priority set 聚合和 RANK_FACTOR_DEDUP_RULES；之后 backend_domain 只读检查 identity/provenance。两者通过后才标记正式 Contract/Ruleset 冻结并创建生产代码。
- priorities 是最多三项的集合，不是重要性排序。相同集合的不同输入顺序不能改变推荐输出；不能按点击顺序比较。
- `RECOMMENDATION_CARD_LIMIT = MAX_3`，不是 ALWAYS_3。不可用 Unverified/Ineligible 补足数量。
- Runtime 必须有固定 expected case IDs 和明确 assertion-count Gate；缺失、重复、跳过 case 或断言数偏离都失败。历史 40 场景按最终 V1 执行，另覆盖 RANK-001–RANK-014。
- 新领域模块不接 Page；微信 TS 4.1.2 targeted 必须包含新 roots。既有 50-module cache 仅证明既有页面回归，不能冒充新模块编译。
- 本轮仍不 commit，不进入 Recommendation Result UI、Institution UI 或 Backend。

恢复后的契约 Gate 已闭合：matching_engine 最终 tuple/落文 PASS；backend_domain 身份、manifest machine schema、八类版本、Preview 消费授权边界 gap closure PASS。主 SOL 在任何 Recommendation production code 创建前冻结 `RECOMMENDATION_CONTRACT.md` §19（recommendation-contract-v1 / FROZEN_PHASE_4B_2）与 `RECOMMENDATION_RULE_CONTRACT.md`（recommendation-ruleset-v1 / FROZEN_V1）。本文件继续仅作决策历史；代码/runtime/最终 QA 完成情况另行记录，不由契约 freeze 推定。

### 0.4 Phase 4B-2 implementation integration checkpoint — 2026-08-31

在 §0.3 的先审查、再冻结 Gate 之后，已创建 Recommendation 类型、Formal/Preview adapter、唯一 semantic core、institution effective projection/全池 manifest、独立 advisory attachment，以及专用 synthetic runtime fixtures。未修改 Page、Component、Store、Service、Backend 或既有冻结业务契约；Recommendation Result 仍为 Skeleton。

matching_engine 的生产写入与独立 fixture 写入两个子 Agent 随后遇到 quota interruption，不能记录为 Agent 交付完成。主 SOL 保留其工作并接管后续集成，修正 TypeScript 4.1.2 的类型收窄、fixtures 证据/价格/分层预期以及机构价格和证据快照的深层引用隔离。未更改已批准产品策略，也未重启 Phase 4B-1。

本次 AUTOMATED evidence：Recommendation runtime 117 个固定 case × 6 个顶层断言 PASS（包含 40 个历史输入按最终 V1 执行、22 个审批矩阵场景、14 个 RANK、37 个边界和 4 个反假绿）；额外矩阵循环在各 case 内执行，不冒充额外顶层 case。Institution 96、ElderProfile 45、Preview 20、Profile 17、Assessment 12、Interaction 38 runtime + 2 structural 均 PASS。

最终输入 hardening：Preview source 仅允许冻结的 3 个字段，Formal identity 仅允许 6 个字段，并显式投影；注入额外字段返回稳定 INVALID_PROFILE_ENVELOPE。康复软例外严格限定为 health definite/possible 线索产生的 training needs_confirmation 与对应 risk clarification，unknown training 不得放行。backend_domain 对原 4 项 fixture gap closure 及新 identity smoke 分别只读 PASS。RANK-003 使用 above/below 双 mismatch 的 priority 折叠与取消 priority 后反向预算顺序验证去重，RANK-004 检查实际 neutral/null slot；另以 4 个同层安全候选实测 MAX_3 且保留完整审计。

COMPILER evidence：沿用已批准 TypeScript 5.9.3 application source Gate PASS；实际微信开发者工具内置 TS 4.1.2 targeted PASS，Recommendation 新文件 8 个，总 target roots 24（含 3 个既有 Profile syntax targets），内存 emitted JS 25 个。source/emitted class fields、额外 runtime import、额外 polyfill 假设均为 0。既有 DevTools 缓存 50 个 JS 的 compatibility 和 self-test PASS，仅证明既有页面 regression，不冒充新域的 DevTools 路由编译。JSON 37（34 个 miniprogram + 3 个公共根配置）PASS。

独立 qa_reviewer 首轮发现两个 blocker：NO_EXACT_MATCH.unverifiedRequirements 遗漏 conditional；输入完整 envelope 未要求 basic/userFacingSummary。主 SOL 依原合同修复，汇总保留 conditional/unverified 原 outcome；输入校验补足两个必需 section 的结构，但不将它们传入 core 或重新 derive。五个对应 runtime 回归已通过。

最终独立 `qa_reviewer = PASS`（仅限本阶段批准的纯 domain 范围）。QA 亲自重跑 Recommendation runtime 117 × 6、微信 TS 4.1.2 targeted、TypeScript 5.9.3 application 与 git diff --check；复验两项 blocker 已闭环，并核对 identity/source 白名单、康复 scoped 例外、rank tuple/ordinal/dedup、MAX_3、深层快照隔离及 manifest/evidence。既有六组 runtime、JSON 和旧 JS compatibility 为主 SOL 的独立集成运行证据，不冒称 QA 每项都亲自重跑。无剩余本阶段代码 blocker。

Android 本阶段不适用；没有 Page 接入、ADB 或新人工真机测试。依项目负责人 RESUME §17，本阶段新域兼容 Gate 是当前微信 TS 4.1.2 targeted，不要求将未接入 Page 的模块临时导入页面来制造产物。Git 未 stage、未 commit；后续仍须由负责人审阅，禁止自动进入 Recommendation Result UI。

## 1. Proposal principles

### 1.1 三层决策

提议按三个不可互相越权的层次处理：

1. Layer A - Care / Safety Compatibility：评估生活能力、认知风险和明确专项护理的安全适配；
2. Layer B - Preference & Financial Fit：评估机构类型、区域、预算和 priority；
3. Layer C - Explainable Ranking：只在同一安全 tier 内按命名因子稳定排序。

Layer B/C 的价格、区域、环境、类型偏好和 priority 永远不能抵消 Layer A 的 verified hard conflict。不得先给全量机构算一个总分，再用最高分覆盖护理不适配。

### 1.2 数据方向

~~~text
ElderProfile / ElderProfilePreview semantic facts
    + validated Institution record
    + field-level verification projection(evaluationAsOf)
    -> per-requirement evaluation
    -> care/safety eligibility tier
    -> preference/financial fit
    -> named-factor ordering
    -> Recommendation or RecommendationPreview
~~~

Institution raw capability 必须先通过 Institution Contract 的 verification projection。supported raw value 在 unverified、expired 或已过 validUntil 时 effective 为 unknown；requires_assessment 不能被当作 supported；unknown 不能被当作 unsupported。availability 只用于展示，不进入上述链路。

### 1.3 Scope boundary

本 proposal 只消费：

- ElderProfile/ElderProfilePreview 的派生事实；
- preference/financial/intent 的 Profile rawFacts；
- Institution Contract 冻结的 22 个 matching-critical field path 及其 current effective projection；
- 两侧可追溯的 evidence snapshot。

不消费：

- Draft Store 或重新读取 27 个原始 answers；
- 页面中文、UI label、Mock 名称或 free text；
- Institution primaryType 作为 matching truth；
- availability、rooms、media、VR、qualification、医疗/康复描述、services、staffing 作为默认匹配输入；
- LLM、随机数、当前时间、网络实时变化。

当前没有真实 verified institution dataset；任何合成资料都只能用于开发或语义审查，不能声称某家武汉机构适合真实老人。

## 2. Care requirement status and readiness

### 2.1 Requirement status consumption

| ElderProfile status | 解释 | 推荐消费边界 |
|---|---|---|
| required | 明确提出该项护理需求，来源可追溯 | 形成 hard requirement candidate；只有 effective supported 可 satisfied |
| not_required | 用户明确选择 none 且无跨题 clue | 对该 capability not_applicable；不因机构状态加分 |
| not_reported | 用户没有作出该项声明 | 不能改写成 not_required，也不能显示“无需”；不产生正向 requirement |
| unknown | 用户明确选择 unknown | requirement 未解析；输出 unverified，阻断受影响 exact/eligible |
| needs_confirmation | ADL/健康等 clue 尚未澄清 | potential requirement；输出 unverified，不能 exact/eligible |

not_reported 是“没有声明”，不是“明确没有”。它可在一个没有适用 requirement 的结果中被标为 not_applicable，但结果不能声称需求已排除。

### 2.2 Input readiness

需要同时保留全局 readiness 与 per-requirement result：

~~~ts
type RecommendationInputReadiness =
  | 'ready_for_exact_evaluation'
  | 'ready_for_conditional_evaluation'
  | 'blocked_by_required_clarification'
  | 'invalid_input'

interface RequirementReadiness {
  sourceDerivedField: ElderProfileDerivedField
  status: 'resolved' | 'unresolved' | 'not_applicable'
  blockingPriority?: ClarificationPriority
  clarificationIds: readonly string[]
}
~~~

required_before_classification 不能静默忽略；它表示 care level 不能被称为已确定。required_before_hard_filter 不能静默忽略；它表示受影响的 requirement 不能使机构成为 eligible 或 exact。已知 hard conflict 可以继续保留为审计结果，但任何 unresolved requirement/clarification 仍阻断 exact/eligible。

## 3. Complete capability four-state matrix

以下矩阵适用于每一项映射到 Institution matching-critical path 的 Elder requirement。A 表示 Policy A 的 candidate-display 结果；B 表示 Policy B 的 candidate-display 结果；两者都不能让 unresolved 变 exact。

| Elder requirement status \ Institution effective status | supported | requires_assessment | unsupported | unknown |
|---|---|---|---|---|
| required | satisfied；不阻断；A/B 均可进入 exact 候选 | conditional；阻断 exact/eligible；A 隐藏，B 可 conditional 展示 | conflict；阻断并标 ineligible；A/B 均不可 near | unverified；阻断 exact/eligible；A 隐藏，B 可 unverified 展示 |
| not_required | not_applicable；无 requirement | not_applicable；不因机构可提供而加分 | not_applicable；不构成老人侧冲突 | not_applicable；不构成老人侧冲突 |
| not_reported | not_applicable；不声称“无需求” | not_applicable；不声称机构满足未声明需求 | not_applicable；不能写成用户与机构冲突 | not_applicable；保留未声明语义，不能当未知便宜/支持 |
| unknown | unverified；老人侧未解析，阻断 exact/eligible；A 隐藏，B 可 unverified 展示 | unverified；同上 | unverified，不把机构 unsupported 当老人已明确 required；A 隐藏，B 可 unverified 展示 | unverified；A 隐藏，B 可 unverified 展示 |
| needs_confirmation | unverified；仍需澄清；A 隐藏，B 可 unverified 展示 | unverified；双重不确定；A 隐藏，B 可 unverified 展示 | unverified；不得在未澄清前断言 hard conflict；A 隐藏，B 可 unverified 展示 | unverified；A 隐藏，B 可 unverified 展示 |

conditional 只表示已明确 requirement 对应机构明确 requires_assessment，不能解释为 supported。unknown 与 unsupported 永远不同。not_reported + unsupported 不能被包装成“老人需求冲突”，因为老人没有声明 requirement。

## 4. HardConstraintResult proposal

类型只在 RECOMMENDATION_CONTRACT.md §7 定义，避免两份提案维护不同结构。每项输出 satisfied / conditional / unverified / conflict / not_applicable，不用 boolean。

- conditional 仅指已明确 requirement + effective requires_assessment。
- unverified 指机构 unknown 或老人 requirement/分类未解析。
- 每条结果保留 institutionId、recordRevision、真实 fieldPath（无对应目标为 null）、两侧 evidence 和 clarificationIds。
- conflict 必须先于排序；不存在“用分数修复冲突”的分支。
- 既有 evidenceId 绑定所属 profile snapshot；偏好/财务用 typed raw-fact refs。未提供机构 evidence 可为空，但只能解释未核验，不可伪造证据。
- formal/preview context、manifest、raw/effective snapshots 和 advisory 分流均以契约 §4、§8、§12 为准。

## 5. Capability mapping matrix

左列使用现有 ElderProfileDerivedField evidence alias，读取路径必须按下表解析；它们不是重新读取 Assessment question ID。右列均为冻结的完整 Institution matching-critical path。

| Evidence alias | 实际 Profile 路径 |
|---|---|
| adl.careLevel | adl.derivedFacts.careLevel |
| adl.careModes.<code> | adl.derivedFacts.careModes 中 code 对应元素 |
| mobility.level | mobility.derivedFacts.level |
| health.rehabilitationNeed | health.derivedFacts.rehabilitationNeed |
| cognition.<field> | cognition.derivedFacts.<field> |
| specialCare.requiredCareCapabilities.<code> | specialCare.derivedFacts.requiredCareCapabilities 中 capability 对应元素 |

以下 hard candidate 均要求老人事实已明确；reported careMode 才可作为事实，needs_confirmation mode 只能 unresolved，context mode 不创造护理要求。多个来源映射同一 target 时只形成一项约束并保留全部来源，不重复加分。

| ElderProfile fact / status | Institution fact | Matching Role | 边界 |
|---|---|---|---|
| adl.careLevel known independent | capabilities.careLevelAcceptance.independent | HARD_REQUIREMENT_CANDIDATE | 独立核验 |
| adl.careLevel known light_care | capabilities.careLevelAcceptance.light_care | HARD_REQUIREMENT_CANDIDATE | 不 alias 其他档 |
| adl.careLevel known semi_disabled | capabilities.careLevelAcceptance.semi_disabled | HARD_REQUIREMENT_CANDIDATE | 独立核验 |
| adl.careLevel known disabled | capabilities.careLevelAcceptance.disabled | HARD_REQUIREMENT_CANDIDATE | 不从更重等级继承 |
| adl.careLevel known severely_disabled | capabilities.careLevelAcceptance.severely_disabled | HARD_REQUIREMENT_CANDIDATE | 不推专项能力 |
| mobility.level known wheelchair / reported adl.careModes.wheelchair | capabilities.mobilitySupport.wheelchair_support | HARD_REQUIREMENT_CANDIDATE | 合并证据，不重复约束 |
| mobility.level known bedbound / reported adl.careModes.bedridden | capabilities.mobilitySupport.bedbound_support | HARD_REQUIREMENT_CANDIDATE | 不等于 careLevel |
| reported adl.careModes.transfer_support / fully_dependent_transfer | capabilities.mobilitySupport.transfer_support | HARD_REQUIREMENT_CANDIDATE | 不由 careLevel 猜测 |
| adl.careModes.walking_aid / transfer_minor | 无 | NOT_MATCHED | 白名单无独立支持粒度，不猜测 |
| adl.careModes.feeding_minor / feeding_dependence / toileting_minor / toileting_full_assistance / bathing_partial / bathing_full_assistance / dressing_partial / dressing_full_assistance / stairs_assistance / stairs_unable / no_stairs_context | 无 | NOT_MATCHED | 由已派生 careLevel 表达护理负担；不制造新能力 |
| health.rehabilitationNeed known required | capabilities.specialCare.rehabilitation_training | HARD_REQUIREMENT_CANDIDATE | 是否单独形成 hard 待审批；不得抹除 special-care clarification |
| health.rehabilitationNeed known possible | capabilities.specialCare.rehabilitation_training | RANKING | 建议仅偏好/说明，非 hard；blocking clarification 仍保留 |
| specialCare.requiredCareCapabilities.rehabilitation_training required | capabilities.specialCare.rehabilitation_training | HARD_REQUIREMENT_CANDIDATE | 明确 training 要求 |
| cognition.reportedDiagnosis known reported | capabilities.cognitiveSupport.dementia_acceptance | HARD_REQUIREMENT_CANDIDATE | 用户报告，非系统诊断 |
| cognition.cognitiveConcern known present、无已报诊断 | capabilities.cognitiveSupport.dementia_acceptance | CONDITIONAL | 需求需要确认，outcome=unverified；不推确诊/专区 |
| cognition.wanderingRisk known present | capabilities.cognitiveSupport.wandering_risk_support | HARD_REQUIREMENT_CANDIDATE | 不由 dementia acceptance 替代 |
| cognition.wanderingRisk unknown/needs_confirmation | capabilities.cognitiveSupport.wandering_risk_support | CLARIFICATION_ONLY | 不把 candidateValue 当 present |
| specialCare.requiredCareCapabilities.round_the_clock_care required | capabilities.specialCare.round_the_clock_care | HARD_REQUIREMENT_CANDIDATE | 明确 24h 要求 |
| specialCare.requiredCareCapabilities.one_to_one_caregiver required | capabilities.specialCare.one_to_one_caregiver | HARD_REQUIREMENT_CANDIDATE | 明确一对一 |
| specialCare.requiredCareCapabilities.night_care required | capabilities.specialCare.night_care | HARD_REQUIREMENT_CANDIDATE | 作息线索不替代 |
| specialCare.requiredCareCapabilities.dementia_unit required | capabilities.specialCare.dementia_unit | HARD_REQUIREMENT_CANDIDATE | 诊断不自动要求专区 |
| specialCare.requiredCareCapabilities.tube_feeding required | capabilities.specialCare.tube_feeding | HARD_REQUIREMENT_CANDIDATE | 不由特殊进食推导 |
| specialCare.requiredCareCapabilities.catheter_care required | capabilities.specialCare.catheter_care | HARD_REQUIREMENT_CANDIDATE | 不由导尿/造口线索推导 |
| specialCare.requiredCareCapabilities.pressure_injury_care required | capabilities.specialCare.pressure_injury_care | HARD_REQUIREMENT_CANDIDATE | 明确需求 |
| specialCare.requiredCareCapabilities.incontinence_care required | capabilities.specialCare.incontinence_care | HARD_REQUIREMENT_CANDIDATE | 明确需求 |
| adl.careModes.special_feeding_review | 无（只引用现有 clarification） | CLARIFICATION_ONLY | special_feeding ≠ tube_feeding |
| adl.careModes.catheter_or_stoma_review | 无（只引用现有 clarification） | CLARIFICATION_ONLY | catheter_or_stoma ≠ catheter_care |
| specialCare.requiredCareCapabilities.<code> needs_confirmation / unknown | 对应 capabilities.specialCare.<code>（9 个冻结 code） | CLARIFICATION_ONLY | 读取已派生状态；不重新用健康/认知原答案造需求 |
| cognition.behavioralRisk / sleepCycleIssue、adl.careModes.incontinence | 无直接 hard 映射 | CLARIFICATION_ONLY / NOT_MATCHED | 专项护理只读取 requiredCareCapabilities；不重推其状态 |

CONDITIONAL 作为 mapping role 表示“需确认的消费关系”，不是 HardConstraintOutcome.conditional；实际 outcome 严格按 §3 矩阵产生。对于 concern 等需要确认的映射，可输出 Recommendation 自身的 unresolved code；不得伪造或修改既有 Profile clarification/evidence。

## 6. Care-level policy

机构五档必须独立读取：

~~~text
capabilities.careLevelAcceptance.independent
capabilities.careLevelAcceptance.light_care
capabilities.careLevelAcceptance.semi_disabled
capabilities.careLevelAcceptance.disabled
capabilities.careLevelAcceptance.severely_disabled
~~~

V1 建议不启用 monotonic inheritance：

- severely_disabled=supported 不自动证明 disabled supported；
- disabled=supported 不自动证明 semi_disabled supported；
- light_care 不 alias independent 或 semi_disabled；
- 每档缺少可靠资料就是该档 effective unknown。

是否启用 monotonic inheritance 属于 PRODUCT_DECISION_REQUIRED，不能在实现中隐式推导。

## 7. Cognitive mapping policy

| Elder semantic | Institution target | Proposed treatment |
|---|---|---|
| reportedDiagnosis=reported | cognitiveSupport.dementia_acceptance | hard candidate；不写成系统诊断 |
| cognitiveConcern=present 且无 diagnosis | cognitiveSupport.dementia_acceptance | conditional/clarification；不自动 hard required |
| wanderingRisk=present | cognitiveSupport.wandering_risk_support | hard candidate |
| wanderingRisk=needs_confirmation | cognitiveSupport.wandering_risk_support | unresolved conditional |
| specialCare.dementia_unit=required | specialCare.dementia_unit | hard candidate |
| only symptoms/diagnosis/wandering clue | specialCare.dementia_unit | no shortcut；clarification only |

因此“认知症可接收”不等于“有专区”，也不等于“安全接收走失风险”。若 dementia acceptance supported、wandering support unsupported，仍产生 independent conflict；如果 dementia unit unknown，仍独立产生 unverified。

## 8. Rehabilitation mapping policy

- health.rehabilitationNeed=required 是明确康复需求候选；target 为 capabilities.specialCare.rehabilitation_training，需项目负责人批准是否作为 hard requirement；
- health.rehabilitationNeed=possible 建议只作为 named ranking factor/说明，不直接 hard filter；
- specialCare.rehabilitation_training=required 是 direct special-care hard candidate；
- health rehabilitation known required 与 specialCare.rehabilitation_training=needs_confirmation 可以同时存在，不能相互覆盖。须保留 health known required、special-care unresolved clue 及其 cross_answer_conflict/clarification 语义；
- 康复室、康复治疗师、机构 rehabilitation_care 类型均不能单独证明 rehabilitation_training=supported。

## 9. Preference and financial mapping

### 9.1 Preference mapping matrix

Structured support 只有三类：STRUCTURED_MATCHABLE、DISPLAY_EXPLAINABLE、NOT_YET_SCORABLE。不支持的自由文本不得自动打分。

| Assessment/Profile stable code | Institution field / source | Structured support | Proposed use |
|---|---|---|---|
| preference.careType=active_aging | typeProfile.supportedTypes | STRUCTURED_MATCHABLE | 集合 contains 为 match；不读 primaryType |
| preference.careType=medical_nursing_integrated | typeProfile.supportedTypes | STRUCTURED_MATCHABLE | 不推导医疗/鼻饲能力 |
| preference.careType=disability_care | typeProfile.supportedTypes | STRUCTURED_MATCHABLE | 不推导失能接收档 |
| preference.careType=dementia_care | typeProfile.supportedTypes | STRUCTURED_MATCHABLE | 不推导 dementia acceptance/unit |
| preference.careType=rehabilitation_care | typeProfile.supportedTypes | STRUCTURED_MATCHABLE | 不推导 rehab training |
| preference.careType=unknown | none | NOT_YET_SCORABLE | 不 penalty、不猜偏好 |
| preference.region.kind=no_preference | none | STRUCTURED_MATCHABLE (not_applicable fit) | 不 penalty |
| preference.region.kind=institution_region | identity.regionCode | STRUCTURED_MATCHABLE | same/different/unknown；默认不 hard exclude |
| region absent | none | NOT_YET_SCORABLE | 与 no_preference 不混同；不猜区域 |
| preference.priorities=medical_conditions | medicalSupport.* | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 无结构化评分，不编 medical score |
| priorities=nursing_professionalism | 无冻结 matching field；可见 daily services/verification | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 只能展示真实资料 |
| priorities=caregiver_attitude | 无冻结 matching field | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 不从 reviews/free text 评分 |
| priorities=rehabilitation_capability | capabilities.specialCare.rehabilitation_training | STRUCTURED_MATCHABLE | 只读 effective capability；不读 rehab room shortcut |
| priorities=food_quality | services/restaurant/media（白名单外） | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 无客观评分不排序 |
| priorities=living_environment | rooms/media/address（白名单外） | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 不造 environmentScore |
| priorities=overall_quality | 无冻结质量评分字段 | NOT_YET_SCORABLE | 不编综合分 |
| priorities=recreational_activities | services/activity media（白名单外） | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 真实资料展示，不自动加分 |
| priorities=close_to_family | identity.regionCode（只有 region preference 时） | STRUCTURED_MATCHABLE（有限） | 只能偏好区域一致；无家庭地址/距离，不能声称“离家近”或算公里 |
| priorities=transportation | address/region（白名单外显示） | DISPLAY_EXPLAINABLE / NOT_YET_SCORABLE | 不计算路线/交通分 |
| priorities=price | price.referenceMonthlyPrice | STRUCTURED_MATCHABLE | 只比较结构化参考月费 |
| priorities=dementia_care | cognitiveSupport.dementia_acceptance + specialCare.dementia_unit | STRUCTURED_MATCHABLE | priority 不能替代 required，也不能合并两个 capability |

priorities 最多三项，按 Profile 中稳定顺序保留；不为 living_environment、overall_quality、caregiver_attitude 等缺少结构化字段的项编数字。

### 9.2 Care type

- supportedTypes 是唯一机构类型 matching truth，必须是当前有效 verified set；
- primaryType 只是展示定位，不参与 fit、hard constraint 或 reason；
- preferred type in supported set = match；
- verified set 不含 preferred type = mismatch，默认只是 near difference；
- institution set effective unknown = unknown，不能惩罚用户未知偏好；
- user careType unknown = not_applicable，不 penalty。

### 9.3 Budget model

表内金额为人民币元便于审阅；实际比较只用 CNY 安全整数分，用户边界乘 100，不能直接与 amountMinor 混比。

| Profile monthlyBudget code | Lower bound | Upper bound |
|---|---:|---:|
| cny_3500_5000 | 3500 | 5000 |
| cny_5000_8000 | 5000 | 8000 |
| cny_8000_12000 | 8000 | 12000 |
| cny_12000_15000 | 12000 | 15000 |
| cny_15000_plus | 15000 | null（未声明，不是无限） |
| unknown | null | null |

只比较 effective price.referenceMonthlyPrice。以下规则按顺序应用：

1. 用户 unknown、cny_15000_plus（无明确 ceiling）、或机构价格 unknown/unavailable/未核验：unknown；开放预算附 BUDGET_CEILING_UNSPECIFIED，不能说任意更高价格都接受。
2. 用户有限区间 [L,U] 与机构 bounded [a,b]：b < L 为 below_declared_range；a > U 为 above_budget；a >= L 且 b <= U 为 within_budget；其余为 partially_overlapping。端点相等算重叠。
3. 用户有限区间与机构 starting_at a：a > U 为 above_budget；其余为 partially_overlapping，必须携带 PRICE_UPPER_BOUND_UNKNOWN。即使 a < L 也不能断言 below，因为最终上限未知。

| Stable fit | 含义 | exact / care |
|---|---|---|
| within_budget | 有限、已核验参考区间整体在用户声明区间内 | 可满足财务 exact 条件，仍不是最终报价 |
| partially_overlapping | 确认区间部分重叠；或只知起价而总价上限不明 | exact=false；展示具体数据完整性差异 |
| above_budget | 已知最低价高于用户明确上限 | soft near，不是护理冲突 |
| below_declared_range | 有界参考区间完全低于用户声明下限 | soft difference，不猜质量差或自动否决 |
| unknown | 缺少可比较预算上限/有效参考价 | exact=false，不当作 0 或无限便宜 |

两个例子（纯 synthetic 文档推演，不是引擎测试）：预算 5000–8000、机构 4500–6000 → partial；同预算、机构 3500–4500 → below_declared_range。starting_at 6000 → partial + PRICE_UPPER_BOUND_UNKNOWN，不能说总价符合预算。

预算默认是 fit，不是 hard constraint；是否升级待产品审批。押金/一次性费用不属于 22 白名单。

### 9.4 Upfront cost advisory

budget.upfrontCostAcceptance 的 stable codes：

~~~text
acceptable
depends_on_amount
avoid_high_one_time_fee
unknown
~~~

Institution price.deposit/price.oneTimeFees 只能在隔离 advisory explanation 中使用：

- deposit unknown 或任一 one-time fee reference unknown = unknown；
- oneTimeFees=[] 只表示未提供项目列表，不是金额 0，也不是“无额外费用”；
- depends_on_amount 与 avoid_high_one_time_fee 没有冻结金额阈值，不能编“高额”阈值；
- 不能从 monthly budget 推导一次性费用接受；
- 不改变 care tier、eligibility、ranking 或 exact predicate；
- 需要真实证据时显示“费用明细需进一步咨询”，不承诺已接受。

### 9.5 Region

- region absent 与 no_preference 不同：前者是未回答，后者是明确不限制；
- no_preference/absent 不 penalty，也不猜家庭所在区域；
- institution region effective same = exact_region_fit；
- different = different_region，默认是 near difference，不 hard exclude；
- institution region effective unknown = unverified_region，不能说不同；
- close_to_family 只能在用户有 institution_region snapshot 时比较 regionCode；没有家庭地址、距离或路线数据，不进行距离排序；
- 是否允许“仅接受该区域”属于未来新增产品输入/决策，本 proposal 不创建。

## 10. Hard safety, eligibility and ranking

### 10.1 Eligibility before ranking

统一聚合优先级：任一 conflict → ineligible；否则任一 unverified 或 blocking clarification → unverified；否则任一 conditional → conditional；否则全部适用 hard satisfied（其余 not_applicable）→ eligible。

unknown 只指 Layer A 护理资料不足时使 eligibility=unverified；预算/区域/类型未知只影响 fit，不冒充护理不确定。not_reported 可以 not_applicable，但不能宣称“已确认无需该护理”。

### 10.2 Match tier

只使用 RECOMMENDATION_CONTRACT.md §10 的同一 predicate：

- EXACT：eligible + 财务 within + 指定区域 same + 已知类型命中；neutral preference 不阻断。
- NEAR：仍然 eligible、全部 hard satisfied；只有预算/区域/类型差异或非护理资料缺口。
- CONDITIONAL：明确 required + requires_assessment；不可 exact/eligible。
- UNVERIFIED：老人/机构护理资料未解析；不可 exact/eligible。
- INELIGIBLE：明确 hard conflict；不进入展示 items 或 nearMatches。

Policy A 仅显示前两层；B 可附条件/待核验分组，保留原层级，不能改名成安全的 soft NEAR。nearMatches 是 no-exact 的替代候选集合，不表示其中所有 item.matchTier 都是 near。

### 10.3 Named ranking factors

只提出命名因子，不冻结数字或最终顺序：

| factorCode | 适用范围 | 提议 |
|---|---|---|
| care_compatibility_tier | 第一层分组 | 非可补偿分数；ineligible 从展示池排除 |
| budget_fit | 相同安全与展示层级 | within/partial/above/below/unknown；unknown不当便宜 |
| region_fit | 相同层级 | same/different/unknown；no_preference/absent neutral |
| institution_type_fit | 相同层级 | match/mismatch/unknown；用户unknown neutral |
| rehabilitation_fit | 同层、已批准康复软需求 | 只读专项 effective capability，不从设施推能力 |
| priority_fit | 同层、STRUCTURED_MATCHABLE | 最多3项；无结构化依据 neutral，不文本评分 |

候选权重命名为 budgetFitWeight / regionFitWeight / typeFitWeight / rehabilitationFitWeight / priorityFitWeight，数值在后续规则冻结前审阅。当前不生成总分或运行权重。priority 若引用 budget/region/rehabilitation 已有因子，只表示该因子的偏好权重，不重复计分；已是 hard requirement 的能力不再靠重复正分获得“更安全”结论。

先按 exact、near、conditional、unverified 分组，再在同组内比较因子；同因子相同用 institutionId 的固定字符序（不依赖 locale）升序决胜。比较必须定义数组稳定顺序，不能依赖输入排列、名称、availability、时间或随机数。advisory_data_completeness 不参与排序；没有可评分的事实时保留中性/未知说明，不补造数字。

## 11. Matching percentage proposal

两份正式 PRD 强调可解释推荐，但没有冻结可验证的百分比校准方法。当前 proposal 建议：

~~~text
MATCHING_PERCENTAGE = NOT_RECOMMENDED_V1
~~~

优先展示：

- 高度匹配/较匹配/需要确认等经过项目负责人批准的 tier 文案；
- 结构化 supported reasons；
- 明确 differences/warnings。

是否展示百分比属于 PRODUCT_DECISION_REQUIRED；在批准前不得实现或在 fixture 中生成百分比。

## 12. RecommendationReason proposal

结构和 stable codes 以 RECOMMENDATION_CONTRACT.md §11 为准：reasonCode、reasonType、polarity、elderEvidenceRefs、institutionEvidenceRefs。supported 必须有两侧实际事实及 current verified effective evidence；未核验只能说明资料不足，不得呈现支持。raw supported + expired 不能生成 *_SUPPORTED 理由。

类型覆盖 care_capability、medical_rehabilitation、budget、region、institution_type、priority、data_quality。偏好/财务使用 Profile raw-fact refs，不伪造 derived evidenceId。公开文案只由 code + typed data 渲染，内部 sourceNote/sourceReference 不外露。

## 13. Difference and warning proposal

以契约 §12 为准：RecommendationDifference 属于 core；RecommendationAdvisoryAttachment 是独立 post-core 呈现附件，不放进 item.differences 或 semantic envelope，不参与核心 equality/排序。匿名附件仅内存；未来正式历史展示若保存附件，必须另存当时快照而非替换核心结果。本文件不维护第二套类型。

| 情况 | Stable difference code | 表达边界 |
|---|---|---|
| hard required + unsupported | HARD_CAPABILITY_UNSUPPORTED | blocking，不能推荐 |
| required + requires_assessment | CAPABILITY_REQUIRES_ASSESSMENT | 需机构个案评估，非支持 |
| required + unknown | CAPABILITY_NOT_VERIFIED | 未核验，非不支持 |
| Elder unknown/needs_confirmation | ELDER_REQUIREMENT_NEEDS_CONFIRMATION | 不替老人确认需求 |
| 参考月费部分/高于/低于区间 | BUDGET_PARTIAL_OVERLAP / BUDGET_ABOVE_RANGE / BUDGET_BELOW_DECLARED_RANGE | soft difference，非护理结论 |
| 起价上限不明 | PRICE_UPPER_BOUND_UNKNOWN | 起价非总价 |
| 预算/价格缺失或开放上限 | BUDGET_UNKNOWN / BUDGET_CEILING_UNSPECIFIED | 不当作0或已接受 |
| 押金/一次性费未知 | UPFRONT_COST_NEEDS_INQUIRY | 独立 attachment，不是核心 difference |
| 区域不同/未核验 | REGION_DIFFERENT / REGION_UNKNOWN | 不自动排除 |
| 类型不符/未核验 | TYPE_DIFFERENT / TYPE_UNKNOWN | 不改变护理能力 |
| 关注项未核验/不命中/不可评分 | PRIORITY_UNVERIFIED / PRIORITY_NOT_MET / PRIORITY_NOT_SCORABLE | 不声称满足全部关注 |
| 床位 unavailable | AVAILABILITY_DISPLAY_ONLY | 独立 attachment，不改变护理适配 |

关键差异都保留真实来源。无机构证据时可引用同 revision 缺失字段快照，不编证据；availability/空池等机构侧提示不强造无关 Elder evidence。

## 14. NO_EXACT_MATCH and near-match policy

### 14.1 Output

~~~ts
interface NoExactMatch {
  code: 'NO_EXACT_MATCH'
  reasonCode:
    | 'NO_VERIFIED_INSTITUTION_POOL'
    | 'ALL_CANDIDATES_HAVE_HARD_CONFLICT'
    | 'REQUIRED_CAPABILITY_UNRESOLVED'
    | 'ONLY_SOFT_NEAR_MATCHES'
    | 'NO_EXACT_MATCH_WITHIN_DECLARED_PREFERENCES'
  unmetHardRequirements: readonly HardConstraintResult[]
  unverifiedRequirements: readonly HardConstraintResult[]
  nearMatches: readonly RecommendationItem[]
  differences: readonly RecommendationDifference[]
}
~~~

规则：

- 不把 NO_EXACT_MATCH 表示成空数组而没有原因；
- nearMatches 至多 3 家，少于 3 家不凑数；
- verified unsupported hard requirement 永远不进入 nearMatches；
- 允许放宽的默认差异只有 budget、region、institution type preference；
- unresolved capability 是否可展示是 PRODUCT_DECISION_REQUIRED；Policy A 默认不展示，Policy B 按 conditional/unverified 原态分组展示；
- 硬护理条件不能为“凑够 1–3 家”而放宽；
- 无 verified 数据集使用 NO_VERIFIED_INSTITUTION_POOL，不能说“武汉没有机构”；
- 如果全池都硬冲突，保留 unmetHardRequirements；如果只是偏好/预算差异，保留 near candidate 的每一条 difference。

### 14.2 Policy A - Conservative

建议作为安全默认候选：

- 所有 hard requirement 必须 effective supported 才进入 exact/eligible；
- required + requires_assessment、unknown 或相关 elder unknown/needs_confirmation：不进入展示 candidate list；若全池因此没有 exact，则 NO_EXACT_MATCH，分别保留 conditional/unverified outcomes；
- 允许展示全部 hard satisfied、无 blocking clarification 的 soft near（预算、区域、类型），并明确差异；
- verified unsupported hard requirement 不展示为 near；
- 优点：安全边界清晰、运营确认压力低；缺点：召回率低、用户可能看不到可进一步咨询的机构；
- 适用于 V1 尚无成熟顾问确认流程的阶段。

### 14.3 Policy B - Balanced

作为需审批的召回方案：

- exact/eligible predicate 与 Policy A 完全相同；
- required + requires_assessment 可在 conditional 分组展示；required + unknown 或 elder unknown/needs_confirmation 可在 unverified 分组展示；均可进入 NO_EXACT_MATCH.nearMatches 替代集合（合计最多3家），但原 matchTier 不变；
- 每条必须显示 unresolved capability、来源和下一步咨询差异；不能显示为 exact、supported 或 eligible；
- verified unsupported hard requirement 仍完全排除；
- 优点：保留咨询入口和召回；缺点：运营确认压力更高，用户容易误读，因此必须有明显 conditional/warning；
- 不允许把 conditional/unknown 视为 exact，不允许悄悄变硬/变软。

### 14.4 Policy comparison

| 维度 | Policy A | Policy B |
|---|---|---|
| 安全 | 展示更克制，不将未核验护理候选交给用户 | 同一安全 predicate，但有误读条件候选的 UX 风险 |
| 召回 | 较低 | 较高 |
| 用户体验 | 结果更克制，可能无替代卡片 | 可看到“需要进一步确认”的替代候选 |
| 运营压力 | 较低 | 较高，需要逐家确认 |
| NO_EXACT | 与 B 发生条件相同；unresolved 常无替代候选 | 与 A 发生条件相同；可有 conditional/unverified 替代候选 |
| 护理硬冲突 | 两者都不可 near、不可被 score 覆盖 | 两者都不可 near、不可被 score 覆盖 |

## 15. Anonymous Recommendation Preview boundary

匿名边界提案：

~~~text
ElderProfilePreview
  + validated effective institution facts
  -> shared recommendation semantic core
  -> RecommendationPreview
~~~

RecommendationPreview：

- 只存在当前页面/调用内存；
- 不生成或保存 recommendationId、assessmentId、elderId、generatedAt；
- 不创建 fake CompletedAssessment；
- 不把 localDraftId 复制到 formal identity；
- 不新增 Preview Store、storage key、历史记录或持久化；
- 下一次进入页面必须从当前 Draft 重新派生 Preview；
- 与正式 Recommendation 共享同一 care evaluation、factor、reason、difference、NO_EXACT_MATCH semantic core；
- 正式 adapter 才能在真实 CompletedAssessment 下绑定 assessmentId、rulesetVersion、institution revision/evidence snapshot。

是否批准 Preview 是 PRODUCT_DECISION_REQUIRED。未批准前 Profile UI 的 Recommendation Skeleton 必须保持 skeleton，不触发真实匹配。

## 16. Revision, dataset and determinism

### 16.1 Revision provenance

正式 Recommendation 应记录：

~~~text
assessmentId
rulesetVersion
selectedPolicy
evaluationAsOf
institutionDatasetVersion
institutionId
recordRevision
fieldPath
rawSnapshot
effectiveSnapshot
evidenceIds
~~~

推荐结果需要全 pool manifest（包含参与和排除项及理由）或能重放当时 pool 的最小快照；旧 revision 不能被 latest 机构资料替换。当前机构记录没有 evidenceRevision 字段，不新增该字段。

### 16.2 Determinism

相同 Elder semantic input、institution dataset revision/effective projection、ruleset version、selected policy 和显式 evaluationAsOf，必须 deep-equal：

- hard constraint outcomes；
- eligibility/tier；
- reason/difference codes；
- nearMatches 集合和稳定顺序。

此处 deep-equal 指 semantic core，包含核心 differences，不含 post-core advisory attachment。显式同一 advisory snapshot 输入才能比较附件 equality；动态床位变化不得影响核心排序。Profile、版本、source 和 Institution manifest 的同源不变量以契约 §4/§8 为准。

禁止 Date.now()、随机数、LLM、网络变化、availability 或未定义对象遍历影响结果。

### 16.3 Small curated pool

V1 面向约 7–8 家精选机构，不建设搜索引擎、向量数据库、ML ranker 或 LLM ranker。算法未来应是 rule-based、deterministic、evidence-backed；没有完全匹配时可以返回少量近似候选，但不能为了数量放宽护理安全。

## 17. Representative scenarios - Policy A

以下为 TEST_SYNTHETIC_VERIFIED / MOCK_DEVELOPMENT_ONLY / NOT_REAL_INSTITUTION_DATA 文档推演，不是可执行 fixture，也不是 Recommendation runtime 测试。单机构场景假定池中仅该候选，多机构另行注明；除括号所示变量外，其余 ElderProfile facts 均已澄清且其来源必须能由现有 derivation 合法产生；机构字段均来自同一 recordRevision 的 effective projection。EXACT/NEAR/CONDITIONAL/UNVERIFIED 是 match tier；exact 是布尔语义；warning 是必须保留的差异，不是隐藏文案。

| # | 场景 | Tier / result | exact | near | warning |
|---:|---|---|---|---|---|
| 1 | 全部 hard care supported，预算/区域/类型也匹配 | EXACT / eligible | yes | none | none |
| 2 | 一个 required capability effective unsupported | INELIGIBLE / NO_EXACT_MATCH | no | none | HARD_CAPABILITY_UNSUPPORTED |
| 3 | 一个 required capability effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | none | CAPABILITY_NOT_VERIFIED；unverifiedRequirements |
| 4 | 一个 required capability requires_assessment | CONDITIONAL / NO_EXACT_MATCH | no | none | CAPABILITY_REQUIRES_ASSESSMENT |
| 5 | 所有 required supported，但参考月费略高 | NEAR / eligible | no | 1 soft candidate | BUDGET_ABOVE_RANGE |
| 6 | care 完全匹配但 region different | NEAR / eligible | no | 1 soft candidate | REGION_DIFFERENT |
| 7 | care 完全匹配但 preferred type mismatch | NEAR / eligible | no | 1 soft candidate | TYPE_DIFFERENT |
| 8 | care 匹配但 effective reference price unknown | NEAR / eligible | no | 1 candidate | BUDGET_UNKNOWN；不当作便宜 |
| 9 | dementia acceptance supported，但 wandering support unsupported | INELIGIBLE / NO_EXACT_MATCH | no | none | HARD_CAPABILITY_UNSUPPORTED（wandering） |
| 10 | dementia acceptance supported，但 direct dementia_unit required 且 effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | none | CAPABILITY_NOT_VERIFIED（unit） |
| 11 | tube_feeding required 且 supported | EXACT / eligible | yes | none | none |
| 12 | adl.eating=special_feeding clue，无 direct tube requirement，Profile 保留 needs_confirmation | UNVERIFIED / NO_EXACT_MATCH | no | none | ELDER_REQUIREMENT_NEEDS_CONFIRMATION；不映射 tube |
| 13 | adl.toileting=catheter_or_stoma clue，无 direct catheter requirement | UNVERIFIED / NO_EXACT_MATCH | no | none | ELDER_REQUIREMENT_NEEDS_CONFIRMATION；不映射 catheter |
| 14 | 多个候选均有至少一个 verified unsupported hard requirement | NO_EXACT_MATCH | no | none | ALL_CANDIDATES_HAVE_HARD_CONFLICT |
| 15 | 只有 budget difference，其他 care/region/type exact | NEAR / eligible | no | 1–3 soft candidates | BUDGET_PARTIAL_OVERLAP 或 ABOVE_RANGE |
| 16 | 只有 region difference，其他 care/type/budget exact | NEAR / eligible | no | 1–3 soft candidates | REGION_DIFFERENT |
| 17 | required capability unsupported，但该机构 preference factor 很高 | INELIGIBLE / NO_EXACT_MATCH | no | none | hard conflict 不被 score 覆盖 |
| 18 | raw supported 已 expired，projection 为 effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | none | CAPABILITY_NOT_VERIFIED（expired→unknown） |
| 19 | availability unavailable，但 care facts fully supported | EXACT / eligible | yes | none | AVAILABILITY_DISPLAY_ONLY |
| 20 | 同一输入、revision、policy、evaluationAsOf 重复计算两次 | EXACT / eligible（若场景1输入） | yes | same order | no；结果 deep-equal |

Policy A 的 3、4、10、12、13、18 不把 uncertain candidate 放入 nearMatches；这是其与 Policy B 的主要产品差异。

## 18. Representative scenarios - Policy B

Policy B 只改变 unresolved candidate 的展示，不改变 hard safety predicate。所有 hard conflict 场景仍不可 near。

| # | 场景 | Tier / result | exact | near | warning |
|---:|---|---|---|---|---|
| 1 | 全部 hard care supported，预算/区域/类型也匹配 | EXACT / eligible | yes | none | none |
| 2 | 一个 required capability effective unsupported | INELIGIBLE / NO_EXACT_MATCH | no | none | HARD_CAPABILITY_UNSUPPORTED |
| 3 | 一个 required capability effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | 1 unverified candidate | CAPABILITY_NOT_VERIFIED；必须咨询 |
| 4 | 一个 required capability requires_assessment | CONDITIONAL / NO_EXACT_MATCH | no | 1 conditional candidate | CAPABILITY_REQUIRES_ASSESSMENT |
| 5 | 所有 required supported，但参考月费略高 | NEAR / eligible | no | 1 soft candidate | BUDGET_ABOVE_RANGE |
| 6 | care 完全匹配但 region different | NEAR / eligible | no | 1 soft candidate | REGION_DIFFERENT |
| 7 | care 完全匹配但 preferred type mismatch | NEAR / eligible | no | 1 soft candidate | TYPE_DIFFERENT |
| 8 | care 匹配但 effective reference price unknown | NEAR / eligible | no | 1 candidate | BUDGET_UNKNOWN；不当作便宜 |
| 9 | dementia acceptance supported，但 wandering support unsupported | INELIGIBLE / NO_EXACT_MATCH | no | none | HARD_CAPABILITY_UNSUPPORTED（wandering） |
| 10 | dementia acceptance supported，但 direct dementia_unit required 且 effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | 1 unverified candidate | CAPABILITY_NOT_VERIFIED（unit） |
| 11 | tube_feeding required 且 supported | EXACT / eligible | yes | none | none |
| 12 | adl.eating=special_feeding clue，无 direct tube requirement，Profile 保留 needs_confirmation | UNVERIFIED / NO_EXACT_MATCH | no | 1 unverified candidate | ELDER_REQUIREMENT_NEEDS_CONFIRMATION；不映射 tube |
| 13 | adl.toileting=catheter_or_stoma clue，无 direct catheter requirement | UNVERIFIED / NO_EXACT_MATCH | no | 1 unverified candidate | ELDER_REQUIREMENT_NEEDS_CONFIRMATION；不映射 catheter |
| 14 | 多个候选均有至少一个 verified unsupported hard requirement | NO_EXACT_MATCH | no | none | ALL_CANDIDATES_HAVE_HARD_CONFLICT |
| 15 | 只有 budget difference，其他 care/region/type exact | NEAR / eligible | no | 1–3 soft candidates | BUDGET_PARTIAL_OVERLAP 或 ABOVE_RANGE |
| 16 | 只有 region difference，其他 care/type/budget exact | NEAR / eligible | no | 1–3 soft candidates | REGION_DIFFERENT |
| 17 | required capability unsupported，但该机构 preference factor 很高 | INELIGIBLE / NO_EXACT_MATCH | no | none | hard conflict 不被 score 覆盖 |
| 18 | raw supported 已 expired，projection 为 effective unknown | UNVERIFIED / NO_EXACT_MATCH | no | 1 unverified candidate | CAPABILITY_NOT_VERIFIED（expired→unknown） |
| 19 | availability unavailable，但 care facts fully supported | EXACT / eligible | yes | none | AVAILABILITY_DISPLAY_ONLY |
| 20 | 同一输入、revision、policy、evaluationAsOf 重复计算两次 | EXACT / eligible（若场景1输入） | yes | same order | no；结果 deep-equal |

Policy B 的 conditional/unverified 替代候选永远带重要 warning，不能渲染成“支持”“高度匹配”或正式 exact。

## 19. Product decisions required

与契约 §16 共用九项审批清单，不把实现细节提交给负责人：

1. required + requires_assessment：隐藏（A）还是单独 conditional 候选（B）。
2. required + unknown：隐藏（A）还是单独 unverified 候选（B），绝不当作 supported。
3. care-level monotonic inheritance：建议 V1 不允许；若要改变，必须先走 Institution frozen contract 变更审批。
4. rehabilitation：known required 是否作为 hard candidate；possible 建议只作软因子/说明；direct training required 保持 hard，冻结 clarification 不得被政策抹除。
5. region 是否 hard：建议否，保留差异。
6. budget 是否 hard：建议否，保留差异及不确定。
7. matching percentage 是否展示：建议否，用结构化理由。
8. unresolved 是否进入 nearMatches，以及默认 Policy A/B：建议 V1 先 A；B 需可见独立分组和顾问核验能力。
9. RecommendationPreview 是否批准：建议批准独立匿名内存边界，但当前仍未授权运行。

matching_engine 推荐 Policy A 作为 V1 起点：在无真实 verified dataset 和尚未验证确认流程的阶段，先确保输出克制；保留 Policy B 供运营确认能力具备后批准。两者安全 predicate 相同，差异是是否向用户展示仍未确认的候选；不保证量化召回率或运营成本。

## 20. QA gate and deferred implementation

qa_reviewer 后续必须只读检查：

- hard safety conflict 不能被 factor 覆盖；
- effective capability only；raw capability 不可直接消费；
- unknown != unsupported；requires_assessment != supported；
- careLevel 五档独立读取；
- primaryType、availability、UI label 和 Mock display 不进 matching；
- diagnosis、wandering、dementia unit 不合并；
- special_feeding/catheter_or_stoma 不偷映射；
- rehab possible 与 required 分开；
- 两侧 evidence 可追溯到同一 input context、institutionId/recordRevision；
- NO_EXACT_MATCH 不偷偷放宽护理；
- preview 无 fake IDs/generatedAt、无 persistence；
- empty pool reason 稳定且不声称“全武汉无机构”；
- runtime Recommendation implementation、hard filter、score、ranking、UI/backend 均为 0。

本 proposal 阶段不得新增 TypeScript production type、runtime、fixture、真实机构数据、页面、service、store 或 backend。后续若产品负责人批准，必须先把本提案升级为正式 frozen Recommendation Contract，再实现 shared semantic core 和 runtime tests。

## 21. Status

~~~text
RECOMMENDATION_CONTRACT = PROPOSED_PHASE_4B_1
RECOMMENDATION_RULE_PROPOSAL = PROPOSED_PHASE_4B_1
FINAL_DECISION = PROJECT_OWNER_DECISION_REQUIRED
MATCHING_ENGINE_IMPLEMENTATION = 0
HARD_FILTER_RUNTIME = 0
SCORING_RUNTIME = 0
RANKING_RUNTIME = 0
RECOMMENDATION_UI = 0
BACKEND = 0
REAL_WUHAN_INSTITUTION_RECORDS = 0
~~~
