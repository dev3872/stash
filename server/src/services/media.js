/**
 * Pictures and short videos for lessons. Media come from Wikimedia Commons
 * (free licenses, stored with caption, author and license) and are matched to
 * bites by the words they share, so a bite only gets a picture that is about it.
 */
import { Post, Source } from '../models/index.js';
import { articleMedia, findArticle } from './wikipedia.js';

const STOP = new Set(`the a an and or of to in on for with by from as at is are was were be been being it its this that these those
which who whom what when where why how than then there their they them into onto over under about after before between during
also can could may might will would shall should not no yes but if so such very more most less least many much some any each
other another one two three first second new used using use uses like via per within without upon while because image photo
picture diagram file svg png jpg jpeg gif webm showing shows shown view close left right top bottom above below main small large`.split(/\s+/));

function stem(word) {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokens(text) {
  const out = new Set();
  for (const raw of String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

function score(post, mediaTokens, topicTokens) {
  const title = tokens(post.title);
  const body = tokens(`${post.body} ${post.example || ''}`);
  let total = 0;
  for (const word of mediaTokens) {
    const weight = topicTokens.has(word) ? 0.3 : 1;
    if (title.has(word)) total += 2 * weight;
    else if (body.has(word)) total += weight;
  }
  return total;
}

/**
 * Picks at most one media item per post. Returns an array aligned with `posts`
 * (null where nothing fits). Strong matches first; the opening bite falls back
 * to the article's lead image, which pictures the topic as a whole.
 */
export function matchMedia(posts, media, topicName) {
  const topicTokens = tokens(topicName);
  const mediaTokens = media.map((m) => tokens(`${m.caption} ${m.fileTitle}`));
  const pairs = [];
  posts.forEach((post, p) => {
    media.forEach((_, m) => {
      const s = score(post, mediaTokens[m], topicTokens);
      if (s > 0) pairs.push({ p, m, s });
    });
  });
  pairs.sort((a, b) => b.s - a.s || a.p - b.p || a.m - b.m);

  const result = posts.map(() => null);
  const used = new Set();
  for (const minScore of [2, 1]) {
    for (const { p, m, s } of pairs) {
      if (s < minScore || result[p] || used.has(m)) continue;
      result[p] = media[m];
      used.add(m);
    }
  }
  if (!result[0]) {
    const lead = media.findIndex((m, i) => m.lead && !used.has(i) && m.kind !== 'video');
    if (lead >= 0) result[0] = media[lead];
  }
  return result.map((m) => (m ? stripInternal(m) : null));
}

function stripInternal({ fileTitle, lead, ...media }) {
  return media;
}

/** Finds media for a lesson. Never throws: pictures are a bonus, not a requirement. */
export async function mediaForPosts(posts, { topicName, article = null }) {
  try {
    const found = article || (await findArticle(topicName));
    if (!found) return { media: posts.map(() => null), checked: true };
    const pool = await articleMedia(found);
    return { media: matchMedia(posts, pool, topicName), checked: true };
  } catch (err) {
    console.warn(`[media] ${err.message}`);
    return { media: posts.map(() => null), checked: !err.wikiUnavailable };
  }
}

// ---------- backfill for lessons made before media existed ----------

const inFlight = new Set();
const RETRY_MS = 10 * 60 * 1000;
const lastTry = new Map();

/** Looks for media for an older lesson in the background (first view triggers it). */
export function backfillLessonMedia(source, topicName) {
  const key = String(source._id);
  if (source.mediaCheckedAt || inFlight.has(key)) return;
  if (Date.now() - (lastTry.get(key) || 0) < RETRY_MS) return;
  inFlight.add(key);
  lastTry.set(key, Date.now());
  (async () => {
    const posts = await Post.find({ source: source._id }).sort({ order: 1 }).select('title body example media').lean();
    if (!posts.length || posts.some((p) => p.media?.url)) {
      await Source.updateOne({ _id: source._id }, { $set: { mediaCheckedAt: new Date() } });
      return;
    }
    const { media, checked } = await mediaForPosts(posts, { topicName });
    const writes = posts
      .map((post, i) => (media[i] ? { updateOne: { filter: { _id: post._id }, update: { $set: { media: media[i] } } } } : null))
      .filter(Boolean);
    if (writes.length) await Post.bulkWrite(writes);
    if (checked) await Source.updateOne({ _id: source._id }, { $set: { mediaCheckedAt: new Date() } });
  })()
    .catch((err) => console.warn(`[media] backfill failed: ${err.message}`))
    .finally(() => inFlight.delete(key));
}
