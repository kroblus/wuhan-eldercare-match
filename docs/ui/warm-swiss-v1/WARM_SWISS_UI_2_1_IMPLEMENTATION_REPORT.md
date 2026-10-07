# WARM_SWISS_UI_2_1 Implementation Report

日期：2026-10-07。Document role = `AUDIT_ONLY`。记录当前代码精修和验证，不替代 frozen visual baseline、CURRENT architecture 或 Frozen Contract。

```text
STATUS = PASS_WITH_RISKS
PHASE = WARM_SWISS_UI_2_1
MAIN_SESSION_ONLY = TRUE
PROFILE_TOP_LAYOUT = PASS
PROFILE_INFORMATION_HIERARCHY = PASS
RECOMMENDATION_SUMMARY = PASS
RECOMMENDATION_INFORMATION_HIERARCHY = PASS
RECOMMENDATION_BLOCKED_CTA = PASS
HOME_TABBAR_ICON_AUDIT = CONFIG_GAP
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = NONE
TESTS = PASS (11 relevant script checks; JSON; diff)
DEVTOOLS = PASS (actual Simulator, separate from manual device evidence)
VISUAL_EVIDENCE = 11 valid new Simulator PNGs + 10 unchanged before copies
ANDROID_17_MANUAL_GATE = PENDING
VISUAL_DEVIATIONS = existing lawful VM content; page-local hierarchy refinements
AFFECTED_OTHER_PAGES = NONE
PRE_EXISTING_CHANGES_PRESERVED = TRUE
DOC_IMPACT = AUDIT_ONLY
READY_FOR_WARM_SWISS_UI_3 = FALSE (requires owner authorization; no UI-3 work started)
STAGE = NONE
COMMIT = NONE
PUSH = NONE
```

## 范围、依据与修改前问题

Main session 完成全部视觉判断、实现与验收；未启动任何 subagent。先读 README、UI-2 report 和相关旧截图，再按 Profile → 检查 → Result → 检查 → Home 只读审计 → DevTools → evidence/report 的顺序执行。V1.2 冻结 PDF 仅阅读相关第 3–8、19 页，未重新读取全部 23 个页面。采用 Profile UI V2 integration、Recommendation Result UI V2 integration 和 WeChat Interaction V2 中与本次展示、事件有关的边界；Recommendation V2 Skill 按 UI-only 路径使用 integration Contract，未重新读取全部上游算法规则。

UI-2 的 Profile headline 与修改入口横向竞争，测试摘要在“视觉验证”内部断行；字段标签、重点答案和 helper 的层级接近。Result 的数量与 no-exact 标题都较重，差异文案被限制在图片右侧窄列，推荐理由、需要确认与生活适配的标题层级接近。readiness blocked 的调整需求动作位于通用看院建议之后。Home 旧截图有 Tab 文字，未显示图标。

## FILES_CHANGED / 实际修改

本轮增量以 `output/warm-swiss-ui2-1/*.before` 保存的 UI-2 工作区版本为起点，而非用 Git HEAD 混入 UI-0/1/2 的既有修改。

| 生产文件 | 本轮修改 |
| --- | --- |
| `miniprogram/pages/assessment/profile.wxml` | 原 headline 独立占满内容宽度；关系说明与原 basic 修改节点组成辅助行。为原 rows 添加页面内视觉分组类，数据表达式、字段、事件和参数原样保留。 |
| `miniprogram/pages/assessment/profile.less` | headline 保持原字号，自然换行、长词兜底，不设置固定高度或截断。标签使用 secondary，helper 保持 muted；只加强照护等级/行动方式、主要健康信息、机构偏好、预算的既有答案；普通字段保持正常正文。照护摘要与七项 ADL 之间加细线，独立饮食区块改为同一左基线以扩大合法长文本宽度。 |
| `miniprogram/pages/recommendation/result.wxml` | 数量 → 原匹配状态 → 原 summary → focus。把原 differences 节点移出图片旁的窄列，保持原数组与顺序。把原 ready 分支的调整按钮与错误反馈收为页面 WXML template：readiness blocked 在 guidance 后调用 primary，其他正常结果在原底部位置调用 secondary；两个调用条件互斥。错误页原出口保留。 |
| `miniprogram/pages/recommendation/result.less` | 数量保留主标题权重；有数量时状态标题降为正文级说明。理由标题深色，差异/生活适配标题中性，组间细线和留白；差异全宽渲染。保留正文/条目原字号，未以缩小正文提高密度。Mock 声明始终可见，以 secondary 文字区别于决策标题。 |

