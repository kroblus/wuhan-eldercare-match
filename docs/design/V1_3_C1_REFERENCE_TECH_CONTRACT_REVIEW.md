# V1.3-C1 初步参考推荐技术契约最终评审

日期：2026-10-26（北京时间）。  
STATUS = V1_3_C1_TECH_CONTRACT_REVIEW_COMPLETE  
DOCUMENT_STATUS = REVIEW_ONLY_NOT_FROZEN  
DOC_IMPACT = AUDIT_ONLY  
IMPLEMENTATION_AUTHORIZED = FALSE  
C2_SCOPE = NOT_STARTED

结论：C1 可以采用独立、版本化的参考通道，不需要修改旧 V2 的派生、Safety、tier 或排序。当前 Production 数据已经足以支持明确区域选择下的 AREA 参考，不能支持费用或普通服务的正向依据。本报告给出一套无未定算法分支的建议规则及十二组固定验收规格，可提交 Owner 审核冻结；这不是契约已冻结，也不是代码实施授权。

“建议规则”均指本次待审 C1 方案；“当前行为”均指已有源码。未把未来验收向量标为通过。

## 1. 实际代码基线与审查依据

### 1.1 工作区

| 项目 | 实际状态 |
|---|---|
| 主工作区 | C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4 |
| 分支 | codex/v2-1-b1-2-4-card-actions-visual |
| HEAD / 指定冻结提交 | 7ae07b9b78e4502940fd9812c6a838e4ddf2cc06 |
| 已有修改 | 40 个 tracked 文件修改；16 个默认折叠显示的 untracked 条目，含上一轮审查报告 |
| 本轮审查基线 | 当前磁盘文件，包含未提交 UI/UX 改动，不是仅审 HEAD |
| 服务端 | 此导出工作区无 server/；本轮不涉及正式历史实现 |
| 上一轮报告 | docs/design/V1_3_CODEBASE_COMPATIBILITY_AUDIT.md；已读取，相关判断本轮抽样复核 |
| Agent / Skill | 单会话；按 Recommendation V2、交互和 Runtime 相关 Skill 定向核查，无子 Agent、无跨仓库复制 |

当前相关目录未发现新的 AGENTS.md；既有未提交文件清单沿用上一轮报告附录 A，再加上一轮报告本身。未 reset、checkout、clean、rebase、commit 或 push。原有字体、结果依据层级、Demo 预约与历史 UI 等改动保留。

本轮再次记录报告以外的 Git tracked/untracked 非忽略文件内容基线，共 2,099 个文件，用于交付前核对。没有重建既有 dist。

### 1.2 产品文件与适用依据

本轮在 docs/product/ 中实际只见 README.md，仍标 CURRENT_PRODUCT_SOURCE_VERSION=V1.2。没有发现最新 V1.3 产品文件或已冻结的 C1 独立参考契约。缺失项如实列出：

- 最新 V1.3 产品规则正式文件：未提供具体文件名，工作区未发现；不能声称已读。
- C1 独立参考策略 / Result 组合消费后继契约：尚未存在已生效版本。
- 索引引用的“武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf”。
- 索引引用的“武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf”。

本次以 Owner 附件中的六项已确认规则和任务约束作为 C1 目标依据；以上文件缺失不被伪装为已经完成的产品文档同步，也不据此否定已明确的六项决策。

直接核对：

- docs/architecture/RECOMMENDATION_CONTRACT_V2.md §6–8。
- docs/architecture/RECOMMENDATION_RULE_CONTRACT_V2.md：Safety、房型/餐次 comparator 与原排序。
- docs/architecture/ELDER_PROFILE_CONTRACT_V2.md、ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md：风险、clarification、版本及匿名身份边界。
- docs/architecture/RECOMMENDATION_RESULT_UI_V2_INTEGRATION_CONTRACT.md。
- docs/architecture/INSTITUTION_CONTRACT.md §8.1、INSTITUTION_CONTRACT_V1_2_1.md。
- docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md、WECHAT_RUNTIME_COMPATIBILITY_POLICY.md。
- docs/agent/README_AGENT_ENGINEERING_V2_1.md：最小必要上下文、风险驱动验证。

本报告不会改写这些 Frozen 文档。C1 采用新的消费范围和独立版本，旧文件继续解释旧 V2。

### 1.3 抽样复核结果

| 事实 | 当前源码 / 函数 | 本轮结论 |
|---|---|---|
| 问卷为 32 / 26 | miniprogram/types/assessment-v2.ts:333 registry | 内存加载复核：32 题、26 必填；不改题 |
| readiness 可 blocked | domain/recommendation/profile.ts:647 buildReadiness；v2/profile-v2.ts:1007 buildReadinessV2 | 情绪/营养等澄清独立于机构能力；继续保留 |
| blocked 时仍会计算已知冲突 | domain/recommendation/v2/core-v2.ts:626 buildCandidate；:360 tierFor | 先执行 evaluateFrozenSafetyCore；conflict 可使 blocked 老人对应机构仍为 INELIGIBLE |
| 旧 V2 展示来源 | v2/core-v2.ts:762 deriveRecommendationSemanticsV2 | Exact 优先，再 SoftNear；仅两者均无时给 Conditional；各最多三家，不补满 |
| VM 再防止 blocked 出卡 | pages/recommendation/result-v2-view-model.ts:386 deriveCards、:406 stateFor | no_safe_recommendation 是页面状态，不是一个可以直接重写的 Domain tier |
| Production 合法记录 | modes/production/catalog.ts:11 buildProductionCatalog | 11 家均通过 V1.2.1 Catalog 和 V1.1 投影，datasetVersion=wuhan-public-directory-20261023-r3 |
| 能力 revision | modes/production/capability-reviews.ts | productionCapabilityRevisions=[]；研究观察不等于已核验能力 |
| 现有导航限制 | pages/recommendation/result.ts:177 hasRecommendationIdentity、:379 onRecommendationCardTap | 仅承认 V2 cards/conditional/nearMatches；不能直接接新参考卡 |

## 2. C1 独立参考通道的适配结论

### 2.1 接入位置

建议新增 C1 application composition，不修改旧 V2 evaluator：

~~~text
一次捕获完整合法 Draft + 一次显式 evaluationAsOf
    ↓
旧 createRecommendationPreviewServiceV2
    ├─ 先做原 Profile/完成校验
    ├─ 经注入的惰性 Catalog port，读取并验证一次当前 V1.2.1 Catalog
    ├─ 从这同一份合法快照投影完整 V1.1 池
    └─ 原 V2 evaluator → 原 ResultApplicationSnapshotV2
    ↓
若旧 V2 有可展示 Exact / SoftNear / Conditional：
    原 VM、原候选、原排序展示；不跑参考资格补数
否则：
    同一合法 V1.2.1 快照的最小事实投影
    + 原 elderSnapshot / clarifications / candidate constraintResults
    → 独立 Reference Policy
    → 新 C1 composition + 新 ViewModel
~~~

现有可复用入口：

- services/recommendation-preview-v2.ts:221 createRecommendationPreviewServiceV2，支持 draftSource 和 institutionCatalog 注入。
- services/institution-catalog-v1-2-1.ts:95 validateInstitutionCatalogPayloadV121。
- 同文件:246 projectInstitutionCatalogV121ToV11，以及 createInstitutionCatalogServiceV11Adapter。
- domain/institution/v1-2-1/project-to-v1-1.ts:17 projectInstitutionRecordV121ToV11。

底层 Provider 实际读取一次；注入 port 返回同一份脱离外部可变对象的投影快照。不能先加载一份给 V2、再读取“最新”一份给参考，也不能换 evaluationAsOf。保持原“不完整问卷先失败、不读取 Catalog”的顺序。

旧 V2 输出应完整嵌入新包络的 legacyV2；与相同输入/时间独立执行旧入口所得 oracle deep-equal。允许新通道读取其诊断事实，不允许改写任何旧字段、向 cards 塞 UNVERIFIED、把 blocked 改 ready。

### 2.2 为什么不能只接 WXML 或只消费旧显示文案

已有 institutionDisplays 包含名称、区域展示名、参考费用和房型/餐次展示，但不能用显示标签作为 AREA code。V2 poolManifest 具有 regionCode、费用和扩展证据引用，可用于交叉核验；其投影并不保留所有原字段信息，例如费用字段 asOf、完整 sourceReference。

因此新增独立的最小 ReferenceInstitutionFacts 投影，来源必须是已经由同一次 Catalog 校验通过的原始记录，至少带：

- institutionId、recordRevision、recordProvenance、recordStatus、datasetVersion/mode、evaluationAsOf。
- 允许读取的 regionCode、referenceMonthlyPrice、roomType、mealSchedule，以及下文两项饮食冲突保护字段。
- 每个字段的 raw availability/value、verification status、verifiedAt、可选 validUntil、asOf。
- 仅与这些字段对应的 evidenceId、fieldPath、valueSnapshot、同 institutionId/revision 的绑定和 sourceType；sourceReference 若展示，取同源原证据，不补造 URL。
- 精确 currentPointer 关联；不保留整家机构所有无关资料。

