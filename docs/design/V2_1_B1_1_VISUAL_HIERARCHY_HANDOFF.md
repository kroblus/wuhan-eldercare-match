# V2.1-B1.1 视觉层级与可读性交接

日期：2026-10-23。STATUS = COMPLETE（本地实现与验证完成；Owner 视觉及 Android 验收尚未完成）。

- BASE_B1_COMMIT = `2854b8d8a274584c519827fbd21f555fe6b524c8`
- SOURCE_A2_COMMIT = `b476d6b0e3d5d379fcc2860219ce530c3c084f77`
- BRANCH = `codex/v2-1-b1-1-visual-hierarchy`
- WORKTREE = `C:\Users\16562\WeChatProjects\wuhan-eldercare-v2-1-b1-1`
- OWNER_DESIGN_DIRECTION_APPROVED = A2 + N2 + NTC-A；仅设计方向，未变更业务 Contract。
- 本文件与实现一起本地提交；提交 SHA 以该分支 `git log -1` 及最终交接为准。

## 实际变化

首页将两条短导读与紧凑入住指南归入一个资讯区，缩短标题和摘要；仍链接原有内容、沿用原核对日期。查找机构用深青绿实底白字，需求评估用浅青绿及橙色细线。资讯、服务、目录、延伸阅读的重量和间距分开，业务顺序保持 A2。没有新增文章、数据、业务流程或图标库。

复用 `styles/tokens.less` 的 `@color-accent = #A84F25`。资讯类别、分区编号、评估入口顶部 3px 线、已核验的公办/公建民营标签及延伸阅读标题使用橙色；民办标签使用青绿。主品牌及主操作继续使用 `#1F676D`，背景 `#F7F2EA`，主要文字 `#193835`。未知资料和风险使用文字及中性底色，错误仍使用既有错误色。

主要正文、电话状态及风险提示为 16px 基准；卡片标题加重，长名称不省略；分区留白和详情入口对齐统一。首页与独立机构目录通过内置 `page-meta` 应用 `--browse-*` 字号变量，按 `wx.getSystemInfoSync().fontSizeSetting / 16` 放大；标准及较小设置保留 CSS 回退，不普遍缩小字体。读取失败只退回原样式；show 时仅在值变化时 setData，不介入输入事件或业务状态。窄屏服务入口、筛选及卡片底部允许纵向换行。

## 标签证据与功能边界

`directory-presentation.ts` 仅消费既有 `readInstitutionDirectoryInfo(institutionId, recordRevision)` 返回的证据门控性质文字，白名单为公办、民办、公建民营。将同一事实从副标题移到一个标签，区域、地址状态和电话状态保持专属位置。未知、未核验、过期性质保留原文字，不生成正面标签。模板支持 0—3 个标签，本轮正式生产投影实际为 0 或 1 个；不为填满标签新增事实。

示例：柏泉街机构的 `natureLabel = 公办` → 一枚“公办”，副标题仅显示东西湖区；性质待确认 → 0 枚。公开电话仍写“有公开电话记录 · 未实拨”，没有另造电话标签。名单联系人手机号不能冒充官方固定电话的机构提醒保留。费用未知继续“费用待咨询”。不从名称中的“医养融合”“康复”推断护理能力，也不展示低价、距离近、性价比、认知症接收等 T2/T3 特征。

默认仍预览普通目录前 2 家；展开完整目录或主动名称/区域/性质 AND 查询显示全部匹配，搜索与结果紧邻。Provider、排序、加载世代保护、NavigationGuard、canonical identity、recordRevision 和 sourceContextRef 没有改动。List 不展示完整地址或电话。详情拨号、地图、CareProcess、评估六步和推荐安全规则沿用 B1；N1 TabBar 不变，公告仍为原生真实空状态，无假角标。

## 原生截图与视觉证据

以下均由本轮独立工作区的真实微信 DevTools 模拟器截取，未使用 HTML/Chromium 替代。B1 对照图来自该基线 fresh build；截图像素尺寸随模拟器显示比例变化，宽度以运行时 `windowWidth` 为准。

| 场景（430px、标准字号） | B1 | B1.1 |
| --- | --- | --- |
| 首页及橙色资讯/服务点缀 | [之前](v2-1-b1-1-evidence/before-home-430.png) | [之后](v2-1-b1-1-evidence/after-home-430.png) |
| 机构性质去重与卡片 | [之前](v2-1-b1-1-evidence/before-cards-430.png) | [之后](v2-1-b1-1-evidence/after-cards-430.png) |

首页首屏矩阵：每组通过 DevTools 机型/字号菜单实际切换，读取真实 `windowWidth` 与 `fontSizeSetting`；125%/150% 的新闻标题 computed font-size 分别验证为 20px/24px。不是 mock 系统字号。

