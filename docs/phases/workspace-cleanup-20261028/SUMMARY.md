# 2026-10-28：旧养老中间工程已清理

`C:/Users/16562/WeChatProjects` 中的 27 个旧目录和 4 份旧 ZIP 已完成本机压缩保全、逐文件校验和原目录移除。父目录现在只保留 `wuhan-eldercare-match`、`daqian-showcase-official-preview-v1`、`learner-lens-miniapp` 三个项目。

旧内容合计约 2,212 MiB，恢复包约 1,324 MiB，保留恢复包后净释放约 888 MiB（约 0.9 GB；按文件内容大小计算，不含文件系统开销）。当前源码、构建产物和主项目已有未提交工作保持原位；本轮仅修改目录说明。

## 清理范围与验证

- 旧阶段：v1-7、v1-8、v1-9、v2-0、v2-1-a/A2、B1 至 B1.2.4，以及各 main-verify/verified 目录。
- 旧基线和恢复材料：antigravity、github-main、main-verification、baseline-backup、`.repo-backups`、10-22 cleanup-recovery，以及 4 份 10-27 源码 ZIP。
- 旧测试：match-test、test-ready/final/verified、personal-records-test。
- 全部 62,300 个文件均保存；压缩包中每个文件的 SHA-256 与原文件一致，并再次读取原文件核对。包括旧仓库 `.git`、旧活动目录的 9 个未提交文件、untracked、被忽略的本机配置、截图、依赖及生成产物。
- 10 个 linked worktree 通过所属仓库的 `git worktree remove --force` 退役；此时工作文件已完整保全。其余目录与 ZIP 经绝对路径范围核对后移除，没有改写主仓库历史。
- 主项目当前构建脚本、模式、前端和工程配置未发现对已删除旧工程路径的依赖；父目录剩余项目名单已核对。
- 本轮验证为文件完整性、目录范围、Git 关系及说明链接；未重跑业务、开发者工具或手机验收，未上传或发布微信版本。

## 找回旧文件

本机恢复目录：`archive/recovery/2026-10-28-workspace-cleanup/`。

- [retired-projects.zip](../../../archive/recovery/2026-10-28-workspace-cleanup/retired-projects.zip)：完整旧文件，以原父目录下的名称组织。
- [manifest.json](../../../archive/recovery/2026-10-28-workspace-cleanup/manifest.json)：原路径、Git HEAD/归属/修改清单、逐文件 SHA-256 与整个 ZIP 的 SHA-256。
- [操作和结果](../../../output/workspace-cleanup-20261028/)：归档与退役脚本、初始工作树状态、验证计划、逐目录移除结果及最终核对。

恢复时只将所需旧文件解压到主项目 `output/` 下的新目录，对比后再恢复单个文件。不要把旧 `.git` 覆盖到当前主仓库；旧 linked worktree 的 Git 关联仍记录旧路径，恢复整套历史时需另行修复关联。整个恢复包可能包含本机配置，仅保存在本机，被 Git 忽略，不上传 Drive。

下一步继续在主目录开发，微信工程从 `dist/demo/` 或 `dist/production/` 打开。历史报告中的旧绝对路径只作当时证据，后续产物放主目录 `output/<任务名>/`。