只读 raw 记录不等于绕过校验。先使用原验证器，再使用当前验证投影；新事实投影不是第二份护理规则。照片、电话、地址、宣传文案、人员数量和运营状态不进入参考排序。

### 2.3 新类别不是旧状态的别名

建议独立标识为 INITIAL_REFERENCE，属于新 C1 result kind/version；不是 V2 MatchTier 新增枚举值。具体机器标识在第 5 节给出一套待签署建议，未写入源码。

- legacy candidate.matchTier=UNVERIFIED，只能说明旧关键能力未核实；还必须经过参考依据、冲突、current revision、来源等检查才可能成为新参考。
- legacy matchTier=null 绝不能解释为“无冲突”或“适合”。需要读取约束和未决需求。
- legacy INELIGIBLE 一律不进入新参考。
- required clarification 原封不动；其优先级依然阻断旧核实型匹配。C1 新消费后继明确允许它在风险明示下进入独立参考计算，不冒充旧 gate 已解除。
- C1 不重算 Profile，不创建身份，不保存评估，不读取真实账号或触发联系/预约。

### 2.4 准入判定的完整顺序

建议固定为以下顺序，不存在用依据数量“抵消”排除条件的分支：

1. Draft/版本/全问卷校验失败：保留旧错误，不运行参考。
2. Catalog/投影失败：整体数据或服务错误，不跳过坏记录拼参考。
3. 原 V2 有可展示候选：只展示原组；参考展示为空。
4. 对 currentPointer 对应、published、来源与当前模式一致的机构，确认它在旧 V2 included manifest 中有唯一同 revision 的 candidate evaluation。
5. 任一原 constraint.outcome=conflict，或者旧 tier=INELIGIBLE：排除。
6. 执行第 4.3 节的 C1 饮食明确冲突补充保护；命中则排除参考。
7. 检查 AREA/BUDGET/BASIC_SERVICE，至少一个类别 MATCHED 才获得参考资格。
8. 复制全部相关风险、澄清和未知能力，不截断；按第 5 节排序，最多三家。

旧诊断记录缺失、证据/版本关联不一致是 DATA_ERROR，不得当“没有冲突”。draft/suspended/archived 不进入参考；原 manifest 的 RECORD_NOT_PUBLISHED 语义不变。

## 3. 可信普通参考依据及真实数据可用性

### 3.1 通用有效事实 Gate

每一条正向依据必须同时满足：

- 原 Catalog、记录版本与证据闭包校验成功。
- 字段 availability=provided。
- isVerificationCurrentAt(verification,T)=true；不单凭 status 字符串判断。
- 所有引用证据与字段值、fieldPath、institutionId、recordRevision 一致。
- 字段若提供 asOf，要求 asOf <= T；费用按原契约必须有合法 asOf。
- verification.verifiedAt <= T；若 validUntil 存在，T <= validUntil。等于 validUntil 仍有效；当前 Frozen 允许 validUntil 缺省，不额外发明统一过期天数。
- currentPointer 与记录精确一致，不从 revision 最大值、数组位置或名称猜当前版本。

domain/institution/verification.ts:18 的 isVerificationCurrentAt、:44 resolveEffectiveCapability、:63 resolveEffectiveInstitutionField 是现成的时间/验证机制。现成字段 helper 不检查业务 asOf 是否晚于 T，因此 C1 正向依据投影应增加上述非未来 asOf 约束；不能为此改变 V2 helper 或旧 V2 输出。

UNKNOWN、UNVERIFIED、EXPIRED、UNAVAILABLE 保留原始差别；依据计算可以统一“不计正向类别”，但诊断与文案不能统一伪装成“机构不提供”。

### 3.2 AREA：只比较用户明确选择的稳定区划 code

老人端：preference.region 必须存在，kind=institution_region，稳定 regionCode 是本次明确选择。no_preference、缺失和默认城市均不满足。

机构端：identity.regionCode 通过上节 Gate，effective code 与老人 code 完全相同。不按中文标签、地址子串、坐标距离、区名别名或同在武汉推断匹配。

- MATCHED：有效 code 相等。
- NOT_MATCHED：两端 code 均明确有效但不同；只是普通区域不符，不是护理硬冲突。
- UNKNOWN：老人明确区域、机构事实却未知/未核验/过期。
- NOT_APPLICABLE：老人没有具体区域选择。

regionLabelSnapshot 只供展示，不作比较键。保留作答时 catalogVersion，不强制它与当前目录的 datasetVersion 相同；当前机构事实仍需在 T 有效。

普通依据的 NOT_MATCHED 不自动变成护理硬冲突；若凭其他类别入选，仍必须展示重要的费用/区域/服务差异，不能用一项正向依据掩盖其他已知不符。原有预算 advisory 保留为提示，不进入新排序。

### 3.3 BUDGET：明确口径的实际区间重叠

唯一正向机构字段：price.referenceMonthlyPrice，且其 value 满足：

~~~text
basis = reference_total
range.kind = bounded
range.period = month
min.currency = max.currency = CNY
0 < min.amountMinor <= max.amountMinor，均为安全整数
asOf <= T，verification 在 T 有效
~~~

不汇总 recurringComponents，不借用 room.referencePrice、bed_fee、deposit、oneTimeFees 或 priceNote。首月促销、单床费、单一护理费和宣传起价没有资格冒充该字段的常态参考总月费。原契约明确 reference_total 仍是参考总费用，不是个人报价或全部附加费保证；卡上必须保留这一限制。

建议老人预算映射（单位：分，闭区间）：

| 稳定 code | 下界 L | 上界 U |
|---|---:|---:|
| cny_3500_5000 | 350000 | 500000 |
| cny_5000_8000 | 500000 | 800000 |
| cny_8000_12000 | 800000 | 1200000 |
| cny_12000_15000 | 1200000 | 1500000 |
| cny_15000_plus | 1500000 | null：无声明上界 |
| unknown | 不可比较 | 不可比较 |

正向判定：Imax >= L，并且 U 为 null 或 Imin <= U。边界相接计重叠；不要求机构区间完全位于预算内。cny_15000_plus 在 C1 可按已声明下界比较，但旧 V2 对其 budgetFit=unknown 的行为不变。null 只是新策略对老人上界的表示，不把 Infinity 写入 Institution 金额。

机构 starting_at 只有下限，不能证明一个完整费用区间，本版 BUDGET=UNKNOWN、不计类别，即使起价低于预算上限也一样。未知/过期/未来 asOf 同样不计正向。明确可比区间不相交为 NOT_MATCHED。

若有人把 basis=first_month 或 period=one_time 塞入 referenceMonthlyPrice，这不是合法“可比性 unknown”记录，而是 Catalog schema 错误，应整体失败。正确的首月说明可保留在价格备注中，referenceMonthlyPrice 保持 unknown，C1 不解析该文案。

### 3.4 BASIC_SERVICE：本版封闭白名单

建议 C1 首版只允许以下两个稳定偏好 comparator，避免把泛化的“服务很好”或护理能力未知当依据：

| 老人明确偏好 | 可匹配机构事实 | 匹配规则 |
|---|---|---|
| preference.roomType=single/double/triple_or_more | rooms[].roomType | current verified single/double/multi_bed 分别对应；存在一条相容房型即可 |
| preference.mealSchedule 为明确稳定餐次 | meal.mealSchedule | three_meals / three_meals_one_snack / three_meals_two_snacks 精确 code 相等 |

两者都没有具体偏好时 BASIC_SERVICE=NOT_APPLICABLE；至少一个有效匹配则 MATCHED；无匹配且存在需要核实的所选事实则 UNKNOWN；其余明确不符为 NOT_MATCHED。多房型、房型与餐次同时匹配，仍只计一个 BASIC_SERVICE 类别。

沿用现有保守事实边界：

- no_preference 不产生正向依据。
- rooms 空数组或未列出目标房型，不能推出“不提供”，为 UNKNOWN。
- suite/other 不自动等于单人/双人房。
- 餐次不做“更多餐次自动包含更少餐次”推断。
- 匹配房型不代表当前有床；匹配餐次不代表吞咽支持、食品质量或营养安全。

本版不将 activityPreference、typeProfile.supportedTypes、services[].name、护理标签、食物质地支持或医疗/人员描述计入 BASIC_SERVICE。activity 在旧 V2 是 display-only；未来若扩白名单，应升 Reference Policy 版本，不暗改本版“类别数”的意义。这里选择最小可验证范围，不改 Owner 的“三类依据至少一类”规则。

### 3.5 Production 11 家抽样数据：实际可满足的条件

本轮内存探针读取当前源码构造 Catalog，在固定 T=2026-10-26T04:00:00.000Z 校验并投影，逐条复核 regionCode 的 evidenceId、fieldPath、valueSnapshot、机构和 revision 绑定：

