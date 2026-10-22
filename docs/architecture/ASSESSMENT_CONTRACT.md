# Assessment 前端领域契约

状态：`FROZEN_PHASE_2D`

冻结标志：`ASSESSMENT_INPUT_SYSTEM_FROZEN = TRUE`

版本：`assessment-schema-v1`

适用范围：Phase 2D 冻结六步评估输入系统及本地 `AssessmentDraft` 完成态校验。画像页仍为 Skeleton；本文不实现 ElderProfile 推导、ADL 分级、推荐算法或历史 Assessment 落库。

## 1. 依据与边界

本契约依据以下正式产品文档整理：

- 《武汉养老机构精准匹配小程序 V1 页面级 PRD》PDF 第 9–20、44–48 页；
- 《武汉养老机构精准匹配小程序_MVP页面方案_V1》PDF 第 5–13、25–27 页；
- 根目录 `AGENTS.md` 中的匿名优先、敏感信息最小化、历史 Assessment 不覆盖和 deterministic 推荐约束。

契约只包含正式 PRD 已定义的问题主题。不会采集身份证号、手机号、微信身份、机构评价或其他 P1/P2 数据。选择“希望顾问联系我”只表达意愿，不等于授权手机号，也不得在评估页触发手机号授权。

## 2. 核心不变量

1. 问题 ID 是跨页面、草稿、历史 Assessment、画像和推荐的稳定机器标识；发布后禁止改义或复用。
2. UI 展示中文 label，持久化只保存稳定英文 code，不保存 label 作为业务判断依据。
3. “未回答”是答案对象中不存在该 question ID；不能当作 `false`、`none` 或 `unknown`。
4. `unknown` 表示用户明确选择“暂不确定/暂不清楚/不确定”；下游不得把它当作无疾病、无风险或无护理需求。
5. `none` 表示用户明确确认“无以上情况/暂无该需求”；它与 `unknown` 语义不同。
6. 多选答案按集合处理；相同 code 不得重复。`none`、`unknown` 与同题其他选项互斥。
7. 条件题失活时必须删除其旧答案，防止隐藏答案继续影响画像或推荐。
8. 当前客户端 `AssessmentDraft` 与已经完成的历史 `Assessment` 是两个对象，禁止用一个带多状态的对象混用。
9. 重新评估创建新 Assessment；不得覆盖任何已完成 Assessment。
10. Recommendation 未来必须绑定生成它的 Assessment；本阶段不生成 Recommendation。

## 3. 步骤与进度

| stepId | 页面 | 进度 | 当前实现 |
|---|---|---:|---|
| `basic` | `pages/assessment/basic` | 1 / 6 | 完整实现 |
| `health` | `pages/assessment/health` | 2 / 6 | 完整实现 |
| `adl` | `pages/assessment/adl` | 3 / 6 | 完整实现 |
| `cognitive` | `pages/assessment/cognitive` | 4 / 6 | 完整实现 |
| `preference` | `pages/assessment/preference` | 5 / 6 | 完整实现 |
| `budget` | `pages/assessment/budget` | 6 / 6 | 完整实现 |

评估说明页展示 PRD 的五组内容概览，但实际数据模型仍为六步；“身体与生活能力”在说明文案中合并展示，进入问卷后拆为 `health` 和 `adl` 两步。

## 4. 答案类型

| questionType | TypeScript 语义 | 说明 |
|---|---|---|
| `single_choice` | 字符串字面量 union | 单选稳定 code |
| `multi_choice` | 字符串字面量数组 | 去重集合；应用互斥和数量规则 |
| `text` | `string` | 非空时保存用户原文；空或全空白按 UNANSWERED 清除 key |
| `integer` | `number` | 必须是十进制整数；范围由问题定义 |
| `dynamic_single_choice` | discriminated union | 选项来自已核验的合作机构数据 |

### 4.1 三种答案状态

