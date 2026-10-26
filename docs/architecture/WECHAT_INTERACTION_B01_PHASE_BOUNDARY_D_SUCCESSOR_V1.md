# WeChat Interaction — B01 Phase Boundary D Scoped Successor V1

```ini
DOC_STATUS = FROZEN
DOC_KIND = CONTRACT
CONTRACT_ID = contract.wechat_interaction.b01_phase_boundary_d.v1
CONTRACT_VERSION = wechat-interaction-b01-phase-boundary-d-v1
SIGNING_DATE = 2026-10-12
SIGNING_TIMEZONE = Asia/Shanghai
SUCCESSOR_TEXT_APPROVAL = APPROVED
STATUS = APPROVED_PENDING_IMPLEMENTATION
SIGNED_SCOPE = A
EXCLUDED_SCOPE = B
IMPLEMENTATION_AUTHORIZATION_THIS_ROUND = NONE
B01_IMPLEMENTATION = NOT_STARTED
RUNTIME_ACTIVATION = FALSE
RUNTIME_ACCEPTANCE = NOT_VERIFIED
ANDROID_OWNER_ACCEPTANCE = NOT_VERIFIED_FOR_B01_D
GLOBAL_NAVIGATION_PASS = NOT_DECLARED
PRODUCTION_RELEASE_READY = FALSE
```

## 签署范围、覆盖优先级与实施边界

Owner 于 2026-10-12（Asia/Shanghai）在本会话直接批准 R01–R04 修订后的两份 successor 文本，并授权本次正式 ID/版本核对与登记。完整签署依据、草案哈希和版本绑定见[签署记录](../../output/b01-phase-boundary-d-owner-signoff-v1/OWNER_SIGNOFF.md)。

- **SIGNED_SCOPE = A**：六物理评估页面、Budget 合法完成后单次阶段重置、Profile 根/非根出口及六组编辑/恢复、继续填写、深来源重新进入 Assessment 的实际容量保护与 Intro 一次性目标意图协议。
- **EXCLUDED_SCOPE = B**：不重新进入 Assessment 的独立深层 Profile/Result/Institution/Appointment 业务链；并排除 D01/D02、History/D12、领域 Schema、S2B、生产发布。B 的容量不足只能保留合法上下文及可见失败/现有合法恢复，不授权猜测性 reset 或 context/handoff 迁移；不得将 B 标为 PASS。B 延期不阻止 A 后续单独获授权实施。
- 本文是**已批准、冻结的未来实施规范**，不是已部署行为或 runtime 验收记录。只有下一轮明确源码实施授权及相应验证/激活治理完成后，才能声明实现符合本 successor；本轮没有这类授权，不提前配置 runtime dispatch、发布新路由或更新 CURRENT 运行时事实。
- 本文与配套 successor 共同组成 Scope A 的局部覆盖：明确改变的导航条款以本签署文本为未来实施依据，未改变的规则仍按原 Frozen。旧文件和旧登记保留，既不全量 SUPERSEDED，也不把两份全量交互规范当并行权威。旧文件中“当前唯一”及旧人工 PASS 只能依其原版本/测试源解释，不能否定本次已批准的局部后继，也不能转为新实现 PASS。
- 下面保留已签署草案的结构化差异字段（包括 `EXISTING_RULE`、`PROPOSED_SUCCESSOR_TEXT`）及“拟议/草案/若获批”等起草时表达，以便逐条追溯。Scope A 中后继条款现在已获文本批准；这些历史表达不表示再次等待同一文本批准，不授权当前源码执行。B 类建议、可选文案与实施参数仍按原范围保持未决/建议性质。
- 32 题、26 必填、稳定 ID、Draft Schema/currentStep、首缺组恢复及完整 Draft Continue-to-Basic、Profile 版本派生与 Recommendation 领域语义均不变；不新增敏感答案传递或全局状态框架。B-1G 原型仍为 REJECTED。

## 源版本与局部覆盖表

前驱：`contract.wechat_interaction.v2` / `wechat-interaction-contract-v2`，原文 [Interaction V2](WECHAT_INTERACTION_CONTRACT_V2.md)。配套签署：[Profile B01-D V1](PROFILE_UI_V2_B01_PHASE_BOUNDARY_D_INTEGRATION_CONTRACT_V1.md)。本 scoped successor 的 V1 是独立 B01-D 文本首版，**不命名为全量 Interaction V3，也不是领域 Schema 升版**。

