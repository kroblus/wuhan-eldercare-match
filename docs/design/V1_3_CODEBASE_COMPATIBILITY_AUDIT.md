# V1.3 产品规则与现有代码适配审查

审查日期：2026-10-26（北京时间）。

STATUS = V1_3_CODEBASE_REVIEW_COMPLETE  
DOC_IMPACT = AUDIT_ONLY  
IMPLEMENTATION_AUTHORIZED = FALSE  
FROZEN_CONTRACT_CHANGE = NONE  
COMMIT_PUSH_RELEASE = NOT_PERFORMED

本报告依据 Owner 本轮提供的四项已定产品决策，以及下述工作区的当前文件。仅记录事实、差异、后续建议和验证边界，不冻结 V1.3 契约，不执行修复。审查完成不等于 V1.3 可以直接实施或上线。

## 1. 实际工程基线

### 1.1 主审查工作区与比较工作区

| 项目 | 主审查基线 A | 只读参考 B |
|---|---|---|
| 绝对路径 | C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4 | C:\Users\16562\WeChatProjects\wuhan-eldercare-match |
| 分支 | codex/v2-1-b1-2-4-card-actions-visual | codex/unified-source-baseline |
| HEAD | 7ae07b9b78e4502940fd9812c6a838e4ddf2cc06 | c7f57037f3cd7b2635d8cda1227eff1df462ac4c |
| Git 状态 | 40 个 tracked 文件已修改；另有 15 个折叠显示的 untracked 文件/目录条目 | 配置、治理文档、server/pom.xml、部分 Visit 源码/测试等已有修改；History 契约、后端包、SQL、桥接脚本和测试等为 untracked |
| 服务端 | 不包含 server/ | 含 Spring/JDBC 服务端；History 是隔离 TEST_ONLY 实现 |
| 本轮用途 | 主要实现与交互依据；报告写入此处 | 仅比较 History 适配与执行无数据库的相关纯测试 |

A 的 HEAD 恰好等于已知冻结提交，但不是全部最新实现。附录 A 列出原有未提交项；本报告审查的是磁盘当前文件，包含这些优化。结果页字体、依据层级、评估页字体、Demo 预约时间等改动已在当前源码中，不应被旧 HEAD 或旧报告覆盖。

A 根目录及本轮相关目录未发现 AGENTS.md，也未在其上级目录发现可适用的 AGENTS.md；不能假定兄弟工程 B 的文件自动继承。本轮遵循 Owner 提供的任务边界，并查阅 A 的 docs/agent/README_AGENT_ENGINEERING_V2_1.md，采用单会话、直接相关 Contract 和风险驱动验证。未启动子 Agent，未复制 B 的配置。

A 的 SOURCE_BASELINE.md 明确说明：这是 2026-10-22 从 B 的 c7f5703 导出的新 Git 历史，包含前端/模式/文本业务资料，排除服务端、机器配置及历史 PDF。两个仓库不是可以无条件 cherry-pick 的同一连续历史。B 中尚未提交的 History 后端也不会随该导出自动存在。

### 1.2 Demo / Production 构建与机构来源

| 入口 | 实际行为 | 适用结论 |
|---|---|---|
| 根 project.config.json → miniprogram/ | 原始开发源码；institution-catalog-v1-2-1.ts:220 附近默认仍读取 MOCK_INSTITUTION_CATALOG_V121 | 不能把直接打开根工程称为 Production 目录运行 |
| npm run build:production | scripts/build-run-mode.mjs 将共享源码与 modes/production/ 组合，替换 Catalog、runtime 校验及来源适配器；输出 dist/production/ | 正式只读目录构建入口；不等于正式服务端已部署 |
| npm run build:demo | 同一脚本将 modes/demo/、内存存储、独立身份 guard、页面替换与 composeDemoStory 组合；输出 dist/demo/ | 独立合成体验；不可作为真实用户历史 |
| Production 数据 | modes/production/catalog.ts:11 buildProductionCatalog → createFirstRecord + directory-data + record-builder + buildCapabilityHistory | datasetVersion = wuhan-public-directory-20261023-r3；当前 11 条机构记录，11 条均通过校验/投影；productionCapabilityRevisions.length = 0 |
| Demo 数据 | modes/demo/catalog.ts + directory.json + session.ts；启动载入 demoScenario | 当前 Demo 为 12 家合成机构，演示历史在内存；reset/restart 清除 |
| 原始开发 Mock | miniprogram/mock/institution-catalog.mock.ts | 八条开发测试记录；既不是上述 11 家真实目录，也不是 12 家 Demo 场景 |

当前已存在的构建标记：

- dist/demo/.shared-build.json：2026-10-25T11:38:22.169Z，ISOLATED_SYNTHETIC_MEMORY。
- dist/production/.shared-build.json：2026-10-25T11:38:30.988Z，REVIEWED_PUBLIC_DIRECTORY_READ_ONLY。

这是已有产物元数据，不是本轮新构建证明。本轮在这些已有产物上执行隔离测试并通过，但没有覆盖 dist，也未读取活动 DevTools 窗口来确认当下究竟打开哪个工程。因此“当前运行目录”只能按入口区分，不能断言用户屏幕当前运行 Production。后续人工验收必须记录打开的 project.config.json 绝对路径。

Production Catalog 只按核心身份、区域及公开地址是否可提供过滤构建条目（catalog.ts:12），不是按护理能力是否已知过滤。unknown-record.ts:16 为能力未知保留合法结构，不会给福利院、医养或康复名称补造能力。公开目录的存在也不证明可预约：canRequestInstitutionService 始终 false。

### 1.3 当前产品与契约依据

A 的 docs/product/README.md 指向 V1.2 产品 PDF，且明确 V1.2 新模块不得改变 Recommendation V2。A 的 docs/product/ 实际只有该 README，引用的两个 PDF 不在导出中。本轮没有据缺失 PDF 推断具体页面规则；Owner 本轮 V1.3 决策为目标规则，当前 Frozen Contract 为实现比较依据。完整产品 PDF 的逐页一致性仍待补齐有效版本后核验。

直接适用的技术依据：

| 文档 | 当前权威与本次用途 |
|---|---|
| ASSESSMENT_CONTRACT_V2.md | assessment-schema-v2；32 题、26 必填、条件题、CompletedAssessment 边界 |
| ASSESSMENT_CONTRACT.md | 历史 V1 的 27 题、21 必填；仅解释版本差异 |
| ELDER_PROFILE_CONTRACT_V2.md；ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md | Frozen V2 派生、营养待澄清优先级、Formal/Preview 语义一致、匿名身份隔离 |
| RECOMMENDATION_CONTRACT_V2.md；RECOMMENDATION_RULE_CONTRACT_V2.md | Frozen V2 readiness、Safety、五种 tier、排序、MAX_3、NO_EXACT_MATCH |
| PROFILE_UI_V2_INTEGRATION_CONTRACT.md；RECOMMENDATION_RESULT_UI_V2_INTEGRATION_CONTRACT.md | 当前画像与结果 application/display 边界；其中签署阶段的“不实施”字段不能代替当前源码事实 |
| INSTITUTION_CONTRACT_V1_2_1.md；INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT.md | 当前事实来源、V1.2.1 → V1.1 投影、精确 revision 与历史/当前展示边界 |
| AUTHENTICATED_ELDER_RECORD_IDENTITY_RESPONSIBLE_USER_BINDING_CONTRACT_V1.md | 一名真实 C5 负责用户对应至多一个 ElderRecord；问卷亲属关系不是授权 |
| WECHAT_INTERACTION_CONTRACT_V2.md；WECHAT_RUNTIME_COMPATIBILITY_POLICY.md | 当前动作、导航、失败重试、证据分层 |

跨域查阅 CONTRACT_INDEX.md 仅用于补充路由，不作为额外业务规则。A 没有 B 中新增的 History 提案及 B01 后继文件，不能把它们视为 A 已集成能力。

B 的 docs/architecture/COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md 明确为 PROPOSED_NOT_FROZEN、TEST_ONLY_DISPOSABLE_ENVIRONMENT、PRODUCTION_WRITE_ENABLED=FALSE；可以参考设计，不能当正式历史 Frozen Contract。

A 现有 docs/design/PROFILE_CLARIFICATION_RESOLUTION_PROPOSAL_V1.md 是 2026-10-25 的待审补充确认方案，IMPLEMENTATION=NOT_STARTED、RUNTIME_ACTIVATION=FALSE。它解释了旧阻断，但不能把“先解决所有澄清才能给参考”继续当成本轮 V1.3 唯一路径。此次不改该文件。

### 1.4 问卷核对：32 / 26 是版本差异

直接执行当前 TypeScript registry，并与 V1 registry 比较：

