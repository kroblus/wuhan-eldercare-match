import { z } from 'zod';
import { ApiError, errors } from '../api/errors';
import {
  detailSchema,
  profileSchema,
  recordSchema,
  statusLabels,
  type Draft,
  type Detail,
  type Visit,
} from '../api/schema';
import { validateInstitutionRecordV121 } from '../../../miniprogram/domain/institution/v1-2-1/validate-institution-v1-2-1';
import { beijingDay, createRequest, emptyDraft, templateRecord } from './seed';
import { consumeFault, readDemo, transact } from './store';
import { buildReport } from './reports';
import type { DemoState, DemoRequest } from './types';
export { loadEmptyScenario } from './store';
import { canonical } from './canonical';
export { canonical } from './canonical';

const p1 = { contractVersion: 'p1-service-request-v1' } as const;
const publication = {
  contractVersion: 'institution-publications-v1',
  dataEnvironment: 'SYNTHETIC_TEST_ONLY',
} as const;
function fail(code: string, status = 400): never {
  throw new ApiError(errors[code] || '演示操作未完成：' + code, status, code);
}
const clone = <T>(v: T): T => structuredClone(v);
function text(max: number): z.ZodString;
function text(max: number, optional: true): z.ZodOptional<z.ZodNullable<z.ZodString>>;
function text(max: number, optional = false) {
  const valid = z
    .string()
    .max(max)
    .refine(
      (v) =>
        (!v.trim() && optional) || (v === v.trim() && !/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/.test(v)),
    );
  return optional ? valid.nullish() : valid.min(1);
}
const guid = z.guid();
const revision = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
const instant = z.iso.datetime({ offset: true });
const followupBody = z
  .object({
    operationId: guid,
    result: z.enum([
      'CONNECTED',
      'NO_ANSWER',
      'REFUSED',
      'MOVED_IN',
      'NOT_MOVED_IN',
      'UNKNOWN_FEEDBACK',
    ]),
    note: text(500, true),
    nextContactAt: z.union([instant, z.literal('')]).nullish(),
    nextAction: text(200, true),
    feedbackSource: text(24, true),
    institutionId: text(100, true),
  })
  .strict();
const visitBody = z
  .object({
    operationId: guid,
    visitId: guid,
    action: z.enum(['SAVE_DRAFT', 'CONFIRM', 'RESCHEDULE', 'CANCEL', 'ARRIVE', 'NO_SHOW']),
    expectedRevision: revision,
    institutionId: text(100, true),
    staffId: text(80, true),
    start: instant.optional(),
    end: instant.optional(),
    bufferBefore: z.number().int().min(0).max(240).optional(),
    bufferAfter: z.number().int().min(0).max(240).optional(),
    familyConfirmed: z.boolean().optional(),
    institutionConfirmed: z.boolean().optional(),
    meetingNote: text(300, true),
    actualAt: instant.optional(),
  })
  .strict();
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) fail('INVALID_INPUT');
  return result.data;
}
function request(state: DemoState, id: string) {
  const result = state.requests[id];
  if (!result) fail('NOT_FOUND', 404);
  return result;
}
function institution(state: DemoState, id: string) {
  const result = state.institutions[id];
  if (!result) fail('NOT_FOUND', 404);
  return result;
}
function institutionName(state: DemoState, id: string) {
  const d = institution(state, id).draft;
  return String(d.publicProfile?.name || d.record?.identity.name?.value || id);
}
function detail(entry: DemoRequest): Detail {
  return {
    ...p1,
    item: clone(entry.item),
    events: clone(entry.events),
    nextContact: clone(entry.nextContact ?? null),
  };
}
function open(entry: DemoRequest) {
  if (['CLOSED', 'CANCELLED'].includes(entry.item.status)) fail('REQUEST_CLOSED', 409);
}
function recompute(entry: DemoRequest) {
  entry.item.visits.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  entry.item.status = ['CLOSED', 'CANCELLED'].includes(entry.workflowStatus)
    ? entry.workflowStatus
    : entry.item.visits.some((v) => v.status === 'CONFIRMED')
      ? 'CONFIRMED'
      : entry.item.visits.some((v) => v.status === 'ARRIVED')
        ? 'VISITED'
        : entry.item.visits.some((v) => v.status === 'NO_SHOW')
          ? 'NO_SHOW'
          : entry.workflowStatus;
}
function event(entry: DemoRequest, type: string, body: Record<string, unknown>, now: string) {
  entry.events.push({
    operationId: body.operationId as string,
    type,
    occurredAt: now,
    details: clone(body),
  });
}
function replay(state: DemoState, path: string, body: { operationId: string }) {
  const old = state.receipts[body.operationId];
  if (old && old.signature !== canonical({ path, body })) fail('IDEMPOTENCY_CONFLICT', 409);
  return old;
}
function receipt(state: DemoState, path: string, body: { operationId: string }, response: unknown) {
  state.receipts[body.operationId] = {
    signature: canonical({ path, body }),
    response: clone(response),
  };
  return response;
}
const intervalsOverlap = (low: number, high: number, l: number, h: number) => l < high && h > low;
const interval = (v: Visit) =>
  [
    Date.parse(v.start) - v.bufferBefore * 60000,
    Date.parse(v.end) + v.bufferAfter * 60000,
  ] as const;
