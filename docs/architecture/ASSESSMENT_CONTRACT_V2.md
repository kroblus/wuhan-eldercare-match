# Assessment Contract V2

状态：`FROZEN_PHASE_V1_1_A`

版本：`assessment-schema-v2`

冻结日期：`2026-09-04`

```text
ASSESSMENT_V2_CONTRACT = FROZEN_PHASE_V1_1_A
ASSESSMENT_SCHEMA_VERSION = 2
QUESTION_COUNT = 32
REQUIRED_COUNT = 26
OPTIONAL_OR_CONDITIONAL_COUNT = 6
ASSESSMENT_STEP_COUNT = 6
ASSESSMENT_V2_RUNTIME = NOT_IMPLEMENTED
PRODUCTION_CODE_CHANGE = 0
```

本文件是 Assessment Schema 2 的自包含正式机器契约。它不修改或覆盖 `ASSESSMENT_CONTRACT.md`：后者文件头仍为 `assessment-schema-v1 / FROZEN_PHASE_2D`；Phase V1.1-A 将其用途分类为 `FROZEN_V1 / HISTORICAL_CONTRACT`，不回写其历史文件头。V1→V2 迁移由 `ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md` 单独冻结。

## 1. Source of Truth and Scope

V2 产品依据：

1. `docs/product/武汉养老机构精准匹配小程序_V1.1_页面级PRD_更新版.pdf`；
2. `docs/product/武汉养老机构精准匹配小程序_MVP页面方案_V1.1_更新版.pdf`；
3. 已批准的 `docs/architecture/V1_1_CHANGE_IMPACT_ANALYSIS.md`；
4. 项目负责人在 Phase V1.1-A 明确批准的 question ID、option code、required、迁移、ADL、吞咽、预算提醒和后续版本边界。

如 Change Impact Analysis 中的早期 proposal code、版本名或待决项与第 4 项冲突，以项目负责人批准决策和本 Contract 为准。该分析保留为影响追溯材料，不是 V2 active machine contract。

本 Contract 只冻结：

- 六步 Assessment 的 32 个 stable question ID；
- 每题类型、required/optional/conditional、stable option code；
- UNANSWERED、unknown、none、no_preference 语义；
- 多选互斥、选择上限、条件展开与清理；
- AssessmentDraft V2 与未来 CompletedAssessment V2 的数据边界；
- downstream intent，不实现 ElderProfile、ADL、Institution 或 Recommendation 规则。

本阶段不实现页面、TypeScript、store、runtime migration、画像、推荐、机构或后端。

## 2. Core Invariants

1. stable question ID 发布后不得改义、复用或根据 UI label 动态生成。
2. 答案只保存 stable English code；中文 label 只用于展示。
3. question key 缺失是 `UNANSWERED`，不得自动补 `normal`、`unknown`、`none` 或 `no_preference`。
4. `unknown` 是用户明确选择“不确定”，不是未回答，也不是否定事实。
5. `none` 是用户明确确认“无”；仅允许在题目 manifest 明确列出的选项中出现。
6. `no_preference` 是用户明确表达“不限制/无特别偏好”，属于有效已回答状态，不等于 unknown。
7. multi-choice 是集合语义：不得重复；`none` 或 `unknown` 与同题具体选项互斥。
8. 条件题失活时必须真实删除旧答案，不能只隐藏 UI。
9. 当前编辑 Draft 与 CompletedAssessment 是不同对象；localDraftId 不是 assessmentId。
10. CompletedAssessment 是不可覆盖历史快照；重新评估必须创建新 Assessment。
11. Assessment 只采集原始答案，不生成 careLevel、ADL score、机构匹配、Recommendation 或正式 identity。
12. 健康、认知和特殊护理数据属于敏感业务数据；不得记录完整答案日志。

## 3. Steps and Progress

V2 继续使用现有六步，不新增页面步骤：

