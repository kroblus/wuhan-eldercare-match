# 微信小程序交互契约 V2

> 状态：`WECHAT_INTERACTION_CONTRACT = FROZEN_V2`
>
> Contract ID：`contract.wechat_interaction.v2`
>
> Contract 版本：`wechat-interaction-contract-v2`
>
> 冻结日期：`2026-09-29`
>
> 适用范围：微信原生小程序中的公共交互组件、导航和六步 Assessment。

本 V2 是当前唯一有效的 WeChat Interaction Contract。它是 Frozen V1 的版本化后继；V1 保持原样并作为历史冻结记录保存，不再作为新实现的当前规范来源。本文件保留 V1 中未明确调整的交互规则，并以本文件的导航与栈规则澄清取代 V1 对根栈回退 API 的不完整说明。若历史 V1 与本文件对同一当前行为有不同表述，以本 V2 为准。

本 Contract 定义交互和导航机制，不修改产品流程、Assessment 数据语义、Institution 身份或业务规则。产品来源定义用户可见流程；本 Contract 定义该流程的交互行为；微信平台约束可用 API；Owner 决定只用于解决产品或 Contract 未覆盖的歧义；Runtime、DevTools 和真机证据用于验证实现是否符合这些规则，不创造新的产品语义。

## 1. 边界与核心术语

本契约只约束交互行为，不改变 `ASSESSMENT_CONTRACT.md` 中的 question ID、option code、必填规则、答案语义或 `AssessmentDraft` 结构。

`CLICKABLE != VALID`：

- `clickable` 表示用户的物理点击能够到达并触发一次业务 Action。
- `valid` 表示 Action 触发后的当前步骤校验允许继续导航。
- Assessment 不得用 `disabled = !formComplete` 把“数据无效”伪装成“按钮不可点击”。

每次物理点击的公共链路必须满足：

`1 physical tap → 1 component event → 1 page handler → at most 1 navigation`

## 2. Back Action Contract

所有 Assessment 步骤的 Back 默认 `backDisabled = false`，并始终可以被物理点击。Back：

1. 不校验当前步骤完整性。
2. 不清空或提交 Draft。
3. 不触发 Profile、网络请求或授权。
4. 存在有效父页面时使用 `wx.navigateBack()` 返回该父页面。
5. 页面处于根栈时使用明确的上一业务路由作为 root fallback，并根据目标页类型选择合法 API：非 Tab 目标使用 `wx.redirectTo()`；注册的 Tab 目标使用 `wx.switchTab()`。不得用空操作的 `navigateBack()` 伪装成功，也不得构造不存在的父页。
6. 一个 Back Action 只能发起一次导航。导航失败必须释放 guard 并允许用户重试。

Assessment 的根栈回退路由如下。`Tab` / `non-Tab` 类型指当前 `miniprogram/app.json` 的实际注册：

| 当前步骤 | 根栈回退目标 | 目标类型 | 根栈 API |
| --- | --- | --- | --- |
| Intro | Home (`/pages/home/index`) | Tab | `wx.switchTab()` |
| Basic | Intro | non-Tab | `wx.redirectTo()` |
| Health | Basic | non-Tab | `wx.redirectTo()` |
| ADL | Health | non-Tab | `wx.redirectTo()` |
| Cognitive | ADL | non-Tab | `wx.redirectTo()` |
| Preference | Cognitive | non-Tab | `wx.redirectTo()` |
| Budget | Preference | non-Tab | `wx.redirectTo()` |

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

## 12. Authority and version relationship

1. 当前 Product Source 定义产品流程、页面和用户可见目的地；本 Contract 定义这些流程中的交互与导航规则。
2. 微信平台行为限制导航 API 的合法目标。Contract 或 Product Source 不得要求调用平台明确不支持的 API。
3. Owner 决定用于解决 Product Source 或 Contract 未明确覆盖的冲突或歧义。不得把单次实现便利性推导成新的产品语义。
4. Runtime、自动测试、DevTools 与 Android 真机结果是各自类型的实现证据；它们不替代 Product Source 或 Contract。
5. `WECHAT_INTERACTION_CONTRACT.md`（`contract.wechat_interaction.v1`）是不可变的 Frozen V1 历史来源。该文件及其原文不得因本 successor 而改写。本 V2 对交互行为提供唯一当前规范：未在本文件明确改变的 V1 交互规则已经在本文件中保留；新实现不得把 V1 与 V2 当作两套并行的当前权威。
6. V2 只澄清根栈回退目标类型、已批准的具体回退路由和 Assessment 页面栈纪律。它不改变 Assessment 答案、Draft、校验、Recommendation 或任何业务域语义。

## 13. Navigation terminology and common rules

