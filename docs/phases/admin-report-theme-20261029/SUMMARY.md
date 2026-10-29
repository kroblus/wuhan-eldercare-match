# 快康养 Excel 导出绿色主题

2026-10-29。后台的后续 Excel 下载统一使用绿色品牌样式，保留四张工作表、聚合口径、公式与快照机制。

- 深青绿标题和表头（`#0F514F`）、薄荷色分区（`#E7F5EE`）、浅绿隔行底色（`#F7FBF8`）；文字、细线和图表跟随后台 Evergreen 色板。
- 提高标题、表头和总览数据行高度，增加数值与说明的留白，拓宽总览数字列并扩大图表；保留横向打印及百分比格式。冻结范围按下文 WPS 修正结果执行。
- 合并区域完整着色，来源计数区域合并空白标签列，四个工作表标签统一绿色。未增加依赖。

## 验证

- 最终使用 `server/tools/check-p1-operations.ps1 -Tests P1ReportsMySqlIntegrationTest` 新建临时库：7 项报表集成测试通过、无跳过，完成后清理临时库；包括前端干净安装与 TypeScript/Vite 构建，再以 `mvn -f server/pom.xml jar:jar spring-boot:repackage` 打包当前已编译产物。
- 中间一次直接复用演示库重跑，因固定测试日期残留导致计数断言失败，已改用上述隔离流程验证；没有修改统计逻辑来迁就测试。
- 本机隔离合成后台登录后，通过实际 HTTP 导出原批次 `e2fc8a68-5ae5-4da5-9d55-83c949cc0e84`，返回 200 / XLSX。
- 与用户原下载文件逐单元格核对：四张表所有非空内容、数据类型和公式相同；图表数据引用与缓存值相同。原下载文件未修改，SHA-256 仍为 `062cd56e37106733d714a03b6fc2cee4f604c68c9a0c7cd6fa33a57bde494394`。
- 新文件的全部 OOXML 可解析、样式索引有效、四张表可见；品牌色正确，无存储错误值。Artifact Tool 导入并渲染四张表，检查标题、两行表头、数字、规则说明和图表无裁切；公式错误扫描无命中。

首次绿色主题交付仅完成后台导出及文件渲染验收，原生应用结果见下方追加记录；手机文件打开仍未验收，未部署生产。现在可在本机合成后台重新下载绿色报告，生产使用需要后续部署该 JAR。

## 同日追加：WPS 分隔线与空白区横线修正

用户实际 WPS 截图暴露了渲染预览未覆盖的冻结分隔线：原先所有表固定 A:B 列及前 8 行，纵线切过合并元信息，横线穿过总览图表。此外，默认单元格样式使用底边框，导致未写入内容的区域也显示横线。

- 总览取消冻结，打开时选择 A1；三张明细表只冻结前 8 行，不冻结列。
- 默认样式恢复无边框、无填充，数据区单独使用带细线样式；绿色主题不变。
- 在现有报表集成测试中加入总览无冻结、明细无冻结列及默认无边框断言；隔离临时库 7 项测试全部通过，前端构建与 JAR 打包通过。
- 从更新后的本机合成后台实际 HTTP 下载同批次修正版，四张表内容、类型、公式及图表数据均与用户原文件一致；四表重新渲染、错误扫描通过。旧文件未覆盖。
- WPS 原生验收通过：总览标题与图表无冻结线切割，I 列以后空白干净；画像表纵向滚动时表头保留，尾部空白无横线，横向滚动时首列随之移动。机构成果、统计口径标题和内容可读，明细仅在第 8 行下方保留正常冻结线。保留用户旧表未保存状态；本次新表验收后关闭且不保存。

追加证据：[用户原截图](../../../output/admin-report-layout-fix-20261029/before-user-wps.png)、[修正版](../../../output/admin-report-layout-fix-20261029/快康养-绿色报告-版式修正版.xlsx)、[下载与内容核对](../../../output/admin-report-layout-fix-20261029/verification.json)、[隔离测试](../../../output/admin-report-layout-fix-20261029/isolated-tests/backend-tests.log)、[打包](../../../output/admin-report-layout-fix-20261029/package.log)。

WPS 原生截图：[总览](../../../output/admin-report-layout-fix-20261029/wps-summary.png)、[画像滚动](../../../output/admin-report-layout-fix-20261029/wps-profile-scroll.png)、[机构成果](../../../output/admin-report-layout-fix-20261029/wps-institutions.png)、[统计口径](../../../output/admin-report-layout-fix-20261029/wps-methodology.png)。Microsoft Excel 与手机文件打开未验收，未部署生产。

本地证据与示例（保留在 output，不随 Git 上传）：

- [实际导出的示例表格](../../../output/admin-report-theme-20261029/快康养-绿色主题服务报告.xlsx)
- [同批次内容核对](../../../output/admin-report-theme-20261029/verification.json)
- [最终构建与测试日志](../../../output/admin-report-theme-20261029/isolated-tests/backend-tests.log)、[打包日志](../../../output/admin-report-theme-20261029/package.log)
- [总览](../../../output/admin-report-theme-20261029/after-报告总览.png)、[画像](../../../output/admin-report-theme-20261029/after-需求画像汇总.png)、[机构](../../../output/admin-report-theme-20261029/after-机构服务成果.png)、[口径](../../../output/admin-report-theme-20261029/after-统计口径.png)
