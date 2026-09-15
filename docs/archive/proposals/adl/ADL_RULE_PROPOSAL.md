# ADL 规则提案与决策历史

> 历史状态：`DECISION_RECORDED`
> 产品决定：`PRODUCT_OWNER_DECISION = PROPOSAL_C`
> 正式生产规则：`ADL_RULE_CONTRACT.md` / `adl-ruleset-v1`

本文保留 Phase 3A-1 对 Proposal A/B/C 的比较和决策证据。产品负责人已批准 Proposal C；运行时只能以 `ADL_RULE_CONTRACT.md` 为规范来源。Proposal A/B 与本文中的旧候选措辞不得进入生产 classifier。

## 1. 依据、范围与输出边界

依据是仓库中的两份正式产品文档与 `docs/architecture/ASSESSMENT_CONTRACT.md`：

- 《武汉养老机构精准匹配小程序 V1 页面级 PRD》PDF 第 14-16 页；
- 《武汉养老机构精准匹配小程序_MVP页面方案_V1》PDF 第 8 页；
- `ASSESSMENT_CONTRACT.md` 第 7、13、14 节。

两份 PRD 都要求用户回答生活场景，而不是自己理解“失能等级”；后台可以据此形成“自理 / 轻度照护 / 半失能 / 失能 / 重度失能”内部标签，问卷阶段不直接展示这些标签。本提案保持这一边界。

本提案讨论的输入只有：

```text
adl.eating
adl.mobility
adl.toileting
adl.bathing
adl.dressing
adl.transfer
adl.stairs
```

建议的概念输出不是一个裸字符串，而是与 ElderProfile 草案一致的两个相互独立的层：

```text
careLevel:
  status: known | unknown | needs_confirmation
  value（仅 known）: independent | light_care | semi_disabled | disabled | severely_disabled

careModes[]:
  wheelchair、bedridden、feeding_dependence、special_feeding_review、incontinence、
  catheter_or_stoma_review、toileting_full_assistance、fully_dependent_transfer、no_stairs_context 等
```

`careLevel` 只表达七题可证明的生活功能负担；`careModes` 保留对机构能力核对和解释理由有价值、但不具备严格序数意义的 ADL 事实。未能分类通过 `careLevel.status` 表达，不新增问卷答案。本文后续案例表中的 `careMode=` 均指 `AdlCareModeCode`，不再另设同义字段。

### 1.1 本轮明确不做的事

- 不把 `special_feeding` 自动写成“鼻饲”；明确鼻饲护理需求仍须读取 `cognitive.specialCareNeeds: tube_feeding`。
- 不把 `catheter_or_stoma` 自动写成“需要导尿护理”；明确导尿护理需求仍须读取 `cognitive.specialCareNeeds: catheter_care`。
- 不以 ADL 等级单独判定某家机构能否接收老人；机构能力必须由后续经过核验的机构字段支撑。
- 不使用疾病、认知、预算、区域或偏好答案偷偷改变 ADL 等级；这些是后续画像和匹配输入。
- 不把未知、缺失或未回答当作自理、无需求或低风险。
- 不引用外部护理量表或外部监管标准作为本项目规则。若未来要比较外部标准，必须另立 `EXTERNAL_REFERENCE_PROPOSAL`，不能直接改变本文候选规则。

## 2. 七题稳定 option code 与语义

下表逐项列出 Assessment Contract 已确认的 code。显示文案来自正式 PRD；规则只能读取 code，不能根据中文 label 推导。

### 2.1 进食能力 `adl.eating`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 可以完全独立进食 | 独立完成 | 是，最低负担 | 能独立进食 |
| `minor_assistance` | 需要少量协助 | 少量动手帮助 | 近似序数 | 进食存在轻度协助 |
| `needs_feeding` | 需要他人喂饭 | 他人持续参与 | 是，高照护负担 | 喂饭依赖；不等同鼻饲 |
| `special_feeding` | 鼻饲或其他特殊进食方式 | 进食方式/护理模式 | 否 | 特殊进食方式；提示核对鼻饲等具体需求 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题；不得补成独立 |

`needs_feeding` 可以提高生活功能负担；`special_feeding` 首先是护理模式事实，不能因为“特殊”二字就把所有老人直接归为重度失能。

### 2.2 行走能力 `adl.mobility`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 可以独立行走 | 独立完成 | 是，最低负担 | 独立行走 |
| `walking_aid` | 需要拐杖或助行器 | 借助器具行走 | 近似序数 | 使用助行器 |
| `wheelchair` | 主要依靠轮椅 | 主要依靠轮椅 | 不是纯序数；护理含义强 | 轮椅依赖/无障碍需求 |
| `bedridden` | 基本无法下床 | 卧床状态 | 是，最高级别覆盖事实 | 卧床；不能被其他题降级 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

`wheelchair` 不说明老人是否能自行驱动、是否需要转移协助，因此既可以参与第一阶段等级判断，也必须独立保留为机构能力核对事实。`bedridden` 是严重程度覆盖候选，不只是一个普通加分项。

### 2.3 如厕能力 `adl.toileting`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 可以完全自主完成 | 独立完成 | 是，最低负担 | 自主如厕 |
| `occasional_assistance` | 偶尔需要帮助 | 偶发协助 | 近似序数 | 偶发如厕协助 |
| `frequent_incontinence` | 经常失禁 | 排泄控制/照护模式 | 否；不是单纯行动分值 | 失禁护理线索 |
| `full_assistance` | 完全需要他人照护 | 完全依赖 | 是，高负担 | 完全如厕照护 |
| `catheter_or_stoma` | 导尿或造瘘 | 医疗/排泄护理模式 | 否 | 导尿或造瘘状态；提示核对导尿护理 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

`full_assistance` 是严重如厕依赖；`frequent_incontinence` 说明照护任务频繁，但不能只凭该 code 推断老人所有生活能力；`catheter_or_stoma` 是状态事实，不是 `catheter_care` 明确需求的替代品。

### 2.4 洗澡能力 `adl.bathing`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 完全自主 | 独立完成 | 是，最低负担 | 自主洗澡 |
| `partial_assistance` | 需要部分协助 | 部分协助 | 是，中等负担 | 洗澡部分协助 |
| `full_assistance` | 完全需要他人协助 | 完全依赖 | 是，高负担 | 洗澡完全协助 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

