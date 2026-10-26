# V1.3-C1 产品文档同步与契约一致性审计

日期：2026-10-26（北京时间）  
文档性质：`AUDIT_ONLY`；产品入口更新的 `DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED`。  
结论：五份核心文件已纳入产品入口，C1 具备进入代码实施规划的文档条件；未授权或执行代码实施。发现的核心文档差异已登记，未改写其正文或旧 Frozen Contract。

## 1. 阶段与审查基线

| 项目 | 结果 |
|---|---|
| 工作区 | `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4` |
| BASELINE_BRANCH | `codex/v2-1-b1-2-4-card-actions-visual` |
| BASELINE_COMMIT | `7ae07b9b78e4502940fd9812c6a838e4ddf2cc06` |
| 开始时 Git 状态 | 40 个 tracked 修改文件、1034 个 untracked 文件；五份核心文档均为既存 untracked 文件 |
| B1.2.6 | Owner 确认 Demo 已通过真机验收，体验版 `1.2.6-demo.1025.0039`；本轮未复测 |
| PRODUCT_POLICY_OWNER_CONFIRMED | YES，六项产品决策 |
| C1_TECH_RULES_FROZEN_BY_OWNER | YES，独立 C1 契约 §1–9 的规则及目标验收行为 |
| C1_CODE_NOT_IMPLEMENTED | YES |
| C1_NEW_TESTS_NOT_RUN | YES，R01–R12 仅有固定规格 |
| C2_ARCHITECTURE_OPEN | YES |
| OVERALL_V1_3_NOT_COMPLETE | YES |
| READY_FOR_C1_IMPLEMENTATION_PLANNING | YES，仅规划条件；不等于编码、提交或发布授权 |

本轮阶段事实来自 Owner 当前指令和实际文档。此前代码审查、数据探针和旧回归结果只作为历史证据，未在本轮重新运行，不据此声称 C1 已可运行。

## 2. 核心文档清点和完整性

`DOCUMENTS_EXPECTED = 5`；`DOCUMENTS_FOUND = 5`；`DOCUMENTS_MISSING = 0`。

| 文档 | 当前角色 | 读取结果 |
|---|---|---|
| [产品规则](../product/RECOMMENDATION_AND_HISTORY_PRODUCT_RULES_V1_3_DRAFT.md) | 六项 Owner 决策；DRAFT 文件名保持 | 27992 bytes；291 行（含末尾空行）；27 个标题 |
| [页面级 PRD 补充](../product/PAGE_LEVEL_PRD_V1_3_ADDENDUM.md) | 目标页面行为，含后续 C2 保存 | 10404 bytes；140 行；17 个标题 |
| [MVP 页面流程补充](../product/MVP_PAGE_FLOW_V1_3_ADDENDUM.md) | 目标流程，不是当前正式能力声明 | 6513 bytes；84 行；7 个标题 |
| [C1 独立契约](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md) | Owner Frozen 的 C1 实现规格 | 19241 bytes；229 行；17 个标题；代码围栏闭合 |
| [后继契约审查](PRODUCT_V1_3_SUCCESSOR_CONTRACT_REVIEW.md) | C1 历史概述及 C2 开放架构 | 38622 bytes；393 行；36 个标题；代码围栏闭合 |

均为可读 UTF-8 Markdown，具有标题、分节和结尾；未见未闭合代码围栏或文件尾截断。文件存在和结构完整不代表每条外部来源均已取得。五份核心文件主要用反引号／书名而非可点击链接互引；README 现在提供五个实际路径入口。本轮不重命名、不补写核心文档。

## 3. 依据层次及产品入口修改

已最小更新 [产品 README](../product/README.md)：保留 `CURRENT_PRODUCT_SOURCE_VERSION = V1.2`、原两份 PDF 名称、V1.2 模块边界和不得改变 V2 的限制；新增六种阶段状态、五份文档入口及后续 Owner 冻结说明。根目录管理规则仅增加已确认的 V1.3 产品规则和补充文件，避免索引自身仍禁止这些文件存在。

