# ADL Rule Contract V1

状态：`FROZEN_V1`

产品决策：`PRODUCT_OWNER_DECISION = PROPOSAL_C`

Ruleset：`adl-ruleset-v1`

本文件是七项 ADL 原始答案到生活功能等级与照护模式的唯一生产规则。`ADL_RULE_PROPOSAL.md` 保留 A/B/C 方案历史，但不再是运行时规则来源。

## 1. Scope

输入只包含七个冻结 Assessment answer：

```text
adl.eating
adl.mobility
adl.toileting
adl.bathing
adl.dressing
adl.transfer
adl.stairs
```

输出固定包含：

```text
careLevel
careModes
observationCoverage
unknownQuestionIds
evidence
clarifications
```

`careLevel` 只表达生活功能依赖等级；`careModes` 保存不同照护方式和上下文。禁止分数、LLM、机构数据或医学诊断。

## 2. Stable Mapping

| question | option code | functional contribution | care mode |
|---|---|---|---|
| eating | `independent` | none | none |
| eating | `minor_assistance` | light | `feeding_minor` |
| eating | `needs_feeding` | dependent floor | `feeding_dependence` |
| eating | `special_feeding` | nonordinal, neutral | `special_feeding_review` / needs confirmation |
| eating | `unknown` | blocks careLevel | none |
| mobility | `independent` | none | none |
| mobility | `walking_aid` | light | `walking_aid` |
| mobility | `wheelchair` | half floor | `wheelchair` |
| mobility | `bedridden` | severe override | `bedridden` |
| mobility | `unknown` | blocks careLevel | none |
| toileting | `independent` | none | none |
| toileting | `occasional_assistance` | light | `toileting_minor` |
| toileting | `frequent_incontinence` | half floor | `incontinence` |
| toileting | `full_assistance` | dependent floor | `toileting_full_assistance` |
| toileting | `catheter_or_stoma` | nonordinal, neutral | `catheter_or_stoma_review` / needs confirmation |
| toileting | `unknown` | blocks careLevel | none |
| bathing | `independent` | none | none |
| bathing | `partial_assistance` | light | `bathing_partial` |
| bathing | `full_assistance` | half floor | `bathing_full_assistance` |
| bathing | `unknown` | blocks careLevel | none |
| dressing | `independent` | none | none |
| dressing | `partial_assistance` | light | `dressing_partial` |
| dressing | `full_assistance` | half floor | `dressing_full_assistance` |
| dressing | `unknown` | blocks careLevel | none |
| transfer | `independent` | none | none |
| transfer | `minor_assistance` | light | `transfer_minor` |
| transfer | `needs_support` | half floor | `transfer_support` |
| transfer | `fully_dependent` | severe override | `fully_dependent_transfer` |
| transfer | `unknown` | blocks careLevel | none |
| stairs | `independent` | none | none |
| stairs | `needs_assistance` | light | `stairs_assistance` |
| stairs | `unable` | half floor | `stairs_unable` |
| stairs | `no_stairs` | not applicable, neutral | `no_stairs_context` |
| stairs | `unknown` | blocks careLevel | none |

## 3. Classification Order

实现必须严格依次执行：

1. `C_INPUT_GATE`：七 key 全部存在且 option 合法；缺 key → `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE`，非法值 → `INVALID_ADL_ANSWER_NOT_DERIVABLE`。
2. `C_PROJECT_CARE_MODES`：按七题顺序投影 care mode；independent/unknown 不生成 mode。
3. `C_OBSERVATION_COVERAGE`：按 `special_feeding`、`catheter_or_stoma`、`no_stairs`、unknown 建立 coverage issues。
4. `C_UNKNOWN_BLOCK`：任一 unknown 时返回 unknown careLevel，不运行等级候选规则。
5. `C_SEVERE_OVERRIDE`：bedridden 或 transfer fully_dependent → severely_disabled。
6. `C_DEPENDENT_FLOOR`：eating needs_feeding 或 toileting full_assistance → 至少 disabled。
7. `C_TWO_HALF_ESCALATION`：两个及以上不同题命中 half floor，且至少一个来自 eating/mobility/toileting/transfer → disabled。
8. `C_NON_CORE_HALF_FALLBACK`：两个及以上 half floor 全部来自 bathing/dressing/stairs → semi_disabled。
9. `C_HALF_FLOOR`：其余任一 half floor → semi_disabled。
10. `C_TWO_LIGHT_ESCALATION`：两个及以上 light → semi_disabled；一个 → light_care；零个 → independent。

