import { useEffect, useRef, useState } from 'react';
import { useApi } from '../api/useApi.js';
import { useToast } from './Toast.jsx';
import { Icon } from './Icon.jsx';
import { compactNumber } from '../lib/time.js';

async function copyText(text) {
  if (!navigator.clipboard?.writeText || !window.isSecureContext) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareButton({ post, showCount = false }) {
  const { request, isAuthenticated, login } = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(post.shareCount);
  const [fallbackUrl, setFallbackUrl] = useState(null);
  const inputRef = useRef(null);
  const url = `${window.location.origin}/posts/${post.id}`;

  useEffect(() => setCount(post.shareCount), [post.shareCount]);
  useEffect(() => {
    if (fallbackUrl) inputRef.current?.select();
  }, [fallbackUrl]);

  async function share() {
    if (!isAuthenticated) return login();
    setBusy(true);
    // Copy first, while the click still counts as a user gesture.
    const copied = await copyText(url);
    if (copied) toast('Link copied');
    else setFallbackUrl(url);
    try {
      const result = await request(`/posts/${post.id}/share`, { method: 'POST', auth: true });
      setCount(result.shareCount);
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="share-wrap">
      <button type="button" className="action" onClick={share} disabled={busy} aria-label={`Share “${post.title}”`}>
        <Icon name="share" />
        {showCount ? <span aria-hidden="true">{compactNumber(count)}</span> : <span className="action-label">Share</span>}
      </button>
      {fallbackUrl ? (
        <span className="share-fallback" role="dialog" aria-label="Copy link">
          <label htmlFor={`share-${post.id}`}>Copy this link</label>
          <input
            id={`share-${post.id}`}
            ref={inputRef}
            readOnly
            value={fallbackUrl}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="btn btn-small" onClick={() => setFallbackUrl(null)}>Done</button>
        </span>
      ) : null}
    </span>
  );
}
