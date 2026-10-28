import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { client, ApiError } from '../api/client';
import { calendarSchema, serviceSchema } from '../api/schema';
import { WorkState } from '../state';
import { confirmAction } from '../components/shared';
import Visits from './Visits';

vi.mock('../components/RequestDetail', () => ({
  default: ({ id, onClose }: { id: string | null; onClose: () => void }) =>
    id ? (
      <div role="dialog" aria-label="合用需求详情">
        <span>{id}</span>
        <button onClick={onClose}>关闭需求详情</button>
      </div>
    ) : null,
}));
vi.mock('../components/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/shared')>()),
  confirmAction: vi.fn().mockResolvedValue(true),
}));

const requestId = '11111111-1111-4111-8111-111111111111';
const services = serviceSchema.parse({
  contractVersion: 'p1-service-request-v1',
  serviceInstitutions: [
    { institutionId: 'synthetic-active', institutionName: '合成启用机构', enabled: true },
    { institutionId: 'synthetic-disabled', institutionName: '合成停用机构', enabled: false },
  ],
});
const calendar = calendarSchema.parse({
  contractVersion: 'p1-service-request-v1',
  visits: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      requestId,
      revision: 1,
      institutionId: 'synthetic-active',
      institutionName: '合成启用机构',
      staffId: '合成负责人甲',
      status: 'CONFIRMED',
      start: '2026-10-28T02:00:00Z',
      end: '2026-10-28T03:00:00Z',
      bufferBefore: 10,
      bufferAfter: 30,
      meetingNote: '前台集合',
      familyConfirmed: true,
      institutionConfirmed: true,
      actualAt: null,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      requestId,
      revision: 1,
      institutionId: 'synthetic-active',
      institutionName: '合成草稿机构',
      staffId: '合成负责人乙',
      status: 'DRAFT',
      start: '2026-10-28T05:00:00Z',
      end: '2026-10-28T06:00:00Z',
      bufferBefore: 0,
      bufferAfter: 0,
      meetingNote: '待协商',
      familyConfirmed: false,
      institutionConfirmed: false,
      actualAt: null,
    },
  ],
  blocks: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      staffId: '合成不可用负责人',
      start: '2026-10-28T06:00:00Z',
      end: '2026-10-28T07:00:00Z',
    },
  ],
  capacities: [{ institutionName: '合成启用机构', capacity: 2 }],
});
const saved = { contractVersion: 'p1-service-request-v1', saved: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function renderVisits() {
  return render(
    <WorkState>
      <Visits />
    </WorkState>,
  );
}
function openResources() {
  fireEvent.click(screen.getByText('维护负责人不可用与机构接待容量'));
}
function fillBlock() {
  fireEvent.change(screen.getByLabelText('不可用负责人标识'), {
    target: { value: '合成负责人丙' },
  });
  fireEvent.change(screen.getByLabelText('不可用开始时间'), {
    target: { value: '2026-10-29T09:00' },
  });
  fireEvent.change(screen.getByLabelText('不可用结束时间'), {
    target: { value: '2026-10-29T10:00' },
  });
}
beforeEach(() => {
  vi.mocked(confirmAction).mockClear().mockResolvedValue(true);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('带看日程范围、资源写入与恢复', () => {
  it('按服务器日期范围读取，状态仅筛选当前范围，并使用共用需求详情处理行程', async () => {
    const request = vi
      .spyOn(client, 'request')
      .mockImplementation(
        async (path) => (path === '/service-institutions' ? services : calendar) as never,
      );
    renderVisits();
    await screen.findByText('前台集合');
    expect(screen.getByText('待协商')).toBeVisible();
    expect(screen.getByText(/当前范围共 2 场，状态筛选后 2 场/)).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: '查看及处理' })[0]);
    expect(screen.getByRole('dialog', { name: '合用需求详情' })).toHaveTextContent(requestId);
    fireEvent.click(screen.getByRole('button', { name: '关闭需求详情' }));
    fireEvent.click(screen.getByLabelText('日程状态筛选'));
    fireEvent.click(await screen.findByRole('option', { name: '待双方确认' }));
    expect(screen.getByText('待协商')).toBeVisible();
    expect(screen.queryByText('前台集合')).not.toBeInTheDocument();
    expect(screen.getByText(/当前范围共 2 场，状态筛选后 1 场/)).toBeVisible();
    const calendarCalls = request.mock.calls.filter(([path]) => path.startsWith('/calendar?'));
    expect(calendarCalls).toHaveLength(1);
    expect(calendarCalls[0][0]).not.toContain('status=');
  });
  it('日期改动后丢弃晚返回的旧查询，新查询发送北京时间日期而非浏览器时区时间', async () => {
    const pending = deferred<typeof calendar>();
    const request = vi
      .spyOn(client, 'request')
      .mockImplementation(
        (path) =>
          (path === '/service-institutions' ? Promise.resolve(services) : pending.promise) as never,
      );
    renderVisits();
    fireEvent.change(screen.getByLabelText('日程起始日'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('日程结束日'), { target: { value: '2026-10-20' } });
    await act(async () => pending.resolve(calendar));
    expect(screen.queryByText('前台集合')).not.toBeInTheDocument();
    request.mockImplementation(
      async (path) => (path === '/service-institutions' ? services : calendar) as never,
    );
    fireEvent.click(screen.getByRole('button', { name: '查询日程' }));
    await screen.findByText('前台集合');
    expect(request).toHaveBeenCalledWith('/calendar?from=2026-10-01&to=2026-10-20', calendarSchema);
  });
  it('不可用登记超时锁输入，手工重试保持同一blockId与北京时间转换后的精确内容', async () => {
    let writes = 0;
    const request = vi
      .spyOn(client, 'request')
      .mockImplementation(async (path, _schema, options) => {
        if (path === '/resources') {
          if (++writes === 1) throw new TypeError('合成网络中断');
          return saved as never;
        }
        return (path === '/service-institutions' ? services : calendar) as never;
      });
    renderVisits();
    openResources();
    fillBlock();
    fireEvent.click(screen.getByRole('button', { name: '登记不可用时段' }));
    await screen.findByText('合成网络中断');
    expect(screen.getByLabelText('不可用负责人标识')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '使用原内容重试登记' }));
    await screen.findByText('不可用时段已由服务器保存。');
    const mutations = request.mock.calls.filter(([path]) => path === '/resources');
    expect(mutations).toHaveLength(2);
    expect(mutations[0][2]).toEqual(mutations[1][2]);
    expect(mutations[0][2]?.body).toEqual({
      action: 'BLOCK',
      blockId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      staffId: '合成负责人丙',
      start: '2026-10-29T01:00:00.000Z',
      end: '2026-10-29T02:00:00.000Z',
    });
    expect(mutations[0][2]?.body).not.toHaveProperty('operationId');
  });
  it('明确时段冲突保留输入并解除锁定，不伪报保存成功', async () => {
    vi.spyOn(client, 'request').mockImplementation(async (path) => {
      if (path === '/resources')
        throw new ApiError('负责人时段冲突，原安排保留。', 409, 'STAFF_CONFLICT');
      return (path === '/service-institutions' ? services : calendar) as never;
    });
    renderVisits();
    openResources();
    fillBlock();
    fireEvent.click(screen.getByRole('button', { name: '登记不可用时段' }));
    await screen.findByText('负责人时段冲突，原安排保留。');
    expect(screen.getByLabelText('不可用负责人标识')).toHaveValue('合成负责人丙');
    expect(screen.getByLabelText('不可用负责人标识')).toBeEnabled();
    expect(screen.queryByText('不可用时段已由服务器保存。')).not.toBeInTheDocument();
  });
  it('移除未知结果保留原编号；即使日期变化清空列表仍可显式重试', async () => {
    let writes = 0;
    const request = vi.spyOn(client, 'request').mockImplementation(async (path) => {
      if (path === '/resources') {
        if (++writes === 1) throw new TypeError('合成移除响应丢失');
        return saved as never;
      }
      return (path === '/service-institutions' ? services : calendar) as never;
    });
    renderVisits();
    fireEvent.click(await screen.findByRole('button', { name: '移除不可用时段' }));
    await screen.findByText('合成移除响应丢失');
    fireEvent.change(screen.getByLabelText('日程结束日'), { target: { value: '2026-11-01' } });
    expect(screen.queryByText('合成不可用负责人')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '使用原内容重试移除' }));
    await screen.findByText('服务器已移除该不可用时段。');
    const mutations = request.mock.calls.filter(([path]) => path === '/resources');
    expect(mutations[0][2]).toEqual(mutations[1][2]);
    expect(mutations[1][2]?.body).toEqual({
      action: 'REMOVE_BLOCK',
      blockId: calendar.blocks[0].id,
    });
    expect(confirmAction).toHaveBeenCalledOnce();
  });
  it('容量维护只给启用机构，保存目标值前确认；服务端拒绝保留输入和原配置', async () => {
    const request = vi.spyOn(client, 'request').mockImplementation(async (path) => {
      if (path === '/resources')
        throw new ApiError('仍有未来确认行程，请先处理再调整容量。', 409, 'ACTIVE_SCHEDULES_EXIST');
      return (path === '/service-institutions' ? services : calendar) as never;
    });
    renderVisits();
    await screen.findByText('前台集合');
    openResources();
    fireEvent.click(screen.getByLabelText('容量配置机构'));
    expect(screen.queryByRole('option', { name: '合成停用机构' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: '合成启用机构' }));
    fireEvent.change(screen.getByLabelText('同时接待组数'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '保存容量设置' }));
    await screen.findByText('仍有未来确认行程，请先处理再调整容量。');
    expect(confirmAction).toHaveBeenCalledOnce();
    const mutation = request.mock.calls.find(([path]) => path === '/resources');
    expect(mutation?.[2]?.body).toEqual({
      action: 'CAPACITY',
      institutionId: 'synthetic-active',
      capacity: 3,
    });
    expect(screen.getByLabelText('同时接待组数')).toHaveValue('3');
    expect(screen.getByText('合成启用机构 · 同时 2 组')).toBeVisible();
  });
  it('跨模块重挂载后保留未知登记的原编号与内容', async () => {
    let writes = 0;
    const request = vi.spyOn(client, 'request').mockImplementation(async (path) => {
      if (path === '/resources') {
        if (++writes === 1) throw new TypeError('合成断网');
        return saved as never;
      }
      return (path === '/service-institutions' ? services : calendar) as never;
    });
    function Harness() {
      const [visible, setVisible] = useState(true);
      return (
        <WorkState>
          <button onClick={() => setVisible((value) => !value)}>切换模块挂载</button>
          {visible && <Visits />}
        </WorkState>
      );
    }
    render(<Harness />);
    openResources();
    fillBlock();
    fireEvent.click(screen.getByRole('button', { name: '登记不可用时段' }));
    await screen.findByText('合成断网');
    fireEvent.click(screen.getByRole('button', { name: '切换模块挂载' }));
    fireEvent.click(screen.getByRole('button', { name: '切换模块挂载' }));
    openResources();
    expect(screen.getByLabelText('不可用负责人标识')).toHaveValue('合成负责人丙');
    fireEvent.click(screen.getByRole('button', { name: '使用原内容重试登记' }));
    await screen.findByText('不可用时段已由服务器保存。');
    const mutations = request.mock.calls.filter(([path]) => path === '/resources');
    expect(mutations[0][2]).toEqual(mutations[1][2]);
  });
});
