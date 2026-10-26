# Batch B 原生截图索引

全部来自实际 DevTools WXML/WXSS 渲染。真实逻辑宽度和 fontSizeSetting 见 native-geometry-summary.json；不是将 430px 内容缩窄模拟。Android 真机与真实软键盘未运行。

滚动截图的顶部可能位于内容中段，这是当前滚动位置，不表示内容被固定裁切。前后设备高度不同，原始 PNG 未裁切或拉伸。

## 修改前后对比

- [基本情况：标准字号](comparison-basic-normal.png)
- [基本情况：150%](comparison-basic-font150.png)
- [评价按钮：150%](comparison-appointment-font150.png)

## 修复后四种视口

| 页面 | 320px / 标准 | 375px / 标准 | 430px / 标准 | 320px / 150% |
| --- | --- | --- | --- | --- |
| 基本情况 | [顶部](after-320-normal-basic-top.png) / [中段](after-320-normal-basic-middle.png) / [末尾](after-320-normal-basic-end.png) | [顶部](after-375-normal-basic-top.png) / [中段](after-375-normal-basic-middle.png) / [末尾](after-375-normal-basic-end.png) | [顶部](after-430-normal-basic-top.png) / [中段](after-430-normal-basic-middle.png) / [末尾](after-430-normal-basic-end.png) | [顶部](after-320-font150-basic-top.png) / [中段](after-320-font150-basic-middle.png) / [末尾](after-320-font150-basic-end.png) |
| 健康情况 | [顶部](after-320-normal-health-top.png) / [中段](after-320-normal-health-middle.png) / [末尾](after-320-normal-health-end.png) | [顶部](after-375-normal-health-top.png) / [中段](after-375-normal-health-middle.png) / [末尾](after-375-normal-health-end.png) | [顶部](after-430-normal-health-top.png) / [中段](after-430-normal-health-middle.png) / [末尾](after-430-normal-health-end.png) | [顶部](after-320-font150-health-top.png) / [中段](after-320-font150-health-middle.png) / [末尾](after-320-font150-health-end.png) |
| 日常生活能力 | [顶部](after-320-normal-adl-top.png) / [中段](after-320-normal-adl-middle.png) / [末尾](after-320-normal-adl-end.png) | [顶部](after-375-normal-adl-top.png) / [中段](after-375-normal-adl-middle.png) / [末尾](after-375-normal-adl-end.png) | [顶部](after-430-normal-adl-top.png) / [中段](after-430-normal-adl-middle.png) / [末尾](after-430-normal-adl-end.png) | [顶部](after-320-font150-adl-top.png) / [中段](after-320-font150-adl-middle.png) / [末尾](after-320-font150-adl-end.png) |
| 认知与特殊护理 | [顶部](after-320-normal-cognitive-top.png) / [中段](after-320-normal-cognitive-middle.png) / [末尾](after-320-normal-cognitive-end.png) | [顶部](after-375-normal-cognitive-top.png) / [中段](after-375-normal-cognitive-middle.png) / [末尾](after-375-normal-cognitive-end.png) | [顶部](after-430-normal-cognitive-top.png) / [中段](after-430-normal-cognitive-middle.png) / [末尾](after-430-normal-cognitive-end.png) | [顶部](after-320-font150-cognitive-top.png) / [中段](after-320-font150-cognitive-middle.png) / [末尾](after-320-font150-cognitive-end.png) |
| 养老需求与偏好 | [顶部](after-320-normal-preference-top.png) / [中段](after-320-normal-preference-middle.png) / [末尾](after-320-normal-preference-end.png) | [顶部](after-375-normal-preference-top.png) / [中段](after-375-normal-preference-middle.png) / [末尾](after-375-normal-preference-end.png) | [顶部](after-430-normal-preference-top.png) / [中段](after-430-normal-preference-middle.png) / [末尾](after-430-normal-preference-end.png) | [顶部](after-320-font150-preference-top.png) / [中段](after-320-font150-preference-middle.png) / [末尾](after-320-font150-preference-end.png) |
| 预算与入住计划 | [顶部](after-320-normal-budget-top.png) / [中段](after-320-normal-budget-middle.png) / [末尾](after-320-normal-budget-end.png) | [顶部](after-375-normal-budget-top.png) / [中段](after-375-normal-budget-middle.png) / [末尾](after-375-normal-budget-end.png) | [顶部](after-430-normal-budget-top.png) / [中段](after-430-normal-budget-middle.png) / [末尾](after-430-normal-budget-end.png) | [顶部](after-320-font150-budget-top.png) / [中段](after-320-font150-budget-middle.png) / [末尾](after-320-font150-budget-end.png) |
| 老人需求画像 | [顶部](after-320-normal-profile-top.png) / [中段](after-320-normal-profile-middle.png) / [末尾](after-320-normal-profile-end.png) | [顶部](after-375-normal-profile-top.png) / [中段](after-375-normal-profile-middle.png) / [末尾](after-375-normal-profile-end.png) | [顶部](after-430-normal-profile-top.png) / [中段](after-430-normal-profile-middle.png) / [末尾](after-430-normal-profile-end.png) | [顶部](after-320-font150-profile-top.png) / [中段](after-320-font150-profile-middle.png) / [末尾](after-320-font150-profile-end.png) |
| 机构推荐结果 | [顶部](after-320-normal-result-top.png) / [中段](after-320-normal-result-middle.png) / [末尾](after-320-normal-result-end.png) | [顶部](after-375-normal-result-top.png) / [中段](after-375-normal-result-middle.png) / [末尾](after-375-normal-result-end.png) | [顶部](after-430-normal-result-top.png) / [中段](after-430-normal-result-middle.png) / [末尾](after-430-normal-result-end.png) | [顶部](after-320-font150-result-top.png) / [中段](after-320-font150-result-middle.png) / [末尾](after-320-font150-result-end.png) |
| 养老咨询助手 | [顶部](after-320-normal-ai-chat-top.png) / [中段](after-320-normal-ai-chat-middle.png) / [末尾](after-320-normal-ai-chat-end.png) | [顶部](after-375-normal-ai-chat-top.png) / [中段](after-375-normal-ai-chat-middle.png) / [末尾](after-375-normal-ai-chat-end.png) | [顶部](after-430-normal-ai-chat-top.png) / [中段](after-430-normal-ai-chat-middle.png) / [末尾](after-430-normal-ai-chat-end.png) | [顶部](after-320-font150-ai-chat-top.png) / [中段](after-320-font150-ai-chat-middle.png) / [末尾](after-320-font150-ai-chat-end.png) |
| 我的预约 | [顶部](after-320-normal-appointment-top.png) / [中段](after-320-normal-appointment-middle.png) / [末尾](after-320-normal-appointment-end.png) | [顶部](after-375-normal-appointment-top.png) / [中段](after-375-normal-appointment-middle.png) / [末尾](after-375-normal-appointment-end.png) | [顶部](after-430-normal-appointment-top.png) / [中段](after-430-normal-appointment-middle.png) / [末尾](after-430-normal-appointment-end.png) | [顶部](after-320-font150-appointment-top.png) / [中段](after-320-font150-appointment-middle.png) / [末尾](after-320-font150-appointment-end.png) |

