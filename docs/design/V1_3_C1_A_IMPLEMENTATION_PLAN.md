# V1.3-C1-A 初步参考推荐实施规划

日期：2026-10-26（北京时间）  
`STATUS = PLAN_COMPLETE / CODE_NOT_AUTHORIZED`  
`READY_FOR_C1_A_CODE_AUTHORIZATION = YES`  
`CODE_CHANGED = NO`  
`DOC_IMPACT = AUDIT_ONLY`

结论：可以在当前 B1.2.6 工作区中，以独立、版本化的方式实施 C1-A。建议仅新增 **5 个 TypeScript 文件、1 个测试 fixture 文件、2 个自动化脚本**；不修改旧 V2 evaluator、旧应用入口、页面、真实目录、package.json 或 build 脚本。当前交付仅是本规划文档，以下新增文件、函数名、类型和命令均为拟实施项，尚不存在、未执行。

## 1. 基线、权威依据和未提交成果

| 项目 | 本轮读取结果 |
|---|---|
| 实际工作区 | `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4` |
| BASELINE_BRANCH | `codex/v2-1-b1-2-4-card-actions-visual` |
| BASELINE_COMMIT | `7ae07b9b78e4502940fd9812c6a838e4ddf2cc06` |
| 开始时 git status --porcelain -uall | 42 个 tracked 修改路径、1035 个 untracked 文件；数量来自本轮，未沿用前轮计数 |
| 内容 diff 补充 | `git diff --name-only` 为 41 个路径；状态标记数与内容 diff 数分开记录，不据此清理任何文件 |
| 规划文件路径 | 本轮开始不存在，无既存报告被覆盖 |
| B1.2.6 验收 | Owner 已确认体验版 `1.2.6-demo.1025.0039`；本轮未复测 |
| 产品／技术阶段 | 产品六项决策确认；C1 Frozen；文档同步完成；C1 未实现；新测试 NOT_RUN；C2 OPEN |

先读 [产品入口](../product/README.md)，再读 [独立 C1 Frozen Contract](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md)。C1 新通道以独立契约 §1–9、§11 为准；旧 V2 继续使用 [Recommendation V2](../architecture/RECOMMENDATION_CONTRACT_V2.md)、[Rule V2](../architecture/RECOMMENDATION_RULE_CONTRACT_V2.md)、[ElderProfile V2](../architecture/ELDER_PROFILE_CONTRACT_V2.md) 及 [Institution V1.2.1](../architecture/INSTITUTION_CONTRACT_V1_2_1.md)。早期建议中的宽泛服务范围／未冻结状态不覆盖现行 C1，差异见 [同步审计](V1_3_C1_DOCUMENT_SYNC_AUDIT.md)。Assessment 仍为 32 个稳定题目、26 必填。

按目标工程 [Agent Engineering V2.1](../agent/README_AGENT_ENGINEERING_V2_1.md) 定向读取；主会话拥有组合、证据与集成规划，一个只读 explorer 核查 fixture 和 NAV 风险。未委派实现或独立 QA，未扫描全库业务正文。实际模式目录为根目录 `modes/`，不存在 `miniprogram/modes/`；根目录 `miniprogram/runtime/` 是现有运行边界。

本轮以 2106 个既存 Git tracked/non-ignored untracked 文件的集合与内容聚合指纹作保护基线；结束再次比较，排除唯一新增的本报告。所有原有 UI/UX、Demo、脚本及文档成果均保留。

## 2. 实际代码结构与接入点

下表行号对应本轮读取时的工作区源码，链接只指向实际存在的文件。

| 实际文件／位置 | 当前行为 | C1-A 使用方式 |
|---|---|---|
| [recommendation-preview-v2.ts](../../miniprogram/services/recommendation-preview-v2.ts) 第 221、224–315 行 | createRecommendationPreviewServiceV2 注入 draftSource 与 V11 Catalog；先派生合法 Profile，后 loadCatalog；buildResultSnapshot 构建完整旧应用快照 | 原函数作为 factory 参数传入新入口；只调用 buildResultSnapshot(T) 一次，不先 build 再 buildResultSnapshot |
| [recommendation-result-application.ts](../../miniprogram/services/recommendation-result-application.ts) | 原 V1/V2 dispatch，旧页面及历史消费联合类型 | 保持不变；C1-A 不给旧 version=2 混入新包络，不自动迁移 V1 |
| [institution-catalog-v1-2-1.ts](../../miniprogram/services/institution-catalog-v1-2-1.ts) 第 95、228、246、285 行 | 完整 V121 校验、Provider service、V121→V11 投影和 V11 service adapter | 直接复用，保留 V121 详细错误与 currentPointers；adapter 在一次 build 内读取已捕获的 V121 结果 |
| [core-v2.ts](../../miniprogram/domain/recommendation/v2/core-v2.ts) 第 627–642、762–799 行 | 每机构先算 Frozen Safety，即使 readiness blocked 仍有 candidateEvaluations；原卡片／Conditional 选择与排序 | 只消费结果，不修改、不直接重写 deriveRecommendationSemanticsV2 |
| [core.ts](../../miniprogram/domain/recommendation/core.ts) 第 327–380 行 | evaluateFrozenSafetyCore 产出逐条 constraint、精确机构／revision 和证据引用 | C1 读取旧 constraintResults；不再次调用来发明另一份冲突结果 |
| [recommendation-result-v2.ts](../../miniprogram/types/recommendation-result-v2.ts) | 完整 RecommendationResultApplicationSnapshotV2 包括 preview、display、advisories、sourceContext、source | 原样嵌入 legacyV2，不缩减为 semantics 或卡片列表 |
| [institution-v2.ts](../../miniprogram/domain/recommendation/v2/institution-v2.ts) 第 110–166、233–265 行 | manifest 保留 matching/extension/evidence；房间按稳定 roomId 处理，但证据定位仍为原 revision 数组 index | 精确关联 manifest；不重排原 rooms 后套用旧 index |
| [verification.ts](../../miniprogram/domain/institution/verification.ts) 第 19–73 行 | isVerificationCurrentAt 验证 T、核验时间、证据 ID 和有效期；不负责完整 evidence binding，也不检查业务 asOf | 前置原 Validator 后复用时间函数；新 sidecar 另检查 asOf，不改旧 helper |
| [institution-display-projection-v11.ts](../../miniprogram/services/institution-display-projection-v11.ts) | displayFact 只保留 availability/value/effectiveVerification；月费扁平化 | 仅作展示；不能作为新匹配的完整事实源，缺 regionCode、asOf、原 verification 和完整来源闭包 |
| [result-v2-view-model.ts](../../miniprogram/pages/recommendation/result-v2-view-model.ts) 第 386–417、426 行 | 旧 VM 的 nearMatches fallback、Conditional 和 no_safe_recommendation 状态 | 生产 C1-A 不依赖 pages；测试用原 VM 做旧状态 parity oracle，页面文件不改 |
| [assessment-draft.ts](../../miniprogram/store/assessment-draft.ts) 第 291 行及文件尾 | 单例构造调用 readInitialDraft，可能读取存储、触发旧草稿迁移 | 新 service 不运行时导入旧 preview service／store；以依赖参数接收旧 factory，避免新模块导入副作用 |
| [build-run-mode.mjs](../../scripts/build-run-mode.mjs) 第 40、49–55、77、92 行 | 构建期替换数据 Provider、核验 resolver、Demo guard 和 runMode；没有 query/storage 模式切换 | 保留既有构建机制；C1-A 无模式切换模块，不修改 build |

