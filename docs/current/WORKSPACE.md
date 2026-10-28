# 只维护一个主项目

目标：以后只打开 `wuhan-eldercare-match` 开发，当前活动工作区的源码直接成为它的 `miniprogram/`、`modes/` 和 `scripts/`。2026-10-27 已完成源码与配置收拢；2026-10-28 继续压缩保全并清理父目录的旧工程，实际结果见[清理说明](../phases/workspace-cleanup-20261028/SUMMARY.md)。以下保留迁移依据与以后约定。

## 每类东西放哪里

| 位置 | 放什么 |
|---|---|
| `miniprogram/` | 唯一共享前端源码 |
| `modes/` | Demo 与正式模式的覆盖/适配，沿用现有构建方式 |
| `scripts/` | 当前构建与检查脚本 |
| `server/`（已保留） | 旧主目录独有的后端实现参考；其 History 是 TEST_ONLY，不代表 C2 正式接通 |
| `dist/demo/`、`dist/production/` | 可重新生成的导入工程，不手改、不按阶段再复制源码 |
| `output/<任务名>/` | 截图、日志、对比、导出、临时准备项目 |
| `tmp/` | 可重建的短期文件；已有会自动清理的系统临时夹具可沿用 |
| `docs/phases/` | 值得长期保留的中文阶段总结与索引 |
| `docs/archive/README.md` | 历史文档及旧工程材料的导航 |
| `archive/recovery/<日期>/` | 这次迁移一次性的恢复材料；不是新的开发工程，不默认加入 Git |

## 为什么以前出现那么多目录

当前 B1 交接记录明确新建过 worktree；B1.2.1 又说明在新工作区操作、保留 B1/B1.1/B1.2/A2 不动。这是阶段目录逐渐增加的直接来源之一。

两个包中的旧 `prepare-assessment-history-test-project.mjs` 默认把测试项目放到父目录，还拒绝位于源码根内部的目标。仅写 AGENTS 无法改变其行为。本包已修正这个入口：默认改到 `output/history-test/<UTC时间>/generated-project/`，显式目标也必须位于根 output 内；已有数据不覆盖，缺后端输入时不产生半个工程。

它仍是历史 TEST_ONLY 准备器，不是日常前端命令，也不是 C2 正式保存的实现。旧 S2 生成器连同旧模板退役归档；确需复现时再使用主根 output 中的独立产物。现有 `build-run-mode.mjs` 本就输出根内 dist，无需另造构建系统。

## 旧目录怎么处理

| 目录/类别 | 处理方式 |
|---|---|
| 原活动 `wuhan-eldercare-v2-1-b1-2-4` | 最新磁盘源码已于 10-27 完整迁入并校验；10-28 再将完整磁盘文件（含 9 个未提交文件）压缩校验后退役，恢复包见本轮清理说明 |
| `partner-demo/` | 已移入恢复区 retired-main-trees/partner-demo；旧检查同存 scripts |
| `partner-demo-s2/` | 已移入恢复区 retired-main-trees/partner-demo-s2，生成器与检查在同区 scripts |
| `showcase/vr-map-interactive-v1/` | 已移入恢复区 retired-main-trees/showcase/vr-map-interactive-v1；当前 miniprogram/pages/showcase 保留 |
| v1-7～b1-2-3、main-verify、test-ready 等旧阶段工程 | 10-28 按真实 Git 归属区分普通仓库与 linked worktree，完整保全源码、Git 历史、截图和本机文件后清理；未凭文件名丢弃独有材料 |
| 已核实可重建/已完整保全的重复目录 | 可按其实际 Git/普通目录类型退役；有独有材料的先归档并登记 |

10-27 迁移时核实主根为独立仓库（当时 a391711），原活动目录为 wuhan-eldercare-github-main 的 linked worktree（5d55a26），未覆盖或合并两个 .git。当时清单和两份 bundle/文件快照见 [10-27 恢复入口](../../archive/recovery/2026-10-27-workflow-v4/README.md)。10-28 的完整旧工程恢复包另放 `archive/recovery/2026-10-28-workspace-cleanup/`，包含旧仓库的 `.git`、未提交/untracked、被忽略文件与独有截图，逐文件 SHA-256 验证后才移除原目录。linked worktree 用 Git 管理移除；不清理未知修改、不把本机恢复包加入 Git 或上传 Drive。

## 一次迁移就够

10-27 已完成真实 Git 核对、恢复保全、603 个源码文件字节校验、成套导入、overlay 合入、双模式构建、convergence 和两个 DevTools 首页截图。旧三个演示目录已退出根入口；当时原活动 worktree 的物理移动被 Windows 拒绝，10-28 在另做完整压缩校验后继续退役清理。两轮验证分别记录，目录清理不代表重跑业务或手机验收。

这是涉及两个现有工程的一次性搬迁核对，不是以后每阶段的流程。保留旧 server 与后端规则；迁入 docs 时保持当前合同路径和报告引用有效。新旧根同名树不能简单叠加，以免留下过时文件；两个 `.git` 也不能互相覆盖。冲突确实影响业务含义时说明具体差异，其他可逆整理继续做。

## 以后怎样继续

阶段号写在 Git 分支/提交或摘要文件名中，不变成主项目旁的新文件夹。阶段总结只留一份并更新[阶段索引](../phases/README.md)；源文档先通过[历史导航](../archive/README.md)逻辑归档，只有确需移动时才修受影响路径。

相关旧证据：[B1 交接](../design/V2_1_B1_COMMERCIAL_UI_HANDOFF.md)、[B1.2.1 交接](../design/V2_1_B1_2_1_VISUAL_FINALIZATION_HANDOFF.md)、[源码导出说明](../../SOURCE_BASELINE.md)。Git 操作语义参见 [Git 官方 worktree 文档](https://git-scm.com/docs/git-worktree)。
