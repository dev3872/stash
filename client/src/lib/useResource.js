import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with `loader(signal)` whenever `deps` change (and `enabled` is true).
 * Exposes { data, error, loading, reload, setData }.
 */
export function useResource(loader, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current(controller.signal)
      .then((data) => !controller.signal.aborted && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setState((s) => ({ ...s, error, loading: false }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  // Between `enabled` turning true and the effect running there is one render with
  // no data yet; report it as loading so callers never see { loading: false, data: null }.
  const loading = state.loading || (enabled && state.data === null && state.error === null);
  return { ...state, loading, reload, setData };
}
