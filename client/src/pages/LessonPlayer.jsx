import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { useStats } from '../lib/stats.jsx';
import { localTimeZone, themeStyle } from '../lib/theme.js';
import { useToast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { LikeButton } from '../components/LikeButton.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { SourceLine } from '../components/SourceLine.jsx';
import { BiteCard } from '../components/BiteCard.jsx';
import { GoalRing } from '../components/DailyGoal.jsx';
import { LessonCover, LessonMini } from '../components/LessonCard.jsx';
import { ErrorState, Spinner } from '../components/States.jsx';
import { compactNumber } from '../lib/time.js';

const SWIPE_PX = 60;

function BiteActions({ post, onChange }) {
  const navigate = useNavigate();
  return (
    <div className="bite-actions">
      <LikeButton post={post} onChange={onChange} />
      <button
        type="button"
        className="action"
        onClick={() => navigate(`/posts/${post.id}#comments`)}
        aria-label={`Comments on “${post.title}”: ${post.commentCount}`}
      >
        <Icon name="comment" />
        <span aria-hidden="true">{compactNumber(post.commentCount)}</span>
      </button>
      <ShareButton post={post} />
    </div>
  );
}

function Recap({ data, stats, isAuthenticated, onSignIn, onReplay }) {
  const { lesson, posts, next } = data;
  return (
    <section className="recap" aria-labelledby="recap-title">
      <div className="recap-badge" aria-hidden="true">
        <span className="recap-art"><LessonCover lesson={lesson} /></span>
        <span className="recap-check"><Icon name="check" size={44} /></span>
      </div>
      <p className="eyebrow">{lesson.topic.name}</p>
      <h1 id="recap-title">Lesson complete!</h1>
      <p className="recap-sub">You read all {posts.length} bites of “{lesson.title}”.</p>

      {isAuthenticated && stats ? (
        <div className="recap-stats">
          <div className="recap-stat">
            <span className="recap-stat-icon flame"><Icon name="flame" size={24} filled /></span>
            <strong>{stats.streak}</strong>
            <span>day streak</span>
          </div>
          <div className="recap-stat">
            <GoalRing value={stats.todayBites} goal={stats.dailyGoal} size={64} />
            <span>{stats.goalMet ? 'Goal done today' : 'Today’s goal'}</span>
          </div>
          <div className="recap-stat">
            <span className="recap-stat-icon trophy"><Icon name="trophy" size={24} /></span>
            <strong>{stats.completedLessons}</strong>
            <span>{stats.completedLessons === 1 ? 'lesson' : 'lessons'} done</span>
          </div>
        </div>
      ) : (
        <div className="recap-guest">
          <p>Sign in to save your progress and start a daily streak.</p>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>Sign in</button>
        </div>
      )}

      <div className="recap-takeaways">
        <h2 className="section-title">What you covered</h2>
        <ol>
          {posts.map((p) => (
            <li key={p.id}>
              <Link to={`?b=${p.order + 1}`} replace>{p.title}</Link>
            </li>
          ))}
        </ol>
      </div>

      {next ? (
        <div className="recap-next">
          <h2 className="section-title">Up next</h2>
          <LessonMini lesson={next} />
        </div>
      ) : null}

      <div className="recap-actions">
        <button type="button" className="btn" onClick={onReplay}><Icon name="replay" size={18} /> Read again</button>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </div>
    </section>
  );
}

export function LessonPlayer() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { request, authLoading, isAuthenticated, login } = useApi();
  const { stats, apply } = useStats();
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const [dir, setDir] = useState('next');
  const drag = useRef(null);
  const [dragX, setDragX] = useState(0);
  const justCreated = Boolean(location.state?.justCreated);

  const { data, error, loading, reload, setData } = useResource(
    (signal) => request(`/lessons/${id}`, { signal }),
    [id, isAuthenticated],
    { enabled: !authLoading }
  );

  const total = data?.posts.length || 0;
  const rawB = params.get('b');
  const atEnd = rawB === 'end';
  const parsed = Number.parseInt(rawB, 10);
  const index = Number.isInteger(parsed) && parsed >= 1 && total ? Math.min(parsed, total) - 1 : null;

  // No bite in the URL yet: resume where the learner stopped, or start at the beginning.
  useEffect(() => {
    if (!data || atEnd || index !== null) return;
    const p = data.lesson.progress;
    const start = p && !p.completed ? p.current : 0;
    setParams({ b: String(start + 1) }, { replace: true, state: location.state });
  }, [data, atEnd, index, setParams, location.state]);

  const go = useCallback(
    (target) => {
      if (!total) return;
      if (target === 'end') {
        setDir('next');
        setParams({ b: 'end' }, { replace: true });
        return;
      }
      const clamped = Math.max(0, Math.min(total - 1, target));
      setDir(index === null || clamped >= index ? 'next' : 'prev');
      setParams({ b: String(clamped + 1) }, { replace: true });
    },
    [total, index, setParams]
  );

  const goNext = useCallback(() => {
    if (atEnd) return;
    if (index === null) return;
    if (index >= total - 1) go('end');
    else go(index + 1);
  }, [atEnd, index, total, go]);

  const goPrev = useCallback(() => {
    if (atEnd) go(total - 1);
    else if (index > 0) go(index - 1);
  }, [atEnd, index, total, go]);

  const close = useCallback(() => {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [location.key, navigate]);

  // Keyboard: arrows move between bites, Escape leaves the lesson.
  useEffect(() => {
    function onKey(e) {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') close();
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, close]);

  // Save progress (signed-in only) a moment after the learner lands on a bite.
  const lessonId = data?.lesson.id;
  useEffect(() => {
    if (!isAuthenticated || !lessonId || index === null) return undefined;
    const timer = setTimeout(async () => {
      const before = statsRef.current;
      try {
        const result = await request(`/lessons/${lessonId}/progress`, {
          method: 'POST',
          auth: true,
          body: { index, tz: localTimeZone() },
        });
        setData((d) => (d ? { ...d, lesson: { ...d.lesson, progress: result.progress } } : d));
        apply(result.stats);
        if (result.stats.goalMet && before && !before.goalMet) toast('Daily goal reached. Nice work!');
        else if (result.stats.activeToday && before && !before.activeToday) {
          toast(result.stats.streak > 1 ? `Streak extended: ${result.stats.streak} days` : 'Streak started: day 1');
        }
      } catch {
        // Progress is best-effort; reading still works.
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isAuthenticated, lessonId, index, request, setData, apply, toast]);

  // Swipe between bites.
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' || e.target.closest('button, a, input')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.horizontal === null && Math.abs(dx) + Math.abs(dy) > 10) d.horizontal = Math.abs(dx) > Math.abs(dy);
    if (d.horizontal) setDragX(dx);
  }
  function onPointerEnd(e) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    setDragX(0);
    if (!d.horizontal) return;
    if (dx <= -SWIPE_PX) goNext();
    else if (dx >= SWIPE_PX) goPrev();
  }

  if (authLoading || loading) {
    return <div className="player player-loading"><Spinner label="Opening lesson…" /></div>;
  }
  if (error) {
    const missing = error.status === 404;
    return (
      <div className="player player-error">
        <ErrorState error={error} onRetry={missing ? null : reload} title={missing ? 'Lesson not found' : 'The lesson didn’t load'} />
        <Link to="/" className="btn">Back to home</Link>
      </div>
    );
  }

  const { lesson, posts } = data;
  const post = index !== null ? posts[index] : null;
  const patchPost = (postId) => (patch) =>
    setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)) }));
  const shown = atEnd ? total : (index ?? 0) + 1;

  return (
    <div className={`player${atEnd ? ' player-end' : ''}`} style={themeStyle(lesson.topic)}>
      <header className="player-top">
        <button type="button" className="icon-btn player-close" onClick={close} aria-label="Close lesson">
          <Icon name="close" />
        </button>
        <ol className="segments" aria-label={`Bite ${shown} of ${total}`}>
          {posts.map((p, i) => {
            const state = atEnd || i < index ? 'done' : i === index ? 'current' : '';
            return (
              <li key={p.id} className={state}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to bite ${i + 1}: ${p.title}`}
                  aria-current={i === index ? 'step' : undefined}
                />
              </li>
            );
          })}
        </ol>
        <span className="player-count" aria-hidden="true">{shown}/{total}</span>
      </header>

      {atEnd ? (
        <div className="player-stage player-stage-end">
          <Recap
            data={data}
            stats={stats}
            isAuthenticated={isAuthenticated}
            onSignIn={() => login()}
            onReplay={() => go(0)}
          />
        </div>
      ) : post ? (
        <>
          <div className="player-meta">
            <Link to={`/topics/${lesson.topic.slug}`} className="topic-tag">{lesson.topic.name}</Link>
            <span className="player-lesson-title">{lesson.title}</span>
          </div>

          {justCreated && index === 0 ? (
            <p className="player-banner" role="status">
              <Icon name="sparkle" size={18} /> Your lesson is ready: {total} bites. Swipe or tap Next to read.
            </p>
          ) : null}

          <div
            className="player-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div
              key={post.id}
              className={`bite-wrap enter-${dir}`}
              style={dragX ? { transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`, transition: 'none' } : undefined}
            >
              <BiteCard post={post} total={total} headingLevel={1}>
                {index === 0 ? (
                  <div className="bite-byline">
                    <Link to={`/users/${lesson.author.id}`} className="author">
                      <Avatar user={lesson.author} size={26} />
                      <span>{lesson.author.name}</span>
                    </Link>
                    <SourceLine source={lesson.source} />
                  </div>
                ) : null}
              </BiteCard>
            </div>
          </div>

          <footer className="player-bottom">
            <BiteActions post={post} onChange={patchPost(post.id)} />
            <div className="player-nav">
              <button type="button" className="btn btn-nav" onClick={goPrev} disabled={index === 0} aria-label="Previous bite">
                <Icon name="back" />
              </button>
              <button type="button" className="btn btn-primary btn-nav-main" onClick={goNext}>
                {index >= total - 1 ? <>Finish <Icon name="check" size={18} /></> : <>Next <Icon name="arrow" size={18} /></>}
              </button>
            </div>
          </footer>
        </>
      ) : (
        <Spinner label="Opening lesson…" />
      )}
    </div>
  );
}
