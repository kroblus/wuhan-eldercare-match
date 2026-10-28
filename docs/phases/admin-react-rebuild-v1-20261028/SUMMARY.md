# React 运营后台完整重建

任务：ADMIN-REACT-REBUILD-V1-20261028。日期：2026-10-28，北京时间。

## 成果与范围

`admin-web/` 已用 React 18、Vite、独立 TypeScript 5.9、Arco Design 与图标、React Router、Dayjs、Fetch 和 CSS Modules 完整替换旧原生 HTML/JS 工作台。旧 app.js、operations.js、publications.js、style.css 已移除；五个页面均为真实业务页面。根小程序 TypeScript 4.1.2、推荐规则、共享源码与正式业务开关未改变。

| 模块 | 现在可操作的内容 |
|---|---|
| 工作台 | 四组服务端总数、最近待处理需求和业务入口；不把首页有限条数当总数 |
| 需求管理 | 服务端分页、状态/类型/机构/北京时间筛选、详情、联系记录、反馈、下次行动、明确拒绝及时间线 |
| 带看日程 | 日期与状态查询；新建意向、编辑、双方确认、改期、取消、已到访、未到访；负责人占用与机构容量维护 |
| 机构资料 | 新草稿、公开字段、价格编辑、高级事实、来源确认、不可变版本发布、独立服务资格、文件/粘贴基线导入及保留历史选项 |
| 服务报告 | 全筛选范围聚合、画像/来源/机构统计、口径和小样本提示、服务端同批快照 XLSX；改筛选立即禁用旧导出 |

没有新增收费、佣金、结算、身份服务或 AI 排序。机构未知事实继续保持未知；模板不伪造核验。所有本次业务操作使用隔离合成库。

## 结构、交互与接口迁移

入口 `src/App.tsx` 负责登录、布局、路由和会话；`pages/` 五个懒加载模块，`components/RequestDetail.tsx` 共用联系与排期操作。`api/schema.ts` 在 HTTP 边界确认响应结构及关联，`api/client.ts` 统一同源请求、超时和错误；`state.tsx` 保留待核对原请求。

- Cookie 继续由服务端管理，Session/CSRF 只在内存。401 清除界面数据；失效会话的迟到响应不能恢复旧数据。没有 localStorage/sessionStorage 凭证、定时轮询或 HTML 注入。
- 未保存表单拦截路由离开与关闭；结果不明时锁住原操作 ID 和原 payload，由用户核对或明确重试，不自动重复写入。查到联系已保存后，只重置对应表单，保留其他未保存输入。
- 409 保留编辑。机构双窗口冲突可查询服务器版本、按中文字段比较、逐项采用服务器值或保留本地内容，再人工合并保存。任何资料编辑立即禁止发布；重新保存后需要新的来源确认。确认过旧版本不等于确认新版本。
- 机构服务资格独立于公开版本；导入保留显式日期和历史 revision。发布时间、版本号和排期冲突仍由现有事务后端决定，前端没有放松门禁。
- 时间展示和 datetime-local 输入统一北京时间。日期筛选转换成后端 UTC 边界；排期交通缓冲、负责人/家庭冲突、并发和幂等继续由原 API 检查。
- 报告只展示与下载服务器完整范围的快照，筛选变化、迟到预览和迟到下载均有过期保护，不用当前列表页拼报表。

旧后台断言迁移到 React 组件和客户端测试；原小程序 P1 检查保留。旧 DOM 选择器不再作为新框架验收依据，功能映射见本机 [迁移盘点](../../../output/admin-react-rebuild-v1-20261028/contracts.md)。

## 视觉与实际截图

Warm Swiss Enterprise：主橙 `#FF6A00`、按下 `#E85E00`，深色文字、浅中性色面板、统一间距/圆角/边框和系统中文字体；不依赖在线字体或海外 CDN。左导航、页头、内容区与抽屉统一，窄屏允许表格局部滚动，页面不产生全局横向溢出。Arco 主题变量在实际 body 范围覆盖，解决默认蓝色残留；字号可在后台切换 100%/150%。

