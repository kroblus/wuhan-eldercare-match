# 开发者工具逐页文字排版检查（2026-10-24）

本轮由 Owner 明确要求重新使用电脑操控。使用 Windows Computer Use 实际查看微信开发者工具；CLI 用于页面打开、模拟器截图和只读状态检查。覆盖全部 30 个注册路由的可进入状态，不等同于覆盖所有业务条件分支。保留 B1.2.4 此前未提交成果，无提交或推送。

## 修复和原生复查

| 问题 | 局部修复 | 本轮截图 |
| --- | --- | --- |
| 预算页返回按钮“返回入住偏好”末字落单 | 调整该页 wideNext 双按钮 flex 比例为 0.85 / 1.15 | [430px](assessment-budget-after-430.png)、[320px](assessment-budget-after-320.png)；[修改前](assessment-budget-before.png) |
| 需求画像“一次性费用接受度”末字落单 | 标签列 176rpx → 208rpx；保留 ≤360px 的纵向排列 | [430px](assessment-profile-after-430.png)；[修改前](assessment-profile-middle.png) |
| 全景演示提示和角度读数合并，75° 落单 | 提示与读数分为两个 block text，保留绑定和操作 | [430px](showcase-vr-after-430.png)；[修改前](showcase-vr.png) |

本轮 UI 源码仅修改 assessment-footer.less、assessment/profile.less、showcase/vr-real.wxml。没有修改业务事件、Contract、机构数据、导航或冻结颜色。普通中文段落自然换行不作为错误强制压缩。

## 逐页覆盖

常规检查主要使用 Demo 430px、字体设置 16，长页滚动查看；正式模式 320px 补查服务安全状态和真实机构目录。以下“查看”只描述实际可见状态，未声称执行对应业务操作。

| 路由（pages/） | 实际查看状态 |
| --- | --- |
| home/index | 顶部、阅读入口、双服务、搜索筛选、卡片、目录入口和底部说明；另查 24 号字体首页 |
| assessment/intro | 说明及开始入口 |
| assessment/basic | 表单顶部、底部和固定操作区 |
| assessment/health | 表单顶部、底部和固定操作区 |
| assessment/adl | 表单顶部、底部和固定操作区 |
| assessment/cognitive | 表单顶部、底部和固定操作区 |
| assessment/preference | 表单顶部、底部和固定操作区 |
| assessment/budget | 表单及双按钮，修复后 430px / 320px |
| assessment/profile | 从本地 Demo 案例正常进入；身份、照护、偏好和预算分组 |
| recommendation/result | Demo 现有评估推荐结果、机构卡片和来源详情导航 |
| institution/index | Demo 空状态；正式 320px 公开目录、长名称和完整风险说明 |
| institution/detail | 从推荐卡片进入，身份、地址电话、照护、费用及来源展开区域 |
| institution/vr | 不可用/无有效上下文状态；可播放状态 NOT_RUN |
| consultant/index | 当前顾问服务不可用状态和说明 |
| consultant/consultation | 当前咨询服务状态和说明 |
| service/ai-chat/index | 默认问答、快捷问题、输入与发送区域；补查正式 320px，未发送真实问题 |
| appointment/create | Demo 隔离工具；正式 320px 当前机构服务不可用状态，真实提交 NOT_RUN |
| appointment/success | 缺少有效 handoff 的安全状态；真实成功状态 NOT_RUN |
| mine/index | 全页、演示设置未载入及载入后状态 |
| elder/index | 当前档案不可用/入口骨架状态 |
| elder/detail | 当前详情骨架状态 |
| assessment/history | 当前历史记录不可用状态；真实记录列表 NOT_RUN |
| appointment/index | Demo 工具；正式 320px 当前预约记录不可用状态 |
| visit/evaluation | Demo 工具；正式 320px 无有效 visit 上下文状态，真实评价表单 NOT_RUN |
| showcase/index | 开发演示入口 |
| showcase/vr-real | Canvas 和控制区、未选择本地照片状态；未读取私人照片 |
| showcase/map-real | 实际原生地图与控制区，不请求用户定位 |
| service/policy/index | 标题、导读、来源日期、正文及底部 |
| service/education/index | 顶部、中段及底部 |
| service/admission/index | 分步指南及来源区域 |

未发现上述可见状态中其他需修改的文字重叠、裁剪或异常错行。Home 的模拟器字体设置从 16 改到 24 后会重新编译回首页；[截图](home-font24-430.png)仅证明该设置下的首页，不证明所有页面均完成 150% 检查。随后已恢复 16。截图文件像素宽度受 DevTools 缩放与屏幕比例影响，不能当作 CSS 视口宽度。

## 验证

- production / demo 构建均 PASS：TS 4.1.2、Less、原生 WXML、生成 JS 和 30 路由。
- runtime 文件字节：production **1,361,280**，demo **2,031,578**；既有预算 2,031,616，Demo 余量 **38**。相对此前图标修订后构建各 +32 字节。不是签名上传后的主包大小。
- assessment-interactions：47 runtime + 2 structural PASS；assessment-v2-runtime：44 PASS；profile-v2-ui-runtime：12 PASS。
- B1.2.4：112 PASS；首页回归：130 PASS；run-mode-convergence：PASS（含 production/demo 隔离）。
- showcase-native-vr-map：21 PASS，含离线原生 WXML 编译。首次调用缺少输出参数，仅为测试调用错误；使用独立 pre-test baseline 和新输出目录重跑成功：`output/page-layout-review-2026-10-24/offline-showcase-1/`。
- git diff --check：PASS（现有文件 EOL 提示保留）；HEAD 仍为 c109208c37947848332ad93b1c4b056eabf0cefc。
- AGENT_DELEGATION_REPORT：主会话实施视觉和 Computer Use；page_review_routes 只读梳理路由/门禁；b124_diff_qa 只读检查本轮三文件 diff，未发现静态问题，不将其检查算作真机证明。

STATUS = READY_FOR_OWNER_VISUAL_REVIEW。Android 真机 NOT_RUN；全业务条件状态与所有页面大字号组合 NOT_RUN。没有真实拨号、预约提交、评价提交、上传、发布、提交或推送。
