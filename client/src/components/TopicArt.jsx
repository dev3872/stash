import { topicTheme } from '../lib/theme.js';

// Small deterministic PRNG so a topic's art never changes between renders.
function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SHAPES = ['circle', 'pill', 'ring', 'squiggle', 'dots', 'star', 'arch', 'triangle'];

function Shape({ kind, x, y, size, rotate, fill }) {
  const t = `translate(${x} ${y}) rotate(${rotate})`;
  switch (kind) {
    case 'circle':
      return <circle transform={t} r={size / 2} fill={fill} />;
    case 'pill':
      return <rect transform={t} x={-size / 2} y={-size / 5} width={size} height={(size * 2) / 5} rx={size / 5} fill={fill} />;
    case 'ring':
      return <circle transform={t} r={size / 2.4} fill="none" stroke={fill} strokeWidth={size / 7} />;
    case 'squiggle':
      return (
        <path
          transform={t}
          d={`M${-size / 2} 0 q${size / 8} ${-size / 4} ${size / 4} 0 t${size / 4} 0 t${size / 4} 0 t${size / 4} 0`}
          fill="none"
          stroke={fill}
          strokeWidth={size / 9}
          strokeLinecap="round"
        />
      );
    case 'dots':
      return (
        <g transform={t} fill={fill}>
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
            <circle key={`${r}-${c}`} cx={(c - 1) * size / 3.2} cy={(r - 1) * size / 3.2} r={size / 16} />
          )))}
        </g>
      );
    case 'star': {
      const r1 = size / 2;
      const r2 = size / 4.5;
      const pts = Array.from({ length: 8 }, (_, i) => {
        const r = i % 2 ? r2 : r1;
        const a = (Math.PI / 4) * i;
        return `${(Math.sin(a) * r).toFixed(1)},${(-Math.cos(a) * r).toFixed(1)}`;
      }).join(' ');
      return <polygon transform={t} points={pts} fill={fill} />;
    }
    case 'arch':
      return <path transform={t} d={`M${-size / 2} ${size / 3} v${-size / 6} a${size / 2} ${size / 2} 0 0 1 ${size} 0 v${size / 6} z`} fill={fill} />;
    default:
      return <polygon transform={t} points={`0,${-size / 2} ${size / 2},${size / 2.6} ${-size / 2},${size / 2.6}`} fill={fill} rx="4" />;
  }
}

/**
 * Generated cover art: a colored field with a few playful shapes, seeded by topic
 * (and optionally a lesson id so lessons in one topic still look different).
 */
export function TopicArt({ topic, variant = '', className = '', label }) {
  const theme = topicTheme(topic);
  const rand = rng(theme.seed ^ (variant ? [...variant].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) : 0));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const items = Array.from({ length: 5 }, (_, i) => ({
    kind: pick(SHAPES),
    x: 20 + rand() * 280,
    y: 20 + rand() * 140,
    size: i === 0 ? 120 + rand() * 50 : 34 + rand() * 46,
    rotate: Math.round(rand() * 360),
    fill: i === 0 ? 'rgb(255 255 255 / 0.18)' : i % 2 ? 'rgb(255 255 255 / 0.85)' : 'rgb(20 16 40 / 0.16)',
  }));

  return (
    <svg
      className={`topic-art ${className}`}
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.deep})` }}
    >
      {items.map((item, i) => <Shape key={i} {...item} />)}
    </svg>
  );
}

/** Round badge with the topic's initial, used where cover art is too big. */
export function TopicBadge({ topic, size = 44 }) {
  const theme = topicTheme(topic);
  const letter = (topic?.name || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <span
      className="topic-badge"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.46, background: `linear-gradient(135deg, ${theme.color}, ${theme.deep})` }}
    >
      {letter}
    </span>
  );
}
