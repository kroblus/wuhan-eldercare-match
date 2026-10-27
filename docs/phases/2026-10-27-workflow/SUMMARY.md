# 2026-10-27：主根收拢与 V4 工作流已合入

最新活动目录的磁盘源码已成套导入 wuhan-eldercare-match；603 个前端/模式/脚本等文件迁入时逐字节一致，包含 9 个未提交文件。旧主根和活动目录各有已验证的 Git bundle 与文件快照。保留两个独立仓库关系，未覆盖 .git、提交、推送或上传微信版本。

现在从根 README 按任务进入当前 PRD/MVP、任务地图及阶段/历史索引。原 23 份阶段报告、V1.2 PDF、三个 Skill、旧后端与相关契约均保留。六个角色配置完成；现有四角色模型已刷新，新增两角色仍需新会话确认；本轮未实际调用 Terra。

## 实际验证与未完成项

- npm ci 按原锁文件完成；未升级依赖或修改 lockfile。production/demo 均通过 TypeScript 4.1.2、Less、原生 WXML、生成语法构建，各 30 路由。
- check:run-mode-convergence 通过，覆盖 Demo 会话、机构详情、问卷画像推荐、模拟看院评价和真实网络/存储隔离。
- 两个主根产物在 DevTools 打开，首页截图成功：[production](../../../output/workflow-v4/production.jpg)、[demo](../../../output/workflow-v4/demo.jpg)。Demo 显示虚构数据标识；currentPage 自动化读取两次超时，不能声称该接口通过。
- TOML/JSON、权限/MCP/Skill 保持、锁文件、Git 忽略、文档链接和治理检查通过（120 registry entries）；CLI strict startup 配置通过。
- 两工具 node --check 通过。History 准备器验证根内默认/显式目标、已有目录拒绝、非目录父级、junction、缺 server/fixture 无残留、AppID 限制及 manifest；没有启用正式保存、没有启动后端。
- 新别名 check:c1:domain / check:c1:composition 确实调用已有脚本，但分别在第 305/303 行失败：预期 blocked_by_required_clarification，实际 ready。两项在原活动目录复跑同样失败，属于迁移前既有基线问题；日志在 output/workflow-v4/c1-*.log。本次未改领域语义以刷绿。
- 未做手机验收、MySQL/C2 正式服务验证、上传、提审或发布。旧 B1.2.6 验收属于历史证据。

## 入口、归档与恢复

唯一日常源码根：C:/Users/16562/WeChatProjects/wuhan-eldercare-match。微信入口：主根 dist/demo 与 dist/production；根配置仍为开发 Mock。

三个旧演示目录 partner-demo、partner-demo-s2、showcase/vr-map-interactive-v1 已移到恢复区 retired-main-trees，旧工具也已保全。server 原位保留并标明历史 TEST_ONLY。

原活动目录 wuhan-eldercare-v2-1-b1-2-4 的旧 Demo 窗口已关闭，但 git worktree move 两次被 Windows 以 Permission denied 拒绝；原路径仍完整保留，作为恢复来源退出日常开发，不强删、不强制移除。其他 23 个相关目录只记录 Git 归属与修改状态，独有材料未逐个确认，不删除。

恢复入口：[archive/recovery/2026-10-27-workflow-v4/README.md](../../../archive/recovery/2026-10-27-workflow-v4/README.md)。main/active 文件 ZIP 与 manifest 保存迁移前文件；bundle 保存历史，原主根 output/tmp 证据未动。两包原件未改写。

后续更新：2026-10-27 已定向修复 C1 测试，两组检查完整通过，详见 [C1-A 复验说明](../../design/V1_3_C1_A_IMPLEMENTATION_REPORT.md)；上文失败记录保留为迁移当时的证据。当前可进入 C1-B 推荐页面接入，C2 正式历史仍待开发。旧活动目录解除占用后可用正常 git worktree move 归入恢复区，不能因路径整理删除未保全成果。

DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED。未引入新的业务契约。
