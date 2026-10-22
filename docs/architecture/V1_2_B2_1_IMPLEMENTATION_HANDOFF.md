# Phase V1.2-B2.1 Implementation Handoff — Global Consultant Application Snapshot Foundation

状态：`FROZEN_PHASE_V1_2_B2_1_DEFINITION`

冻结日期：`2026-09-16`

```text
NEXT_PHASE_ID = V1.2-B2.1
NEXT_PHASE_NAME = Global Consultant Application Snapshot Foundation
B2_1_PHASE_KIND = DOMAIN_APPLICATION_FOUNDATION_IMPLEMENTATION
OPTION_C_APPROVED = CAPTURED
GLOBAL_CONSULTANT_SNAPSHOT_REQUIRED = TRUE
GLOBAL_CONSULTANT_SNAPSHOT_BOUNDARY = CLOSED_AT_CONTRACT_LEVEL
B2_1_PHASE_DEFINITION = PASS
GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT = FROZEN
B2_1_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_B2_1 = NOT_STARTED
PRE_B2_1_DEFINITION_HEAD = 77e8d0dcd6f7e12eb3cec6b01b6eb0ef398e050b
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_CODE_CHANGE_BY_DEFINITION_TASK = 0
RUNTIME_CODE_CHANGE_BY_DEFINITION_TASK = 0
TEST_CODE_CHANGE_BY_DEFINITION_TASK = 0
MOCK_DATA_CHANGE_BY_DEFINITION_TASK = 0
READY_TO_START_V1_2_B2_1 = TRUE
B3_PHASE_DEFINITION = BLOCKED_PENDING_B2_1_IMPLEMENTATION
```

## 1. Phase Transition and Authority

本文件正式建立：

```text
V1.2-B2 Consultant Domain & Application Foundation
  -> PASS / implementation complete
  -> V1.2-B2.1 Global Consultant Snapshot Contract Freeze
  -> GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1 = FROZEN
  -> future B2.1 Foundation implementation and mandatory automated Gates
  -> only after B2.1 implementation PASS: resume B3 phase definition
```

项目负责人已批准 Option C。`GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md` 是 B2.1 新增语义的唯一 Frozen Source；
`CONSULTANT_PERMISSION_CONTRACT_V1.md` 继续负责 Consultant/phone/QR/permission truth，现有 B2 继续负责 Institution-bound
Foundation。本文只冻结 B2.1 工程切片、ownership、Gates 和 completion evidence，不重新设计三者。

Source of Truth 顺序：

```text
Current Product Source
  -> CONSULTANT_PERMISSION_CONTRACT_V1.md
  -> GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1.md
  -> V1_2_B2_IMPLEMENTATION_HANDOFF.md and passed B2 runtime
  -> FRONTEND_STRUCTURE.md / MOCK_DATA_POLICY.md
  -> this B2.1 implementation boundary
  -> implementation details and fixtures
```

如实现必须修改 B1、Global Contract 或 B2 Institution-bound behavior 才能继续，应报告 `CONTRACT_GAP` 或
`SCOPE_MISMATCH`，不得反向改写 Frozen Source。

## 2. Goal

B2.1 的目标是实现一个无 Institution context 的、确定性、public-safe Consultant Application Foundation：

```text
authoritative platform-level global configuration
  -> versioned validation
  -> deterministic global selection
  -> existing B1/B2 Consultant and channel projection
  -> GlobalConsultantPublicApplicationSnapshotV1
  -> future B3 Page/ViewModel (not B2.1)
```

完成后，未来 Consultant Tab 可以只消费 versioned public-safe Global Application output，不伪造 Institution identity、
不调用 Institution assignment/default resolver，也不直接读取 raw ConsultantProfile。

## 3. Preconditions

B2.1 implementation 开始前必须保持：

- `PHASE_V1_2_A1_5 = PASS`；
- `PHASE_V1_2_B1 = PASS`；
- `CONSULTANT_PERMISSION_CONTRACT_V1 = FROZEN`；
- `PHASE_V1_2_B2 = PASS` 且 Institution-bound Foundation unchanged；
- `GLOBAL_CONSULTANT_SNAPSHOT_CONTRACT_V1 = FROZEN`；
- `FRONTEND_STRUCTURE.md` 与 `MOCK_DATA_POLICY.md` 为 CURRENT normative policy；
- 无需等待 Backend、production provider、真实 global configuration、真实 phone 或 QR，这些不是 Foundation blocker。

