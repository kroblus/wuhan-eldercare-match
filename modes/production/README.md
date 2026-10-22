# 正式只读机构目录（V1.8）

当前11家真实机构，覆盖江岸、江汉、硚口、汉阳、武昌、青山、洪山、东西湖8个区；7家有公开固定电话。
核对日期2026-10-22；只读核对政府公开资料，未拨打电话、未实地核验。公开资料收录不代表当前运营、空床、合作或平台预约。

## 扩充路径

- `directory-data.ts`：新增机构的稳定institutionId、recordRevision、名称、区代码、院址、可选固定电话和明确性质，每个字段引用来源键。
- `sources.ts`：来源URL、发布主体、标题、原始发布日期（无法确定则null）、实际核对日期、可访问状态及内部复核期限。
- `record-builder.ts`：由空模型生成正式V1.2.1记录，逐字段生成evidence和valueSnapshot；缺失、冲突或无法访问的必需来源不提升为已核验字段。新条目核心身份或地址不可核对时从当前目录跳过，保留其他有效机构，不让一条失效来源拖垮整个目录。
- `administrative-divisions.ts`：仅接受本轮核对的8个市辖区及正确省／市／区组合；不把东湖开发区等功能区强行映射为某个区。
- `first-record.ts`：完整保留V1.7武汉市社会福利院revision 1，事实和证据对象未改变。新资料必须追加revision并明确currentPointer，不能覆盖历史快照。
- `directory-metadata.ts`：公办／公建民营／民办是只读目录性质，不是护理类型。性质证据单独绑定institutionId＋recordRevision，沿用逐字段证据结构，不扩展Frozen Institution或参与Recommendation V2。
- `source-notes.ts`：仅为当前显示的精确机构版本提供来源和日期，不能用当前来源替换历史版本。

新增一家机构只需补充来源与数据行；新行政区需先核对后扩充行政区划表。不复制机构大对象，不修改搜索、卡片、详情或推荐引擎。
每次变更运行 `check:production-directory-data`、双构建、`check:real-institution-provider`、`check:run-mode-convergence`、`check:v1-7-homepage`。

## 本轮新增

以下均为revision 1；日期为2026-10-22公开页面核对。各字段来源精确到数据行，不能将同一来源套用于所有字段。

| institutionId | 机构名称 | 区域／院址 | 主要来源键 | 电话／性质说明 |
| --- | --- | --- | --- | --- |
| wh-jiangan-social-welfare | 武汉市江岸区社会福利院 | 江岸区兴盛路203号 | jiangan2026、registry2024 | 未采用联系人手机；性质未知 |
| wh-qiaokou-social-welfare | 武汉市硚口区社会福利院 | 硚口区工农路6号 | qiaokouProfile、metropolitan2026 | 公开电话不同，保持未知；性质未知 |
| wh-hanyang-social-welfare | 武汉市汉阳区社会福利院 | 汉阳区鲤鱼洲路28号 | hanyang2025、hanyangProfile、metropolitan2026 | 公办；固定电话按两份名录核对 |
| wh-taibao-hanyang | 太保家园（武汉）养老服务有限公司 | 汉阳区四新中路8号 | metropolitan2026、hanyang2025 | 民办；同址同固定电话对应旧称国际颐养社区 |
| wh-zhaoshang-guanyi-hanyang | 武汉市汉阳区招商观颐之家颐养院 | 汉阳区江城大道288号蔚湖轩22栋 | metropolitan2026、hanyang2025 | 民办；与区级备案简称合并为单条 |
| wh-wuchang-social-welfare | 武昌区社会福利院 | 武昌区粮道街109号 | metropolitan2026 | 采用名录固定电话；性质未知 |
| wh-qingshan-social-welfare | 武汉市青山区社会福利院 | 青山区白玉山康寿路1号 | metropolitan2026 | 未采用联系人手机；性质未知 |
| wh-hongshan-social-welfare | 武汉市洪山区社会福利院 | 洪山区张家湾街烽胜路47号 | hongshanProfile、hongshan2024、metropolitan2026 | 公办；固定电话源自2024通告，未确认接通 |
| wh-dongxihu-baiquan-eldercare | 东西湖区柏泉街卫生院医养融合康复服务中心 | 东西湖区柏泉街商业街8号 | metropolitan2026、dongxihu2025 | 公办；采用2026名录固定电话 |
| wh-dongxihu-jiangjunlu-eldercare | 东西湖区将军路街卫生院医养融合康复服务中心 | 东西湖区将军一路108号 | metropolitan2026、dongxihu2025 | 公办；未采用联系人手机 |

