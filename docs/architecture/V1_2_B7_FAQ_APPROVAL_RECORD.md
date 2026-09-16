# V1.2-B7 Production FAQ Approval Record

状态：`FROZEN_APPROVAL_EVIDENCE`

批准日期：`2026-09-17`

```text
approvalAuthority = project_owner
approvalEvidenceRef = b7-faq-approval-2026-09-17
approvedFaqCount = 11
directApprovalCount = 9
editedThenApprovedCount = 2
```

本记录是 `V1_2_B7_IMPLEMENTATION_HANDOFF.md` 所要求的 production FAQ owner approval evidence。
它只批准下列固定文本、alias、版本和 public provenance，不修改
`AI_CONSULTATION_CONTRACT_V1.md`、Product Source、B5 Application boundary 或 B6 UI semantics。

## 1. Approval scope and boundaries

- knowledge category 仅允许 `product_faq` 与 `visit_faq`；
- 每条 production entry 的 `approvalStatus = approved`；
- 每条 production entry 的 `approvalAuthority = project_owner`；
- 每条 production entry 的 `approvalEvidenceRef = b7-faq-approval-2026-09-17`；
- safety disposition 必须先于 FAQ lookup；
- exact approved question / alias 之外不得使用 fuzzy、semantic、embedding 或模型生成匹配；
- zero match、multiple match、invalid manifest、invalid provenance 或 unapproved entry 必须 fail closed；
- FAQ 不提供医疗诊断、治疗或用药建议，不承诺实时床位、最终价格、机构确认、预约成功或推荐保证；
- FAQ 不修改 Recommendation、Institution、ElderProfile、Assessment、Appointment、Visit 或 VisitEvaluation truth；
- 本批准不授权 Backend、真实 provider、Secret、RAG、persistence 或新增 FAQ。

## 2. Direct approvals — 9

以下条目按 Owner 审批包原文批准。

### faq.product.ai-scope.v1

```text
category = product_faq
canonicalQuestion = 养老咨询助手可以回答哪些问题？
aliases = 养老咨询助手能帮我做什么？ | AI助手可以回答什么？
answer = 养老咨询助手只用于解释小程序使用方法、已批准的养老基础概念、已有老人画像展示结果、已有推荐理由与差异、合法可展示的机构资料，以及带看流程说明。资料不足、需要机构确认或属于复杂问题时，会提示联系养老顾问。
version = v1.0.0
publicSourceLabel = 产品使用说明 V1.2
```

### faq.product.ai-boundary.v1

```text
category = product_faq
canonicalQuestion = 养老咨询助手不能回答哪些问题？
aliases = 哪些问题需要联系养老顾问？ | 什么情况会转人工？
answer = 医疗诊断、治疗、用药或鼻饲等专业判断，以及实时床位、实时最终价格、合同、付款、投诉、预约确认和复杂特殊护理事项，不能由助手给出确定性结论。涉及这些问题时，应按页面提示联系养老顾问或相应专业人员；转人工不代表顾问已联系、机构已确认或预约已创建。
version = v1.0.0
publicSourceLabel = AI 安全边界说明 V1.2
```

### faq.product.ai-anonymous-privacy.v1

```text
category = product_faq
canonicalQuestion = 打开养老咨询助手需要登录或提供手机号吗？
aliases = 游客可以使用养老咨询助手吗？ | 使用AI助手会获取我的手机号吗？
answer = 匿名用户可以打开养老咨询助手并查看已批准的基础 FAQ。仅打开或使用基础咨询不要求提供手机号；手机号只应在用户明确预约或要求顾问联系时获取。涉及个人画像解释时，也只能使用合法且最小化的展示上下文。
version = v1.0.0
publicSourceLabel = 隐私与授权说明 V1.2
```

### faq.product.assessment-start.v1

```text
category = product_faq
canonicalQuestion = 怎样开始养老需求评估？
aliases = 如何开始需求评估？ | 养老评估从哪里开始？
answer = 可以从首页选择“开始养老需求评估”，先阅读评估说明，再按页面填写。评估预计约 3–5 分钟，会了解健康、生活自理、认知、养老偏好和预算等；不清楚的问题可以选择“暂不确定”。
version = v1.0.0
publicSourceLabel = 评估使用说明 V1.2
```

### faq.product.recommendation-reading.v1