另新增本报告及 `output/warm-swiss-ui2-1/` 的截图、before 副本、测试/运行证据、哈希检查与只展示实际原图的 HTML 对比页。没有修改 TS、ViewModel、Domain、Store、Provider、Server、fixture、Home、app.json、global tokens、shared components、Agent Engineering 配置、Frozen PDF 或 README 的基线版本。

## Contract safety / 信息保留

- `headline / relationshipLine / basicRows / overviewTags` 原样读取；没有拆分 headline 或猜测姓名、年龄、性别、careLevel。长名称样本仍经过原正式 Profile runtime 得到合法 VM。
- 01–05、七项 ADL、mobility、careModes、健康、独立进食与饮食、认知/特殊护理、preferences、budget/intent、一次 budget advisory、clarifications、unknown 和全部编辑/恢复出口保留。展示类只控制字重、颜色和对齐，不改变 tone 或数据来源。
- 候选数量仍直接来自 `viewModel.cards.length`，正常测试为 3 家 `ready_soft_near`；no-exact headline/summary 原样保留。没有改变 tier、排序、why-fit、needs-confirm、NO_EXACT_MATCH 或 source revision。
- 首家机构保留 4 reasons、2 differences、3 compactFacts。相近“资料不足”来自不同源字段/投影，不进行去重：differences 对应房型/餐次差异，compactFacts 对应生活适配与 VR 缺失状态。不能以文字相似判断同一语义。
- 原 Mock banner、dataset label、开发机构名称与价格 provenance、“暂无机构图片”、未核验/待确认和 VR 缺失说明持续存在；没有制造真实机构资料、图片或 VR。
- readiness blocked 仍为 `no_safe_recommendation / ELDER_READINESS_BLOCKED`，cards=0。只移动既有纠正 Action；template 内 primary-button 只有 `bind:action="onAdjustNeeds"`，不绑定 native tap。运行时只有一个 ready 分支调整入口。原 NavigationGuard、Back、失败反馈、route 和 source context 不变。

## TESTS

全部原 Gate 保持原样，没有修改测试。详见 [Profile 输出](../../../output/warm-swiss-ui2-1/profile-tests.json) 和 [Result 输出](../../../output/warm-swiss-ui2-1/result-tests.json)。

| 检查 | 本轮结果 |
| --- | --- |
| Profile page runtime | PASS，17 cases |
| Profile V2 UI runtime | PASS，12 cases |
| ElderProfile V1 runtime | PASS，45 cases |
| ElderProfile V2 runtime | PASS，18 fixtures，5 formal/preview parity，22 ADL parity，10 boundaries |
| Recommendation V1 runtime | PASS，117 cases |
| Recommendation V2 runtime | PASS，68 cases，6 formal/preview parity，determinism/permutation/immutability |
| Recommendation Result page | PASS，30 cases |
| Recommendation Result V2 UI | PASS，18 snapshot + 30 UI cases |
| Profile–Result V2 bindings | PASS，10 cases |
| Institution navigation A0-4 | PASS，25 cases |
| WeChat targeted TS 4.1.2 compatibility | PASS，0 diagnostics |
| app / Profile / Result JSON | PASS，3 files |
| git diff --check | PASS |

Assessment completion 未受影响：无 Assessment handler、答案、validation、完成门禁或 TS 修改，因此未额外执行 completion suite。TS/generated class runtime 未改，JS class-compat 与 self-test 无新增受影响面；本轮没有重复跑这些无变化 Gate。两页 WXML 的最新模板编译摘要成功；它们只证明模板检查，实际页面渲染由下方截图证明，不把 refresh/open-page 的触发成功当整包编译 PASS。

