import { Router } from 'express';
import { Follow, Source, Topic, User } from '../models/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireObjectId } from '../lib/validate.js';
import { publicUser } from '../services/users.js';
import { publicTopic } from '../services/topics.js';

export async function topicsForAuthor(userId) {
  const topicIds = await Source.distinct('topic', { author: userId, status: 'ready' });
  const topics = await Topic.find({ _id: { $in: topicIds } }).sort({ name: 1 }).lean();
  return topics.map(publicTopic);
}

export function profileFor(user) {
  return {
    ...publicUser(user),
    followerCount: user.followerCount || 0,
    followingCount: user.followingCount || 0,
    joinedAt: user.createdAt,
  };
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function userRoutes({ requireAuth, optionalAuth }) {
  const router = Router();

  // Search people by name (used to start a conversation).
  router.get('/users', requireAuth, async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) throw badRequest('Type at least 2 characters to search.');
    const users = await User.find({ name: { $regex: escapeRegex(q.slice(0, 60)), $options: 'i' }, _id: { $ne: req.user._id } })
      .sort({ followerCount: -1 })
      .limit(10)
      .lean();
    res.json({ users: users.map(publicUser) });
  });

  router.get('/users/:id', optionalAuth, async (req, res) => {
    const user = await User.findById(requireObjectId(req.params.id, 'User')).lean();
    if (!user) throw notFound('User not found.');
    const isMe = Boolean(req.user && String(req.user._id) === String(user._id));
    const [topics, follow, postCount] = await Promise.all([
      topicsForAuthor(user._id),
      req.user && !isMe ? Follow.exists({ follower: req.user._id, following: user._id }) : null,
      Source.countDocuments({ author: user._id, status: 'ready' }),
    ]);
    res.json({ user: { ...profileFor(user), sequenceCount: postCount }, topics, isMe, isFollowing: Boolean(follow) });
  });

  router.post('/users/:id/follow', requireAuth, async (req, res) => {
    const targetId = requireObjectId(req.params.id, 'User');
    if (targetId === String(req.user._id)) throw badRequest("You can't follow yourself.");
    const target = await User.findById(targetId).select('_id');
    if (!target) throw notFound('User not found.');
    try {
      await Follow.create({ follower: req.user._id, following: target._id });
      await Promise.all([
        User.updateOne({ _id: target._id }, { $inc: { followerCount: 1 } }),
        User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } }),
      ]);
    } catch (err) {
      if (err?.code !== 11000) throw err; // already following
    }
    const fresh = await User.findById(target._id).select('followerCount').lean();
    res.json({ following: true, followerCount: fresh.followerCount });
  });

  router.delete('/users/:id/follow', requireAuth, async (req, res) => {
    const targetId = requireObjectId(req.params.id, 'User');
    const target = await User.findById(targetId).select('_id');
    if (!target) throw notFound('User not found.');
    const removed = await Follow.findOneAndDelete({ follower: req.user._id, following: target._id });
    if (removed) {
      await Promise.all([
        User.updateOne({ _id: target._id, followerCount: { $gt: 0 } }, { $inc: { followerCount: -1 } }),
        User.updateOne({ _id: req.user._id, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
      ]);
    }
    const fresh = await User.findById(target._id).select('followerCount').lean();
    res.json({ following: false, followerCount: fresh.followerCount });
  });

  async function listFollows(req, res, direction) {
    const user = await User.findById(requireObjectId(req.params.id, 'User')).select('_id').lean();
    if (!user) throw notFound('User not found.');
    const query = direction === 'followers' ? { following: user._id } : { follower: user._id };
    const field = direction === 'followers' ? 'follower' : 'following';
    const follows = await Follow.find(query).sort({ createdAt: -1 }).limit(100).populate(field, 'name picture').lean();
    let mine = new Set();
    if (req.user) {
      const ids = follows.map((f) => f[field]?._id).filter(Boolean);
      const myFollows = await Follow.find({ follower: req.user._id, following: { $in: ids } }).select('following').lean();
      mine = new Set(myFollows.map((f) => String(f.following)));
    }
    res.json({
      users: follows
        .filter((f) => f[field])
        .map((f) => ({ ...publicUser(f[field]), isFollowing: mine.has(String(f[field]._id)) })),
    });
  }

  router.get('/users/:id/followers', optionalAuth, (req, res) => listFollows(req, res, 'followers'));
  router.get('/users/:id/following', optionalAuth, (req, res) => listFollows(req, res, 'following'));

  return router;
}
