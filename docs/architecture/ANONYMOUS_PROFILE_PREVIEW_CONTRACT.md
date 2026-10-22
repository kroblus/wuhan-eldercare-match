# Anonymous Profile Preview Contract

状态：`FROZEN_PHASE_3A_3`

Preview 使用的正式语义版本：

- `profileContractVersion = elder-profile-contract-v1`
- `derivationRulesetVersion = elder-profile-ruleset-v1`
- `adlRulesetVersion = adl-ruleset-v1`

本文件定义完整本地 `AssessmentDraft` 如何生成临时老人画像预览。它不授权 Profile UI、Recommendation、Institution Matching、Backend、登录、手机号或持久化实现。

## 1. Purpose

客户端当前拥有可恢复的本地评估草稿，但没有服务器 Assessment ID、老人档案 ID 或正式完成时间。本 Contract 建立以下合法链路：

```text
AssessmentDraft
        ↓ frozen completion validation
Validated Local Assessment Snapshot
        ↓ shared semantic derivation core
ElderProfilePreview
```

正式历史链路保持不变：

```text
CompletedAssessment
        ↓ formal identity validation
shared semantic derivation core
        ↓
ElderProfile
```

两条链路共享全部 ADL、行动能力、康复、认知、特殊护理、Evidence、Clarification 和 Summary 规则。

## 2. Problem

`AssessmentDraft.localDraftId` 只标识本机当前编辑草稿，不是服务器 Assessment ID。Draft 也没有 `elderId`、`status = completed` 或 `completedAt`。

禁止将 Draft 包装成伪造的 `CompletedAssessment`，包括但不限于：

```text
id = localDraftId
elderId = anonymous
completedAt = current timestamp
kind = completed_assessment
```

这样做会破坏历史记录、身份 provenance、determinism 和未来 Backend 接入边界。

## 3. Formal vs Preview Boundary

| 维度 | 正式 ElderProfile | ElderProfilePreview |
|---|---|---|
| 输入 | 合法 `CompletedAssessment` | 完整合法 `AssessmentDraft` |
| 对象 kind | `elder_profile` | `elder_profile_preview` |
| 身份 | 强制 `ElderProfile.identity` | 强制 `ElderProfilePreview.source` |
| Assessment ID | 真实服务器 ID | 不存在 |
| Elder ID | 真实档案 ID | 不存在 |
| Completed time/status | 真实完成记录 | 不存在 |
| 持久化语义 | 历史画像 | ephemeral preview |
| 语义规则 | shared core | 同一个 shared core |

不得把正式 `ElderProfile.identity` 改成 optional 或 union。不得让 Preview 继承正式身份。

## 4. Preview Identity

Preview 外层固定为：

```ts
interface ElderProfilePreviewSource {
  kind: 'local_assessment_preview'
  localDraftId: string
  assessmentSchemaVersion: 1
}

interface ElderProfilePreview extends ElderProfileSemanticPayload {
  kind: 'elder_profile_preview'
  source: ElderProfilePreviewSource
  profileContractVersion: 'elder-profile-contract-v1'
  derivationRulesetVersion: 'elder-profile-ruleset-v1'
}
```

Preview 不生成或保存：

- `previewId`；
- `assessmentId`；
- `elderId`；
- `completedAt`；
- `generatedAt`；
- server ID、completed status 或 historical status；
- UUID、当前时间或随机值。

`localDraftId` 只能出现在 `source.localDraftId`，不得复制到任何正式 identity 字段。

## 5. Validated Local Snapshot

实现内部使用不对页面暴露的纯内存快照：

```ts
interface ValidatedLocalAssessmentSnapshot {
  kind: 'validated_assessment_snapshot'
  source: {
    kind: 'local_draft'
    localDraftId: string
    persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY'
  }
  schemaVersion: 1
  answers: AssessmentAnswerSnapshot
}
```

该对象只证明：

