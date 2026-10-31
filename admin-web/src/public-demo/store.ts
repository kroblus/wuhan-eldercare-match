import { z } from 'zod';
import { detailSchema, draftSchema, reportSchema, statusLabels } from '../api/schema';
import { validateInstitutionRecordV121 } from '../../../miniprogram/domain/institution/v1-2-1/validate-institution-v1-2-1';
import { ApiError } from '../api/errors';
import { createSeed } from './seed';
import type { DemoEvent, DemoFault, DemoState } from './types';

const DB = 'p1-admin-public-demo-v1',
  STORE = 'demo',
  KEY = 'state';
const listeners = new Set<(event: DemoEvent) => void>();
const faultListeners = new Set<(fault: DemoFault | undefined) => void>();
const NOTIFY = 'p1-admin-public-demo:notification';
let connection: Promise<IDBDatabase> | undefined;
let fault: DemoFault | undefined;
let channel: BroadcastChannel | undefined;
let storageNotifications = false;
function receive(event: DemoEvent) {
  if (
    event &&
    ['write', 'reset', 'session'].includes(event.kind) &&
    Number.isSafeInteger(event.generation)
  ) {
    if (event.kind === 'reset') armFault(null);
    listeners.forEach((listener) => listener(event));
  }
}
function broadcast(event: DemoEvent) {
  listeners.forEach((listener) => listener(event));
  channel?.postMessage(event);
  if (storageNotifications) {
    try {
      localStorage.setItem(NOTIFY, JSON.stringify({ ...event, nonce: crypto.randomUUID() }));
    } catch {
      throw new ApiError(
        '演示已保存，但跨标签通知失败。请刷新所有演示标签后核对。',
        0,
        'DEMO_NOTIFICATION_FAILED',
      );
    }
  }
}
function connect() {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(
        new ApiError('当前浏览器无法使用 IndexedDB，演示保存已停止。', 0, 'STORAGE_UNAVAILABLE'),
      );
      return;
    }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => {
      connection = undefined;
      reject(
        new ApiError('无法打开本地演示数据，请检查浏览器存储权限。', 0, 'STORAGE_UNAVAILABLE'),
      );
    };
    request.onblocked = () =>
      reject(new ApiError('其他窗口阻止存储升级，请关闭旧演示页后重试。', 0, 'STORAGE_BLOCKED'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      if (!channel && !storageNotifications) {
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel(DB);
            channel.onmessage = ({ data }: MessageEvent<DemoEvent>) => receive(data);
          }
        } catch {
          channel = undefined;
        }
        if (!channel) {
          try {
            localStorage.setItem(NOTIFY, JSON.stringify({ kind: 'probe' }));
            globalThis.addEventListener('storage', (event) => {
              if (event.key === NOTIFY && event.newValue) {
                let value: unknown;
                try {
                  value = JSON.parse(event.newValue);
                } catch {
                  return;
                }
                receive(value as DemoEvent);
              }
            });
            storageNotifications = true;
          } catch {
            db.close();
            connection = undefined;
            reject(
              new ApiError(
                '浏览器不支持跨标签演示通知，请允许本地存储或更换浏览器。当前演示保存已停止。',
                0,
                'DEMO_NOTIFICATION_UNAVAILABLE',
              ),
            );
            return;
          }
        }
      }
      resolve(db);
    };
  });
  return connection;
}
// Single object store + a synchronous callback keeps every read/check/write in one IDB transaction.
export async function transact<T>(
  fn: (state: DemoState) => T,
  expectedGeneration?: number,
  kind: DemoEvent['kind'] = 'write',
): Promise<T> {
  const db = await connect();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    let result: T,
      generation = 0,
      failure: unknown;
    const request = store.get(KEY);
    request.onsuccess = () => {
      try {
        const state = (request.result ?? createSeed()) as DemoState;
        if (
          state.schemaVersion !== 1 ||
          state.seedVersion !== 1 ||
          state.syntheticMarker !== 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY'
        )
          throw new ApiError(
            '演示数据版本不同，请先导出备份，再重置演示。',
            0,
            'UNSUPPORTED_DEMO_VERSION',
          );
        if (expectedGeneration !== undefined && state.generation !== expectedGeneration)
          throw new ApiError(
            '演示已被其他窗口重置，旧操作已忽略，请刷新。',
            409,
            'STALE_GENERATION',
          );
        result = fn(state);
        if (result instanceof Promise)
          throw new Error('Demo transaction callbacks must be synchronous');
        generation = state.generation;
        store.put(state, KEY);
      } catch (error) {
        failure =
          error instanceof DOMException
            ? new ApiError(
                '本地存储写入失败，内容未保存，请导出备份并检查浏览器空间。',
                0,
                'STORAGE_WRITE_FAILED',
              )
            : error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      try {
        broadcast({ kind, generation });
        resolve(structuredClone(result));
      } catch (error) {
        reject(error);
      }
    };
    transaction.onabort = transaction.onerror = () =>
      reject(
        failure ??
          new ApiError(
            '本地存储写入失败，内容未保存，请导出备份并检查浏览器空间。',
            0,
            'STORAGE_WRITE_FAILED',
          ),
      );
  });
}
export async function initializeDemo() {
  const db = await connect();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'),
      objectStore = tx.objectStore(STORE),
      request = objectStore.get(KEY);
    let error: unknown;
    request.onsuccess = () => {
      if (!request.result) objectStore.put(createSeed(), KEY);
      else if (
        request.result.schemaVersion !== 1 ||
        request.result.seedVersion !== 1 ||
        request.result.syntheticMarker !== 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY'
      ) {
        error = new ApiError(
          '演示数据版本不同，请先导出备份，再重置演示。',
          0,
          'UNSUPPORTED_DEMO_VERSION',
        );
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(error ?? new ApiError('演示初始化失败，请检查存储权限。', 0, 'STORAGE_UNAVAILABLE'));
  });
}
export async function readDemo(): Promise<DemoState> {
  const db = await connect();
  const result = await new Promise<DemoState | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new ApiError('读取本地演示失败，请检查存储权限。', 0, 'STORAGE_UNAVAILABLE'));
  });
  if (!result) {
    await initializeDemo();
    return readDemo();
  }
  if (
    result.schemaVersion !== 1 ||
    result.seedVersion !== 1 ||
    result.syntheticMarker !== 'P1_PUBLIC_DEMO_SYNTHETIC_ONLY'
  )
    throw new ApiError(
      '演示数据版本不同，请先导出备份，再重置演示。',
      0,
      'UNSUPPORTED_DEMO_VERSION',
    );
  return result;
}
export function subscribeDemo(listener: (event: DemoEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
async function replaceDemo(transform: (state: DemoState) => void) {
  // Reset deliberately accepts any prior schema, preserving an ever increasing generation.
  const db = await connect();
  const state = await new Promise<DemoState>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'),
      objectStore = tx.objectStore(STORE),
      get = objectStore.get(KEY);
    let next: DemoState;
    get.onsuccess = () => {
      next = createSeed(undefined, Math.max(0, Number(get.result?.generation) || 0) + 1);
      transform(next);
      objectStore.put(next, KEY);
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = tx.onerror = () =>
      reject(new ApiError('重置失败，原演示数据保留。', 0, 'STORAGE_WRITE_FAILED'));
  });
  armFault(null);
  broadcast({ kind: 'reset', generation: state.generation });
  return state;
}
export async function resetDemo() {
  return replaceDemo(() => undefined);
}
export async function clearDemo() {
  await replaceDemo((s) => {
    s.requests = {};
    s.institutions = {};
    s.capacities = {};
    s.reports = {};
    s.blocks = {};
    s.receipts = {};
  });
}
export async function loadEmptyScenario() {
  await replaceDemo((s) => {
    s.requests = {};
    s.reports = {};
    s.blocks = {};
    s.receipts = {};
  });
}
export async function exportDemo(): Promise<string> {
  // Raw export also works for a newer schema, so users can back up before resetting.
  const db = await connect();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(JSON.stringify(request.result ?? createSeed(), null, 2));
    request.onerror = () => reject(new ApiError('导出读取失败。', 0, 'STORAGE_UNAVAILABLE'));
  });
}
const workflow = z.enum(
  Object.keys(statusLabels) as [keyof typeof statusLabels, ...(keyof typeof statusLabels)[]],
);
const importedRequest = z
  .object({
    item: detailSchema.shape.item,
    events: detailSchema.shape.events,
    nextContact: detailSchema.shape.nextContact,
    subjectId: z.string().regex(/^demo-account-/),
    workflowStatus: workflow,
    visitUpdatedAt: z.record(z.string(), z.iso.datetime()),
  })
  .strict();
