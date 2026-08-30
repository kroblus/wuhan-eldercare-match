# Bootstrap 领域契约

本文件冻结小程序骨架所需的最小语义，不代表正式后端 API 或数据库 schema 已完成。

Phase 3A-2 已在 `ELDER_PROFILE_CONTRACT.md` 冻结 `elder-profile-contract-v1`，并在 `ADL_RULE_CONTRACT.md` 冻结 `adl-ruleset-v1`；二者替代本文和 Bootstrap 类型中的 ElderProfile 占位形状。

Phase 3A-3 的 `ANONYMOUS_PROFILE_PREVIEW_CONTRACT.md` 单独定义本地完整 Draft 的 ephemeral Preview；它不把 Draft 升级或伪装成正式 Assessment/Profile。

## 核心对象

- `Elder`：老人档案，可拥有多次评估。
- `Assessment`：一次不可被后续重评覆盖的评估记录。
- `AssessmentAnswer` / `AssessmentDraft`：结构化答案与未提交草稿。
- `ElderProfile`：由指定评估推导的老人需求画像。
- `ElderProfilePreview`：由当前完整本地 Draft 即时派生、不可持久化的画像预览，不是历史画像。
- `Institution`：机构资料，字段必须携带数据来源和可空语义。
- `Recommendation`：必须绑定生成它的 `assessmentId`。
- `RecommendationReason`：结构化、可追溯到机构字段的理由；本批只定义类型。
- `Appointment`：预约申请；提交不等于确认。

## 不变量

1. 重新评估创建新的 `Assessment`，不得覆盖历史记录。
2. `ElderProfile.identity.assessmentId` 指向生成画像的评估。
3. `ElderProfilePreview.source.localDraftId` 只能指向真实本地 Draft，且 Preview 不得包含 `assessmentId`、`elderId` 或 `completedAt`。
4. `Recommendation.assessmentId` 指向生成推荐的评估。
5. `RecommendationReason` 不得脱离机构真实字段生成。
6. 健康与特殊护理数据按高敏感信息处理，最小化采集和展示。
7. 匿名用户可以浏览并填写评估草稿；保存档案、历史记录和预约可以在明确操作点要求登录。
8. 手机号只在预约或用户明确要求顾问联系时获取。

## 预约状态

建议最小状态集合：

```text
DRAFT → SUBMITTED → CONFIRMED → COMPLETED
                    ↘ CANCELLED
```

- `SUBMITTED`：用户已提交申请，等待顾问或机构确认。
- `CONFIRMED`：业务侧已确认接待事实。
- 页面不得因提交表单直接展示为 `CONFIRMED`。

Bootstrap 只定义状态语义，不实现持久化或状态机。

## 未知与来源

- 允许 `null` 表示未提供或不适用。
- 允许显式 `unknown` 状态表示尚未核验。
- Mock 记录使用 `MOCK_DEVELOPMENT_ONLY`。
- 真实机构信息只有业务核验完成后才能使用 `VERIFIED`。

## 后续冻结顺序

1. 评估题目与答案枚举；
2. ADL 与老人画像规则；
3. 机构能力字段和证据来源；
4. 推荐输入/输出 contract；
5. API contract；
6. 数据库 schema 与 migration。

完成以上契约后，才允许前后端并行接入。
