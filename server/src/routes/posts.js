import { Router } from 'express';
import { Comment, Like, Post, Share } from '../models/index.js';
import { notFound } from '../lib/errors.js';
import { requireObjectId, requireText } from '../lib/validate.js';
import { POST_POPULATE, bumpCounter, likedPostIds } from '../services/posts.js';
import { serializeComment, serializePost } from '../services/serialize.js';

async function findPost(id) {
  const post = await Post.findById(requireObjectId(id, 'Post')).select('_id source topic author');
  if (!post) throw notFound('Post not found.');
  return post;
}

export function postRoutes({ requireAuth, optionalAuth }) {
  const router = Router();

  router.get('/posts/:id', optionalAuth, async (req, res) => {
    const post = await Post.findById(requireObjectId(req.params.id, 'Post')).populate(POST_POPULATE).lean();
    if (!post) throw notFound('Post not found.');
    const [liked, sequence] = await Promise.all([
      likedPostIds(req.user, [post._id]),
      Post.find({ source: post.source._id }).sort({ order: 1 }).select('title order').lean(),
    ]);
    res.json({
      post: serializePost(post, liked),
      sequence: sequence.map((p) => ({ id: String(p._id), title: p.title, order: p.order })),
    });
  });

  router.post('/posts/:id/like', requireAuth, async (req, res) => {
    const post = await findPost(req.params.id);
    try {
      await Like.create({ post: post._id, user: req.user._id, topic: post.topic });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Already liked: idempotent, no double count.
      const current = await Post.findById(post._id).select('likeCount').lean();
      return res.json({ liked: true, likeCount: current.likeCount });
    }
    const likeCount = await bumpCounter(post, 'likeCount', 1);
    res.json({ liked: true, likeCount });
  });

  router.delete('/posts/:id/like', requireAuth, async (req, res) => {
    const post = await findPost(req.params.id);
    const removed = await Like.findOneAndDelete({ post: post._id, user: req.user._id });
    const likeCount = removed
      ? await bumpCounter(post, 'likeCount', -1)
      : (await Post.findById(post._id).select('likeCount').lean()).likeCount;
    res.json({ liked: false, likeCount });
  });

  router.get('/posts/:id/comments', async (req, res) => {
    const post = await findPost(req.params.id);
    // Newest 200, returned oldest-first so the newest sits at the bottom.
    const comments = await Comment.find({ post: post._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .populate('user', 'name picture')
      .lean();
    res.json({ comments: comments.reverse().map(serializeComment) });
  });

  router.post('/posts/:id/comments', requireAuth, async (req, res) => {
    const text = requireText(req.body?.text, { field: 'Comment', min: 1, max: 500 });
    const post = await findPost(req.params.id);
    const comment = await Comment.create({ post: post._id, user: req.user._id, text, topic: post.topic });
    const commentCount = await bumpCounter(post, 'commentCount', 1);
    comment.user = req.user;
    res.status(201).json({ comment: serializeComment(comment), commentCount });
  });

  router.post('/posts/:id/share', requireAuth, async (req, res) => {
    const post = await findPost(req.params.id);
    const share = await Share.create({ post: post._id, user: req.user._id, topic: post.topic });
    const shareCount = await bumpCounter(post, 'shareCount', 1);
    res.status(201).json({ share: { id: String(share._id), createdAt: share.createdAt }, shareCount });
  });

  return router;
}