## 4. In Scope

B2.1 production implementation 只允许覆盖：

1. versioned global selection/configuration、snapshot 与 Application result types；
2. raw global configuration trust-boundary validation；
3. deterministic explicit global selection resolver；
4. configured profile identity/status validation；
5. public-safe Global Snapshot projection/orchestration；
6. 复用 B2 ConsultantProfile、phone、QR/media 与 resolution helpers/semantics；
7. read-only global configuration Foundation port；
8. 合法 missing/unavailable/unknown state 与 invalid/provider/projection failure 的稳定区分；
9. test-only fixtures、targeted runtime check、WeChat TypeScript/generated-JS compatibility；
10. Global/Institution context、DEFAULT role、mock、privacy、Recommendation 与 Institution isolation assertions；
11. 实现所必需的最小 CURRENT architecture reference update。

B2.1 MAY 对现有 B2 pure helper 做不改变 behavior 的复用性重构，但只有在 Global implementation 确实需要时才允许，且
必须证明 Institution-bound output 深相等。禁止通过修改 `resolveForInstitution` 的 selection rules 实现 Global behavior。

## 5. Out of Scope

B2.1 不实现：

- Consultant Page、ViewModel、Component、WXML、Less、route/navigation 或 user action；
- Institution Detail、Home、Recommendation Result 或其他跨页面 Consultant entry；
- Institution assignment/default resolver 的新语义；
- production global configuration Provider 或真实配置/Consultant/contact/media 数据；
- Backend API、`server/**`、DB、ORM、migration、persistence、cache、auth 或 audit infrastructure；
- QR upload/review/CDN/signing/rotation、phone provisioning 或 Operations UI；
- login、User.phone、Appointment、AI、Visit/Evaluation 或 CRM；
- B1 Contract、Global Contract、B2 handoff/runtime behavior、Product Source、Recommendation V2 或 Institution semantics 修改。

如果实现触及 Page/ViewModel/navigation/user-visible behavior，必须停止并报告 `B2_1_SCOPE_EXPANSION_DETECTED`；不得
静默把 B3 UI 纳入 B2.1。

## 6. Layer and Ownership Boundary

稳定调用方向：

```text
Global Contract-backed types
  -> pure global configuration validator and explicit selector
  -> read-only Foundation port + Application orchestration
  -> shared B1/B2 Consultant phone/QR projection
  -> public-safe Global Consultant Application output
  -> future B3 Page/ViewModel (not B2.1)
```

Repository placement 应遵守当前结构：

- `miniprogram/types/consultant*.ts`：versioned shapes，不执行 I/O；
- `miniprogram/domain/consultant/**`：纯 validation、selection、projection/state derivation；
- `miniprogram/services/consultant*.ts`：read-only port、orchestration、failure mapping、public output；
- `scripts/fixtures/**` 和 targeted check：只保存测试 provenance 和 assertions；
- `miniprogram/mock/**`：只有显式开发 Mock adapter 经当前 policy 允许时才可使用。

Ownership：

- Global selection/profile/contact/media semantics 与 mutation authority：Consultant Service / authorized Operations；
- 小程序 types/domain/application implementation：`wechat_frontend`；
- future `server/**`、production provider/API/DB/auth/media infrastructure：`backend_domain`；
- Page/ViewModel：future B3，不属于本阶段；
- QA：final diff 的独立、只读、risk-based review；
- main session：跨文档集成、scope 和 Gate 验收。

read-only port 是 Foundation 内部 trust boundary，不冻结 HTTP/RPC、Backend DTO、同步/异步形式、endpoint 或 storage schema。

## 7. Required Runtime Behavior

### 7.1 Selection

- 只能读取 `platform_primary_consultant` 的 explicit platform configuration；
- configured 必须只解析 exact configured `consultantId`；
- missing/unavailable/unknown 必须生成对应合法 Global Snapshot；
- invalid/conflicting configuration 必须返回 Application failure；
- 不读取 assignment、Institution default、Institution official contact、route 或 Recommendation；
- 不按列表顺序、region、随机数、当前时间或 consumer 自选推导 Consultant。

