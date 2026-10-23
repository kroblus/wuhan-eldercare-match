# V2.1-B1.2.3 机构卡片交接

2026-10-23～24。本地实施完成；尚未获得 Owner Android 验收。未 push、创建 PR、merge、上传或发布；未进入 B2。

```text
STATUS = COMPLETE
BASE_B1_2_2_COMMIT = a749172e50a8974c50a1480c8a0b7d4d44796f5e
BRANCH = codex/v2-1-b1-2-3-compact-cards
IMPLEMENTATION_COMMIT = 4b1be15ae18d4101c10a1e9f55c76c7571c21ae0
NEW_LOCAL_COMMIT = final handoff commit at this branch HEAD
WORKTREE = C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-3
OWNER_CARD_DIRECTION = COMPACT_NAME_ADDRESS_PRICE
ADDRESS_CONTRACT_REVIEW = COMPLETE_NARROW_SCOPE
ADDRESS_CONTRACT_APPROVAL = OWNER_EXPLICIT_REQUEST_V2_1_B1_2_3
ADDRESS_CONTRACT_AMENDMENT = institution-ordinary-directory-display-v1
ADDRESS_EVIDENCE_GATING = READY_EXACT_IDENTITY_REVISION_CURRENT_VERIFIED
ADDRESS_DIRECT_DISPLAY = YES_ORDINARY_DIRECT_DIRECTORY_ONLY
PRICE_EVIDENCE_GATING = PROVIDED_CURRENT_VERIFIED_REFERENCE_TOTAL_CNY_MONTH
PRODUCTION_PRICE_COVERAGE = 0/11
DEMO_PRICE_DISPLAY = 7/12_CURRENT_SYNTHETIC_TEST_ONLY
UNKNOWN_PRICE_HIDDEN = YES
PRICE_UNIT_AND_SCOPE = EXACT_RANGE_OR_STARTING_MONTH_REFERENCE_WITH_CAVEAT
CARD_LAYOUT_REDESIGNED = YES
NORMAL_CARD_HEIGHT = 206.53px_AT_390_AND_430
RISK_CARD_HEIGHT = 283.32px_AT_390_AND_430
LONG_ADDRESS_HANDLING = NATURAL_WRAP_NO_TRUNCATION
SPECIAL_RISKS_PRESERVED = YES
ZERO_TAG_LAYOUT = PASS_NATIVE_320_FONT150
T1_ONLY = YES
T2_T3_DISABLED = YES
HOME_PREVIEW = 2
ACTIVE_SEARCH_RESULTS = ALL_EXISTING_AND_MATCHES
DIRECTORY_REUSE = HOME_AND_DIRECT_LIST
DETAIL_ROUTE_CONTEXT = PRESERVED
RECOMMENDATION_CONTEXT_PRESERVED = YES
ASSESSMENT_CONTRACT_CHANGED = NO
RECOMMENDATION_CONTRACT_CHANGED = NO
INSTITUTION_DOMAIN_SEMANTICS_CHANGED = NO
PRODUCTION_DATA_CHANGED = NO
DEMO_DATA_CHANGED = NO
N1_TABBAR_PRESERVED = YES
UNIT_TESTS = TARGETED_PASS
TARGETED_INTERACTION_TESTS = PASS_VM_AND_SCOPED_DEVTOOLS
PRODUCTION_BUILD = PASS
DEMO_BUILD = PASS
WECHAT_COMPATIBILITY = TS4_1_2_LESS_NATIVE_WXML_GENERATED_JS_PASS
DEVTOOLS_SCREENSHOTS = NATIVE_PRODUCTION_320_375_390_430_AND_DEMO
ANDROID_DEVICE_VERIFICATION = NOT_RUN
PRODUCTION_SIZE = 1355460_BYTES_LOCAL_RUNTIME
DEMO_SIZE = 2025758_BYTES_LOCAL_RUNTIME
LOCAL_BUDGET_REMAINING = PRODUCTION_676156_BYTES_DEMO_5858_BYTES
WECHAT_MAIN_PACKAGE_SIZE = NOT_AVAILABLE
DOC_IMPACT = NEW_CONTRACT_REQUIRED_ADDRESSED_BY_VERSIONED_DISPLAY_AMENDMENT
WORKSPACES_PRESERVED = YES_NO_OTHER_WORKSPACE_WRITES
GIT_WORKTREE_CLEAN = YES_AFTER_FINAL_HANDOFF_COMMIT
RISKS = ANDROID_PENDING_SMALL_DEMO_HEADROOM_EXISTING_DOC_GATE_21
BLOCKERS = NONE_FOR_LOCAL_IMPLEMENTATION_OWNER_ACCEPTANCE_PENDING
NEXT = OWNER_COMPACT_CARD_REVIEW
```

