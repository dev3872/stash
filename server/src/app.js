import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { UPLOAD_DIR } from './config.js';
import { createAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { feedRoutes } from './routes/feed.js';
import { postRoutes } from './routes/posts.js';
import { topicRoutes } from './routes/topics.js';
import { sourceRoutes } from './routes/sources.js';
import { meRoutes } from './routes/me.js';
import { userRoutes } from './routes/users.js';
import { recommendationRoutes } from './routes/recommendations.js';
import { storyRoutes } from './routes/stories.js';
import { messageRoutes } from './routes/messages.js';

export function createApp(config) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.clientOrigins,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  const { requireAuth, optionalAuth } = createAuth(config.auth);
  const deps = { requireAuth, optionalAuth, openai: config.openai };

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({
      ok: true,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      converter: config.openai.apiKey ? 'openai' : 'local',
    });
  });
  api.use(feedRoutes(deps));
  api.use(postRoutes(deps));
  api.use(topicRoutes(deps));
  api.use(sourceRoutes(deps));
  api.use(meRoutes(deps));
  api.use(userRoutes(deps));
  api.use(recommendationRoutes(deps));
  api.use(storyRoutes(deps));
  api.use(messageRoutes(deps));

  app.use('/api', api);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