### 7.2 Profile and projection

- profile missing/inactive/unknown 必须保留各自 Contract state；
- active valid profile 才执行 B1/B2 public phone/QR projection；
- QR projection 的 Global resolution prerequisite 是 explicit global selection 已合法解析 exact `consultantId` 且 valid profile
  identity 匹配；不得调用或伪造 Institution assignment/default resolver；
- 上述 context-specific prerequisite 之外，B1 的 service/review/lifecycle/media validation 与 public resolver 条件全部不变；
- phone 与 QR availability 独立；
- no eligible media 时返回合法非 available state，不制造 placeholder；
- Global output 不包含 internal media ID、raw configuration、audit/private data 或 User.phone；
- invalid profile/provider/media result/projection invariant 必须 fail closed。

### 7.3 Determinism

Domain/runtime 只能使用显式 input、Provider value 与显式 `snapshotAsOf`。禁止调用 `Date.now()`、随机数、storage、`wx.*`
或 network。相同 validated input 必须产生深相等 output。

## 8. Mock and Fixture Boundary

允许 test-only deterministic fixtures 覆盖：

- configured active Consultant with phone and/or QR available；
- channel-independent phone/QR states；
- configuration missing/unavailable/unknown；
- configured profile missing/inactive/unknown；
- invalid/conflicting configuration；
- Provider/profile/media/projection failure；
- same consultantId used by independently configured Institution default and Global role；
- proof that one role cannot derive the other。

所有 fixture 必须显式 test-only provenance。production import graph 不得引用 fixture；development mock 不得默认启用；fake
phone、QR、configuration 和 Consultant 不能进入 production truth、Recommendation 或 Institution facts。

## 9. Mandatory Implementation Gates

未来 B2.1 implementation 必须全部通过以下 Gates，才能输出 `PHASE_V1_2_B2_1 = PASS`。

### Gate 1 — CONTRACT CONFORMANCE

- 实现遵守 B1、Global Contract 与本 handoff；
- 不新增 selection、contact、permission 或 product behavior；
- B1/B2 Frozen Source 无 semantic diff。

### Gate 2 — GLOBAL CONFIGURATION RUNTIME

- versioned role/config types 与 trust-boundary validation 完整；
- configured/missing/unavailable/unknown deterministic；
- invalid/conflict 不生成合法 Snapshot。

### Gate 3 — GLOBAL SELECTION RESOLUTION

- exact configured consultantId only；
- missing/unknown/unavailable 不 fallback；
- Institution assignment/default resolver 未被调用；
- Provider failure 与合法 data state 分离。

### Gate 4 — APPLICATION PROJECTION

- Global Snapshot kind/version/context identity 正确；
- public allowlist 正确，无 internal data；
- profile/service/overall state 稳定；
- future consumer 不需要 raw config/profile。

### Gate 5 — DEFAULT ROLE AND CONTEXT ISOLATION

- Institution `DEFAULT_CONSULTANT` 与 Global explicit configuration 互不推导；
- 即使 consultantId 相同也保留独立 source role；
- Global/Institution snapshot 不包含或伪造对方 identity；
- 现有 Institution-bound runtime/output 保持不变。

### Gate 6 — CONTACT AND QR CONFORMANCE

- 复用 B1/B2 phone/QR eligibility；
- explicit Global selection resolution 作为 Global QR context prerequisite，并证明 Institution assignment/default resolver 未调用；
- platform phone 不变成 Institution official phone；
- expired/pending/rejected/unavailable media 不冒充 available；
- phone/QR independent availability 有覆盖。

### Gate 7 — PERMISSION AND PRIVACY

- anonymous public read 不要求 login/User.phone；
- output 不含 raw config、internal media/audit/private data 或 Secret；
- no Appointment/persistence side effect。

### Gate 8 — RECOMMENDATION AND INSTITUTION ISOLATION

