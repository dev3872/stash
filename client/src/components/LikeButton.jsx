import { useEffect, useState } from 'react';
import { useApi } from '../api/useApi.js';
import { useToast } from './Toast.jsx';
import { Icon } from './Icon.jsx';
import { compactNumber } from '../lib/time.js';

export function LikeButton({ post, onChange }) {
  const { request, isAuthenticated, login } = useApi();
  const toast = useToast();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(post.likedByMe);
    setCount(post.likeCount);
  }, [post.likedByMe, post.likeCount]);

  async function toggle() {
    if (!isAuthenticated) return login();
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const result = await request(`/posts/${post.id}/like`, { method: next ? 'POST' : 'DELETE', auth: true });
      setLiked(result.liked);
      setCount(result.likeCount);
      onChange?.({ likedByMe: result.liked, likeCount: result.likeCount });
    } catch (err) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      if (err.status !== 401) toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`action${liked ? ' action-liked' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'} “${post.title}”. ${count} ${count === 1 ? 'like' : 'likes'}`}
    >
      <Icon name="heart" filled={liked} />
      <span aria-hidden="true">{compactNumber(count)}</span>
    </button>
  );
}
