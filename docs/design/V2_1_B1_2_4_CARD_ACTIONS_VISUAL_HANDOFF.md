# B1.2.4 — Owner 亮橙与电话图标修订

DOC_IMPACT = AUDIT_ONLY

STATUS = READY_FOR_OWNER_VISUAL_REVIEW（B1.2.4 整阶段仍为 PARTIAL）

工作区：`C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4`\
分支：`codex/v2-1-b1-2-4-card-actions-visual`\
本地 HEAD：`c109208c37947848332ad93b1c4b056eabf0cefc`。保留原有未提交 B1.2.4 成果；本轮没有创建最终提交、push、上传或发布。

## 当前：Owner 第二轮局部修订

Owner 初步认可 `#FF6A00` 与操作布局，仍未最终视觉冻结。本次只改目录局部样式和对应展示断言：

- 听筒改为自包含 SVG 标准闭合轮廓，24×24px、`#D95800`；44×44px 透明触区、禁用灰态及所有事件不变。未增加资源文件、依赖或拨号文字。图标对白卡对比约 3.93:1。
- “展开完整目录”使用 `#E8E2DD` 细边框和 `#202020` 文字；“打开独立机构目录”使用更易阅读的深橙 `#B54808`。
- 未修改 TS、机构资料、导航、拨号逻辑或全局 Token；没有提交、推送或最终冻结。

当前双构建均 PASS：正式 **1,361,248 bytes**、Demo **2,031,546 bytes**，比上轮各增加 99 bytes；Demo 距原预算余 **70 bytes**，预算阈值不变。仍为本地 runtime 文件字节，非签名后微信主包大小。

相关回归 PASS：B1.2.4 **112** 条、首页 **130** 条、首页结构 **43** 条、列表详情 **17** 条，以及 Demo 安全隔离／双模式收敛。TS、Less、原生 WXML 和生成 JS 检查包含在双构建内。

新证据：[430px 正常字号完整视口](v2-1-b1-2-4-evidence/owner-handset-review/demo-430-full.png)、[电话原始像素 1:1 局部](v2-1-b1-2-4-evidence/owner-handset-review/phone-icon-1to1.png)。430px 图来自真实 DevTools Demo 视口（保留 TEST ONLY），PNG 为窗口截图 473×1023 像素；48×48 局部直接裁切原 PNG，没有缩放或重绘，不将截图像素与 CSS 视口像素混同。取图后的附加布局查询遇到 DevTools `An object could not be cloned`／超时，未用失败查询补造布局通过记录。

ANDROID_REAL_DEVICE = NOT_RUN；SVG 与禁用灰态的 Android 渲染仍待 Owner 真机复核。

AGENT_DELEGATION_REPORT（本次）：两处局部视觉可独立完成，按当前主会话视觉 ownership 直接实施并验证，未新增专项委派。

## 上轮记录（以下保留历史方案与构建数据，以当前记录为准）

- 机构卡片主操作 `#FF6A00`，按下 `#E85E00`，文字 `#202020`；主按钮文字对比 5.67:1。
- 名称／正文采用深灰黑，辅助信息 `#707070`，卡片 `#FFFFFF`、边框 `#E8E2DD`。目录页声明暖白背景 `#FFF9F5`；既有 page-container 与导航的 Warm Swiss 背景保持原样。
- 电话仅显示代码绘制的斜向听筒，18×24px 未缩放图形、44×44px 透明触控区。可拨橙色，不可用灰色；真实／TEST ONLY／不可用的无障碍名称保留。
- 右侧“查看详情”为唯一大面积主操作。原有失败／模拟反馈移至操作区之前，保持电话位于底部左侧；长反馈和风险文字完整显示。
- 候选变量位于目录局部 Less；全局 Token 未升级。没有新增图标资源、依赖或数据。

本次直接修改：`miniprogram/styles/institution-directory.less`、`miniprogram/templates/institution-directory.wxml`、相关 B1.1／B1.2.4 视觉断言。此前 B1.2.4 的 Home 局部视觉、官方拨号 helper、投影、页面 handler、构建优化和新 action amendment 均保留；完整文件清单见 [changed-files.json](v2-1-b1-2-4-evidence/owner-orange-icon/changed-files.json)。

## 安全与测试

正式拨号继续使用详情应用与 ViewModel 的合法官方电话投影，精确匹配机构、revision、phoneKey、时间和当前上下文；不使用顾问／个人电话。Demo 先返回 TEST ONLY 模拟反馈，不调用真实拨号。电话 catchtap、原生 disabled、独立详情 catchtap、单次触发与重试保护保留。

