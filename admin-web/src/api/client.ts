import type { z } from 'zod';
export const API = '/api/v1/p1-service/admin';
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = '',
  ) {
    super(message);
  }
}
const errors: Record<string, string> = {
  STAFF_CONFLICT: '负责人时段冲突（含交通缓冲），原安排保留。',
  SUBJECT_CONFLICT: '同一认证账号已有冲突安排。',
  STAFF_UNAVAILABLE: '负责人该时段不可用。',
  INSTITUTION_CAPACITY_CONFLICT: '超过机构配置的接待容量。',
  STALE_REVISION: '安排已更新，请读取最新记录后核对。',
  BOTH_CONFIRMATIONS_REQUIRED: '家属与机构均确认后才能排期。',
  REQUEST_CLOSED: '申请已取消或结束联系。',
  VISIT_ENDED: '这场已结束，不能覆盖历史。',
  INVALID_ACTUAL_TIME: '实际时间不正确，未来行程不能记录到访。',
  FEEDBACK_SOURCE_REQUIRED: '入住反馈需要来源与关联机构。',
  IDEMPOTENCY_CONFLICT: '操作编号与原内容不符，请查询服务器记录。',
  INVALID_NEXT_ACTION: '下次联系需为未来时间，并填写下一动作。',
  ACTIVE_SCHEDULES_EXIST: '仍有未来确认行程，请先处理再调整容量。',
  STALE_DRAFT_REVISION: '草稿已被另一位操作者更新。本地修改已保留。',
  BASE_REVISION_CONFLICT: '发布版本已变化，请核对最新草稿。',
  STALE_ACCESS_REVISION: '服务接入设置已变化，请刷新核对。',
  BASELINE_REVISION_CONFLICT: '相同版本内容不同，服务器拒绝覆盖。',
  CONFIRMATION_REQUIRED: '当前草稿尚未人工确认，或确认已经失效。',
  INVALID_PUBLIC_PROFILE: '公开介绍或价格不合法，请核对必填项及金额合计。',
  INVALID_RECORD: '机构事实未通过领域校验。',
  INVALID_CONFIRMATION_DATE: '确认日期不能是未来日期。',
  PUBLICATION_UNAVAILABLE: '机构资料维护尚未开通。',
  INSTITUTION_NOT_PUBLISHED: '先发布有效机构资料，再启用服务。',
};
export class AdminClient {
  private csrf = '';
  epoch = 0;
  onExpired: () => void = () => {};
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
export const describe = (error: unknown) =>
  error instanceof Error ? error.message : '请求未完成，请重试。';
