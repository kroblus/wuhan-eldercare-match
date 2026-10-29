import { expect, it } from 'vitest';
import { recordSchema, requestSchema, priceSchema } from './schema';

it('keeps legacy UUID-shaped IDs without accepting arbitrary strings', () => {
  const id = requestSchema.shape.id;
  expect(id.parse('abcdefab-cdef-abcd-abcd-abcdefabcdef')).toBe(
    'abcdefab-cdef-abcd-abcd-abcdefabcdef',
  );
  expect(id.parse('00000000-0000-0000-0000-000000000000')).toBe(
    '00000000-0000-0000-0000-000000000000',
  );
  expect(id.safeParse('not-an-id').success).toBe(false);
});

it('preserves unknown, absent and false facts and passthrough evidence after Zod 4 migration', () => {
  const record = {
    institutionId: 'synthetic',
    recordRevision: 1,
    recordStatus: 'draft',
    identity: {
      unknown: { availability: 'unknown', value: null },
      absent: { availability: 'unavailable' },
      denied: { value: false, verification: { status: 'unverified' } },
    },
    capabilities: { nursing: { status: 'unknown' } },
    evidence: [{ fieldPath: 'identity.denied', recordRevision: 1, source: 'synthetic' }],
  };
  expect(recordSchema.parse(record)).toEqual(record);
  expect(recordSchema.safeParse({ ...record, identity: { bad: 'not-a-fact' } }).success).toBe(
    false,
  );
});

it('keeps price totals and invalid input rejection at the API boundary', () => {
  const price = { level: '合成', bed: 100, care: 200, food: 300, total: 600 };
  expect(priceSchema.parse(price)).toEqual(price);
  expect(priceSchema.safeParse({ ...price, total: 601 }).success).toBe(false);
  expect(priceSchema.safeParse({ ...price, bed: -1 }).success).toBe(false);
  expect(priceSchema.safeParse({ ...price, bed: '100' }).success).toBe(false);
});
