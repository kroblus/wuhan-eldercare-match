# Phase V1.2-B7 Implementation Handoff — Approved AI FAQ & Knowledge Capability

状态：`FROZEN_PHASE_V1_2_B7_DEFINITION`

冻结日期：`2026-09-17`

```text
POST_B6_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-B7
NEXT_PHASE_NAME = Approved AI FAQ & Knowledge Capability
NEXT_PHASE_TYPE = APPLICATION_KNOWLEDGE_INTEGRATION
B7_PHASE_DEFINITION = PASS
B7_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B7 = NOT_STARTED
PRE_B7_DEFINITION_HEAD = a5218e769b9567d65568a300b2f4d579d80ce870
PHASE_V1_2_B6 = PASS
B6_IMPLEMENTATION = COMPLETE
AI_CONSULTATION_CONTRACT = FROZEN
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
READY_TO_START_V1_2_B7 = TRUE
```

本 handoff 冻结 B6 之后唯一获准立即实施的 successor：为已完成的 AI Consultation Foundation 与 UI
接入真实、版本化、明确批准且可追溯的静态 FAQ / knowledge limited mode。它不授权真实模型、Backend
gateway、Secret、RAG、持久化、个人画像上下文接入，也不授权 Appointment / InstitutionVisit / VisitEvaluation
实现。

## 1. Authority and Source Order

B7 依次遵守：

1. `docs/product/README.md` 与当前两份 V1.2 Product PDF；
2. `AI_CONSULTATION_CONTRACT_V1.md`；
3. `V1_2_B5_IMPLEMENTATION_HANDOFF.md` 与已完成 B5 AI Domain/Application Foundation；
4. `V1_2_B6_IMPLEMENTATION_HANDOFF.md` 与已完成 B6 AI UI；
5. `FRONTEND_STRUCTURE.md`、`MOCK_DATA_POLICY.md` 与 `WECHAT_INTERACTION_CONTRACT.md`；
6. 本 handoff 的 knowledge capability implementation boundary。

本 handoff 不新增 knowledge category、AI state、safety disposition、handoff reason、权限或 public result shape。
任何此类变化都需要 AI Consultation Contract successor，不得由 FAQ content、adapter 或 Page 自行引入。

## 2. Successor Discovery

### 2.1 Remaining V1.2 P0

- V1.1 Assessment / Profile / Recommendation 主链：已完成；
- V1.2-A Institution CareProcess：已完成；
- Consultant / Enterprise WeChat / phone：Contract、Foundation 与独立 UI 已完成，真实运营数据仍是外部依赖；
- AI Consultation：Contract、Foundation 与 UI 已完成，production 仍只能诚实返回 `unavailable`；
- Appointment / InstitutionVisit / VisitEvaluation：尚无完整 Contract、Domain、Backend 或 persistence，当前 Appointment 只是 honest scaffold；
- `/pages/visit/evaluation`：尚未建立 route 与 implementation。

### 2.2 Candidate review

#### Approved production FAQ / knowledge capability — READY

- B4 已允许 `approved_faq` production limited mode；
- B5 已提供 `AIConsultationProviderPortV1`、safety evaluator、provider firewall 与 public-safe result；
- B6 Page 已只消费 `AIConsultationPublicApplicationResultV1`；
- 它不需要 Backend、Secret、login、User.phone、DB 或新 public Contract；
- 只有显式批准、版本化且可追溯的 content 才能使用 `approved_faq` provenance。

#### Self-owned Backend Gateway Foundation — DEFERRED / REQUIRES BOUNDARY FREEZE

真实 Backend 必须另行冻结 endpoint、transport、DTO、auth/anonymous boundary、rate limit、retention、
observability、error mapping 与 deployment ownership。B4/B5 只冻结了 ownership 与 port，未冻结 wire protocol。

#### Real provider / Secret integration — DEFERRED / REQUIRES BACKEND

真实 provider 与 Secret 硬依赖 self-owned Backend gateway；Mini Program 直连、前端 SDK 或 bundle Secret 仍为禁止项。

#### Appointment / InstitutionVisit / VisitEvaluation — DEFERRED / REQUIRES NEW CONTRACT

V1.2-C 仍是 P0 闭环，但它需要 canonical Institution revision、appointment/visit identity、purpose-bound
User.phone、auth、Backend/persistence、运营状态与 idempotency 边界。VisitEvaluation 又依赖真实 `completed`
InstitutionVisit。它们不得从当前 scaffold 直接升级为伪生产提交。

### 2.3 Dependency order

```text
B6 AI UI
  -> B7 approved FAQ / knowledge limited mode
  -> future discovery: Backend gateway boundary OR V1.2-C Contract

self-owned Backend gateway boundary
  -> Backend foundation
  -> real provider / Secret integration

Appointment + InstitutionVisit Contract/Foundation
  -> real operational completed Visit
  -> VisitEvaluation Foundation/UI
```

