# 快康养 Young Evergreen：第一阶段视觉标杆

任务 `ADMIN-EVERGREEN-V3`，2026-10-28（北京时间）。**三项可点击标杆已完成，等待 Owner 一次视觉确认；第二阶段正式迁移尚未开始。**

## 已完成与体验入口

基于本地与远程一致的 `57dd1d8e5fdadb8aa584511a74377a80884993f2`，在主项目 `admin-web/` 增加独立 `evergreen.html`。保留现有正式 React/Arco 入口；没有修改后端、小程序、问卷、推荐或真实业务开关。开始时已存在的配置、小程序样式、历史证据与文档归档改动未纳入本任务。

- 桌面工作台：1440px 的品牌侧栏、KPI、待联系列表、快捷入口、详情侧栏及空/错状态。
- 手机需求：独立卡片布局、搜索、状态底部弹层、全屏详情、联系记录与下一步、本页暂存及未暂存输入保护。
- 手机冲突：375px / 150% 字号，一次一个字段；本地与服务器样例版本显式选择，切换字段保留选择，全部选择后才能完成；固定单层底部操作与选值汇总。额外核对320px / 150%。
- A 为浅薄荷导航，B 为深青绿导航；每个标杆的 A/B 使用完全相同的内容、尺寸和操作。推荐 **A**：白色与浅绿形成主要空间，更符合明亮轻盈方向；B 的导航品牌识别更强。两者正文可读性与组件布局一致。

所有样例均显式标明合成、仅本页、不写入业务。工作台计数由完整的6条样例按现有状态计算，不把列表页长度、今日新增或行程场次冒充业务统计；读取失败展示“—”，空态展示0。手机样例状态沿用待联系/跟进中/待安排，冲突使用实际 `publicProfile` 字段 address/name/nature/room。没有个人联系方式、真实机构事实或API写入。

从主根启动：

```powershell
npm --prefix admin-web run dev:evergreen
```

打开 `http://127.0.0.1:5174/p1-admin/evergreen.html?view=dashboard&variant=a`。`view` 可选 `dashboard`、`requests`、`conflict`；`variant=a|b`，`font=150` 设置24px根字号。手机原型按375px视口查看；这是独立评审入口，不替代正式 `/p1-admin/`。

[真实截图对照页](../../../output/admin-evergreen-v3-20261028/review.html)包含桌面、手机、150%冲突与旧版对照；本机本轮另在 `http://127.0.0.1:5175/review.html` 提供浏览。旧版截图来自此前V2，仅比较风格，数据与拍摄时点不同，不能比较计数。

## 组件与工程隔离