| 宽度 | 标准 16 | 125% 20 | 150% 24 |
| --- | --- | --- | --- |
| 320 | [截图](v2-1-b1-1-evidence/after-home-320.png) | [截图](v2-1-b1-1-evidence/after-home-320-font125.png) | [截图](v2-1-b1-1-evidence/after-home-320-font150.png) |
| 375 | [截图](v2-1-b1-1-evidence/after-home-375.png) | [截图](v2-1-b1-1-evidence/after-home-375-font125.png) | [截图](v2-1-b1-1-evidence/after-home-375-font150.png) |
| 390 | [截图](v2-1-b1-1-evidence/after-home-390.png) | [截图](v2-1-b1-1-evidence/after-home-390-font125.png) | [截图](v2-1-b1-1-evidence/after-home-390-font150.png) |
| 430 | [截图](v2-1-b1-1-evidence/after-home-430.png) | [截图](v2-1-b1-1-evidence/after-home-430-font125.png) | [截图](v2-1-b1-1-evidence/after-home-430-font150.png) |

窄屏大字需要自然纵向滚动；本轮检查了 320px/150% 的[双服务](v2-1-b1-1-evidence/after-services-320-font150.png)、[完整长名称及单标签](v2-1-b1-1-evidence/after-cards-320-font150.png)、[电话状态和详情入口换行](v2-1-b1-1-evidence/after-card-footer-320-font150.png)、[页面底部](v2-1-b1-1-evidence/after-bottom-320-font150.png)，未发现横向溢出、名称省略或末项被 TabBar 永久覆盖。没有声称每种宽度与每种业务状态的全部组合均做了原生测试。

- [真实公开目录的特定风险](v2-1-b1-1-evidence/after-cards-390.png)、[真实搜索无结果](v2-1-b1-1-evidence/after-empty-390.png)、[公告空状态](v2-1-b1-1-evidence/after-announcement-empty.png)。
- [0 标签](v2-1-b1-1-evidence/demo-zero-tags.png)：现有演示资料投影，未知性质保持文字，无空标签容器。
- [3 标签及延伸阅读橙色标题](v2-1-b1-1-evidence/test-only-three-tags.png)：仅在隔离 demo 运行时临时 setData 的 TEST_ONLY 视觉夹具，不代表生产支持三个特征，不写入 Provider 或资料文件。
- [加载错误](v2-1-b1-1-evidence/test-only-load-error.png)：隔离 demo 页面状态夹具，仅证明错误布局；实际异步失败/重试和竞态由下述运行测试覆盖。夹具使用后重新加载并刷新 demo，恢复原 12 家数据及 0 标签投影。

## 验证结果

| 检查 | 证据 / 结果 |
| --- | --- |
| B1.1 展示、证据过期、去重、风险、隔离、字号、生成样式 | `check:v2-1-b1-1-visual`，86 assertions PASS |
| B1 双模式原位搜索及交互 | `check:v2-1-b1-ui`，122 assertions PASS |
| 首页旧行为、连续导航 | `check:v1-7-homepage` 双模式 PASS；`check:navigation-home-dedup-p0` 10/10 PASS |
| Institution 页面与拨号/地图路由状态 | `check:institution-list-page-runtime` 22 PASS；`check:institution-detail-page-runtime` 32 PASS；`check:institution-detail-v1-2-1-interactions` 16 PASS（模拟 wx API，未实拨电话） |
| 冻结评估与推荐 | `check:assessment-v2-runtime` 44 PASS；`check:recommendation-v2-runtime` 68/68 fixed fixtures、6/6 formal-preview parity 及确定性/不可变断言 PASS |
| 模式隔离 | `check:run-mode-convergence` PASS；production 排除 demo；演示不转发真实网络、Storage、电话等 API |
| 微信兼容 | 原生 WXML 编译、Less、TypeScript 4.1.2 双构建 PASS；`check:wechat-ts-targeted-compat` PASS；生成 JS 检查 production 211 / demo 206 模块 PASS，无可选链、空值合并或不支持的 class fields |
| DevTools | 2.02.2609232 Nightly，基础库 2.32.3；原生页面运行、12 组首页截图、搜索输入/清除、详情进入返回、公告打开关闭 PASS；中文字符串由自动化输入，不等于真机中文输入法验证 |

日志随截图目录保存为 `*.log.txt`。字号切换/重新编译期间曾出现 automator 连接超时及 `routeDone ... not the current page`；等待重连后重新取证，未将超时计为通过。最后 320px/150% fresh compile 的 console 缓冲未见 error，列表仍正常载入 2/11 家。Android/iOS 实机、系统微信字号映射、中文拼音组合与软键盘焦点、实际拨号/地图平台操作均为 **NOT_RUN**。

