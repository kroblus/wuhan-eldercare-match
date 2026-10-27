# 只维护一个主项目

目标：以后只打开 `wuhan-eldercare-match` 开发，当前活动工作区的源码直接成为它的 `miniprogram/`、`modes/` 和 `scripts/`。2026-10-27 已完成源码与配置收拢；以下记录实际结果及以后约定。

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
| 当前 `wuhan-eldercare-v2-1-b1-2-4` | 最新磁盘源码已完整迁入并校验；旧 Demo 窗口已关闭。git worktree move 被 Windows 拒绝（Permission denied），原路径保留为恢复来源，不再用于日常开发 |
| `partner-demo/` | 已移入恢复区 retired-main-trees/partner-demo；旧检查同存 scripts |
| `partner-demo-s2/` | 已移入恢复区 retired-main-trees/partner-demo-s2，生成器与检查在同区 scripts |
| `showcase/vr-map-interactive-v1/` | 已移入恢复区 retired-main-trees/showcase/vr-map-interactive-v1；当前 miniprogram/pages/showcase 保留 |
| 截图中的 v1-7～b1-2-3、main-verify、test-ready 等 | 都属于待核查的历史/验收候选；仅凭文件名不能知道有没有独有实现、未提交改动或截图 |
| 已核实可重建/已完整保全的重复目录 | 可按其实际 Git/普通目录类型退役；有独有材料的先归档并登记 |

本机已核实主根为独立仓库（a391711），活动目录为 wuhan-eldercare-github-main 的 linked worktree（5d55a26），未覆盖或合并两个 .git。25 个相关目录已逐个记录 Git 归属和工作状态；其他历史目录未核实独有材料，保留原位。清单和两份已验证 bundle/文件快照见 [恢复入口](../../archive/recovery/2026-10-27-workflow-v4/README.md)。linked worktree 用 Git 管理移除；不要直接拖拽 `.git` 或强制清理未知修改。Git 历史恢复包不包含未提交/untracked 或被忽略的本机配置、独有截图等工作文件；迁移时一并识别并保留有价值内容，不显示凭证。

## 一次迁移就够

本次已完成真实 Git 核对、一次恢复保全、603 个源码文件字节校验、成套导入、overlay 合入、双模式构建、convergence 和两个 DevTools 首页截图。旧三个演示目录已退出根入口；原活动 worktree 的物理移动受 Windows 文件占用或访问限制阻止，未强删。

这是涉及两个现有工程的一次性搬迁核对，不是以后每阶段的流程。保留旧 server 与后端规则；迁入 docs 时保持当前合同路径和报告引用有效。新旧根同名树不能简单叠加，以免留下过时文件；两个 `.git` 也不能互相覆盖。冲突确实影响业务含义时说明具体差异，其他可逆整理继续做。

## 以后怎样继续

阶段号写在 Git 分支/提交或摘要文件名中，不变成主项目旁的新文件夹。阶段总结只留一份并更新[阶段索引](../phases/README.md)；源文档先通过[历史导航](../archive/README.md)逻辑归档，只有确需移动时才修受影响路径。

相关旧证据：[B1 交接](../design/V2_1_B1_COMMERCIAL_UI_HANDOFF.md)、[B1.2.1 交接](../design/V2_1_B1_2_1_VISUAL_FINALIZATION_HANDOFF.md)、[源码导出说明](../../SOURCE_BASELINE.md)。Git 操作语义参见 [Git 官方 worktree 文档](https://git-scm.com/docs/git-worktree)。
