import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { client, describe } from './api/client';
export function useRead<T>(path: string | null, schema: z.ZodType<T>) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => client.subscribe(() => setRevision((v) => v + 1)), []);
  useEffect(() => {
    if (!path) {
      setData(undefined);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setData(undefined);
    client
      .request(path, schema)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(describe(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, schema, revision]);
  return { data, error, loading, reload: () => setRevision((v) => v + 1) };
}