## 3. 分层方案与最小调用流程

三个主要模块：A1 `ReferenceInstitutionFactsV1`、A2 `InitialReferenceEligibilityPolicyV1`、A3 `ReferenceCompositionV1`。应用层只负责捕获输入、单次加载、错误映射和调用顺序。

```text
新的 createInitialReferencePreviewServiceV1(dependencies)
  → 捕获一次 Draft，保留原值的脱离外部引用副本
  → 请求内 capture-once V121 Catalog service（此时尚不加载）
  → createLegacyV2Service({capturedDraft, V11Adapter(capture-once service)})
  → 原 buildResultSnapshot(T)：先合法 Assessment/Profile，再加载 Catalog
      → 原 V121 Validator → 捕获合法 V121 → 原 V121→V11 投影
      → 原 V2 evaluator → 完整 legacyV2
  → 核对 T / dataset / mode / manifest / source identity
  → 有原可展示组：LEGACY_V2_DISPLAY，参考数组为空
  → 无原可展示组：A1 白名单投影 → A2 原冲突 + C1饮食否决 + 普通依据
  → A3 聚合 → 类别数降序 / institutionId ASCII升序 → 最多3家
```

新 service 的必要依赖拟为：`draftSource`、`institutionCatalogV121`、`expectedDatasetMode`、`createLegacyV2Service`。后者的函数签名复用现有 RecommendationPreviewServiceDependenciesV2／RecommendationPreviewServiceV2 类型，**仅 type import**；C1-A 文件自身不 runtime import 旧 preview service。实际调用方传入现有 createRecommendationPreviewServiceV2，测试传同一原 factory。原 catalog adapter 可运行时复用，它构造 service 本身不读 Provider。

不新增默认单例、不从 store 读取第二次、不调用默认旧应用入口。C1-B 将来负责在可信模式边界组装这些依赖并改页面接线；本阶段只有显式 factory 和自动化调用，因此 C1-A 完成后当前页面不会自动出现参考卡。

`capture-once` 是每次 build 内的局部 Promise 与结果，不是全局 cache。首次请求原 V121 service 时创建 Promise，后续只读同一个结果；拒绝或失败也不重试读取“最新目录”。不同 build、并发请求相互隔离，取消／重试是新调用。原 adapter／投影可重复执行纯验证，这不等于 Provider 多次读取。测试同时统计原 Provider、V121 service 调用数；合法输入每次各一次，问卷不合法均零次。

T 由 `build(evaluationAsOf)` 显式传入，不读 Date.now/new Date；旧引擎、sidecar、证据判断及新包络使用相同原始 ISO 字符串。不要为了比较而改写 legacyV2 中时间字符串。非法 T 保留旧 INVALID_EVALUATION_AS_OF 原因，不用“无候选”代替。

## 4. 文件实施清单（全部为未来新增）

下列路径均相对于目标工作区；未发现同名既存文件时才允许新增，实施开始仍需再次检查。既有文件的修改计划为 **0**。

