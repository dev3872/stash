import { Router } from 'express';
import { Follow, Topic, User } from '../models/index.js';
import { badRequest, notFound, unauthorized } from '../lib/errors.js';
import { parseLimit, requireObjectId } from '../lib/validate.js';
import { publicTopic } from '../services/topics.js';
import { publicUser } from '../services/users.js';
import {
  forYouLessons,
  learnerStats,
  loadLesson,
  queryLessons,
  recordProgress,
  resolveTimeZone,
} from '../services/lessons.js';

export function lessonRoutes({ requireAuth, optionalAuth }) {
  const router = Router();

  // GET /api/lessons?topic=&author=&tab=latest|following&cursor=&limit=
  router.get('/lessons', optionalAuth, async (req, res) => {
    const { topic: topicSlug, author, tab = 'latest', cursor } = req.query;
    if (tab !== 'latest' && tab !== 'following') throw badRequest('tab must be "latest" or "following".');
    const limit = parseLimit(req.query.limit, { fallback: 8, max: 30 });
    const filter = {};
    const meta = {};

    if (topicSlug) {
      const topic = await Topic.findOne({ slug: String(topicSlug).toLowerCase() });
      if (!topic) throw notFound('Topic not found.');
      filter.topic = topic._id;
      meta.topic = publicTopic(topic);
    }

    if (author) {
      const user = await User.findById(requireObjectId(String(author), 'User'));
      if (!user) throw notFound('User not found.');
      filter.author = user._id;
      meta.author = publicUser(user);
    }

    if (tab === 'following') {
      if (!req.user) throw unauthorized('Sign in to see lessons from people you follow.');
      const follows = await Follow.find({ follower: req.user._id }).select('following').lean();
      const ids = follows.map((f) => String(f.following));
      if (filter.author && !ids.includes(String(filter.author))) return res.json({ lessons: [], nextCursor: null, ...meta });
      if (!ids.length) return res.json({ lessons: [], nextCursor: null, ...meta });
      if (!filter.author) filter.author = { $in: ids };
    }

    const page = await queryLessons(filter, { cursor: cursor || null, limit, viewer: req.user });
    res.json({ ...page, ...meta });
  });

  // GET /api/lessons/for-you?page=&limit=
  router.get('/lessons/for-you', optionalAuth, async (req, res) => {
    const page = req.query.page === undefined || req.query.page === '' ? 0 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 0 || page > 100) throw badRequest('page must be a whole number from 0 to 100.');
    const pageSize = parseLimit(req.query.limit, { fallback: 6, max: 12 });
    res.json(await forYouLessons(req.user, { page, pageSize }));
  });

  // GET /api/lessons/:id — the lesson, its bites in order, the viewer's progress and a next pick.
  router.get('/lessons/:id', optionalAuth, async (req, res) => {
    res.json(await loadLesson(req.params.id, req.user));
  });

  // POST /api/lessons/:id/progress { index, tz }
  router.post('/lessons/:id/progress', requireAuth, async (req, res) => {
    const timeZone = resolveTimeZone(req.body?.tz);
    res.json(await recordProgress(req.user, req.params.id, req.body?.index, timeZone));
  });

  // GET /api/me/stats?tz= — streak, daily goal, this week, lessons in progress.
  router.get('/me/stats', requireAuth, async (req, res) => {
    res.json({ stats: await learnerStats(req.user, resolveTimeZone(req.query.tz)) });
  });

  return router;
}
