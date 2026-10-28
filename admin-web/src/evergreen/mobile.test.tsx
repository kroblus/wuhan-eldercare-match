import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MobilePrototype from './MobilePrototype';

beforeEach(() => {
  window.history.replaceState(null, '', '/p1-admin/evergreen.html');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

it('retains a field selection when going back and only completes after every explicit choice', () => {
  render(<MobilePrototype view="conflict" />);
  const finish = screen.getByRole('button', { name: '完成校对' });
  expect(finish).toBeDisabled();
  expect(screen.getByRole('radio', { name: /我的本地版本/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(screen.getByRole('radio', { name: /服务器样例版本/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  fireEvent.click(screen.getByRole('radio', { name: /我的本地版本/ }));
  fireEvent.click(screen.getByRole('button', { name: /下个差异/ }));
  fireEvent.click(screen.getByRole('radio', { name: /服务器样例版本/ }));
  fireEvent.click(screen.getByRole('button', { name: '上个差异' }));
  expect(screen.getByRole('radio', { name: /我的本地版本/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(screen.getByRole('radio', { name: /服务器样例版本/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(finish).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '查看差异3：机构性质' }));
  fireEvent.click(screen.getByRole('radio', { name: /我的本地版本/ }));
  fireEvent.click(screen.getByRole('button', { name: /下个差异/ }));
  fireEvent.click(screen.getByRole('radio', { name: /服务器样例版本/ }));
  expect(finish).toBeEnabled();
  fireEvent.click(finish);
  expect(screen.getByText('仅本页演示，未提交服务器。')).toBeInTheDocument();
  expect(screen.getByText(/从东湖路南门进入，沿无障碍通道直行约 200 米/)).toBeInTheDocument();
  expect(screen.getByText('春和康养服务中心（样例）')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回修改选择' }));
  expect(screen.getByRole('radio', { name: /我的本地版本/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

it('does not silently choose the server when skipping differences', () => {
  render(<MobilePrototype view="conflict" />);
  for (let index = 0; index < 3; index += 1)
    fireEvent.click(screen.getByRole('button', { name: /下个差异/ }));
  expect(screen.getByText('已选 0 / 4')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '完成校对' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /服务器样例版本/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

it('protects contact input and next action, retains the draft on return, and only saves an in-memory sample', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  render(<MobilePrototype view="requests" />);
  fireEvent.click(screen.getByRole('button', { name: '查看样例家庭 A需求' }));
  fireEvent.change(screen.getByRole('textbox', { name: '联系备注' }), {
    target: { value: '合成备注：下周再沟通，尚未确认时间。' },
  });
  fireEvent.click(screen.getByRole('button', { name: '等待回复' }));
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '返回列表' }));
  expect(await screen.findByText('还有未暂存的联系输入')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '继续填写' }));
  expect(screen.getByRole('textbox', { name: '联系备注' })).toHaveValue(
    '合成备注：下周再沟通，尚未确认时间。',
  );
  fireEvent.click(screen.getByRole('button', { name: '返回列表' }));
  fireEvent.click(await screen.findByRole('button', { name: '保留草稿并返回' }));
  fireEvent.click(await screen.findByRole('button', { name: '查看样例家庭 A需求' }));
  expect(screen.getByRole('textbox', { name: '联系备注' })).toHaveValue(
    '合成备注：下周再沟通，尚未确认时间。',
  );
  expect(screen.getByRole('button', { name: '等待回复' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '暂存到样例' }));
  expect(screen.getByRole('status')).toHaveTextContent('未联系任何人');
  expect(screen.getByText('本页暂存记录 1')).toBeInTheDocument();
  const savedUnload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(savedUnload);
  expect(savedUnload.defaultPrevented).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('guards browser back and retains contact input after browser forward', async () => {
  render(<MobilePrototype view="requests" />);
  fireEvent.click(screen.getByRole('button', { name: '查看样例家庭 A需求' }));
  fireEvent.change(screen.getByRole('textbox', { name: '联系备注' }), {
    target: { value: '浏览器前进后退保留的合成输入' },
  });
  act(() => window.history.back());
  await screen.findByText('还有未暂存的联系输入');
  await waitFor(() => expect(window.history.state.index).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '继续填写' }));
  await waitFor(() => expect(screen.queryByText('还有未暂存的联系输入')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: '联系备注' })).toHaveValue(
    '浏览器前进后退保留的合成输入',
  );
  act(() => window.history.back());
  await screen.findByText('还有未暂存的联系输入');
  await waitFor(() => expect(window.history.state.index).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '保留草稿并返回' }));
  await screen.findByRole('button', { name: '查看样例家庭 A需求' });
  act(() => window.history.forward());
  expect(await screen.findByRole('textbox', { name: '联系备注' })).toHaveValue(
    '浏览器前进后退保留的合成输入',
  );
});

it('filters only synthetic requests through the bottom sheet', async () => {
  render(<MobilePrototype view="requests" />);
  fireEvent.click(screen.getByRole('button', { name: '筛选需求状态' }));
  const dialog = await screen.findByRole('dialog', { name: '按状态找需求' });
  fireEvent.click(dialog.querySelector('button[aria-pressed="false"]')!);
  expect(screen.getByRole('button', { name: '查看样例家庭 A需求' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '查看样例家庭 B需求' })).not.toBeInTheDocument();
});