```text
question ID 不存在       = UNANSWERED（未回答）
question ID 值为 unknown = UNKNOWN（用户明确不确定）
question ID 有普通值     = ANSWERED（用户明确回答）
```

只有问题定义允许时才能使用 `unknown`。基本情况页不新增“暂不确定”选项；其必填项严格按照 PRD 校验。

## 5. 第 1 步：老人基本情况

### 5.1 问题定义

| questionId | 类型 | 必填 | 条件 | 后续语义 |
|---|---|---:|---|---|
| `basic.relationship` | `single_choice` | 是 | - | Elder/Profile 家庭关系标签；不参与硬过滤 |
| `basic.elderName` | `text` | 否 | - | 仅用于家庭档案识别；不参与匹配 |
| `basic.gender` | `single_choice` | 是 | - | Profile 基础信息；当前不参与硬过滤 |
| `basic.age` | `integer` | 是 | 50–110，含边界 | Profile 基础信息；当前不参与硬过滤 |
| `basic.livingStatus` | `single_choice` | 否 | - | Profile 居住背景、顾问理解上下文 |
| `basic.primaryCaregiver` | `single_choice` | 否 | - | Profile 照护资源背景 |
| `basic.hasInstitutionExperience` | `single_choice` | 否 | - | 是否展开离院原因 |
| `basic.institutionExitReasons` | `multi_choice` | 条件选填 | 仅当上一题为 `true` | 体验偏好上下文；不作为护理能力事实 |

PRD 只明确 `relationship`、`gender`、`age` 为必填，`elderName` 为选填；本契约不擅自把其余基本信息升级为必填。

### 5.2 稳定选项

`basic.relationship`

```text
father=父亲
mother=母亲
paternal_grandfather=祖父
paternal_grandmother=祖母
maternal_grandfather=外祖父
maternal_grandmother=外祖母
spouse=配偶
self=本人
other=其他
```

`basic.gender`

```text
male=男
female=女
```

`basic.livingStatus`

```text
alone=独居
with_spouse=与配偶同住
with_children=与子女同住
with_other_relatives=与其他亲属同住
hospitalized=当前住院
in_eldercare_institution=已入住养老机构
other=其他
```

`basic.primaryCaregiver`

```text
spouse=配偶
children=子女
nanny=保姆
care_worker=护工
community_care=社区照护
no_fixed_caregiver=暂无固定照护者
other=其他
```

`basic.hasInstitutionExperience`

```text
true=有
false=没有
```

`basic.institutionExitReasons`

```text
poor_nursing=护理不理想
poor_service_attitude=服务态度问题
high_cost=收费较高
too_far=距离太远
insufficient_medical_capability=医疗能力不足
unsatisfactory_environment=环境不满意
unsatisfactory_food=饮食不满意
elder_not_adapted=老人不适应
other=其他
```

条件清理规则：`basic.hasInstitutionExperience` 从 `true` 改为 `false` 或被清除时，必须同时删除 `basic.institutionExitReasons`。

## 6. 第 2 步：健康情况

| questionId | 类型 | 必填 | 规则 | 后续语义 |
|---|---|---:|---|---|
| `health.conditions` | `multi_choice` | 是 | `none` / `unknown` 互斥 | 疾病与医疗支持画像；认知疾病可提供风险证据 |
| `health.recentEvents` | `multi_choice` | 是 | `none` / `unknown` 互斥 | 跌倒、骨折、住院、卧床、压疮风险 |
| `health.rehabilitationNeed` | `single_choice` | 是 | 允许 `unknown` | 康复需求、排序和推荐理由 |

`health.conditions`

```text
hypertension=高血压
diabetes=糖尿病
coronary_heart_disease=冠心病
stroke_sequelae=脑卒中后遗症
parkinson_disease=帕金森
alzheimers_disease=阿尔茨海默症
other_cognitive_impairment=其他认知障碍
chronic_respiratory_disease=慢性呼吸疾病
osteoarticular_disease=骨关节疾病
tumor=肿瘤
other_chronic_disease=其他慢性疾病
none=暂无明显慢性疾病
unknown=暂不清楚
```

