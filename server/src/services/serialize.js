import { publicUser } from './users.js';
import { publicTopic } from './topics.js';

export function publicMedia(media) {
  if (!media?.url) return null;
  return {
    kind: media.kind,
    url: media.url,
    poster: media.poster || null,
    mime: media.mime || null,
    width: media.width || null,
    height: media.height || null,
    caption: media.caption || null,
    credit: media.credit || null,
    license: media.license || null,
    pageUrl: media.pageUrl || null,
  };
}

export function publicSource(source) {
  if (!source || !source._id) return null;
  return {
    id: String(source._id),
    kind: source.kind,
    url: source.kind === 'url' ? source.url : null,
    originalName: source.kind === 'pdf' ? source.originalName : null,
    title: source.title || null,
    origin: source.origin || null,
    postCount: source.postCount ?? 0,
    createdAt: source.createdAt,
  };
}

/** Serializes a post whose author, topic and source are populated. */
export function serializePost(post, likedIds = new Set()) {
  return {
    id: String(post._id),
    title: post.title,
    body: post.body,
    example: post.example || null,
    media: publicMedia(post.media),
    order: post.order,
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    createdAt: post.createdAt,
    author: publicUser(post.author),
    topic: publicTopic(post.topic),
    source: publicSource(post.source),
    likedByMe: likedIds.has(String(post._id)),
  };
}

export function serializeComment(comment) {
  return {
    id: String(comment._id),
    text: comment.text,
    createdAt: comment.createdAt,
    author: publicUser(comment.user),
  };
}
