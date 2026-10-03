import { NavLink } from 'react-router';

export function TopicChips({ topics, allLabel = 'All topics', showAll = true, label = 'Filter by topic' }) {
  if (!topics?.length) return null;
  return (
    <nav className="chips" aria-label={label}>
      {showAll ? <NavLink to="/" end className="chip">{allLabel}</NavLink> : null}
      {topics.map((topic) => (
        <NavLink key={topic.id} to={`/topics/${topic.slug}`} className="chip">
          {topic.name}
        </NavLink>
      ))}
    </nav>
  );
}