### 2.5 穿衣能力 `adl.dressing`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 完全自主 | 独立完成 | 是，最低负担 | 自主穿衣 |
| `partial_assistance` | 需要部分协助 | 部分协助 | 是，中等负担 | 穿衣部分协助 |
| `full_assistance` | 完全需要他人帮助 | 完全依赖 | 是，高负担 | 穿衣完全协助 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

### 2.6 起床与床椅转移 `adl.transfer`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 可以自主完成 | 独立完成 | 是，最低负担 | 自主转移 |
| `minor_assistance` | 需要少量帮助 | 少量协助 | 是，低负担 | 转移少量协助 |
| `needs_support` | 需要他人搀扶 | 人工支持 | 是，中高负担 | 转移需搀扶 |
| `fully_dependent` | 完全依赖他人 | 完全依赖 | 是，最高级别覆盖事实 | 完全转移依赖；不能被其他题降级 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

`fully_dependent` 是与 `bedridden` 同等重要的严重程度覆盖候选，即使其他六题看起来较轻，也不能让总分平均后降级。

### 2.7 上下楼能力 `adl.stairs`

| code | PRD 文案 | 功能形状 | 是否序数负担 | 必须保留的下游事实 |
|---|---|---|---|---|
| `independent` | 可以独立完成 | 独立完成 | 是，低负担 | 可独立上下楼 |
| `needs_assistance` | 需要帮助 | 需要协助 | 近似序数 | 上下楼需帮助 |
| `unable` | 无法完成 | 功能受限 | 近似序数 | 无法上下楼 |
| `no_stairs` | 当前生活环境无楼梯 | 不适用场景 | 否 | 无楼梯环境；不等于独立或无法完成 |
| `unknown` | 暂不确定 | 信息未知 | 否 | 未知问题 |

`no_stairs` 必须作为 `not_applicable_context` 保留。不能给它正向独立分，也不能把它当成“无法上下楼”。它对无障碍环境解释有价值，对身体功能等级不能产生正负推断。

## 3. 共同语义约束

三套候选方案都必须遵守以下约束；差别只在完整、无未知答案时如何形成 `careLevel`。

### 3.1 严重程度覆盖

下列事实不能被其他低负担答案的平均效果冲掉：

| 覆盖事实 | 最低结果建议 | 理由 | 仍需保留的 `careMode` |
|---|---|---|---|
| `adl.mobility = bedridden` | `重度失能` | 基本无法下床，转移、翻身、起居安全通常需要重点核对 | `bedridden` |
| `adl.transfer = fully_dependent` | `重度失能` | 床椅/起床完全依赖，属于直接高强度转移事实 | `fully_dependent_transfer` |
| `adl.eating = needs_feeding` | 至少 `失能` | 进食需要他人持续参与；属于明确生活照护依赖 | `feeding_dependence` |
| `adl.toileting = full_assistance` | 至少 `失能` | 如厕完全需要他人照护 | `toileting_full_assistance` |
| `adl.mobility = wheelchair` | 至少 `半失能` | 主要依靠轮椅，需要无障碍和转移能力核对 | `wheelchair` |
| `adl.toileting = frequent_incontinence` | 至少 `半失能` 或标为高照护模式 | 失禁护理任务频繁，但不证明所有 ADL 均失能 | `incontinence` |

这里的“至少”是候选规则含义，不是已经批准的生产规则。`full_assistance` 洗澡/穿衣、`needs_support` 转移、`unable` 上下楼等是否提升到更高等级，由方案选择和产品审批决定；任何实现都必须将该选择写成命名规则。

### 3.2 特殊进食、鼻饲、导尿与造瘘

- `special_feeding` 是进食方式不普通的事实，可能包含鼻饲，也可能包含其他方式；它不等于明确鼻饲护理需求。
- `cognitive.specialCareNeeds` 中的 `tube_feeding` 才能表达用户明确提出鼻饲护理需求。两者同时存在时理由可以更强，但不能把一个 code 改写成另一个 code。
- `catheter_or_stoma` 表达老人当前导尿或造瘘状态；`cognitive.specialCareNeeds: catheter_care` 表达明确需要导尿护理。二者必须分别留证。
- 机构匹配时，任何特殊护理硬约束都要读取明确需求和机构真实能力；ADL 等级不能替代硬约束评价。

### 3.3 unknown、未回答、incomplete 与 confidence

三者必须分开：

| 状态 | 机器含义 | 建议推导结果 | 禁止行为 |
|---|---|---|---|
| question ID 缺失 | `INCOMPLETE`，调用方错误地传入未完成评估 | reject / error / not derive，并返回缺失 ID | 不创建 ElderProfile，不补“自理” |
| value = `unknown` | `UNKNOWN_EXPLICIT`，用户明确不确定 | careLevel status=`unknown`；保留已知题事实，标记未知 ID | 不当作无需求 |
| 七题均为具体 code | `COMPLETE` | 可以运行候选规则 | 不丢失原始 code |

任一 question ID 缺失时，derivation 必须以 `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` 拒绝，不能产出部分 ElderProfile。任一值为 `unknown` 时，合法 Completed Assessment 可以保留 raw facts，但 `careLevel.status = unknown`、`confidence = needs_confirmation`，并携带 `unknownQuestionIds`。如果未来产品需要给推荐页一个临时区间，只能是单独的“信息不足下的候选范围”，不能伪装成 ADL 等级，也不能触发护理硬过滤。

建议将 confidence 定义为证据完整性标签而不是统计概率：

- `high`：七题都有具体、可排序的合法 code；只表示 ADL 分类证据完整，不表示机构能力已经核验。
- `medium`：七题完整，但出现 `special_feeding`、`catheter_or_stoma` 或 `no_stairs`，至少一个领域只有非序数/不适用上下文；可以保留功能层候选等级，护理适配仍需确认。
- `needs_confirmation`：至少一个问题为 `unknown`；careLevel status=`unknown`，不输出确定等级。question ID 缺失不进入 confidence，而是直接 reject。

`frequent_incontinence` 等可排序事实仍可得到 `high` 的 care-level evidence completeness，但对应护理 Capability 可以独立为 `needs_confirmation`。confidence 不得替代 `careMode` 或 Capability 状态。

