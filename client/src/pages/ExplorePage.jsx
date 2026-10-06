import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { TopicGrid } from '../components/TopicGrid.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

export function ExplorePage() {
  const { request } = useApi();
  const { data, error, loading, reload } = useResource((signal) => request('/topics', { signal }), []);
  const [query, setQuery] = useState('');

  const topics = useMemo(() => {
    const all = data?.topics || [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Explore</p>
        <h1>Pick a topic</h1>
        <p className="muted">Every topic is a stack of short lessons made from real sources. Tap one to start reading.</p>
      </header>

      <div className="search-field">
        <Icon name="search" size={20} />
        <label htmlFor="topic-search" className="visually-hidden">Search topics</label>
        <input
          id="topic-search"
          type="search"
          className="input"
          placeholder="Search topics"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="topic-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-tile" />)}
        </div>
      ) : null}
      {error ? <ErrorState error={error} onRetry={reload} title="Topics didn’t load" /> : null}
      {data && !data.topics.length ? (
        <EmptyState title="No topics yet" action={{ to: '/create', label: 'Create the first lesson' }}>
          Topics appear here once someone turns a source into a lesson.
        </EmptyState>
      ) : null}
      {data && data.topics.length && !topics.length ? (
        <EmptyState title={`No topic matches “${query.trim()}”`}>
          Try a shorter word, or <Link to="/create">make a lesson about it</Link>.
        </EmptyState>
      ) : null}
      <TopicGrid topics={topics} label="All topics" />
    </div>
  );
}