const stateSchema = z
  .object({
    syntheticMarker: z.literal('P1_PUBLIC_DEMO_SYNTHETIC_ONLY'),
    schemaVersion: z.literal(1),
    seedVersion: z.literal(1),
    datasetId: z.string().regex(/^demo-dataset-/),
    generation: z.number().int().positive(),
    anchorDay: z.iso.date(),
    session: z.boolean(),
    requests: z.record(z.string(), importedRequest),
    institutions: z.record(
      z.string(),
      z
        .object({
          draft: draftSchema,
          versions: z.record(
            z.string(),
            z
              .object({
                record: draftSchema.shape.record,
                publicProfile: draftSchema.shape.publicProfile,
              })
              .strict(),
          ),
          confirmedContent: z.string().optional(),
        })
        .strict(),
    ),
    reports: z.record(z.string(), reportSchema.shape.report),
    blocks: z.record(
      z.string(),
      z
        .object({
          id: z.string(),
          staffId: z.string().min(1),
          start: z.iso.datetime(),
          end: z.iso.datetime(),
        })
        .strict(),
    ),
    capacities: z.record(z.string(), z.number().int().min(1).max(100)),
    receipts: z.record(
      z.string(),
      z.object({ signature: z.string(), response: z.unknown() }).strict(),
    ),
  })
  .strict();