| 画面 | 本轮截图 |
|---|---|
| 工作台 | [1440 首页](../../../output/admin-react-rebuild-v1-20261028/gui/final-dashboard-1440.jpg) |
| 需求 | [筛选列表](../../../output/admin-react-rebuild-v1-20261028/gui/requests-filter.jpg)、[375px 大字号详情](../../../output/admin-react-rebuild-v1-20261028/gui/request-drawer-375-font150.jpg) |
| 日程 | [日程页](../../../output/admin-react-rebuild-v1-20261028/gui/visits.jpg)、[确认带看](../../../output/admin-react-rebuild-v1-20261028/gui/visit-confirmed.jpg) |
| 机构编辑 | [保存后标题](../../../output/admin-react-rebuild-v1-20261028/gui/final-institution-title.jpg)、[375px 大字号编辑](../../../output/admin-react-rebuild-v1-20261028/gui/institution-editor-375-font150.jpg)、[中文冲突比较](../../../output/admin-react-rebuild-v1-20261028/gui/final-conflict-chinese-compare.jpg) |
| 报告 | [1440 报告](../../../output/admin-react-rebuild-v1-20261028/gui/final-report-1440.jpg) |

原始记录：[GUI 验收与尺寸读数](../../../output/admin-react-rebuild-v1-20261028/gui/gui-summary.md)。截图与日志为本机 output 证据，不含在 Git/Drive 回执中。早期报错截图保留供追踪，不代表修复后的状态。

## 验证结果与边界

| 项目 | 本轮证据与结果 |
|---|---|
| 前端 | 类型检查、构建通过；38 项组件/客户端测试加 1 项真实合成 HTTP 契约测试，共 39 通过。CI 没有本机私有库，明确跳过该 1 项 live 测试 |
| 后端 | Java21 + 隔离 MySQL：机构发布15、P1/服务边界/排期/报表43、Node校验3、静态路由2，共63通过，0失败0跳过 |
| 管理员 | 浏览器合成登录、刷新会话及退出；实际生产型 JAR 另做13项HTTP认证/CSRF/退出检查。Secure、HttpOnly、SameSite=Strict、管理员 API Path 保持 |
| 需求/联系 | 实际浏览器筛选总数317→107、详情与联系保存；组件测试覆盖干净状态、结果未知原请求重试、读回已保存记录及冲突保留输入 |
| 带看 | 浏览器新建意向、修改备注、双方确认；组件测试覆盖操作与资源请求、冲突/失败恢复、北京时间转换；MySQL回归覆盖缓冲、并发、改期/结果事务 |
| 机构发布 | 浏览器新建草稿；现有机构保存→来源确认→发布v3；双窗口真实409→比较→保留本地→手工合并→再保存确认。组件测试覆盖编辑失效、未知发布读回和历史导入 |
| 服务资格 | 保持独立，浏览器发布后服务仍未启用；HTTP/MySQL及组件测试覆盖资格边界，资格读回不覆盖未保存公开资料 |
| 报告/XLSX | 浏览器生成真实服务器聚合与点击导出；组件覆盖同批快照、筛选过期、错误与下载请求；后端报表/XLSX测试通过。本轮浏览器下载文件最终落盘尚未确认 |
| 交叉影响 | 原 P1 runtime 与架构边界检查通过；CI保留小程序源检查。没有改共享小程序代码，因此未重复双模式微信构建/真机验收 |

详见 [最终前端日志](../../../output/admin-react-rebuild-v1-20261028/frontend-tests-final.log)、[后端定向日志](../../../output/admin-react-rebuild-v1-20261028/backend/backend-tests.log)。GUI业务操作运行于端口18341的 Spring 测试类路径合成服务，使用真实 HTTP/MySQL 与构建后的 React，不是 Vite 页面；它不代表正式身份或生产业务。