| 验证 | 本轮结果 |
| --- | --- |
| B1.2.4 专项 | PASS，110 条（保留原 98 条，增加配色／图标／布局检查） |
| 首页行为回归 | PASS，130 条；B1.2 首页结构 43 条 |
| B1.1／B1.2.1／B1.2.3 相关检查 | PASS，86／52／138 条 |
| 列表详情事件／首页导航防重 | PASS，17／10 条 |
| Demo 隔离与双模式收敛 | PASS |
| 微信 TS 4.1.2、Less、原生 WXML、生成 JS | PASS |
| 原生 CLI 交互 | PASS，6 个场景；全部拨号被 mock，无真实电话 |
| 原生 320px 正式卡片 | PASS：长名称、地址、完整风险、44px 触区，无横向溢出 |
| 原生 430px Demo | PASS：TEST ONLY、两卡和独立操作，无横向溢出 |
| 150% 字体 | PASS：320px 正式、430px Demo 的受控字体投影及几何检查 |
| 正式 430px 卡片精确高度重测 | NOT_RUN；既有源／生成样式高度相关检查通过，不借用旧截图宣称本轮实测 |
| 操作系统大字号／Android 真机 | NOT_RUN |

150% 使用 DevTools mock `getSystemInfoSync.fontSizeSetting = 24` 调用既有 `syncBrowseFont`，真实 WXML 在实际 320／430px 视口渲染；不是系统字号设置或 Android 验收。测试后 API mock 和字体样式均恢复。430px Demo 的截图像素宽为 227（工具窗口缩放），视口宽由运行时及布局矩形记录，不能混为一谈。

截图及结构化证据均在 [owner-orange-icon](v2-1-b1-2-4-evidence/owner-orange-icon/)。该目录以外的旧 B1.2.4 截图反映此前配色，不作为本轮通过证据。

## 构建与门禁

| 本地 runtime 文件字节 | 正式 | 演示 |
| --- | ---: | ---: |
| Owner 修订前 | 1,360,728 | 2,031,026 |
| 本轮最终 | 1,361,149 | 2,031,447 |
| 增量 | +421 | +421 |
| 距既有 2,031,616 字节预算余量 | 670,467 | 169 |

两构建成功，预算阈值未变。初版图标曾令 Demo 超出 341 字节；随后仅合并冗余 CSS，未删除功能。以上为构建 miniprogramRoot 文件字节，不是微信签名／上传后真实主包大小；后者 NOT_AVAILABLE。

NATIVE_ACCEPTANCE = PARTIAL（独立 CLI 验证，未恢复已停止的 Computer Use）\
ANDROID_REAL_DEVICE = NOT_RUN

剩余事项：Owner 确认亮橙与听筒效果；Android 实测 320／430px、大字号、长名称／风险、不可用电话、合法拨号系统面板、取消重试与详情返回。橙色图标对白卡对比约 2.87:1，未宣称其达到正文 AA；按钮深色文字满足 4.5:1。Demo 预算仅余 169 字节，后续改动需继续检查。此前全局文档治理的 21 项历史问题未纳入本次局部修订。

AGENT_DELEGATION_REPORT：`wechat_frontend` 负责边界明确的局部样式、模板及视觉断言；主会话负责构建、预算、原生 CLI 与截图集成；`qa_reviewer` 对 diff 和最终图进行只读复核，未发现拨号安全／事件隔离回归，保留原生人工验收风险。

NEXT = OWNER_VISUAL_REVIEW；确认前不冻结全局颜色、不创建最终提交，不进入下一阶段。

## 2026-10-24 逐页排版复查补充（当前结果）

Owner 本轮明确要求使用电脑操控后，重新进行了独立 Computer Use 检查；以上“未恢复 Computer Use”描述仅属于历史轮次。实际查看 30 个注册路由的可进入状态，补查正式 320px 机构目录及服务安全状态。修复预算页返回按钮末字落单、需求画像费用标签末字落单、全景演示读数落单三处局部排版问题。

本轮生产/演示构建均通过，runtime 文件字节更新为 1,361,280 / 2,031,578，Demo 预算余量 **38 字节**。评估交互、V2 运行时、画像、B1.2.4、首页回归、模式隔离和 showcase 相关检查均通过。完整覆盖范围、未运行状态和前后截图见 [逐页检查记录](v2-1-b1-2-4-evidence/page-layout-review/README.md)。真实成功预约、评价表单等无合法上下文的业务分支未伪造进入；Android 真机仍为 NOT_RUN。

DOC_IMPACT = AUDIT_ONLY。保留原有未提交工作，不提交或推送；STATUS = READY_FOR_OWNER_VISUAL_REVIEW。
