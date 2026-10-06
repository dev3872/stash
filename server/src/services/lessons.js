/**
 * Lessons are the learner-facing name for a ready source and its ordered posts
 * ("bites"). This module lists them, tracks how far each user has read, and
 * derives streaks and the daily goal from per-day activity rows.
 */
import mongoose from 'mongoose';
import { ActivityDay, LessonProgress, Post, Source } from '../models/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireObjectId } from '../lib/validate.js';
import { publicTopic } from './topics.js';
import { publicUser } from './users.js';
import { publicMedia, publicSource } from './serialize.js';
import { backfillLessonMedia } from './media.js';
import { POST_POPULATE, serializePosts } from './posts.js';
import { rankForYou } from './recommend.js';

export const DAILY_GOAL = 5; // bites per day
const SECONDS_PER_BITE = 40; // reading-time estimate shown on lesson cards

const id = (value) => String(value?._id ?? value);

// ---------- time zones and calendar days ----------

export function resolveTimeZone(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 64) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
    return raw;
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for `date` in `timeZone`. */
export function localDay(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function shiftDay(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
}

// ---------- serialization ----------

const JUNK_TITLE = /^(untitled|microsoft (word|powerpoint)|document\d*|new document|slide\s*\d*|title|pdf|untitled document)\b/i;

function cleanTitle(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\.(pdf|docx?|pptx?|tex|html?)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 3 || JUNK_TITLE.test(text)) return null;
  if ((text.match(/[\p{L}]/gu) || []).length < text.length * 0.5) return null; // mostly digits/symbols
  return text[0].toLocaleUpperCase() + text.slice(1);
}

/** A readable lesson name: the page/PDF title when it is meaningful, else the topic. */
export function lessonTitle(source) {
  return (
    cleanTitle(source.title) ||
    (source.kind === 'pdf' ? cleanTitle(source.originalName) : null) ||
    source.topic?.name ||
    'Untitled lesson'
  );
}

export function serializeLesson(source, { preview, progress, cover } = {}) {
  const postCount = source.postCount || 0;
  return {
    id: id(source),
    title: lessonTitle(source),
    kind: source.kind,
    source: publicSource(source),
    topic: publicTopic(source.topic),
    author: publicUser(source.author),
    postCount,
    minutes: Math.max(1, Math.round((postCount * SECONDS_PER_BITE) / 60)),
    likeCount: source.likeCount || 0,
    commentCount: source.commentCount || 0,
    shareCount: source.shareCount || 0,
    createdAt: source.createdAt,
    preview: preview ? { title: preview.title, body: preview.body } : null,
    cover: cover ? coverFrom(cover) : null,
    progress: progress
      ? {
          current: Math.min(progress.current ?? 0, Math.max(0, postCount - 1)),
          furthest: Math.min(progress.furthest ?? 0, Math.max(0, postCount - 1)),
          completed: Boolean(progress.completedAt),
        }
      : null,
  };
}

/** The picture that represents a lesson on cards: the first bite's image, or a video's poster. */
function coverFrom(media) {
  const m = publicMedia(media);
  if (!m) return null;
  const url = m.kind === 'video' ? m.poster : m.url;
  return url ? { url, caption: m.caption, credit: m.credit, license: m.license } : null;
}

async function coverMap(sourceIds) {
  if (!sourceIds.length) return new Map();
  const posts = await Post.find({ source: { $in: sourceIds }, 'media.url': { $exists: true } })
    .sort({ order: 1 })
    .select('source media order')
    .lean();
  const map = new Map();
  for (const post of posts) {
    const key = id(post.source);
    if (map.has(key)) continue;
    if (post.media.kind === 'video' && !post.media.poster) continue;
    map.set(key, post.media);
  }
  return map;
}

async function progressMap(viewer, sourceIds) {
  if (!viewer || !sourceIds.length) return new Map();
  const rows = await LessonProgress.find({ user: viewer._id, source: { $in: sourceIds } }).lean();
  return new Map(rows.map((row) => [id(row.source), row]));
}