```text
category = product_faq
canonicalQuestion = 推荐结果应该怎么看？
aliases = 怎么看机构推荐结果？ | 推荐理由和差异怎么看？
answer = 推荐结果用于展示最多 3 家可解释候选，并说明推荐理由、差异或待确认事项等。养老咨询助手只能解释页面已有结果，不会重新计算、补足、改写或重新排序，也不能保证某家机构一定最好或一定适合。
version = v1.0.0
publicSourceLabel = 推荐结果说明 V1.2
```

### faq.product.consultant-phone-identity.v1

```text
category = product_faq
canonicalQuestion = 页面里的养老顾问电话是机构官方电话吗？
aliases = 顾问电话和养老院电话一样吗？ | 平台顾问电话是什么性质？
answer = 不是。页面中的号码必须明确标注为“养老顾问电话”或“带看顾问电话”，不得冒充养老机构官方电话。未来如果同时提供机构官方电话，也必须与平台顾问电话分区展示。
version = v1.0.0
publicSourceLabel = 顾问联系说明 V1.2
```

### faq.visit.intent-fields.v1

```text
category = visit_faq
canonicalQuestion = 预约看院意向需要填写哪些信息？
aliases = 看院预约要准备哪些信息？ | 提交看院意向需要什么？
answer = 按产品规则，看院意向信息包括机构、老人、日期、时间、人数、联系人、手机号和备注；接送仅在真实支持时填写。手机号只在明确预约或要求顾问联系时授权。是否已经正式提交及后续状态，应以页面和顾问确认结果为准。
version = v1.0.0
publicSourceLabel = 看院流程说明 V1.2
```

### faq.visit.submission-not-confirmation.v1

```text
category = visit_faq
canonicalQuestion = 预约申请已提交等于机构已经确认吗？
aliases = 提交预约后就算确认了吗？ | 已提交申请是不是预约成功？
answer = 不等于。产品成功页只能表达“预约申请已提交”，不能写成“预约已确认”。实际安排和状态需要由顾问或机构进一步确认；助手不会创建预约，也不会推断机构已经接受。
version = v1.0.0
publicSourceLabel = 预约状态说明 V1.2
```

### faq.visit.evaluation-purpose.v1

```text
category = visit_faq
canonicalQuestion = 看院评价有什么用途？
aliases = 看院评价会影响推荐排序吗？ | 看院后的评价会改机构资料吗？
answer = 看院评价用于帮助家庭记录自己的判断，并为顾问或运营提供复盘和资料复核线索。它属于用户主观反馈，不直接修改机构核验事实，不进入 Recommendation V2 排序，也不形成公开机构评分。
version = v1.0.0
publicSourceLabel = 看院评价说明 V1.2
```

## 3. Edited then approved — 2

以下条目只批准本节中的最终修订文本；旧草案不得进入 production manifest。

### faq.product.fee-components.v1

```text
category = product_faq
canonicalQuestion = 养老机构费用说明通常要看哪些项目？
aliases = 费用由什么组成？ | 看机构费用要确认哪些项目？
answer = 产品资料要求费用说明至少关注床位费、餐费、护理费、管理费、特殊护理费、其他月费、押金和一次性费用是否讲清。具体项目、适用条件和金额需要由机构或养老顾问进一步确认；这里的说明不是实时最终报价。“特殊护理费”仅表示收费项目，不构成护理能力或医疗判断。
version = v1.0.0
publicSourceLabel = 费用说明提示 V1.2
```

### faq.visit.status-model.v1

```text
category = visit_faq
canonicalQuestion = 带看有哪些状态？
aliases = 看院申请有哪些状态？ | 什么是已完成带看状态？
answer = 产品定义的带看状态包括 requested（已提交意向）、contacting（顾问联系中）、scheduled（已确认计划）、completed（已完成带看）和 cancelled（已取消）。这些状态属于 Backend / 顾问运营事实，前端和助手不能根据时间自行推断；实际状态以正式记录为准。
version = v1.0.0
publicSourceLabel = 带看状态说明 V1.2
```

## 4. Approved IDs

```text
faq.product.ai-scope.v1
faq.product.ai-boundary.v1
faq.product.ai-anonymous-privacy.v1
faq.product.assessment-start.v1
faq.product.recommendation-reading.v1
faq.product.fee-components.v1
faq.product.consultant-phone-identity.v1
faq.visit.intent-fields.v1
faq.visit.submission-not-confirmation.v1
faq.visit.status-model.v1
faq.visit.evaluation-purpose.v1
```

任何新增条目、alias 或文本修改都不属于本 approval evidence，必须重新取得明确 Owner approval，并按 B7
version/provenance 规则重新验证 deterministic lookup、alias collision、safety precedence 和 public projection。
