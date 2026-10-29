# 快康养 Young Evergreen：A 版迁移与验收记录

任务 `ADMIN-EVERGREEN-V3`。Owner 于 **2026-10-29 回复“A”**，一次视觉确认已完成。五模块、登录和独立移动布局的代码已迁入正式 React 入口，自动化与实际 JAR 检查通过；**第二阶段尚未完成全部 GUI 验收，不标记整项完成**。

## 当前可以做什么

- 工作台、需求、带看、机构、报告和登录使用统一浅薄荷 A 版；深青绿白字主操作，浅绿/白色内容空间。
- 桌面使用 Ant Design 6.6.8；手机使用 Ant Design Mobile 5.43.0，导航为工作台/需求/日程/更多。React 18.3.1、Router、Vite/TS、同源 API 及后端业务契约保留。
- 手机需求卡片、带本地搜索的筛选选择页、全屏详情与联系/行程入口；日程按北京日期/状态组织卡片；机构四步编辑；报告指标与可展开明细。
- 机构移动冲突按字段明确选择本地/服务器，包含价格和完整核验 JSON；全部选择后才合并，使用最新草稿 revision 保存并重新人工确认。名称/地区关联及 unknown 事实不自动升级。
- 表单与业务操作状态共用。视口切换保留输入，pending 禁输入但原操作重试仍可用；嵌套窗口共享滚动锁；窗口内下拉选项不会落入原生 dialog 的 inert 背景。
- 新版运行时不引用 Arco，也不加载旧主题。由于完整 GUI 验收尚未完成，按任务约束**暂留未使用的 Arco 依赖及 arco.css.ts**，待剩余验收通过再删除；未安装 TDesign。

主范围为 `admin-web/`；后端只补 `/p1-admin/more` 的静态路由白名单与对应检查。没有修改 API、认证、CSRF、幂等、机构发布契约、小程序源码或业务开放开关。开始时的 `.codex` 配置、小程序样式、PDF归档和旧证据目录未纳入本任务。

本轮执行已核对为普通 Windows Medium 权限。未合并 main、部署云服务器、开放真实服务或上传微信。

## 实际验证

| 项目 | 本轮证据与结果 |
|---|---|
| 前端类型/组件/API | **60/60通过，0跳过**；包含实际本机合成 Session、分页、详情、日程、机构草稿、报告快照和同批 XLSX HTTP（200、正确内容类型及 ZIP 文件头）。[最终测试](../../../output/admin-evergreen-v3-20261028/stage2-tests-final.json) |
| 保真回归 | 原有幂等重试、响应未知读回、确认失效、不可变发布、报表批次测试继续通过；新增移动步骤/价格/JSON/unknown、筛选提交、视口保值、滚动锁及确认宿主测试。 |
| 后端 | Java21 + 独立临时 MySQL schema，P1边界6、服务16、排期14、报告7、机构发布15、Node验证3、静态路由2，共**63通过，0失败0跳过**；新增more后又单独跑2项路由测试。[日志](../../../output/admin-evergreen-v3-20261028/backend-regression/backend-tests.log) |
| 实际JAR | Maven实际npm ci/typecheck/build/package成功；**21个静态文件逐个哈希匹配、36项真实HTTP检查通过**，含五模块和more深路由、缺失资源404、默认业务关闭。[日志](../../../output/admin-evergreen-v3-20261028/jar-smoke.log) |
| JAR认证 | 实际JAR的13项HTTP诊断通过，Cookie Secure/HttpOnly/SameSite=Strict/路径正确，业务记录计数未改变；这不是浏览器HTTPS验收。[结果](../../../output/admin-evergreen-v3-20261028/jar-auth.log) |
| 工程 | `check-admin-web`通过，五业务路由与两视口组件按需加载，运行时无Arco、无外部CDN；小程序TS4.1.2保持。[包体](../../../output/admin-evergreen-v3-20261028/assets-final.json) |

Maven第一次打包遇到正在运行的Vite持有esbuild.exe，导致npm ci EPERM；关闭本任务Vite后正常完整重建，没有提升权限或跳过最终前端构建。组件测试超时统一为15秒，避免Ant样式计算在并发测试下触发原5秒限制；未删除断言。

## 真实浏览器已经验证的业务

本轮GUI全部使用隔离合成MySQL与本机服务，不以测试截图代替正式服务。

1. 真实登录、桌面五模块与手机五模块入口可访问。
2. 手机需求筛选实际查询，待联系结果从319条切至106条；详情中的选择页与未保存关闭确认可操作。
3. 手机写入“未接通”联系记录成功，服务器状态变跟进中并增加事件。
4. 桌面保存2026-11-20 10:00–11:00合成带看为“待双方确认”，详情和事件显示结果，没有触发通知。
5. 机构四步切换及未保存离开提示；375→768切换后名称输入保持。双标签409已触发，名称本地输入保留；查询服务器、选值、合并为最新版本后保存草稿6，填写合成来源/确认人/日期后确认至草稿7。
6. 手机报告预览成功；GUI点击Excel仅证明发起下载，**未捕捉到文件落地**。同批文件的真实HTTP内容已由上面的API测试验证。

