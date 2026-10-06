import { Fragment, useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { TopicArt } from './TopicArt.jsx';
import { themeStyle } from '../lib/theme.js';

const STOP = new Set(`about above after again also because been before being below between both could does doing during each
from further have having here into itself just more most much must only other over same should some such than that their them
then there these they this those through under until very were what when where which while will with would your part basics
picture`.split(/\s+/));

/** Splits a short paragraph into sentences without breaking on "e.g." or "Dr.". */
export function sentences(text) {
  const protectedText = String(text || '').replace(/\b(e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|Prof|St|U\.S|approx)\./g, (m) => m.replace(/\./g, '․'));
  return protectedText
    .split(/(?<=[.!?]["”’)]?)\s+(?=["“(]?[\p{Lu}\d])/u)
    .map((s) => s.replace(/․/g, '.').trim())
    .filter(Boolean);
}

function keyTerms(title, topicName) {
  const words = `${title} ${topicName || ''}`.toLowerCase().match(/[\p{L}][\p{L}'’-]+/gu) || [];
  return [...new Set(words.filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 6);
}

/**
 * Wraps the first mention of each key term in a highlighter mark. A plain
 * function (not a component) so one `seen` set spans the whole bite within a
 * single render.
 */
function highlight(text, terms, seen) {
  if (!terms.length) return text;
  const pattern = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(s|es)?\\b`, 'giu');
  const out = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(last, match.index));
    out.push(<mark key={match.index} className="hl">{match[0]}</mark>);
    last = match.index + match[0].length;
  }
  out.push(text.slice(last));
  return out.map((part, i) => (typeof part === 'string' ? <Fragment key={`t${i}`}>{part}</Fragment> : part));
}

function Credit({ media }) {
  const parts = [media.credit, media.license].filter(Boolean).join(' · ');
  const label = media.kind === 'video' ? 'Video' : media.kind === 'animation' ? 'Animation' : 'Image';
  return (
    <span className="media-credit">
      {label}: {media.pageUrl ? (
        <a href={media.pageUrl} target="_blank" rel="noopener noreferrer">{parts || 'Wikimedia Commons'}</a>
      ) : parts || 'Wikimedia Commons'}
      {parts ? ' · Wikimedia Commons' : ''}
    </span>
  );
}

/** The picture, animation or short video at the top of a bite. Falls back to topic art. */
export function BiteMedia({ media, topic, variant }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [media?.url]);

  if (!media || broken) {
    return (
      <div className="bite-media bite-media-art" aria-hidden="true">
        <TopicArt topic={topic} variant={variant} />
      </div>
    );
  }

  const frameStyle = { '--media-bg': `url("${(media.kind === 'video' ? media.poster : media.url) || ''}")` };

  return (
    <figure className={`bite-media bite-media-${media.kind}`}>
      <div className="bite-media-frame" style={frameStyle}>
        {media.kind === 'video' ? (
          <video
            controls
            playsInline
            muted
            loop
            preload="none"
            poster={media.poster || undefined}
            aria-label={media.caption || 'Video'}
            onError={() => setBroken(true)}
          >
            <source src={media.url} type={media.mime || 'video/webm'} onError={() => setBroken(true)} />
          </video>
        ) : (
          <img
            src={media.url}
            alt={media.caption || ''}
            loading="lazy"
            decoding="async"
            width={media.width || undefined}
            height={media.height || undefined}
            onError={() => setBroken(true)}
          />
        )}
        {media.kind !== 'image' ? (
          <span className="media-badge">
            <Icon name={media.kind === 'video' ? 'play' : 'sparkle'} size={13} filled={media.kind === 'video'} />
            {media.kind === 'video' ? 'Video' : 'Animation'}
          </span>
        ) : null}
      </div>
      <figcaption>
        {media.caption ? <span className="media-caption">{media.caption}</span> : null}
        <Credit media={media} />
      </figcaption>
    </figure>
  );
}

/** Reads the bite aloud with the browser's built-in speech, when there is one. */
function ListenButton({ post }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [post.id, supported]);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const text = [post.title, post.body, post.example ? `For example: ${post.example}` : ''].filter(Boolean).join('. ');
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button type="button" className={`listen-btn${speaking ? ' on' : ''}`} onClick={toggle} aria-pressed={speaking}>
      <Icon name={speaking ? 'pause' : 'volume'} size={16} />
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}

/**
 * One bite, laid out for easy reading: a picture first, a short title, the key
 * idea in large type, the remaining points one per line with key terms
 * highlighted, then an everyday example.
 */
export function BiteCard({ post, total, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`;
  const [lead, ...rest] = sentences(post.body);
  const terms = keyTerms(post.title, post.topic?.name);
  const seen = new Set();
  const leadNodes = lead ? highlight(lead, terms, seen) : null;
  const pointNodes = rest.map((sentence) => highlight(sentence, terms, seen));

  return (
    <article className="bite" style={themeStyle(post.topic)} aria-labelledby={`bite-${post.id}`}>
      <BiteMedia media={post.media} topic={post.topic} variant={`${post.source?.id || ''}-${post.order}`} />
      <div className="bite-content">
        <div className="bite-toprow">
          <p className="bite-count">Bite {post.order + 1}{total ? ` of ${total}` : ''}</p>
          <ListenButton post={post} />
        </div>
        <Heading className="bite-title" id={`bite-${post.id}`}>{post.title}</Heading>

        {lead ? (
          <div className="bite-key">
            <span className="bite-key-label"><Icon name="bolt" size={14} filled /> Key idea</span>
            <p className="bite-lead">{leadNodes}</p>
          </div>
        ) : null}

        {rest.length ? (
          <ul className="bite-points">
            {pointNodes.map((nodes, i) => (
              <li key={i}>{nodes}</li>
            ))}
          </ul>
        ) : null}

        {post.example ? (
          <div className="bite-example">
            <span className="bite-example-label"><Icon name="bulb" size={18} /> Think of it like this</span>
            <p>{post.example}</p>
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
}