| 适用范围 | 权威依据 | 限制 |
|---|---|---|
| 已有实现和旧 V2 历史 | 原 Frozen V2 与现有实现基线 | 未经 successor 不变更旧规则；代码存在不证明正式服务已开放 |
| V1.3 目标产品方向 | 产品规则中六项 Owner 决策 | 不自动变成工程实现或发布状态 |
| 新 C1 通道 | 独立 C1 Frozen Contract | 在独立 composition 中实现，不覆盖 V2 |
| 页面目标 | PRD/MVP V1.3 补充 | 保存及历史是 C2 目标，不能混入 C1 |
| C2 正式历史 | 后继审查 §9.0B 的开放项及已确认产品方向 | 架构仍 OPEN，无正式接口或部署冻结结论 |

旧 [代码适配审计](V1_3_CODEBASE_COMPATIBILITY_AUDIT.md)与 [C1 技术评审](V1_3_C1_REFERENCE_TECH_CONTRACT_REVIEW.md)保留当时结论。后者第 5、793、810 行的 review/freeze-review 状态不是当前 Owner 确认的替代品。README 记录时间顺序，不回写历史报告。

## 4. 业务和 Frozen V2 一致性

| 审查项 | 结论与依据 |
|---|---|
| 产品定位 | 产品规则 §1、C1 §2 一致：需求画像、参考和待核实事项；不诊断、不保证护理、接收、床位或最终价格 |
| 问卷 | 各补充文件采用 32／26；[Assessment V2](../architecture/ASSESSMENT_CONTRACT_V2.md) 第 12–13 行确认。27／21 只作 V1 历史，不新增题目 |
| 老人风险 | 原 reported/unknown/needs_confirmation 保留，不逼用户改真实答案；C1 §3–4 不重置旧 readiness |
| 原候选分层 | [Recommendation V2](../architecture/RECOMMENDATION_CONTRACT_V2.md) 第 191–210 行的五种 tier、Safety 和 MAX_3 保留；C1 §1、3、7 保留完整 legacyV2，要求 oracle deep-equal |
| 新参考准入 | C1 §4–5：旧 Exact/SoftNear/Conditional 没有可展示卡时才 fallback；至少一类可信 AREA/BUDGET/BASIC_SERVICE；未知不冒充支持 |
| 正向依据 | 区划 code 精确匹配；合法可比月费闭区间重叠；BASIC_SERVICE 仅房型或餐次，不使用宣传、名称、默认武汉或地址存在作依据 |
| 冲突 | C1 §4、6 保留旧 conflict/INELIGIBLE 否决；另加两条仅 C1 饮食否决，不将过期／未核实的否定当当前事实 |
| 排序 | C1 §7：不同已匹配类别数降序、institutionId ASCII 升序、唯一机构、最多三家；不拿护理未知加分、不补满旧组 |
| 来源与错误 | C1 §3、7 与原 Catalog Gate 一致：全池校验、精确 revision/currentPointer、同一 T、单次 Provider；数据错误／服务错误不伪装无候选 |
| 旧 no-safe | C1 §7、R10 保留旧 VM 的 no_safe_recommendation，仅新增 composition 可见状态，不改写旧层 |
| 历史 | 产品规则 §6 与后继审查 §6、9.0B 一致：未来单老人、真实授权、显式保存、不可变快照、跨设备；Preview 不写历史；零候选保存是 C2 目标 |
| 模式隔离 | C1 §1、9 保持 Demo 合成资料与 Production 分离；Demo 验收不证明正式机构事实或正式历史可用 |

特别核验饮食版本差异：[Recommendation Rule V2](../architecture/RECOMMENDATION_RULE_CONTRACT_V2.md) 第 130–145、283 行及 Recommendation V2 第 252 行将饮食支持作为解释／差异，不能变成旧 tier 否决；[ElderProfile V2](../architecture/ELDER_PROFILE_CONTRACT_V2.md) 第 167–181 行也禁止从吞咽推导 tube_feeding。C1 §6 明确仅在 fallback 否决“老人已知需要 + 当前核验 provided/value=unavailable”。原始 availability=unavailable、unknown、过期证据不是同一语义。

[Institution 原契约](../architecture/INSTITUTION_CONTRACT.md) 第 202–211、280–285 行的证据闭包、精确 revision 和时间 Gate 继续适用；[Institution V1.2.1](../architecture/INSTITUTION_CONTRACT_V1_2_1.md) 第 140、794–806 行的状态区分与旧推荐保护不变。新 C1 使用可信区划不是通过地址／Geo 重排旧 V2，也不改变原电话、地图和公开内容权限。

