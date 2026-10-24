# B1.2.5 — Demo Data Continuity & Service Flow Repair

2026-10-24 · 独立演示工程 · HEAD 保持 c109208。

## STATUS

`READY_FOR_OWNER_VISUAL_REVIEW_WITH_DEVICE_GAPS`。继续既有 B1.2.5，已完成本轮记录页、历史结果、预约、机构/VR 与三步评价的展示修复，双构建和相关回归通过。真实 320/375/430px Demo 视口及 150% 字体原生渲染已取证；Android 真机、真实软键盘弹出布局及最终微信打包体积仍为 NOT_RUN。没有 Git 提交、推送、预览上传、提审或发布。B1.2.4 / B1.2.5 原有未提交成果保留。

`DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED`：更新 FRONTEND_STRUCTURE 中共享记录展示、日期展示及评价布局职责，没有修改 Frozen Contract。Owner 已明确选择 **21 项数字评分 + 费用清楚/不清楚**，本轮不新增第 22 个分数字段。实现位置仍为独立工程 `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`；未写入正式工程。

## VISUAL_FIXES

- 老人、历史与预约记录共用 Warm Swiss 记录模板及既有颜色变量；提供标题、分隔、标签、适当间距和至少 44px 操作高度。页面渲染姓名与机构名，内部 ID 仅用于关联、key 和路由。
- 中国日期展示统一为 UTC+8 的“2026年10月20日 11:00”；原始 ISO、实体、快照和持久化不变。预约 Fixture 未提供时段，诚实显示“具体时间待确认”。completed 只来自显式状态。
- 历史结果按老人情况、照护需求、评估摘要、当次推荐结果分组，使用当次保存的 Assessment / Profile / Recommendation。推荐顺序不变；没有对象序列化输出。另存演示评估仅在既有 TEST ONLY 工具区提供。
- 评价页用机构与老人展示名代替内部标识；保留完整三步、21 项评分、收费清楚/不清楚、七费项、护理记录/交接、独立三项标签上限、200 字、摘要与修改、失败重试及防重。已提交查看隐藏提交按钮。
- 根据真实 footer 高度预留末尾空间，修复 320px / 150% 下最后一行被遮挡；修复放大字体时微信默认按钮行高导致文字裁切。键盘高度监听仅改变 footer 展示，hide/unload 解除监听；真实 IME 弹出未取得证据。
- 机构详情和 VR 页复用现有字体适配；精确 institutionId/revision/source/核验 Gate 保留，缺资料显示原因，无默认地图中心点或通用 VR 替代。

## ROOT_CAUSE_ANALYSIS

| 断点 | 已核实原因 | 修复 |
| --- | --- | --- |
| Demo 案例 | loadDemo 每次调用 resetDemo，装填当前草稿与匿名推荐预览，没有已完成历史实体 | 显式场景 Fixture、稳定实体 ID、已完成合成 Assessment/Profile/Recommendation 快照；重复加载幂等 |
| 老人档案 | 正式页面仍是不可用/骨架，没有 Demo 读取 Provider | 构建时选择隔离记录页，从同一 Session 读取多老人及对应历史 |
| 我的评估 | 页面读取独立 C5 历史后端，Demo 禁止真实网络与 Storage | Demo 专属记录 Provider；历史结果读取保存的快照，另存草稿追加新记录 |
| 我的预约 | Demo 构建把整个页面 WXML 替换为简易服务工具，五态筛选与列表未接通 | 恢复独立列表，显式 Fixture 状态及 completed Visit 关联 |
| 地图/VR | 地图 action 已有核验 Gate；VR 入口藏在护理展开区，未知时没有直接可见状态 | 详情顶部显示位置核验状态、VR 状态和入口；VR 页保留当前机构和 revision；未知仍不可用 |
| 看院评价 | 共享页面是单长表单，Demo 又被替换为简易四星工具；没有会话评价存储 | 恢复共享三步表单，替换 Demo 上下文/提交端口；草稿、提交与重进共用隔离 Session |
| 容量 | 实测阶段初始 Demo 为 2,031,602 bytes，预算仅剩 14 bytes | 同一基础 WXSS 前缀精确复用，节省 28,100 bytes；Demo 记录页替换消除不再引用的正式历史链路 |

