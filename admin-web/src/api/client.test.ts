import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { AdminClient, ApiError } from './client';
import { publication, p1, sessionSchema, detailSchema } from './schema';
const envelope = { contractVersion: 'p1-service-request-v1' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let api: AdminClient;
beforeEach(() => {
  api = new AdminClient();
  api.establish('synthetic-csrf');
});
afterEach(() => vi.unstubAllGlobals());
describe('same-origin API boundary', () => {
  it('does not imply an uncertain write when a read-only service is disabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'SERVICE_UNAVAILABLE' }, 503)));
    await expect(api.request('/requests', p1)).rejects.toThrow('服务暂不可用，请稍后刷新。');
  });
  it('keeps the uncertain-write warning for a failed mutation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'SERVICE_UNAVAILABLE' }, 503)));
    await expect(api.request('/resources', p1, { method: 'POST', body: {} })).rejects.toThrow(
      '服务暂不可用；写入结果尚未确认。',
    );
  });
  it('uses JSON, same-origin cookies, no-store and CSRF for mutations; no automatic retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(envelope));
    vi.stubGlobal('fetch', fetcher);
    await api.request('/resources', p1, {
      method: 'POST',
      body: { action: 'CAPACITY', capacity: 0, institutionId: 'synthetic' },
    });
    const [path, options] = fetcher.mock.calls[0];
    expect(path).toBe('/api/v1/p1-service/admin/resources');
    expect(options.credentials).toBe('same-origin');
    expect(options.cache).toBe('no-store');
    expect(options.headers['X-P1-CSRF']).toBe('synthetic-csrf');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('login uses required marker and only exact supplied credentials', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        json({ ...envelope, authenticated: true, username: 'fixture', csrfToken: 'fixture-token' }),
      );
    vi.stubGlobal('fetch', fetcher);
    await api.request('/login', sessionSchema, {
      method: 'POST',
      login: true,
      body: { username: 'fixture', password: 'fixture-only' },
    });
    expect(fetcher.mock.calls[0][1].headers['X-P1-Admin-Request']).toBe('1');
    expect(fetcher.mock.calls[0][1].headers['X-P1-CSRF']).toBeUndefined();
  });
  it('rejects malformed or missing publication environment', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ contractVersion: 'institution-publications-v1', dataEnvironment: 'DEMO' }),
        ),
    );
    await expect(api.request('/institutions', publication)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 0,
    });
  });
  it('preserves structured conflict status without pretending success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'STALE_DRAFT_REVISION' }, 409)));
    await expect(api.request('/institutions/synthetic/draft', publication)).rejects.toMatchObject({
      status: 409,
      code: 'STALE_DRAFT_REVISION',
    });
  });
  it('401 expires scoped session and ignores an older successful response', async () => {
    let late!: (r: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            late = resolve;
          }),
      )
      .mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal('fetch', fetcher);
    const expired = vi.fn();
    api.onExpired = expired;
    const waiting = api.request('/requests', p1);
    await expect(api.request('/session', sessionSchema)).rejects.toBeInstanceOf(ApiError);
    late(json(envelope));
    await expect(waiting).rejects.toMatchObject({ code: 'STALE_SESSION' });
    expect(expired).toHaveBeenCalledTimes(1);
  });
  it('rejects an old-session response even when its JSON finishes after a new login', async () => {
    let resolveBody!: (v: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => {
            resolveBody = resolve;
          }),
      }),
    );
    const waiting = api.request('/requests', p1);
    await Promise.resolve();
    api.establish('new-session');
    resolveBody(envelope);
    await expect(waiting).rejects.toMatchObject({ code: 'STALE_SESSION' });
  });
  it('validates XLSX MIME and sends CSRF for snapshot export', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('bad html', { headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(api.download('fixture-snapshot')).rejects.toThrow('导出未完成');
    expect(fetcher.mock.calls[0][1].headers['X-P1-CSRF']).toBe('synthetic-csrf');
  });
  it('does not accept detail with missing internal visits or unknown dataset', () => {
    expect(
      detailSchema.safeParse({
        ...envelope,
        item: {
          id: '00000000-0000-4000-8000-000000000001',
          kind: 'CONSULTATION',
          status: 'PENDING_CONTACT',
          datasetMode: 'DEMO',
          createdAt: '2026-10-28T00:00:00Z',
        },
        events: [],
      }).success,
    ).toBe(false);
    expect(z.string().parse('safe text')).toBe('safe text');
  });
});
