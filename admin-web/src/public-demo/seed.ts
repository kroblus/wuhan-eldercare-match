import { createUnknownProductionRecord } from '../../../miniprogram/domain/institution/v1-2-1/unknown-record';
import { recordSchema, type RequestItem, type Visit, type Draft } from '../api/schema';
import type { DemoState, DemoRequest } from './types';
import { canonical } from './canonical';

export const beijingDay = (now = new Date()) =>
  new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
export const dayAt = (anchor: string, offset: number, hour = 10) =>
  new Date(
    Date.parse(anchor + 'T00:00:00+08:00') + offset * 86400000 + hour * 3600000,
  ).toISOString();
export function templateRecord(id: string) {
  return recordSchema.parse(createUnknownProductionRecord(id));
}
export function emptyDraft(id: string): Draft {
  return {
    institutionId: id,
    draftRevision: 0,
    baseRecordRevision: null,
    currentRecordRevision: null,
    status: 'NONE',
    record: null,
    publicProfile: null,
    confirmation: null,
    publishedRecordRevision: null,
    serviceAccess: { enabled: false, accessRevision: 0 },
  };
}
export function createRequest(
  state: DemoState,
  index = Object.keys(state.requests).length,
): DemoRequest {
  const institutions = Object.values(state.institutions).filter(
    (x) => x.draft.serviceAccess.enabled,
  );
  const institution = institutions[index % institutions.length]?.draft;
  const id = crypto.randomUUID();
  const item: RequestItem = {
    id,
    kind: index % 3 ? 'VISIT_INTENT' : 'CONSULTATION',
    status: 'PENDING_CONTACT',
    datasetMode: 'SYNTHETIC_TEST_ONLY',
    createdAt: new Date(
      Math.min(Date.now(), Date.parse(dayAt(state.anchorDay, -(index % 28), 8 + (index % 10)))),
    ).toISOString(),
    institutionId: institution?.institutionId ?? null,
    institutionName: institution?.publicProfile?.name ?? null,
    contactName: '演示联系人 ' + String(index + 1).padStart(3, '0'),
    contactPhone: '演示联络号 DEMO-' + String(index + 1).padStart(4, '0'),
    relationship: ['FAMILY', 'SELF', 'OTHER'][index % 3],
    serviceScenario: ['LONG_TERM', 'SHORT_STAY', 'POST_OPERATION'][index % 3],
    preferredWindow: index % 2 ? '演示：工作日时段，尚未确认' : null,
    partySize: 1 + (index % 3),
    assistanceNote: index % 4 ? null : '纯合成：希望了解无障碍参观路线',
    source: ['MINIPROGRAM', 'OFFLINE_MANUAL', 'SELF_TEST', 'SYNTHETIC_TEST_ONLY'][index % 4],
    consentVersion: 'DEMO_NOTICE_V1',
    visits: [],
  };
  return {
    item,
    subjectId: 'demo-account-' + Math.floor(index / 2),
    events: [
      {
        type: 'REQUEST_SUBMITTED',
        occurredAt: item.createdAt,
        details: { note: '纯合成演示申请，不代表真实服务' },
      },
    ],
    nextContact: null,
    workflowStatus: 'PENDING_CONTACT',
    visitUpdatedAt: {},
  };
}
export function createSeed(anchorDay = beijingDay(), generation = 1): DemoState {
  const state: DemoState = {
    syntheticMarker: 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY',
    schemaVersion: 1,
    seedVersion: 1,
    datasetId: 'demo-dataset-' + crypto.randomUUID(),
    generation,
    anchorDay,
    session: false,
    requests: {},
    institutions: {},
    reports: {},
    blocks: {},
    capacities: {},
    receipts: {},
  };
  for (let i = 0; i < 7; i++) {
    const id = 'demo-institution-' + (i + 1),
      name = '合成演示机构 ' + String.fromCharCode(65 + i);
    const record = templateRecord(id);
    record.identity.name = {
      availability: 'provided',
      value: name,
      verification: { status: 'unverified', evidenceIds: [] },
    };
    record.identity.regionCode = {
      availability: 'provided',
      value: '420100',
      verification: { status: 'unverified', evidenceIds: [] },
    };
    record.identity.regionDisplayName = {
      availability: 'provided',
      value: '演示地区',
      verification: { status: 'unverified', evidenceIds: [] },
    };
    record.recordStatus = i < 5 ? 'published' : 'draft';
    const publicProfile: NonNullable<Draft['publicProfile']> = {
      schemaVersion: 'institution-public-profile-v1',
      id,
      name,
      source: '纯合成演示资料，所有价格和能力均为虚构',
      room: '演示房型',
      address: '演示区域 ' + (i + 1) + ' 号虚构地址',
      nature: '演示机构性质（虚构）',
      tags: ['合成演示'],
      tagNote: '标签不代表医疗或护理资格',
      prices: ['演示基础档', '演示照护档'].map((level, j) => ({
        level,
        bed: 1800 + 100 * i,
        care: 500 + j * 600,
        food: 700,
        total: 3000 + i * 100 + j * 600,
      })),
      otherFees: '演示：其他费用未知',
      priceNote: '虚构价格，不可用于真实咨询',
      historyNote: '纯合成，无真实核验历史',
    };
    const draft: Draft = {
      ...emptyDraft(id),
      draftRevision: 1,
      baseRecordRevision: i < 5 ? 1 : 0,
      currentRecordRevision: i < 5 ? 1 : null,
      status: i < 5 ? 'PUBLISHED' : 'DRAFT',
      record,
      publicProfile,
      publishedRecordRevision: i < 5 ? 1 : null,
      serviceAccess: { enabled: i < 4, accessRevision: 1 },
    };
    state.institutions[id] = {
      draft,
      versions:
        i < 5
          ? {
              '1': {
                record: structuredClone(record),
                publicProfile: structuredClone(publicProfile),
              },
            }
          : {},
    };
    if (i < 3) state.capacities[id] = 2 + i;
    if (i === 4) {
      draft.status = 'CONFIRMED';
      draft.draftRevision = 2;
      draft.publishedRecordRevision = null;
      record.recordStatus = 'draft';
      draft.confirmation = {
        sourceReference: '合成演示来源，仅本浏览器有效',
        confirmedBy: '演示运营员',
        confirmedOn: anchorDay,
      };
      state.institutions[id].confirmedContent = canonical([record, publicProfile]);
    }
    if (i === 6) state.institutions[id].draft = emptyDraft(id);
  }
  const followup = [
    'CONNECTED',
    'NO_ANSWER',
    'REFUSED',
    'MOVED_IN',
    'NOT_MOVED_IN',
    'UNKNOWN_FEEDBACK',
  ];
  for (let i = 0; i < 76; i++) {
    const entry = createRequest(state, i),
      item = entry.item;
    if (i % 8 !== 0) {
      const result = followup[(i + Math.floor(i / 6)) % followup.length];
      const occurredAt = new Date(
        Math.max(
          Date.parse(item.createdAt),
          Math.min(Date.now(), Date.parse(dayAt(anchorDay, -(i % 6), 9))),
        ),
      ).toISOString();
      entry.events.push({
        operationId: crypto.randomUUID(),
        type: 'FOLLOWUP',
        occurredAt,
        details: {
          result,
          note: '纯合成演示跟进',
          ...(result.includes('MOVED') || result === 'UNKNOWN_FEEDBACK'
            ? { feedbackSource: 'FAMILY', institutionId: item.institutionId }
            : {}),
        },
      });
      if (result === 'REFUSED') entry.workflowStatus = item.status = 'CLOSED';
      else
        entry.workflowStatus = item.status =
          item.kind === 'VISIT_INTENT' && result === 'CONNECTED'
            ? 'PENDING_ARRANGEMENT'
            : 'FOLLOWING_UP';
      if (result === 'NO_ANSWER')
        entry.nextContact = {
          nextContactAt: dayAt(anchorDay, i % 2 ? 1 : -1, 14),
          nextAction: '演示：再次联系',
        };
    }
    if (i % 4 === 1 && item.status !== 'CLOSED') {
      const status: Visit['status'] = ['CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELLED', 'DRAFT'][
        Math.floor(i / 4) % 5
      ] as Visit['status'];
      const offset = status === 'CONFIRMED' || status === 'DRAFT' ? i % 6 : -((i % 7) + 1);
      const visit: Visit = {
        id: crypto.randomUUID(),
        revision: 1,
        institutionId: item.institutionId!,
        institutionName: item.institutionName!,
        staffId: '演示顾问-' + ((i % 4) + 1),
        status,
        start: dayAt(anchorDay, offset, 9 + (i % 7)),
        end: dayAt(anchorDay, offset, 10 + (i % 7)),
        bufferBefore: 20,
        bufferAfter: 30,
        meetingNote: '合成演示集合点，勿前往',
        familyConfirmed: status !== 'DRAFT',
        institutionConfirmed: status !== 'DRAFT',
        actualAt: ['ARRIVED', 'NO_SHOW'].includes(status)
          ? dayAt(anchorDay, offset, 9 + (i % 7))
          : null,
      };
      item.visits.push(visit);
      entry.visitUpdatedAt[visit.id] = dayAt(anchorDay, offset, 11);
      entry.events.push({
        operationId: crypto.randomUUID(),
        type:
          'VISIT_' +
          {
            CONFIRMED: 'CONFIRM',
            ARRIVED: 'ARRIVE',
            NO_SHOW: 'NO_SHOW',
            CANCELLED: 'CANCEL',
            DRAFT: 'SAVE_DRAFT',
          }[status],
        occurredAt: dayAt(anchorDay, Math.min(offset, 0), 11),
        details: { visitId: visit.id, institutionId: visit.institutionId, action: status },
      });
      if (status === 'CONFIRMED') item.status = 'CONFIRMED';
      else if (status === 'ARRIVED') item.status = 'VISITED';
      else if (status === 'NO_SHOW') item.status = 'NO_SHOW';
    }
    if (i === 75) entry.workflowStatus = item.status = 'CANCELLED';
    state.requests[item.id] = entry;
  }
  const blockId = crypto.randomUUID();
  state.blocks[blockId] = {
    id: blockId,
    staffId: '演示顾问-1',
    start: dayAt(anchorDay, 1, 13),
    end: dayAt(anchorDay, 1, 15),
  };
  return state;
}
