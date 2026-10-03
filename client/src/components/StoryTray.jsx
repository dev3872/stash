import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '../api/useApi.js';
import { useResource } from '../lib/useResource.js';
import { Avatar } from './Avatar.jsx';
import { StoryViewer } from './StoryViewer.jsx';
import { StoryComposer } from './StoryComposer.jsx';

export function StoryTray() {
  const { request, authLoading, isAuthenticated } = useApi();
  const { user } = useAuth0();
  const [openAt, setOpenAt] = useState(null);
  const [composing, setComposing] = useState(false);
  const { data, reload, setData } = useResource((signal) => request('/stories', { signal }), [isAuthenticated], {
    enabled: !authLoading,
  });

  const tray = data?.tray || [];
  const mine = tray.find((g) => g.isMe);
  const others = tray.filter((g) => !g.isMe);

  function markSeen(storyId) {
    setData((d) => d && {
      tray: d.tray.map((g) => {
        const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
        return { ...g, stories, hasUnseen: stories.some((s) => !s.seen) };
      }),
    });
  }

  if (!isAuthenticated && !tray.length) return null;

  const groups = mine ? [mine, ...others] : others;

  return (
    <section className="stories" aria-label="Stories">
      <ul className="stories-list">
        {isAuthenticated ? (
        <li>
          <button
            type="button"
            className="story-bubble"
            onClick={() => (mine ? setOpenAt(0) : setComposing(true))}
            aria-label={mine ? 'View your story' : 'Add to your story'}
          >
            <span className="story-avatar">
              <Avatar user={user} size={58} ring={mine ? (mine.hasUnseen ? 'new' : 'seen') : null} />
              {!mine ? <span className="story-plus" aria-hidden="true">+</span> : null}
            </span>
            <span className="story-name">Your story</span>
          </button>
          {mine ? (
            <button type="button" className="story-add-more" onClick={() => setComposing(true)} aria-label="Add another story">+</button>
          ) : null}
        </li>
        ) : null}
        {others.map((group, index) => (
          <li key={group.author.id}>
            <button
              type="button"
              className="story-bubble"
              onClick={() => setOpenAt(mine ? index + 1 : index)}
              aria-label={`View ${group.author.name}’s story${group.hasUnseen ? ', new' : ''}`}
            >
              <Avatar user={group.author} size={58} ring={group.hasUnseen ? 'new' : 'seen'} />
              <span className="story-name">{group.author.name.split(' ')[0]}</span>
            </button>
          </li>
        ))}
      </ul>

      {openAt !== null ? (
        <StoryViewer
          groups={groups}
          startGroup={openAt}
          onClose={() => setOpenAt(null)}
          onSeen={markSeen}
          onDeleted={() => {
            setOpenAt(null);
            reload();
          }}
        />
      ) : null}
      {composing ? (
        <StoryComposer
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}
