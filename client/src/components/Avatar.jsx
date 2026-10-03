import { useState } from 'react';

const COLORS = ['#4f46e5', '#0e7490', '#b45309', '#be185d', '#15803d', '#7c3aed'];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ user, size = 36, ring = null }) {
  const [broken, setBroken] = useState(false);
  const name = user?.name || 'Learner';
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  const ringClass = ring ? ` avatar-ring avatar-ring-${ring}` : '';

  return (
    <span className={`avatar${ringClass}`} style={style}>
      {user?.picture && !broken ? (
        <img src={user.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <span className="avatar-fallback" style={{ background: color }} aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
