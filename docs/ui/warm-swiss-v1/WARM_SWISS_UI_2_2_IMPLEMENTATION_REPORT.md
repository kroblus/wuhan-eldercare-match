# WARM_SWISS_UI_2_2 — Native TabBar Icon Completion

审计日期：2026-10-07（Asia/Shanghai）。本报告仅记录本阶段实施和证据，不是新视觉基线或 CURRENT architecture 文档。

```text
STATUS = PASS_WITH_RISKS
PHASE = WARM_SWISS_UI_2_2
MAIN_SESSION_ONLY = TRUE
UI_SUBAGENT_DELEGATION = DISABLED
NATIVE_TABBAR = PRESERVED
ICONS_CREATED = 6
HOME_ICON = PASS
CONSULTANT_ICON = PASS
MINE_ICON = PASS
CONFIG_VALIDATION = PASS
ASSET_VALIDATION = PASS
DEVTOOLS = PASS
TAB_SWITCH_API_TEST = PASS
TAB_SWITCH_TEST = PARTIAL
INTERACTION_GATE = PARTIAL
BUSINESS_BEHAVIOR_CHANGED = FALSE
CONTRACT_CHANGES = NONE
ANDROID_17_MANUAL_GATE = PENDING
PRE_EXISTING_CHANGES_PRESERVED = TRUE
DOC_IMPACT = AUDIT_ONLY
READY_FOR_WARM_SWISS_UI_3 = TRUE
```

就绪判断按本任务允许的 `PASS_WITH_RISKS` 分支：配置、资源、实际编译展示与原生 API 切换均已通过；坐标点击工具不支持当前运行时，物理点击仍未验证。此判断不代表全部交互或 Android 17 真机验收通过。本阶段结束，不开始 UI-3。

## 原配置与最小改动

当前 active 配置为 `miniprogram/app.json`，由 `project.config.json` 的 `miniprogramRoot = miniprogram/` 生效。原 `tabBar.list` 三项均只有 `pagePath` / `text`，缺少 `iconPath` / `selectedIconPath`；仓库小程序源码未发现可复用的 PNG / SVG Tab 图标。

三个 Tab 的数量、顺序、标签与 route 原样保留：

| 顺序 | 标签 | pagePath | iconPath | selectedIconPath |
| --- | --- | --- | --- | --- |
| 1 | 首页 | pages/home/index | assets/tabbar/home.png | assets/tabbar/home-active.png |
| 2 | 养老顾问 | pages/consultant/index | assets/tabbar/consultant.png | assets/tabbar/consultant-active.png |
| 3 | 我的 | pages/mine/index | assets/tabbar/mine.png | assets/tabbar/mine-active.png |

`tabBar.custom` 原先未设置，默认原生模式；本次保留此配置，不引入 custom-tab-bar。`window.navigationStyle = custom` 是导航栏设置，未更改。

仅另外对齐两个标签色值：`color` 从 `#6D737B` 改为 `#6B7280`，`selectedColor` 从 `#B86B45` 改为 `#D9572A`。`backgroundColor = #FFFFFF`、`borderStyle = white` 和所有其他 app 配置不变。

## 视觉依据与资源

已读取本目录 README、当前 V1.2 PDF 第 4 页 Tokens、第 5-6 页 BottomTab / route 约束，并实际渲染检查第 15 页首页图。采用 `miniprogram/styles/tokens.less` 的 `@ws-muted = #6B7280` 与 `@ws-accent = #D9572A`；未更改 Tokens 文件或冻结 PDF。

六张图标由 Main session 原创矢量几何生成，没有第三方素材、截图截取或外部图片。使用同一 `viewBox = 0 0 27 27`，导出 81×81 RGBA 透明 PNG。描边均为 1.35 矢量单位（81 px 画布上 4.05 px），圆角连接及圆端点；共同底线 y=22、头部中心 y=8.3，保留透明安全边距。选中状态使用同色填充，顾问气泡继续保持轻量轮廓。各状态保持相同包围盒，图标视觉中心围绕画布中心，形状宽度因气泡略有区别。

源矢量直接由 Sharp 高密度栅格化并降采样至 81 px，未放大低分辨率图片。随后将 RGB 通道精确归一到相应 Token，保留原始抗锯齿 alpha，避免栅格化产生 ±1 的 RGB 舍入差异。工程未新增依赖或大型图标库；PNG 不包含文字、渐变、阴影、背景或医疗符号。