| stepId | Page | Progress | V2 question count |
|---|---|---:|---:|
| `basic` | `pages/assessment/basic` | 1 / 6 | 8 |
| `health` | `pages/assessment/health` | 2 / 6 | 5 |
| `adl` | `pages/assessment/adl` | 3 / 6 | 7 |
| `cognitive` | `pages/assessment/cognitive` | 4 / 6 | 2 |
| `preference` | `pages/assessment/preference` | 5 / 6 | 6 |
| `budget` | `pages/assessment/budget` | 6 / 6 | 4 |

```text
basic -> health -> adl -> cognitive -> preference -> budget
```

## 4. Answer Types and States

| questionType | Contract value | Validation |
|---|---|---|
| `single_choice` | string literal union | exactly one allowed stable code |
| `multi_choice` | stable-code array with set semantics | non-empty when present; unique; mutual-exclusion/max rules apply |
| `text` | string | empty or whitespace-only is UNANSWERED and the key must be removed |
| `integer` | number | finite base-10 integer within the question range |
| `dynamic_single_choice` | discriminated object union | stable code plus display/catalog snapshot |

### 4.1 Four relevant states

```text
question key absent             = UNANSWERED
answer code is unknown          = UNKNOWN, explicitly selected
answer code is none             = NONE, explicitly no listed fact/need
answer code is no_preference    = NO_PREFERENCE, explicitly no constraint
other valid answer              = ANSWERED
```

`UNKNOWN`、`NONE`、`NO_PREFERENCE` 都是用户事实。任何 migration、validator、UI 初始化或 service 不得替用户生成这些值。

## 5. Complete 32-question Manifest

Requirement 值只有：`required`、`optional`、`conditional_optional`。

| # | Step | questionId | Type | Requirement | Condition / validation |
|---:|---|---|---|---|---|
| 1 | basic | `basic.relationship` | `single_choice` | required | allowed code only |
| 2 | basic | `basic.elderName` | `text` | optional | trim for emptiness; preserve non-empty user text |
| 3 | basic | `basic.gender` | `single_choice` | required | allowed code only |
| 4 | basic | `basic.age` | `integer` | required | integer 50–110 inclusive |
| 5 | basic | `basic.livingStatus` | `single_choice` | optional | allowed code only |
| 6 | basic | `basic.primaryCaregiver` | `single_choice` | optional | allowed code only |
| 7 | basic | `basic.hasInstitutionExperience` | `single_choice` | optional | string code `true` or `false` |
| 8 | basic | `basic.institutionExitReasons` | `multi_choice` | conditional_optional | active only when `basic.hasInstitutionExperience === 'true'` |
| 9 | health | `health.conditions` | `multi_choice` | required | `none`/`unknown` mutually exclusive with concrete codes |
| 10 | health | `health.recentEvents` | `multi_choice` | required | `none`/`unknown` mutually exclusive with concrete codes |
| 11 | health | `health.rehabilitationNeed` | `single_choice` | required | `unknown` allowed |
| 12 | health | `health.chewingAbility` | `single_choice` | required | `unknown` allowed; no conditional expansion |
| 13 | health | `health.swallowingAbility` | `single_choice` | required | `unknown` allowed; no conditional expansion |
| 14 | adl | `adl.eating` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 15 | adl | `adl.mobility` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 16 | adl | `adl.toileting` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 17 | adl | `adl.bathing` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 18 | adl | `adl.dressing` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 19 | adl | `adl.transfer` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 20 | adl | `adl.stairs` | `single_choice` | required | `unknown` allowed; raw ADL answer only |
| 21 | cognitive | `cognitive.symptoms` | `multi_choice` | required | `none`/`unknown` mutually exclusive with concrete codes |
| 22 | cognitive | `cognitive.specialCareNeeds` | `multi_choice` | required | `none`/`unknown` mutually exclusive with concrete codes |
| 23 | preference | `preference.careType` | `single_choice` | required | `unknown` allowed |
| 24 | preference | `preference.roomType` | `single_choice` | required | `no_preference` allowed |
| 25 | preference | `preference.mealSchedule` | `single_choice` | required | `no_preference` allowed |
| 26 | preference | `preference.activityPreference` | `single_choice` | required | `no_preference` allowed |
| 27 | preference | `preference.priorities` | `multi_choice` | required | 1–3 unique V2 codes; no none/unknown |
| 28 | preference | `preference.region` | `dynamic_single_choice` | optional | verified catalog region or `no_preference` snapshot |
| 29 | budget | `budget.monthlyRange` | `single_choice` | required | `unknown` allowed |
| 30 | budget | `budget.upfrontCostAcceptance` | `single_choice` | required | `unknown` allowed |
| 31 | budget | `budget.moveInTiming` | `single_choice` | required | allowed code only |
| 32 | budget | `budget.consultantSupport` | `single_choice` | required | contact intent only; no phone authorization |