## 4. Proposal A：加权负担分 + 命名覆盖规则

### 4.1 核心想法

将纯生活功能负担转换成一个透明的 `normalizedBurdenScore`，再用命名的覆盖规则处理严重事实和非序数 `careMode`。分值仅用于内部解释和测试，不向用户展示“分数”。`special_feeding`、`catheter_or_stoma`、`no_stairs` 不进入负担分；它们从可观察分母中排除，并以 `careMode` 进入后续能力核对。

### 4.2 七项权重

权重表示该题对日常人工照护时间与安全风险的相对影响，不是医学量表，也不是外部标准：

| 常量名 | questionId | 权重 |
|---|---|---:|
| `ADL_WEIGHT_EATING` | `adl.eating` | 2 |
| `ADL_WEIGHT_MOBILITY` | `adl.mobility` | 2 |
| `ADL_WEIGHT_TOILETING` | `adl.toileting` | 2 |
| `ADL_WEIGHT_BATHING` | `adl.bathing` | 1 |
| `ADL_WEIGHT_DRESSING` | `adl.dressing` | 1 |
| `ADL_WEIGHT_TRANSFER` | `adl.transfer` | 2 |
| `ADL_WEIGHT_STAIRS` | `adl.stairs` | 1 |

### 4.3 每个 option code 的分值

`N/A` 不是零分：它表示该 code 不属于一般功能序数，必须另存为 `careMode`。以下“原始分”只对完整且不是 `unknown` 的输入计算。

