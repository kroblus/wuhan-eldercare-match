# 正式机构护理证据接入

应用阶段 V2.0，不改变 Institution V1.2.1、Capability V1 或 Recommendation V2。

当前入口位于 `modes/production/`：

- `capability-reviews.ts` 保存4家既有机构的公开来源、逐项观察、疑点及人工确认问题。仅查阅公开文件，未电话、现场或合作确认。
- `capability-review-matrix.ts` 将观察展开为既有字段路径的待核验行；缺少直接陈述时明确保留 null，不生成原文引述。76个匹配护理字段、4个参考月费字段及1个术后康复展示字段，共81项待核验。
- `capability-evidence.ts` 只接收既有能力字段路径，不解释中文、不从机构类型或宣传词推断能力。

2026-10-23核对的资料包括市民政局机构职能页、汉阳与洪山2024年专项接收公告、汉阳2026年开放日公告和两份原始附件，以及太保官网介绍。原始发布时间与访问日期分开；附件、官网未标注独立发布日期时保留null。活动日期、URL日期、开业日期不冒充发稿日期。

本轮没有符合当前有效、精确字段核验门槛的新护理事实。`productionCapabilityRevisions` 为空；11家机构原始revision及证据保持不变。19项匹配护理能力均未知，不把国标“完全失能4级”映射为平台某个照护等级，也不把“记忆照护”“术后康复”扩张为专区、高走失风险接收或专项训练。

## 后续加入一项已核实能力

1. 在来源表增加准确URL、发布主体、原始发布日期、核对日、复核截止日、来源类型、适用机构身份及来源状态。既有来源key和历史元数据不可覆盖，后续复核使用新key；来源失效时也保留原核查时的记录。复核期限是内部检查期限，不是机构服务承诺。
2. 新建 `CapabilityRevisionChange`，显式指定同一机构的 `parentRevision` 和新的 `recordRevision`。每行指定既有 `fieldPath`、独立的能力值与verification状态、精确valueSnapshot、来源、原文和确认问题。
3. 只有人工核对后确有直接、当前的字段证据，才能声明 `direct_current_statement`；该标记不是自动核验器。历史、概括、不明确或冲突资料继续放待核验记录，不可用标记替代证据。
4. builder校验来源机构、字段、日期、快照与证据闭合，并通过既有完整Validator。非法变更使provider拒绝加载，不静默使用旧事实冒充新核查结果。
5. successor复制未改变事实，以原有核对时间重新绑定其证据到新revision，保留父记录原样；currentPointer按显式变更更新，不按最大revision猜测。`readProductionRevision`仅做精确历史查询，不latest fallback。在线历史入口仍遵循既有resolver安全拒绝规则，不会自动拼接新事实。
6. 时间自然经过validUntil不重新生成revision或核验日期。既有投影在显式evaluationAsOf将过期证据视为unknown，不变成unsupported。来源失效或矛盾若影响已发布事实，应提交有明确父级的新版本处置；使用导入行 `disposition=withdraw_to_unknown` 显式撤回旧结论，只能输出unknown/unverified，不得附加新核验日期、来源或服务证据。旧revision继续保存原证据，禁止原地改写历史。该处置标记不是Domain枚举，也不自动导入待核验记录。
7. 运行 `check:capability-evidence`、双构建、`check:real-institution-provider`、`check:run-mode-convergence`及受影响检查。后续新增真实事实时，相应更新数据基线断言；不要删除安全测试。

详情读取的核查说明是独立、精确机构版本绑定的说明资料；只显示待确认状态、公开来源及咨询问题，不转换成Institution事实、推荐理由或服务承诺。其他7家不显示本轮核查完成标记。演示模式使用空说明提供者，不加载这些真实机构研究记录。

测试正反例全部来自明确的合成机构和 `example.invalid` 测试来源。便携检查可在普通Node runner运行；完整微信双构建仍需本机工具链。本轮仅本地验证，不声称远端CI执行。
