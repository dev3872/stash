import { Router } from 'express';
import { Topic } from '../models/index.js';
import { notFound } from '../lib/errors.js';
import { publicTopic } from '../services/topics.js';

export function topicRoutes() {
  const router = Router();

  router.get('/topics', async (_req, res) => {
    const topics = await Topic.find({ postCount: { $gt: 0 } }).sort({ lastPostedAt: -1 }).limit(100).lean();
    res.json({ topics: topics.map(publicTopic) });
  });

  router.get('/topics/:slug', async (req, res) => {
    const topic = await Topic.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
    if (!topic) throw notFound('Topic not found.');
    res.json({ topic: publicTopic(topic) });
  });

  return router;
}