1. 输入是合法本地 Draft 结构；
2. 已调用冻结的 `validateAssessmentDraftForCompletion`；
3. required answers 完整；
4. 所有已存在 answer key、optional answer 和条件题合法；
5. answers 已按当前 snapshot 深复制。

它不是 `CompletedAssessment`、历史记录或存储对象。`currentStep`、`startedAt` 和 `updatedAt` 不进入画像语义。

## 6. Shared Semantic Core

唯一核心函数是：

```text
deriveProfileSemantics(AssessmentAnswerSnapshot)
  → ElderProfileSemanticPayload
```

生产位置：

```text
miniprogram/domain/elder-profile/derive-elder-profile.ts
```

该函数不接收任何正式或本地 identity，只处理已经验证的答案快照。两个 adapter 必须调用它：

```text
deriveElderProfile
  → validate CompletedAssessment identity and answers
  → deriveProfileSemantics
  → attach formal identity

deriveElderProfilePreview
  → validate local Draft structure and completion
  → deriveProfileSemantics
  → attach local preview source
```

`deriveProfileSemantics` 与答案快照运行时校验函数是 adapter-only internal API，不从 `miniprogram/domain/elder-profile/index.ts` 导出。页面、未来 Recommendation 和其他业务调用方不得直接消费裸 `ElderProfileSemanticPayload`，必须通过携带正式 identity 或真实本地 source 的公开 adapter。

`deriveElderProfilePreview` 不得复制或重新实现 ADL、cognition、rehabilitation、special-care、Evidence、Clarification 或 Summary 规则。

## 7. Shared Semantic Payload

`ElderProfileSemanticPayload` 同时被正式 Profile 与 Preview 复用，包含：

- `basic`
- `health`
- `adl`
- `mobility`
- `cognition`
- `specialCare`
- `preference`
- `financial`
- `intent`
- `userFacingSummary`
- `evidence`
- `clarifications`

正式 `ElderProfile` 的 public runtime shape 除抽取共享 TypeScript interface 外不改变。

## 8. Evidence Provenance

现有 `DerivationEvidence`、Evidence ID、question ID、option code 和完整 answer-set snapshot 结构保持不变。

- 正式 Profile 的 evidence provenance 由外层 `identity.assessmentId` 绑定到 CompletedAssessment。
- Preview 的 evidence provenance 由外层 `source.kind = local_assessment_preview` 与 `source.localDraftId` 绑定到当前 Draft。

Evidence 仍只引用真实 `Draft.answers` 中的稳定 question ID、已选 option 或完整 multi-choice answer set。不得引用 UI label、Institution、Recommendation 或 fake Assessment ID。

Evidence ID 仅在所属 Profile/Preview 对象内部作为稳定引用；当前 ID 不包含 Assessment ID，因此相同 answers 的正式和预览语义可 deep-equal。

## 9. Clarification

Preview 与正式 Profile 使用完全相同的 clarification 规则和稳定 ID，包括：

- `unknown_answer`
- `other_without_detail`
- `non_ordinal_adl_answer`
- `cross_answer_conflict`
- `risk_signal_needs_confirmation`

Preview 不得隐藏 unknown、弱化医学边界或删除 hard-filter 前必须确认的事实。

## 10. Determinism

相同 Draft answers、`localDraftId`、schema 和 ruleset 运行两次必须 deep-equal。

核心和 Preview adapter 禁止：

- `wx.*`
- Store mutation 或 storage write
- 网络、登录、手机号或预约
- Institution/Recommendation 查询
- `Date.now()`、`new Date()`
- `Math.random()`、UUID
- LLM

Draft answers 变化后必须重新派生；旧 Preview 不得被读取或复用。

## 11. Persistence Policy

`ElderProfilePreview` 是 ephemeral derived object：

```text
PROFILE_PREVIEW_PERSISTENCE = FORBIDDEN_V1
```

禁止：

- 写回 AssessmentDraft；
- 新增 Preview Store；
- 新增 profile-preview storage key；
- 缓存长期 Preview；
- 把 Preview 放入历史 Assessment/Profile 列表。