## 展示规则及边界

原 Institution V1.2.1 §22 禁止首版 List 增加完整地址。本轮没有改写它或其他 Frozen 原文；Owner 本次明确产品指令、当前 AGENTS 的显式 successor/version 规则及架构文档治理允许采用独立后继。新增 [普通目录展示修订 V1](../architecture/INSTITUTION_ORDINARY_DIRECTORY_DISPLAY_AMENDMENT_V1.md)，登记 DOC_REGISTRY 与 Contract 路由，仅替代普通直接目录的完整地址禁止条款。机构 Domain 版本、证据判定、资料、Provider、排序、API 和推荐语义均未改变。

首页默认两条，输入非空名称、选择非默认区域／性质后展示全部既有 AND 匹配结果；展开为完整普通目录，清除全部回到两条。没有重新实现搜索，没有调整加载世代、竞态、焦点或 setData 策略。首页 Hero、品牌、资讯、服务入口、搜索控件和公告铃铛源文件完全未改，N1 app.json 未改。

普通卡只有完整名称、原区域、合法非重复性质 T1、合格地址、合格参考月费、具体风险、详情入口。性质未知不造标签；0 标签不留空容器。地址从 exact identity/revision 的现有 Detail Application/VM 官方地址读取，只有 ready 才直接展示。无效／未知／不可用／待核验／过期不输出地址值，也不推导位置、地图或服务能力。待核验和过期的重要说明仍作为独立风险保留；完整状态留在 Detail。

价格仅消费当前已核验 provided 的 CNY/month/reference_total 投影，区间和起价各保留含义、分值精度；有不能完整表达的附加收费或机构限定时保守隐藏。随价格同时显示“随照护等级、房型等变化，非最终报价”。无价时整组省略，不出现 ¥--、费用待咨询或空白价格行。正式 11 家均无合格价格；Demo 原 12 家中 7 条当前合格、4 unknown、1 expired，只有前 7 条可显示既有合成金额，每卡保留“演示机构 · TEST ONLY”。没有复制新价格或机构资料。

删除普通卡通用电话行，同时保留冲突、仅有联系人手机号、待核验、过期、明确不可用等具体警告，按原文去重；无具体号码条目的泛化 unknown 不重新变成每卡一行。QA 首轮指出电话风险覆盖不足，现已修复并补真实资料及 seam 断言。没有显示号码、声称实拨或改动 Detail 合法拨号、地图和 CareProcess。

共享模板仅对普通 direct_list 设置 compact 投影。推荐来源列表跳过装饰，保留旧卡片分支（所以旧地址／收费布局 CSS 仍有实际消费者）。候选、其余目录组、来源上下文及 canonical identity 参数不变。详情文字 CTA 与整卡共用原有唯一 onCardTap；没有新增子按钮 handler。

## 原生视觉及交互证据

证据目录：[v2-1-b1-2-3-evidence](v2-1-b1-2-3-evidence/)。PNG 均来自微信 DevTools simulator_screenshot；不是浏览器渲染。宽度／字号使用 wx.getSystemInfoSync 校验，PNG 像素受模拟器缩放影响，不等同 CSS 像素。before 只读复制自 a749172 的已提交 B1.2.2 证据。