## DEVTOOLS / VISUAL_EVIDENCE

证据类型为 `DEVTOOLS_SIMULATOR_AUTOMATION`，不是人工 Android 或 ADB。实际 Simulator 390×844 CSS px，bottom inset=34；有效 PNG 为 512×1103。11 张新截图逐张查看：长名称、右侧修改入口、02/03/04 层级、独立饮食、预算/待确认、StickyFooter、机构编号、费用、理由、全宽差异、生活适配、详情入口与阻断 CTA 均可见。

| 证据 | before | after |
| --- | --- | --- |
| Profile top | [before](../../../output/warm-swiss-ui2-1/profile-top-before.png) | [after](../../../output/warm-swiss-ui2-1/profile-top-after.png) |
| Profile middle | [before](../../../output/warm-swiss-ui2-1/profile-middle-before.png) | [after](../../../output/warm-swiss-ui2-1/profile-middle-after.png) |
| Profile bottom | [before](../../../output/warm-swiss-ui2-1/profile-bottom-before.png) | [after](../../../output/warm-swiss-ui2-1/profile-bottom-after.png) |
| Profile pending | [before](../../../output/warm-swiss-ui2-1/profile-pending-before.png) | [after](../../../output/warm-swiss-ui2-1/profile-pending-after.png) |
| Result top | [before](../../../output/warm-swiss-ui2-1/recommendation-top-before.png) | [after](../../../output/warm-swiss-ui2-1/recommendation-top-after.png) |
| Result first | [before](../../../output/warm-swiss-ui2-1/recommendation-first-before.png) | [after](../../../output/warm-swiss-ui2-1/recommendation-first-after.png) |
| Result last | [before](../../../output/warm-swiss-ui2-1/recommendation-last-before.png) | [after](../../../output/warm-swiss-ui2-1/recommendation-last-after.png) |
| Result bottom | [before](../../../output/warm-swiss-ui2-1/recommendation-bottom-before.png) | [after](../../../output/warm-swiss-ui2-1/recommendation-bottom-after.png) |
| Readiness blocked | [before](../../../output/warm-swiss-ui2-1/recommendation-readiness-blocked-before.png) | [after](../../../output/warm-swiss-ui2-1/recommendation-readiness-blocked-after.png) |
| Home read-only | [before](../../../output/warm-swiss-ui2-1/home-tabbar-before.png) | [audit](../../../output/warm-swiss-ui2-1/home-tabbar-audit.png) |

额外 [长中文名称](../../../output/warm-swiss-ui2-1/profile-long-name-after.png) 测试使用 19 字符 TEST_ONLY 名称：中文片段保持完整，72 岁自然进入第二行；没有裁切、越界、重叠或挤压修改入口。没有拆分 headline、改字号或硬截断。

[原图对比页](../../../output/warm-swiss-ui2-1/evidence-gallery.html) 只并排展示实际截图，没有修饰或合成截图。[运行证据摘要](../../../output/warm-swiss-ui2-1/runtime-evidence.json) 不含完整健康答案/Profile。

实际运行检查：

- normal Profile ready，clarification=0；pending Profile 仍 ready，clarification=1；未知吞咽信息保留。
- normal Result 为 3 家接近候选；pending Result 为 readiness blocked、0 cards，无虚假的重新匹配成功状态。
- 移动后的 Profile Basic 修改节点 native selector tap → Basic。
- 首张机构卡 native selector tap → Detail ready；`institution-a-mock / recordRevision=2 / source=recommendation`、非空 source context 保留。Detail Back → Result → Profile。
- blocked 的 template 按钮 custom `action` trigger → 原 Profile 父页，当前栈只余 Budget / Profile；同时 querySelectorAll 证明该正常分支只渲染一个调整入口。此操作是 custom-event 证据，不能称为人工 physical tap；快速点击/失败 guard 由原 page/runtime Gate 覆盖。
- 错误 console filter 无命中，只表示没有匹配 `error`，不等于全量日志为空。

