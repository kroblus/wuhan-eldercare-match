# 微信小程序交互契约

> 状态：`ASSESSMENT_INTERACTION_CONTRACT = FROZEN_V1`
>
> 系统冻结：`ASSESSMENT_INTERACTION_SYSTEM_FROZEN = TRUE`
>
> 适用范围：微信原生小程序中的公共交互组件、导航和六步 Assessment。
>
> 最终标准：微信真机可操作。TypeScript、自动回归和微信开发者工具通过是必要证据，但不能替代真机复测。

## 1. 边界与核心术语

本契约只约束交互行为，不改变 `ASSESSMENT_CONTRACT.md` 中的 question ID、option code、必填规则、答案语义或 `AssessmentDraft` 结构。

`CLICKABLE != VALID`：

- `clickable` 表示用户的物理点击能够到达并触发一次业务 Action。
- `valid` 表示 Action 触发后的当前步骤校验允许继续导航。
- Assessment 不得用 `disabled = !formComplete` 把“数据无效”伪装成“按钮不可点击”。

每次物理点击的公共链路必须满足：

`1 physical tap → 1 component event → 1 page handler → at most 1 navigation`

## 2. Back Action Contract

所有 Assessment 步骤的 Back 默认 `backDisabled = false`，并且始终可被物理点击。Back：

1. 不校验当前步骤完整性。
2. 不清空或提交 Draft。
3. 不触发 Profile、网络请求或授权。
4. 正常页面栈中使用 `wx.navigateBack()` 返回上一页。
5. 当页面由 DevTools 编译模式、二维码或其他入口直接打开且栈深为 1 时，使用明确的上一业务路由 `wx.redirectTo()`；不得把无可见结果的 `navigateBack()` 当作成功。

Assessment 的根栈回退路由如下：

| 当前步骤 | 根栈 Back 回退 |
| --- | --- |
| Intro | Home |
| Basic | Intro |
| Health | Basic |
| ADL | Health |
| Cognitive | ADL |
| Preference | Cognitive |
| Budget | Preference |

Back 与 Next 的禁用状态必须分开建模为 `backDisabled` 与 `nextDisabled`，禁止 Footer 级完整性禁用。

## 3. Next Action Contract

Assessment 的 Next 默认 `nextDisabled = false`。即使 required answer 全部未填写，Next 也必须可被物理点击。

标准流程：

1. 物理点击只产生一次 Next Action。
2. 页面校验当前步骤。
3. `INVALID`：导航次数为 0；保留当前页面和 Draft；在对应问题附近显示 inline error；使用统一首错定位机制让第一个错误可见。
4. 用户修正对应问题后，清除该问题错误。
5. `VALID`：保存当前步骤答案；发起一次导航；NavigationGuard 防止快速重复 push。

Budget 在本页校验通过后还执行既有全 Assessment 完成门禁。门禁失败时必须在用户当前操作区给出立即可见的错误反馈，且不得进入 Profile；它不改变任何 Assessment 数据契约。

## 4. Disabled Contract

`disabled` 只用于真实的暂时不可操作状态，例如不可重复的异步提交或产品明确要求的锁定。当前纯本地 Assessment 不得因为 required 未完成而禁用 Back 或 Next。

禁用态必须继续阻止业务 Action；可用态不得被透明遮罩、错误 `z-index`、`pointer-events`、fixed/sticky 安全区布局或 loading mask 截获触控。

## 5. 公共组件事件契约

### 5.1 PrimaryButton

- 内部原生按钮只调用一个内部 handler。
- 对外只发出 `action`。
- 必须显式设置 `{ bubbles: false, composed: false }`。
- 外部统一使用 `bind:action`，禁止为同一业务 handler 再绑定 `bindtap`。
- 禁止 native tap bubbling 与 `triggerEvent('tap')` 形成双业务通道。

### 5.2 AssessmentFooter

事件链固定为：

