# V1.3-C2-A：正式单老人历史后端

2026-10-27。本轮完成后端代码与合成环境验证；**没有上线，没有开放真实答卷收集，没有提交、push、上传或发布**。C1-B Owner Android 6/6 PASS 以本轮用户提供的基线为准，本轮未重做手机验收。

## 已具备的能力

- 独立正式 API、Flyway V9 和 `c2_history_*_v1` 三张表；不读取、迁移或提升旧 TEST_ONLY History 数据。原门禁保留。
- 复用 C5 服务器会话与 ElderRecord 单老人绑定。同一事务锁定并复核会话和老人授权；请求不接受 userId、elderId、手机号或客户端推荐结果作为凭据。
- 独立告知与单独同意证据：仅部署方安装实际获批的 `C2DataPolicy` 后才可返回告知、接受明确同意；保存告知原文/版本/审批引用、服务端时间和授权关联。当前无正式实现，不生成虚假同意记录。
- 服务端用已有 Assessment V2、ElderProfile V2、冻结 V2 及 C1 纯规则生成一次固定快照；复用当前画像/推荐公开展示映射。原答卷与完整派生画像私有保存；公开详情只返回展示快照、版本和来源，不返回原答卷、身份凭据、内部评分元组或答案摘要。
- 旧 V2、`INITIAL_REFERENCE_ONLY`、`NO_PERSONALIZED_CANDIDATE` 分开保存，保留公开卡片顺序、依据、差异、全部公开风险/澄清/普通偏好缺口及零候选原因。技术错误不进入合法空结果。
- 持久化原保存意图与固定版本，重复/并发确认最多一条正式记录；记录与意图回执在同一事务提交。数据库禁止更新已保存快照及修改已准备意图正文。
- 列表按保存时间倒序，只含 ID、时间、结果类型和可信保存状态；详情只读原快照。当前规则、目录变化和重新评估均不改旧记录；新服务实例仍可凭同一账号授权读取。

## C2-B 从哪里接入

HTTP 根路径：`/api/v1/formal-assessment-history`，回包 `{contractVersion:"formal-single-elder-history-v1", result:...}`；错误为 `{contractVersion, code}`。身份沿用 `X-Auth-Evidence` 的 C5 自有会话。新增 wire types 在 [formal-assessment-history.ts](../../../miniprogram/types/formal-assessment-history.ts)，没有接线到现有页面，也没有自动网络上传。

| 方法/路径 | 用途与关键字段 |
|---|---|
| GET `/capability` | 读取配置门禁；不含身份、健康信息或记录数，不代替实际请求成功回执 |
| GET `/notice` | 仅返回真实已获批告知；未配置则 503 |
| POST `/consents` | `{noticeVersion, accepted:true}`；返回服务端 `consentId/noticeVersion/acceptedAt` |
| POST `/save-intents` | `{intentId, assessmentVersion:"assessment-contract-v2", answers, consentId}` |
| GET `/save-intents/{intentId}` | 按原意图核对待确认/过期/已保存；成功后只返回原回执，未知意图为 404 |
| POST `/confirm` | `{intentId,resultVersion,displayBinding}`；只确认该份快照，返回可信 Item |
| GET `/` | `limit=1..50`，可选上页 `nextCursor`；回包 `{items,nextCursor}` |
| GET `/{recordId}` | `{availability,item,display}`；不支持的展示快照版本为 `UNSUPPORTED_VERSION` |
| GET `/data-rights` | 当前明确返回 `UNAVAILABLE/RIGHTS_HANDLER_NOT_CONFIGURED`；不冒充已受理数据权利申请 |

**所见即所存采用强制重新展示协议**：匿名填写和结果浏览完全沿用现有流程；只有点击保存后才登录、绑定、展示告知并单独同意。前端先生成一个 lowercase UUID `intentId`，保留原请求，再 prepare。后端返回 `REQUIRES_REDISPLAY_AND_CONFIRMATION`、不可猜测的 `resultVersion/displayBinding`、15 分钟确认期限及固定 `display`。C2-B 必须完整重新展示返回的画像和推荐，用户再次明确确认后才能调用 confirm；不得后台自动确认，也不得把匿名页面旧结果直接当成已保存结果。

prepare 重试相同意图只复用同一快照；改答卷或 consentId 返回 `INTENT_CONFLICT`。确认版本/绑定不符返回 `RESULT_CONFIRMATION_MISMATCH`；固定来源撤销/不再授权返回 `RESULT_SOURCE_CHANGED`，不改换候选。超时、丢回执、进程重启先按原 intentId reconcile，再重放原确认，不能自动换键。过期未保存返回 `RESULT_EXPIRED`；再次保存必须是用户重新发起的明确动作。最多允许 16 个同时有效未确认意图；到期不意味着删除健康数据，清理仍受获批保留方案约束。

