# 画像：已记录照护情况与后续提醒

2026-10-28，北京时间。本轮从 `2fe129d8ceb5f8054dfd0648011686a3fe98c82f` 开始，在 `codex/unified-source-baseline` 实施。

## 成果与当前能力

- 画像标题为“已记录的照护情况与后续提醒”。风险已记录、原答案不确定、具体护理需求未明确、回答冲突分别标明。
- 正常吞咽、偶尔吞咽不顺或容易呛咳、明显吞咽困难、不确定各自展示实际答案；风险已记录不表示已核验安全。提示核实进食照护安排和机构接收能力，无需重复作答。
- “可能需要康复”显示已选答案，解释它与特殊护理中的专门康复训练不同。知道需要专门训练时可到特殊护理修改；不清楚可保持原回答，无需重提健康情况。
- 已记录风险的编辑按钮使用可选语义；真实冲突保留两个相关原题入口。沿用单一事件链、导航守卫、失败反馈与返回画像的 onShow 刷新。
- Demo 覆盖模板同步修复，保留虚构机构标识。未新增路由、正式业务流程或专业核实功能。

## 保留的边界与真实风险

32 题、稳定 ID、选项、ElderProfile V2 派生规则、clarification 的 ID/status/priority、V2/C1 排序、安全过滤、readiness、历史快照与机构核验状态均未修改。`PROFILE_CLARIFICATION_RESOLUTION_PROPOSAL_V1.md` 仍是未实施方案。

吞咽风险仍待核实进食照护安排、机构是否具备能力及是否接收；康复是否需要专门训练仍未明确，不自动改为 required、not_required 或 verified。无法满足安全核实条件时不能生成已确认安全适合的推荐，仍可浏览机构公开资料。

既有实现中，吞咽澄清项保留但不单独阻断 readiness；康复训练作为 OTHER 能力的处理也保持原样。这是根 README 已记载的历史边界，本轮没有修订，也没有向用户承诺“不影响推荐”。新增合成回归同时验证现有 ready 场景和 ADL unknown 造成的真实 blocked 场景；后者仍无推荐及条件候选。

## 本轮自动化验证

使用合成输入，不读取真实老人草稿：

- `check:profile-clarification-guidance`：偶尔吞咽不顺+可能康复、正常/明显困难/不确定、康复训练明确、康复真实冲突、缺必填、编辑失败重试与返回刷新、同答案重复提交；逐个比较 Formal/Preview 全部语义及推荐结果，验证显示前后没有副作用。双模板检查防止 Demo 覆盖层漏同步。
- `check:profile-page-runtime` 20/20；`check:profile-v2-ui-runtime` 12/12；`check:profile-result-v2-interactions` 10/10。
- `check:assessment-v2-runtime` 44 项；`check:elder-profile-v2-runtime` 18/18、Formal/Preview 5/5、冻结 ADL 22 项；`check:recommendation-v2-runtime` 68/68、Formal/Preview 6/6；推荐 Preview 集成 20/20。
- C1 领域、组合和结果页回归通过；TypeScript 定向兼容检查通过。
- Demo/Production 双构建通过（31 路由，232/245 个生成模块）；模式源码隔离、模式运行隔离和两套实际生成 JS 兼容检查通过。

当前 package.json 没有名为 `check` 的总脚本，采用上述现有相关脚本。旧画像检查把已经存在的纯展示适配器 `runtime/institution-display.ts` 误判为机构业务模块；仅允许该精确路径后通过，实际领域/服务导入禁令及无外部副作用断言保留。

## 页面证据与下一步

微信开发者工具中以隔离 Demo 合成工程验证实际构建页面：320/375/430px、150% 字号的进食区及吞咽/康复提醒均可读，滚动后内容可见，未见横向溢出；另取得 320/375px 默认字号截图。150% 由测试工程模拟 fontSizeSetting=24，属于 DevTools 合成证据。本轮未取得手机验收。

截图与操作说明见 [GUI 验证摘要](../../../output/profile-recorded-care-20261028/GUI_SUMMARY.md)，例如 [375px 大字号提醒](../../../output/profile-recorded-care-20261028/375-font24-reminders-1.png) 和 [320px 康复说明](../../../output/profile-recorded-care-20261028/320-font24-reminder-rehab.png)。正常吞咽、明显困难、真正不确定和冲突等其余变体为自动化合成用例，不冒充逐一 GUI 截图。

在 375px、模拟 150% 字号下，实际点击“如需康复训练，修改特殊护理”进入认知与特殊护理，选择合成的康复训练并返回画像；提醒由 2 项变为 1 项，吞咽提醒继续保留。

下一步是 Owner 手机检查这两类提醒和编辑返回；真实进食照护及康复安排仍须结合实际情况与机构核实。本轮不上传微信、不提审、不发布、不部署、不打开真实服务。

## 修改入口

- [V2 展示投影](../../../miniprogram/presentation/assessment/profile-v2-view-model.ts)
- [正式页面模板](../../../miniprogram/pages/assessment/profile.wxml)、[Demo 覆盖模板](../../../modes/demo/overrides/pages/assessment/profile.wxml)、[页面样式](../../../miniprogram/pages/assessment/profile.less)
- [合成场景回归](../../../scripts/check-profile-clarification-guidance.mjs)、[V2 UI 检查](../../../scripts/check-profile-v2-ui-runtime.mjs)、[画像页面检查](../../../scripts/check-profile-page-runtime.mjs)