浏览器自动化策略拒绝 `chrome://downloads/`（仅允许 HTTP/HTTPS），本次没有绕过。导出按钮只提示“已发起下载”，不能把触发 Blob 下载等同于确认文件落盘。

## 实际 Spring Boot JAR

Maven `generate-resources` 每次清除旧后台生成目录，执行独立 `npm ci`、类型检查与 Vite build，随后递归打包全部资源；任一步失败即中止。缺 dist 不回退旧 HTML。根 `npm ci` 仍是现有服务端领域校验器构建前提。

最终本机 JAR：`server/target/visit-submission-server-0.1.0-SNAPSHOT.jar`；SHA256：`bc046910aa8ae99c49d3684d1e5ce9d9a82c9883f450102d01501899b064c3ea`。

实际 `java -jar` 验证23个静态文件逐个内容一致、36项HTTP检查通过；入口 `/p1-admin` 重定向补斜杠，根及五个已知深路由回退 React index，未知路径/缺失 JS/CSS/API 保持404。前端 base `/p1-admin/`，接口 `/api/...` 保持同源，无海外CDN。详见 [资源与路由结果](../../../output/admin-react-rebuild-v1-20261028/backend/jar-smoke-final/result.json)。

最终 JAR 另以全部业务关闭、未连数据库方式启动在临时 loopback 端口供浏览器检查；[根登录页](../../../output/admin-react-rebuild-v1-20261028/gui/jar-login-final.jpg)与[机构深链刷新](../../../output/admin-react-rebuild-v1-20261028/gui/jar-deep-link-final.jpg)记录实际 React 加载。临时端口只用于本轮取证，结束停止。

实际 JAR 的 [13项认证结果](../../../output/admin-react-rebuild-v1-20261028/backend/jar-auth-final/result.json)使用隔离 disposable 库，仅检查进程临时启用 C4 与机构维护以满足既有登录门禁；P1接单、C5、C2写入仍关闭，未发送发布/业务变更，10张业务表前后数量相同。Node在loopback HTTP中显式携带Secure Cookie，这验证协议分支，不替代浏览器正式HTTPS Cookie验收。

## 性能与大字号

[最终构建体积](../../../output/admin-react-rebuild-v1-20261028/assets-final.json)：初始JS 638,583字节（本机gzip 195,049），初始CSS 271,337字节（gzip 29,988），五个业务页面独立懒加载。按实际依赖引入Arco样式，初始CSS从整包约580KB降至271KB；gzip为本机计算，未宣称线上已启用压缩。

本机 Chrome 单次合成运行：登录态刷新 FCP 104ms，工作台数据渲染就绪279.3ms；该次14条资源记录含6条API。需求翻页与状态查询各1条API、详情2条、输入备注0条。工具点击起点到页面标记：需求221.1ms、日程1162ms、机构1150.5ms，含自动化点击调度，不作为纯应用延迟或线上承诺。报告生成预览91.3ms、1条API；它不是报告导航耗时。

实际检查1440、1280、768、375px及100%/150%应用字号，含375px机构编辑和需求抽屉输入，无页面级横向溢出。系统比例使精确1024px不可达，实测1023/1025覆盖两侧。快捷键未改变浏览器缩放，因此**浏览器真实150%缩放未验证**；不可用应用字号结果冒充。没有中国公网、低配电脑或手机性能测量。

## 国内云部署准备

同一套可执行 JAR 和内置静态资源可用于具备相同运行条件的阿里云 ECS、腾讯云 CVM，不绑定某家云API。这里是部署准备说明，未购买/创建/登录云资源，也未部署生产。

