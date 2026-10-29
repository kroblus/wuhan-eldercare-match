import { render } from '../test/render';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Reports from './Reports';
import { ApiError, client } from '../api/client';
import { reportSchema, serviceSchema } from '../api/schema';

const snapshotId = '11111111-1111-4111-8111-111111111111';
const services = serviceSchema.parse({
  contractVersion: 'p1-service-request-v1',
  serviceInstitutions: [
    { institutionId: 'synthetic-active', institutionName: '合成启用机构', enabled: true },
    { institutionId: 'synthetic-disabled', institutionName: '合成停用机构', enabled: false },
  ],
});
const metrics = {
  newRequests: 155,
  visitIntentRequests: 80,
  contactEvents: 25,
  connectedEvents: 20,
  noAnswerEvents: 3,
  refusedEvents: 2,
  confirmedSessions: 8,
  rescheduledEvents: 2,
  arrivedSessions: 5,
  arrivedRequests: 4,
  noShowSessions: 1,
  cancelledSessions: 1,
  movedInFeedbackEvents: 2,
  notMovedInFeedbackEvents: 1,
  unknownFeedbackEvents: 1,
  cohortDenominator: 155,
  cohortContactedRequests: 20,
  cohortArrivedRequests: 4,
  cohortMovedInRequests: 2,
  cohortArrivalRate: 4 / 155,
};
const response = reportSchema.parse({
  contractVersion: 'p1-service-request-v1',
  report: {
    snapshotId,
    policyVersion: 'p1-report-v1',
    datasetMode: 'SYNTHETIC_TEST_ONLY',
    timeZone: 'Asia/Shanghai',
    warning: '合成测试资料，不代表真实业务',
    from: '2026-10-01',
    to: '2026-10-28',
    generatedAt: '2026-10-28T07:00:00Z',
    institutionId: null,
    institutionName: '平台去重总览',
    sourceFilter: 'ALL',
    metrics,
    profiles: [{ dimension: '服务场景', category: '尚未确定', count: null, note: '小样本不展示' }],
    institutions: [{ institutionName: '合成启用机构', metrics }],
    sources: [{ source: 'SYNTHETIC_TEST_ONLY', count: 155 }],
    rules: ['各机构行独立去重，不能相加。'],
  },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: '生成报告预览' }));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('服务报告固定批次与失败恢复', () => {
  it.each([false, true])(
    '展示完整服务器范围，按预览批次下载，筛选更改后立即禁用旧导出 (mobile=%s)',
    async (mobile) => {
      const request = vi
        .spyOn(client, 'request')
        .mockImplementation(
          async (path) => (path === '/service-institutions' ? services : response) as never,
        );
      const download = vi.spyOn(client, 'download').mockResolvedValue(new Blob(['synthetic-xlsx']));
      const createObjectURL = vi.fn().mockReturnValue('blob:synthetic');
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
      const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      render(<Reports />, { mobile });
      submit();
      await screen.findByText(snapshotId);
      if (mobile) {
        fireEvent.click(screen.getByText('需求画像'));
        fireEvent.click(screen.getByText('分机构成果'));
      }
      expect(screen.getAllByText('155').length).toBeGreaterThan(0);
      expect(screen.getByText('小样本不展示')).toBeVisible();
      expect(screen.getByText('各机构行独立去重，平台总数不能由这些行相加。')).toBeVisible();
      const reportRequest = request.mock.calls.find(([path]) => path === '/reports');
      expect(reportRequest?.[2]).toMatchObject({
        method: 'POST',
        body: { institutionId: null, source: null },
      });
      fireEvent.click(screen.getByRole('button', { name: '下载本批次 Excel' }));
      await waitFor(() => expect(anchor).toHaveBeenCalledOnce());
      expect(download).toHaveBeenCalledWith(snapshotId);
      expect(createObjectURL).toHaveBeenCalledOnce();
      fireEvent.change(screen.getByLabelText('报告开始日期', { selector: 'input' }), {
        target: { value: '2026-10-01' },
      });
      expect(screen.getByRole('button', { name: '下载本批次 Excel' })).toBeDisabled();
      expect(screen.queryByText(snapshotId)).not.toBeInTheDocument();
    },
  );
  it('筛选变化时忽略尚未返回的旧报告，不重新启用下载', async () => {
    const pending = deferred<typeof response>();
    vi.spyOn(client, 'request').mockImplementation(
      (path) =>
        (path === '/service-institutions' ? Promise.resolve(services) : pending.promise) as never,
    );
    render(<Reports />);
    submit();
    await waitFor(() =>
      expect(client.request).toHaveBeenCalledWith('/reports', reportSchema, expect.anything()),
    );
    fireEvent.change(screen.getByLabelText('报告结束日期'), { target: { value: '2026-11-01' } });
    await act(async () => pending.resolve(response));
    expect(screen.queryByText(snapshotId)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载本批次 Excel' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('筛选已更改');
  });
  it('下载等待中修改筛选，不发起旧批次文件保存或报告成功提示', async () => {
    vi.spyOn(client, 'request').mockImplementation(
      async (path) => (path === '/service-institutions' ? services : response) as never,
    );
    const pending = deferred<Blob>();
    vi.spyOn(client, 'download').mockReturnValue(pending.promise);
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    render(<Reports />);
    submit();
    await screen.findByText(snapshotId);
    fireEvent.click(screen.getByRole('button', { name: '下载本批次 Excel' }));
    fireEvent.change(screen.getByLabelText('报告结束日期'), { target: { value: '2026-11-01' } });
    await act(async () => pending.resolve(new Blob(['old-batch'])));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('筛选已更改');
    expect(screen.getByRole('button', { name: '下载本批次 Excel' })).toBeDisabled();
  });
  it('401或服务器失败不显示空统计或伪造成功，允许重新查询', async () => {
    const request = vi.spyOn(client, 'request').mockImplementation(async (path) => {
      if (path === '/service-institutions') return services as never;
      throw new ApiError('登录已失效，请重新登录。', 401);
    });
    render(<Reports />);
    submit();
    await screen.findByText('登录已失效，请重新登录。');
    expect(screen.getByRole('button', { name: '下载本批次 Excel' })).toBeDisabled();
    expect(screen.queryByText(snapshotId)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('尚未生成本批报告');
    request.mockImplementation(
      async (path) => (path === '/service-institutions' ? services : response) as never,
    );
    submit();
    await screen.findByText(snapshotId);
    expect(screen.getByRole('button', { name: '下载本批次 Excel' })).toBeEnabled();
  });
  it('组件退出后到达的报告响应不创建导出或恢复内容', async () => {
    const pending = deferred<typeof response>();
    vi.spyOn(client, 'request').mockImplementation(
      (path) =>
        (path === '/service-institutions' ? Promise.resolve(services) : pending.promise) as never,
    );
    const { unmount } = render(<Reports />);
    submit();
    await waitFor(() =>
      expect(client.request).toHaveBeenCalledWith('/reports', reportSchema, expect.anything()),
    );
    unmount();
    await act(async () => pending.resolve(response));
    expect(screen.queryByText(snapshotId)).not.toBeInTheDocument();
  });
});