| 步骤 | 稳定题目数 | 必填数 |
|---|---:|---:|
| basic | 8 | 3 |
| health | 5 | 5 |
| adl | 7 | 7 |
| cognitive | 2 | 2 |
| preference | 6 | 5 |
| budget | 4 | 4 |
| 合计 | 32 | 26 |

- registry：miniprogram/types/assessment-v2.ts:333 ASSESSMENT_QUESTION_DEFINITIONS_V2。
- V1 实测 27 题 / 21 必填；V2 新增的五题均为必填：health.chewingAbility、health.swallowingAbility、preference.roomType、preference.mealSchedule、preference.activityPreference。因此是 27+5 / 21+5，不是需要删回旧题的“冲突”。
- 五个普通选填：basic.elderName、basic.livingStatus、basic.primaryCaregiver、basic.hasInstitutionExperience、preference.region。
- 唯一条件选填：basic.institutionExitReasons，仅当 basic.hasInstitutionExperience === 'true' 显示/有效；不是第 27 个必填。
- 六步稳定 ID、完整题表在 Frozen V2 §7.1 与 registry 一致；health 的两道营养题没有条件扩展。
- unknown 是部分题的合法完整回答；完成问卷不保证派生事实 known 或推荐 readiness ready。
- basic.age 仍为 50–110 整数，preference.priorities 为 1–3 个去重稳定 code；本轮没有重设计问卷。

## 2. 问题证据表

P0：V1.3 主闭环实施前必须解决的规则/授权/架构阻断；P1：适配或回归的重要缺口；P2：范围内的测试维护/取证缺口。表中“已证明”仅指代码与标注层级的自动化证据，不声称真机或生产服务端实测。

| ID | 用户可见问题 | 实际根因 / 证据等级 | 文件 / 函数 | 当前行为 | V1.3 目标行为 | 优先级 |
|---|---|---|---|---|---|---|
| R01 | 完整问卷选“情绪波动”后仍无卡 | 已证明：mood_instability 单独产生行为风险 needs_confirmation，并有 required_before_hard_filter | domain/elder-profile/derive-elder-profile.ts:613 行为派生；:236 addRiskClarification；domain/recommendation/profile.ts:647 buildReadiness | 11 条候选 matchTier=null，cards/conditional 皆空；重新提交同样答案不解除 | 保留线索和澄清，按新规则评估独立初步参考资格 | P0 |
| R02 | 吞咽不顺/未知时无卡 | 已证明：营养派生把非 normal 吞咽标为待澄清，unknown 同样阻断；机构食物支持不能解除 | domain/elder-profile/v2/semantic-core-v2.ts:207、约 274–320；domain/recommendation/v2/profile-v2.ts:1007 buildReadinessV2 | no_safe_recommendation；不是鼻饲需求，不是机构 UNVERIFIED | 保存原风险；初步参考清晰列吞咽核实事项，不制造诊断/接收承诺 | P0 |
| R03 | 走失风险后出现“认知症专区待确认” | 已证明：wandering_risk 本身为 known present，但未直接选择 dementia_unit 时会派生该专区需求待确认；gets_lost 还会使 wanderingRisk 待确认 | derive-elder-profile.ts:804 capabilityClueSources、:847 deriveCapabilities；core.ts buildRequirementSpecs | 前者可因专区需求被老人侧阻断；直接选专区后 readiness 可 ready，但仍要检查机构走失支持和专区能力 | 不把走失自动等于认知症诊断；在保留全部风险及已知冲突排除下给合规初步参考 | P0 |
| R04 | 没有上述风险也看不到真实目录推荐 | 已证明：11 家目录通过 Catalog；本轮无风险完整合成问卷得到 11 个 UNVERIFIED | modes/production/unknown-record.ts:16；recommendation/core.ts:198 buildRequirementSpecs、:327 hardOutcome；v2/core-v2.ts:360 tierFor | 仅独立生活等级接收这一必要能力未知也足以挡住默认卡，不是目录为空 | 有真实普通参考依据者可进入新类别，不能升级为已核实支持 | P0 |
| R05 | 无法表达“仅有初步参考” | 已证明：现有 public result 只有 EXACT/SOFT_NEAR/CONDITIONAL/UNVERIFIED/INELIGIBLE；卡构造及 VM 再次拒绝 blocked | v2/core-v2.ts:762 deriveRecommendationSemanticsV2；pages/recommendation/result-v2-view-model.ts:386 deriveCards、:406 stateFor | 新类别/独立空态不存在，不能只改 WXML 显示 candidateEvaluations | 新版本 result/reference 契约、类型和 UI 状态；保留旧 V2 语义 | P0 |
| R06 | 其他完整回答也可能没有推荐 | 已证明：夜间线索、特殊进食、导尿/造瘘、压疮、失禁、ADL/认知/咀嚼/康复 unknown 及交叉矛盾 | derive-elder-profile.ts；v2/semantic-core-v2.ts；profile.ts:647 | required classification / hard-filter 澄清或未知事实造成阻断；特殊进食/造瘘存在额外 ADL 不能分级的问题 | 对每类风险定义初步参考允许范围；不能笼统取消 Hard Filter | P1 |
| R07 | 明确不支持关键护理的机构必须排除 | 已证明：required + effective unsupported → conflict → INELIGIBLE，优先于 conditional/unknown/soft-fit；blocked 时仍保留可计算的 conflict | recommendation/core.ts:327 hardOutcome、:369 evaluateFrozenSafetyCore；v2/core-v2.ts:360 tierFor | 不进默认卡；不会被价格/区域/房型补偿 | 任何新参考分支都不能捞回明确关键冲突机构 | P0 |
| R08 | 一条坏机构可能使整个结果报资料错误 | 已证明：版本/证据/指针/重复身份/来源等错误是全池失败；能力 unknown 本身合法 | services/institution-catalog-v1-2-1.ts:95 validateInstitutionCatalogPayloadV121、:249 附近投影；v2/institution-v2.ts:168 | malformed 记录不是“排除后继续”；非 published 则 manifest excluded | 保留校验与明确错误。没有证据需要放宽 unknown 校验；未来容错须新定义来源隔离 | P1 |
| H01 | 普通结果页没有正式保存 | 已证明：普通构建保存描述器固定 null；controller 在身份/网络前关闭 | services/recommendation-save-build.ts:13；recommendation-result-save.ts currentBuild / activate | WXML 有 TEST_ONLY 按钮代码，但普通 Demo/Production 不显示；看结果不保存 | 显式“保存本次评估”才启动正式链路，回执后才标已保存 | P0 |
| H02 | 我的评估不能查询正式跨设备记录 | 已证明：history client 只接受 develop、TEST_ONLY source 和严格 metadata；A 无服务端 | services/completed-assessment-history.ts:33 createCompletedAssessmentHistoryClientV1；c5-authenticated-backend-session.ts:152 resolveC5BackendOriginV1 | 未配置时 UNAVAILABLE，不是成功空列表；trial/release 不走此开发 origin | 可信正式会话、服务器 owner+elder 查询、同账号跨设备读取 | P0 |
| H03 | 老人授权不是“填了父亲/母亲”即可 | 已证明：A 老人列表仍是骨架；B 后端要求真实 principal 的唯一负责老人绑定，未绑定拒绝；没有在保存时偷偷建绑定 | pages/elder/index.ts；B HistoryService.java:87 owner；ElderRecordRepository.findByResponsibleUserId(Connection,…) | 合成会话可测；A 未接正式建立/确认绑定的用户闭环 | 先完成最小合法绑定/授权，再正式保存；不要求多老人、不把手机号当身份 | P0 |
| H04 | 不能直接启用旧后端变正式历史 | 已证明：isolation 同时要求 test profile、disposable MySQL、非 production、c5.auth.enabled=false；capture 只接 Mock dataset | B config/AssessmentHistoryConfiguration.java:20 附近；A domain/assessment-history/recommendation-display.ts:12 | 开真实 C5 或 Production 会关闭；TEST_ONLY source/table/bridge 编码贯穿链路 | 新正式契约、正式来源/配置/表与部署边界的选择性适配 | P0 |
| H05 | 用户看到的匿名结果未必等于旧 History 保存的结果 | 已证明：普通旧保存按保存时服务器 Catalog/时间派生；确认文案明确“不代表与当前匿名预览完全相同” | completed-assessment-user-loop.ts:217 requestSaveConfirmation；B HistoryService.java:309 create | 测试 trusted preview 另做受控展示绑定；匿名上方预览不是保存对象 | 明确“本次结果”的答案、来源 revision、规则、时间和展示绑定，变化需重新展示/确认 | P0 |
| H06 | 旧“获取核验结果”会先存完整合成问卷 | 已证明：createTrustedPreview 在正式完成历史之前 insertTrustedPreview，V7 表有 assessment_answers/profile_display/recommendation_display；只允许批准向量 | A completed-assessment-user-loop.ts:184；B HistoryService.java:120；db/assessment-history-test-only/V7…sql | 尚未完成历史不等于未写数据库；这是显式 TEST_ONLY 合成测试，不是匿名自动正式保存 | 不把此机制直接开放真实匿名问卷；正式写入边界与授权须在手动保存流程中定义 | P0 |
| H07 | 重进后不能随意重试新保存或开始新评估 | 已证明：冷启动只核对原意图；恢复标识缺失/损坏或无法证明答案未改会保守阻断；同 draftContext 修改不会自动创建新版 | completed-assessment-user-loop.ts:254 lifecycle、:312 save；history-save-recovery.ts；history-assessment-session.ts | 避免重复记录，但可能停留 RECOVERY_REQUIRED/SAVED_WITH_LOCAL_CHANGES | 规定原请求幂等、修改后另存与新评估的用户动作；安全恢复，保留草稿 | P1 |
| H08 | Demo 我的评估看起来完整但不是正式历史 | 已证明：自动载入预设合成记录 + 手动 saveDemoReassessment 仅向模块内数组追加 | modes/demo/session.ts:52 resetDemo、:100 loadDemo、:110 saveDemoReassessment；record-pages.ts:13 | 可打开合成当次结果；重启/重置清空；无真实身份或跨设备能力 | 保持 TEST ONLY 和内存隔离，正式历史另接服务端 | P0 |
| H09 | 历史卡不会更新为当前机构详情，但也未接当前资料入口 | 已证明：历史展示使用存储的 display 和 exact revision；纯 viewer 不导入当前 Catalog/engine；无 current detail action | domain/assessment-history/recommendation-view.ts:77；pages/assessment/history-user-loop.ts:177 附近 | 已有“当次/当时”提示和只读快照，不用当前机构补算；新参考类别/风险字段不在旧 display 中 | 继续历史不可变；若加“当前资料”入口，单独标识当前版本，不能覆盖历史卡 | P1 |
| T01 | 老 VR 导航 Gate 失败 | 已复现：NAV-019 正则仍要求 !canOpenVr 阻止导航，与当前资料状态页入口不同 | scripts/check-institution-navigation-a0-4-interactions.mjs:758；pages/institution/detail.ts:394、detail.wxml:30；institution/vr.ts | 允许去 VR 状态页，resource resolver 仍拒绝未知/过期/错版本资源；专项 VR runtime PASS | 后续按已存在状态页交互修订断言，同时保留资源校验；本轮不改测试 | P2 |
| T02 | 同一 Gate 还存在首页 harness 错误 | 已复现：NAV-024 调用生命周期时测试实例未挂载 syncBrowseFont；真实 Component.methods 有该方法 | pages/home/index.ts:115、:132、:140；同导航脚本 Home harness | TypeError: this.syncBrowseFont is not a function；不是已证明的真实首页故障 | 以后补足真实实例方法和导航验证；不得在本轮改测试或声称全绿 | P2 |