批准的 half-floor options：

```text
adl.mobility=wheelchair
adl.toileting=frequent_incontinence
adl.bathing=full_assistance
adl.dressing=full_assistance
adl.transfer=needs_support
adl.stairs=unable
```

批准的 half core set 名义上包含 eating/mobility/toileting/transfer；当前 eating 没有 half-floor option，禁止擅自将 `minor_assistance` 提升为 half floor。

批准的 light options：

```text
adl.eating=minor_assistance
adl.mobility=walking_aid
adl.toileting=occasional_assistance
adl.bathing=partial_assistance
adl.dressing=partial_assistance
adl.transfer=minor_assistance
adl.stairs=needs_assistance
```

## 4. Unknown, Nonordinal and Not-applicable

### 4.1 Unknown

任一 ADL required answer=`unknown`：

- `careLevel.status=unknown`；
- `confidence=needs_confirmation`；
- 不得产生 value 或 candidateValue；
- `observationCoverage.status=unknown`；
- issues 同时保留 `unknown_input` 与其它 coverage issue；
- `unknownQuestionIds` 按七题顺序列出；
- 已知题的 careModes 继续保留；
- 每个 unknown 产生 `unknown_answer` clarification，priority=`required_before_classification`。

### 4.2 Special feeding

`special_feeding`：

- 对 careLevel 中性；
- mode=`special_feeding_review`，status=`needs_confirmation`；
- coverage issue=`special_feeding_non_ordinal`；
- coverage limited，确定 careLevel confidence=medium；
- 生成 `non_ordinal_adl_answer` clarification；
- 不等于 tube feeding，不直接生成 capability required。

### 4.3 Catheter or stoma

`catheter_or_stoma` 与 special feeding 同理，mode=`catheter_or_stoma_review`，issue=`catheter_or_stoma_non_ordinal`；不等于 catheter care。

### 4.4 No stairs

`no_stairs` 表示未观察/不适用：

- 对 careLevel 无正负贡献；
- mode=`no_stairs_context`，status=`context`；
- issue=`stairs_not_applicable`；
- coverage limited，确定 careLevel confidence=medium；
- 不生成能力不足 clarification。

### 4.5 Coverage and confidence

- 无 issue：coverage complete，确定 careLevel confidence high；
- 无 unknown 但有非序数/不适用 issue：coverage limited，confidence medium；
- 有 unknown：coverage unknown，confidence needs_confirmation。

Coverage issues 的稳定顺序为：`special_feeding_non_ordinal`、`catheter_or_stoma_non_ordinal`、`stairs_not_applicable`、`unknown_input`。`unknownQuestionIds` 与 careModes 均按七题顺序。

## 5. Evidence and Clarification

每个 careLevel 和每个 careMode 均有 evidence。careLevel evidence 引用所有实际影响规则、限制 confidence 或阻断结论的 ADL option；不引用 unrelated options 凑来源。

规则 ID 固定使用：

```text
adl-ruleset-v1:C_UNKNOWN_BLOCK
adl-ruleset-v1:C_SEVERE_OVERRIDE
adl-ruleset-v1:C_DEPENDENT_FLOOR
adl-ruleset-v1:C_TWO_HALF_ESCALATION
adl-ruleset-v1:C_NON_CORE_HALF_FALLBACK
adl-ruleset-v1:C_HALF_FLOOR
adl-ruleset-v1:C_TWO_LIGHT_ESCALATION
adl-ruleset-v1:C_NO_BURDEN
adl-ruleset-v1:C_PROJECT_CARE_MODE
adl-ruleset-v1:C_NO_STAIRS_NEUTRAL
```

