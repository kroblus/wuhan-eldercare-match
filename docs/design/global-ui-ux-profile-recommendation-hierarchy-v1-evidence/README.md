# 原生视觉证据索引

`final-*` 为最终重点截图。`demo-*`、`after-*` 与 `review-*` 为过程检查；最终审核以 `final-*` 和前后对照为准。所有原图来自微信开发者工具 WXML/WXSS，拼图仅缩放并排列原图。

修改前为 `before-profile-430.png`、`before-recommendation-430.png`。前后对照为 `profile-before-after.png`、`recommendation-before-after.png`。

## 最终截图与几何

实际 viewport/font、元素 offset/size、滚动位置、路由与展开状态见 [final-native-evidence.json](final-native-evidence.json)。150% 是 16→24px 字体投影，Android 真机 NOT_RUN。普通 view 的 scrollWidth API 失败原样保留，未伪称通过。

咨询准备清单最终换行后，四种尺寸末尾均已补拍，保留原截图名并重新生成拼图。

| 视口 | 页面 | 最终原图 |
| --- | --- | --- |
| 320 / 150% | profile | [0](final-320-font150-profile-0.png) · [1](final-320-font150-profile-1.png) · [2](final-320-font150-profile-2.png) · [3](final-320-font150-profile-3.png) · [4](final-320-font150-profile-4.png) · [5](final-320-font150-profile-5.png) |
| 320 / 150% | recommendation | [0](final-320-font150-recommendation-0.png) · [1](final-320-font150-recommendation-1.png) · [2](final-320-font150-recommendation-2.png) · [3](final-320-font150-recommendation-3.png) · [4](final-320-font150-recommendation-4.png) · [5](final-320-font150-recommendation-5.png) · [6](final-320-font150-recommendation-6.png) |
| 320 / 16px | profile | [0](final-320-profile-0.png) · [1](final-320-profile-1.png) · [2](final-320-profile-2.png) · [3](final-320-profile-3.png) |
| 320 / 16px | recommendation | [0](final-320-recommendation-0.png) · [1](final-320-recommendation-1.png) · [2](final-320-recommendation-2.png) · [3](final-320-recommendation-3.png) · [4](final-320-recommendation-4.png) |
| 375 / 16px | profile | [0](final-375-profile-0.png) · [1](final-375-profile-1.png) · [2](final-375-profile-2.png) · [3](final-375-profile-3.png) |
| 375 / 16px | recommendation | [0](final-375-recommendation-0.png) · [1](final-375-recommendation-1.png) · [2](final-375-recommendation-2.png) · [3](final-375-recommendation-3.png) · [4](final-375-recommendation-4.png) |
| 430 / 16px | profile | [0](final-430-profile-0.png) · [1](final-430-profile-1.png) · [2](final-430-profile-2.png) · [3](final-430-profile-3.png) |
| 430 / 16px | recommendation | [0](final-430-recommendation-0.png) · [1](final-430-recommendation-1.png) · [2](final-430-recommendation-2.png) · [3](final-430-recommendation-3.png) · [4](final-430-recommendation-4.png) |


## 自动化与保护检查

- [最终检查日志](final-checks.json)
- [完整展示数据比较](data-comparison.json)
- [源文件保护](source-preservation.json)
- [任务前源文件基线](baseline.json)
- [修改前展示模型摘要](display-baseline.json)

修改前后比较保护字段值、顺序、身份、原因及历史快照。独立 VM 初始化生成的新 localDraftId 不作相同假设；保存状态比较在同一会话内完成。

交互使用可见界面点击或元素 tap；未直接调用页面事件处理函数。固定 CTA/调整需求为可见界面点击，修改、展开、详情为自动化元素 tap。返回为平台导航。
