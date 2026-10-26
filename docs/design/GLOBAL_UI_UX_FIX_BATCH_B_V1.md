# GLOBAL_UI_UX_FIX_BATCH_B_V1

```ini
STATUS = READY_FOR_OWNER_VISUAL_REVIEW
GLOBAL_UI_UX_FIX_BATCH_B_V1 = READY_FOR_OWNER_VISUAL_REVIEW
DOC_IMPACT = AUDIT_ONLY
NATIVE_DEVTOOLS = PASS_FOR_RECORDED_SCENARIOS
AUTOMATED_REGRESSION = PASS
ANDROID_REAL_DEVICE = NOT_RUN
ANDROID_SYSTEM_FONT = NOT_RUN
ANDROID_SOFT_KEYBOARD = NOT_RUN
READY_FOR_OWNER_REVIEW = YES
COMMIT = NOT_RUN
PUSH = NOT_RUN
WECHAT_FINAL_PACKAGE = NOT_RUN
WECHAT_UPLOAD = NOT_RUN
REVIEW_SUBMISSION = NOT_RUN
PRODUCTION_RELEASE = NOT_RUN
```

验收日期：2026-10-25，北京时间。工作区为 `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`，冻结基线为 `7ae07b9b78e4502940fd9812c6a838e4ddf2cc06`。保留 Batch A 与画像/推荐层级优化的既有实现。本轮仅为字号、行高、局部自适应和按钮裁切修复。

[完整截图索引：120 个四视口页面位置](global-ui-ux-fix-batch-b-v1-evidence/SCREENSHOT_INDEX.md) · [实际几何数据](global-ui-ux-fix-batch-b-v1-evidence/native-geometry-summary.json)

## ROOT_CAUSE

1. 六步页面原先没有读取已有 `readBrowseFontStyle`；部分 rpx 辅助字号随 320px 视口缩为 10px，输入缩为 12px，fontSizeSetting=24 时仍不增大。430px 输入原为 17px、保存提示 13px，说明问题并非所有文字统一过小。
2. 咨询助手原有输入约 12px、来源说明约 10px，固定编辑区未接入字号投影；输入与发送区按原固定比例争用窄屏宽度。
3. 预约操作行在 320px/150% 下仍排两列，按钮约宽 142px、字体 24px、左右内边距合计 32px，长评价文案横向裁切。completed Visit 与评价状态条件没有问题。
4. 实际巡检继续发现：画像进食标题存在更高优先级旧规则，原生计算字号仍为 12px；偏好说明、窄标签列、推荐说明及咨询输入提示出现末行孤字。分别用局部字号覆盖、均衡换行及输入区首选宽度修正，没有改写文案。

修改前原生数据见 [before-native.json](global-ui-ux-fix-batch-b-v1-evidence/before-native.json)，进食标题见 [12px 实测](global-ui-ux-fix-batch-b-v1-evidence/native-profile-nutrition-before-fix.json)。

## CHANGED_FILES

相对本任务开始时的文件摘要，更新 27 个已有源码文件，并新增局部样式与专项脚本。既有 dirty 文件不等于本批修改，完整差异来源见 [preservation.json](global-ui-ux-fix-batch-b-v1-evidence/preservation.json)。

- 六步 `miniprogram/pages/assessment/{basic,health,adl,cognitive,preference,budget}.ts/.wxml`：新增展示用 fontStyle，在 onShow 读取已有字号机制；相同字号不重复 setData。
- `miniprogram/pages/assessment/basic.less`、`preference.less`、`miniprogram/styles/assessment-warm-swiss.less`，新增 `miniprogram/styles/assessment-readability.less`：局部角色字号、输入高度、选项最小宽度、提示与标题换行、底部留位。
- `miniprogram/components/{single-choice,multi-choice,question-section,progress-header,primary-button}/*.less`：仅样式；评估页面通过专用 CSS 变量选择性启用，其他调用者使用原有 fallback。组件 TS 和事件链不变。
- `miniprogram/pages/assessment/profile.less`：补齐进食标题、小提示和修改入口字号，保留橙色标签；窄标签和末尾说明均衡换行。
- `miniprogram/pages/recommendation/result.less`：补齐标题、机构名称与辅助文字字号，说明均衡换行，保留“本次匹配依据”。
- `miniprogram/pages/service/ai-chat/index.ts/.wxml/.less`：页面与固定编辑区复用同一字号读取；输入区首选宽度 240px，窄屏自然换行；文本框按字号增长并保留内部滚动。
- `modes/demo/pages/records.wxml/.less`：appointments 独立类控制操作行，按钮按字号决定换行且高度自适应；文案与入口可用条件不变。
- 新增 `scripts/check-global-ui-ux-batch-b.mjs`、本报告与本轮证据目录。