| 字段 / 类别 | 当前有效正向数据 |
|---|---|
| identity.regionCode | 11 / 11；8 个区 |
| referenceMonthlyPrice | 0 / 11 |
| rooms[].roomType | 0 个有效房型子项 |
| meal.mealSchedule | 0 / 11 |
| activity.indoorSpace / outdoorSpace | 无有效正向值；本版也不计依据 |
| typeProfile.supportedTypes | 0 / 11；本版也不计 BASIC_SERVICE |
| productionCapabilityRevisions | 0 条已发布能力 revision |

有效区划对应表，均为当前 revision 1；同区内以下列表已按 ASCII institutionId 排序：

| code | 区域 | 机构 ID |
|---|---|---|
| 420102 | 江岸区 | wh-jiangan-social-welfare |
| 420103 | 江汉区 | wh-social-welfare-institute |
| 420104 | 硚口区 | wh-qiaokou-social-welfare |
| 420105 | 汉阳区 | wh-hanyang-social-welfare；wh-taibao-hanyang；wh-zhaoshang-guanyi-hanyang |
| 420106 | 武昌区 | wh-wuchang-social-welfare |
| 420107 | 青山区 | wh-qingshan-social-welfare |
| 420111 | 洪山区 | wh-hongshan-social-welfare |
| 420112 | 东西湖区 | wh-dongxihu-baiquan-eldercare；wh-dongxihu-jiangjunlu-eldercare |

数据构造依据：

- modes/production/first-record.ts:14 createFirstRecord：首家 regionCode=420103，独立绑定区划证据。
- modes/production/record-builder.ts:10 buildPublicDirectoryEntry：新增条目的区划来自 reviewedDistricts + divisions 来源，而不是从地址猜。
- modes/production/unknown-record.ts:16：费用、护理、房型/餐次等未知状态被保留。
- modes/production/capability-reviews.ts：历史机构简介、开放日资料、建设计划等仍是待核实观察，没有进入 provider capability patch。

因此：

1. 若用户明确选汉阳区，当前数据中有三家通过 AREA 条件；明确选东西湖区则有两家。前提仍包括该用户需求的已知冲突检查，不能保证所有用户都得到同一数量。
2. 用户不选具体区或选择“不限制”，当前 Production 不能靠默认武汉补 AREA；费用和基本服务均不足，可能没有任何个性化参考。
3. 可以确认“有满足建议规则所需事实的真实目录记录”，不能声称 C1 功能当前已经输出参考；当前 engine/VM 仍给旧无安全推荐状态。
4. 公开名称、地址、电话、图片、简介和 pending research 都不能补足缺失的费用/服务/护理证据。本轮不在线重新核实机构现实状态，也不宣称内部有效期等于政府保证。

## 4. 已知关键冲突的可靠来源

### 4.1 冻结 Safety Core 已提供的证据

domain/recommendation/core.ts：

- buildRequirementSpecs：读取已派生事实，生成老人实际需要的 care-level acceptance、wheelchair/bedbound/transfer、dementia acceptance、wandering support 和直接特殊护理要求。
- hardOutcome：effective supported→satisfied；requires_assessment→conditional；unsupported→conflict；unknown→unverified。
- evaluateHardConstraints：每条结果带老人 requirement、sourceDerivedField、机构 fieldPath、effective status、institutionId/revision、elderEvidenceRefs、institutionEvidenceRefs。
- evaluateFrozenSafetyCore:369：统一执行这些规则。
- v2/core-v2.ts:360 tierFor：readiness blocked 时仍优先将已计算 conflict 设为 INELIGIBLE。

本轮只用合成输入调用现有实现，复现：

~~~text
cognitive.symptoms = [wandering_risk, mood_instability]
机构 wandering_risk_support = 当前 verified unsupported
老人 readiness = blocked_by_required_clarification
机构 tier = INELIGIBLE
constraint = WANDERING_RISK_SUPPORT / conflict
fieldPath = capabilities.cognitiveSupport.wandering_risk_support
老人和机构 evidence refs 均存在，机构 revision = 1
~~~

所以新通道可可靠继承已有关键冲突，不必在 C1 重写或再次解释 Hard Filter。排除检查读 constraintResults，不能以 rankTuple=null 或 matchTier=null 代替。

### 4.2 不能从现有模型推出来的内容

- needs_confirmation / unknown 需求不等于已经证明 required。Safety Core 对某些未决需求不生成对应 hard requirement；新通道必须记录 UNKNOWN_REQUIREMENT，不能把“没有 conflict 项”说成“全部护理安全检查通过”。
- 未核验或已过期 unsupported 的 effective 状态为 unknown，不得冒充 current known conflict；保留其原始否定记录和核实提示。
- 吞咽风险不等于 tube_feeding，走失线索不等于认知症诊断或必须入住专区。
- 当前没有行为风险专项接收矩阵，不能编造“情绪护理已支持/不支持”字段，也不能用机构简介补齐。
- 若收到现有模型之外的真实明确拒收事实，先走合法版本化事实接入；C1 不从自由文本识别新的护理冲突。

### 4.3 建议新增的 C1 饮食明确冲突补充保护

仅靠原 Safety Core 不能涵盖已存在但在 V2 被定义为展示信息的饮食字段。为避免新参考在已有明确饮食支持冲突时入选，建议 C1 Reference Policy 明确加入两条独立的否决规则：

| 老人派生事实 | 机构 current verified 对应值 | 新参考结论 |
|---|---|---|
| nutrition.foodTextureSupport known easy_chew | meal.easyChewSupport availability=provided、value=unavailable | 排除：REFERENCE_FOOD_TEXTURE_UNSUPPORTED |
| nutrition.foodTextureSupport known modified_food | meal.modifiedFoodSupport availability=provided、value=unavailable | 排除：REFERENCE_FOOD_TEXTURE_UNSUPPORTED |

这是 C1 新通道的否决，不是扩大 V2 Hard Filter；不改原 nutrition rankParticipation、Exact 或 V2 tier。新字段不被用来加分或计 BASIC_SERVICE。

raw availability=unavailable、value=unknown、requires_inquiry、unverified、expired，以及吞咽需要核实但尚无对应必要能力结论，均不能套上这两条 known conflict；它们保留未知/待核实状态。

这两条规则适用于参考 fallback 分支。已有合法 V2 组仍按 Owner“原组优先、原输出不变”展示，保留原有 nutrition difference；本次不扩展成重审所有旧 V2 候选的全新全局 Safety policy。若 Owner 要求该否决也改变旧 V2 的可展示资格，应另立 Recommendation successor，超出本次“不改变旧 V2”范围。

通过“原 frozen conflict 一票否决 + 两条明确饮食否决 + 未决需求不伪装已核实”，本版 C1 对其已建模关键事实的处理可以完整确定；不承诺覆盖模型外所有现实接收条件。

## 5. 排序、去重与组合状态的最终建议

### 5.1 选择组，而不是合并凑数

原 V2 经过原 VM 可展示的 Exact/SoftNear/Conditional 非空时：

- composition.presentationState=LEGACY_V2_DISPLAY。
- 展示原组、原顺序、原数量；一个候选就展示一个。
- displayedReferenceCards=[]，不拿参考补三家，不将 Conditional 当作“旧 V2 无卡”。
- noExactMatch.nearMatches 与 cards 的同一引用不能重复变成新卡。

只有原可展示组完全为空时，才计算并展示 Reference Policy 通过者。

### 5.2 参考排序

每家机构先聚合其 MATCHED 类别集合，再排序：

~~~text
basisCategories = distinct([AREA, BUDGET, BASIC_SERVICE] 中 MATCHED 的类别)
sortKey = (-basisCategories.length, institutionId_ASCII)
取前 min(3, eligibleCount) 家
~~~

这是证据类别计数，不是护理评分、总匹配分或百分比。未知护理能力不参与此计数，UI 不展示“3 分”或“100%”。同类十个证据或房型+餐次同时符合也只计一类。

字符串用稳定 ASCII 比较（小于/大于），不使用 localeCompare、当前语言、中文名称、数组顺序、床位或随机数。同 institutionId 只对应一个合法 current revision，因此无需 revision 大小作为 tie-break。

### 5.3 去重不能修复非法 Catalog

- 合法的“同一家机构 AREA、BUDGET、多个 BASIC_SERVICE 依据”应聚合为一张卡。
- revision archive 可以保存多版，但传入当前 Catalog 的 records 只能含 currentPointer 精确指向的一版。
- records 中重复同 institutionId，即使 revision 不同，现有校验会产生 DUPLICATE_CURRENT_INSTITUTION_ID，必须 DATA_ERROR。不能先删重，再把错误伪装成合法池。
- currentPointer 缺失/错版/重复维持原错误；禁止采用 max(revision) 或 latest fallback。
- 所有 basis、constraint 和 display 都必须对应同一 institutionId+recordRevision；关联不上整体报错，不跨版本借依据或冲突。
- 旧 revision 中的支持或不支持不替换当前 revision；旧历史也不被当前 revision 覆盖。

### 5.4 新包络、状态与字段责任

以下是本报告建议的待签署命名，源码尚未新增：