B7 是当前前置依赖最少、不新增业务语义、且能直接将已完成 B6 从诚实 unavailable 推进为
真实有限能力的 immediate successor。

## 3. Phase Goal

B7 要建立一条端到端但范围严格有限的 production 路径：

```text
owner-approved versioned FAQ content
  -> deterministic allowlisted FAQ adapter
  -> AIConsultationProviderPortV1 (responseProvenance = approved_faq)
  -> B5 safety / validation / provider firewall / public projection
  -> AIConsultationPublicApplicationResultV1
  -> existing B6 Page
```

目标不是伪装成在线模型，而是让用户在 allowlist 内获得真实、可追溯、版本化的基础解释；未命中、
越界或资料不足时继续 fail closed。

## 4. Preconditions

- `PHASE_V1_2_B4 = PASS`，AI Consultation Contract frozen；
- `PHASE_V1_2_B5 = PASS`，AI Domain/Application Foundation complete；
- `PHASE_V1_2_B6 = PASS`，AI Page/UI integration complete；
- B6 Page 仍只消费 public-safe Application result；
- 无 fake FAQ、fake sourceRef、frontend Secret 或 test fixture production import；
- Recommendation、Institution、ElderProfile、Appointment/Visit frozen boundaries unchanged。

## 5. In Scope

1. 建立 production FAQ manifest/content 的明确版本和 approval provenance；
2. FAQ 内容只允许来自当前 Product Source 或已冻结、允许公开的流程说明；
3. 实现 provider-neutral、read-only `approved_faq` adapter；
4. 实现确定性的已批准 question/alias 查找；
5. 未命中、manifest 缺失、版本无效或 provenance 非法时返回既有 `knowledge_unavailable`；
6. 仅使用已冻结 `product_faq` / `visit_faq` source category；
7. 为 public-safe `sourceRefs` 投影合法 label/version，不暴露 internal locator 或 approval metadata；
8. 通过 B5 Application service 完成 safety-first orchestration，不在 FAQ adapter 复制 safety rules；
9. 将 B6 Page facade 从 capability-absent 路径最小接入已批准 adapter，保留 safe unavailable fallback；
10. 建立 TEST_ONLY deterministic fixtures 与 targeted runtime/compatibility/UI evidence。

内部 manifest / adapter shape 是 B7 implementation detail，不升格为新 public Contract。若实现需要新 knowledge
category、state、message kind、permission 或 public result field，必须停止并报告 `CONTRACT_GAP`。

## 6. Out of Scope

- self-owned Backend gateway、endpoint、DTO、auth、DB、persistence、rate limit 或 observability；
- 任何真实模型 provider、provider SDK、HTTP/RPC 调用、API Key、Secret 或 Token；
- Prompt engineering、RAG、vector DB、embedding、semantic/fuzzy retrieval 或自由生成；
- 个人 ElderProfile / Recommendation / Institution context adapter；
- conversation persistence、history、login、User.phone 或账号绑定；
- AI Page 重设计、新 route 或 context-aware cross-entry；
- Appointment、InstitutionVisit、VisitEvaluation、CRM 或 V1.2-C implementation；
- Recommendation V2、Institution verified fact 或 ElderProfile 修改。

## 7. Ownership

### Product / content owner

- 批准每个 production FAQ answer、alias 与 source provenance；
- 确认内容没有新的医疗结论、实时承诺、机构事实或产品语义；
- 未获明确批准的 content 不得进入 production manifest。

### AI Domain / Application

- 继续拥有 safety disposition、context minimization、provider firewall、sourceRefs projection 与 public result；
- safety/refusal/handoff 必须在 FAQ answer 被接受前执行；
- 越界 query 不得因 FAQ alias 命中而绕过 safety。

### Approved FAQ adapter

- 是 `AIConsultationProviderPortV1` 的本地、read-only、provider-neutral implementation；
- 只返回已批准 manifest 中的 answer/sourceRef；
- 不拥有 safety、Recommendation、Institution、Profile 或 Visit truth。

### Page / ViewModel

- 仍只消费 `AIConsultationPublicApplicationResultV1`；
- 不读取 FAQ manifest，不执行 alias matching，不重写 answer/sourceRef；
- 不把 `approved_faq` 描述成在线模型或实时机构查询。

### Backend

B7 Backend ownership = `NONE`。Backend gateway、provider/Secret 与 server-side knowledge 为 future successor。

## 8. Content and Provenance Boundary

