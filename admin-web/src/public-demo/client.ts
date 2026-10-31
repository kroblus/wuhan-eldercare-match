import type { z } from 'zod';
import { ApiError } from '../api/errors';
import { initializeDemo, readDemo, subscribeDemo } from './store';
import { demoRequest } from './service';
export { ApiError } from '../api/errors';
export const describe = (e: unknown) =>
  (e instanceof Error ? e.message : '模拟操作未完成，请重试。')
    .replaceAll('服务器', '模拟服务')
    .replaceAll('登录', '演示会话');
export const API = 'PUBLIC_DEMO_LOCAL_ONLY';
export class AdminClient {
  epoch = 0;
  onExpired: () => void = () => {};
  onReset: () => void = () => {};
  prepareMutationBody(body: unknown) {
    return body && typeof body === 'object' && !Array.isArray(body) && !('operationId' in body)
      ? { ...body, operationId: crypto.randomUUID() }
      : body;
  }
  private generation: number | undefined;
  private listeners = new Set<() => void>();
  constructor() {
    subscribeDemo((event) => {
      if (event.kind === 'reset') {
        this.generation = event.generation;
        this.clear();
        this.onReset();
      } else if (event.kind === 'session')
        void readDemo()
          .then((s) => {
            if (!s.session) {
              this.clear();
              this.onExpired();
            }
          })
          .catch(() => {});
      for (const fn of this.listeners) fn();
    });
  }
  establish(_csrf: string) {
    this.epoch++;
  }
  clear() {
    this.epoch++;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { method?: string; body?: unknown; login?: boolean } = {},
  ) {
    await initializeDemo();
    if (this.generation === undefined) this.generation = (await readDemo()).generation;
    const epoch = this.epoch;
    try {
      const response = await demoRequest(path, options, this.generation);
      if (epoch !== this.epoch && path !== '/logout')
        throw new ApiError('演示状态已变化，旧响应已忽略。', 409, 'STALE_SESSION');
      const parsed = schema.safeParse(response);
      if (!parsed.success) throw new ApiError('模拟响应未通过资料校验。', 0, 'INVALID_RESPONSE');
      return parsed.data;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.clear();
        this.onExpired();
      }
      throw e;
    }
  }
  async download(snapshotId: string): Promise<Blob> {
    const state = await readDemo(),
      epoch = this.epoch;
    if (!state.session) {
      this.clear();
      this.onExpired();
      throw new ApiError('演示会话已失效。', 401);
    }
    const report = state.reports[snapshotId];
    if (!report) throw new ApiError('本批次不存在，请重新生成演示报告。', 404);
    const { buildWorkbook } = await import('./workbook');
    const result = await buildWorkbook(structuredClone(report));
    if (epoch !== this.epoch || (await readDemo()).generation !== state.generation)
      throw new ApiError('演示状态已变化，下载已取消。', 409);
    return result;
  }
}
export const client = new AdminClient();