| PNG | 字节 | alpha 非零包围盒（left, top, right, bottom；右/下为排他边界） | 可见像素 RGB |
| --- | ---: | --- | --- |
| home.png | 638 | 11, 11, 70, 68 | #6B7280 |
| home-active.png | 483 | 11, 11, 70, 68 | #D9572A |
| consultant.png | 1310 | 9, 13, 73, 68 | #6B7280 |
| consultant-active.png | 1016 | 9, 13, 73, 68 | #D9572A |
| mine.png | 1091 | 12, 13, 69, 68 | #6B7280 |
| mine-active.png | 761 | 12, 13, 69, 68 | #D9572A |

合计 5299 字节。顾问为人物加右侧小型对话气泡；我的为纯个人头像，二者可区分。

### 原创几何记录

所有坐标均为上述 27×27 viewBox。共同 stroke 为当前 Token 色，`stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"`；未选中 fill=none，选中 fill=accent，气泡始终 fill=none。下面记录源几何以便后续维护，无须将 SVG 放入小程序包或作为 iconPath。

```xml
<!-- Home unselected -->
<path d="M4.5 12L13.5 4.5 22.5 12M6.5 10.5V22H11V15.5H16V22H20.5V10.5"/>
<!-- Home selected: door uses an even-odd transparent cutout -->
<path fill-rule="evenodd" d="M4.5 12L13.5 4.5 22.5 12H20.5V22H6.5V12ZM11 22V15.5H16V22Z"/>
<!-- Consultant, both states -->
<circle cx="10.5" cy="8.3" r="3.3"/>
<path d="M3.8 22C3.8 17.7 6.5 15 10.5 15C14.5 15 17.2 17.7 17.2 22Z"/>
<path fill="none" d="M19 10.8H21.5Q23.5 10.8 23.5 12.8V15.3Q23.5 17.3 21.5 17.3H20L17.5 19V17.3Q16 17.3 16 15.3V12.8Q16 10.8 19 10.8Z"/>
<!-- Mine, both states -->
<circle cx="13.5" cy="8.3" r="3.3"/>
<path d="M5 22C5 17.7 8.5 15 13.5 15C18.5 15 22 17.7 22 22Z"/>
```

## 本地验证

- JSON 解析 PASS。比较本阶段前后 app 配置，剔除六个新增图标字段并还原两个颜色后，完整对象相等。Tab 顺序、route、text、其他配置均未变。
- 六个 iconPath 均为相对 miniprogramRoot 的本地 PNG 路径，文件存在且可完整解码；全部 81×81 / RGBA，alpha 覆盖 0..255，边缘透明、图形未触碰画布边界，全部可见像素 RGB 与对应 Token 精确一致。
- 顾问与我的几何、PNG 内容不同；未选中 / 选中图形位置相同，透明范围相同。
- `git diff --check -- miniprogram/app.json` PASS；最终报告同样进行 diff 格式检查。
- 本次仅更改 JSON 与静态资源，未修改 TS、WXML、Less、业务代码或依赖，未无理由扩大至全业务测试。

## 实际 DevTools 证据

使用已连接的 WeChat DevTools MCP。运行门禁为 skill 0.3.11、`versionRelation = equal`、登录未过期；不修改开发者工具/项目配置。

模拟器：`platform = devtools`，机型 `iPhone 12/13 (Pro)`，逻辑屏幕 390×844，`SDKVersion = 2.32.3`。这不是 iPhone 或 Android 真机证据。

最终资源写入后执行 `simulator_open_page` 编译到首页。该工具 success 只说明触发成功，因此另以实际页面加载、当前 route、四张有效截图中图标呈现，以及定向 console 查询无阻断错误匹配共同验证本次编译与显示通过。没有仅凭 refresh / compile trigger 宣称成功。

| 步骤 | 操作与实际结果 | 证据 |
| --- | --- | --- |
| 1 | 最终编译到 Home，首页选中橙色，另两项灰色 | 01-home-selected.png |
| 2 | `automation_navigate(action=switchTab, url=/pages/consultant/index)` success；currentPage=pages/consultant/index，pageId=186 | 02-consultant-selected.png |
| 3 | `switchTab` 到 /pages/mine/index success；currentPage=pages/mine/index，pageId=188 | 03-mine-selected.png |
| 4 | `switchTab` 回 /pages/home/index success；currentPage=pages/home/index，pageId=185 | 04-tabbar-overview.png |

四张实际截图均为原始 512×1103 PNG，通过 Main session 视觉检查：三个 Tab 图标均可见，没有截断、丢失或错选。另对各图标区域进行像素检查：选中项存在 accent 色像素，未选中项存在 muted 色像素，各区域没有另一状态的实色。抗锯齿/Simulator 缩放产生的边缘混合色不作为新的 Token 色。

