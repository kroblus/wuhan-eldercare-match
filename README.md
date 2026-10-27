# 武汉养老机构精准匹配小程序

这是项目的日常进度与资料入口。更新：2026-10-27（北京时间）；已完成本机源码收拢和 V4 工作流合入；历史验收与本轮验证分别记录。

## 现在做到哪里

**C1-B 初步参考页面已完成，Owner Android 6/6 PASS（用户提供基线）。C2-A 正式单老人历史后端已实现并完成合成 MySQL 定向验证；真实数据写入仍关闭，下一步接入 C2-B 页面。**

| 工作 | 当前结论 | 还差什么 |
|---|---|---|
| 页面与 Demo | 当前源码有 30 个路由；111 页图册展示 Demo 在开发者工具中的界面 | 图册不代表正式服务、手机验收或后续改动已上传 |
| B1.2.6 演示体验版 | Drive 记录 `1.2.6-demo.1025.0039` 上传及用户手机验收 | 后续本地 UI 修复分别看对应记录 |
| C1-A：初步参考计算 | R02/R10 测试输入与断言已修正；两项 C1 自动化检查完整通过 | 后继 C1-B 已完成；不重新规划本阶段 |
| C1-B：推荐页面接入 | 已接入旧卡优先、1–3 张初步参考、全部风险与澄清；Owner Android 6/6 PASS（用户提供基线） | 后续改动按实际范围验证；不重启 C1 验收 |
| C2-A：正式历史后端 | 独立 API/表、C5 单老人授权、告知/同意边界、固定快照确认、幂等与只读历史；合成 MySQL 验证通过 | C2-B 页面；真实 C5/机构来源/获批数据处理方案及部署验收，真实写入关闭 |

继续 V1.3 时，从 [C2-A 后端与页面接入说明](docs/phases/v1-3-c2-a/SUMMARY.md) 进入 C2-B；旧 TEST_ONLY History 保持隔离。旧 V2 吞咽条款与当前 readiness 实现的既有差异仍保留，见[复验说明](docs/design/V1_3_C1_A_IMPLEMENTATION_REPORT.md)；本次未改 Frozen 或领域规则。当前问卷 V2 为 **32 题、26 必填、6 选填**；部分旧报告的 27/21 不用于回改当前问卷。

## 按任务找资料

| 你要做什么 | 需要时打开 |
|---|---|
| 改功能、找代码与必要检查 | [任务地图](docs/current/TASK_MAP.md) |
| 看当前产品能力和页面方案 | [当前 PRD](docs/product/CURRENT_PRD.md) · [当前 MVP](docs/product/CURRENT_MVP.md) |
| 查某一阶段做了什么、测到哪里 | [阶段成果索引](docs/phases/README.md) |
| 找旧设计、旧工作流程或原始依据 | [历史导航](docs/archive/README.md) |
| 看模型、Terra 分工和配置生效 | [Codex 配置说明](.codex/README.md) |
| 收拢旧目录与安排副产物 | [单一主目录说明](docs/current/WORKSPACE.md) |

无需依次打开这些链接。Codex 按根 [AGENTS.md](AGENTS.md) 协作，只读取本次任务需要的内容。

## 在哪里开发

唯一日常主目录：`C:/Users/16562/WeChatProjects/wuhan-eldercare-match`。最新活动源码及 9 个未提交文件已迁入；原活动路径保留为恢复来源，Windows 拒绝移动，停止作为日常入口。旧三个演示目录已移到恢复区。

源码：`miniprogram/`；模式适配：`modes/`；构建：`dist/`；截图、日志与生成测试项目：`output/<任务名>/`；值得长期保留的总结：`docs/phases/`。以后不新建平行的小程序阶段目录。

按任务选择 `npm run build:demo`、`npm run build:production` 或相关检查即可；构建后分别从 `dist/demo/` 与 `dist/production/` 打开工程。不要直接改 dist；编译环境与 C1 检查命令见任务地图。

本轮两项 C1-A、[C1 页面运行检查](scripts/check-c1-result-page-runtime.mjs)、旧 V1/V2 推荐页及交互检查、production/demo 原生构建、模式隔离与产物 JS 兼容检查通过。导航总检查仍保留既有 NAV-019／NAV-024 失败；结果页可执行导航用例通过。DevTools 长风险合成夹具证据留在 `output/c1-b/`，与手机验收分开；未提交、上传或发布。目录收拢的恢复材料见[此前工作流记录](docs/phases/2026-10-27-workflow/SUMMARY.md)。

DevTools 已验证隔离合成参考页：逻辑宽度 320／375／430px、字号 24（默认 16 的 150%）下，首屏、首卡长风险与公开详情按钮正常换行，按钮可滚动到且无遮挡；已实际跳转公开详情。截图在 `output/c1-b/`，仅覆盖合成夹具和首张长卡，不代替手机验收。自动化点击通道返回 `App.CDPEnable unimplemented`，本轮未取得真实 Demo 旧候选页的 GUI 截图；该分支与模式隔离已由运行脚本验证，手机上仍需检查。

维护本页只更新当前结论和下一步，不追加整段历史。旧根说明已留在历史导航中；详细证据、上传记录和图册范围由阶段索引按需提供。