| 原生 CSS 尺寸 | B1.2.2 普通／风险卡 | B1.2.3 普通／风险卡 | 两卡含 12px 间距 |
|---|---:|---:|---:|
| 430px / font16 | 235.73 / 312.52px | 206.53 / 283.32px | 560.25 → 501.85px |
| 390px / font16 | 235.73 / 312.52px | 206.53 / 283.32px | 560.25 → 501.85px |
| 320px / font24 (150%) | 561.88 / 703.46px | 347.92 / 530.29px | 1277.33 → 890.21px |

正文、名称、风险和主要操作字号没有缩小。375px 实际截图正常。长名称、最长地址、零标签和风险全文在 320/150% 自然换行，可纵向滚动；风险上下段分别截图，未使用裁切或固定高度。Demo 375/font16：现有有价卡 234.52px，无价卡 176.13px（不同现有示例）；金额／限定省略后不留占位。

- 正式：production-cards-430/390/375、production-card-320-font150、production-long-address-320-font150、production-zero-tag-320-font150、production-risk-top/bottom-320-font150；production-expanded-390 记录展开，measure JSON 记录默认两条及尺寸。
- 演示：demo-price-and-no-price-375、demo-price-measure-375、demo-starting-price-375、demo-unknown-address-no-price；分别覆盖区间、起价、无价格、缺失地址与 TEST ONLY。
- 过期：test-only-expired-render-320 与 test-only-expired-risks-320 是**明确标记 TEST ONLY 的渲染检查**。用现有编译 Application 在 2027-02-01 只读计算真实记录的过期 VM，再临时 setData 到模拟器；不是当前生产记录状态。地址和价格为空，显示“地址资料已过核验期”“电话资料已过核验期”。只读投影检查后 reLaunch 恢复，无 Provider、数据库、源资料或持久化改动。
- Chinese input 使用原生 automator element input 注入“社会福利”，得到 7 条；区域汉阳＋性质公办得到 1 条，切民办得 0，清关键词保留筛选得 2 条，清全部回默认 2 条。卡片真实 tap → 指定 id/revision Detail ready，navigateBack 后条件保持。筛选部分通过原生 page handler 调用，**不冒充 Android 中文输入法组合事件测试**。
- Demo ready_soft_near Result → onRecommendationListTap → 带 ref 的 12 条列表，compact=false；候选保留 ref，其余 direct_list 保持 null。真实点卡进入同候选 revision 的 source=recommendation Detail ready。native-interactions.json 中“all rows sameContext=false”是混合两组的观察；随后分别确认 candidateContexts=true、directContexts=true，不是上下文丢失。

DevTools 2.02.2609232 Nightly 期间发生一次服务中断、项目窗口消失；状态检查确认登录有效，CLI 恢复本轮两项目。MCP 重连返回 Bad Request，后续采用已有 CLI 通道完成，未更改安全设置或寻找凭证。一次大字号刷新后 automator 超时重试恢复；测量时页面已进入 Detail，辅助测量脚本读取不存在的列表 length 产生一次 WAAutoService eval 错误，已纠正页状态及截图命名。Production console 还记录 routeDone/webviewId 诊断；没有把本轮记作 console-zero-error。Demo 后续 error 过滤为空。这些不被包装成 Android 证据。

## 检查及包预算

实际运行并通过：

| package.json 检查入口 | 结果 |
|---|---|
| check:v2-1-b1-2-3-cards | 138 assertions，production/demo |
| check:v2-1-b1-ui | 130 assertions，production/demo，搜索／竞态／快速动作／失败重试／返回／读取 |
| check:v2-1-b1-1-visual | 86 assertions |
| check:v2-1-b1-2-home | 43 assertions |
| check:v2-1-b1-2-1-visual | 52 assertions |
| check:institution-list-page-runtime / detail-page-runtime | PASS |
| check:institution-list-detail-interactions | 17/17 |
| check:institution-detail-v1-2-1-interactions | 16/16，含合法电话／地图 guard 的模拟检查 |
| check:navigation-home-dedup-p0 | 10/10 |
| check:assessment-v2-runtime | 44 source cases |
| check:recommendation-v2-runtime | PASS，含 NO_EXACT_MATCH |
| check:run-mode-convergence | PASS，12 Demo身份、上下文、隔离、无真实提交 |
| check:wechat-ts-targeted-compat | PASS |
| build:production / build:demo | TS 4.1.2、Less、native WXML、生成语法，30 routes；211 / 206 modules |
| check:wechat-js-compat --artifact-dir dist/{mode}/miniprogram | 211 / 206 JS，无 class fields／optional chain／nullish |
| git diff --check | PASS |

