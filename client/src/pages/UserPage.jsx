import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { Avatar } from '../components/Avatar.jsx';
import { LessonList } from '../components/LessonList.jsx';
import { FollowButton } from '../components/FollowButton.jsx';
import { TopicChips } from '../components/TopicChips.jsx';
import { Icon } from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/States.jsx';
import { compactNumber } from '../lib/time.js';

export function ProfileHeader({ user, children }) {
  return (
    <header className="profile-head">
      <Avatar user={user} size={84} />
      <div className="profile-info">
        <h1>{user.name}</h1>
        <ul className="stats">
          <li><strong>{compactNumber(user.sequenceCount ?? 0)}</strong> lessons</li>
          <li><strong>{compactNumber(user.followerCount)}</strong> {user.followerCount === 1 ? 'follower' : 'followers'}</li>
          <li><strong>{compactNumber(user.followingCount)}</strong> following</li>
        </ul>
        {children}
      </div>
    </header>
  );
}

export function AuthorPosts({ userId, isAuthenticated, emptyTitle, emptyAction }) {
  const { request } = useApi();
  const loadPage = useCallback(
    async (cursor, signal) => {
      const qs = new URLSearchParams({ author: userId, limit: '8' });
      if (cursor) qs.set('cursor', cursor);
      const data = await request(`/lessons?${qs}`, { signal });
      return { lessons: data.lessons, next: data.nextCursor };
    },
    [request, userId]
  );
  return (
    <LessonList
      key={`${userId}-${isAuthenticated}`}
      resetKey={`${userId}-${isAuthenticated}`}
      loadPage={loadPage}
      headingLevel={3}
      empty={<EmptyState title={emptyTitle} action={emptyAction} />}
    />
  );
}

export function UserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { request, authLoading, isAuthenticated, login } = useApi();
  const [starting, setStarting] = useState(false);
  const { data, error, loading, reload, setData } = useResource((signal) => request(`/users/${id}`, { signal }), [id, isAuthenticated], {
    enabled: !authLoading,
  });

  if (authLoading || loading) return <Spinner />;
  if (error) return <div className="page"><ErrorState error={error} onRetry={error.status === 404 ? null : reload} title={error.status === 404 ? 'Person not found' : 'This profile didn’t load'} /></div>;
  if (data.isMe) return <Navigate to="/profile" replace />;

  async function message() {
    if (!isAuthenticated) return login();
    setStarting(true);
    try {
      const result = await request('/conversations', { method: 'POST', auth: true, body: { userId: id } });
      navigate(`/messages/${result.conversation.id}`);
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
      setStarting(false);
    }
  }

  return (
    <div className="page">
      <ProfileHeader user={data.user}>
        <div className="profile-actions">
          <FollowButton
            userId={id}
            name={data.user.name}
            initial={data.isFollowing}
            onChange={(r) => setData((d) => ({ ...d, isFollowing: r.following, user: { ...d.user, followerCount: r.followerCount } }))}
          />
          <button type="button" className="btn" onClick={message} disabled={starting}>
            <Icon name="message" size={18} /> {starting ? 'Opening…' : 'Message'}
          </button>
        </div>
      </ProfileHeader>
      {data.topics.length ? (
        <section aria-labelledby="their-topics">
          <h2 id="their-topics" className="section-title">Topics</h2>
          <TopicChips topics={data.topics} showAll={false} label={`${data.user.name}’s topics`} />
        </section>
      ) : null}
      <h2 className="section-title">Lessons</h2>
      <AuthorPosts userId={id} isAuthenticated={isAuthenticated} emptyTitle={`${data.user.name} hasn’t posted a lesson yet`} />
      <p className="hint center"><Link to="/">Back to home</Link></p>
    </div>
  );
}
