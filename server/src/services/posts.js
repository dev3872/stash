import { Like, Post, Source } from '../models/index.js';
import { badRequest } from '../lib/errors.js';
import { serializePost } from './serialize.js';

export const POST_POPULATE = [
  { path: 'author', select: 'name picture' },
  { path: 'topic', select: 'name slug postCount' },
  { path: 'source', select: 'kind url originalName title origin postCount createdAt' },
];

export async function likedPostIds(user, postIds) {
  if (!user || !postIds.length) return new Set();
  const likes = await Like.find({ user: user._id, post: { $in: postIds } }).select('post').lean();
  return new Set(likes.map((like) => String(like.post)));
}

export async function serializePosts(posts, viewer) {
  const liked = await likedPostIds(viewer, posts.map((p) => p._id));
  return posts.map((post) => serializePost(post, liked));
}

/**
 * Adjusts a counter on a post and on its source (sequence totals for the
 * recommender). Decrements never go below zero. Returns the post's new value.
 */
export async function bumpCounter(post, field, delta) {
  const guard = delta < 0 ? { [field]: { $gt: 0 } } : {};
  const [updated] = await Promise.all([
    Post.findOneAndUpdate({ _id: post._id, ...guard }, { $inc: { [field]: delta } }, { new: true }).lean(),
    Source.updateOne({ _id: post.source, ...guard }, { $inc: { [field]: delta } }),
  ]);
  if (updated) return updated[field];
  const current = await Post.findById(post._id).select(field).lean();
  return current?.[field] ?? 0;
}

// Cursor = the last post's (source id, order). Feed sorts by source desc, order asc.
export function encodeCursor(post) {
  const source = post.source?._id ?? post.source;
  return Buffer.from(JSON.stringify({ s: String(source), o: post.order })).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const { s, o } = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s) && Number.isInteger(o) && o >= 0) return { s, o };
  } catch {
    // fall through
  }
  throw badRequest('The feed cursor is invalid. Reload the feed.');
}

export async function queryFeed(filter, { cursor, limit, viewer }) {
  const query = { ...filter };
  const after = decodeCursor(cursor);
  if (after) {
    query.$or = [{ source: { $lt: after.s } }, { source: after.s, order: { $gt: after.o } }];
  }
  const docs = await Post.find(query).sort({ source: -1, order: 1 }).limit(limit + 1).populate(POST_POPULATE).lean();
  const page = docs.slice(0, limit);
  return {
    posts: await serializePosts(page, viewer),
    nextCursor: docs.length > limit && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
}
