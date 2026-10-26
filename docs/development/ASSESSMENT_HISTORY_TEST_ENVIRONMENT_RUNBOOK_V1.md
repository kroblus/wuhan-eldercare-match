# CompletedAssessment History：独立测试环境与设备门禁

TASK = V1_2_ASSESSMENT_HISTORY_TEST_ENVIRONMENT_AND_DEVICE_GATE_V1

DOCUMENT_ROLE = CURRENT_TECHNICAL_PREPARATION_NOT_RELEASE_APPROVAL
CONTRACT_STATUS = PROPOSED_NOT_FROZEN
TEST_APPID_STATUS = EXISTING_TEST_APPID_OWNER_CONFIRMED_AND_LIVE_MANAGEABLE_20261017
TEST_BUILD_PROVENANCE = NOT_VERIFIED
DEVTOOLS_FULL_SAVE = NOT_RUN
ANDROID_17_MANUAL_GATE = NOT_RUN

本流程复用已有可信 Preview、D02、Session、SaveIntent、冷启动核对及不可变历史协议。它不新增产品语义，不批准真实身份或健康资料处理，不改变 Frozen Contract 或 D01–D12 审批等级。

## 三层证据

| 层级 | 可证明的内容 | 不可替代的后续条件 |
| --- | --- | --- |
| A：准备 | 当前 dirty/untracked 源码受控快照、独立文件复制、隔离数据库脚本、固定运行包、脱敏核对、操作与证据模板 | 不等于注册独立 AppID、微信权限或设备验收 |
| B：实际环境 | 实际 AppID、有效配置、编译和运行包、服务器身份关系、独立数据库/会话/密钥、HTTPS 均有可核验证据 | 仅生成 manifest 或客户端自报标志不能通过 |
| C：客户端 | 独立应用实际 DevTools 与 Android17 合成保存、历史、A→B、真进程恢复 | Node/HTTP/模拟器/手改页面数据不能替代真机 |

2026-10-17（Asia/Shanghai）Owner 已确认既有 Native VR/Map 与机构独立预览测试 AppID 仍获授权；本轮只读微信后台查询确认该测试 AppID 当前可管理、与正式 AppID 不同。此事实只关闭“测试身份资源不存在”缺口，History 复用准入仍未通过：服务器可信 code2Session 绑定、HTTPS/合法域名、History 实际构建来源及同 AppID 存储保护均不能据此预填 PASS。原项目 AppID 和两个 project 配置不得改动；旧测试工程保持。

本轮当前证据见 [History 隔离端到端预检](../../output/v1-2-assessment-history-isolated-readiness-v1-20261017/REPORT.md)。旧 DELIVERY 与验收文件保留历史状态，不追溯改写。指定环境仍为 STOPPED_DATA_RETAINED；旧本地 HTTP、数据库与幂等 PASS 可作历史技术证据，本轮未重启、未实连复验。

## 当前配置与准备边界

原项目根为 C:\Users\16562\WeChatProjects\wuhan-eldercare-match，common miniprogramRoot 与 srcMiniprogramRoot 均为 miniprogram/。private 同名字段优先；本轮读取时 private 未覆盖 AppID/源码根，覆盖 libVersion=3.17.2、urlCheck=true 等本机设置。common 基础库2.32.3不能替代实际运行时版本。正式配置、private 配置和默认返回 null 的保存 build 模块原样保留。

旧 Android 准备文档保留历史事实和 NOT_RUN 表格，见 [既有验收计划](ASSESSMENT_HISTORY_ANDROID_17_TEST_ONLY_ACCEPTANCE_V1.md)。其中 root/旧共享测试凭据和 loopback HTTP 示例不作为本轮环境或 HTTPS 门禁通过依据；本轮使用新实例、新受限用户、新随机密钥及本流程。不得通过修改旧签署材料来升级验收。

## 1. 捕获当前源码