Manifest checksum:

```text
basic=8
health=5
adl=7
cognitive=2
preference=6
budget=4
total=32

required=3+5+7+2+5+4=26
optional_or_conditional=5+0+0+0+1+0=6
```

## 6. Stable Option Codes

### 6.1 Basic

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

`basic.elderName` 没有 option code；`basic.age` 没有 option code。

### 6.2 Health

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
fall_within_6_months=近半年发生过跌倒
fracture_within_6_months=近半年发生过骨折
frequent_hospitalization_within_6_months=近半年频繁住院
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

`health.chewingAbility`

```text
normal=正常咀嚼
easy_chew=更适合软食、易咀嚼食物
modified_food=咀嚼能力较差，需要对食物做特殊处理
unknown=暂不确定
```

`health.swallowingAbility`

```text
normal=正常
occasional_difficulty=偶尔吞咽不顺或容易呛咳
significant_difficulty=明显吞咽困难
unknown=暂不确定
```

### 6.3 ADL

以下七题只保存原始用户答案，不在 Assessment 中生成分数或等级。

```text
adl.eating:
  independent
  minor_assistance
  needs_feeding
  special_feeding
  unknown

adl.mobility:
  independent
  walking_aid
  wheelchair
  bedridden
  unknown

adl.toileting:
  independent
  occasional_assistance
  frequent_incontinence
  full_assistance
  catheter_or_stoma
  unknown

adl.bathing:
  independent
  partial_assistance
  full_assistance
  unknown

adl.dressing:
  independent
  partial_assistance
  full_assistance
  unknown

adl.transfer:
  independent
  minor_assistance
  needs_support
  fully_dependent
  unknown

adl.stairs:
  independent
  needs_assistance
  unable
  no_stairs
  unknown
```

### 6.4 Cognitive and Special Care

`cognitive.symptoms`

```text
memory_decline=记忆力明显下降
repetitive_questioning=经常重复询问
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

### 6.5 Preference

`preference.careType`

```text
active_aging=活力型养老
medical_nursing_integrated=医养结合
disability_care=失能护理
dementia_care=认知症照护
rehabilitation_care=康复养老
unknown=不确定
```

`preference.roomType`

```text
no_preference=不限制
single=单人间
double=双人间
triple_or_more=三人及以上
```

`preference.mealSchedule`

```text
no_preference=不特别要求
three_meals=三餐
three_meals_one_snack=三餐一点
three_meals_two_snacks=三餐两点
```

`preference.activityPreference`

```text
no_preference=不特别在意
indoor=比较在意室内活动
outdoor=比较在意户外活动
indoor_and_outdoor=室内外活动都比较重要
```

`preference.priorities` V2，最多选择 3 项：

```text
care_capability=护理能力
caregiver_quality=护理人员质量
medical_conditions=医疗条件
rehabilitation_capability=康复条件
food_quality=膳食质量
living_environment=居住环境
room_facilities=房间设施
activity_space=活动空间
transportation=交通便利
near_major_hospital=靠近大型医院
price=价格预算
region=地理位置
```

`preference.region` 没有武汉全量静态 option list。有效答案形状：

```text
{
  kind: 'no_preference',
  regionCode: 'no_preference',
  regionLabelSnapshot: '不限制',
  catalogVersion: non-empty string
}