| 字段 / 状态 | 含义 |
|---|---|
| kind=reference_composition_v1 | 独立新包络；不是 recommendation_preview_v2 的字段扩写 |
| referencePolicyVersion=initial-reference-policy-v1 | 固定普通依据、冲突补充、类别计数、排序版本 |
| compositionVersion=reference-composition-v1 | 组合/展示选择版本 |
| legacyV2 | 原 ResultApplicationSnapshotV2 完整不变 |
| legacyPresentationState | 原 VM 的 ready_exact / ready_soft_near / ready_conditional / no_safe_recommendation；只读记录 |
| LEGACY_V2_DISPLAY | 原候选组可展示 |
| INITIAL_REFERENCE_ONLY | 原组为空，新参考非空 |
| NO_PERSONALIZED_CANDIDATE | 输入合法且非空池，但原组/参考均无可展示者 |
| DATA_ERROR | Catalog/schema/来源/revision/证据或结果关联错误，保留原错误信息 |
| SERVICE_ERROR | Provider 请求/加载或计算服务不可用，不能退为成功空结果 |

不完整/不支持 Assessment 版本保留原 assessment error，不尝试参考；原 V1 dispatch 保持旧路径，不把历史 V1 问卷自动迁移为 C1。空 Catalog 在当前旧 buildResultSnapshot 中是 NO_INSTITUTIONS_AVAILABLE 错误，应继续错误分类，不改成成功的 NO_PERSONALIZED_CANDIDATE。

参考卡至少含：精确机构身份与 revision、类别集合、可追溯依据、原始风险/clarification 关联、未知能力项、需要机构核实事项、新类别标签、展示顺序和来源版本。不得含伪造 elderId/assessmentId、接收保证或自动保存状态。

### 5.5 文案约束与详情入口

固定语义模板，未来自动化应对 stable code 与关键句断言，不以展示文字作为业务输入：

- 通用标签：G0 / “初步参考 · 护理与接收条件待机构核实”。
- AREA：A0 / “与您明确选择的区域一致；仅作为区域参考依据。”
- BUDGET：B0 / “已核验参考总月费区间与您的预算区间有重叠；实际费用仍需机构确认。”
- BASIC_SERVICE：S0 / “当前核验资料列出符合所选房型或餐次的普通服务；不代表床位或专项护理已确认。”
- 关键能力未知：K0 / “关键护理能力尚未核实，不能据此确认适合入住。”
- 吞咽：W0 / “已报告吞咽不顺，具体情况及饮食支持需要机构或专业人员核实。”
- 走失：L0 / “已报告走失相关风险，必要保障与接收条件仍需核实。”
- 情绪：M0 / “已报告情绪波动，相关行为情况仍需核实。”
- ADL：D0 / “日常生活能力仍有待确认项，当前不能形成确定照护等级或行动结论。”
- 被明确冲突排除：X0 / “当前有效资料明确不支持已知必要照护，未列入个性化参考。”
- 无参考依据：N0 / “当前没有具备足够可信依据的个性化候选，可继续浏览公开机构目录。”
- 仅参考结果标题：I0 / “暂无可核实匹配，以下为初步参考”；不能显示“没有机构”。
- 数据错误：E0 / “机构资料暂时不可用，请重试；这不是对机构是否适合的判断。”

风险/未知能力必须逐项保留，不受现有 focusTags.slice(0,3) 或 primaryReasons 截断限制。风险文字不把 needs_confirmation 改成诊断或 known；未知能力文字不能说“不提供”。

建议新卡独立 onReferenceCardTap，校验它确实属于本页当前 C1 快照，再用现有 serializeInstitutionDetailRoute(identity,'direct_link') 打开“查看机构公开资料”。这是普通公开详情，不携带 V2 recommendation sourceContext，不冒称已核实匹配。若精确版本已不可解析，显示资料版本不可用并允许返回/重试，不能自动替换为最新版本。

旧 onRecommendationCardTap、hasRecommendationIdentity 和 V2 sourceContext registry 保持原职责。不能将初步参考偷偷注入旧 registry 来骗过合法候选校验。新导航仍需单动作 guard、失败释放、生命周期清理；不自动电话、授权或预约。

## 6. 十二组完整固定验收向量

EXECUTION_STATUS = NOT_RUN_FOR_ALL_NEW_C1_VECTORS

本节是后续编写 fixture/assertions 的固定规格，不是新增测试代码。本轮仅运行现有测试和原源码探针，没有实现 Reference Policy 或新验收脚本。

### 6.1 全部向量共享的完整输入定义

固定时间：

~~~text
T = 2026-10-26T04:00:00.000Z
S = 2026-10-25T00:00:00.000Z
V = 2026-11-25T00:00:00.000Z
EXPIRED = 2026-10-26T03:59:59.000Z
FUTURE = 2026-10-26T04:00:01.000Z
~~~

U0：合法 AssessmentDraftV2，kind=assessment_draft、schemaVersion=2、persistence=LOCAL_DEVICE_DEVELOPMENT_ONLY、localDraftId=c1-fixed-draft、currentStep=budget、startedAt=2026-10-26T03:00:00.000Z、updatedAt=2026-10-26T03:30:00.000Z。答案恰为以下 26 项；未列的选填 key 缺失，不补默认区域：

~~~json
{
  "basic.relationship":"father",
  "basic.gender":"male",
  "basic.age":72,
  "health.conditions":["none"],
  "health.recentEvents":["none"],
  "health.rehabilitationNeed":"none",
  "health.chewingAbility":"normal",
  "health.swallowingAbility":"normal",
  "adl.eating":"independent",
  "adl.mobility":"independent",
  "adl.toileting":"independent",
  "adl.bathing":"independent",
  "adl.dressing":"independent",
  "adl.transfer":"independent",
  "adl.stairs":"independent",
  "cognitive.symptoms":["none"],
  "cognitive.specialCareNeeds":["none"],
  "preference.careType":"unknown",
  "preference.roomType":"no_preference",
  "preference.mealSchedule":"no_preference",
  "preference.activityPreference":"no_preference",
  "preference.priorities":["price"],
  "budget.monthlyRange":"cny_5000_8000",
  "budget.upfrontCostAcceptance":"unknown",
  "budget.moveInTiming":"research_only",
  "budget.consultantSupport":"recommendation_first"
}
~~~

可用已有 scripts/fixtures/elder-profile-v2-fixtures.mjs 的 makeAssessmentDraftV2 构造，但以上字面量为本规格 truth；若 helper 后续默认值变化，不得悄悄改变本向量。

A：向 U0 添加 preference.region：

~~~json
{"kind":"institution_region","regionCode":"420105","regionLabelSnapshot":"汉阳区","catalogVersion":"C1-FIXED-REGIONS-1"}
~~~

B(id,r=1)：完整合法的合成 InstitutionRecordV121，后续测试 loader 可复用 modes/production/unknown-record.ts 的结构工厂，但不得把合成记录写回 Production 数据。固定构造规则：

- contractVersion=institution-contract-v1.2.1；capabilityContractVersion=institution-capability-contract-v1；recordProvenance=MOCK_DEVELOPMENT_ONLY；recordStatus=published。
- 所有工厂字段保持原合法 unknown/空集合，尤其全部能力 unknown、价格 unknown、rooms=[]、meal/activity unknown、operations unknown。
- identity.name 为 provided + 当前 verified 的“Mock C1 institution {id}”，满足 Mock 标签约束，不用真实机构名。
- identity.regionCode 为 provided '420105'、identity.regionDisplayName 为 provided '汉阳区'，两者默认 verification=unverified/evidenceIds=[]。原 schema 要求这两个身份字段 provided；不能用缺字段或 availability=unknown 制造非法底座。它们默认不产生可信 AREA。
- publicLocation.address 为 provided + 当前 verified 的结构化地址：CN / 420000 湖北省 / 420100 武汉市 / 420105 汉阳区，addressLine='Mock C1 address {id}'、postalCode=null。地址不产生 AREA。
- 其他需要的字段全部保留完整工厂形状，不通过 any、缺 key 或绕过 validator 构造正例。

F(path,value,mode=CURRENT)：字段 availability=provided、value 按 path 合法类型、asOf=S；CURRENT 时 verification.status=verified、verifiedAt=S、validUntil=V。为该字段生成唯一 evidenceId，格式 c1-{id}-r{r}-e{计数}，附同 institutionId、revision、fieldPath、valueSnapshot、sourceType=official_document、sourceReference=https://example.invalid/c1/{id}、sourceNote=TEST_ONLY_SYNTHETIC_C1_VECTOR、observedAt=S 及匹配核验时间/状态。源 URL 只是不可访问的合成标识，测试不请求网络。

EXPIRED 模式：字段和对应 evidence 的 status 均 expired、verifiedAt=S、validUntil=EXPIRED，raw 值保留。UNVERIFIED 模式：字段 provided、verification=unverified、evidenceIds=[]，不留孤立的 verified evidence。必须先清理被替换字段的旧证据，再重建引用。

