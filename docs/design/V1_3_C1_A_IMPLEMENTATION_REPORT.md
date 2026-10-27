# V1.3-C1-A 实施报告

> **2026-10-27 定向复验更新**：修正两份测试，不改 Frozen 契约或领域源码。R02 将机构饮食 fixture 改为 unknown，验证吞咽澄清/未决项保留且不单独阻断当前 V2 readiness，未知资料不提供支持证据，可信月费重叠仍形成 BUDGET。R10 改用合法的 `health.chewingAbility=unknown`，真实产生旧 blocked/no-safe，同时保留两张 AREA 参考；完整 legacy oracle 深比较继续通过。后续 R12 Demo 断言也改为保留其真实合法的 V2 候选，参考卡为零。
>
> 实际执行 `npm run check:c1:domain`、`npm run check:c1:composition` 均退出 0；组合检查为 **12/12 组、30 分支、24 种排列通过**，TypeScript 4.1.2 完整类型检查及 51 个传递模块的 ES5 内存输出检查通过，C1 真实副作用为 0。未重跑双构建或全仓测试。本轮完成的是 C1-A 定向自动化复验，可进入 C1-B 页面接入；尚无本轮 C1 页面、手机或 Owner 验收，也未实施 C1-B。
>
> **既有差异保留**：`RECOMMENDATION_CONTRACT_V2.md` §6 写吞咽风险未澄清时阻断；当前 `v2/profile-v2.ts` 的 `buildReadinessV2` 明确对 `nutrition.swallowingConcern` 设置 `blocksEligibility=false`，仍保留 unresolved/clarification。按本次授权保留两者，只修测试以准确覆盖当前规则及 C1 R02/R10；两组通过不等于这项 V2 契约/实现差异已解决。下文为 2026-10-26 的历史实施与验收记录，其中授权停点仅描述当时。

日期：2026-10-26（北京时间）  
`STATUS = C1_A_IMPLEMENTED_AND_VERIFIED`  
`READY_FOR_OWNER_CODE_REVIEW = YES`  
`OWNER_ACCEPTED = NOT_CLAIMED`  
`C1_B_AUTHORIZED = NO`；`C2_ARCHITECTURE = OPEN`  
`DOC_IMPACT = AUDIT_ONLY`（实施现有 Frozen C1；未改写原契约或产品索引）

本轮已实施独立的 C1-A 事实投影、资格策略、结果组合、应用 factory 和自动化测试。五个运行源码文件、三个测试文件及本报告全部为新增，既有业务文件修改为零。推荐页面尚未接线，不代表微信端已经显示参考卡；V1.3 整体未完成。

## 1. 基线与实际变更

| 项目 | 结果 |
|---|---|
| BASELINE_BRANCH | `codex/v2-1-b1-2-4-card-actions-visual` |
| BASELINE_COMMIT | `7ae07b9b78e4502940fd9812c6a838e4ddf2cc06` |
| 工作区 | `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-2-4` |
| 开始时状态 | 42 个 tracked 修改路径、1036 个 untracked 文件；Git 内容 diff 路径为 41，与 status 标记数分别记录 |
| 文档依据 | [产品入口](../product/README.md)、[Frozen C1](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md)、[已审阅实施规划](V1_3_C1_A_IMPLEMENTATION_PLAN.md) |
| 范围 | C1-A；没有 C1-B、C2、真实身份／数据库／保存 API、微信上传或 Git 提交 |

实际新增文件：

| 文件 | 职责 |
|---|---|
| [initial-reference-v1.ts](../../miniprogram/types/initial-reference-v1.ts) | 独立版本、事实、依据、资格决策、组合包络、错误和依赖接口；不扩展旧 MatchTier |
| [institution-facts.ts](../../miniprogram/domain/recommendation/initial-reference-v1/institution-facts.ts) | 原全池 Validator 后的最小白名单事实、时间和证据投影 |
| [eligibility.ts](../../miniprogram/domain/recommendation/initial-reference-v1/eligibility.ts) | 原冲突、C1 饮食否决及三类普通依据 |
| [composition.ts](../../miniprogram/domain/recommendation/initial-reference-v1/composition.ts) | 严格关联、旧组优先、风险保留、稳定排序和最多三家 |
| [initial-reference-preview-v1.ts](../../miniprogram/services/initial-reference-preview-v1.ts) | 单次 Draft/Provider 捕获、同一 T、注入旧 factory、错误分类 |
| [initial-reference-v1-fixtures.mjs](../../scripts/fixtures/initial-reference-v1-fixtures.mjs) | 明确合成来源的合法 V121 fixture、字段／证据／revision 重绑和错误样本 |
| [check-initial-reference-v1-runtime.mjs](../../scripts/check-initial-reference-v1-runtime.mjs) | A1/A2 领域与 fixture Gate；支持 facts-only、policy-only 和默认完整领域检查 |
| [check-reference-composition-v1-runtime.mjs](../../scripts/check-reference-composition-v1-runtime.mjs) | R01–R12 应用验收、完整旧 oracle、模式／并发／副作用、完整类型及内存 ES5 检查 |
| 本报告 | 实际运行结果和交付边界 |