| 分组／拟路径 | 新增／修改 | 具体职责与现有依赖 | Frozen V2／既有未提交修改 | R 向量 | 风险 |
|---|---|---|---|---|---|
| Reference Types：`miniprogram/types/initial-reference-v1.ts` | 新增 | 独立版本、依据、投影、诊断、结果包络、错误和 service port；type-only 复用 Institution/Catalog/V2 snapshot 类型 | 引用旧类型，零修改；新路径无重叠 | 全部 | 中 |
| Institution Facts Projection：`miniprogram/domain/recommendation/initial-reference-v1/institution-facts.ts` | 新增 | A1 最小原始事实、时间状态、绑定证据和指针；复用 verification/primitives 与原 Institution 类型 | 不改 Validator／旧投影；新路径无重叠 | R01–05、R08、R09、R11、R12 | 高 |
| Eligibility Policy：`miniprogram/domain/recommendation/initial-reference-v1/eligibility.ts` | 新增 | A2 三类封闭 comparator、原冲突与两条 C1 饮食否决、风险保留；读取 legacy candidate/snapshot 和 A1 | 不新增 MatchTier，不改旧 nutrition；新路径无重叠 | R01–05、R07、R08、R11、R12 | 高 |
| Result Composition：`miniprogram/domain/recommendation/initial-reference-v1/composition.ts` | 新增 | A3 严格 join、旧组优先、旧状态摘要、排序、唯一机构、MAX_3；可复用 compareAsciiV2/copyDomainDataV2 | 旧数组只读，zero in-place sort；新路径无重叠 | R06–10、R12及全量oracle | 高 |
| Application Entry Adapter：`miniprogram/services/initial-reference-preview-v1.ts` | 新增 | 新 factory；一次 Draft／Provider／T、原 V11 adapter、依赖注入的旧 factory、错误分类；不接页面、不保存 | 复用原 factory，不改旧默认入口；新路径无重叠 | 全部，重点 R06、R09、R10、R12 | 高 |
| Test Fixtures：`scripts/fixtures/initial-reference-v1-fixtures.mjs` | 新增 | 合法 V121 current Catalog、完整 Draft、证据重绑、archive 测试侧样本、固定 T、Provider计数、隔离 runtime 组装 | 不改原 fixtures 或真实数据；新路径无重叠 | 全部 | 中 |
| Domain Runtime：`scripts/check-initial-reference-v1-runtime.mjs` | 新增 | A1/A2/A3 单元及关联边界、固定 manifest；复用 WeChat TS loader，覆盖类型检查和纯函数不变性 | 保留旧 expected/oracle；新路径无重叠 | R01–05、R07、R08、R11 | 高 |
| Application Runtime：`scripts/check-reference-composition-v1-runtime.mjs` | 新增 | 真实旧 factory + 新 wrapper 集成、单次加载、同 T、旧 VM parity、错误和模式隔离 | 不修改旧导航脚本；新路径无重叠 | R06、R09、R10、R12，兼跑全量包络oracle | 高 |

不需要新框架、依赖或 barrel 文件；新测试直接用 `node scripts/...mjs`，无需修改 package.json。若实际编码发现必须改清单外旧文件，应先说明必要性及兼容影响，不把扩大范围藏入实现。

**冲突敏感路径**：已有未提交 `miniprogram/pages/recommendation/result.ts/.wxml/.less`、`pages/assessment/profile.*`、AI 页面、预约页、组件及 Demo story/record 文件都不在 C1-A 清单。C1-B 将来接线会碰 result.ts，因此届时应基于实时内容增量修改，不从 HEAD 恢复。当前已修改的两个旧业务检查及 demo-story-composition 也不触碰。

## 5. A1：证据、核验和版本投影

合法入口必须先经过原 validateInstitutionCatalogPayloadV121／createInstitutionCatalogServiceV121；types 的强制转换不能代替运行校验。原 validator 第 111–164 行已经保护 provenance、唯一机构、唯一 pointer 和精确 revision；V121→V11 投影第 246 行及 record projection 会再次本地校验，继续保留。

每个 `ReferenceInstitutionFactsV1` 至少包含：institutionId、recordRevision、recordProvenance、recordStatus、datasetVersion、datasetMode、evaluationAsOf、精确 currentPointer，以及以下字段的最小事实槽：

- `identity.regionCode`。
- `price.referenceMonthlyPrice`，完整原始 basis/range/CNY/amountMinor/period/asOf。
- `rooms[].roomType`，保留 roomId 和原 revision 的 `rooms.<index>.roomType` locator。
- `meal.mealSchedule`、`meal.easyChewSupport`、`meal.modifiedFoodSupport`。

槽位保留 raw availability/value、asOf、原 verification/status/verifiedAt/validUntil/evidenceIds、T 下的可用判定及精确 evidence 快照。证据白名单保留 institutionId、recordRevision、fieldPath、valueSnapshot、evidenceId、sourceType、合法来源引用及核验时间；不复制整个机构记录或无关联系方式、Geo、简介。旧 V2 manifest 已有大部分证据，但裁掉 sourceReference/sourceNote 且没有全部业务 asOf；不能从 display 或标签反推这些值。

复用 isVerificationCurrentAt 只能发生在完整记录校验之后。A1 逐字段以 evidenceId 找同记录 evidence，核对 ID/revision/path/valueSnapshot/status/time/sourceType；任何闭包丢失或跨 revision 都整体 DATA_ERROR，不降级 UNKNOWN。普通合法 unknown/unavailable/unverified/expired 则保留原状态，不制造非法数据错误。不要把 resolveEffectiveInstitutionField 返回的统一 unknown 当成唯一诊断模型。

正向依据须 provided + 当前核验 + verifiedAt≤T + validUntil≥T（等号有效）；字段有 asOf 时 asOf≤T，费用必须有合法 asOf。缺失／未来 asOf 不提供正向依据，不能改旧 helper 让旧 V2 输出跟着变化。对饮食明确不支持也使用当前证据；存在未来 asOf 时不能声称是 T 时的已知否定。observedAt 合法性沿用 Validator，不另造自由文本来源解析规则。

合法非 published current record 按原 manifest 排除，不计参考、不要求其有 candidate evaluation；published/included 记录必须精确命中旧 candidate。C1 不按最大 revision 找 current，不跳过坏记录，也不使用 presentation.displayOrder 排参考。

## 6. A2：资格、依据与两条饮食否决

