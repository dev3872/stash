import { Router } from 'express';
import { suggestTopics, suggestUsers } from '../services/recommend.js';

export function recommendationRoutes({ optionalAuth }) {
  const router = Router();

  router.get('/recommendations', optionalAuth, async (req, res) => {
    const [users, topics] = await Promise.all([suggestUsers(req.user, 5), suggestTopics(req.user, 6)]);
    res.json({ users, topics });
  });

  return router;
}
