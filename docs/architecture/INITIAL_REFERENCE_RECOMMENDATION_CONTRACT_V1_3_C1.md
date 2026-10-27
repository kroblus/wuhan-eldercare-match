# 武汉养老机构精准匹配小程序 V1.3-C1 初步参考推荐独立技术契约

**STATUS：`C1_TECH_RULES_FROZEN_BY_OWNER`**  
**FREEZE_DATE：2026-10-26（北京时间；Owner 本轮回复“确认”，未记录精确时分秒）**  
**CONTRACT_KIND：`reference_composition_v1`**  
**REFERENCE_POLICY_VERSION：`initial-reference-policy-v1`**  
**COMPOSITION_VERSION：`reference-composition-v1`**  
**IMPLEMENTATION_STATUS：`NOT_IMPLEMENTED`**  
**IMPLEMENTATION_AUTHORIZED：`FALSE`**  
**C2_FORMAL_HISTORY：`OUT_OF_SCOPE`**  

## 1. 冻结依据及适用范围

本契约将 Owner 已确认的 V1.3 六项产品决策和 Codex《`V1_3_C1_REFERENCE_TECH_CONTRACT_REVIEW.md`》（2026-10-26）的单一技术建议，固化为 **C1 新增初步参考通道**的实现与验收标准。Owner 已在本轮明确确认其具体技术规则，包括两条**仅在 C1 参考通道适用**的饮食明确冲突排除。

此处冻结的是**新通道的规则和预期验收结果**，不是已完成代码、测试、服务端或上线的声明。实现与实施后验收另行授权；本次未修改 Windows 项目工作区、冻结 V2 原合同或既有生产机构事实。

### 1.1 工程基线

- 优先使用已验收 B1.2.6 工作区：`C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`。
- 源码冻结起点：`7ae07b9b78e4502940fd9812c6a838e4ddf2cc06`；实施必须尊重该工作区现存未提交 UI/UX 成果，禁止覆盖、清理或改写。
- 当前正式 Assessment V2 为**32 个稳定题目、26 个必填**；六步、原问卷选项、已有条件/未知语义保持。
- 原 `Recommendation V2` 的 ElderProfile、Safety、Exact／SoftNear／Conditional／UNVERIFIED／INELIGIBLE、NO_EXACT_MATCH、Rank Tuple、最多三家策略及应用快照一律不变。
- Demo／Production 的证据来源、身份、数据隔离和副作用 Gate 保留。B1.2.6 工作区无可直接宣称生产可用的正式 `server/` 历史服务；C2 另议。

## 2. 用户可见业务定义

“初步参考”仅表明机构与老人**至少一个经核实的普通偏好条件**相符，**不表明**机构具备所需专项护理能力、同意接收、床位在售、最终费用成立，亦不属于医疗诊断或入住许可。

可出现的三类互斥展示层：

1. **旧 V2 可展示候选**：原 Exact／SoftNear／Conditional；原组优先、原顺序原数量，不以新参考补足三家。
2. **C1 初步参考候选**：仅在旧 V2 完全没有可展示卡时独立计算，最多三家，并逐项显示待核实事项。
3. **公开机构目录**：没有合法个性化候选时可供独立浏览；不得将其冒充个性化推荐结果。

明确的老人风险（情绪波动、吞咽困难、走失、ADL、营养等）和机构专项能力 `unknown` 不得构成 C1 自动整体阻断，**也不得被解释为已验证安全或可接收**。任何已核实、对该老人必要条件的明确不支持，不能因面积、区域、价格等普通依据较多而被抵消。

## 3. 输入、来源与旧 V2 保护

| 输入或事实 | 冻结规则 |
|---|---|
| `AssessmentDraftV2` | 必须满足当前 32／26 与条件性校验；合法 `unknown` 视为用户作答，不强迫修改。输入不合法时沿用旧 Assessment 错误，不开始参考及 Catalog 读取。 |
| `evaluationAsOf` | 一次计算只有一个显式时间 T。旧 V2 与 C1 使用同一 T，不读取两次不同“最新”事实。 |
| Catalog | 先完成原 `InstitutionCatalogV121` 全池校验，且同一合法投影提供给两个通道；底层 Provider 只读取一次。 |
| 当前机构版本 | 必须 `published`，来源模式合法，并由 `currentPointer` 精确指向唯一 `institutionId+recordRevision`。不得选择最大 revision 或跳过非法记录。 |
| `legacyV2` | 在新包络中完整保存旧 `ResultApplicationSnapshotV2`；须与同一输入、同一 T、同一池的原入口 oracle **deep-equal**。 |
| 风险／证据 | 原 ElderProfile 的 `reported`、`unknown`、`needs_confirmation` 和原 constraint/evidence/reason 不改写、不删减。 |