- Recommendation Safety、Eligibility、Exactness、PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` 与 ordering 不变；
- Institution verified facts/revision/assignment/official contact 不变；
- 验证按实际 shared dependency risk 定向执行，不默认重跑全部历史 suites。

### Gate 9 — MOCK ISOLATION

- production graph 不 import test-only fixture；
- synthetic configuration/phone/QR/Consultant 不进入 production truth；
- production config missing 时安全输出 missing/unavailable，不启用 test fixture。

### Gate 10 — WECHAT RUNTIME COMPATIBILITY

- 运行 B2.1 targeted TypeScript/runtime check；
- 若 production TS 进入小程序 runtime，运行当前适用的 targeted WeChat TypeScript/generated-JS compatibility；
- 不因 Foundation change 默认扩大到所有历史 compatibility suites。

### Gate 11 — TARGETED QA

按最终 diff 只审查：global/default separation、trust boundary、snapshot allowlist、phone/QR conformance、privacy、context/mock/
Recommendation/Institution isolation 与 scope expansion。QA 不扩张成全仓页面审查。

## 10. Evidence Expectations

B2.1 implementation evidence 必须分开报告：

```text
TARGETED_RUNTIME_EVIDENCE
GLOBAL_SELECTION_EVIDENCE
APPLICATION_PROJECTION_EVIDENCE
ISOLATION_EVIDENCE
WECHAT_COMPATIBILITY_EVIDENCE
TARGETED_QA_EVIDENCE
```

本阶段没有 Page/ViewModel/navigation/user interaction，因此：

```text
FRESH_DEVTOOLS_GATE = NOT_MANDATORY
ANDROID_REAL_DEVICE_GATE = NOT_MANDATORY
```

如果 implementation 实际触及用户可见层，则上述豁免失效；必须报告 scope expansion，而不是静默增加 UI 与 evidence。
B3 真正恢复并实现后，Fresh DevTools 与 Android evidence 按 B3 handoff 重新成为 mandatory。

## 11. Completion Criteria

只有同时满足以下条件，未来 implementation 才可输出 `PHASE_V1_2_B2_1 = PASS`：

1. §9 的 11 项 mandatory Gate 全部 PASS；
2. public Global Snapshot 与 Application failure boundary 均已实现；
3. Global selection 不依赖任何 Institution context/default/assignment；
4. B1/B2 phone/QR eligibility 被复用而非复制分叉；
5. existing Institution-bound runtime behavior 保持不变；
6. production 无 fixture/mock contamination；
7. Recommendation 与 Institution isolation 保持；
8. 没有 Page/UI/Backend/真实数据 scope expansion；
9. Frozen Contract/Product Source 未被实现反向修改；
10. blockers = 0，final diff 有独立 targeted QA；
11. Git close-out 只提交 B2.1 明确 change set，不 push。

成功结果：

```text
PHASE_V1_2_B2_1 = PASS
B2_1_IMPLEMENTATION = COMPLETE
READY_TO_RESUME_B3_DEFINITION = TRUE
```

Contract Freeze 本身只允许：

```text
PHASE_V1_2_B2_1 = NOT_STARTED
READY_TO_START_V1_2_B2_1 = TRUE
B3_PHASE_DEFINITION = BLOCKED_PENDING_B2_1_IMPLEMENTATION
```

## 12. Non-blocking Dependencies and Successor Boundary

以下不是 B2.1 Foundation blocker：

- production global configuration source 尚未实现；
- Backend/API/DB/auth/operations UI 尚未实现；
- 真实 Consultant、phone、approved QR 尚未准备；
- media upload/CDN/rotation infrastructure 尚未选择。

Foundation 必须通过 read-only abstraction、test-only fixture 和 safe missing/unavailable state 在无上述依赖时完成。没有真实
production provider 时，不得声称真实 Consultant content 已可用。

B2.1 PASS 后只允许恢复 `V1.2-B3 — Consultant UI Integration` 的 phase definition/freeze；不得在 B2.1 implementation
中直接实现 B3，也不得由本文提前修改或冻结 B3 的最终 scope。

## 13. Change Policy

- 本 handoff 是 phase boundary，不是新的业务语义来源；业务语义以 Frozen Contracts 为准；
- implementation detail MAY 在不改变 outputs/invariants 的前提下优化；
- global selection role、snapshot identity/public fields、default/context separation、permission 或 isolation 变化需要新的 Contract revision；
- Backend protocol、production provider 或 real data onboarding 需要对应后续 phase/Contract；
- 任何 B1/B2 behavior 改变必须单独 impact analysis，不得混入 B2.1。