最后电话风险代码修改后重新双构建，并重跑 B1/本轮新检查及双模式 JS 检查；其余检查已通过且对应业务代码没有改变。原始日志在本工作区忽略目录 output/v2-1-b1-2-3/。全局 check:doc-governance **FAIL 21 项既有问题**：缺 AGENTS.md、server/README.md 入站引用及未登记 PRODUCTION_CAPABILITY_EVIDENCE 等。直接在未修改的 B1.2.2 工作区只读运行同检查，21 项逐项一致，新增／消失均 0；本次新文档已正确登记，不扩展修复历史治理。

| 本地 runtime bytes | B1.2.2 | B1.2.3 | delta | 距既有 2,031,616 预算 |
|---|---:|---:|---:|---:|
| Production | 1,361,113 | 1,355,460 | -5,653 | 676,156 |
| Demo | 2,031,411 | 2,025,758 | -5,653 | 5,858 |

首次 Demo 超预算 2,009 bytes。核实 Less 由两个页面内联、运行文件无独立 WXSS 引用后，构建器仅省略 styles/institution-directory.wxss；源文件、渲染编译和其他 8 个旧无依赖 WXSS 均保留。增加 runtime 引用 fail-closed 断言，以后若有人引用被省略文件，构建失败。

artifact-optimization-proof.json 记录首次优化时两模式均仅移除 8,114 bytes，其他运行文件逐一 SHA 相等。随后独立 QA 电话风险补丁只增加 directory-presentation.js 247 bytes；package-audit.json 复核最终所有页面 CSS 与优化前完全相同。与 B1.2.2 比，最终仅两个页面的卡片 CSS、目录模板、目录投影 JS 改变，加上省略一份独立 WXSS。资源体积完全保留：Production 5,299 bytes，Demo 423,329 bytes；无新图片、库、机构数据或预算放宽。docs 截图不进入 runtime。

以上仅按 dist/{mode}/project.config.json 的 miniprogramRoot 统计本地原始运行文件，不是整个 dist 的合计，也不是微信最终编译／压缩／签名主包。最终包信息、平台上传校验为 NOT_AVAILABLE/NOT_RUN；未通过 preview/upload 或接入 CI 私钥取得数字。未声称真实包限制已通过。

## Agent 委派及 Owner 验收

AGENT_DELEGATION_REPORT：

| Agent | 授权文件／职责 | 结果 |
|---|---|---|
| wechat_frontend / b123_frontend | 目录 template、Less、directory-presentation、list VM 可选展示字段、4 个直接相关测试；不写 docs/build/data | 完成；修复 QA 指出的电话风险，138/130 断言通过 |
| backend_domain / b123_evidence_review | 只读地址、参考价格证据及覆盖核对 | 现有投影门槛可用，正式 0/11、Demo 7/12；无数据或领域代码修改 |
| qa_reviewer / b123_diff_qa | 只读 diff-driven Contract／证据／推荐上下文／双模式／构建检查 | 修复后 PASS；未独立重跑主线程 suite 或操作 DevTools |
| main_session | 最小地址展示后继、集成、双构建、预算证明、原生截图及交付 | 完成 |

文件所有权互斥；本次 Owner 明确要求专项前端实施，按该授权委派。未启动 matching_engine，因为没有修改其领域；没有为数量启动额外 Agent。

NOT_RUN：Android 物理设备、大字号下真实输入法组合事件、真实电话系统对话框／实拨、平台最终代码包检查、上传／提审／发布。失败加载与重试、双击、竞态主要由 VM/交互脚本验证，不宣称每项都已真人触摸验证。