所有条目的价格、可用床位、护理／医疗能力、接收条件、地图坐标、图片与VR均保持unknown或空集合。名字含“医养／康复／福利院”不产生能力或性质推断。历史床位总数未导入。

## 来源与核验范围

- [2026武汉都市圈养老机构清单](https://www.hbqj.gov.cn/xxgk/zc/qtwj/gsgg/202606/t20260615_5958211.html)：潜江市民政局政府门户公开，2026-06-15；仅摘取所选武汉机构的名称、院址、明确固定电话，不保存联系人及手机号。
- [江岸区养老机构名单](https://www.jiangan.gov.cn/jaxxw/zfxxgk/fdzdgk/shgysy_41394/shjzhshfl/ylfw/yljgcx/202110/t20211026_1819861.shtml)：页面标注2026-07-30；核对江岸区社会福利院名称、区域和院址。
- [2025年汉阳区备案养老机构信息](https://www.hanyang.gov.cn/zwgk_38/xxgkml/gysyjs/shbz/ylfw/202511/P020251117443595692803.pdf)：附件只标明年度，发布日期保留null；核对前三条的地址、明确性质及固定电话。未导入床位与联系人。
- [2025年东西湖区养老机构备案信息表](https://www.dxh.gov.cn/ZWGK/QZFXXGKML/GGFWXX_devsavepath/SHBZ_devsavepath/ylfw/202511/t20251112_2676023.shtml)：2025-11-12；仅核对柏泉和将军路两个条目的身份、院址与公办性质。
- [洪山区通告](https://www.hongshan.gov.cn/zfbm/mzj/fdzdgknr/tzgg/202404/t20240425_2393546.shtml)：2024-04-25；仅用名称、院址和固定电话，不导入通告中针对特定政策对象的接收／资质结论。
- [洪山区公共设施页](https://www.hongshan.gov.cn/gzfw/ggsscx/yly/202112/t20211222_1878762.shtml)：发布日期未标注；核对名称与明确“公办养老院”表述，其他描述不转成能力。
- [硚口区社会福利院简介](https://www.qiaokou.gov.cn/bsfw/bmfw/yljg/201808/t20180807_112656.shtml)：发布2022-05-11、更新2022-12-30；仅核对名称和工农路6号，电话与2026名录不同，未启用拨号。
- [汉阳区二级单位资料](https://www.hanyang.gov.cn/bmxxgk/zfgzjg/qmzj/fdzdgknr/jgjj05/jgzn/202106/t20210630_1729868.shtml)：发布日期未确认；核对全称与鲤鱼洲路28号。
- [武汉行政区划](https://zrzyhcxjs.wuhan.gov.cn/yswhzszx/)：仅取本轮所需8区的名称、代码与层级，未使用其中的功能区划分去替代市辖区。
- 原条目的[市民政局机构页](https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/jgjj/jgsz/xsjg/201912/t20191220_255274.shtml)（页面标注2024-01-02）及[2024检查名录](https://mzj.wuhan.gov.cn/zwgk_918/fdzdgk/qtzdgknr/ssj/202401/t20240104_2335959.shtml)保持原revision 1证据。

跳过了地址存在差异的荷包湖老年公寓，以及2025／2026名称、主体对应尚不明确的走马岭条目；未将同址直接视为同一机构。

`asOf/observedAt/verifiedAt`为实际核对日期，不是文档发布日期；`validUntil = 2027-01-20T23:59:59Z`为内部90天复核期限，不是政府承诺或服务开放期限。到期由既有投影标为expired，电话隐藏、拨号关闭、区域／性质不再作为当前可核验条件。来源失效或冲突时保留既有历史依据，追加新revision处理，不能刷新旧核验日期伪装新资料。

`canRequestInstitutionService`始终false；详情与直接预约链接均不因公开电话而开放预约。正式包仅含正式提供者；演示包仍仅含12家合成机构。

## 自动化范围

最小GitHub Actions仅运行便携的源码数据、评估、推荐与交互检查，固定使用TypeScript 4.1.2；这些命令已在本地以npm安装的相同版本运行通过。本轮未push，未运行远端Actions。完整Production／Demo的TypeScript、Less、原生WXML构建仍依赖本机微信开发者工具，不宣称普通runner完成微信构建。