`FROZEN_V2_COMPATIBILITY = DOCUMENTALLY_COMPATIBLE_WITH_SCOPED_SUCCESSOR`。这是规格边界判断，旧 V2 deep-equal 与新 C1 行为仍需编码阶段验证。

## 5. 跨文档差异登记

以下均在本轮修改前已经读到，归入 `PRE_EXISTING_DOCUMENT_ISSUES`（相对本次任务开始时的文件状态）。五份核心文件尚未入 Git，无法证明各差异的产生时间或作者，`HISTORICAL_ORIGIN = UNKNOWN`。不得据此声称是长期已知缺陷。

| 编号／位置 | 原文摘录 | 影响 | 本轮处理与建议 |
|---|---|---|---|
| DOC-01 产品规则第 4、91、230、290 行；PRD 第 65 行；后继审查第 112、123 行 | “技术后继契约未冻结”；“具体 tie-break 属待技术审查细节” | 单读早期表述会误判 C1 当前仍未冻结 | README 明确后续 Owner 冻结；独立 C1 §11 为当前状态。原文保留，后续获得编辑授权时限定为历史说明，C2 仍开放 |
| DOC-02 产品规则第 12、70、85、279 行；后继审查第 118、285、296 行 | “已核验的普通服务或收护类型”；“已核实基本收护范围” | 容易把 supportedTypes、活动或护理标签扩为正向依据 | C1 第 119 行封闭排除，后继审查第 346 行也明确收窄；README 强调仅房型／餐次。无需重新选择业务方案，扩充须新 Policy 版本 |
| DOC-03 后继审查第 120 行 | “参考来源有错误、不可用或无可比证据时，该项普通依据不计入” | “错误”可能被误读成允许吞掉 schema/provenance/pointer 错误 | 依 C1 §3、R09 区分合法字段未知／无可比依据与非法目录。前者不计正向依据，后者整体 DATA_ERROR；原概述不得覆盖正式契约 |
| DOC-04 C1 第 205 行；后继审查第 350、352 行 | “原 docs/product/ 当前仍只见 V1.2”；“尚未同步进去” | 不符合本轮开始五份文件已存在及本轮索引完成后的事实 | README 和本报告记录已同步；该文字作为同步前记录保留，不修改 Frozen 核心 |
| DOC-05 后继审查第 128–135、154 行 | “VERIFIED_OR_CONDITIONAL_RESULTS”；“DATA_OR_SERVICE_ERROR”；“INITIAL_REFERENCE_UNVERIFIED_CARE” | 概念旧名可能被照抄为实际协议 | 使用 C1 §7 的 LEGACY_V2_DISPLAY、INITIAL_REFERENCE_ONLY、DATA_ERROR、SERVICE_ERROR 等正式标识；不重命名文档，不把候选概念字段当现有代码 |
| DOC-06 后继审查第 250 行 C06；产品规则第 258 行 V05 | “不得出现在该老人的个性化参考或核实匹配卡” | 泛化理解可能将新饮食否决倒灌旧 V2 | 已有 Safety 冲突仍按旧规则；新增两条饮食否决仅 C1。C1 §6、后继审查第 344 行已经限定；编码测试分别保护两通道 |
| DOC-07 产品 README 原第 7–8 行、产品规则第 284–286 行 | 两份 V1.2 PDF 名称及 RECOMMENDATION_PRODUCT_SCOPE_AUDIT_V1 | 目标工作区 docs 下未找到对应 PDF 和 scope-audit 文件，无法本地追溯原页码／完整原报告 | 保留原文来源名；不生成虚假 PDF、不跨工程复制。需要原始来源时由后续资料归档补齐；非 C1 五份文件缺失 |
| DOC-08 CONTRACT_INDEX 第 9 行 | “current V1.2 product PDF” | fallback router 尚未直接列 C1，但已路由 product README | README 已连接新规范；router 不定义语义，本轮授权外保持原样。未来若维护 router，可增加 C1 路由而不改旧 V2 |

