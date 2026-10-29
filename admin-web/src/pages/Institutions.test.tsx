import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { render } from '../test/render';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { WorkState } from '../state';
import { client, ApiError } from '../api/client';
import { draftSchema, type Draft } from '../api/schema';
import { Editor, BaselineImport, buildCandidate, sameContent } from './Institutions';
const record = {
  contractVersion: 'institution-contract-v1.2.1',
  institutionId: 'synthetic-react',
  recordRevision: 1,
  recordStatus: 'draft',
  identity: {
    name: {
      availability: 'provided',
      value: '合成院区',
      verification: { status: 'unverified', evidenceIds: [] },
    },
    regionCode: {
      availability: 'provided',
      value: 'wuhan',
      verification: { status: 'unverified', evidenceIds: [] },
    },
    regionDisplayName: {
      availability: 'provided',
      value: '合成地区',
      verification: { status: 'unverified', evidenceIds: [] },
    },
  },
  evidence: [],
  capabilities: { specialCare: { status: 'unknown' } },
};
const profile = {
  schemaVersion: 'institution-public-profile-v1' as const,
  id: 'synthetic-react',
  name: '合成院区',
  source: '合成原来源',
  room: '合成双人间',
  address: '合成测试地址',
  nature: '合成机构性质',
  tags: ['医养结合'],
  tagNote: '仅展示，不代表资格',
  prices: [{ level: '合成档位', bed: 100, care: 200, food: 300, total: 600 }],
  otherFees: '未提供',
  priceNote: '合成资料不用于报价',
  historyNote: '保留旧版',
};
const fixture = () =>
  draftSchema.parse({
    institutionId: 'synthetic-react',
    draftRevision: 2,
    baseRecordRevision: null,
    currentRecordRevision: null,
    status: 'CONFIRMED',
    record: structuredClone(record),
    publicProfile: structuredClone(profile),
    confirmation: {
      sourceReference: '合成确认来源',
      confirmedBy: '合成确认人',
      confirmedOn: '2026-10-28',
    },
    publishedRecordRevision: null,
    serviceAccess: { enabled: false, accessRevision: 0 },
  });
