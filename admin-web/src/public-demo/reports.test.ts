import { describe, expect, it } from 'vitest';
import { reportSchema, type Detail, type Visit } from '../api/schema';
import { buildReport } from './reports';
import type { DemoRequest, DemoState } from './types';

const now = new Date('2040-01-02T04:00:00Z'); // Jan 2 noon Beijing
const scope = { from: '2040-01-02', to: '2040-01-02' };
const at = '2040-01-02T01:00:00Z';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function empty(): DemoState {
  return {
    schemaVersion: 1,
    syntheticMarker: 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY',
    seedVersion: 1,
    datasetId: 'synthetic-vector',
    generation: 0,
    anchorDay: scope.from,
    session: true,
    requests: {},
    institutions: {},
    reports: {},
    blocks: {},
    capacities: {},
    receipts: {},
  };
}
function request(n: number, createdAt = at): DemoRequest {
  return {
    subjectId: `synthetic-family-${n}`,
    workflowStatus: 'PENDING_CONTACT',
    events: [],
    visitUpdatedAt: {},
    item: {
      id: id(n),
      kind: 'VISIT_INTENT',
      status: 'PENDING_CONTACT',
      datasetMode: 'SYNTHETIC_TEST_ONLY',
      createdAt,
      serviceScenario: 'LONG_TERM',
      source: 'SYNTHETIC_TEST_ONLY',
      visits: [],
      contactName: '合成联系人不进报表',
      contactPhone: '00000000000',
      assistanceNote: '合成说明不进报表',
    },
  };
}
function institution(state: DemoState, key: string) {
  state.institutions[key] = {
    versions: {},
    draft: {
      institutionId: key,
      draftRevision: 0,
      baseRecordRevision: null,
      currentRecordRevision: null,
      status: 'NONE',
      record: null,
      publicProfile: null,
      confirmation: null,
      publishedRecordRevision: null,
      serviceAccess: { enabled: true, accessRevision: 0 },
    },
  };
}
function visit(
  n: number,
  institutionId: string,
  status: Visit['status'] = 'ARRIVED',
  actualAt: string | null = at,
): Visit {
  return {
    id: id(1000 + n),
    revision: 2,
    institutionId,
    institutionName: `合成演示 ${institutionId}`,
    staffId: '合成人员',
    status,
    actualAt,
    start: at,
    end: '2040-01-02T02:00:00Z',
    bufferBefore: 0,
    bufferAfter: 0,
    meetingNote: '',
    familyConfirmed: true,
    institutionConfirmed: true,
  };
}
const followup = (result: string, extras = {}, occurredAt = at): Detail['events'][number] => ({
  type: 'FOLLOWUP',
  occurredAt,
  details: { result, ...extras },
});