| 原合同条款 | Scope A 后继条款 | 最小覆盖关系 |
|---|---|---|
| Interaction V2 §§2–8、10 | I01/I02 | 六物理步骤、校验/保存/首错保留；Back 不主动完成/派生，真实 Profile 父实例的既有 onShow 刷新允许；Budget 最终 push 改为成功门禁后的单次 reLaunch；§10 完整反向链只在完成边界被分段验收取代 |
| Interaction V2 §§2–3、10.2、15–16、19–22 | I03/R02/R03 + Profile P02 | 现行普通入口/根 fallback 保留；容量不足的已覆盖评估入口增加确认后 Intro-only reset、第二次显式进入及一次性意图/来源有效性协议；单动作单 API 与可见失败/重试继续适用 |
| Interaction V2 §§2、10、15、19 | I04 + Profile P01/P02/P04 | 真实父页仍优先；真实 Profile 根的业务 fallback 改 Home switchTab，系统根 Back 与 Home 操作分开，不虚构 Budget 祖先 |
| Interaction V2 §§12、24–26 | 本文签署范围与第 8 节 | 仅明确授权的 A 局部条款形成后继；旧 runtime/Android 证据不自动继承，实施、激活及验收另行授权/记录 |
| Interaction V2 §§19–23 及其他未变条款 | I01/I05 不变量 | 保留公共事件链、失败恢复、跨域隔离；不新增业务链 reset，也不变更 D01/D02 或已实施 B02/B03/U01–U04 |

## I01. 保留六个物理评估页面及原交互

六路由继续是Basic、Health、ADL、Cognitive、Preference、Budget，对应 `/pages/assessment/{basic,health,adl,cognitive,preference,budget}`；顺序不变。保留32题、稳定question/option ID、26 required、现行Draft、条件失活真实删除、none/unknown互斥、局部错误与首错滚动。Assessment Schema/Draft Schema均不升版。

顺序从Basic进入时，第2–6步Footer Back与Android系统返回都遵循真实物理父页，回前一已访问步骤；Back不触发Next校验、不提交、不clear。前五步Next保留当前校验/保存成功后一次合法navigateTo；INVALID零导航。防重是第二层保护，公共组件仍只有一条action→Footer→Page链。

首缺组续填、定点编辑和独立根步骤不保证先前全部步骤存在：有父回实际Intro/Profile/前步；无父的显式业务按钮沿当前Assessment root fallback。根Android手势与业务fallback分开标注。不得批量push未访问步骤、用onUnload重开页面或触摸监听伪装原生返回。

