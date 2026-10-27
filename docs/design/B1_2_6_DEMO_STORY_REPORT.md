# B1.2.6 — Demo Story Integration

2026-10-24。工作区：`C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`。

## STATUS

`LOCAL_FREEZE_COMPLETE`。Owner 正式批准包含顾问反馈可见性修复的 B1.2.6 功能、视觉冻结及相关成果本地提交。验收日期为2026-10-24（北京时间），来源为本次 Owner 手动反馈；冻结检查与记录于2026-10-25完成。

```ini
PHASE = B1.2.6
IMPLEMENTATION = COMPLETE
OWNER_VISUAL_ACCEPTANCE = PASS
OWNER_BUSINESS_FLOW_ACCEPTANCE = PASS
OWNER_BUSINESS_ACCEPTANCE = PASS
ANDROID_CONSULTANT_RETEST = OWNER_REPORTED_PASS
CONSULTANT_SIX_CHECKS = 6/6 PASS
ANDROID_OWNER_RETEST = PASS
CODEX_ADB_AUTOMATION = NOT_RUN
B1_2_6_LOCAL_FREEZE = APPROVED
LOCAL_FREEZE = COMPLETE
B1_2_6_FINAL_WECHAT_PACKAGE = NOT_RUN
DEMO_UPLOAD = NOT_RUN
REVIEW_SUBMISSION = NOT_RUN
PRODUCTION_RELEASE = NOT_RUN
```

本地 Git 提交的实际哈希、成功状态及提交后工作区由本轮最终提交回执给出；本报告不自嵌包含自身的提交哈希。可用 `git log -1 --format="%H %s" -- docs/design/B1_2_6_DEMO_STORY_REPORT.md` 定位冻结记录所在提交。本地冻结不等同上传或发布。

本地业务演示整合、双构建、相关回归与原生渲染取证已完成。顾问缺陷先阻断、局部修复后由 Owner 专项复测通过；最新反馈关闭该缺口。本轮不新增功能、不调整视觉、不开启 B1.2.7。

2026-10-24 完成 Demo 顾问反馈可见性修复和专项取证，当时没有提交或上传。2026-10-25 按 Owner 新授权完成最终检查并准备本地集成提交，保留 B1.2.4 / B1.2.5 / B1.2.6 全部已确认相关成果。没有 push、微信预览 / 上传、提审或发布；原 B1.2.5 上传版本 `1.2.5-demo.1024.1730` 只作历史记录，不补造新版上传记录。

`DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED`：更新 FRONTEND_STRUCTURE 中 Demo Provider、页面职责和构建组合方式；没有新增或修改业务 Contract。B1.2.5 上传文档另补原任务成功结果，未重复上传。

本次局部修复的 `DOC_IMPACT = AUDIT_ONLY`；更新本报告与专项证据，无长期结构或 Contract 变化。原自动化日志和截图保持历史证据属性。

## FINAL_OWNER_ACCEPTANCE

验收对象：包含养老顾问反馈可见性修复的 B1.2.6。复测范围为此前规定的六项顾问专项检查；Owner 明确报告6/6全部通过，模拟联系和三个常见问题回复可查看，机构进入上下文正确，预约、返回重进及连续点击正常；整体视觉满意、业务演示流程符合预期，同意本地功能与视觉冻结及 Git 提交。

证据来源仅为 Owner 手动反馈，不包装成 Codex / ADB / 自动化真机结果。具体机型、微信版本、系统版本和所测构建标识没有独立证据，均记“未提供”；不使用此前遗留远程调试信息补造本次复测对象。实际测试日期按 Owner 指定记2026-10-24（北京时间），不编造具体时分。

## FINAL_LOCAL_VERIFICATION_AND_COMMIT_SCOPE