`health.recentEvents`

```text
fall_within_6_months=半年内跌倒
fracture_within_6_months=半年内骨折
frequent_hospitalization_within_6_months=半年内频繁住院
recently_discharged=近期刚出院
postoperative_recovery=术后恢复中
long_term_bedridden=长期卧床
pressure_injury=存在压疮
none=以上均无
unknown=暂不清楚
```

`health.rehabilitationNeed`

```text
definite=明确需要
possible=可能需要
none=不需要
unknown=不确定
```

## 7. 第 3 步：日常生活能力（ADL 输入）

以下 7 题均为 `single_choice`、步骤必填。普通选项来自 PRD；根据评估说明页的全局规则，每题另允许 `unknown=暂不确定`。`unknown` 不计分，也不能当作独立能力。

| questionId | 选项 code | 后续语义 |
|---|---|---|
| `adl.eating` | `independent`, `minor_assistance`, `needs_feeding`, `special_feeding`, `unknown` | ADL；`special_feeding` 同时提示核对鼻饲等特殊进食需求 |
| `adl.mobility` | `independent`, `walking_aid`, `wheelchair`, `bedridden`, `unknown` | ADL、轮椅/卧床能力匹配和理由 |
| `adl.toileting` | `independent`, `occasional_assistance`, `frequent_incontinence`, `full_assistance`, `catheter_or_stoma`, `unknown` | ADL；失禁、导尿/造瘘护理线索 |
| `adl.bathing` | `independent`, `partial_assistance`, `full_assistance`, `unknown` | ADL |
| `adl.dressing` | `independent`, `partial_assistance`, `full_assistance`, `unknown` | ADL |
| `adl.transfer` | `independent`, `minor_assistance`, `needs_support`, `fully_dependent`, `unknown` | ADL、转移照护强度 |
| `adl.stairs` | `independent`, `needs_assistance`, `unable`, `no_stairs`, `unknown` | ADL；`no_stairs` 是不适用场景，不等于独立或无法完成 |

显示 label 必须使用 PRD 的人话描述。问卷阶段不得显示内部“自理/半失能/失能”等计算结果；ADL 分级规则由后续 matching 里程碑单独冻结。

## 8. 第 4 步：认知与特殊护理

| questionId | 类型 | 必填 | 规则 | 后续语义 |
|---|---|---:|---|---|
| `cognitive.symptoms` | `multi_choice` | 是 | `none` / `unknown` 互斥 | 认知症、走失风险与照护强度 |
| `cognitive.specialCareNeeds` | `multi_choice` | 是 | `none` / `unknown` 互斥 | 特殊护理硬性条件和解释理由 |

`cognitive.symptoms`

```text
memory_decline=记忆力明显下降
repetitive_questioning=重复询问
gets_lost=容易迷路
wandering_risk=有走失风险
sleep_wake_disorder=昼夜作息混乱
mood_instability=情绪波动明显
agitation=容易躁动
aggression=有攻击行为
diagnosed_dementia=已确诊认知症
none=无以上情况
unknown=暂不确定
```

`cognitive.specialCareNeeds`

```text
round_the_clock_care=24 小时照护
one_to_one_caregiver=一对一护工
night_care=夜间重点照护
dementia_unit=认知症专区
rehabilitation_training=康复训练
tube_feeding=鼻饲护理
catheter_care=导尿护理
pressure_injury_care=压疮护理
incontinence_care=失禁护理
other=其他
none=无以上特殊护理需求
unknown=暂不确定
```

`none` 是为避免“未回答”被误解为“无需求”而冻结的显式否定值，不增加新的问卷主题。硬性护理条件只从用户明确答案中生成；`unknown` 不得触发支持或不支持的断言。

