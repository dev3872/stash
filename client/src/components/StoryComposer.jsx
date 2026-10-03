import { useEffect, useRef, useState } from 'react';
import { useApi } from '../api/useApi.js';
import { useToast } from './Toast.jsx';
import { Icon } from './Icon.jsx';

const THEMES = [
  ['sunrise', 'Sunrise'],
  ['ocean', 'Ocean'],
  ['forest', 'Forest'],
  ['ink', 'Ink'],
  ['plum', 'Plum'],
];
const MAX = 220;

export function StoryComposer({ post = null, onClose, onPosted }) {
  const { request } = useApi();
  const toast = useToast();
  const [text, setText] = useState(post ? `Today I learned: ${post.title}` : '');
  const [theme, setTheme] = useState('sunrise');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = text.trim();
  const over = text.length > MAX;

  async function submit(e) {
    e.preventDefault();
    if (!trimmed) return setError('Write something for your story.');
    if (over) return setError(`Stories can be up to ${MAX} characters.`);
    setBusy(true);
    setError('');
    try {
      await request('/stories', { method: 'POST', auth: true, body: { text: trimmed, theme, postId: post?.id } });
      toast('Added to your story for 24 hours');
      onPosted?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="composer-title" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="composer-title">New story</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className={`story-preview theme-${theme}`}>
          <p>{trimmed || 'What did you learn today?'}</p>
        </div>

        <label htmlFor="story-text" className="label">Story text</label>
        <textarea
          id="story-text"
          ref={textRef}
          className={`input${over ? ' input-invalid' : ''}`}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share one thing you learned"
          aria-describedby="story-count story-error"
          aria-invalid={over || undefined}
        />
        <p id="story-count" className={`counter${over ? ' counter-over' : ''}`}>{text.length}/{MAX}</p>

        <fieldset className="themes">
          <legend className="label">Background</legend>
          {THEMES.map(([value, label]) => (
            <label key={value} className={`theme-swatch theme-${value}${theme === value ? ' selected' : ''}`}>
              <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />
              <span className="visually-hidden">{label}</span>
            </label>
          ))}
        </fieldset>

        {post ? <p className="muted small">Links to “{post.title}”. Stories disappear after 24 hours.</p> : <p className="muted small">Stories disappear after 24 hours.</p>}
        <p id="story-error" className="form-error" role="alert">{error}</p>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Share to story'}</button>
        </div>
      </form>
    </div>
  );
}