F 的 valueSnapshot discriminator 固定如下：identity.name、identity.regionDisplayName、room.name、media.url、priceNote 为 text；identity.regionCode、roomType、mealSchedule、两项 meal 食物支持及 capability.status 为 stable_code；publicLocation.address 为 structured_address；referenceMonthlyPrice 为 reference_monthly_price。snapshot.value 必须与被绑定字段的原始值完全相等，evidenceId 不得跨字段复用。额外未列的 child 字段必须保留工厂定义的 unknown 结构。

下列 patch 缩写是本规格的确定性数据操作，不是待实现的业务判断：

| 缩写 | 明确数据变更 |
|---|---|
| AREA_OK | 用 F 覆盖 identity.regionCode='420105' 和 regionDisplayName='汉阳区'；code 用 stable_code snapshot，label 用 text |
| PRICE_OK | F(price.referenceMonthlyPrice,{basis:'reference_total',range:{kind:'bounded',min:{amountMinor:600000,currency:'CNY'},max:{amountMinor:700000,currency:'CNY'},period:'month'}})；snapshot.valueType=reference_monthly_price |
| MEAL_OK | F(meal.mealSchedule,'three_meals')，stable_code snapshot |
| ROOM_OK | 增加 roomId='c1-room-double'；name 为 provided 'Mock double room'；roomType 用 F(rooms.0.roomType,'double')；面积/床型/七项 features/referencePrice 保持合法 unknown，mediaIds=[] |
| CARE_OK / CARE_CONDITIONAL | capabilities.careLevelAcceptance.independent.status=supported / requires_assessment；使用对应当前 verified capability 与 stable_code evidence 绑定；不是 InstitutionField availability |
| U(room,meal) | 用户 preference.roomType='double'、preference.mealSchedule='three_meals' |
| IMG | 增加 mediaId='c1-image'、category='exterior'、role='gallery'，url 用 F(media.0.url,'https://example.invalid/c1-image.png')；sortOrder/caption/capturedAt 合法 unknown；不请求图片 |

Catalog C(records)：datasetVersion=C1-FIXTURE-DATASET-1、datasetMode=MOCK_DEVELOPMENT_ONLY、records 为列出的完整 B 记录、currentPointers 每个 id 唯一精确指向列出的 r、presentation.orderingPolicy=CANONICAL_IDENTITY_ASC_V1、displayOrder=[]。默认 administrativeDivisionResolver 使用现有 reviewed resolver。正例必须先通过原 V1.2.1 Catalog 校验和原投影；如果底座不合法，测试应失败，不允许为跑通更改 validator。

所有根向量还共同断言 P：

- P1：旧 V2 oracle 来自原入口、同一 Draft/完整池/T；composition.legacyV2 deep-equal oracle，组合前后的输入也 deep-equal。
- P2：旧 VM 状态、readiness、tier、constraintResults、exactMatch、NO_EXACT_MATCH、PriorityFitVector、Rank Tuple、候选顺序与 evidence/clarification 全部不变。
- P3：原始风险不删改；Reference 独立类别，未知能力不变成 supported，结果无诊断/接收承诺/匹配分。
- P4：合成来源保留；没有真实账号、Storage、网络、登录、电话、预约、自动保存副作用。
- P5：单次底层 Provider 读取、同一显式 T；错误时不运行成功参考 fallback。

### R01：关键能力未知 + 明确区域

| 项目 | 固定规格 |
|---|---|
| 输入 | U0 + A；C([B('c1-a')+AREA_OK])；T |
| 核验事实 | 区划 CURRENT，其他关键能力均 unknown，费用和基本服务 unknown |
| 旧结果 | readiness=ready；c1-a 为 UNVERIFIED；旧 cards/conditional 均 []；旧 VM=no_safe_recommendation |
| 新资格 / 依据 | c1-a ELIGIBLE，basisCategories=[AREA]，类别数=1 |
| 排序 | ['c1-a#1']，仅一张 |
| 文案 / 风险 | G0+A0+K0，不能出现已核实护理/能接收/为了凑数的其他机构 |
| 新状态 | INITIAL_REFERENCE_ONLY，标题 I0 |
| V2 保护 | P1–P5；尤其不把 UNVERIFIED 改成 SOFT_NEAR |

### R02：吞咽风险明确 + 饮食照护未知 + 费用重叠

| 项目 | 固定规格 |
|---|---|
| 输入 | U0，health.swallowingAbility=occasional_difficulty；不选区域；C([B('c1-a')+PRICE_OK])；T |
| 核验事实 | 常态参考总月费 CURRENT 6000–7000 元；meal.easyChewSupport / modifiedFoodSupport unknown；关键能力 unknown |
| 旧结果 | readiness blocked；nutrition.swallowingConcern 保持 needs_confirmation/candidateValue；无卡；tier=null（无已知 conflict） |
| 新资格 / 依据 | ELIGIBLE，[BUDGET]，类别数=1；不能把饮食未知算 BASIC_SERVICE |
| 排序 | ['c1-a#1'] |
| 文案 / 风险 | G0+B0+W0+K0；“费用符合”只能是区间重叠，不能承诺该护理等级实际总费用 |
| 新状态 | INITIAL_REFERENCE_ONLY |
| V2 保护 | P；不产生 tube_feeding required，不解除吞咽 clarification |

### R03：必要保障的已知不支持优先于普通依据

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；cognitive.symptoms=[wandering_risk,mood_instability]；C([B('c1-a')+AREA_OK+PRICE_OK])；T |
| 核验事实 | capabilities.cognitiveSupport.wandering_risk_support 用 CURRENT capability.status=unsupported；其余未知 |
| 旧结果 | 老人仍 blocked；WANDERING_RISK_SUPPORT=conflict，tier=INELIGIBLE；保留 mood 和 dementia_unit 等 clarification |
| 新资格 / 依据 | EXCLUDED_KNOWN_CRITICAL_CONFLICT；即使 AREA/BUDGET 能匹配也无展示资格 |
| 排序 | [] |
| 文案 / 风险 | X0 可用于结果排除摘要；不得生成 c1-a 参考卡；老人风险在总结果中保留 |
| 新状态 | NO_PERSONALIZED_CANDIDATE；合法数据，不是 DATA_ERROR |
| V2 保护 | P；INELIGIBLE 不得被新通道捞回 |

同组两个必要固定分支：

- R03-expired：相同 raw unsupported 改成 EXPIRED，证据同步；旧 effective 为 unknown，无 current conflict。c1-a 可因 AREA+BUDGET 获参考，仍显示 L0/M0/K0 及“原否定资料已过期、需核实”，不能把它显示为当前明确不支持或已支持。
- R03-food：U0+A，health.chewingAbility=modified_food；c1-a 的 meal.modifiedFoodSupport 为 F(...,'unavailable',CURRENT)，care acceptance 仍 unknown。旧 V2 保持 UNVERIFIED/原 nutrition difference，新参考 EXCLUDED_FOOD_TEXTURE_UNSUPPORTED，排序 []、新状态 NO_PERSONALIZED_CANDIDATE。raw availability=unavailable 而不是 provided value=unavailable 的对照分支只能保留 UNKNOWN，不能误用本否决。

### R04：情绪、吞咽与 ADL 多项待确认

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；cognitive.symptoms=[mood_instability]；health.swallowingAbility=significant_difficulty；adl.mobility=unknown；C([B('c1-a')+AREA_OK])；T |
| 核验事实 | 区划 CURRENT，全部关键能力 unknown，无已知冲突 |
| 旧结果 | blocked；至少含 cognition.behavioralRisk、nutrition.swallowingConcern、adl.careLevel、mobility.level 未决事实/关联 clarification；原集合全部保留 |
| 新资格 / 依据 | ELIGIBLE，[AREA]，1 类；ADL 未决不是强制用户改答案的理由 |
| 排序 | ['c1-a#1'] |
| 文案 / 风险 | G0+A0+M0+W0+D0+K0；对应全部未决项，不受“三个标签”上限截断 |
| 新状态 | INITIAL_REFERENCE_ONLY |
| V2 保护 | P；没有把 unknown ADL 强行派成 independent，也没有把 mood 当诊断 |

### R05：只有名称、地址、图片，不得个性化入选

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；C([B('c1-a')+IMG])；T |
| 核验事实 | 名称、地址和图片 CURRENT；identity.regionCode 仍 provided + unverified；其他普通事实/能力未知 |
| 旧结果 | 合法 Catalog，readiness ready、UNVERIFIED、无卡 |
| 新资格 / 依据 | NOT_ELIGIBLE_NO_TRUSTED_BASIS；AREA=UNKNOWN、BUDGET=UNKNOWN、BASIC_SERVICE=NOT_APPLICABLE；类别数=0 |
| 排序 | [] |
| 文案 / 风险 | N0；机构可存在于普通目录，图片/地址不能称为需求对应依据 |
| 新状态 | NO_PERSONALIZED_CANDIDATE |
| V2 保护 | P；未核验 regionCode 不能因地址中有汉阳二字而升级 |