未修改全局 Token、Assessment 27 个稳定题目 ID、21 必填/6 选填、选项顺序、条件清理、Preference 上限、领域服务、历史快照、推荐排序、机构核验或预约/评价状态机。

## FONT_SIZE_BEFORE_AFTER

| 320px 实测对象 | 修改前标准 | 修改前 150% | 修改后标准 | 修改后 150% |
| --- | ---: | ---: | ---: | ---: |
| 基本页输入 | 12px / 高 37px | 12px | 16px / 高 48px | 24px / 高 60px |
| 开场说明、保存提示 | 10px | 10px | 14px | 21px |
| 咨询助手输入 | 12px / 高 37px | 未单独测量 | 16px | 24px |
| 咨询来源说明 | 10px | 未单独测量 | 14px 局部样式 | 21px 局部样式 |
| 画像进食标题 | 12px | 未单独测量 | 20px | 30px |
| 预约操作文字 | 原已响应字号 | 24px、两列裁切 | 保持可读字号 | 24px、窄屏改为分行 |

主要问题与答案采用 16/24px，辅助/错误采用 14/21px。自定义组件内部节点未由当前桥接单独暴露，不能将源码角色值冒充全部节点的原生计算样式；这些位置同时以实际 WXML/WXSS 截图复核。输入、说明、标题等表中标明的实测数据可直接复核。

`--assessment-*` 只映射已有 `--browse-*`，没有第二个倍率计算器或全局字体 Token 修改。没有通过缩小文字避免换行。

## SIX_STEP_ASSESSMENT_RESULT

六步均完成四种视口的顶部、中段、末尾截图。标准字号保留两列自适应，320px/150% 自然转单列；标签、描述和容器随内容增长，Radio/Checkbox 的字段与选择语义不变。最后选项和保存提示可以滚动至固定底栏上方。

实际坐标触摸完成 Basic → Health → ADL → Cognitive → Preference → Budget → Profile；逐步 Back 再 Next 的路径正确。[六步往返记录](global-ui-ux-fix-batch-b-v1-evidence/native-six-step-forward-back.json)。

## LARGE_FONT_RESULT

使用开发者工具设备菜单设置 fontSizeSetting=24，实际 systemInfo 验证逻辑宽度 320px，复用字号读取产生 150% 投影，没有 mock 视口或仅缩窄 430px 内容。

- 基本输入 24px、高 60px；说明/保存提示 21px。
- 画像进食标题 30px。
- 咨询输入 24px，长文本时高 178.40px；固定编辑区约高 249.46px、顶部 350.54px。
- 咨询最后业务按钮顶部约 189.42px、高 45.73px，底边 235.15px，小于固定编辑区顶部 350.54px，未被永久遮挡。
- [长文本原生截图](global-ui-ux-fix-batch-b-v1-evidence/interaction-320-font150-ai-long-input.png)。测试文字已清空，没有发送问题或发起真实咨询。

这些是 DevTools 投影和输入布局验收，不是 Android 系统字体或真实软键盘验收。

## APPOINTMENT_BUTTON_RESULT

320px/150% 下，查看机构与查看评价分行，原“查看看院评价”文案完整显示；375px、430px 标准字号仍可在合适宽度并排。

窗口实际点击进入 `demo-visit-demo-inst-chunhe-garden` 的评价，状态为 `submitted`，返回预约页正常；最终构建又以坐标触摸复核相同目标和只读状态。[窗口点击证据](global-ui-ux-fix-batch-b-v1-evidence/native-appointment-physical-click.json) · [最终复核](global-ui-ux-fix-batch-b-v1-evidence/final-native-review-entry.json)。

