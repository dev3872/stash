import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { FeedList } from '../components/FeedList.jsx';
import { TopicChips } from '../components/TopicChips.jsx';
import { StoryTray } from '../components/StoryTray.jsx';
import { Suggestions } from '../components/Suggestions.jsx';
import { EmptyState, SignInPrompt, Spinner } from '../components/States.jsx';

const TABS = [
  ['latest', 'Latest'],
  ['following', 'Following'],
  ['for-you', 'For you'],
];

export function FeedPage() {
  const { request, authLoading, isAuthenticated, login } = useApi();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'latest';
  const topics = useResource((signal) => request('/topics', { signal }), []);

  const loadPage = useCallback(
    async (cursor, signal) => {
      if (tab === 'for-you') {
        const page = cursor ?? 0;
        const data = await request(`/feed/for-you?page=${page}&limit=3`, { signal });
        return { posts: data.posts, next: data.nextPage };
      }
      const qs = new URLSearchParams({ limit: '10', tab });
      if (cursor) qs.set('cursor', cursor);
      const data = await request(`/feed?${qs}`, { signal });
      return { posts: data.posts, next: data.nextCursor };
    },
    [request, tab]
  );

  function selectTab(key) {
    const nextParams = new URLSearchParams(params);
    if (key === 'latest') nextParams.delete('tab');
    else nextParams.set('tab', key);
    setParams(nextParams, { replace: true });
  }

  let body;
  if (authLoading) body = <Spinner label="Loading your feed…" />;
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
        Turn a PDF or an article into a short series of posts. Pick a topic, add a source, and Stash does the rest.
      </EmptyState>
    );
    body = <FeedList key={`${tab}-${isAuthenticated}`} loadPage={loadPage} resetKey={`${tab}-${isAuthenticated}`} empty={empty} />;
  }

  return (
    <div className="page">
      <h1 className="visually-hidden">Your learning feed</h1>
      <StoryTray />

      <div className="tabs" role="tablist" aria-label="Feed">
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

      {tab === 'latest' ? <TopicChips topics={topics.data?.topics} /> : null}
      {tab === 'for-you' && !authLoading ? <Suggestions refreshKey={isAuthenticated} /> : null}
      {tab === 'for-you' && !isAuthenticated && !authLoading ? (
        <p className="hint">These picks are popular and recent. <button type="button" className="link-btn" onClick={() => login()}>Sign in</button> to tune them to what you like.</p>
      ) : null}

      <div role="tabpanel" aria-label={TABS.find(([k]) => k === tab)[1]}>{body}</div>

      {tab === 'latest' && !authLoading ? (
        <p className="hint center"><Link to="/create">Turn a PDF or link into a lesson →</Link></p>
      ) : null}
    </div>
  );
}
