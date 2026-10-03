import { Link } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { Avatar } from './Avatar.jsx';
import { FollowButton } from './FollowButton.jsx';

/** "Suggested for you": people to follow and topics to explore, from the recommender. */
export function Suggestions({ refreshKey }) {
  const { request, authLoading } = useApi();
  const { data } = useResource((signal) => request('/recommendations', { signal }), [refreshKey], { enabled: !authLoading });

  if (!data || (!data.users.length && !data.topics.length)) return null;

  return (
    <section className="panel" aria-labelledby="suggestions-title">
      <h2 id="suggestions-title" className="panel-title">Suggested for you</h2>
      {data.topics.length ? (
        <div className="suggest-topics">
          {data.topics.map((topic) => (
            <Link key={topic.id} to={`/topics/${topic.slug}`} className="chip" title={topic.reason}>
              {topic.name}
            </Link>
          ))}
        </div>
      ) : null}
      {data.users.length ? (
        <ul className="people">
          {data.users.map((user) => (
            <li key={user.id} className="person">
              <Link to={`/users/${user.id}`} className="person-link">
                <Avatar user={user} size={40} />
                <span>
                  <span className="person-name">{user.name}</span>
                  <span className="muted small">{user.reason}</span>
                </span>
              </Link>
              <FollowButton userId={user.id} name={user.name} small />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