## 9. 第 5 步：养老需求与偏好

| questionId | 类型 | 必填 | 规则 | 后续语义 |
|---|---|---:|---|---|
| `preference.careType` | `single_choice` | 是 | 允许 `unknown` | 机构类型偏好、排序和解释 |
| `preference.priorities` | `multi_choice` | 是 | 1–3 项，无互斥项 | 排序权重和可解释理由主题 |
| `preference.region` | `dynamic_single_choice` | 否 | `no_preference` 或当前已核验机构区域 | 区域偏好与 NO_EXACT_MATCH 差异说明 |

`preference.careType`

```text
active_aging=活力养老
medical_nursing_integrated=医养结合
disability_care=失能护理
dementia_care=认知症照护
rehabilitation_care=康复养老
unknown=不确定
```

`preference.priorities`

```text
medical_conditions=医疗条件
nursing_professionalism=护理专业
caregiver_attitude=护理态度
rehabilitation_capability=康复能力
food_quality=餐饮质量
living_environment=居住环境
overall_quality=整体品质
recreational_activities=文娱活动
close_to_family=离家近
transportation=交通方便
price=价格
dementia_care=认知症照护
```

`preference.region`

```text
{
  kind: 'no_preference',
  regionCode: 'no_preference',
  regionLabelSnapshot: '不限制',
  catalogVersion: string
}
{
  kind: 'institution_region',
  regionCode: string,
  regionLabelSnapshot: string,
  catalogVersion: string
}
```

禁止维护武汉全量行政区常量。`regionCode` 必须是机构数据源中的长期稳定规范 code，并来自真实、已核验合作机构数据；机构池变化时动态生成选项。`regionLabelSnapshot` 保存用户作答当时的显示名称，`catalogVersion` 保存当时的机构区域目录版本，保证合作机构池变化后仍能解释历史 Assessment。快照只用于历史展示，当前匹配仍以稳定 `regionCode` 为准。

## 10. 第 6 步：预算与入住计划

| questionId | 类型 | 必填 | 规则 | 后续语义 |
|---|---|---:|---|---|
| `budget.monthlyRange` | `single_choice` | 是 | 允许 `unknown` | 预算匹配和 NO_EXACT_MATCH 差异 |
| `budget.upfrontCostAcceptance` | `single_choice` | 是 | 允许 `unknown` | 押金/一次性费用提示，不伪造机构费用 |
| `budget.moveInTiming` | `single_choice` | 是 | - | 入住意向和顾问跟进优先级 |
| `budget.consultantSupport` | `single_choice` | 是 | - | 只保存联系意愿；不包含手机号 |

`budget.monthlyRange`

```text
cny_3500_5000=3500–5000 元/月
cny_5000_8000=5000–8000 元/月
cny_8000_12000=8000–12000 元/月
cny_12000_15000=12000–15000 元/月
cny_15000_plus=15000 元以上/月
unknown=暂不确定
```

`budget.upfrontCostAcceptance`

```text
acceptable=可以接受
depends_on_amount=视具体金额而定
avoid_high_one_time_fee=不希望较高一次性费用
unknown=不清楚
```

`budget.moveInTiming`

```text
as_soon_as_possible=希望尽快入住
within_1_month=1 个月以内
within_1_to_3_months=1–3 个月
after_3_months=3 个月以后
research_only=只是提前了解
```

`budget.consultantSupport`

```text
request_contact=希望顾问联系我
recommendation_first=先看推荐结果
```

## 11. 条件与互斥规则

