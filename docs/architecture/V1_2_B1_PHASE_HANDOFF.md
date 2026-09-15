# Phase V1.2-B1 Handoff — Consultant & Permission Contract Freeze

状态：`FROZEN_PHASE_V1_2_B1`

冻结日期：`2026-09-15`

```text
POST_A1_PHASE_APPROVAL = APPROVED
PRE_B1_HEAD = 9a03e03edf68d0afe7206e7b873586118dcb9c77
CROSS_DOCUMENT_REVIEW_BASELINE = PRE_B1_HEAD + B1_TARGET_DOCUMENTS
PHASE_V1_2_A1_5 = PASS
PHASE_V1_2_B1 = PASS
PHASE_V1_2_B1_KIND = CONTRACT_FREEZE_PHASE
CONSULTANT_PERMISSION_CONTRACT = FROZEN
PRODUCT_DECISIONS_REQUIRED = 0
PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
MOCK_DATA_CHANGE = 0
READY_FOR_B1_IMPLEMENTATION_SUCCESSOR = TRUE
```

## 1. Formal Phase Transition

本文件正式建立以下阶段链路：

```text
Phase V1.2 A1-5 Final Gate
  -> PASS / READY_FOR_NEXT_PHASE
  -> Phase V1.2-B1 Consultant & Permission Contract Freeze
  -> CONSULTANT_PERMISSION_CONTRACT_V1.md
  -> future separately approved implementation phase
```

A1-5 已完成 Institution V1.2.1 implementation baseline 的 runtime、Fresh DevTools、Android 17 人工真机与
独立 QA Final Gate。B1 不重新打开 A1-4/A1-5，也不把这些历史证据冒充为 B1 文档验证。

项目负责人已正式批准 `V1.2-B1` 为 A1-5 的后继阶段。本 handoff 取代依赖
`V1_2_CHANGE_IMPACT_ANALYSIS.md` 推荐顺序猜测下一阶段的做法；该影响分析继续只是 accepted impact/history，
不是新增对象的 frozen Contract。

## 2. Phase Goal

B1 的唯一目标是冻结 V1.2 Consultant Service 与 Permission/Privacy 的稳定架构语义，使后续 Consultant UI、
Institution → Consultant contact projection、Appointment contact flow、Backend、persistence、authentication、
authorization 与 privacy implementation 共享同一 Source of Truth。

B1 是 docs-only Contract Freeze，不实现任何顾问、预约、登录、手机号、媒体、后端或持久化能力。

## 3. In Scope

- `ConsultantProfile` identity、公开身份、服务状态与服务范围；
- Institution → Consultant assignment 与可选 `DEFAULT_CONSULTANT` MVP 策略；
- 平台养老顾问联系方式与机构官方联系方式的硬隔离；
- 企业微信 QR/media 的 owner、审核、公开资格、失效、轮换与 fallback；
- public/application projection 与 internal record 的边界；
- anonymous、authenticated user、consultant、operations 的最小权限矩阵；
- 用户手机号的 purpose limitation、最小化、脱敏、审计与删除原则；
- Consultant 与 Recommendation V2、Institution verified facts 的隔离；
- 后续实现可以依赖的稳定语义及仍需另行冻结的实现边界。

## 4. Out of Scope

- Consultant production UI 或 Institution Detail 新 UI；
- production types、validator、provider、service、Page、WXML、Less 或 interaction；
- Backend API、数据库、ORM、migration、鉴权实现或登录技术方案；
- 手机号授权代码、consent token、加密算法、retention TTL 或删除 job；
- QR 上传、审核后台、媒体存储、CDN、真实电话或真实二维码录入；
- Appointment、InstitutionVisit、VisitEvaluation、AI Assistant 或 CRM；
- Recommendation V2、Institution frozen semantics 或 Product Source 修改；
- production fake data、placeholder QR 或虚构顾问联系方式。

## 5. Frozen Deliverables

1. `CONSULTANT_PERMISSION_CONTRACT_V1.md`：B1 唯一 Consultant/Permission 语义来源；
2. 本 handoff：冻结 A1-5 → B1 转换、B1 范围与完成状态；
3. `CONTRACT_INDEX.md` 的最小路由登记。

## 6. Mandatory Gate Record

