/**
 * Every topic gets a stable color and cover-art seed from its name, so the same
 * topic always looks the same everywhere (tiles, lesson cards, the player).
 */
export const THEMES = [
  { key: 'violet', color: '#7c5cff', deep: '#5a3be0' },
  { key: 'coral', color: '#ff6b5b', deep: '#e04a3b' },
  { key: 'mint', color: '#16b88a', deep: '#0b8261' },
  { key: 'sky', color: '#2f9bff', deep: '#1677d8' },
  { key: 'sun', color: '#ffb020', deep: '#b06a00' },
  { key: 'pink', color: '#ff4f9a', deep: '#d92f78' },
  { key: 'teal', color: '#0fb5c5', deep: '#0a7f8b' },
  { key: 'orange', color: '#ff8338', deep: '#c9520f' },
];

export function hashString(text = '') {
  let h = 2166136261;
  for (const ch of String(text).toLowerCase()) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function topicTheme(topic) {
  const key = topic?.slug || topic?.name || '';
  const seed = hashString(key);
  return { ...THEMES[seed % THEMES.length], seed };
}

/** Inline style that exposes the theme as CSS custom properties. */
export function themeStyle(topic, extra = {}) {
  const theme = topicTheme(topic);
  return { '--t': theme.color, '--t-deep': theme.deep, ...extra };
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || '';
}

export const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