固定顺序为：合法问卷 → 合法全池 → 原 V2 → 旧组检查 → 精确关联 → 原关键冲突 → C1 饮食否决 → 普通依据 → 保留风险。旧组非空时短路，不计算参考资格来凑数。

原 conflict 或 INELIGIBLE 直接排除 C1。不能用 matchTier=null、rankTuple=null、UNVERIFIED 或 blocked 推断“无冲突”；旧 candidate 的 constraintResults 仍必须读取。关联缺失不是无冲突，而是 DATA_ERROR。

两条新增否决只在 `eligibility.ts` 的 C1 fallback 路径实现：

1. legacy elderSnapshot.nutrition.foodTextureSupport 为 known easy_chew，A1 对应 meal.easyChewSupport 为当前核验 provided/value=unavailable → REFERENCE_FOOD_TEXTURE_UNSUPPORTED。
2. known modified_food 对应 meal.modifiedFoodSupport 同条件 → 同一排除码，保留不同 field/evidence 引用。

老人 standard／未知／待确认不会推导另一种需要；吞咽线索不推导鼻饲。机构 raw availability=unavailable + value=null 不等于 provided + value=unavailable；unknown、requires_inquiry、未核验／过期 unsupported 不当当前明确冲突。保留待核实提示。原 core-v2 nutritionFor、MatchTier、Safety Core 及 Rule V2 的饮食差异语义不改。

| 类别 | 新策略精确判定 | 诊断边界 |
|---|---|---|
| AREA | snapshot.preference.region 为 institution_region；稳定 regionCode 与当前可信机构 code 完全相等 | no_preference 为 NOT_APPLICABLE；缺可信机构区划为 UNKNOWN；有效不相等为 NOT_MATCHED，普通差异可与其它匹配共存 |
| BUDGET | 唯一使用 reference_total/bounded/month/CNY、安全整数且 0<min≤max 的当前月费；与冻结预算区间相交：Imax≥L 且 U无上界或Imin≤U | 闭区间边界相接算匹配；cny_15000_plus 用 L=1500000分、U=null，不写 Infinity；unknown 不比较 |
| BASIC_SERVICE | single/double/triple_or_more 对 single/double/multi_bed；或明确餐次 code 精确相等 | 房型和餐次同时成功只算一类；空 rooms/未列所选房型不推断不提供；suite/other不映射；更多餐次不自动包含更少 |

预算其余稳定区间为 350000–500000、500000–800000、800000–1200000、1200000–1500000 分，按 Frozen C1 表固定。不能调用旧 V2 budgetFit 代替新 comparator：旧开放预算等语义必须继续保持。

合法 starting_at、过期价格、仅首月备注、单项收费／押金不会提供 BUDGET。若把 basis=first_month、period=one_time 或缺 max 的 bounded 塞进只允许常态参考月费的字段，这属于非法 schema，必须整池 DATA_ERROR，不能伪装成合法 UNKNOWN。首月说明的合法 fixture 应放已有备注，月总价 unknown，不解析文案。

每类输出 MATCHED/NOT_MATCHED/UNKNOWN/NOT_APPLICABLE、elder/source refs 和诊断；至少一类 MATCHED 才 eligible。不计 activity、supportedTypes、护理、VR、床位、医疗文案。老人风险、全部 clarifications、机构相关未知 constraint/evidence 独立保留，不能只复制前三个 warning，也不能当扣分后隐藏。

## 7. A3：旧 V2 保护、严格关联、排序与结果

`legacyV2` 为原 buildResultSnapshot 返回的完整 RecommendationResultApplicationSnapshotV2；原 preview、source、institutionDisplays、operationalDisplayAdvisories、sourceContext 原样复制，不向旧 cards 塞参考，不更改任何字段。输入采用脱离外部引用的快照；新层不对原数组 sort/splice，不在旧对象上附加 C1 字段，不 freeze 传入者所有的对象。

关联键使用 `institutionId + recordRevision`；同时核对 datasetVersion/mode/T、recordProvenance/status、唯一 manifest、disposition、currentPointer、candidate、display 和证据引用。先检查重复，再建 Map；不能让 Map 覆盖丢掉重复来源。每个 published/included 机构须恰好一个 candidate，candidate 下 constraint/ref 也须同 identity 与 revision；缺失／多份／错版/伪造 evidence 是 DATA_ERROR。不通过再次 evaluateFrozenSafetyCore 补齐缺项，不静默跳过关联失败的机构。

旧可展示组规则严格镜像现有 VM：readiness 不 ready 时旧组为空；ready 时优先 semantics.cards，否则使用合法 noExactMatch.nearMatches；同时保留原 conditionalCandidates 的原行为。正常 oracle 下 core 已确保这些组合法互斥；不遍历 candidateEvaluations 自行提升 Exact/Conditional，也不把显示组重新排序。

`composition.ts` 内小型纯函数可形成只读 legacyPresentationState 摘要（ready_exact / ready_soft_near / ready_conditional / no_safe_recommendation）。**不 runtime import pages**；集成脚本调用原 createRecommendationResultViewModelV2，对相同 legacyV2 验证 state parity，尤其 blocked、nearMatches fallback 和 Conditional。若真实运行输入发现超出原 VM 行为的情况，保留诊断，不自行重新定义旧状态。

| 新组合状态 | 行为 |
|---|---|
| LEGACY_V2_DISPLAY | 旧可见组非空；referenceEvaluations 不执行、displayedReferenceCards=[]；旧数量顺序完全保留 |
| INITIAL_REFERENCE_ONLY | 旧组空且参考至少一张；1–3 家；legacyPresentationState 仍可为 no_safe_recommendation |
| NO_PERSONALIZED_CANDIDATE | 合法非空池两组均无候选；保留目录目标，说明依据不足／已知冲突，不声称全武汉不适合 |
| DATA_ERROR | Catalog、schema、pointer、mode、projection或关联非法；无部分候选，保留原详细 cause/index/path |
| SERVICE_ERROR | Provider 拒绝／不可用；可重试，不能冒充无候选 |