| questionId | code | 原始分 | 说明 |
|---|---|---:|---|
| `adl.eating` | `independent` | 0 | 独立 |
|  | `minor_assistance` | 1 | 少量协助 |
|  | `needs_feeding` | 3 | 喂饭依赖；另触发至少失能覆盖 |
|  | `special_feeding` | N/A | `special_feeding_review`，不将方式当成序数 |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.mobility` | `independent` | 0 | 独立 |
|  | `walking_aid` | 1 | 借助器具 |
|  | `wheelchair` | 2 | `wheelchair` careMode；至少半失能覆盖 |
|  | `bedridden` | 3 | 卧床；重度失能覆盖 |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.toileting` | `independent` | 0 | 独立 |
|  | `occasional_assistance` | 1 | 偶尔协助 |
|  | `frequent_incontinence` | 2 | 失禁照护负担；至少半失能覆盖 |
|  | `full_assistance` | 3 | 完全照护；至少失能覆盖 |
|  | `catheter_or_stoma` | N/A | `catheter_or_stoma_review` |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.bathing` | `independent` | 0 | 独立 |
|  | `partial_assistance` | 1 | 部分协助 |
|  | `full_assistance` | 2 | 完全协助；至少半失能覆盖 |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.dressing` | `independent` | 0 | 独立 |
|  | `partial_assistance` | 1 | 部分协助 |
|  | `full_assistance` | 2 | 完全帮助；至少半失能覆盖 |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.transfer` | `independent` | 0 | 独立 |
|  | `minor_assistance` | 1 | 少量帮助 |
|  | `needs_support` | 2 | 搀扶；至少半失能覆盖 |
|  | `fully_dependent` | 3 | 完全依赖；重度失能覆盖 |
|  | `unknown` | N/A | 不计算，结果未分类 |
| `adl.stairs` | `independent` | 0 | 独立 |
|  | `needs_assistance` | 1 | 需要帮助 |
|  | `unable` | 2 | 无法完成 |
|  | `no_stairs` | N/A | 不适用场景；从 observed denominator 排除并另存 `no_stairs_context` |
|  | `unknown` | N/A | 不计算，结果未分类 |

七项全部可观察时，`weightedObservedScore` 最小值 0、最大值 30。遇到 `special_feeding`、`catheter_or_stoma`、`no_stairs` 时，不把它们记为 0，而是同时从分子和该题最高可能分构成的分母中排除：

```text
ADL_NORMALIZED_SCORE_MAX = 30
availableWeightedMax = 所有可排序题的 (weight × 该题最高普通分) 之和
normalizedBurdenScore = weightedObservedScore × ADL_NORMALIZED_SCORE_MAX / availableWeightedMax
```

`ADL_NORMALIZED_SCORE_MAX=30` 是七题全部可观察时的透明理论最大值，不是外部量表常量或运行时散落数字。按当前 Contract，最多三个题可能是非序数 code，仍至少有四个可排序题；若未来输入导致 `availableWeightedMax = 0`，必须拒绝分类。`no_stairs` 会使分母从 30 降为 28，并令 confidence=`medium`，不会被解释为独立或无法完成。

### 4.4 五档 threshold 与产品意义

| 常量名 | normalizedBurdenScore | 内部等级 | 产品意义 |
|---|---:|---|---|
| `ADL_THRESHOLD_SELF_CARE_MAX` | 0 | 自理 | 所有一般功能题均独立，且没有累计负担 |
| `ADL_THRESHOLD_LIGHT_CARE_MAX` | `>0` 且 `<=3` | 轻度照护 | 仅有低强度或单项轻度协助 |
| `ADL_THRESHOLD_HALF_DEPENDENT_MAX` | `>3` 且 `<=9` | 半失能 | 至少存在一项明显功能受限或多项轻度协助，需要稳定日常帮助 |
| `ADL_THRESHOLD_DEPENDENT_MAX` | `>9` 且 `<=18` | 失能 | 多个生活领域有中高强度人工参与 |
| `ADL_THRESHOLD_SEVERE_DEPENDENT_MAX` | `>18` 且 `<=30` | 重度失能 | 广泛高负担；通常需要密集照护与安全支持 |

分值命中 threshold 后仍必须依次应用覆盖规则：

1. `bedridden` 或 `fully_dependent` → 至少 `重度失能`；
2. `needs_feeding` 或 `toileting.full_assistance` → 至少 `失能`；
3. `wheelchair`、`frequent_incontinence`、`bathing.full_assistance`、`dressing.full_assistance` 或 `transfer.needs_support` → 至少 `半失能`；
4. `special_feeding`、`catheter_or_stoma`、`no_stairs` → 不改变等级，分别写入 `special_feeding_review`、`catheter_or_stoma_review`、`no_stairs_context` careMode。

### 4.5 优缺点与推荐影响

优点：

- 数值、权重和阈值容易单元测试、回放和审计；
- 可以解释“总负担来自哪些题”；
- 覆盖规则能防止卧床和完全转移依赖被平均稀释；
- 适合后续做稳定回归矩阵。

缺点：

- 分值和权重有伪精确风险，产品负责人必须接受每个常量的业务含义；
- 不同风险可能得出相同分数，必须展示 evidence/careMode，而不能只看等级；
- `special_feeding`、`catheter_or_stoma` 被排除出分值后，调用方若只读取等级仍可能漏掉硬护理核对；
- 覆盖规则越来越多时，分数会和例外表同时存在，维护成本上升。

推荐影响：排序可以把 `careLevel` 作为一个明确输入，但不能把 normalized score 当机构匹配分；护理硬约束仍要从明确特殊护理需求和已核验机构能力计算。

### 4.6 代表案例矩阵

记号：`E/M/T/B/D/R/S` 分别代表 eating、mobility、toileting、bathing、dressing、transfer、stairs；未写出的题均为 `independent`。未特别注明时 `score` 是全部题可观察情况下的 normalized score；`careMode` 是与类型草案一致的独立事实 code。

| Case | input | classification | evidence | why |
|---|---|---|---|---|
| A01 | 全部 `independent` | 自理 | score=0 | 七题均无功能负担。 |
| A02 | `B=partial_assistance` | 轻度照护 | score=1 | 1 分落在 1-3 档，只有洗澡部分协助。 |
| A03 | `M=walking_aid, B=partial_assistance` | 轻度照护 | score=3 | 2+1=3，仍在轻度档；说明 threshold 上沿。 |
| A04 | `M=wheelchair` | 半失能 | score=4，careMode=wheelchair | 4 分刚进入半失能，且轮椅覆盖确保不会按自理处理。 |
| A05 | `E=needs_feeding` | 失能 | score=6，careMode=feeding_dependence | 原始分仅到半失能，但喂饭依赖覆盖到至少失能。 |
| A06 | `E=special_feeding` | 自理（功能层），confidence=medium | observed=0/24，normalized=0，careMode=special_feeding_review | 进食题从分母排除；特殊进食不能被误写为鼻饲或直接重度失能，需核对 tube_feeding。 |
| A07 | `M=bedridden` | 重度失能 | score=6，careMode=bedridden | 卧床覆盖优先于总分，不能被其他独立答案降级。 |
| A08 | `R=fully_dependent` | 重度失能 | score=6，careMode=fully_dependent_transfer | 完全转移依赖是严重事实覆盖。 |
| A09 | `T=full_assistance` | 失能 | score=6，careMode=toileting_full_assistance | 完全如厕照护至少为失能；不要求其他题也重度。 |
| A10 | `T=catheter_or_stoma` | 自理（功能层），confidence=medium | observed=0/24，normalized=0，careMode=catheter_or_stoma_review | 如厕题从分母排除；当前状态不是“独立如厕”，也不是 catheter_care 需求的替代。 |
| A11 | `S=no_stairs` | 自理，confidence=medium | observed=0/28，normalized=0，careMode=no_stairs_context | 上下楼题从分母排除；无楼梯不提供正负能力证据。 |
| A12 | `M=wheelchair` | 半失能 | score=4，careMode=wheelchair | 与 A13 原始分相同，但解释证据不同，轮椅能力核对优先。 |
| A13 | `M=walking_aid, B=partial_assistance, D=partial_assistance` | 半失能 | score=4，careModes=walking_aid+bathing_partial+dressing_partial | 与 A12 同分、同等级，但风险/机构问题不同，不能只展示分数。 |
| A14 | `B=unknown`，其余具体 | careLevel status=unknown | score=N/A，confidence=needs_confirmation | 明确 unknown 不能补成独立。 |
| A15 | 缺少 `R` key，其余具体 | reject | `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | incomplete input 不创建 ElderProfile。 |
| A16 | `M=walking_aid` | 轻度照护 | normalized=2 | 使用拐杖/助行器且其余独立，属于单项轻度协助。 |
| A17 | `M=wheelchair, B=full_assistance` | 半失能 | normalized=6，careModes=wheelchair+bathing_full_assistance | 轮椅与洗澡完全协助均需保留，但 6 分仍在半失能档。 |
| A18 | `M=wheelchair, T=frequent_incontinence, R=needs_support` | 失能 | normalized=12，careModes=wheelchair+incontinence+transfer_support | 三个核心领域中度依赖累计进入失能档。 |
| A19 | `T=full_assistance, B=full_assistance, D=full_assistance, R=fully_dependent` | 重度失能 | normalized=16 + `fully_dependent` override | 多项完全依赖；即使分值只到失能，转移完全依赖覆盖到重度。 |

## 5. Proposal B：主导照护需求的决策表

### 5.1 核心想法

不累加一个总分，而是先按明确的“最高照护事实”决策，再按跨领域负担数量补充升级。每个 option 只映射到 `independent / light / moderate / high / non_ordinal / unknown` 语义带，不做小数或加权。这样同一等级的两个老人仍然必须携带不同 evidence 和 careModes。

### 5.2 option code 到功能带

| questionId | code | 功能带 | 特殊说明 |
|---|---|---|---|
| `adl.eating` | `independent` | independent | |
|  | `minor_assistance` | light | |
|  | `needs_feeding` | high | 直接触发至少失能 |
|  | `special_feeding` | non_ordinal | `special_feeding_review`，不进入功能带比较 |
|  | `unknown` | unknown | 不分类 |
| `adl.mobility` | `independent` | independent | |
|  | `walking_aid` | light | |
|  | `wheelchair` | moderate | 至少半失能并保留 `wheelchair` careMode |
|  | `bedridden` | high | 重度失能覆盖 |
|  | `unknown` | unknown | 不分类 |
| `adl.toileting` | `independent` | independent | |
|  | `occasional_assistance` | light | |
|  | `frequent_incontinence` | moderate | 至少半失能的照护线索 |
|  | `full_assistance` | high | 至少失能 |
|  | `catheter_or_stoma` | non_ordinal | `catheter_or_stoma_review` |
|  | `unknown` | unknown | 不分类 |
| `adl.bathing` | `independent` | independent | |
|  | `partial_assistance` | light | |
|  | `full_assistance` | moderate | 至少半失能 |
|  | `unknown` | unknown | 不分类 |
| `adl.dressing` | `independent` | independent | |
|  | `partial_assistance` | light | |
|  | `full_assistance` | moderate | 至少半失能 |
|  | `unknown` | unknown | 不分类 |
| `adl.transfer` | `independent` | independent | |
|  | `minor_assistance` | light | |
|  | `needs_support` | moderate | 至少半失能 |
|  | `fully_dependent` | high | 重度失能覆盖 |
|  | `unknown` | unknown | 不分类 |
| `adl.stairs` | `independent` | independent | |
|  | `needs_assistance` | light | 不单独决定重度照护 |
|  | `unable` | moderate | 只能说明上下楼受限 |
|  | `no_stairs` | non_ordinal | 环境不适用，不影响等级 |
|  | `unknown` | unknown | 不分类 |

