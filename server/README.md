> 2026-10-27：C2-A 独立正式单老人历史后端已实现，合成 MySQL 定向验证通过；真实数据写入默认关闭，前端尚未接入。原 CompletedAssessment History 仍为 TEST_ONLY，保护条件未解除。接口、开放条件与证据见 [C2-A 总结](../docs/phases/v1-3-c2-a/SUMMARY.md)。

# C4 预约提交后端 Foundation

独立测试环境准备流程见 [History 环境与设备门禁](../docs/development/ASSESSMENT_HISTORY_TEST_ENVIRONMENT_RUNBOOK_V1.md)。该流程使用当前工作区快照、固定运行包、新 disposable 实例和专库受限用户，随机合成 C5 密钥/本机 ticket 不进入前端。缺独立 AppID/可信服务器关系/HTTPS/设备时保持 WAITING_FOR_OWNER / NOT_VERIFIED / NOT_RUN；不改正式配置或升级已有协议。旧 root/loopback 测试示例不能代替这轮环境门禁。

## TEST_ONLY trusted Recommendation Preview → History

Trusted capability also requires server-installed `HistoryTrustedPreviewInputSource`: a bounded, copied immutable exact-fixture allowlist. Missing source fails closed. Full canonical input equality is checked before candidate reuse, Node calculation or persistence; synthetic C5, client declarations/Headers/digests are insufficient. Test classpath installs only `test-only-answers.json` and the explicit no-safe cognitive-unknown variant. Valid unapproved answers are refused with zero candidate/completion creation. Production has no source provider; arbitrary real inputs remain unauthorized.

Existing History capability/C5/sole-Elder/disposable gates additionally require default-off `assessment.history.trusted-preview-enabled` and a deployment-owned stable `assessment.history.test-only-environment-id` (`TEST_ONLY_[A-Za-z0-9_-]{1,72}`), distinct for different isolated environments. The test-classpath harness adds explicit `--trusted-preview --user-loop --recommendation`; production/default source and writes remain closed.

Owner-scoped POST `/api/v1/completed-assessments/trusted-previews` generates bounded Formal V2 synthetic Profile/Recommendation display from the controlled server Catalog, not an anonymous client result. `/trusted-previews/check` reads only candidate validity. V7 stores immutable synthetic candidate payload/source/revision pins with ACTIVE → BOUND → CONSUMED or ACTIVE → REVOKED, 600-second use expiry and existing owner total/burst resource parameters. No automatic cleanup, unknown-intent abandonment or real retention approval. Response exposes controlled display and opaque body-only associations, never answers/identity credentials/public health digest.

V7 candidate creation durably stores full submitted **synthetic** answers and derived displays before D02 completion confirmation, to validate the exact original input. UI warns before the explicit request. Expiry/revocation prevents use but does not delete those isolated test rows. No real health data, production retention, consent or deletion policy is authorized by this protocol.

Trusted successful replay rechecks consumed candidate namespace/owner/Elder/intent/session/completion/ID/binding while permitting original expiry. Namespace fences candidate operations; it is not confidentiality filtering for existing owner-scoped list/detail/reconcile. Distinct TEST deployments require separate database, C5 identity/session storage, backend and build/AppID isolation. Shared DB plus namespace strings is insufficient; no stronger historical isolation contract is invented here.

Trusted `/save-intents` shape binds the same candidate to the existing Session intent; the completion POST uses `completed_assessment_save_with_trusted_preview_request_v1` plus previewId/displayBinding. Owner/Elder/namespace/Session/nonce/canonical input are rechecked transactionally; legacy bypass is rejected for candidate Sessions. Commit copies pinned display without current Catalog/Node recomputation, remapping only final completion ID/time. Unique associations and original canonical digest preserve concurrent one-completion, rollback, replay and metadata-only cold recovery. Missing/expired/unknown original intent stays safely blocked. True anonymous claiming, real identity/consent/source/rights/retention and production remain outside this stage.

Targeted verification: `HistoryTrustedPreviewMySqlIntegrationTest`, existing History/config/bridge/security suites, `node scripts/check-trusted-assessment-preview.mjs --http` (virtual build fixture, real synthetic HTTP/MySQL), and `HISTORY_TRUSTED_PREVIEW=true` with the existing real killed/new-PID cold script. Independent TEST AppID/build/TLS/device proof is not established by these tests. Contract details remain PROPOSED_NOT_FROZEN in `docs/architecture/COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`.

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

## CompletedAssessment History — TEST_ONLY

独立草案 `docs/architecture/COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md` 保持 PROPOSED_NOT_FROZEN。GET/POST `/api/v1/completed-assessments` 已实现隔离的完成态保存与 owner-scoped 元数据读取；默认返回 UNAVAILABLE。主应用不包含合成身份 Provider，生产写入没有可启用配置。

仅在 `assessment-history-test-only` 服务端 profile、`assessment.history.test-only-enabled=true`、`assessment.history.disposable-mysql=true` 同时满足时尝试初始化隔离 History store。数据库必须是 loopback、非 3306、schema 名含 disposable 的 MySQL；其他地址启动失败关闭。独立迁移位于 `db/assessment-history-test-only`，不加入默认生产 Flyway 路径。校验器需要 Node 24，执行打包的现有 Assessment V2 纯校验实现。没有合法保存 UI/隐私授权时，前端只读 Provider 不发送保存请求。