{
  kind: 'institution_region',
  regionCode: stable verified catalog code,
  regionLabelSnapshot: non-empty display snapshot,
  catalogVersion: non-empty string
}
```

区域选项只来自当前真实合作机构数据的已核验区域。Mock 行政区不得伪装为真实可选项；历史答案保留作答时 label/catalog snapshot，当前匹配只读取 stable regionCode。

### 6.6 Budget

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
avoid_high_one_time_fee=不希望存在较高一次性费用
unknown=不清楚
```

`budget.moveInTiming`

```text
as_soon_as_possible=希望尽快入住
within_1_month=1 个月以内
within_1_to_3_months=1–3 个月
after_3_months=3 个月以后
research_only=目前只是提前了解
```

`budget.consultantSupport`

```text
request_contact=希望顾问联系我
recommendation_first=先看推荐结果
```

`request_contact` 只表达意愿。本页不立即获取手机号，不触发登录、授权、网络或顾问任务。

## 7. Required and Optional Orders

### 7.1 Required question order

完成态校验与全局首错定位必须使用以下稳定顺序：

```text
basic.relationship
basic.gender
basic.age
health.conditions
health.recentEvents
health.rehabilitationNeed
health.chewingAbility
health.swallowingAbility
adl.eating
adl.mobility
adl.toileting
adl.bathing
adl.dressing
adl.transfer
adl.stairs
cognitive.symptoms
cognitive.specialCareNeeds
preference.careType
preference.roomType
preference.mealSchedule
preference.activityPreference
preference.priorities
budget.monthlyRange
budget.upfrontCostAcceptance
budget.moveInTiming
budget.consultantSupport
```

### 7.2 Optional or conditional questions

```text
basic.elderName
basic.livingStatus
basic.primaryCaregiver
basic.hasInstitutionExperience
basic.institutionExitReasons   # conditional_optional
preference.region
```

Optional key 缺失不阻止 completion；一旦存在就必须通过同题类型、code、条件和结构校验。

## 8. Mutual Exclusion, Conditions and Cleanup

| Stable rule ID | Trigger | Required behavior |
|---|---|---|
| `basic-experience-reasons-v2` | `basic.hasInstitutionExperience === 'true'` | `basic.institutionExitReasons` active but optional |
| `basic-experience-clear-v2` | experience is `false` or UNANSWERED | delete `basic.institutionExitReasons` from Draft |
| `health-condition-exclusive-v2` | selecting `none` or `unknown` | remove every other `health.conditions` code; selecting a concrete code removes `none` and `unknown` |
| `health-event-exclusive-v2` | selecting `none` or `unknown` | remove every other `health.recentEvents` code; selecting a concrete code removes `none` and `unknown` |
| `cognitive-symptom-exclusive-v2` | selecting `none` or `unknown` | remove every concrete symptom; selecting a concrete code removes `none` and `unknown` |
| `special-care-exclusive-v2` | selecting `none` or `unknown` | remove every concrete care need; selecting a concrete code removes `none` and `unknown` |
| `priority-limit-v2` | three priorities already selected | reject a fourth addition; cancellation remains available; never save >3 |
| `region-source-v2` | region selector opens | load only currently verified catalog regions plus explicit no-preference option |

Single-choice `unknown` and `no_preference` are naturally exclusive because the answer has exactly one code. The five new questions create no conditional child question.

Cleanup is a Draft business mutation, not visual-only state. A cleared code must not reappear after page re-entry or app restart.

## 9. AssessmentDraft V2 Boundary

V2 客户端草稿的规范形状如下。这里是数据契约，不是本阶段的 TypeScript/runtime 实现：

