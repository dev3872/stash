import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icon.jsx';
import { ErrorState, SignInPrompt, Spinner } from '../components/States.jsx';
import { fullDate, relativeTime } from '../lib/time.js';

const MAX = 1000;
const POLL_MS = 4000;

export function ConversationPage() {
  const { id } = useParams();
  const { request, authLoading, isAuthenticated, login } = useApi();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastIdRef = useRef(null);
  const [attempt, setAttempt] = useState(0);

  lastIdRef.current = messages.length ? messages[messages.length - 1].id : null;

  const markRead = useCallback(() => request(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {}), [id, request]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    Promise.all([
      request(`/conversations/${id}`, { signal: controller.signal }),
      request(`/conversations/${id}/messages?limit=50`, { signal: controller.signal }),
    ])
      .then(([c, m]) => {
        setConversation(c.conversation);
        setMessages(m.messages);
        setHasMore(m.hasMore);
        setStatus('ready');
        stickToBottom.current = true;
        markRead();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err);
        setStatus('error');
      });
    return () => controller.abort();
  }, [id, authLoading, isAuthenticated, request, markRead, attempt]);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const after = lastIdRef.current;
      try {
        const data = await request(`/conversations/${id}/messages${after ? `?after=${after}` : ''}`);
        if (data.messages.length) {
          const list = listRef.current;
          stickToBottom.current = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
          setMessages((current) => {
            const seen = new Set(current.map((m) => m.id));
            return [...current, ...data.messages.filter((m) => !seen.has(m.id))];
          });
          markRead();
        }
      } catch {
        // try again next tick
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [status, id, request, markRead]);

  useLayoutEffect(() => {
    if (stickToBottom.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!messages.length) return;
    setLoadingOlder(true);
    const list = listRef.current;
    const prevHeight = list?.scrollHeight || 0;
    try {
      const data = await request(`/conversations/${id}/messages?before=${messages[0].id}&limit=50`);
      stickToBottom.current = false;
      setMessages((current) => [...data.messages, ...current]);
      setHasMore(data.hasMore);
      requestAnimationFrame(() => {
        if (list) list.scrollTop = list.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return setSendError('Type a message first.');
    if (body.length > MAX) return setSendError(`Messages can be up to ${MAX} characters.`);
    setSending(true);
    setSendError('');
    try {
      const result = await request(`/conversations/${id}/messages`, { method: 'POST', auth: true, body: { text: body } });
      stickToBottom.current = true;
      setMessages((current) => (current.some((m) => m.id === result.message.id) ? current : [...current, result.message]));
      setText('');
    } catch (err) {
      if (err.status !== 401) setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (authLoading) return <Spinner />;
  if (!isAuthenticated) {
    return (
      <div className="page">
        <SignInPrompt title="Sign in to read this conversation" onSignIn={() => login()} />
      </div>
    );
  }
  if (status === 'loading') return <Spinner label="Loading conversation…" />;
  if (status === 'error') {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={error.status === 404 ? null : () => setAttempt((n) => n + 1)} title={error.status === 404 ? 'Conversation not found' : 'This conversation didn’t load'} />
        <p className="hint center"><Link to="/messages">Back to messages</Link></p>
      </div>
    );
  }

  const other = conversation.other;
  const over = text.length > MAX;

  return (
    <div className="chat">
      <header className="chat-head">
        <Link to="/messages" className="icon-btn" aria-label="Back to messages"><Icon name="back" /></Link>
        <Link to={`/users/${other.id}`} className="author">
          <Avatar user={other} size={36} />
          <h1 className="chat-title">{other.name}</h1>
        </Link>
      </header>

      <div className="chat-list" ref={listRef} role="log" aria-live="polite" aria-label={`Messages with ${other.name}`}>
        {hasMore ? (
          <div className="center">
            <button type="button" className="btn btn-small" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        ) : null}
        {!messages.length ? <p className="muted center">Say hello to {other.name}. Ask about a lesson or share what you’re learning.</p> : null}
        {messages.map((m, i) => {
          const showTime = i === 0 || new Date(m.createdAt) - new Date(messages[i - 1].createdAt) > 15 * 60 * 1000;
          return (
            <div key={m.id}>
              {showTime ? <p className="chat-time"><time dateTime={m.createdAt}>{fullDate(m.createdAt)}</time></p> : null}
              <div className={`bubble-row${m.fromMe ? ' mine' : ''}`}>
                <p className="bubble" title={relativeTime(m.createdAt)}>
                  <span className="visually-hidden">{m.fromMe ? 'You' : other.name}: </span>
                  {m.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-form" onSubmit={send}>
        <label htmlFor="chat-input" className="visually-hidden">Message {other.name}</label>
        <textarea
          id="chat-input"
          className={`input chat-input${over ? ' input-invalid' : ''}`}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (sendError) setSendError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          aria-invalid={over || undefined}
          aria-describedby="chat-error"
        />
        <button type="submit" className="btn btn-primary icon-only" disabled={sending || !text.trim() || over} aria-label="Send message">
          <Icon name="send" />
        </button>
        <p id="chat-error" className="form-error chat-error" role="alert">
          {sendError || (over ? `${text.length - MAX} characters over the limit.` : '')}
        </p>
      </form>
    </div>
  );
}
