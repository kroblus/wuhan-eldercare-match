# 正式只读机构目录

当前条目：武汉市社会福利院；`institutionId = wh-social-welfare-institute`，`recordRevision = 1`。
这是机构公开资料接入，不代表平台合作、空床、可预约或已核验护理能力。

核对日期：2026-10-22。核对方法：只读核对政府公开网页，未拨打电话、未现场核验。

| 字段 | 资料 | 来源及状态 |
| --- | --- | --- |
| 名称 | 武汉市社会福利院 | 武汉市民政局下属机构页面，文献核对 verified |
| 区域 | 武汉市江汉区 | 市民政局检查对象名录交叉核对；行政区划表校验层级 |
| 公开地址 | 武汉市江汉区发展大道198号 | 民政局机构页面与检查对象名录一致，文献核对 verified |
| 机构固定电话 | 027-85872325 | 机构页面列明的电话；purpose=main，文献核对 verified，未核验接通状态 |
| 价格、床位、护理与医疗能力、资质、接收状态 | unknown | 不从机构简介、机构名称或一般服务描述推断 |
| 地图坐标、普通媒体、VR | unknown / 空集合 | 未取得可信坐标或对应授权素材，入口保持关闭 |

来源：

- [武汉市民政局：武汉市社会福利院](https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/jgjj/jgsz/xsjg/201912/t20191220_255274.shtml)，页面标注 2024-01-02 发布；仅摘取名称、地址、机构固定电话，不摘取页脚民政局电话。
- [武汉市民政局：养老机构检查对象名录](https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/qtzdgknr/ssj/202401/t20240104_2335959.shtml)，2024-01-04；只核对第一条机构的身份、区域与地址，不保存联系人或法定代表人。
- [武汉市自然资源和城乡建设局：云上武汉展示中心](https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/)，武汉行政区划栏目；用于湖北省／武汉市／江汉区的层级和代码核对。

`catalog.ts` 为每个 provided 字段生成独立 evidence，保留 sourceReference、sourceNote、observedAt、verifiedAt。
字段 `asOf` 为本次公开页面观测日期；不表示来源页面刚发布，也不表示已电话确认。
`validUntil = 2027-01-20T23:59:59Z` 是平台内部 90 天复核期限，不是政府承诺，也不是服务开放期限。
过期后由既有投影处理 expired。追加资料须新增记录 revision 和相应 evidence，不覆盖历史快照。

`unknown-record.ts` 只按现有类型及规则枚举建立空结构，不读取或克隆 Mock、演示或测试记录。
`administrative-divisions.ts` 目前仅接受已核对的湖北省／武汉市／江汉区层级；其他地址在扩充并核对前拒绝。
`canRequestInstitutionService` 当前返回 false：公开目录不能自动赋予预约能力，详情与直接预约链接都执行此策略。

正式构建才包含本目录；演示构建只包含 `modes/demo/`。目录和公开电话均不参与推荐 V2 排序。
