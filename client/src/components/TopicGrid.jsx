import { Link } from 'react-router';
import { TopicArt } from './TopicArt.jsx';
import { themeStyle } from '../lib/theme.js';

export function TopicTile({ topic }) {
  const lessons = topic.lessonCount ?? null;
  return (
    <Link to={`/topics/${topic.slug}`} className="topic-tile" style={themeStyle(topic)}>
      <TopicArt topic={topic} className="topic-tile-art" />
      <span className="topic-tile-text">
        <span className="topic-tile-name">{topic.name}</span>
        <span className="topic-tile-meta">
          {lessons !== null ? `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'} · ` : ''}
          {topic.postCount} {topic.postCount === 1 ? 'bite' : 'bites'}
        </span>
      </span>
    </Link>
  );
}

export function TopicGrid({ topics, label = 'Topics' }) {
  if (!topics?.length) return null;
  return (
    <ul className="topic-grid" aria-label={label}>
      {topics.map((topic) => (
        <li key={topic.id}><TopicTile topic={topic} /></li>
      ))}
    </ul>
  );
}