源Interaction §2第3项“不触发Profile”与新增真实Profile父页须一起澄清：Back handler不直接生成/提交画像、不执行Budget完成跳转或全评估校验；若P02获批后实际父页是Profile，正常navigateBack返回该页，其原有onShow按Profile §6/§10决策4读取最新Draft重新派生。此生命周期刷新不创建partial/正式Profile，缺失数据仍显示incomplete/error；不把返回父页当作绕过Budget完成门禁。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/ASSESSMENT_CONTRACT_V2.md
SOURCE_SECTION: Interaction §§2–7、10、19–21；Assessment §§2、3、7.1、9、9.1、11
EXISTING_RULE: 六步物理页面、父栈优先/root fallback、Back不校验不清Draft且§2第3项不触发Profile；Next成功才导航、单事件与失败可重试；currentStep不是可见页或自动resume目标。
APPROVED_NEW_PRODUCT_BEHAVIOR: Owner选择D，继续六物理步骤；新的阶段切换只发生在批准的完成或容量边界。
PROPOSED_SUCCESSOR_TEXT: 原六组题目/校验/保存/首错和步骤间导航保持；仅I02/I03/I04及关联P02列出的导航分支拟变化。顺序访问保持实际逐步返回，直达入口不造前序父栈。Back不直接计算画像；返回获批真实Profile父页时，其既有onShow刷新按Profile合同执行，不绕过完成门禁生成partial/正式身份。
UNCHANGED_INVARIANTS: 32题、稳定ID、26必填、Schema、条件/互斥、Draft与CompletedAssessment边界、历史版本、Back零校验；不增加single-container、原生page-container拦截器或通用框架。
BREAKING_NAVIGATION_SEMANTICS: 六步映射无变化；关联P02增加真实Profile父页后，首编辑页返回Profile及其onShow需上述限定澄清，不能把Back变成Budget完成/主动推导。现行根组按钮/系统差异不会被假栈掩盖。
REQUIRED_TESTS: 六组顺序Next/Back、invalid/valid、快速点击、条件/互斥与首错，实际父栈/root两分支，Draft保存失败与恢复；Owner Android原生逐步返回单独验收。
```

## I02. Budget完成阶段：一次reLaunch到画像根

### 拟议规范

1. 保留Budget现行检查顺序和规则：本组校验；已有保存失败状态处理；全Assessment完成门禁；现行合法Draft进度/答案保存及其persistence结果检查。任一失败仍在Budget，不执行阶段导航。
2. 合法、已成功保存的当前Draft是画像的输入来源。Budget不复制健康答案，不提前构造第二套Profile/VM，不在URL传画像；目标Profile沿现行versioned Application/VM入口派生。不得把阶段切换当作创建正式CompletedAssessment或服务器提交。
3. 全部门禁成功后，一个用户完成动作只执行一次 `wx.reLaunch({url:'/pages/assessment/profile', ...callbacks})`；不用navigateTo或redirectTo代替阶段重置，也不先push再reset。成功后真实页面栈只有现有Profile路由，旧六步、Intro及其浏览父栈不再可物理回退。
4. 快速重复完成点击最多一次有效阶段跳转；禁止双事件链。同步异常、fail或等价失败须释放pending/guard，Budget当前操作区可见反馈并可重试。不自动尝试第二导航API。若原页面已离开，不得由迟到回调重置另一个当前页。
5. 不清Draft、不更改已成功保存的答案或现行元数据语义。只能据实际保存结果说“已保存”；不承诺失败写入、进程被回收前未保存输入或服务器同步。
6. Profile就绪/错误态由原Application结果决定；导航成功不等于派生成功。Profile派生失败仍有合法恢复/返回首页出口，不自动回预算或再开Result来掩盖错误。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md
SOURCE_SECTION: Interaction §§3、7（Budget各状态）、8（Budget用例）、10（完整前后栈/历史证据）、19–22、24–26；Profile §§3、6、7、10（决策4：Preview refresh）
EXISTING_RULE: Budget完整门禁成功后最多一次进入Profile；现行budget.ts:291使用navigateTo，§10的原验收链包含Profile返回Budget。§22要求避免评估栈耗尽且保持既有Back语义。
APPROVED_NEW_PRODUCT_BEHAVIOR: 已批准完成评估后丢弃旧评估父栈，画像为下一阶段根页；这是对原完成后返回语义的明确变化。
PROPOSED_SUCCESSOR_TEXT: 保留全部校验与成功保存门禁，仅最终导航替换为一次guarded reLaunch到已注册Profile；成功后旧评估父栈关闭，失败可见可重试。§10未来D矩阵改为六步阶段内返回与画像根退出分段验收，不再要求完成后的Profile系统Back回Budget。
UNCHANGED_INVARIANTS: INVALID零导航、保存失败不宣称成功、统一首错、Back不验证、单动作单API、防重/释放、Draft及Profile/Recommendation版本化计算、敏感数据最小化、无真实提交。
BREAKING_NAVIGATION_SEMANTICS: YES；从保留Budget祖先的push改为清全部父栈的阶段reset。原Profile→Budget→…→Home完整反向栈不适用于D完成后；旧人工PASS仅保留为旧runtime证据。
REQUIRED_TESTS: Budget未填/部分/前序缺失/保存失败均零reLaunch；合法完成一次reLaunch，目标Profile真实根与最新Draft；快速点击、同步异常/fail/重试、离页迟到回调；Owner Android分段Back与根退出；不能用静态深度或Node代替真机PASS。
```

## I03. 深入口容量：实栈推导、确认/取消与局部重置

### 已设计的Assessment入口与拟议规则

