# CompletedAssessment History — Android 17 TEST_ONLY 验收准备

TASK = V1_2_ASSESSMENT_HISTORY_POLICY_AND_DEVICE_READINESS_V1

DOCUMENT_ROLE = TEST_ONLY_ACCEPTANCE_PLAN_NOT_DEVICE_EVIDENCE
CONTRACT_STATUS = PROPOSED_NOT_FROZEN
OWNER_DECISIONS_APPROVED = FALSE
ANDROID_17_ENVIRONMENT = BLOCKED
ANDROID_17_MANUAL_GATE = NOT_RUN
ANDROID_17_EVIDENCE = NONE

## 当前已核实与阻断

2026-10-14 本轮主会话检查：`adb devices -l` 无连接设备；没有本轮 Android 17 截图/操作/进程证据。DevTools 安装包版本为 **2.02.2609232**（app.asar/package.json），技能协议版本0.3.11不是 DevTools 版本。当前运行时 `platform=devtools`、SDKVersion=3.17.2、version=8.0.5，是模拟器信息，**不是手机微信版本**。项目配置 libVersion=2.32.3，同样不能替代真机实际基础库。Android 设备型号、系统、微信和实际基础库均待填写，不沿用其他阶段 Android PASS。

可用本地隔离条件：MySQL8 loopback非3306 disposable schema；TEST classpath 合成 WeChat exchange（固定A/B/C）+真实服务器会话表、唯一 Elder 绑定；服务器非production且真实C5关闭；History三个测试能力开关；合成问卷/Mock推荐来源。普通项目和生产敏感写入仍关闭。后端只监听127.0.0.1，没有已验证的真机通道；未启用LAN、公开隧道或真实Provider。

现有注册AppID仅用于本机模拟器副本；默认副本在非devtools运行时不读取/植入Draft，不连接TEST_ONLY后端。真机必须提供不同于正式项目的、Owner明确授权且没有真实资料的独立注册测试AppID；格式校验或manifest不是权限证明。当前该测试AppID/手机成员/预览权限均未验证。Owner须确认合法开发者权限和沙箱隔离；不得替换正式AppID、AppSecret、真实C5或手机号规则来绕过阻断。缺设备、权限或真机网络任一条件，保持 BLOCKED/NOT_RUN。

## Owner 启动顺序（只操作新的隔离环境/副本）

1. **准备手机**：连接授权的实际Android17手机，确认不是模拟器。记录型号、`adb shell getprop ro.build.version.release`和微信“关于”版本。选定设备serial，`adb devices -l`必须显示device；unauthorized/offline不通过。无ADB时可手工执行，但必须用手机画面和进程重启证据证明真实设备。
2. **准备本机数据库**：使用单独已确认的MySQL8 TEST_ONLY datadir、127.0.0.1、非3306端口，例如33390。不要使用生产MySQL实例/库；不要清理已有测试库/数据/证据。下列命令只在该隔离实例已运行后执行，创建新的批次库。命令中的root空密码仅适用于自行创建的disposable实例，不能用于正式环境。

若尚无可复用的本次隔离实例，可先在项目根目录创建一个**不存在的新目录**并启动（不删除/移动任何旧目录）：

```powershell
Set-Location C:\Users\16562\WeChatProjects\wuhan-eldercare-match
if (Get-NetTCPConnection -LocalPort 33390 -State Listen -ErrorAction SilentlyContinue) { throw '端口已占用，先核对所属实例，不终止未知服务' }
$mysqlBatch = Get-Date -Format 'yyyyMMdd_HHmmss'
$deviceDataDir = Join-Path (Get-Location) "server/target/history-device-disposable-$mysqlBatch"
if (Test-Path -LiteralPath $deviceDataDir) { throw '目录已存在，保留旧证据，选择新批次' }
New-Item -ItemType Directory -Path $deviceDataDir | Out-Null
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe' --no-defaults --initialize-insecure "--datadir=$deviceDataDir" --console
if ($LASTEXITCODE -ne 0) { throw '隔离初始化失败，不继续连接其他数据库' }
$deviceMysqlProcess = Start-Process -FilePath 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe' -ArgumentList @('--no-defaults',"--datadir=$deviceDataDir",'--port=33390','--bind-address=127.0.0.1','--mysqlx=OFF',"--log-error=$deviceDataDir/mysql-device.log") -WindowStyle Hidden -PassThru
# 保存该进程ID/datadir；待mysqladmin ping成功后才执行下方CREATE。
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqladmin.exe' --no-defaults --host=127.0.0.1 --port=33390 --user=root ping
```