`PrimaryButton action → AssessmentFooter back/next → Page handler`

Footer 只转发语义明确的 `back` 或 `next`，每次各最多一次，且均使用 `{ bubbles: false, composed: false }`。Footer 不得同时监听原生 tap 冒泡和 custom event 来执行同一个动作。

### 5.3 NavigationGuard

NavigationGuard 只是第二层防御：当同一页面生命周期中的相同导航仍在执行时，忽略后续调用。它不能掩盖双事件通道。同步异常或导航失败必须释放；用户返回来源页后必须可再次导航。

### 5.4 WeChat API Parameter Contract

新增或修改 `wx.*` API 调用时，必须主动核对当前微信官方 typings / API contract 中的字符长度、enum、required 参数、平台限制以及 `success` / `fail` / `complete` 行为。TypeScript 能编译或 DevTools 可运行，不代表真机参数行为一定正确。

禁止传入已知违反官方约束的值。对 `wx.showModal`、导航、授权、手机号、登录、文件/媒体选择、地图/位置、WebView/VR 等用户可见关键路径，如果 API 提供 `fail` callback，必须评估可见失败反馈与状态释放；不得让 API 失败表现为“按钮没反应”。这是一项现有真机兼容与 Interaction QA Gate，不引入大型 API framework。

## 6. 校验与首错定位

六步 Assessment 统一复用 `assessment-validation` 和既有首错滚动机制：

`Next → validate current step → inline errors → wx.nextTick → first error visible`

错误不能只通过 Toast 表达。错误信息必须靠近问题，滚动不得产生剧烈跳动，校验失败不得清空有效 Draft。

## 7. Assessment Interaction Matrix

表中“未填/部分”均指该页至少一个 required question 无有效答案；“有效”指当前页 required 全部有效。所有状态下 Back 均可点击、无校验并返回上一业务步骤。

| 页面 | 状态 | Next 可物理点击 | 校验/副作用 | 导航 | 特殊规则 |
| --- | --- | --- | --- | --- | --- |
| Basic | 未填/部分 | 是 | 失败；inline error；首错可见；Draft 保留 | 0 | 年龄仍遵守既有边界 |
| Basic | 有效 | 是 | 保存当前页 | Health，最多 1 次 | 根栈 Back → Intro |
| Health | 未填/部分 | 是 | 失败；inline error；首错可见；Draft 保留 | 0 | none/unknown 冲突值不得复活 |
| Health | 有效 | 是 | 保存当前页 | ADL，最多 1 次 | 根栈 Back → Basic |
| ADL | 未填/部分 | 是 | 失败；inline error；首错可见；Draft 保留 | 0 | 不生成 ADL 等级或分数 |
| ADL | 有效 | 是 | 保存 7 组原始答案 | Cognitive，最多 1 次 | 根栈 Back → Health |
| Cognitive | 未填/部分 | 是 | 失败；inline error；首错可见；Draft 保留 | 0 | none/unknown/具体项互斥真实写回 Draft |
| Cognitive | 有效 | 是 | 保存当前页 | Preference，最多 1 次 | 根栈 Back → ADL |
| Preference | 未填/部分 | 是 | 失败；inline error；首错可见；Draft 保留 | 0 | 用户关注项最多 3 项 |
| Preference | 有效 | 是 | 保存当前页 | Budget，最多 1 次 | 第 4 项不得形成非法 Draft；根栈 Back → Cognitive |
| Budget | 未填/部分 | 是 | 本页校验失败；inline error；首错可见；Draft 保留 | 0 | 根栈 Back → Preference |
| Budget | 本页有效、前序不完整 | 是 | 全 Assessment 门禁失败；操作区立即可见反馈；Draft 保留 | 0 | 直达页面可复现 |
| Budget | 全 Assessment 有效 | 是 | 保存当前页并通过完整门禁 | Profile Skeleton，最多 1 次 | 不在本契约实现 Profile 业务 |

