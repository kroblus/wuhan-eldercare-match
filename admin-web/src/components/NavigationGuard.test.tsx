import { useState } from 'react';
import { createMemoryRouter, RouterProvider, Outlet, Link } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkState, useDirty, useMutation } from '../state';
import { client } from '../api/client';
import { p1 } from '../api/schema';
import NavigationGuard from './NavigationGuard';
const NativeRequest = globalThis.Request;
// jsdom's AbortSignal belongs to a different realm from Node's fetch Request.
// These memory-router tests have no loaders/network; omit only that incompatible signal.
beforeEach(() =>
  vi.stubGlobal(
    'Request',
    class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, { ...init, signal: undefined });
      }
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());
function Editing() {
  const [dirty, setDirty] = useState(false);
  useDirty('fixture', dirty);
  const mutation = useMutation('fixture/save', p1);
  return (
    <>
      <input aria-label="test input" onChange={() => setDirty(true)} />
      <button
        onClick={() =>
          void mutation.run('/resources', { action: 'BLOCK', blockId: 'stable' }).catch(() => {})
        }
      >
        save
      </button>
      <Link to="/next">next</Link>
    </>
  );
}
function mount() {
  const router = createMemoryRouter([
    {
      element: (
        <WorkState>
          <NavigationGuard />
          <Outlet />
        </WorkState>
      ),
      children: [
        { path: '/', element: <Editing /> },
        { path: '/next', element: <p>next screen</p> },
      ],
    },
  ]);
  render(<RouterProvider router={router} />);
  return router;
}
it('protects dirty input across route changes and unload until explicit discard', async () => {
  mount();
  fireEvent.change(screen.getByLabelText('test input'), { target: { value: 'kept' } });
  fireEvent.click(screen.getByText('next'));
  await screen.findByText('离开当前页面？');
  expect(screen.getByLabelText('test input')).toHaveValue('kept');
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText('test input')).toHaveValue('kept');
  fireEvent.click(screen.getByText('next'));
  fireEvent.click(await screen.findByRole('button', { name: '放弃修改并离开' }));
  await screen.findByText('next screen');
});
it('unknown mutation has no discard shortcut and remains on the same route', async () => {
  vi.spyOn(client, 'request').mockRejectedValue(new TypeError('unknown'));
  mount();
  fireEvent.click(screen.getByText('save'));
  fireEvent.click(screen.getByText('next'));
  await screen.findByText('写入结果尚未确认');
  expect(screen.queryByRole('button', { name: '放弃修改并离开' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '留在此页' }));
  expect(screen.queryByText('next screen')).not.toBeInTheDocument();
});