async function previewMap(sourceIds) {
  if (!sourceIds.length) return new Map();
  const posts = await Post.find({ source: { $in: sourceIds }, order: 0 }).select('source title body').lean();
  return new Map(posts.map((post) => [id(post.source), post]));
}

/** Serializes ready sources (topic + author populated) with preview and the viewer's progress. */
export async function serializeLessons(sources, viewer) {
  const ids = sources.map((s) => s._id);
  const [previews, progress, covers] = await Promise.all([previewMap(ids), progressMap(viewer, ids), coverMap(ids)]);
  for (const source of sources) backfillLessonMedia(source, source.topic?.name || '');
  return sources.map((s) =>
    serializeLesson(s, { preview: previews.get(id(s)), progress: progress.get(id(s)), cover: covers.get(id(s)) })
  );
}

// Never ship the extracted source text or the upload path with a lesson.
const LESSON_FIELDS = '-extractedText -filePath';

const LESSON_POPULATE = [
  { path: 'topic', select: 'name slug postCount' },
  { path: 'author', select: 'name picture' },
];

// ---------- listing ----------

/** Newest lessons first. The cursor is the last source id on the page. */
export async function queryLessons(filter, { cursor, limit, viewer }) {
  const query = { status: 'ready', postCount: { $gt: 0 }, ...filter };
  if (cursor) {
    if (typeof cursor !== 'string' || !mongoose.isValidObjectId(cursor) || !/^[a-f0-9]{24}$/i.test(cursor)) {
      throw badRequest('The lessons cursor is invalid. Reload the page.');
    }
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const docs = await Source.find(query).sort({ _id: -1 }).limit(limit + 1).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean();
  const page = docs.slice(0, limit);
  return {
    lessons: await serializeLessons(page, viewer),
    nextCursor: docs.length > limit && page.length ? id(page[page.length - 1]) : null,
  };
}

export async function forYouLessons(viewer, { page, pageSize }) {
  const ranked = await rankForYou(viewer);
  const slice = ranked.slice(page * pageSize, (page + 1) * pageSize);
  const ids = slice.map((item) => item.source._id);
  const sources = ids.length ? await Source.find({ _id: { $in: ids } }).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean() : [];
  const byId = new Map(sources.map((s) => [id(s), s]));
  const ordered = slice.map((item) => byId.get(id(item.source))).filter(Boolean);
  const lessons = await serializeLessons(ordered, viewer);
  const reasons = new Map(slice.map((item) => [id(item.source), item.reason]));
  for (const lesson of lessons) lesson.recommendation = reasons.get(lesson.id) || null;
  return { lessons, nextPage: ranked.length > (page + 1) * pageSize ? page + 1 : null };
}

// ---------- one lesson ----------

export async function loadLesson(sourceId, viewer) {
  const source = await Source.findById(requireObjectId(sourceId, 'Lesson')).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean();
  if (!source || source.status !== 'ready') throw notFound('Lesson not found.');

  const [posts, progress] = await Promise.all([
    Post.find({ source: source._id }).sort({ order: 1 }).populate(POST_POPULATE).lean(),
    viewer ? LessonProgress.findOne({ user: viewer._id, source: source._id }).lean() : null,
  ]);
  const [preview] = posts;
  backfillLessonMedia(source, source.topic?.name || '');
  const cover = posts.find((p) => p.media?.url && (p.media.kind !== 'video' || p.media.poster))?.media;

  return {
    lesson: serializeLesson(source, { preview, progress, cover }),
    posts: await serializePosts(posts, viewer),
    next: await nextLessonFor(source, viewer),
  };
}

/** Another lesson to read after this one: same topic first, skipping ones the viewer finished. */
async function nextLessonFor(source, viewer) {
  let done = [];
  if (viewer) {
    done = await LessonProgress.find({ user: viewer._id, completedAt: { $ne: null } }).select('source').lean();
  }
  const exclude = [source._id, ...done.map((row) => row.source)];
  const base = { status: 'ready', postCount: { $gt: 0 }, _id: { $nin: exclude } };
  const candidate =
    (await Source.findOne({ ...base, topic: id(source.topic) }).sort({ _id: -1 }).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean()) ||
    (await Source.findOne(base).sort({ _id: -1 }).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean());
  if (!candidate) return null;
  const [lesson] = await serializeLessons([candidate], viewer);
  return lesson;
}

// ---------- progress, streaks and goals ----------

/**
 * Records that `user` reached bite `index` of a lesson. New bites (past the
 * previous furthest point) count toward today's goal; reaching the last bite
 * completes the lesson once.
 */
export async function recordProgress(user, sourceId, rawIndex, timeZone) {
  const source = await Source.findById(requireObjectId(sourceId, 'Lesson')).select('status postCount topic').lean();
  if (!source || source.status !== 'ready') throw notFound('Lesson not found.');
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index >= source.postCount) {
    throw badRequest(`index must be a whole number from 0 to ${Math.max(0, source.postCount - 1)}.`);
  }

  const before = await LessonProgress.findOneAndUpdate(
    { user: user._id, source: source._id },
    { $max: { furthest: index }, $set: { current: index }, $setOnInsert: { topic: source.topic } },
    { upsert: true, returnDocument: 'before' }
  ).lean();
  const newBites = Math.max(0, index - (before ? before.furthest : -1));

  let completedNow = false;
  if (index === source.postCount - 1) {
    const result = await LessonProgress.updateOne(
      { user: user._id, source: source._id, completedAt: null },
      { $set: { completedAt: new Date() } }
    );
    completedNow = result.modifiedCount === 1;
  }

  if (newBites || completedNow) {
    await ActivityDay.updateOne(
      { user: user._id, day: localDay(new Date(), timeZone) },
      { $inc: { bites: newBites, lessonsCompleted: completedNow ? 1 : 0 } },
      { upsert: true }
    );
  }

  const progress = await LessonProgress.findOne({ user: user._id, source: source._id }).lean();
  return {
    progress: {
      current: progress.current,
      furthest: progress.furthest,
      completed: Boolean(progress.completedAt),
    },
    newBites,
    completedNow,
    stats: await learnerStats(user, timeZone, { includeLessons: false }),
  };
}

