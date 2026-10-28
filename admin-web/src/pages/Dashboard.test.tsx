import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
import { client } from '../api/client';
it('dashboard uses server totals for every status and one request per query, never page length', async () => {
  const call = vi.spyOn(client, 'request').mockImplementation(
    async (path) =>
      ({
        contractVersion: 'p1-service-request-v1',
        items: [],
        total: path.includes('PENDING_CONTACT') ? 155 : 7,
        offset: 0,
        hasMore: true,
      }) as never,
  );
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  await screen.findByText('155');
  await waitFor(() => expect(call).toHaveBeenCalledTimes(4));
  expect(new Set(call.mock.calls.map((c) => c[0])).size).toBe(4);
  expect(screen.getAllByRole('link', { name: /待联系/ })[0]).toHaveAttribute(
    'href',
    '/requests?status=PENDING_CONTACT',
  );
});