| 规则 ID | 触发 | 行为 |
|---|---|---|
| `basic-experience-reasons` | `basic.hasInstitutionExperience === 'true'` | 显示 `basic.institutionExitReasons` |
| `basic-experience-clear` | 上题为 `false` 或未回答 | 删除 `basic.institutionExitReasons` |
| `health-condition-exclusive` | 选择 `none` 或 `unknown` | 清除 `health.conditions` 其他值；选择普通值时清除 `none`/`unknown` |
| `health-event-exclusive` | 选择 `none` 或 `unknown` | 清除 `health.recentEvents` 其他值；选择普通值时清除 `none`/`unknown` |
| `cognitive-exclusive` | 选择 `none` 或 `unknown` | 对对应认知/特殊护理多选清除其他值 |
| `priority-limit` | 已选 3 个关注项 | 禁止继续新增；允许取消；显示“最多选择 3 项” |
| `region-source` | 打开区域题 | 只加载当前真实合作机构存在的已核验区域，加“不限” |

## 12. AssessmentDraft 与历史 Assessment

### 12.1 当前编辑草稿

`AssessmentDraft` 是客户端本地、可变、未完成的数据：

```text
kind: assessment_draft
schemaVersion: 1
localDraftId: 仅本机 ID，不是服务器 Assessment ID
persistence: LOCAL_DEVICE_DEVELOPMENT_ONLY
currentStep: basic | health | adl | cognitive | preference | budget
answers: Partial<Record<AssessmentQuestionId, typed value>>
startedAt / updatedAt: ISO 时间
```

`currentStep` 表示“最近一次已通过本步骤校验并成功持久化的步骤”，不是当前可见页面、恢复路由或匹配事实。返回上一页不会回退该字段；评估说明页继续填写仍从 Basic 进入，由各页从同一 Draft 恢复答案。

### 12.2 已完成历史评估

`Assessment` 是未来后端生成的不可覆盖历史事实：

```text
kind: completed_assessment
id: 服务器 ID
elderId: 老人档案 ID
status: completed
schemaVersion: 1
answers: 完成时的答案快照
completedAt: ISO 时间
```

本阶段不创建、不模拟、不在本地伪造已完成 Assessment。

### 12.3 保存范围

- 只保存一个当前编辑草稿；保存字段限于 schemaVersion、localDraftId、currentStep、answers 和时间戳。
- 仅使用微信小程序本地 storage；不调用 `wx.request`，不声称已经同步服务器。
- 不保存手机号、微信凭证、身份证号、推荐结果或历史 Assessment。
- 每次有效字段变更立即保存；返回上一页、切换页面、进入后台或重启小程序不主动清除。
- 禁止在日志中输出答案内容。

### 12.4 恢复规则

1. 仅恢复 `kind === 'assessment_draft'` 且 `schemaVersion === 1` 的结构。
2. 答案可部分存在；缺失 question ID 保持未回答，不补默认业务答案。
3. 页面进入时从 store 读取最新快照；UI 临时状态不得覆盖已保存答案。
4. 条件题恢复后再次应用条件清理规则，隐藏答案不能残留。
5. 无法识别或版本不兼容的数据不参与评估；回退为空草稿，且不得伪装为历史记录。

### 12.5 清理规则

草稿只在以下情况清理：

1. 用户明确选择“重新开始”并二次确认；
2. 未来服务器已成功创建 Completed Assessment 后，由完成流程显式清理；
3. 本地结构损坏或 schemaVersion 无法迁移。

验证失败、返回评估说明、进入下一页、关闭小程序或网络失败都不得清理草稿。

### 12.6 Phase 2D TypeScript 落地要求

`miniprogram/types/assessment.ts` 必须与本文同版本实现：

- 27 个 `AssessmentQuestionId` 字面量 union；
- `AssessmentAnswerValueMap`，按 question ID 约束答案类型；
- `AssessmentDraftAnswers = Partial<...>`，只以 key 缺失表达未回答；
- 独立的 `AssessmentDraft` 与 `CompletedAssessment` discriminated type；
- `PreferenceRegionAnswer` 对象 union，包含稳定 code 和历史快照；
- 不再使用任意 `questionKey: string`、宽泛 `AnswerValue` 或 `isUncertain`；
- 最小问题规则 registry/validator，至少机器校验年龄整数和 50–110 边界、全部 21 个必填问题、互斥 code、条件题清理和 schemaVersion；
- `validateAssessmentDraftForCompletion` 在 Budget 进入 Profile Skeleton 前聚合校验六步必填原始答案；它只返回校验结果，不创建 `CompletedAssessment`，不生成任何画像或推荐结果；
- 选填文本为空或全空白时必须清除对应 key，不得把空字符串保存成“已回答”。

