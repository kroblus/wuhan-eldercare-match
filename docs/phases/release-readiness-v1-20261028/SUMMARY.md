# 封闭试用准备：RELEASE-READINESS-V1

2026-10-28，北京时间。任务 `RELEASE-READINESS-V1-20261028`；起点本机和远程均为 `49aad838789c41fd3e8e7d0a029200ea51ad4f18`，分支 `codex/unified-source-baseline`。本轮全部业务写入只用隔离合成数据。

**本机网页工作台已具备朋友试用条件，朋友本人尚未验收。** 管理员发布主链已真实点击通过，编译后小程序当前版本和旧推荐精确版本已通过实际 HTTP/MySQL 联调。正式 HTTPS、微信合法域名与 Android 真机仍待独立验收，不能据此开放真实服务。

## 实际修复和新增入口

- 正式公开地址原先复用开发地址规则，可能接受 HTTPS 私网 IP。现在正式配置只接受符合格式的 HTTPS 域名，拒绝 IP、本地/内部/测试后缀、路径、查询参数及凭证；开发存储中的 `false`、`0`、对象等非法值明确失败，不再被误当成未配置而使用本地事实。空地址继续使用随构建目录，Demo 保持隔离。域名格式通过不证明 DNS、证书、备案、平台配置或机构资料已获批准。
- 新增 `npm run check:publication-preflight`：默认只检查仓库地址与业务关闭默认值，不联网；显式 `--probe` 才只读检查获批端点的当前目录、schema、环境和精确版本。不携带管理员凭证、不跟随重定向、不输出失败响应正文。离线预检加入源码 CI。
- 新增可复跑的编译后客户端 HTTP 检查及 test-classpath-only 版本读取服务。专用受限 MySQL schema、loopback 监听、显式合成机构；测试服务不打进生产 jar。
- 修复启动器 Java 混用：本机裸 `java` 为17、指定运行时为21，Maven 现在跟随已校验的 Java。启动失败停止本次 Java 进程，恢复调用前环境变量。
- 实际320px/150%字号检查发现Demo推荐卡“本次讲解机构”贴住候选状态；三处无样式的标签改用已有独立成行的机构说明样式，不改变候选和排序。
- 增加“恢复既有合成 MySQL”和“停止合成 HTTP”小脚本；核对实例目录、loopback、私有配置和进程归属，不创建替代工程、不初始化或删除原数据库、不替换占用端口的其他服务。

问卷、画像派生、V2/C1 推荐规则、服务状态机和21项评价未改变。已有 `.codex`、`app.less` 和文档迁移工作不纳入本任务提交。

## 后台真实点击证据

本轮使用浏览器接口实际操作 `127.0.0.1` 合成工作台，不以旧 DOM/API 结果充当点击证据。

| 场景 | 本轮结果 |
|---|---|
| 登录、新草稿、必填校验、保存 | 空ID/名称提示必填；填写地区与公开资料后保存通过 |
| 人工来源、确认人和日期 | 实际确认通过；只确认合成资料 |
| 确认后改字段 | 确认失效，发布禁用；重新确认后可继续 |
| 发布第一版、修改确认后发布第二版 | 真实点击成功；页面显示版本变化 |
| 两页读同一草稿后提交旧内容 | 旧页准确提示冲突并保留本地输入，未覆盖新版 |
| 服务资格 | 发布后默认未开通；单独开启再关闭成功，旧记录保留 |
| 基线迁移 | 通过页面粘贴导入两条既有版本；相同ID/版本但内容不同被拒绝 |
| 冲突后查询与尺寸复核 | 查询的确认框、375px/150%阅读字号设置遇到浏览器控制超时，未取得完整恢复或尺寸通过证据 |
| 网络超时、双击、重放、同编号不同内容 | DOM/API、Java/MySQL和HTTP分别覆盖；未宣称全部经过真实鼠标点击 |

工具故障区别于应用故障：Windows坐标工具因无法可靠确认浏览器URL停止；改用能明确绑定本机URL的浏览器接口后成功登录和发布。后续 `Emulation.setFocusEmulationEnabled` 超时/会话重置使部分恢复和尺寸检查无法继续。文件选择受扩展本地文件权限限制，改用网页已有的粘贴入口完成导入，没有修改权限或放宽CSRF。

截图：[草稿](../../../output/release-readiness-v1-20261028/gui/admin-draft.png)、[第一版](../../../output/release-readiness-v1-20261028/gui/admin-v1-published.png)、[第二版](../../../output/release-readiness-v1-20261028/gui/admin-v2-published.png)、[冲突](../../../output/release-readiness-v1-20261028/gui/admin-stale-conflict.png)、[基线导入](../../../output/release-readiness-v1-20261028/gui/admin-baseline-import.png)、[禁止覆盖](../../../output/release-readiness-v1-20261028/gui/admin-baseline-conflict.png)。均为合成内容。

