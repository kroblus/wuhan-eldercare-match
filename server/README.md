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

## Institution 历史版本存储

Flyway V5 建立完整 Institution record snapshot、显式 current head 与受控发布 provenance 的持久化表。历史名称解析只读取指定的 `(institutionId, recordRevision)`；找不到该版本时返回 unavailable，不回退到 current head 或开发 Mock。一次成功发布在同一事务内写入不可变版本并提升 current head；应用正常启动不会自动导入机构资料。

发布是部署方控制的内部操作，不开放 HTTP 或小程序写入入口，也不使用 C5 普通用户 session 作为运营权限。发布包需要完整 Institution record、operation ID、source reference 和 operator reference；服务端签发版本及发布时间，并在写入前调用随 Backend 打包的 Institution 领域校验器。该校验器运行时需要 Node.js 24 或更新版本，缺失时发布失败关闭，普通历史名称读取不依赖 Node。Mock 仅用于开发与测试，不是生产资料来源；本仓库没有自动回填旧 Visit 所引用历史版本的流程。

仅在受控环境显式运行应用主类并传入 `--institution.publisher.command=publish --institution.publisher.input=<package-path>`，同时配置上述持久化环境变量。输入文件是内部发布包，不由普通用户上传；命令退出码和脱敏状态用于核验结果。正常启动不带此命令参数。
