import { Router } from 'express';
import { Follow, Post, Story, StoryView, STORY_THEMES, STORY_TTL_MS } from '../models/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireObjectId, requireText } from '../lib/validate.js';
import { publicUser } from '../services/users.js';

const MAX_ACTIVE_STORIES = 20;
const TRAY_AUTHORS = 20;

function serializeStory(story, { viewer, seen }) {
  const mine = viewer && String(story.author?._id ?? story.author) === String(viewer._id);
  return {
    id: String(story._id),
    text: story.text,
    theme: story.theme,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    post: story.post?._id ? { id: String(story.post._id), title: story.post.title } : null,
    topic: story.topic?._id ? { id: String(story.topic._id), name: story.topic.name, slug: story.topic.slug } : null,
    seen: mine || seen.has(String(story._id)),
    ...(mine ? { viewCount: story.viewCount || 0 } : {}),
  };
}

export function storyRoutes({ requireAuth, optionalAuth }) {
  const router = Router();

  // Story tray: you first, then people you follow; others fill in so the tray is never empty.
  router.get('/stories', optionalAuth, async (req, res) => {
    const now = new Date();
    const viewer = req.user;
    let priority = [];
    if (viewer) {
      const follows = await Follow.find({ follower: viewer._id }).select('following').lean();
      priority = [String(viewer._id), ...follows.map((f) => String(f.following))];
    }

    const stories = await Story.find({ expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('author', 'name picture')
      .populate('post', 'title')
      .populate('topic', 'name slug')
      .lean();

    const seen = viewer
      ? new Set((await StoryView.find({ user: viewer._id, story: { $in: stories.map((s) => s._id) } }).select('story').lean())
        .map((v) => String(v.story)))
      : new Set();

    const groups = new Map();
    for (const story of stories) {
      if (!story.author) continue;
      const authorId = String(story.author._id);
      if (!groups.has(authorId)) groups.set(authorId, { author: publicUser(story.author), stories: [], latestAt: story.createdAt });
      groups.get(authorId).stories.push(story);
    }

    const rank = (authorId) => {
      const index = priority.indexOf(authorId);
      return index === 0 ? 0 : index > 0 ? 1 : 2; // me, following, everyone else
    };

    const tray = [...groups.entries()]
      .map(([authorId, group]) => {
        const items = group.stories.reverse().map((s) => serializeStory(s, { viewer, seen })); // oldest first
        return {
          author: group.author,
          isMe: Boolean(viewer && authorId === String(viewer._id)),
          isFollowing: rank(authorId) === 1,
          hasUnseen: items.some((s) => !s.seen),
          latestAt: group.latestAt,
          stories: items,
          _rank: rank(authorId),
        };
      })
      .sort((a, b) => a._rank - b._rank || Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.latestAt) - new Date(a.latestAt))
      .slice(0, TRAY_AUTHORS)
      .map(({ _rank, ...group }) => group);

    res.json({ tray });
  });

  router.post('/stories', requireAuth, async (req, res) => {
    const text = requireText(req.body?.text, { field: 'Story text', min: 1, max: 220 });
    const theme = req.body?.theme ?? 'sunrise';
    if (!STORY_THEMES.includes(theme)) throw badRequest(`Theme must be one of: ${STORY_THEMES.join(', ')}.`);

    let post = null;
    if (req.body?.postId) {
      post = await Post.findById(requireObjectId(String(req.body.postId), 'Post')).select('title topic').lean();
      if (!post) throw notFound('Post not found.');
    }

    const active = await Story.countDocuments({ author: req.user._id, expiresAt: { $gt: new Date() } });
    if (active >= MAX_ACTIVE_STORIES) throw badRequest(`You can have up to ${MAX_ACTIVE_STORIES} active stories. Delete one or wait for one to expire.`);

    const story = await Story.create({
      author: req.user._id,
      text,
      theme,
      post: post?._id,
      topic: post?.topic,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
    });
    await story.populate([{ path: 'post', select: 'title' }, { path: 'topic', select: 'name slug' }]);
    res.status(201).json({ story: serializeStory(story.toObject(), { viewer: req.user, seen: new Set() }) });
  });

  router.delete('/stories/:id', requireAuth, async (req, res) => {
    const story = await Story.findOne({ _id: requireObjectId(req.params.id, 'Story'), author: req.user._id });
    if (!story) throw notFound('Story not found.');
    await Promise.all([story.deleteOne(), StoryView.deleteMany({ story: story._id })]);
    res.json({ deleted: true });
  });

  router.post('/stories/:id/view', requireAuth, async (req, res) => {
    const story = await Story.findOne({ _id: requireObjectId(req.params.id, 'Story'), expiresAt: { $gt: new Date() } }).select('author expiresAt');
    if (!story) throw notFound('Story not found or expired.');
    if (String(story.author) !== String(req.user._id)) {
      try {
        const result = await StoryView.updateOne(
          { story: story._id, user: req.user._id },
          { $setOnInsert: { expiresAt: story.expiresAt } },
          { upsert: true }
        );
        if (result.upsertedCount === 1) await Story.updateOne({ _id: story._id }, { $inc: { viewCount: 1 } });
      } catch (err) {
        if (err?.code !== 11000) throw err; // a concurrent request recorded the view
      }
    }
    res.json({ seen: true });
  });

  return router;
}