- 构建：Java21、Maven、Node24/npm；生产运行：Java21、MySQL8，以及现有机构发布校验器所需Node24。React静态页面无需Vite/Node网页服务，但不能据此省略后端发布校验器的Node依赖。
- 入口：获批域名/HTTPS证书，反向代理保持 `/p1-admin/` 与 `/api/` 同源，后端仅受控网络可达；保留Cookie安全属性与CSRF，不放宽跨域。index与管理员API不缓存，哈希静态资源可长期缓存。
- 配置：数据库、管理员和身份凭证由部署环境注入，不放前端、仓库、访问日志或响应正文日志。业务开关默认关闭；真实管理员维护、P1接单、C5、C2各自按批准条件接线。
- 运维：管理员访问控制、TLS续期、进程/磁盘/数据库监测，使用实际配置接口与静态资源探测；未声称已有健康探针平台。数据库先备份并验证恢复，Flyway按现有迁移执行，不自动降级数据库。
- 回滚：保留上个已验证完整JAR与对应外部配置，确认数据库schema向后兼容后切回；本次无新migration。Maven的 `.jar.original` 不是上一发布版，不能当回滚包。

尚缺：真实服务器与网络授权、域名/证书、正式数据库与备份恢复演练、正式管理员凭证和访问策略、真实C5/机构资料来源及获批数据处理方案、浏览器HTTPS验证。没有补造Redis、Kubernetes、云监控或微信合法域名的配置完成状态。

## 可复现启动与验收

主根 PowerShell；安装 Java21/Maven/Node24/MySQL8，并正确设置 `JAVA_HOME`。全新拉取先运行：

```powershell
npm ci
mvn -f server/pom.xml -DskipTests package
./server/tools/check-admin-jar.ps1 -JavaExecutable "$env:JAVA_HOME/bin/java.exe"
```

最后一步自行启动/检查/停止真实JAR，默认业务全关闭。需持续查看无业务登录页时可在单独终端执行以下命令，结束按 Ctrl+C：

```powershell
& "$env:JAVA_HOME/bin/java.exe" -jar server/target/visit-submission-server-0.1.0-SNAPSHOT.jar --server.address=127.0.0.1 --server.port=18342
```

打开 `http://127.0.0.1:18342/p1-admin/`；默认未配置业务时不能登录是正常关闭行为。

朋友在**本台已有隔离库的电脑**操作完整合成业务：

```powershell
./server/tools/resume-p1-synthetic-mysql.ps1
./server/tools/start-p1-synthetic.ps1 -DatabaseSettings output/p1-1/mysql.private.json -JavaExecutable "$env:JAVA_HOME/bin/java.exe" -OutputDirectory output/admin-react-rebuild-v1-20261028/backend
```

打开 `http://127.0.0.1:18341/p1-admin/`；仅在本机查看该输出目录的 `runtime.private.json` 取得合成账号，勿上传/分享该文件。此类私有设置不在Git；全新电脑需按[原隔离试用说明](../release-readiness-v1-20261028/SUMMARY.md)准备自己的disposable环境，不连接真实用户库。

依次验收登录/刷新→工作台总数→需求筛选和联系→带看意向/确认/改期/结果→机构保存/确认/发布与双窗口冲突→服务资格独立→报告筛选/预览/下载→退出。检查丢失响应时核对原操作、编辑离开提示以及375px大字号输入。结束：

```powershell
./server/tools/stop-p1-synthetic.ps1 -OutputDirectory output/admin-react-rebuild-v1-20261028/backend
```

定向前端检查：`npm --prefix admin-web run typecheck`、`npm --prefix admin-web test`、`npm --prefix admin-web run build`、`npm run check:admin-web`。真实合成HTTP测试需服务已启动，在当前PowerShell临时设置 `ADMIN_LOCAL_HTTP=1` 后运行测试，结束移除该环境变量。CI包含安装/类型/测试/构建/资源检查并保留原源码门禁；CI不代表数据库或浏览器验收。

下一步是朋友独立走完上述流程，人工确认下载文件、真实浏览器缩放和正式HTTPS；真实接线与部署继续按已有授权边界处理。本轮不合并main、不部署、不上传微信、不启用真实业务。