目标 checkout 没有 AGENTS.md，也没有 PRD/视觉 PDF 实体；按用户所给工作约定执行，读取该 checkout 的当前 Contract 与 Product/UI 索引，并从正式工程对应路径只读取得索引指向的 V1.2 PRD 和 Warm Swiss Final Audit V1.2。未修改正式工程。

## DEMO_CASE_DATA_FLOW

```text
demo-case-continuity-v1 / TEST_ONLY / demo-user-continuity
  -> demo-elder-lin
     -> demo-assessment-lin-v1
        -> CompletedAssessmentV2 snapshot
        -> derived ElderProfileV2 snapshot
        -> saved RecommendationResultApplicationSnapshotV2
  -> demo-elder-chen
     -> demo-assessment-chen-v1 -> 同类型独立保存快照
  -> demo-appointment-demo-inst-chunhe-home
     -> demo-inst-chunhe-home / recordRevision 1
     -> demo-visit-demo-inst-chunhe-home / completed (显式 Fixture)
     -> demo-evaluation-demo-inst-chunhe-home / USER_REPORTED_DATA
```

另一条 requested 预约和一条已有 submitted 评价的 completed Visit 同样由 Fixture 明确声明。ID 不依赖列表索引、名称或展示文本。Demo 对象不进入正式 Provider、微信 Storage 或后端。显式重置及进程重启清除；Tab 切换、页面返回、页面重进、重复加载同一案例保留数据。epoch 只用于拒绝重置前的旧请求，不作为实体 ID。

## ELDER_PROFILE_RESULT / ASSESSMENT_HISTORY_RESULT / APPOINTMENT_HISTORY_RESULT

| 项目 | 结果 |
| --- | --- |
| ELDER_PROFILE_RESULT | PASS：两位合成老人，列表进入对应详情，合法 CompletedAssessmentV2 经固定 V2 派生器生成 Profile；关联该老人历史 |
| ASSESSMENT_HISTORY_RESULT | PASS：时间倒序；每条结果使用当次快照；当前草稿修改不覆盖历史；显式另存已完成草稿生成新 ID、新记录 |
| APPOINTMENT_HISTORY_RESULT | PASS：全部/待确认/已确认/已完成/已取消筛选；初始三条预约、两条 completed；未配置状态的筛选准确为空；完成状态不由时间推断 |
| 评价入口 | 合法 completed Visit 显示填写入口，提交后及预置已评价 Fixture 显示查看入口；返回列表立即刷新 |

截图：[老人列表](b1-2-5-evidence/batch-a-elders.png)、[老人详情](b1-2-5-evidence/batch-a-profile.png)、[评估历史](b1-2-5-evidence/batch-a-history.png)、[历史结果](b1-2-5-evidence/batch-a-result.png)、[预约](b1-2-5-evidence/batch-a-appointments.png)。

## INSTITUTION_MAP_RESULT / INSTITUTION_VR_RESULT

| 项目 | 结果 |
| --- | --- |
| INSTITUTION_MAP_RESULT | PASS：复用 V1.2.1 地址/Geo 核验 Gate；详情直接显示地址及地图状态；合法 action 保持原 institution/revision 的精确坐标；Demo 无实际院址坐标，显示待确认并禁止导航 |
| INSTITUTION_VR_RESULT | PASS（准确不可用路径）：入口与状态在详情可见；路由保留 canonical institutionId/revision/source；Viewer resolver 仍要求当前正式、合法、已核验 HTTPS 资源；Demo 机构没有合法场景，不关联通用演示素材 |
| 返回上下文 | DevTools 从指定机构进入 VR 不可用页，再返回同一机构详情通过 |

没有合成坐标替代 unknown，没有武汉中心点导航，没有静态图冒充机构 VR。原独立全景演示保留自己的非机构素材边界。

截图：[机构详情](b1-2-5-evidence/batch-b-detail.png)、[带机构身份的 VR 不可用状态](b1-2-5-evidence/batch-b-vr-unavailable.png)。

## VISIT_EVALUATION_STEP1 / STEP2 / STEP3 / PERSISTENCE