Draft 是唯一当前编辑事实源。未来页面每次需要时从当前完整 Draft 重新 derive。

## 12. Error Contract

Preview 使用 Result union，不使用自由文本或业务 exception：

| error code | 语义 |
|---|---|
| `INVALID_DRAFT_STRUCTURE` | 非 Draft、非法 local identity/persistence/step/timestamp shape、未知 answer key、非法 optional answer 或失活条件答案 |
| `UNSUPPORTED_ASSESSMENT_SCHEMA` | Draft 明确携带非冻结 schema version |
| `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | `validateAssessmentDraftForCompletion` 未通过，包含 required 缺失或非法 |

失败结果包含稳定 `questionIds`。失败时不生成 partial Preview，也不填充默认答案。

Preview 不返回 `NOT_COMPLETED_ASSESSMENT` 或 `INVALID_COMPLETED_AT_TIMESTAMP`，因为它不冒充正式 CompletedAssessment。

## 13. Validation Rules

验证顺序固定为：

1. 输入为对象且 `kind = assessment_draft`；
2. schema 字段存在且类型正确；
3. schema 等于冻结版本 1；
4. Draft 只包含冻结字段，local identity、persistence、step、answers 与时间戳 shape 合法；
5. 调用 `validateAssessmentDraftForCompletion(draft.answers)`；
6. 检查全部已有 question key/answer 和条件题状态；
7. 深复制完整 answers，形成内部 Validated Snapshot；
8. 调用唯一 semantic core。

禁止通过 `currentStep` 推断完成，也禁止调用 `applyAssessmentConditionalRules` 静默修正非法输入后继续派生。

## 14. Region Snapshot

Preview 只复制 Draft 已保存的 `preference.region`：

- `regionCode`
- `regionLabelSnapshot`
- `catalogVersion`
- `kind`

不得读取当前 Institution catalog、重算 label 或替换 catalog version。

## 15. Recommendation Boundary

```text
RECOMMENDATION_CONSUMPTION = NOT_YET_AUTHORIZED
```

本 Contract 不决定未来 Recommendation 是否可以消费 Preview。不得添加 hard filter、ranking、weight、NO_EXACT_MATCH 或 Institution capability 依赖。

## 16. Profile UI Boundary

Phase 3A-3 不实现 `pages/assessment/profile` 业务 UI。未来页面数据链只能是：

```text
AssessmentDraft Store
  → validate/deriveElderProfilePreview
  → ViewModel mapping
  → render
```

Page 只能读取、调用领域函数、转换 ViewModel、展示和处理交互；不得在 Page TS 中重新计算 ADL、认知、特殊护理或 Summary。

## 17. Examples

合法 Preview envelope：

```text
kind: elder_profile_preview
source.kind: local_assessment_preview
source.localDraftId: <existing local Draft ID>
source.assessmentSchemaVersion: 1
profileContractVersion: elder-profile-contract-v1
derivationRulesetVersion: elder-profile-ruleset-v1
basic/health/adl/...: shared semantic payload
```

禁止的 envelope：

```text
kind: elder_profile
identity.assessmentId: <localDraftId>
identity.elderId: anonymous
identity.assessmentCompletedAt: <current time>
```

## 18. Freeze Preconditions

状态只有在以下证据全部通过后才可由 `PROPOSED_PHASE_3A_3` 更新为 `FROZEN_PHASE_3A_3`：

1. PREVIEW-001–015 runtime regression PASS；
2. 五组 Formal/Preview semantic parity PASS；
3. 现有 45 个 formal ElderProfile cases PASS；
4. Assessment runtime 与 interaction regression PASS；
5. TypeScript 5.9 与微信 TypeScript targeted compatibility PASS；
6. WeChat JS compatibility 与 self-test PASS；
7. Institution/Recommendation/Store/persistence dependency 为 0；
8. Assessment 与 Interaction 冻结文档无业务 diff；
9. qa_reviewer 独立只读验收无 blocker。
