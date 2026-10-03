import { Router } from 'express';
import { Follow, Source, Topic, User } from '../models/index.js';
import { badRequest, notFound, unauthorized } from '../lib/errors.js';
import { parseLimit, requireObjectId } from '../lib/validate.js';
import { queryFeed } from '../services/posts.js';
import { forYouPage } from '../services/recommend.js';
import { publicTopic } from '../services/topics.js';
import { publicUser } from '../services/users.js';
import { publicSource } from '../services/serialize.js';

export function feedRoutes({ optionalAuth }) {
  const router = Router();

  // GET /api/feed?topic=&author=&source=&tab=latest|following&cursor=&limit=
  router.get('/feed', optionalAuth, async (req, res) => {
    const { topic: topicSlug, author, source: sourceId, tab = 'latest', cursor } = req.query;
    const limit = parseLimit(req.query.limit, { fallback: 10, max: 30 });
    const filter = {};
    const meta = {};

    if (tab !== 'latest' && tab !== 'following') throw badRequest('tab must be "latest" or "following".');

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

    if (sourceId) {
      const source = await Source.findById(requireObjectId(String(sourceId), 'Sequence'))
        .populate('topic', 'name slug postCount')
        .populate('author', 'name picture');
      if (!source || source.status !== 'ready') throw notFound('Sequence not found.');
      filter.source = source._id;
      meta.source = { ...publicSource(source), topic: publicTopic(source.topic), author: publicUser(source.author) };
    }

    if (tab === 'following') {
      if (!req.user) throw unauthorized('Sign in to see posts from people you follow.');
      const follows = await Follow.find({ follower: req.user._id }).select('following').lean();
      meta.followingCount = follows.length;
      if (!follows.length) return res.json({ posts: [], nextCursor: null, ...meta });
      filter.author = filter.author
        ? follows.some((f) => String(f.following) === String(filter.author)) ? filter.author : null
        : { $in: follows.map((f) => f.following) };
      if (filter.author === null) return res.json({ posts: [], nextCursor: null, ...meta });
    }

    const page = await queryFeed(filter, { cursor, limit, viewer: req.user });
    res.json({ ...page, ...meta });
  });

  // GET /api/feed/for-you?page=&limit=  (limit = sequences per page)
  router.get('/feed/for-you', optionalAuth, async (req, res) => {
    const page = req.query.page === undefined || req.query.page === '' ? 0 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 0 || page > 100) throw badRequest('page must be a whole number from 0 to 100.');
    const pageSize = parseLimit(req.query.limit, { fallback: 3, max: 10 });
    res.json(await forYouPage(req.user, { page, pageSize }));
  });

  return router;
}