容量依据是真实当前栈、目标组和所选API，不是当前可见进度或一个固定业务常量。设目标序号k=1..6、进入后深度s，则正常完成剩余组需 `s+6-k`。navigateTo时s=p+1，redirectTo时s=p，复用祖先时s=a；必须检查对应合法祖先，而不只找同名route。Forward边界也要检查遗留深栈，不能仅保护Intro。

当前平台分析阈值10来自官方项目typings和Interaction V2 §22历史失败记录；它不成为产品MAX_STACK，不保证设备所有导航≤10都必然成功。实际平台失败仍执行失败恢复。后续业务链需要依据其真实API另计；不能只拿评估峰值通过便允许任意业务深链。

| 入口 | 现行/提议分支与静态峰值 | 草案处理 |
|---|---|---|
| Home1→Intro2→Basic3 | 五次Next到Budget8 | 正常路径保留；完成I02后Profile1 |
| Home中途续填第k组，目标3 | 当前首缺组实现，Budget9-k | 保留已存在的首缺恢复映射；首次Back回实际Intro，不填前组父栈 |
| 普通独立根Intro | 当前redirectTo第k组，Budget7-k | 原分支保留；根组手势不冒充业务root fallback |
| 根Profile无步骤祖先 | 拟navigateTo第k组2，Budget8-k | 拟保留真实Profile父页，具体文本与Profile草案共同审阅；完成I02重建根 |
| 有合法对应步骤祖先 | 拟navigateBack到a，Budget a+6-k | 容量安全才复用；否则进入说明/确认 |
| Result调整需求 | 现行回Profile祖先；无祖先redirectTo(Profile) | 此动作不直接重写；Profile下一次编辑/恢复/业务进入分别核算，不能默认其已是根 |
| 深Basic5 / Basic6 | Budget10 / 11（11是所需深度，非可到达证明） | 前者恰好阈值，后者不能普通push到完成；必须确认后的局部入口重置 |
| Mine→Elder→ElderDetail→History说明→Result5→redirectProfile5，再拟pushBasic6 | Budget11 | 必须容量确认，History能力保持未实施；取消保留Profile5和合法Draft |
| 同一Profile5拟pushHealth6 / Budget6 | Budget10 / 6 | 就评估链可进入；仍不据此宣称全部后续业务分支安全 |

已设计的容量不足处理：

- 先展示可理解的提示，说明确认后离开当前浏览/评估返回路径；只对实际成功保存的Draft说明可继续使用。此reset不是Restart，不清合法Draft。
- 取消保留原页，导航次数0、Draft不变；提示失败/同步异常也不得自动导航。确认的来源/目标有效性与并发规则按下述R03条款执行，不由迟到回调重置别页。
- 作为本次**拟议文本**，已设计的Assessment容量分支确认后一次reLaunch现有Intro根页；不是每次入口都reset。Intro真实显示，用户另一次明确“继续评估/继续修改”才navigateTo目标，目标2、Budget8-k。不得在onLoad自动push，从一次Action串联reLaunch+导航。
- 普通独立根Intro的既有redirect分支保留。专用容量重置Intro→目标navigateTo分支与一次性意图遵循下述R02协议；参数命名和内部实现留给实施阶段，不再把读取/消费/失效行为留作未定义。
- 恢复按当前required order/现行恢复入口判断，不重新解释currentStep。现行完整Draft Continue-to-Basic和首缺组便利恢复保持，不统一改为全部从Basic或跳到Budget/Profile。
- 无支持的Draft/schema按现行恢复/迁移边界处理，不能借reset自动补答案、升级历史或绕过用户确认清草稿。

### R02：Intro一次性目标意图的拟议协议

