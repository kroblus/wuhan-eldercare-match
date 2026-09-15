# Recommendation Result UI Contract

状态：`PROPOSED_PHASE_4C_2`

版本：`recommendation-result-ui-v1`

冻结前置：Automated、DevTools、matching_engine、qa_reviewer 与项目负责人 Android 17
`MANUAL_ANDROID_REAL_DEVICE_VERIFICATION` 全部通过。人工证据不得写成 ADB 或 automated PASS。

## 1. Scope

本阶段只实现 `/pages/recommendation/result`：

```text
AssessmentDraft
  -> Recommendation Preview Application Integration
  -> Recommendation Result Application Snapshot
  -> RecommendationResultViewModel
  -> WXML
```

不修改 Recommendation / Institution / ElderProfile / Assessment Domain，不迁移 Institution List/Detail，
不实现 Backend、持久化、真实武汉机构、VR、登录、手机号、预约或顾问联系提交。

## 2. Application display snapshot

Phase 4C-1 的 `buildRecommendationPreview()` 签名、返回值和错误语义保持不变。页面不得直接读取
Provider、Mock、Institution service、Assessment answers 或 Domain 内部函数。

为解决 Preview 不含展示事实的 `DOMAIN_DISPLAY_GAP`，Application 增加只面向页面的加法式入口：

```text
RecommendationResultApplicationSnapshot
  preview: RecommendationPreview
  institutionRecords: same validated complete catalog snapshot
  advisories: RecommendationAdvisoryAttachment[]
  datasetVersion
  datasetMode
  evaluationAsOf
```

同一次调用只读取一次 Draft、只加载一次 Catalog，并以同一份 Profile Preview、Institution records 与
evaluationAsOf 调用现有 `evaluateRecommendationPreview()` 和独立 `buildRecommendationAdvisories()`。
records 不预筛、不预排、不截断；ViewModel 只按 `institutionId + recordRevision` 关联卡片。
禁止数组下标、名称或临时 ID 映射。Snapshot 不写 storage，不缓存，不生成正式身份。

## 3. PRD Page 10 source mapping

| PRD 显示 | 唯一合法来源 | 展示边界 |
| --- | --- | --- |
| 综合建议 | `semantics.exactMatch`、`noExactMatch.reasonCode`、候选集合与静态模板 | 不生成“更建议医养结合型”等新个性化结论 |
| 筛选重点标签 | `semantics.elderSnapshot` 已冻结 derived facts | 只做 stable code 中文映射与最多 3 项展示排序，不形成匹配理由 |
| 推荐原因 | `RecommendationItem.reasons` | 只允许 reason code + 自身 evidence field path 的中文模板；无 reason 不补 |
| 看院建议 | PRD 的通用静态 checklist | 必须写成“建议实地确认”，不是机构事实 |
| 推荐机构 | `semantics.items`；独立 `conditionalCandidates` | 严格消费 Domain 数量和顺序，最多 3 但不补满 |
| 名称 | 同源 `InstitutionRecord.identity.name` | 保留 Mock 名称；不从 ID 猜名称 |
| 区域 | `identity.regionDisplayName` | 不从地址或名称推断 |
| 类型 | `typeProfile.primaryType` / `supportedTypes` | 仅机构信息；不能创造 TYPE_MATCH reason |
| 参考费用 | `price.referenceMonthlyPrice` | bounded / starting_at / unknown；不显示 0、免费或最终价格 |
| 主要标签 | 机构 structured type facts | 最多 3 项；是展示标签，不是 RecommendationReason |
| 为什么推荐 | `item.reasons` | 不读取 raw capability 额外发现理由 |
| 主要差异 | `item.differences` | 全部展示；category/severity 视觉不降级 |
| 床位提示 | `AVAILABILITY_DISPLAY_ONLY` advisory | 只作动态咨询提示，绝不改变顺序或适配结论 |
| 封面 | 同源 record 的可解析 cover media | 不存在时显示中性“暂无机构图片”，不拉 stock photo |
| VR | `record.vr` | 只有合法 available 才能出现标识；当前 Mock 无 VR，标识与 CTA 数量都必须为 0 |

普通 UI 不展示 evidence ID、fieldPath、rule ID、rank tuple、tier code、localDraftId 或内部版本。

## 4. Result states

稳定页面状态：

```text
loading
ready_exact
ready_soft_near
ready_conditional
no_safe_recommendation
assessment_error
catalog_error
recommendation_error
```

