# 武汉养老机构精准匹配小程序：从 0 创建到 Codex 多 Agent 开工

这份流程按“你现在还没有创建微信小程序”的状态设计。

## 最终目标结构

建议最后形成：

```text
wuhan-eldercare-match/
├─ AGENTS.md
├─ .codex/
│  ├─ config.toml
│  └─ agents/
│     ├─ wechat_frontend.toml
│     ├─ backend_domain.toml
│     ├─ matching_engine.toml
│     └─ qa_reviewer.toml
├─ prompts/
├─ miniprogram/
├─ server/
├─ docs/
└─ project.config.json
```

主 Codex 会话使用 GPT-5.6 Sol + Max；四个自定义子 Agent 使用 GPT-5.6 Luna + Max。

---

# 第一阶段：创建微信小程序账号

## 1. 准备一个小程序主体

进入微信公众平台，注册“小程序”类型账号。

如果这个产品未来要正式对外运营、预约看院、获取手机号、由机构/公司承接业务，优先使用真实业务主体注册，而不是把正式产品长期绑在个人主体上。

注册过程通常包括：

1. 选择账号类型“小程序”。
2. 填写未被其他公众平台账号占用的邮箱。
3. 邮箱激活。
4. 选择主体类型并完成主体信息。
5. 完成管理员绑定/验证。
6. 登录小程序管理后台。

后台界面名称可能随微信更新略有变化，以当时页面为准。

## 2. 完善小程序基础资料

进入后台后完成：

- 小程序名称
- 头像/Logo
- 简介
- 服务类目
- 主体信息
- 管理员信息

服务类目一定按真实业务能力选择。这个项目主要是“养老机构信息展示 + 老人需求匹配 + 顾问服务 + 看院预约”，不要为了功能听起来高级而错误选择需要额外医疗资质的类目。

## 3. 获取 AppID

在小程序后台找到开发相关设置中的 AppID/开发者 ID。

保存 AppID。

注意：
- AppID 不是 AppSecret。
- AppSecret 以后只应放在后端安全环境，不允许提交进小程序前端仓库。

## 4. 添加开发成员

如果开发微信号不是管理员本人，在后台的成员/权限管理中把实际开发微信号添加为开发者/体验成员。

这样微信开发者工具才能正常使用对应 AppID 进行开发、预览和上传。

---

# 第二阶段：安装微信开发者工具并创建工程

## 5. 安装微信开发者工具

下载并安装最新 Stable/稳定版微信开发者工具。

打开后用有开发权限的微信扫码登录。

## 6. 在 Windows 建项目目录

建议先创建：

```text
D:\Dev\wuhan-eldercare-match
```

项目名建议英文，例如：

```text
wuhan-eldercare-match
```

不要用“养老小程序最终版2”之类目录名，后面 Git/Codex/脚本都更难管理。

## 7. 新建微信小程序项目

在微信开发者工具中新建小程序：

- 项目名称：`wuhan-eldercare-match`
- 目录：上面创建的空目录
- AppID：填写真实 AppID
- 开发模式：小程序
- 语言/模板：优先 TypeScript 基础模板（如果当前工具提供）
- 后端服务：先不要启用云开发，保持普通小程序项目

为什么先不用云开发：

这个项目后续有老人健康数据、评估历史、机构资料、推荐逻辑、预约状态和运营跟进，独立后端边界更清楚，也更适合把推荐算法和业务数据做成可测试服务。

如果工具当前模板入口和文字略有变化，只要最终得到能正常编译的原生小程序工程即可。

## 8. 第一次编译

新建后立即点“编译”。

确保：

- 模拟器能显示默认页面
- Console 没有红色致命错误
- `project.config.json` 存在
- 小程序根目录设置正确

此时先不要开始做 20 个业务页面。

---

# 第三阶段：初始化 Git

## 9. 安装 Git

Windows 没装 Git 时，使用 winget 或官网安装。

安装后在项目根目录：

```powershell
git init
git add .
git commit -m "chore: initialize wechat mini program"
```

## 10. 建立 .gitignore

让 Codex 创建适配微信小程序 + Java/Spring Boot + IDE 的 `.gitignore`。

原则：

- 不提交 secret
- 不提交 AppSecret
- 不提交本机缓存
- 不提交构建产物
- `project.private.config.json` 一般作为本机配置对待

第一次能编译的纯净工程一定先 commit。以后 Codex 改坏时你才有可靠回退点。

---

# 第四阶段：安装和配置 Codex