入口为 `scripts/prepare-assessment-history-test-project.mjs`。默认目标 C:\Users\16562\WeChatProjects\wuhan-eldercare-match-test，必须不存在且父目录可写；存在时拒绝，不覆盖、不合并、不清理。

```powershell
node scripts/prepare-assessment-history-test-project.mjs
# 结果只是 preparation：source/ + 来源清单；没有可打开的测试 project.config.json。
node scripts/prepare-assessment-history-test-project.mjs --mode verify --prepared C:\Users\16562\WeChatProjects\wuhan-eldercare-match-test
```

受控范围：当前 miniprogram 代码/资源；后端 main 源码/迁移/桥接工具/pom；新的隔离测试启动器；两个已批准 synthetic 输入文件。字节从当前工作区读取，包含未提交实现，不用 HEAD 导出。逐文件大小与 SHA256、集合快照标识、HEAD 和配置摘要记录在 preparation manifest；HEAD 仅为辅助信息。

不复制 .git、Agent/Skills、原 private 配置、secret/credential/env 文件、历史 output/tmp/target、node_modules 或缓存。不使用 hardlink；拒绝链接文件/目录、已有目标、源码目录内目标、秘密字面量和捕获期间源变化。失败批次保留，选择新目录重做，不清理旧证据。逐文件散列是内容检查，不是平台身份或签名批准。

在 Owner 真正提供独立 AppID 和授权引用后，可向**新的不存在目标**显式传入 --test-appid 与 --approval-reference 生成 project 子目录。引用仅允许3–96字符的非敏感字母、数字、连字符、下划线、点或冒号，manifest只保存其SHA256；不得传入凭据。该动作拒绝正式 AppID；不复制原 private 配置，使用明确的测试编译配置、urlCheck=true。格式及引用不是平台权限证明，保存模块仍返回 null，不生成已启用保存 build。不得随意填一个 wx 字符串来演示成功。

## 2. 在快照内编译并固定后端

使用受支持 Java21、Maven 和 Node24，所有输出写入新的 snapshot/source/server/target；不覆盖原仓库 target 或既有测试报告。

```powershell
$prepared = 'C:\Users\16562\WeChatProjects\wuhan-eldercare-match-test'
$originalRepo = 'C:\Users\16562\WeChatProjects\wuhan-eldercare-match'
Set-Location "$prepared\source\server"
mvn -o -q test-compile dependency:build-classpath '-Dmdep.includeScope=test' '-Dmdep.outputFile=target/environment-classpath.txt'
if ($LASTEXITCODE -ne 0) { throw '编译失败，保留批次；不启动后端' }
Set-Location $originalRepo
node scripts/prepare-assessment-history-test-project.mjs --mode artifact --prepared $prepared --destination "$prepared\backend-artifact" --classpath-file "$prepared\source\server\target\environment-classpath.txt"
```

artifact 为完整独立字节副本：classes、仅隔离启动器及批准 fixture 的 test-classes、依赖 JAR；不引用 live target/classes。Manifest 记录源码快照、每个运行输入、Node 版本/可执行文件摘要、artifactId。启动器独立复核大小/散列/允许路径/额外文件及 Node，不仅相信 JSON。临时凭据、运行日志不放入 artifact。

## 3. 新建专用 MySQL 和合成本地服务

入口为 `scripts/history-test-environment-backend.ps1`，仅 initialize/start/verify/stop；没有清理或 DROP/TRUNCATE/DELETE 模式。EnvironmentRoot 必须是原仓库 server/target 下全新的 history-test-environment-UUID 目录；检查路径、reparse point、固定专用端口空闲后才初始化。