问卷缺失、Draft 读取失败、版本不支持继续返回原 Assessment/Profile error，不硬塞入五种成功／技术状态。V1 输入留给旧 dispatch，不在 C1 迁移。空 Catalog 沿用旧 buildResultSnapshot 的 NO_INSTITUTIONS_AVAILABLE 错误；C1 的 NO_PERSONALIZED_CANDIDATE 明确仅适用于合法非空池。

错误模型用 discriminated union：成功值必须有完整 legacyV2；失败保留 error/domainCause。旧 V2 尚未成功时 legacyV2 必须缺省，禁止伪造空快照；旧 V2 已成功但 C1 join 失败时可只读附带该真实 legacyV2 作诊断，仍不显示部分卡。旧 V121 原始错误在 adapter 映射前捕获，不能丢成笼统 provider failure；仅真正 Provider 故障映射 SERVICE_ERROR。意外 evaluator／投影异常保留 phase 与诊断并中止，不 catch 后返回空名单。

参考先按 institutionId 聚合合法多条依据，`basisCategories` 是固定类别去重集合，数量为 1–3；之后对新数组按 `(-categoryCount, institutionId_ASCII)` 排序再 slice(0,3)。可只读复用 compareAsciiV2，禁用 localeCompare／中文名／数组原顺序。机构 ID 已经由原 stable identifier 规则限制为 ASCII。非法重复 current 记录先由 Validator 整体拒绝，聚合不能“修好”非法目录。

## 8. C1-B 消费的数据契约

下面是新文件计划中的结构，不是对 Frozen V2 的字段扩充。版本常量固定为 C1 契约：kind=`reference_composition_v1`、policyVersion=`initial-reference-policy-v1`、compositionVersion=`reference-composition-v1`。

成功包络应提供：

- 完整 legacyV2、legacyPresentationState、组合 state、evaluationAsOf、source/version/datasetMode。
- `displayedReferenceCards` 的已排序只读数组；每张显式 category=INITIAL_REFERENCE，institutionId/revision/provenance、当次公开展示快照引用。
- `basisCategories`、逐项 referenceReasons（类别、精确比较值、elder refs、field/evidence refs、A0/B0/S0 语义）。
- 独立的 elderRiskFacts、elderClarifications、requirementReadiness、institutionCapabilityUnknowns、ordinaryDataGaps；保留原值与 K0、W0/L0/M0/D0 等提示语义，不扁平化成 supported 布尔。
- `publicDetailTarget={institutionId,recordRevision,routeSource:direct_link}` 纯描述；C1-B 依据当前快照验证卡片后使用既有 serializeInstitutionDetailRoute。C1-A 不调用导航、不注册旧 recommendation sourceContext、不暴露自动联系动作。
- 目录入口可用性和无候选原因；DATA_ERROR/SERVICE_ERROR 的 cause 应与普通空态分开。

不增加 elderId、assessmentId、CompletedAssessment、保存回执、真实账号授权或持久化；只保留原 source 的 Preview 身份，不额外传递完整 32 题或姓名／电话。只在内存持有必要最小风险和证据；日志仅 case/code/path，不打印完整 Profile、健康答案或来源中的个人信息。

C1-B 后续负责标签、风险可读、独立 handler、单动作 guard、迟到导航、320/375/430px 与 150% 字体及 Android。A 阶段输出结构不能被误报为这些 UI 验收已通过。

## 9. Fixture 与 oracle 统一规则

固定 `T=2026-10-26T04:00:00.000Z`。所有 R 正例从原 V121 fixture／已校验 current mock Catalog 构造，完整通过原 Validator，再经原 V121→V11 投影运行旧入口；不是给 policy 塞假 typed 对象。

可复用 [institution-v1-2-1-fixtures.mjs](../../scripts/fixtures/institution-v1-2-1-fixtures.mjs) 第 85、95 行 makeValidInstitutionV121/makeEvidenceField，[catalog-integration-fixtures](../../scripts/fixtures/institution-v1-2-1-catalog-integration-fixtures.mjs) 第 233–243 行 cloneCatalogForMutation/makeCurrentIdentity，以及 [elder-profile-v2-fixtures](../../scripts/fixtures/elder-profile-v2-fixtures.mjs) 第 40、62 行 makeV2Answers/makeAssessmentDraftV2。新 helper 只在 scripts/fixtures 中，对字段、source、verification 和 revision 做成套绑定；替换字段先清掉原绑定证据，防止悬挂 evidence。

应用 Mock 的 V121 current #2 目录亦可作为合法底座（[mock catalog](../../miniprogram/mock/institution-catalog.mock.ts) 第 729–869 行）。[recommendation-v2-fixtures](../../scripts/fixtures/recommendation-v2-fixtures.mjs) 第 167 行的 makeV2InstitutionPool 从 V1.1 构造，只能作旧 oracle 参考，不能直接当成 V121 输入。旧 fixture 内各自日期不可直接沿用到新 C1 的过期／未来边界，需要显式重设并重绑。

统一断言 `O`（每个获得 legacyV2 的分支）：用相同捕获 Draft、同一 T、相同 V121→V11 全池，**独立调用原 factory 的 buildResultSnapshot** 得 oracle，规范化跨 VM 数据后 assert.deepStrictEqual；比较完整快照、readiness、五种 tier、Exact、priority/rank、候选顺序、所有风险／证据和 NO_EXACT_MATCH。不能把 wrapper 自己的 legacyV2 当 oracle，也不修改旧 expected。原输入深拷贝前后相等，并对冻结副本执行；新结果随后操作也不能污染原对象。