凡 Catalog schema、provenance、证据闭包、currentPointer、来源和 revision 关联不合法，均属**数据错误**；Provider 故障属**服务错误**。不允许跳过坏记录继续推荐，也不允许包装成“无适合机构”。旧 V1 dispatch 不得偷偷迁移至 C1。

## 4. 参考资格：固定判定顺序

按以下固定顺序执行；上一条失败后不得靠下一条“加分”补救。

1. Assessment／版本／问卷完整性有效；否则保留原错误。
2. 当前 Catalog 和投影全部有效；否则整体报错。
3. 运行冻结 V2；只要存在原可展示 Exact／SoftNear／Conditional，**立即选择旧组**，不展示任何参考卡。
4. 对剩余合法 `published` 的 current 机构，严格找到同 `institutionId+recordRevision` 的旧 V2 candidate evaluation、约束结果及 evidence 关联；缺失或错版为 `DATA_ERROR`。
5. 若原 `constraint.outcome=conflict` 或旧 tier=`INELIGIBLE`，一票否决新参考。
6. 执行 §6 的两条饮食明确冲突保护，命中则否决参考。
7. 独立计算 §5 的 `AREA`、`BUDGET`、`BASIC_SERVICE`；**至少一类 MATCHED** 才有个性化参考资格。
8. 对资格成立者保留全部风险／澄清／机构未知，按 §7 稳定排序并截取最多三家。

旧 tier=`UNVERIFIED`、`null` 或老人 readiness=`blocked_by_required_clarification` **既不自动授予 C1 资格，也不自动排除 C1**。未决老人需求不等于已证明必须专项接收；不得由吞咽风险自动推断鼻饲需求，亦不得由走失线索自动推断已诊断认知症或必须专区。

## 5. 普通依据三类封闭白名单

### 5.1 所有正向事实的共同证据 Gate

参与正向依据的机构字段必须：

- 原始 `availability=provided`，字段值合法；
- 经原验证机制判定在 T **current verified**，核验时间不晚于 T；有 `validUntil` 时 T 不晚于该期限（等号有效）；
- 对应证据 `evidenceId`、`fieldPath`、`valueSnapshot`、`institutionId`、`recordRevision`、`sourceType` 与字段精确绑定；
- 若字段有 `asOf`，不得晚于 T。费用必须具有合法 `asOf`；
- 不使用字符串显示标签、图片、宣传材料、地址子串、默认武汉、床位数或未证实的研究观察替代证据。

过期、未核验、不可用及未知字段**均不计正向依据**，但其原状态必须在诊断和展示中区分，不得统一改写成“机构不提供”。

### 5.2 AREA

- 用户须明确选择 `preference.region.kind=institution_region` 与稳定 `regionCode`；`no_preference`、缺失或默认城市不成立。
- 与机构经过共同 Gate 的 `identity.regionCode` **稳定 code 完全相等**才 `MATCHED`；中文区名、坐标和地址不比较。
- 双方有效且不相等为 `NOT_MATCHED`；机构缺可信区划为 `UNKNOWN`；用户未选明确区域为 `NOT_APPLICABLE`。
- 区域“不相符”是普通条件差异，不自动升级为护理硬冲突；若其他类别符合仍可入选，但必须展示差异。

### 5.3 BUDGET

唯一允许比较的机构字段为有效 `price.referenceMonthlyPrice`，严格满足：

`basis=reference_total`、`range.kind=bounded`、`range.period=month`、币种 CNY、`0 < min.amountMinor <= max.amountMinor` 且金额为安全整数，`asOf <= T`。

| 用户预算稳定 code | 下界 L（分） | 上界 U（分） |
|---|---:|---:|
| `cny_3500_5000` | 350000 | 500000 |
| `cny_5000_8000` | 500000 | 800000 |
| `cny_8000_12000` | 800000 | 1200000 |
| `cny_12000_15000` | 1200000 | 1500000 |
| `cny_15000_plus` | 1500000 | 无声明上界 |
| `unknown` | 不比较 | 不比较 |

