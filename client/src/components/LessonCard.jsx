import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';
import { TopicArt } from './TopicArt.jsx';
import { compactNumber, fullDate, relativeTime } from '../lib/time.js';
import { themeStyle } from '../lib/theme.js';

export function lessonHref(lesson, bite) {
  return bite ? `/learn/${lesson.id}?b=${bite}` : `/learn/${lesson.id}`;
}

export function lessonCta(lesson) {
  const p = lesson.progress;
  if (p?.completed) return { label: 'Review', icon: 'replay', href: lessonHref(lesson, 1) };
  if (p) return { label: 'Continue', icon: 'play', href: lessonHref(lesson, p.current + 1) };
  return { label: 'Start', icon: 'play', href: lessonHref(lesson) };
}

/** A lesson's picture (from its first illustrated bite) or generated topic art. */
export function LessonCover({ lesson }) {
  const [broken, setBroken] = useState(false);
  if (lesson.cover?.url && !broken) {
    return <img className="lesson-cover-img" src={lesson.cover.url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
  }
  return <TopicArt topic={lesson.topic} variant={lesson.id} />;
}

export function ProgressBar({ value, max, label }) {
  const pct = max ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span className="progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

function readCount(lesson) {
  const p = lesson.progress;
  if (!p) return 0;
  return p.completed ? lesson.postCount : p.furthest + 1;
}

/** A lesson in the feed: cover art, what it's about, and one clear call to action. */
export function LessonCard({ lesson, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  const cta = lessonCta(lesson);
  const read = readCount(lesson);
  const titleId = `lesson-${lesson.id}-title`;

  return (
    <article className="lesson-card" style={themeStyle(lesson.topic)} aria-labelledby={titleId}>
      {lesson.recommendation ? (
        <p className="rec-reason"><Icon name="sparkle" size={16} /> {lesson.recommendation.label}</p>
      ) : null}
      <Link to={cta.href} className="lesson-cover" tabIndex={-1} aria-hidden="true">
        <LessonCover lesson={lesson} />
        <span className="lesson-cover-meta">
          <span className="pill-on-art"><Icon name="layers" size={14} /> {lesson.postCount} bites</span>
          <span className="pill-on-art"><Icon name="clock" size={14} /> {lesson.minutes} min</span>
        </span>
        {lesson.progress?.completed ? <span className="done-badge"><Icon name="check" size={16} /> Done</span> : null}
      </Link>

      <div className="lesson-body">
        {lesson.topic ? (
          <Link to={`/topics/${lesson.topic.slug}`} className="topic-tag">{lesson.topic.name}</Link>
        ) : null}
        <Heading className="lesson-title" id={titleId}>
          <Link to={cta.href}>{lesson.title}</Link>
        </Heading>
        {lesson.preview ? (
          <p className="lesson-preview">
            <strong>{lesson.preview.title}.</strong> {lesson.preview.body}
          </p>
        ) : null}

        {lesson.progress && !lesson.progress.completed ? (
          <div className="lesson-progress">
            <ProgressBar value={read} max={lesson.postCount} label={`${read} of ${lesson.postCount} bites read`} />
            <span className="small muted">{read}/{lesson.postCount}</span>
          </div>
        ) : null}

        <footer className="lesson-foot">
          <Link to={`/users/${lesson.author.id}`} className="author">
            <Avatar user={lesson.author} size={28} />
            <span className="author-name">{lesson.author.name}</span>
          </Link>
          <time dateTime={lesson.createdAt} title={fullDate(lesson.createdAt)} className="muted small">{relativeTime(lesson.createdAt)}</time>
          <span className="lesson-counts muted small" aria-label={`${lesson.likeCount} likes, ${lesson.commentCount} comments`}>
            <span aria-hidden="true"><Icon name="heart" size={15} /> {compactNumber(lesson.likeCount)}</span>
            <span aria-hidden="true"><Icon name="comment" size={15} /> {compactNumber(lesson.commentCount)}</span>
          </span>
          <Link to={cta.href} className="btn btn-primary btn-small lesson-cta">
            <Icon name={cta.icon} size={15} filled={cta.icon === 'play'} /> {cta.label}
            <span className="visually-hidden"> “{lesson.title}”</span>
          </Link>
        </footer>
      </div>
    </article>
  );
}

/** Compact card for horizontal "Continue learning" rails. */
export function LessonMini({ lesson }) {
  const cta = lessonCta(lesson);
  const read = readCount(lesson);
  return (
    <Link to={cta.href} className="lesson-mini" style={themeStyle(lesson.topic)}>
      <span className="lesson-mini-art"><LessonCover lesson={lesson} /></span>
      <span className="lesson-mini-body">
        <span className="topic-tag as-text">{lesson.topic?.name}</span>
        <span className="lesson-mini-title">{lesson.title}</span>
        <ProgressBar value={read} max={lesson.postCount} label={`${read} of ${lesson.postCount} bites read`} />
        <span className="small muted">{cta.label} · bite {Math.min(read + 1, lesson.postCount)} of {lesson.postCount}</span>
      </span>
    </Link>
  );
}

export function LessonSkeleton({ count = 2 }) {
  return (
    <div className="lesson-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="lesson-card skeleton-card" key={i}>
          <div className="sk sk-cover" />
          <div className="lesson-body">
            <div className="sk sk-row" />
            <div className="sk sk-title" />
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}