### R06：一名旧候选 + 参考，不补三家

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；C([B('c1-v')+AREA_OK+CARE_OK, B('c1-a')+AREA_OK+PRICE_OK])；T |
| 核验事实 | c1-v 必要 independent 接收 CURRENT supported，费用未知；c1-a 能力未知、有普通依据 |
| 旧结果 | 原 c1-v=SOFT_NEAR 可展示；c1-a=UNVERIFIED |
| 新资格 / 展示 | 选择旧组；参考资格分支可不执行，displayedReferenceCards=[] |
| 排序 | 仅 ['c1-v#1']，不得追加 c1-a |
| 文案 / 风险 | 原 SoftNear 文案与差异保持；不能标 c1-v 为 INITIAL_REFERENCE |
| 新状态 | LEGACY_V2_DISPLAY |
| V2 保护 | P；原卡 count=1、顺序/理由完全不变 |

同组分支：给 c1-v 加 PRICE_OK，U0 的 room/meal 无偏好、type=unknown，则应复用旧 EXACT 组；把 CARE_OK 换为 CARE_CONDITIONAL，则应复用旧 CONDITIONAL 组。两种情况下仍只展示原 c1-v，绝不能以“semantics.cards 为空”为由忽略 conditionalCandidates。

### R07：四家参考，按类别数而不是证据条数排序

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A+U(room,meal)；T |
| 机构 | c1-a：AREA_OK+PRICE_OK+ROOM_OK+MEAL_OK；c1-b：AREA_OK+PRICE_OK；c1-c：AREA_OK+ROOM_OK；c1-d：AREA_OK；能力均 unknown |
| 类别 | a=[AREA,BUDGET,BASIC_SERVICE]→3；b=[AREA,BUDGET]→2；c=[AREA,BASIC_SERVICE]→2；d=[AREA]→1 |
| 旧结果 | 四家均 UNVERIFIED；旧无卡 |
| 新资格 | 四家 ELIGIBLE；a 的房型和餐次同时满足仍只计一个 BASIC_SERVICE |
| 排序 | 完整顺序 a,b,c,d；展示 ['c1-a#1','c1-b#1','c1-c#1']；d 因 limit 不展示 |
| 文案 / 风险 | 每卡 G0+其真实依据模板+K0；不得展示计分或“护理更好” |
| 新状态 | INITIAL_REFERENCE_ONLY |
| V2 保护 | P；分别执行四条输入记录全部 24 种排列，选中机构/顺序相同，不改变旧 V2 排序算法 |

### R08：跨依据聚合与合法精确 revision

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A+U(room,meal)；独立 archive 持有 c1-a#1 与 c1-a#2，#1 的 capabilities.careLevelAcceptance.independent 用 CURRENT unsupported 并将证据绑定 #1；C.records 仅放 B('c1-a',2)+AREA_OK+PRICE_OK+ROOM_OK+MEAL_OK；currentPointer=(c1-a,2)；T |
| 核验事实 | 全部新证据重绑 revision 2；archive r1 不支持必要能力的旧事实不得借入当前记录 |
| 新资格 / 依据 | 一家 ELIGIBLE，3 个类别；不生成四张“各依据一张”的重复卡 |
| 排序 | ['c1-a#2'] |
| 文案 / 风险 | G0+对应依据+K0；展示 revision 2，引用的 display/证据均是 #2 |
| 新状态 | INITIAL_REFERENCE_ONLY |
| V2 保护 | P；不把 archive 合并进 V2 当前池 |

同组错误分支：把 #1 和 #2 同时放进 C.records，维持原 DUPLICATE_CURRENT_INSTITUTION_ID→DATA_ERROR；currentPointer 指 #3 而记录只有 #2，则 CURRENT_POINTER_NOT_FOUND→DATA_ERROR；篡改一个参考 display 或 constraint 关联为 #1，则 SOURCE_REVISION_MISMATCH→DATA_ERROR。均不得“去重选最新后继续”。

### R09：非法记录必须使全池失败

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；C 包含有效 B('c1-a')+AREA_OK，以及 B('c1-b') 后将 recordRevision 改成 0；T |
| 关键事实 | b 是 schema/证据关联非法，不是护理 unknown |
| 原错误 | V1.2.1 Catalog validator 原 cause=INVALID_INSTITUTION_RECORD；各旧适配层保留其原 envelope/code 映射 |
| 新资格 / 排序 | 不运行成功参考；displayedReferenceCards=[]；不展示 a 的部分结果 |
| 文案 / 风险 | E0；不说“没有适合的机构” |
| 新状态 | DATA_ERROR，并保留原数据错误 cause |
| V2 保护 | P 中错误分支；不改 validator 或将异常吞成空数组 |

同组 Provider throw/返回失败的分支应为 SERVICE_ERROR；不是 NO_PERSONALIZED_CANDIDATE。

### R10：旧 no-safe + 两家合法参考是双层状态

| 项目 | 固定规格 |
|---|---|
| 输入 | U0+A；health.swallowingAbility=occasional_difficulty；C([B('c1-b')+AREA_OK,B('c1-a')+AREA_OK])；T |
| 事实 | 两家区划 CURRENT，关键能力/饮食照护 unknown；无已知 conflict |
| 旧结果 | readiness blocked；旧 VM=no_safe_recommendation；exactMatch=false，NO_EXACT_MATCH 保留；两家 tier=null |
| 新资格 / 排序 | 两家均 ELIGIBLE、各 [AREA]；['c1-a#1','c1-b#1'] |
| 文案 / 风险 | I0+G0+A0+W0+K0；可给数量 2，不显示“没有机构”或“已找到安全匹配” |
| 新状态 | INITIAL_REFERENCE_ONLY；legacyPresentationState 仍 no_safe_recommendation |
| V2 保护 | P；不存在对 Domain 写入 semantics.state='ready' 的做法 |

### R11：过期、首月口径、默认城市等不构成依据

共同输入：U0、不选区域、无房型/餐次偏好；每个分支 Catalog 仅含 c1-a，关键能力 unknown，T 固定。每个分支必须独立执行，不能被其他正向依据掩盖。

| 分支 | 机构 / 用户固定变化 | BUDGET / 资格 | 排序 / 新状态 |
|---|---|---|---|
| expired | PRICE_OK 改 EXPIRED，raw 6000–7000 保留 | UNKNOWN；不入选 | [] / NO_PERSONALIZED_CANDIDATE |
| first-month | referenceMonthlyPrice unknown；priceNote 用 F 保存“首月优惠6000元，不代表常态月总费用” | UNKNOWN，不解析宣传文字 | [] / NO_PERSONALIZED_CANDIDATE |
| default-city | 无有效月费；合法地址含武汉；用户可另测明确 no_preference 对象 | 无 AREA / 无其他依据 | [] / NO_PERSONALIZED_CANDIDATE |
| starting-at | 当前 verified reference_total/month 起价 600000、max=null、kind=starting_at | UNKNOWN，不能证明完整区间 | [] / NO_PERSONALIZED_CANDIDATE |
| future-asOf | PRICE_OK 的字段 asOf=FUTURE，核验仍 S/V 且证据闭包合法 | C1 UNKNOWN；旧 V2 若仍可比较不得被改写 | [] / NO_PERSONALIZED_CANDIDATE |
| touch | 当前完整月费区间 [800000,900000]，U0 预算 [500000,800000] | MATCHED，[BUDGET]；闭区间边界相接 | ['c1-a#1'] / INITIAL_REFERENCE_ONLY |
| no-overlap | 当前完整区间 [800001,900000] | NOT_MATCHED | [] / NO_PERSONALIZED_CANDIDATE |
| open-user-budget | 老人 cny_15000_plus；当前完整月费 [1400000,1550000] | MATCHED，[BUDGET]；不得伪造老人预算上限 | ['c1-a#1'] / INITIAL_REFERENCE_ONLY |
| valid-until-boundary | PRICE_OK，字段/evidence validUntil=T | MATCHED（边界包含） | ['c1-a#1'] / INITIAL_REFERENCE_ONLY |

不入选分支文案 N0，保留费用过期/口径未知等原状态；入选分支 G0+B0+K0。全部保护 P，特别是不能为 C1 费用比较改变旧 V2 对 cny_15000_plus 或 starting_at 的 budgetFit/Exact 语义。若构造非法 referenceMonthlyPrice.basis=first_month，应走 R09 DATA_ERROR，而不是本组成功 unknown。

### R12：Demo / Production 独立执行与来源拒绝

| 项目 | Production 子例 | Demo 子例 |
|---|---|---|
| 输入 | U0+A，仅将 regionCode 改为 '420112'、regionLabelSnapshot 改为 '东西湖区'；T | U0+A；T；独立合成 Catalog C([B('c1-demo-a')+AREA_OK])，经 Demo 注入边界 |
| 机构事实 | 固定保存的当前 wuhan-public-directory-20261023-r3 的 11 条 r1 合法快照；Production provenance | MOCK_DEVELOPMENT_ONLY；不导入 Production 目录事实 |
| 旧 V2 | 无风险 ready、关键能力未知、无卡 | 必需能力 unknown、无卡 |
| 新资格 / 排序 | 仅 ['wh-dongxihu-baiquan-eldercare#1','wh-dongxihu-jiangjunlu-eldercare#1'] | 仅 ['c1-demo-a#1'] |
| 风险 / 文案 | G0+A0+K0；不能套虚构机构标签 | 同样 reference 警示，并明确 TEST ONLY / 虚构数据 |
| 状态 | INITIAL_REFERENCE_ONLY | INITIAL_REFERENCE_ONLY |
| 隔离 | 不读 Demo session/fixtures，不调用登录、电话或预约 | 不调用真实 Storage/network/login/位置/电话/支付；重置后会话对象失效 |

