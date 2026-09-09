# V1.2 产品变更影响分析

状态：`ACCEPTED`

```text
PRODUCT_V1_2_CHANGE_IMPACT_ANALYSIS = ACCEPTED
PRODUCT_SOURCE_VERSION = V1.2
PRODUCT_V1_2_SOURCE_COMMIT = 34e5b2f4daf55ba71f0b8bf8eba5d0d72628d70c
V1_1_CODE_BASELINE = 43f9e16918d61993d8c3239845ec5df089243532
PRODUCTION_CODE_CHANGE = 0
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
```

本文件只评估 V1.2-A、V1.2-B、V1.2-C 对现有架构、领域、页面、后端、权限与发布顺序的影响。它不是任何新增对象的冻结 Contract，也不授权实现、迁移、上线、持久化或真实数据录入。

## 1. Source of Truth

### 1.1 当前产品依据

当前产品最高依据为：

1. `docs/product/武汉养老机构精准匹配小程序_V1.2_页面级PRD_更新版.pdf`
2. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.2_更新版.pdf`
3. `docs/product/README.md`

`docs/product/archive/**` 仅是历史参考；旧 V1/V1.1 PDF 不得覆盖 V1.2 产品要求。新 PDF 也不得直接覆盖已经冻结的 Architecture Contract，必须先经过本影响分析和后续独立 Contract Freeze。

### 1.2 已读取的冻结架构依据

| Contract / Policy | 当前状态 | 本分析中的用途 |
|---|---|---|
| `ASSESSMENT_CONTRACT_V2.md` | `FROZEN_PHASE_V1_1_A` | Assessment V2 的 32 题、答案语义与完成条件 |
| `ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md` | `FROZEN_PHASE_V1_1_A` | V1 历史数据和 V1→V2 迁移边界 |
| `ADL_RULE_CONTRACT.md` | `FROZEN_V1` | ADL 原始答案与 care level 推导边界 |
| `ELDER_PROFILE_CONTRACT_V2.md` | `FROZEN_PHASE_V1_1_C` | ElderProfile V2 事实与推导规则 |
| `ANONYMOUS_PROFILE_PREVIEW_CONTRACT_V2.md` | `FROZEN_PHASE_V1_1_C` | 匿名 Preview、无假身份与无持久化边界 |
| `INSTITUTION_CONTRACT_V1_1.md` | `FROZEN_PHASE_V1_1_D` | `InstitutionRecordV11`、字段可用性、核验与 revision |
| `INSTITUTION_CAPABILITY_CONTRACT.md` | `FROZEN_PHASE_4A_2` | 护理能力和硬性安全判断的唯一能力语义 |
| `RECOMMENDATION_CONTRACT_V2.md` | `FROZEN_PHASE_V1_1_E` | Recommendation V2 输入、输出、身份和 manifest |
| `RECOMMENDATION_RULE_CONTRACT_V2.md` | `FROZEN_PHASE_V1_1_E` | Safety、Tier、Exactness、PriorityFitVector、Rank Tuple |
| `PROFILE_UI_V2_INTEGRATION_CONTRACT.md` | `FROZEN_PHASE_V1_1_F1` | Profile V2 Page/Application/Domain 分层 |
| `RECOMMENDATION_RESULT_UI_V2_INTEGRATION_CONTRACT.md` | `FROZEN_PHASE_V1_1_F1` | Result V2 display snapshot、CTA 与下游 identity gate |
| `RECOMMENDATION_PREVIEW_INTEGRATION_CONTRACT.md` | `FROZEN_PHASE_4C_1` | Page→Service→Provider 和完整机构池边界 |
| `WECHAT_INTERACTION_CONTRACT.md` | `FROZEN_V1` | 单一 Action、导航 guard、失败反馈和真机 Gate |
| `MOCK_DATA_POLICY.md` | 当前正式 Policy | Mock 的文件、记录、UI 三层披露与真实性约束 |
| `LEGACY_INSTITUTION_DTO_MIGRATION_PLAN.md` | 正式迁移计划 | legacy Institution DTO 到 canonical Institution 的边界 |
| `ROUTES.md` / `FRONTEND_STRUCTURE.md` / `AGENTS.md` | 当前工程规则 | 路由、Page→Service→Provider、Agent ownership 与 MVP 范围 |

### 1.3 当前仓库证据

- HEAD 为产品源基线 `34e5b2f4daf55ba71f0b8bf8eba5d0d72628d70c`；分析开始时工作树干净。
- `miniprogram/app.json` 当前注册 21 个物理路由，其中包含 P0 “老人档案”的配套详情路由 `pages/elder/detail`。
- `/pages/service/ai-chat` 与 `/pages/visit/evaluation` 尚不存在。
- `server/` 只有占位 `README.md`；没有 Spring Boot、数据库 migration、API、鉴权或持久化实现。
- Home/Preference 仍可使用 legacy `types/domain.ts::Institution` 与 legacy Mock service；Recommendation V2 已使用 canonical `InstitutionRecordV11` catalog。Institution List/Detail 仍是骨架，尚未建立 same-source identity。
- Result V2 仍冻结：`CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED`、`INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED`。

## 2. Frozen Contract Impact Matrix

分类定义：

- `UNCHANGED`：现有 Contract 的业务语义和版本均不变。
- `COMPATIBLE_EXTENSION`：在既有边界之外增加页面入口或展示能力；不得回写旧 Contract。
- `VERSION_BUMP_REQUIRED`：旧 Contract 已冻结，新增字段需要新的版本化记录/校验器/投影。
- `BREAKING_CHANGE`：若采用会破坏既有身份、语义或历史解释；本分析不批准任何此类方案。
- `NEW_CONTRACT_REQUIRED`：现有 Contract 没有该领域或应用边界。

| 对象 | 分类 | 影响原因 | 版本变化 | Runtime migration | 历史数据影响 | Recommendation V2 |
|---|---|---|---|---|---|---|
| Assessment V2 | `UNCHANGED` | V1.2 不增加评估题、不改变 32 题/26 required | 否 | 否 | 无；V1/V2 历史语义不变 | 无 |
| Assessment V1→V2 Migration | `UNCHANGED` | 新功能位于评估之后 | 否 | 否 | 无 | 无 |
| Assessment Interaction | `UNCHANGED` | 新页面必须遵守现有单 Action/导航规则，但不改该 Contract | 否 | 否 | 无 | 无 |
| ADL ruleset | `UNCHANGED` | CareProcess 与用户带看观察都不是 ADL 输入 | 否 | 否 | 无 | 无 |
| ElderProfile V2 | `UNCHANGED` | V1.2 只能解释 display snapshot，不能改变画像推导 | 否 | 否 | 无 | 无 |
| Anonymous Profile Preview V2 | `UNCHANGED` | AI 只可读取最小 display snapshot，不创建正式身份 | 否 | 否 | 无 | 无 |
| Institution Contract V1.1 | `VERSION_BUMP_REQUIRED` | CareProcess 是新的字段级核验事实；V1.1 exact shape 已冻结 | 是，建议 `institution-contract-v1.2` | 新 V1.2 consumer 需要显式 upgrade/projection；禁止隐式补值 | V1.1 记录保持 V1.1，不原地重写 | 必须通过显式 V1.1 projection 保持无影响 |
| Institution Capability V1 | `UNCHANGED` | 流程透明度不等于护理能力 | 否 | 否 | 无 | 无 |
| Recommendation Contract V2 | `UNCHANGED` | 产品明确禁止 V1.2 新对象进入输入/输出语义 | 否 | 否 | 无 | `business diff = 0` |
| Recommendation Ruleset V2 | `UNCHANGED` | Safety、Tier、Exact、Rank 和 `NO_EXACT_MATCH` 都不变 | 否 | 否 | 无 | `business diff = 0` |
| Profile UI V2 Integration | `COMPATIBLE_EXTENSION` | 可增加“问 AI/联系顾问”入口，但 snapshot/derivation 不变 | 领域 Contract 不变；新增 V1.2 UI addendum | 否 | 无 | 只读解释，不回写 |
| Recommendation Result UI V2 Integration | `COMPATIBLE_EXTENSION` | 可增加 AI/顾问入口；Detail/List gate 仍不解除 | 领域 Contract 不变；新增 V1.2 UI addendum | 否 | 无 | 卡片、顺序、理由不变 |
| Institution List UI | `NEW_CONTRACT_REQUIRED` | 当前只有骨架/legacy 数据源，没有冻结的 canonical List integration contract | 是，新增页面集成 Contract | 是，切换 provider 与 display model | 不改历史机构 revision | 不用评价/护理流程重排列表 |
| Institution Detail UI | `NEW_CONTRACT_REQUIRED` | 需要 canonical identity、V1.2 CareProcess、顾问与 VR truth | 是 | 是 | 展示指定 revision，不覆盖历史 | 只展示已生成的推荐上下文 |
| Consultant | `NEW_CONTRACT_REQUIRED` | 当前只有骨架，无 `ConsultantProfile`/assignment/media 边界 | 是 | 否；新对象 | 新增运营数据，不改历史 Institution | 无 |
| Appointment / Visit | `NEW_CONTRACT_REQUIRED` | 既有轻量 Appointment DTO 不足以表达运营 Visit 事实 | 是 | 旧 DTO 需显式 legacy 隔离；禁止猜测升级 | 未来记录需版本化保存 | 无 |
| Authentication / Permission | `NEW_CONTRACT_REQUIRED` | 当前没有后端身份、角色授权、手机号 consent | 是 | 上线时需要身份绑定策略 | 匿名本地数据不得伪造 server identity | 无 |
| Backend API | `NEW_CONTRACT_REQUIRED` | 当前后端仅占位 | 是 | 不适用；全新实现 | 必须保护既有历史 Contract | 无 |
| Persistence | `NEW_CONTRACT_REQUIRED` | 新对象需要服务端 identity、状态与审计 | 是 | 需要数据库 migration 计划 | 禁止覆盖历史 Assessment/Institution revision | 无直接影响 |
| AI | `NEW_CONTRACT_REQUIRED` | UI、Application、Gateway、Knowledge、Conversation、Message 均不存在 | 是 | 否；新对象 | 留存策略待决定 | 只能读 display snapshot |
| VisitEvaluation | `NEW_CONTRACT_REQUIRED` | 新的用户私有结构化反馈对象 | 是 | 否；新对象 | 与当时 Institution revision 绑定 | 严禁进入推荐 |

本分析识别到的潜在 `BREAKING_CHANGE` 均不批准：原地扩充 `InstitutionRecordV11` exact shape、把 Appointment 和 Visit 的状态混成同一事实、把用户观察写回机构核验字段、把 V1.2 数据加入 Recommendation V2。

## 3. 顶级不变量

```text
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
CARE_PROCESS_MATCHING_ROLE = DISPLAY_EXPLAINABLE_ONLY
PUBLIC_INSTITUTION_RATING = DISABLED_V1_2
REAL_AI_ONLINE = BLOCKED_BY_SECURE_BACKEND
```

以下对象不得进入 Recommendation V2 的 Safety Core、Eligibility、`EXACT / SOFT_NEAR`、PriorityFitVector、Rank Tuple、`NO_EXACT_MATCH` 或 reason generation：

- `InstitutionCareProcess`
- `AIConversation`
- `AIMessage`
- `ConsultantProfile` / Consultant interaction
- `InstitutionVisit`
- `VisitEvaluation`
- `VerificationLead`

严禁新增 `careProcessScore`、`ratingScore`、`reviewWeight`、`popularityScore`、AI ranking、AI reranking 或 AI Recommendation override。未来若产品要求这些数据影响匹配，必须发布新的 Recommendation Contract（建议 V3），重新走 Contract、fixtures、determinism、QA 和产品审批。

## 4. V1.2-A — InstitutionCareProcess Impact

### 4.1 领域归属与候选字段

`Owner = Institution Domain`。它记录“护理管理过程是否有可核验资料”，不是护理能力，也不是用户评价。

| 字段 | V1.2 产品候选语义 | 核验要求 | 缺失处理 |
|---|---|---|---|
| `careRecordAvailability` | 产品源表述为 `verified positive / unknown / unverified / expired / unavailable`；稳定 code 待冻结 | 字段级 verification/evidence；候选值中事实与核验态的最终拆分待 Contract 决定 | `unknown` |
| `careRecordFrequency` | `per_shift / daily / event_based / other / unknown` | 字段级 evidence | `unknown` |
| `careRecordTraceable` | `yes / unknown / unavailable` | 字段级 evidence | `unknown` |
| `shiftHandover24h` | `confirmed / unknown / unavailable` | 字段级 evidence | `unknown` |
| `handoverIncludesVitalSigns` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |
| `handoverIncludesAbnormalEvents` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |
| `handoverIncludesInterventions` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |
| `handoverIncludesFollowUp` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |
| `handoverIncludesFamilyCommunication` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |
| `handoverIncludesMedicalTransfer` | field-level fact | 独立 verification/evidence | `unknown`，不得 `false` |

所有关键事实必须保留至少：`institutionId`、`recordRevision`、`fieldPath`、verification/evidence 引用和可评估的有效性。`unknown != unavailable != false`，`unverified != expired`。不得用数据库 NULL、空字符串或 UI 默认值把这些状态压平。

### 4.2 写入边界

- 机构资料只能由有权限的运营/资料核验流程写入。
- `VisitEvaluation` 是 `USER_REPORTED_DATA`，不能直接写入或覆盖 CareProcess。
- 用户观察最多形成待复核线索；只有人工核验和新的 Institution revision 才能形成新平台事实。
- V1.2 开发 Mock 必须继续三层标识，不能把合成 CareProcess 标为现实机构 VERIFIED。

## 5. Institution Contract Version Proposal

### 5.1 方案比较

| 方案 | 优点 | 风险 | 结论 |
|---|---|---|---|
| A：原地 amendment `institution-contract-v1.1` | 表面改动小 | 破坏已冻结 exact shape、validator、fixture、record manifest 和历史解释；consumer 无法区分记录版本 | 不采用 |
| B1：发布 `institution-contract-v1.2` | 与产品版本一致；清楚表达 additive 事实；保留 V1.1 历史；可建立显式 projection | 需要双版本 validator/provider 和 List/Detail 迁移 | **推荐** |
| B2：直接发布 `institution-contract-v2` | 强版本信号 | V1.2 只是机构结构的兼容扩展，并未重定义 Institution identity/Capability 核心；版本跳跃会夸大破坏性 | 当前不推荐 |

明确建议：

```text
INSTITUTION_CONTRACT_VERSION_PROPOSAL = institution-contract-v1.2
INSTITUTION_CONTRACT_V1_1 = IMMUTABLE
INSTITUTION_CAPABILITY_CONTRACT_V1 = UNCHANGED
```

`InstitutionCareProcess` 应作为 `InstitutionRecordV12` 的版本化结构段并在同一 Institution V1.2 Contract 中冻结；不必为了文件数量拆成完全独立的顶级领域。若工程需要单独类型文件，它仍受 Institution Contract V1.2 所有权和 revision/evidence 规则约束。

### 5.2 迁移与投影策略

- 历史 V1.1 记录保持 `institution-contract-v1.1`，不得原地加字段或重写 revision。
- V1.2 provider 若接收旧记录，必须通过显式、可审计的 upgrade adapter 产生 V1.2 view；所有缺失 CareProcess 事实为 `unknown/unverified`，不得推成 `false/supported/0`。
- 推荐引擎继续接收冻结的 `InstitutionRecordV11` 语义。Canonical V1.2 record 进入 Recommendation V2 前必须通过显式 V1.2→V1.1 projection，排除 CareProcess，同时保持同一 `institutionId + recordRevision` 和原有 capability/evidence 语义。
- 禁止用 object spread 把未来 V1.2 sidecar 意外带入 Recommendation Domain。
- 生产数据库应创建新 revision/extension schema，而不是覆盖历史行；具体 migration 在后端 Contract 阶段冻结。

## 6. Capability Preservation

`InstitutionCapability V1 = UNCHANGED`。证明边界如下：

| CareProcess 事实 | 不等价于 | 原因 |
|---|---|---|
| 有护理记录制度 | `round_the_clock_care` | 有记录只能说明流程/可追溯性，不证明服务覆盖时长 |
| 有 24h 轮班交接 | `round_the_clock_care` | 交接安排不证明每位老人得到 24h 持续照护 |
| 记录异常事件 | `pressure_injury_care` | 记录能力不证明具备压疮专业护理能力 |
| 记录处理方法 | `tube_feeding_care` / `catheter_care` | 文书过程不证明特殊护理资质、人员或资源 |
| 可追溯、可与家属沟通 | 任一 Safety capability | 透明度不是护理安全能力 |

CareProcess 只能作为机构详情中的可解释展示信息。它不得生成硬过滤、条件候选、理由、分数或排序信号。

## 7. Institution Detail V1.2 Prerequisites

当前 List/Detail 仍建立在骨架或 legacy DTO 上，而 Recommendation V2 使用 canonical V1.1 catalog。V1.2-A 不能直接叠加到 legacy 页面。

必须依次满足：

1. **Canonical catalog**：Institution List/Detail 改为 Page→Service→Provider→runtime validation，消费同一 canonical Institution source。
2. **版本分派**：V1.1/V1.2 records 由对应 validator 验证；不得在 Page 中猜版本或补业务默认值。
3. **稳定 identity**：路由、service lookup 和 display snapshot 均绑定 `(institutionId, recordRevision)`，不能只传 legacy `id`。
4. **Same-source**：Result card、List、Detail 解析到同一记录 revision；找不到或 revision 不匹配时安全失败，不展示另一版本。
5. **Provenance/verification**：Detail 只展示合法 display projection；unknown/unavailable/unverified/expired 采用不同文案。
6. **Recommendation context**：有“为什么推荐”时只读取已经生成的 Result display snapshot，不在 Detail 重算推荐。
7. **CareProcess support**：V1.2 validator、field-level evidence、display projection 和 unknown 文案先冻结，再做 UI。
8. **Consultant assignment**：CTA 从 Consultant service 解析 `DEFAULT_CONSULTANT` 或机构 assignment，不能在机构记录硬编码朋友号码。
9. **VR truth**：只有真实、合法、可用的 VR 地址才显示入口；Mock/缺失时保持隐藏或 unavailable。
10. **Interaction/runtime Gate**：single Action、NavigationGuard、Back fallback、API fail feedback、rapid tap、DevTools 与后续真机 Gate 全部通过。

在上述前提满足前：

```text
CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_DETAIL_V1_2_GATE = NOT_RELEASED
```

本分析不解除任何 gate。

## 8. V1.2-B — Consultant Impact

`ConsultantProfile = NEW_CONTRACT_REQUIRED`，建议属于独立 Consultant Service Configuration，而不是 Institution 核心事实。

候选模型至少包括：

- `consultantId`：稳定顾问身份。
- `displayName`：公开展示名。
- `phone`：平台养老顾问/带看顾问电话，不是机构官方电话。
- `wechatQrMediaId`：企业批准的二维码媒体引用。
- `serviceStatus`：至少 `active / inactive`；公开 DTO 不应泄露内部排班细节。
- `serviceArea`：当前武汉服务范围。
- `institutionAssignment`：机构到顾问的独立映射。
- `DEFAULT_CONSULTANT`：MVP 可让全部机构共享一个默认 assignment，号码只维护一处。

推荐关系：

```text
Institution identity
  -> ConsultantAssignment
  -> ConsultantProfile public projection
```

禁止在每个 `InstitutionRecord` 重复写入朋友电话号码、二维码或顾问运营状态。未来支持多顾问、区域或轮班时，只扩展 assignment 策略，不污染 Institution revision 和 Recommendation。

需要新的 provider/service、公开 display projection、availability/error model、运营写权限、媒体审核和审计。Development Mock 可以展示明确的 Mock/unavailable 状态，但不能使用真实个人电话或假二维码。

## 9. Enterprise WeChat Impact

### 9.1 数据与权限

- 二维码 owner 是 Consultant/企业媒体服务，不是 Institution media，也不是小程序静态资产的随意副本。
- 只允许企业批准、真实可用且在有效期内的 `wechatQrMediaId` 解析为展示资源。
- 应表达 `available / unavailable / expired` 等状态；不可用时使用合法 phone fallback，二者都不可用时显示明确不可用。
- 查看公开顾问联系方式不要求登录或获取用户手机号。
- 顾问二维码轮换、失效、删除和下载权限由后端/运营 Contract 管理；前端不可缓存为永久事实。

### 9.2 MVP UX 建议

最安全简单的 MVP 交互是：

1. 页面内展示真实二维码图片和清楚的“企业微信养老顾问”身份。
2. 点击图片进入微信原生图片预览，允许用户按当前平台能力长按处理。
3. 始终提供电话 fallback；二维码不可用时完全不渲染二维码容器。
4. 不主动要求相册写入权限，不把 `wx.scanCode` 用于扫描同一台手机当前屏幕，也不生成 placeholder QR。

实施时必须依据当前微信官方 typings/API contract 核对 `image`、`wx.previewImage`、长按菜单、基础库与真机差异，并为 fail callback 提供可见反馈。DevTools 表现不能替代真机验证。

## 10. AI Architecture

AI 是新的跨层能力，不能塞进 Page handler 或 Recommendation Domain。

```text
AI Page
  -> AI Application Service
     -> Context Minimizer / Permission Gate
     -> Own Backend Gateway
        -> Knowledge Retrieval / Source Resolver
        -> AI Provider API
        -> Audit / Handoff
```

必须新增并冻结：

- AI UI state：`idle / sending / answer_ready / need_human / knowledge_unavailable / network_error / service_error`。
- AI Application：输入校验、最小上下文、source refs、错误和转人工。
- AI Backend Gateway：provider adapter、超时、限流、Secret、日志脱敏、错误映射。
- AI Knowledge Source：FAQ、display snapshots 与版本化来源。
- `AIConversation` / `AIMessage`：身份、role、content、`sourceRefs`、`handoffReason`、时间和留存边界。
- Handoff：转到 Consultant 的原因和最少必要摘要；不得默认共享完整对话。

```text
REAL_AI_ONLINE = BLOCKED_BY_SECURE_BACKEND
AI_API_KEY_IN_MINIPROGRAM = FORBIDDEN
```

在 Backend 不存在时，未来最多实现清楚标记的本地 FAQ/Mock adapter；不能宣称真实在线 AI、不能把 provider key 放进小程序、不能用 Mock 回答伪装机构实时事实。

## 11. AI Scope Matrix

| 类别 | 允许/要求 | 边界 |
|---|---|---|
| `AI_ALLOWED_SCOPE` | 产品使用方法 | 来自版本化 Product FAQ |
| `AI_ALLOWED_SCOPE` | 养老基础术语 | 非诊断、非治疗、非个体用药建议 |
| `AI_ALLOWED_SCOPE` | 解释 Profile display snapshot | 只解释已推导内容；unknown 仍是 unknown |
| `AI_ALLOWED_SCOPE` | 解释 Recommendation reason/difference/gap | 不重算、不增删卡、不改变顺序 |
| `AI_ALLOWED_SCOPE` | 查询 verified Institution display snapshot | 必须带 source refs；缺资料明确“需进一步确认” |
| `AI_ALLOWED_SCOPE` | 带看流程与看院 FAQ | 不确认预约状态 |
| `AI_HANDOFF_REQUIRED` | 医疗诊断、治疗、用药、是否需要鼻饲 | 转人工/专业医疗渠道，不生成决策 |
| `AI_HANDOFF_REQUIRED` | 复杂特殊护理确认 | 必须由机构/顾问基于真实能力确认 |
| `AI_HANDOFF_REQUIRED` | 实时床位、实时最终价格 | 当前无可靠实时来源 |
| `AI_HANDOFF_REQUIRED` | 合同、付款、投诉 | 进入人工服务流程 |
| `AI_HANDOFF_REQUIRED` | 预约确认 | 状态是 Backend/Consultant operational fact |
| `AI_HANDOFF_REQUIRED` | 用户明确要求人工 | 立即提供顾问入口 |
| `AI_HANDOFF_REQUIRED` | 连续两次资料不足或需机构确认 | 进入 `need_human` |
| `AI_FORBIDDEN_SCOPE` | 保证某机构最好、一定适合或一定入住 | 禁止承诺 |
| `AI_FORBIDDEN_SCOPE` | 补造机构价格、床位、能力、评价、QR 或 VR | 缺失必须承认 |
| `AI_FORBIDDEN_SCOPE` | AI ranking/reranking/Recommendation override | Recommendation V2 隔离 |
| `AI_FORBIDDEN_SCOPE` | 修改 Assessment、ElderProfile、Institution、Recommendation、VisitEvaluation | AI 为只读解释/分流 |

## 12. AI Context Minimization and Traceability

### 12.1 AI minimum context contract proposal

允许的上下文类别仅为：

1. `PRODUCT_FAQ_SNAPSHOT`
2. `PROFILE_DISPLAY_SNAPSHOT_V2`
3. `RECOMMENDATION_DISPLAY_SNAPSHOT_V2`
4. `VERIFIED_INSTITUTION_DISPLAY_SNAPSHOT`
5. `VISIT_FAQ_SNAPSHOT`

禁止默认发送：

- 完整 32 道 Assessment raw answers；
- 完整 health/cognitive/special-care raw data；
- Institution evidence dump；
- internal operation notes、私人后台备注；
- AppSecret、AI provider Secret、token 或凭证；
- 与当前问题无关的手机号、评价全文或对话历史。

Context builder 应按本次问题选择最小字段，并在服务端执行权限和敏感字段 allowlist；Page 不得用 object spread 上传完整 Store/Profile/Recommendation 对象。

### 12.2 Source traceability

机构事实型回答至少应在服务端审计记录中保留：

- `sourceRefs[]`
- `knowledgeCategory`
- `institutionId + recordRevision`（涉及机构时）
- Institution display snapshot version
- Profile/Recommendation display snapshot version（涉及解释时）
- `recommendationContractVersion` / `rulesetVersion`（涉及推荐解释时）
- 生成时间、knowledge version 和 handoff reason

用户界面不必暴露内部 evidence dump，但必须能显示通俗来源类别和“资料截至/需确认”状态；后台必须可追溯回答所依据的合法 display snapshot。

## 13. V1.2-C — InstitutionVisit Impact

`InstitutionVisit = NEW_CONTRACT_REQUIRED`。候选字段：

| 字段 | 语义 |
|---|---|
| `visitId` | 正式带看记录 ID；不得由前端临时 UUID 冒充服务器身份 |
| `userId` | 正式持久化用户；匿名意向与正式记录分离 |
| `institutionId` | 带看机构身份 |
| `institutionRecordRevision` | 发起/确认带看时所依据的机构版本 |
| `consultantId` | 负责顾问 |
| `status` | `requested / contacting / scheduled / completed / cancelled` |
| `scheduledAt` | 顾问/后端确认的计划时间，存在时写入 |
| `completedAt` | 真实完成时间，存在时写入 |
| `createdAt` | 正式记录创建时间 |

状态是 Backend/Consultant operational fact。前端只渲染服务端状态，不能根据当前时间把 `scheduled` 自动改为 `completed`，也不能因跳转成功就写成“已确认”。每次状态转换应记录 actor、时间、来源和幂等键。

## 14. Appointment vs Visit Model

### 14.1 方案比较

| 方案 | 模型 | 优点 | 风险 |
|---|---|---|---|
| A：扩展单一 Appointment | 从意向一路承载到实际带看和评价资格 | 对象少 | 用户请求状态与运营事实混杂；旧 DTO 语义被改写；取消/确认/完成容易互相矛盾 |
| B：`AppointmentRequest -> InstitutionVisit` | 预约是用户请求；Visit 是顾问/运营事实 | identity、权限、审计和评价资格清楚；旧 DTO 可隔离 | 多一个显式关联和转换 |

推荐方案 B：

```text
AppointmentRequest 1 -> 0..1 InstitutionVisit
```

- Appointment/Request identity 表示用户提交的预约意向；“提交成功”不等于机构已确认。
- 顾问开始承接或确认后创建/关联 `InstitutionVisit`；是否在 `requested` 即创建 Visit 由后续 Contract 决定，但不得两边各维护一套冲突状态。
- `scheduled` 只能由有权限的顾问/运营/后端工作流确认。
- 实际带看完成后写入 `completed` 与 `completedAt`。
- `VisitEvaluation` eligibility 必须依赖真实 `visitId + status=completed + user ownership`。
- 预约未承接、取消或失效时可以没有 Visit；Visit 必须保留 source appointment identity（如存在）。
- 既有前端 `Appointment` DTO 视为 legacy UI type；不得静默迁移成正式 server object。

后续 Contract 仍需决定：一对一是否绝对、取消/改期/no-show/rejected 状态、期望时间与确认时间分离、状态 code 大小写兼容以及匿名意向升级规则。

## 15. VisitEvaluation Impact

`VisitEvaluation = NEW_CONTRACT_REQUIRED`，且：

```text
VISIT_EVALUATION_DATA_CLASS = USER_REPORTED_DATA
```

身份至少绑定：`evaluationId`、`visitId`、`institutionId`、`institutionRecordRevision`、`userId`。它保存用户自己的决策记录和运营复盘素材，不能成为 Institution verified field、InstitutionCapability、公开评分或 Recommendation 输入。

状态为 `editing / submitting / submitted / submit_failed`。提交失败必须保留用户输入；正式提交必须由后端验证 completed Visit、用户归属和幂等性。是否允许提交后编辑/撤回、一个 Visit 多次评价或 server-side draft 尚需产品决策。

### 15.1 CareProcess observation boundary

评价中的“是/否/未确认”是 `USER_REPORTED_VISIT_OBSERVATION`。例如用户选择“没有了解到 24h 交接”，只能保存为用户观察：

```text
VisitEvaluation
  -> optional VerificationLead candidate
  -> human review / institution evidence
  -> new Institution revision
```

不得直接执行：

```text
InstitutionCareProcess.shiftHandover24h = unavailable
```

## 16. Evaluation Field Manifest (Proposed)

本 manifest 提供稳定候选 field/code，供下一阶段 Contract 审批；requiredness 未由 PDF 明确时一律标为 `PRODUCT_DECISION_REQUIRED`，不在本分析中猜测。

### 16.1 总体与六个维度

| Field ID | 类型/范围 | 语义/展示提示 | Requiredness |
|---|---|---|---|
| `overallRating` | integer `1..5` | 整体印象 | `PRODUCT_DECISION_REQUIRED`（建议 required） |
| `considerationIntent` | single choice | `further_consider / continue_compare / not_consider` | `PRODUCT_DECISION_REQUIRED`（建议 required） |
| `ratings.environment` | integer `1..5` | 环境卫生、房间舒适、适老化、公共空间、居住氛围 | `PRODUCT_DECISION_REQUIRED` |
| `ratings.care` | integer `1..5` | 服务态度、专业感受、与老人沟通、护理秩序 | `PRODUCT_DECISION_REQUIRED` |
| `ratings.medical` | integer `1..5` | 医疗配套、紧急处理说明、康复设施、安全管理 | `PRODUCT_DECISION_REQUIRED` |
| `ratings.meal` | integer `1..5` | 餐厅环境、餐食观感、饮食安排说明、主观饮食适配感受 | `PRODUCT_DECISION_REQUIRED` |
| `ratings.activity` | integer `1..5` | 活动空间、活动丰富度、生活氛围、公共区域使用 | `PRODUCT_DECISION_REQUIRED` |
| `ratings.pricingTransparency` | integer `1..5` | 收费介绍是否清楚 | `PRODUCT_DECISION_REQUIRED` |

PDF 的分项文字当前作为各维度评分提示，不应未经产品审批扩成二十余个独立评分题。

### 16.2 护理管理观察

| Field ID | 类型/候选 code | Requiredness / 规则 |
|---|---|---|
| `careProcessObservations.careRecordAwareness` | single `yes / no / unconfirmed` | `PRODUCT_DECISION_REQUIRED` |
| `careProcessObservations.shiftHandover24hAwareness` | single `yes / no / unconfirmed` | `PRODUCT_DECISION_REQUIRED` |
| `careProcessObservations.handoverIncludes` | multi：`vital_signs / abnormal_events / interventions / follow_up / family_communication / unconfirmed` | `PRODUCT_DECISION_REQUIRED`；若批准，`unconfirmed` 与具体项互斥 |

这里的 `no` 表示“用户本次未了解到”，不是机构不存在该制度。

### 16.3 费用说明观察

| Item code | 中文 |
|---|---|
| `bed_fee` | 床位费 |
| `meal_fee` | 餐费 |
| `care_fee` | 护理费 |
| `management_fee` | 管理费 |
| `special_care_fee` | 特殊护理费 |
| `deposit` | 押金 |
| `other_one_time_fee` | 其他一次性费用 |

建议容器为 `feeDisclosureObservations`。PDF 只规定“是否说明”这些项目，未冻结逐项回答是 boolean、三态 `yes/no/unconfirmed` 还是已说明项目多选。因此答案 shape 和 requiredness 均为 `PRODUCT_DECISION_REQUIRED`；不得擅自把未选择解释成“未说明”。

### 16.4 标签与文字

`likedTags` 与 `concernTags` 使用同一候选 code 集：

```text
care
medical
room
environment
meal
activity
transport
price
staff_attitude
other
```

- 每组最多 3 项；是否至少选择 1 项为 `PRODUCT_DECISION_REQUIRED`，建议 optional。
- `comment` 明确为 optional，最大 200 个字符；计数口径（Unicode code point 或 UTF-16 unit）需在 Contract 中冻结并与微信端/后端一致。
- `other` 是否需要条件文本字段未由 PDF 说明，标为 `PRODUCT_DECISION_REQUIRED`，不得静默复用 `comment`。

## 17. VerificationLead Decision

建议：

```text
VERIFICATION_LEAD_V1_2_MVP = FUTURE_OPTIONAL
AUTO_CREATE_VERIFICATION_LEAD = FALSE
```

V1.2 MVP 可保存 VisitEvaluation，并由运营人工复盘。PDF 将 `VerificationLead` 定义为后续/可选链路；首批不必建设内部审核队列。若产品批准自动或半自动建线索，必须另发 `VERIFICATION_LEAD_CONTRACT`，冻结 claim、fieldPath、状态、reviewer、evidence、权限、去重和新 revision 关联。无论是否建线索，用户反馈都不能自动升级为 verified fact。

## 18. Public Rating Policy

```text
PUBLIC_INSTITUTION_RATING = DISABLED_V1_2
```

Institution List、Institution Detail、Recommendation Result 均不得新增平均星级、评论数、好评率、评价排名或用户评论流。VisitEvaluation 默认仅用户本人和有授权的企业内部角色可见；不参与 List 排序、Recommendation ranking 或机构核验状态。

## 19. V1.2 Permission Matrix

| 行为 | Anonymous | Authenticated User | Consultant | Operations | Frontend gate | Backend authorization |
|---|---|---|---|---|---|---|
| 查看公开 CareProcess | 允许 | 允许 | 允许 | 允许 | 只渲染合法 display projection | 仅返回可公开且核验态清楚的字段 |
| 打开 AI | 允许 | 允许 | 可用 | 可用 | 不提前登录 | 限流、内容与上下文策略 |
| AI 读取匿名 Profile snapshot | 有合法本地 snapshot 时允许 | 最小化允许 | 仅经用户授权 | 仅业务必要且授权 | 明示使用范围；不上传 raw Draft | Context allowlist / consent / audit |
| 联系顾问 | 允许 | 允许 | 不适用 | 不适用 | 公开服务入口 | 只返回 approved public profile |
| 查看企业微信 QR | 允许 | 允许 | 不适用 | 可维护 | available 才显示；失败有 fallback | 媒体有效性、公开投影与审计 |
| 创建本地 appointment/visit intention | 可允许未持久化意向 | 允许 | 可代录 | 可代录 | 明示“未提交/本地” | 正式保存前鉴权/幂等 |
| 正式提交 appointment | 操作点要求登录 | 允许 | 可协助，不冒充用户 | 可代录并保留 actor | 登录和 consent gate | user ownership / actor / state transition |
| 获取用户手机号 | 仅在明确预约/要求联系时触发 | 同左 | 仅因服务处理读取 | 最小权限读取 | 不在 AI/详情/推荐入口强制 | consent、加密、脱敏、访问审计 |
| 创建/更新 Visit 状态 | 禁止 | 只可发起请求/取消其允许状态 | 按 assignment 权限 | 允许 | 不前端推断状态 | 状态机 + role + actor audit |
| 提交看院评价 | 禁止正式提交 | 仅本人且 Visit completed | 可协助但不得代写用户观点 | 可协助/内部查看 | completed eligibility + 输入保留 | visit/user ownership + 幂等 |
| 修改自己的已提交评价 | 禁止 | `PRODUCT_DECISION_REQUIRED` | 禁止替用户改 | 合规更正需审计 | 由 Contract 决定 | 版本/审计/撤回策略 |
| 查看他人评价 | 禁止 | 禁止 | 仅业务授权范围 | 内部授权可看 | 不提供公开入口 | row-level authorization |
| 维护 Institution/CareProcess | 禁止 | 禁止 | 默认禁止 | 允许/需审核 | 无用户端写入口 | field-level verification + revision |
| 将用户反馈升级为 verified fact | 禁止 | 禁止 | 禁止直接升级 | 仅人工核验后 | 无自动路径 | evidence、reviewer、新 revision |

Product permission 说明“业务是否允许”；Frontend gate 只改善 UX，不能代替 Backend authorization。所有服务端读写必须独立校验身份、对象归属、角色和状态。

## 20. Login and Phone Boundary

继续保持：

- 匿名允许：首页、机构浏览、Assessment、AI 初询、查看/联系顾问。
- 保存历史、正式 appointment/visit、VisitEvaluation 等持久化能力可以在操作点要求登录。
- 手机号只在用户明确预约或明确要求顾问联系时请求。
- 打开 AI、机构详情、Profile 或 Recommendation Result 时不得强制登录或手机号授权。
- `ConsultantProfile.phone` 是平台公开服务号码；`User.phone` 是用户个人数据，两者是不同对象、权限和生命周期。

当前无 Backend 时：

| 功能 | 当前允许状态 |
|---|---|
| AssessmentDraft / Profile Preview / Recommendation Preview | `LOCAL_ONLY`，沿用冻结边界 |
| AI FAQ / 开发 Mock adapter | `MOCK_ONLY`，必须明示非在线 AI、无实时机构事实 |
| Consultant Mock/unavailable display | `MOCK_ONLY`；不得使用假电话或假 QR |
| Appointment 表单本地草稿 | 可提案为 `LOCAL_ONLY`，不得显示正式提交/确认 ID |
| 正式 appointment/visit | `BLOCKED_BY_BACKEND` |
| Visit state/history | `BLOCKED_BY_BACKEND` |
| VisitEvaluation 正式提交/历史 | `BLOCKED_BY_BACKEND` |
| 真实在线 AI | `BLOCKED_BY_SECURE_BACKEND` |
| 登录、手机号安全落库 | `BLOCKED_BY_BACKEND` |

## 21. Route Impact

新增候选路由：

- `/pages/service/ai-chat`
- `/pages/visit/evaluation`

当前 21 个物理路由（20 个 P0 业务页面 + `elder/detail` 配套路由）若只增加这两个页面，将变为 23 个物理路由。实施阶段需同步 `miniprogram/app.json`、`ROUTES.md`、页面 ownership 和 route runtime gate；本分析不注册路由。

候选入口：Home、Profile、Recommendation Result、Institution Detail 可进入 AI；Home/Detail/Recommendation/VR 可进入 Consultant；只有 completed Visit/Appointment History 可进入 Evaluation。

`WECHAT_INTERACTION_CONTRACT = UNCHANGED`。新页面仍必须：

- `1 physical tap -> 1 component event -> 1 page handler -> at most 1 navigation`；
- 使用明确的 `action/back/next` 事件，不用 native bubbling + `triggerEvent('tap')` 双通道；
- NavigationGuard 只作第二层防御；
- Back 有 root fallback；导航和关键 `wx.*` API fail 有当前操作区域可见反馈；
- rapid tap 不重复 push，返回后可再次操作；
- 实施前定义 `INTERACTION_MATRIX`，后续执行 DevTools 和真实 Android Gate。

当前 `AGENTS.md` 仍写有“不建设 AI 对话养老顾问”和旧 P0 页面清单；V1.2 将 AI 收敛为有限范围咨询助手。实施前需要一次受控规则更新明确此有限例外，而不能让 Agent 依据旧规则或宽泛“AI 顾问”各自解释。

## 22. Page Impact Matrix

| 页面 | 分类 | V1.2 影响 / data source | CTA / permission | Backend dependency |
|---|---|---|---|---|
| 首页 | `COMPATIBLE_EXTENSION` | 增加 AI 初询入口；机构预览仍需从 legacy 迁 canonical | AI 匿名可点；单 Action | FAQ Mock 可前端；real AI 需 Backend |
| Profile | `COMPATIBLE_EXTENSION` | 只把 V2 display snapshot 作为最小 AI context | “问 AI/联系顾问”；不改 derivation | AI real/handoff 需 Backend |
| Recommendation Result | `COMPATIBLE_EXTENSION` | 增加 AI 解释入口；cards/reasons/order 不变 | Detail/List 仍 blocked；顾问/AI 匿名可用 | AI real 需 Backend |
| Institution List | `REQUIRES_MIGRATION` | legacy/骨架 → canonical V1.1/V1.2 provider | 详情 CTA 需 identity gate | 真实 catalog/revision 生产需 Backend |
| Institution Detail | `REQUIRES_MIGRATION` | canonical record + CareProcess display + assignment | VR/AI/顾问/预约；same-source | 真实事实、顾问、预约需 Backend |
| VR | `UNCHANGED` | 仅真实 URL/媒体；无数据隐藏 | 顾问/预约 CTA 可扩展 | 真实媒体源生产需 Backend/可信 provider |
| Consultant | `COMPATIBLE_EXTENSION` | 骨架 → Consultant service public projection | 电话、真实 QR、预约；无需先登录浏览 | 生产 profile/assignment/media 需 Backend |
| AI Chat | `NEW_PAGE` | FAQ/display snapshots；不能读 raw Draft | 发送、重试、转人工、Back | real AI `BLOCKED_BY_BACKEND` |
| Appointment Create | `REQUIRES_MIGRATION` | legacy skeleton → Request/Visit service | 明确预约时登录/手机号 | 正式提交 `BLOCKED_BY_BACKEND` |
| Appointment Success | `BLOCKED_BY_BACKEND` | 只展示真实提交响应 | 写“申请已提交”，不写“已确认” | 必须 Backend identity/state |
| Visit Evaluation | `NEW_PAGE` | completed Visit + Evaluation service | 校验、提交失败保留、Back | 正式提交 `BLOCKED_BY_BACKEND` |
| Mine | `UNCHANGED`（首批） | V1.2 P1 可以后增加我的带看/评价 | 登录后历史入口 | 新历史需 Backend |
| Appointment History | `REQUIRES_MIGRATION` | 后端 Visit operational state，不按时间推断 | completed 才出现评价 CTA | `BLOCKED_BY_BACKEND` |

## 23. Downstream Identity Gate

Detail/List gate 只能在以下证据同时成立后解除：

1. canonical Institution V1.1/V1.2 identity 与 validator 已冻结；
2. Result、List、Detail 使用同一 catalog/provider 或可证明 same-source 的 immutable snapshot；
3. route 参数含 `institutionId + recordRevision`，并对缺失、篡改、revision mismatch 安全失败；
4. display snapshot 保留 contract version、record revision、provenance、verification；
5. CareProcess 只在 V1.2 record/display projection 中出现；
6. Consultant CTA 通过 assignment 解析；
7. VR truth gate 通过；
8. List/Detail runtime、interaction、DevTools 和 Android 真机 Gate 通过。

相同 identity 继续贯穿：

```text
Recommendation card / source manifest
  -> Institution Detail
  -> AppointmentRequest
  -> InstitutionVisit
  -> VisitEvaluation
```

每一步都保留当时的 `(institutionId, recordRevision)`。不得伪造 `institutionId`、`recordRevision`、appointment/visit/evaluation identity，也不得以当前最新 revision 替换历史带看所对应版本。

## 24. Backend Requirement Matrix

| 功能 | 分类 | 说明 |
|---|---|---|
| 静态页面壳、边界说明、empty/error UI | `FRONTEND_ONLY_SAFE` | 不产生正式 identity/事实/成功状态 |
| 从已验证本地 record 构建 CareProcess display view | `FRONTEND_ONLY_SAFE` | 仅开发；unknown 保真，不写回 |
| CareProcess 开发展示 | `FRONTEND_MOCKABLE` | 三层 Mock 标识；不能伪装真实核验 |
| Consultant static profile | `FRONTEND_MOCKABLE` | 只能开发 Mock/unavailable；生产需 authoritative config |
| Enterprise QR | `FRONTEND_MOCKABLE` 仅 unavailable 状态 | 禁止 fake/placeholder QR；真实 QR 生产需媒体服务 |
| AI FAQ | `FRONTEND_MOCKABLE` | 明示 FAQ/Mock，不宣称模型或实时事实 |
| Real AI | `BACKEND_REQUIRED_FOR_PRODUCTION` | 自有 Gateway、Secret、context、source、rate limit、audit |
| Appointment persistence | `BACKEND_REQUIRED` | identity、幂等、用户/机构/顾问关联 |
| Visit state | `BACKEND_REQUIRED_FOR_PRODUCTION` | operational fact、状态审计 |
| VisitEvaluation persistence | `BACKEND_REQUIRED_FOR_PRODUCTION` | completed gate、ownership、失败恢复 |
| Login | `BACKEND_REQUIRED_FOR_PRODUCTION` | 微信登录换取/维护服务端身份 |
| User phone | `BACKEND_REQUIRED_FOR_PRODUCTION` | 明确 consent、加密、脱敏、授权访问 |
| VerificationLead | `BACKEND_REQUIRED`（若启用） | 内部工作流；本 MVP 建议 deferred |
| Institution management/revision/evidence | `BACKEND_REQUIRED_FOR_PRODUCTION` | field-level verification、immutable revision |

## 25. Persistence Impact

| 对象 | 未来持久化 | V1.2 可暂时代替方案 | 禁止伪装 |
|---|---|---|---|
| `InstitutionCareProcess` | Institution revision/evidence store | Development Mock `unknown/unverified` | Mock VERIFIED、覆盖历史 revision |
| `ConsultantProfile` / assignment | 顾问主档、媒体、机构映射、审计 | 静态开发 config 或 unavailable | 假电话、假 QR、机构官方号码 |
| `AIConversation` / `AIMessage` | 是否持久化及留存待产品决定 | session-only FAQ Mock | 把本地消息称为服务端历史 |
| AppointmentRequest | 服务端 identity、用户、机构、期望时间、contact consent | local draft（若批准） | 假 submission/confirmation ID |
| `InstitutionVisit` | 服务端状态机、实际时间、actor audit | 无可替代 production 方案 | 前端时间推断 completed |
| `VisitEvaluation` | 用户归属、visit/revision、内容、状态、幂等 | local draft（若批准） | 假 submitted 状态/公开评分 |
| User/Elder linkage | 服务端 identity/ownership | 继续匿名 Preview，不建正式 identity | `localDraftId = assessmentId/elderId` |
| `VerificationLead` | 内部 review queue（若启用） | 运营人工离线复盘 | 用户反馈自动写 verified fact |

未来数据库 migration 必须前向兼容、保留 immutable Institution revision 和状态审计，不能以 SQL NULL 压平 unknown/unavailable。当前仓库没有数据库，因此本分析不声称任何 migration 已存在。

## 26. Privacy / Security

```text
V1_2_PRIVACY_REQUIREMENTS = PROPOSED
```

- **健康与 AI**：默认不向模型发送完整 Assessment/health/cognitive/raw special-care；只发送当前问题需要的 display snapshot 字段。
- **手机号**：只在明确预约或顾问联系时收集；需要 consent、传输保护、加密/脱敏存储、访问审计和删除策略。
- **企业微信 QR**：只用企业批准媒体；不得将个人临时二维码、过期二维码或媒体原始管理地址公开。
- **对话留存**：需冻结匿名/登录会话留存周期、删除、导出、顾问可见范围；默认不把完整对话分享给顾问。
- **VisitEvaluation / comment**：默认用户私有 + 企业内部服务记录；防止自由文本泄露老人健康、电话或第三方信息；不公开索引。
- **机构 evidence**：AI/UI 只读 display projection，不能暴露合同、内部审计、原始证据文件或运营备注。
- **Secrets**：AI API key、AppSecret、数据库凭证只能在后端 Secret 管理中；不得进入小程序、Mock、日志或 Git。
- **日志**：不记录完整 Assessment、Profile、Recommendation、AI conversation、手机号或评价大对象。
- **授权**：Frontend gate 不能替代 Backend role/row-level authorization；状态变更记录 actor。
- **数据真实性**：unknown/unavailable/unverified/expired 均保真；AI 缺来源必须承认不足。

## 27. Recommendation V2 Isolation

### 27.1 当前只读证明

当前正式链路仍为：

```text
AssessmentDraftV2
  -> deriveElderProfilePreviewV2()
  -> InstitutionCatalogServiceV11
  -> validateAndProjectInstitutionPoolV2()
  -> evaluateRecommendationPreviewV2()
  -> deriveRecommendationSemanticsV2()
  -> Result display snapshot
```

只读审查确认：

- V1.2 新对象在 `miniprogram/**`、`scripts/**`、`server/**` 中没有实现/import/feed path。
- V2 Institution extension allowlist 只有已冻结的 room/meal/activity 路径，没有 CareProcess、AI、Consultant、Visit、Evaluation 或 VerificationLead。
- Recommendation V2 `68/68 PASS`，Formal/Preview parity `6/6 PASS`，V2 integration `20/20 PASS`；Recommendation V1 `117/117 PASS`，V1 integration `24/24 PASS`。
- 完整 catalog 先进入 Domain；Preview persistence 为 0。

`CURRENT_RECOMMENDATION_V2_ISOLATION = PASS`。但当前尚无 V1.2 专用 isolation script，因此未来自动化覆盖状态为 `PROPOSED_NOT_IMPLEMENTED`。

### 27.2 Architectural risk

`ARCHITECTURAL_RISK`：Recommendation application 当前接收完整 `InstitutionRecordV11`。未来如果粗暴放宽类型、移除 exact-key validation 或用 object spread 传递 `InstitutionRecordV12`，CareProcess 可能越过投影边界。解决方向是新版本 validator + 显式 V1.2→V1.1 projection，而不是修改当前 Recommendation。

### 27.3 Proposed V1.2 isolation gate

后续建议新增 `V1_2_RECOMMENDATION_ISOLATION_GATE`：

1. 禁止 Recommendation Domain import CareProcess、AI、Consultant、Visit、Evaluation、VerificationLead。
2. 固定 input/extension field allowlist，拒绝宽泛 object spread。
3. 对同一 Profile/Catalog/evaluationAsOf 添加 display-only V1.2 sidecar，Safety、tier、Exactness、PriorityFitVector、Rank Tuple、cards、`NO_EXACT_MATCH`、reasons/differences 必须 deep-equal。
4. 扫描并拒绝 `careProcessScore/ratingScore/reviewWeight/popularityScore` 和 AI/manual rerank。
5. `VisitEvaluation` 只能产生用户反馈；`VerificationLead` 只有经人工核验和新 Institution revision 才能影响未来机构事实。
6. 每个 V1.2 阶段继续原样运行 Recommendation V2 68 cases、V1 117 cases、integration、permutation 和 determinism gates。
7. Recommendation Contract V2 与 Ruleset V2 的 business diff 必须为 0。

本阶段只提出 Gate，不实现脚本。

## 28. New Contract Inventory

避免过度拆分，建议未来形成以下最小集合：

| 建议 Contract | 处理方式 | 合并/边界说明 |
|---|---|---|
| `INSTITUTION_CONTRACT_V1_2` | 新版本 | 将 `InstitutionCareProcess` 作为同一文档/所有权下的结构段；不另起重复 Institution identity |
| `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT` | 新 UI/Application contract | 冻结 canonical provider、same-source identity、display snapshot、route 和 gate 解除条件 |
| `CONSULTANT_SERVICE_CONTRACT` | 新 Contract | 合并 ConsultantProfile、assignment、public projection、phone/QR availability/media |
| `AI_SUPPORT_AND_CONTEXT_CONTRACT` | 新 Contract | 合并 AI Support、Knowledge Context、source traceability、UI/Application/Gateway state 与 handoff；无需拆成两套重叠 Contract |
| `APPOINTMENT_VISIT_CONTRACT` | 新 Contract | 同时冻结 Request 与 Visit 的 identity、关系、状态和权限，避免重复状态机 |
| `VISIT_EVALUATION_CONTRACT` | 新 Contract | 单独冻结用户数据、manifest、completed gate、提交/编辑和 observation boundary |
| `V1_2_PERMISSION_PRIVACY_CONTRACT` | 新横切 Contract | 登录、手机号、角色、对象归属、AI context、retention 与审计 |
| Backend API/Persistence manifest | 各领域 Contract 的配套章节或一个统一 manifest | 不应重复业务语义；只冻结 endpoints、error codes、schema migration 和 idempotency |

`VERIFICATION_LEAD_CONTRACT` 暂不纳入 MVP 必须集合；只有产品批准启用内部线索工作流时再发布。

## 29. Recommended Implementation Sequence

依赖优先的建议顺序如下，不机械照搬 A/B/C 页面顺序：

0. **Product decisions**：项目负责人审批本分析中的 version、Appointment/Visit、evaluation requiredness、AI retention 等决策。
1. **V1.1 final freeze**：先执行 G0、Android 17 人工 Gate 和 V1.1 Final Freeze，保留稳定回归基线。
2. **V1.2-A0 — Canonical Institution prerequisite**：冻结 List/Detail V1.1 canonical migration 和 same-source identity；先迁移 provider/display/route，不加 CareProcess。
3. **V1.2-A1 — Institution V1.2 Contract**：冻结 CareProcess 值域、field evidence、V1.1↔V1.2 version dispatch、Recommendation projection 和 fixtures。
4. **V1.2-B1 — Consultant/Permission Contract**：冻结 ConsultantProfile、assignment、phone/QR、公开投影、媒体和权限。
5. **V1.2-C1 — Appointment/Visit/Evaluation Contract**：先冻结 Request→Visit、状态机、completed eligibility、评价 manifest、登录/手机号和 persistence。
6. **V1.2-A2 — Institution List/Detail UI**：在 canonical source 上实现 CareProcess、顾问 CTA、VR truth；经独立 QA 后才评估解除 Detail/List gate。
7. **V1.2-B2 — AI Support Contract + FAQ/Mock UI**：冻结最小 context/source/handoff；可实现明确标识的 FAQ/Mock，但不接模型。
8. **Backend foundation milestone**：经项目负责人单独授权后建立 Spring Boot/API/DB、auth/consent/audit、Institution revision、Consultant、Appointment/Visit/Evaluation persistence。
9. **V1.2-C2 — Visit/Evaluation UI integration**：连接真实 Visit status 和 Evaluation API；失败保留输入；不公开评分。
10. **V1.2-B3 — Real AI Gateway**：在安全 Backend、Secret、retention、source traceability 和 handoff 都通过后才接真实 AI。
11. **每阶段 Gate**：frozen regression、V1.2 isolation、TypeScript/WeChat compatibility、Interaction runtime、DevTools、独立 QA；对应功能完成后再安排 Android 真机人工 Gate。

建议 Git milestones 独立保持：analysis doc、各 Contract freeze、canonical Institution migration、CareProcess UI、Consultant、Visit/Evaluation、Backend foundation、AI gateway。不得把 Product PDF、Contract 和大量 production implementation 混进同一 commit。

## 30. V1.1 Final Freeze Sequence

两个选项：

- **Option A（推荐）**：Change Impact Analysis → V1.1 G0 → Android 17 人工验证 → V1.1 Final Freeze → V1.2 implementation。
- Option B：直接 V1.2 implementation，再做混合 Android Gate。

选择 Option A。理由：

1. 当前 V1.1 主链已经具备清晰代码 baseline，但 Android Gate 尚未执行。
2. 先锁定 V1.1 可把后续真机失败明确归因到 V1.2，而不是在 AI、Detail、Visit 同时加入后再猜回归来源。
3. V1.2 将增加路由、长页面、媒体、网络、登录、手机号和状态交互；这些都会扩大真机变量。
4. V1.1 frozen runtime cases 可成为 V1.2 isolation 的稳定对照。

本分析完成后不得直接开始 V1.2 implementation。

## 31. Independent Agent Reviews

### 31.1 backend_domain

结论：`PASS_WITH_REQUIRED_CONTRACTS`。

- 当前没有正式后端；CareProcess、Consultant、AI、Visit、Evaluation、permission 和 persistence 均需新 Contract。
- 推荐 Request 与 Visit 分离，并保留 immutable Institution revision、状态 actor audit 和用户 ownership。
- Real AI、正式 appointment/visit、Evaluation、登录和手机号均被 Backend 阻塞。
- VerificationLead 建议后续可选，用户反馈不能直接升级事实。

### 31.2 wechat_frontend

结论：`PASS_WITH_MIGRATION_GATES`。

- 当前 21 个物理路由，缺 AI/Evaluation；List/Detail/Consultant/Appointment 仍为 legacy 或骨架。
- 先完成 canonical Institution identity，再接 CareProcess/Detail；不绕过 Result 的两个 development gate。
- 新页面必须沿用 Page→Service→Provider、single Action、NavigationGuard、fail feedback、Mock 三层披露。
- 真实 QR、电话、AI、Visit 状态和评价提交均不得用前端 Mock 伪装生产成功。

### 31.3 matching_engine

结论：`CURRENT_RECOMMENDATION_V2_ISOLATION = PASS`，`V1_2_RECOMMENDATION_CHANGE_IMPACT = PASS_WITH_GAPS`。

- 当前新对象 import/feed 为 0；V1/V2 runtime、parity、integration 和 determinism 通过。
- Recommendation V2/Ruleset V2 应保持 `UNCHANGED`。
- 唯一 gap 是尚无 V1.2 专用 isolation gate；本文件已提出 gate，但按阶段边界不实现。

### 31.4 qa_reviewer

结论：`QA_VERDICT = PASS_WITH_RISKS`，无 blocker。

- 两份 V1.2 PDF 已完整读取（61 页、27 页），Frozen Contract impact matrix 覆盖要求对象。
- 当前 V1.2 新对象进入 Recommendation 的 import/feed 为 0；当前路由为 21，AI Chat/Evaluation 尚未注册；`server/` 仍只有占位 README。
- Git 暂存区为空，只有本分析文档新增；`PRODUCTION_CODE_CHANGE = 0`，`git diff --check = PASS`。
- 非阻断风险：CareProcess stable code 尚待冻结、专用 Recommendation isolation automation 尚未实现、V1.1 Android Final Freeze 尚未完成、当前没有真实 V1.2 业务数据。

## 32. Product Decisions Required

在进入对应实现前需要项目负责人明确：

1. 批准 `institution-contract-v1.2`，而不是原地 amendment V1.1 或直接跳 V2。
2. 冻结 CareProcess 每个 field-level fact 的 stable value；尤其 `careRecordAvailability` 中事实与核验状态是否拆分。
3. 批准 AppointmentRequest 与 InstitutionVisit 分离、关联基数、状态职责、取消/改期/no-show/rejected 规则。
4. 冻结 `scheduledAt` 是确认时间还是期望时间，并决定是否另设 requested slot。
5. 冻结 Evaluation 六个维度的 requiredness、fee disclosure answer shape、`other` 文本和一个 Visit 可评价次数/编辑撤回规则。
6. 确认 Evaluation draft 是仅本地、可登录后服务器恢复，还是不保存；正式提交必须登录。
7. 确认 `VerificationLead = FUTURE_OPTIONAL`，首批只做运营人工复盘。
8. 批准 Consultant MVP 全部机构→`DEFAULT_CONSULTANT`，并冻结未来 assignment 所需的最小字段。
9. 冻结顾问电话与企业微信 QR 的 authoritative source、媒体审核、轮换、失效和 fallback。
10. 冻结匿名 AI conversation 是否持久化、留存期、删除和顾问可见范围，以及用户主动共享机制。
11. 批准 AI 首批只做 FAQ/Mock 还是等待 Backend；任何 real AI 都必须经 Own Backend。
12. 冻结登录/手机号 consent、加密、脱敏、访问审计和删除策略。
13. 批准先完成 V1.1 Android Final Freeze（Option A）。
14. 批准 V1.2 实施前更新 `AGENTS.md` 中旧 AI/P0 页面边界，明确“有限范围 AI 咨询助手”例外。
15. 单独授权何时创建正式 Spring Boot 3 / Java 21 / MySQL 8 工程与 migration framework。

## 33. Blockers and Risks

### 33.1 Blockers for implementation

- 上述产品决策和新增 Contract 尚未冻结。
- V1.1 Android Gate / Final Freeze 尚未完成。
- Institution List/Detail canonical identity 与 same-source gate 尚未完成。
- 后端只有占位，没有 API、数据库、鉴权、Secret 或持久化能力。
- 没有真实 CareProcess evidence、顾问电话/企业微信 QR、Visit 或 Evaluation 数据。
- `AGENTS.md` 的旧 AI/P0 边界与 V1.2 产品源需要受控对齐。

这些不是完成本分析文档的 blocker；它们是进入 V1.2 production implementation 的 blocker。

### 33.2 Risks

- 原地修改 V1.1 Institution shape 会破坏 frozen validator、历史解释与 Recommendation input。
- 先做 Detail UI 再迁 canonical identity 会造成 Result/List/Detail 指向不同机构 revision。
- CareProcess 被错误映射为 Capability 会造成高风险护理能力误判。
- 用户评价直接回写 Institution 或进入排名会污染核验事实与 Recommendation。
- Appointment/Visit 混成一个状态机，会让“已提交”“已确认”“已完成”失真。
- AI 接收 raw health data、无 source refs 或前端 Secret 会带来隐私、安全和虚构事实风险。
- Mock 电话、QR、VR、床位或提交成功会违反真实数据政策。
- 新页面复用旧 scaffold 的直接导航模式，可能重新引入真机重复导航、无反馈或 hit-testing 风险。
- 未先冻结 V1.1 Android baseline 就开发 V1.2，会降低回归定位能力。

## 34. Next Recommendation

1. 项目负责人先审批本分析中的 15 项产品决策。
2. 按 Option A 完成 V1.1 G0、Android 17 人工 Gate 和 V1.1 Final Freeze。
3. 下一份文档优先冻结 `INSTITUTION_LIST_DETAIL_V1_2_INTEGRATION_CONTRACT` 的 canonical identity 前置条件，再冻结 `INSTITUTION_CONTRACT_V1_2`/CareProcess。
4. 在任何 production code 前依次冻结 Consultant、Appointment/Visit、Evaluation、Permission/Privacy 和 AI Support/Context Contract。
5. 保持 Recommendation V2 业务 diff 为 0，并在首个 V1.2 实现阶段增加专用 isolation gate。

完成本分析后停止；不自动进入 V1.2 implementation、Backend 或 Android Gate，也不自动提交 Git。

## 35. Final Product Decision Note

项目负责人已接受本影响分析。以下决定覆盖本文件中对应的“建议”或“待批准”状态；其余尚未获批的细节继续保持 `PRODUCT_DECISION_REQUIRED`。

```text
PRODUCT_V1_2_CHANGE_IMPACT_ANALYSIS = ACCEPTED
V1_1_FINAL_FREEZE_SEQUENCE = OPTION_A
V1_2_RECOMMENDATION_V2_CHANGE = FORBIDDEN
INSTITUTION_CONTRACT_V1_2_SUCCESSOR = APPROVED
INSTITUTION_CAPABILITY_V1 = UNCHANGED
VERIFICATION_LEAD_V1_2_MVP = FUTURE_OPTIONAL
PUBLIC_INSTITUTION_RATING_V1_2 = DISABLED
CARD_DETAIL_NAVIGATION = DEVELOPMENT_BLOCKED
INSTITUTION_LIST_NAVIGATION = DEVELOPMENT_BLOCKED
```

`OPTION_A` 的正式顺序为：

```text
V1.2 Change Impact Analysis
  -> V1.1 G0 Integrated Freeze Readiness Audit
  -> Android 17 Final Gate
  -> V1.1 Runtime Final Freeze
  -> V1.2 implementation
```

### 35.1 CareProcess dual-axis constraint

后续 V1.2-A Contract Proposal 必须延续 Institution V1.1 的双轴模型，不得把事实值/可用性与核验状态混入同一 enum：

```text
FACT_VALUE / AVAILABILITY
  !=
VERIFICATION_STATUS
```

- `available / unavailable / unknown` 属于事实值或 availability axis。
- `verified / unverified / expired` 属于 verification axis。
- PRD 在 `careRecordAvailability` 候选栏中的混合表述只作为产品意图输入，不得直接复制成最终 stable value enum。
- 每个 CareProcess 关键字段必须分别保存其业务事实/availability 与 `verificationStatus`/evidence；`unknown`、`unavailable`、`false` 仍不得互相替代。
- 具体 TypeScript shape、stable code、validator、migration 和 persistence mapping 留待 V1.2-A Contract Freeze 决定；本决策不授权任何 production code 修改。

本 docs-only baseline 之后应停止，并按 `OPTION_A` 进入 V1.1 G0；不得直接开始 V1.2-A。