表内 R/H 路径未写 B 前缀的均相对 A。B 专用 Java 路径统一位于 server/src/main/java/com/wuhan/eldercare/visit/；SQL 位于 server/src/main/resources/。

未证实的运行问题单列：实际微信真机的返回栈、触摸重复点击、设备账号切换及跨设备正式历史均为待实测，不能因 harness PASS 推断不存在问题。

## 3. 推荐阻断与初步参考适配方案

### 3.1 真实阻断链路

当前链路：

完整合法 AssessmentDraftV2 → Profile Preview V2 → readiness → 完整机构池的 frozen Safety Core → tier/rank → 最多三卡 → result VM → WXML。

必须区分：

1. 老人侧 blocked：不是问卷未完成，也不是机构未知。buildReadiness 汇总未知派生事实、ADL 不能分级与 required clarification；buildReadinessV2 再加入营养澄清。v2/core-v2.ts:770 将两类可展示数组置空；VM:393 再防止诊断候选泄露为卡。
2. 机构侧 UNVERIFIED：老人 ready，但必需能力有效状态 unknown，不能作为安全匹配。原始 unknown、未核验支持、过期证据等均可能形成 effective unknown，但来源状态必须保留。
3. INELIGIBLE：已知关键需求与有效 unsupported 冲突；不能拿软偏好补偿。
4. CONDITIONAL：机构该关键能力的当前核验证据明确为 requires_assessment；不是资料缺失，也不是新“初步参考”的别名。
5. NO_EXACT_MATCH：是成功业务结果，不等于技术失败、不等于 Catalog 没有机构，也不应成为保存拒绝条件。

行为风险的细节也不能漏掉：agitation/aggression 是直接报告行为风险，可派生 known present，不能据此说“所有情绪风险都在同一 gate”。现有 frozen Safety 模型没有通用“行为风险接收能力”这一新字段；同样 nutrition 的 food support 在 V2 是 rank-neutral/Exact-neutral 展示。若 V1.3 将这些纳入新的关键冲突矩阵，须明确数据证据与版本，不得凭名称或文案臆造冲突或支持。

其他阻断包括：认知答案与健康诊断矛盾、ADL unknown、特殊进食/导尿的非序数答案、夜间照护线索、压疮/失禁护理需求、营养 unknown。健康康复 definite/possible 单独带来的特定康复线索有现成 soft exception，不能把所有康复线索都列为必然阻断；rehabilitationNeed=unknown 则仍阻断。

当前没有完成行为/吞咽的独立澄清工作流；“修改原答案”不等于“核实风险”，不能要求用户删掉真实风险来获得卡片。

### 3.2 本轮源码运行观测

以完全合成的 makeAssessmentDraftV2 为输入，固定 evaluationAsOf=2026-10-26T04:00:00.000Z，使用 A 当前 Production 源码构造的 11 条记录。未读取任何真实用户草稿；这里只统计结果和阻断字段。

| 场景 | 问卷完整合法 | readiness | 阻断字段 / 结果 |
|---|---|---|---|
| 无风险控制组 | 是 | ready | 11 个 UNVERIFIED；无卡 |
| mood_instability | 是 | blocked | cognition.behavioralRisk |
| occasional_difficulty | 是 | blocked | nutrition.swallowingConcern |
| wandering_risk，特殊护理选 none | 是 | blocked | dementia_unit 需求待确认 |
| wandering_risk + 直接选 dementia_unit | 是 | ready | 仍 11 个 UNVERIFIED；还要核实真实机构能力 |
| gets_lost | 是 | blocked | wanderingRisk + dementia_unit |
| 情绪 + 走失 + significant_difficulty | 是 | blocked | behavioralRisk + dementia_unit + swallowingConcern |
| sleep_wake_disorder | 是 | blocked | night_care |
| special_feeding | 是 | blocked | adl.careLevel + special_feeding_review + tube_feeding |
| catheter_or_stoma | 是 | blocked | adl.careLevel + catheter_or_stoma_review + catheter_care |
| pressure_injury | 是 | blocked | pressure_injury_care |
| frequent_incontinence | 是 | blocked | incontinence_care |
| rehabilitationNeed=unknown | 是 | blocked | health.rehabilitationNeed |
| rehabilitationNeed=possible | 是 | ready | 特定康复 soft exception 保留；仍 11 个 UNVERIFIED |
| chewingAbility=unknown | 是 | blocked | nutrition.foodTextureSupport |
| cognitive.symptoms=unknown | 是 | blocked | 五项 cognition 派生事实 |

以上全部 Production 场景 cards=0、conditionalCandidates=0。另用现有八条 Mock 开发目录作合成控制组，同一无风险草稿得到 ready_soft_near、3 卡。说明推荐管线可运行；真实目录证据不足和老人侧冻结规则是不同原因。

### 3.3 Catalog 是否“校验过严”

结论：没有发现“因为能力 unknown 就整条拒绝合法机构”的当前代码或运行证据。

11 条 Production 记录在 V1.2.1 校验、V1.1 投影及 V2 池中均可被处理。真正挡住卡的是 required capability unresolved → UNVERIFIED；非 published 记录另按 manifest 的 RECORD_NOT_PUBLISHED 排除。

全 Catalog 对坏记录 fail-closed 是已存在的真实边界，但本轮数据未触发。不要以新参考为由移除证据闭包、版本、来源、行政区、重复身份或 currentPointer 校验。构建时来源不足的身份/地址条目跳过与推荐时能力未知是两个不同环节。

### 3.4 建议保持不变的判断

