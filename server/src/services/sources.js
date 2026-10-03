import fs from 'node:fs/promises';
import path from 'node:path';
import { Post, Source, Topic } from '../models/index.js';
import { LIMITS, UPLOAD_DIR } from '../config.js';
import { badRequest } from '../lib/errors.js';
import { findOrCreateTopic, normalizeTopicName } from './topics.js';
import { extractFromPdf } from './extract-pdf.js';
import { extractFromUrl } from './extract-url.js';
import { convertToPosts } from './convert.js';
import { truncate } from './text.js';

export function parseSourceUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  if (value.length > 2048) throw badRequest('That link is too long.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw badRequest('Enter a full link that starts with http:// or https://.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('Only http:// and https:// links are supported.');
  }
  if (url.username || url.password) throw badRequest('Links with a username or password aren’t supported.');
  return url.href;
}

/**
 * Runs the whole create flow inside the request: validate, upsert the topic,
 * extract text, convert to posts, save. Marks the source failed on any error.
 */
export async function createSourceWithPosts({ user, topicName, rawUrl, file, openai }) {
  const url = parseSourceUrl(rawUrl);
  if (file && url) throw badRequest('Choose either a PDF or a link, not both.');
  if (!file && !url) throw badRequest('Add a PDF or paste a link to learn from.');
  normalizeTopicName(topicName); // validate before creating anything

  const topic = await findOrCreateTopic(topicName);
  const source = await Source.create({
    topic: topic._id,
    author: user._id,
    kind: file ? 'pdf' : 'url',
    url: url || undefined,
    filePath: file ? path.relative(path.resolve(UPLOAD_DIR, '..'), file.path) : undefined,
    originalName: file ? file.originalname.slice(0, 200) : undefined,
    status: 'pending',
  });

  try {
    const extracted = file
      ? await extractFromPdf(await fs.readFile(file.path), LIMITS)
      : await extractFromUrl(url, LIMITS);

    source.extractedText = truncate(extracted.text, LIMITS.storedTextChars);
    source.title = extracted.title || (file ? file.originalname.replace(/\.pdf$/i, '') : new URL(url).hostname);
    await source.save();

    const { posts, converter } = await convertToPosts({ text: extracted.text, topicName: topic.name, openai, limits: LIMITS });

    const docs = await Post.insertMany(
      posts.map((post, order) => ({
        topic: topic._id,
        source: source._id,
        author: user._id,
        title: post.title,
        body: post.body,
        example: post.example || undefined,
        order,
      }))
    );

    source.status = 'ready';
    source.converter = converter;
    source.postCount = docs.length;
    source.error = undefined;
    await source.save();
    await Topic.updateOne({ _id: topic._id }, { $inc: { postCount: docs.length }, $set: { lastPostedAt: new Date() } });

    return { source, topic, posts: docs };
  } catch (err) {
    source.status = 'failed';
    source.error = err?.expose ? err.message : 'Something went wrong while turning this source into posts.';
    if (file) {
      await fs.unlink(file.path).catch(() => {});
      source.filePath = undefined;
    }
    await Post.deleteMany({ source: source._id }).catch(() => {});
    await source.save().catch(() => {});
    throw err;
  }
}

export function serializeSourceStatus(source, topic) {
  return {
    id: String(source._id),
    status: source.status,
    error: source.error || null,
    kind: source.kind,
    url: source.url || null,
    originalName: source.originalName || null,
    title: source.title || null,
    postCount: source.postCount ?? 0,
    converter: source.converter || null,
    topic: topic ? { id: String(topic._id), name: topic.name, slug: topic.slug } : undefined,
    createdAt: source.createdAt,
  };
}