```powershell
$environmentRoot = Join-Path "$originalRepo\server\target" ('history-test-environment-' + [guid]::NewGuid())
# 在专用子终端操作；若继承 CLASSPATH，先人工核对后仅移除当前进程变量。
# 不修改系统/用户环境，不清除未知 SPRING/C4/C5 配置来绕过拒绝规则。
Remove-Item Env:CLASSPATH -ErrorAction SilentlyContinue
pwsh -NoProfile -File scripts/history-test-environment-backend.ps1 -Mode initialize -EnvironmentRoot $environmentRoot -MySqlBin 'C:\Program Files\MySQL\MySQL Server 8.0\bin'
if ($LASTEXITCODE -ne 0) { throw '隔离初始化失败，不连接其他实例' }
# 在本批次环境内生成新的固定运行包；Java 拒绝其他工作目录。
node scripts/prepare-assessment-history-test-project.mjs --mode artifact --prepared $prepared --destination "$environmentRoot\backend-artifact" --classpath-file "$prepared\source\server\target\environment-classpath.txt"
if ($LASTEXITCODE -ne 0) { throw '运行包固定失败，不启动后端' }
pwsh -NoProfile -File scripts/history-test-environment-backend.ps1 -Mode start -EnvironmentRoot $environmentRoot -ArtifactRoot "$environmentRoot\backend-artifact" -JavaExe "$env:JAVA_HOME\bin\java.exe"
pwsh -NoProfile -File scripts/history-test-environment-backend.ps1 -Mode verify -EnvironmentRoot $environmentRoot
```

MySQL8 使用 --no-defaults、独立 datadir、127.0.0.1:33410；新 schema 和仅该 schema 的随机用户。新 disposable 实例单独使用 --skip-log-bin，使既有不可变触发器迁移无需给运行账号 SUPER 权限；不改变其他实例设置。bootstrap admin 与运行账户配置分离，随机 root 密码、C5 hash key、仅本机合成登录 ticket 位于当前 Windows 用户/SYSTEM ACL 保护目录。服务仅持有受限库用户，不接收 root 或正式凭据；会话/身份表在新库。日志和 proof 不输出凭据、token、完整请求体或真实身份。

