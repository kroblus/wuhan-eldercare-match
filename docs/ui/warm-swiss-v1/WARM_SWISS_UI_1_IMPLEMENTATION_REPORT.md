# WARM_SWISS_UI_1 Implementation Report

日期：2026-10-07。Document role = `AUDIT_ONLY`；本报告不替代 CURRENT architecture 或 Frozen Contract。

```text
STATUS = PASS_WITH_RISKS
PHASE = WARM_SWISS_UI_1
MAIN_SESSION_ONLY = TRUE
HEALTH = PASS
ADL = PASS
COGNITIVE = PASS
PREFERENCE = PASS
BUDGET = PASS
TOKENS_CHANGED = NONE
SHARED_COMPONENTS_CHANGED = single-choice / multi-choice / assessment-footer
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
ANDROID_17_MANUAL_GATE = PENDING
AFFECTED_OTHER_PAGES = NONE
PRE_EXISTING_CHANGES_PRESERVED = TRUE
DOC_IMPACT = AUDIT_ONLY
READY_FOR_WARM_SWISS_UI_2 = TRUE
COMMIT = NONE
STAGED_CHANGES = NONE
```

`READY_FOR_WARM_SWISS_UI_2` 表示本阶段实现与证据已可供负责人审阅，不表示已批准进入 UI-2。本次到此停止；没有继续修改 Profile、Recommendation 或其他页面。

## CHANGES

以 README 指定的 V1.2 PDF（重点第 4–7、16–18 页）和 UI-0 Basic 代表页为依据，由 Main session 完成全部分析、实现和验证；未启动 subagent。

- 五页统一复用 AppHeader、6-step Progress、编号分区、细分隔线、warm white、原字号/spacing scale、Radio / Checkbox、selected terracotta 与 StickyFooter。保留全部正式 option、code、required 和事件绑定。
- 新增 `miniprogram/styles/assessment-warm-swiss.less`，仅由五页导入，复用 UI-0 的 page surface、40rpx 页边距、32rpx 分区上下间隔、256rpx footer reserve + safe-area。现有 tokens / mixins 未修改。
- single-choice / multi-choice 增加默认空对象的 `fullWidthOptions`，仅在 warmSwiss 模式按页面给定的稳定 option code 应用整行展示；single-choice 增加默认 false 的 `singleColumn`，用于活动偏好。选择值、change / limit event 与 validation 都不变。
- 单选选项中的说明文本在 warmSwiss 模式使用既有 `@ws-muted`，改善 Preference 照护类型说明的可读性；Basic 没有 description 选项，展示不受影响。
- assessment-footer 增加默认 false 的 `wideNext`；仅 Budget 显式开启，让长 CTA 在当前 390px viewport 单行显示。按钮高度、padding、safe-area 和原 Action 链不变。
- 五页 TS 仅增加与 UI-0 相同的 header 几何测量，给首错 anchor 留出固定 AppHeader 空间；不改变首错 question ID、滚动 utility、答案、进度、保存或导航。
- Preference 展示 `已选 N / 3`；保留真实 dynamic region loading / ready / empty / error / retry。
- Budget CTA 为 `查看老人需求画像 →`，中性费用与后续联系说明保留；其余四页为 `下一步 →`。

## CONTRACT_CHECKS

| 页面 | 结果 | 核对内容 |
| --- | --- | --- |
| Health | PASS | 两道 multi-choice + 三道 single-choice，5 道 required；none/unknown 真实清理；咀嚼/吞咽不推导鼻饲或 specialCareNeeds。 |
| ADL | PASS | 7 道 required Radio、每题 unknown、全部原始选项；special_feeding / catheter_or_stoma / no_stairs 不被前端推导为护理需求、分数或等级。 |
| Cognitive | PASS | 2 道 required Checkbox；none/unknown/具体项清理写入 Draft，重新读取不复活；无跨页自动预选。 |
| Preference | PASS | 4 道 required Radio、1 道 required 1–3 项 Checkbox、1 道 optional dynamic Radio；第四次添加由组件拒绝，满额可取消；无静态武汉区名或默认 no_preference。 |
| Budget | PASS | 4 道 required Radio；费用只表达家庭接受范围；contact intent 无登录/手机号/联系请求；保留本页和完整 Assessment gate、保存失败留在当前流程及单次导航。 |

只读取相关 Assessment V2 / Interaction V2 / Runtime compatibility 文档，没有修改 Frozen Contract、matching、server、机构事实或 AI。

## VISUAL_DEVIATIONS

