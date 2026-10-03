import { Link, useLocation, useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { PostCard, SourceLine } from '../components/PostCard.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { CardSkeleton, ErrorState } from '../components/States.jsx';

/** One lesson (all posts made from a single source), top to bottom. */
export function SequencePage() {
  const { id } = useParams();
  const location = useLocation();
  const { request, authLoading } = useApi();
  const { data, error, loading, reload, setData } = useResource(
    (signal) => request(`/feed?source=${id}&limit=30`, { signal }),
    [id],
    { enabled: !authLoading }
  );

  if (loading || authLoading) return <div className="page"><CardSkeleton count={3} /></div>;
  if (error) return <div className="page"><ErrorState error={error} onRetry={error.status === 404 ? null : reload} title={error.status === 404 ? 'Lesson not found' : 'The lesson didn’t load'} /></div>;

  const { source, posts } = data;
  const justCreated = location.state?.justCreated;

  return (
    <div className="page">
      {justCreated ? (
        <div className="banner" role="status">
          Your lesson is ready: {posts.length} posts. Read it top to bottom, or share a post.
        </div>
      ) : null}
      <header className="page-head">
        <p className="eyebrow"><Link to={`/topics/${source.topic.slug}`}>{source.topic.name}</Link></p>
        <h1>{posts[0]?.title ? `${source.topic.name}: a ${posts.length}-part lesson` : source.topic.name}</h1>
        <div className="seq-meta">
          <Link to={`/users/${source.author.id}`} className="author">
            <Avatar user={source.author} size={28} />
            <span>{source.author.name}</span>
          </Link>
          <SourceLine source={source} />
        </div>
        <ol className="toc" aria-label="Parts in this lesson">
          {posts.map((p) => (
            <li key={p.id}><a href={`#part-${p.order + 1}`}>{p.title}</a></li>
          ))}
        </ol>
      </header>
      <div className="feed">
        {posts.map((post) => (
          <div id={`part-${post.order + 1}`} key={post.id} className="anchor">
            <PostCard
              post={post}
              showLessonLink={false}
              onChange={(patch) => setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === post.id ? { ...p, ...patch } : p)) }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
