# A01 Batch 1 历史报告归档清单

归档日期：2026-10-13（Asia/Shanghai）。本清单仅记录历史文件处理和恢复，不提供 CURRENT 规范。

| 候选 | 原始路径 | 目标路径 | 处理原因 |
|---|---|---|---|
| UI-0 / ARCHIVED | `docs/ui/warm-swiss-v1/WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md` | `docs/archive/ui/warm-swiss-v1/implementation-reports/WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md` | 2026-10-07 的实施审计记录，正文明确不替代产品 Source 或 Frozen Contract；clean tracked，非规范、非签署合同。 |
| UI-1 / SKIPPED | `docs/ui/warm-swiss-v1/WARM_SWISS_UI_1_IMPLEMENTATION_REPORT.md` | `docs/archive/ui/warm-swiss-v1/implementation-reports/WARM_SWISS_UI_1_IMPLEMENTATION_REPORT.md`（未创建） | 原文 25 个可点击相对证据链接在目标位置失效；修复需改写原文字节或新增白名单外文件，因此保留原路径完整原文。 |

| 文件 | 原始 SHA256 | 归档后 SHA256 |
|---|---|---|
| UI-0 | `2a5e10298fdbf89815bc4cf232603e6086a7032d5e7489c2c5bca2f6d32d3375` | `2a5e10298fdbf89815bc4cf232603e6086a7032d5e7489c2c5bca2f6d32d3375` |
| UI-1 | `39c0f320fd85a7c6c0b1376879ec4a3d036404cdafe8023c14d80c80c41b3936` | NOT_APPLICABLE（未归档，原始 SHA256 保持） |

引用验证结果：

- 限定精确文件名检查 CURRENT 文档、AGENTS、Skills、Contract、Registry 和 scripts，没有发现必须保留正文、标题锚点、签署绑定或机器内容解析的入站要求。历史引用具有用途，未因未命中活动引用而判断无用。
- `output/warm-swiss-v1_2-full-coverage-audit/evidence-index.md` 的 UI-0 链接（14、58、273 行）不带锚点；旧路径兼容入口可继续找到完整原文。UI-1 入站链接保持原状。
- 另有历史工作区 hash/file-list 快照引用：原快照不改写；原文 hash 由归档副本保留。这些快照不是新签署或现行读取规范。相关精确文件名搜索未命中可执行脚本内容解析。
- UI-0 无可点击相对 Markdown 链接或图片；16 个文字路径引用逐项存在。原文的 `../../../output/warm-swiss-ui-0/test-results.json` 是 code span，原目录解析为 `output/warm-swiss-ui-0/test-results.json`；旧路径入口新增有效测试摘要链接，完整快照不改写。
- 原文“本目录 README”和 PDF 名称沿原始目录解析；原路径入口给出有效 README、V1.1 PDF 和 V1.2 PDF 链接。其余 `output/...` 路径按正文声明相对仓库根解析，所有原证据保持原位置。
- 不从 archive 所在目录重新解释历史文字路径。UI-1 具有实际可点击相对链接，故不使用文字基址说明代替链接修复。

原路径兼容方式：[docs/ui/warm-swiss-v1/WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md](../../../../ui/warm-swiss-v1/WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md) 保留 HISTORICAL / ARCHIVED / NOT_CURRENT 轻量入口，链接到 [完整原文](WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md)；未保留正文解析或旧锚点接口，因为未发现这类入站要求。

恢复方式：先核对归档 UI-0 的 SHA256 为上表值，再将其原始字节复制回 `docs/ui/warm-swiss-v1/WARM_SWISS_UI_0_IMPLEMENTATION_REPORT.md` 覆盖本批次兼容入口，并确认恢复后 SHA256 相同。归档副本和本清单可保留作为历史；恢复应单独授权，不使用 Git 重置。UI-1 无需恢复。