| Gate | Result | Evidence boundary |
|---|---|---|
| `PHASE_HANDOFF` | `PASS` | 本文件冻结 ID、名称、目标、范围、完成条件与非授权边界 |
| `CONSULTANT_CONTRACT_COMPLETENESS` | `PASS` | Contract §§4–11 |
| `CONTACT_IDENTITY_SEPARATION` | `PASS` | Contract §7；复用 Institution V1.2.1 已冻结双向隔离 |
| `PERMISSION_PRIVACY_BOUNDARY` | `PASS` | Contract §§12–13 |
| `STATE_MODEL` | `PASS` | Contract §§5、8、9 |
| `PUBLIC_PROJECTION` | `PASS` | Contract §10 |
| `RECOMMENDATION_ISOLATION` | `PASS` | Contract §14 |
| `INSTITUTION_ISOLATION` | `PASS` | Contract §15 |
| `CROSS_DOCUMENT_CONSISTENCY` | `PASS` | 当前 Product Source 与直接相关 frozen Contracts 定向审查 |
| `CONTRACT_QA` | `PASS` | 独立 `qa_reviewer` 对最终 diff 的 Contract-only review |
| `PRODUCTION_ISOLATION` | `PASS` | production/runtime/mock diff 为 0 |

这些 Gate 只证明 Contract Freeze；不构成 runtime、DevTools、Android、Backend、真实媒体或真实数据证据。

## 7. Completion Criteria and Result

B1 的完成条件为：phase handoff、Consultant/Permission Contract、contact identity separation、状态模型、公开投影、
权限/隐私、Recommendation/Institution isolation、cross-document consistency、独立 QA 与 production isolation
全部通过，且没有 contract-critical 产品决策残留。

```text
PHASE_V1_2_B1 = PASS
CONSULTANT_PERMISSION_CONTRACT = FROZEN
PHASE_HANDOFF = PASS
PRODUCT_DECISIONS = CLOSED
QA_GATE = PASS
BLOCKERS = 0
READY_FOR_B1_IMPLEMENTATION_SUCCESSOR = TRUE
```

`READY_FOR_B1_IMPLEMENTATION_SUCCESSOR = TRUE` 仅表示 Contract 已足以供后续阶段依赖。它不命名、不批准、
不启动下一 implementation phase，也不代表 Backend、真实顾问数据或媒体基础设施已经就绪。

## 8. Successor Boundary

未来 implementation phase 必须：

1. 由项目负责人另行批准 phase ID、范围和 Gates；
2. 以 `consultant-permission-contract-v1` 为唯一 Consultant/Permission 语义来源；
3. 先实现 versioned types/validation/provider/application projection，再接 Page；
4. 无 production authoritative source 时只允许显式 unavailable 或合规开发 Mock，不能造电话或二维码；
5. production contact、assignment、media、user phone 与权限必须由安全 Backend/运营来源支撑；
6. 保持 Recommendation V2 与 Institution frozen semantics 的 business diff 为 0；
7. 按实际改动和正式 successor Gate 决定 runtime、DevTools、Android 与 QA 范围。

真实顾问资料、REST endpoint、DB schema、媒体设施、登录实现、运营后台与 retention schedule 都是后续实现依赖，
不是 B1 Contract Freeze blocker。

## 9. Change Policy

本 handoff 与 `CONSULTANT_PERMISSION_CONTRACT_V1.md` 一旦冻结，后续代码不得自行改变其身份、assignment、
contact、media、permission、privacy 或 isolation 语义。重大行为变化必须通过新的 Contract revision/version 与
明确 phase approval；不得以实现细节、Mock、旧 candidate roadmap 或 UI 文案覆盖 frozen semantics。

## 10. Review Record

```text
BACKEND_DOMAIN_REVIEW = PASS
WECHAT_FRONTEND_REVIEW = PASS
MATCHING_ENGINE_REVIEW = PASS
QA_REVIEW = PASS_AFTER_FINDINGS_CLOSED
QA_TARGET_SCOPE = B1_HANDOFF + CONSULTANT_PERMISSION_CONTRACT + CONTRACT_INDEX_ROUTE
```

- `backend_domain`：Consultant ownership、assignment、public projection、媒体与 privacy 的稳定边界完整；API、DB、
  auth、媒体设施与真实数据属于非阻塞 successor dependency；
- `wechat_frontend`：Page → Service/Application Snapshot 分层、公开 contact identity、匿名浏览、User.phone action
  gate 与 fallback 成立；
- `matching_engine`：`CONSULTANT_RECOMMENDATION_MATCHING_ROLE = NONE` 与 frozen Recommendation V2 完全一致；
- `qa_reviewer`：首轮发现 assignment/default、ambiguous state、QR review/fallback 三类空洞；第二轮发现 assignment
  missing/default 的 gate 顺序歧义。全部修正后最终复核 `PASS`。

Cross-document review 以 `PRE_B1_HEAD` 中已提交的 Product/Architecture source 加本次三个 B1 目标文档为基线。
任何并行、未提交且不属于 B1 的 working-tree 文档修改都不构成本 Freeze 的来源，也不得混入 B1 commit。
