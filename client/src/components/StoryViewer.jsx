import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../api/useApi.js';
import { useToast } from './Toast.jsx';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';
import { relativeTime } from '../lib/time.js';

const DURATION = 6000;

export function StoryViewer({ groups, startGroup = 0, onClose, onSeen, onDeleted }) {
  const { request, isAuthenticated } = useApi();
  const toast = useToast();
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [storyIndex, setStoryIndex] = useState(() => {
    const first = groups[startGroup]?.stories.findIndex((s) => !s.seen);
    return first > 0 ? first : 0;
  });
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const closeRef = useRef(null);
  const reported = useRef(new Set());

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const next = useCallback(() => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) setStoryIndex((i) => i + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else onClose();
  }, [group, storyIndex, groupIndex, groups.length, onClose]);

  const prev = useCallback(() => {
    if (storyIndex > 0) setStoryIndex((i) => i - 1);
    else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    }
  }, [storyIndex, groupIndex, groups]);

  // Auto-advance.
  useEffect(() => {
    if (paused || !story) return undefined;
    const id = setTimeout(next, DURATION);
    return () => clearTimeout(id);
  }, [story, paused, next]);

  // Record a view once per story.
  useEffect(() => {
    if (!story || group.isMe || reported.current.has(story.id)) return;
    reported.current.add(story.id);
    onSeen?.(story.id);
    if (isAuthenticated) request(`/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
  }, [story, group, isAuthenticated, request, onSeen]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose]);

  async function remove() {
    setDeleting(true);
    try {
      await request(`/stories/${story.id}`, { method: 'DELETE', auth: true });
      toast('Story deleted');
      onDeleted?.();
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(false);
    }
  }

  if (!story) return null;

  return (
    <div className="story-overlay" role="dialog" aria-modal="true" aria-label={`${group.author.name}’s story`}>
      <div className={`story-frame theme-${story.theme}`}>
        <div className="story-progress" aria-hidden="true">
          {group.stories.map((s, i) => (
            <span key={s.id} className="story-seg">
              <span
                className={`story-seg-fill${i < storyIndex ? ' done' : ''}${i === storyIndex ? ' active' : ''}${paused ? ' paused' : ''}`}
                style={i === storyIndex ? { animationDuration: `${DURATION}ms` } : undefined}
                key={`${s.id}-${i === storyIndex}`}
              />
            </span>
          ))}
        </div>

        <div className="story-top">
          <Link to={`/users/${group.author.id}`} className="story-author" onClick={onClose}>
            <Avatar user={group.author} size={32} />
            <span>{group.isMe ? 'Your story' : group.author.name}</span>
            <span className="story-time">{relativeTime(story.createdAt)}</span>
          </Link>
          <button type="button" className="icon-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play story' : 'Pause story'}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <button type="button" className="icon-btn" ref={closeRef} onClick={onClose} aria-label="Close stories">
            <Icon name="close" />
          </button>
        </div>

        <div className="story-content">
          <p className="story-text">{story.text}</p>
          {story.post ? (
            <Link to={`/posts/${story.post.id}`} className="story-post" onClick={onClose}>
              <span className="muted-on-dark">Read the post</span>
              <span>{story.post.title}</span>
            </Link>
          ) : null}
        </div>

        <button type="button" className="story-nav story-nav-prev" onClick={prev} aria-label="Previous story" disabled={groupIndex === 0 && storyIndex === 0}>
          <Icon name="back" />
        </button>
        <button type="button" className="story-nav story-nav-next" onClick={next} aria-label="Next story">
          <Icon name="next" />
        </button>

        {group.isMe ? (
          <div className="story-footer">
            <span><Icon name="eye" size={18} /> Seen by {story.viewCount ?? 0}</span>
            <button type="button" className="btn btn-small btn-ghost-dark" onClick={remove} disabled={deleting}>
              <Icon name="trash" size={16} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