## 当前目录和旧推荐联调

真实链路为：编译后的 production client/page → 本机HTTP → 实际Spring Controller/发布服务 → 独立受限MySQL。

测试先读取第一版并注册推荐引用，再修改名称、介绍和公示价、重新确认并发布第二版。当前目录读取第二版；旧版公开资料仍为第一版、2500合成价，第二版为2600；旧推荐详情重复进入仍显示第一版身份和名称，原推荐上下文不变。缺失旧版返回明确失败，绝不换成第二版。

43次公开HTTP请求覆盖实际不存在的版本，以及通过本机HTTP故障代理注入的503、断连、25ms测试截止时间、错误schema、身份不一致和跨环境响应；失败后恢复均重新请求成功。代理只处理公开GET，不传Cookie或Authorization。无配置才用本地11家；非法配置不发请求；已配置失败不偷偷回退。Demo编译模块零公开请求、零身份或存储副作用。

为保留产品的合成环境拒绝规则，成功的普通目录/旧推荐测试在**隔离库内测试PRODUCTION协议分支，数据仍全部是合成fixture**；真实合成工作台的 `SYNTHETIC_TEST_ONLY` 响应仍被普通正式目录和旧推荐拒绝。测试transport把私有 `.local` 地址映射到loopback，未开放LAN监听；这不是微信实际HTTP或HTTPS联网通过。网络失败注入不是生产服务故障实测。

可复跑入口：`node scripts/check-publication-http-readiness.mjs <新建reader私有配置路径>`。reader必须是全新专用fixture，初始第一版；脚本不会覆盖已完成第二版的实验。[本轮最终结果](../../../output/release-readiness-v1-20261028/http-readiness-final.log)。

## 小程序及后端回归

- 17项首轮定向命令全部通过：发布client/admin、轻量目录、画像引导/UI、32题评估、V2推荐、C1领域/组合/页面、P1、Demo故事、21项评价、详情交互、卡片电话事件和VR、预检。
- 新构建运行检查覆盖在线当前目录、旧推荐精确版本、失败恢复和Demo隔离；性能回归覆盖首屏加载去重、搜索一次patch、返回刷新、并发只合并进行中请求、卸载后迟到响应忽略。目录检查仍禁止每张卡构造完整详情。
- Java/MySQL定向61项，0失败、0跳过；实际P1 HTTP覆盖申请、跟进、确认/冲突、改期、单场取消、到访、本人刷新、155+分页报告与冻结XLSX。权限、CSRF、幂等、身份隔离和不泄露后台备注同时验证。
- 双模式TypeScript4.1.2、Less及本机原生WXML编译通过，分别31个路由；模式收敛、包体、架构边界和实际生成JS检查分别记录。这些不等于微信上传包、手机编译或正式发布。
- 微信开发者工具生产模式：以合成草稿核对身份后，实点康复直达、“康复训练”和返回画像；两条提醒减少为仅吞咽提醒，未解除专业核实。320/375/430px、页面运行时注入150%字号的长提示复核，320/375另检查底部按钮可滚动到。原草稿逐键恢复并校验，模拟器恢复430px/16字号。仅注入合成数据和页面字号，不是系统字号或真实微信鉴权。Android本轮无可用真机操作证据，不沿用旧手机PASS。
- Demo实际点击首页→画像→推荐→详情，通过演示设置模拟完成带看后打开评价，21个评分控件逐项tap并读回均为4，再实际点击下一步和提交，显示“演示评价已保存”。这是演示会话保存，不是正式持久化。地图、VR、顾问、预约创建和我的记录本轮由故事/模块自动化覆盖，未将它们全部计作本轮GUI通过。

证据：[定向命令](../../../output/release-readiness-v1-20261028/targeted-checks.json)、[后端61项](../../../output/release-readiness-v1-20261028/backend/validation-summary.json)、[P1 HTTP](../../../output/release-readiness-v1-20261028/backend/p1-http.log)、[最终双模式构建](../../../output/release-readiness-v1-20261028/final-build-results.json)、[GUI范围与工具问题](../../../output/release-readiness-v1-20261028/gui/gui-summary.md)、[评价21项](../../../output/release-readiness-v1-20261028/gui/demo-evaluation-21.jpg)、[演示评价保存](../../../output/release-readiness-v1-20261028/gui/demo-evaluation-saved.jpg)。原始截图、日志和数据库只保留本机，未放入Git或Drive。