原 evaluator、Safety、问卷、机构数据、页面、package.json、build 脚本、原业务测试及所有 Frozen Contract 均保持开始时内容。原有未提交文件没有还原、覆盖或清理。

## 2. 四个实施批次

| Gate | 实际结果 | 证据 |
|---|---|---|
| A1 Facts + Fixture | PASS | facts-only 实跑；原 Validator、白名单、状态、证据、未来 asOf、错误目录、非 published 排除、输入不变性 |
| A2 Eligibility | PASS | policy-only 实跑 R01–05/R07/R08/R11；旧 V2 真实候选作为输入；严格类型检查 |
| A3 Composition | PASS | R01–R12 全部实际运行；30 个分支组，另有 24 种排列和关联／错误子例；完整独立旧 oracle、同 T、单读及并发 |
| A4 Regression | PASS（相关 Gate） | 两个新脚本、六组旧回归、两模式构建、两模式生成 JS 检查、模式收敛和包预算 |

旧导航 Gate 在实施前实际运行仍为 23/25，NAV-019/NAV-024 保留失败身份，因此**不宣称全项目测试全部通过**。

## 3. 事实、来源与资格规则

`projectReferenceInstitutionFactsV1` 先调用原 `validateInstitutionCatalogPayloadV121`，不改变 Validator。全池 schema、provenance、pointer 或 evidence 非法时返回 DATA_ERROR，保留 cause 与 recordIndex/pointerIndex，不吞掉坏条目。合法非 published current 记录按原 manifest excluded 语义排除；它们仍先参与完整校验，不属于“跳过非法记录”。

每个 published 投影保留 institutionId/revision/provenance/status、dataset/mode/T、精确 currentPointer，以及 regionCode、参考总月费、原 index 房型、餐次和两项饮食质地支持。原 availability/value/asOf/verification 和精确 evidence 的 ID/path/valueSnapshot/sourceType/revision 均保留。unknown、unverified、expired、unavailable、current_verified 不混同；来源不由展示文字、图片或宣传推断。

旧 `isVerificationCurrentAt` 只读复用；C1 增加非未来 asOf 检查。费用还要求合法 asOf。核验及有效期边界采用原规则，T 等于 validUntil 仍有效。匹配输入从合法原记录取得，不从 institutionDisplays 的扁平文字反推证据。

资格固定顺序为：合法问卷／目录 → 旧 V2 → 旧组检查 → 精确关联 → 原关键冲突 → C1 饮食否决 → 普通依据。否决命中立即返回空匹配依据，不能被普通依据抵消。正向范围仅：

- AREA：用户明确选择的稳定区划 code 与当前核验机构 code 精确相等。
- BUDGET：reference_total/bounded/month/CNY 的安全金额与用户冻结预算区间相交；闭区间相接可匹配，开放用户上界不写 Infinity；不复用旧 budgetFit。
- BASIC_SERVICE：合法房型映射或餐次 code 精确相等，二者同时成立也只计一类。未列出所选房型保持未知，不推断不提供；正向 evidence/elder refs 只引用实际成功子字段。

至少一类 MATCHED 才有参考资格。合法起价、首月备注、押金、床费、过期／未核验或未来时间价格不成为正向依据；非法字段结构／证据不一致整体拒绝。没有正向依据时允许零候选，不为凑三张卡制造事实。

## 4. 已知冲突及两条 C1 饮食否决

原 constraint.outcome=conflict 或 matchTier=INELIGIBLE 均排除参考。null、blocked、UNVERIFIED 不提升为已核实，也不直接等于参考资格。

仅在新 eligibility fallback 内，对老人 known easy_chew／known modified_food 与机构对应当前核验 provided/value=unavailable 的组合返回 `REFERENCE_FOOD_TEXTURE_UNSUPPORTED`。两条规则实际测试通过；unverified、expired、future verifiedAt、requires_inquiry 和 raw availability=unavailable/null 均不会冒充当前明确不支持。吞咽线索不推导 tube_feeding。