2026-10-25 有边界重新执行双构建、B1.2.6 Story（含顾问定位、离页保护、快速重复预约与返回 guard）、B1.2.5 Continuity、模式隔离、双产物 JS、既有预算，以及集成提交涉及的 B1.2.4 电话 / 卡片和 Institution VR 检查，均 PASS。未重复全项目、DevTools尺寸或真机操作；Owner验收和2026-10-24原生证据独立保留。结果见 [freeze-checks-20261025.json](b1-2-6-evidence/freeze-checks-20261025.json)。

额外 `check:doc-governance` 为 FAIL（21项）：缺失 AGENTS.md / server/README.md 引用及既有 PRODUCTION_CAPABILITY_EVIDENCE 未登记。隔离导出的提交前 HEAD `c109208` 同一检查报23项，包含当前全部21项，额外两项仅为导出中没有生成的 dist配置。该差异确认当前21项均为既有文档债务；本轮不改 Frozen Contract、不绕过检查或伪标全库文档 PASS。当前报告链接及证据 JSON 单独核对。

提交方案B：一次 `feat(demo): finalize B1.2.4-B1.2.6 demo experience baseline` 集成提交。当前分支 `codex/v2-1-b1-2-4-card-actions-visual`，起点 `c109208`；初次盘点35个有内容差异的已跟踪文件、268个未跟踪文件，另 tokens.less 仅stat/EOL状态提示、HEAD/index/工作树 Git内容哈希一致。既有 index 为空。B1.2.4报告仍保留其阶段PARTIAL事实，不把本轮集成冻结描述成历史所有专项均完成。最终具体路径清单见 [freeze-files-20261025.json](b1-2-6-evidence/freeze-files-20261025.json)。

归属已由只读 Agent 审查：B1.2.4目录/电话/视觉及其 Owner Amendment，B1.2.5连续记录/评价/地图VR状态，B1.2.6故事/顾问/隔离页面与对应取证；共享构建器、工具、端口和检查器交织，拆分会有不完整中间状态风险。没有发现来源不明的源码或凭据。证据是相关PNG/JSON，原有未跟踪文件总量约21.85MB、单文件小于0.5MiB；保留中间取证，不把它们伪称最终图。dist、output、依赖及私有配置均不暂存；按经核对的具体文件路径清单暂存，未使用无范围add、stash、清理或回滚。

## CONSULTANT_INTERACTION_REPAIR

### ROOT_CAUSE

本地复现的是“事件已生效，但反馈留在屏外”：430px 默认字体下，实际坐标点击联系按钮后 contacting=true，reply 已更新，但回复 top=1182.833，超出 windowHeight=850；机构进入时回复 top=1209.229。同一视口内没有可见状态变化，使用者感到按钮无响应。原实现的 contact / ask 仅 setData，没有定位反馈区；原直接调用 handler 的测试没有检验反馈可见性。

已检查静态 bindtap 与 Page 注册一致，父层没有 catchtap、scroll-view 拦截或透明遮罩；可操作按钮没有永久 disabled / loading。实际点击可触发，推荐和预约能够导航，未找到 NavigationGuard 锁死或 Demo 安全拦截这些本地 Action 的证据。Tab 的 story=null 是正常无机构状态，不阻止 contact / ask。该结论是本地取得证据的原因，不冒充已确认所有 Android 差异。

### CHANGED_FILES / INTERACTION_FIX

- `modes/demo/consultant.ts`：联系后在渲染完成时定位现有问答区；选择问题后定位现有回复。测量真实导航栏高度并留16px，不改变页面设计。异步回调确认页面仍在前台，避免旧页面滚动新页面；滚动失败保留本地回复可手动阅读。
- `modes/demo/pages/consultant.wxml`：只为既有导航组件增加查询 ID，无新增视觉模块、样式、Token 或事件通道。
- `scripts/check-b1-2-6-story.mjs`：补屏外反馈定位、离页不滚动、快速重复预约防重和返回后 guard 重置检查。
- 本报告及 `b1-2-6-evidence/consultant-*`：修复前后截图、坐标、实际几何、页面栈和回归输出。