- `PARENT_BACK`：页面栈中存在有效父页面时，返回该既有导航历史。
- `ROOT_FALLBACK`：没有有效父页面时，按当前页面明确指定的业务回退目的地离开根页面。它是显式目的地动作，不表示“向后退一页”。
- `TAB_DESTINATION`：在当前 `miniprogram/app.json` `tabBar.list` 中注册的页面。
- `NON_TAB_DESTINATION`：非 Tab 的普通页面。
- Root fallback 必须由当前流程明确指定目的地；不能因为当前没有父页就一律返回 Home。
- 先按有效父栈处理普通 Back；只有没有有效父页时才采用 root fallback。Home 的存在不改变有父页面时的普通 Back 语义。
- API 选择由目标页面类型决定，而不是由源页面名称、入口来源或当前 Tab 是否可见来猜测。

| 情形 | 目标 | 必需 API |
| --- | --- | --- |
| 有效父页面存在，用户执行普通 Back | 既有父页面 | `wx.navigateBack()` |
| 无父页，流程指定非 Tab root fallback | 指定的普通页面 | `wx.redirectTo()` |
| 无父页，流程指定已注册 Tab root fallback | 指定的 Tab 页面 | `wx.switchTab()` |

## 14. WeChat platform constraint: Tab destinations

已注册的 Tab 页面必须使用平台支持的 Tab 导航方式。当前项目对显式 root fallback 使用 `wx.switchTab()`。

不得对 Tab 目的地使用会因其为 Tab 页面而不能打开它的普通页面导航 API；在当前具体路由中，`wx.redirectTo('/pages/home/index')` 已实测失败，错误为 `redirectTo:fail can not redirectTo a tabbar page`。`wx.navigateTo('/pages/home/index')` 同样不得作为 Tab root fallback 使用。不得以自动尝试多个 API 的方式掩盖目标类型错误；本 Contract 不要求 `wx.reLaunch()`。

这是一项微信平台约束，不是 Product Source 的业务规则。若未来平台行为或路由配置改变，应先核实最新项目 typings/API contract 和真实目标路由，再通过版本化 Contract 流程更新规范。

## 15. Non-Tab root fallback remains supported

`wx.redirectTo()` 仍是显式非 Tab root fallback 的合法方式。调用方必须：

- 选择当前流程明确指定的非 Tab 目的地；
- 仅在没有有效父页面时执行该 fallback；
- 保证一次用户动作最多发起一次导航；
- 在同步异常或导航失败后释放 guard 并允许重试。

本规则保留 V1 对 Assessment 非 Tab 根栈回退的语义。它不把 `wx.redirectTo()` 全局废止，也不允许把它用于已注册 Tab 目标。

## 16. Normative case: Assessment Intro root to Home

以下行为是规范要求；这是已关闭的 Owner 决定，不是待审议的新选择：

~~~text
CURRENT_PAGE = /pages/assessment/intro
PAGE_STACK = ROOT (no valid parent)
ACTION = user taps Back
DESTINATION = /pages/home/index
DESTINATION_TYPE = REGISTERED_TAB
REQUIRED_API = wx.switchTab
FORBIDDEN_APIS = wx.redirectTo, wx.navigateTo
RESULT = Home Tab becomes active
~~~

不得创建虚构父页、重复发起第二种导航、清除或提交 Assessment Draft、改变业务状态，或由 Back 本身触发登录、手机号授权、Backend 请求。开始或继续 Assessment 属于各自的显式业务 Action；它可以依 V1 保留的规则导航到明确的 non-Tab Assessment 页面。

## 17. Normative case: Institution List root to Home

当 `/pages/institution/index` 是当前根页面且没有有效父页时，导航栏 Back 和页面提供的等价 root fallback Action（包括空列表及错误状态 Action）均按以下已关闭的 Owner 决定执行 Tab root fallback：

~~~text
DESTINATION = /pages/home/index
DESTINATION_TYPE = REGISTERED_TAB
REQUIRED_API = wx.switchTab
FORBIDDEN_APIS = wx.redirectTo, wx.navigateTo
~~~

成功结果是 Home Tab 成为活动页。Action 不得伪造父页、进行两次导航或改变列表/机构业务状态。仅当本次 Action 由该回退本身引起时，登录、手机号授权和 Backend 请求次数均为零；不得把 Home 页面自行执行的独立生命周期行为归因于此 Back Action。

## 18. Normative contrasting case: Institution List with a parent

如果 Institution List 有有效父页面，用户的普通 Back（包括空列表/错误页上标注为返回上一页的 Action）必须调用一次 `wx.navigateBack()` 并返回该父页。不得仅因为 Home 是 Tab 就 `wx.switchTab('/pages/home/index')`，也不得把 root fallback 应用于有效父栈。

因此，同一 List 路由的行为由页面栈状态决定：

~~~text
valid parent exists -> wx.navigateBack()
no valid parent and explicit Home fallback -> wx.switchTab('/pages/home/index')
~~~

## 19. One action, one navigation

单一用户 Action 至多触发一次业务导航决定：

- parent Back → 一次 `wx.navigateBack()`；
- non-Tab root fallback → 一次 `wx.redirectTo()`；
- Tab root fallback → 一次 `wx.switchTab()`。

