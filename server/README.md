# C4 预约提交后端 Foundation

本目录包含 V1.2-C4 的最小 Spring Boot 后端 Foundation：版本化、未信任的预约提交边界，可信身份/目的限定联系方式/机构与老人引用校验端口，以及真实 MySQL 的原子 create-or-replay 与持久化幂等性。

技术基线：

- Spring Boot 3.x
- Java 21
- MySQL 8.x
- V1 默认不引入 Redis

## 本地配置

默认 `c4.persistence.enabled=false`。缺少真实适配器或数据库时，应用保持 `AUTH_REQUIRED` / `SERVICE_UNAVAILABLE` 等 fail-closed 结果，不会生成伪造的 `visitId`、时间戳或提交成功。

启用真实 MySQL 时，使用环境变量 `C4_PERSISTENCE_ENABLED=true`、`C4_MYSQL_URL`、`C4_MYSQL_USERNAME` 和可选的 `C4_MYSQL_PASSWORD`。Flyway 会执行 `src/main/resources/db/migration` 中的版本化 migration；不要把凭据写入仓库。

## 验证

在 Java 21 与 Maven 环境中从本目录执行 `mvn test`。真实数据库 migration、replay/conflict、事务回滚和同 key 并发证据由显式设置 `C4_MYSQL_*` 的 disposable MySQL integration test 提供；未配置时该组测试会跳过，不会伪装成生产能力。

C4 不包含具体微信登录/手机号 provider、Backend 部署、owner-read、Operations lifecycle、VisitEvaluation 或小程序 Page；这些能力仍需后续 phase。`requested` 是唯一初始状态，`SUBMITTED != CONFIRMED`。

## C5 微信可信身份边界

C5 在服务端使用微信 `jscode2session` 校验一次性登录 code，以独立 MySQL 表保存微信主体摘要到 opaque `userId` 的映射，并签发只保存 SHA-256 摘要的自有 session。`/api/v1/auth/wechat` 返回自有 session evidence；C4 的 `AuthEvidenceResolver` 仅验证该 session。身份映射与 session 发放在同一数据库事务内完成，失败不留下新身份记录。

默认 `C5_AUTH_ENABLED=false`，缺少真实配置时失败关闭。启用须由服务端环境提供 `C5_AUTH_ENABLED=true`、`C4_PERSISTENCE_ENABLED=true`、`C5_WECHAT_APP_ID`、`C5_WECHAT_APP_SECRET`、`C5_AUTH_HASH_SECRET`；可选 `C5_SESSION_TTL_SECONDS`。AppSecret 与 HMAC 密钥不得提交到仓库、输出到日志或进入小程序。C5 不取得手机号，也不启用预约提交、机构/老人引用授权或客户端登录编排。