统一断言 `Z`：新 C1 模块导入和 build 期间，注入的登录、真实存储、电话、位置、预约、支付、wx.request／上传及其它网络端口调用数为零（throw-on-call + 计数）。旧 factory 在测试 VM 内预先以隔离内存宿主加载，原 store 初始化不访问用户设备存储；其导入初始化计数与 C1 build 计数分开，不能用它掩盖 C1 调用。新 C1 模块独立导入时不得连带旧 store 初始化。

错误用例没有成功 legacyV2 时，不伪造 deep-equal 断言：独立 oracle 应产生对应原失败，断言 cause 保留、输入不变、没有局部参考、Z、读取次数和阶段。旧成功后注入关联损坏的 case 必须保留其原 legacyV2 且与成功 oracle 相等，再拒绝新组合。

## 10. R01–R12 完整实施验收计划

脚本归属：`D=check-initial-reference-v1-runtime.mjs`，`A=check-reference-composition-v1-runtime.mjs`。全部 `NOT_RUN`。下表是每组最低分支，并非只做十二个快乐路径断言；每个成功分支均适用 O/Z，每个错误分支适用上一节的错误 oracle 规则。

| 向量／脚本 | 输入构造与 fixture | 预期状态／依据／排除 | 必测错误和边界 |
|---|---|---|---|
| R01 D+A | 一家 published/current、所需护理全部 unknown；Draft 明确选汉阳；机构已核验区划相同，预算/房型/餐次无偏好 | INITIAL_REFERENCE_ONLY，一张 AREA；相关能力未知、风险均保留，原 tier不提升 | 无明确选区/默认武汉不计；合法不同区不计AREA但不作关键冲突；区划未核验/过期不计；非法证据整体错误 |
| R02 D+A | 已报告偶尔吞咽不顺、饮食支持unknown；用户明确月预算、机构合法 bounded reference_total month 与之重叠 | INITIAL_REFERENCE_ONLY，BUDGET；原 readiness 可 blocked，吞咽提示不丢，不声称提供吞咽照护 | 不自动推导tube_feeding；与吞咽无关的普通依据不能抹去警示；无价格依据则无参考 |
| R03 D+A | 明确需要防走失支持、当前有效 unsupported；另做 known easy_chew + 对应 provided/unavailable，以及 known modified_food 对应版本 | 目标机构被否决；若池中无其它参考则 NO_PERSONALIZED_CANDIDATE；饮食码 REFERENCE_FOOD_TEXTURE_UNSUPPORTED，旧冲突保留原码 | 区域/预算全匹配也不能抵消；同证据过期/未来核验、不明确所需、requires_inquiry、raw unavailable分别对照；R06另证旧V2饮食行为不变 |
| R04 D+A | 用合法答案组合形成情绪、吞咽和ADL多项澄清，AREA合法 | INITIAL_REFERENCE_ONLY，AREA；全部 clarification/known risks 保留，旧 blocked 不变 | unknown是合法回答但非正常；无论warning数量多少不截断；不能改ADL/careLevel来得到正例 |
| R05 D+A | 合法主体、名称、地址/图片存在，但用户没有明确区域、价格unknown、无可信房型/餐次对应 | NO_PERSONALIZED_CANDIDATE，依据空，只留目录目标 | 地址存在、机构名带区名、VR、默认武汉均不得成为依据；合法未核验与非法证据分开 |
| R06 A | 三个独立子例：旧V2恰好一张Exact、SoftNear、Conditional；另有符合AREA的机构 | LEGACY_V2_DISPLAY，原一张原序；参考空，policy不执行 | 加入当前饮食不支持但仍属旧合法卡的对照，证明新否决未倒灌；缺必填问卷Provider读0；V1不被C1迁移 |
| R07 D+A | 四家护理unknown，普通类别数3/2/2/1；两个2类机构ASCII ID相反于输入顺序 | INITIAL_REFERENCE_ONLY，前三；3类优先、2类按ASCII；房型+餐次同时满足只计BASIC_SERVICE一次 | 24种records排列，pointer关联仍精确，输出恒定；no_preference/空rooms/suite/other/更多餐次不自动匹配；输入与旧排序不变 |
| R08 D+A | 测试侧独立archive#1，Catalog只含同机构current#2、完整重绑#2证据及pointer；多种普通依据聚合 | 一张current#2参考，所有display/refs都是#2；不借#1能力或价格 | 双revision同入current Catalog→DUPLICATE_CURRENT_INSTITUTION_ID；错误pointer/#3、跨revision evidence、重复／缺失candidate或manifest、后投影缺关联→DATA_ERROR |
| R09 A | 一条合法记录+一条schema非法记录；Provider分别reject及返回PROVIDER_LOAD_FAILED | 非法全池DATA_ERROR；Provider故障SERVICE_ERROR；无合法条目的局部返回 | 原code/index/path保留；一次调用不自动重读；unknown合法字段与非法schema不混同；空池保留旧NO_INSTITUTIONS_AVAILABLE；意外异常不可降为空名单 |
| R10 A | 原VM no_safe_recommendation、原readiness blocked；两家AREA参考 | INITIAL_REFERENCE_ONLY；legacyPresentationState仍no_safe_recommendation，O验证原blocked/noExact | 原nearMatches fallback/Conditional/空态与VM parity；旧组非空时不得走新组；新层失配不覆盖原快照 |
| R11 D+A | 过期价、合法首月备注/月费unknown、默认武汉、starting_at、未来asOf；另构造相接闭区间和开放预算 | 无其它依据时前者NO_PERSONALIZED_CANDIDATE；合法边界/开放端为BUDGET参考 | T=validUntil有效、T超过不计；verifiedAt>T不计；预算unknown不比较；invalid first_month/one_time/缺bounded.max/非安全整数为DATA_ERROR；价格不重叠为NOT_MATCHED |
| R12 A | 从根modes/production构造当前正式Catalog及批准区划resolver；Demo合成目录独立；构建模式来源不互借 | 固定T复核11家：有明确区域时仅AREA；未明确区域时允许0参考。Demo全部保留MOCK_DEVELOPMENT_ONLY来源 | PRODUCTION expectedMode收到整包MOCK或混入Mock记录均DATA_ERROR，反向也拒绝；不通过改provenance造“生产正例”；Z断言所有真实副作用0，测试fixture不进Production |

