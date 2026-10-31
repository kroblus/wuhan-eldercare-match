import type { z } from 'zod';
import type { reportSchema } from '../api/schema';
import type { DemoState } from './types';

export type Report = z.infer<typeof reportSchema>['report'];
export type ReportFilters = {
  from: string;
  to: string;
  institutionId?: string | null;
  source?: string | null;
};
const sources = ['MINIPROGRAM', 'OFFLINE_MANUAL', 'SELF_TEST', 'SYNTHETIC_TEST_ONLY'];
const contactResults = ['CONNECTED', 'NO_ANSWER', 'REFUSED'];
const feedbackSources = ['FAMILY', 'INSTITUTION', 'CONSULTANT'];
const rules = [
  '所有日期采用北京时间，开始日00:00至结束日次日00:00，半开区间；生成时刻为观察截止日。',
  '新需求按创建时间计数并按request_id去重。不是老人或家庭总人数；平台去重数不可由机构行相加。',
  '同批需求指筛选期间创建且截止生成时已存在的关联需求。到访/接通/反馈转化均以这同一批需求为分母；分母0时无可用比率。',
  '期间联系/确认/改期按记录事件发生时间，到访/未到访按明确填报的实际时间；与同批需求转化分开。',
  '确认场次只计首次双方确认事件，改期单列；重复操作不重复。到访场次与去重到访需求分别统计。',
  '机构关联采用生成时明确选择的目标或独立看院记录。关联需求的联系记录可能在多家机构报告中出现，不可相加为平台总数。',
  '单机构仅包含本机构的看院和有来源反馈；带看意向需求为关联需求的申请类型，不是该机构承诺的接待能力。',
  '入住反馈必须注明家属/机构/顾问来源，未知另列；不推断入住、不表示签约或收入。无访问埋点，不报告UV/PV。',
  '区域/预算/年龄/日常协助未结构化采集，保持未采集。服务场景任一非零类别不足5条时整维抑制，不输出敏感交叉组合。',
  '仅聚合数据，无个人或隐藏明细。合成、员工自测、线下和小程序来源分别计数；公开演示均为合成数据，不代表真实获客。',
  '预览和Excel读取同一浏览器持久化聚合快照。业务变化后请重新生成；报告读取同一次本地事务的数据。',
];