- 原始答案、风险 evidence、clarification、known/unknown/needs_confirmation 不覆盖、不降级、不伪造“已核实”。
- 旧 V2 的 readiness、Safety、Exact、tier、PriorityFitVector、Rank Tuple、NO_EXACT_MATCH 全部保持原语义，继续按旧版本解释历史。
- known critical conflict 永远排除新个性化参考；病情/照护线索不能被预算、区域、媒体或公共简介抵消。
- 机构 unknown、unavailable、unverified、expired、unsupported 各自来源语义保留；不能统称“不提供”。
- 正式/Mock/独立 Demo 来源隔离；身份去重和精确 revision 关联保留。
- AI、Consultant、VisitEvaluation、运营状态不进入 V2 排序或伪造护理证据。普通目录仍是普通目录。

### 3.5 需要版本化新增的能力

建议新增独立“初步参考”结果分支及其规则版本；名称、字段名和具体版本号均待正式定稿，本报告不冻结。

它应独立记录：

- 参考来源 kind/版本、institutionId + recordRevision、datasetVersion/mode、evaluationAsOf。
- 来自合法当前机构记录的明确参考依据，附字段值及来源状态/证据引用；不能只有“这个机构在目录里”就宣称个性化适合。
- 保留老人原始风险关联与 unresolved requirements；已知冲突排除结论及可追溯依据。
- unknown 能力清单、风险提示、机构待核实事项、参考展示顺序。
- 独立 referenceEligibility / referenceReasons / referenceWarnings；不把 UNVERIFIED 改名后直接投放、不改为 SOFT_NEAR。

先运行和保留旧 V2 评估作为核实型判断；新分支只在新授权范围内从合法输入形成参考资格。不能在 result VM 中直接把完整 candidateEvaluations 当备选卡：其中含 INELIGIBLE、null tier、未满足依据门槛的记录。

如果保留 V2 Profile 派生不变，可由显式的消费后继契约界定“这些澄清仍阻断旧核实型匹配，但新参考允许在风险明示下评估”，不用先把真实风险改成 ready。若要改变 clarification.priority 或其派生事实，则必须另发 ElderProfile ruleset successor，并同步 Formal/Preview；禁止只改 buildReadinessV2 绕过 canonical 校验。

“真实、明确的普通参考依据”尚缺可执行门槛：哪些 current verified 地域/机构类型等事实足以入选、缺失时如何处理、老人等级未知时哪些情况还能参考，以及哪些照护要求被新规则定义为关键，均需写入后继规则。这里缺的是四项既定决策的机器化细节，不是要求 Owner 重新选择产品方向。

### 3.6 状态、最多三家、排序与去重

建议默认选择顺序：现有 EXACT → SOFT_NEAR → 单独 CONDITIONAL → 新初步参考类别。有较高可展示组时不使用更低类别补足三家，保留现有“不一定三家”的原则。CONDITIONAL 继续标“机构需进一步评估”，不得误称已完全核实支持。

- 核实型结果的排序完全复用现有 tuple/comparator；不得往 V2 tuple 塞新 reference 权重。
- 初步参考单独定义确定性排序；只允许使用批准的有证据字段，固定规则版本、显式时间，同分用 ASCII institutionId；不能按数组、中文显示名或随机数排序。
- 入选前以 institutionId 去重，currentPointer 确定唯一 revision，展示 key 用 institutionId + recordRevision。
- 全部个性化展示的机构总数最多三家；nearMatches 与主卡重复引用应合并呈现，不能复制成第 4–6 家。
- 当前 V2 的 duplicate institution 输入是错误，不能擅自在旧 engine 静默去重；新 composition 负责其自有多分支的去重。

新结果状态至少区分：有核实型候选、有条件候选、仅初步参考、无个性化候选、资料/服务技术错误。具体 stable code 待定。

只有初步参考时，建议用户表达为“暂无可核实匹配；有 N 家初步参考，关键护理条件仍待机构确认”，并醒目列未知能力和风险。当前结果页已有普通目录入口和“未确认不代表不提供”，并未简单宣称全市没有机构；V1.3 仍需新增独立类别和计数，不能只替换“没有机构”一句话。

没有个性化候选时，说明是已知冲突、普通参考依据不足、老人信息不足还是资料不可用。普通目录入口可继续使用，但不把其全部列表称为推荐。无候选完整评估仍可手动保存。

## 4. 正式历史实施差异

### 4.1 分层能力与缺口

| 分组 | A 已具备 | B 独有 / 仅 TEST_ONLY | V1.3 正式缺口 |
|---|---|---|---|
| 前端结果 | 本地匿名 Profile/Recommendation V2 Preview；展示不自动登录/保存；普通构建 save gate 关闭 | 受控 trusted preview + 私有确认 token 的 UI/服务实现也已导出到 A，但普通包关闭 | 正式显式入口、未保存/保存中/已保存/失败待核对状态；明确保存的是哪次结果 |
| 身份 | C5 transport/client 代码存在，但 origin 仅 develop 开放 | B 有 C5 server 设施；History 隔离配置要求真实 C5 关闭 | 正式域名/会话和真实 principal 接通；不能由 route/storage 的 userId 冒充 |
| 老人授权 | 有唯一负责用户的 Frozen Contract；老人列表仍是骨架 | B ElderRecordRepository、事务范围绑定查找及 History owner 复核 | 正式建立/确认/读取唯一绑定的完整路径；未绑定、错账号、撤销等失败状态 |
| 保存接口 | requestSaveConfirmation / saveCurrent / recovery 的前端代码 | HistoryController + HistoryService + HistoryValidator + HistoryRepository | 版本化正式 API/来源标识、部署与依赖；非 TEST_ONLY 来源严格分发 |
| 数据库 | A 不含数据库实现 | B 的隔离 V1–V7 表/约束/触发器/快照/意图/会话/展示绑定 | 正式数据库方案、迁移、权限、敏感数据生命周期、备份恢复；本轮未建表 |
| 不可变快照 | capture/view 结构和版本守卫 | 原始 CompletedAssessment、profile display、recommendation display 原子写入，SQL 禁止历史 update/delete | 新参考类别、原始风险及版本信息、正式机构来源/精确 revision 的不可变快照；旧 display reader 兼容 |
| 查询 | history client + 分页/迟到响应隔离；UNAVAILABLE 与 EMPTY 区分 | owner+elder 范围下列表、详情、推荐专用 endpoint | 正式跨设备列表/详情、当前账号权限验证、正式 metadata 和 source；独立于本地恢复标识 |
| 历史展示 | 只读 viewer、当次时间/规则/机构 revision，错误/版本不可解释可降级 | 合成历史可读取且不重算 | 正式卡、初步参考警示；若提供当前资料，必须显式离开历史上下文 |
| 幂等与重试 | 单页 pending、全局操作锁、scope/session/intent 和回执校验 | server unique(owner,key)、digest、事务、相同请求 replay、异载荷 conflict | 用真实授权和正式存储验证；修改后另存、新评估、冷启动恢复的产品规则仍需适配 |
| 测试 | 源码 runtime、Mock Provider、隔离 guard/产物测试 | 无数据库桥接测试可跑；另有 SQL/HTTP/E2E 测试代码 | 正式来源 + 真实身份/合法老人 + 数据库 + 跨设备闭环，无候选和新参考快照回归 |

### 4.2 旧主工程可复用的具体部分

B 的 server/src/main/java/com/wuhan/eldercare/visit/assessment/：

- HistoryService.owner：用事务内 trusted principal 解析唯一绑定，保存前/提交事务内再次验证。
- HistoryService.create：完整 schema/答案校验；服务器生成完成 ID/时间；相同 owner/key + digest 返回原记录，载荷不同冲突；快照创建与关联失败整体回滚。
- HistoryRepository：owner+elder+id 查询、稳定 keyset 分页、意图/会话关联、唯一键和事务，未知/外部 cursor 不泄露其他记录。
- HistoryValidator 与 server/tools/：调用同一 TypeScript 校验/派生代码；避免 Java 重抄问卷规则。
- V1–V3 SQL：不可变评估、画像展示、推荐展示；V4–V7：恢复意图、评估会话、context claim 和 trusted binding。只能作为正式结构设计参考，不能把 test-only migrations 放进正式链而不评估。
- HistoryMySqlIntegrationTest、HistoryTrustedPreviewMySqlIntegrationTest、HistorySecurityGateTest、HistoryBridgeIsolationTest：可迁移对应测试思想和夹具，保留真实数据库与纯单测的证据区分。

对 17 个前端/类型/领域/相关脚本文件进行 CRLF→LF 规范化比较，结果全部文本一致，包括 History client、user-loop、save controller/build gate、trusted preview、C5 client、history capture/view、assessment-v2、core-v2、semantic-core-v2、history page/helper 及三项历史测试脚本。因此不存在“B 的前端历史完全没到 A”的结论；主要缺的是后端与正式能力适配。字节比较的差异主要是换行，不能误报成业务差异。

即使同源，B 的测试也不能替代 A 的集成：A 的 Production 目录、Demo composition、当前 UI 改动和无 server 结构不同。