R08 不是修改 Catalog 模型的授权：原 validator 对 records 内 institutionId 唯一，不能同时塞 archive/current。archive 仅为测试断言侧对象，不是新业务事实来源，也不参与生产投影。published/included candidate 缺失用新纯 composition 的损坏输入测试，不改旧 engine 造缺失结果。

R12 源级测试可复用 [check-capability-evidence.mjs](../../scripts/check-capability-evidence.mjs) 现有隔离临时源码树模式：只在 OS 临时目录按现有路径布局提供 miniprogram 与 production 模块、注入同一 approved administrativeDivisionResolver，再调用**原** Validator／adapter。不得更改真实目录、原 runtime 配置或 build 脚本，不用 permissive resolver。源码与实际构建 wiring 证据分开；临时目录只清理本测试创建且已核验绝对路径的目标。当前规划不创建该临时树。

## 11. 旧测试风险的处理

保留既有 [导航 Gate](../../scripts/check-institution-navigation-a0-4-interactions.mjs)，本轮不修改、不重跑、不把旧失败记作C1新失败。

| 分类 | 已知情况 | 实施时处理 |
|---|---|---|
| PRE_EXISTING_TEST_FAILURE / 旧预期差异 | NAV-019 第758–763行期待 onVrTap 包含 canOpenVr 阻断；当前 detail.ts 第394–403行允许进入VR状态页，资源未核实时仍不打开viewer；专用VR runtime 第47–51行区分二者 | 在同一工作区开工前保留实际基线结果；若仍失败按旧预期差异登记，实际业务是否违规仍按适用VR契约核对，不为C1改expected |
| TEST_HARNESS_DRIFT | NAV-024 的假Home宿主第159–215行没有挂载syncBrowseFont，却调用生命周期；真实 home/index.ts 第129–143行会调用该方法 | 后续单独维护harness或隔离字体同步依赖；不把异常当成已证实Home故障，更不能在C1-A顺手修 |
| C1_NEW_FAILURE | 新R向量失败、oracle发生变化、Provider多读、mode串用、side effect或新文件编译失败 | 阻断C1-A放行，先修新模块；不得通过修改旧V2预期或宽松Validator让测试通过 |

旧记录曾为8组检查7 PASS/1 FAIL；本轮仅核对源码形态，不宣称今日重跑仍是相同结果。旧Gate未绿就不能声称全项目PASS；领域C1-A验证与后续页面整体放行分开记录。

## 12. Demo／Production 隔离与接线边界

expectedDatasetMode 是调用方从可信构建组合提供的必填依赖，不从Catalog自身推断“当前模式”，不信任query/storage标记。原Validator检查mode与recordProvenance一致；新层再检查Catalog mode与expectedMode相等，阻止整包合法Mock被误注入Production。模式核对发生在原V121成功后、旧V2消费前，错误保留为来源数据错误。

正式运行只消费原Provider和当前已核验事实。当前11家/8区、费用/房型/餐次/能力缺正向证据来自已记录的只读探针；本轮未重跑数据探针。R12实施时从当前源码重新构造确认，不把旧dist当新产物，不把公开研究观察提升为护理verified。无明确选区且无其它证据时允许零候选。

Demo只使用明确MOCK来源及现有guard/内存适配；新纯领域不触wx、网络、持久化或身份。新service不导入Demo模块、不导入scripts fixture。现有build第49–55行替换旧Provider即可让未来接线继承数据来源，A阶段不新增另一套数据入口。C1-B再从既有构建注入runMode确定expectedMode并传入依赖；不用新运行时模式框架。

现有build按app/pages的require可达图收集打包模块；C1-A的新factory尚未接页面，因此双模式构建成功也不能证明线上C1已经执行。新脚本显式导入新entry验证行为；C1-B完成实际接线后再验证最终包体积、require graph、UI和真机。

## 13. 实施顺序与验证 Gate

本节命令均为将来获批后执行的计划；本轮没有运行。