画像证据：[康复直达](../../../output/release-readiness-v1-20261028/gui/production-special-care-entry.jpg)、[勾选康复训练](../../../output/release-readiness-v1-20261028/gui/production-special-care-selected.jpg)、[返回后的提醒](../../../output/release-readiness-v1-20261028/gui/production-profile-return.jpg)、[320px大字号底部](../../../output/release-readiness-v1-20261028/gui/production-profile-320-font150-bottom.jpg)。Demo标签修复经最终构建的320px/150%实际模拟器再次截图确认：[修复后](../../../output/release-readiness-v1-20261028/gui/demo-recommendation-320-font150-fixed.jpg)。Terra最后遇模型容量限制，该次由主会话接手；恢复430px机型的UI选择可见，后续runtime查询超时，Demo窗口已成功关闭。

## 朋友坐在这台电脑上怎样试

工程准备已完成，**朋友独立人工操作尚未发生**。仅用于本机合成试用；远程电脑和手机不能直接打开这个loopback地址。

Owner先在项目根目录打开PowerShell，确认 `JAVA_HOME` 指向本机Java21，再依次运行：

```powershell
./server/tools/resume-p1-synthetic-mysql.ps1
./server/tools/start-p1-synthetic.ps1 -DatabaseSettings output/p1-1/mysql.private.json -JavaExecutable "$env:JAVA_HOME/bin/java.exe" -OutputDirectory output/release-readiness-v1-20261028/backend
```

