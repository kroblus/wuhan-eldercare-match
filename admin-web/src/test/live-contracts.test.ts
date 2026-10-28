// Explicit local synthetic integration only; never runs in CI or against a remote host.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  sessionSchema,
  listSchema,
  detailSchema,
  calendarSchema,
  serviceSchema,
  institutionsSchema,
  draftResponse,
  reportSchema,
} from '../api/schema';
import { today } from '../time';
describe.skipIf(process.env.ADMIN_LOCAL_HTTP !== '1')(
  'actual local synthetic response contracts',
  () => {
    it('accepts real session, pagination, detail, calendar, institution drafts and report snapshot', async () => {
      const runtime = JSON.parse(
        readFileSync(
          resolve(
            process.env.ADMIN_LOCAL_RUNTIME ||
              '../output/admin-react-rebuild-v1-20261028/backend/runtime.private.json',
          ),
          'utf8',
        ),
      );
      const base = new URL(runtime.baseUrl);
      if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.protocol !== 'http:')
        throw Error('Loopback HTTP fixture required');
      const config = await fetch(new URL('/api/v1/p1-service/config', base)).then((r) => r.json());
      expect(config.datasetMode).toBe('SYNTHETIC_TEST_ONLY');
      const prefix = new URL('/api/v1/p1-service/admin', base).href;
      const login = await fetch(prefix + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-P1-Admin-Request': '1' },
        body: JSON.stringify({ username: runtime.adminUsername, password: runtime.adminPassword }),
      });
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
      const session = sessionSchema.parse(await login.json());
      const read = async (path: string) => {
        const r = await fetch(prefix + path, { headers: { Cookie: cookie } });
        expect(r.status).toBe(200);
        return r.json();
      };
      const valid = (
        schema: {
          safeParse: (v: unknown) => {
            success: boolean;
            error?: { issues: { path: (string | number)[]; code: string }[] };
          };
        },
        body: unknown,
        label: string,
      ) => {
        const result = schema.safeParse(body);
        if (!result.success)
          throw Error(
            label +
              ': ' +
              result.error?.issues.map((i) => i.path.join('.') + ' ' + i.code).join('; '),
          );
      };
      const requests = await read('/requests?limit=25&offset=0');
      valid(listSchema, requests, 'requests');
      if (requests.items.length)
        valid(detailSchema, await read('/requests/' + requests.items[0].id), 'detail');
      valid(calendarSchema, await read('/calendar?from=' + today() + '&to=' + today()), 'calendar');
      valid(serviceSchema, await read('/service-institutions'), 'service list');
      const institutions = await read('/institutions');
      valid(institutionsSchema, institutions, 'institutions');
      for (const item of institutions.items.slice(0, 3))
        valid(draftResponse, await read('/institutions/' + item.institutionId + '/draft'), 'draft');
      const report = await fetch(prefix + '/reports', {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          'X-P1-CSRF': session.csrfToken,
        },
        body: JSON.stringify({ from: today(), to: today(), institutionId: null, source: null }),
      });
      expect(report.status).toBe(200);
      valid(reportSchema, await report.json(), 'report');
      await fetch(prefix + '/logout', {
        method: 'POST',
        headers: { Cookie: cookie, 'X-P1-CSRF': session.csrfToken },
      });
    });
  },
);