- Exact：只表达“关键护理需求已找到可确认匹配的候选机构”，不承诺 100% 适合或入住。
- SoftNear：必须显示“暂时没有完全符合全部偏好条件的合作机构”，并逐卡显示所有 difference。
- Conditional：独立标题“需要机构进一步评估的候选”，不得放入“已匹配机构”。
- Unverified / Ineligible：只留在 Domain audit，不生成卡片，不用于补足数量。
- No safe：无 items 且无 conditionalCandidates 时显示安全空态，不凑卡。
- Application error：不显示旧结果、原始 Draft/Profile/Catalog/stack；提供 Retry、调整需求或顾问入口。

每次 `onShow` 先原子清空旧 ViewModel并进入 loading，再生成一次 ISO `evaluationAsOf`，调用一次
Application entry。只接受本轮最新异步结果；不缓存 RecommendationPreview 或机构结果。

## 5. Reason, difference and advisory presentation

Reason 文案只能由 `RecommendationReason.reasonCode` 形成；需要具体护理名称时，只能读取该 reason
自带的 `institutionEvidenceRefs.fieldPath` 做稳定 label 映射。不得从 InstitutionRecord capability 再推新 reason。

Difference 必须全部保留：

| category | UI 层级 |
| --- | --- |
| `SOFT_DIFFERENCE` | 中性“偏好差异” |
| `CONDITIONAL_REQUIREMENT` | 明确“需机构进一步评估” |
| `UNVERIFIED_DATA_GAP` | “资料待核验” |
| `HARD_CONFLICT` | 只用于安全空态摘要，不公开机构负面清单 |

Availability 与 upfront cost 只消费独立 advisory attachment。它们不是 reason/difference，不改变卡片
顺序、tier、exactness 或 eligibility。

## 6. Mock disclosure

当 `datasetMode = MOCK_DEVELOPMENT_ONLY` 时，页面顶部持续可见：

> 开发演示数据
>
> 以下机构、价格与护理能力均为功能测试示例，不代表真实合作机构信息。

不得只写在日志、About 或测试报告。所有截图和人工验收称为
`DEVELOPMENT_MOCK_RECOMMENDATION_UI`，不得称“真实推荐结果”。

## 7. Downstream identity gate

当前 Institution Detail/List 仍为 legacy/骨架，与 V1 Catalog ID 不同源：

```text
CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED
```

推荐卡不得导航到 legacy Detail；“查看详情”位置显示“机构详情接入中”。“查看全部合作机构”位置显示
“合作机构列表接入中”。不得使用 index、名称或临时 ID mapping。Consultant tab 路由稳定，可通过
`wx.switchTab` 打开，但不触发登录、手机号或联系提交。

## 8. Interaction matrix

| Action | Element / clickable | Validation | Side effect / navigation | Rapid tap | Failure feedback |
| --- | --- | --- | --- | --- | --- |
| Back | NavigationBar；所有状态可点 | 无 | 正常 `navigateBack`；根栈 `redirectTo` Profile | 依现有真机 Back contract，页面不增加第二导航通道 | 当前页 inline error |
| Retry | error state PrimaryButton；loading 禁用 | 无 | 重新读取 Draft/Catalog；不持久化 | 同一 refresh in-flight 忽略 | error panel 保留，可再次重试 |
| Adjust Needs | ready/no-safe/error secondary action | 无 | 返回既有 Profile；不复制问卷 | NavigationGuard，最多 1 次 | 当前操作区 inline error |
| Consultant | ready/no-safe/error action | 无登录/手机号 | `switchTab` Consultant | NavigationGuard，最多 1 次 | 当前操作区 inline error |
| Institution Detail | 产品位置不可导航 | 同源 identity gate 未通过 | 无；显示“机构详情接入中” | 无导航 | 静态开发态说明 |
| View All | 产品位置不可导航 | 同源 list gate 未通过 | 无；显示“合作机构列表接入中” | 无导航 | 静态开发态说明 |
| Conditional | 卡片可读，不作为已匹配 | 无 | 不新增下游导航 | 无导航 | 明确“需机构评估” |
| onShow refresh | 生命周期 action | Service 校验 | 清旧数据、一次时间快照、重算 | 只接收最新 generation | 映射为稳定错误状态 |

业务事件继续满足：`1 physical tap -> 1 handler -> at most 1 navigation`。NavigationGuard 只作第二层保护。

## 9. Visual direction

使用现有 PageContainer、SectionCard、PrimaryButton、Tag、NavigationBar、StatePanel 和 Less tokens。
方向为“温暖克制的照护决策书”：纵向叙事、陶土色结论标记、清晰分组和留白；35–65 岁用户优先，
主要触控区至少 88rpx。禁止 dashboard、雷达图、进度环、匹配百分比、概率、AI 分和算法指标。

## 10. Verification and freeze gate

