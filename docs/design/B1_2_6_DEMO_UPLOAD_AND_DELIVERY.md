# B1.2.6 — Demo Experience Upload & Delivery

2026-10-25，北京时间。Owner 已授权上传冻结 B1.2.6 Demo 体验版；未授权 Git push、提审或正式发布。本轮不改实现，不创建新 Git 提交。

## STATUS

`UPLOAD_SUCCESS = SUCCESS`。Owner 确认后只查询原任务一次，结果为 status=success、detail=execution_success、result.success=true；没有重新发起上传。

```ini
B1_2_6_DEMO_UPLOAD = COMPLETE
GIT_PUSH = NOT_RUN
WECHAT_REVIEW_SUBMISSION = NOT_RUN
PRODUCTION_RELEASE = NOT_RUN
EXPERIENCE_DEVICE_ACCEPTANCE = PENDING_OWNER
```

| 项目 | 当前记录 |
| --- | --- |
| 冻结提交 | `7ae07b9b78e4502940fd9812c6a838e4ddf2cc06` |
| 分支 | `codex/v2-1-b1-2-4-card-actions-visual` |
| 上传目标 | 当前工作区 `dist/demo`，仅 Demo 体验版 |
| AppID / 后台名称 | `wx69f6bd834cebca33` / 学习画像；当前账号可管理 |
| 上传版本 | `1.2.6-demo.1025.0039`；成功原任务对应此版本请求。最终任务回执未单独回显版本字段，不冒充后台体验版列表核实 |
| 上传任务 | `confirmation_upload_afffdd04-bae8-4189-b1f6-ffd54457382b` |
| 原操作返回 | 最初为pending；Owner确认后查询同一任务，已为success / execution_success / result.success=true |
| 上传最终成功回执 | 已取得，`output/b1-2-6-upload-20261025/upload-task-result.json` |
| 上传完成时间 | 2026-10-25 00:42:03.576（北京时间）；采用原任务updatedAt=1792860123576，回执无单独服务器提交时间字段 |
| 实际上传包 bytes | 1,889,713；来自原上传最终result.info.size.total，packages仅TOTAL |
| 体验版版本核实 | `NOT_VERIFIED`；上传成功已确认，后台体验版当前指向未独立读取 |
| 体验版二维码 | `NOT_VERIFIED` |
| 新体验版手机验收 | `PENDING_OWNER`；不复用冻结前手动验收作为新上传包验收 |

上传说明：B1.2.6 演示流程整合版；优化老人档案、评估与预约展示，机构详情整合地图、VR及养老顾问，完善模拟咨询、预约引导与带看评价，修复顾问回复反馈可见性。演示数据均为测试内容，不代表真实机构信息或服务承诺；仅供体验测试，不提审、不正式发布。

## PREFLIGHT_RESULTS

| Gate | 结果 |
| --- | --- |
| FROZEN_COMMIT_MATCH | PASS；HEAD与指定提交、分支精确一致 |
| 工作树 / 代码 | PASS；检查时仅tokens.less混合行尾提示，无文本diff、Git内容hash与HEAD一致；未重写该文件 |
| DEMO_BUILD | PASS；原TypeScript4.1.2、Less、原生WXML及生成语法，200模块 / 30路由 |
| PRODUCTION_BUILD | PASS；214模块 / 30路由，与冻结基线一致 |
| DEMO_ISOLATION | PASS；身份及API Guard先于App启动，develop/trial允许，release拒绝；真实网络、登录、拨号、导航、客服、Storage受阻 |
| PRODUCTION_ISOLATION | PASS；无Demo Story、顾问Fixture、管理组件、模拟服务写入和合成VR资源 |
| CORE_REGRESSION | PASS；B1.2.6 Story含顾问定位、三问、关联预约、防重及返回；B1.2.5 Continuity、convergence和Institution VR；历史快照、21评分及独立费用判断、重进只读、幂等加载保持 |
| JS兼容 | PASS；Demo200 / Production214生成模块，无不支持语法 |
| 微信预览编译 | PASS；当前Demo的官方CLI preview退出0，未auto-preview推送手机 |
| PACKAGE_BUDGET | PASS；原预算未变，当前实际预览包低于项目预算及2MiB主包限制 |
| 上传防重 | 本地任务和报告未发现任何先前B1.2.6上传；本次仅此一次请求，后续只查原任务 |

