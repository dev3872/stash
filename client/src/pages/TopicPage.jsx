import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { FeedList } from '../components/FeedList.jsx';
import { TopicChips } from '../components/TopicChips.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/States.jsx';

export function TopicPage() {
  const { slug } = useParams();
  const { request, authLoading, isAuthenticated } = useApi();
  const topics = useResource((signal) => request('/topics', { signal }), []);
  const [topic, setTopic] = useState(null);
  const [notFound, setNotFound] = useState(null);

  const loadPage = useCallback(
    async (cursor, signal) => {
      const qs = new URLSearchParams({ topic: slug, limit: '10' });
      if (cursor) qs.set('cursor', cursor);
      try {
        const data = await request(`/feed?${qs}`, { signal });
        setTopic(data.topic);
        setNotFound(null);
        return { posts: data.posts, next: data.nextCursor };
      } catch (err) {
        if (err.status === 404) setNotFound(err);
        throw err;
      }
    },
    [request, slug]
  );

  if (authLoading) return <Spinner />;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Topic</p>
        <h1>{topic?.name || (notFound ? 'Topic not found' : ' ')}</h1>
        {topic ? <p className="muted">{topic.postCount} {topic.postCount === 1 ? 'post' : 'posts'}</p> : null}
      </header>
      <TopicChips topics={topics.data?.topics} label="Other topics" />
      {notFound ? (
        <ErrorState error={{ message: 'There’s no topic at this address. Pick one above or create a lesson.' }} title="Topic not found" />
      ) : (
        <FeedList
          key={`${slug}-${isAuthenticated}`}
          resetKey={`${slug}-${isAuthenticated}`}
          loadPage={loadPage}
          empty={<EmptyState title="No posts in this topic yet" action={{ to: '/create', label: 'Create a lesson' }} />}
        />
      )}
    </div>
  );
}