## 11. Windows 上使用 Codex

推荐直接使用 ChatGPT/Codex Windows 桌面应用。

常用本地工具至少安装：

- Git
- Node.js LTS
- Python（Codex 辅助脚本常用）
- Java 21（准备后端时）

项目建议放 Windows 本地磁盘，例如 `D:\Dev\...`，让 Windows 原生 Codex + PowerShell 工作，路径和微信开发者工具也最直观。

## 12. 把本压缩包里的文件复制进项目

把：

```text
AGENTS.md
.codex/
prompts/
```

复制到项目根目录。

最终至少确保存在：

```text
AGENTS.md
.codex/config.toml
.codex/agents/wechat_frontend.toml
.codex/agents/backend_domain.toml
.codex/agents/matching_engine.toml
.codex/agents/qa_reviewer.toml
```

### 为什么没有默认安装 chief_orchestrator.toml？

因为推荐架构是：

```text
主会话 = GPT-5.6 Sol MAX
        ├─ wechat_frontend (Luna MAX)
        ├─ backend_domain (Luna MAX)
        ├─ matching_engine (Luna MAX)
        └─ qa_reviewer (Luna MAX)
```

主会话本身已经是总控 SOL，再额外 spawn 一个 SOL 总控通常只会浪费额度并增加一层沟通。

`optional/chief_orchestrator.toml` 只是备用，不要默认复制到 `.codex/agents/`。

## 13. 信任项目

Codex 只有在项目被信任时才会加载项目级 `.codex/config.toml` 等配置。

打开项目后如果出现 Trust/信任提示，确认这是你自己的仓库后再信任。

## 14. 主会话模型

检查主会话：

- Model：GPT-5.6 Sol
- Reasoning：Max
- 权限：建议使用需要审批/Ask for approval 的安全模式，而不是一上来 Full Access

`.codex/config.toml` 已经写入主 SOL 与四个 Luna 的项目默认值。

## 15. 验证自定义 Agent 是否被加载

在主会话先让 Codex：

> 阅读 AGENTS.md 和 .codex 配置，列出当前可用的自定义 Agent，不要修改代码。

应看到：

- wechat_frontend
- backend_domain
- matching_engine
- qa_reviewer

如果没出现：

1. 检查目录是不是 `.codex/agents/`。
2. 检查每个 TOML 是否有 `name`、`description`、`developer_instructions`。
3. 新开 Codex 会话，因为 AGENTS.md/配置通常在会话启动时读取。
4. 检查项目是否 Trusted。

---

# 第五阶段：给 Codex 产品资料

## 16. 建 docs/product

创建：

```text
docs/product/
```

把现有两份 PDF 放进去：

- 武汉养老机构精准匹配小程序 V1 页面级 PRD.pdf
- 武汉养老机构精准匹配小程序_MVP页面方案_V1.pdf

然后让主 SOL 阅读这些资料，而不是让每个 Luna 自己猜产品需求。

AGENTS.md 已经写了最关键的常驻约束；PDF 是详细页面依据。

---

# 第六阶段：第一次让 SOL 工作

## 17. 先不要说“把整个小程序做完”

第一次使用 `prompts/SOL_FIRST_PROMPT.md`。

主 SOL 应先：

- 读取仓库
- 读取 AGENTS.md
- 读取 PRD
- 检查 Agent
- 给 Bootstrap Plan

你确认计划后，再执行骨架创建。

## 18. 第一个开发里程碑：只做工程骨架

第一阶段建议让 SOL 创建：

- miniprogram/pages
- components
- services
- store
- types
- mock
- docs
- server 占位
- 20 个 P0 路由最小骨架
- 3 个底部 Tab：首页 / 养老顾问 / 我的

但是不要马上把 20 页都做成最终页面。

让 `wechat_frontend` 承担前端骨架；完成后让 `qa_reviewer` 检查是否能编译和跳转。

---

# 第七阶段：推荐的开发顺序

## Milestone 1：小程序骨架

主 SOL → wechat_frontend → qa_reviewer

完成：

- 路由
- TabBar
- 基础样式
- mock 数据层
- 服务层接口
- Git baseline

## Milestone 2：完整评估问卷

主 SOL 把 6 步问卷拆给 wechat_frontend。

同时 matching_engine 可以只做“评估答案 → 老人画像/ADL”的规则设计和测试，不去改 UI。

最后 QA 验证：

- 前后切换
- 暂不确定
- 答案不丢
- 画像与答案一致

## Milestone 3：推荐引擎