- production FAQ manifest 必须有稳定 version 和可审计 approval evidence；
- 每个 entry 必须有 stable internal identity，但 raw locator/approval actor 不投影到 Page；
- public answer 与 alias 必须逐项批准，不得在 runtime 自动补全或生成；
- FAQ 不得声称实时床位、最终价格、机构确认、预约成功、医疗结论或一定适合；
- 如 Product Source 或 Frozen Contract 无法直接支持答案，该 entry 不得获批；
- content 修订必须显式提升 version，不得静默改写已验证的 provenance。

## 9. Deterministic Lookup Boundary

- lookup 只使用 manifest 显式列出的 normalized question / alias；
- normalization 只可做去除首尾空白、已批准的大小写/全半角/标点归一化等非语义性处理；
- 禁止基于关键词猜测意图、fuzzy ranking、embedding 或模型生成；
- zero match 返回 `knowledge_unavailable`；
- multiple match、duplicate alias、invalid sourceRef 或 invalid manifest 必须 fail closed；
- 相同 manifest version 和相同 normalized input 必须生成相同业务结果。

## 10. Safety, Handoff and Public Projection

- B5 safety evaluator 的 `answer / safe_refusal / human_handoff` 优先级高于 FAQ lookup；
- 医疗、实时床位/价格、合同/投诉、正式预约、用户要求人工等语义继续按 B4/B5 处理；
- FAQ adapter 不得伪造 Consultant reply、联系已建立或 Appointment 已创建；
- `sourceRefs` 只投影冻结的 public-safe category/label/version；
- `responseProvenance = approved_faq` 只能由合法 production manifest adapter 产生；
- manifest/adapter 不可用时必须保留 B6 honest unavailable path。

## 11. Permission, Privacy and Cross-domain Isolation

- generic approved FAQ 对匿名用户开放，不要求登录、User.phone 或 persistent identity；
- B7 provider-facing context 不得包含 raw assessment、health detail、private Profile、Institution evidence、Consultant private
  metadata、Secret 或 credential；
- Profile / Recommendation / Institution display snapshot integration 不属于 B7；
- Recommendation recompute/rerank/write/matching calls = 0；
- Institution / ElderProfile / Assessment writes = 0；
- Appointment / Visit / VisitEvaluation writes = 0；
- FAQ answer 不得成为 Institution verified fact 或 VisitEvaluation observation。

## 12. Mock and Fixture Boundary

- TEST_ONLY synthetic FAQ / answer / sourceRef 可用于 automated coverage；
- test fixture 不得 import 进 production graph；
- development Mock 不得带 `approved_faq` production provenance；
- production manifest 不得放在 `scripts/fixtures/**`；
- 不得为 DevTools 或 Android 演示注入未批准 answer；
- automated positive cases 必须区分 TEST_ONLY 与真实 production-approved content。

## 13. Mandatory Implementation Gates

### GATE 1 — CONTRACT CONFORMANCE

B4/B5/B6 public states、knowledge categories、safety、handoff、privacy 与 public result 零语义漂移。

### GATE 2 — CONTENT APPROVAL AND PROVENANCE

所有 production FAQ answer/alias/source 均有明确 owner approval，零未批准或无来源内容。

### GATE 3 — VERSIONED MANIFEST

manifest identity/version/duplicate/invalid entry 检查确定性且 fail closed；内部 metadata 不泄漏到 public result。

### GATE 4 — DETERMINISTIC ALLOWLISTED LOOKUP

显式 approved question/alias 可命中；unknown、zero-match、multiple-match 或 invalid manifest 不产生 answer。

### GATE 5 — SAFETY PRECEDENCE

medical/realtime/contract/complaint/appointment/human-request 等冻结 safety disposition 不得被 FAQ alias 绕过。

### GATE 6 — SOURCE REFS AND PUBLIC PROJECTION

只生成 public-safe `product_faq` / `visit_faq` sourceRefs；raw locator、approval metadata 与 internal version data 不泄漏。

### GATE 7 — HONEST UNAVAILABLE / FAIL CLOSED

manifest 缺失、未批准、无命中、重复或无效时返回既有 safe state，不静默回退 Mock、自由生成或任意 answer。

### GATE 8 — APPLICATION / PAGE BOUNDARY

adapter 通过 `AIConsultationProviderPortV1` 进入 B5 Application；Page/ViewModel 只消费
`AIConsultationPublicApplicationResultV1`，不读 manifest/raw candidate。

### GATE 9 — ANONYMOUS / PRIVACY

generic FAQ 不强制登录、不请求 User.phone、不建立 persistent identity，provider-facing context 通过白名单构造。

### GATE 10 — BACKEND / PROVIDER / SECRET ISOLATION

real provider、SDK、network call、endpoint、API Key、Secret、Token 与 Backend implementation 数量均为 0。

### GATE 11 — MOCK ISOLATION

production fixture/mock imports = 0；synthetic answer/sourceRef 不冒充 production approval。

### GATE 12 — CROSS-DOMAIN ISOLATION