六页通用补充：快速连续点击时导航最多 1 次；返回页面后 guard 重置，可再次执行 Next；被互斥或条件规则清理的答案不得再次进入页面后复活。

## 8. 可复现用例

### ASSESSMENT-BUDGET-001：完全未填写 Next

- 前置：清空 Budget 四个 required answer；加载 Budget。
- 操作：点击 Next 一次。
- 预期：按钮收到点击；page handler = 1；校验失败；navigation = 0；仍在 Budget；第一题 inline error 且可见。

### ASSESSMENT-BUDGET-002：部分填写 Next

- 前置：只填写部分 Budget required answer。
- 操作：点击 Next 一次。
- 预期：handler = 1；校验失败；navigation = 0；首个缺失问题可见；已填 Draft 保留。

### ASSESSMENT-BUDGET-003：完整 Next

- 前置：六步 required answer 全部有效。
- 操作：点击 Next 一次。
- 预期：当前页保存；完整门禁通过；Profile 只进入一次。

### ASSESSMENT-BUDGET-004：快速 Next

- 前置：同 003。
- 操作：快速连续触发 Next。
- 预期：业务导航与 Profile push 均不超过 1 次。

### ASSESSMENT-BUDGET-005：根栈 Back

- 前置：以直接编译模式加载 Budget，`getCurrentPages().length === 1`；答案可为空。
- 操作：点击 Back 一次。
- 预期：不校验；一次业务 Action；`redirectTo` Preference 一次；Draft 不清空。

### ASSESSMENT-BUDGET-006：返回后再操作

- 前置：从完整 Assessment 进入 Profile 后返回 Budget。
- 操作：再次点击 Back，并重新进入后点击 Next。
- 预期：guard 已释放；Back/Next 均可再次工作；Draft 保留。

### 六页通用行为集

Basic、Health、ADL、Cognitive、Preference、Budget 都必须覆盖：完全未填、部分填写、有效、快速点击、返回后重试、invalid → 修正 → Next。自动检查必须执行页面 handler 和运行时行为，不能只检查 handler 或 route 文本存在。

## 9. 自动回归 Gate

保持轻量脚本，不建设大型 Form Framework 或测试框架。Interaction Runtime Regression 至少证明：

- unanswered/partial Next：handler = 1、validation = FAIL、navigation = 0；
- valid Next：handler = 1、validation = PASS、navigation = 1；
- unanswered Back：handler = 1、无完整性校验、返回上一业务页；
- rapid Next：navigation <= 1；
- return：guard reset 后 Next 再次工作；
- invalid → fix：错误清除并可正常导航；
- Draft 在前后导航中保持，冲突/隐藏值不复活；
- PrimaryButton 与 Footer 只有单一事件链。

涉及 Assessment 交互修改时，自动 Gate、TypeScript、JSON、微信 DevTools 最新编译、`check:wechat-js-compat` 与其 self-test 都是必跑项。

## 10. Android 17 人工真机矩阵

真机测试必须标为 `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`，不得冒充 ADB 或自动化结果。项目负责人至少复测：

- Basic、Health、ADL、Cognitive：Back、Next invalid、Next valid。
- Preference：Back、Next invalid、最多 3 项、Next valid。
- Budget：Back、Next 完全未填、Next 部分填写、Next 完整、rapid Next、Profile 返回 Budget 后再次 Back/Next。
- 完整前进栈：Intro → Basic → Health → ADL → Cognitive → Preference → Budget → Profile。
- 完整返回栈：Profile → Budget → Preference → Cognitive → ADL → Health → Basic → Intro → Home。

### 10.1 2026-08-29 人工真机结果

证据类型：`MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`。执行者为项目负责人，设备为 Android 17 微信真机；这不是 ADB 验证，也不是自动化测试。

已人工确认：