看到 ready 后打开 [本机工作台](http://127.0.0.1:18341/p1-admin/)。账号密码由Owner在本机 `output/release-readiness-v1-20261028/backend/runtime.private.json` 查看并填写，禁止发送该文件或截图登录内容。这里不使用数据库密码登录网页。

1. 在“联系与需求”点击“查询/刷新”，选带有合成标记的待联系或待安排记录。姓名、电话、费用和备注只填写合成内容，不联系或拨打真实人员。
2. 记录一次联系结果、下一次联系时间与下一步动作；保存后重新查询，核对历史记录出现。
3. 安排看院：选择机构、同一负责人名称、北京时间起止、集合说明和准备时间。先保存待确认，再模拟双方已确认。故意安排一场重叠行程，应提示冲突；换无冲突时间再试。
4. 改期或取消指定的一场，重新查询，核对其他场次保留。登记实际到访要选择已发生的合成时段，不能将未来行程提前记为到访。
5. 在“机构服务报告”选择日期、机构与“合成测试”，点“生成报告预览”，再点“下载本批次Excel”。改变筛选后重新生成；汇总数字不包含联系人、电话、病史或后台备注。
6. 在“机构资料”准备一个名字含“合成”的新机构，使用 `synthetic-friend-日期数字` 这样的唯一编号。填写名称、地区、地址说明、合成价目和公开介绍；资料不知道就保持未知。先保存，再填写合成来源、确认人和日期，确认后发布。
7. 修改介绍或价目并保存，原确认应失效。再次核对、确认、发布，观察新旧版本。机构资料发布不会自动开通平台接单；服务资格仅在合成试用中单独测试并恢复关闭。
8. 打开第二个后台标签页读取同一机构，第一页保存后第二页保存应提示冲突。先保留本地未保存文字，查询服务器资料再对照修改；不要通过改编号覆盖旧内容。

| 遇到的情况 | 恢复办法 |
|---|---|
| 页面一直等待、网络中断或保存结果不明 | 保留当前页面和输入，恢复服务后用页面“查询服务器状态”核对，再使用原操作重试；先不要重复新建或刷新丢失现场 |
| 资料已被另一页修改 | 保留自己的文字，加载服务器最新资料核对，再保存、确认；不强制覆盖 |
| 登录失效 | 重新登录，查询当前状态后再操作；普通用户身份不能代替管理员 |
| 端口被占用 | 若是已运行的同一合成工作台直接使用；否则查清占用来源，不关闭未知程序 |
| Java版本不符 | 指定Java21的完整路径，不改业务开关、不用旧Java强行启动 |
| 数据库恢复提示旧进程仍在退出 | 稍后再次运行恢复脚本；它不会重新创建数据库。其他错误保留本机日志交给Owner |
| 文件选择导入失败 | 可用网页现有“粘贴完整目录”入口；只能使用Owner准备的合成测试文件 |

结束后退出网页登录并运行：

```powershell
./server/tools/stop-p1-synthetic.ps1 -OutputDirectory output/release-readiness-v1-20261028/backend
```

重启实测：草稿1→1、已发布版本2→2、行程59→59、事件129→129；现有启动逻辑每次增加1条待安排合成示例，需求314→315，不会清空旧数据。本轮最后已停止18341、18342及隔离MySQL，保留全部本机数据和私有配置。[恢复与最终关闭证据](../../../output/release-readiness-v1-20261028/backend/final-safe-state.json)。

朋友验收时逐项打勾：登录、查询、跟进、安排、冲突、改期、取消、到访、报告、Excel、草稿、确认后修改、再次发布、旧内容保留、退出。将不理解的文案或不能恢复的步骤交给Owner，不填写真实资料作为验证捷径。

## HTTPS还缺什么，Owner最短步骤

当前 `modes/production/runtime/institution-publication-origin.ts` 仍为空。本轮没有发现已配置的获批测试HTTPS服务；未采购域名、申请证书、配置DNS、创建隧道或部署公网服务。

1. 提供明确获批用于测试的公共HTTPS服务与域名，服务证书有效，并说明允许读取的机构/旧版本。准备好真实资料来源、机构身份和核验责任后，才能另行决定正式导入和服务开通。
2. 由有权限的Owner在微信公众平台配置对应request合法域名，保持开发者工具域名校验开启。平台具体配置以[微信网络官方入口](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)为准；本轮未登录公众平台修改设置。
3. 工程侧先运行离线预检；得到端点读取授权后执行下列模板，传入真实获批地址与已知旧版编号，不能直接使用示例占位符：

```powershell
npm run check:publication-preflight
npm run check:publication-preflight -- --probe --origin <获批HTTPS地址> --institution <机构编号> --revision <旧版编号>
```

4. 通过后才将获批origin写入production适配器、重新构建，并在开启域名校验的DevTools和Android微信验证当前目录、旧推荐详情、断网恢复。公开读取不需要管理员Cookie、CSRF或密钥。接单、C2历史写入和机构发布开关各自独立，仍需对应授权。

手机最短清单：恢复评估→画像确认“吞咽已记录”→修改特殊护理勾选康复训练→返回后提醒减少但吞咽核实保留→推荐/详情往返→地图/VR/官方电话安全入口→Demo模拟预约与21项评价→我的记录；再用系统大字号检查底部按钮。禁止把DevTools尺寸和HTTP回放当作手机完成。

## 性能和包体

轻量批量目录、首次首页去重、单次搜索patch、迟到响应保护本轮回归通过。Node固定时点、一次预热和7次采样仍只是数据准备量度，不是Android启动或渲染耗时；本轮没有同条件手机前后测量，因此不填写手机性能提升或退化百分比。

包体最终数值与同编译器/压缩器的本轮模块增量见 [同条件模块测量](../../../output/release-readiness-v1-20261028/module-size.json)。预检、HTTP工具、Java测试fixture均在运行包之外；Demo保持既有1984KiB本地预算，微信平台最终上传包仍未测量。

| 模式 | 最终本地运行文件 | 本轮改动增量 | 距1984KiB预算余量 |
|---|---:|---:|---:|
| Production | 1,410,343 B（向上取整1378KiB） | +385 B | 621,273 B |
| Demo | 2,017,073 B（向上取整1970KiB） | +421 B | 14,543 B |

增量使用相同TypeScript/Terser重编译起点与当前模块，并按相同行尾比较Demo三处标签；其余当前文件保持相同。不是把上轮不同工作树的包大小直接作性能结论。[本轮Node采样](../../../output/release-readiness-v1-20261028/after.json)中，Demo/Production目录准备中位数约177/206ms，首入约175/219ms；每模式7次、一次预热，仅首轮本机编译模块，不含原生渲染。最终产物的去重/返回/卸载行为另由 [最终检查](../../../output/release-readiness-v1-20261028/final-checks.json) 确认。

## 收敛结论和交付

- **工程已完成**：本机合成后台与版本发布主链、旧推荐HTTP精确版本、权限/数据隔离、失败恢复自动化、双模式本机原生构建、试用启动恢复和操作说明。
- **需要人工验收**：朋友独立操作、浏览器工具超时未完成的恢复与阅读字号、Android微信和系统大字号。
- **需要正式环境/独立授权**：获批HTTPS和微信合法域名、真实机构来源与确认、真实身份/告知/联系方式及服务开通。默认关闭状态未改变；没有微信上传、提审、正式发布或生产部署。

提交与推送、远程CI及Drive创建响应另记本机短回执，避免为回写自身SHA制造重复提交。全部原始证据在 `output/release-readiness-v1-20261028/`；本机证据链接不代表GitHub已包含这些文件。