Recommendation/Institution/ElderProfile/Assessment/Appointment/Visit/Evaluation writes = 0；Recommendation ranking 语义不变。

### GATE 13 — TARGETED RUNTIME

确定性 fixtures 至少覆盖：approved hit、alias hit、zero-match、duplicate/multiple-match、invalid manifest/version/
sourceRef、safety precedence、unavailable fallback、public projection、fixture isolation 与 negative cases。

### GATE 14 — WECHAT COMPATIBILITY

针对实际 changed miniprogram runtime dependency 执行 targeted TypeScript 与 DevTools-generated JS compatibility；禁止 Node-only API
与不兼容 class-field syntax。

### GATE 15 — FRESH DEVTOOLS

B7 改变 production 可见 AI 能力，因此 Fresh DevTools mandatory。至少验证 approved FAQ 命中、source label、
unknown/unavailable、safe refusal/handoff、retry 与 console/runtime exception = 0。

### GATE 16 — ANDROID 17 MANUAL REAL DEVICE

Android 17 真机 mandatory。必须使用与 automated/DevTools 相同 implementation source，验证 production-approved FAQ
、unavailable、输入/键盘/滚动、rapid tap、Consultant handoff 与返回栈。不得用 simulator 代替。

### GATE 17 — TARGETED QA

final diff 进行 independent、Contract-driven QA，重点检查 content approval、safety bypass、fake provenance、hidden
generation/provider、fixture contamination、privacy、public projection 与 scope expansion。

## 14. Evidence Strategy

必须分开报告：

```text
CONTENT_APPROVAL_EVIDENCE = MANDATORY
TARGETED_RUNTIME = MANDATORY
WECHAT_COMPATIBILITY = MANDATORY
FRESH_DEVTOOLS = MANDATORY
ANDROID_17_MANUAL_REAL_DEVICE = MANDATORY
TARGETED_QA = MANDATORY
FULL_REPOSITORY_TESTS = NOT_MANDATORY
```

自动化 fixture 不能代替 production content approval；DevTools 不能代替 Android 真机。

## 15. Completion and Verdict Rules

只有 17 项 mandatory Gates 全部 PASS 才允许：

```text
PHASE_V1_2_B7 = PASS
B7_IMPLEMENTATION = COMPLETE
APPROVED_FAQ_CAPABILITY = AVAILABLE
BLOCKERS = 0
READY_FOR_B7_SUCCESSOR = TRUE
```

若 automated、compatibility、Fresh DevTools、content approval 与 QA 均 PASS，但 Android 17 人工证据尚未返回：

```text
PHASE_V1_2_B7 = PASS_WITH_RISKS
B7_IMPLEMENTATION = COMPLETE_PENDING_MANUAL_GATE
ANDROID_17_MANUAL_REAL_DEVICE = PENDING_OWNER_VERIFICATION
READY_FOR_B7_SUCCESSOR = FALSE
```

以下必须 `BLOCKED`：

- production content 未获批准或无可追溯来源；
- FAQ alias 可绕过 safety disposition；
- 新增未冻结 knowledge category/state/result/permission；
- fake FAQ、Mock、test fixture 或 synthetic sourceRef 进入 production truth；
- Page 读取 manifest/raw candidate 或自行选 answer；
- 引入 frontend provider/SDK/Secret/network call；
- Recommendation/Institution/Profile/Visit isolation 破坏；
- mandatory runtime/compatibility/DevTools/Android/QA FAIL；
- 必须修改 Frozen Contract 才能完成。

报告 `BLOCKER / ROOT_CAUSE / MINIMAL_FIX_SCOPE / REVALIDATION_REQUIRED`。

## 16. Successor Boundary

B7 PASS 后才重新评估：

- self-owned Backend gateway boundary/foundation；
- real provider / Secret integration；
- 个人 Profile/Recommendation/Institution display context adapters；
- V1.2-C Appointment / InstitutionVisit / VisitEvaluation Contract Freeze。

本 handoff 不命名、编号、批准或实现 B7 successor。

## 17. Change Policy

- approved content 变化必须显式 version/approval，不得静默替换；
- adapter/retrieval 可做 additive internal refactor，但不得改变 public Contract 或 safety semantics；
- Backend/provider/Secret、新 knowledge category、personal context、persistence 或新 Page behavior 需要另行 phase/Contract approval；
- B7 scope expansion 不得由 implementation 自行决定。

## 18. Definition Task Result

```text
POST_B6_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-B7
NEXT_PHASE_NAME = Approved AI FAQ & Knowledge Capability
NEXT_PHASE_TYPE = APPLICATION_KNOWLEDGE_INTEGRATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B7 = NOT_STARTED
READY_TO_START_NEXT_PHASE = TRUE
PRODUCT_DECISIONS = CLOSED
BLOCKERS = 0
```
