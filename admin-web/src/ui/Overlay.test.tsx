import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UIContext } from './context';
import desktop from './desktop';
import mobile from './mobile';
import {
  Drawer,
  Modal,
  Form,
  Input,
  Button,
  Select,
  ConfirmationHost,
  confirmAction,
} from './index';

describe('responsive business form host', () => {
  it('uses the mounted confirmation host and never falls back to a blocking browser confirm', async () => {
    const native = vi.spyOn(window, 'confirm');
    const { unmount } = render(
      <UIContext.Provider value={{ adapter: mobile, mobile: true }}>
        <ConfirmationHost />
      </UIContext.Provider>,
    );
    let decision!: Promise<boolean>;
    act(() => {
      decision = confirmAction('发布版本？', '历史版本会保留。');
    });
    expect(screen.getByRole('dialog', { name: '发布版本？' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '返回核对' }));
    await expect(decision).resolves.toBe(false);
    unmount();
    await expect(confirmAction('发布版本？', '历史版本会保留。')).resolves.toBe(false);
    expect(native).not.toHaveBeenCalled();
  });
  it('keeps entered values when presentation changes, without disabling recovery actions', async () => {
    const retry = vi.fn();
    function Editor() {
      const [form] = Form.useForm();
      const [locked, setLocked] = useState(false);
      return (
        <Drawer visible title="资料编辑" footer={null}>
          <Form form={form} disabled={locked}>
            <Form.Item field="name" label="机构名称">
              <Input />
            </Form.Item>
            <Button onClick={() => setLocked(true)}>模拟结果待确认</Button>
            <Button onClick={retry}>原操作重试</Button>
          </Form>
        </Drawer>
      );
    }
    const view = (small: boolean) => (
      <UIContext.Provider value={{ adapter: small ? mobile : desktop, mobile: small }}>
        <Editor />
      </UIContext.Provider>
    );
    const { rerender } = render(view(false));
    fireEvent.change(screen.getByLabelText('机构名称'), {
      target: { value: '保留的合成机构输入' },
    });
    rerender(view(true));
    expect(screen.getByLabelText('机构名称')).toHaveValue('保留的合成机构输入');
    rerender(view(false));
    expect(screen.getByLabelText('机构名称')).toHaveValue('保留的合成机构输入');
    fireEvent.click(screen.getByText('模拟结果待确认'));
    expect(screen.getByLabelText('机构名称')).toBeDisabled();
    fireEvent.click(screen.getByText('原操作重试'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('puts searchable mobile options inside the active native dialog', async () => {
    render(
      <UIContext.Provider value={{ adapter: mobile, mobile: true }}>
        <Drawer visible title="筛选" footer={null}>
          <Select
            aria-label="意向机构"
            showSearch
            options={[
              { value: 'a', label: '合成甲' },
              { value: 'b', label: '合成乙' },
            ]}
          />
        </Drawer>
      </UIContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '意向机构' }));
    const search = await screen.findByRole('textbox', { name: '搜索选项' });
    expect(search.closest('dialog')).toHaveAttribute('aria-label', '筛选');
    fireEvent.change(search, { target: { value: '合成乙' } });
    expect(screen.queryByRole('button', { name: '合成甲' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '合成乙' })).toBeVisible();
  });

  it('restores page scrolling when the outer dialog unmounts before its confirmation closes', async () => {
    function Flow({ outer, inner }: { outer: boolean; inner: boolean }) {
      return (
        <UIContext.Provider value={{ adapter: desktop, mobile: false }}>
          {outer && (
            <Drawer visible title="详情" footer={null}>
              输入
            </Drawer>
          )}
          <Modal visible={inner} title="离开当前页面" onOk={() => {}}>
            确认
          </Modal>
        </UIContext.Provider>
      );
    }
    const before = document.body.style.overflow;
    const { rerender } = render(<Flow outer inner />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Flow outer={false} inner />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Flow outer={false} inner={false} />);
    await waitFor(() => expect(document.body.style.overflow).toBe(before));
  });
});