1. **康复需求保留单选 Radio**：任务文字和 V1.2 视觉基线标为多选，但 Frozen `ASSESSMENT_CONTRACT_V2.md` §5、§6.2 明确 `health.rehabilitationNeed = required single_choice`，正式 code 为 definite / possible / none / unknown。当前运行时一致；依任务指定优先级保留 Contract，未创建新的康复多选问题。
2. 保留全部正式选项和必要 helper / error / 草稿说明；实际页长高于演示图。长选项整行或自然换行，未缩小字号或触控尺寸。
3. 当前 provider 没有已核验机构区域，实际为 `empty`；只有可明确选择的“不限制”，首次 unanswered 时不预选。没有复制 PDF 区名或制造真实机构数据。
4. Budget 长 CTA 使用更宽的右侧列；长预算区间整行展示，保留同一 footer 高度、safe-area、字号与控件语言。

## TESTS / INTERACTION_TESTS

最终运行结果及完整输出见 [test-results.json](../../../output/warm-swiss-ui1/test-results.json)。全部通过：

- `check:wechat-ts-targeted-compat`：WeChat TS 4.1.2 + 官方 typings，0 diagnostics。
- `check:assessment-runtime`：12 cases，覆盖 registry / option codes / draft / cleanup / priorities / region / completion。
- `check:assessment-v2-runtime`：44 cases，覆盖 V2 manifest、required / unknown、validation、migration / draft persistence 和失败。
- `check:assessment-interactions`：44 runtime cases + 2 structural checks，覆盖六页 invalid / partial / valid / rapid Next、Back、guard reset、Draft 保存、Budget 全局 gate、导航失败重试与公共单一事件链。
- `check:wechat-js-compat`：当前 DevTools 实际缓存的 159 个 generated JS modules，无 unsupported class field；产物覆盖和 freshness gate 通过。
- `check:wechat-js-compat:self-test`：historical incidents 与 4 种 class-field variants 检出，method assignments 正常。
- [supplemental-regression.mjs](../../../output/warm-swiss-ui1/supplemental-regression.mjs)：5 组补充测试，使用真实 component → page → Draft 事件链验证第四项拒绝和取消；真实 page 的 region loading / ready / empty / provider rejection / retry、Mock 排除、不默认选择；Budget contact intent side-effect spies；五页 header 几何不修改 Draft；新增 shared layout 属性默认关闭。全部 fixture 显式 synthetic，仅存在于测试 VM。
- 9 个受影响 page/component/app JSON 文件解析通过。
- `git diff --check`：通过；index 无 staged changes。

没有修改既有测试来降低 Gate，也没有改 tsconfig / compiler plugins。

## DEVTOOLS

`DEVTOOLS = PASS`（五页实际加载/渲染、WXML 编译摘要、fresh generated artifact、Simulator 运行证据）。单文件 WXML 摘要不是整包编译结论；Less 的证据为本轮 DevTools 实际渲染和截图，无额外生成 WXSS。

当前实际 viewport：390 × 844 CSS px，platform = devtools，bottom safe area = 34px；PNG 为 512 × 1103。五页顶部、中段、底部均已检查。ADL 01–07、stairs inline error、最后 unknown；Cognitive 两种 checkbox 长项；Preference 3/3、动态区域 empty/error/retry；Budget 全四题与长 CTA 都有截图。末项、草稿状态和错误可滚到 footer 上方。

运行时证据见 [runtime-evidence.json](../../../output/warm-swiss-ui1/runtime-evidence.json)，不含完整答案/Profile：

- Health：empty Next 留在原页、首错可见；修正后连续触发两次 Next，栈内只新增一个 ADL。
- ADL：invalid Back 回到 Health；最后 stairs 未填时显示 inline error，全部楼梯选项在 footer 上方；special feeding / catheter / no stairs 仅保存原始回答。
- Cognitive：实际 handler 写入互斥混合测试值，读取本机 Draft 只保留最后显式选择；none / unknown / concrete 双向清理均验证。症状和特殊护理分别选择，没有跨页推导。
- Preference：真实 empty 目录不默认选“不限制”；组件 limit event 显示拒绝反馈，取消既有项后 Draft 数量为 2。第四项真实组件拒绝由 source runtime 的 component → page → Draft 测试覆盖。Simulator 的区域 error 为显式 setData 测试画面；原 retry 的 tap event 重新加载真实 provider 后恢复 empty，error 清除。真实 provider rejection / ready 等完整状态由补充 runtime fixture 覆盖，未冒充真实服务故障或真实机构区名。
- Budget：空白 Next 留在本页；完整 synthetic Assessment 在 round_the_clock_care + cny_3500_5000 + request_contact 组合下可完成。连续两次 onNext 后实际栈为 Budget + 一个 Profile，`profileCount = 1`。Profile 只作为既有完成流程的目标被加载，未做 UI-2 修改。

