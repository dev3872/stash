import { Link, useNavigate } from 'react-router';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';
import { LikeButton } from './LikeButton.jsx';
import { ShareButton } from './ShareButton.jsx';
import { compactNumber, fullDate, relativeTime } from '../lib/time.js';

export function SourceLine({ source }) {
  if (!source) return null;
  if (source.kind === 'url') {
    let host = source.url;
    try {
      host = new URL(source.url).hostname.replace(/^www\./, '');
    } catch {
      // keep raw
    }
    return (
      <a className="source-line" href={source.url} target="_blank" rel="noopener noreferrer nofollow">
        <Icon name="link" size={16} />
        <span>{source.title ? `${source.title} · ${host}` : host}</span>
      </a>
    );
  }
  return (
    <span className="source-line">
      <Icon name="file" size={16} />
      <span>Uploaded PDF{source.originalName ? ` · ${source.originalName}` : ''}</span>
    </span>
  );
}

export function PostCard({ post, detail = false, onChange, showLessonLink = true }) {
  const navigate = useNavigate();
  const total = post.source?.postCount;
  const Heading = detail ? 'h1' : 'h2';

  const content = (
    <>
      <p className="part">
        {total ? `Part ${post.order + 1} of ${total}` : `Part ${post.order + 1}`}
      </p>
      <Heading className="card-title">{post.title}</Heading>
      <p className="card-body">{post.body}</p>
      {post.example ? (
        <div className="example">
          <span className="example-label"><Icon name="bulb" size={16} /> Example</span>
          <p>{post.example}</p>
        </div>
      ) : null}
    </>
  );

  return (
    <article className={`card${detail ? ' card-detail' : ''}`} aria-labelledby={`post-${post.id}-title`}>
      <header className="card-head">
        <Link to={`/users/${post.author.id}`} className="author">
          <Avatar user={post.author} size={34} />
          <span className="author-name">{post.author.name}</span>
        </Link>
        <span className="dot" aria-hidden="true">·</span>
        <time dateTime={post.createdAt} title={fullDate(post.createdAt)} className="muted">{relativeTime(post.createdAt)}</time>
        {post.topic ? (
          <Link to={`/topics/${post.topic.slug}`} className="chip chip-small card-topic">{post.topic.name}</Link>
        ) : null}
      </header>

      {detail ? (
        <div className="card-main" id={`post-${post.id}-title`}>{content}</div>
      ) : (
        <Link to={`/posts/${post.id}`} className="card-main card-link" id={`post-${post.id}-title`}>
          {content}
        </Link>
      )}

      {detail ? <SourceLine source={post.source} /> : null}

      <footer className="card-actions">
        <LikeButton post={post} onChange={onChange} />
        <button
          type="button"
          className="action"
          onClick={() => navigate(`/posts/${post.id}#comments`)}
          aria-label={`Comments on “${post.title}”: ${post.commentCount}`}
        >
          <Icon name="comment" />
          <span aria-hidden="true">{compactNumber(post.commentCount)}</span>
        </button>
        <ShareButton post={post} />
        {!detail && showLessonLink && post.source ? (
          <Link className="action action-end" to={`/sequences/${post.source.id}`}>
            <span className="action-label">Full lesson</span>
            <Icon name="next" size={18} />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
