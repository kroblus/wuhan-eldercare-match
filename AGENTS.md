# 武汉养老机构精准匹配小程序 — Project Agent Contract V2.1

本文件只保存所有任务都需要知道的全局规则。业务细节以当前版本化 Contract 为准；不要把本文件当第二份 PRD 或算法规格。

## 1. Source of Truth

- 当前产品版本由 `docs/product/README.md` 指定；`docs/product/archive/**` 仅作历史参考。
- 已冻结的领域语义以对应 frozen Contract / Ruleset 为准。
- **不要默认读取 `CONTRACT_INDEX.md`。** 只有任务跨领域、版本归属不明确，或不知道该读哪份 Contract 时才读取 `docs/architecture/CONTRACT_INDEX.md`。
- Proposal、旧 Contract、Bootstrap 文档不能覆盖 active frozen Contract。

如果任务与 frozen Contract 真正冲突，指出最小冲突点；只有该冲突会改变实现结果时才请求项目负责人决策。其余独立工作继续完成。

## 2. 全局 Invariants

- 不伪造机构价格、床位、人员、护理/医疗能力、资质、评价、电话、地址、坐标、VR 等现实事实。
- `unknown / unavailable / unverified / expired / false` 按所属 Contract 保持不同语义。
- Mock / synthetic 数据必须保持显式开发 provenance，不得冒充真实武汉机构数据。
- Institution verified fact、公开展示内容、运营状态、用户反馈/VisitEvaluation 不得互相越权覆盖。
- V1.2 的 CareProcess、AI、Consultant、Visit/Evaluation、官方电话、地址/Geo、公开简介不得改变 Recommendation V2 的 Safety、Eligibility、Exactness、PriorityFitVector、Rank Tuple 或 `NO_EXACT_MATCH`，除非未来新 Contract 明确批准。
- AI 只能解释允许读取的快照/已核验展示数据；不得重算、重排或写回 Recommendation / Institution verified facts。
- 历史 CompletedAssessment、ElderProfile / Recommendation、旧 Institution revision 不得就地升级或覆盖；新语义走显式版本 dispatch / migration / successor。
- 健康、认知、特殊护理等敏感数据最小化读取与传递；不得记录完整健康答案/Profile。Secret、AppSecret、模型 API Key 不得进入小程序前端或仓库。

## 3. Agent 路由

主会话负责跨域架构、任务拆分、Contract 冲突、集成与最终验收。不要为了多 Agent 机械启动全部子 Agent。

- `wechat_frontend`：页面、组件、前端 application/view-model/state/integration。
- `backend_domain`：`server/**`、API、持久化、认证与服务端领域边界。
- `matching_engine`：Assessment 派生、ElderProfile、Recommendation 等纯领域规则/runtime。
- `qa_reviewer`：独立只读 QA / review。

### Delegate before deep-read

如果任务已有明确专项所有者，主会话先完成**轻量路由**，再委派；不要主会话先全文读取大型领域 Contract、随后又让子 Agent 重复读取。主会话只在跨域设计、冲突判断或最终集成确实需要时深读对应 Contract。

仅当任务跨两个以上所有权边界且能独立并行时再并发；会修改同一核心文件的写入任务不要并发。小型、单域、低风险修改可由主会话或一个专项 Agent 直接完成。

## 4. Repo Skills

只在触发条件匹配时加载：

- `wechat-runtime-compat`：Mini Program class、`wx.*`、生成 JS 兼容性、共享组件事件传播。
- `wechat-interaction`：用户 Action、validation、navigation、disabled/loading、Assessment 交互。
- `recommendation-v2`：Recommendation V2 eligibility/exactness/ranking/reason-difference/integration。

纯文案、纯视觉 Less、无行为的数据展示修改通常不加载微信 Skills。

## 5. 决定边界

默认自主完成：任务内必要阅读、工作区修改、相关本地检查，以及修复本次变更直接造成的失败。

不要自行发明：frozen Contract 新语义、未批准 stable code/结果 shape、真实机构事实/Secret/生产数据、不可逆生产操作，或 Source of Truth 未决定且会明显改变业务结果的产品方案。

## 6. 验证与额度纪律

验证范围按 `requested behavior + changed files + affected Contract + realistic regression surface` 决定。

- 先跑直接相关测试和 Contract 明确要求的 Gate。
- 通过后不无理由扩大测试；共享代码、失败、新风险或 Contract 明确要求时再追加。
- 不要为一次小改动启动多个 Agent 只为重复 review。
- 主会话与子 Agent 避免重复读取同一大型 Contract；优先由实际实现/审查的 Agent 深读并返回压缩结论。
- DevTools、自动化、ADB、人工真机证据必须分开报告；拿不到就如实标风险。
- 可用脚本以 `package.json` 为准，不在常驻 Prompt 维护脚本清单。

## 7. 完成标准

明确实现任务应持续到请求范围真正完成，不因第一版代码完成就默认停下等待 review。

通常完成意味着：实现请求行为；未破坏相关 Contract/版本边界；运行与改动匹配的验证并处理本次改动造成的失败；剩余外部依赖、人工证据或真实产品决策被明确记录。

最终报告简洁说明 `STATUS / CHANGES / TESTS / RISKS`；不要只回复“完成”。
