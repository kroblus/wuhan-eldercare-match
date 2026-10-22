# Elder Profile Preview UI Contract

状态：`PROFILE_UI_PHASE_3B = FROZEN`

适用范围：`pages/assessment/profile`

本文件只冻结 Phase 3B 的页面展示、交互与恢复边界。它不修改
`ASSESSMENT_CONTRACT.md`、`ELDER_PROFILE_CONTRACT.md`、
`ADL_RULE_CONTRACT.md` 或 `ANONYMOUS_PROFILE_PREVIEW_CONTRACT.md` 的业务语义，
也不定义 Recommendation、Institution 或 Backend 契约。

## 1. 产品目标与数据流

页面目标是让用户确认“系统是否正确理解了老人当前情况和养老需求”，不是原始问卷回顾、算法调试页或推荐结果页。

唯一允许的数据流：

```text
AssessmentDraft Store
  -> deriveElderProfilePreview()
  -> ElderProfilePreview
  -> ProfilePageViewModel
  -> WXML
```

- 页面每次 `onShow` 都重新读取当前 Draft 并派生 Preview。
- Preview 与 ViewModel 只保存在当前页面内存，不写回 Draft、storage 或其他 Store。
- 页面不得构造 `CompletedAssessment`、`assessmentId`、`elderId`、`completedAt`。
- Page 和 ViewModel 不得从原始答案重新计算 ADL、行动能力、认知、康复或特殊护理结论。
- 页面不得读取机构目录、实现匹配或触发网络请求。

## 2. ProfilePageViewModel 边界

ViewModel 只负责：

- 将冻结的 stable code 映射为用户可读中文；
- 按产品信息架构组合及排序区块；
- 决定已存在事实、required 能力和 clarification 的展示形态；
- 提供编辑路由、视觉 token 与 CTA 文案。

ViewModel 不负责：

- 根据七项 ADL 答案计算照护等级；
- 根据症状推断疾病或认知症诊断；
- 将 `unknown`、`needs_confirmation`、`not_reported` 转换为确定事实；
- 根据文案反向生成业务 code；
- 暴露 evidence ID、rule ID、版本号、question ID 或 option code。

页面优先消费 `userFacingSummary` 的稳定 section/code 作为展示清单，并从同一个 Preview 中读取对应 raw/derived fact 生成文案。中文文案永远不是业务逻辑输入。

## 3. 信息架构与编辑入口

| 产品区域 | Preview 来源 | 编辑目标 |
| --- | --- | --- |
| 核心画像概览 | basic + 已派生 careLevel、mobility、rehabilitation、cognition、required special care | Basic / 对应区块 |
| 健康情况 | health raw/derived facts | Health |
| 日常生活与照护 | ADL raw answers、careLevel、mobility、careModes | ADL |
| 认知与特殊护理 | cognition raw/derived facts、specialCare derived facts | Cognitive |
| 仍有信息需要确认 | Preview clarifications | clarification 来源所属步骤 |
| 养老偏好 | preference raw facts，区域只用 `regionLabelSnapshot` | Preference |
| 预算与入住计划 | financial + intent raw facts | Budget |

每个主要产品区块提供明确“修改”入口。编辑动作不清空 Draft、不创建历史 Assessment，也不保存 Preview。

编辑导航优先回退到当前导航栈中已存在的对应 Assessment 页面；只有异常深链下目标页面不在栈中时才 `redirectTo` 该步骤。禁止用 `navigateTo` 把新的问卷链压在旧 Profile 之上。

## 4. 用户表达边界

- `careLevel` 与 `careModes` 分开展示；照护等级必须附“基于本次生活能力问卷，不是医学诊断、官方失能鉴定或长护险等级”的说明。
- `careLevel.status = unknown` 时显示“自理能力等级暂无法确定”，不得显示候选确定等级。
- `medium` confidence 不直接展示技术置信度；其相关 clarification 用“部分情况仍需进一步确认”表达。
- `special_feeding` 只显示“特殊进食方式 · 具体情况待确认”；只有 `tube_feeding = required` 才显示“鼻饲护理”。
- `catheter_or_stoma` 只显示“导尿/造瘘情况 · 具体护理需求待确认”；只有 `catheter_care = required` 才显示“导尿护理”。
- 用户报告的诊断必须写为“已报告/评估中了解到”，症状不能升级为系统医学诊断。
- 特殊护理优先显示 `required`、`needs_confirmation` 与重要已报告事实；`not_reported` 不得显示为“不需要”。
- 顾问意向只展示，不触发登录、手机号、联系顾问或请求。

## 5. Clarification UI

`clarifications.length > 0` 时显示“仍有信息需要确认”区域。

优先级只控制克制的视觉层级：

1. `required_before_classification`
2. `required_before_hard_filter`
3. `recommended`
4. `informational`

该区域不得使用医学报警式文案，不展示内部 clarification/evidence 标识。每条 clarification 必须由冻结 reason/source 语义映射为友好说明；不得创建新的风险推断。

## 6. 页面状态与恢复

页面状态固定为：