Simulator 验证使用页面真实 handler、公开组件事件 trigger 与滚动；不等同 physical touch。MCP 曾出现 automator response timeout / page destroyed；恢复连接并核对当前 route 与实际截图后重新取证，失败/空白截图不用于 PASS。最后 console error/exception/failed filter 未返回命中行，该结果不等于全量日志为空。

原 Draft 的 V1 / V2 / active-pointer 三个 storage key 在测试前备份，测试后逐项比较并恢复；最终 temporary backup 删除，内存视图在 refresh / syncFromDraft 后恢复。没有保存完整健康答案/Profile 到文件或日志；选中演示值没有进入生产默认状态。

## VISUAL_EVIDENCE

以下截图来自本轮 DevTools；包含草稿恢复及显式 synthetic 选中/错误演示状态，不代表默认答案。路径相对仓库根目录。

| 页面 | 截图 |
| --- | --- |
| Health | [top](../../../output/warm-swiss-ui1/health-top.png) / [middle](../../../output/warm-swiss-ui1/health-middle.png) / [bottom](../../../output/warm-swiss-ui1/health-bottom.png) / [invalid](../../../output/warm-swiss-ui1/health-invalid.png) |
| ADL | [top](../../../output/warm-swiss-ui1/adl-top.png) / [middle](../../../output/warm-swiss-ui1/adl-middle.png) / [transfer](../../../output/warm-swiss-ui1/adl-transfer.png) / [bottom](../../../output/warm-swiss-ui1/adl-bottom.png) / [stairs error](../../../output/warm-swiss-ui1/adl-stairs-error.png) |
| Cognitive | [top](../../../output/warm-swiss-ui1/cognitive-top.png) / [middle](../../../output/warm-swiss-ui1/cognitive-middle.png) / [bottom](../../../output/warm-swiss-ui1/cognitive-bottom.png) |
| Preference | [top](../../../output/warm-swiss-ui1/preference-top.png) / [middle](../../../output/warm-swiss-ui1/preference-middle.png) / [3 of 3](../../../output/warm-swiss-ui1/preference-priorities-3-of-3.png) / [bottom](../../../output/warm-swiss-ui1/preference-bottom.png) / [region error](../../../output/warm-swiss-ui1/preference-region-error.png) |
| Budget | [top](../../../output/warm-swiss-ui1/budget-top.png) / [middle](../../../output/warm-swiss-ui1/budget-middle.png) / [bottom](../../../output/warm-swiss-ui1/budget-bottom.png) / [invalid](../../../output/warm-swiss-ui1/budget-invalid.png) |

## AFFECTED_OTHER_PAGES / WORKTREE

`AFFECTED_OTHER_PAGES = NONE`。Basic 文件未修改；新 fullWidthOptions / singleColumn / wideNext 均默认关闭，default 模式不应用样式。Warm Swiss 的 description 调整只影响本阶段 Preference 的既有说明文本。首页、详情、其他页面、navigation architecture 和业务模块未改动。

开始时记录的 pre-existing 文件 hashes 中，除允许扩展的三个 shared components 九个文件外，其余全部保持 byte-identical；证据见 [preservation-check.json](../../../output/warm-swiss-ui1/preservation-check.json)。`.codex`、README、UI-0 Basic/Home/Detail、原 tokens / mixins / package / scripts、V1.2 PDF 等既有改动均保留。未 reset / restore / checkout / stage；原 output/pdf 未触碰。本阶段新增输出仅在独立 output/warm-swiss-ui1，新增报告为此 Audit 文件。

## RISKS

- `ANDROID_17_MANUAL_GATE = PENDING`：没有取得当前 Android 17 人工真机证据，留待最终全量 UI closeout；不引用历史 Gate 冒充 PASS。
- 当前视觉证据仅覆盖 390px Simulator。physical tap / 真机触控、其他屏宽仍无直接人工证据；页面 handler 和公共 action channel 已分别由 Simulator 与 source runtime 验证。

`DOC_IMPACT = AUDIT_ONLY`。Frozen PDF 未修改或重新生成；本阶段无新的业务 Contract / application boundary / route / provenance 架构变更。
