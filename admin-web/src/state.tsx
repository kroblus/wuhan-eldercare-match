import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { z } from 'zod';
import { client, ApiError, describe } from './api/client';
type Pending = { path: string; body: unknown; method: string };
type State = {
  pending: Map<string, Pending>;
  setPending: (key: string, value: Pending | null) => void;
  dirty: Map<string, boolean>;
  setDirty: (key: string, value: boolean) => void;
};
const Context = createContext<State | null>(null);
export function WorkState({ children }: { children: ReactNode }) {
  const [pending, setP] = useState(new Map<string, Pending>()),
    [dirty, setD] = useState(new Map<string, boolean>());
  const setPending = useCallback(
    (key: string, value: Pending | null) =>
      setP((old) => {
        const next = new Map(old);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const setDirty = useCallback(
    (key: string, value: boolean) =>
      setD((old) => {
        if (old.has(key) === value) return old;
        const next = new Map(old);
        if (value) next.set(key, true);
        else next.delete(key);
        return next;
      }),
    [],
  );
  return (
    <Context.Provider value={{ pending, setPending, dirty, setDirty }}>{children}</Context.Provider>
  );
}
export function useWork() {
  const state = useContext(Context);
  if (!state) throw Error('WorkState missing');
  return state;
}
export function useDirty(key: string, dirty: boolean) {
  const { setDirty } = useWork();
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}
export function useMutation<T>(key: string, schema: z.ZodType<T>, matches?: (value: T) => boolean) {
  const state = useWork(),
    pending = state.pending.get(key);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const run = async (path: string, body: unknown, method = 'POST'): Promise<T | undefined> => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const epoch = client.epoch;
    const operation = state.pending.get(key) || { path, body: structuredClone(body), method };
    state.setPending(key, operation);
    try {
      const response = await client.request(operation.path, schema, operation);
      if (epoch !== client.epoch) return;
      if (matches && !matches(response))
        throw new ApiError(
          '响应关联不正确，原操作仍保留；请查询服务器实际状态。',
          0,
          'INVALID_ASSOCIATION',
        );
      state.setPending(key, null);
      return response;
    } catch (e) {
      if (epoch !== client.epoch) return;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) state.setPending(key, null);
      setError(describe(e));
      throw e;
    } finally {
      lock.current = false;
      if (epoch === client.epoch) setBusy(false);
    }
  };
  return { run, pending, busy, error, clear: () => state.setPending(key, null), setError };
}