- `loading`：正在读取 Draft 并派生；
- `ready`：Preview 成功，展示 ViewModel；
- `incomplete`：`INCOMPLETE_ASSESSMENT_NOT_DERIVABLE`；
- `error`：`INVALID_DRAFT_STRUCTURE` 或 `UNSUPPORTED_ASSESSMENT_SCHEMA`。

恢复规则：

- incomplete 且 Draft 有有效答案：根据错误返回的第一个 question ID 回到对应 Assessment 步骤；
- incomplete 且没有答案：回到 Assessment Intro；
- invalid/unsupported：回到 Assessment Intro，由既有 Continue/Restart 流程处理；
- 恢复动作不自动补答案、不清空 Draft、不生成 partial Profile；
- 派生失败时不展示旧 ViewModel，也不允许进入 Recommendation。

错误和导航失败必须在当前操作区域给出可见文字反馈，不能只表现为按钮无响应，也不能输出完整 Draft/Profile 到日志。

## 7. Recommendation CTA 安全过渡

Ready 状态保留页面底部 Primary CTA，文案为“查看推荐结果（开发中）”。

该 CTA 只导航到现有 `/pages/recommendation/result` Skeleton。Skeleton 必须继续明确尚未生成真实推荐；本阶段不得创建 Recommendation、机构候选、匹配度、推荐理由或 `NO_EXACT_MATCH` 结果。

## 8. PROFILE_INTERACTION_MATRIX

| Action | Element | Clickable | Validation | Side effect | Navigation | Rapid tap behavior | Failure feedback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Navigation Back | NavigationBar Back | 始终可点击 | 无 | 不改 Draft/Preview | 正常栈返回上一级；根栈 fallback Budget | 保持已通过真机验证的原生 Back 行为，不为理论对称新增 Back guard | 导航 API fail 时页面显示“暂时无法返回，请重试” |
| 修改基本情况 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 Basic；深链 fallback redirect Basic | 同一 action pending 时忽略后续点击 | 当前页显示导航失败信息 |
| 修改健康情况 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 Health；深链 fallback redirect Health | 同上 | 同上 |
| 修改日常照护 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 ADL；深链 fallback redirect ADL | 同上 | 同上 |
| 修改认知/特殊护理 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 Cognitive；深链 fallback redirect Cognitive | 同上 | 同上 |
| 修改养老偏好 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 Preference；深链 fallback redirect Preference | 同上 | 同上 |
| 修改预算/计划 | 区块“修改” | ready 时可点击 | 无 | 不改 Draft | 回栈 Budget；深链 fallback redirect Budget | 同上 | 同上 |
| Ready Primary CTA | PrimaryButton | ready 时可点击 | Preview 已成功 | 无登录、网络或持久化 | navigateTo Recommendation Skeleton | NavigationGuard 保证最多一次 push；返回 Profile 的 onShow 重置 | 当前页显示“暂时无法打开，请重试” |
| Incomplete recovery | StatePanel 外 PrimaryButton | 可点击 | 不再次生成 partial Preview | 不改 Draft | 首个缺失步骤；无答案时 Intro | guard 保证最多一次 | 当前页显示导航失败信息 |
| Invalid recovery | StatePanel 外 PrimaryButton | 可点击 | 无 | 不清空非法 Draft | Intro | guard 保证最多一次 | 当前页显示导航失败信息 |
| onShow refresh | 页面生命周期 | 非物理 action | 每次完整 derive | 只替换当前页内存 ViewModel | 无 | 连续 onShow 以最新 Draft 为准，不使用 Preview cache | 稳定转为 incomplete/error，不 crash |

所有业务组件继续遵守：

```text
1 physical tap -> 1 custom action -> 1 page handler -> at most 1 navigation
```

自定义业务事件使用明确名称并设置 `bubbles: false`、`composed: false`。NavigationGuard 只是第二层防御。

## 9. 验收边界

- Runtime manifest 固定覆盖 `PROFILE-001` 至 `PROFILE-017`。
- 必须运行 ElderProfile、Preview、Assessment 与 Assessment Interaction 回归。
- 微信开发者工具必须实际编译并进入 Profile，真实产物必须包含 Profile 到 Preview domain 的模块链。
- Android 17 结果只能由项目负责人标记为 `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`；自动化和 DevTools 不能代替。
- Phase 3B 不允许 Recommendation、Institution、Backend、登录、手机号、预约或 P1/P2 实现。

## 10. Phase 3B Freeze 证据

本阶段冻结证据按来源分别记录，不互相替代：

- `AUTOMATED`：Profile page、ElderProfile、Preview、Assessment、Assessment Interaction、
  微信 JavaScript 兼容及定向微信 TypeScript 兼容 Gate 通过。
- `DEVTOOLS`：微信开发者工具完成最新实际编译，并实际加载
  `Budget -> Profile -> Recommendation Skeleton`；Profile 与 Preview domain 模块进入最新生成产物。
- `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`：项目负责人在 Android 17 微信真机完成人工验收，
  `PROFILE_ANDROID_RESULT = PASS`。覆盖 Profile 长页滚动、物理 Back、各修改入口、最新 Draft
  重新派生、unknown/clarification 表达、特殊护理语义边界、Primary CTA、快速点击与导航栈。

上述 Android 证据不是 ADB 验证，也不是自动化 Android 测试。