后端定向验证：设置 `HISTORY_DISPOSABLE_MYSQL=true` 与 `HISTORY_TEST_MYSQL_URL` 指向自行建立的 disposable MySQL，运行 `mvn -Dtest=HistoryMySqlIntegrationTest,AssessmentHistoryConfigurationTest,C5AuthEvidenceResolverTest,C5AuthProviderFirewallTest,C5AuthServiceTest test`。缺少显式隔离数据库时集成测试 SKIP，不算数据库 PASS。`HistorySyntheticE2eServer` 仅存在于 test classpath；它使用真实 C5 会话表和仅测试的合成 WeChat exchange Provider，不属于正式打包产物。

根目录定向脚本：`check-completed-assessment-history-validator.mjs`、`check-completed-assessment-history-provider-runtime.mjs`、`check-completed-assessment-history-e2e.mjs`。HTTP E2E 需启用/禁用两组 test-classpath Server 与全新 disposable schema；不会接真实微信账号或用户库。真实收集/隐私同意、保留删除、生产身份/来源/部署、正式保存 UI、历史结果和无损重新评估仍有独立 Owner Gate。

额外默认关闭的 `assessment.history.user-loop-enabled=true` 仅在上述隔离门禁内有效。公开 `/user-loop-capability` 无身份或记录内容；小程序 develop 运行时仅在正确回执后展示独立 TEST_ONLY 操作区。显式保存不改 Draft，未确认回执时固定原 payload/idempotency intent 重试。GET `/api/v1/completed-assessments/{id}` 通过 C5 当前账号及 sole Elder binding 读取不可变最小画像展示；未知/错误账号/非法 ID 统一 NOT_FOUND，不返回原始答案、owner 或 elderId。旧记录无画像显示 unavailable；没有历史 Recommendation 快照，不重新计算。

独立 V2 迁移为后续新记录增加 immutable Profile display V1 表；不改写或回填旧记录。六个受控显示行使用打包的现行 ElderProfile V2 pure derivation，在创建事务内生成一次并保存。Node 桥接使用独立 stdin、参数数组、限长输出、八秒进程期限及最多四并发；缺失 Node24/依赖或失败拒绝并回滚，不记录答案。后端增加 `HistoryBridgeIsolationTest`；`check:completed-assessment-user-loop-e2e` 验证真实 HTTP/MySQL 与 History/PrimaryButton/Intro 动作闭环。

运行 test-classpath `HistorySyntheticE2eServer --user-loop` 与 `--disabled --user-loop`（启用/关闭端口34479/34480），设置 `HISTORY_DISPOSABLE_MYSQL=true` 后执行新增 E2E。模拟器准备脚本 `check-completed-assessment-user-loop-devtools.mjs` 仅生成 `server/target/history-loop-simulator-*` 独立项目副本；合成登录/问卷只写该副本，不进入正式小程序。`--empty-context` 生成独立空草稿副本。不得上传副本、切真实会话或把 TEST_ONLY 验收当生产批准。

历史 Recommendation 额外使用默认关闭的 `assessment.history.recommendation-snapshot-enabled` 和服务器安装的 `HistoryRecommendationSource`；主应用无默认来源，客户端不能提交推荐 JSON/来源或通过 Header 激活。TEST classpath 的 `--recommendation --user-loop` 从当前已批准 Mock V1.2.1 目录的合法 V1.1 投影取得输入，在显式保存事务内调用 unchanged `evaluateFormalRecommendationV2`，不持久化匿名 Preview。V3 TEST_ONLY 迁移独立保存受控展示、实际候选顺序/reason/difference/gap、机构 revision、全部版本与服务器来源 digest；旧记录不回填。GET `/{id}/recommendation` 只读存储，不调用 Node 或当前 Catalog；missing/no-safe/unsupported/error 分开，跨账号和不存在使用相同404。

保存 body 在 JSON 解析前限长64KiB，混合 production profile 或启用真实 C5 适配器（c5.auth.enabled=true）均拒绝 TEST_ONLY History，实际身份配置保持不变。Recommendation Node 输入/输出限制1MiB/256KiB，仍受八秒期限及四并发限制。定向安全用 `HistorySecurityGateTest`、`HistoryBridgeIsolationTest`、现有 MySQL/C5/config 测试；Maven 使用新的 `-Dsurefire.reportNameSuffix=<本次唯一后缀>` 保留原报告。根脚本 `check:completed-assessment-recommendation-runtime` 验证 Formal/Display parity 及客户端状态，`check:completed-assessment-recommendation-e2e` 验证真实 HTTP/C5/MySQL 的 Profile → 历史推荐 → 返回与草稿保护。源 fixture 仅作为 TEST server 输入，不包含任何预制历史输出，不进入生产 resources。

