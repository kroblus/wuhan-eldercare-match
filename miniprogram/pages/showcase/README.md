# 原生全景与真实地图开发入口

仅当前小程序 `develop` 构建可用；开发者工具选择编译页 `pages/showcase/index`。正式产品页面没有入口，trial/release 和构建身份未知时内容关闭。三个页面只互相导航，不进入业务流程。本目录不证明独立 TEST AppID 或完整 Safe Rehearsal 已通过，不开放无人值守演示。

全景采用 Canvas WebGL 的 UV 球面内壁和透视相机，支持上下左右拖动、双指和按钮视场角、复位。按需绘制，不启动持续动画。隐藏/退出会释放 GPU 资源；本地照片不持久化，重新进入需重新选择。校准按钮生成经纬网格，不是照片，不代表家庭或机构环境。正式 `pages/institution/vr` 继续保留真实授权机构资料 Gate。

Owner 素材尚未提供。只接受经过人工隐私检查并由 Owner 确认完整球形 360°×180° equirectangular 投影的 2:1 baseline JPEG 演示副本，512–4096 像素宽、不超过 8 MB、无 EXIF/XMP/ICC/备注/内嵌缩略图或追加内容。尺寸不能证明投影；普通横向 Panorama 不作为完整球形照片加载。程序不能自动确认人物、证件、门牌、私人相片/文件已经脱敏。选图确认不是敏感数据持久化授权。

可使用仓库外的受控本地目录准备副本：在已安装 Pillow 的 Python 环境中执行 `scripts/prepare-showcase-panorama.py --input <仓库外原始文件> --owner-authorized --privacy-reviewed --full-sphere-equirectangular`。这三个声明必须由素材提供者先确认。工具不覆盖原件、不上传，输出到操作系统本地应用数据目录的 `WuhanEldercareShowcase/panoramas`，重新编码清除元数据并压缩，保存本地 provenance manifest；不把照片加入仓库。使用前还需人工复查副本视觉内容与投影。此工具不进行 AI 补图，也不将投影声明当作独立核验。

地图采用微信原生 map 和腾讯底图，初始为武汉城市范围，未设置自定义标记、机构坐标、POI 或导航。底图自身可能显示地图服务方公共地名；它们不是本项目核验的机构事实或自定义 POI。无需地图 WebService Key、搜索/路线服务或用户定位。地图加载产生服务方网络流量；wx.request 缓冲区为空不能证明原生瓦片无流量。组件 updated 和中心点回调也不能替代目视底图验收。页面支持更新超时提示、空白问题说明与显式重试。

验证入口：`npm run check:showcase-native-vr-map -- --output-dir <本轮baseline目录下的全新子目录> --baseline <本轮baseline.json>`。这是 TS4.1.2、离线 WXML 和 mock 生命周期检查，不等于原生操作。`node scripts/check-showcase-native-vr-map-artifacts.mjs --artifact-dir <实际当前 DevTools 编译缓存> --output-dir <另一个全新子目录> --baseline <本轮baseline.json>` 另行校验本目录全部 JS 的新鲜度、精确 source map 和语法。两者均在写入前拒绝缺省参数、历史输出目录、仓库/任务根目录、解析链接后越界路径及非空子目录，避免复跑覆盖旧证据。Baseline 是本轮工作区的 HEAD/index/文件哈希快照，不授予业务运行能力。整工程 `check:wechat-js-compat` 的覆盖 Gate 独立保留，不能把局部检查替代成全局 PASS。

本轮原生截图、事件记录、回归结果和未关闭门禁见 `output/v1-2-showcase-native-vr-map-v1-20261016/`。浏览器原型证据不用于本目录的 DevTools 验收；真实 Owner 图片、真机双指、Android 17、启动审计、两次稳定完整复演、完整 App Restart 和迟到业务回复跨页 Gate 仍需分别完成。

后续定向验证记录在 `output/v1-2-native-vr-map-targeted-verification-v1-20261016/`，不覆盖上述历史报告。DevTools 双触点事件、透传 WebGL 调用计数和元素隐藏/重建证据与物理触屏、GPU 驱动/GC 内存回收证据分别记录。不能将自动化触摸事件或释放 API 调用当作真机双指或无内存泄漏的证明。
