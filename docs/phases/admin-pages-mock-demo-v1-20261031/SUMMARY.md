# 快康养桌面／移动互动演示

任务：ADMIN-PAGES-MOCK-DEMO-V1-20261031。日期：2026-10-31，北京时间。

## 使用入口与边界

已实际发布并从公网打开：<https://kroblus.github.io/wuhan-eldercare-match/>。电脑和手机使用同一地址，无需安装 Node 或启动后端；可直接分享 `https://kroblus.github.io/wuhan-eldercare-match/#/dashboard` 等 hash 深链。

点击“进入演示工作台”，无需账号、密码、手机号。身份为“演示运营员”。全站使用合成记录，既不联系真人，也不发布真实机构资料。公开前端不是认证或多人权限服务。

朋友可这样体验：

1. 从“演示工具”新增模拟咨询或带看意向，打开详情记录联系结果和下一步。
2. 新增带看，先保存待确认，再勾选双方确认并排期；可改期或逐场取消。未来不能提前登记到访，工具内另有可登记到访的历史场景。
3. 在机构资料新建 `demo-` 开头的稳定 ID，名称使用“合成演示”前缀；编辑介绍、价格和事实，保存、模拟确认后发布。修改后确认失效，重新确认再发布下一版；演示工具提供固定 V1/V2 链接。
4. 在服务报告选择日期和范围，生成批次，下载同一快照的绿色四页签 Excel。改变筛选后旧下载禁用。
5. 工具内可导出进度 JSON，在另一设备手动导入。校验通过、确认覆盖后才替换；恢复初始、空场景、清除本项目数据是独立操作。退出只结束演示会话。

同一浏览器配置文件的标签共享一份 IndexedDB 数据；电脑、手机、微信内置浏览器、隐私窗口和不同浏览器互不自动同步。请只输入合成资料，进度文件不要放入 URL、二维码或 GitHub。

## 模块与操作覆盖

| 模块 | 已实现操作 | 一致性与限制 |
|---|---|---|
| 工作台 | 全量状态总数、最近待联系、状态跳转、快捷办理 | 从完整数据计算，未用当前 25 条分页求总数；状态存量不冒充今日新增或行程场次 |
| 需求与联系 | 类型／状态／机构／北京时间筛选、分页、详情、事件、已接通／未接通／拒绝、下一动作、有来源反馈、模拟新增 | 写入后列表和计数更新；拒绝联系结束待办；同操作重试保持原回执；联系人为不可拨打的演示编号 |
| 带看日程 | 待确认、双方确认、改期、逐场取消、到访、未到访、负责人不可用、机构容量 | 原子核对负责人／认证账号／容量及准备交通缓冲；失败保留旧安排；不按电话推断家庭，不模拟外部通知 |
| 机构资料 | 草稿、公开介绍和价格、高级事实、模拟来源确认、不可变发布版本、独立服务资格、文件／粘贴基线导入 | draftRevision、recordRevision、accessRevision 分开；确认后修改失效；真实双标签旧版本冲突保留本地值并可核对合并；历史绑定版本不换成最新 |
| 服务报告 | 全量期间活动、同批转化、平台与机构独立去重、来源、零／缺失／小样本、冻结预览与 XLSX | 沿用 p1-aggregate-v2-k5；未采集画像不补造；快照不因后续业务修改重算；Excel 无个人明细或隐藏联系人页 |
| 演示工具 | 恢复、清除、空场景、历史到访、指定写入前失败／保存后丢响应、会话失效、进度导入导出 | 故障显式开启一次、全局标记；进度上限 2 MiB，验证版本／标记／关联后覆盖；不同标签重置时旧草稿失效 |

初始为 76 条需求、7 家合成机构，覆盖待联系、跟进、待安排、确认、到访、未到访、结束、取消及无草稿／草稿／已确认／发布／未接入服务。场景内容按索引确定，首次初始化以北京时间日期锚定；记录与数据集使用独立 UUID，刷新不重播种，不平移旧日期。

## 构建与数据隔离