```powershell
Set-Location C:\Users\16562\WeChatProjects\wuhan-eldercare-match
$deviceBatch = Get-Date -Format 'yyyyMMdd_HHmmss'
$deviceSchema = "history_device_disposable_$deviceBatch"
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' --no-defaults --host=127.0.0.1 --port=33390 --user=root --execute="CREATE DATABASE $deviceSchema CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs"
$env:HISTORY_DISPOSABLE_MYSQL = 'true'
$env:HISTORY_TEST_MYSQL_URL = "jdbc:mysql://127.0.0.1:33390/$deviceSchema`?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
$env:JAVA_HOME = 'C:\Users\16562\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2'
Set-Location server
& mvn -q test-compile dependency:build-classpath "-Dmdep.outputFile=target/device-classpath-$deviceBatch.txt" '-Dmdep.includeScope=test'
$testClasspath = 'target/test-classes;target/classes;' + (Get-Content -LiteralPath "target/device-classpath-$deviceBatch.txt" -Raw).Trim()
& "$env:JAVA_HOME\bin\java.exe" -cp $testClasspath com.wuhan.eldercare.visit.assessment.HistorySyntheticE2eServer --user-loop --recommendation
```

该终端保持运行；记录批次库名/端口/启动参数及后端代码来源。只有此TEST classpath提供合成身份，不启动真实C5；生产混合profile仍关闭History。另一个终端复制本次两个HISTORY环境变量，可运行普通HTTP E2E建立合成A/B账号的合法Elder绑定和历史记录。该脚本需要另一个同库的disabled服务器34480（同testClasspath、追加`--disabled`）；HTTP E2E只在本次全新批次库首次执行。不要对已有签署测试库重跑“EMPTY”前置断言。

```powershell
# 在另一个已设置本次HISTORY环境变量的项目根目录终端
npm run check:completed-assessment-history-e2e
node scripts/check-completed-assessment-user-loop-devtools.mjs --synthetic-account=A --test-appid=填入Owner授权独立测试AppID
# 空草稿真机场景须使用另一个合法独立测试AppID/已验证独立存储，不能把同AppID的新副本当成空Draft
node scripts/check-completed-assessment-user-loop-devtools.mjs --empty-context --synthetic-account=A --test-appid=填入另一Owner授权空草稿测试AppID
# 无合法合成身份场景用另一新副本
node scripts/check-completed-assessment-user-loop-devtools.mjs --synthetic-account=INVALID --test-appid=填入Owner授权独立测试AppID
```

上述AppID占位符必须替换为合法注册的独立测试ID。未知、与正式项目相同、无权限或无法证明无真实数据时，设备测试保持BLOCKED；不要清真实微信数据来制造隔离。默认不传该参数生成的副本只能做Simulator回归，无法在手机启用测试保存。

3. **检查测试包来源**：脚本输出`server/target/history-loop-simulator-*`独立副本路径和`TEST_ONLY_MANIFEST.json`。记录manifest中的HEAD、原输入tree digest、测试包miniprogram digest、projectConfig digest、backend artifact/test-harness digest、合成账号、草稿模式及AppID来源/OWNER_VERIFICATION_REQUIRED状态。首次fixture只在空Draft时引导；本地`__test_only_history_fixture_seed_v1`标识后续不再注入或比较答案。PRESERVED_EXISTING_CONTEXT、SEED_STARTED、SEED_FAILED_DRAFT_PRESERVED不是就绪证明；保留草稿，手工检查合成问卷，不自动重种/清空。HEAD不足以证明dirty代码来源；manifest必须对应当次编译副本，后端重编译/包修改后重新生成并记录新副本。manifest是来源说明，不是假定已拿到微信最终包的字节哈希或running server签名证明。必须把后端进程PID/启动时间、实际classpath/启动参数和本次artifact digest绑定；不要记录secret。后端重编译后需停止自己识别的测试进程、用新classpath重启，再生成新副本/manifest；不得在运行期间修改编译目录却把新digest当旧进程的来源。
4. **建立可验证的真机通道**：优先USB ADB reverse，不把后端改为0.0.0.0。生成副本已有TEST_ONLY transport把逻辑`history-e2e.local:34479`转为127.0.0.1:34479；此改动不存在于正式项目。指定实际手机后执行下列命令，检查reverse列表。手机微信是否允许该开发态loopback HTTP必须实际验证；拒绝时保持BLOCKED，不修改真实安全门禁、生产合法域名或公开数据库。

```powershell
$deviceSerial = '填写本次实际授权手机serial'
adb -s $deviceSerial reverse tcp:34479 tcp:34479
adb -s $deviceSerial reverse --list
```

5. **编译并预览副本**：打开脚本生成的独立项目，确认TEST_ONLY文案、清晰合成数据、默认生产写入关闭。Owner用合法开发者权限通过DevTools“预览”扫描到指定手机；不上传体验版或发布。需要故障注入时使用明确连接该手机的真机调试会话。记录预览包AppID/开发者成员身份、生成时间、可获得的构建/预览标识及manifest；不记录AppSecret或真实用户凭据。不能以正常页面query/header激活测试能力。
6. **证明当前运行在手机**：从已连接的实际真机调试上下文读取`wx.getSystemInfoSync()`、`wx.getAccountInfoSync().miniProgram.envVersion`，记录Android/platform/model/微信实际version/SDKVersion及develop状态。`platform=devtools`、trial/release、无合成能力或网络不通都不是READY。只截取版本和环境字段，不采集定位、账号私人资料或整份网络headers。

运行资源默认值256总量、16/60s只为隔离技术保护；不是生产政策。触发429时停止新建，使用“核对原保存结果”，不删除marker、Draft或数据库记录来恢复额度。不把34481的低配额资源测试环境当成设备正常闭环环境。

## 每场景证据记录格式

为每个场景填写以下字段（可共用同一ENV-ID，但每条记录必须绑定该ENV-ID和包manifest）：

`ENV-ID | 场景ID | 操作者/时间 | 设备型号 | Android版本 | 微信版本 | 实际基础库SDKVersion | DevTools版本 | 测试包身份/manifest摘要 | backend TEST_ONLY批次标识 | PASS/FAIL/BLOCKED/NOT_RUN | 截图/最小脱敏日志/合成记录引用 | 观察与差异`。

不要预填PASS。所有手机字段目前UNKNOWN、所有场景NOT_RUN。手机截图只用合成资料；不得导出完整健康答案/Profile、session token/header、真实微信账号日志。后端核对仅记录合成intent→completed ID对应和行数、接口路径/状态/POST次数，不记录请求body。历史其他Android17证据不替代本表。

## Android 17 场景清单（本轮全部 NOT_RUN）

| 场景ID | Owner操作 | 通过条件 | 当前状态 |
| --- | --- | --- | --- |
| A01 | 我的→我的评估 | 合法入口/导航栏、TEST_ONLY明确、时间倒序和长列表可滚动 | NOT_RUN |
| A02 | 选记录→历史Profile→当次Recommendation | 原记录时间/版本与不可变快照一致；没有读取当前Draft补算 | NOT_RUN |
| A03 | 推荐→Profile→列表 | 返回原列表位置；迟到响应不重新打开其他记录 | NOT_RUN |
| A04 | 普通父栈和非Tab根栈分别点击微信原生/页面返回 | 有父栈按父栈返回；根栈按既有合法fallback返回，不新增路由/栈、不清Draft | NOT_RUN |
| B01 | 完整合成问卷后明确点保存 | 点之前无保存POST；真实回执后显示服务器记录；Draft保留 | NOT_RUN |
| B02 | 手指快速连点、请求等待中再点 | 不重复写入/不共享其他账号回执；只有一个原意图和一条完成记录 | NOT_RUN |
| B03 | 发出前断网使保存失败，再恢复网络重试 | 原Draft完整；可靠marker已落盘才发送；当前进程原请求重试同key/body，冷启动只核对 | NOT_RUN |
| B04 | 正常成功后再次点保存 | 同Draft上下文确认原记录，无新完成ID | NOT_RUN |
| B05 | INVALID账号副本或服务关闭 | 明确安全不可用/身份失败，无健康保存；不触发真实手机号 | NOT_RUN |
| C01 | 保存时仅故意丢弃成功回执 | 服务器已提交、手机未宣称成功、marker pending；记录原意图和服务器对应ID | NOT_RUN |
| C02 | 真正终止小程序所属微信进程并重新打开同包 | 旧PID/运行时注入消失，marker/Draft保留；“关闭页面”不算进程终止 | NOT_RUN |
| C03 | 重开后核对原意图 | 回执为原Completed ID；新保存POST=0；该意图对应行数=1 | NOT_RUN |
| C04 | 原提交延迟、查询网络失败，再恢复查询 | 待确认状态保留；不生成新key、不提交修改后的Draft | NOT_RUN |
| C05 | 切合成账号B/INVALID，再回原合法A | 旧marker不被用于新账号查询、不展示A记录；原marker保留，可回A核对 | NOT_RUN |
| D01 | 非空Draft点击开始新评估，取消/继续 | 明确冲突、原Draft完整；无新记录、无reset；继续打开既有Intro流程 | NOT_RUN |
| D02 | 经确认不同合法测试AppID/独立存储的空草稿副本→Intro→开始→填写合成答案→保存 | 空草稿安全入口；新旧Completed ID独立，旧Profile/Recommendation不变 | NOT_RUN |
| E01 | 手指点按钮、长列表滚动、底部区域 | action一次、点击区可靠、安全区无遮挡，列表末尾可达 | NOT_RUN |
| E02 | 增大微信/系统字体，检查状态/错误提示 | 长文本可读、不遮挡按钮；冻结Warm Swiss层级保持 | NOT_RUN |
| E03 | 网络断连/恢复、前后台切换 | 加载状态释放、可核对；迟到结果不污染隐藏/新页面 | NOT_RUN |
| E04 | 原生返回/冲突提示/错误状态 | 返回导航正确，提示可理解；无擅自新增保存确认/丢弃弹窗 | NOT_RUN |

## C01–C03 冷启动执行说明

仅在明确绑定手机的TEST_ONLY真机调试控制台注入以下一次性故障。不要改正式源码，不把DevTools Simulator执行算作手机执行，不把完整答案写日志。注入只替换成功回执，原网络请求仍交给微信；`dropCommitted`只表明HTTP成功，仍需后端核对对应记录。

```javascript
// 只用于 Owner 已确认的实际手机 TEST_ONLY 运行时。
wx.__historyDeviceOriginalRequest = wx.request;
wx.request = function (options) {
  if (options.method === 'POST' && /\/api\/v1\/completed-assessments$/.test(options.url)) {
    var next = Object.assign({}, options);
    next.success = function (response) {
      wx.__historyDeviceDropCommitted = response.statusCode === 200 || response.statusCode === 201;
      if (options.fail) options.fail({ errMsg: 'TEST_ONLY dropped save acknowledgment' });
    };
    return wx.__historyDeviceOriginalRequest(next);
  }
  return wx.__historyDeviceOriginalRequest(options);
};
```

保存后确认：界面待确认；`__test_only_history_save_recovery_v1`只含七个字段且state=pending；后台同key已提交。不截图完整Draft/answers。为证明真实进程丢失，Owner可在接受“会中断微信”的情况下手动结束微信进程，或对指定测试手机执行`adb -s $deviceSerial shell am force-stop com.tencent.mm`，记录前后`adb shell pidof com.tencent.mm`/运行时身份。重新手工打开微信中的**同一测试包**，不要清应用数据、卸载、清微信缓存、删除Draft/marker或重新植入marker。旧wx注入必须不存在；核对结果为原ID，服务器同意图COUNT=1且重开无completed POST。若微信替换预览包导致storage被清，标记BLOCKED，不能用重新seed数据冒充恢复PASS。

可用以下只读SQL核对本次合成意图的完成行，不查询snapshot/answers。必须使用本次已记录的disposable库、合法UUID；不得替换为真实账号库。手机网络证据只记录方法/路径/状态，明确区分登录POST、reconcile POST和新的completed保存POST。

```powershell
$originalIntent = '填入本次合成intent的完整UUID'
if ($originalIntent -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') { throw '非法合成意图标识' }
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' --no-defaults --host=127.0.0.1 --port=33390 --user=root "--database=$deviceSchema" --execute="SELECT id,COUNT(*) AS row_count FROM completed_assessment_history_test_only_v1 WHERE idempotency_key='recover_$originalIntent' GROUP BY id"
```

若本次设备不支持可验证故障注入/进程终止，C01–C03保留BLOCKED/NOT_RUN；Node/Simulator恢复证据只作工程回归。C04可在隔离接口延迟或网络中断条件下执行，不能调用“清意图后重存”来模拟。

## 验收收尾与仍待批准事项

仅撤销本次USB reverse/运行时mock并停止自建TEST_ONLY服务；不要删除批次库、等待意图或历史证据。整理每条实际PASS/FAIL/BLOCKED/NOT_RUN记录及其manifest关联。没有真实设备证据，ANDROID_17_MANUAL_GATE保持NOT_RUN，ANDROID_17_EVIDENCE=NONE。

审批状态更正（2026-10-14，保留本表既有 NOT_RUN 及历史证据）：当前 PROPOSED History Contract 的首轮 Decision Register 为权威审批层级，D02/D03/D04/D06/D07 已批准规则，D01/D09 批准方向，D05/D08/D10/D11/D12 批准原则。本表不追加正式保存 UI、意图解除/保留/删除或生产限额授权。真实C5、敏感数据告知/单独同意与主体权限、真实机构来源、传输/存储/备份/运维保护、数据权利细则、合同冻结与生产迁移/发布仍为独立 Gate。设备 PASS 即使未来获得，也不自动关闭这些 Gate 或激活 B01 Scope B/successor。


## 本轮独立复核与证据边界

主线程自动化：29项定向Maven测试、实际HTTP资源限制及历史闭环、不同PID终止/恢复、生成副本bootstrap/TypeScript、冻结领域回归和DevTools编译/模拟器检查。独立qa_reviewer仅做只读源码与必要依赖复核，不运行这些测试，结论PASS_WITH_RISKS；原无限累积LOW已在TEST_ONLY范围内由owner total/burst bound关闭，剩余LOW是总额度用尽后新建持续阻断，解除仍需D05–D08政策。发现的重复seed启动失败及默认同AppID设备隔离缺口已修复并复核。所有Android17实际场景仍NOT_RUN，ANDROID_17_EVIDENCE=NONE；这些工程和独立审查证据不能代替手机记录。
