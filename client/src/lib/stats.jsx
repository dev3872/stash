import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useApi } from '../api/useApi.js';
import { localTimeZone } from './theme.js';

const StatsContext = createContext({ stats: null, loading: false, refresh: () => {}, apply: () => {} });

/** Streak, daily goal and in-progress lessons for the signed-in learner. */
export function StatsProvider({ children }) {
  const { request, isAuthenticated, authLoading } = useApi();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  // `request` changes identity on every navigation; keep a ref so stats load once per sign-in.
  const requestRef = useRef(request);
  requestRef.current = request;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await requestRef.current(`/me/stats?tz=${encodeURIComponent(localTimeZone())}`, { auth: true });
      setStats(data.stats);
    } catch {
      // stats are decoration; the app works without them
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) setStats(null);
    else refresh();
  }, [authLoading, isAuthenticated, refresh]);

  // Merge a partial stats object (from a progress response) without losing inProgress.
  const apply = useCallback((partial) => setStats((s) => ({ ...(s || {}), ...partial })), []);

  return <StatsContext.Provider value={{ stats, loading, refresh, apply }}>{children}</StatsContext.Provider>;
}

export const useStats = () => useContext(StatsContext);