机构完整闭区间 `[Imin,Imax]` 与预算有交集，等价于 `Imax >= L` 且（`U` 无上界或 `Imin <= U`），边界相接计 `MATCHED`。区间不重叠为 `NOT_MATCHED`。用户上界缺省仅表示预算开放端，不向机构数据写 Infinity。

`starting_at`、首月价、一次性费用、押金、房间单价、护理单项费用、宣传性价格文本或过期／未来时间价格不能形成 BUDGET 正向依据。价格重叠只证明“参考月总价区间与预算交叉”，绝不保证个人入住总价。原 V2 对开放预算等 comparator 维持原行为。

### 5.4 BASIC_SERVICE

首版仅允许下列对应：

| 用户明确偏好 | 当前核验机构字段 | 相容关系 |
|---|---|---|
| `preference.roomType=single` | `rooms[].roomType` | `single` |
| `preference.roomType=double` | `rooms[].roomType` | `double` |
| `preference.roomType=triple_or_more` | `rooms[].roomType` | `multi_bed` |
| 明确 `preference.mealSchedule` | `meal.mealSchedule` | `three_meals`／`three_meals_one_snack`／`three_meals_two_snacks` 逐 code 精确相等 |

至少一个明确偏好且存在对应有效事实为 `MATCHED`。房型和餐次同时符合仍**只计 BASIC_SERVICE 一类**。`rooms=[]` 或没有所选房型时，不能推断明确“不提供”；`suite/other` 不自动对应普通房型；餐次不按“更多自动包含更少”推断。

活动偏好、宽泛收护类型、`typeProfile.supportedTypes`、`services[].name`、护理标签、食物质地支持及医疗文案**不在本版白名单**。扩充须升级 Policy 版本并新增验收向量；不得暗改。

## 6. 已知关键冲突否决与新增饮食保护

1. 原 Frozen Safety Core 已得出的任何当期有效 `conflict` 或 `INELIGIBLE` **必须排除**，即使普通依据全部成立。
2. C1 另增加两条当期明确事实的排除：

| 老人已知需要 | 机构当前有效事实 | C1 结果 |
|---|---|---|
| `nutrition.foodTextureSupport=known easy_chew` | `meal.easyChewSupport` 的合法 `availability=provided,value=unavailable` | `REFERENCE_FOOD_TEXTURE_UNSUPPORTED`，不展示参考卡 |
| `nutrition.foodTextureSupport=known modified_food` | `meal.modifiedFoodSupport` 的合法 `availability=provided,value=unavailable` | 同上 |

上述两条新保护**只作用于 C1 fallback**，不改变原 V2 Safety、nutrition 展示或候选资格。若未来发现旧 V2 的饮食能力表现需要统一强化，必须另立版本化专项变更。

`unknown`、`requires_inquiry`、未经核验或过期的 `unsupported` 不得冒充当前已知冲突；完整保留其原始状态与核实提醒。C1 也不能从机构自由文本自动生成新的明确护理拒收事实。

## 7. 组合、排序、去重及错误状态

| 组合状态 | 条件 | 页面结果 |
|---|---|---|
| `LEGACY_V2_DISPLAY` | 原可展示组非空 | 原 V2 卡片原序原数量，`displayedReferenceCards=[]` |
| `INITIAL_REFERENCE_ONLY` | 旧组为空，新参考至少一张 | 展示新参考 1–3 张，旧 `legacyPresentationState` 保留原值 |
| `NO_PERSONALIZED_CANDIDATE` | 两组均空、合法非空机构池 | 提示可信个性化依据不足，保留公开目录浏览 |
| `DATA_ERROR` | 来源、schema、目录、revision、evidence 或关联错误 | 保留原技术错误原因，不给局部卡片 |
| `SERVICE_ERROR` | Provider／服务不可用 | 显示重试，不包装成不适配 |

参考排名在**各机构聚合成功的不同普通类别集合**之后执行：

```text
basisCategories = distinct([AREA, BUDGET, BASIC_SERVICE] 中 MATCHED 的类别)
sortKey = (-basisCategories.length, institutionId_ASCII)
displayedReferenceCards = sortedEligibleCandidates.slice(0, 3)
```

