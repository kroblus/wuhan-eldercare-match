import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { WorkState, useMutation } from './state';
import { client, ApiError } from './api/client';
import { p1 } from './api/schema';
function Mutation() {
  const mutation = useMutation('request/followup', p1);
  return (
    <>
      <p>{mutation.pending ? 'pending' : 'ready'}</p>
      <button
        onClick={() =>
          void mutation
            .run('/requests/fixture/followups', {
              operationId: crypto.randomUUID(),
              note: 'original input',
            })
            .catch(() => {})
        }
      >
        save
      </button>
    </>
  );
}
function Harness() {
  const [show, setShow] = useState(true);
  return (
    <WorkState>
      <button onClick={() => setShow((v) => !v)}>mount</button>
      {show && <Mutation />}
    </WorkState>
  );
}
describe('pending mutation ownership', () => {
  it('remount retries exact original payload and operationId; never auto retries', async () => {
    const call = vi
      .spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network unknown'))
      .mockResolvedValueOnce({ contractVersion: 'p1-service-request-v1' });
    render(<Harness />);
    fireEvent.click(screen.getByText('save'));
    await screen.findByText('pending');
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    const first = call.mock.calls[0][2];
    fireEvent.click(screen.getByText('mount'));
    fireEvent.click(screen.getByText('mount'));
    expect(screen.getByText('pending')).toBeInTheDocument();
    fireEvent.click(screen.getByText('save'));
    await screen.findByText('ready');
    expect(call.mock.calls[1][2]).toEqual(first);
  });
  it('definite conflict unlocks corrected input, but duplicate clicks send once', async () => {
    let reject!: (e: unknown) => void;
    const call = vi.spyOn(client, 'request').mockImplementation(
      () =>
        new Promise((_, no) => {
          reject = no;
        }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByText('save'));
    fireEvent.click(screen.getByText('save'));
    expect(call).toHaveBeenCalledTimes(1);
    reject(new ApiError('conflict', 409));
    await screen.findByText('ready');
  });
});