1. **内容限制**：跨页面意图只能表达六个稳定step ID（basic、health、adl、cognitive、preference、budget）及必要的评估/Profile来源类型，例如续填、定点修改或缺失恢复。不携带答案、健康资料、Profile、institutionId/revision、sourceContext、handoff或其它业务对象；不写入Draft Schema、currentStep或新的持久resume字段。参数名称/内部保存方式不在合同中指定。
2. **读取与校验**：容量确认的reLaunch只打开Intro。Intro读取后须校验step白名单、来源类型及与本次已批准Assessment/Profile交接的对应关系；意图只属当前有效Intro实例。非法/过期意图不得导航，显示可见反馈并保留普通合法说明/恢复入口，不依据外部参数补答案。
3. **显式进入**：Intro显示可理解的目标；只有第二次显式操作才按来源类型和现行Draft恢复规则重新验证目标与容量，再执行一次合法navigateTo。定点修改保持其合法目标；当前Draft若已需缺失恢复则沿既有首缺规则；普通完整Draft Continue仍Basic。目标与用户看到的本次目标不一致时，留在Intro更新提示，待新的显式操作，不偷换目标或自动进入。
4. **占用与消费**：一次有效显式操作发起导航时占用该意图，请求期间忽略重复操作；导航成功后消费并清除，不得由旧回调或返回Intro重放。之后新的继续操作按现行恢复规则重新决定，不使用已消费意图。
5. **失败与重试**：同步异常/fail须可见并释放占用；仅当当前Intro及其目标/导航上下文仍有效，才保留本次合法意图供用户再次显式重试，每次重验目标/容量。不得自动重试或换用第二API；退出、取消或失效后不得由失败回调恢复意图。
6. **失效边界**：取消进入、退出Intro、来源在确认/reset发出前失效、或不再符合本次导航交接时，意图失效，不继续导航、不清合法Draft。合法reLaunch正常关闭原来源属于已批准的交接，不要求被关闭的原页继续存活；此后意图由真实Intro实例拥有，仍须第二次显式操作，不成为自动导航许可。

### R03：异步确认与并发导航的拟议协议