### 5.3 决策顺序与边界

使用命名规则，不使用散落在页面或服务中的隐式比较：

1. `ADL_INCOMPLETE_REJECT`：任一 question ID 缺失，返回 `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE`，不创建 Profile。
2. `ADL_UNKNOWN_RESULT`：任一题为 `unknown`，careLevel status=`unknown`、confidence=`needs_confirmation`。
3. `ADL_SEVERE_OVERRIDE`：存在 `bedridden` 或 `fully_dependent`，返回 `重度失能`。
4. `ADL_DEPENDENT_DIRECT_NEED`：存在 `needs_feeding` 或 `toileting.full_assistance`，返回至少 `失能`。
5. `ADL_DEPENDENT_COMBINATION`：至少两个不同题为 `moderate` 或以上，且其中一个是 `mobility`、`toileting`、`transfer`、`eating`，返回 `失能`。这是为了区分单项环境受限和多个核心生活领域的照护依赖。
6. `ADL_HALF_DEPENDENT_ANY`：任一 `moderate`（包括 wheelchair、frequent_incontinence、full_assistance bathing/dressing、needs_support transfer、unable stairs），返回至少 `半失能`。
7. `ADL_HALF_DEPENDENT_TWO_LIGHT`：两个或以上 `light`，返回 `半失能`。
8. `ADL_LIGHT_ONE`：恰有一个 `light`，返回 `轻度照护`。
9. 其他完整具体输入返回 `自理`。

`special_feeding`、`catheter_or_stoma`、`no_stairs` 不参与上述数量比较，但必须分别加入 `special_feeding_review`、`catheter_or_stoma_review`、`no_stairs_context` careMode。这样不会把一个特殊护理模式偷换成日常功能等级，也不会让环境没有楼梯被误判。

### 5.4 优缺点与推荐影响

优点：

- 没有总分和跨题权重，解释路径是“哪条规则命中”；
- 关键事实可以直接成为覆盖条件，适合硬约束前的证据审计；
- 便于产品负责人逐条审批和修改边界；
- 不会因不同题目的数量权重而制造分数相同却无法解释的假精度。

缺点：

- 规则数量会随边界案例增加；
- “两个 moderate”与“两个 light”的选择仍然需要产品决策；
- 没有一个整体负担指标，不适合需要连续排序的下游场景；
- 如果调用方只保存最终等级而不保存命中规则，解释性仍会丢失。

推荐影响：适合先作为匹配前的可审计分类器。排序只能读取命中规则和 careModes，不能把“规则命中次数”直接冒充机构匹配度。

### 5.5 代表案例矩阵

| Case | input | classification | evidence | why |
|---|---|---|---|---|
| B01 | 全部 `independent` | 自理 | 命中 default | 没有任何功能带负担。 |
| B02 | `B=partial_assistance` | 轻度照护 | 1 个 light | 单个低强度协助不升级。 |
| B03 | `M=walking_aid, B=partial_assistance` | 半失能 | 2 个 light，命中 `ADL_HALF_DEPENDENT_TWO_LIGHT` | 两个生活领域均需协助，达到组合边界。 |
| B04 | `M=wheelchair` | 半失能 | 1 个 moderate，careMode=wheelchair | 轮椅是中等功能限制和无障碍核对事实。 |
| B05 | `E=needs_feeding` | 失能 | 命中 `ADL_DEPENDENT_DIRECT_NEED`，careMode=feeding_dependence | 喂饭依赖不能被其他独立答案稀释。 |
| B06 | `E=special_feeding` | 自理（功能层），confidence=medium | non_ordinal，careMode=special_feeding_review | 特殊进食方式本身不证明一般 ADL 失能，但必须核对具体护理。 |
| B07 | `M=bedridden` | 重度失能 | 命中 `ADL_SEVERE_OVERRIDE` | 卧床是第一优先级严重事实。 |
| B08 | `R=fully_dependent` | 重度失能 | 命中 `ADL_SEVERE_OVERRIDE` | 完全转移依赖是同级严重事实。 |
| B09 | `T=full_assistance` | 失能 | 命中 `ADL_DEPENDENT_DIRECT_NEED`，careMode=toileting_full_assistance | 完全如厕照护直接到失能。 |
| B10 | `T=catheter_or_stoma` | 自理（功能层），confidence=medium | non_ordinal，careMode=catheter_or_stoma_review | 状态需要机构能力核对，但不等同所有如厕依赖。 |
| B11 | `S=no_stairs` | 自理，confidence=medium | context，careMode=no_stairs_context | 无楼梯使楼梯领域不适用，不产生功能结论。 |
| B12 | `M=walking_aid, B=partial_assistance, D=partial_assistance` | 半失能 | 3 个 light | 轻度负担广度达到半失能；解释应列出三个来源。 |
| B13 | `M=wheelchair` 与 `M=walking_aid, B=partial_assistance` | 均为半失能，但 evidence 不同 | 前者 1 moderate；后者 2 light | 同级不等于同风险；前者重点核对转移/轮椅，后者重点核对日常协助。 |
| B14 | `B=unknown`，其余具体 | careLevel status=unknown | `ADL_UNKNOWN_RESULT`，confidence=needs_confirmation | unknown 不是 independent，不能运行确定规则。 |
| B15 | 缺少 `R` key，其余具体 | reject | `ADL_INCOMPLETE_REJECT` | key 缺失不创建 ElderProfile。 |
| B16 | `T=frequent_incontinence` | 半失能 | 1 moderate，careMode=incontinence；capability needs_confirmation | 分类证据完整，但失禁护理需求仍需独立确认。 |
| B17 | `M=walking_aid` | 轻度照护 | 1 个 light | 使用拐杖/助行器且其余独立。 |
| B18 | `M=wheelchair, B=full_assistance` | 失能 | 2 个 moderate，命中 `ADL_DEPENDENT_COMBINATION` | 轮椅与洗澡完全协助形成跨领域中度依赖。 |
| B19 | `M=wheelchair, T=frequent_incontinence, R=needs_support` | 失能 | 3 个 moderate，careModes=wheelchair+incontinence+transfer_support | 三个核心领域同时受限，不能停留在半失能。 |
| B20 | `T=full_assistance, B=full_assistance, D=full_assistance, R=fully_dependent` | 重度失能 | `ADL_SEVERE_OVERRIDE` + 多项完全依赖 | 转移完全依赖提供重度覆盖，其余答案保留为解释证据。 |