这是一层数据契约与校验，不是大型表单框架，也不得包含 ADL 计分、硬过滤或推荐权重。

## 13. 匹配证据语义（契约，不是算法）

后续 matching 不得把所有正向选项视为同一强度。TypeScript 需要冻结以下证据类别，但本轮不执行过滤或计分：

| evidenceKind | 含义 | 示例 | 允许直接生成的结论 |
|---|---|---|---|
| `direct_requirement` | 用户明确提出的护理服务需求 | `tube_feeding`, `catheter_care`, `pressure_injury_care`, `night_care`, `dementia_unit` | 可作为对应机构能力硬过滤候选；具体规则后续冻结 |
| `direct_observation` | 用户明确报告的疾病、身体状态或功能事实 | `diagnosed_dementia`, `pressure_injury`, `wheelchair`, `bedridden`, `catheter_or_stoma` | 可形成画像事实；是否提升为硬约束必须由后续显式规则决定 |
| `risk_signal` | 风险或症状信号 | `wandering_risk`, `gets_lost`, `sleep_wake_disorder`, `frequent_hospitalization_within_6_months` | 用于风险解释与规则输入；不能擅自等同某项服务需求 |
| `care_clue` | 需要进一步确认的照护线索 | `special_feeding`, `possible` 康复需求 | 只能提示核对或用于谨慎排序，不能独立触发硬过滤 |
| `preference` | 家庭主观偏好 | 养老类型、关注项、区域、价格关注 | 用于排序和差异说明，不得覆盖护理硬约束 |

关键约束：

1. `cognitive.symptoms: diagnosed_dementia` 可证明“已报告确诊认知症”，但不能自动证明“明确要求认知症专区”；后者必须来自 `cognitive.specialCareNeeds: dementia_unit`。
2. 认知症接收能力、走失风险支持和认知症专区是三个不同机构能力目标，后续规则不得合并。
3. `adl.eating: special_feeding` 只说明特殊进食方式；只有 `cognitive.specialCareNeeds: tube_feeding` 才是明确鼻饲护理需求。
4. `adl.toileting: catheter_or_stoma` 是当前状态事实；`cognitive.specialCareNeeds: catheter_care` 是明确导尿护理需求。
5. `unknown` 和未回答不产生任何正向、负向或硬约束证据。

## 14. 下游匹配能力覆盖

| 后续能力 | 必需 Assessment 输入 | 约束 |
|---|---|---|
| ADL 分级 | `adl.*` 七题 | 规则后续冻结；`unknown` 不计分 |
| 认知症硬条件 | `health.conditions`, `cognitive.symptoms`, `cognitive.specialCareNeeds` | 只用明确证据，不从缺失值推断 |
| 走失风险 | `cognitive.symptoms: wandering_risk/gets_lost` | `wandering_risk` 是直接证据 |
| 鼻饲 | `adl.eating: special_feeding`, `cognitive.specialCareNeeds: tube_feeding` | 后者是明确护理需求；前者仅提示核对 |
| 导尿 | `adl.toileting: catheter_or_stoma`, `cognitive.specialCareNeeds: catheter_care` | 区分生活状态与明确护理需求 |
| 压疮 | `health.recentEvents: pressure_injury`, `cognitive.specialCareNeeds: pressure_injury_care` | 可形成硬性护理需求证据 |
| 夜间护理 | `cognitive.specialCareNeeds: night_care`, `cognitive.symptoms: sleep_wake_disorder` | 明确需求优先，症状仅作解释证据 |
| 康复需求 | `health.rehabilitationNeed`, `health.recentEvents`, `cognitive.specialCareNeeds: rehabilitation_training` | 支持康复排序与理由 |
| 预算匹配 | `budget.monthlyRange`, `preference.priorities: price` | `unknown` 不得当作无限预算 |
| 区域偏好 | `preference.region`, `preference.priorities: close_to_family/transportation` | 只对真实机构区域计算 |
| 用户关注项 | `preference.priorities` | 最多 3 项，用于命名权重和理由主题 |
| NO_EXACT_MATCH | 全部硬性护理输入 + 预算 + 区域 | 不得放宽护理硬约束；必须说明差异 |
| 可解释推荐理由 | 原始答案 + 已核验机构字段 | 每条理由必须追溯到两侧证据 |