| 项目 | 结果 |
| --- | --- |
| VISIT_EVALUATION_STEP1 | PASS：初始整体评分 null；1–5 单选；三个考虑意愿；点击下一步才显示既有两个必填项错误 |
| VISIT_EVALUATION_STEP2 | PASS：21 项数字评分、费用清楚/不清楚、七项独立费用说明；完整护理记录、24 小时交接、交接内容与未确认互斥；保留 Contract 选填性 |
| VISIT_EVALUATION_STEP3 | PASS：满意/担心分别最多三项；200 字选填说明；九个分组完整列出评分、观察、费用及标签/说明；每组有修改入口 |
| VISIT_EVALUATION_PERSISTENCE | PASS（会话级）：稳定 evaluationId/visitId/institutionId/revision/Demo user；保存 USER_REPORTED_DATA；重进恢复，已提交只读；重复提交防重；失败保留输入并可重试；旧 epoch 拒绝 |

编辑草稿不自动变成提交评价。提交只通过隔离 TestOnly Provider；正式认证、owner、completed、幂等写入边界保持既有 Contract。正式 V1 没有评价内容读 API，本轮未扩展该 API。

截图：[Step 1](b1-2-5-evidence/batch-c-step1-430.png)、[Step 2](b1-2-5-evidence/batch-c-step2-430.png)、[Step 3](b1-2-5-evidence/batch-c-step3-430.png)、[摘要](b1-2-5-evidence/batch-c-summary.png)、[最终提交后重进](b1-2-5-evidence/final-reopened-evaluation.png)。

## DEMO_ISOLATION / FORMAL_DATA_SAFETY

- PASS：生产构建没有 demo 目录、demo-tools 或 Demo Session Provider；正式页面不能用 query/Storage flag 开启 Demo。
- PASS：Session 的 Assessment/Profile/Recommendation 与机构目录在评价前后完全不变；不写 verified facts、评分均值、公开评价或排序。
- PASS：Demo 真实 request/login/Storage/拨号/openLocation/cloud 等既有拦截保留；develop/trial 隔离与错误身份/环境 fail closed 回归通过。
- PASS（DevTools）：正式首页没有 Demo 工具；正式历史 0 条演示记录；预约无假记录；传入 Demo visitId 的正式评价页保持 unavailable/contextMode=none。
- 正式既有历史/预约后端未配置时保留诚实的不可用状态；未测试真实后端、真实用户提交或真实拨号。

截图：[正式历史](b1-2-5-evidence/production-history.png)、[正式预约](b1-2-5-evidence/production-appointments.png)、[正式拒绝 Demo Visit](b1-2-5-evidence/production-demo-visit-unavailable.png)。正式窗口实测 320px、fontSizeSetting 16；该证据只覆盖不可用状态，不代表 320px Demo 评价矩阵通过。

## BUILD_RESULTS / BUILD_SIZES

双模式：TypeScript 4.1.2 语义检查、Less、离线原生 WXML 编译及生成 JS 兼容检查 PASS。生成产物通过 fresh build 后的 DevTools 页面验证。未取得微信签名打包后的主包大小。

| 模式 | 本地 runtime bytes | 模块 | 路由 | 原预算 | 剩余 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Demo | 2,004,717 | 210 | 30 | 2,031,616 | 26,899 |
| Production | 1,341,026 | 214 | 30 | 2,031,616 | 690,590 |

本轮展示修复相对前次 B1.2.5 构建（Demo 2,001,088 / Production 1,339,415 bytes）增加 3,629 / 1,611 bytes，仍在原预算内。Demo 基础样式精确复用节省 25,295 bytes，Production 节省 28,100 bytes。没有提高阈值、关闭测试或新增分包。表中为本地 runtime 文件 bytes，不是最终微信签名打包主包大小；后者未运行上传/打包验收。

## TESTS