/** Same aggregate-v2-k5 definitions as P1Reports; operates on the complete local dataset. */
export function buildReport(state: DemoState, filters: ReportFilters, now = new Date()): Report {
  const low = Date.parse(`${filters.from}T00:00:00+08:00`);
  const end = Date.parse(`${filters.to}T00:00:00+08:00`);
  const high = end + 86_400_000;
  const cutoff = now.getTime();
  const institution = filters.institutionId || null;
  const source = filters.source || null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(filters.from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(filters.to) ||
    !Number.isFinite(low) ||
    !Number.isFinite(end) ||
    !Number.isFinite(cutoff) ||
    low >= high ||
    high - low > 3660 * 86_400_000 ||
    new Date(low + 8 * 3_600_000).toISOString().slice(0, 10) !== filters.from ||
    new Date(end + 8 * 3_600_000).toISOString().slice(0, 10) !== filters.to ||
    (institution !== null && !state.institutions[institution]) ||
    (source !== null && !sources.includes(source))
  )
    throw new Error('INVALID_FILTER');
  const during = (at: string | null | undefined) =>
    at != null && Date.parse(at) >= low && Date.parse(at) < high;
  const observed = (at: string | null | undefined) => at != null && Date.parse(at) <= cutoff;
  const requests = Object.values(state.requests).filter(
    ({ item }) =>
      item.datasetMode === 'SYNTHETIC_TEST_ONLY' && (source === null || item.source === source),
  );
  const associated = (id: string | null) =>
    requests.filter(
      ({ item }) =>
        id === null || item.institutionId === id || item.visits.some((v) => v.institutionId === id),
    );
  const institutionName = (id: string) => {
    const draft = state.institutions[id]?.draft;
    const name = draft?.record?.identity.name?.value;
    return draft?.publicProfile?.name || (typeof name === 'string' ? name : `合成演示机构 ${id}`);
  };
  const aggregate = (selected: typeof requests, id: string | null): Report['metrics'] => {
    const cohort = new Set(
      selected
        .filter(({ item }) => during(item.createdAt) && observed(item.createdAt))
        .map(({ item }) => item.id),
    );
    const m = {
      newRequests: cohort.size,
      visitIntentRequests: 0,
      contactEvents: 0,
      connectedEvents: 0,
      noAnswerEvents: 0,
      refusedEvents: 0,
      confirmedSessions: 0,
      rescheduledEvents: 0,
      arrivedSessions: 0,
      arrivedRequests: 0,
      noShowSessions: 0,
      cancelledSessions: 0,
      movedInFeedbackEvents: 0,
      notMovedInFeedbackEvents: 0,
      unknownFeedbackEvents: 0,
      cohortDenominator: cohort.size,
      cohortContactedRequests: 0,
      cohortArrivedRequests: 0,
      cohortMovedInRequests: 0,
      cohortArrivalRate: null as number | null,
    };
    const contacted = new Set<string>(),
      moved = new Set<string>(),
      arrived = new Set<string>(),
      cohortArrived = new Set<string>();
    for (const { item, events, visitUpdatedAt } of selected) {
      if (cohort.has(item.id) && item.kind === 'VISIT_INTENT') m.visitIntentRequests++;
      for (const event of events) {
        if (!observed(event.occurredAt)) continue;
        const period = during(event.occurredAt),
          details = event.details;
        if (event.type === 'FOLLOWUP') {
          if (contactResults.includes(details?.result ?? '')) {
            if (period) {
              m.contactEvents++;
              if (details?.result === 'CONNECTED') m.connectedEvents++;
              else if (details?.result === 'NO_ANSWER') m.noAnswerEvents++;
              else m.refusedEvents++;
            }
            if (details?.result === 'CONNECTED' && cohort.has(item.id)) contacted.add(item.id);
          } else if (
            feedbackSources.includes(details?.feedbackSource ?? '') &&
            (id === null || details?.institutionId === id)
          ) {
            if (period) {
              if (details?.result === 'MOVED_IN') m.movedInFeedbackEvents++;
              else if (details?.result === 'NOT_MOVED_IN') m.notMovedInFeedbackEvents++;
              else if (details?.result === 'UNKNOWN_FEEDBACK') m.unknownFeedbackEvents++;
            }
            if (details?.result === 'MOVED_IN' && cohort.has(item.id)) moved.add(item.id);
          }
        } else if (period && (id === null || details?.institutionId === id)) {
          if (event.type === 'VISIT_CONFIRM') m.confirmedSessions++;
          if (event.type === 'VISIT_RESCHEDULE') m.rescheduledEvents++;
        }
      }
      for (const visit of item.visits) {
        if (id !== null && visit.institutionId !== id) continue;
        if (visit.status === 'ARRIVED' && observed(visit.actualAt)) {
          if (during(visit.actualAt)) {
            m.arrivedSessions++;
            arrived.add(item.id);
          }
          if (cohort.has(item.id)) cohortArrived.add(item.id);
        }
        if (visit.status === 'NO_SHOW' && during(visit.actualAt) && observed(visit.actualAt))
          m.noShowSessions++;
        if (visit.status === 'CANCELLED') {
          // The local event is the durable equivalent of p1_visit.updated_at.
          const updated = visitUpdatedAt[visit.id];
          if (during(updated) && observed(updated)) m.cancelledSessions++;
        }
      }
    }
    m.arrivedRequests = arrived.size;
    m.cohortContactedRequests = contacted.size;
    m.cohortArrivedRequests = cohortArrived.size;
    m.cohortMovedInRequests = moved.size;
    m.cohortArrivalRate = cohort.size === 0 ? null : cohortArrived.size / cohort.size;
    return m;
  };
  const selected = associated(institution),
    metrics = aggregate(selected, institution);
  const ids = new Set<string>();
  for (const { item } of requests) {
    if (item.institutionId) ids.add(item.institutionId);
    for (const visit of item.visits) ids.add(visit.institutionId);
  }
  const institutions =
    institution !== null
      ? [{ institutionName: institutionName(institution), metrics: { ...metrics } }]
      : [...ids]
          .sort()
          .map((id) => ({
            institutionName: institutionName(id),
            metrics: aggregate(associated(id), id),
          }))
          .filter((row) => Object.values(row.metrics).some((value) => value !== null && value > 0));
  const cohort = selected.filter(({ item }) => during(item.createdAt) && observed(item.createdAt));
  const profiles: Report['profiles'] = ['区域', '预算段', '年龄段', '日常协助'].map(
    (dimension) => ({
      dimension,
      category: '未采集',
      count: cohort.length,
      note: '未读取旧问卷，不推断或补造',
    }),
  );
  const scenarios = new Map<string, number>();
  for (const { item } of cohort) {
    const key = item.serviceScenario ?? 'UNDECIDED';
    scenarios.set(key, (scenarios.get(key) ?? 0) + 1);
  }
  if ([...scenarios.values()].some((count) => count > 0 && count < 5))
    profiles.push({
      dimension: '服务场景',
      category: '小样本分布已抑制',
      count: null,
      note: '任一非零分类少于5条时，整维不展示分类数量；不输出交叉画像',
    });
  else if (scenarios.size === 0)
    profiles.push({
      dimension: '服务场景',
      category: '暂无需求',
      count: 0,
      note: '分母为0，无可用占比',
    });
  else
    for (const [category, count] of [...scenarios].sort(([a], [b]) => a.localeCompare(b)))
      profiles.push({
        dimension: '服务场景',
        category:
          (
            { LONG_TERM: '长期养老', SHORT_STAY: '短期托养', POST_OPERATION: '术后阶段' } as Record<
              string,
              string
            >
          )[category] ?? '尚未确定 / 未采集',
        count,
        note: '当前独立服务意向中的自述，不是护理评级',
      });
  return {
    snapshotId: crypto.randomUUID(),
    policyVersion: 'p1-aggregate-v2-k5',
    datasetMode: 'SYNTHETIC_TEST_ONLY',
    warning: '公开演示 · 全部为合成测试数据，不代表真实获客或真实机构',
    from: filters.from,
    to: filters.to,
    timeZone: 'Asia/Shanghai',
    generatedAt: now.toISOString(),
    institutionId: institution,
    institutionName: institution === null ? '平台去重总览' : institutionName(institution),
    sourceFilter: source ?? '全部来源（公开演示合成数据）',
    metrics,
    institutions,
    profiles,
    sources: [...sources, 'UNKNOWN'].map((value) => ({
      source: value,
      count: cohort.filter(({ item }) =>
        value === 'UNKNOWN' ? !sources.includes(item.source ?? '') : item.source === value,
      ).length,
    })),
    rules: [...rules],
  };
}