这些检查用于确认冻结源码的构建组合与安全状态，不冒充本轮重新执行全部原生/Android交互验收。顾问修复、地图/VR和完整演示链路原有证据及Owner手动冻结验收见 [B1.2.6交接报告](B1_2_6_DEMO_STORY_REPORT.md)。

## PACKAGE_BYTES

| 口径 | bytes | 来源 |
| --- | ---: | --- |
| LOCAL_RUNTIME_BYTES / Demo | 1,942,871 | 当前Demo运行文件字节求和 |
| LOCAL_RUNTIME_BYTES / Production | 1,341,026 | 当前正式运行文件字节求和，不上传 |
| WECHAT_PREVIEW_PACKAGE_BYTES | 1,889,713 | 本次CLI preview实际返回size.total；packages仅TOTAL |
| 项目既有预算 | 2,031,616 | 未修改，预览包余量141,903 |
| WECHAT_UPLOAD_PACKAGE_BYTES | 1,889,713 | 原上传成功任务result.info.size.total，packages仅TOTAL |

预览包与runtime不同源于微信编译打包统计，不视为相同口径。本次预览与上传分别取得实际回执，恰好均为1,889,713 bytes；上传包也通过原项目预算，余量141,903 bytes，不是从预览体积推算。B1.2.5的1,949,172 bytes、旧二维码和旧成功任务都不用于本次验收。

当前二维码工具不提供info-output，故沿用已用过的微信官方CLI `preview --info-output` 获取实际包信息；没有创建替代上传脚本。最终upload使用已配置的MCP正式上传能力。

## EVIDENCE_AND_RESUME

本地原始记录位于 `output/b1-2-6-upload-20261025/`：

- `preflight.json`：Gate、目标、构建和本轮回归输出。
- `preview-package-info.json`：本次实际微信预览包信息。
- `preview-qr.jpg`：预览产物，仅用于打包检查，绝非已核实的体验版入口。
- `upload-request-result.json`：原始pending请求回执。
- `pending-task.json`：保留原任务上下文，现记success；Owner确认后查询1次。
- `upload-task-result.json`：原任务最终成功回执，含updatedAt和实际上传包信息。

Owner 已在微信开发者工具确认，并回复“我已经批准，检查一下。”随后使用 `polling_task_result` 查询原任务 `confirmation_upload_afffdd04-bae8-4189-b1f6-ffd54457382b`，取得真实success回执后更新本报告。原上传已成功，不再重发。原回执与预检证据不含登录凭据或令牌。

## EXPERIENCE_ACCESS_AND_OWNER_CHECK

上传成功已确认；体验版当前指向及二维码仍未独立核实。现有工具没有体验版版本列表 / 二维码读取接口，上传后的开发者工具主窗口亦未展示可读取的体验入口。Owner 可在微信公众平台该AppID的“小程序 → 版本管理 → 体验版”核对是否为 `1.2.6-demo.1025.0039` 并扫码访问；如仅出现在开发版本中，需要由Owner将该版本选为体验版，再取得体验二维码。这里提供的是操作路径，不是已经扫码访问成功的证明。本轮没有额外登录后台、提审或发布。

- [ ] 手机进入最新B1.2.6体验版，核对版本。
- [ ] 首页自动加载演示案例。
- [ ] 老人档案、评估、预约均有演示记录。
- [ ] 机构详情地图与交互VR正常。
- [ ] 顾问模拟联系与三个回复可见。
- [ ] 关联预约、返回和连续点击正常。
- [ ] 带看评价可以查看。
- [ ] 无明显错位、空白或资源加载错误。

`EXPERIENCE_DEVICE_ACCEPTANCE = PENDING_OWNER`。冻结前Owner手动PASS保持其原来源，不自动覆盖本次上传后的手机检查。

## POST_UPLOAD_GIT_STATUS_AND_BOUNDARIES

原任务已成功：冻结HEAD未变；本轮仅新增本交接文档（未提交），原tokens.less行尾状态保留，output证据为忽略目录。未改业务源码、构建预算或私有权限；没有新Git提交、push、提审或正式发布。

上传最终回执及上传包信息已确认；体验版入口和上传后手机验收仍待Owner核对，不提前标为PASS。修复版冻结前的Owner手动验收继续保持原记录，不被篡改或冒充本次上传后验收。
