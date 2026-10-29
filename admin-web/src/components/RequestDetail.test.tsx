import { render } from '../test/render';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RequestDetail, { Followup, VisitEditor } from './RequestDetail';
import { WorkState, useWork } from '../state';
import { client, ApiError } from '../api/client';
import { detailSchema, type Detail } from '../api/schema';
const fixture = (): Detail =>
  detailSchema.parse({
    contractVersion: 'p1-service-request-v1',
    item: {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'VISIT_INTENT',
      status: 'PENDING_CONTACT',
      datasetMode: 'SYNTHETIC_TEST_ONLY',
      createdAt: '2026-10-28T00:00:00Z',
      institutionId: 'synthetic-campus',
      institutionName: '合成院区',
      contactName: '合成联系人',
      contactPhone: '13800000000',
      visits: [],
    },
    events: [],
    nextContact: null,
  });
function Dirty() {
  const work = useWork();
  return <output>{work.dirty.size ? 'dirty' : 'clean'}</output>;
}
describe('contact and visit operations', () => {
  it('mobile detail keeps unsaved contact input after a refused close and section navigation', async () => {
    vi.spyOn(client, 'request').mockImplementation(
      async (path) =>
        (path === '/service-institutions'
          ? { contractVersion: 'p1-service-request-v1', serviceInstitutions: [] }
          : fixture()) as never,
    );
    const close = vi.fn();
    render(
      <WorkState>
        <RequestDetail id={fixture().item.id} onClose={close} />
      </WorkState>,
      { mobile: true },
    );
    fireEvent.change(await screen.findByLabelText('内部备注'), {
      target: { value: '保留的联系草稿' },
    });
    fireEvent.click(screen.getByRole('button', { name: '查看带看行程' }));
    fireEvent.click(screen.getByRole('button', { name: '联系与反馈' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭窗口' }));
    await screen.findByRole('dialog', { name: '关闭详情并放弃输入？' });
    fireEvent.click(screen.getByRole('button', { name: '返回核对' }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('内部备注')).toHaveValue('保留的联系草稿');
  });
  it('read-back acknowledges a lost contact response and clears only its saved form, preventing a fresh duplicate', async () => {
    let submitted: Record<string, unknown> | undefined;
    vi.spyOn(client, 'request').mockImplementation(async (path, _schema, options) => {
      if (path === '/service-institutions')
        return { contractVersion: 'p1-service-request-v1', serviceInstitutions: [] } as never;
      if (options?.method) {
        submitted = options.body as Record<string, unknown>;
        throw new TypeError('lost response');
      }
      const detail = fixture();
      if (submitted)
        detail.events = [
          {
            operationId: String(submitted.operationId),
            type: 'FOLLOWUP',
            occurredAt: '2026-10-28T01:00:00Z',
            details: { result: 'CONNECTED', note: '合成已保存记录' },
          },
        ];
      return detail as never;
    });
    render(
      <WorkState>
        <Dirty />
        <RequestDetail id={fixture().item.id} onClose={() => {}} />
      </WorkState>,
    );
    fireEvent.change(await screen.findByLabelText('内部备注'), {
      target: { value: '合成已保存记录' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存联系记录' }));
    await screen.findByText('lost response');
    fireEvent.click(screen.getByRole('button', { name: '查询服务器最新记录' }));
    await screen.findByText('已核对原操作已保存；对应表单已更新，其他未保存输入保留。');
    expect(screen.getByLabelText('内部备注')).toHaveValue('');
    await screen.findByText('clean');
  });
  it('contact save clears input and dirty state only after a server response', async () => {
    const call = vi.spyOn(client, 'request').mockResolvedValue(fixture() as never),
      saved = vi.fn();
    render(
      <WorkState>
        <Dirty />
        <Followup detail={fixture()} onSaved={saved} />
      </WorkState>,
    );
    fireEvent.change(screen.getByLabelText('内部备注'), { target: { value: '合成跟进记录' } });
    await screen.findByText('dirty');
    fireEvent.click(screen.getByRole('button', { name: '保存联系记录' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('内部备注')).toHaveValue('');
    await screen.findByText('clean');
    const body = call.mock.calls[0][2]?.body as Record<string, unknown>;
    expect(body.note).toBe('合成跟进记录');
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.nextContactAt).toBeNull();
  });
  it.each([false, true])(
    'unknown contact result locks fields and retry preserves exact original content and ID (mobile=%s)',
    async (mobile) => {
      const call = vi
        .spyOn(client, 'request')
        .mockRejectedValueOnce(new TypeError('lost response'))
        .mockResolvedValueOnce(fixture() as never);
      render(
        <WorkState>
          <Followup detail={fixture()} onSaved={() => {}} />
        </WorkState>,
        { mobile },
      );
      fireEvent.change(screen.getByLabelText('内部备注'), {
        target: { value: '必须保留的合成记录' },
      });
      fireEvent.click(screen.getByRole('button', { name: '保存联系记录' }));
      await screen.findByText('lost response');
      expect(screen.getByLabelText('内部备注')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: '使用原操作重试联系' }));
      await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
      expect(call.mock.calls[1][2]).toEqual(call.mock.calls[0][2]);
    },
  );
  it('visit draft uses Beijing time and retains the same visitId after a lost response', async () => {
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('lost response'))
      .mockResolvedValueOnce(fixture() as never);
    render(
      <WorkState>
        <VisitEditor
          detail={fixture()}
          services={[
            { institutionId: 'synthetic-campus', institutionName: '合成院区', enabled: true },
          ]}
          onSaved={() => {}}
        />
      </WorkState>,
    );
    for (const [label, value] of [
      ['负责人标识', '合成负责人'],
      ['开始（北京时间）', '2026-11-07T10:00'],
      ['结束（北京时间）', '2026-11-07T11:00'],
      ['集合与出行说明（用户可见）', '合成集合说明'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '保存带看安排' }));
    await screen.findByText('lost response');
    const body = call.mock.calls[0][2]?.body as Record<string, unknown>;
    expect(body.start).toBe('2026-11-07T02:00:00.000Z');
    expect(body.end).toBe('2026-11-07T03:00:00.000Z');
    expect(body.action).toBe('SAVE_DRAFT');
    expect(body.familyConfirmed).toBe(false);
    expect(body.institutionConfirmed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '使用原操作重试安排' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
    expect(call.mock.calls[1][2]).toEqual(call.mock.calls[0][2]);
  });
  it('a definite conflict unlocks inputs without clearing staff or meeting details', async () => {
    vi.spyOn(client, 'request').mockRejectedValue(
      new ApiError('负责人冲突', 409, 'STAFF_CONFLICT'),
    );
    render(
      <WorkState>
        <VisitEditor
          detail={fixture()}
          services={[
            { institutionId: 'synthetic-campus', institutionName: '合成院区', enabled: true },
          ]}
          onSaved={() => {}}
        />
      </WorkState>,
    );
    for (const [label, value] of [
      ['负责人标识', '保留的合成负责人'],
      ['开始（北京时间）', '2026-11-07T10:00'],
      ['结束（北京时间）', '2026-11-07T11:00'],
      ['集合与出行说明（用户可见）', '保留的合成集合说明'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '保存带看安排' }));
    await screen.findByText('负责人冲突');
    expect(screen.getByLabelText('负责人标识')).toBeEnabled();
    expect(screen.getByLabelText('负责人标识')).toHaveValue('保留的合成负责人');
    expect(screen.getByLabelText('集合与出行说明（用户可见）')).toHaveValue('保留的合成集合说明');
  });
});