没有修改正式顾问 Provider、机构事实、推荐排序、契约、模拟问答内容、真实通信限制或共享导航实现。

### DIRECT_TAB_RESULT / INSTITUTION_ENTRY_RESULT

PASS（DevTools）：Tab 正常加载，需求摘要存在，story=null；联系操作显示“模拟咨询中 · 未联系真人”，三个固定问题分别显示照护、费用 / 床位、医疗回复，推荐入口进入推荐页。Tab 切走再回来可再次操作。

PASS（DevTools）：从推荐的查看详情按钮进入主讲机构，再实际点击咨询养老顾问；保留 home / revision1 / source=recommendation / sourceContextRef=institution-context-2。模拟联系和回复可见，预约引导进入同一机构的 Demo 安排；实际返回顾问页保持上下文，可再次预约。Windows 原生鼠标双击该预约按钮后，页面栈中 appointment/create 只有1个。运行时回归另覆盖导航未完成时重复调用及 onShow 后再次进入。

### NATIVE_TOUCH_RESULT

业务操作通过 DevTools 模拟器中的实际坐标点击完成，没有以直接调用 contact / ask / browse / book 充当原生点击结果。页面准备导航、测试字号 onShow、只读状态查询与滚动辅助另行区分。完整记录见 [consultant-interaction-native.json](b1-2-6-evidence/consultant-interaction-native.json)。

| 实际视口 / 字体 | 联系按钮宽 × 高 | 选问题后回复 top / bottom | 结果 |
| --- | --- | --- | --- |
| 320 / 默认 | 238.667 × 48 | 79.927 / 217.510 | PASS，坐标点击显示照护回复 |
| 320 / 150% | 238.667 × 58.531 | 79.833 / 309.802 | PASS，费用按钮可换行点击，回复完整可见 |
| 375 / 默认 | 294 × 48 | 239.594 / 350.781 | PASS，医疗回复可见 |
| 375 / 150% | 294 × 58.531 | 107.260 / 337.229 | PASS，照护回复可见 |
| 430 / 默认 | 348.667 × 48 | 359.500 / 470.688 | PASS，三个问题逐一点击 |
| 430 / 150% | 348.667 × 58.531 | 166.396 / 356.771 | PASS，费用回复可见；机构进入也已点击 |

windowWidth 来自真实机型切换，未 mock 宽度；150% 仅投影 fontSizeSetting=24，结束恢复16。按钮点击均生效且内容在视口横向边界内，未见遮罩或异常布局；不把投影称为 Android 系统字号验收。联系操作定位问答区，320 / 150% 的整组问答本来长于视口，可正常滚动；点击问题后会把对应回复显示在导航栏下。

截图：[修复前](b1-2-6-evidence/consultant-defect-before.png)、[320联系](b1-2-6-evidence/consultant-fix-320-contact.png)、[320回复](b1-2-6-evidence/consultant-fix-320-faq.png)、[320放大字体](b1-2-6-evidence/consultant-fix-320-font150.png)、[375回复](b1-2-6-evidence/consultant-fix-375-faq.png)、[375放大字体](b1-2-6-evidence/consultant-fix-375-font150.png)、[430联系 / 放大字体](b1-2-6-evidence/consultant-fix-430-contact.png)、[430三问](b1-2-6-evidence/consultant-fix-430-faq.png)、[430放大字体](b1-2-6-evidence/consultant-fix-430-font150.png)、[机构预约](b1-2-6-evidence/consultant-fix-institution-booking.png)。

取证环境曾保留远程调试，自动化系统信息指向手机而截图指向模拟器，已结束该遗留会话后才做有效本地复现。生成文件替换期间还出现过一次编译缓存 WXSS 错误，完整构建后清编译缓存再编译恢复；这些工具超时、错误屏和无效坐标点击不计 PASS，也不作为修改 Android 真机代码已通过的证据。

### ANDROID_RETEST / REGRESSION_RESULTS