export function validateDemoImport(input: unknown): DemoState {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success)
    throw new ApiError('演示进度格式或版本不正确，原数据未替换。', 400, 'INVALID_DEMO_IMPORT');
  const state = parsed.data as DemoState;
  const invalid = () => {
    throw new ApiError('导入含非演示内容或关联错误，原数据未替换。', 400, 'INVALID_DEMO_IMPORT');
  };
  if (
    Object.keys(state.requests).length > 5000 ||
    Object.keys(state.institutions).length > 200 ||
    Object.keys(state.reports).length > 1000
  )
    invalid();
  const serialized = JSON.stringify(state);
  if (
    /(?:https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?<![0-9])1[3-9][0-9]{9}(?![0-9]))/i.test(
      serialized,
    )
  )
    invalid();
  const visits = new Set<string>();
  for (const [id, institution] of Object.entries(state.institutions)) {
    const d = institution.draft;
    if (
      !id.startsWith('demo-') ||
      d.institutionId !== id ||
      (d.record && d.record.institutionId !== id) ||
      (d.publicProfile &&
        (!d.publicProfile.name.startsWith('合成演示') ||
          d.publicProfile.name !== d.record?.identity.name?.value))
    )
      invalid();
    if (d.currentRecordRevision !== null && !institution.versions[String(d.currentRecordRevision)])
      invalid();
    for (const [revision, version] of Object.entries(institution.versions))
      if (
        !version.record ||
        !validateInstitutionRecordV121(version.record).ok ||
        version.record.institutionId !== id ||
        String(version.record.recordRevision) !== revision ||
        (version.publicProfile &&
          (version.publicProfile.id !== id ||
            version.publicProfile.name !== version.record.identity.name?.value))
      )
        invalid();
  }
  for (const [id, r] of Object.entries(state.requests)) {
    if (
      r.item.id !== id ||
      r.item.datasetMode !== 'SYNTHETIC_TEST_ONLY' ||
      !/^演示联系人 \d+$/.test(r.item.contactName ?? '') ||
      !/^演示联络号 DEMO-\d+$/.test(r.item.contactPhone ?? '') ||
      (r.item.institutionId && !state.institutions[r.item.institutionId])
    )
      invalid();
    for (const v of r.item.visits) {
      if (
        visits.has(v.id) ||
        !state.institutions[v.institutionId] ||
        Date.parse(v.start) >= Date.parse(v.end) ||
        v.revision < 1 ||
        v.bufferBefore < 0 ||
        v.bufferAfter < 0 ||
        v.bufferBefore > 240 ||
        v.bufferAfter > 240 ||
        (v.status === 'CONFIRMED' && (!v.familyConfirmed || !v.institutionConfirmed))
      )
        invalid();
      visits.add(v.id);
    }
    for (const event of r.events)
      if (
        (event.details?.institutionId &&
          !state.institutions[String(event.details.institutionId)]) ||
        (event.details?.visitId && !r.item.visits.some((v) => v.id === event.details?.visitId))
      )
        invalid();
    for (const id of Object.keys(r.visitUpdatedAt))
      if (!r.item.visits.some((v) => v.id === id)) invalid();
  }
  for (const [id, report] of Object.entries(state.reports))
    if (report.snapshotId !== id || report.datasetMode !== 'SYNTHETIC_TEST_ONLY') invalid();
  for (const [id, block] of Object.entries(state.blocks))
    if (id !== block.id || Date.parse(block.start) >= Date.parse(block.end)) invalid();
  for (const id of Object.keys(state.capacities)) if (!state.institutions[id]) invalid();
  return state;
}
export async function importDemo(text: string) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new ApiError('进度文件超过 2 MiB。', 413, 'INVALID_DEMO_IMPORT');
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new ApiError('进度文件不是有效 JSON，原数据未替换。', 400, 'INVALID_DEMO_IMPORT');
  }
  const next = validateDemoImport(input);
  await transact(
    (current) => {
      const generation = current.generation + 1;
      Object.assign(current, next, { generation, session: false });
    },
    undefined,
    'reset',
  );
  armFault(null);
}
export function getArmedFault() {
  return fault ? { ...fault } : undefined;
}
export function subscribeFault(listener: (fault: DemoFault | undefined) => void) {
  faultListeners.add(listener);
  return () => {
    faultListeners.delete(listener);
  };
}
export function armFault(value: DemoFault | null) {
  fault = value ? { ...value, method: value.method.toUpperCase() } : undefined;
  faultListeners.forEach((listener) => listener(getArmedFault()));
}
export function consumeFault(path: string, method: string) {
  if (fault?.path !== path || fault.method !== method) return undefined;
  const selected = fault.mode;
  armFault(null);
  return selected;
}