不得使用 `localeCompare`、中文名、数组原顺序、未知护理加分、任意匹配百分比或随机数。多个依据属于同一机构必须合成一张；同一 Catalog 包含重复 current institutionId 或错误 currentPointer 必须整体 `DATA_ERROR`，**不得先去重再消除错误**。

结果快照至少保留 `kind`、policyVersion、compositionVersion、完整 `legacyV2`、旧 VM 状态、同源 T、机构 ID/revision、依据类别、字段及证据引用、原始风险／澄清与未知能力、展示顺序和来源版本。C1 结果**不产生真实账号、elderId、assessmentId、CompletedAssessment，亦不触发正式保存**。

## 8. UI、文案、页面动作

必须明确呈现以下意思，稳定语义代码可用于验收：

| 代码 | 必须传达的意思 |
|---|---|
| G0 | 初步参考，护理与接收条件待机构核实 |
| A0/B0/S0 | 对应的区域／预算区间／普通房型或餐次为何符合；注明不代表护理、价格最终确定或床位可用 |
| K0 | 关键护理能力仍未知或未核实，不能确认可入住 |
| W0/L0/M0/D0 | 吞咽／走失／情绪／ADL 的**各自**风险与待核实事项 |
| X0 | 当前有效资料与老人已知必要条件明确冲突，故未列入参考 |
| N0 | 尚无足够可信的个性化参考依据，仍可浏览合法公开目录 |
| I0 | 暂无可核实匹配；下列仅为初步参考 |
| E0 | 机构资料错误或暂时不可用，不能据此判断老人是否适合机构 |

风险和未知护理项**不可被 UI 的前三项标签截断**。320／375／430px、150% 字体及 Android 真机中，标签、风险说明、按钮必须可见可读、无遮挡。只有已证实的依据才能进入“为什么列入参考”。

新参考卡采用独立点击处理，验证卡片确实属于当前 C1 快照，并通过已存在的公开机构详情导航序列化（`direct_link`）打开**机构公开资料**；不伪造旧 V2 recommendation sourceContext，也不调用自动电话、预约或咨询。按现有单动作 guard 防止快速双击及迟到跳转；失败可重试。不存在合法精确 revision 时说明资料版本不可用，不替换为猜测的新版本。

## 9. 冻结验收矩阵（规格固定、尚未执行）

固定测试基准 `T=2026-10-26T04:00:00.000Z`；数据采用通过**原 Catalog Validator** 的合成机构记录、精确 currentPointer、绑定证据和合法 Assessment V2，不得绕开校验器制造正例。测试中使用的 `Mock` 机构仅为 `MOCK_DEVELOPMENT_ONLY`，不得进入 Production。

| 向量 | 必须覆盖的输入及预期 |
|---|---|
| R01 | 所需护理能力全部 unknown、用户明确选汉阳；当前有效区划一致 → 一张 `[AREA]` 参考、风险可见、旧 V2 不变。 |
| R02 | 已报告吞咽不顺、机构饮食支持 unknown、正规月费区间与预算重叠 → `[BUDGET]` 参考；不声称吞咽照护支持。 |
| R03 | 已知当前防走失必要能力 unsupported，即使区域/费用匹配也排除；过期 unsupported 分支不冒充 current conflict；known food-texture unavailable 单独排除。 |
| R04 | 情绪、吞咽、ADL 多项待确认且 AREA 合法 → 可参考，保留全部风险，不强迫改答案。 |
| R05 | 只有名称、地址、图片；区域未核验且无其他对应依据 → 无个性化参考，只可浏览目录。 |
| R06 | 旧 V2 一张 Exact、SoftNear 或 Conditional，另有可参考机构 → 只显示原 V2 一张，不补满三家。 |
| R07 | 四家依据类别数分别 3/2/2/1 → 按类别数与 ASCII ID 稳定排序，展示前三家；房型+餐次不能重复计 BASIC_SERVICE，目录输入 24 种排列结果恒定。 |
| R08 | 同机构多依据聚合、archive #1/current #2 → 当前 #2 一张；非法双 current、错误 pointer、跨 revision 关联 → `DATA_ERROR`。 |
| R09 | 机构池中仅一条记录 schema 非法 → 整体 `DATA_ERROR`；Provider 失败 → `SERVICE_ERROR`；不能返回合法条目的部分结果。 |
| R10 | 旧 VM `no_safe_recommendation` 且两家合法参考 → 用户可见 `INITIAL_REFERENCE_ONLY`，旧 blocked/no-safe 原值不变。 |
| R11 | 过期价、首月价、默认武汉、仅起价、未来 asOf 无正向依据；闭区间边界相接、开放用户预算、validUntil 边界另测合法重叠。 |
| R12 | Production 11 条真实目录快照仅有效 AREA；Demo 合成数据独立；互串 provenance 报错，Demo 不触发真实微信副作用。 |