```ts
type AssessmentSchemaVersionV2 = 2

type AssessmentStepId =
  | 'basic'
  | 'health'
  | 'adl'
  | 'cognitive'
  | 'preference'
  | 'budget'

interface AssessmentDraftV2 {
  kind: 'assessment_draft'
  schemaVersion: AssessmentSchemaVersionV2
  localDraftId: string
  persistence: 'LOCAL_DEVICE_DEVELOPMENT_ONLY'
  currentStep: AssessmentStepId
  answers: Partial<AssessmentAnswerValueMapV2>
  startedAt: string
  updatedAt: string
  migrationNotice?: AssessmentMigrationNoticeV2
}
```

`AssessmentAnswerValueMapV2` 是第 5 节每个 question ID 到第 4、6 节对应 value type/allowed code 的精确映射，不允许开放字符串或文档外 code。本阶段只冻结该映射，不在生产 TypeScript 中声明它。

约束：

1. `localDraftId` 只标识客户端编辑草稿，永远不是 `assessmentId`、`elderId` 或 Recommendation identity。
2. `startedAt`、`updatedAt` 必须是有效 ISO 8601 timestamp；它们描述草稿元数据，不改变答案语义。
3. `answers` 可部分存在；只要 key 存在，其值就必须符合本 Contract。
4. 原生 V2 草稿可以直接恢复；V1 草稿必须先通过 `ASSESSMENT_V1_TO_V2_MIGRATION_CONTRACT.md` 的纯迁移边界。
5. restore、migration、页面初始化均不得给未回答题目填业务默认值。
6. `migrationNotice` 是迁移 provenance，不是 AssessmentAnswer，不得参与画像、推荐或 completion 判定。
7. V2 persistence 的实现仍属于后续 Phase；本 Contract 不改变当前本地开发态存储政策，也不承诺服务器持久化。

### 9.1 `currentStep` semantics remain unchanged

`currentStep` 继续表示最近一次已成功校验并保存的步骤进度标记，不表示当前可见页面，也不自动等于“继续填写”应跳转的 route。V1→V2 migration 必须原样保留该字段，不得因为新增 required question 伪造一个新的完成进度。

V2 的“第一个未完成问题”必须依据第 7.1 节的 required order 动态推导。对一个原本完整的 V1 Draft，迁移后第一个 required error 是 `health.chewingAbility`；如果两项新增 health 答案已补齐而 V1 priority 含歧义 code，则相应第一个 preference error 是 `preference.roomType`，随后依次为 `preference.mealSchedule`、`preference.activityPreference`、`preference.priorities`。

未来若产品要求 Continue 直接进入第一个未完成步骤，Phase V1.1-B 必须单独冻结 resume-route 行为；不得通过重新解释 `currentStep` 偷偷实现，也不在本 Contract 新增 `resumeStep`。

## 10. CompletedAssessment Version Boundary

未来 V2 完成态必须是独立的、不可变的历史快照：

```ts
interface CompletedAssessmentV2 {
  kind: 'completed_assessment'
  id: string
  elderId: string
  status: 'completed'
  schemaVersion: 2
  answers: CompleteAssessmentAnswerValueMapV2
  completedAt: string // valid ISO 8601 timestamp
}
```

`CompleteAssessmentAnswerValueMapV2` 必须包含全部 26 个 required question，optional/conditional answer 则在存在时通过正式校验。创建 CompletedAssessment V2 前必须通过全量 completion validation；Draft 不得通过类型断言或补默认值伪装成 completed。

已经存在的 `CompletedAssessment` Schema V1 保持不可变、可重放、可审计：

```text
HISTORICAL_COMPLETED_ASSESSMENT_V1 = IMMUTABLE
COMPLETED_ASSESSMENT_V1_POLICY = IMMUTABLE_HISTORICAL_RECORD
COMPLETED_ASSESSMENT_V1_MIGRATION = FORBIDDEN
```