固定 Production fixture 应在后续测试中以此 datasetVersion 和精确 r1 输入冻结，不能每次读取更新后的目录却仍使用旧期望；本轮未新增该 fixture。其区划及日期值取本报告 §3.5 复核的当前记录，不改真实能力资料。

必要负例：把 Demo 记录混入 Production Catalog，或反向混入，原 DATASET_PROVENANCE_MISMATCH→DATA_ERROR，绝不通过改标签接受。旧 Demo 12 家场景还应跑原 convergence 回归，以同 T 的旧 V2 oracle 保证已有合法组优先；不是用此单条 fixture 替换演示场景。

R12 共同保护 P，当前测试可用虚拟微信 API 计数器断言真实副作用为零。新 C1 双模式构建、微信触摸及真机证据仍全部 NOT_RUN。

## 7. 预计修改文件、风险和依赖

以下均为后续可能实施范围，本轮零业务源码修改。拟新增文件名用于说明职责，可在正式签署时统一。

| 次序 / 层 | 文件或模块 | 当前职责 / 建议增量 | Frozen V2 影响 | 主要风险 |
|---|---|---|---|---|
| 1 事实投影 | 拟新增 domain/initial-reference/v1/institution-facts.ts | 只从合法同源 V1.2.1 记录提取允许字段、asOf、原始状态和证据；不取显示字符串 | 不改原验证/投影函数 | 来源二次读取、跨 revision、未来/过期正向事实 |
| 2 Reference Policy | 拟新增 domain/initial-reference/v1/eligibility.ts、rules.ts、index.ts | 最低一类依据、原 conflict 否决、饮食明确否决、类别聚合、确定排序 | 不修改 domain/recommendation/core.ts 或 v2/core-v2.ts | 把未知当支持、把同类证据计多次、丢风险 |
| 3 类型 / 组合 | 拟新增 types/initial-reference-v1.ts、types/reference-composition-v1.ts；services/reference-result-application-v1.ts | 新包络保留 legacyV2；惰性单次 Catalog 读取、版本/来源/精确关联、结果状态 | 旧 public types 不扩 MatchTier，不改旧 snapshot shape | 只查 semantics.cards 而漏 Conditional、错误吞成空、V1 dispatch 被破坏 |
| 4 构建注入适配 | services/recommendation-result-application.ts 的调用边界；新 wrapper 复用 createRecommendationPreviewServiceV2、原 Catalog adapter | 接新 composition，V1 和旧 V2 入口仍可独立调用；底层 Provider 一次 | 不重写旧算法；原则上新 wrapper 即可，原 service 修改应最少 | Profile 不完整却先读 Catalog、两份时间/数据源 |
| 5 新 VM | 拟新增 pages/recommendation/reference-result-view-model.ts | 独立参考卡、依据/风险/未知能力/核实事项；旧分支委托原 VM | result-v2-view-model.ts 原函数及 no-safe 行为不改 | 将旧 no-safe 抹掉、风险只显示前三项、UI 计分 |
| 6 页面 | pages/recommendation/result.ts、result.wxml；必要 result.less | 选择新组合状态；新 reference handler/公开资料路由，保留旧卡与原 guard | 旧推荐 handler/sourceContext 不冒充新类别 | 已有未提交字体/层级被覆盖、重复点击和迟到结果 |
| 7 历史接口预留 | 新 C1 类型中的 kind/policy/composition/source/evaluationAsOf/风险与证据引用字段 | 只约定未来可复制的不可变语义；不写库、不改现有 history reader | 旧历史 V1/V2 仍用原 reader | C1 临时包络冒充正式 CompletedAssessment |
| 8 fixture 与回归 | 拟新增 scripts/fixtures/initial-reference-v1-fixtures.mjs、check-initial-reference-v1-runtime.mjs、check-reference-composition-v1-runtime.mjs；package.json 注册必要命令 | 实现 R01–R12 及反例/排列/证据状态；复用原验证器/loader | 原测试期望不为新参考放宽 | 底座非法导致假失败/绕过校验导致假 PASS |
| 9 直接交互验证 | 新 reference 页动作测试；原 Result/UI/preview/convergence Gate | 旧组原序、新卡独立动作、失败/返回、双模式 | 不以改旧 Gate 隐藏失败 | 页面返回栈、Demo guard、原推荐详情关联 |

C1 不需要改 Assessment 32/26、ElderProfile 派生、旧 priority comparator、旧 Hard Filter、真实机构数据或 C2 后端。Profile 页继续能进入结果，不需要借新规则将其澄清改成“已确认”。

不新增真实保存按钮逻辑、不启用 TEST_ONLY History、不改正式身份/数据库/迁移。若未来 C2 要消费新类别，应由 C2 单独建立可授权保存、版本分发与不可变存储能力；旧历史缺少新字段时保持缺失，不在读取时重新计算 C1。

## 8. Frozen V2 保护清单

后续实施和验收必须保留：

1. recommendation-contract-v2、recommendation-ruleset-v2、conservative-exact-with-conditional-v1 的原值及旧入口。
2. 原 ElderProfile/Preview 语义和 Formal/Preview parity；不改 clarification.priority、evidence、candidateValue 或 known 状态。
3. 原 Safety Core、constraint 构造和有效验证投影；INELIGIBLE、UNVERIFIED、CONDITIONAL 不互相换名。
4. 原 EXACT/SoftNear 条件、PriorityFitVector、Rank Tuple、排序、MAX_3 与不补低 tier。
5. 原 NO_EXACT_MATCH、blocked readiness 和 no-safe 页面解释；新状态在另一个包络中表达。
6. 全池校验、坏记录整体失败、source provenance、重复 identity、currentPointer 和 exact revision 边界。
7. 原 display 同源原子关联；不通过第二次“最新机构查询”构造新参考。
8. 原普通目录/推荐 context 的区别；新卡公开详情不得伪造 V2 来源。
9. 原 Preview 无正式身份、无持久化、无自动授权/联系/预约；C2 不在本轮启动。
10. 旧历史快照/旧 reader 不升级、不回填、不覆盖；新类别不写入旧版本结构。

## 9. Demo / Production 隔离要求

构建入口仍为 scripts/build-run-mode.mjs production/demo；根 miniprogram/ 默认开发 Mock 不等于 Production 运行。现有 dist 是 2026-10-25 构建产物，本轮未覆盖。

- Production 新 wrapper 使用 Production 实际 Provider 和其校验选项；不得直接导入 fixtures、Demo session 或 capability research 观察作为事实。
- Demo 新 wrapper 使用 Demo Provider/内存边界；Mock 的“verified”仅为合成规则输入，始终保留虚构数据声明。
- recordProvenance 与 datasetMode 不匹配，维持原错误，不能仅按 runMode 字符串切掉 provenance 检查。
- modes/demo/guard.ts 中真实 wx 网络、存储、登录、电话、位置等阻断保留。
- scripts/support/demo-story-composition.mjs 会替换共享 Result 文案/代码片段；以后新增 C1 区块时需验证其锚点与插入位置，不让已有 Demo override 消除风险提示。
- Demo 的预设历史与另存演示评估仍为内存合成数据，不因 C1 result 增加版本字段变成正式历史。
- C1 查询与渲染不触发自动保存，即使无候选或获得新参考也一样。
- 后续必须在新鲜双构建后重跑隔离；本轮已有产物 PASS 不能替代未来新增模块的隔离验收。

## 10. 本轮验证与证据边界

### 10.1 实际执行

执行前检查现有脚本写入范围；未实现新测试文件。check:capability-evidence 只使用并清除其系统临时目录，本轮无 --with-build。其他列出的源码 Gate 在 VM 中加载/转译当前 TS；convergence 只读已有 dist，模拟微信 API。

| 现有命令 | 本轮结果 | 证据范围 |
|---|---|---|
| npm run check:recommendation-v2-runtime | PASS：68/68 固定 fixture，6/6 parity，确定性/不可变性 PASS | 当前原 V2，不是新 C1 |
| npm run check:recommendation-result-v2-ui-runtime | PASS：18 snapshot + 30 UI | 当前原 no-safe、Conditional、显示与来源 |
| npm run check:recommendation-preview-v2-integration-runtime | PASS：20/20，storage writes=0 | 旧全池、单次来源、验证/错误、无 Preview 写入 |
| npm run check:capability-evidence | PASS | 合成 current/expired/conditional/unsupported、revision/排序保护；真实研究未升为事实 |
| npm run check:production-directory-data | PASS | 当前目录来源元数据/区划/唯一性；不是本轮在线事实核查 |
| npm run check:run-mode-convergence | PASS（已有 dist） | 12 家 Demo、重置、来源、旧业务链与副作用阻断 |
| npm run check:institution-vr-runtime | PASS | 当前 VR 状态页与资源验证、失败重试 |
| npm run check:institution-navigation-a0-4-interactions | FAIL：23/25，NAV-019、NAV-024 | 保留旧 Gate 失败，不改预期 |