export async function learnerStats(user, timeZone, { includeLessons = true } = {}) {
  const today = localDay(new Date(), timeZone);
  const since = shiftDay(today, -400);

  const [days, totals, completedLessons, inProgress] = await Promise.all([
    ActivityDay.find({ user: user._id, day: { $gte: since }, bites: { $gt: 0 } }).select('day bites').sort({ day: -1 }).lean(),
    ActivityDay.aggregate([{ $match: { user: user._id } }, { $group: { _id: null, bites: { $sum: '$bites' } } }]),
    LessonProgress.countDocuments({ user: user._id, completedAt: { $ne: null } }),
    includeLessons
      ? LessonProgress.find({ user: user._id, completedAt: null }).sort({ updatedAt: -1 }).limit(8).select('source').lean()
      : [],
  ]);

  const byDay = new Map(days.map((d) => [d.day, d.bites]));
  const todayBites = byDay.get(today) || 0;

  // A streak survives until the end of today: if today has no bites yet, count from yesterday.
  let streak = 0;
  let cursor = todayBites > 0 ? today : shiftDay(today, -1);
  while (byDay.get(cursor) > 0) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    week.push({ day, bites: byDay.get(day) || 0, isToday: i === 0 });
  }

  const stats = {
    today,
    timeZone,
    dailyGoal: DAILY_GOAL,
    todayBites,
    goalMet: todayBites >= DAILY_GOAL,
    streak,
    activeToday: todayBites > 0,
    totalBites: totals[0]?.bites || 0,
    completedLessons,
    week,
  };

  if (includeLessons) {
    const ids = inProgress.map((row) => row.source);
    const sources = ids.length
      ? await Source.find({ _id: { $in: ids }, status: 'ready' }).select(LESSON_FIELDS).populate(LESSON_POPULATE).lean()
      : [];
    const byId = new Map(sources.map((s) => [id(s), s]));
    const ordered = ids.map((sid) => byId.get(id(sid))).filter(Boolean);
    stats.inProgress = await serializeLessons(ordered, user);
  }
  return stats;
}
