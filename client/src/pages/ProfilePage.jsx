import { Link } from 'react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { TopicChips } from '../components/TopicChips.jsx';
import { Icon } from '../components/Icon.jsx';
import { ErrorState, SignInPrompt, Spinner } from '../components/States.jsx';
import { AuthorPosts, ProfileHeader } from './UserPage.jsx';
import { compactNumber, relativeTime } from '../lib/time.js';
import { useStats } from '../lib/stats.jsx';
import { WeekStrip } from '../components/DailyGoal.jsx';
import { LessonMini } from '../components/LessonCard.jsx';
import { TopicBadge } from '../components/TopicArt.jsx';

const STATUS_LABEL = { ready: 'Ready', pending: 'Processing', failed: 'Failed' };

export function ProfilePage() {
  const { request, authLoading, isAuthenticated, login } = useApi();
  const { logout } = useAuth0();
  const { stats } = useStats();
  const { data, error, loading, reload } = useResource((signal) => request('/me', { signal, auth: true }), [], {
    enabled: !authLoading && isAuthenticated,
  });

  if (authLoading) return <Spinner />;
  if (!isAuthenticated) {
    return (
      <div className="page">
        <SignInPrompt title="Your profile lives here" onSignIn={() => login('/profile')}>
          Sign in to see your topics, the lessons you’ve made, and the people you follow.
        </SignInPrompt>
      </div>
    );
  }
  if (loading) return <Spinner label="Loading your profile…" />;
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} title="Your profile didn’t load" /></div>;

  const { user, topics, sources } = data;
  const readyCount = sources.filter((s) => s.status === 'ready').length;

  return (
    <div className="page">
      <ProfileHeader user={{ ...user, sequenceCount: readyCount }}>
        {user.email ? <p className="muted small">{user.email}</p> : null}
        <div className="profile-actions">
          <Link to="/create" className="btn btn-primary"><Icon name="plus" size={18} /> New lesson</Link>
          <button
            type="button"
            className="btn"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            <Icon name="logout" size={18} /> Log out
          </button>
        </div>
      </ProfileHeader>

      {stats ? (
        <section className="learner-panel" aria-labelledby="learner-title">
          <h2 id="learner-title" className="section-title">Your learning</h2>
          <ul className="learner-stats">
            <li className={`learner-stat${stats.activeToday ? ' lit' : ''}`}>
              <Icon name="flame" size={26} filled={stats.activeToday} />
              <strong>{stats.streak}</strong>
              <span>day streak</span>
            </li>
            <li className="learner-stat">
              <Icon name="layers" size={26} />
              <strong>{compactNumber(stats.totalBites)}</strong>
              <span>bites read</span>
            </li>
            <li className="learner-stat">
              <Icon name="trophy" size={26} />
              <strong>{compactNumber(stats.completedLessons)}</strong>
              <span>lessons done</span>
            </li>
            <li className="learner-stat">
              <Icon name="target" size={26} />
              <strong>{stats.todayBites}/{stats.dailyGoal}</strong>
              <span>today</span>
            </li>
          </ul>
          <WeekStrip week={stats.week} />
          {stats.inProgress?.length ? (
            <>
              <h3 className="sub-title">In progress</h3>
              <div className="rail">
                {stats.inProgress.map((lesson) => <LessonMini key={lesson.id} lesson={lesson} />)}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="my-topics">
        <h2 id="my-topics" className="section-title">Your topics</h2>
        {topics.length ? (
          <TopicChips topics={topics} showAll={false} label="Your topics" />
        ) : (
          <p className="muted">You haven’t made a lesson yet. <Link to="/create">Create your first one.</Link></p>
        )}
      </section>

      {sources.length ? (
        <section aria-labelledby="my-sources">
          <h2 id="my-sources" className="section-title">Your uploads</h2>
          <ul className="source-list">
            {sources.map((s) => (
              <li key={s.id} className="source-item">
                <TopicBadge topic={s.topic} size={40} />
                <div className="source-item-text">
                  {s.status === 'ready' ? (
                    <Link to={`/learn/${s.id}`} className="strong">{s.title || s.topic?.name}</Link>
                  ) : (
                    <span className="strong">{s.title || s.topic?.name || 'Untitled source'}</span>
                  )}
                  <p className="muted small">
                    {s.topic?.name} · {s.kind === 'pdf' ? 'PDF' : 'Link'} · {relativeTime(s.createdAt)}
                    {s.status === 'ready' ? ` · ${s.postCount} bites` : ''}
                  </p>
                  {s.status === 'failed' && s.error ? <p className="form-error small">{s.error}</p> : null}
                </div>
                <span className={`status status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="section-title">Your lessons</h2>
      <AuthorPosts
        userId={user.id}
        isAuthenticated
        emptyTitle="No lessons yet"
        emptyAction={{ to: '/create', label: 'Create a lesson' }}
      />
    </div>
  );
}