matching_engine 主负责。

先用 mock 的 7–8 家机构能力数据建立测试集。

注意：这些 mock 只用于测试，不代表真实合作机构事实。

重点完成：

- 硬过滤
- 护理匹配
- 预算
- 偏好
- 区域
- 推荐理由
- NO_EXACT_MATCH

QA 独立验证。

## Milestone 4：机构列表 / 详情 / VR

wechat_frontend 主负责 UI。

backend_domain 后续提供真实机构数据接口。

VR 第一版只要求：

- 真实 VR URL/Viewer
- 场景切换（取决于合作方提供能力）
- 机构详情明显入口

不要让 Codex自己“生成一个假的养老院 VR”。

## Milestone 5：后端落库

到前端流程稳定后再创建 Spring Boot 后端：

- 微信登录
- User / Elder
- Assessment / Answer
- Institution
- Recommendation
- Appointment

此阶段 backend_domain 主负责。

主 SOL 先定 API contract，再让 frontend 和 backend 并行接入。

## Milestone 6：预约与隐私

重点验证：

- 预约提交 = 待确认
- 手机号只在预约/顾问联系时获取
- 隐私说明
- 健康信息用途
- 预约真实落库

## Milestone 7：真实机构数据替换 mock

这是上线前最重要的一步之一。

逐家核验：

- 名称
- 地址
- 经纬度
- 价格
- 接收能力
- 特殊护理
- 医疗/康复
- 房型
- 图片
- VR
- 资质

没有的信息就留空/需咨询，禁止为了页面好看补假数字。

---

# 第八阶段：微信联调与上线前准备

## 19. 真机预览

每个核心里程碑都用微信开发者工具“预览”到手机测试。

特别测试：

- 老年家庭用户常见字体和触控体验
- 页面滚动
- 表单键盘
- 授权弹窗
- VR 打开
- 网络慢/失败

## 20. 后端域名

正式调用自建后端后，需要：

- HTTPS
- 在微信小程序后台配置合法服务器域名
- 根据用到的能力配置 request/upload/download/socket 等域名
- 不要把 localhost/IP 当成正式服务器地址

开发阶段可以利用开发者工具调试设置，但上线前必须按微信真实域名规则整理干净。

## 21. 隐私与用户信息保护

上线前必须完成微信后台要求的隐私/用户信息相关配置，并让实际代码行为与声明一致。

这个项目包含老人健康、认知、照护等信息，不能把隐私文案当成最后一天才补的东西。

## 22. 上传体验版

流程通常是：

微信开发者工具上传代码 → 小程序后台生成开发版本 → 设为体验版/让体验成员测试。

不要第一次上传就直接提审。

## 23. 提审前检查

至少完成：

- 20 个 P0 页面核心链路
- 微信登录
- 隐私声明
- 手机号授权时机
- 真实机构数据
- VR 可访问
- 预约真实落库
- 空状态
- 无完全匹配状态
- 无明显 console error
- 手机真机走完整闭环

## 24. 提交审核与发布

在后台提交版本审核；按审核反馈修正后再发布。

服务类目、隐私、用户信息、实际页面功能必须一致，否则容易被打回。

---

# 最推荐的 Agent 分配

```text
你
└─ 主 Codex：GPT-5.6 Sol MAX
   ├─ wechat_frontend：GPT-5.6 Luna MAX
   ├─ backend_domain：GPT-5.6 Luna MAX
   ├─ matching_engine：GPT-5.6 Luna MAX
   └─ qa_reviewer：GPT-5.6 Luna MAX
```

不要固定每次四个 Luna 全开。

常见路由：

- 首页/UI：frontend + QA
- 问卷：frontend + matching（规则部分）+ QA
- 推荐算法：matching + QA
- 数据库/API：backend + QA
- 纵向完整功能：SOL 定 contract → frontend/backend 并行 → QA

---

# 你真正应该做的第一个动作

1. 注册微信小程序账号。
2. 获取 AppID。
3. 安装微信开发者工具。
4. 用真实 AppID 创建一个能编译的 TypeScript 原生小程序空项目。
5. `git init` 并提交第一次 baseline。
6. 把本包的 `AGENTS.md`、`.codex/`、`prompts/` 复制进去。
7. 把两份 PRD PDF 放进 `docs/product/`。
8. 用 GPT-5.6 Sol MAX 打开项目。
9. 发送 `prompts/SOL_FIRST_PROMPT.md`。
10. 先审核 Bootstrap Plan，再开始开发。