取证恢复过程：初始 `simulator_open_page` 使用正斜线路径的调用 300 秒超时；截图两次只得到 2×2，无效图以 `invalid-2x2-profile.png` / `screenshot-diagnostic.jpg` 隔离，未计入视觉证据。Computer Use 发现 DevTools 窗口最小化，恢复后使用规范 Windows 路径，实际 refresh/nav、路由/selector/TEST_ONLY 状态确认后重新取图成功。Storage seed 后须 refresh 重建原 store 内存快照，不能把旧页面当新 fixture 证据。

三个原 Draft storage 项只在临时内存备份，测试结束逐项按原 present/value 恢复并验证 `storageRestored=true / checkedKeys=3`，释放备份，refresh 清除测试内存状态并返回 Home。测试 fixture 仅来自既有 TEST_ONLY 输出，没有更改或新导入生产 fixture。

## HOME_TABBAR_ICON_AUDIT

`HOME_TABBAR_ICON_AUDIT = CONFIG_GAP`。

- `miniprogram/app.json` 的 `tabBar.custom` 未启用，实际为原生 tabBar；`window.navigationStyle="custom"` 指导航栏，不是 custom tabBar。
- list 三项为 Home / Consultant / Mine，各项只有 `pagePath` 和 `text`，均没有 `iconPath` 或 `selectedIconPath`。
- 因没有配置资源路径，当前不存在待校验的已引用 icon 文件，也不存在“配置路径错误/文件丢失”的证据。未发现 `custom-tab-bar` 目录或源码 `wx.setTabBarItem` 动态补图标逻辑；相关 icon/asset 文件名检索无 Tab 图标命中。
- 两轮实际 Home 截图都有文字标签、无图标，与当前配置一致；这不是单凭截图猜测 DevTools 渲染失败。
- 最小建议：负责人如批准独立修复，再选定真实本地 Tab 资源，分别配置三项 normal/selected icon 路径并验证文件存在、DevTools/真机展示。此次不新增资源、不改 app.json/tabBar/Home，不更换 custom tabBar。

## VISUAL_DEVIATIONS / RISKS / WORKTREE / STOP

1. Profile 仍采用一个合法 headline，不拆成视觉示例中的独立身份字段。独立饮食区块为 frozen integration 批准内容，仍保留；本轮以同一 40rpx 左基线提高其长文本可读性。
2. Result 仍包含完整 Mock 声明、全部差异与生活适配信息、通用看院建议和真实缺失状态。保留相近文案的不同来源，不做业务去重或删项。没有将接近候选升级为完全匹配。
3. blocked 调整按钮用原 primary variant 提高当前纠正动作权重；其他正常结果仍在原底部位置使用 secondary。没有修改按钮组件、事件语义或重算业务状态。
4. `ANDROID_17_MANUAL_GATE = PENDING`。本轮没有新的人工物理设备验证，也没有 ADB 证据。直接视觉证据只有一个 390px Simulator viewport；现有 ≤360px responsive 规则保留，但没有本轮窄屏截图，不能将窄屏或真机标为 PASS。
5. Home 图标属于独立配置缺口，本轮按只读范围结束；未来修复需独立授权。

[Preservation check](../../../output/warm-swiss-ui2-1/preservation-check.json)：开始时 848 个已有文件中，仅四个允许页面文件发生本轮修改，其余 844 个逐文件 byte-identical；包含原 UI-0/1/2、全部旧证据、Home、tokens/shared、PDF/README、package/scripts 和 pre-existing Agent/config changes。index 为空。没有 reset、restore、checkout、clean、stage、commit 或 push。

本轮 `DOC_IMPACT = AUDIT_ONLY`，没有长期 route/ownership/application/provenance 边界变化，无需 CURRENT 架构更新或 successor Contract。Visual Polish 范围已完成并可供负责人审阅。`READY_FOR_WARM_SWISS_UI_3 = FALSE` 表示尚未获负责人批准进入下一阶段，不是本轮技术检查失败。到此停止，没有开始 UI-3、扩展到其他页面或修改冻结基线。
