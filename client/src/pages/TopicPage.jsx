import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { LessonList } from '../components/LessonList.jsx';
import { TopicChips } from '../components/TopicChips.jsx';
import { TopicArt } from '../components/TopicArt.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/States.jsx';
import { themeStyle } from '../lib/theme.js';

export function TopicPage() {
  const { slug } = useParams();
  const { request, authLoading, isAuthenticated } = useApi();
  const topics = useResource((signal) => request('/topics', { signal }), []);
  const info = useResource((signal) => request(`/topics/${slug}`, { signal }), [slug]);
  const [first, setFirst] = useState(null);

  const loadPage = useCallback(
    async (cursor, signal) => {
      const qs = new URLSearchParams({ topic: slug, limit: '8' });
      if (cursor) qs.set('cursor', cursor);
      const data = await request(`/lessons?${qs}`, { signal });
      if (!cursor) setFirst(data.lessons.find((l) => !l.progress?.completed) || data.lessons[0] || null);
      return { lessons: data.lessons, next: data.nextCursor };
    },
    [request, slug]
  );

  if (authLoading || info.loading) return <Spinner label="Loading topic…" />;
  if (info.error) {
    const missing = info.error.status === 404;
    return (
      <div className="page">
        <ErrorState
          error={missing ? { message: 'There’s no topic at this address. Pick another one or make a lesson.' } : info.error}
          onRetry={missing ? null : info.reload}
          title={missing ? 'Topic not found' : 'This topic didn’t load'}
        />
        <TopicChips topics={topics.data?.topics} label="Other topics" />
      </div>
    );
  }

  const { topic } = info.data;
  const startHref = first ? `/learn/${first.id}${first.progress && !first.progress.completed ? `?b=${first.progress.current + 1}` : ''}` : null;

  return (
    <div className="page">
      <header className="topic-hero" style={themeStyle(topic)}>
        <TopicArt topic={topic} className="topic-hero-art" />
        <div className="topic-hero-text">
          <p className="eyebrow on-art">Topic</p>
          <h1>{topic.name}</h1>
          <p className="topic-hero-meta">
            {topic.lessonCount} {topic.lessonCount === 1 ? 'lesson' : 'lessons'} · {topic.postCount} {topic.postCount === 1 ? 'bite' : 'bites'}
          </p>
          <div className="topic-hero-actions">
            {startHref ? (
              <Link to={startHref} className="btn btn-white">
                <Icon name="play" size={16} filled /> {first.progress && !first.progress.completed ? 'Continue' : 'Start learning'}
              </Link>
            ) : null}
            <Link to="/create" state={{ topic: topic.name }} className="btn btn-ghost-dark">
              <Icon name="plus" size={18} /> Add a lesson
            </Link>
          </div>
        </div>
      </header>

      <TopicChips topics={topics.data?.topics} label="Other topics" />

      <h2 className="section-title">Lessons in {topic.name}</h2>
      <LessonList
        key={`${slug}-${isAuthenticated}`}
        resetKey={`${slug}-${isAuthenticated}`}
        loadPage={loadPage}
        headingLevel={3}
        empty={<EmptyState title="No lessons in this topic yet" action={{ to: '/create', label: 'Create a lesson' }} />}
      />
    </div>
  );
}
