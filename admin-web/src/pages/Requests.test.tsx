import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { client } from '../api/client';
import { listSchema, serviceSchema } from '../api/schema';
import { WorkState } from '../state';
import { render } from '../test/render';
import Requests from './Requests';

const services = serviceSchema.parse({
  contractVersion: 'p1-service-request-v1',
  serviceInstitutions: [
    { institutionId: 'synthetic-campus', institutionName: '合成筛选机构甲', enabled: true },
    { institutionId: 'synthetic-other', institutionName: '合成筛选机构乙', enabled: true },
  ],
});
const empty = listSchema.parse({
  contractVersion: 'p1-service-request-v1',
  items: [],
  total: 0,
  offset: 0,
  hasMore: false,
});
const filtered = listSchema.parse({
  ...empty,
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'CONSULTATION',
      status: 'FOLLOWING_UP',
      datasetMode: 'SYNTHETIC_TEST_ONLY',
      createdAt: '2026-10-29T01:00:00Z',
      institutionId: 'synthetic-campus',
      institutionName: '合成筛选机构甲',
    },
  ],
  total: 1,
});

it('手机筛选的查看结果提交所选状态和机构，关闭筛选页并显示服务器返回的列表', async () => {
  const request = vi.spyOn(client, 'request').mockImplementation(async (path) => {
    if (path === '/service-institutions') return services as never;
    const query = new URLSearchParams(path.split('?')[1]);
    return (
      query.get('status') === 'FOLLOWING_UP' && query.get('institutionId') === 'synthetic-campus'
        ? filtered
        : empty
    ) as never;
  });
  render(
    <MemoryRouter initialEntries={['/requests']}>
      <WorkState>
        <Requests />
      </WorkState>
    </MemoryRouter>,
    { mobile: true },
  );
  await screen.findByText('当前筛选共 0 条');
  fireEvent.click(screen.getByRole('button', { name: '筛选需求' }));
  const filter = screen.getByRole('dialog', { name: '筛选需求' });
  const submit = within(filter).getByRole('button', { name: '查看结果' });
  expect(submit).toHaveAttribute('type', 'submit');
  expect(submit.closest('form')).not.toBeNull();
  expect(within(filter).queryByRole('button', { name: '查询需求' })).not.toBeInTheDocument();
  fireEvent.click(within(filter).getByLabelText('需求状态'));
  fireEvent.click(await screen.findByRole('button', { name: '跟进中' }));
  fireEvent.click(within(filter).getByLabelText('意向机构'));
  fireEvent.click(await screen.findByRole('button', { name: '合成筛选机构甲' }));

  // Merely choosing fields must not issue the query before the explicit apply action.
  expect(request.mock.calls.filter(([path]) => path.startsWith('/requests?'))).toHaveLength(1);
  fireEvent.click(within(filter).getByRole('button', { name: '查看结果' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '筛选需求' })).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByRole('button', {
      name: /普通咨询.*跟进中.*合成筛选机构甲/,
    }),
  ).toBeVisible();
  expect(screen.getByText('当前筛选共 1 条')).toBeVisible();

  const listCalls = request.mock.calls.filter(([path]) => path.startsWith('/requests?'));
  expect(listCalls).toHaveLength(2);
  const [path, schema] = listCalls[1];
  expect(schema).toBe(listSchema);
  expect(Object.fromEntries(new URLSearchParams(path.split('?')[1]))).toEqual({
    limit: '25',
    offset: '0',
    status: 'FOLLOWING_UP',
    institutionId: 'synthetic-campus',
  });
});