禁止从一次点击组合 `navigateBack + switchTab`、`redirectTo + switchTab`、`navigateTo + switchTab`，或先后尝试多个 API。组件原生 tap 与 `triggerEvent` 不得为同一个 Action 建立重复业务通道。防重复 guard 是次级保护，不能修补错误的事件绑定或目标类型选择。

## 20. Navigation failure and retry

导航同步异常、`fail` 回调或等价失败结果必须释放该 Action 的 pending/guard 状态，向用户提供当前交互需要的可见失败反馈，并允许再次尝试。禁止永久锁定、自动多 API fallback、重复提示/跳转循环。成功结果只能有一次目标导航。

## 21. NavigationGuard is secondary insurance

NavigationGuard 只能抑制同一页面生命周期内仍在执行的重复导航请求，不能替代正确的事件链或 API 选择。用户返回来源页后，guard 必须允许再次操作。不得把任意固定 debounce 时长冻结为 Contract 要求。

## 22. Assessment page-stack discipline

Assessment Flow 不得无界累积页面栈，导致推荐、机构详情或其他后续导航因栈耗尽而不可用。实现应使用能保持既有 Back/Forward/Draft 语义的页面栈管理方式。

这项规则不定义产品级页面数量，也不将 `MAX_STACK = 10` 或任何其它数字设为产品常量。历史 DevTools 曾在深度 10 报告 `navigateTo:fail:page limit exceeded: 10`，Android WebView 也曾报告 `navigateTo:fail webview count limit exceed`；这些是平台/实现证据，不是业务限制。根栈返回出现小于一秒的轻微粘滞感属于低级体验观察，不构成性能 SLA 或本 Contract 的要求。

## 23. Cross-domain isolation

本 Contract 只规定交互与导航。它不授权、也不改变：

- Recommendation V2 的 eligibility、exactness、排序、reason 或结果；
- Institution ID、`recordRevision`、 verified facts、公开展示或运营授权语义；
- Appointment Create、InstitutionVisit 创建/提交、Evaluation 或 Contact Consultant 权限；
- C5 身份/session、C4 persistence、Backend origin 或任何后端状态；
- 手机号授权/provider、真实电话能力或个人数据处理；
- AI 的输入范围、输出或业务决策。

导航不得仅凭自身触发登录、C5 会话、手机号授权、`getPhoneNumber` 或 Backend 请求；目标页面独立的产品行为依其所属 Contract 处理。

## 24. Implementation conformance and evidence

新导航实现或导航 API 修改必须证明：实际注册的源/目的地、有效父页面与 root fallback 的分支、目标是否为 Tab、所选 API 与失败后状态释放。组件绑定和页面 handler 必须沿单一 Action 链执行。QA 应审查完整路径：

`physical action -> component event -> page handler -> navigation decision -> result/failure release`

当前符合实现及历史验证基线：

~~~text
TESTED_RUNTIME_SOURCE = 4ba7b61abd31ff2b560b9ae4ab8b43d1e2449c90
HOME_IS_TAB = YES
HOME_ROUTE = /pages/home/index
INTRO_ROOT_HOME = wx.switchTab
INSTITUTION_LIST_ROOT_HOME = wx.switchTab
INSTITUTION_LIST_VALID_PARENT_BACK = wx.navigateBack
KNOWN_AUDITED_ROOT_HOME_REDIRECT_TO_COUNT = ZERO
KNOWN_AUDITED_ROOT_HOME_NAVIGATE_TO_COUNT = ZERO
PREVIOUS_HIGH_FINDING = CLOSED_BY_4ba7b61
FRESH_DEVTOOLS = PASS
ANDROID_17_INSTITUTION_NAVIGATION = PASS
ANDROID_17_INSTITUTION_LIST_ROOT_BACK = PASS
G13_IMPLEMENTATION_CONFORMANCE = PASS
PRIOR_RUNTIME_G15_QA = PASS
CONTRACT_DRAFT_G15 = REQUIRED_BEFORE_FREEZE
~~~

这些标记描述的是上述 runtime commit 的既有证据。本 V2 的文档提交本身不属于 Android、DevTools 或 runtime 测试对象。任何后续 runtime 修改都必须按其影响重新验证；不得把历史证据自动沿用到不同 runtime source。Root fallback 轻微粘滞观察保持 `LOW_NON_BLOCKING`，不阻塞符合性。

## 25. QA obligations

QA 必须逐项确认：父栈 Back 与 root fallback 区分；Tab 与 non-Tab 的 API 合法；每个具体流程的 fallback 目的地明确；单一点击最多一次导航；失败可重试；页面栈不无界累积；没有业务状态、认证、手机号或后端副作用。自动化、DevTools、ADB 和人工 Android 证据必须分开标注。未取得的证据不得标为 PASS。

## 26. Version and change control

本 Contract 作为 `contract.wechat_interaction.v2` 冻结后，是当前唯一有效交互 Contract。任何改变目标路由、Tab 身份、Back 行为、单一事件链、失败恢复或 Assessment 栈原则的后续语义，都必须通过新版本化 successor 澄清；不得就地修改 V1 或本 Frozen V2。Product 流程调整需先按 Product governance 决定，不得用实现推测覆盖。