const wrap = (item: Draft) => ({
  contractVersion: 'institution-publications-v1' as const,
  dataEnvironment: 'SYNTHETIC_TEST_ONLY' as const,
  item,
});
function editor(initial = fixture(), mobile = false) {
  render(
    <WorkState>
      <Editor initial={initial} onBack={() => {}} onListChanged={() => {}} />
    </WorkState>,
    { mobile },
  );
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  client.establish('fixture-csrf');
});
describe('institution facts and publication state', () => {
  it('opens collapsed required fields on validation failure without sending a write', async () => {
    const call = vi.spyOn(client, 'request');
    editor();
    change('机构公开名称', '');
    const section = screen.getByText('基础资料').closest('details')!;
    section.open = false;
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(section.open).toBe(true));
    expect(call).not.toHaveBeenCalled();
    expect(screen.getByLabelText('机构公开名称')).toHaveValue('');
  });
  it('editing immediately disables publish; name change clears field verification without inventing care capability', async () => {
    const initial = fixture();
    initial.record!.identity.name = {
      availability: 'provided',
      value: '合成院区',
      verification: { status: 'verified', evidenceIds: ['old-evidence'] },
    };
    initial.record!.evidence = [{ fieldPath: 'identity.name', recordRevision: 1 }];
    editor(initial);
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeEnabled();
    change('机构公开名称', '合成改名');
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeDisabled();
    const call = vi.spyOn(client, 'request').mockImplementation(async (_path, _schema, options) => {
      const body = options?.body as {
        record: Draft['record'];
        publicProfile: Draft['publicProfile'];
      };
      return wrap({
        ...initial,
        ...body,
        status: 'DRAFT',
        confirmation: null,
        draftRevision: 3,
      }) as never;
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    const body = call.mock.calls[0][2]?.body as { record: typeof record };
    expect(body.record.identity.name.verification.status).toBe('unverified');
    expect(body.record.evidence).toEqual([]);
    expect(body.record.capabilities.specialCare.status).toBe('unknown');
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeDisabled();
  });
  it('409 preserves local input, requires explicit comparison and latest revision before resave', async () => {
    editor();
    const newer = {
      ...fixture(),
      draftRevision: 5,
      status: 'DRAFT' as const,
      confirmation: null,
      publicProfile: { ...profile, address: '另一标签修改' },
    };
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new ApiError('草稿冲突', 409, 'STALE_DRAFT_REVISION'))
      .mockResolvedValueOnce(wrap(newer) as never)
      .mockImplementationOnce(
        async (_p, _s, o) => wrap({ ...newer, ...(o?.body as object), draftRevision: 6 }) as never,
      );
    change('机构公开名称', '我的修改');
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText('草稿冲突');
    expect(screen.getByLabelText('机构公开名称')).toHaveValue('我的修改');
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '查询服务器版本' }));
    await screen.findByText('核对服务器最新版本');
    expect(screen.getByLabelText('机构公开名称')).toHaveValue('我的修改');
    fireEvent.click(screen.getByRole('button', { name: '保留我的修改，以最新版本为基准继续编辑' }));
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(3));
    expect(
      (call.mock.calls[2][2]?.body as { expectedDraftRevision: number }).expectedDraftRevision,
    ).toBe(5);
  });
  it('publish lost response retains operationId and retries exact body without enabling service', async () => {
    editor();
    const published = {
      ...fixture(),
      status: 'PUBLISHED' as const,
      currentRecordRevision: 1,
      publishedRecordRevision: 1,
    };
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network unknown'))
      .mockResolvedValueOnce({
        ...wrap(published),
        publication: { institutionId: 'synthetic-react', recordRevision: 1, status: 'REPLAYED' },
      } as never);
    fireEvent.click(screen.getByRole('button', { name: '发布已确认版本' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认继续' }));
    await screen.findByText('network unknown');
    expect(screen.getByLabelText('机构公开名称')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '使用原操作重试发布' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
    expect(call.mock.calls[1][2]).toEqual(call.mock.calls[0][2]);
    await screen.findByText(/服务器已确认发布第 1 版/);
    expect(screen.getByText('未接收新服务申请')).toBeInTheDocument();
  });
  it('read-back normalizes published revision and recovers a lost publish response without another write', async () => {
    const initial = fixture(),
      published = {
        ...initial,
        status: 'PUBLISHED' as const,
        currentRecordRevision: 3,
        publishedRecordRevision: 3,
        record: { ...structuredClone(record), recordRevision: 3, recordStatus: 'published' },
      };
    editor(initial);
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network unknown'))
      .mockResolvedValueOnce(wrap(published) as never);
    fireEvent.click(screen.getByRole('button', { name: '发布已确认版本' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认继续' }));
    await screen.findByText('network unknown');
    fireEvent.click(screen.getByRole('button', { name: '查询服务器版本' }));
    await screen.findByText('已核对服务器：原版本发布成功。');
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][2]).toBeUndefined();
  });
  it('invalid JSON, missing region, or incorrect price total never sends a save', async () => {
    editor();
    const call = vi.spyOn(client, 'request');
    change('机构公开名称', '合成改名');
    fireEvent.click(screen.getByText('高级资料 · 完整事实、核验与护理证据 JSON'));
    change('Institution V1.2.1 完整资料', '{bad');
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存草稿' })).toBeEnabled());
    expect(call).not.toHaveBeenCalled();
    const values = {
      name: '合成院区',
      regionCode: '',
      regionDisplayName: '',
      hasProfile: true,
      source: 'x',
      room: '',
      address: '',
      nature: '',
      tags: '医养结合',
      tagNote: '',
      otherFees: '',
      priceNote: '',
      historyNote: '',
      recordJson: JSON.stringify(record),
    };
    expect(() => buildCandidate(values, [], record.institutionId)).toThrow('地区');
    expect(() =>
      buildCandidate(
        { ...values, regionCode: 'wuhan', regionDisplayName: '合成' },
        [{ level: '合成', bed: 1, care: 2, food: 3, total: 99 }],
        record.institutionId,
      ),
    ).toThrow();
  });
  it('service access recovery leaves unsaved public profile fields intact', async () => {
    const initial = { ...fixture(), currentRecordRevision: 1, publishedRecordRevision: 1 };
    editor(initial);
    change('实际地址（未知保持空白）', '本地未保存地址');
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network unknown'))
      .mockResolvedValueOnce(
        wrap({ ...initial, serviceAccess: { enabled: true, accessRevision: 1 } }) as never,
      );
    fireEvent.click(screen.getByLabelText('允许接收新咨询 / 带看意向'));
    change('接入决定来源 / 确认说明', '合成接入来源');
    fireEvent.click(screen.getByRole('button', { name: '保存接入设置' }));
    await screen.findByText('network unknown');
    fireEvent.click(screen.getByRole('button', { name: '查询服务器版本' }));
    await screen.findByText('已核对服务接入状态。本地未保存资料继续保留。');
    expect(screen.getByLabelText('实际地址（未知保持空白）')).toHaveValue('本地未保存地址');
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeDisabled();
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('comparison recognizes canonical content regardless of key order', () => {
    const initial = fixture();
    expect(sameContent(initial, { publicProfile: profile, record })).toBe(true);
    expect(sameContent(initial, { publicProfile: { ...profile, nature: 'changed' }, record })).toBe(
      false,
    );
  });
});
describe('mobile institution editing', () => {
  it('keeps hidden step fields mounted and saves the complete form and prices', async () => {
    const initial = fixture();
    editor(initial, true);
    const call = vi.spyOn(client, 'request').mockImplementation(
      async (_path, _schema, options) =>
        wrap({
          ...initial,
          ...(options?.body as object),
          status: 'DRAFT',
          confirmation: null,
          draftRevision: 3,
        }) as never,
    );
    change('机构公开名称', '手机编辑的合成名称');
    fireEvent.click(screen.getByRole('button', { name: '第2步 介绍' }));
    expect(screen.getByLabelText('机构公开名称')).not.toBeVisible();
    change(
      '实际地址（未知保持空白）',
      '武汉市合成大道一号，非常长的合成入口地址，用于检查分步保留。',
    );
    change('公开资料来源', '手机填写的可追溯合成来源');
    fireEvent.click(screen.getByRole('button', { name: '第3步 价格' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '第1行床位费' }), {
      target: { value: '200' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: '第1行总月费' }), {
      target: { value: '700' },
    });
    fireEvent.click(screen.getByRole('button', { name: '第1步 基础' }));
    expect(screen.getByLabelText('机构公开名称')).toHaveValue('手机编辑的合成名称');
    fireEvent.click(screen.getByRole('button', { name: '第2步 介绍' }));
    expect(screen.getByLabelText('公开资料来源')).toHaveValue('手机填写的可追溯合成来源');
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    const body = call.mock.calls[0][2]?.body as {
      publicProfile: typeof profile;
      record: typeof record;
    };
    expect(body.publicProfile.name).toBe('手机编辑的合成名称');
    expect(body.publicProfile.source).toBe('手机填写的可追溯合成来源');
    expect(body.publicProfile.address).toContain('非常长的合成入口地址');
    expect(body.publicProfile.prices[0]).toEqual({
      level: '合成档位',
      bed: 200,
      care: 200,
      food: 300,
      total: 700,
    });
    expect(body.record.capabilities.specialCare.status).toBe('unknown');
  });

  it('keeps source confirmation input when moving between steps and exposes independent service access', () => {
    editor({ ...fixture(), currentRecordRevision: 1, publishedRecordRevision: 1 }, true);
    fireEvent.click(screen.getByRole('button', { name: '第4步 确认发布' }));
    change('本次确认来源引用', '尚未提交的手机确认来源');
    expect(screen.getByRole('button', { name: '保存接入设置' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '第1步 基础' }));
    expect(screen.getByLabelText('本次确认来源引用')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '第4步 确认发布' }));
    expect(screen.getByLabelText('本次确认来源引用')).toHaveValue('尚未提交的手机确认来源');
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeVisible();
  });

  it('requires every explicit mobile conflict choice, retains previous selections, includes prices and advanced facts, and saves against the latest revision', async () => {
    const initial = fixture();
    editor(initial, true);
    const serverRecord = {
      ...structuredClone(record),
      capabilities: { specialCare: { status: 'unavailable' } },
    };
    const newer = {
      ...initial,
      draftRevision: 5,
      status: 'DRAFT' as const,
      confirmation: null,
      record: serverRecord,
      publicProfile: {
        ...profile,
        address: '服务器合成地址：另一入口及接待地点，长文本继续保留。',
        prices: [{ level: '服务器合成档位', bed: 300, care: 300, food: 300, total: 900 }],
      },
    };
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new ApiError('草稿冲突', 409, 'STALE_DRAFT_REVISION'))
      .mockResolvedValueOnce(wrap(newer) as never)
      .mockImplementationOnce(
        async (_path, _schema, options) =>
          wrap({ ...newer, ...(options?.body as object), draftRevision: 6 }) as never,
      );
    change('机构公开名称', '手机本地名称');
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText('草稿冲突');
    fireEvent.click(screen.getByRole('button', { name: '查询服务器版本' }));
    const dialog = await screen.findByRole('dialog', { name: '核对机构资料' });
    const review = within(dialog);
    expect(review.getByRole('button', { name: '确认选择并继续编辑' })).toBeDisabled();
    expect(review.getByRole('radio', { name: /服务器最新内容/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    fireEvent.click(review.getByRole('radio', { name: /我的本地输入/ }));
    fireEvent.click(review.getByRole('button', { name: '下个差异' }));
    fireEvent.click(review.getByRole('radio', { name: /服务器最新内容/ }));
    fireEvent.click(review.getByRole('button', { name: '上个差异' }));
    expect(review.getByRole('radio', { name: /我的本地输入/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(review.getByRole('button', { name: '下个差异' }));
    expect(review.getByRole('radio', { name: /服务器最新内容/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(review.getByRole('button', { name: '下个差异' }));
    expect(review.getByRole('heading', { name: '公示价格' })).toBeInTheDocument();
    fireEvent.click(review.getByRole('radio', { name: /服务器最新内容/ }));
    expect(review.getByRole('button', { name: '确认选择并继续编辑' })).toBeDisabled();
    fireEvent.click(review.getByRole('button', { name: '下个差异' }));
    expect(
      review.getByRole('heading', { name: '完整事实、核验与护理证据 JSON' }),
    ).toBeInTheDocument();
    fireEvent.click(review.getByRole('radio', { name: /服务器最新内容/ }));
    fireEvent.click(review.getByRole('button', { name: '确认选择并继续编辑' }));
    expect(screen.getByLabelText('机构公开名称')).toHaveValue('手机本地名称');
    expect(call).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '第4步 确认发布' }));
    expect(screen.getByRole('button', { name: '发布已确认版本' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(3));
    const body = call.mock.calls[2][2]?.body as {
      expectedDraftRevision: number;
      publicProfile: typeof profile;
      record: typeof record;
    };
    expect(body.expectedDraftRevision).toBe(5);
    expect(body.publicProfile.address).toBe(newer.publicProfile.address);
    expect(body.publicProfile.prices).toEqual(newer.publicProfile.prices);
    expect(body.publicProfile.name).toBe('手机本地名称');
    expect(body.record.identity.name.value).toBe('手机本地名称');
    expect(body.record.capabilities.specialCare.status).toBe('unavailable');
    expect(body.record.identity.name.verification.status).toBe('unverified');
  });

  it.each([
    { label: 'empty unknown prices', prices: [] },
    { label: 'existing original prices', prices: profile.prices },
  ])(
    'keeps local unknown facts and $label when all differences explicitly retain local',
    async ({ prices }) => {
      const initial = {
        ...fixture(),
        publicProfile: { ...profile, address: '', room: '', nature: '', prices },
      };
      editor(initial, true);
      change('机构公开名称', '保留本地合成名称');
      const newer = {
        ...initial,
        draftRevision: 5,
        status: 'DRAFT' as const,
        confirmation: null,
        publicProfile: {
          ...initial.publicProfile,
          address: '服务器有来源的新合成地址',
          prices: [{ level: '服务器新档位', bed: 300, care: 300, food: 300, total: 900 }],
        },
        record: {
          ...structuredClone(record),
          capabilities: { specialCare: { status: 'unavailable' } },
        },
      };
      const call = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(wrap(newer) as never)
        .mockImplementationOnce(
          async (_path, _schema, options) =>
            wrap({ ...newer, ...(options?.body as object), draftRevision: 6 }) as never,
        );
      fireEvent.click(screen.getByRole('button', { name: '查询服务器版本' }));
      const review = within(await screen.findByRole('dialog', { name: '核对机构资料' }));
      expect(review.getByText('差异 1 / 4')).toBeInTheDocument();
      for (let index = 0; index < 4; index += 1) {
        fireEvent.click(review.getByRole('radio', { name: /我的本地输入/ }));
        if (index < 3) fireEvent.click(review.getByRole('button', { name: '下个差异' }));
      }
      fireEvent.click(review.getByRole('button', { name: '确认选择并继续编辑' }));
      expect(call).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
      await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
      const body = call.mock.calls[1][2]?.body as {
        publicProfile: typeof profile;
        record: typeof record;
      };
      expect(body.publicProfile.prices).toEqual(prices);
      expect(body.publicProfile.address).toBe('');
      expect(body.publicProfile.room).toBe('');
      expect(body.publicProfile.nature).toBe('');
      expect(body.record.capabilities.specialCare.status).toBe('unknown');
      expect(body.record.identity.name.value).toBe('保留本地合成名称');
    },
  );
});

describe('baseline import', () => {
  it('requires explicit preservation, keeps historical records separate, retries exact original package', async () => {
    render(
      <WorkState>
        <BaselineImport onSaved={() => {}} />
      </WorkState>,
    );
    fireEvent.click(screen.getByText('已有目录迁移 · 文件导入或粘贴 JSON'));
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network unknown'))
      .mockResolvedValueOnce({
        contractVersion: 'institution-publications-v1',
        dataEnvironment: 'SYNTHETIC_TEST_ONLY',
        imported: 2,
        replayed: true,
      } as never);
    change(
      '或粘贴完整目录 JSON',
      JSON.stringify({
        catalog: { schemaVersion: 'test-current' },
        historicalRecords: [{ recordRevision: 1 }],
      }),
    );
    change('本次迁移来源引用', '合成迁移来源');
    fireEvent.click(screen.getByRole('button', { name: '导入现有目录' }));
    await screen.findByText('请确认保留原事实和核验日期。');
    expect(call).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByLabelText('我确认仅迁移现有版本，保留原核验日期，不代表本次重新核验'),
    );
    fireEvent.click(screen.getByRole('button', { name: '导入现有目录' }));
    await screen.findByText('network unknown');
    const body = call.mock.calls[0][2]?.body as Record<string, unknown>;
    expect(body.catalog).toEqual({ schemaVersion: 'test-current' });
    expect(body.historicalRecords).toEqual([{ recordRevision: 1 }]);
    expect(screen.getByLabelText('或粘贴完整目录 JSON')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '使用原操作重试导入' }));
    await screen.findByText(/服务器已确认导入 2 条/);
    expect(call.mock.calls[1][2]).toEqual(call.mock.calls[0][2]);
  });
});