## 6. Proposal C：功能轴 + 照护模式双轴矩阵

### 6.1 核心想法

把“老人日常功能依赖程度”和“需要什么照护模式”分成两个轴：

- `functionalAxis`：只用具有相对序数意义的生活功能事实判断五档等级；
- `careModeAxis`：保留喂饭、失禁、特殊进食、导尿/造瘘、轮椅、卧床和转移等护理模式，不用单一等级吞掉它们。

最终展示或画像可以是“半失能 + 轮椅辅助 + 导尿状态待核对”，而不是把所有事实挤成一个总分。内部 `careLevel` 只来自第一轴，并受明确的高依赖覆盖；第二轴负责后续机构能力核对和推荐理由证据。

### 6.2 功能轴映射

| questionId | code | functionalAxis 贡献 | careModeAxis |
|---|---|---|---|
| `adl.eating` | `independent` | none | none |
|  | `minor_assistance` | light | feeding_minor |
|  | `needs_feeding` | dependent floor | feeding_dependence |
|  | `special_feeding` | none | special_feeding_review |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.mobility` | `independent` | none | none |
|  | `walking_aid` | light | walking_aid |
|  | `wheelchair` | half floor | wheelchair |
|  | `bedridden` | severe override | bedridden |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.toileting` | `independent` | none | none |
|  | `occasional_assistance` | light | toileting_minor |
|  | `frequent_incontinence` | half floor | incontinence |
|  | `full_assistance` | dependent floor | toileting_full_assistance |
|  | `catheter_or_stoma` | none | catheter_or_stoma_review |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.bathing` | `independent` | none | none |
|  | `partial_assistance` | light | bathing_partial |
|  | `full_assistance` | half floor | bathing_full_assistance |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.dressing` | `independent` | none | none |
|  | `partial_assistance` | light | dressing_partial |
|  | `full_assistance` | half floor | dressing_full_assistance |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.transfer` | `independent` | none | none |
|  | `minor_assistance` | light | transfer_minor |
|  | `needs_support` | half floor | transfer_support |
|  | `fully_dependent` | severe override | fully_dependent_transfer |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |
| `adl.stairs` | `independent` | none | none |
|  | `needs_assistance` | light | stairs_assistance |
|  | `unable` | half floor | stairs_unable |
|  | `no_stairs` | none | no_stairs_context |
|  | `unknown` | blocks careLevel | 不生成 careMode；记录 `unknownQuestionIds` |

### 6.3 双轴矩阵与升级规则

功能轴的基线由“最高贡献 + 负担广度”得到：

| 最高功能贡献 | 其他贡献 | 功能轴结果 |
|---|---|---|
| none | 全为 none | 自理 |
| light | 只有一个 light | 轻度照护 |
| light | 两个或以上 light | 半失能 |
| half floor | 只有一个 half floor，且没有 dependent/severe floor | 半失能 |
| half floor | 两个或以上不同题为 half floor，且至少一个属于 mobility/toileting/transfer/eating | 失能 |
| half floor | 两个或以上不同题为 half floor，但全部只来自 bathing/dressing/stairs | 半失能 |
| dependent floor | 没有 severe override | 失能 |
| severe override | 任意 | 重度失能 |

功能轴规则的明确命名边界：

- `C_SEVERE_OVERRIDE`: `bedridden` 或 `fully_dependent`；
- `C_DEPENDENT_FLOOR`: `needs_feeding` 或 `full_assistance toileting`；
- `C_HALF_FLOOR`: `wheelchair`、`frequent_incontinence`、`full_assistance bathing/dressing`、`needs_support transfer`、`unable stairs`；
- `C_TWO_HALF_ESCALATION`: 两个或以上 half floor 且至少一个来自 mobility/toileting/transfer/eating，升级到失能；
- `C_NON_CORE_HALF_FALLBACK`: 两个或以上 half floor 但全部只来自 bathing/dressing/stairs，保持半失能，并完整保留各 careMode；
- `C_TWO_LIGHT_ESCALATION`: 两个及以上 `light` 贡献升级到半失能；
- `C_UNKNOWN_BLOCK`: 任一 unknown 令 careLevel status=`unknown`；任一 question ID 缺失则 reject。

照护模式轴永远并行保存，不因功能轴等级而删除：

| careModeAxis 事实 | 推荐后续语义 |
|---|---|
| `feeding_dependence` | 需要核对喂饭、护理人员参与和吞咽/进食安全；不自动等于 tube feeding |
| `special_feeding_review` | 必须核对具体方式；只有 `tube_feeding` 才是明确鼻饲护理需求 |
| `wheelchair` | 核对无障碍、转移、轮椅护理能力 |
| `bedridden` | 核对卧床、翻身、压疮预防和重度护理能力 |
| `incontinence` | 核对失禁护理；不能直接推断认知症 |
| `catheter_or_stoma_review` | 核对导尿/造瘘照护；只有 `catheter_care` 才是明确导尿护理需求 |
| `fully_dependent_transfer` | 核对床椅转移、起床和重度失能接收能力 |
| `no_stairs_context` | 作为环境上下文，不参与能力等级 |

### 6.4 优缺点与推荐影响

优点：

- 最完整地保留“功能等级”和“护理模式”两个不同语义；
- 特殊进食、导尿/造瘘、失禁、轮椅等不会被一个序数分数掩盖；
- 适合生成可追溯 ElderProfile facts，并为硬约束和推荐理由提供不同来源；
- 同一个 `careLevel` 下可以有不同 careMode，便于机构能力逐项核对。

缺点：

- 数据输出比单一等级复杂，需要下游明确读取哪一轴；
- 画像和推荐 UI 需要决定展示“等级 + flags”的组合文案；
- 矩阵规则仍需要边界案例回归，不能因为没有分数就省略测试；
- 未来任何持久化或接口层都必须同时承载 `careLevel` 与 `careModes`；不得退化为单一等级后丢失第二轴。

推荐影响：对后续 deterministic matching 最稳妥。硬约束使用明确 `direct_requirement`，ADL 功能轴只提供照护强度推导；推荐理由引用 careModeAxis 的事实和机构核验能力，避免“半失能”被误当成全部护理能力。

### 6.5 代表案例矩阵

| Case | input | classification | evidence | why |
|---|---|---|---|---|
| C01 | 全部 `independent` | 自理；careMode=none | 功能轴 none | 无生活功能负担或特殊模式。 |
| C02 | `B=partial_assistance` | 轻度照护；careMode=bathing_partial | 一个 light | 单项轻度协助。 |
| C03 | `M=walking_aid, B=partial_assistance` | 半失能；careMode=walking_aid+bathing_partial | 两个 light，`C_TWO_LIGHT_ESCALATION` | 两个领域负担的广度导致升级。 |
| C04 | `M=wheelchair` | 半失能；careMode=wheelchair | `C_HALF_FLOOR` | 轮椅影响功能轴，同时独立保留无障碍事实。 |
| C05 | `E=needs_feeding` | 失能；careMode=feeding_dependence | `C_DEPENDENT_FLOOR` | 喂饭依赖提供失能下限，但不写 tube feeding。 |
| C06 | `E=special_feeding` | 自理（功能层）+ special review | careMode=special_feeding_review | 功能独立与特殊进食方式可同时成立；需进一步确认。 |
| C07 | `M=bedridden` | 重度失能；careMode=bedridden | `C_SEVERE_OVERRIDE` | 卧床覆盖，不能被其他题降级。 |
| C08 | `R=fully_dependent` | 重度失能；careMode=fully_dependent_transfer | `C_SEVERE_OVERRIDE` | 完全转移依赖覆盖。 |
| C09 | `T=full_assistance` | 失能；careMode=toileting_full_assistance | `C_DEPENDENT_FLOOR` | 完全如厕照护给出失能下限。 |
| C10 | `T=catheter_or_stoma` | 自理（功能层）+ catheter review | careMode=catheter_or_stoma_review | 状态事实与功能等级分离；不能替代 catheter_care。 |
| C11 | `S=no_stairs` | 自理；confidence=medium；careMode=no_stairs_context | `C_NO_STAIRS_NEUTRAL` | 环境不适用，不对能力做正负推断。 |
| C12 | `M=walking_aid, B=partial_assistance` 与 `E=special_feeding` | 前者半失能；后者自理+special review | 功能轴相同的部分不同，careMode 不同 | 不同风险不能因“题目数量相同”合并；第二个需要特殊护理核对。 |
| C13 | `M=wheelchair` 与 `T=frequent_incontinence` | 均半失能，但 careMode 分别为 wheelchair / incontinence | 同一 careLevel、不同能力目标 | 一个重点是无障碍/转移，一个重点是失禁护理。 |
| C14 | `B=unknown`，其余具体 | careLevel status=unknown；confidence=needs_confirmation | `C_UNKNOWN_BLOCK` | 未知阻断功能轴确定性，已知 facts 仍可保留。 |
| C15 | 缺少 `R` key，其余具体 | reject | `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` | incomplete input 不创建 ElderProfile。 |
| C16 | `T=frequent_incontinence, R=needs_support` | 失能；careMode=incontinence+transfer_support | `C_TWO_HALF_ESCALATION` | 两个核心 half floor 升级到失能，规则已在本候选中定死。 |
| C17 | `M=walking_aid` | 轻度照护；careMode=walking_aid | 一个 light | 使用拐杖/助行器且其余独立。 |
| C18 | `M=wheelchair, B=full_assistance` | 失能；careMode=wheelchair+bathing_full_assistance | `C_TWO_HALF_ESCALATION` | 轮椅与洗澡完全协助形成两个 half floor。 |
| C19 | `M=wheelchair, T=frequent_incontinence, R=needs_support` | 失能；careMode=wheelchair+incontinence+transfer_support | `C_TWO_HALF_ESCALATION` | 多个核心 half floor 进入失能，但不自动升级重度。 |
| C20 | `T=full_assistance, B=full_assistance, D=full_assistance, R=fully_dependent` | 重度失能；careMode=toileting_full_assistance+bathing_full_assistance+dressing_full_assistance+fully_dependent_transfer | `C_SEVERE_OVERRIDE` | 多项完全依赖，转移完全依赖提供重度覆盖。 |
| C21 | `B=full_assistance, D=full_assistance` | 半失能；careModes=bathing_full_assistance+dressing_full_assistance | `C_NON_CORE_HALF_FALLBACK` | 两项 half floor 都来自非核心领域；不触发失能升级，但两个完全协助事实均保留。 |

## 7. 三套方案比较

| 维度 | Proposal A：加权分 | Proposal B：决策表 | Proposal C：双轴矩阵 |
|---|---|---|---|
| 可解释性 | 中高：可解释分值来源，但要同时解释覆盖 | 高：直接展示命中的规则 | 最高：等级与护理模式分离，证据最完整 |
| 实现复杂度 | 中：分数、阈值、覆盖、careMode | 中：规则表和组合计数 | 中高：双轴输出、careModes、下游读取约定 |
| 边界稳定性 | 中：阈值附近对单个选项敏感 | 中高：规则变更明确但组合边界较多 | 高：非序数事实不参与等级，边界语义更清晰 |
| 同分不同风险 | 需要额外 evidence 才能避免丢失 | 不使用总分，天然保留规则证据 | 通过 careModeAxis 原生保留 |
| 对推荐影响 | 适合排序前的负担摘要，但容易被误当匹配分 | 适合硬约束前的可审计分类 | 最适合硬约束证据与理由分离 |
| 测试成本 | 需覆盖分值、threshold、覆盖和同分 | 需覆盖决策优先级和组合数 | 需覆盖两轴、组合和下游映射 |
| 主要风险 | 伪精确、平均稀释特殊需求 | 规则增长、组合边界争议 | 输出复杂，旧 ElderProfile 字段不够承载 |

### 7.1 建议方案

历史建议为 `RECOMMENDED_PROPOSAL = C`，现已正式批准：`PRODUCT_OWNER_DECISION = PROPOSAL_C`。

理由是本项目后续推荐存在硬性护理条件，ADL“生活功能等级”不能替代鼻饲、导尿、压疮、认知症专区等明确护理需求。双轴结构能同时满足：

1. 用一条简洁、可审计的功能轴生成内部照护等级；
2. 保留特殊护理模式和原始 code，避免机构能力核对所需事实丢失；
3. 让 Recommendation 理由引用具体 evidence，而不是引用一个无法解释的总分；
4. 对 unknown/incomplete 诚实返回信息不足，不把不确定性伪装成自理。

`HISTORICAL_ONLY / NOT_ACTIONABLE`：Proposal B 曾是较低复杂度备选，Proposal A 曾要求额外接受权重和阈值；Proposal C 批准后，两者均不得作为实现选择。

`FINAL DECISION = PROPOSAL_C`。正式等级顺序、nonordinal/unknown/no-stairs 语义及 C01-C21 以 `ADL_RULE_CONTRACT.md` 为准。

## 8. 必须写入后续 ElderProfile 的 facts 与证据

以下是只读语义审查结论，供后续 ElderProfile contract 使用；本文件不修改该 contract。

### 8.1 必须保留的原始 facts

每个画像都必须能回溯到本次 Assessment 的原始答案：

- 七个 `questionId` 和对应 stable `code`；
- 由规则命中的 `careLevel`、rule id、规则版本；
- `careModes`：`wheelchair`、`bedridden`、`feeding_dependence`、`special_feeding_review`、`incontinence`、`toileting_full_assistance`、`catheter_or_stoma_review`、`fully_dependent_transfer`；
- `no_stairs_context`，不能在画像序列化时丢掉；
- Profile 中保留 `unknownQuestionIds`；分类状态与 confidence 由 `careLevel.status` / `careLevel.confidence` 表达，避免重复字段漂移；
- `missingQuestionIds` 只属于 `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` 错误结果，不能写进一个看似合法的 ElderProfile；
- 每个派生结论的 `sourceQuestionIds` 和 `sourceCodes`，便于推荐理由回溯。

`careLevel` 只能表示规则推导的内部摘要，不能替代上述 facts。任何未来接口都不能把所有事实压成 `tags` 或 `summary` 后丢失来源；必须保留结构化 careModes 与 evidence，而不是依赖自由文本。

### 8.2 unknown、other 与医学推导边界

- ADL 的 `unknown` 是用户明确不确定；question key 缺失是未回答；两者均不能当作 independent。
- 本七题没有 ADL `other` option。不要在 UI 或 classifier 中自行增加 `other`、自由文本或临时 code；如果产品要补充，必须先修改 Assessment Contract。
- `special_feeding` 只能推导“特殊进食方式待确认”；明确鼻饲必须来自 `tube_feeding`。
- `catheter_or_stoma` 只能推导“导尿/造瘘状态”；明确导尿护理必须来自 `catheter_care`。
- `bedridden` 是用户报告的生活状态，不是医生诊断；`fully_dependent` 是用户报告的转移依赖，不自动生成疾病结论。
- ADL 等级不是医疗诊断、护理评估证书或机构接收承诺；不能据此推断压疮、认知症、吞咽障碍或长护险等级。
- `no_stairs` 只表示当前环境无楼梯，不能推断老人能够或不能够上下楼。

### 8.3 当前 Assessment Contract 的下游 Gap

现有七题足以支持一个可解释的第一版生活功能分类，但不足以支持所有机构接收决策。明确 Gap 包括：

1. `wheelchair` 没有记录是否能自行驱动、是否需要转移帮助、室内外使用差异；
2. `special_feeding` 没有记录具体方式、鼻饲与否、吞咽风险或护理频次；
3. `catheter_or_stoma` 没有记录类型、频次、是否需要专业护理；
4. `frequent_incontinence` 没有记录失禁类型、夜间频率、是否需要全程更换照护；
5. 洗澡、穿衣和上下楼没有记录风险触发原因或所需器具；
6. 七题没有记录答题人、观察时间、急性病后变化或医学确认来源；
7. 没有单独的“无法判断原因”，因此 confidence 只能表达输入完整性，不能解释未知原因；
8. 没有一个 ADL 题记录照护频次、夜间需求或一对一需求；这些必须继续使用 Cognitive/Health 中已冻结的明确需求 code，不能由 classifier 猜测。

因此，后续匹配必须把这些 Gap 作为“需要咨询/待核验”而不是默认支持或默认不支持。若业务要把其中任何 Gap 变成硬约束输入，应先报告并修改对应 Assessment Contract，不能在 classifier 内偷偷扩展。

## 9. 实施验收门槛

Proposal C 已批准，classifier 只能在以下冻结项均可验证时进入生产：

- 方案 A/B/C 的单一选择；
- 所有 override、组合边界和 unknown/incomplete 行为；
- `careLevel.status`、`careLevel.confidence`、`careModes` 和 evidence 的结构；
- rule version 与测试 fixture 格式；
- 与 ElderProfile 的字段映射；
- 与 matching engine 的输入边界，尤其是 `special_feeding`/`tube_feeding`、`catheter_or_stoma`/`catheter_care` 的分离。

实现后必须完整覆盖正式规则的 C01-C21，另加非法 code、missing、unknown、nonordinal、no-stairs、evidence 与 determinism 测试。Proposal A/B 的案例仅保留为历史，不是生产回归期望。未经独立 QA 审查，不得把任何内部等级用于推荐排序、硬过滤或用户文案。
