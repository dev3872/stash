import { Router } from 'express';
import { Source } from '../models/index.js';
import { publicTopic } from '../services/topics.js';
import { profileFor, topicsForAuthor } from './users.js';

export function meRoutes({ requireAuth }) {
  const router = Router();

  router.get('/me', requireAuth, async (req, res) => {
    const [topics, sources] = await Promise.all([
      topicsForAuthor(req.user._id),
      Source.find({ author: req.user._id }).sort({ _id: -1 }).limit(20).populate('topic', 'name slug postCount').lean(),
    ]);
    res.json({
      user: { ...profileFor(req.user), email: req.user.email || null },
      topics,
      sources: sources.map((s) => ({
        id: String(s._id),
        status: s.status,
        error: s.error || null,
        kind: s.kind,
        title: s.title || s.originalName || s.url,
        postCount: s.postCount || 0,
        topic: publicTopic(s.topic),
        createdAt: s.createdAt,
      })),
    });
  });

  return router;
}
