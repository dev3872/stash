import { useCallback, useEffect, useRef, useState } from 'react';
import { PostCard } from './PostCard.jsx';
import { CardSkeleton, ErrorState } from './States.jsx';
import { Icon } from './Icon.jsx';

/**
 * Paginated list of post cards. `loadPage(cursor, signal)` must resolve to
 * { posts, next } where `next` is the cursor for the following page or null.
 */
export function FeedList({ loadPage, resetKey, empty, onFirstPage }) {
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | more | moreError
  const [error, setError] = useState(null);
  const loadRef = useRef(loadPage);
  loadRef.current = loadPage;
  const firstRef = useRef(onFirstPage);
  firstRef.current = onFirstPage;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setPosts([]);
    loadRef.current(null, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setPosts(page.posts);
        setNext(page.next);
        setStatus('ready');
        firstRef.current?.(page);
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
      setPosts((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNext(page.next);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('moreError');
    }
  }, [next]);

  const updatePost = useCallback((id, patch) => {
    setPosts((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  if (status === 'loading') return <><span className="visually-hidden" role="status">Loading posts…</span><CardSkeleton count={2} /></>;
  if (status === 'error') return <ErrorState error={error} onRetry={() => setAttempt((n) => n + 1)} title="The feed didn’t load" />;
  if (!posts.length) return empty;

  return (
    <div className="feed">
      {posts.map((post, index) => {
        const startsSequence = index === 0 || posts[index - 1].source?.id !== post.source?.id;
        return (
          <div key={post.id} className={startsSequence && index > 0 ? 'sequence-start' : undefined}>
            {post.recommendation ? (
              <p className="rec-reason"><Icon name="sparkle" size={16} /> {post.recommendation.label}</p>
            ) : null}
            <PostCard post={post} onChange={(patch) => updatePost(post.id, patch)} />
          </div>
        );
      })}
      {next !== null && next !== undefined ? (
        <div className="load-more">
          {status === 'moreError' ? <p className="form-error" role="alert">{error?.message}</p> : null}
          <button type="button" className="btn" onClick={loadMore} disabled={status === 'more'}>
            {status === 'more' ? 'Loading…' : status === 'moreError' ? 'Try again' : 'Load more'}
          </button>
        </div>
      ) : (
        <p className="feed-end">You’re all caught up.</p>
      )}
    </div>
  );
}