- Assessment Back 可以正常物理点击；未完成表单时 Next 也可以正常物理点击；
- Invalid Next 会执行 validation、不会导航，并在当前操作区域给出明确可见反馈；
- Valid Next 正常导航，完整 Assessment 可以进入 Profile Skeleton；
- Budget 根栈 Back 进入 Preference；前序步骤不完整时，全局 Gate 反馈在当前操作区域可见；
- rapid Next 不重复 push；Profile 返回 Budget 后 Back / Next 可以再次工作；
- Assessment 正向与反向导航栈正常；一次物理点击最多产生一次业务 Action 和一次导航。

项目负责人已补充确认：

`RAPID_BACK_RESULT = PASS`

因此不为理论对称新增 Back NavigationGuard。

### 10.2 Restart 真机阻断、修复与人工复测闭环

首次 Android 17 项目负责人人工验证记录：

- `CONTINUE = PASS`：存在未完成 Draft 时，“继续填写”可物理点击并沿既有路径继续；
- `RESTART = FAIL`：“重新开始”点击后没有可见确认或后续结果。

源码证据确认 Restart 既有语义是：打开确认弹窗；取消时保留 Draft；确认时清除当前本地开发态 Draft，再进入 Basic。该语义保持不变。

根因证据：修复前 `wx.showModal.confirmText` 为 5 字“清除并开始”，而项目内微信 API typings 明确限制该字段最多 4 个字符；Continue 不经过 Modal，因此不受影响。修复将文案收敛为 4 字，并为 Modal pending、失败及同步异常提供最小状态保护和可见反馈。正式 Interaction Runtime Regression 覆盖 Continue、Restart 确认/取消和 rapid Restart。

根因属于 `WECHAT API PARAMETER CONTRACT`：`wx.showModal.confirmText` 的值违反当前官方 typings 已声明的字符长度限制。DevTools 与静态逻辑没有提供足够明显的失败反馈，Android 真机最终表现为没有可见 Modal，用户感知为按钮无响应。

修复完成后，项目负责人已在 Android 17 微信真机完成专项人工复测。证据类型严格记录为 `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`，不是 ADB，也不是自动化测试。最终结果：

- `CONTINUE = PASS`：进入 Basic，原 Draft 保留并恢复，没有重复导航；
- `RESTART = PASS`：单击显示确认弹窗；取消保留旧 Draft；再次执行仍正常；确认后旧 Draft 清除并进入新的 Basic，旧答案不复活；
- rapid Restart 不产生重复 Modal、重复 Draft 清理或重复导航；
- 返回 Intro 后 Continue / Restart 均可再次使用；
- `RAPID_BACK_RESULT = PASS`：快速连续 Back 只返回一级，不穿透多个页面，返回后交互可再次使用；
- 导航栈无重复 push，也无残留重复 Assessment 页面。

Assessment Interaction Freeze 的证据来源必须继续分层：

- `AUTOMATED`：Assessment Interaction Runtime Regression 覆盖 Continue、Restart 确认/取消、rapid Restart、六步 Back/Next、Draft 和导航行为；
- `DEVTOOLS`：微信开发者工具实际编译与生成产物兼容检查；该证据不替代真机；
- `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`：上述项目负责人 Android 17 微信真机结果；不得写成 ADB 或 automated PASS。

最终状态：

`ASSESSMENT_INTERACTION_SYSTEM_FROZEN = TRUE`

`ANDROID_REAL_DEVICE_STATUS = PASS — MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`

## 11. 交互页面交付规则

任何新增或修改的交互页面，`wechat_frontend` 编码前必须定义 Interaction Matrix，至少写明 Action、Element、初始状态、物理可点击性、校验、副作用、导航、loading、disabled、快速点击、Back 和错误行为。实现后执行运行时回归。

`qa_reviewer` 必须审查完整链路：

`physical action → component event → page handler → validation → navigation`

仅有 TypeScript PASS、DevTools PASS、handler 存在或 route 存在，不足以判定 Interaction PASS。
