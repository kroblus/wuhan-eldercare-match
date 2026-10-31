import type { z } from 'zod';
export const API = '/api/v1/p1-service/admin';
import { ApiError, errors } from './errors';
export { ApiError, describe } from './errors';
export class AdminClient {
  private csrf = '';
  epoch = 0;
  onExpired: () => void = () => {};
  onReset: () => void = () => {};
  prepareMutationBody(body: unknown) {
    return body;
  }
  subscribe(_listener: () => void): () => void {
    return () => {};
  }
  establish(csrf: string) {
    this.epoch++;
    this.csrf = csrf;
  }
  clear() {
    this.epoch++;
    this.csrf = '';
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { method?: string; body?: unknown; login?: boolean } = {},
  ): Promise<T> {
    const epoch = this.epoch;
    const response = await fetch(API + path, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.login
          ? { 'X-P1-Admin-Request': '1' }
          : options.method
            ? { 'X-P1-CSRF': this.csrf }
            : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    if (epoch !== this.epoch) throw new ApiError('旧会话响应已忽略。', 0, 'STALE_SESSION');
    if (response.status === 401) {
      this.clear();
      this.onExpired();
      throw new ApiError('登录已失效，请重新登录。', 401);
    }
    const body: unknown = await response.json().catch(() => null);
    if (epoch !== this.epoch) throw new ApiError('旧会话响应已忽略。', 0, 'STALE_SESSION');
    if (!response.ok) {
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : '';
      throw new ApiError(
        errors[code] ||
          (response.status === 403
            ? '操作未获授权，请重新登录。'
            : response.status >= 500
              ? options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())
                ? '服务暂不可用；写入结果尚未确认。'
                : '服务暂不可用，请稍后刷新。'
              : '请求未完成，请检查输入。'),
        response.status,
        code,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        '响应资料不完整，未替换本地内容；请查询服务器实际状态。',
        0,
        'INVALID_RESPONSE',
      );
    return parsed.data;
  }
  async download(snapshotId: string): Promise<Blob> {
    const epoch = this.epoch;
    const response = await fetch(API + '/reports/' + encodeURIComponent(snapshotId) + '/xlsx', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-P1-CSRF': this.csrf },
      signal: AbortSignal.timeout(30000),
    });
    if (epoch !== this.epoch) throw new ApiError('旧会话响应已忽略。', 0, 'STALE_SESSION');
    if (response.status === 401) {
      this.clear();
      this.onExpired();
      throw new ApiError('登录失效。', 401);
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('spreadsheetml'))
      throw new ApiError('导出未完成，请重试原批次。', response.status);
    const blob = await response.blob();
    if (epoch !== this.epoch) throw new ApiError('旧会话响应已忽略。', 0, 'STALE_SESSION');
    return blob;
  }
}
export const client = new AdminClient();
