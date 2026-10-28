import { useEffect } from 'react';
// Local browser timing evidence only. No input, identity or remote telemetry is recorded.
export function useRenderMark(name: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => performance.mark(name));
    return () => cancelAnimationFrame(frame);
  }, [name, ready]);
}
