import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessSchema,
  calendarSchema,
  detailSchema,
  draftResponse,
  importSchema,
  institutionsSchema,
  listSchema,
  publishSchema,
  reportSchema,
  serviceSchema,
  sessionSchema,
  type Detail,
  type Draft,
} from '../api/schema';
import { validateInstitutionRecordV121 } from '../../../miniprogram/domain/institution/v1-2-1/validate-institution-v1-2-1';
import {
  armFault,
  clearDemo,
  exportDemo,
  getArmedFault,
  importDemo,
  initializeDemo,
  loadEmptyScenario,
  readDemo,
  resetDemo,
  subscribeDemo,
  subscribeFault,
  transact,
} from './store';
import {
  canonical,
  createSyntheticRequest,
  demoRequest,
  expireDemoSession,
  exportBaselineDemo,
  loadHistoricalScenario,
} from './service';
import { createSeed, dayAt } from './seed';

const post = (path: string, body: unknown) => demoRequest(path, { method: 'POST', body });
describe('demo envelopes for production-shaped writes', () => {
  it('draft response loss and later writes retain the original receipt', async () => {
    const path = '/institutions/demo-institution-1/draft';
    const d = draftResponse.parse(await demoRequest(path)).item;
    const body = {
      operationId: crypto.randomUUID(),
      expectedDraftRevision: d.draftRevision,
      record: d.record,
      publicProfile: d.publicProfile,
    };
    armFault({ path, method: 'PUT', mode: 'after-write' });
    await expect(demoRequest(path, { method: 'PUT', body })).rejects.toMatchObject({
      code: 'DEMO_RESPONSE_LOST',
    });
    const original = draftResponse.parse(await demoRequest(path, { method: 'PUT', body }));
    expect(original.item.draftRevision).toBe(d.draftRevision + 1);
    await demoRequest(path, {
      method: 'PUT',
      body: {
        ...body,
        operationId: crypto.randomUUID(),
        expectedDraftRevision: original.item.draftRevision,
      },
    });
    expect(await demoRequest(path, { method: 'PUT', body })).toEqual(original);
    await expect(
      demoRequest(path, { method: 'PUT', body: { ...body, expectedDraftRevision: 88 } }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('resource retry returns its old receipt without reapplying a removed block', async () => {
    const body = {
      operationId: crypto.randomUUID(),
      action: 'BLOCK',
      blockId: crypto.randomUUID(),
      staffId: '演示顾问-资源回执',
      start: new Date(Date.now() + 86400000).toISOString(),
      end: new Date(Date.now() + 90000000).toISOString(),
    };
    const original = await post('/resources', body);
    await post('/resources', {
      operationId: crypto.randomUUID(),
      action: 'REMOVE_BLOCK',
      blockId: body.blockId,
    });
    expect(await post('/resources', body)).toEqual(original);
    expect((await readDemo()).blocks[body.blockId]).toBeUndefined();
  });
});
const getDetail = async (id: string) => detailSchema.parse(await demoRequest('/requests/' + id));
const follow = (id: string, result = 'CONNECTED', extra = {}) => ({
  operationId: crypto.randomUUID(),
  result,
  ...extra,
});
async function fresh(kind: 'VISIT_INTENT' | 'CONSULTATION' = 'VISIT_INTENT') {
  return createSyntheticRequest({ kind, institutionId: 'demo-institution-1' });
}
function visitBody(extra: Record<string, unknown> = {}) {
  return {
    operationId: crypto.randomUUID(),
    visitId: crypto.randomUUID(),
    action: 'CONFIRM',
    expectedRevision: 0,
    institutionId: 'demo-institution-1',
    staffId: '演示测试顾问',
    start: new Date(Date.now() + 86400000).toISOString(),
    end: new Date(Date.now() + 90000000).toISOString(),
    bufferBefore: 30,
    bufferAfter: 30,
    familyConfirmed: true,
    institutionConfirmed: true,
    meetingNote: '合成演示集合点',
    ...extra,
  };
}
async function save(id: string, body: unknown) {
  return detailSchema.parse(await post('/requests/' + id + '/visits', body));
}
beforeEach(async () => {
  await resetDemo();
  await transact((state) => {
    state.requests = {};
    state.reports = {};
    state.receipts = {};
    state.blocks = {};
    state.capacities = {};
    state.session = true;
  });
  armFault(null);
});
describe('public demo persistent transactions', () => {
  it('seeds 76 wholly synthetic requests and seven institutions; all records pass frozen validator', () => {
    const state = createSeed();
    expect(Object.keys(state.requests)).toHaveLength(76);
    expect(Object.keys(state.institutions)).toHaveLength(7);
    for (const i of Object.values(state.institutions).filter((i) => i.draft.record))
      expect(validateInstitutionRecordV121(i.draft.record)).toEqual(
        expect.objectContaining({ ok: true }),
      );
    expect(new Set(Object.values(state.institutions).map((i) => i.draft.status))).toEqual(
      new Set(['NONE', 'DRAFT', 'CONFIRMED', 'PUBLISHED']),
    );
    expect(Object.values(state.requests).some((r) => r.item.status === 'PENDING_ARRANGEMENT')).toBe(
      true,
    );
    for (const r of Object.values(state.requests)) {
      expect(r.item.contactPhone).toMatch(/^演示联络号 DEMO-\d+$/);
      expect(r.item.datasetMode).toBe('SYNTHETIC_TEST_ONLY');
    }
  });
  it('concurrent initialization preserves existing data and does not broadcast read writes', async () => {
    const listener = vi.fn(),
      unsubscribe = subscribeDemo(listener);
    const initial = await readDemo();
    await Promise.all(Array.from({ length: 8 }, () => initializeDemo()));
    expect((await readDemo()).datasetId).toBe(initial.datasetId);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
  it('IDB serializes two competing writes without lost increments', async () => {
    await Promise.all(
      Array.from({ length: 8 }, () =>
        transact((s) => {
          s.capacities['demo-institution-1'] = (s.capacities['demo-institution-1'] ?? 0) + 1;
        }),
      ),
    );
    expect((await readDemo()).capacities['demo-institution-1']).toBe(8);
  });
  it('transaction throw rolls back all changes', async () => {
    const before = await exportDemo();
    await expect(
      transact((s) => {
        s.requests = {};
        s.capacities.x = 2;
        throw Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await exportDemo()).toBe(before);
  });
  it('quota failures stop saving and retain the prior committed dataset', async () => {
    const before = await exportDemo();
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(
      transact((s) => {
        s.capacities['demo-institution-1'] = 9;
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_WRITE_FAILED' });
    expect(await exportDemo()).toBe(before);
  });
  it('reset broadcasts generation and rejects stale writes', async () => {
    const old = await readDemo(),
      listener = vi.fn(),
      unsub = subscribeDemo(listener);
    await resetDemo();
    expect(listener).toHaveBeenCalledWith({ kind: 'reset', generation: old.generation + 1 });
    await expect(
      transact((s) => {
        s.requests = {};
      }, old.generation),
    ).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    await expect(demoRequest('/login', { method: 'POST' }, old.generation)).rejects.toMatchObject({
      code: 'STALE_GENERATION',
    });
    unsub();
  });
  it('clear creates an empty tombstone; refresh does not reseed, empty scenario retains institutions', async () => {
    await clearDemo();
    await initializeDemo();
    const empty = await readDemo();
    expect(Object.keys(empty.requests)).toHaveLength(0);
    expect(Object.keys(empty.institutions)).toHaveLength(0);
    await loadEmptyScenario();
    expect(Object.keys((await readDemo()).institutions)).toHaveLength(7);
    expect(Object.keys((await readDemo()).requests)).toHaveLength(0);
  });
  it('export/import persists progress, logs out, validates references and rejects real contacts atomically', async () => {
    const r = await fresh(),
      original = await exportDemo();
    await importDemo(original);
    expect((await readDemo()).requests[r.item.id]).toBeTruthy();
    expect((await readDemo()).session).toBe(false);
    const before = await exportDemo(),
      invalid = JSON.parse(before);
    invalid.requests[r.item.id].item.contactPhone = '13800000000';
    await expect(importDemo(JSON.stringify(invalid))).rejects.toMatchObject({
      code: 'INVALID_DEMO_IMPORT',
    });
    expect(await exportDemo()).toBe(before);
    invalid.requests[r.item.id].item.contactPhone = '演示联络号 DEMO-0001';
    invalid.requests[r.item.id].item.institutionId = 'unknown';
    await expect(importDemo(JSON.stringify(invalid))).rejects.toMatchObject({
      code: 'INVALID_DEMO_IMPORT',
    });
    expect(await exportDemo()).toBe(before);
    await expect(importDemo('{')).rejects.toMatchObject({ code: 'INVALID_DEMO_IMPORT' });
    expect(await exportDemo()).toBe(before);
    const noMarker = JSON.parse(before);
    delete noMarker.syntheticMarker;
    await expect(importDemo(JSON.stringify(noMarker))).rejects.toMatchObject({
      code: 'INVALID_DEMO_IMPORT',
    });
    expect(await exportDemo()).toBe(before);
  });
  it('incompatible stored schema blocks normal reads but allows raw export and deliberate reset', async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('p1-admin-public-demo-v1', 1);
      open.onsuccess = () => {
        const db = open.result,
          tx = db.transaction('demo', 'readwrite');
        tx.objectStore('demo').put(
          { schemaVersion: 2, generation: 500, customBackup: '演示未来格式' },
          'state',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
    await expect(readDemo()).rejects.toMatchObject({ code: 'UNSUPPORTED_DEMO_VERSION' });
    expect(JSON.parse(await exportDemo()).customBackup).toBe('演示未来格式');
    await resetDemo();
    expect((await readDemo()).generation).toBe(501);
  });
});
describe('same production-facing DTOs with local sessions and explicit failures', () => {
  it('session logout and expiry preserve business data, no endpoint calls network', async () => {
    const network = vi.spyOn(globalThis, 'fetch'),
      r = await fresh();
    sessionSchema.parse(await demoRequest('/session'));
    await expireDemoSession();
    await expect(demoRequest('/requests')).rejects.toMatchObject({ status: 401 });
    sessionSchema.parse(await post('/login', {}));
    expect((await getDetail(r.item.id)).item.id).toBe(r.item.id);
    await post('/logout', {});
    expect((await readDemo()).requests[r.item.id]).toBeTruthy();
    expect(network).not.toHaveBeenCalled();
  });
  it('supports list/date/association filters and pages completely; rejects unsupported and malformed filters', async () => {
    for (let i = 0; i < 5; i++) await fresh();
    const page = listSchema.parse(await demoRequest('/requests?limit=2&offset=2'));
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(listSchema.parse(await demoRequest('/requests?kind=CONSULTATION')).total).toBe(0);
    expect(
      listSchema.parse(await demoRequest('/requests?institutionId=demo-institution-2')).total,
    ).toBe(0);
    await expect(demoRequest('/requests?limit=0')).rejects.toMatchObject({
      code: 'INVALID_FILTER',
    });
    await expect(demoRequest('/requests?from=2026-02-30')).rejects.toMatchObject({
      code: 'INVALID_FILTER',
    });
    await expect(demoRequest('/not-implemented')).rejects.toMatchObject({
      code: 'DEMO_ENDPOINT_UNSUPPORTED',
    });
    await expect(demoRequest('https://example.invalid')).rejects.toMatchObject({
      code: 'DEMO_ENDPOINT_UNSUPPORTED',
    });
    serviceSchema.parse(await demoRequest('/service-institutions'));
    institutionsSchema.parse(await demoRequest('/institutions'));
  });
  it('scoped before-write and response-loss faults retain original operation atomic receipt', async () => {
    const r = await fresh(),
      path = '/requests/' + r.item.id + '/followups',
      b = follow(r.item.id);
    armFault({ mode: 'before-write', path, method: 'POST' });
    await demoRequest('/requests');
    await expect(post(path, b)).rejects.toMatchObject({ code: 'DEMO_BEFORE_WRITE' });
    expect((await getDetail(r.item.id)).events).toHaveLength(1);
    armFault({ mode: 'after-write', path, method: 'POST' });
    await expect(post(path, b)).rejects.toMatchObject({ code: 'DEMO_RESPONSE_LOST' });
    expect((await getDetail(r.item.id)).events).toHaveLength(2);
    await post(path, b);
    expect((await getDetail(r.item.id)).events).toHaveLength(2);
    await expect(post(path, { ...b, result: 'NO_ANSWER' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
  it('fault status remains observable across navigation and clears only on matching consumption or reset', async () => {
    const listener = vi.fn(),
      off = subscribeFault(listener),
      r = await fresh(),
      path = '/requests/' + r.item.id + '/followups';
    armFault({ mode: 'after-write', path, method: 'post' });
    expect(getArmedFault()?.method).toBe('POST');
    await demoRequest('/requests');
    expect(getArmedFault()).toBeTruthy();
    await expect(post(path, follow(r.item.id))).rejects.toMatchObject({
      code: 'DEMO_RESPONSE_LOST',
    });
    expect(getArmedFault()).toBeUndefined();
    expect(listener).toHaveBeenLastCalledWith(undefined);
    armFault({ mode: 'before-write', path, method: 'POST' });
    await resetDemo();
    expect(getArmedFault()).toBeUndefined();
    off();
  });
  it('idempotent replay returns the identical original receipt even after later different operations', async () => {
    const r = await fresh(),
      path = '/requests/' + r.item.id + '/followups',
      first = follow(r.item.id),
      receipt = await post(path, first);
    await post(path, follow(r.item.id, 'NO_ANSWER'));
    expect(await post(path, first)).toEqual(receipt);
    expect((await getDetail(r.item.id)).events).toHaveLength(3);
    const b = visitBody(),
      visitPath = '/requests/' + r.item.id + '/visits',
      confirmed = await post(visitPath, b);
    await post(visitPath, {
      operationId: crypto.randomUUID(),
      visitId: b.visitId,
      action: 'CANCEL',
      expectedRevision: 1,
    });
    expect(await post(visitPath, b)).toEqual(confirmed);
    expect((await getDetail(r.item.id)).item.visits[0].status).toBe('CANCELLED');
  });
});
describe('contact workflow', () => {
  it('multiple contacts retain history; pending next action validates future time and feedback association', async () => {
    const r = await fresh(),
      path = '/requests/' + r.item.id + '/followups';
    await expect(
      post(
        path,
        follow(r.item.id, 'NO_ANSWER', {
          nextContactAt: new Date(Date.now() - 1).toISOString(),
          nextAction: '演示再次联系',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_NEXT_ACTION' });
    await expect(
      post(
        path,
        follow(r.item.id, 'CONNECTED', {
          nextContactAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_NEXT_ACTION' });
    const next = new Date(Date.now() + 86400000).toISOString();
    await post(
      path,
      follow(r.item.id, 'NO_ANSWER', { nextContactAt: next, nextAction: '演示再次联系' }),
    );
    await post(
      path,
      follow(r.item.id, 'MOVED_IN', {
        feedbackSource: 'FAMILY',
        institutionId: 'demo-institution-1',
      }),
    );
    expect((await getDetail(r.item.id)).nextContact?.nextContactAt).toBe(next);
    await expect(
      post(
        path,
        follow(r.item.id, 'MOVED_IN', {
          feedbackSource: 'FAMILY',
          institutionId: 'demo-institution-2',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INSTITUTION_NOT_ASSOCIATED' });
    await expect(post(path, follow(r.item.id, 'MOVED_IN'))).rejects.toMatchObject({
      code: 'FEEDBACK_SOURCE_REQUIRED',
    });
    await post(path, follow(r.item.id));
    expect((await getDetail(r.item.id)).item.status).toBe('PENDING_ARRANGEMENT');
    expect((await getDetail(r.item.id)).events).toHaveLength(4);
  });
  it('refusal cancels active visits, closes contact and clears next contact while allowing sourced feedback', async () => {
    const r = await fresh();
    await save(r.item.id, visitBody());
    await post('/requests/' + r.item.id + '/followups', follow(r.item.id, 'REFUSED'));
    const d = await getDetail(r.item.id);
    expect(d.item.status).toBe('CLOSED');
    expect(d.item.visits[0].status).toBe('CANCELLED');
    expect(d.nextContact?.nextContactAt).toBeNull();
    await expect(
      post('/requests/' + r.item.id + '/followups', follow(r.item.id)),
    ).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
    await post(
      '/requests/' + r.item.id + '/followups',
      follow(r.item.id, 'MOVED_IN', {
        feedbackSource: 'INSTITUTION',
        institutionId: 'demo-institution-1',
      }),
    );
    expect((await getDetail(r.item.id)).item.status).toBe('CLOSED');
  });
});
describe('visit schedule rules and optimistic concurrency', () => {
  it('requires both confirmations, preserves unconfirmed draft and explicit reschedule transition', async () => {
    const r = await fresh(),
      b = visitBody({ familyConfirmed: false });
    await expect(save(r.item.id, b)).rejects.toMatchObject({ code: 'BOTH_CONFIRMATIONS_REQUIRED' });
    const draft = await save(r.item.id, { ...b, action: 'SAVE_DRAFT' });
    expect(draft.item.visits[0].status).toBe('DRAFT');
    await save(r.item.id, {
      ...b,
      operationId: crypto.randomUUID(),
      expectedRevision: 1,
      familyConfirmed: true,
    });
    await expect(
      save(r.item.id, {
        ...b,
        operationId: crypto.randomUUID(),
        expectedRevision: 2,
        familyConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: 'USE_RESCHEDULE' });
    await expect(save(r.item.id, { ...visitBody(), action: 'RESCHEDULE' })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
  it('two simultaneous saves with same expected revision allow only one', async () => {
    const r = await fresh(),
      b = visitBody();
    await save(r.item.id, { ...b, action: 'SAVE_DRAFT' });
    const results = await Promise.allSettled([
      save(r.item.id, { ...b, operationId: crypto.randomUUID(), expectedRevision: 1 }),
      save(r.item.id, { ...b, operationId: crypto.randomUUID(), expectedRevision: 1 }),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((x) => x.status === 'rejected')).toMatchObject({
      reason: { code: 'STALE_REVISION' },
    });
  });
  it('checks staff plus transportation buffer and same authenticated account across requests', async () => {
    const a = await fresh(),
      b = await fresh(),
      first = visitBody();
    await save(a.item.id, first);
    await expect(
      save(
        b.item.id,
        visitBody({
          start: new Date(Date.parse(first.end) + 20 * 60000).toISOString(),
          end: new Date(Date.parse(first.end) + 60 * 60000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'STAFF_CONFLICT' });
    await transact((s) => {
      s.requests[b.item.id].subjectId = s.requests[a.item.id].subjectId;
    });
    await expect(
      save(
        b.item.id,
        visitBody({
          staffId: '演示另顾问',
          institutionId: 'demo-institution-2',
          start: first.start,
          end: first.end,
        }),
      ),
    ).rejects.toMatchObject({ code: 'SUBJECT_CONFLICT' });
  });
  it('sweeps simultaneous institution capacity and rolls back a failed reschedule', async () => {
    const a = await fresh(),
      b = await fresh();
    await transact((s) => {
      s.capacities['demo-institution-1'] = 1;
      s.requests[b.item.id].subjectId = 'demo-account-other';
    });
    const first = visitBody();
    await save(a.item.id, first);
    await expect(
      save(b.item.id, visitBody({ staffId: '演示另顾问', start: first.start, end: first.end })),
    ).rejects.toMatchObject({ code: 'INSTITUTION_CAPACITY_CONFLICT' });
    const second = visitBody({
      staffId: '演示另顾问',
      start: new Date(Date.parse(first.start) + 3 * 3600000).toISOString(),
      end: new Date(Date.parse(first.end) + 3 * 3600000).toISOString(),
    });
    await save(b.item.id, second);
    const before = await getDetail(b.item.id);
    await expect(
      save(b.item.id, {
        ...second,
        operationId: crypto.randomUUID(),
        action: 'RESCHEDULE',
        expectedRevision: 1,
        start: first.start,
        end: first.end,
      }),
    ).rejects.toMatchObject({ code: 'INSTITUTION_CAPACITY_CONFLICT' });
    expect(await getDetail(b.item.id)).toEqual(before);
  });
  it('does not add disjoint reception groups as if they were simultaneously present', async () => {
    const entries = await Promise.all([fresh(), fresh(), fresh()]),
      state = await readDemo();
    await transact((s) => {
      s.capacities['demo-institution-1'] = 2;
      entries.forEach((r, i) => {
        s.requests[r.item.id].subjectId = 'demo-account-sweep-' + i;
      });
    });
    await save(
      entries[0].item.id,
      visitBody({
        staffId: '演示早间顾问',
        start: dayAt(state.anchorDay, 1, 9),
        end: dayAt(state.anchorDay, 1, 10),
        bufferBefore: 0,
        bufferAfter: 0,
      }),
    );
    await save(
      entries[1].item.id,
      visitBody({
        staffId: '演示午间顾问',
        start: dayAt(state.anchorDay, 1, 12),
        end: dayAt(state.anchorDay, 1, 13),
        bufferBefore: 0,
        bufferAfter: 0,
      }),
    );
    expect(
      (
        await save(
          entries[2].item.id,
          visitBody({
            staffId: '演示全天顾问',
            start: dayAt(state.anchorDay, 1, 8),
            end: dayAt(state.anchorDay, 1, 14),
            bufferBefore: 0,
            bufferAfter: 0,
          }),
        )
      ).item.visits[0].status,
    ).toBe('CONFIRMED');
  });
  it('resource block overlap rejects confirmed schedules; block id is idempotent; unavailable/capacity guards apply', async () => {
    const r = await fresh(),
      b = visitBody(),
      block = {
        action: 'BLOCK',
        blockId: crypto.randomUUID(),
        staffId: b.staffId,
        start: b.start,
        end: b.end,
      };
    await post('/resources', block);
    await post('/resources', block);
    await expect(post('/resources', { ...block, staffId: '演示不同顾问' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await expect(save(r.item.id, b)).rejects.toMatchObject({ code: 'STAFF_UNAVAILABLE' });
    await post('/resources', { action: 'REMOVE_BLOCK', blockId: block.blockId });
    await save(r.item.id, b);
    await expect(
      post('/resources', { ...block, blockId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'STAFF_CONFLICT' });
    await expect(
      post('/resources', { action: 'CAPACITY', institutionId: 'demo-institution-1', capacity: 2 }),
    ).rejects.toMatchObject({ code: 'ACTIVE_SCHEDULES_EXIST' });
    const day = b.start.slice(0, 10);
    calendarSchema.parse(await demoRequest('/calendar?from=' + day + '&to=' + day));
  });
  it('future arrival is refused; historical arrival and ended visit immutability are enforced', async () => {
    const future = await fresh(),
      b = visitBody();
    await save(future.item.id, b);
    await expect(
      save(future.item.id, {
        operationId: crypto.randomUUID(),
        visitId: b.visitId,
        action: 'ARRIVE',
        expectedRevision: 1,
        actualAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ACTUAL_TIME' });
    const old = await loadHistoricalScenario(),
      v = old.item.visits[0];
    const result = await save(old.item.id, {
      operationId: crypto.randomUUID(),
      visitId: v.id,
      action: 'ARRIVE',
      expectedRevision: 1,
      actualAt: v.start,
    });
    expect(result.item.status).toBe('VISITED');
    await expect(
      save(old.item.id, {
        operationId: crypto.randomUUID(),
        visitId: v.id,
        action: 'CANCEL',
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: 'VISIT_ENDED' });
  });
  it('cannot overwrite another request visit UUID; confirms reception service access', async () => {
    const a = await fresh(),
      b = await fresh(),
      v = visitBody();
    await save(a.item.id, v);
    await expect(
      save(b.item.id, { ...v, operationId: crypto.randomUUID(), action: 'SAVE_DRAFT' }),
    ).rejects.toMatchObject({ code: 'VISIT_ID_CONFLICT' });
    await expect(
      save(b.item.id, visitBody({ institutionId: 'demo-institution-5' })),
    ).rejects.toMatchObject({ code: 'INSTITUTION_UNAVAILABLE' });
  });
});
describe('institution draft/confirm/publish/access/baseline', () => {
  const path = '/institutions/demo-institution-1';
  async function draft(): Promise<Draft> {
    return draftResponse.parse(await demoRequest(path + '/draft')).item;
  }
  async function edit(d: Draft) {
    return draftResponse.parse(
      await demoRequest(path + '/draft', {
        method: 'PUT',
        body: {
          expectedDraftRevision: d.draftRevision,
          record: d.record,
          publicProfile: d.publicProfile,
        },
      }),
    ).item;
  }
  async function confirm(d: Draft) {
    return draftResponse.parse(
      await post(path + '/confirm', {
        expectedDraftRevision: d.draftRevision,
        sourceReference: '合成演示来源',
        confirmedBy: '演示确认人',
        confirmedOn: (await readDemo()).anchorDay,
      }),
    ).item;
  }
  it('draft revision conflicts preserve first save; confirmation invalidates on every edit', async () => {
    const original = await draft(),
      saved = await edit(original);
    await expect(edit(original)).rejects.toMatchObject({ code: 'STALE_DRAFT_REVISION' });
    const confirmed = await confirm(saved);
    expect(confirmed.status).toBe('CONFIRMED');
    const again = await edit(confirmed);
    expect(again.confirmation).toBeNull();
    await expect(
      post(path + '/publish', {
        operationId: crypto.randomUUID(),
        expectedDraftRevision: again.draftRevision,
      }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  });
  it('publishes immutable versions, replay idempotency and independently managed service access', async () => {
    const state = await readDemo(),
      old = canonical(state.institutions['demo-institution-1'].versions['1']);
    let d = await confirm(await edit(await draft()));
    const body = { operationId: crypto.randomUUID(), expectedDraftRevision: d.draftRevision };
    const published = publishSchema.parse(await post(path + '/publish', body));
    expect(published.publication.recordRevision).toBe(2);
    expect(publishSchema.parse(await post(path + '/publish', body)).publication.status).toBe(
      'PUBLISHED',
    );
    expect(canonical((await readDemo()).institutions['demo-institution-1'].versions['1'])).toBe(
      old,
    );
    d = published.item;
    const access = accessSchema.parse(
      await post(path + '/service-access', {
        operationId: crypto.randomUUID(),
        expectedAccessRevision: d.serviceAccess.accessRevision,
        enabled: false,
        sourceReference: '演示停止接收',
      }),
    );
    expect(access.access.enabled).toBe(false);
    expect((await draft()).currentRecordRevision).toBe(2);
    await expect(
      post('/institutions/demo-institution-6/service-access', {
        operationId: crypto.randomUUID(),
        expectedAccessRevision: 1,
        enabled: true,
        sourceReference: '演示',
      }),
    ).rejects.toMatchObject({ code: 'INSTITUTION_NOT_PUBLISHED' });
  });
  it('rejects future confirmation dates, inconsistent public profiles, and invalid frozen records', async () => {
    let d = await edit(await draft());
    await expect(
      post(path + '/confirm', {
        expectedDraftRevision: d.draftRevision,
        sourceReference: '演示',
        confirmedBy: '演示',
        confirmedOn: '2999-01-01',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIRMATION_DATE' });
    d.publicProfile!.name = '合成演示错误名称';
    d = await edit(d);
    await expect(confirm(d)).rejects.toMatchObject({ code: 'INVALID_PUBLIC_PROFILE' });
    d.publicProfile!.name = String(d.record!.identity.name.value);
    d.record!.capabilities = {};
    d = await confirm(await edit(d));
    await expect(
      post(path + '/publish', {
        operationId: crypto.randomUUID(),
        expectedDraftRevision: d.draftRevision,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RECORD' });
  });
  it('baseline only accepts explicitly marked synthetic catalog, replays and rejects conflicting immutable versions', async () => {
    const sample = JSON.parse(await exportBaselineDemo()),
      body = {
        ...sample,
        operationId: crypto.randomUUID(),
        sourceReference: '合成演示基线',
        preserveExistingFacts: true,
      };
    const result = importSchema.parse(await post('/institutions/import-baseline', body));
    expect(result.imported).toBe(5);
    expect(importSchema.parse(await post('/institutions/import-baseline', body)).replayed).toBe(
      false,
    );
    const unsafe = { ...body, operationId: crypto.randomUUID() };
    delete unsafe.syntheticMarker;
    await expect(post('/institutions/import-baseline', unsafe)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    const conflict = structuredClone(body);
    conflict.operationId = crypto.randomUUID();
    conflict.catalog.records[0].identity.name.value = '合成演示不同名称';
    await expect(post('/institutions/import-baseline', conflict)).rejects.toMatchObject({
      code: 'BASELINE_REVISION_CONFLICT',
    });
  });
  it('baseline head advancement leaves in-progress draft and old publications intact but blocks stale confirmation', async () => {
    const d = await edit(await draft()),
      before = canonical((await readDemo()).institutions['demo-institution-1'].versions['1']);
    const sample = JSON.parse(await exportBaselineDemo()),
      record = sample.catalog.records.find(
        (r: { institutionId: string }) => r.institutionId === 'demo-institution-1',
      );
    record.recordRevision = 2;
    sample.catalog.currentPointers.find(
      (r: { institutionId: string }) => r.institutionId === 'demo-institution-1',
    ).recordRevision = 2;
    await post('/institutions/import-baseline', {
      ...sample,
      operationId: crypto.randomUUID(),
      sourceReference: '合成演示新基线',
      preserveExistingFacts: true,
    });
    expect((await draft()).draftRevision).toBe(d.draftRevision);
    expect(canonical((await readDemo()).institutions['demo-institution-1'].versions['1'])).toBe(
      before,
    );
    await expect(confirm(d)).rejects.toMatchObject({ code: 'BASE_REVISION_CONFLICT' });
  });
  it('reports are immutable same-batch snapshots, include zero and reject invalid filters', async () => {
    const state = await readDemo(),
      body = { operationId: crypto.randomUUID(), from: state.anchorDay, to: state.anchorDay };
    const first = reportSchema.parse(await post('/reports', body));
    expect(first.report.metrics.newRequests).toBe(0);
    const snapshot = canonical(first);
    await fresh();
    const second = reportSchema.parse(
      await post('/reports', { ...body, operationId: crypto.randomUUID() }),
    );
    expect(second.report.metrics.newRequests).toBe(1);
    expect(await post('/reports', body)).toEqual(first);
    expect(
      canonical({
        contractVersion: 'p1-service-request-v1',
        report: (await readDemo()).reports[first.report.snapshotId],
      }),
    ).toBe(snapshot);
    await expect(
      post('/reports', {
        ...body,
        operationId: crypto.randomUUID(),
        institutionId: 'no-such-institution',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILTER' });
  });
  it('lost report responses retry the same original snapshot without generating another batch', async () => {
    const state = await readDemo(),
      body = { operationId: crypto.randomUUID(), from: state.anchorDay, to: state.anchorDay };
    armFault({ mode: 'after-write', path: '/reports', method: 'POST' });
    await expect(post('/reports', body)).rejects.toMatchObject({ code: 'DEMO_RESPONSE_LOST' });
    const snapshot = Object.values((await readDemo()).reports)[0];
    await fresh();
    expect(reportSchema.parse(await post('/reports', body)).report).toEqual(snapshot);
    expect(Object.keys((await readDemo()).reports)).toHaveLength(1);
    await expect(post('/reports', { ...body, source: 'SELF_TEST' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});