自动 Gate 至少覆盖 RESULT-001–030，并回归 Recommendation、Integration、Institution、ElderProfile、
Preview、Profile、Assessment、Interaction、TS 5.9、WeChat TS 4.1.2 targeted、JSON 和 diff check。

必须由微信开发者工具实际编译并真实打开 Profile -> Recommendation Result；生成产物必须包含 result page、
ViewModel、Recommendation Preview/Catalog Service 及 Recommendation/Institution Domain，再运行 generated JS
compatibility 与 self-test。

最终 QA 后状态仍保持 PROPOSED，直至项目负责人完成 Android 17 人工矩阵。Android 人工通过后才能更新为：

```text
FROZEN_PHASE_4C_2
```

本阶段不自动 commit，不进入 Institution List/Detail migration。

### 10.1 Phase 4C-2 implementation evidence

| 证据类型 | 状态 | 证据边界 |
| --- | --- | --- |
| `AUTOMATED` | PASS | Result 30、Integration 24、Recommendation 117、Institution 96、ElderProfile 45、Preview 20、Profile 17、Assessment 12、Interaction 38 + 2；TS 5.9 application、WeChat TS 4.1.2 targeted、JSON 37、diff check 与 compatibility self-test 均通过 |
| `DEVTOOLS` | PASS | Stable v2.01.2510290 本轮重新编译，并实际走通 Budget -> Profile -> Recommendation Result；结果页正常渲染，Console errors = 0 |
| `DEVTOOLS_GENERATED_JS` | PASS | 最新 WeappCompileCache 共 67 个 JS 模块，包含 Result Page、ViewModel、Recommendation Preview/Catalog Service、Recommendation Domain 与 Institution validator；class-field compatibility PASS |
| `MATCHING_ENGINE_READONLY_REVIEW` | PASS | 卡片顺序、tier、reasons、differences、unverified/ineligible、availability 与 no-exact 语义保持冻结 Domain 输出 |
| `QA_REVIEWER_READONLY_REVIEW` | PASS | 独立复跑正式 Gate并审查 PRD coverage、Mock disclosure、Domain fidelity、Interaction、Privacy 与下游 identity gate；无代码 blocker |
| `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION` | PENDING | 只能由项目负责人在 Android 17 微信真机完成下方 16 项矩阵；不得记为 ADB 或 automated PASS |

因此本文仍为 `PROPOSED_PHASE_4C_2`，Android 人工 Gate 完成前不得冻结或提交基线。

## 11. Android 17 manual real-device matrix

证据类型固定为 `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`，不能记为 ADB 或 automated。自动 Gate、
微信开发者工具和 QA 通过后，仍需由项目负责人在 Android 17 微信真机逐项确认：

| ID | 人工检查项 | 冻结前状态 |
| --- | --- | --- |
| ANDROID-RESULT-001 | Profile 只进入一次 Recommendation Result | PENDING |
| ANDROID-RESULT-002 | 顶部 Mock Banner 清晰可见且文案完整 | PENDING |
| ANDROID-RESULT-003 | 长页面滚动、触控、safe-area 和固定层无异常 | PENDING |
| ANDROID-RESULT-004 | 卡片数量等于 Engine 实际输出，不补满 3 家 | PENDING |
| ANDROID-RESULT-005 | 推荐理由清晰可读且没有内部 code/evidence | PENDING |
| ANDROID-RESULT-006 | difference / conditional / unverified 提示层级正确 | PENDING |
| ANDROID-RESULT-007 | 不出现百分比、概率、分数或 AI 推荐文案 | PENDING |
| ANDROID-RESULT-008 | UNVERIFIED / INELIGIBLE 不成为推荐卡 | PENDING |
| ANDROID-RESULT-009 | Back 只返回一级 Profile，根栈 fallback 可用 | PENDING |
| ANDROID-RESULT-010 | 修改 Assessment 后再次进入会展示重新计算结果 | PENDING |
| ANDROID-RESULT-011 | rapid Back / Consultant / Adjust 不重复导航 | PENDING |
| ANDROID-RESULT-012 | 页面栈无重复 Profile / Recommendation | PENDING |
| ANDROID-RESULT-013 | 当前无 VR 时不出现 VR 标识或 CTA | PENDING |
| ANDROID-RESULT-014 | 不触发微信登录、手机号授权或网络请求 | PENDING |
| ANDROID-RESULT-015 | Detail/List 开发态位置不会进入 legacy 不同机构 | PENDING |
| ANDROID-RESULT-016 | loading、error、no-safe 操作区可见且可点击 | PENDING |

只有上述矩阵全部由项目负责人报告 PASS，且此前 Automated、DevTools、matching_engine 与
qa_reviewer Gate 保持 PASS，才允许把本文状态更新为 `FROZEN_PHASE_4C_2`。
