import { z } from 'zod';
export const environment = z.enum(['PRODUCTION', 'SYNTHETIC_TEST_ONLY']);
export const p1 = z.object({ contractVersion: z.literal('p1-service-request-v1') });
export const publication = z.object({
  contractVersion: z.literal('institution-publications-v1'),
  dataEnvironment: environment,
});
export const sessionSchema = p1.extend({
  authenticated: z.literal(true),
  username: z.string().min(1),
  csrfToken: z.string().min(1),
});
const date = z.string().refine((v) => Number.isFinite(Date.parse(v)));
export const statusLabels = {
  PENDING_CONTACT: '待联系',
  FOLLOWING_UP: '跟进中',
  PENDING_ARRANGEMENT: '待安排',
  CONFIRMED: '已确认带看',
  VISITED: '已到访',
  NO_SHOW: '未到访',
  CLOSED: '结束联系',
  CANCELLED: '已取消',
};
export const kindLabels = { CONSULTATION: '普通咨询', VISIT_INTENT: '带看意向' };
export const visitLabels = {
  DRAFT: '待双方确认',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  ARRIVED: '已到访',
  NO_SHOW: '未到访',
};
export const followupLabels = {
  CONNECTED: '已接通',
  NO_ANSWER: '未接通',
  REFUSED: '拒绝联系',
  MOVED_IN: '反馈已入住',
  NOT_MOVED_IN: '反馈未入住',
  UNKNOWN_FEEDBACK: '入住情况未知',
};
export const visitSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int(),
  institutionId: z.string(),
  institutionName: z.string(),
  staffId: z.string(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED', 'ARRIVED', 'NO_SHOW']),
  start: date,
  end: date,
  bufferBefore: z.number(),
  bufferAfter: z.number(),
  meetingNote: z.string(),
  familyConfirmed: z.boolean(),
  institutionConfirmed: z.boolean(),
  actualAt: date.nullish(),
  requestId: z.string().optional(),
});
export const requestSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['CONSULTATION', 'VISIT_INTENT']),
  status: z.enum([
    'PENDING_CONTACT',
    'FOLLOWING_UP',
    'PENDING_ARRANGEMENT',
    'CONFIRMED',
    'VISITED',
    'NO_SHOW',
    'CLOSED',
    'CANCELLED',
  ]),
  datasetMode: environment,
  createdAt: date,
  institutionId: z.string().nullish(),
  institutionName: z.string().nullish(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  relationship: z.string().optional(),
  serviceScenario: z.string().optional(),
  preferredWindow: z.string().nullish(),
  partySize: z.number().optional(),
  assistanceNote: z.string().nullish(),
  source: z.string().optional(),
  consentVersion: z.string().optional(),
  visits: z.array(visitSchema),
});
export const listSchema = p1.extend({
  items: z.array(requestSchema.omit({ visits: true })),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export const eventSchema = z.object({
  operationId: z.string().nullish(),
  type: z.string(),
  occurredAt: date,
  details: z
    .object({
      result: z.string().nullish(),
      note: z.string().nullish(),
      nextAction: z.string().nullish(),
      nextContactAt: date.nullish(),
      feedbackSource: z.string().nullish(),
      institutionName: z.string().nullish(),
      action: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
export const detailSchema = p1.extend({
  item: requestSchema,
  events: z.array(eventSchema),
  nextContact: z
    .object({ nextContactAt: date.nullish(), nextAction: z.string().nullish() })
    .nullish(),
});
export const serviceSchema = p1.extend({
  serviceInstitutions: z.array(
    z.object({
      institutionId: z.string(),
      institutionName: z.string(),
      enabled: z.boolean(),
      accessRevision: z.number().optional(),
      recordRevision: z.number().nullish(),
    }),
  ),
});
export const calendarSchema = p1.extend({
  visits: z.array(visitSchema.extend({ requestId: z.string().uuid() })),
  blocks: z.array(z.object({ id: z.string(), staffId: z.string(), start: date, end: date })),
  capacities: z.array(z.object({ institutionName: z.string(), capacity: z.number() })),
});
export const priceSchema = z
  .object({
    level: z.string().min(1),
    bed: z.number().int().nonnegative(),
    care: z.number().int().nonnegative(),
    food: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .refine((v) => v.total === v.bed + v.care + v.food, '总月费必须等于各分项之和');
export const profileSchema = z.object({
  schemaVersion: z.literal('institution-public-profile-v1'),
  id: z.string(),
  name: z.string(),
  source: z.string(),
  room: z.string(),
  address: z.string(),
  nature: z.string(),
  tags: z.array(z.string()),
  tagNote: z.string(),
  prices: z.array(priceSchema),
  otherFees: z.string(),
  priceNote: z.string(),
  historyNote: z.string(),
});
export const recordSchema = z
  .object({
    institutionId: z.string(),
    recordRevision: z.number().int(),
    recordStatus: z.string(),
    identity: z.record(z.object({ value: z.unknown() }).passthrough()),
    evidence: z
      .array(
        z
          .object({ fieldPath: z.string().optional(), recordRevision: z.number().nullish() })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
export const draftSchema = z
  .object({
    institutionId: z.string(),
    draftRevision: z.number().int().nonnegative(),
    baseRecordRevision: z.number().int().nullable(),
    currentRecordRevision: z.number().int().nullable(),
    status: z.enum(['NONE', 'DRAFT', 'CONFIRMED', 'PUBLISHED']),
    record: recordSchema.nullable(),
    publicProfile: profileSchema.nullable(),
    confirmation: z
      .object({ sourceReference: z.string(), confirmedBy: z.string(), confirmedOn: z.string() })
      .passthrough()
      .nullable(),
    publishedRecordRevision: z.number().int().nullable(),
    serviceAccess: z.object({
      enabled: z.boolean(),
      accessRevision: z.number().int().nonnegative(),
    }),
  })
  .refine(
    (d) =>
      (!d.record || d.record.institutionId === d.institutionId) &&
      (!d.publicProfile || d.publicProfile.id === d.institutionId),
    '机构关联不一致',
  );
export const draftResponse = publication.extend({ item: draftSchema });
export const institutionsSchema = publication.extend({
  items: z.array(
    z
      .object({
        institutionId: z.string(),
        name: z.string().nullish(),
        status: z.enum(['NONE', 'DRAFT', 'CONFIRMED', 'PUBLISHED']),
        draftRevision: z.number().int(),
        currentRecordRevision: z.number().int().nullable(),
      })
      .passthrough(),
  ),
});
export const templateSchema = publication.extend({ record: recordSchema });
export const publishSchema = draftResponse.extend({
  publication: z.object({
    institutionId: z.string(),
    recordRevision: z.number().int().positive(),
    status: z.enum(['PUBLISHED', 'REPLAYED']),
  }),
});
export const accessSchema = publication.extend({
  access: z.object({
    institutionId: z.string(),
    enabled: z.boolean(),
    accessRevision: z.number().int(),
  }),
});
export const importSchema = publication.extend({
  imported: z.number().int().nonnegative(),
  replayed: z.boolean(),
});
const metricCounts = [
  'newRequests',
  'visitIntentRequests',
  'contactEvents',
  'connectedEvents',
  'noAnswerEvents',
  'refusedEvents',
  'confirmedSessions',
  'rescheduledEvents',
  'arrivedSessions',
  'arrivedRequests',
  'noShowSessions',
  'cancelledSessions',
  'movedInFeedbackEvents',
  'notMovedInFeedbackEvents',
  'unknownFeedbackEvents',
  'cohortDenominator',
  'cohortContactedRequests',
  'cohortArrivedRequests',
  'cohortMovedInRequests',
];
const metrics = z.record(z.number().finite().nullable()).superRefine((value, ctx) => {
  for (const key of metricCounts)
    if (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0 || value[key] === null)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: '统计数量缺失或不合法' });
  if (
    value.cohortArrivalRate !== null &&
    !(
      typeof value.cohortArrivalRate === 'number' &&
      value.cohortArrivalRate >= 0 &&
      value.cohortArrivalRate <= 1
    )
  )
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cohortArrivalRate'],
      message: '比率缺失或不合法',
    });
});
export const reportSchema = p1.extend({
  report: z.object({
    snapshotId: z.string().uuid(),
    datasetMode: environment,
    timeZone: z.literal('Asia/Shanghai'),
    institutionId: z.string().nullish(),
    institutionName: z.string(),
    from: z.string(),
    to: z.string(),
    generatedAt: date,
    sourceFilter: z.string(),
    policyVersion: z.string(),
    warning: z.string(),
    metrics,
    profiles: z.array(
      z.object({
        dimension: z.string(),
        category: z.string(),
        count: z.number().nullable(),
        note: z.string(),
      }),
    ),
    institutions: z.array(z.object({ institutionName: z.string(), metrics })),
    sources: z.array(z.object({ source: z.string(), count: z.number() })),
    rules: z.array(z.string()),
  }),
});
export type Draft = z.infer<typeof draftSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type RequestItem = z.infer<typeof requestSchema>;
export type Detail = z.infer<typeof detailSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type ServiceInstitution = z.infer<typeof serviceSchema>['serviceInstitutions'][number];