`get_simulator_console` 对 `error|fail|warn` 的定向查询无匹配输出；这不等于 console 没有任何日志。顾问页当前显示“顾问资料待配置”，我的页显示匿名/空档案状态，这些现有状态不是本次编译失败，也未注入虚构顾问或用户资料。

### 物理点击缺口

基于 Simulator 截图与 systemInfo 尝试 `automation_element_action(action=tap, x=195, y=799)` 点击底部顾问入口。工具返回：

```text
success = false
error = appservice App.CDPEnable unimplemented
```

随后读取 currentPage 仍为 Home；不能将此次调用视为有效 Tab 点击。没有修改基础库、调试配置、导航系统或页面 Handler 来绕过限制。

因此 `TAB_SWITCH_API_TEST = PASS`，但 `TAB_SWITCH_TEST = PARTIAL / INTERACTION_GATE = PARTIAL`。API 路由成功与物理点击证据严格分开；三个底部入口的物理点击仍需负责人手动确认。

## 截图文件

目录：`output/warm-swiss-ui2-2/`。所有文件均来自实际 WeChat DevTools `simulator_screenshot(optimize=false)`；没有静态设计图冒充运行截图。

- `00-home-before.png`：本阶段修改前原生 Tab 仅显示文字的截图。
- `01-home-selected.png`：最终编译后的 Home 选中状态。
- `02-consultant-selected.png`：原生 API 切换后的 Consultant 选中状态。
- `03-mine-selected.png`：原生 API 切换后的 Mine 选中状态。
- `04-tabbar-overview.png`：返回 Home 后的完整 Simulator 截图，包含三个 Tab；未裁剪或拼接。

## Regression 与工作区保护

本阶段开始时保存 889 个 Git tracked / non-ignored untracked 文件的 SHA-256 快照。结束时逐项比较：既有文件只有 `miniprogram/app.json` 改变；没有删除既有文件，其他所有快照文件原字节保留。新增文件仅为六张 PNG、本阶段报告与五张 Simulator 截图。

- Home：修改前后截图的正文矩形 `(0,60)-(512,995)` RGB 像素差异包围盒为 None，即完全一致；排除了顶部动态时钟和底部 TabBar。
- Consultant / Mine：实际 API 切换可加载、内容和现有匿名/配置状态正常。其页面源码 hash 完全不变，未调整现有布局或状态。
- Profile / Recommendation：源码 hash 完全不变，UI-2.1 原工作区状态保留，未重新打开或修改该范围。
- Assessment：源码 hash 完全不变，UI-1 原工作区状态保留。
- 全部 `miniprogram/pages/**`、`miniprogram/components/**`、`server/**`、`.codex/**`、`.agents/**`、Frozen Contracts、V1.2 PDF 和原报告均未改动。
- 未修改业务事件 Handler、页面生命周期、登录行为、switchTab 实现、全局业务状态、Recommendation / Assessment / ElderProfile / Institution 语义。
- 未运行 reset / restore / checkout / clean / stage / commit / push；Git index 没有暂存本阶段文件。

## FILES_CHANGED

- `miniprogram/app.json`
- `miniprogram/assets/tabbar/home.png`
- `miniprogram/assets/tabbar/home-active.png`
- `miniprogram/assets/tabbar/consultant.png`
- `miniprogram/assets/tabbar/consultant-active.png`
- `miniprogram/assets/tabbar/mine.png`
- `miniprogram/assets/tabbar/mine-active.png`
- `docs/ui/warm-swiss-v1/WARM_SWISS_UI_2_2_IMPLEMENTATION_REPORT.md`
- `output/warm-swiss-ui2-2/00-home-before.png`
- `output/warm-swiss-ui2-2/01-home-selected.png`
- `output/warm-swiss-ui2-2/02-consultant-selected.png`
- `output/warm-swiss-ui2-2/03-mine-selected.png`
- `output/warm-swiss-ui2-2/04-tabbar-overview.png`

## RISKS / 待验收

1. 工具坐标点击失败，三个 native Tab 的实际物理点击仍待人工确认；当前只有完整 API 切换证据，不宣称物理点击全通过。
2. `ANDROID_17_MANUAL_GATE = PENDING`：本阶段没有新增 Android 17 真机证据，需实际检查三组图标、选中颜色、点击与 safe area。
3. 图标显示已由 Main session 检查，负责人最终视觉验收仍待进行；没有新视觉版本、业务 Contract 变化或 UI-3 实施。