历史视图应按静态快照只读渲染，不能执行当下推荐引擎或自动套用当前机构详情；快照中的当前页面 action 文案不代表历史页可编辑。切账号、会话失效或老人绑定变更后必须清理页面中的旧授权结果，所有服务端读取/确认仍重新校验当前范围。匿名答卷与取消保存时的合法草稿保留由 C2-B 在前端处理。

状态区别：401 `AUTH_REQUIRED`；403 `ELDER_BINDING_REQUIRED/ELDER_SCOPE_CHANGED/CONSENT_REQUIRED`；404 `NOT_FOUND/INTENT_NOT_FOUND`（跨账号与无记录相同）；409 意图/版本/来源/告知变化；422 `UNSUPPORTED_VERSION`；503 `UNAVAILABLE/AUTH_UNAVAILABLE/ELDER_SERVICE_UNAVAILABLE/SOURCE_UNAVAILABLE/ENGINE_UNAVAILABLE/ERROR`。前端网络失败单独处理，不映射为“暂无记录”。

## 生产开放还缺什么

正式配置要求既有持久化与 C5 均启用，且不处于 `assessment-history-test-only/demo/test` profile；`C2_HISTORY_WRITES_ENABLED` 默认 false。即使手动打开该 flag，也必须同时安装：

1. 可信 `C2CatalogSource`：部署方实际审核的 V1.2.1 目录、合法来源引用及固定 release；`authorizes` 必须复核指定 release 的完整固定内容与撤销状态，不能仅比对客户端标签、当前名称或信任开发目录。没有自动导入生产资料的工具。
2. 实际获批 `C2DataPolicy`：敏感数据告知、保留期限、保存中间数据的处理、数据权利联系与运营处理方案及审批引用。当前仓库没有正式文案和处理适配器；数据权利入口保持不可用。
3. 正式 C5 的 AppID/AppSecret/HMAC、可信 HTTPS 服务、MySQL 配置、最小权限数据库账号与运营备份/保留实施；凭据只在服务器环境。正式微信账号、多设备真实登录及生产服务验收未进行。

Node 24 是保存时纯规则桥接的运行依赖，采用已有隔离 stdin、8 秒期限、4 并发、输入/输出大小限制。缺依赖失败关闭。读取历史不依赖 Node 或当前目录。生产机构来源、真实配置与获批处理计划尚缺，**不能对真实用户开放保存**。

## 验证与复跑

本轮真实 MySQL 为独立 loopback 非 3306 的 MySQL 8.0.34；受限用户只访问新建 disposable schemas。正式 C2 与旧 History 分库，输入/账号/同意/机构均为合成；没有访问既有 3306 服务。合成夹具中的 PRODUCTION 仅测试严格 schema 分支，不是机构核验或真实收集批准。

- `C2HistoryMySqlIntegrationTest`：16 项，含实际打包 Node 三结果保存读取、新连接池/新 C5/Service 重建、并发幂等、授权隔离与失效、事务故障回滚、不可变历史、无读取重算、同意与来源变化。
- 旧 `HistoryMySqlIntegrationTest` 14 项、`HistoryTrustedPreviewMySqlIntegrationTest` 5 项：实际 MySQL 兼容。仅为连接受限测试账号增加可选用户名/密码环境变量，原 TEST_ONLY 防护未改。
- 最终 13 组定向 Java 检查合计 **73 项全部通过，0 失败、0 错误、0 跳过**（包含上述 35 项真实 MySQL）。`C2HistoryBoundaryTest`、C5/config/Elder/旧 History bridge/security 结果见本轮 [测试汇总](../../../output/c2-a/verification-summary.json) 和 [最终 Java 日志](../../../output/c2-a/java-final.log)。
- [C2 公开快照脚本](../../../scripts/check-c2-snapshot-runtime.mjs)：三类完整公开展示与现有前端服务独立 oracle 相等，非法答案/Mock/来源 revision 错误/不支持版本拒绝。Java 中另验证打包后的实际桥接。
- C1 domain、C1 composition（含 TypeScript/ES5）、旧 Recommendation V2 定向检查通过；新增 wire types 定向 TypeScript 检查通过。没有完整 UI、手机、多路由或生产验收。

Java 21 / Maven；正式 C2 集成测试需 `C2_HISTORY_DISPOSABLE_MYSQL=true`、`C2_HISTORY_MYSQL_URL/USERNAME/PASSWORD`；旧 History 用 `HISTORY_DISPOSABLE_MYSQL=true`、`HISTORY_TEST_MYSQL_URL` 及可选 `HISTORY_TEST_MYSQL_USERNAME/PASSWORD`。仅指向全新隔离测试库，严禁真实用户库；未配置会 SKIP，不能写数据库 PASS。

下一步为 C2-B 页面接入上述显式保存/重新展示确认/回执恢复/只读列表详情，并独立补齐真实开放所需条件；本轮后端代码通过不代表这些条件已满足。