Owner 建议在 Android 检查：默认两卡和展开／收起、中文持续输入与清除、区域性质 AND 与无结果、整卡及详情 CTA 快点、详情返回条件、合法拨号入口、320/大字号长地址与风险全文、演示区间与起价／无价、推荐来源详情及返回。查看 production 与 demo 各自工程，禁止混用身份或资料。

B2 前置条件：Owner 本轮视觉和 Android 验收；单独授权 N2 迁移、冻结导航影响（顾问 switchTab 和候选上下文）；在目标 AppID/DevTools 获取真实编译包信息并解决 Demo 仅 5,858 bytes 的本地余量。B1.2.3 不启动迁移、公告后台或真实预约。

历史 B1.2.2 工作区仍 clean；原工程已有 63 条未提交状态，未修改／重置／清理；其他历史工作区没有写入。dist、output 为本轮忽略构建／验证产物。本轮代码与证据先提交，当前文件在单独本地文档提交中交接；最终 SHA 由交付消息及 git log -1 给出。

## 实际修改文件

以下清单包含所有代码、规则、测试、证据及本交接文件；无未列出的业务模块变更。

- `docs/architecture/CONTRACT_INDEX.md`
- `docs/architecture/DOC_REGISTRY.json`
- `docs/architecture/INSTITUTION_ORDINARY_DIRECTORY_DISPLAY_AMENDMENT_V1.md`
- `docs/design/V2_1_B1_2_3_COMPACT_CARD_HANDOFF.md`
- `docs/design/v2-1-b1-2-3-evidence/artifact-optimization-proof.json`
- `docs/design/v2-1-b1-2-3-evidence/before-cards-390.png`
- `docs/design/v2-1-b1-2-3-evidence/before-cards-430.png`
- `docs/design/v2-1-b1-2-3-evidence/demo-price-and-no-price-375.png`
- `docs/design/v2-1-b1-2-3-evidence/demo-price-measure-375.json`
- `docs/design/v2-1-b1-2-3-evidence/demo-price-measure-375.png`
- `docs/design/v2-1-b1-2-3-evidence/demo-recommendation-context-detail.png`
- `docs/design/v2-1-b1-2-3-evidence/demo-starting-price-375.png`
- `docs/design/v2-1-b1-2-3-evidence/demo-unknown-address-no-price.png`
- `docs/design/v2-1-b1-2-3-evidence/measure-390.json`
- `docs/design/v2-1-b1-2-3-evidence/measure-430.json`
- `docs/design/v2-1-b1-2-3-evidence/native-interactions.json`
- `docs/design/v2-1-b1-2-3-evidence/package-audit.json`
- `docs/design/v2-1-b1-2-3-evidence/production-card-320-font150.json`
- `docs/design/v2-1-b1-2-3-evidence/production-card-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/production-cards-375.png`
- `docs/design/v2-1-b1-2-3-evidence/production-cards-390.png`
- `docs/design/v2-1-b1-2-3-evidence/production-cards-430.png`
- `docs/design/v2-1-b1-2-3-evidence/production-detail-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/production-expanded-390.png`
- `docs/design/v2-1-b1-2-3-evidence/production-home-390.png`
- `docs/design/v2-1-b1-2-3-evidence/production-long-address-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/production-risk-bottom-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/production-risk-top-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/production-zero-tag-320-font150.png`
- `docs/design/v2-1-b1-2-3-evidence/test-only-expired-render-320.png`
- `docs/design/v2-1-b1-2-3-evidence/test-only-expired-risks-320.png`
- `miniprogram/pages/institution/directory-presentation.ts`
- `miniprogram/pages/institution/list-view-model.ts`
- `miniprogram/styles/institution-directory.less`
- `miniprogram/templates/institution-directory.wxml`
- `package.json`
- `scripts/build-run-mode.mjs`
- `scripts/check-v2-1-b1-1-visual.mjs`
- `scripts/check-v2-1-b1-2-1-visual.mjs`
- `scripts/check-v2-1-b1-2-3-cards.mjs`
- `scripts/check-v2-1-b1-ui.mjs`