### 14.1 明确暂缓的推荐输出契约

Assessment 输入已足以支持后续判断，但以下内容不属于本轮：

- `RecommendationReason` 的稳定 reason code、Assessment evidence reference 和 Institution verified field reference；
- `NO_EXACT_MATCH` 的 `nearMatches`、未满足硬条件、预算差异、区域差异和解释结构。

这些必须在实现推荐算法前通过独立 `RECOMMENDATION_CONTRACT` 冻结。本轮不得用自由文本或临时对象假装完成。

## 15. Phase 2D Assessment 输入冻结边界

冻结链路：

```text
assessment/intro
  → assessment/basic
  → assessment/health
  → assessment/adl
  → assessment/cognitive
  → assessment/preference
  → assessment/budget
  → assessment/profile（仅 Skeleton）
```

冻结条件：

1. Contract、TypeScript、页面选项和 `AssessmentDraft` 对 27 个稳定 question ID、stable code 与状态规则保持一致；
2. Draft 可本地保存、退出、恢复、前后导航、修改并再次保存，且已清理答案不会复活；
3. 进入 Profile Skeleton 前，21 个 required question 均通过统一完成态校验；选填/条件题继续以 key 缺失表示未回答；
4. `preference.region` 只允许页面从当前已核验机构区域目录生成；当前无 `VERIFIED` 区域时只能不作答或保存 `no_preference`，不得写入 Mock 行政区；
5. Profile Skeleton 不读取原始答案生成画像结论，不创建 Completed Assessment，不触发推荐、登录、手机号或 API；
6. 微信开发者工具实际生成六步相关 JavaScript，并通过真机兼容自动检查。

本契约冻结的是原始 Assessment 输入，不是 ElderProfile derivation、ADL classification、Recommendation Contract、Institution Matching 或 Backend。上述下游能力必须在后续阶段分别冻结规则后才能实现。

## 16. Assessment Input Freeze 证据（2026-08-29）

证据必须按来源分层记录，禁止互相替代：

- `AUTOMATED`：正式 `check:assessment-runtime` 直接加载当前 TypeScript 源码，验证 27 个 question ID、21 个 required question、stable code、互斥/条件清理、Draft 恢复、Preference max 3、区域语义和六步完成 Gate；Interaction Runtime Regression 验证六步页面真实 handler、Draft、校验及导航行为。
- `DEVTOOLS`：微信开发者工具 Stable v2.01.2510290 实际执行编译，Errors 0、Warnings 0；TypeScript、WXML、Less、JSON 均由当前项目配置处理。
- `MANUAL_ANDROID_REAL_DEVICE_VERIFICATION`：项目负责人在 Android 17 微信真机确认未完成 Next 可物理触发校验且不导航、Invalid 反馈可见、Valid Next 正常导航、完整六步可以进入 Profile Skeleton，并且正向与反向导航栈正常。该证据不是 ADB，也不是自动化测试。

Freeze 仍只覆盖 Assessment 原始输入与本地开发态 Draft。上述证据不证明 ElderProfile、ADL classification、Recommendation、Institution matching 或 Backend 已实现。
