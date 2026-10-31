import type { z } from 'zod';
import type { Draft, Detail, RequestItem, reportSchema } from '../api/schema';

export type DemoRequest = {
  item: RequestItem;
  subjectId: string;
  events: Detail['events'];
  nextContact?: Detail['nextContact'];
  workflowStatus: RequestItem['status'];
  visitUpdatedAt: Record<string, string>;
};
export type DemoInstitution = {
  draft: Draft;
  versions: Record<string, { record: Draft['record']; publicProfile: Draft['publicProfile'] }>;
  confirmedContent?: string;
};
export type DemoState = {
  syntheticMarker: 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY';
  schemaVersion: 1;
  seedVersion: 1;
  datasetId: string;
  generation: number;
  anchorDay: string;
  session: boolean;
  requests: Record<string, DemoRequest>;
  institutions: Record<string, DemoInstitution>;
  reports: Record<string, z.infer<typeof reportSchema>['report']>;
  blocks: Record<string, { id: string; staffId: string; start: string; end: string }>;
  capacities: Record<string, number>;
  receipts: Record<string, { signature: string; response: unknown }>;
};
export type DemoEvent = { kind: 'write' | 'reset' | 'session'; generation: number };
export type DemoFault = { mode: 'before-write' | 'after-write'; path: string; method: string };
