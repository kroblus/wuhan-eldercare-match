# 快康养 Excel 导出绿色主题

2026-10-29。后台的后续 Excel 下载统一使用绿色品牌样式，保留四张工作表、聚合口径、公式与快照机制。

- 深青绿标题和表头（`#0F514F`）、薄荷色分区（`#E7F5EE`）、浅绿隔行底色（`#F7FBF8`）；文字、细线和图表跟随后台 Evergreen 色板。
- 提高标题、表头和总览数据行高度，增加数值与说明的留白，拓宽总览数字列并扩大图表；保留冻结窗格、横向打印及百分比格式。
- 合并区域完整着色，来源计数区域合并空白标签列，四个工作表标签统一绿色。未增加依赖。

## 验证

- 最终使用 `server/tools/check-p1-operations.ps1 -Tests P1ReportsMySqlIntegrationTest` 新建临时库：7 项报表集成测试通过、无跳过，完成后清理临时库；包括前端干净安装与 TypeScript/Vite 构建，再以 `mvn -f server/pom.xml jar:jar spring-boot:repackage` 打包当前已编译产物。
- 中间一次直接复用演示库重跑，因固定测试日期残留导致计数断言失败，已改用上述隔离流程验证；没有修改统计逻辑来迁就测试。
- 本机隔离合成后台登录后，通过实际 HTTP 导出原批次 `e2fc8a68-5ae5-4da5-9d55-83c949cc0e84`，返回 200 / XLSX。
- 与用户原下载文件逐单元格核对：四张表所有非空内容、数据类型和公式相同；图表数据引用与缓存值相同。原下载文件未修改，SHA-256 仍为 `062cd56e37106733d714a03b6fc2cee4f604c68c9a0c7cd6fa33a57bde494394`。
- 新文件的全部 OOXML 可解析、样式索引有效、四张表可见；品牌色正确，无存储错误值。Artifact Tool 导入并渲染四张表，检查标题、两行表头、数字、规则说明和图表无裁切；公式错误扫描无命中。

本轮是后台导出及文件渲染验收，未声称 Excel/WPS 原生应用或手机文件打开已验收；未部署生产。现在可在本机合成后台重新下载绿色报告，生产使用需要后续部署该 JAR。

本地证据与示例（保留在 output，不随 Git 上传）：

- [实际导出的示例表格](../../../output/admin-report-theme-20261029/快康养-绿色主题服务报告.xlsx)
- [同批次内容核对](../../../output/admin-report-theme-20261029/verification.json)
- [最终构建与测试日志](../../../output/admin-report-theme-20261029/isolated-tests/backend-tests.log)、[打包日志](../../../output/admin-report-theme-20261029/package.log)
- [总览](../../../output/admin-report-theme-20261029/after-报告总览.png)、[画像](../../../output/admin-report-theme-20261029/after-需求画像汇总.png)、[机构](../../../output/admin-report-theme-20261029/after-机构服务成果.png)、[口径](../../../output/admin-report-theme-20261029/after-统计口径.png)