V1 历史记录继续由 Assessment Schema 1 与 ElderProfile V1 rules 解释。需要采用 V2 问题时必须创建新的 V2 Assessment，禁止覆盖、重写或补齐历史 V1 完成记录。

## 11. Completion Validation and First Error

V2 completion validator 必须 deterministic，并返回 stable question ID：

```ts
interface AssessmentCompletionValidationResultV2 {
  valid: boolean
  invalidQuestionIds: readonly RequiredAssessmentQuestionIdV2[]
  firstInvalidQuestionId?: RequiredAssessmentQuestionIdV2
}
```

规则：

1. 按第 7.1 节顺序逐题检查 26 个 required answer；不可按对象 key 插入顺序决定首错。
2. required single-choice 的显式 `unknown` 或 `no_preference` 在该题允许时是有效回答。
3. required multi-choice 必须至少一项、无重复、全为允许 code，并满足互斥/上限规则。
4. optional/conditional answer 缺失不阻止完成；存在的非法 optional answer 仍必须拒绝。
5. inactive conditional answer 若残留，必须在 completion 前清理或拒绝，不能被静默当成有效事实。
6. 校验只证明 Assessment input 完整合法，不生成 ADL 等级、ElderProfile 或 Recommendation。

现有 `WECHAT_INTERACTION_CONTRACT.md` 的 Next/Back、首错近端提示与首错可见机制继续适用；V2 只增加需要接入同一机制的 question ID。

## 12. ADL and Swallowing Boundaries

### 12.1 ADL remains frozen

七个 ADL question ID、option code 与原始答案语义完全沿用 V1：

```text
ADL_QUESTION_SET_CHANGE = FALSE
ADL_RULESET_VERSION_BUMP_REQUIRED = FALSE
ADL_ASSESSMENT_INPUT = UNCHANGED
ADL_RULESET = adl-ruleset-v1
ADL_SCORE_IN_ASSESSMENT = FORBIDDEN
CARE_LEVEL_IN_ASSESSMENT = FORBIDDEN
```

本 Contract 不修改已冻结 ADL derivation；新增咀嚼/吞咽题不得参与 ADL 分数或 careLevel。

### 12.2 Swallowing semantics

`health.swallowingAbility === 'significant_difficulty'` 表示用户报告明显吞咽困难。V1.1 边界为：

- 它是后续营养/吞咽事实及 clarification signal；
- 它不阻止 Assessment completion；
- 它不阻止 ElderProfile derivation；
- 它不改变 ADL 或 careLevel；
- 它不能等同或推导为 `cognitive.specialCareNeeds = tube_feeding`；
- 只有用户在特殊护理题显式选择 `tube_feeding`，才构成鼻饲直接需求。
- meal texture 在 V1.1 只允许作为可解释展示事实，不产生 matching score、hard filter 或 eligibility 变化。

```text
MEAL_TEXTURE_MATCHING_ROLE = DISPLAY_EXPLAINABLE_V1_1
SWALLOWING_HARD_FILTER = NOT_IMPLEMENTED_V1_1
```

## 13. Preference and Future Recommendation Boundary

`preference.priorities` V2 保存的只是用户关注项，不能在 Assessment 层预先计分、过滤或排序。

- `transportation` 与 `near_major_hospital` 在 V1.1 为 `NOT_YET_SCORABLE_V1_1`；可以保存和展示，不得伪造距离、路线或医院数据参与评分。
- 新增 room、meal、activity preference 只形成原始答案；后续是否进入 Institution matching 必须由独立版本化契约决定。
- care hard constraint 永远优先于主观 preference；Assessment 不实现该优先级算法。

未来 Recommendation 大版本命名已批准但不在本阶段实现：

```text
NEAR_MAJOR_HOSPITAL_PRIORITY = NOT_YET_SCORABLE_V1_1
TRANSPORTATION_PRIORITY = NOT_YET_SCORABLE_V1_1
RECOMMENDATION_CONTRACT_V1_1_NAME = REJECTED
FUTURE_RECOMMENDATION_CONTRACT = recommendation-contract-v2
FUTURE_RECOMMENDATION_RULESET = recommendation-ruleset-v2
RECOMMENDATION_SAFETY_POLICY = conservative-exact-with-conditional-v1
```