R06 另以原 Exact、SoftNear、Conditional 各一例验证：即使旧合法卡具有饮食 unavailable 展示差异，新否决也不倒灌旧 V2，仍只展示旧一张卡、不补参考。未改变旧 nutrition、Safety、tier 或优先级。

## 5. 组合、旧快照和错误保护

新包络为 `reference_composition_v1`，policy=`initial-reference-policy-v1`，composition=`reference-composition-v1`，persistence=FORBIDDEN。成功结果完整保留原 RecommendationResultApplicationSnapshotV2 作为 legacyV2，包含 preview、displays、advisories、sourceContext 和 source，不只保存卡片或 semantics。

严格核对同一 dataset/mode/T、pointer、manifest、candidate、display 及 evidence 的机构／revision；先拒绝重复再关联，缺 candidate、错版本、错证据或上下文均 DATA_ERROR。合法旧可展示组存在时立即 LEGACY_V2_DISPLAY，参考资格不执行。无旧组才执行新策略，结果为 INITIAL_REFERENCE_ONLY 或 NO_PERSONALIZED_CANDIDATE。Provider 故障为 SERVICE_ERROR，问卷原错误独立保留，空 Catalog 沿用 NO_INSTITUTIONS_AVAILABLE，不伪装成老人不适合。

参考按每家不同匹配类别数降序、institutionId ASCII 升序排序，最多三张；不原地排序旧数组，不借 presentation/displayOrder 排名，不计算护理百分比。非法重复 current 由原 Validator 整体拒绝，不先去重掩盖错误。

旧 VM 状态由少量纯函数镜像，测试与原 VM 逐次比较；旧 no_safe_recommendation、blocked、NO_EXACT_MATCH 原值保持，新组合状态可以同时为 INITIAL_REFERENCE_ONLY。生产领域层不依赖 pages。

每张参考卡提供真实依据、精确公开详情 target、原始派生风险、全部 elderClarifications/requirementReadiness、相关 unknown constraints、普通数据缺口及原事实槽。风险不截为前三项。G0/I0 保留参考限制；K0 依据实际未核实约束提供，不凭空把已知事实标为未知。数据返回时深拷贝，避免消费者修改结果后写穿旧输入。

## 6. 完整 oracle、单读、时间和副作用证明

每个适用成功分支使用相同 Draft、T 和原 V121→V11 全池，**独立调用原 createRecommendationPreviewServiceV2.buildResultSnapshot**，对完整新 legacyV2 做 deepStrictEqual；不是用 wrapper 返回值充当自身 oracle。跨 VM 对象仅做 JSON 数据规范化以消除原型差异，字段和值不删减。原 Safety、readiness、tier、priority/rank、顺序、NO_EXACT_MATCH、风险及 evidence 一并受到完整比较保护。

测试深冻结输入、比较运行前后内容，并验证对返回 legacyV2 的消费者修改不影响来源。错误分支不伪造成功快照；旧成功后注入关联损坏时保留实际传入旧快照，整体拒绝新结果。

wrapper 每次 build 捕获一次真实 Draft source，并创建请求内局部 Promise。底层 Provider 对合法计算实际为 1 次，旧 buildResultSnapshot 为 1 次，T 原串一致；问卷缺失或版本错误 Provider 为 0 次。两个并发 build 使用不同 T 时总计 Provider=2、Draft=2、旧 builder=2，各自与独立 oracle 相等，不共享全局 cache。

新模块仅通过依赖注入接收旧 factory，不 runtime import 旧 service／store。测试先独立导入 C1，在 throw-on-call wx 宿主下证明不触发 store 初始化；原 store 仅在隔离 VM bootstrap 中发生 3 次内存读取。C1 导入及计算阶段真实存储、登录、电话、位置、预约、支付、网络提交等调用为 **0**；没有真实设备存储或账号操作。

## 7. R01–R12 实际测试矩阵

下列均为本轮**实际执行 PASS**，不是仅有规格。应用脚本覆盖全部12组，领域脚本另覆盖 A1/A2 对应分支。