| 实际执行 | 结果与范围 |
| --- | --- |
| check:b1-2-5-continuity | PASS：A/B/C、并发加载幂等、快照校验、历史不变、追加重评、五态筛选、三步、重进、失败重试、重复提交、epoch 与正式隔离 |
| check:visit-evaluation-runtime | 43 cases PASS，既有正式上下文/字段校验/幂等/失败映射保持，增加键盘高度事件展示与监听释放检查 |
| check:institution-detail-v1-2-1-interactions | 16 cases PASS，精确地图/电话 payload、不可用 Gate、防重与重试 |
| check:institution-vr-runtime | PASS，身份/revision/provenance/HTTPS/核验 Gate，以及不可用上下文入口 |
| check:run-mode-convergence | PASS，正式/Demo 构建隔离、搜索、旧会话拒绝及真实 API 不转发 |
| check:wechat-js-compat | Demo 210 / Production 214 生成模块 PASS；--demo 只切换实际替代 Provider 的覆盖清单，保留正式清单 |
| check:wechat-js-compat:self-test | 前次 B1.2.5 已执行 PASS；本轮未改探测器 |
| check:recommendation-v2-runtime | 前次 B1.2.5 已执行：68/68 固定 Fixture、6/6 formal/preview parity、95 ancillary cases PASS；本轮未改推荐领域规则 |
| check:v2-1-b1-2-4-card-actions | 112 assertions PASS，上轮卡片动作回归 |
| check:v2-1-b1-2-home | 前次 B1.2.5 已执行 43 assertions PASS；本轮未改首页 |
| check:run-mode-package-size / git diff --check | PASS；既有 EOL 提示仍存在 |

## E2E_TEST_RESULTS

固定 `demo-case-continuity-v1`；DevTools native runtime 的页面 handler 自动化，包含实际坐标点选评分；不是人工手机操作。

| 步骤 | 结果 | 证据 |
| ---: | --- | --- |
| 1 打开小程序 | PASS | DevTools HOME / runMode DEMO |
| 2 加载案例 | PASS | ready=true，无错误 |
| 3 进入我的 | PASS | 原 Tab 及入口 handler |
| 4 查看老人档案 | PASS | 两位老人、对应详情截图 |
| 5 查看历史及结果 | PASS | 两条历史、6 行画像摘要、保存的推荐快照 |
| 6 查看预约 | PASS | 全部三条，已完成筛选两条 |
| 7 对应机构详情 | PASS | demo-inst-chunhe-home / revision 1 |
| 8 地图信息 | PASS（不可用） | 当前机构地址待确认，无导航 action |
| 9 VR | PASS（不可用） | 同 institutionId/revision，url 空，返回原详情 |
| 10 合法 completed Visit | PASS | demo-visit-demo-inst-chunhe-home |
| 11 Step 1 | PASS | 初始未选，校验、选分及考虑意愿 |
| 12 Step 2 | PASS（Owner 确认范围） | 21 项评分 + 费用清楚/不清楚 + 七费项 + 护理观察 |
| 13 标签 | PASS | 第四项被阻止，满意/担心独立 |
| 14 完整摘要 | PASS | 九组，逐组修改入口 |
| 15 提交 | PASS | 快速双调用仍一份 submitted |
| 16 返回再查看 | PASS | 相同 evaluationId，21 项分数及九组摘要恢复 |
| 17 重载不重复 | PASS | 预约 count=3 / unique=3；已评价入口仍为查看；老人/评估去重另有 runtime 全量等值断言 |

## 视觉与触控证据

本轮通过开发者工具设备菜单分别选择真实 320×568 自定义设备、iPhone 12/13 mini 375×812、iPhone 14/15 Pro Max 430×932。切换后用未 mock 的 getSystemInfoSync 核实 windowWidth；再只投影 fontSizeSetting=24（默认 16，150%），不修改 viewport 或页面宽度。截图来自实际 WXML/WXSS；导出图片会按 DevTools 显示缩放，PNG 像素宽不等于逻辑 CSS 视口宽。

### 320PX_RESULT / 150_PERCENT_RESULT

| 实际视口 / 页面窗口高度 | 默认 / 150% 评分 cell | 最大 cell 右边界 | 150% 最终摘要 bottom / footer top | 结果 |
| --- | --- | --- | --- | --- |
| 320 / 514px | 105 个，最小 54.80×44px | 303.01px < 320px | 318.89 / 370.72px | PASS：无横向溢出，末尾可滚动至按钮上方 |
| 375 / 730px | 105 个，最小 60.67×44px | 355.33px < 375px | 480.06 / 570.72px | PASS：底部安全区及放大文字完整 |
| 430 / 850px | 105 个，最小 70×50px | 408px < 430px | 587.15 / 681.11px | PASS：长摘要与底部操作无重叠 |

