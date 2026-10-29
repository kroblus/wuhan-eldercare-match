# 快康养 Young Evergreen：A 版迁移与验收记录

任务 `ADMIN-EVERGREEN-V3`。Owner 于 **2026-10-29 回复“A”**，随后授权补齐 GUI、清理 Arco 并提交推送。本机浏览器已完成尺寸覆盖、机构冲突合并与发布、Excel 下载文件核对；Arco 依赖与旧样式已删除。**结果限本机合成环境，未部署生产；真机、真实浏览器缩放与 HTTPS 浏览器仍未验收。**

## 当前能力与本轮修正

- 工作台、需求、带看、机构、报告和登录统一浅薄荷 A 版、深青绿主操作。桌面 Ant Design 6.6.8，手机 Ant Design Mobile 5.43.0；手机导航为工作台/需求/日程/更多。
- 手机需求卡片、全屏筛选/详情、联系与行程入口；日程按北京日期/状态分组；机构四步编辑、价格和完整核验 JSON 逐字段冲突选择；报告指标与可展开明细。跨视口保留输入，嵌套弹层共享滚动锁。
- 发现 Vite 条件动态导入只绑定桌面预加载、导致手机 CSS 未实际加载。拆为两个独立加载函数，首次手机访问及桌面切手机均实测恢复；构建检查直接核对生成代码的手机 CSS 预加载，不能仅靠 manifest 存在判定通过。
- 手机筛选原先有两个提交入口，实测外侧入口未更新列表。改为表单内唯一原生“查看结果”提交按钮；320/375 宽、150%字号均实测筛选成功，375重置成功。
- 应用内确认宿主重新实测通过。完成 GUI 后卸载 Arco，删除未使用的 `arco.css.ts`；构建检查断言依赖不存在、运行时代码无 Arco。未安装 TDesign。

React 18.3.1、Router、Vite/TS、同源 API 与业务契约保留；品牌变量共用 `src/evergreen/tokens.ts`。迁移涉及 `admin-web/`、检查脚本及后端 `/p1-admin/more` 静态白名单。本轮没有修改 API、认证、CSRF、幂等、机构发布契约、小程序或业务开关。开始时的 .codex 配置、小程序样式、PDF归档和旧证据目录未纳入提交。

## 最终浏览器验收

静态生产构建通过本机5176预览，连接隔离合成MySQL/服务。没有以Mock或截图冒充真实保存。

| 项目 | 结果与证据 |
|---|---|
| 五模块尺寸矩阵 | 100%/150%应用字号分别root16/24；每组5模块×10实际宽度，共100项，document scrollWidth均等于clientWidth。[100%](../../../output/admin-evergreen-v3-20261028/final-gui/retest-matrix-100.json)、[150%](../../../output/admin-evergreen-v3-20261028/final-gui/retest-matrix-150.json)、[汇总](../../../output/admin-evergreen-v3-20261028/final-gui/matrix-summary.json) |
| 宽度边界 | 实际320、375、390、429、431、768、1023、1025、1280、1440；工具整数输入和DPR量化无法得到精确430/1024，以429/431及1023/1025两侧夹测，不能称精确目标宽度通过。 |
| 手机操作 | 320/375、150%下状态+机构筛选返回105条；375重置回319条。筛选主要按钮高55–56px、最窄75px。四步编辑、未保存返回取消后保留、375→768输入保留、退出重登录通过。 |
| 联系与带看 | 前序GUI已真实写入合成“未接通”联系及2026-11-20待双方确认带看；未触发通知。本轮不重复制造相同记录。 |
| 首次发布 | synthetic-react-gui-new-20261028 从确认草稿7实际发布为第1版、草稿8；服务接入保持关闭。 |
| 价格/JSON冲突发布 | synthetic-release-gui-20261028 桌面双页409后选择服务器价格及完整JSON，保存18→确认19→发布5/草稿20；375/150再次双页409，逐项明确2/2选择，保存21→确认22→发布6/草稿23。 |
| 历史版本 | 发布6后，精确读取4/5版均200且内容SHA与发布前一致；6版可读取。[历史只读比对](../../../output/admin-evergreen-v3-20261028/final-gui/history-after-publication6.json) |
| 返回、横屏、焦点 | 浏览器返回、812×375横屏150%无横溢、Tab焦点可移动。实际触摸与虚拟键盘未测。 |
| 下载闭环 | 浏览器下载事件捕获超时；用户提供落地XLSX后只读核验：12797字节、4个可见工作表、同一snapshotId，ZIP完整、无Excel错误/宏/外部链接。与同快照服务器导出的全部ZIP项及整文件SHA完全一致。[文件核验](../../../output/admin-evergreen-v3-20261028/final-gui/download-verification.json) |

