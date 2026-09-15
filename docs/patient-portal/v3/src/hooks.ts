import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch-on-mount hook for the mock API with reload + optimistic set. */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fnRef.current().then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(run, [run]);

  const reload = useCallback(() => {
    fnRef.current().then(setData);
  }, []);

  return { data, loading, reload, setData };
}