2026-10-24 本地修复交付时为 `ANDROID_RETEST = NOT_RUN`；此后 Owner 已完成修复版六项专项，最新状态 `ANDROID_CONSULTANT_RETEST = OWNER_REPORTED_PASS`、`ANDROID_OWNER_RETEST = PASS`。Codex没有运行真机业务自动化，`CODEX_ADB_AUTOMATION = NOT_RUN`；原始JSON的NOT_RUN保留为当时证据，不回写历史日志。

本次重新通过 Demo / Production 双构建、B1.2.6专项、B1.2.5连续性、run-mode convergence、Demo200 / Production214生成JS兼容及包预算。结果见 [consultant-interaction-regression.json](b1-2-6-evidence/consultant-interaction-regression.json)。模拟操作不触发真实通信，安全 guard 和 Production 排除 Demo 的检查均 PASS；未重跑无关全项目测试。

## ANDROID_OWNER_ACCEPTANCE（修复前历史反馈）

| 项目 | 最新记录 |
| --- | --- |
| Android 真机验收 | 历史 `OWNER_REPORTED_PASS`；后续补报顾问缺陷，本次修复 `ANDROID_RETEST = NOT_RUN` |
| 来源与方式 | Owner 在当前会话直接反馈；Owner 手动测试，非 Codex / ADB / 自动化执行 |
| Owner 原反馈 | “B1.2.6 Android 真机测试已由 Owner 完成，反馈正常，没有发现问题。” |
| 记录日期 | 2026-10-24；实际测试时间未单独提供 |
| 验收范围 | B1.2.6 Android 真机整体体验；不将整体反馈扩展成未逐项报告的专项测试证据 |
| 设备及运行信息 | 具体机型、Android / 微信版本、所测 B1.2.6 版本号与分发方式未单独提供 |
| Codex ADB / 自动化真机证据 | `NOT_RUN`；本次没有连接设备、执行真机命令或生成设备日志 |
| 截图、录屏及专项步骤 | Owner 本次未提供；不伪造或替换原 DevTools 证据 |

下文 E2E 表、geometry.json、navigation-e2e.json 和 final-checks.json 均为原实现阶段的本地 / DevTools 证据；其中历史 NOT_RUN 仅指当时范围。最新修复版专项验收以 FINAL_OWNER_ACCEPTANCE 为准，不覆盖或篡改原日志。

## DEMO_STORY_FLOW

首页自动幂等载入案例 → 查看需求画像 → 推荐结果 →「本次讲解机构」虚构示例·春和颐养中心 → 位置与周边 / 全景看院演示 → 咨询养老顾问 → 演示看院安排 → 合法 completed Visit 三步评价 → 我的预约回查；老人档案与历史评估在“我的”正常入口可查。

推荐顺序仍为原来的 center → home → kangyi，主讲提示不排序、不置顶、不修改推荐。主讲实体仍是 `demo-inst-chunhe-home` / revision 1。旧 Fixture 名称“春和颐养之家”保留；“虚构示例·春和颐养中心”仅为 Demo 展示别名，不改实体、revision、已保存快照或机构事实。

机构详情发出的地图、VR、咨询、预约路由均保留 institutionId、recordRevision、source 及推荐 sourceContextRef。Demo Story Provider 调用既有详情快照解析，要求有效的当前 MOCK_DEVELOPMENT_ONLY 机构上下文；历史只读上下文、不存在的 revision / 来源及过期 epoch 被拒绝。

主案例原本明确包含 completed Visit，预约页如实说明“案例已包含一次完成的看院”；没有根据日期推导完成，也没有制造第二次预约。其他机构可保存幂等的内存模拟安排，完成带看管理能力仍在演示设置。

## MINE_PAGE_RESULT

“我的”主体只保留老人档案、我的评估、我的预约与对应数量，底部为次级“演示设置”。原管理能力完整保留在该二级页面：重新载入、重置、浏览机构、画像、推荐、独立全景 / 城区地图、另存草稿、模拟预约 / 完成带看、评价入口。