### 4.3 不能直接复用为正式能力的边界

1. AssessmentHistoryConfiguration 明确反向隔离真实环境；真实身份与正式持久化支持不是“改开关”。
2. Metadata source 是 COMPLETED_ASSESSMENT_HISTORY_TEST_ONLY_V1；前端 exact-keys/source 校验会拒绝另一个正式来源。需要新增明确版本/来源，不得删验证。
3. captureHistoricalRecommendationV1 只接 MOCK_DEVELOPMENT_ONLY；validHistoricalRecommendationV1 也限制 Mock 来源和旧 V2 版本。直接送 Production 记录不能成立。
4. createTrustedPreview 只接受 server 批准的完整合成向量，并在 /trusted-previews 写入测试库。正式真实问卷不能直接沿用该 admission/存储策略。
5. 普通匿名 Preview 当前是临时对象，不能直接序列化当 CompletedAssessment。保存必须建立真实 identity/elder authority，且满足当次展示与正式快照的一致性。
6. 现有历史 Profile display 只有六行，Recommendation display 保留结果/原因/差异/机构展示，不是完整 ElderProfile 语义快照，也没有新参考风险字段。原问卷虽在 CompletedAssessment 保存，但 V1.3 展示不能依赖读时用新规则重新派生风险。
7. old snapshot 缺失/unsupported 时已经返回 unavailable/unsupported_version，不能自动回填当前机构、当前规则或当前问卷。

### 4.4 手动保存目标流程建议

流程仍严格遵守 Owner 方案 A：

评估完成 → 本地查看初步结果（未保存）→ 明确点击保存 → 身份/老人授权/必要同意与完整性校验 → 固定当次答案及结果来源 → 正式持久化 → 有效回执 → 已保存 + 可到我的评估 → 服务器列表 → 当次只读详情。

- 页面 onShow、预算 Next、Profile/Result 导航、普通目录浏览，不创建正式评估、保存意图或服务器健康快照。
- 保存所需的认证/核验请求只能在明确动作和相应授权后发生；不得新增匿名 Preview 自动持久化分支。
- 如果保存时必须由服务器重算，应校验展示绑定的规则/数据 revision/结果摘要，变化时先重新展示并重新确认，不能把不同结果静默保存为“你刚才看到的本次结果”。
- 服务器仍生成正式 assessmentId/completedAt。evaluationAsOf 与 completedAt 分开，客户端预览时间不冒充服务器完成时间。
- 无候选、老人待澄清、NO_EXACT_MATCH 均是可保存的完整业务结果；技术失败与不完整问卷另行反馈。
- 相同保存操作复用同一服务器幂等关联；重复按钮只发一次有效完成操作。失败/丢回执先查询原结果，不能自动换 key 重建。
- 已保存后编辑形成的未保存变化必须清晰可见；同会话另存与开始新评估的具体转换写入正式规则，不覆盖原记录。
- 切账号/老人/环境后隐藏旧响应；不要删除用户草稿来“解除”恢复阻断。
- 同账号跨设备历史从服务端权限范围查询；本地恢复标识只是关联元数据，不是身份凭证，也不是查询所有历史的前提。

### 4.5 交互路径的当前判断

- Budget.onNext（budget.ts:256）先校验本页、全问卷和本地持久化，再 reLaunch Profile；无服务端保存。合法问卷可进入画像，即使带风险。
- Profile VM.actions.canOpenRecommendation=true；profile.wxml:133 有真实按钮，profile.ts:268 有页面/栈/guard 校验。风险不会在按钮层禁用进入结果；阻断发生在结果内容。
- Result.refreshRecommendation（result.ts:248）按一次时间构造匿名快照；onHide/onUnload 清旧 source context/save proof；返回/重进会重新构建当前 Preview，不能把它当历史。
- result-v2-view-model.ts 已区分 ELDER_READINESS_BLOCKED 与 NO_SAFE_RECOMMENDATION，并提供具体文案；result.wxml 保留普通目录入口。本轮无证据表明它把 11 家真实机构误说成“目录里零机构”。
- 真实历史页只有 TEST_ONLY capability 通过才显示 user-loop 保存和可点击详情。只看 history-view-model.ts 中 resultDisabled=true 不能断言所有详情永久禁用：WXML 对 userLoopEnabled 有单独可点击分支。
- 历史详情/推荐是在原页内切换 subview，generation 过滤迟到结果；返回列表恢复原滚动位置。Demo 则由 record-pages.ts 在会话数组中按 assessmentId 找快照。
- 现有历史推荐卡只读，无当前机构链接；若 V1.3 加链接，应标“查看当前机构资料”，使用独立当前解析，不以 current/latest 补写当时的字段。
- 本轮未取得微信触控或真机导航证据；以上是当前源码和指定 harness 的结论。

## 5. 后续最小修改范围与依赖顺序

这是实施建议清单，本轮全部 NOT_IMPLEMENTED。