| 向量 | 已运行的主要断言 | 结果 |
|---|---|---|
| R01 | 需要的护理能力全部 unknown、明确选区、AREA 一张、未知约束可见、原 oracle 不变 | PASS |
| R02 | 吞咽风险、对应饮食资料 unknown、月费用重叠、BUDGET、吞咽澄清保留 | PASS |
| R03 | 关键 conflict/INELIGIBLE；easy_chew 与 modified_food 两条否决；过期／未核验／未来核验／requires_inquiry／raw unavailable 对照；冲突先于普通依据 | PASS |
| R04 | 情绪、走失、吞咽、ADL 多风险，clarifications 超过3项仍全量保留，原 blocked 不变 | PASS |
| R05 | 无对应可信普通偏好，主体资料不能单独变推荐；零候选和目录语义 | PASS |
| R06 | Exact／SoftNear／Conditional 各一张优先、不补数；新饮食否决不改变旧组；参考评估数组为空 | PASS |
| R07 | 四家3/2/2/1、24种排列、ASCII同分、最多三张、房型和餐次只算一类 | PASS，24/24 |
| R08 | archive仅测试侧；current精确revision、多个依据一张；双current、错pointer、缺／重复candidate、错display/manifest/evidence/T与跨revision引用全部拒绝 | PASS |
| R09 | 一条坏记录整池失败且保留recordIndex；Provider reject／失败结果；空池原错误；缺必填／V1／Draft失败；非法T；并发请求隔离 | PASS |
| R10 | 旧 no_safe/blocked 与新 INITIAL_REFERENCE_ONLY 并存；完整旧 snapshot 和 VM state parity | PASS |
| R11 | 过期／starting_at／未来asOf／合法首月备注；闭区间相接、开放预算、validUntil=T；非法basis/period/bounded结构和证据不一致拒绝 | PASS |
| R12 | 11家真实目录由原校验器验证、仅AREA、无选区可零候选；真实Demo目录独立；整包错mode／混合Mock来源拒绝；真实副作用0 | PASS |

最终应用脚本输出：`R01_R12: 12/12 PASS; 30 branch groups, plus 24 permutations and association/error subcases`。领域脚本默认执行完整 A1/A2，分阶段开关仍可复现各 Gate。

## 8. 实际命令与相关回归

以下均实际运行并退出码0：

| 命令 | 结果 |
|---|---|
| `node scripts/check-initial-reference-v1-runtime.mjs --facts-only` | A1 PASS |
| `node scripts/check-initial-reference-v1-runtime.mjs --policy-only` | A2 PASS |
| `node scripts/check-initial-reference-v1-runtime.mjs` | 完整领域 Gate PASS |
| `node scripts/check-reference-composition-v1-runtime.mjs` | R01–R12、oracle、类型和内存兼容 PASS |
| `npm run check:recommendation-v2-runtime` | 68固定向量、6组Formal/Preview parity及相关不变性 PASS |
| `npm run check:recommendation-preview-v2-integration-runtime` | 20/20 PASS |
| `npm run check:institution-v1-2-1-catalog-integration` | 199项 PASS |
| `npm run check:institution-v1-2-1-runtime` | PASS |
| `npm run check:recommendation-runtime` | 117项 PASS |
| `npm run check:wechat-ts-targeted-compat` | 204模块内存检查，诊断／class fields／外部runtime依赖为0 |

实施前原前三组也通过；实施后按 A4 重跑，未改旧 expected。开发期间新增 fixture 缺字段、跨 VM 原型比较等 harness 问题仅在新增测试中修正，没有通过放宽原 Validator 或修改旧 V2 预期消除失败。

## 9. TypeScript、JS、构建与包预算

新应用脚本用 TypeScript **4.1.2** 的 createProgram、项目 strict 配置和官方微信 typings 对5个新增TS入口及其依赖取得完整语义诊断，诊断数为0；随后内存 emit ES5，共51个传递依赖 JS 模块，检查语法、class fields、optional-chain token 和外部 runtime import，全部通过。不是以 transpileModule 代替完整类型检查。

构建前已核实两个 dist 根带 `generated_shared_run_mode` 标记、无 tracked 文件和 symlink；仅执行原安全构建脚本，没有手工删除／清空 dist，没有改 build 脚本。使用原安装编译器，TypeScript 4.1.2 + Less 4.1.3 + native WXML 构建通过。

