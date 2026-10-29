import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { UIAdapter } from './types';
export const UIContext = createContext<{ adapter: UIAdapter; mobile: boolean } | null>(null);
const media = () => window.matchMedia('(max-width: 767px)');
function subscribe(callback: () => void) {
  const m = media();
  m.addEventListener('change', callback);
  return () => m.removeEventListener('change', callback);
}
export function useMobile() {
  const context = useContext(UIContext);
  const matched = useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => false,
  );
  return context?.mobile ?? matched;
}
export function useUI() {
  const c = useContext(UIContext);
  if (!c) throw Error('UIProvider missing');
  return c.adapter;
}
export function UIProvider({ children }: { children: ReactNode }) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => false,
  );
  const [loaded, setLoaded] = useState<{ adapter: UIAdapter; mobile: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    (mobile ? import('./mobile') : import('./desktop')).then((module) => {
      if (active) setLoaded({ adapter: module.default, mobile });
    });
    return () => {
      active = false;
    };
  }, [mobile]);
  // Keep the same tree and form instances while a viewport transition loads its presentation.
  return loaded ? (
    <UIContext.Provider value={loaded}>{children}</UIContext.Provider>
  ) : (
    <p className="loading" role="status">
      正在打开工作台…
    </p>
  );
}