| 顺序 | 可能涉及的文件 / 模块 | 原因 | 依赖与主要回归风险 |
|---|---|---|---|
| 1 | docs/product/README.md 所指向的有效产品资料；Recommendation/规则/Result UI 消费后继；正式 History 契约 | 明确新参考门槛/冲突矩阵/展示层级、手动保存边界、快照/权限/跨设备、重复保存语义 | 先定稿再实施；保留所有 Frozen V1/V2 原文 |
| 2 | 拟新增 miniprogram/domain/initial-reference/ 与独立 types；新的 result composition/version dispatcher | 独立 referenceEligibility、evidence、风险/未知能力、稳定排序/去重 | 不能改旧 V2 tier 枚举冒充兼容；不能绕过 known conflict |
| 3 | services/recommendation-preview-v2.ts、recommendation-result-application.ts、types/recommendation-result-v2.ts 的后继入口或版本化扩展 | 组合核实型结果与新参考，保持同源机构 revision、显式时间 | 旧入口和旧 snapshots 不变；display join/来源/版本仍需原子校验 |
| 4 | pages/recommendation/result-v2-view-model.ts、result.ts、result.wxml；assessment/profile-v2-view-model.ts、profile.wxml 按新规则必要调整 | 初步参考独立分区/状态、清晰风险与核实事项、正式手动保存动作 | 保留未提交字体/层级优化；禁止只在 UI 强行显示 UNVERIFIED |
| 5 | services/recommendation-save-build.ts、recommendation-result-save.ts、completed-assessment-user-loop.ts 的正式适配；c5-authenticated-backend-session.ts 的正式传输边界 | 从测试 gate 迁移到独立正式 API/会话；绑定当次结果、回执、幂等和恢复 | 真实身份/隐私影响高；不能删除 TEST_ONLY guard 或直接用 dev storage origin 开 Production |
| 6 | pages/elder/*、正式绑定 service；B 中 auth/elder backend 的选择性适配 | 单老人授权闭环 | 保存评估不隐式把关系答案变成授权；不得带入 Appointment 的机构预约资格门槛 |
| 7 | 拟在选定正式后端集成 HistoryController/Service/Repository/Validator 对应能力；新生产 migration/配置/可信 Catalog provider | 服务端保存/查询/不可变快照、正式来源、事务及权限 | 先固定后端归属/部署结构；桥接 Node/runtime/catalog 打包不能遗漏；不整体复制 B 或 test-only SQL |
| 8 | domain/assessment-history/recommendation-display.ts、recommendation-view.ts、types/completed-assessment-history.ts、history-view-model.ts、history.ts、history-user-loop.ts、history.wxml 的新版本 | 支持 Production、初步参考与原风险；旧 display 继续可读；当前/当时分离 | exact-keys guard 会拒绝新字段，应显式版本分发而非放宽旧验证 |
| 9 | 对应 fixture/runtime；未来 History SQL/HTTP/跨设备 E2E；必要 Demo composition 适配 | 验证第 6 节矩阵 | 保留 Demo guards、内存历史与 source 标签；不能让新后端动作通过共享页面漏进 Demo |
| 10 | scripts/check-institution-navigation-a0-4-interactions.mjs 及直接相关测试 | 正常维护 VR 状态页/Component harness | 本轮未改；保留真实资源拒绝/导航失败重试断言，不能删失败用例制造 PASS |

问卷 registry 和六步题目无需因本次目标重设计。若仅新增参考消费而不更改 Profile 派生，不应先重写整个 semantic-core。若新规则确需改变 Profile priority/关键事实语义，先安排对应 successor，再改派生和 Formal/Preview parity 测试。

B1.2.6 适合作为 V1.3 的前端与双模式起点；不适合作为“后端齐备、可直接开工”的全栈基线。实施应保留 A 当前 UI 改动，逐模块适配 B 的缺失能力。后续代码实施评审前，需明确正式后端放置/集成方式及生产数据源责任，不能把这两个基础问题留给一个布尔开关。

## 6. 验证结果与测试矩阵

### 6.1 本轮执行范围

所有测试先检查输出行为：

- 常规源码 runtime 在 VM 中转译/加载 TypeScript 4.1.2，不生成业务 JS。
- check:capability-evidence 只创建系统临时目录 eldercare-cap-evidence-*，复制合成测试所需输入，finally 校验路径后清除；未使用 --with-build。
- check:run-mode-convergence 读取已有 dist，模拟微信 API，未重建或覆盖产物。
- B 的三项桥接/快照/trusted-preview 单测没有带 --http、--prepare-source、--visual-fixture；未写数据库或源码。
- 本轮附加探针通过 PowerShell here-string → Node stdin 执行，只在内存加载/转译当前源码；Production 模式相对导入按构建目录布局映射，注入同一个当前行政区 resolver。无磁盘脚本、真实草稿、网络或机构联系。
- 本轮未执行 build:demo / build:production，因脚本会写入既有 dist 输出；针对源码的转译/类型相关检查由下列相关 runtime 执行。没有将这些检查称为 DevTools 编译或人工真机。

### 6.2 已执行的命令及结果

除明确标 B 外，工作目录均为 A。

| 命令 | 结果 | 能证明的范围 |
|---|---|---|
| npm run check:assessment-v2-runtime | PASS：44 cases | 题目 registry、完整性、互斥/条件、版本迁移与本地持久化失败 |
| npm run check:elder-profile-v2-runtime | PASS：18 fixtures、5 parity、22 ADL parity、10 boundary | 派生、Formal/Preview 和原 ADL 规则一致 |
| npm run check:recommendation-v2-runtime | PASS：68 fixtures、6 parity、95 ancillary；稳定性/不可变性 PASS | frozen Safety/tier/rank、unknown/已知冲突、池置换/排序 |
| npm run check:recommendation-preview-v2-integration-runtime | PASS：20 cases；storage writes=0 | 完整池、一次来源/时间、错误/重复身份/来源、Preview 无写入 |
| node scripts/check-recommendation-result-v2-ui-runtime.mjs | PASS：18 snapshot + 30 UI | 同源 display、blocked/Conditional/无候选、MAX_3、unknown 展示 |
| npm run check:profile-result-v2-interactions | PASS：10 checks | 源码动作绑定、导航/匿名边界；不是物理触摸 |
| npm run check:profile-clarification-guidance | PASS | 七类能力线索的编辑路径、澄清保留及重试 |
| npm run check:completed-assessment-history-provider | PASS | 严格来源、身份/权限/未配置状态、分页及迟到响应；Mock transport |
| npm run check:assessment-history-presentation | PASS | UNAVAILABLE/EMPTY/ERROR/列表、单向动作、定向 TS；无设备声明 |
| node scripts/check-recommendation-result-save-runtime.mjs | PASS：32 cases + structural assertions | 普通包关闭、显式核验、伪造 flag 拒绝、切账号/环境及旧回执不可冒充当前已保存；非真实写入 |
| npm run check:production-directory-data | PASS | 10 条新增目录 + 既有首条的数据构造基础；官方来源元数据/区划/去重，不是本轮在线重新核实机构事实 |
| npm run check:capability-evidence | PASS | 合成 supported/conditional/unsupported、证据过期、revision 不变、MAX_3/排序；真实研究仍是待核实队列 |
| npm run check:run-mode-convergence | PASS（已有 dist） | Demo load/reset/reload、12 家详情/合成历史/评价、阻断真实网络/存储/API；Production 排除 Demo |
| npm run check:institution-vr-runtime | PASS | exact revision/验证/HTTPS/未知资源不打开 viewer；真实 handler 的状态页导航及失败重试 |
| npm run check:institution-navigation-a0-4-interactions | FAIL：23/25；NAV-019、NAV-024 | 保留既有失败；原因见 §6.3 |
| B：npm run check:completed-assessment-history-validator | PASS：15 vectors | Node 后端桥接复用同一 Assessment 校验；非 Java/HTTP/MySQL |
| B：npm run check:completed-assessment-recommendation-runtime | PASS | Formal capture、原顺序/版本/来源、合法 no-safe、Production 输入拒绝、Draft/Catalog 变化不改展示 |
| B：node scripts/check-trusted-assessment-preview.mjs | PASS：8 unit scenarios | 受控合成展示/绑定/取消/篡改/过期；无 --http，不是真实服务端 E2E |

合计 18 组既有测试命令：17 PASS、1 FAIL。另执行 §3.2 的源码观测探针，16 个 Production 场景均成功构造业务结果，外加一个 Mock 控制组；这不表示未实现的 V1.3 目标已通过。

### 6.3 VR 与新增发现的测试差异

NAV-019 仍失败，但其“unknown VR 不得产生任何路由”的预期不再对应当前界面。detail.wxml:30 已区分“打开机构全景”和“查看全景资料状态”；detail.ts:394 允许进入带 exact identity 的 /pages/institution/vr；vr.ts:25 loadResource 用 resolver，没有资源时 url=''，显示“当前没有可用的已核验全景资料”。

专项 check:institution-vr-runtime 明确覆盖 canOpenVr=false 时仍进入同一路由，同时严格拒绝 wrong revision、Mock、historical context、未核验、过期、非 HTTPS 资源。因此 NAV-019 属于旧导航断言与当前状态页交互的差异，不能据其失败声称未知资源被伪造成可看全景，也不能抹掉该 FAIL。

NAV-024 是额外复现的失败。实际首页 Component.methods.syncBrowseFont 存在，而旧 Home harness 组装的对象没有该方法，生命周期调用时报 TypeError。当前证据支持测试实例滞后；真实首页是否在所有设备可正常返回仍未实测。未修改测试，也没有以其他 PASS 抵消这两个失败。

### 6.4 V1.3 必需测试矩阵

“当前证据”与“V1.3 验收”分开：新类别/正式历史尚未实现，不能把现有保守行为 PASS 当作新功能 PASS。

| ID | 场景 | 当前证据 | V1.3 验收预期 / 后续测试位置 |
|---|---|---|---|
| M01 | 完整问卷 + 情绪风险 | SOURCE_OBSERVED：R01 blocked；frozen runtime PASS | 记录 mood 风险、真实依据满足才给初步参考；新 reference fixture + Result UI；NOT_RUN |
| M02 | 完整问卷 + 吞咽风险 | SOURCE_OBSERVED：R02 blocked | 不改成鼻饲、不丢风险，明确机构核实饮食/吞咽支持；新 reference + snapshot；NOT_RUN |
| M03 | 完整问卷 + 走失风险 | SOURCE_OBSERVED：专区待确认；直接选专区可 ready 但 11 UNVERIFIED | 区分 gets_lost/明确 wandering/专区需求，真实冲突排除；NOT_RUN |
| M04 | 三项风险组合 | SOURCE_OBSERVED：三字段同时保留、无卡 | 所有风险同时提示，不以其中一个覆盖其他；NOT_RUN |
| M05 | 机构关键能力未知 | SOURCE_OBSERVED：11 家合法但 UNVERIFIED | 有批准依据者独立参考、unknown 显示；不能变成 verified；NOT_RUN |
| M06 | 已知关键能力冲突 | frozen/合成 capability runtime PASS | 新分支也排除；blocked + known conflict、unknown + conflict 混合均不可捞回；新 reference fixture；NOT_RUN |
| M07 | 有核实型候选 | V2 fixtures、Result UI PASS | 原候选优先、原 tuple/顺序不变、不以低类补满；新 composition regression；NOT_RUN |
| M08 | 只有初步参考候选 | 当前结构不支持 | 新状态/文案/来源/警示及最多三家；不能显示“没有机构”；NOT_RUN |
| M09 | 无个性化候选 | 现有 Result UI PASS，区分 no-safe/资料错误 | 清楚原因、普通目录仍独立、可手动保存完整结果；新正式闭环；NOT_RUN |
| M10 | 手动保存成功 | save controller/unit PASS（虚拟 build/source） | 点击前零正式写入；完成回执后才已保存；真实 C5+老人+DB+页面；NOT_RUN |
| M11 | 失败、超时、丢回执 | unit/recovery 代码证据；DB E2E 未跑 | 旧意图查询/安全重试，草稿保留，不生成第二条；正式 HTTP/DB；NOT_RUN |
| M12 | 重复点击/并发重复请求 | pending/token unit PASS；旧 server unique/digest 静态存在 | 同请求仅一记录，同 key 不同载荷冲突，切账号不共享回执；正式 DB 并发；NOT_RUN |
| M13 | 无候选完整评估保存 | B capture runtime PASS：合法 no-safe 可形成快照 | Formal save 不以 cards.length/readiness/noExact 为拒绝；新正式 no-candidate HTTP+SQL；NOT_RUN |
| M14 | 历史列表/详情与快照不变 | Provider/presentation/capture runtime PASS | 机构更新、Draft 改变、规则升级后仍读原快照，不读时重算；正式 DB+reader；NOT_RUN |
| M15 | 越权 owner/elder/cursor/detail | Mock Provider + B owner 查询静态证据 | 真实不同 principal、猜 ID/foreign cursor/绑定变化返回安全错误，无他人资料；正式 HTTP；NOT_RUN |
| M16 | 同账号跨设备 | 当前无正式链路 | 两台独立设备/干净本地存储读取同一合法账号历史；不得靠复制本地 marker；NOT_RUN |
| M17 | Demo / Production 隔离 | 已有 dist convergence PASS；源 guard 审查 | 新正式保存不进入 Demo，Demo API/存储阻断仍有效；新构建后重跑 + 真机；NOT_RUN |
| M18 | 稳定排序/最多三家/去重 | frozen permutation/同时间一致/MAX_3 PASS | 同池任意顺序、同机构跨类别、同分、currentPointer 一致；新 reference composition；NOT_RUN |
| M19 | 旧历史兼容/未来版本 | B capture/reader 拒绝不支持版本 PASS | 旧 V1/V2 不迁移、不改写；新 kind/version 独立 reader；未知版本显式 unavailable；NOT_RUN |
| M20 | 保存后编辑/重进/新评估 | lifecycle 代码证明会保守阻断 | 显示原已保存与当前未保存变化；新操作按新规则建独立快照，无自动保存；NOT_RUN |
| M21 | 历史“当时”与“当前资料” | 当前历史只读、无当前链接 | 若提供当前入口，显式新页面/新 revision 标识，不回写历史；NOT_RUN |
| M22 | 返回、导航失败、重复点击 | Profile/Result 结构、VR handler、Provider stale-response 部分 PASS；NAV Gate 仍 FAIL | 新流程真实 DevTools/微信触控/真机回归，并修复测试实例差异后复测；NOT_RUN |

### 6.5 明确未执行

- 新鲜双模式构建、DevTools 编译/操作、ADB/人工微信真机：NOT_RUN。
- B 的 MySQL/JDBC 集成测试、History HTTP E2E、冷启动进程 E2E：NOT_RUN。它们需要明确的隔离数据库/服务启动与可能写入，本轮未配置或执行迁移。
- 正式真实身份、合法绑定、Production Catalog 服务端供给、真实历史保存/跨设备：NOT_RUN / NOT_IMPLEMENTED。
- 当前产品 PDF 全文逐页审查：NOT_AVAILABLE_IN_BASELINE。
- 本轮未上传、发布、联系机构或拨打电话；未查询/输出真实用户健康数据、凭证或本地密钥。

## 7. 产品契约差异与实施前停点

优先处理的文档方向（本轮只建议，不改其他文档）：

1. V1.3 产品规则及结果说明：固定“初步参考”定位、类别门槛、风险/未知能力/明确冲突矩阵，以及核实型优先、最多三家、不混淆普通目录。
2. Recommendation 与 Result UI/Application 消费后继：旧 V2 不变，批准独立参考分支及版本化结构；新类别不能套 EXACT/SOFT_NEAR/CONDITIONAL/UNVERIFIED。
3. ElderProfile/匿名 Preview 消费边界：说明保留原始风险和原 required clarification，在新参考消费中的适用范围。仅在改变派生或 priority 时新增对应 ruleset；避免机械放宽旧 readiness。
4. 正式 CompletedAssessment History 契约：显式手动保存、真实身份与单老人权限、何时可写健康输入、所见/所存绑定、服务端不可变快照、无候选保存、幂等/失败恢复/修改后另存、跨设备列表详情和历史/当前区分。
5. 机构事实/证据消费：普通参考的事实最低要求；若新增原模型没有的关键护理冲突字段，再发相应 Institution successor。公开地址、电话、名称不可替代护理证据。

当前文档冲突/缺口：

- 产品索引仍是 V1.2，且禁止 V1.2 模块改变 V2 Safety；V1.3 目标不能作为静默覆盖旧 frozen 的理由。
- V2 §6 明确吞咽/咀嚼待澄清时不得出卡；§7–8 明确 UNVERIFIED 不进默认卡。V1.3 新参考超出此结果语义，需要 successor，不是实现 bug 修一行。
- 历史 27/21 与现行 32/26 已由 schema 版本解释，属于文档版本识别，不是问卷缺陷。
- History 目前只有 B 的未冻结 TEST_ONLY 提案；它允许的合成 trusted-preview 数据库写入、预览绑定与正式产品保存边界不能混用。
- 旧补充确认 proposal 未激活，不应反向要求用户修改真实风险才能得到 V1.3 初步参考。
- A 缺少索引所指向的产品 PDF；正式产品文档最终一致性不能宣称已验收。

尚需定稿的实施前事项：

- 初步参考的证据门槛、关键冲突矩阵、确定性排序细节。
- 正式后端集成/部署归属、可信 Production Catalog 的服务端版本来源。
- 手动保存动作的敏感输入写入边界、真实老人授权、所见与所存一致性及快照 schema。
- 保存后修改/新评估/未决意图的正式恢复规则。
- 新旧版本 reader 与正式存储的兼容方案，以及相关真实闭环验证安排。

这些不是让 Owner 重选已经确定的四项方向，而是进入代码实施前必须由可审契约表达的细节。可立即进入产品/契约差异评审；尚不具备以“契约已定、可直接实施”为前提的代码实施评审 READY 条件。

## 8. 最终结论

~~~ini
CODEBASE_REVIEW_STATUS = V1_3_CODEBASE_REVIEW_COMPLETE
RECOMMENDATION_BLOCKERS_FOUND = TRUE
OTHER_HIDDEN_BLOCKERS = TRUE
INITIAL_REFERENCE_FEASIBILITY = FEASIBLE_WITH_VERSIONED_REFERENCE_POLICY_AND_EVIDENCE_GATES
FORMAL_HISTORY_GAPS = PRODUCTION_AUTH_ELDER_BINDING_BACKEND_STORAGE_SOURCE_SNAPSHOT_MANUAL_SAVE_CROSS_DEVICE
BASELINE_INTEGRATION_RISKS = DIRTY_UI_EXPORT_WITHOUT_BACKEND_AND_UNTRACKED_TEST_ONLY_SERVER
PRODUCT_DOC_CONFLICTS = V1_2_V2_FROZEN_BOUNDARIES_VS_V1_3_NEW_REFERENCE_AND_FORMAL_HISTORY
TEST_RESULTS = 18_COMMAND_GROUPS_17_PASS_1_FAIL_PLUS_SOURCE_PROBE_COMPLETED
REMAINING_UNCERTAINTIES = REFERENCE_THRESHOLD_CRITICAL_CONFLICT_MATRIX_FORMAL_BACKEND_SEEN_SAVED_PRIVACY_RECOVERY_DEVICE_E2E_PRODUCT_PDFS
READY_FOR_V1_3_CONTRACT_FINALIZATION = FALSE
READY_FOR_CODE_IMPLEMENTATION_REVIEW = FALSE
PRODUCTION_RELEASE_READY = FALSE
NEXT = OWNER_REVIEW_AND_NEXT_AUTHORIZATION
~~~

审查已完成，实施尚未授权。B1.2.6 当前工作区可作为前端起点；应先完成上述契约与正式历史边界的定稿，再按最小范围适配，不直接合并旧主工程，也不通过关闭 Hard Filter 解决问题。

本轮唯一交付新增文件为本报告。原有 40 个修改文件和全部 untracked 成果保留；相关测试完成后对报告以外 2,098 个 Git tracked/untracked 非忽略文件作内容汇总比对，内容与开始时一致、原 Git 状态一致。未重建既有 dist。未 commit、push、rebase、迁移或发布。

## 附录 A：开始时的未提交内容

### A.1 已修改 tracked 文件（40）

~~~text
miniprogram/components/multi-choice/multi-choice.less
miniprogram/components/primary-button/primary-button.less
miniprogram/components/progress-header/progress-header.less
miniprogram/components/question-section/question-section.less
miniprogram/components/single-choice/single-choice.less
miniprogram/pages/appointment/create.ts
miniprogram/pages/appointment/create.wxml
miniprogram/pages/assessment/adl.ts
miniprogram/pages/assessment/adl.wxml
miniprogram/pages/assessment/basic.less
miniprogram/pages/assessment/basic.ts
miniprogram/pages/assessment/basic.wxml
miniprogram/pages/assessment/budget.ts
miniprogram/pages/assessment/budget.wxml
miniprogram/pages/assessment/cognitive.ts
miniprogram/pages/assessment/cognitive.wxml
miniprogram/pages/assessment/health.ts
miniprogram/pages/assessment/health.wxml
miniprogram/pages/assessment/preference.less
miniprogram/pages/assessment/preference.ts
miniprogram/pages/assessment/preference.wxml
miniprogram/pages/assessment/profile.less
miniprogram/pages/assessment/profile.ts
miniprogram/pages/assessment/profile.wxml
miniprogram/pages/institution/index.wxml
miniprogram/pages/recommendation/result.less
miniprogram/pages/recommendation/result.ts
miniprogram/pages/recommendation/result.wxml
miniprogram/pages/service/ai-chat/index.less
miniprogram/pages/service/ai-chat/index.ts
miniprogram/pages/service/ai-chat/index.wxml
miniprogram/styles/assessment-warm-swiss.less
miniprogram/styles/tokens.less
modes/demo/pages/appointment/create.ts
modes/demo/pages/appointment/create.wxml
modes/demo/pages/records.less
modes/demo/pages/records.wxml
modes/demo/record-pages.ts
scripts/check-appointment-create-runtime.mjs
scripts/check-b1-2-5-continuity.mjs
scripts/support/demo-story-composition.mjs
~~~

### A.2 未跟踪条目（目录按 Git 默认折叠显示）

~~~text
docs/design/B1_2_6_DEMO_UPLOAD_AND_DELIVERY.md
docs/design/GLOBAL_UI_UX_AUDIT_V1.md
docs/design/GLOBAL_UI_UX_FIX_BATCH_A_V1.md
docs/design/GLOBAL_UI_UX_FIX_BATCH_B_V1.md
docs/design/GLOBAL_UI_UX_PROFILE_RECOMMENDATION_HIERARCHY_V1.md
docs/design/PROFILE_CLARIFICATION_RESOLUTION_PROPOSAL_V1.md
docs/design/global-ui-ux-audit-v1-evidence/
docs/design/global-ui-ux-fix-batch-a-v1-evidence/
docs/design/global-ui-ux-fix-batch-b-v1-evidence/
docs/design/global-ui-ux-profile-recommendation-hierarchy-v1-evidence/
miniprogram/styles/assessment-readability.less
modes/demo/appointment-time.ts
scripts/check-global-ui-ux-batch-a.mjs
scripts/check-global-ui-ux-batch-b.mjs
scripts/check-profile-recommendation-hierarchy.mjs
~~~

## 附录 B：本轮附加源码探针的可复现命令

在 A 工作目录执行下列 PowerShell。输入来自已有合成 fixture；只输出状态和阻断字段，不读取用户存储。模式源码的相对路径映射只用于这次内存测试，不修改构建配置。它验证当前行为，不是尚未实现的 V1.3 验收脚本。


~~~powershell
@'
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from './node_modules/typescript/lib/typescript.js';
import assert from 'node:assert/strict';
import {makeAssessmentDraftV2} from './scripts/fixtures/elder-profile-v2-fixtures.mjs';
const root=process.cwd(),cache=new Map();
const context=vm.createContext({console,wx:{getStorageSync(){return ''}},Page(){},Component(){}});
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 if(file.endsWith('.json')){module.exports=JSON.parse(fs.readFileSync(file,'utf8'));return module.exports;}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
 const req=(request)=>{let base=path.resolve(path.dirname(file),request);let candidates=[base+'.ts',base+'.json',path.join(base,'index.ts'),base];let f=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(!f&&base.startsWith(path.join(root,'modes')+path.sep)){base=base.replace(path.join(root,'modes')+path.sep,path.join(root,'miniprogram')+path.sep);f=[base+'.ts',base+'.json',path.join(base,'index.ts')].find(p=>fs.existsSync(p));}assert.ok(f,'resolve '+request);return load(f);};
 vm.runInContext('(function(require,module,exports){'+code+'\n})',context,{filename:file})(req,module,module.exports);return module.exports;
}
const m=p=>load('miniprogram/'+p+'.ts');
const resolver=load('modes/production/administrative-divisions.ts').administrativeDivisionResolver;
m('runtime/institution-validation').institutionValidationOptions={administrativeDivisionResolver:resolver};
const catalog=load('modes/production/catalog.ts').readModeCatalog();
const valid=m('services/institution-catalog-v1-2-1').validateInstitutionCatalogPayloadV121(catalog);
assert.equal(valid.ok,true,JSON.stringify(valid.error));
const project=m('domain/institution/v1-2-1/project-to-v1-1').projectInstitutionRecordV121ToV11;
const records=catalog.records.map(r=>{const p=project(r,{administrativeDivisionResolver:resolver});assert.equal(p.ok,true);return p.value});
console.log('PRODUCTION_CATALOG',JSON.stringify({valid:true,count:records.length,datasetVersion:catalog.datasetVersion,capabilityRevisions:load('modes/production/capability-reviews.ts').productionCapabilityRevisions.length}));
const defs=m('types/assessment-v2').ASSESSMENT_QUESTION_DEFINITIONS_V2;
const oldDefs=m('types/assessment').ASSESSMENT_QUESTION_DEFINITIONS;
console.log('QUESTION_MANIFEST',JSON.stringify({v1:Object.keys(oldDefs).length,v1Required:Object.values(oldDefs).filter(q=>q.required).length,v2:Object.keys(defs).length,v2Required:Object.values(defs).filter(q=>q.required).length,added:Object.keys(defs).filter(k=>!oldDefs[k])}));
const build=m('services/recommendation-preview-v2').createRecommendationPreviewServiceV2;
const createVm=m('pages/recommendation/result-v2-view-model').createRecommendationResultViewModelV2;
const synth=m('mock/institution-catalog.mock').MOCK_INSTITUTION_CATALOG_V121;
const syntheticRecords=synth.records.map(r=>{const p=project(r);assert.equal(p.ok,true);return p.value});
const scenarios=[
 ['clean',{}],['mood',{'cognitive.symptoms':['mood_instability']}],
 ['swallow',{'health.swallowingAbility':'occasional_difficulty'}],
 ['wandering',{'cognitive.symptoms':['wandering_risk']}],
 ['wandering-explicit-unit',{'cognitive.symptoms':['wandering_risk'],'cognitive.specialCareNeeds':['dementia_unit']}],
 ['gets-lost',{'cognitive.symptoms':['gets_lost']}],
 ['combined',{'cognitive.symptoms':['mood_instability','wandering_risk'],'health.swallowingAbility':'significant_difficulty'}],
 ['night',{'cognitive.symptoms':['sleep_wake_disorder']}],
 ['special-feeding',{'adl.eating':'special_feeding'}],
 ['catheter',{'adl.toileting':'catheter_or_stoma'}],
 ['pressure',{'health.recentEvents':['pressure_injury']}],
 ['incontinence',{'adl.toileting':'frequent_incontinence'}],
 ['rehab-unknown',{'health.rehabilitationNeed':'unknown'}],
 ['rehab-soft',{'health.rehabilitationNeed':'possible'}],
 ['chew-unknown',{'health.chewingAbility':'unknown'}],
 ['cognition-unknown',{'cognitive.symptoms':['unknown']}]
];
for(const [name,overrides]of scenarios){
 const draft=makeAssessmentDraftV2(overrides);
 const r=await build({draftSource:{getDraft:()=>draft},institutionCatalog:{loadCatalog:async()=>({ok:true,value:{datasetVersion:catalog.datasetVersion,datasetMode:'PRODUCTION',records}})}}).buildResultSnapshot('2026-10-26T04:00:00.000Z');
 assert.equal(r.ok,true,JSON.stringify(r.error));const s=r.value.preview.semantics,v=createVm(r.value);
 console.log('CASE',JSON.stringify({name,validAnswers:m('types/assessment-v2').validateAssessmentAnswersV2(draft.answers,true).valid,readiness:s.elderReadiness,state:v.state,cards:s.cards.length,conditional:s.conditionalCandidates.length,tiers:s.candidateEvaluations.reduce((a,x)=>(a[x.matchTier??'null']=(a[x.matchTier??'null']||0)+1,a),{}),blockingFields:[...new Set(s.requirementReadiness.filter(x=>x.blocksEligibility).map(x=>x.sourceDerivedField))]}));
}
const draft=makeAssessmentDraftV2();
const syn=await build({draftSource:{getDraft:()=>draft},institutionCatalog:{loadCatalog:async()=>({ok:true,value:{datasetVersion:synth.datasetVersion,datasetMode:synth.datasetMode,records:syntheticRecords}})}}).buildResultSnapshot('2026-10-26T04:00:00.000Z');
assert.equal(syn.ok,true);console.log('SYNTHETIC_CONTROL',JSON.stringify({state:createVm(syn.value).state,cards:syn.value.preview.semantics.cards.length,conditional:syn.value.preview.semantics.conditionalCandidates.length}));
'@ | node --input-type=module
~~~