几何数据是同一 selectorQuery 坐标系下的逻辑 px；其中 footer 矩形随原生导航栏/页面滚动坐标呈现，应比较同次测量的 summary bottom 和 footer top。完整 105 cell 矩形、safeArea、scrollTop、最终/中间 footer 数据及 21 项实际坐标点击结果见 [geometry.json](b1-2-5-visual-evidence/geometry.json)。每个评分项先滚动到可见位置，再读取当前矩形、坐标点击 4 分并核对对应 selected；21/21 通过，不以直接调用评分 handler 代替此项证明。

本轮先发现 320px / 150% summary bottom=397.76 超过 footer top=380.83 的真实遮挡，修复后复测上述最终间距。`footer-before` 是失败证据，`footer-after` 是中间版本，`footer-final` 才是最终按钮字号/行高下的结论。之前 430px 内窄内容替代测试仅保留为历史，不参与本轮真实 320px PASS。

| 审查内容 | 本轮原生截图 |
| --- | --- |
| 320 老人/详情/历史/预约 | [老人](b1-2-5-visual-evidence/320-elders.png)、[详情](b1-2-5-visual-evidence/320-elder-detail.png)、[历史结果](b1-2-5-visual-evidence/320-history-result.png)、[推荐分组](b1-2-5-visual-evidence/320-history-recommendation.png)、[预约](b1-2-5-visual-evidence/320-appointments-final.png) |
| 320 矩阵与底部 | [默认矩阵](b1-2-5-visual-evidence/320-matrix.png)、[150% 矩阵](b1-2-5-visual-evidence/320-font150-matrix.png)、[150% 最终底部](b1-2-5-visual-evidence/320-font150-footer-final.png) |
| 375 页面与矩阵 | [老人](b1-2-5-visual-evidence/375-elders.png)、[历史](b1-2-5-visual-evidence/375-history.png)、[默认矩阵](b1-2-5-visual-evidence/375-matrix.png)、[150% 矩阵](b1-2-5-visual-evidence/375-font150-matrix.png)、[150% 长摘要最终底部](b1-2-5-visual-evidence/375-font150-long-summary.png) |
| 430 页面与矩阵 | [老人](b1-2-5-visual-evidence/430-elders.png)、[详情](b1-2-5-visual-evidence/430-elder-detail.png)、[默认矩阵](b1-2-5-visual-evidence/430-matrix.png)、[150% 矩阵](b1-2-5-visual-evidence/430-font150-matrix.png)、[150% 长摘要最终底部](b1-2-5-visual-evidence/430-font150-long-summary.png) |
| 长名称 | [320 长老人姓名](b1-2-5-visual-evidence/320-long-elder-name.png)、[375 长机构名](b1-2-5-visual-evidence/375-long-institution.png)、[430 / 150% 长老人名](b1-2-5-visual-evidence/430-font150-long-elder.png)、[430 / 150% 长机构名](b1-2-5-visual-evidence/430-font150-long-institution.png) |
| VR 不可用 | [430 / 150%](b1-2-5-visual-evidence/430-font150-vr-unavailable.png)：同一机构/revision，url 为空，无内部 ID 文案 |
| 返回与已提交查看 | [返回预约再进入](b1-2-5-visual-evidence/320-submitted-reopened.png)、[最终 150% 只读页](b1-2-5-visual-evidence/320-font150-submitted-final.png)：21 分项、200 字恢复，footer 为 null |

长姓名/机构名只通过当前 Page 展示数据做 synthetic 排版投影，未改案例实体或机构事实。长评价通过真实 textarea 输入通道填写并按既有规则截到 200 字。默认/150% 矩阵、长文本滚动、分组修改、重复提交、返回重进与重复加载均通过。所有字体 mock 已 restore。

### 键盘与证据边界

DevTools 实际点击 textarea 后可输入 200 字，但桌面工具没有弹出手机软键盘，未观察到真实高度事件；[输入焦点截图](b1-2-5-visual-evidence/320-comment-focus.png) 不能作为 IME 弹出通过证明。43 项评价 runtime 检查验证 height>0 时隐藏 footer、关闭后恢复、草稿不变及 hide/unload 释放监听；这是模拟事件测试。**真实键盘弹出布局 NOT_RUN**，需 Android 实机继续验收。

DevTools 在反复替换生成目录后两次出现空白页/自动化超时；只清理对应项目编译缓存后恢复。失败时的截图/空状态没有计为 PASS。构建文件检查与原生运行证据分开记录。