Demo App 首次启动和首页轻引导共享 loadDemo 单次初始化；重复 onShow、Tab 切换及加载不重置、不复制。实际重复加载后仍为 2 位老人、2 条评估、3 条预约，已提交评价可查。显式重置或进程销毁才清除当前内存会话；完全冷启动自动恢复初始 Fixture，不承诺跨进程保存新增内容，不开启真实 Storage。

## INSTITUTION_MAP_RESULT

主讲机构详情直接显示“位置与周边”示意与入口。点击进入带机构名称的既有原生地图，真实拖动可改变城市视野；返回原机构详情及来源上下文。预览明确写明区位示意，地图明确写明“演示区位 · 非真实院址”。

复用武汉城区地图，没有机构 marker、院址断言、正式 Institution Geo 写入或真实导航 API。原生拖动取证：城市视野中心由 30.59000 / 114.30000 变为 30.61361 / 114.25886，仅是地图相机位置。非主讲机构继续使用原不可用原因和正式校验规则。

## INSTITUTION_VR_RESULT

同一机构详情直接显示 VR 预览；点击进入现有 Canvas WebGL 球面全景 Viewer。复用唯一既有 `vr-synthetic-test.jpg` 合成全景；预览与 Viewer 共用资源，没有重复打包大图。实际 WebGL rendered=true，坐标触摸后 yaw=340 / pitch=8；另一次拉近使 fov 从 75 变为 65。返回保持原机构。

近旁明确显示“演示空间 · 非真实机构实景”。没有把静态图片当作可交互 VR，没有生成正式核验资源，也没有放宽正式 HTTPS、revision 或 verification Gate。仅 Demo 构建将有效主讲上下文解析到既有演示引擎。正式机构专属素材仍未补齐，见既有[缺失素材清单](B1_2_5_MAP_VR_MISSING_ASSETS.md)：需真实院址 / Geo 及来源核验，以及机构授权的合法全景、预览、空间说明、revision 和 verification 元数据。

## CONSULTANT_DEMO_RESULT

新增稳定虚构顾问 `demo-consultant-xiaoan-v1`：演示顾问·小安，养老顾问（演示），服务区域武汉，演示可体验。卡片、服务说明、已保存老人需求摘要、机构咨询说明、固定问答、模拟联系、预约引导和四步服务流程均可用。没有资历年限、服务人数、职业资质、真实电话或二维码。

从详情进入保留当前机构并进入其 Demo 预约；直接打开顾问 Tab 时 story=null，仍展示完整介绍、需求摘要与推荐入口，不伪造选中机构。模拟咨询明确“未联系真人”；费用、床位、医疗能力回复要求进一步人工确认，没有拨号、消息、企微、网络预约或外部通信。

## FORMAL_ISOLATION

Demo 专用 story / consultant / 页面覆盖由 `scripts/support/demo-story-composition.mjs` 和既有 Demo 构建选择器组合；正式 Provider 和公开联系方式规则保持原实现。Production 产物不包含 demo 目录、演示组件、顾问 Fixture、管理入口或合成全景文件。

Demo 继续先安装原 API guard 再初始化。request、login、Storage、makePhoneCall、openLocation、openCustomerServiceChat 均 fail closed；自动化验证无真实外部副作用。Assessment V2、ElderProfile V2、Recommendation V2、Institution 事实及 verification、completed Visit 与 VisitEvaluation 字段语义不变。评价不写回推荐或机构事实。

## BUILD_SIZES

| 构建 | 本地 runtime bytes | 模块 / 路由 | 最终本地构建时间（北京时间） | 结果 |
| --- | ---: | --- | --- | --- |
| Demo | 1,942,871 | 200 / 30 | 2026-10-25 00:01:50.561 | PASS_LOCAL_BUILD |
| Production | 1,341,026 | 214 / 30 | 2026-10-25 00:02:16.200 | PASS_LOCAL_BUILD |