function conflicts(state: DemoState, entry: DemoRequest, visit: Visit) {
  const [low, high] = interval(visit),
    points = new Map<number, number>();
  const point = (at: number, delta: number) => points.set(at, (points.get(at) ?? 0) + delta);
  point(low, 1);
  point(high, -1);
  for (const other of Object.values(state.requests))
    for (const v of other.item.visits) {
      if (v.id === visit.id || v.status !== 'CONFIRMED') continue;
      const [l, h] = interval(v);
      if (!intervalsOverlap(low, high, l, h)) continue;
      if (v.staffId === visit.staffId) fail('STAFF_CONFLICT', 409);
      if (other.subjectId === entry.subjectId) fail('SUBJECT_CONFLICT', 409);
      if (v.institutionId === visit.institutionId) {
        point(Math.max(low, l), 1);
        point(Math.min(high, h), -1);
      }
    }
  if (state.capacities[visit.institutionId]) {
    let occupancy = 0;
    for (const [, delta] of [...points].sort(([a], [b]) => a - b)) {
      occupancy += delta;
      if (occupancy > state.capacities[visit.institutionId])
        fail('INSTITUTION_CAPACITY_CONFLICT', 409);
    }
  }
  for (const block of Object.values(state.blocks))
    if (
      block.staffId === visit.staffId &&
      intervalsOverlap(low, high, Date.parse(block.start), Date.parse(block.end))
    )
      fail('STAFF_UNAVAILABLE', 409);
}
function followup(state: DemoState, id: string, path: string, input: unknown, now: string) {
  const b = parse(followupBody, input),
    entry = request(state, id);
  const replayed = replay(state, path, b);
  if (replayed) return clone(replayed.response);
  const feedback = ['MOVED_IN', 'NOT_MOVED_IN', 'UNKNOWN_FEEDBACK'].includes(b.result);
  if (entry.item.status === 'CANCELLED' || (!feedback && entry.item.status === 'CLOSED'))
    fail('REQUEST_CLOSED', 409);
  if (feedback) {
    if (
      !b.institutionId ||
      !state.institutions[b.institutionId] ||
      !['FAMILY', 'INSTITUTION', 'CONSULTANT'].includes(b.feedbackSource ?? '')
    )
      fail('FEEDBACK_SOURCE_REQUIRED');
    if (
      entry.item.institutionId !== b.institutionId &&
      !entry.item.visits.some((v) => v.institutionId === b.institutionId)
    )
      fail('INSTITUTION_NOT_ASSOCIATED');
  }
  if (
    b.nextContactAt &&
    (Date.parse(b.nextContactAt) <= Date.parse(now) ||
      !b.nextAction?.trim() ||
      b.result === 'REFUSED' ||
      feedback)
  )
    fail('INVALID_NEXT_ACTION');
  if (b.result === 'REFUSED') {
    for (const v of entry.item.visits)
      if (v.status === 'DRAFT' || v.status === 'CONFIRMED') {
        v.status = 'CANCELLED';
        v.revision++;
        entry.visitUpdatedAt[v.id] = now;
      }
    entry.workflowStatus = 'CLOSED';
  } else if (!feedback)
    entry.workflowStatus =
      b.result === 'CONNECTED' && entry.item.kind === 'VISIT_INTENT'
        ? 'PENDING_ARRANGEMENT'
        : 'FOLLOWING_UP';
  if (!feedback)
    entry.nextContact = {
      nextContactAt: b.nextContactAt || null,
      nextAction: b.nextAction || null,
    };
  event(entry, 'FOLLOWUP', b, now);
  recompute(entry);
  return receipt(state, path, b, detail(entry));
}
function visit(state: DemoState, id: string, path: string, input: unknown, now: string) {
  const b = parse(visitBody, input),
    entry = request(state, id);
  const replayed = replay(state, path, b);
  if (replayed) return clone(replayed.response);
  open(entry);
  const old = entry.item.visits.find((v) => v.id === b.visitId);
  if ((old?.revision ?? 0) !== b.expectedRevision) fail('STALE_REVISION', 409);
  if (old && ['CANCELLED', 'ARRIVED', 'NO_SHOW'].includes(old.status)) fail('VISIT_ENDED', 409);
  if (['CANCEL', 'ARRIVE', 'NO_SHOW'].includes(b.action)) {
    if (!old || (b.action !== 'CANCEL' && old.status !== 'CONFIRMED'))
      fail('INVALID_TRANSITION', 409);
    if (
      b.action !== 'CANCEL' &&
      (!b.actualAt ||
        Date.parse(b.actualAt) > Date.parse(now) ||
        Date.parse(old.start) > Date.parse(now) ||
        Date.parse(b.actualAt) < Date.parse(old.start) - 86400000)
    )
      fail('INVALID_ACTUAL_TIME');
    old.status =
      b.action === 'CANCEL' ? 'CANCELLED' : b.action === 'ARRIVE' ? 'ARRIVED' : 'NO_SHOW';
    old.actualAt = b.action === 'CANCEL' ? null : b.actualAt;
    old.revision++;
  } else {
    if (
      !b.institutionId ||
      !b.staffId?.trim() ||
      !b.meetingNote?.trim() ||
      !b.start ||
      !b.end ||
      b.bufferBefore === undefined ||
      b.bufferAfter === undefined ||
      b.familyConfirmed === undefined ||
      b.institutionConfirmed === undefined
    )
      fail('INVALID_INPUT');
    if (/[\r\n]/.test(b.staffId)) fail('INVALID_INPUT');
    const institutionState = institution(state, b.institutionId),
      d = institutionState.draft;
    const current = institutionState.versions[String(d.currentRecordRevision)];
    if (!d.serviceAccess.enabled || !current || current.record?.recordStatus !== 'published')
      fail('INSTITUTION_UNAVAILABLE');
    if (
      Date.parse(b.start) >= Date.parse(b.end) ||
      Math.floor((Date.parse(b.end) - Date.parse(b.start)) / 3600000) > 24
    )
      fail('INVALID_TIME');
    const confirmed = b.action !== 'SAVE_DRAFT';
    if (confirmed && (!b.familyConfirmed || !b.institutionConfirmed))
      fail('BOTH_CONFIRMATIONS_REQUIRED');
    if (b.action === 'RESCHEDULE' && old?.status !== 'CONFIRMED') fail('INVALID_TRANSITION', 409);
    if (old?.status === 'CONFIRMED' && b.action !== 'RESCHEDULE') fail('USE_RESCHEDULE', 409);
    for (const other of Object.values(state.requests))
      if (other !== entry && other.item.visits.some((v) => v.id === b.visitId))
        fail('VISIT_ID_CONFLICT', 409);
    const next: Visit = {
      id: b.visitId,
      revision: b.expectedRevision + 1,
      institutionId: b.institutionId,
      institutionName:
        old?.institutionId === b.institutionId
          ? old.institutionName
          : String(
              current.publicProfile?.name ||
                current.record?.identity.name?.value ||
                institutionName(state, b.institutionId),
            ),
      staffId: b.staffId,
      status: confirmed ? 'CONFIRMED' : 'DRAFT',
      start: b.start,
      end: b.end,
      bufferBefore: b.bufferBefore,
      bufferAfter: b.bufferAfter,
      familyConfirmed: b.familyConfirmed,
      institutionConfirmed: b.institutionConfirmed,
      meetingNote: b.meetingNote,
      actualAt: null,
    };
    if (confirmed) conflicts(state, entry, next);
    if (old) Object.assign(old, next);
    else entry.item.visits.push(next);
  }
  entry.visitUpdatedAt[b.visitId] = now;
  event(entry, 'VISIT_' + b.action, b, now);
  recompute(entry);
  return receipt(state, path, b, detail(entry));
}
function day(value: string | null, high = false): number | undefined {
  if (!value) return undefined;
  if (!z.iso.date().safeParse(value).success) fail('INVALID_FILTER');
  return Date.parse(value + 'T00:00:00+08:00') + (high ? 86400000 : 0);
}
function resources(state: DemoState, input: unknown, now: string) {
  const b = parse(
    z.discriminatedUnion('action', [
      z
        .object({
          action: z.literal('BLOCK'),
          blockId: guid,
          staffId: text(80),
          start: instant,
          end: instant,
        })
        .strict(),
      z.object({ action: z.literal('REMOVE_BLOCK'), blockId: guid }).strict(),
      z
        .object({
          action: z.literal('CAPACITY'),
          institutionId: text(100),
          capacity: z.number().int().min(0).max(100),
        })
        .strict(),
    ]),
    input,
  );
  if (b.action === 'REMOVE_BLOCK') delete state.blocks[b.blockId];
  else if (b.action === 'BLOCK') {
    const low = Date.parse(b.start),
      high = Date.parse(b.end);
    if (low >= high) fail('INVALID_TIME');
    for (const r of Object.values(state.requests))
      for (const v of r.item.visits) {
        const [l, h] = interval(v);
        if (
          v.status === 'CONFIRMED' &&
          v.staffId === b.staffId &&
          intervalsOverlap(low, high, l, h)
        )
          fail('STAFF_CONFLICT', 409);
      }
    const next = { id: b.blockId, staffId: b.staffId, start: b.start, end: b.end };
    if (state.blocks[b.blockId] && canonical(state.blocks[b.blockId]) !== canonical(next))
      fail('IDEMPOTENCY_CONFLICT', 409);
    state.blocks[b.blockId] = next;
  } else {
    institution(state, b.institutionId);
    for (const r of Object.values(state.requests))
      for (const v of r.item.visits)
        if (
          v.institutionId === b.institutionId &&
          v.status === 'CONFIRMED' &&
          interval(v)[1] > Date.parse(now)
        )
          fail('ACTIVE_SCHEDULES_EXIST', 409);
    if (b.capacity) state.capacities[b.institutionId] = b.capacity;
    else delete state.capacities[b.institutionId];
  }
  return { ...p1, saved: true };
}
function validateProfile(record: NonNullable<Draft['record']>, profile: Draft['publicProfile']) {
  if (!profile) return;
  if (
    !profileSchema.safeParse(profile).success ||
    profile.id !== record.institutionId ||
    profile.name !== record.identity.name?.value ||
    record.identity.name?.availability !== 'provided' ||
    !profile.name ||
    !profile.source ||
    profile.tags.length > 12 ||
    new Set(profile.tags).size !== profile.tags.length ||
    profile.prices.length > 30 ||
    new Set(profile.prices.map((p) => p.level)).size !== profile.prices.length ||
    profile.prices.some((p) => Math.max(p.total, p.bed, p.care, p.food) > 10000000)
  )
    fail('INVALID_PUBLIC_PROFILE');
}
function validateRecord(record: NonNullable<Draft['record']>, id: string) {
  if (
    record.institutionId !== id ||
    record.contractVersion !== 'institution-contract-v1.2.1' ||
    record.recordProvenance !== 'PRODUCTION_CANDIDATE'
  )
    fail('INVALID_RECORD');
  if (!validateInstitutionRecordV121(record).ok) fail('INVALID_RECORD');
}
function institutions(
  state: DemoState,
  path: string,
  method: string,
  input: unknown,
  now: string,
  id?: string,
  action?: string,
) {
  if (!id && method === 'POST') {
    const b = parse(
      z
        .object({
          institutionId: z.string().regex(/^demo-[a-z0-9-]{1,94}$/),
          record: recordSchema,
          publicProfile: profileSchema.nullable(),
        })
        .strict(),
      input,
    );
    if (state.institutions[b.institutionId]) fail('STALE_DRAFT_REVISION', 409);
    if (
      b.record.institutionId !== b.institutionId ||
      b.record.contractVersion !== 'institution-contract-v1.2.1' ||
      b.record.recordProvenance !== 'PRODUCTION_CANDIDATE'
    )
      fail('INVALID_RECORD');
    state.institutions[b.institutionId] = {
      draft: {
        ...emptyDraft(b.institutionId),
        draftRevision: 1,
        baseRecordRevision: 0,
        status: 'DRAFT',
        record: clone(b.record),
        publicProfile: clone(b.publicProfile),
      },
      versions: {},
    };
    return { ...publication, item: state.institutions[b.institutionId].draft };
  }
  if (!id) fail('NOT_FOUND', 404);
  const entry = institution(state, id),
    d = entry.draft;
  if (action === 'draft' && method === 'PUT') {
    const b = parse(
      z
        .object({
          expectedDraftRevision: revision,
          record: recordSchema,
          publicProfile: profileSchema.nullable(),
        })
        .strict(),
      input,
    );
    if (b.expectedDraftRevision !== d.draftRevision) fail('STALE_DRAFT_REVISION', 409);
    if (d.status !== 'PUBLISHED' && (d.baseRecordRevision || 0) !== (d.currentRecordRevision || 0))
      fail('BASE_REVISION_CONFLICT', 409);
    if (
      b.record.institutionId !== id ||
      b.record.contractVersion !== 'institution-contract-v1.2.1' ||
      b.record.recordProvenance !== 'PRODUCTION_CANDIDATE'
    )
      fail('INVALID_RECORD');
    if (d.status === 'PUBLISHED') d.baseRecordRevision = d.currentRecordRevision;
    d.record = clone(b.record);
    d.publicProfile = clone(b.publicProfile);
    d.draftRevision++;
    d.status = 'DRAFT';
    d.confirmation = null;
    d.publishedRecordRevision = null;
    delete entry.confirmedContent;
  } else if (action === 'confirm' && method === 'POST') {
    const b = parse(
      z
        .object({
          expectedDraftRevision: revision,
          sourceReference: text(1000),
          confirmedBy: text(80),
          confirmedOn: z.iso.date(),
        })
        .strict(),
      input,
    );
    if (b.confirmedOn > beijingDay(new Date(now))) fail('INVALID_CONFIRMATION_DATE');
    if (!b.expectedDraftRevision || d.draftRevision !== b.expectedDraftRevision)
      fail('STALE_DRAFT_REVISION', 409);
    if (d.status === 'PUBLISHED' || !d.record) fail('CONFIRMATION_REQUIRED', 409);
    if ((d.baseRecordRevision || 0) !== (d.currentRecordRevision || 0))
      fail('BASE_REVISION_CONFLICT', 409);
    validateProfile(d.record, d.publicProfile);
    d.confirmation = {
      sourceReference: b.sourceReference,
      confirmedBy: b.confirmedBy,
      confirmedOn: b.confirmedOn,
      confirmedAt: now,
    };
    d.status = 'CONFIRMED';
    d.draftRevision++;
    entry.confirmedContent = canonical([d.record, d.publicProfile]);
  } else if (action === 'publish' && method === 'POST') {
    const b = parse(
      z.object({ operationId: guid, expectedDraftRevision: revision }).strict(),
      input,
    );
    const replayed = replay(state, path, b);
    if (replayed) return clone(replayed.response);
    if (!b.expectedDraftRevision || b.expectedDraftRevision !== d.draftRevision)
      fail('STALE_DRAFT_REVISION', 409);
    if (
      d.status !== 'CONFIRMED' ||
      !d.confirmation ||
      !d.record ||
      entry.confirmedContent !== canonical([d.record, d.publicProfile])
    )
      fail('CONFIRMATION_REQUIRED', 409);
    if ((d.baseRecordRevision || 0) !== (d.currentRecordRevision || 0))
      fail('BASE_REVISION_CONFLICT', 409);
    validateProfile(d.record, d.publicProfile);
    const nextRevision = (d.currentRecordRevision ?? 0) + 1;
    const record = clone(d.record);
    record.recordStatus = 'published';
    record.recordRevision = nextRevision;
    record.evidence?.forEach((e) => {
      e.recordRevision = nextRevision;
    });
    validateRecord(record, id);
    entry.versions[String(nextRevision)] = {
      record: clone(record),
      publicProfile: clone(d.publicProfile),
    };
    d.record = record;
    d.currentRecordRevision = d.publishedRecordRevision = nextRevision;
    d.status = 'PUBLISHED';
    d.draftRevision++;
    return receipt(state, path, b, {
      ...publication,
      item: d,
      publication: { institutionId: id, recordRevision: nextRevision, status: 'PUBLISHED' },
    });
  } else if (action === 'service-access' && method === 'POST') {
    const b = parse(
      z
        .object({
          operationId: guid,
          expectedAccessRevision: revision,
          enabled: z.boolean(),
          sourceReference: text(1000),
        })
        .strict(),
      input,
    );
    const replayed = replay(state, path, b);
    if (replayed) return clone(replayed.response);
    if (b.expectedAccessRevision !== d.serviceAccess.accessRevision)
      fail('STALE_ACCESS_REVISION', 409);
    if (
      b.enabled &&
      (!d.currentRecordRevision ||
        entry.versions[String(d.currentRecordRevision)]?.record?.recordStatus !== 'published')
    )
      fail('INSTITUTION_NOT_PUBLISHED');
    d.serviceAccess = { enabled: b.enabled, accessRevision: b.expectedAccessRevision + 1 };
    return receipt(state, path, b, {
      ...publication,
      access: { institutionId: id, ...d.serviceAccess },
    });
  } else fail('DEMO_ENDPOINT_UNSUPPORTED', 404);
  return { ...publication, item: clone(d) };
}
function baseline(state: DemoState, path: string, input: unknown) {
  const b = parse(
    z
      .object({
        syntheticMarker: z.literal('P1_PUBLIC_DEMO_SYNTHETIC_ONLY'),
        schemaVersion: z.literal(1),
        operationId: guid,
        sourceReference: text(1000),
        preserveExistingFacts: z.literal(true),
        catalog: z
          .object({
            datasetVersion: text(200),
            datasetMode: z.literal('SYNTHETIC_TEST_ONLY'),
            records: z.array(recordSchema).min(1).max(200),
            currentPointers: z.array(
              z
                .object({ institutionId: z.string(), recordRevision: z.number().int().positive() })
                .strict(),
            ),
            presentation: z
              .object({
                orderingPolicy: z.literal('CANONICAL_IDENTITY_ASC_V1'),
                displayOrder: z.array(z.unknown()).max(0),
              })
              .strict(),
          })
          .strict(),
        historicalRecords: z.array(recordSchema).max(2000).optional(),
      })
      .strict(),
    input,
  );
  const replayed = replay(state, path, b);
  if (replayed) return clone(replayed.response);
  const heads = new Map(b.catalog.records.map((r) => [r.institutionId, r]));
  if (
    heads.size !== b.catalog.records.length ||
    b.catalog.currentPointers.length !== heads.size ||
    new Set(b.catalog.currentPointers.map((p) => p.institutionId)).size !== heads.size ||
    b.catalog.currentPointers.some(
      (p) => heads.get(p.institutionId)?.recordRevision !== p.recordRevision,
    )
  )
    fail('INVALID_INPUT');
  const all = [...(b.historicalRecords || []), ...b.catalog.records],
    seen = new Set<string>();
  for (const record of all) {
    if (
      !record.institutionId.startsWith('demo-') ||
      !String(record.identity.name?.value || '').startsWith('合成演示') ||
      !heads.has(record.institutionId) ||
      record.recordRevision < 1 ||
      record.recordRevision > heads.get(record.institutionId)!.recordRevision
    )
      fail('INVALID_RECORD');
    const key = record.institutionId + ':' + record.recordRevision;
    if (seen.has(key)) fail('INVALID_INPUT');
    seen.add(key);
    validateRecord(record, record.institutionId);
    const existing =
      state.institutions[record.institutionId]?.versions[String(record.recordRevision)]?.record;
    if (existing && canonical(existing) !== canonical(record))
      fail('BASELINE_REVISION_CONFLICT', 409);
  }
  for (const record of all) {
    const entry = (state.institutions[record.institutionId] ??= {
      draft: emptyDraft(record.institutionId),
      versions: {},
    });
    entry.versions[String(record.recordRevision)] ??= {
      record: clone(record),
      publicProfile: null,
    };
    if (
      heads.get(record.institutionId) === record &&
      (entry.draft.currentRecordRevision ?? 0) < record.recordRevision
    ) {
      entry.draft.currentRecordRevision = record.recordRevision;
      if (!entry.draft.draftRevision)
        Object.assign(entry.draft, {
          record: clone(record),
          baseRecordRevision: record.recordRevision,
          publishedRecordRevision: record.recordRevision,
        });
    }
  }
  return receipt(state, path, b, { ...publication, imported: all.length, replayed: false });
}
function read(state: DemoState, pathname: string, query: URLSearchParams) {
  if (pathname === '/session') return session(state);
  if (!state.session) fail('DEMO_SESSION_EXPIRED', 401);
  if (pathname === '/service-institutions')
    return {
      ...p1,
      serviceInstitutions: Object.values(state.institutions).map(({ draft: d }) => ({
        institutionId: d.institutionId,
        institutionName: institutionName(state, d.institutionId),
        enabled: d.serviceAccess.enabled,
        accessRevision: d.serviceAccess.accessRevision,
        recordRevision: d.currentRecordRevision,
      })),
    };
  if (pathname === '/requests') {
    const status = query.get('status'),
      kind = query.get('kind'),
      institutionId = query.get('institutionId'),
      low = day(query.get('from')),
      high = day(query.get('to'), true),
      limit = Number(query.get('limit') || 50),
      offset = Number(query.get('offset') || 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      (status && !(status in statusLabels)) ||
      (kind && !['CONSULTATION', 'VISIT_INTENT'].includes(kind)) ||
      (institutionId && !state.institutions[institutionId]) ||
      (low !== undefined && high !== undefined && low >= high)
    )
      fail('INVALID_FILTER');
    const items = Object.values(state.requests)
      .map((r) => r.item)
      .filter(
        (r) =>
          (!status || r.status === status) &&
          (!kind || r.kind === kind) &&
          (!institutionId ||
            r.institutionId === institutionId ||
            r.visits.some((v) => v.institutionId === institutionId)) &&
          (low === undefined || Date.parse(r.createdAt) >= low) &&
          (high === undefined || Date.parse(r.createdAt) < high),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return {
      ...p1,
      items: clone(items.slice(offset, offset + limit)),
      total: items.length,
      offset,
      hasMore: offset + limit < items.length,
    };
  }
  const requestMatch = /^\/requests\/([^/]+)$/.exec(pathname);
  if (requestMatch) return detail(request(state, requestMatch[1]));
  if (pathname === '/calendar') {
    const low = day(query.get('from')),
      high = day(query.get('to'), true);
    if (low === undefined || high === undefined || low >= high || (high - low) / 86400000 > 93)
      fail('INVALID_FILTER');
    return {
      ...p1,
      visits: Object.values(state.requests).flatMap((r) =>
        r.item.visits
          .filter((v) => intervalsOverlap(low, high, Date.parse(v.start), Date.parse(v.end)))
          .map((v) => ({ ...clone(v), requestId: r.item.id })),
      ),
      blocks: Object.values(state.blocks).filter((b) =>
        intervalsOverlap(low, high, Date.parse(b.start), Date.parse(b.end)),
      ),
      capacities: Object.entries(state.capacities).map(([id, capacity]) => ({
        institutionName: institutionName(state, id),
        capacity,
      })),
    };
  }
  if (pathname === '/institutions/template') {
    const id = query.get('institutionId') || '';
    if (!/^demo-[a-z0-9-]{1,94}$/.test(id)) fail('DEMO_ID_REQUIRED');
    return { ...publication, record: templateRecord(id) };
  }
  if (pathname === '/institutions')
    return {
      ...publication,
      items: Object.values(state.institutions).map(({ draft: d }) => ({
        institutionId: d.institutionId,
        name: institutionName(state, d.institutionId),
        status: d.status,
        draftRevision: d.draftRevision,
        currentRecordRevision: d.currentRecordRevision,
        serviceAccess: clone(d.serviceAccess),
      })),
    };
  const draftMatch = /^\/institutions\/([^/]+)\/draft$/.exec(pathname);
  if (draftMatch)
    return {
      ...publication,
      item: clone(institution(state, decodeURIComponent(draftMatch[1])).draft),
    };
  const revisionMatch = /^\/institutions\/([^/]+)\/revisions\/(\d+)$/.exec(pathname);
  if (revisionMatch) {
    const version = institution(state, revisionMatch[1]).versions[revisionMatch[2]];
    if (!version) fail('NOT_FOUND', 404);
    return {
      ...publication,
      ...clone(version),
      institutionId: revisionMatch[1],
      recordRevision: Number(revisionMatch[2]),
    };
  }
  fail('DEMO_ENDPOINT_UNSUPPORTED', 404);
}
function session(state: DemoState) {
  if (!state.session) fail('DEMO_SESSION_EXPIRED', 401);
  return {
    ...p1,
    authenticated: true,
    username: '演示运营员',
    csrfToken: 'public-demo-no-real-auth',
  };
}
export async function demoRequest(
  path: string,
  options: { method?: string; body?: unknown; login?: boolean } = {},
  expectedGeneration?: number,
): Promise<unknown> {
  const url = new URL(path, 'https://demo.invalid'),
    method = (options.method || 'GET').toUpperCase();
  if (!path.startsWith('/') || url.origin !== 'https://demo.invalid')
    fail('DEMO_ENDPOINT_UNSUPPORTED', 404);
  const state = await readDemo(),
    generation = expectedGeneration ?? state.generation;
  if (state.generation !== generation) fail('STALE_GENERATION', 409);
  if (method === 'GET') return clone(read(state, url.pathname, url.searchParams));
  if (
    /(?:https?:\/\/|tel:|sms:|mailto:|javascript:|<script\b|(?<![0-9])1[3-9][0-9]{9}(?![0-9]))/i.test(
      JSON.stringify(options.body ?? {}),
    )
  )
    throw new ApiError(
      '仅限合成演示输入；请移除真实电话号码、网址或可执行内容。',
      400,
      'DEMO_SYNTHETIC_ONLY',
    );
  const selectedFault = consumeFault(url.pathname, method);
  if (selectedFault === 'before-write')
    throw new ApiError('模拟保存前失败；本次未写入，可使用原操作重试。', 503, 'DEMO_BEFORE_WRITE');
  const response = await transact(
    (current) => {
      const now = new Date().toISOString();
      if (url.pathname === '/login' && method === 'POST') {
        current.session = true;
        return session(current);
      }
      if (!current.session) fail('DEMO_SESSION_EXPIRED', 401);
      if (url.pathname === '/logout' && method === 'POST') {
        current.session = false;
        return { ...p1, authenticated: false };
      }
      const match = /^\/requests\/([^/]+)\/(followups|visits)$/.exec(url.pathname);
      if (match && method === 'POST')
        return match[2] === 'followups'
          ? followup(current, match[1], url.pathname, options.body, now)
          : visit(current, match[1], url.pathname, options.body, now);
      if (url.pathname === '/resources' && method === 'POST')
        return replayableWrite(current, method + url.pathname, options.body, (body) =>
          resources(current, body, now),
        );
      if (url.pathname === '/reports' && method === 'POST') {
        const body = parse(
          z
            .object({
              operationId: guid,
              from: z.iso.date(),
              to: z.iso.date(),
              institutionId: z.string().nullish(),
              source: z.string().nullish(),
            })
            .strict(),
          options.body,
        );
        const replayed = replay(current, url.pathname, body);
        if (replayed) return clone(replayed.response);
        const { operationId: _, ...filters } = body;
        let report;
        try {
          report = buildReport(current, filters, new Date(now));
        } catch (error) {
          if (error instanceof Error && error.message === 'INVALID_FILTER') fail('INVALID_FILTER');
          throw error;
        }
        current.reports[report.snapshotId] = clone(report);
        return receipt(current, url.pathname, body, { ...p1, report });
      }
      if (url.pathname === '/institutions/import-baseline' && method === 'POST')
        return baseline(current, url.pathname, options.body);
      const institutionMatch =
        /^\/institutions\/([^/]+)\/(draft|confirm|publish|service-access)$/.exec(url.pathname);
      if (institutionMatch) {
        const write = (body: unknown) =>
          institutions(
            current,
            url.pathname,
            method,
            body,
            now,
            decodeURIComponent(institutionMatch[1]),
            institutionMatch[2],
          );
        return ['draft', 'confirm'].includes(institutionMatch[2])
          ? replayableWrite(current, method + url.pathname, options.body, write)
          : write(options.body);
      }
      if (url.pathname === '/institutions' && method === 'POST')
        return replayableWrite(current, method + url.pathname, options.body, (body) =>
          institutions(current, url.pathname, method, body, now),
        );
      fail('DEMO_ENDPOINT_UNSUPPORTED', 404);
    },
    generation,
    ['/login', '/logout'].includes(url.pathname) ? 'session' : 'write',
  );
  if (selectedFault === 'after-write')
    throw new ApiError(
      '模拟已写入但响应丢失；请查询记录，或使用原编号和内容重试。',
      0,
      'DEMO_RESPONSE_LOST',
    );
  return response;
}
// These production-shaped DTOs do not carry operationId; the demo transport supplies it.
// Strip only that demo envelope, then run the unchanged DTO validation in the same transaction.
function replayableWrite(
  state: DemoState,
  path: string,
  input: unknown,
  write: (body: unknown) => unknown,
) {
  if (!input || typeof input !== 'object' || !('operationId' in input)) return write(input);
  const operationId = parse(guid, input.operationId);
  const body = input as { operationId: string };
  const old = replay(state, path, body);
  if (old) return clone(old.response);
  const { operationId: _, ...payload } = input as Record<string, unknown>;
  return receipt(state, path, { ...body, operationId }, write(payload));
}
export async function createSyntheticRequest(
  options: { kind?: 'CONSULTATION' | 'VISIT_INTENT'; institutionId?: string } = {},
): Promise<Detail> {
  const state = await readDemo();
  return transact((current) => {
    const entry = createRequest(current);
    entry.item.kind = options.kind ?? 'VISIT_INTENT';
    if (options.institutionId) {
      const d = institution(current, options.institutionId).draft;
      if (!d.serviceAccess.enabled || !d.currentRecordRevision) fail('INSTITUTION_UNAVAILABLE');
      entry.item.institutionId = options.institutionId;
      entry.item.institutionName = institutionName(current, options.institutionId);
    } else {
      entry.item.institutionId = null;
      entry.item.institutionName = null;
    }
    entry.item.createdAt = new Date().toISOString();
    entry.events[0].occurredAt = entry.item.createdAt;
    current.requests[entry.item.id] = entry;
    return detail(entry);
  }, state.generation);
}
export async function expireDemoSession() {
  await transact(
    (state) => {
      state.session = false;
    },
    undefined,
    'session',
  );
}
export async function loadHistoricalScenario(): Promise<Detail> {
  const state = await readDemo();
  return transact((current) => {
    const entry = createRequest(current);
    entry.item.kind = 'VISIT_INTENT';
    if (!entry.item.institutionId) fail('INSTITUTION_UNAVAILABLE');
    const start = new Date(Date.now() - 2 * 86400000).toISOString(),
      end = new Date(Date.parse(start) + 3600000).toISOString(),
      id = crypto.randomUUID();
    entry.item.createdAt = new Date(Date.parse(start) - 86400000).toISOString();
    entry.events[0].occurredAt = entry.item.createdAt;
    entry.item.visits.push({
      id,
      revision: 1,
      institutionId: entry.item.institutionId,
      institutionName: entry.item.institutionName!,
      staffId: '演示历史顾问',
      status: 'CONFIRMED',
      start,
      end,
      bufferBefore: 30,
      bufferAfter: 30,
      meetingNote: '合成历史场景，可登记已到访或未到访',
      familyConfirmed: true,
      institutionConfirmed: true,
      actualAt: null,
    });
    entry.visitUpdatedAt[id] = entry.item.createdAt;
    entry.events.push({
      operationId: crypto.randomUUID(),
      type: 'VISIT_CONFIRM',
      occurredAt: entry.item.createdAt,
      details: { visitId: id, institutionId: entry.item.institutionId },
    });
    entry.item.status = 'CONFIRMED';
    current.requests[entry.item.id] = entry;
    return detail(entry);
  }, state.generation);
}
export async function exportBaselineDemo(): Promise<string> {
  const state = await readDemo();
  const records = Object.values(state.institutions)
    .filter((x) => x.draft.currentRecordRevision)
    .map((x) => clone(x.versions[String(x.draft.currentRecordRevision)].record));
  return JSON.stringify(
    {
      syntheticMarker: 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY',
      schemaVersion: 1,
      catalog: {
        datasetVersion: 'demo-baseline-v1',
        datasetMode: 'SYNTHETIC_TEST_ONLY',
        records,
        currentPointers: records.map((r) => ({
          institutionId: r!.institutionId,
          recordRevision: r!.recordRevision,
        })),
        presentation: { orderingPolicy: 'CANONICAL_IDENTITY_ASC_V1', displayOrder: [] },
      },
      historicalRecords: [],
    },
    null,
    2,
  );
}