[最终GUI摘要](../../../output/admin-evergreen-v3-20261028/final-gui/gui-summary.md)。正确加载手机样式后重跑上述100项矩阵；随后筛选提交修正又单独复测320/375。前序stage2-gui及本目录早期未修正截图只保留为历史，不作为最终样式证明。

最终截图：[桌面1440/100](../../../output/admin-evergreen-v3-20261028/final-gui/final-dashboard-1440-100.jpg)、[桌面1440/150](../../../output/admin-evergreen-v3-20261028/final-gui/final-dashboard-1440-150.jpg)、[手机需求375/150](../../../output/admin-evergreen-v3-20261028/final-gui/final-requests-375-150.jpg)、[机构确认375/150](../../../output/admin-evergreen-v3-20261028/final-gui/final-institution-confirm-375-150.jpg)。裁切仅去工具输出的外部空白；桌面含合成管理员标签，粉色浮标来自浏览器扩展。证据保留本地output，不随Git/Drive上传。

## 工程验证

| 项目 | 结果 |
|---|---|
| 最终前端 | 清理Arco后类型检查通过；完整60/60项组件/API测试通过，0失败0跳过，见[最终测试](../../../output/admin-evergreen-v3-20261028/final-gui/frontend-tests-final.json)。包括实际本机合成Session、分页、草稿、报告快照/XLSX，以及幂等重试、响应未知读回、确认失效、移动冲突和视口保值。 |
| 最终实际JAR | 完整Maven执行npm ci/typecheck/build/package成功，未跳过前端构建。21个静态文件哈希匹配、36项真实HTTP通过；13项认证HTTP通过，Cookie Secure/HttpOnly/SameSite/路径正确，业务计数未变。[构建日志](../../../output/admin-evergreen-v3-20261028/final-gui/maven-final-retry.log)、[资源及HTTP检查](../../../output/admin-evergreen-v3-20261028/final-gui/jar-smoke.log)、[认证诊断](../../../output/admin-evergreen-v3-20261028/final-gui/jar-auth.log)。 |
| 静态包检查 | 五业务路由、两端组件按需加载；手机CSS实际预加载，另一端不被首屏加载；无Arco和外部CDN，小程序TS4.1.2保持。[最终包体](../../../output/admin-evergreen-v3-20261028/final-gui/assets-final-clean.json) |
| 之前的后端回归 | 前序迁移已在Java21/独立MySQL下通过63项，随后more静态路由单测2项通过。本轮没有后端业务修改，没有宣称再跑63项。[历史日志](../../../output/admin-evergreen-v3-20261028/backend-regression/backend-tests.log) |

首次最终打包与尚未结束的测试发生依赖文件占用，npm ci报EPERM、该次测试也失效；结束相关进程后按顺序完整重建并重新测试，不采用失败过程作为验收证据。执行权限为Windows Medium，未提升权限。

Arco删除后的最终构建再次经浏览器轻量复核：新开1440桌面入口，切375加载手机CSS，白底/绿色圆角按钮正确；实际待联系筛选返回105条，仅查询未写业务。

包体统计采用manifest静态依赖闭包，含工作台路由和当前视口组件；最终数值见JSON。gzip为本机计算，不等于服务器开启压缩，Ant桌面运行时注入样式不计入静态CSS。桌面chunk仍有大于500KB警告，未宣称性能全面优于旧版。

清理Arco后npm audit仍8项（2低、3中、1高、2严重），涉及Mobile/deepmerge、Router/Zod与Vitest/tinypool开发依赖；未强制跨主版本升级。既有使用路径限制不等于漏洞已修复或生产安全验收。[前序审计](../../../output/admin-evergreen-v3-20261028/audit-stage2.json)。

## 视觉确认与未覆盖范围

Owner已选A，不再请求第二次审美批准。第一阶段原型提交d76231cb31f0c6cb988c62014fcf8224dec0da7d，迁移提交eec5f07113f03cc46234453eb7aa5ebeba2116cb。[A/B原型及旧V2对照](../../../output/admin-evergreen-v3-20261028/review.html)。旧图只比较风格，不比较不同时点统计数。原型仍可用 `npm --prefix admin-web run dev:evergreen` 打开5174的 `/p1-admin/evergreen.html?view=dashboard&variant=a`。

应用150%字号不是浏览器150%缩放：快捷键未观测到真实zoom改变。Android/iOS真机、Safari/WebView、虚拟键盘、真实触摸、浏览器同源HTTPS，以及实际网络丢响应后的GUI重试仍未覆盖；后者仅有组件/接口回归证据。不会把这些边界写成全平台通过。

下一步是设备与正式HTTPS环境验收，以及依赖漏洞兼容升级。当前完成本机浏览器与构建交付；真实业务仍关闭，未合并main、部署云服务器或上传微信。