- 正式入口保留 `/p1-admin/`、Browser Data Router、真实 API、Cookie／CSRF 和原登录流程，Maven 仍只复制 `admin-web/dist/`。
- `vite.public-demo.config.ts` 编译时替换 experience 与 transport，使用同一套路由和业务页面；Hash Data Router 保留未保存保护。没有运行时真／假开关，没有真实请求失败回退 Mock。
- Demo 初始化 IndexedDB 后才挂载 React。每次写入在单个 readwrite 事务内核对版本、操作回执并保存；跨标签由 BroadcastChannel 通知，缺失时用本项目 localStorage 的纯通知替代。读操作不广播写事件。
- 数据含 schemaVersion、seedVersion、datasetId、generation 和合成标记。重置增加 generation，旧异步结果不能写回。存储不可用明确阻止保存；不兼容版本可原样导出后显式重置，更新不静默清数据。
- 报告快照保存在同一数据层；浏览器按需加载 `fflate 0.8.3`（MIT）生成标准 OOXML ZIP，不调用 Java、不伪装 CSV。Playwright 与 fake-indexeddb 为测试依赖（Apache-2.0）；未升级既有 UI 主要依赖，保留 file:vendor/deepmerge 补丁。
- 发布产物 CSP 禁止连接请求；只含本地打包资源。构建模块图拒绝真实 transport、生产 experience 和机构数据集，产物扫描同时检查正式包没有 Mock 登录、seed、故障面板。第三方 Router 的 localhost 字符串是 URL 解析占位，不是服务依赖，实际请求另由浏览器检查。
- 无 Service Worker、PWA、外部字体／图片、埋点、外呼、第三方上传或真实数据库。未知 Mock 端点明确失败。

## 可运行命令

在项目根执行，Node 固定为工作流中的 24.18.0，安装依赖使用锁文件：

```powershell
npm ci --prefix admin-web
npm --prefix admin-web run dev:public-demo
npm --prefix admin-web run build
npm --prefix admin-web run build:public-demo
npm --prefix admin-web run test:public-demo
npm --prefix admin-web run check:public-demo-isolation
npm --prefix admin-web run preview:public-demo
npm --prefix admin-web run test:public-demo:e2e
```

首次 E2E 需在 admin-web 内执行 `npx playwright install chromium`。预览服务器只服务 `/wuhan-eldercare-match/` 下真实文件，不提供 history fallback。正式 `npm run build` 与原 Maven 入口不变。

## 验证与本机证据

当前本机结果：119 项前端测试通过，1 项需单独启用的后端实连测试跳过；其中 49 项为本轮 Mock／报表／XLSX 定向测试。npm audit 0 告警。生产及 Demo 构建、模式隔离通过。Maven 打包和实际 JAR 21 个静态文件、36 次 HTTP 接线检查通过，真实业务保持关闭。

16 个统一 E2E 场景全部通过（本机最终一轮 1.2 分钟）。浏览器自动化使用独立 Chromium 环境和纯静态服务器：桌面 1440、手机 390 和 320 压力宽度分别跑完整故事，包含实际 download 事件、文件保存、ZIP／XML 解析、四页签、批次与预览数字核对；另覆盖新浏览器独立、刷新、hash 深链、返回前进、异常路由、两标签冲突、基线导入、进度恢复及故障幂等。

375／390／430／768／1280／1440 和额外 320 像素，分别验证 100%／150% **应用字号**及六个页面。修复了 320 像素进度文件选择框撑宽、机构列表服务资格漏映射、种子待安排场景缺失及演示文案不一致。实际浏览器 zoom 与应用字号分开，未将缩小 viewport 当作真实缩放。

本机证据目录为 `output/admin-pages-mock-demo-v1-20261031/`，不上传到公开仓库：

- `local-e2e.log`、`e2e-artifacts/`：统一自动化结果、各尺寸截图、网络附件及可解析合成 Excel。
- `local-synthetic-report.xlsx`、`workbook-报告总览.png` 等四页渲染：下载文件的绿色主题复核，公式错误搜索无命中。
- `maven-package.log`、`jar-smoke/`：正式包及实际 HTTP 静态资源核对。
- `security-final-scan.json`、`security-review.md`：脱敏安全清点及人工复核边界。
- `desktop-two-tab-conflict.png` 等原生 Chrome 截图属于本地中途构建；不能当作最终构建或公网证据。