[GUI原始摘要](../../../output/admin-evergreen-v3-20261028/stage2-gui/gui-summary.md)、[需求375/150截图](../../../output/admin-evergreen-v3-20261028/stage2-gui/requests-mobile-375-150.jpg)、[日程截图](../../../output/admin-evergreen-v3-20261028/stage2-gui/visits-mobile-375-150.jpg)、[报告截图](../../../output/admin-evergreen-v3-20261028/stage2-gui/reports-mobile-375-150.jpg)。截图带工具输出的外部空白和浏览器翻译浮标，且拍摄早于最后的圆角/列表容器微调，不能冒充最终视觉全验收。

### 发布结果与工具阻断

点击机构发布时进入浏览器原生confirm，工具accept超时。随后已独立只读核对 `synthetic-react-gui-new-20261028`：**草稿7、CONFIRMED、currentRecordRevision=null，尚未发布**；没有重复发起发布。[只读结果](../../../output/admin-evergreen-v3-20261028/stage2-gui/publication-readback.json)。

恢复时 `mcp__cua_repl.js` 的 `cua.getApp({windowId:917764})` 返回：

> Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.

遵守限制停止本轮GUI，没有换工具绕过。发现开发热更新时模块级确认回调可失效后，已改为稳定事件连接应用内全屏确认宿主，宿主缺失时取消操作，去除浏览器confirm降级；新增回归通过。**该修正尚未重新GUI核验**。

### 尺寸证据与仍须完成的项目

- 机构编辑100%已观测320/375/390/约431/768/约1025/1280/1440宽度，页面未横溢；430与1024目标值尚需精确复测。
- 375px / 应用150%下，机构、日程、报告实测根字号24px，scrollWidth=clientWidth=352px（Chrome滚动条占23px）；需求筛选也已实际操作。
- **未完成**：五模块完整8宽度×2字号矩阵、最终桌面/手机截图、价格与完整JSON的真实409全过程、真实发布成功、浏览器返回/横屏/键盘/触摸区域最终核对、真实浏览器zoom、手机退出及再次登录、Excel文件落地、实际丢响应安全重试。
- 应用150%字号不是浏览器150%缩放。没有Android/iOS真机、Safari/WebView、虚拟键盘或同源HTTPS浏览器验收。

## 包体与依赖

同一manifest静态依赖闭包计算，工作台含当前视口组件及业务路由：桌面JS **1,012,468字节 / gzip 326,179**，手机JS **478,015 / gzip 158,897**；CSS分别18,799 / gzip4,564和29,734 / gzip7,014。壳层初始JS370,808 / gzip117,690；不能只报壳层来掩盖进入页面后的组件下载。桌面不会下载Mobile包，手机不会下载Ant桌面包；首次跨断点才追加另一端组件。桌面chunk仍有约628KB未压缩警告，未宣称性能全面优于旧版。gzip是本机计算，不代表服务器已开启压缩；Ant桌面运行时注入样式不计入静态CSS数。

`npm audit`仍8项（2低、3中、1高、2严重）：Mobile/deepmerge低风险链、Router与Zod，以及Vitest/tinypool开发依赖链。未强制跨主版本更新Router/Zod/Vitest：本次保持既有外部契约，当前静态路由不接收任意跳转目标、不使用SSR反序列化，Mobile不将机构JSON传给deepmerge；这些是使用路径说明，**不等于漏洞已修复或生产安全验收**。后续需单独验证可兼容升级。[审计](../../../output/admin-evergreen-v3-20261028/audit-stage2.json)。

## 第一阶段已完成的视觉确认

2026-10-28在 `d76231cb31f0c6cb988c62014fcf8224dec0da7d` 完成独立A/B标杆；Owner现已选择A，不再请求第二次审美批准。原型仍用 `npm --prefix admin-web run dev:evergreen`，入口 `http://127.0.0.1:5174/p1-admin/evergreen.html?view=dashboard&variant=a`。支持dashboard/requests/conflict、variant=a|b与font=150。

两版同内容同尺寸，明确合成、不写业务。第一阶段45项前端测试通过，live测试当时跳过；桌面1440、手机375、冲突375/320与150%实际点击。[原型及旧V2截图对照](../../../output/admin-evergreen-v3-20261028/review.html)、[第一阶段GUI](../../../output/admin-evergreen-v3-20261028/gui/gui-summary.md)。旧V2截图只作风格比较，不比较不同时点的统计数。

版本核对使用官方npm元数据及[Ant Design6最低React18说明](https://ant.design/docs/react/migration-v6/)、[Mobile5 React兼容说明](https://mobile.ant.design/zh/guide/v5-for-19/)。品牌变量共用 `src/evergreen/tokens.ts`。

## 下一步

在允许继续计算机操作后，以静态生产构建重新核验修正后的确认窗口并完成上述剩余GUI项目。随后移除未使用的Arco依赖/样式，重跑定向测试与实际JAR检查、更新最终截图并正常同步。当前提交只备份已实现和已验证的增量，**不代表ADMIN-EVERGREEN-V3整项验收完成或上线**。
