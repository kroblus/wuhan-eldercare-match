# 架构第 4 项：普通机构目录轻量读取

日期：2026-10-28。用户授权继续架构第 4 项，在主工作区完成；前 3 项见[基础结构摘要](../architecture-foundation-20261028/SUMMARY.md)。

## 成果与当前能力

首页与普通目录原先为每张卡片构建完整详情及详情展示模型，再取地址、电话风险、价格。现在一次批量读取只返回这些应用事实；详情与目录共用原有纯投影。候选推荐入口不进入此装饰链路，卡片排序、导航身份、全部机构风险与页面可见输出保持一致。

- `institution-directory-read.ts` 一次取得当前目录，逐项核对身份、revision、published、模式来源及 V1.2.1→V1.1 关联。一项失败只让对应卡片缺少补充字段，已有基本信息与风险保留。
- `institution-current-catalog.ts` 与详情共用进行中请求，不新增跨批事实缓存。当前目录与固定历史仍有独立边界。
- 地址与电话共用 domain/presentation 纯函数；价格保留原有货币、月费范围、附加收费与限制判断。unknown、unavailable、unverified、expired 的含义不变。
- 电话卡片只含操作键；点击仍读取最新详情、重新核验电话及页面状态，再进入既有确认流程。Demo 不拨真实电话。

这是用户所选第 4 项的实现路径调整，继续使用 `institution-ordinary-directory-display-v1`；Frozen 文档、领域版本、旧历史快照、推荐与排序规则均未修改。新 `institution_directory_read_snapshot_v1` 仅为内部应用结果类型。

## 前后结果

基线为 `b99773d0cf43b9ea33775e14367a9a82b29963d7` 的双模式构建。相同 Node/TypeScript VM、固定评估时间 `2026-10-28T00:00:00.000Z`，预热 1 次、采样 7 次取中位数。下表是 Node 数据准备耗时，不是微信冷启动、渲染或手机成绩。

| 指标 | Demo：之前 → 之后 | 正式：之前 → 之后 |
|---|---:|---:|
| 目录数据准备 | 265.0 → 166.3 ms（约 -37%） | 213.0 → 175.6 ms（约 -18%） |
| 首页数据准备 | 239.9 → 169.5 ms | 208.9 → 172.4 ms |
| 独立目录页数据准备 | 252.0 → 168.6 ms | 224.9 → 173.8 ms |
| 每次目录加载完整详情 / 详情 VM 构建 | 12 / 12 → 0 / 0 | 11 / 11 → 0 / 0 |
| 补充读取的内部 JSON 快照 | 155,152 → 22,900 bytes（-85%） | 133,073 → 14,150 bytes（-89%） |

每条链路改为 1 次批量补充读取；包括基础列表读取在内的 provider 调用仍为 2 次。两种模式的完整首页 data、普通卡片与目录 visibleItems 的 SHA-256 均与基线相同。此处 JSON 指内部应用快照，不是 setData 负载。

此次没有做分包或减少静态模块加载：主页静态 require 图各增加 3 个小模块。原始运行文件约 Demo 1957 KiB、正式 1364 KiB（改前 1952/1360 KiB），均通过 1984 KiB 本地预算；不能代替微信最终上传包统计。

原始证据：[baseline.json](../../../output/directory-read-v1-20261028/baseline.json)、[after.json](../../../output/directory-read-v1-20261028/after.json)。这些本地证据不随 Git 上传。

## 验证与缺口

双模式 TypeScript 4.1.2、Less、原生 WXML 与生成 JS 构建通过。卡片回归 301 条断言对照完整详情，覆盖当前和过期资料、准确价格、来源关联、模式隔离和风险保留；补充 UI 132 条断言；电话操作 112 条断言通过（模拟微信 API，无真实拨号）。既有详情交互、目录交互、读请求合并/失败重试/页面卸载、Demo 与正式模式收敛检查通过。

源码边界检查纳入工作分支 CI。新目录读取测试 9 组 / 180 条断言通过，覆盖批量、身份与来源关联、错误恢复与无持久事实缓存；运行 `npm run check:institution-directory-read`。工作流涉及的 V2、C1、P1 等源码回归本地通过；独立只读复核未发现需修改问题。生成产物比对运行 `npm run check:v2-1-b1-2-3-cards`、`npm run check:v2-1-b1-ui`、`npm run check:v2-1-b1-2-4-card-actions`。性能复测需先双模式构建，再运行 `node scripts/measure-directory-read-v1.mjs after`；不要以新代码重写旧 baseline 冒充改前数据。

开发者工具定向烟测：Demo 首页搜索、独立目录搜索、详情返回保留搜索和模拟电话提示通过；正式首页 11 家及风险说明正常。最终构建后点击正式电话入口，在开发者工具的“仅为模拟”拨号框点击取消，返回首页，未真实拨号；本次单次控制台读取未见项目错误。两模式首次自动化等待各超时一次，重试后恢复。此证据不代表真机通话行为，取消后也未观察到额外错误提示。截图：[Demo 首页](../../../output/directory-read-v1-20261028/demo-home-cards.png)、[正式首页](../../../output/directory-read-v1-20261028/production-home-cards.png)、[电话弹框](../../../output/directory-read-v1-20261028/production-phone-prompt.png)、[取消后](../../../output/directory-read-v1-20261028/production-phone-cancelled.png)；[本次控制台](../../../output/directory-read-v1-20261028/production-console-current.log)。

真实手机耗时、真实服务、微信上传/提审/发布未执行。下一步可在手机复测首页与目录响应，再按架构建议选择后续优化；本项不扩展后台能力或修改业务事实。