同卡片“查看机构”API 尺寸为 294×57.33 逻辑像素。评价按钮单独伪类选择器未被桥接正确区分，未将其冒称为评价按钮精确 CSS 尺寸；评价按钮原始 PNG 边框约 x=17、y=467、376×74 像素（±1px），横向完整，见几何汇总。

[修改前后对比](global-ui-ux-fix-batch-b-v1-evidence/comparison-appointment-font150.png)

## VIEWPORT_RESULTS

| DevTools 逻辑宽度 | fontSizeSetting | 截图位置 | 结果 |
| --- | ---: | --- | --- |
| 320px | 16 | 10 页 × 顶部/中段/末尾 | PASS，含后续局部复核 |
| 375px | 16 | 同上，含刘海安全区 | PASS，含后续局部复核 |
| 430px | 16 | 同上，含底部安全区 | PASS，含后续局部复核 |
| 320px | 24 | 同上，重点复核长选项、错误、输入与底栏 | PASS，Android 仍 NOT_RUN |

全部记录的页面根内容边界位于实际逻辑视口内；样例中未见横向溢出、固定高度裁切或按钮文字截断。截图含正常滚动位置，顶部部分内容位于屏外不属于裁切。前后设备高度不同，原图均保留，没有裁切、拉伸或用宽视口代替窄视口。

## INTERACTION_RESULTS

- 无效年龄 49：Next 不跳转，实际首错滚动后年龄、内联错误和输入均可见。[触摸及几何记录](global-ui-ux-fix-batch-b-v1-evidence/native-next-coordinate-probe.json)。
- 无效时 Back 返回上一页；有效年龄和测试姓名在重进后恢复；原姓名、年龄已恢复。[草稿/返回记录](global-ui-ux-fix-batch-b-v1-evidence/native-assessment-back-draft-next.json)。
- 慢性病多选实际增加并取消“其他慢性疾病”，原高血压选择恢复；单选长文案从正常切换至偶尔吞咽不顺并恢复正常。截图与 data 均记录。
- 六步往返、有效 Next、画像到推荐均通过实际 UI 触摸路径。
- 两次官方坐标触摸请求在同一毫秒发送，只增加一条 Health 页面栈，没有跳至 ADL。[连续点击记录](global-ui-ux-fix-batch-b-v1-evidence/native-rapid-next.json)。这是 DevTools 自动化触摸，不是 Android 硬件双击证明。
- 评价查看窗口点击和最终坐标触摸均进入对应已提交只读评价。
- 长文本输入真实渲染可见；空字符串 input 被工具 schema 拒绝后，使用 input 事件完成测试清空并核实 inputValue 为空。[清空记录](global-ui-ux-fix-batch-b-v1-evidence/native-ai-input-teardown.json)。清空事件不被用作输入或键盘通过的替代证据。

单次 Windows 指针探索未观察到 Next 滚动，未计为通过；表单通过依据为随后官方 DevTools 坐标触摸、原生截图、滚动几何和页面栈，不是直接调用页面 handler。

## BUILD_RESULTS

Demo / Production 均通过 TypeScript 4.1.2、Less、原生 WXML、生成 JS 语法与既有预算检查；各 30 路由，Demo 201、Production 214 个生成 JS 模块。

[最终构建清单](global-ui-ux-fix-batch-b-v1-evidence/builds.json)。未执行微信最终上传打包。

## REGRESSION_RESULTS

既有 13 项相关检查全部通过，见 [checks.json](global-ui-ux-fix-batch-b-v1-evidence/checks.json)：Assessment V2 44 个 runtime cases；Assessment Interaction 47 个行为案例及 2 个结构检查；Profile/Result 10/10；AI B5；B1.2.5 Continuity；模式隔离；画像/推荐展示比较；Batch A；双模式 JS 兼容；预算；Batch B；官方 typings 下 targeted compatibility 0 diagnostics。