`no_stairs_context` careMode 使用 `C_NO_STAIRS_NEUTRAL`；careLevel 仍使用实际命中的 functional rule（例如 otherwise-independent 为 `C_NO_BURDEN`），并把 no-stairs source 标为 `excluded_not_applicable`。

Contribution 固定映射：

| source role | contribution |
|---|---|
| severe override option | `overrides` |
| dependent / half / light / independent functional option | `supports` |
| ADL unknown | `requires_clarification` |
| special feeding / catheter-stoma 对 careLevel coverage | `limits_confidence` |
| special feeding / catheter-stoma 对其 review careMode | `requires_clarification` |
| no-stairs 对 careLevel 与 context mode | `excluded_not_applicable` |
| ordinary reported careMode | `supports` |

非序数/不适用 source 使用 `limits_confidence` 或 `excluded_not_applicable`。所有 ID 必须 deterministic，不能使用时间或随机数。

## 6. C01-C21 Normative Fixtures

除表中列出的非 independent 值外，其余题均为 independent。

| ID | non-default input | expected careLevel | expected rule / boundary |
|---|---|---|---|
| C01 | none | independent | `C_NO_BURDEN` |
| C02 | bathing partial_assistance | light_care | one light |
| C03 | mobility walking_aid + bathing partial_assistance | semi_disabled | `C_TWO_LIGHT_ESCALATION` |
| C04 | mobility wheelchair | semi_disabled | `C_HALF_FLOOR` |
| C05 | eating needs_feeding | disabled | `C_DEPENDENT_FLOOR` |
| C06 | eating special_feeding | independent / medium | nonordinal neutral + review |
| C07 | mobility bedridden | severely_disabled | `C_SEVERE_OVERRIDE` |
| C08 | transfer fully_dependent | severely_disabled | `C_SEVERE_OVERRIDE` |
| C09 | toileting full_assistance | disabled | `C_DEPENDENT_FLOOR` |
| C10 | toileting catheter_or_stoma | independent / medium | nonordinal neutral + review |
| C11 | stairs no_stairs | independent / medium | neutral context |
| C12a | mobility walking_aid + bathing partial_assistance | semi_disabled | two light |
| C12b | eating special_feeding | independent / medium | distinct second axis |
| C13a | mobility wheelchair | semi_disabled | wheelchair mode |
| C13b | toileting frequent_incontinence | semi_disabled | incontinence mode |
| C14 | bathing unknown | unknown | `C_UNKNOWN_BLOCK` |
| C15 | missing transfer key | reject | `INCOMPLETE_ASSESSMENT_NOT_DERIVABLE` |
| C16 | toileting frequent_incontinence + transfer needs_support | disabled | `C_TWO_HALF_ESCALATION` |
| C17 | mobility walking_aid | light_care | one light |
| C18 | mobility wheelchair + bathing full_assistance | disabled | `C_TWO_HALF_ESCALATION` |
| C19 | mobility wheelchair + toileting frequent_incontinence + transfer needs_support | disabled | no severe override |
| C20 | toileting/bathing/dressing full_assistance + transfer fully_dependent | severely_disabled | severe override |
| C21 | bathing + dressing full_assistance | semi_disabled | `C_NON_CORE_HALF_FALLBACK` |

`C12a/C12b` 与 `C13a/C13b` 是同一比较案例的两个独立 fixture；运行时必须全部断言，不能只覆盖表格行数。

## 7. Determinism and Boundaries

同一输入运行两次必须 deep-equal。Classifier 只使用 pure function，不读 Store/Page/Institution/Recommendation/时间/网络/随机数。

禁止：

- 在 raw answers 或 Draft 中写入五档等级或 score；
- 以 careLevel 推导疾病、鼻饲、导尿、认知症、压疮或机构接收；
- 省略 special-feeding、catheter/stoma、no-stairs care mode；
- 将 unknown 当 independent；
- 将 careModes 合并成自由文本标签。
