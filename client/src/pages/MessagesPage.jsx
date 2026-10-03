import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { Avatar } from '../components/Avatar.jsx';
import { useToast } from '../components/Toast.jsx';
import { EmptyState, ErrorState, SignInPrompt, Spinner } from '../components/States.jsx';
import { relativeTime } from '../lib/time.js';

function NewMessage() {
  const { request } = useApi();
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return undefined;
    }
    const controller = new AbortController();
    const id = setTimeout(() => {
      request(`/users?q=${encodeURIComponent(term)}`, { signal: controller.signal, auth: true })
        .then((data) => setResults(data.users))
        .catch((err) => err.name !== 'AbortError' && setResults([]));
    }, 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [q, request]);

  async function open(user) {
    setOpening(user.id);
    try {
      const result = await request('/conversations', { method: 'POST', auth: true, body: { userId: user.id } });
      navigate(`/messages/${result.conversation.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setOpening(null);
    }
  }

  return (
    <div className="panel">
      <label htmlFor="dm-search" className="label">New message</label>
      <input
        id="dm-search"
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people by name"
        autoComplete="off"
      />
      {results ? (
        results.length ? (
          <ul className="people">
            {results.map((user) => (
              <li key={user.id}>
                <button type="button" className="person-link person-button" onClick={() => open(user)} disabled={opening === user.id}>
                  <Avatar user={user} size={36} />
                  <span className="person-name">{user.name}</span>
                  <span className="muted small">{opening === user.id ? 'Opening…' : 'Message'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No one matches “{q.trim()}”.</p>
        )
      ) : null}
    </div>
  );
}

export function MessagesPage() {
  const { request, authLoading, isAuthenticated, login } = useApi();
  const { data, error, loading, reload, setData } = useResource((signal) => request('/conversations', { signal, auth: true }), [], {
    enabled: !authLoading && isAuthenticated,
  });

  // Refresh the inbox every 15 seconds while it's open.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        request('/conversations').then((d) => setData(d)).catch(() => {});
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [isAuthenticated, request, setData]);

  if (authLoading) return <Spinner />;
  if (!isAuthenticated) {
    return (
      <div className="page">
        <SignInPrompt title="Message other learners" onSignIn={() => login('/messages')}>
          Sign in to send direct messages about the lessons you’re reading.
        </SignInPrompt>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Messages</h1>
      </header>
      <NewMessage />
      {loading ? <Spinner label="Loading conversations…" /> : null}
      {error ? <ErrorState error={error} onRetry={reload} title="Messages didn’t load" /> : null}
      {data && !data.conversations.length ? (
        <EmptyState title="No conversations yet">
          Search for someone above, or open a learner’s profile and tap Message.
        </EmptyState>
      ) : null}
      {data?.conversations.length ? (
        <ul className="inbox" aria-label="Conversations">
          {data.conversations.map((c) => (
            <li key={c.id}>
              <Link to={`/messages/${c.id}`} className={`inbox-item${c.unread ? ' unread' : ''}`}>
                <Avatar user={c.other} size={48} />
                <span className="inbox-text">
                  <span className="inbox-name">{c.other.name}</span>
                  <span className="inbox-preview">
                    {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.text}
                  </span>
                </span>
                <span className="inbox-meta">
                  <time dateTime={c.lastMessage.at}>{relativeTime(c.lastMessage.at)}</time>
                  {c.unread ? <span className="unread-dot"><span className="visually-hidden">Unread</span></span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