describe('browser P1 aggregate-v2-k5 Java parity vectors', () => {
  it('reads the complete range beyond a 25-item UI page and freezes the returned aggregate', () => {
    const state = empty();
    for (let n = 1; n <= 155; n++) state.requests[id(n)] = request(n);
    const report = buildReport(state, scope, now);
    expect(report.metrics.newRequests).toBe(155);
    expect(report.profiles.find((p) => p.dimension === '服务场景')).toMatchObject({
      category: '长期养老',
      count: 155,
    });
    expect(
      reportSchema.safeParse({ contractVersion: 'p1-service-request-v1', report }).success,
    ).toBe(true);
    state.reports[report.snapshotId] = structuredClone(report);
    state.requests[id(156)] = request(156);
    state.requests[id(1)].item.serviceScenario = 'SHORT_STAY';
    state.requests[id(1)].events.push(followup('CONNECTED'));
    expect(state.reports[report.snapshotId]).toEqual(report);
    expect(report.metrics.contactEvents).toBe(0);
    expect(buildReport(state, scope, now).metrics.newRequests).toBe(156);
    expect(JSON.stringify(report)).not.toMatch(
      /00000000000|contactPhone|assistanceNote|合成联系人/,
    );
  });

  it('separates period activity from cohort conversion across Beijing midnight', () => {
    const state = empty();
    const old = request(1, '2040-01-01T15:59:59Z'); // previous Beijing day
    old.item.visits = [visit(1, 'a', 'ARRIVED', '2040-01-01T16:00:01Z')];
    old.events = [followup('CONNECTED')];
    const fresh = request(2, '2040-01-01T16:00:00Z');
    // Conversion observes through generation, even if an event occurs after the selected day.
    fresh.item.visits = [visit(2, 'a', 'ARRIVED', '2040-01-03T01:00:00Z')];
    fresh.events = [followup('CONNECTED', {}, '2040-01-03T02:00:00Z')];
    state.requests = { [old.item.id]: old, [fresh.item.id]: fresh };
    const report = buildReport(state, scope, new Date('2040-01-04T00:00:00Z'));
    expect(report.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 1,
      arrivedRequests: 1,
      cohortArrivedRequests: 1,
      cohortContactedRequests: 1,
      contactEvents: 1,
      cohortArrivalRate: 1,
    });
    const previous = buildReport(state, { from: '2040-01-01', to: '2040-01-01' }, now);
    expect(previous.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 0,
      cohortArrivedRequests: 1,
      cohortArrivalRate: 1,
    });
    const observed = buildReport(state, scope, now);
    expect(observed.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 1,
      cohortArrivedRequests: 0,
      cohortContactedRequests: 0,
      cohortArrivalRate: 0,
    });
  });

  it('independently deduplicates each institution, contacts and sourced feedback', () => {
    const state = empty();
    institution(state, 'a');
    institution(state, 'b');
    const r = request(1);
    r.item.institutionId = 'a';
    r.item.visits = [visit(1, 'a'), visit(2, 'b'), visit(3, 'a')];
    r.events = [
      followup('CONNECTED'),
      followup('NO_ANSWER'),
      followup('REFUSED'),
      followup('MOVED_IN', { feedbackSource: 'FAMILY', institutionId: 'b' }),
      followup('MOVED_IN', { institutionId: 'a' }), // missing source is not a result
      followup('NOT_MOVED_IN', { feedbackSource: 'CONSULTANT', institutionId: 'a' }),
      followup('UNKNOWN_FEEDBACK', { feedbackSource: 'INSTITUTION', institutionId: 'b' }),
      { type: 'VISIT_CONFIRM', occurredAt: at, details: { institutionId: 'a' } },
      { type: 'VISIT_RESCHEDULE', occurredAt: at, details: { institutionId: 'b' } },
    ];
    state.requests[r.item.id] = r;
    const p = buildReport(state, scope, now),
      a = buildReport(state, { ...scope, institutionId: 'a' }, now),
      b = buildReport(state, { ...scope, institutionId: 'b' }, now);
    expect(p.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 3,
      arrivedRequests: 1,
      contactEvents: 3,
      connectedEvents: 1,
      noAnswerEvents: 1,
      refusedEvents: 1,
      movedInFeedbackEvents: 1,
      notMovedInFeedbackEvents: 1,
      unknownFeedbackEvents: 1,
      cohortContactedRequests: 1,
      cohortMovedInRequests: 1,
      confirmedSessions: 1,
      rescheduledEvents: 1,
    });
    expect(p.institutions).toHaveLength(2);
    expect(a.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 2,
      contactEvents: 3,
      movedInFeedbackEvents: 0,
      cohortMovedInRequests: 0,
      confirmedSessions: 1,
      rescheduledEvents: 0,
    });
    expect(b.metrics).toMatchObject({
      newRequests: 1,
      arrivedSessions: 1,
      contactEvents: 3,
      movedInFeedbackEvents: 1,
      cohortMovedInRequests: 1,
      confirmedSessions: 0,
      rescheduledEvents: 1,
    });
    expect(Number(a.metrics.newRequests) + Number(b.metrics.newRequests)).toBe(2);
  });

  it('keeps zero, missing dimensions and whole-dimension small sample suppression explicit', () => {
    const state = empty();
    const zero = buildReport(state, scope, now);
    expect(zero.metrics.cohortArrivalRate).toBeNull();
    expect(zero.profiles.at(-1)).toMatchObject({ category: '暂无需求', count: 0 });
    for (let n = 1; n <= 11; n++) state.requests[id(n)] = request(n);
    state.requests[id(11)].item.serviceScenario = 'SHORT_STAY';
    const report = buildReport(state, scope, now);
    expect(report.profiles.filter((p) => p.dimension === '服务场景')).toEqual([
      {
        dimension: '服务场景',
        category: '小样本分布已抑制',
        count: null,
        note: '任一非零分类少于5条时，整维不展示分类数量；不输出交叉画像',
      },
    ]);
    expect(
      report.profiles.slice(0, 4).every((p) => p.category === '未采集' && p.count === 11),
    ).toBe(true);
  });

  it('filters source and environment before computing all activities, without fake offline totals', () => {
    const state = empty();
    for (let n = 1; n <= 4; n++) state.requests[id(n)] = request(n);
    state.requests[id(1)].item.source = 'OFFLINE_MANUAL';
    state.requests[id(1)].events = [followup('CONNECTED')];
    state.requests[id(2)].item.datasetMode = 'PRODUCTION';
    state.requests[id(3)].item.source = 'UNRECOGNIZED';
    const all = buildReport(state, scope, now),
      offline = buildReport(state, { ...scope, source: 'OFFLINE_MANUAL' }, now);
    expect(all.metrics.newRequests).toBe(3);
    expect(all.sources.map((s) => [s.source, s.count])).toEqual([
      ['MINIPROGRAM', 0],
      ['OFFLINE_MANUAL', 1],
      ['SELF_TEST', 0],
      ['SYNTHETIC_TEST_ONLY', 1],
      ['UNKNOWN', 1],
    ]);
    expect(offline.metrics).toMatchObject({ newRequests: 1, contactEvents: 1 });
    expect(offline.sources.find((s) => s.source === 'SYNTHETIC_TEST_ONLY')?.count).toBe(0);
  });

  it('excludes future creations, events and actuals at the cutoff, counting cancellations by update time', () => {
    const state = empty(),
      r = request(1),
      future = '2040-01-02T05:00:00Z';
    r.item.visits = [
      visit(1, 'a', 'CANCELLED', null),
      visit(2, 'a', 'NO_SHOW', at),
      visit(3, 'a', 'NO_SHOW', future),
      visit(4, 'a', 'ARRIVED', future),
      visit(5, 'a', 'CANCELLED', null),
    ];
    r.visitUpdatedAt = { [id(1001)]: at, [id(1005)]: future };
    r.events = [
      followup('CONNECTED', {}, future),
      { type: 'VISIT_CONFIRM', occurredAt: future, details: { institutionId: 'a' } },
    ];
    const futureRequest = request(2, future);
    state.requests = { [r.item.id]: r, [futureRequest.item.id]: futureRequest };
    expect(buildReport(state, scope, now).metrics).toMatchObject({
      newRequests: 1,
      contactEvents: 0,
      confirmedSessions: 0,
      noShowSessions: 1,
      cancelledSessions: 1,
      arrivedSessions: 0,
    });
  });

  it('rejects invalid filters rather than silently producing an empty report', () => {
    const state = empty();
    for (const filters of [
      { from: '2040-02-30', to: '2040-03-01' },
      { from: '2040-01-03', to: '2040-01-02' },
      { ...scope, institutionId: 'missing' },
      { ...scope, source: 'invalid' },
      { from: '2000-01-01', to: '2040-01-01' },
    ])
      expect(() => buildReport(state, filters, now)).toThrow('INVALID_FILTER');
  });
});
