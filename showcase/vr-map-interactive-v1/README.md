# 独立 VR / 地图交互演示 V1

STATUS = PARTIAL — 组件和浏览器交互已验证，微信 DevTools 导入受 AppID 阻断。

这是物理隔离的教学演示工程。正式小程序不导入这里的文件，也没有新增正式入口。全景是原创几何空间，A/B 是无经纬度的逻辑示意点，均不属于任何机构。

## 当前适用范围（2026-10-22）

此目录是 2026-10-16 的独立 V1 教学工具；上方 PARTIAL 是当时记录，不是当前两个产品的总状态。它与正式 `miniprogram/pages/showcase/` 及 Classic B 的同名页面不是同一目录。

原创几何全景 PNG、生成器、浏览器交互外壳和隔离测试具有独立参考价值，建议保留这些内容后再决定归档；不得作为普通 TMP 清空。后续 Native VR/Map 工作包进度按需查 [技术演示进度](../../docs/development/NATIVE_VR_MAP_TECHNICAL_DEMO_PROGRESS_V1.md)。下方启动/验证命令仅用于复现此旧工具，不是日常开发 Gate。

## 本地操作

在仓库根目录运行 `node showcase/vr-map-interactive-v1/tools/serve.mjs`，打开控制台打印的 `http://127.0.0.1:端口/`。服务只监听本机，只允许读取清单中的本地源码、页面和一张图片；不接受写入。浏览器页面明确标注“不是微信 DevTools 验收”。它复用小程序的渲染器、资源和数学模块，但不模拟 WXML、微信事件或导航栈。

全景：左右/上下拖动，按钮调整视野，复位，查看说明，返回。示意图：拖动、缩放、点击 A/B，居中，切换未知/待核验/过期/不可用。状态不具备真实导航能力。

## 小程序运行门禁

单独导入本目录，不导入仓库根工程。当前项目配置使用游客标识 `touristappid`；实际 DevTools 导入已返回 APPID_ERROR，不能运行。它不是获批 TEST AppID。保持此失败关闭状态，不能改用正式 AppID、放宽域名安全或从普通应用安装启动后的 wrapper 来替代隔离。Owner 提供合法独立身份后，才可在另行核对构建来源、启动请求及权限的环境实际验收原生 Canvas、手势和返回栈。

## 实现和来源

- `miniprogram/`：三个独立页面，原生 Canvas WebGL 球面投影、Canvas2D 示意图；无 npm 运行依赖、web-view、业务启动或远程资源。
- `tools/generate_panorama.py`：原创射线与几何图案生成器。Pillow/NumPy 仅用于离线制作，不进入小程序包。
- `miniprogram/assets/provenance.json`：2048×1024、360°×180°等距柱状投影，单场景，35417 bytes，SHA256 `2701a9c06da5dac81bb2d3202a331baeab2595464f01b3ce1d22d7d65739e9e1`。无第三方照片、商业 VR 或机构关联；不主张任何外部机构素材许可。
- 视角采用方向向量到经纬角的采样，不把普通平面图拉伸成全景。WebGL 失效进入不可用；退出清理图片回调、监听、轮询和 GPU 资源。
- 原生 API 依据本地微信 typings 与[腾讯官方 API typings](https://raw.githubusercontent.com/wechat-miniprogram/api-typings/master/types/wx/lib.wx.api.d.ts)。配置基础库版本不构成运行通过证据。

## 本地验证

`node showcase/vr-map-interactive-v1/tests/check-runtime.mjs`：15 个单元/渲染与安全隔离场景。

`node showcase/vr-map-interactive-v1/tools/verify.mjs --local-only`：TS 4.1.2 源码解析和 ES2017 产物、无 class fields、厂商离线 WCC/WCSC。去掉参数另外运行定向正式回归；这仍不等于 DevTools App 编译或真机验收。

完整报告、实际截图、讲稿和阻断记录位于 `output/v1-2-showcase-vr-map-interactive-demo-v1-20261016/`。真实地理测试、真实机构 VR、微信实际交互、双指真机操作、字体放大及 Android 17 均未通过本轮实际运行验收。

DOC_IMPACT = NONE（新增隔离教学工具，无正式产品 route、ownership 或业务边界变更）。