## 交互证据

- [年龄无效、Next 留页并滚动首错](interaction-320-font150-next-coordinate.png)
- [六步往返进入画像](interaction-320-font150-six-step-profile.png)
- [画像进入推荐](interaction-320-font150-profile-to-result.png)
- [长选项实际选择](interaction-320-font150-long-choice-selected.png)
- [150% 长文本输入及固定输入区](interaction-320-font150-ai-long-input.png)
- [已提交评价实际进入](after-320-font150-review-final.png)
- [窗口实际点击评价记录](native-appointment-physical-click.json)
- [连续两次触摸只导航一次](native-rapid-next.json)
- [输入已清空](native-ai-input-teardown.json)

## 局部复核

- [画像进食标题修改前](before-final-nutrition-fix.png) / [标准字号修改后](after-320-normal-nutrition.png) / [150% 修改后](after-320-font150-nutrition.png)
- [偏好说明换行修改前](before-final-preference-wrap-fix.png) / [修改后](after-320-normal-preference-top.png)
- [375px 标签末行修改前](before-final-profile-label-wrap.png) / [修改后](after-375-normal-profile-end.png)
- [430px 推荐说明修改前](before-final-result-wrap.png) / [修改后](after-430-normal-result-end.png)
- [430px 输入提示修改前](before-final-ai-placeholder-wrap.png) / [修改后](after-430-normal-ai-chat-end.png)

## 未计为通过的工具探索

- native-appointment-interaction.json、native-review-button-selector-check.json：伪类选择器实际选中了“查看机构”，不能用作评价按钮的精确 CSS 尺寸或点击通过证据。
- native-invalid-next.json：该次 Windows 鼠标操作未观察到首错滚动；采用 native-next-coordinate-probe.json 的官方坐标触摸结果核实首错。
- final-320-font150-targeted.json 最后的空字符串 input 操作被工具 schema 拒绝；native-ai-input-teardown.json 记录后续 input 事件清空成功。
- Android 系统字号、软键盘与真机触摸均 NOT_RUN；未用上述 DevTools 记录替代。