## ANDROID_REAL_DEVICE

`NOT_RUN`。本轮再次执行 adb devices -l，仅显示空设备列表。未上传新体验版或触发手机预览；DevTools 证据不替代 Android 人工触控、真实软键盘、安全区、真实用户身份、真实后端写入或真实地图/VR 播放证明。

## MAP_VR_MISSING_ASSETS

已额外交付 [缺失素材清单](B1_2_5_MAP_VR_MISSING_ASSETS.md)：逐条列出 12 家合成机构现状，以及正式机构地址/GCJ-02、版本与核验证据、授权院区照片、HTTPS Viewer、封面 media、非空场景和来源授权要求。当前全部保持 unknown / 不可用，不填假资料。

## CHANGED_FILES

本阶段涉及以下文件；不是对全部 git diff 的重新归属。当前工作区还保留 B1.2.4 的既有未提交修改：

- `modes/demo/session.ts`、`scenario.ts`、`record-pages.ts`、`record-presentation.ts`、`evaluation-session.ts`、`tools.ts`、`tools.wxml`。本轮展示修复没有改 session/scenario 实体。
- `modes/demo/pages/elder/{index,detail}.{ts,wxml,less}`、`pages/assessment/history.{ts,wxml,less}`、`pages/appointment/index.{ts,wxml,less}`。
- `modes/demo/pages/records.{wxml,less}`、`miniprogram/utils/display-date.ts`、`miniprogram/runtime/evaluation-session.ts`。
- `miniprogram/pages/institution/{detail,vr}.{ts,wxml}`、`miniprogram/pages/institution/vr.less`。
- `miniprogram/pages/visit/evaluation.{ts,wxml,less}`。
- `scripts/build-run-mode.mjs`、`check-b1-2-5-continuity.mjs`、`check-wechat-js-compat.mjs`、`check-visit-evaluation-runtime.mjs`、`check-institution-vr-runtime.mjs`。
- `package.json`、`docs/architecture/FRONTEND_STRUCTURE.md`、本报告、`B1_2_5_MAP_VR_MISSING_ASSETS.md`、前次 `b1-2-5-evidence/` 及本轮 `b1-2-5-visual-evidence/` 截图/几何数据。

## REMAINING_RISKS / NEXT

1. 真实 320px Demo 矩阵已补齐；Android 人工触控/滚动/软键盘验收仍 NOT_RUN，不能用 DevTools 或模拟事件关闭该 Gate。
2. Demo 为已有安全边界内的内存会话；显式重置、重新编译或进程重启会清除。跨重启持久保存未实现，也未放开微信 Storage 权限。
3. 当前合成机构无合法院址/VR 资源，本轮完整验证准确不可用路径；真实导航和可播放 Viewer 仍需合法真实资源验证。
4. 最终微信打包大小没有证据；当前为原预算下本地 runtime bytes。
5. 后续任何新 Demo 体验版上传须 Owner 明确确认；本轮停在可审查结果，不自动提交、推送或发布。

## READY_FOR_OWNER_VISUAL_REVIEW

`YES_WITH_EXPLICIT_DEVICE_GAPS`。可审查本轮真实三尺寸截图、几何数据与展示修复；不表示 Android/软键盘或最终微信包体验收已通过。所有已执行的相关自动化、双构建和包预算检查通过。完成后停止，等待 Owner 审查。

## Owner 后续授权：Demo 体验版准备

Owner 随后明确授权新版 Demo 上传供 Android 17 验收。双构建与关键回归均 PASS，版本 `1.2.5-demo.1024.1730` 的原上传任务最终查询为 success / execution_success；任务完成时间为 2026-10-24 17:32:00.953（北京时间），最终 upload 回执包大小 1,949,172 bytes，与 preview 一致，不同于 Demo runtime 2,004,717 bytes。没有重复上传；ANDROID_ACCEPTANCE 仍 NOT_RUN。详细状态、原回执与真机清单见 [Demo 上传与 Android 验收](B1_2_5_DEMO_UPLOAD_AND_ANDROID_ACCEPTANCE.md)。前文未打包表述仅代表此前视觉修复轮次；上述数值不代表后续 B1.2.6 本地版本的最终微信包体积。
