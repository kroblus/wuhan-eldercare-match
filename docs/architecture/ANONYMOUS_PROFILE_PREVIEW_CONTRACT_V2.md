# Anonymous ElderProfile Preview Contract V2

状态：`FROZEN_PHASE_V1_1_C`

Assessment schema：`2`

Profile contract：`elder-profile-contract-v2`

Derivation ruleset：`elder-profile-ruleset-v2`

ADL ruleset：`adl-ruleset-v1`

提案日期：`2026-09-07`

本文件定义完整合法 `AssessmentDraftV2 -> ElderProfilePreviewV2`。它与 frozen V1 Preview
并存，不修改 V1 Preview，不接 Profile UI，不授权 persistence、Institution、Recommendation 或
Backend。

```text
ANONYMOUS_PROFILE_PREVIEW_V2_CONTRACT = FROZEN_PHASE_V1_1_C
```

## 1. Data Flow

```text
AssessmentDraftV2
  -> validateAssessmentDraftV2
  -> frozen V2 completion validation
  -> deep-cloned ValidatedLocalAssessmentSnapshotV2
  -> deriveProfileSemanticsV2
  -> ElderProfilePreviewV2
```

正式链路：

```text
CompletedAssessmentV2
  -> formal identity/timestamp/answer validation
  -> same deriveProfileSemanticsV2
  -> ElderProfileV2
```

Formal 与 Preview 除 envelope identity/source 外，所有 semantic sections 必须 deep-equal。

## 2. Preview Source Identity

```ts
interface ElderProfilePreviewSourceV2 {
  kind: 'local_assessment_preview'
  localDraftId: string
  assessmentSchemaVersion: 2
}

interface ElderProfilePreviewV2 extends ElderProfileSemanticPayloadV2 {
  kind: 'elder_profile_preview'
  source: ElderProfilePreviewSourceV2
  profileContractVersion: 'elder-profile-contract-v2'
  derivationRulesetVersion: 'elder-profile-ruleset-v2'
}
```

Preview 中禁止：

```text
assessmentId
elderId
completedAt
assessmentCompletedAt
generatedAt
previewId
recommendationId
server identity/status
```

`localDraftId` 只能位于 `source.localDraftId`，不得复用为 formal ID。Preview adapter 不构造或
伪装 `CompletedAssessmentV2`。

## 3. Input and Version Gate

验证顺序固定：

1. object、`kind=assessment_draft`、schema 字段 shape；
2. schema 必须为 2，否则 `UNSUPPORTED_ASSESSMENT_SCHEMA`；
3. V2 Draft envelope、local identity、persistence、step、timestamps、migration notice 与 answer
   shape 合法；
4. frozen 26-required completion validation PASS；
5. 深复制 32-question snapshot；
6. 调用唯一 V2 semantic core。

禁止通过 `currentStep` 推断完成，禁止补默认答案，禁止在 Preview derivation 中静默运行 cleanup
修复非法 Draft。

稳定错误：

| code | meaning |
|---|---|
| `INVALID_DRAFT_STRUCTURE` | envelope、timestamp、answer key/value 或条件状态非法 |
| `UNSUPPORTED_ASSESSMENT_SCHEMA` | schema 不是 2 |
| `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | required completion 未通过 |

失败只返回 stable code 与 question IDs，不产生 partial Preview。

## 4. V1/V2 Isolation

```text
AssessmentDraftV1 -> deriveElderProfilePreview (V1 only)
AssessmentDraftV2 -> deriveElderProfilePreviewV2 (V2 only)
```

- V1 Draft 不进入 V2 adapter；
- V2 Draft 不进入 V1 adapter；
- V1 preview 20-case runtime 和五组 V1 parity 必须原样通过；
- migration notice 不进入画像语义；含 notice 且 priorities 未重答的 Draft 不能通过 completion。

## 5. Semantic Parity

对同一组独立 deep-cloned Schema 2 answers：

```text
semantic(ElderProfileV2) deepEqual semantic(ElderProfilePreviewV2)
```

比较必须覆盖：

```text
basic / health / nutrition / adl / mobility / cognition / specialCare
preference / financial / intent / userFacingSummary / evidence / clarifications
```

至少五组 parity fixture：normal、nutrition concern、unknown、high-care/low-budget advisory、
explicit special care。两侧 adapter 均不得修改输入。

## 6. Evidence and Clarification Provenance

Preview evidence 由外层真实 `source.localDraftId` 绑定当前本地 Draft，不伪造 Assessment ID。
Evidence 只引用 Draft snapshot 中真实 Schema 2 question/option。Nutrition、V2 preference、budget
advisory 与既有 ADL/cognition/special-care 的 evidence/clarification 必须与 Formal V2 完全相同。

## 7. Persistence and Recalculation

```text
ELDER_PROFILE_PREVIEW_V2_PERSISTENCE = FORBIDDEN
```

禁止 Preview Store、storage key、local cache、写回 Draft 或历史列表。每次 consumer 需要时从当前
Draft snapshot 重新派生；Draft 改变必须得到重新计算后的结果，旧 Preview 不得复活。

## 8. Pure Domain and UI Boundary

Adapter/core 禁止 `wx.*`、storage、网络、时间、随机数、login、phone authorization、Institution、
Recommendation 与大对象日志。本阶段不修改 `pages/assessment/profile`、ViewModel、WXML/Less 或
Recommendation Result UI。

## 9. Freeze Preconditions

只有在以下证据全部通过后才更新为 `FROZEN_PHASE_V1_1_C`：

1. V2 Profile runtime `PROFILE-V2-001..018`；
2. 五组 Formal/Preview V2 semantic parity；
3. V1 Formal 45 + Preview 20 及其 parity regression；
4. V1/V2 schema isolation、no fake identity、no persistence；
5. Assessment V1/V2、migration、interaction 与 downstream V1 regression；
6. TypeScript 5.9、WeChat TypeScript 4.1.2 targeted compatibility；
7. matching_engine、wechat_frontend 与 qa_reviewer 独立只读审查无 blocker。
