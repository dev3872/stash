import { useCallback, useEffect, useRef, useState } from 'react';
import { LessonCard, LessonSkeleton } from './LessonCard.jsx';
import { ErrorState } from './States.jsx';

/**
 * Paginated lesson cards. `loadPage(cursor, signal)` resolves to { lessons, next }.
 */
export function LessonList({ loadPage, resetKey, empty, headingLevel = 2 }) {
  const [lessons, setLessons] = useState([]);
  const [next, setNext] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(loadPage);
  loadRef.current = loadPage;

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setLessons([]);
    loadRef.current(null, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setLessons(page.lessons);
        setNext(page.next);
        setStatus('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setError(err);
        setStatus('error');
      });
    return () => controller.abort();
  }, [resetKey, attempt]);

  const loadMore = useCallback(async () => {
    setStatus('more');
    try {
      const page = await loadRef.current(next);
      setLessons((current) => {
        const seen = new Set(current.map((l) => l.id));
        return [...current, ...page.lessons.filter((l) => !seen.has(l.id))];
      });
      setNext(page.next);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('moreError');
    }
  }, [next]);

  if (status === 'loading') return <><span className="visually-hidden" role="status">Loading lessons…</span><LessonSkeleton /></>;
  if (status === 'error') return <ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} title="Lessons didn’t load" />;
  if (!lessons.length) return empty;

  return (
    <div className="lesson-list">
      {lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} headingLevel={headingLevel} />)}
      {next !== null && next !== undefined ? (
        <div className="load-more">
          {status === 'moreError' ? <p className="form-error" role="alert">{error?.message}</p> : null}
          <button type="button" className="btn" onClick={loadMore} disabled={status === 'more'}>
            {status === 'more' ? 'Loading…' : status === 'moreError' ? 'Try again' : 'Load more lessons'}
          </button>
        </div>
      ) : (
        <p className="feed-end">You’ve seen every lesson here.</p>
      )}
    </div>
  );
}