MySQL8 的 --defaults-file/--no-defaults 不足以隔离用户 .mylogin.cnf；客户端子进程须设置指向专用目录内不存在文件的 MYSQL_TEST_LOGIN_FILE，并在命令行固定 host/port/protocol、设置连接超时。仅修改子进程环境，禁止读取或修改 Owner 的默认登录文件。依据 [MySQL8 option file 文档](https://dev.mysql.com/doc/refman/8.0/en/option-files.html)。停机须核对自有 PID/可执行文件/参数和子进程，并确认专用端口关闭；其他进程占用端口时报告不完整，不强停它。

后端仅监听127.0.0.1:34579，使用独立 TEST_ONLY profile、明确 capability、随机环境 ID、原 sole Elder 和 approved input source。拒绝 Spring/C4/C5/Java 注入配置和 production 混合；仅两组批准的问卷/Mock Catalog。数据库 namespace 是候选操作限制，不能替代实际数据库/身份隔离。verify 要核对真实进程、datadir、schema grants、运行包摘要及能力状态。

本地 synthetic ticket 仅供本机验收进程使用，不打包到前端，不是微信账号或 AppID 证明。当前没有服务器可信的独立 Test AppID 认领/真实微信身份授权。客户端 AppID、environment、ownerId、elderId、Storage/Header 或 manifest 布尔值均不能补足该缺口。获得独立 AppID 后，还需 Owner 明确批准服务器可信校验关系及合成身份衔接；不得自动开启真实 C5 或复用正式 AppSecret/OpenID/会话。

可执行本地技术回归：`node scripts/support/history-test-environment-client.mjs --private-config "$environmentRoot\private\runtime.properties" --prepared $prepared`。它在不同 Node 子进程中执行丢弃成功回执、终止、最小 marker 恢复，以及 Preview→History、Session A→B 和跨账号拒绝；不把合成 ticket 写入源码或证据。不等于 DevTools 或 Android 验收。

## 4. HTTPS 与实际 build provenance

当前 loopback 服务只用于本机技术回归，TEST_HTTPS_ENDPOINT=NOT_READY。手机的 localhost 不是 Windows 后端；ADB reverse/关闭域名校验/关闭TLS校验都不能作为本轮 HTTPS 通过。不要自动启用公网隧道、0.0.0.0 或修改正式后台域名。

Owner 须提供测试应用的独立 HTTPS origin、域名控制/有效证书、测试应用合法域名配置权限和隔离连接方案；证据须表明请求实际到达本批次服务和专用数据库。正式 AppSecret、数据库密码、C5 key 不发到聊天、截图、前端或 manifest。

实际来源证明要关联：平台登记 AppID/开发权限；DevTools实际AppID；新 common/private有效配置；实际 miniprogramRoot；sourceSnapshotId；实际编译记录/运行包标识；后端 PID/启动时间/frozen artifact；独立 schema/用户权限；合成身份存储与密钥隔离；HTTPS/域名；工具版本。完整 DevTools 版本须从实际 About/安装包证据确认，skill协议0.3.11不是产品版本。只生成文件，状态仍 NOT_VERIFIED。

## 5. DevTools/Android17 操作与记录

仅在 B 层全部有证据后才开放受控 build/提交，不能用直接 setData、改 Storage、调隐藏变量冒充门禁通过。原项目入口继续隐藏。真实 AppID 尚无时不运行实际 full-save，也不伪造测试包。

| 场景 | 必要实际操作与通过条件 | 初始状态 |
| --- | --- | --- |
| 配置/包 | 平台→DevTools→新common/private→当前运行包AppID一致，源码/后端/数据库/HTTPS对应 | NOT_RUN |
| 可信展示 | 完成批准合成问卷，明确核验C5，再获取并查看服务器投影；匿名原结果不冒充历史 | NOT_RUN |
| D02取消 | 核验候选不等于完成历史；取消无完成POST/新完成记录，Draft保留 | NOT_RUN |
| 明确保存/双击 | 明确信赖回执，按原意图单记录；快速点不重复保存 | NOT_RUN |
| 历史 | 列表→当次Profile→Recommendation，状态/顺序/reason/difference/gap/来源/revision与候选对应 | NOT_RUN |
| 特殊状态 | approved no-safe向量保存NO_SAFE/NO_EXACT_MATCH，无虚假机构 | NOT_RUN |
| 失败/不确定 | 断网、延迟、丢成功回执，同内存原payload同键重试；未知不新建、不删marker | NOT_RUN |
| 真进程恢复 | 实际手机旧PID消失/运行时清空，同包重开仅读原marker核对；无新完成POST | NOT_RUN |
| Session A→B | 同账号同Store已保存未修改→明确确认独立空B→填写批准向量→保存B；旧历史不变 | NOT_RUN |
| 冲突/归属 | 修改/非空/未知Draft不丢失，跨账号/老人拒绝；不复制旧健康答案 | NOT_RUN |
| 触摸/导航 | 手指点击、双击、滚动、返回、弹窗/底部安全区、前后台状态释放符合现行约束 | NOT_RUN |
| 正式工程 | 正式配置/hash未变，原入口隐藏，不能通过参数启用测试写入 | NOT_RUN |

Android17 须实际连接授权设备，记录型号/系统/微信/SDK、指定设备的ADB状态、微信开发/体验权限和当前测试包。当前 adb devices为空，ANDROID_17_ENVIRONMENT=BLOCKED。禁止把模拟器SDK/微信版本当手机版本，不自动结束微信进程。真正 force-stop 会中断微信，必须由 Owner 明确接受/执行；不清应用数据、不卸载、不清缓存、不删除Draft/marker。

每场景保留：时间（Asia/Shanghai）、ENV-ID、sourceSnapshotId/artifactId、实际包/平台身份引用、设备/工具版本、操作者授权引用、PASS/FAIL/BLOCKED/NOT_RUN、截图、只含方法/路径/状态/POST次数与合成完成记录引用的日志。只读核对完成ID/计数，不导出 answers/Profile/token/header。C5登录POST、reconcile POST、completed保存POST分开计数。

## 6. 结束与剩余决策

仅对 helper 已核对的自建进程执行 stop；不关闭用户的正式项目、不删除 datadir/数据库/源码副本/报告/缓存。停机也要保存 proof。首次失败保留批次状态，人工核对后另建目录；不得通过重置未知意图或释放额度来解决长时间PENDING。

```powershell
pwsh -NoProfile -File scripts/history-test-environment-backend.ps1 -Mode stop -EnvironmentRoot $environmentRoot
```

原 A 层准备本身不解决平台身份或权限；2026-10-17 的 Owner 确认与实时查询只补足测试 AppID 资源。仍未解决：服务器可信 AppID关系、HTTPS、真正设备/运行包、D11同意/主体权限、D12权利/保留/删除、真实机构来源、生产迁移/冻结/发布。候选存量与累计额度用尽安全阻断的既有 LOW 保留。B01 Scope A=CLOSED_WITH_RISKS、Scope B=DEFERRED_NOT_VERIFIED、SUCCESSOR_ACTIVATED=FALSE、PRODUCTION_RELEASE_READY=FALSE。

同 AppID 的新目录/源码副本不建立独立微信本地存储命名空间。现有 Draft、History session/recovery marker 和 backend-origin 等固定 key 不得为 History 复用而读取、迁移或清理。当前未打开新测试包；未来启动前须先证明独立测试构建从启动到页面的所有存储访问均与旧 key 隔离，或使用另一个明确授权且独立的 AppID。此项如需修改小程序源码，由 GPT-6.1 Sol 执行最小改动并另取构建/运行证据。不得把旧 DevTools-only synthetic ticket 工程上传手机，或把本机 ticket 作为微信登录替代。

本轮 reused AppID 不得使用 `scripts/check-completed-assessment-user-loop-devtools.mjs` 生成或启动测试包：旧 builder 的设备分支会替换 `wx.login`、关闭域名校验并读取 Draft/写入 seed 与 backend-origin 等共享 key；非空草稿保护不足以满足“完全不触碰旧存储”。保留旧脚本/历史证据，但不得凭它升级本轮微信身份、HTTPS 或存储 Gate。受控 preparer 本身也不自动证明存储隔离。

## 7. 可信测试身份与 HTTPS 后续准备（2026-10-17）

Owner 已在后续 enablement 任务中明确：测试域名与部署资源尚未准备。因此仅形成 [可信身份与网络准备报告](../../output/v1-2-assessment-history-trusted-identity-https-v1-20261017/REPORT.md) 及设计/Owner清单，未实现或启用新的鉴权适配、HTTPS、MySQL连接或微信客户端构建。旧 synthetic ticket harness 不得直接代理到公网。真实 code2Session、合法域名、生产网络拒绝与共享存储隔离 Gate 仍未通过。

既有测试 AppID 可管理不证明该测试号有 request 域名/服务器秘密配置资格；由 Owner 在对应后台核实并提供非秘密证据引用。现有 C5 正式认证开启会使 TEST_ONLY History guard 关闭，不得靠启用正式 C5 或放宽 guard 取得测试能力。拟议隔离适配只是部署技术设计，不改变 PROPOSED_NOT_FROZEN、D08 或生产健康数据禁写边界；实现前必须补齐外部条件、批准测试身份映射并形成新固定运行包，不能原地改旧 artifact。

另保留 LOW 运维边界：helper 主动停机时核对并停止 Java 进程树；若 JVM 在 helper 检查前已被外部终止，遗留的 Node validator 可能失去可枚举父进程。当前不按进程名批量杀 Node，不自动清理临时目录；需保留证据，后续按明确进程登记或 Job Object 方案另行处理。此风险不构成开放公网、真实身份或生产写入的批准。