- 容量提示/确认绑定有效来源页面实例、当时合法导航上下文与本次目标（step及必要来源类型）。绑定规则是局部交互责任，不指定新的全局状态管理框架。
- 执行reset前重新核对：来源仍是本次有效当前页，目标及确认所说明的导航上下文未被替换。来源离开/卸载、其它导航已改变上下文、目标改变或确认已取消时，迟到确认不得执行reLaunch，也不得创建可执行的Intro意图。需要继续时由新的显式操作重新判断/说明。
- 同一有效确认只允许一次合法reLaunch；快速重复确认、旧回调及并发重复请求不能再发第二次导航。reset成功只交接到Intro，不自动执行目标步骤导航。
- 取消零导航、保留当前页与合法Draft。提示失败、导航同步异常/fail均可见、释放保护；仅来源仍有效时允许用户重试，重试重新检查容量/目标。禁止连续尝试reLaunch/redirectTo/navigateTo等API，禁止任何合法Draft清理。
- 已发给平台的导航请求不被伪装成可撤销：来源失效后不得追加导航、伪造回退或恢复旧意图；已有API成功/失败按其真实结果记录，避免以迟到回调改变另一个当前页面。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/ASSESSMENT_CONTRACT_V2.md；docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md
SOURCE_SECTION: Interaction §§2、3、10.2、15、16、19–22、24–26；Assessment §§7.1、9、9.1、11；Profile §§6、7
EXISTING_RULE: 父栈优先、普通根Intro/步骤有明确fallback、单API和失败释放；§22禁止评估耗尽后续栈，但未规定D确认/reset分支。currentStep与恢复route不等价；目前Intro源码使用首缺组helper，完整Draft回Basic。
APPROVED_NEW_PRODUCT_BEHAVIOR: 当前栈不足以支持后续评估或业务链时，先解释返回路径变化，经确认才允许局部reset；取消保留当前页面及合法Draft。
PROPOSED_SUCCESSOR_TEXT: 对范围内Assessment/Profile入口、祖先及Forward按实栈判断；不足时停止普通push，有效来源/目标确认后一次reset到Intro，第二次显式操作才进入目标。一次性意图严格按R02读取/验证/占用/成功消费/失败显式重试/失效；确认与并发按R03。同一合法祖先按delta及容量返回，无祖先且安全的Profile编辑采用navigateTo(target)。独立深业务链按R01单独延期，不猜reset或context迁移。
UNCHANGED_INVARIANTS: 无全局reset、无假父栈、无多API试探、无Draft清理/领域默认值/新业务常量、原首错与合法保存、未知版本恢复边界、单事件和可重试。
BREAKING_NAVIGATION_SEMANTICS: YES；确认后丢弃深浏览父栈；专用根Intro不再采用普通root redirect，而保留真实Intro父页。取消不改变任何既有页面栈。当前首缺组实现拟被明确为交互映射，不改Assessment currentStep数据语义。
REQUIRED_TESTS: 所有范围内入口/API组合、六组s+6-k边界、Basic5/6、deep Profile5改组和旧遗留栈；六step/来源白名单、非法/过期意图、Intro只打开不自动进入、成功消费/返回不重放、失败仍有效时显式重试、取消/退出/失效不可恢复意图；迟到确认的卸载/非当前页/目标或上下文改变、重复确认/并发导航至多一次API、取消零导航、fail可见可重试；完整Draft Basic与首缺规则不变、合法Draft不清；未覆盖深业务保持context及可见反馈且不reset、不标PASS；Owner Android独立记录。
```

### R01 / TBD-BIZ-ENTRY：分阶段批准范围与单独延期的业务入口

**范围A（拟由本次successor签署覆盖、随后明确授权实施）**：六物理评估、Budget完成边界、根/非根Profile出口与六组修改/恢复，以及确实重新进入Assessment的首页、续填、根、深来源入口与其容量保护。深Profile选择题组重新进入评估属于A，不能仅因来源较深便划入延期范围。

**范围B（单独待决策，不由本次文本授权reset）**：未重新进入Assessment的独立深Profile/Result/Institution/Appointment业务链。其reset目标、合法context/handoff生命周期和重进入方案未设计完整；不授权猜测性reLaunch或context迁移，不丢弃合法institutionId、revision、sourceContext或handoff，也不改变已受理业务事实。

在B发现容量不足时，保持当前位置及现有合法上下文，给出可见容量不足/导航失败和现有合法返回或恢复反馈，不执行已知不安全的继续push、不自动reset、不连续试多个API。没有已定义恢复入口时明确反馈该限制，不发明新恢复协议。用户确认本身不能授权一个尚未批准的B类reset目标。

例如深Profile5直接进入普通目录尾链需要11（p+6），这是B；同页定点改组后走Budget完成则是A。根Profile1的无List咨询扩展链也到10（p+9），不能据标准后链7宣告全局安全。建议Owner明确分阶段批准A，B单独决策，必要时另出successor；B未完成不阻止A在文本正式签署及另行实施授权后实施，但不得把B标为PASS或宣称B01已解决全部业务深链。本轮仍不激活、不实施。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md
SOURCE_SECTION: Interaction §§22、23、24–26；Profile §§6、7、11；最新D设计§6
EXISTING_RULE: 导航不越权改Institution身份/context、Appointment回执或Recommendation；独立深入口不必经过Budget，不能天然视为Profile根。
APPROVED_NEW_PRODUCT_BEHAVIOR: 不足以支持后续业务链时须说明并确认后局部重置，取消保留页与合法Draft。
PROPOSED_SUCCESSOR_TEXT: 独立深业务链列范围B单独延期；容量不足时保持合法context/当前位置及可见失败/恢复反馈，不执行未经批准reset或迁移，不继续已知不安全push。推荐明确范围A分阶段签署/授权实施，B不得标PASS；未来B方案需独立决策，必要时另出successor。
UNCHANGED_INVARIANTS: 既有Institution/Appointment/Recommendation身份、授权、状态和已受理业务事实；不读真实数据/真实提交来验证草案，无新持久化或业务复制。
BREAKING_NAVIGATION_SEMANTICS: 本次不授权B类栈重置/上下文迁移，不改变其合法身份与回执语义；容量不足可见阻止不安全继续，不伪造恢复父栈。未来B的破坏性变化另行决定。
REQUIRED_TESTS: 区分deep Profile改组(A)与独立业务继续(B)；B容量不足保持institutionId/revision/sourceContext/handoff、无reset/迁移或多API，可见反馈/现有合法恢复；不把未覆盖链标PASS。未来B具体方案批准后再验证其实际栈与重进入；A按本次范围独立验收。
```

## I04. 明确评估阶段与画像根阶段的返回边界

