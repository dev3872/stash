import { Router } from 'express';
import { Source, Topic } from '../models/index.js';
import { notFound } from '../lib/errors.js';
import { publicTopic } from '../services/topics.js';

export function topicRoutes() {
  const router = Router();

  router.get('/topics', async (_req, res) => {
    const topics = await Topic.find({ postCount: { $gt: 0 } }).sort({ lastPostedAt: -1 }).limit(100).lean();
    const counts = await Source.aggregate([
      { $match: { status: 'ready', topic: { $in: topics.map((t) => t._id) } } },
      { $group: { _id: '$topic', lessons: { $sum: 1 } } },
    ]);
    const lessonsByTopic = new Map(counts.map((c) => [String(c._id), c.lessons]));
    res.json({ topics: topics.map((t) => ({ ...publicTopic(t), lessonCount: lessonsByTopic.get(String(t._id)) || 0 })) });
  });

  router.get('/topics/:slug', async (req, res) => {
    const topic = await Topic.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
    if (!topic) throw notFound('Topic not found.');
    const lessonCount = await Source.countDocuments({ topic: topic._id, status: 'ready' });
    res.json({ topic: { ...publicTopic(topic), lessonCount } });
  });

  return router;
}
