import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { PostCard } from '../components/PostCard.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icon.jsx';
import { StoryComposer } from '../components/StoryComposer.jsx';
import { CardSkeleton, ErrorState, Spinner } from '../components/States.jsx';
import { fullDate, relativeTime } from '../lib/time.js';

const MAX_COMMENT = 500;

function Comments({ postId, onCountChange }) {
  const { request, isAuthenticated, login } = useApi();
  const { data, error, loading, reload, setData } = useResource((signal) => request(`/posts/${postId}/comments`, { signal }), [postId]);
  const [text, setText] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const listEnd = useRef(null);

  const trimmed = text.trim();
  const over = text.length > MAX_COMMENT;

  async function submit(e) {
    e.preventDefault();
    if (!isAuthenticated) return login();
    if (!trimmed) return setFormError('Write a comment before posting.');
    if (over) return setFormError(`Comments can be up to ${MAX_COMMENT} characters. Remove ${text.length - MAX_COMMENT}.`);
    setBusy(true);
    setFormError('');
    try {
      const result = await request(`/posts/${postId}/comments`, { method: 'POST', auth: true, body: { text: trimmed } });
      setData((d) => ({ comments: [...(d?.comments || []), result.comment] }));
      onCountChange(result.commentCount);
      setText('');
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    } catch (err) {
      if (err.status !== 401) setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="comments" id="comments" aria-labelledby="comments-title">
      <h2 id="comments-title" className="section-title">Comments</h2>
      {loading ? <Spinner label="Loading comments…" /> : null}
      {error ? <ErrorState error={error} onRetry={reload} title="Comments didn’t load" /> : null}
      {data && !data.comments.length ? <p className="muted">No comments yet. Ask a question or add what you learned.</p> : null}
      {data?.comments.length ? (
        <ol className="comment-list">
          {data.comments.map((c) => (
            <li key={c.id} className="comment">
              <Link to={`/users/${c.author.id}`} aria-hidden="true" tabIndex={-1}><Avatar user={c.author} size={32} /></Link>
              <div>
                <p className="comment-meta">
                  <Link to={`/users/${c.author.id}`} className="strong">{c.author.name}</Link>
                  <time dateTime={c.createdAt} title={fullDate(c.createdAt)} className="muted small">{relativeTime(c.createdAt)}</time>
                </p>
                <p className="comment-text">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div ref={listEnd} />

      {isAuthenticated ? (
        <form className="comment-form" onSubmit={submit} noValidate>
          <label htmlFor="comment-text" className="label">Add a comment</label>
          <textarea
            id="comment-text"
            className={`input${over || formError ? ' input-invalid' : ''}`}
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (formError) setFormError('');
            }}
            placeholder="What stood out to you?"
            aria-invalid={over || Boolean(formError) || undefined}
            aria-describedby="comment-count comment-error"
          />
          <div className="form-row">
            <span id="comment-count" className={`counter${over ? ' counter-over' : ''}`}>{text.length}/{MAX_COMMENT}</span>
            <button type="submit" className="btn btn-primary" disabled={busy || !trimmed || over}>
              {busy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
          <p id="comment-error" className="form-error" role="alert">
            {formError || (over ? `That’s ${text.length - MAX_COMMENT} characters over the limit.` : '')}
          </p>
        </form>
      ) : (
        <div className="signin-inline">
          <p className="muted">Sign in to join the conversation.</p>
          <button type="button" className="btn btn-primary" onClick={() => login()}>Sign in to comment</button>
        </div>
      )}
    </section>
  );
}

export function PostPage() {
  const { id } = useParams();
  const location = useLocation();
  const { request, authLoading, isAuthenticated, login } = useApi();
  const [composing, setComposing] = useState(false);
  const { data, error, loading, reload, setData } = useResource((signal) => request(`/posts/${id}`, { signal }), [id], {
    enabled: !authLoading,
  });

  useEffect(() => {
    if (data && location.hash === '#comments') {
      document.getElementById('comments')?.scrollIntoView({ block: 'start' });
    }
  }, [data, location.hash]);

  if (authLoading || loading) return <div className="page"><CardSkeleton count={1} /></div>;
  if (error) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={error.status === 404 ? null : reload} title={error.status === 404 ? 'Post not found' : 'This post didn’t load'} />
        {error.status === 404 ? <p className="hint center"><Link to="/">Back to the feed</Link></p> : null}
      </div>
    );
  }

  const { post, sequence } = data;
  const index = sequence.findIndex((p) => p.id === post.id);
  const prev = sequence[index - 1];
  const next = sequence[index + 1];
  const patchPost = (patch) => setData((d) => ({ ...d, post: { ...d.post, ...patch } }));

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Feed</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/topics/${post.topic.slug}`}>{post.topic.name}</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/sequences/${post.source.id}`}>Full lesson</Link>
      </nav>

      <PostCard post={post} detail onChange={patchPost} />

      <div className="post-tools">
        <button type="button" className="btn btn-small" onClick={() => (isAuthenticated ? setComposing(true) : login())}>
          <Icon name="sparkle" size={16} /> Add to your story
        </button>
      </div>

      <nav className="seq-nav" aria-label="Lesson navigation">
        {prev ? (
          <Link to={`/posts/${prev.id}`} className="seq-link">
            <span className="muted small"><Icon name="back" size={14} /> Previous</span>
            <span>{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/posts/${next.id}`} className="seq-link seq-next">
            <span className="muted small">Next <Icon name="next" size={14} /></span>
            <span>{next.title}</span>
          </Link>
        ) : null}
      </nav>

      <Comments postId={post.id} onCountChange={(commentCount) => patchPost({ commentCount })} />

      {composing ? <StoryComposer post={post} onClose={() => setComposing(false)} onPosted={() => setComposing(false)} /> : null}
    </div>
  );
}