共 8 组命令，7 PASS / 1 FAIL。本轮为控制输出尾部使用 PowerShell Select-Object -Last 8，并保留 npm 原退出码；错误 stderr 仍保留。没有以输出裁剪消除失败。

无落盘源码探针另外完成：

- 当前问卷 registry 32/26、11 家 Production 验证、零 capability revision 的复核。
- 逐条当前有效区划证据闭包及 8 区 ID 列表；费用/房型/餐次/活动/类型正向字段计数均为零。
- 明确区域、带情绪/吞咽 blocked 的区域样例：原 V2 都可成功生成诊断结果，11 家 included、无卡、无硬冲突；同源区划仍可读取。
- blocked + current verified wandering unsupported：旧 V2 仍为 INELIGIBLE，conflict 和双方 evidence refs 保留。
- 探针没有实现新 Reference eligibility/composition，也未声称十二组新向量通过。

### 10.2 现有失败与 C1 关系

NAV-019：旧测试要求 canOpenVr=false 时不得出现任何 VR 路由；当前 detail.wxml 已有“查看全景资料状态”，handler 允许去状态页，resource resolver 仍防止未知/过期/错版本资源打开 viewer。专项 VR runtime PASS。属于现有测试预期与当前界面差异，不是 C1 eligibility 阻断，后续维护时仍须保留资源安全断言。

NAV-024：测试组装的 Home 实例缺少 syncBrowseFont，生命周期调用报 TypeError；真实 Component.methods 中存在该方法。是当前 harness 滞后证据，尚非真实首页故障证明。与 C1 新策略无直接关联，但新页面导航验收不能因此跳过。

本轮不修改两个失败，也不因其他 PASS 报告全绿。这些问题不阻止将明确的 C1 方案交 Owner 评审，但不能作为代码实施验收已通过的依据。

### 10.3 未执行项

- R01–R12 的新 C1 Policy / composition / 页面验收：NOT_RUN，功能和测试尚未实施。
- 新双模式构建、正式微信打包、DevTools 当前 UI 操作：NOT_RUN。
- Android/人工微信真机：NOT_RUN。
- 真实服务端、数据库、正式历史、真实身份与跨设备 E2E：NOT_RUN / C2_OUT_OF_SCOPE。
- 本轮无真实机构联系、电话、预约、微信上传或发布；未读取用户健康草稿或凭证。

## 11. 技术契约剩余开放项与冻结评审结论

### 11.1 可提交 Owner 的单一建议方案

建议 Owner 对本报告这一个完整方案作冻结确认，不重新选择已明确的六项产品方向。方案已经明确：

- 普通依据仅三类，BASIC_SERVICE 首版只含相容房型/精确餐次。
- current、证据闭包、非未来 asOf、参考总月费 bounded 与区间边界的确定判定。
- 原 conflict 一票否决、明确饮食支持否决，以及未决需求不伪装成安全通过。
- 原 Exact/SoftNear/Conditional 任一可展示就不展示参考；否则按不同依据类别数降序、ASCII id 升序、精确 current revision、最多三家。
- 旧 no-safe 与新 reference presentation 双层共存，不更改旧 V2。
- 原 Catalog 非法重复版本与新多依据聚合分开处理。
- 独立公开详情动作和未来历史只读版本预留，无 C2 写入。
- 十二组固定输入、输出、反例、文案和旧 V2 保护断言。

当前没有需要实施者临场选择的未定义算法分支。BUDGET/BASIC_SERVICE 当前 Production 缺资料是合法 UNKNOWN，不是必须造数据补齐的冻结阻断；用户未选区域时可能无参考，是允许且已定义的结果。

### 11.2 尚未发生的事项

| 开放项 | 本次状态 / 是否阻止送 Owner 冻结评审 |
|---|---|
| Owner 签署本报告的具体 Policy scope、补充饮食否决、字段和版本命名 | PENDING_OWNER_CONFIRMATION；这正是下一停点，不等于已冻结 |
| 将方案整理成独立 successor / consumption Contract，并与产品资料同步 | NOT_CREATED；本轮只授权本报告，不新增契约文件 |
| 最新 V1.3 产品文件补入有效文档体系 | NOT_AVAILABLE；本轮六项书面决策足以开展 C1 技术送审，不假装已同步 |
| 新实现、十二组自动化、构建、导航/真机验证 | NOT_IMPLEMENTED / NOT_RUN；实施授权之后验收，不能提前 PASS |
| 已有 NAV-019 / NAV-024 的测试维护 | 已记录，后续相关回归处理；不在本轮改测试 |
| 模型外能力、更多 BASIC_SERVICE、starting_at 作为依据、全局改变 V2 饮食资格 | 不进入本版；未来独立版本，不留任意 fallback |
| 正式历史后端、真实身份/持久化 | C2_OUT_OF_SCOPE，不构成 C1 开始后端开发的授权 |

READY_FOR_C1_TECH_FREEZE_REVIEW=YES 的含义严格限定为“这套已明确边界的 C1 建议可以交 Owner 审核”。若 Owner 改变白名单、费用 comparator、饮食否决范围或要求同时改变旧 V2 候选资格，须同步修订相应向量和 successor 范围后再冻结；实现者不能自行选择另一套行为。

### 11.3 最终状态

~~~text
STATUS = V1_3_C1_TECH_CONTRACT_REVIEW_COMPLETE
BASELINE_COMMIT = 7ae07b9b78e4502940fd9812c6a838e4ddf2cc06
DIRTY_WORKTREE_PRESERVED = YES
REFERENCE_POLICY_FEASIBILITY = FEASIBLE_BY_INDEPENDENT_VERSIONED_CHANNEL
PRODUCTION_DATA_EVIDENCE = AREA_11_RECORDS_8_DISTRICTS_BUDGET_BASIC_SERVICE_UNKNOWN
KNOWN_CONFLICT_EXCLUSION = LEGACY_CONFLICT_AND_INELIGIBLE_VETO_PLUS_EXPLICIT_REFERENCE_FOOD_GUARD
LEGACY_V2_COMPATIBILITY = ORIGINAL_OUTPUT_UNCHANGED_REQUIRED_AND_EXISTING_SAFETY_REVERIFIED
RESULT_COMPOSITION = LEGACY_FIRST_ELSE_REFERENCE_ELSE_NONE_ERRORS_SEPARATE
STABLE_SORTING = DISTINCT_CATEGORY_COUNT_DESC_THEN_ASCII_INSTITUTION_ID_MAX_3
TWELVE_VECTORS = SPECIFIED_WITH_FIXED_INPUTS_AND_ASSERTIONS_ALL_NEW_C1_NOT_RUN
TEST_RESULTS = 8_EXISTING_COMMAND_GROUPS_7_PASS_1_FAIL_SOURCE_PROBES_COMPLETED
CONTRACT_OPEN_ITEMS = OWNER_CONFIRMATION_DOCUMENT_SUCCESSOR_IMPLEMENTATION_AND_ACCEPTANCE
READY_FOR_C1_TECH_FREEZE_REVIEW = YES
CODE_CHANGED = NO
GIT_COMMIT_PUSH = NOT_PERFORMED
WECHAT_UPLOAD_RELEASE = NOT_PERFORMED
~~~

完成报告后停止。只新增本文件；原有文件和前轮报告保留。本轮未冻结契约、未改业务代码/既有测试/真实机构事实，未启动 C2 或执行发布。

交付自检：报告以外的 2,099 个 Git tracked/untracked 非忽略文件内容汇总与开始时一致；排除本报告新增条目后的 Git 状态也一致。十二个根向量、要求的十六项最终字段及 Markdown 代码围栏检查通过。此文档自检不代表新 C1 功能验收通过。

## 附录：源码抽样探针复现方式

本轮沿用上一轮报告附录 B 的只读内存 loader，直接加载当前 modes/production 源码、注入同一 reviewed administrativeDivisionResolver，校验原 Catalog 与投影；新增观测仅读取 effective 字段计数、区划证据绑定，以及调用原 createRecommendationPreviewServiceV2。没有 Reference Policy 实现或新验收脚本。

固定观测摘要：

~~~text
PRODUCTION_CATALOG valid=true count=11 capabilityRevisions=0
CURRENT_FIELD_COUNTS price=0 room=0 meal=0 activity=0 supportedTypes=0
area: readiness=ready cards=0 conditional=0 hardConflicts=0 included=11
blocked-area: readiness=blocked_by_required_clarification cards=0 conditional=0 hardConflicts=0 included=11
both area-matched ids: wh-hanyang-social-welfare, wh-taibao-hanyang, wh-zhaoshang-guanyi-hanyang
blocked + verified wandering unsupported: tier=INELIGIBLE; path=capabilities.cognitiveSupport.wandering_risk_support
~~~