最终样式收敛后再次通过 Batch B 字号/状态不变检查、模式隔离、Demo/Production JS 兼容及预算检查，见 [final-checks.json](global-ui-ux-fix-batch-b-v1-evidence/final-checks.json)。其中 149 个受保护业务源码未变化；六步与 AI 在 16/24px 的业务展示状态、完整草稿与保存快照相同，外部副作用计数为零。

## DEMO_ISOLATION

PASS（自动化与构建证据）。继续使用 `ISOLATED_SYNTHETIC_MEMORY`；真实拨号、登录、客服、预约网络与真实 Storage 转发限制未放宽。本轮原生操作仅输入、选择、滚动、导航与读取已有只读评价，没有真实发送或预约。

## PRODUCTION_ISOLATION

PASS（双构建与模式隔离检查）。Production 使用既有只读目录 Provider，未包含 Demo Fixture、虚构顾问、模拟媒体或 Demo 记录读取入口。本轮不声称做过 Production 真机验收。

## PACKAGE_BUDGET

| 模式 | runtime bytes | 原预算上限 | 剩余预算 |
| --- | ---: | ---: | ---: |
| Demo | 1,962,065 | 2,031,616 | 69,551 |
| Production | 1,359,558 | 2,031,616 | 672,058 |

以上是本地运行文件体积，不是微信最终上传包大小。阈值未提高，未删除业务安全逻辑，没有新增打包图片。最终微信包 `NOT_RUN`。

## ANDROID_REAL_DEVICE

`NOT_RUN`。未连接或执行 Android 真机、ADB、Android 系统字号及真实软键盘测试。此前 Owner 对 B1.2.6 的人工验收不覆盖本轮字号改动。不能把 DevTools 模拟机型中的 Android 字样当成真机证据。

## 工作区与证据保护

修改前 [baseline.json](global-ui-ux-fix-batch-b-v1-evidence/baseline.json) 记录 1769 个文件摘要。全局 tokens.less 字节与行尾保持不变；Batch A 既有源修改、旧报告和 PNG/JPG 保留，未暂存、回滚或清理工作区。

**一处需明确披露的例外**：早期复用 `check-profile-recommendation-hierarchy.mjs` 时，该脚本自动刷新旧证据目录的 `data-comparison.json`。通过结论仍为展示数据相同、快照不变、外部副作用零；新隔离 VM 的随机草稿引用使 validationSessionHash 改变。原文件哈希保留在任务基线，原随机会话摘要未恢复，不能宣称这份旧生成 JSON 字节未变。此后输出均写入本轮目录，旧报告和原截图未改。

## 工具恢复与证据限制

Owner 完成登录、信任项目及更新环境变量令牌后，确认安装路径大小写对应两个旧/新 profile 端口。通过官方 MCP 桥接、既有 `WECHATIDE_MCP_TOKEN` 及仅子进程生效的 `ELECTRON_BASE_APP_PATH` 完成本轮验收；未改安装文件、安全开关或令牌配置，令牌未显示或写入项目。

重建期间曾发生 DevTools 文件列表/编译缓存导致的缺模块错误；仅清理编译缓存后重新编译恢复，没有清理 Storage、登录或业务数据。恢复后的实际页面导航、渲染和验收记录正常。失败探索和工具伪类/空字符串限制在截图索引中明确列出，不计为产品通过证据。

## REMAINING_RISKS

1. Owner 仍需在 Android 上复核系统大字号、真实触摸与软键盘弹出/收起、输入框光标及底栏遮挡；均未标 PASS。
2. 部分组件内部计算样式未由桥接暴露，已保留角色样式、实际截图和可取得的几何，不能声称所有节点均有精确计算字号测量。
3. 旧生成比较 JSON 的刷新例外需结合本轮新证据复核；旧随机会话摘要没有补造或恢复。
4. 微信最终包体积没有本轮上传打包证据；本轮不执行上传。

## READY_FOR_OWNER_REVIEW

YES。代码、相关回归、双构建、四种视口原生截图及关键交互证据已经具备，等待 Owner 视觉确认及上述设备复测。开发者工具已恢复为 430px/16px 并停在 Demo 首页。未执行 Git commit、push、微信上传、提审或正式发布。