| 实际执行 | 结果 |
|---|---|
| `npm run build:production -- --install-root <现有安装目录>` | PASS_LOCAL_BUILD；30 routes、214 modules；1359558 bytes（约1328 KiB） |
| `npm run build:demo -- --install-root <现有安装目录>` | PASS_LOCAL_BUILD；30 routes、201 modules；1962065 bytes（约1917 KiB） |
| `npm run check:wechat-js-compat -- --artifact-dir dist/production/miniprogram` | 214个本轮生成JS模块 PASS |
| `npm run check:wechat-js-compat:demo` | 201个本轮生成JS模块 PASS |
| `npm run check:run-mode-package-size` | 两者均低于1984 KiB本地预算 |
| `npm run check:run-mode-convergence` | 模式隔离、Demo模拟流程、Production排除Demo及无真实API转发 PASS |

本轮生成构建 marker 为 `2026-10-25T23:12:36.398Z`；上述 JS 检查读取这些新产物。新 C1 factory 尚未从 app/pages 可达，**不在这214/201个运行包模块中**；它自身的执行和ES5证据来自新脚本的显式导入／完整program内存输出。构建成功不代表微信端C1参考卡已可用，也不证明C1设备兼容。

`SOURCE_IMPLEMENTATION_PASS = YES`；`DOMAIN_TEST_PASS = YES`；`BUILD_PASS = YES`。  
`UI_NOT_IMPLEMENTED = YES`；`ANDROID_NOT_RUN = YES`。  
最终微信打包字节、模拟器可见流程和本轮Android人工真机均未取证；不能用B1.2.6既有体验版验收替代。

## 10. Demo／Production 隔离

expectedDatasetMode 由可信调用方明确注入，不从Catalog自己、query或storage推断。原Validator继续校验每条recordProvenance，新层拒绝与expectedMode不一致的整包合法目录，双向错模式及混合来源均已测试。

R12 在本测试专属、绝对路径校验后的 OS 临时源码树使用现有 production builder 和批准的行政区 resolver，原校验器完整验证11家正式记录，投影的可比费用／房型／餐次正向事实仍为0。没有把Mock改标签当Production，也没有把公开研究观察升级成护理能力。真实目录与Demo JSON均只读，退出时仅清理本测试临时树。

Demo继续明确MOCK_DEVELOPMENT_ONLY；测试也读取原Demo机构目录验证，无真实登录／保存／通信／支付。Production源码没有导入新测试fixture或Demo数据；两模式原guard及构建替换保持不变。

## 11. 既有失败与审查边界

实施前实际运行 `node scripts/check-institution-navigation-a0-4-interactions.mjs`：23/25，exit1。

- NAV-019：旧断言要求未知VR时handler直接阻断，现页面允许进入资料状态页，资源Gate仍独立处理；保留 PRE_EXISTING_TEST_FAILURE／旧预期差异身份。
- NAV-024：Home假宿主缺syncBrowseFont，属于 TEST_HARNESS_DRIFT；未据此声称真实Home故障。

这两个旧脚本／页面均未改，C1尚未接页面，不能将其归因于新资格策略。最终新C1测试失败数为0，没有隐藏旧Gate失败，也未声称全库E2E全绿。

执行采用主会话集成、专项领域／测试实现和按需只读QA。A1只读核对完成；A3由主会话结合边界源码和自动化核对，本报告不声称另有独立A3签署或人工设备验收。

## 12. 工作区保护、剩余事项和停点

开始时2107个既存tracked/non-ignored untracked文件，排除本轮9个授权新增路径后，结束集合与内容聚合校验仍为相同2107个文件、相同指纹。原42个tracked修改路径与1036个既存untracked文件保留；新增9文件后untracked为1045。HEAD与分支不变。ignored dist生成文件按授权重建；不能把它们的更新描述为源文件修改。

未执行git add/commit/push、reset/clean/checkout覆盖、微信上传／提审／发布；未修改Frozen V2/C1、旧评审／规划／产品文件、真实数据或Owner原有成果。

C1-B具备开始页面接入规划的领域／应用数据条件，但尚未授权实施。后续需：从可信构建模式传expectedDatasetMode、注入原factory与原Catalog、按新包络建独立VM，参考卡独立handler验证当前快照并用精确revision的direct_link打开公开详情，不伪造旧推荐sourceContext；失败不能猜最新版本。标签、风险全量可读、单动作guard、迟到导航、窄屏／大字号及Android需后续实证。

Owner仍需审阅本轮代码；旧NAV预期／harness维护、C1-B授权和C2身份／后端／数据库设计属于后续决定。本轮不自动开始这些工作。当前正式数据主要依赖AREA，无明确区域可能零候选，这是可信证据约束下的预期行为。

`READY_FOR_OWNER_CODE_REVIEW = YES`。该结论不等于Owner已验收、不授权C1-B、不授权Git提交或微信发布。工作到此停止。
