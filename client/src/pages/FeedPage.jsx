import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { useStats } from '../lib/stats.jsx';
import { firstName, greeting } from '../lib/theme.js';
import { LessonList } from '../components/LessonList.jsx';
import { LessonMini, LessonSkeleton, lessonCta } from '../components/LessonCard.jsx';
import { DailyGoal, GuestHero } from '../components/DailyGoal.jsx';
import { TopicGrid } from '../components/TopicGrid.jsx';
import { TopicChips } from '../components/TopicChips.jsx';
import { StoryTray } from '../components/StoryTray.jsx';
import { Suggestions } from '../components/Suggestions.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, SignInPrompt } from '../components/States.jsx';

const TABS = [
  ['latest', 'Latest'],
  ['following', 'Following'],
  ['for-you', 'For you'],
];

const HOME_TOPICS = 6;

export function FeedPage() {
  const { request, authLoading, isAuthenticated, login } = useApi();
  const { user } = useAuth0();
  const { stats } = useStats();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'latest';
  const topics = useResource((signal) => request('/topics', { signal }), []);

  const loadPage = useCallback(
    async (cursor, signal) => {
      if (tab === 'for-you') {
        const data = await request(`/lessons/for-you?page=${cursor ?? 0}&limit=6`, { signal });
        return { lessons: data.lessons, next: data.nextPage };
      }
      const qs = new URLSearchParams({ limit: '8', tab });
      if (cursor) qs.set('cursor', cursor);
      const data = await request(`/lessons?${qs}`, { signal });
      return { lessons: data.lessons, next: data.nextCursor };
    },
    [request, tab]
  );

  function selectTab(key) {
    const nextParams = new URLSearchParams(params);
    if (key === 'latest') nextParams.delete('tab');
    else nextParams.set('tab', key);
    setParams(nextParams, { replace: true });
  }

  const inProgress = stats?.inProgress || [];
  const resume = inProgress[0] ? { ...lessonCta(inProgress[0]), label: `Continue “${inProgress[0].title}”` } : null;
  const allTopics = topics.data?.topics || [];

  let body;
  if (authLoading) body = <LessonSkeleton count={1} />;
  else if (tab === 'following' && !isAuthenticated) {
    body = (
      <SignInPrompt title="See lessons from people you follow" onSignIn={() => login()}>
        Sign in to follow other learners and get their new lessons here.
      </SignInPrompt>
    );
  } else {
    const empty = tab === 'following' ? (
      <>
        <EmptyState title="Nothing from people you follow yet">
          Follow a few learners and their new lessons will show up here.
        </EmptyState>
        <Suggestions />
      </>
    ) : (
      <EmptyState title="No lessons yet" action={{ to: '/create', label: 'Create a lesson' }}>
        Type any topic, or add a PDF or an article, and Stash turns it into a short series of bites with pictures.
      </EmptyState>
    );
    body = <LessonList key={`${tab}-${isAuthenticated}`} loadPage={loadPage} resetKey={`${tab}-${isAuthenticated}`} empty={empty} headingLevel={3} />;
  }

  return (
    <div className="page home">
      <header className="home-hello">
        <p className="eyebrow">{greeting()}{isAuthenticated && user?.name ? `, ${firstName(user.name)}` : ''}</p>
        <h1>What will you learn today?</h1>
      </header>

      {!authLoading && isAuthenticated && stats ? <DailyGoal stats={stats} resume={resume} /> : null}
      {!authLoading && !isAuthenticated ? <GuestHero onSignIn={() => login()} /> : null}

      <StoryTray />

      {inProgress.length ? (
        <section aria-labelledby="continue-title" className="home-section">
          <div className="section-head">
            <h2 id="continue-title" className="section-title">Continue learning</h2>
          </div>
          <div className="rail">
            {inProgress.map((lesson) => <LessonMini key={lesson.id} lesson={lesson} />)}
          </div>
        </section>
      ) : null}

      {allTopics.length ? (
        <section aria-labelledby="topics-title" className="home-section">
          <div className="section-head">
            <h2 id="topics-title" className="section-title">Explore topics</h2>
            {allTopics.length > HOME_TOPICS ? <Link to="/explore" className="see-all">See all <Icon name="next" size={16} /></Link> : null}
          </div>
          <TopicGrid topics={allTopics.slice(0, HOME_TOPICS)} />
        </section>
      ) : null}

      <section aria-labelledby="lessons-title" className="home-section">
        <div className="section-head">
          <h2 id="lessons-title" className="section-title">Lessons</h2>
          <Link to="/create" className="see-all"><Icon name="plus" size={16} /> Make one</Link>
        </div>
        <div className="tabs" role="tablist" aria-label="Lesson feed">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab-btn${tab === key ? ' active' : ''}`}
              onClick={() => selectTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'latest' ? <TopicChips topics={allTopics} /> : null}
        {tab === 'for-you' && !authLoading ? <Suggestions refreshKey={isAuthenticated} /> : null}
        {tab === 'for-you' && !isAuthenticated && !authLoading ? (
          <p className="hint">These picks are popular and recent. <button type="button" className="link-btn" onClick={() => login()}>Sign in</button> to tune them to what you like.</p>
        ) : null}

        <div role="tabpanel" aria-label={TABS.find(([k]) => k === tab)[1]}>{body}</div>
      </section>
    </div>
  );
}