沿用 2,031,616 bytes 本地预算，不提高阈值。Demo 余量 88,745 bytes，本次修复增加696 bytes，仍比 B1.2.5 的 2,004,717 bytes 少61,846 bytes；Production 字节数不变。统计为 miniprogram 运行文件字节求和，不是微信最终包。

`B1.2.6_FINAL_WECHAT_PACKAGE = NOT_RUN`（未取得微信最终打包体积回执）。Owner 历史真机反馈不补齐最终包字节数或上传信息，本次亦未执行微信预览打包 / 上传。B1.2.5 原任务的 1,949,172 bytes 不可挪作本轮包体积。上表为本次修复后的本地双构建记录，既有 AppID `wx69f6bd834cebca33` 保持不变。

## E2E_RESULTS

原生 DevTools WXML/WXSS 逐页检查与实际坐标触摸结合使用。页面 handler 驱动跳转不等同所有按钮均用手指点击；地图拖动、WebGL 环顾与返回另有实际坐标操作。完整实际路径及页面栈见 [navigation-e2e.json](b1-2-6-evidence/navigation-e2e.json)。

| 验收项 | 结果与证据 |
| --- | --- |
| 1–3 首页、自动案例、个人中心 | PASS：无需“我的”工具初始化；首页 ready；“我的”三个记录入口 |
| 4 推荐至指定机构 | PASS：ready_soft_near → ready，home / revision 1，来源引用完整 |
| 5–6 详情地图、交互返回 | PASS：详情可见，native mapVisible=true，拖动更新，返回同一 detail |
| 7–8 VR 预览与全景返回 | PASS：详情可见，WebGL rendered=true，触摸 / 缩放有效，返回同一 detail |
| 9 顾问 Tab | PASS：完整服务与需求摘要，story=null |
| 10–12 机构咨询、模拟联系、预约 | PASS：机构上下文连续，固定回复无真实通信，同机构预约页 |
| 13 completed 三步评价 | PASS：仅显式 completed Visit 可进；21 个逐项评分＋独立费用判断；提交后只读 |
| 14 老人 / 历史 / 预约 / 评价回查 | PASS：老人详情、当次保存结果（6 行画像、推荐分组3/0）、3条预约、提交后重开 |
| 15 幂等加载 | PASS：重复加载仍为2/2/3；提交内容保留；没有复制或重置 |
| 16 正式隔离 | PASS：Production 无 Demo 顾问、Story、管理组件与合成素材 |

新检查 `check:b1-2-6-story` 覆盖 identity / revision / source、Tab 无假关联、咨询副作用、幂等预约、completed gate、快照不变及 stale epoch。最终重新执行 B1.2.5 continuity、run-mode convergence、双产物 JS 和包预算均 PASS，输出保存在 [final-checks.json](b1-2-6-evidence/final-checks.json)。

本轮另已通过：detail-v1-2-1 interactions（16）、institution-vr runtime、formal appointment-create runtime、visit-evaluation runtime（43）、B1.2.4 card-actions（112）、Recommendation V2（68/68；parity6/6；ancillary95）、JS checker self-test。既有地图 / 全景引擎离线检查21项通过，诊断保存在 `output/b1-2-6-local-verification/showcase-check/offline-results.json`；其 baseline 只记录验证前未改的引擎文件，不冒充阶段开始的全部 dirty 基线。

取证过程中一次跨多页长脚本超时，随后过早调用下一页方法；这些失败调用不计 PASS。改为逐页确认实际路由后完整复核成功。另一次工具连接返回 APPID_ERROR/aborted，重新只读确认同一 AppID 后预约→评价成功；没有重复任何上传。

## VISUAL_EVIDENCE

