import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DesktopPrototype from './DesktopPrototype';

it('distinguishes empty counts from failed reads without making an operational request', () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  render(<DesktopPrototype variant="a" />);
  const metrics = screen.getByRole('region', { name: '需求状态统计' });
  expect(
    within(metrics)
      .getAllByRole('button')
      .map((button) => button.querySelector('strong')?.firstChild?.textContent),
  ).toEqual(['3', '1', '1', '1']);
  fireEvent.click(screen.getByText('空数据', { exact: true }));
  expect(
    within(metrics)
      .getAllByRole('button')
      .map((button) => button.querySelector('strong')?.firstChild?.textContent),
  ).toEqual(['0', '0', '0', '0']);
  expect(screen.getByText('暂时没有待联系需求')).toBeInTheDocument();
  fireEvent.click(screen.getByText('错误状态', { exact: true }));
  expect(
    within(metrics)
      .getAllByRole('button')
      .map((button) => button.querySelector('strong')?.firstChild?.textContent),
  ).toEqual(['—', '—', '—', '—']);
  fireEvent.click(screen.getByRole('button', { name: '重试样例' }));
  expect(screen.getByText('样例家庭 01')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