保留 React 18.3.1，锁定 Ant Design **6.6.8**、Ant Design Mobile **5.43.0**。本轮查询官方 npm 发布元数据：前者 peer React >=18，后者兼容16.8/17/18/19；官方文档分别说明 [Ant Design 6最低React18](https://ant.design/docs/react/migration-v6/) 与 [Mobile 5默认兼容React16–18](https://mobile.ant.design/zh/guide/v5-for-19/)。未安装TDesign，Arco只在确认后迁移完成时清理。

品牌基础颜色统一来自 `src/evergreen/tokens.ts`：桌面 ConfigProvider 与手机 CSS变量共用。两类展示组件按页面懒加载，原型不加载 Arco/原主题；原型构建使用独立 Vite 配置，输出至 `output/admin-evergreen-v3-20261028/prototype-build`，正式构建的 manifest 不包含原型。

生产型原型构建按manifest静态依赖（不含另一端动态分支）计算：桌面 gzip JS 258,988字节/CSS 2,843字节；手机 gzip JS 93,367字节/CSS 6,624字节。桌面主组件chunk仍有约650KB未压缩警告，正式迁移需继续按模块拆分；不把第一阶段原型当最终包体。现有正式入口初始JS 638,106字节、CSS 274,090字节，与V2基线一致。[包体明细](../../../output/admin-evergreen-v3-20261028/bundles.json)。

## 本轮验证与限制

- TypeScript、原型构建、原正式构建、`check:admin-web` 通过。
- 45项前端测试通过，1项live接口测试因未启动隔离后端而跳过。新增6项覆盖空/错计数、无网络写入、筛选、逐字段选择、未选不能完成、草稿/浏览器前后退保护。[测试日志](../../../output/admin-evergreen-v3-20261028/frontend-tests.log)。
- 真实Chrome点击桌面空态/错误/重试；手机状态筛选、详情、样例联系暂存、未暂存返回提示、保留后再进入、浏览器返回提示；冲突四项选择/完成、回到上一项保留值。只证明原型交互，不证明服务器联系、保存、409或发布。
- 最终实测桌面1440×900、手机375×812，冲突375及320×812 / 根字号24px；scrollWidth等于clientWidth，无横向溢出。Chrome滚动条占23px，375视口内容宽352px，准确数据及触摸尺寸见 [GUI记录](../../../output/admin-evergreen-v3-20261028/gui/gui-summary.md)。
- 最终有效截图以 `final-` 开头；截图工具出现平铺，按实际视口裁去重复区域，没有修改页面内容。滚动后截图错位，未作为有效证据；滚动/服务器选值以实际点击与无障碍状态核对。粉色翻译浮标来自浏览器扩展。
- 150%为应用阅读字号16→24px，未称作浏览器150%缩放。未做真机、iOS Safari/WebView、虚拟键盘及全尺寸矩阵；这些属于确认后的第二阶段验收。
- 第一阶段没有运行MySQL/API业务闭环、后端契约测试或重新打包JAR。原正式构建保持隔离的检查通过，但不代替第二阶段的实际JAR资源、深路由与服务端验收。

本轮 `npm audit` 报8项（2低、3中、1高、2严重）：新增Mobile依赖链deepmerge相关2项低风险，另有既有测试工具/路由/Zod告警。未执行强制升级或改动保留契约；进入正式交付前需针对实际依赖路径评估与修复，不能把原型验证写成生产安全验收。[原始审计](../../../output/admin-evergreen-v3-20261028/dependency-audit.json)。

当前执行进程检测为Windows高完整性；本轮限于本地独立原型、定向测试与分支同步，未执行大规模正式迁移或部署。第二阶段优先切普通权限环境。

## 确认后的迁移接点

| 链路 | 沿用与迁移边界 |
|---|---|
| 身份/API | `api/client.ts` Session/Cookie/CSRF、epoch隔离与错误解释继续保留；`api/schema.ts` 继续做外部响应边界校验。 |
| 联系/排期 | `RequestDetail.tsx`、`Visits.tsx` 中已验证操作函数与请求体保持；替换表单展示，沿用 `state.tsx` pending原请求重试、操作ID与关联校验。 |
| 机构编辑/409 | `Institutions.tsx` 的草稿revision、dirty、来源确认失效、record/publicProfile联动、价格与高级事实比较保留；把表单访问改为共享业务状态后再接独立移动分步界面，不重写后端契约。 |
| 不可变发布/资格 | 保存、确认、发布、独立接入各自revision和pending继续区分；逐项选值只是本地合并，仍须原保存/重新确认链路。 |
| 服务报告 | 筛选变动失效、完整范围统计、固定snapshotId及同批Excel下载保持；手机改为指标/展开明细。 |
| 打包 | 继续同源 `/p1-admin/`、现有API和Spring Boot资源链；正式迁移通过后才删除Arco及旧主题，不保留三套UI体系。 |

下一步只需 Owner 对当前 A/B 标杆做一次视觉确认。确认后在**同一任务**继续五业务模块、登录及独立移动布局迁移，接隔离MySQL完成真实API/GUI闭环、尺寸矩阵、打包与按需加载验收。当前没有替 Owner 选择并铺满页面，没有合并main、云部署、开放真实服务或微信上传。