本节截图全部为原生 WXML/WXSS 渲染的既有 DevTools 证据，不是 Owner Android 截图。实际 windowWidth 为320、375、430，非430px下缩窄内容；导出 PNG 的408/479/549像素宽是模拟器缩放比例，不能当逻辑视口。150% 投影仅将 getSystemInfoSync 的 fontSizeSetting 从16模拟为24，未 mock windowWidth，不等同 Android 系统字体 / IME 实测。Owner 的整体手动通过另记于 ANDROID_OWNER_ACCEPTANCE，不更改这些证据的来源。

既有 Warm Swiss Token 与既有目录橙色复用；无新全局配色或 Token。统一圆角、间距、至少48px按钮；共享操作区纵向排列，修复430px / 150%时预约长按钮裁切。长机构名 / 顾问名以页面 setData 仅替换展示文字测试，未修改 Fixture 或快照。

| 视口 / 150% | 详情媒体按钮实际宽 × 高 | 顾问主按钮实际宽 × 高 | 内容最右侧 |
| --- | --- | --- | --- |
| 320 | 286 × 58.531 | 238.667 × 58.531 | 303 / 279.333 |
| 375 | 335.333 × 58.531 | 294 × 58.531 | 355.333 / 334.667 |
| 430 | 386 × 58.531 | 348.667 × 58.531 | 408 / 389.333 |

375根容器浮点舍入为375.333，实际内容仍在355.333内。430最终预约主按钮390 × 58.531、right=410，文字完整；页面有安全区及滚动留白。几何原始数据：[geometry.json](b1-2-6-evidence/geometry.json)。部分早期查询按 button 标签未返回矩形，JSON中 buttons=[]不代表没有按钮；表格使用后续 class 查询取得的实际值。

改造前截图为原有393px，记录内容与信息架构变化，未伪称与三个新视口等宽对照：

| 页面 | 改造前（393px） | 改造后 |
| --- | --- | --- |
| 我的 | [before-mine](b1-2-6-evidence/before-mine.png) | [320](b1-2-6-evidence/320-mine-final.png) / [375](b1-2-6-evidence/375-mine.png) / [430](b1-2-6-evidence/430-mine.png) |
| 顾问 | [before-consultant](b1-2-6-evidence/before-consultant.png) | [320](b1-2-6-evidence/320-consultant.png) / [375](b1-2-6-evidence/375-consultant.png) / [430](b1-2-6-evidence/430-consultant.png) |
| 机构 | [before-institution](b1-2-6-evidence/before-institution.png) | [320](b1-2-6-evidence/320-institution.png) / [430媒体](b1-2-6-evidence/430-institution-media.png) |

150%与长文本： [320长顾问](b1-2-6-evidence/320-font150-long-consultant.png)、[320长机构](b1-2-6-evidence/320-font150-long-institution.png)、[320地图入口](b1-2-6-evidence/320-font150-map-preview.png)、[320 VR入口](b1-2-6-evidence/320-font150-vr-preview.png)、[375顾问](b1-2-6-evidence/375-font150-consultant.png)、[375机构](b1-2-6-evidence/375-font150-institution-map.png)、[430机构](b1-2-6-evidence/430-font150-institution-media.png)、[430顾问](b1-2-6-evidence/430-font150-consultant.png)、[最终预约按钮](b1-2-6-evidence/430-font150-appointment-bottom.png)。

业务链路： [320首页](b1-2-6-evidence/320-home.png)、[推荐](b1-2-6-evidence/320-recommendation.png)、[原生地图](b1-2-6-evidence/320-map.png)、[交互全景](b1-2-6-evidence/320-vr-interaction.png)、[顾问Tab](b1-2-6-evidence/320-consultant-tab.png)、[看院安排](b1-2-6-evidence/320-appointment.png)、[评分矩阵](b1-2-6-evidence/320-evaluation-step2.png)、[老人](b1-2-6-evidence/430-elders.png)、[老人详情](b1-2-6-evidence/430-elder-detail.png)、[历史结果](b1-2-6-evidence/430-history.png)、[最终只读评价](b1-2-6-evidence/430-final-evaluation-reopened.png)、[二级演示设置](b1-2-6-evidence/430-demo-settings.png)。地图 / VR 的早期尺寸截图早于最后共享按钮纵排修正，保留作为当时真实渲染证据；最终预约图验证该修正，未把旧截图替换为模拟图片。

