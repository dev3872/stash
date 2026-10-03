import { Router } from 'express';
import fs from 'node:fs/promises';
import multer from 'multer';
import crypto from 'node:crypto';
import { Source } from '../models/index.js';
import { LIMITS, UPLOAD_DIR } from '../config.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireObjectId } from '../lib/validate.js';
import { createSourceWithPosts, serializeSourceStatus } from '../services/sources.js';
import { publicTopic } from '../services/topics.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.pdf`),
  }),
  limits: { fileSize: LIMITS.pdfBytes, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(badRequest('Only PDF files (application/pdf) can be uploaded.'));
    cb(null, true);
  },
});

export function sourceRoutes({ requireAuth, openai }) {
  const router = Router();

  // Multipart (topic + file) or JSON (topic + url).
  router.post('/sources', requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { source, topic, posts } = await createSourceWithPosts({
        user: req.user,
        topicName: req.body?.topic,
        rawUrl: req.body?.url,
        file: req.file,
        openai,
      });
      res.status(201).json({
        source: serializeSourceStatus(source, topic),
        topic: publicTopic(topic),
        firstPostId: String(posts[0]._id),
      });
    } catch (err) {
      // Validation failed before a source existed: don't keep the upload.
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      throw err;
    }
  });

  router.get('/sources/:id', requireAuth, async (req, res) => {
    const source = await Source.findById(requireObjectId(req.params.id, 'Source')).populate('topic', 'name slug');
    // Other people's sources are reported as missing rather than revealing they exist.
    if (!source || String(source.author) !== String(req.user._id)) throw notFound('Source not found.');
    res.json({ source: serializeSourceStatus(source, source.topic) });
  });

  return router;
}
