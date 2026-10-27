# B1.2.5 机构地图与 VR 缺失素材清单

2026-10-24。仅盘点当前资料，不补造坐标、照片或核验事实。

## 当前覆盖

`modes/demo/institutions.json` 中 12 条均为 `MOCK_DEVELOPMENT_ONLY`、revision 1。它们的 `publicLocation.address`、`publicLocation.geo` 均为 unknown，`vr.status` 为 unknown。下表名称仅为合成案例的展示名。

| institutionId | 展示名 | 地图 | 机构专属 VR |
| --- | --- | --- | --- |
| demo-inst-chunhe-center | 春和颐养中心 | 缺地址、Geo 及核验证据 | 缺 Viewer、封面、场景及核验证据 |
| demo-inst-chunhe-home | 春和颐养之家 | 同上 | 同上 |
| demo-inst-chunhe-garden | 春和颐养苑 | 同上 | 同上 |
| demo-inst-anning-home | 安宁照护之家 | 同上 | 同上 |
| demo-inst-anning-garden | 安宁颐养苑 | 同上 | 同上 |
| demo-inst-heyue-home | 和悦养老之家 | 同上 | 同上 |
| demo-inst-heyue-center | 和悦颐养中心 | 同上 | 同上 |
| demo-inst-qingxin-garden | 清馨养老苑 | 同上 | 同上 |
| demo-inst-qingxin-home | 清馨颐养之家 | 同上 | 同上 |
| demo-inst-kangyi-center | 晨曦养老中心 | 同上 | 同上 |
| demo-inst-yile-home | 晨曦颐养苑 | 同上 | 同上 |
| demo-inst-yile-garden | 待确认养老之家 | 同上 | 同上 |

虚构机构没有可核实的真实院址。真实机构接入须使用它自己的正式 institutionId、资料 revision 和院区绑定，不得把真实机构素材挂到这些 Demo ID，也不得把 catalogId 当 institutionId。当前 Demo 的正确体验是说明缺失原因、禁止真实导航、VR 显示不可用。现有 VR resolver 还要求 PRODUCTION 数据集及 PRODUCTION_CANDIDATE 来源，补图片不会使 Demo 变成可播放机构实景。

## 地图所需资料

| 类别 | 字段或资源 | 验收依据 |
| --- | --- | --- |
| 身份与版本 | institutionId、recordRevision、来源、发布状态、实际院区对应关系 | 与详情路由及当前核验快照一致；历史 revision 不就地覆盖 |
| 结构化地址 | publicLocation.schemaVersion；address 的 countryCode=CN、province/city/district 各自 code/displayName、addressLine、postalCode（允许 null） | 精确到该院区；行政层级及现有地址 validator 合法 |
| 坐标 | publicLocation.geo 的 latitude、longitude、coordinateSystem=gcj02 | 实际院区坐标，合法范围；不得用城市中心、名称搜索结果或默认点补缺 |
| 核验证据 | address/geo 对应 availability、verification、evidenceIds；证据的来源引用、字段路径、valueSnapshot、verifiedAt/validUntil 等适用字段 | 同机构、同 revision、同字段值，当前有效且证据闭合；unknown/unverified/expired/unavailable 保持区别 |
| 图片（可选展示） | 授权院区外观、入口照片或地图缩略图、拍摄时间及说明 | 当前导航 Gate 不要求图片；图片不能替代地址/Geo 核验，不能截图伪造地图能力 |

## VR 所需资料

| 类别 | 字段或资源 | 验收依据 |
| --- | --- | --- |
| Viewer | vr.status=available、vr.url、vr.verification | 已核验、当前有效的 HTTPS 平台 Viewer URL；页面可访问及小程序业务域名配置另行验证 |
| 封面图片 | vr.coverMediaId 引用本机构 media；真实院区全景封面 | mediaId、category、role、sortOrder、url、caption、capturedAt 及各自 InstitutionField 状态合法，引用存在 |
| 场景 | 非空 vr.scenes：sceneId、sceneCode、name、url、coverMediaId | sceneCode 使用既有 exterior/lobby/room/bathroom/restaurant/rehabilitation/activity/garden；仅提供实际拍摄且已授权的场景，不要求捏造全部八类 |
| 原始素材与托管 | 实际院区授权 360° 采集素材、Viewer 托管资源、对应场景预览图 | 普通平面照片不能直接当全景；当前 Contract 的 URL 是平台 Viewer，不能换成普通 JPEG 冒充播放 |
| 来源与授权 | 院区对应证明、采集/更新时间、素材授权、人物隐私处理、资源有效期 | 证据绑定 institutionId/revision/字段值；封面和场景同属该院区，通用 Demo 素材不能标为机构实景 |

资料齐备后仍须通过既有 validation、地图 readiness、VR resolver 和真实设备访问检查。本轮没有新增事实字段、修改 Frozen Contract 或采集真实个人资料。
