# 按任务找代码、规则和检查

先看[根 README](../../README.md)，再选下面与你的任务有关的一行。不要把本页所有检查一次跑完。

## 任务地图

| 你想做什么 | 先看哪里 | 需要时做什么检查 |
| --- | --- | --- |
| 改单页文字、间距、颜色、卡片 | 目标 `miniprogram/pages/**`；Demo 专属内容再查 `modes/demo/**` | 看受影响页面；布局改动看窄屏，字号改动再看 150%；必要时构建相应模式，不默认写新测试 |
| 修改 C1 初步参考页面 | `pages/recommendation/result.*`、`initial-reference-view-model.ts`；`services/recommendation-result-application.ts`；`runtime/recommendation-mode.ts`；独立 C1 契约 | `check:c1:page`、两个 C1 检查与结果页相关交互；运行模式接线变更再做双构建/隔离，页面变化看开发者工具及相关手机操作 |
| 改 C1 计算逻辑 | `types/initial-reference-v1.ts`；`domain/recommendation/initial-reference-v1/` | `check:c1:domain`、`check:c1:composition`；影响旧边界才加相应旧回归 |
| 改旧推荐、画像 | 对应 `domain/recommendation/`、`domain/elder-profile/`、V2 服务和版本规则 | 选择 `check:recommendation-v2-runtime`、`check:recommendation-preview-v2-integration-runtime` 或相关画像脚本 |
| 改问卷字段和步骤 | `types/assessment-v2.ts`、`pages/assessment/`、草稿相关服务 | `check:assessment-v2-runtime` 及对应交互；保留稳定 ID、必填条件与旧版本读取 |
| 改机构资料、详情、地图或 VR | `modes/production/`、`services/institution-*`、`pages/institution/` | 选择 `check:production-directory-data`、对应机构脚本或 `check:institution-vr-runtime` |
| 改演示、预约、评价故事流程 | `modes/demo/`、相关页面及模拟端口 | 选择 `check:b1-2-6-story`、`check:visit-evaluation-runtime` 或直接相关检查 |
| 改构建器、共享模式层、隔离 | `scripts/build-run-mode.mjs`、`modes/` | 双构建、`check:run-mode-convergence`、产物 JS 兼容和包体积；不要在普通文案任务默认全跑 |
| 做正式历史保存 | `server/.../history/C2History*`、`miniprogram/types/formal-assessment-history.ts`、[C2-A 接入说明](../phases/v1-3-c2-a/SUMMARY.md) | C2 定向 Java/MySQL 与所改页面链路；独立正式 API 默认关写，旧 TEST_ONLY 不提升为正式 |
| 在微信工具/浏览器复现、操作或截图 | 委派 `computer_operator`（Terra）；给定实际工程、模式、页面与复现目标 | 同一界面一个操作者；证据留在 `output/<任务名>/`，只看受影响流程；CLI 可直接完成的继续用 CLI |
| 查阶段成果或旧决定 | [阶段索引](../phases/README.md) 或 [历史导航](../archive/README.md) 中相关一行 | 只打开需要的报告/段落；不运行历史全部检查 |
| 只改文档或 AI 配置 | 本次变更文件及直接引用 | TOML/JSON 语法、路径和指令一致性；不需要微信构建、手机验收或全项目业务测试 |

表中未写完整路径的源码均相对于 `miniprogram/`。实际可用命令以当前 `package.json` 为准。

## 规则的直接入口

- C1 初步参考：[独立 C1 契约](../architecture/INITIAL_REFERENCE_RECOMMENDATION_CONTRACT_V1_3_C1.md)。旧 V2 有合法展示候选时保留旧结果；新参考不虚构事实、不承诺入住、不改旧算法。
- 推荐 V2：[结果契约](../architecture/RECOMMENDATION_CONTRACT_V2.md)和[规则契约](../architecture/RECOMMENDATION_RULE_CONTRACT_V2.md)。只在对应任务读。
- 问卷：[V2 契约](../architecture/ASSESSMENT_CONTRACT_V2.md)。当前 32/26/6；旧 V1 用于旧版本。
- 交互：[微信交互 V2](../architecture/WECHAT_INTERACTION_CONTRACT_V2.md)；编译语法：[运行兼容规则](../architecture/WECHAT_RUNTIME_COMPATIBILITY_POLICY.md)。
- 真实机构：[正式目录说明](../../modes/production/README.md)和[护理证据接入](../architecture/PRODUCTION_CAPABILITY_EVIDENCE.md)。
- 领域或版本确实不明确时再看 [CONTRACT_INDEX.md](../architecture/CONTRACT_INDEX.md)；它不是每轮必读清单。

## 两个容易记的 C1 命令

```powershell
npm run check:c1:domain
npm run check:c1:composition
```

它们只是已有脚本的别名，不是新加的验收体系。若尚未合入别名，原命令同样有效：

```powershell
node scripts/check-initial-reference-v1-runtime.mjs
node scripts/check-reference-composition-v1-runtime.mjs
```

纯 Node 检查沿用现有 CI 的 TypeScript 4.1.2。已安装本项目锁定依赖后，可在当前 PowerShell 会话设置：

```powershell
$env:WECHAT_TYPESCRIPT_PATH = (Resolve-Path .\node_modules\typescript\lib\typescript.js).Path
```

缺少依赖才按本项目 lockfile 安装；不要顺手升级 TypeScript。完整构建还需要本机微信工具中的 Less 和 WXML 编译器，纯 Node 检查通过不等于原生构建或真机通过。

## 构建与证据范围

```powershell
npm run build:demo
npm run build:production
npm run check:run-mode-convergence
npm run check:wechat-js-compat -- --artifact-dir dist/production/miniprogram
npm run check:wechat-js-compat:demo
```

这些命令按影响选择。`dist/` 可以重新生成，不直接修改；根 `project.config.json` 是原开发 Mock 入口，正式/演示构建分别打开对应 `dist/<mode>/project.config.json`。

`check:doc-governance` 仅在核对文档生命周期、路径或相关登记时使用。旧历史输出未打包时说明缺项，不伪造 Closeout，也不把它变成普通 UI 开发的阻碍。旧主目录的默认 `npm run check` 检查旧 Agent/B01 路由，不能当本分支的通用完成标准。

已有导航失败按报告中的 `NAV-019` / `NAV-024` 保留身份。改到该路径时再核实原因；没有本轮结果不写“已经修复”。