拟议规范：顺序评估中原生返回正常pop；I02成功后Profile根没有Budget父页，系统Back可能按微信根行为离开小程序。这是Owner已接受的变化，不是clear Draft、取消预约或用户拒绝推荐。根画像显式“返回首页”使用一次合法switchTab到Home；“修改评估”由Profile关联草案定义独立合法流程。根左上角拟明确Home；真实父栈Profile仍优先回实际父页。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/PROFILE_UI_V2_INTEGRATION_CONTRACT.md；docs/architecture/PROFILE_UI_CONTRACT.md
SOURCE_SECTION: Interaction §§2、10、15、19、24–26；Profile V2 §§6、7、8；legacy Profile §8
EXISTING_RULE: 非Tab根业务fallback与原生Back不同；Profile既有父栈Back、root Budget fallback，历史§10反向链能回Budget。
APPROVED_NEW_PRODUCT_BEHAVIOR: 根Profile提供返回Home和修改，允许Android根系统返回可能退出，不虚构Budget父页。
PROPOSED_SUCCESSOR_TEXT: 六步Back保持实际物理栈；D完成后根Profile系统返回与页面Home动作分开。根箭头/Home动作一次switchTab，非根Profile实际父页Back不改；不调用空navigateBack假装回预算。
UNCHANGED_INVARIANTS: Draft保留、合法Tab API、真实父栈优先、导航不取消业务事实、不拦手势、不添加隐藏页面、单API与反馈。
BREAKING_NAVIGATION_SEMANTICS: YES；D创建的根画像不再有Budget可物理回退，root业务fallback拟从Budget改Home。不是将所有Profile实例一律视为根。
REQUIRED_TESTS: 四状态root/parent动作、根Home switchTab及父实例Back；六步完整往返分段与根Profile Android退出；明确区分按钮落点、系统落点及保存事实。
```

## I05. 保留已修复和已延期导航边界

本草案不撤销B02、B03、U01–U04：合法目录祖先复用；离开/非当前Create迟到回执不得带走当前页、已受理事实仍按原规则；Back文案跟真实父页、失败可重试；无效预约合法出口；Mine/说明non-Tab入口防重。D01 FAQ/AI转人工及D02我的预约卡联系顾问继续延期，保留其当前Frozen Tab/switchTab规则。主动TabBar和Result顾问Tab语义不变；机构详情/Success咨询子页、Create→Success redirectTo与真实父页返回不变。

```text
SOURCE_CONTRACT: docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md；docs/architecture/AI_CONSULTATION_CONTRACT_V1.md；docs/architecture/MY_APPOINTMENTS_CONTACT_CONSULTANT_ACTION_CONTRACT_V1.md
SOURCE_SECTION: Interaction §§19–26；AI §11；My Appointments Consultant §§5、8；当前导航修复REPORT的B02/B03/U01–U04
EXISTING_RULE: 单Action/guard/跨域隔离；指定顾问Tab handoff；预约卡按Frozen switchTab；当前已实施的局部导航修复保持。
APPROVED_NEW_PRODUCT_BEHAVIOR: D只新增评估阶段边界与经确认的容量reset，不授权变更上述既有合同。
PROPOSED_SUCCESSOR_TEXT: 无此区域语义覆盖。保持主Tab和既有咨询/预约返回路径，D01/D02继续延期；容量reset不得借机改变顾问目标/预约回执或撤销B02祖先返回保护。
UNCHANGED_INVARIANTS: Institution ID/revision/context，业务请求/回执/幂等/评价/授权，官方事实与Recommendation，History/D12边界及既有防重复/失败恢复。
BREAKING_NAVIGATION_SEMANTICS: 本区域NO；D清评估父栈只改变阶段起点深度，不自动重写后续业务navigation API。特殊深业务入口仍TBD，不能当作已修复。
REQUIRED_TESTS: 后续实施定向回归B02循环、B03迟到回执隔离、U01–U04、详情/Success咨询Back、我的预约/评价、主动Tab以及D01/D02仍为已知限制；不重复96项机构视觉测试，不触发真实提交。
```

## 6. 栈推演与API复核

2026-10-12定向复核当前app.json、Budget/Intro/Result/详情/Create/Success/我的预约/顾问源码，真实路由24、Home为Tab。下列D行仍是拟议API，不是已实施事实：

- 标准：Home1→Intro2→Basic3→Health4→ADL5→Cognitive6→Preference7→Budget8；步骤前进navigateTo，完成拟reLaunch(Profile1)。
- 普通后链：Profile1→Result2→List3→Detail4→Create5→Success5（redirectTo替换Create）→Appointments6→Evaluation7；其余上述前进navigateTo。
- 直接卡片后链：Profile1→Result2→Detail3→Create4→Success4→Appointments5→Evaluation6。
- 无List扩展：Profile1 Result2 Detail3 Success4 Consultation5→新List6→Detail7→Create8→Success8→Appointments9→Evaluation10。已有List后B02回List6，不每圈增加；此链并不意味着所有扩展都有余量。
- Result→Profile祖先用navigateBack(delta)，无祖先redirectTo；Safe edit完成后再reLaunch消除旧Profile/Result，不push第二画像。
- 标准全操作峰值max(8,7)=8；深Basic5评估峰值10，Basic6所需11必须入口保护。以上大于10的数字为风险推导，不是实际成功运行。

## 7. 实施前的最小验收矩阵

| 验收组 | 最低条件/失败边界 | 证据 |
|---|---|---|
| 1 六物理步骤 | 顺序进入，Back不校验，真实前步与Draft/条件/首错一致；直达首Back真实来源 | 自动化+DevTools+Owner Android分别记 |
| 2 Budget失败 | 本组/全门禁/任何保存失败不reset，当前反馈可见 | 合成runtime+真实UI，禁止真实健康数据 |
| 3 Budget成功 | 一次reLaunch、Profile真实根；rapid/同步异常/fail/重试/离页 | runtime与DevTools；设备验证单列 |
| 4 根画像出口 | 四状态Home有效，Tab用switchTab，不假回Budget；非根父Back正确 | runtime+DevTools+Owner系统返回 |
| 5 六组修改 | 真Profile父或合法步骤祖先，容量六组边界；不造前序栈 | 自动化/实际页面栈/Android |
| 6 派生与推荐 | 最新合法Draft→原versioned快照；incomplete/error不旧ready；显式开Result、重复编辑无重页 | 相关Application/导航Gate，不改算法 |
| 7 续填与深入口 | 普通/root/深、确认/取消/弹窗fail/导航fail/过期来源；合法Draft不clear | runtime+DevTools+Owner原生Back |
| 8 业务回归 | 机构→咨询/预约，Success→咨询/列表，迟到回执/幂等，D01/D02继续原状态 | 合成client与定向UI；无真实预约/评价提交 |
| 9 最长链容量 | 标准8/7、无List扩展10、deep及TBD入口；确认真实API替换/祖先/失败 | 栈记录；不能仅静态PASS宣告全局安全 |
| 10 Android | 六步原生Back、根画像系统退出/箭头Home、续填/修改/deep、快速操作/键盘 | 仅Owner真机验收；不得由Node冒充 |

实施Gate遵从源Interaction §9/§24/§25及适用Profile Gate：实际diff决定定向runtime、TS/JSON、DevTools最新产物、generated-JS兼容/要求的自测与Owner真机面。草案起草不运行这些行为Gate，不生成PASS或继承旧runtime PASS。

## 8. 签署完成与后续治理

两份 R01–R04 修订文本已签署 Scope A，B 单独延期。下节只记录后续实施边界，不构成当前源码授权。

## 后续授权与证据边界

两篇文本的 Scope A 已由本轮 Owner 签署关闭，不再把正式 ID/版本或 R01–R04 文本批准列为待办。参数命名、局部意图持有/清理、有效来源绑定、对应 UI/可选措辞和实施 Gate 安排，留给单独授权的实施设计；不得改变已签署行为或引入新全局状态框架。

本轮仅冻结文本及必要治理登记：没有 Assessment/Draft/Recommendation、app.json、S2B、Backend 或发布能力改动，也不激活 runtime。后续实施须按 Interaction V2 §11/§24/§25 与本版矩阵完成适用测试和独立 QA，分别记录自动化、DevTools、Android Owner 真机证据。静态栈 8/7/6/10 推导不是 runtime PASS，更不是全局业务深链安全证明。

`STATUS = APPROVED_PENDING_IMPLEMENTATION`；`B01_IMPLEMENTATION = NOT_STARTED`；`RUNTIME_ACTIVATION = FALSE`；`PRODUCTION_RELEASE_READY = FALSE`。