所有成功向量需额外断言：原 `legacyV2` 与 oracle deep-equal、输入不可变、原 tier／排序／风险／evidence／no-safe 不变、Provider 一次加载且同 T、新类别不自动落盘或调用真实微信 API。错误分支不得吞掉原因。**`R01–R12_EXECUTION = NOT_RUN`**；未来不得将规格制定写成测试已通过。

## 10. 当前数据及实施验收前提

Codex 在 2026-10-26 的只读探针中确认，当前 Production 目录 11 家机构经过既有 Catalog 校验，8 个区的区划事实有效；可用于 BUDGET 的完整月费 **0 家**，BASIC_SERVICE 房型 **0 项**、餐次 **0 家**，已发布真实护理能力 revision **0 条**。因此当前正式数据**不能**靠默认武汉或宣传文案填充参考。该探针不是未来 C1 实际运行证明，也不能代表真实机构能力已获得行政或医疗核实。

现有回归记录：8 组既有命令 7 PASS／1 FAIL；失败组中的 NAV-019、NAV-024 为已有导航／测试 harness 差异，不可静默忽略。完整新 C1 向量、双模式重建、JS 兼容、微信导航、包体积和 Android 真机均 `NOT_RUN`。

实施前必须：

1. 将六项 V1.3 产品决策、对应页面级 PRD/MVP 补充文件和**本独立契约**同步到 Windows 实际项目文档体系；原 `docs/product/` 当前仍只见 V1.2，不能假装已同步。
2. 先核实工作区 Git 状态与所有未提交成果，遵守既有配额平衡 Agent 工作流；不跨仓库复制旧 TEST_ONLY server 或绕过生产模式隔离。
3. 代码阶段按事实投影 → 独立 Policy → application composition → VM／页面与新 handler → fixture/runtime Gate 分层推进，并保留原 V2 oracle、Demo/Production 数据隔离。
4. 新 C1 通过 R01–R12、旧回归、双模式构建、UI 大字／窄屏及 Owner Android 实机验收后，另申请阶段交付和 Git 权限。任何上传、提审、发布仍需独立批准。

## 11. 正式冻结范围与后继边界

**已冻结（Owner 本轮确认）**：§1–9 的 C1 独立版本、旧 V2 优先且不补数、可信依据封闭白名单、时间/证据 Gate、已有关键冲突及两条 C1 饮食明确冲突排除、组合状态、稳定排序/去重、风险展示、独立公开详情入口，以及 R01–R12 的目标验收行为。

**没有冻结／没有授权**：C1 实现和测试通过状态；正式账号、单老人授权、历史写库、保存 API、跨设备验证（C2）；旧 V2 饮食资格的全局调整；新的 BASIC_SERVICE 扩充；真实机构护理能力凭证的采集确认；Git commit/push、微信上传／提审／发布。

最终阶段标记：

```text
OWNER_C1_TECH_FREEZE_CONFIRMATION = YES
C1_TECH_RULES = FROZEN_FOR_IMPLEMENTATION_SPEC
C1_CODE = NOT_IMPLEMENTED
C1_NEW_TESTS = NOT_RUN
C2_ARCHITECTURE = OPEN
READY_FOR_C1_IMPLEMENTATION_PLANNING = YES
IMPLEMENTATION_AUTHORIZED = FALSE
```

依据文档：`RECOMMENDATION_AND_HISTORY_PRODUCT_RULES_V1_3_DRAFT.md`、`PRODUCT_V1_3_SUCCESSOR_CONTRACT_REVIEW.md`（第 5 版评审稿）、Codex `V1_3_CODEBASE_COMPATIBILITY_AUDIT.md` 与 `V1_3_C1_REFERENCE_TECH_CONTRACT_REVIEW.md`。本冻结记录不追溯更改 V1.2 PDF 或已冻结的 V2 契约。