`CROSS_DOCUMENT_CONSISTENCY = PASS_WITH_RECORDED_DOCUMENT_DRIFT`。未发现独立 C1 Frozen 规则与六项 Owner 决策之间仍需 Owner 选择的新业务冲突；上述宽泛措辞按现有明确收窄和版本适用范围即可解释。若后续希望扩大 BASIC_SERVICE、改变旧 V2 饮食资格或推进 C2，才需要新的 Owner 决策及适用契约。

## 6. 链接、文档检查与变更保护

范围：本轮新增／修改的全部 Markdown 链接、五份核心文件的 Markdown 结构／路径，以及直接相关的旧契约和 fallback index。没有做全库历史链接审计。

- `BROKEN_LINKS_NEW = 0`：README 及本报告全部本地 Markdown 目标存在；本轮不引入外链或锚点。
- `BROKEN_LINKS_PRE_EXISTING = 0`（本轮检查范围内的可点击 Markdown 链接）；五份核心文档和原 README 没有 Markdown 链接，不可将其反引号来源名称算作已通过链接校验。
- `PRE_EXISTING_MISSING_LITERAL_REFERENCES = 3`：两份 V1.2 PDF 和 scope-audit 名称未找到对应本地文件；见 DOC-07。来源／丢失时间 UNKNOWN，不声称整个仓库无断链。
- `NEW_DOCUMENT_ISSUES = 0`：入口与报告准确区分冻结、实现、测试和发布；无新增业务规范。
- `PRE_EXISTING_DOCUMENT_ISSUES = DOC-01..DOC-08`；README 提供消歧，核心原文保留。
- 五份核心文档前后内容哈希一致、仍可读取。除授权 README 和本报告外的 2104 个既存文件集合及内容前后聚合校验一致，覆盖现有未提交和 untracked 成果；旧 Frozen 契约、历史报告及代码均未改写。
- Git diff 仅新增本轮 README 修改；本报告为新 untracked 文件。原 40 个 tracked 修改及原 untracked 文件保留，不把原修改列为本轮产出。

本轮未运行业务测试、构建、DevTools、Android、正式历史 E2E，未清理 dist，未执行 git add/commit/push 或微信上传、提审、发布。文档语法、相对路径、状态和变更保护检查通过不代表 R01–R12 通过。

## 7. 进入编码规划的条件与风险

五份文件已进入正式产品索引；README 能区分 V1.2 实现基线和 V1.3 目标。C1 规则、白名单、证据 Gate、排序、错误语义、UI 要求和 R01–R12 规格已有独立 Frozen 依据，因此 `READY_FOR_C1_IMPLEMENTATION_PLANNING = YES`。本轮到此停止，不启动编码、不生成下一阶段任务。

实际编码必须验证：

1. 同一 Assessment、同一 T、同一合法 Catalog 的 legacyV2 oracle deep-equal；不改旧 readiness、tier、Rank Tuple、NO_EXACT_MATCH 或历史 reader。
2. 证据 sidecar 的 schema／provenance／时间闭包，Provider 单次加载、精确 currentPointer/revision；任何非法条目整体报错。
3. AREA/BUDGET/BASIC_SERVICE 的精确 comparator、边界、去重和 ASCII 排序；两条饮食否决仅 C1，unknown/expired/unavailable 语义不混同。
4. R01–R12 全部固定向量及相关旧回归；既有 NAV-019/NAV-024 失败记录须核对，不伪报通过。本报告仅引用旧审计，未重跑。
5. 新结果 composition、独立公开详情 handler、防重复和迟到导航，风险信息不被前三标签截断；窄屏、大字号、Android 真机需新证据。
6. Demo/Production 数据与副作用隔离；旧探针显示正式数据仅 AREA 可用，不等于未来数据已获核验。无足够可信依据仍可能零候选，不造价格或能力。
7. C2 的可信账号、单老人授权、显式保存、幂等事务、不可变版本 reader、数据生命周期和跨设备验证仍开放，C1 不创建正式身份或保存健康快照。

`REMAINING_RISKS = 文档旧表述残留 + 编码验证未执行 + C2 架构开放 + 历史来源本地缺失`。这些边界已明确，不能被文档同步消除，也不构成本轮开始实现的授权。