## CHANGED_FILES

本轮主要实现范围（不把既有 B1.2.4 / B1.2.5 dirty 文件全部归为新增改动）：

- `modes/demo/story.ts`、`story-name.ts`、`story-preview.{ts,wxml,less,json}`：受验证的机构上下文、展示别名与媒体入口。
- `modes/demo/consultant.ts`、`pages/consultant/*`、`pages/consultant.wxml`：虚构顾问服务及固定模拟回复。
- `modes/demo/pages/mine/*`、`pages/appointment/create.*`、`pages/showcase/*`、`pages/demo-story.less`：个人中心、演示预约、地图 / VR界面与二级设置。
- `modes/demo/tools.{ts,wxml}`、`record-pages.ts`、`evaluation-session.ts`：首页轻引导和展示名衔接。
- `scripts/support/demo-story-composition.mjs`、`scripts/build-run-mode.mjs`：仅 Demo 构建组合。
- `scripts/check-b1-2-6-story.mjs`、`check-wechat-js-compat.mjs`、`package.json`：专属回归与实际生成模块覆盖。
- `docs/architecture/FRONTEND_STRUCTURE.md`、本报告及证据；B1.2.5 上传状态文档补录原成功回执。

## REMAINING_RISKS

| 分类 | 项目 | 当前结论 |
| --- | --- | --- |
| 已关闭 | 顾问点击与反馈可见性 | Owner 2026-10-24手动复测修复版六项6/6 PASS；视觉与业务流程同时通过，已批准本地冻结 |
| 证据边界 | Codex ADB / 自动化真机业务测试 | `CODEX_ADB_AUTOMATION = NOT_RUN`；没有将 Owner 反馈或遗留远程调试信息变成自动化证据 |
| 未取得 | B1.2.6 微信最终打包体积回执 | `B1_2_6_FINAL_WECHAT_PACKAGE = NOT_RUN`；不能从runtime或旧包推算，后续上传仍须单独授权 |
| 未提供 | 本次Owner复测机型、微信 / 系统版本、构建标识 | 保留“未提供”，不补造；Owner明确验收对象为包含反馈可见性修复的B1.2.6 |
| 既有文档债务 | 全库文档检查21项失败 | 已用HEAD隔离导出确认均为既有问题，非本轮新增；不宣称全库文档检查PASS，不为本地冻结重写契约 |
| 已知 Demo 边界 | 城市地图无院址标记、合成 VR、固定虚构顾问 | 保留演示说明，不构成真实机构事实或真实通信服务 |
| 已知会话边界 | Demo 内存数据的暖启动 / 冷启动行为 | 同进程保留、进程销毁后重建是既定设计，不承诺跨进程新增数据持久化 |

本地功能与视觉冻结已获正式批准；顾问真机缺口关闭，保留上述证据和打包边界。没有待开发的B1.2.6功能；不把本地冻结升级为上传、提审或正式发布。

## FREEZE_DECISION

- Owner 已批准包含顾问修复的B1.2.6本地功能与视觉冻结，并授权相关成果本地Git提交。
- 顾问六项手动验收全部通过；没有要求补造机型、系统、微信版本或ADB记录。
- `READY_FOR_DEMO_UPLOAD = READY_TO_REQUEST_AUTHORIZATION`：具备申请上传授权的本地基线，尚未授权或执行上传；届时仍须核对模式、版本、AppID及最终微信包。

## READY_FOR_OWNER_VISUAL_REVIEW

`OWNER_ACCEPTED_AND_LOCALLY_FROZEN`。Owner视觉、业务流程和顾问专项均已通过。按本轮授权只完成本地Git提交；提交结果另见最终回执。停止后续操作，不push、上传、提审或发布。