1. **基线 Gate**：重新读取branch/HEAD/status及报告所列新增路径；保存既有文件内容指纹、已知旧失败。运行直接相关原命令：`npm run check:recommendation-v2-runtime`、`npm run check:recommendation-preview-v2-integration-runtime`、`npm run check:institution-v1-2-1-catalog-integration`。失败记录按上一节分类，不改旧expected。
2. **A1 Gate**：新增类型、最小投影和fixture；用原Validator验证所有合法fixture及错误fixture；重点验证asOf/证据闭包/revision/状态区分。测试脚本此时可逐步引入，不建单独框架。
3. **A2 Gate**：实现三类comparator和两条C1否决，先跑D脚本中的R01–05/R11，再跑R07/R08。不得等页面实现后才验证领域正确性。
4. **A3 Gate**：实现严格join、旧组优先、独立排序及新factory；A脚本覆盖R06/R09/R10/R12和全量O/Z。再全跑两个新脚本，固定case manifest防漏组。
5. **编译／兼容 Gate**：两个新脚本使用现有WeChat TS 4.1.2 loader；其中一个对5个新增TS入口及其依赖建createProgram，沿用strict配置与官方wx typings，noEmit或内存emit收集完整语义诊断，不只transpileModule。新输出作兼容语法检查，禁止class fields、外部runtime imports及额外polyfill假设。现有targeted compat脚本有固定路径列表，新文件不一定覆盖，不能仅报旧脚本PASS便宣称新文件已类型检查；在新脚本中补足，不改原脚本。
6. **回归 Gate**：新脚本全绿后重跑上述3个直接相关旧命令；补`npm run check:institution-v1-2-1-runtime`、`npm run check:recommendation-runtime`（共享Safety只读但需要确认兼容）、`npm run check:wechat-ts-targeted-compat`。同一组通过后不无故扩大或重复。输入错误、原V1 dispatch和无持久化由新集成脚本补断言。
7. **双模式工程 Gate**：C1-A代码验收按冻结契约保留`npm run build:production`、`npm run build:demo`以及对应JS兼容与`check:run-mode-package-size`/`check:run-mode-convergence`的计划；获批后使用现有受控生成目录构建，不手工删除dist。受DevTools TypeScript／Less安装阻断时记录具体缺项，不改依赖或编译器来绕过。R12源码隔离验证与构建产物验证分别留证。
8. **阶段停点**：仅C1-A领域/应用类型与测试完成，报告逐组状态；C1-B未开发、Android UI未验收、C2未实施，V1.3未整体完成。Git提交、上传、提审和发布不包含在此授权判断中。

运行拟新增命令：`node scripts/check-initial-reference-v1-runtime.mjs`、`node scripts/check-reference-composition-v1-runtime.mjs`。本轮未创建它们，`R01_R12_EXECUTION = NOT_RUN`。所有Gate须用当前源码，不通过旧dist或既有Demo体验版替代。

## 14. 风险、复杂度与阻断判断

| 风险 | 等级 | 可执行控制 |
|---|---|---|
| 旧V2被新资格倒灌／oracle不完整 | 高 | 独立类型/entry、旧文件零修改、完整snapshot deep-equal，独立旧factory oracle |
| Provider重复读取或并发共享 | 高 | 每build局部Promise捕获，同一T，计数／失败／并发fixture |
| display代替证据、跨revision借事实 | 高 | V121原校验+白名单sidecar，严格join，缺项整体失败 |
| 新否决误伤旧饮食语义 | 高 | eligibility fallback内唯一实现，R03/R06双向保护 |
| 直接导入旧service触发store初始化 | 中高 | 新entry只type import旧port，factory依赖注入；独立导入及build零真实副作用检查 |
| 假Fixture无法通过原Validator | 中高 | 用V121底座、整体重绑、固定T；R08 archive独立，非法schema单独预期 |
| 旧VM状态摘要漂移 | 中 | 新纯函数最小镜像，测试用真实VM parity，不向domain引入pages |
| 正式数据只能AREA、仍可能零候选 | 预期限制 | 不制造价格／服务依据；目录入口与初步参考明确分离 |
| 已有NAV失败／harness漂移 | 已知风险 | 保留失败身份，不归因未编码C1，不为A扩大页面修改范围 |
| 编译器／构建工具与产物不可达 | 实施验证风险 | 新文件全语义诊断、显式runtime导入；构建和最终页面可达性分阶段验证 |

`ESTIMATED_COMPLEXITY = MEDIUM_HIGH`：约4个可独立验收的小批次（投影／策略／组合与wrapper／完整回归与模式验证），涉及5个运行源码文件、3个测试文件。难点是证据／错误闭包与旧V2不变性，非算法规模；不提供未经实施验证的工时承诺。

`BLOCKERS = NONE_FOR_C1_A_AUTHORIZATION`：未发现需要Owner重新确定白名单、预算比较或饮食否决范围的新业务分歧。当前已有合法依赖注入、V121验证、V11投影和完整旧快照支撑独立接入。编译工具可用性、真实Provider计数、测试fixture和构建结果必须实施后证明，尚未PASS；若实现需要修改冻结契约、扩大文件范围或改变旧语义，应停止相关变化并列出最小影响。

C2身份／后端／数据库仍OPEN，但不是无持久化C1-A的前置阻断。C1-B页面/真实导航/Android不属于A验收范围；整个C1交付仍需后续UI和真机证据，不在A完成时提前宣布V1.3完成。

## 15. 本轮交付与授权结论

仅新增本报告；未修改业务代码、原测试、原契约、真实数据、package.json、build或dist，未创建C1实现。完成后校验本报告Markdown链接和围栏、拟文件路径无冲突，并比较既存文件集合／内容指纹。未执行业务测试／构建／DevTools／Android；没有Git暂存、提交、推送或微信操作。

`READY_FOR_C1_A_CODE_AUTHORIZATION = YES` 的含义：Owner可以基于本报告审阅并明确授权上述8文件的C1-A增量实现；**当前仍没有编码授权**。建议最小实施步骤为A1投影及合法fixture → A2封闭策略与C1否决 → A3组合和单次加载wrapper → R01–R12与旧oracle/模式Gate。保留旧默认入口，页面接线交给后续C1-B。

`NEXT = STOP_AND_WAIT_FOR_OWNER_CODE_AUTHORIZATION`。不自动启动C1-A、不生成下一阶段任务、不开始C1-B或C2。