本机文本扫描覆盖 173 个可达提交、3758 个去重 blob；未发现确认的真实凭证或未决文本候选。当前 14 个及历史 828 个二进制／超限对象仅清点，未做 OCR，不能声称全部历史截图／PDF 都已穷尽检查。检查未上传候选值或源码到外部扫描服务，未改写历史或修改仓库公开状态。

## GitHub Pages 发布

专用工作流为 `.github/workflows/deploy-public-demo.yml`，保留原源码 CI。仅本仓库 `codex/unified-source-baseline` 的 push／可选 dispatch 可部署；PR 只检查。verify 只读 contents，全部测试通过才上传唯一 dist-pages；deploy 仅 pages:write、id-token:write，经 github-pages 环境发布。没有 PAT、外部发布服务或 main 合并。

已通过现有 gh 登录设置 Actions 来源，并在原 github-pages 环境策略中新增当前工作分支，未撤销已有规则或审批。官方动作按查询到的 commit SHA 固定，参见 [GitHub 官方自定义 Pages 工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

首次实际发布：[Pages run 41173026768](https://github.com/kroblus/wuhan-eldercare-match/actions/runs/41173026768)，verify 与 deploy 均成功，部署输出 page_url 为上方地址。2026-10-31 13:36（北京时间）部署提交 `74903725e3e7d93c1ac860d400590b409ac53f59`，公网 `build-info.json` 的 PUBLIC_DEMO 与 SHA 一致；证据为 `public-build-info-first.json`。后续交付提交的最终 SHA、源码 CI 与 Pages run 保存在本地交付回执及最终回复，站点当前 SHA 可直接查看 [build-info.json](https://kroblus.github.io/wuhan-eldercare-match/build-info.json)。

首次源码 CI 的旧全局 localStorage 禁令误包含编译隔离的演示偏好和跨标签通知，已限定仅这两个演示文件允许；其余生产限制及禁止清空整个域名存储的检查保留。修复后本地 `check:p1` 通过；源码 CI 与 Pages 分开核对，不以首次 Pages 成功掩盖该检查失败。

公网全新 Chromium 上完整重跑相同 16 个 E2E，全部通过（2.7 分钟）。桌面 1440、手机 390、压力宽度 320 的核心故事、机构 V1/V2 与双标签冲突、刷新持久化、hash 深链、进度导入与重置、7 个尺寸的 100%／150% 应用字号均从真实 Pages 地址执行。三条核心故事记录的请求均限本项目静态路径，外域／真实业务请求为 0；下载事件成功落盘，解析四个工作表，snapshotId 与新需求合计同预览一致。公网下载另经四页渲染及公式错误搜索（0 命中）。

公网证据仍只保存在本机 `output/admin-pages-mock-demo-v1-20261031/`：`public-e2e.log`、`public-e2e-artifacts/`、`public-playwright-report/`（含网络附件）、`public-desktop-report.png`、`public-mobile-report.png`、`public-synthetic-report.xlsx` 和 `public-workbook-报告总览.png` 等四页渲染。它们是公网成果，区别于前述 localhost 与中途原生 Chrome 证据。

## 尚未验证的范围

本轮 adb 未检测到 Android，真机／软键盘／微信内置浏览器待验；未沿用前次真机 PASS。原生桌面控制工具因不能可靠确认 Chrome 当前地址而中止后续操作，真实浏览器 150% 缩放没有本轮新证据。手机 viewport 自动化与真机分开说明。

中国大陆不同运营商、移动数据与 Wi-Fi 可达性待朋友实测，不保证所有网络可用；未增加代理或第三方镜像。本轮未部署真实后端、未开启真实接单、未修改云资源、未上传微信。朋友下一步只需打开最终公开链接试用合成流程。