上一阶段已完成独立只读安全 QA 及真实客户端进程级冷启动恢复；原冷启动 MEDIUM 已关闭。真实身份、生产机构来源/隐私及运行环境安全、Android 真机验收仍未通过。提案保持 PROPOSED_NOT_FROZEN，生产写入关闭。


TEST_ONLY History cold-start recovery: explicit save prepares a server-bound random intent and verifies metadata-only local persistence before sending answers. History opens with scope-checked reconciliation and an explicit retry-query action; unknown results block new submission. No new page route or production save entrance. The scoped backend `save-intents/scope`, `save-intents`, `save-intents/reconcile` endpoints reuse C5 + sole Elder transaction authorization and completion metadata; V4 runs only in the existing isolated disposable migration chain. Proposal policy/details: `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`. No Frozen or Draft semantics changed.


TEST_ONLY intent resource protection (creation only): defaults owner total 256 and burst 16/60s. Independent bounded test properties are `assessment.history.test-only-intent-max-per-owner` (1..1000), `assessment.history.test-only-intent-max-per-window` (1..32, <= total), `assessment.history.test-only-intent-window-seconds` (1..3600). Owner-wide persisted counts and creation are serialized by existing C5/Elder transaction locks. Refusal is 429/INTENT_CREATE_LIMITED; existing reconciliation, pending original-key save, replay and immutable reads are not limited. There is no reset, expiry, delete, production quota or new migration. Full capacity is a safe stop, not permission to discard pending operations.

`HistorySyntheticE2eServer --intent-guard-check --user-loop --recommendation` uses port34481 and a separate fresh disposable schema with test limits4 total /2 per5s; `npm run check:history-intent-resource-guard-e2e` exercises real HTTP constraints and continued reads/recovery. Keep the ordinary enabled/disabled E2E servers on34479/34480 and another fresh schema. Main HTTP user-loop/cold-process E2Es write the same synthetic account and must run sequentially. Maven report suffixes must be new to preserve prior evidence. Android preparation: `docs/development/ASSESSMENT_HISTORY_ANDROID_17_TEST_ONLY_ACCEPTANCE_V1.md`; absence of actual hardware/secure test connectivity means NOT_RUN, not Simulator PASS.


Device preparer generates a source manifest and supports fixed synthetic accounts. Default registered-AppID copy is Simulator-only (device runtime cannot seed/read Draft or access TEST_ONLY History). Owner must supply/verify a different independent registered test AppID for phone use; format is not authorization, and same-AppID copies are not independent device storage. One-time seeding preserves edited/partial/nonempty Drafts at startup. `npm run check:assessment-history-device-preparation` verifies the generated-copy boundary with TypeScript4.1.2; it is runtime simulation, not Android evidence.


TEST_ONLY Session lifecycle: D03/D04 approved behavior is implemented only in the isolated History operation area; the whole History proposal remains PROPOSED_NOT_FROZEN. V5 adds immutable AssessmentSession → SaveIntent → CompletedAssessment associations. Same-session preparation/replay never creates a second completion. Initial registration allows one scoped root; explicit `assessment-sessions/new` requires an authorized completed predecessor and idempotently returns one successor for the durable candidate context. Save acknowledgment retains Draft. The private confirmation action can replace the existing single active slot only after trusted original-payload ACK evidence, unchanged answers and fresh C5/Elder checks; cancel/edited/pending/unknown/cold-proof-missing states preserve and block. `history-assessment-session.ts` stores only non-sensitive context/transition metadata, with SWITCH_REQUESTED readback before the new-session request and SWITCH_PREPARED before single-slot CAS. No clear/reset, new sensitive local backup, formal Recommendation UI, production route or real-user enablement. Existing Intro → Basic navigation is reused. Cold-start reconciliation remains supported; lack of content evidence never becomes permission to replace Draft. See the latest Owner decision update and Session lifecycle boundary in `COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md`.


Decision alignment TEST_ONLY increment: the latest D01–D12 approval levels and formal-release plan are in the current register and Release Readiness section of COMPLETED_ASSESSMENT_HISTORY_CONTRACT_V1.md, still PROPOSED_NOT_FROZEN. History Save now opens a private single-use confirmation; cancel creates no intent/upload, confirmation rechecks answers/C5/sole-Elder/environment. It explicitly disclaims equality with the anonymous Preview and is not sensitive-data consent. Owner-scoped POST assessment-sessions/inspect-context reads only workflow state; missing/corrupt recovery markers block resubmission, and ALREADY_PREPARED cannot become a fresh request. V6 preserves non-sensitive context provenance with a unique claim to prevent cross-scope reassignment of inherited Draft contexts; no answer/history backfill, cleanup or production migration. Unassociated legacy intents/completions fence new allocations (RECOVERY_REQUIRED/LEGACY_RECOVERY_REQUIRED) while old authorized reads, original late completion and replay remain available. Existing A→B and cold recovery stay; late list/detail/Recommendation replies recheck current scope. Scope GET uses base isolated History authorization for metadata-only reads; prepare/reconcile still require user-loop. No formal Recommendation UI, route, real identity, sensitive consent/deletion or production enablement is implemented. Human recovery channel/terminal closure, D08 release/retention, D09 final fields, D10 real source and D11/D12 detailed processes still require approval.