从生成 WXSS 提取颜色计算：橙字/浅橙底 4.79:1，青绿字/浅青底 5.57:1，白字/深青绿主入口 6.52:1，次要字/浅青绿 5.44:1，风险字/暖白 5.72:1；检查的六组组合均满足普通文字 4.5:1。标签与风险同时依靠文字和布局区别。

| 本地运行目录字节 | B1 fresh build | B1.1 | 增量 |
| --- | ---: | ---: | ---: |
| production | 1,356,864 | 1,359,711 | +2,847 |
| demo | 2,027,162 | 2,030,009 | +2,847 |

`build:production`、`build:demo` 及 `check:run-mode-package-size` 均 PASS。既有本地预算仍为 2,031,616 bytes（1984 KiB），demo 剩余 1,607 bytes，未提高门禁。截图/测试日志位于 docs，不进入 miniprogram 运行目录。**WECHAT_MAIN_PACKAGE_SIZE = NOT_RUN**：以上不是 dist 全部文件合计，也不冒充微信最终主包体积；未上传或预览打包。

## 专项委派与交付边界

AGENT_DELEGATION_REPORT：

- `/root/b11_frontend`（wechat_frontend）：首页 WXML/Less、共享卡片、性质分配投影、字体 helper 与原生 page-meta 接入、针对性测试；完成。主线程在明确 ownership 后安排字体修复，无并发写入同一文件。
- `/root/b11_diff_qa`（qa_reviewer）：只读 diff-driven 复核证据、去重、导航/查询、冻结范围、数据隔离和可读性；未发现阻断项。提出目录标题固定字号问题，主线程修复并重建后，QA 最终复核通过。QA 最终小修复复核未重新运行测试；前述测试由主线程执行。
- 主线程：边界与集成、双构建、兼容/回归、实际 DevTools 截图和状态恢复、文档及本地提交。未委派 backend_domain / matching_engine，因为本轮没有对应领域实现改动。

DOC_IMPACT = CURRENT_DOC_UPDATE_REQUIRED（README 与 FRONTEND_STRUCTURE 仅更新当前展示结构）。`check:doc-governance` 为 BASELINE_FAIL：B1 与本轮均为相同 21 项问题，差集为 0，主要是未纳入 Git 的 AGENTS.md、server/README.md 引用以及既有未登记文档。本轮不修复历史治理项。N2_MIGRATION = NOT_STARTED。Assessment / Recommendation / Institution Frozen Contract、生产资料、演示资料、app.json、API、真实公告及预约逻辑均未修改；无远端发布动作。B1 历史工作区仍干净；原工程原有 63 项状态记录保留，未清理其他工作区。

Owner 重点检查 5 项：

1. Android 微信里首页标准/放大字号，能否快速区分资讯、深青绿查找入口与次级需求评估。
2. 中文拼音输入、删除/清除、区域/性质 AND 筛选、展开/收起与快速连点，软键盘是否稳定。
3. 长机构名、0/1 标签、特定风险和电话状态是否完整可读；不将名称或性质当作护理能力。
4. 进入详情后返回，条件与版本上下文保留；合法拨号及可用地图的系统操作。
5. 公告打开关闭、三类阅读页和 N1 TabBar，320px/大字号下最后内容和操作不被遮挡。

RISKS = 演示预算余量较小；实机字体/输入法/平台 API 仍待验收。BLOCKERS = 无本地实现阻断；Owner 实机验收门禁未完成。B2 尚不满足启动条件：需要 Owner 完成本轮视觉及 Android 验收并明确授权 B2；再单独核对 institution Tab 注册、顾问 switchTab 迁移及推荐来源上下文导航回归，不在本轮启动。

NEXT = OWNER_VISUAL_AND_ANDROID_REVIEW

## 文件清单

业务运行源码：

- `miniprogram/pages/home/index.wxml`、`index.less`、`index.ts`
- `miniprogram/pages/institution/index.wxml`、`index.ts`、`directory-presentation.ts`、`list-view-model.ts`
- `miniprogram/styles/institution-directory.less`
- `miniprogram/templates/institution-directory.wxml`
- `miniprogram/utils/browse-font.ts`（新增）

测试及文档：`package.json`、`scripts/check-v2-1-b1-ui.mjs`、`scripts/check-v2-1-b1-1-visual.mjs`（新增）、`README.md`、`docs/architecture/FRONTEND_STRUCTURE.md`、本交接；`docs/design/v2-1-b1-1-evidence/` 保存上文列出的 25 张 PNG 与 13 份原始测试日志文本。