禁止使用 `recommendation-contract-v1.1`。现有冻结 Recommendation Contract/Ruleset 本阶段不修改；在 V2 Recommendation runtime 发布前，V2 priority 不得被别名转换、静默忽略或送入 V1 ranking。

## 14. High-care Low-budget Advisory Intent

产品文案中的 `budget.monthlyBudget == 3500_5000` 必须规范化为当前 stable answer：

```text
questionId = budget.monthlyRange
answerCode = cny_3500_5000
```

“高照护”候选条件仅记录为 downstream advisory intent：

- 后续正式 derivation 得出 `disabled` 或 `severely_disabled`；或
- 用户明确选择 `round_the_clock_care`、`one_to_one_caregiver`、`tube_feeding`、`pressure_injury_care` 中至少一项。

当且仅当上述高照护条件与 `budget.monthlyRange === 'cny_3500_5000'` 同时成立，后续层可以展示中性的费用沟通提醒。该 intent：

- 不阻止 Assessment completion；
- 不改变 ADL/careLevel；
- 不改变机构 eligibility；
- 不声称 3500 元是市场最低价；
- budget 为 `unknown` 或 UNANSWERED 时不触发；
- 本阶段不实现提示 UI、ElderProfile 字段或 Recommendation 行为。

```text
HIGH_CARE_LOW_BUDGET = ADVISORY_ONLY
```

## 15. Interaction Contract Status

```text
WECHAT_INTERACTION_CONTRACT = FROZEN_V1_UNCHANGED
ASSESSMENT_INPUT_SYSTEM_V1 = FROZEN
ASSESSMENT_INTERACTION_SYSTEM_V1 = FROZEN
ASSESSMENT_V2_RUNTIME = NOT_IMPLEMENTED
```

Phase V1.1-A 不改变 Action 通道、NavigationGuard、Back/Next、validation timing、首错滚动或 Android 真机证据状态。未来 V2 页面接入必须复用现有单一 Action 与错误定位机制，并重新执行该阶段自己的 automated、DevTools 和 manual real-device gates。

## 16. Phase and System Boundaries

- Phase 4C-2 Recommendation Result UI 继续保持 V1 implementation；本阶段不将其宣称为 V1.1 frozen，也不执行 Android freeze。
- Assessment V2 Contract 不修改 ElderProfile、Anonymous Preview、Institution、Recommendation 或 safety policy 的冻结业务语义。
- Production page/component/store/service/domain change：`0`。
- 本阶段不实现 migration runtime、V2 TypeScript types、V2 validator、local persistence、backend schema 或 API。
- 不触发 `wx.login`、手机号授权、`wx.request`，不处理 AppID、Secret 或 private config。

```text
PHASE_4C_2_IMPLEMENTATION = FUNCTIONALLY_COMPLETE_AGAINST_V1_BASELINE
PHASE_4C_2_FREEZE = DEFERRED_BY_V1_1_PRODUCT_CHANGE
ANDROID_GATE = DEFERRED
```

## 17. Phase V1.1-B Entry Conditions

下一阶段若获批准，必须以本 Contract 和迁移 Contract 为唯一输入，最小实现：

1. V2 TypeScript manifest/types 与 deterministic validator；
2. V1 Draft→V2 Draft 纯迁移及 fixture；
3. 现有五个新增问题的页面接入与同一 AssessmentDraft 状态；
4. 首错顺序、Continue/resume 行为的显式产品决定；
5. 全量 runtime、Interaction、WeChat compatibility、DevTools 与 Android 真机 Gate。

在这些 entry conditions 未独立通过前，不得把 Assessment V2 标记为 runtime complete 或替代 V1 frozen baseline。
