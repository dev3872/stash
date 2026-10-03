/**
 * Recommendation engine. Deterministic and explainable; no external services.
 *
 * "For you" ranks recent sequences (sources) with:
 *   3.0 × topic affinity   what the viewer liked (1), commented on (2), shared (3) or created (2), normalized 0–1
 *   2.0 × following        the author is someone the viewer follows
 *   1.5 × popularity       log-scaled likes + 2×comments + 3×shares, normalized 0–1
 *   2.0 × recency          exp(-age / 4 days)
 *  −1.5 × already engaged  the viewer already interacted with this sequence
 * then re-ranks greedily so one topic or author doesn't dominate a page.
 * Signed-out visitors get the same ranking without the personal terms.
 */
import { Comment, Follow, Like, Post, Share, Source, Topic, User } from '../models/index.js';
import { POST_POPULATE, serializePosts } from './posts.js';
import { publicUser } from './users.js';
import { publicTopic } from './topics.js';

const CANDIDATE_LIMIT = 300;
const WEIGHTS = { topic: 3, following: 2, popularity: 1.5, recency: 2, engaged: -1.5 };
const RECENCY_HOURS = 96;
const TOPIC_REPEAT_DECAY = 0.75;
const AUTHOR_REPEAT_DECAY = 0.85;

const id = (value) => String(value?._id ?? value);

export async function buildProfile(user) {
  if (!user) return { affinity: new Map(), following: new Set(), engagedSources: new Set(), hasSignals: false };

  const [likes, comments, shares, ownSources, follows] = await Promise.all([
    Like.find({ user: user._id }).sort({ createdAt: -1 }).limit(300).select('topic post').lean(),
    Comment.find({ user: user._id }).sort({ createdAt: -1 }).limit(200).select('topic post').lean(),
    Share.find({ user: user._id }).sort({ createdAt: -1 }).limit(200).select('topic post').lean(),
    Source.find({ author: user._id, status: 'ready' }).sort({ _id: -1 }).limit(100).select('topic').lean(),
    Follow.find({ follower: user._id }).select('following').lean(),
  ]);

  const raw = new Map();
  const add = (topic, weight) => topic && raw.set(id(topic), (raw.get(id(topic)) || 0) + weight);
  likes.forEach((l) => add(l.topic, 1));
  comments.forEach((c) => add(c.topic, 2));
  shares.forEach((s) => add(s.topic, 3));
  ownSources.forEach((s) => add(s.topic, 2));

  const max = Math.max(0, ...raw.values());
  const affinity = new Map([...raw].map(([topic, value]) => [topic, max ? value / max : 0]));

  const engagedPostIds = [...new Set([...likes, ...comments, ...shares].map((x) => id(x.post)))];
  const engagedPosts = engagedPostIds.length
    ? await Post.find({ _id: { $in: engagedPostIds } }).select('source').lean()
    : [];

  return {
    affinity,
    following: new Set(follows.map((f) => id(f.following))),
    engagedSources: new Set(engagedPosts.map((p) => id(p.source))),
    hasSignals: affinity.size > 0 || follows.length > 0,
  };
}

function scoreCandidates(candidates, profile, topicNames, now = Date.now()) {
  const engagement = (s) => (s.likeCount || 0) + 2 * (s.commentCount || 0) + 3 * (s.shareCount || 0);
  const maxEngagement = Math.max(1, ...candidates.map(engagement));

  return candidates.map((source) => {
    const topicId = id(source.topic);
    const ageHours = Math.max(0, (now - new Date(source.createdAt).getTime()) / 3.6e6);
    const parts = {
      topic: profile.affinity.get(topicId) || 0,
      following: profile.following.has(id(source.author)) ? 1 : 0,
      popularity: Math.log1p(engagement(source)) / Math.log1p(maxEngagement),
      recency: Math.exp(-ageHours / RECENCY_HOURS),
      engaged: profile.engagedSources.has(id(source)) ? 1 : 0,
    };
    const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * parts[key], 0);

    let reason;
    if (parts.topic >= 0.3) reason = { type: 'topic', label: `Because you’re into ${topicNames.get(topicId) || 'this topic'}` };
    else if (parts.following) reason = { type: 'following', label: 'From someone you follow' };
    else if (parts.popularity >= 0.5) reason = { type: 'popular', label: 'Popular with learners' };
    else if (parts.recency >= 0.7) reason = { type: 'new', label: 'New on Stash' };
    else reason = { type: 'explore', label: 'Something new to explore' };

    return { source, score, parts, reason };
  });
}

/** Greedy diversity re-rank: repeated topics/authors get progressively discounted. */
function diversify(scored) {
  const remaining = [...scored].sort((a, b) => b.score - a.score || id(b.source).localeCompare(id(a.source)));
  const topicSeen = new Map();
  const authorSeen = new Map();
  const ranked = [];
  while (remaining.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    remaining.forEach((item, index) => {
      // Shift scores positive so the decay always lowers them.
      const base = item.score + 10;
      const value = base
        * TOPIC_REPEAT_DECAY ** (topicSeen.get(id(item.source.topic)) || 0)
        * AUTHOR_REPEAT_DECAY ** (authorSeen.get(id(item.source.author)) || 0);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    const [picked] = remaining.splice(bestIndex, 1);
    topicSeen.set(id(picked.source.topic), (topicSeen.get(id(picked.source.topic)) || 0) + 1);
    authorSeen.set(id(picked.source.author), (authorSeen.get(id(picked.source.author)) || 0) + 1);
    ranked.push(picked);
  }
  return ranked;
}

async function loadCandidates(viewer) {
  const filter = { status: 'ready', postCount: { $gt: 0 } };
  if (viewer) filter.author = { $ne: viewer._id };
  return Source.find(filter)
    .sort({ _id: -1 })
    .limit(CANDIDATE_LIMIT)
    .select('topic author postCount likeCount commentCount shareCount createdAt')
    .lean();
}

async function topicNameMap(topicIds) {
  const topics = await Topic.find({ _id: { $in: [...new Set(topicIds)] } }).select('name').lean();
  return new Map(topics.map((t) => [id(t), t.name]));
}

export async function rankForYou(viewer) {
  const [profile, candidates] = await Promise.all([buildProfile(viewer), loadCandidates(viewer)]);
  const names = await topicNameMap(candidates.map((c) => id(c.topic)));
  return diversify(scoreCandidates(candidates, profile, names));
}

/** One page of the "For you" feed: whole sequences, in ranked order. */
export async function forYouPage(viewer, { page, pageSize }) {
  const ranked = await rankForYou(viewer);
  const slice = ranked.slice(page * pageSize, (page + 1) * pageSize);
  const sourceIds = slice.map((item) => item.source._id);

  const posts = sourceIds.length
    ? await Post.find({ source: { $in: sourceIds } }).sort({ order: 1 }).populate(POST_POPULATE).lean()
    : [];
  const bySource = new Map(sourceIds.map((sid) => [id(sid), []]));
  for (const post of posts) bySource.get(id(post.source))?.push(post);

  const ordered = slice.flatMap((item) => bySource.get(id(item.source)) || []);
  const serialized = await serializePosts(ordered, viewer);
  const reasons = new Map(slice.map((item) => [id(item.source), item.reason]));
  const labelled = new Set();
  for (const post of serialized) {
    const sourceId = post.source?.id;
    if (sourceId && !labelled.has(sourceId)) {
      labelled.add(sourceId); // the reason shows above the first card of each sequence
      post.recommendation = reasons.get(sourceId) || null;
    }
  }

  return { posts: serialized, nextPage: ranked.length > (page + 1) * pageSize ? page + 1 : null };
}

/** People to follow: authors who post in the viewer's topics or are popular overall. */
export async function suggestUsers(viewer, limit = 5) {
  const [profile, candidates] = await Promise.all([buildProfile(viewer), loadCandidates(viewer)]);
  const scores = new Map();
  const topTopic = new Map();
  for (const source of candidates) {
    const author = id(source.author);
    if (viewer && (author === id(viewer) || profile.following.has(author))) continue;
    const affinity = profile.affinity.get(id(source.topic)) || 0;
    const engagement = Math.log1p((source.likeCount || 0) + 2 * (source.commentCount || 0) + 3 * (source.shareCount || 0));
    scores.set(author, (scores.get(author) || 0) + 2 * affinity + 0.5 * engagement + 0.2);
    const best = topTopic.get(author);
    if (!best || affinity > best.affinity) topTopic.set(author, { topic: id(source.topic), affinity });
  }

  const authorIds = [...scores.keys()];
  if (!authorIds.length) return [];
  const users = await User.find({ _id: { $in: authorIds } }).select('name picture followerCount').lean();
  const names = await topicNameMap([...topTopic.values()].map((t) => t.topic));

  return users
    .map((user) => {
      const score = scores.get(id(user)) + 0.5 * Math.log1p(user.followerCount || 0);
      const top = topTopic.get(id(user));
      const reason = top && top.affinity > 0
        ? `Posts about ${names.get(top.topic)}`
        : top ? `Recently posted about ${names.get(top.topic)}` : 'Active on Stash';
      return { ...publicUser(user), followerCount: user.followerCount || 0, reason, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

/**
 * Topics to explore. Collaborative signal first ("learners who like your
 * topics also like…"), then topics with fresh posts.
 */
export async function suggestTopics(viewer, limit = 6) {
  const profile = await buildProfile(viewer);
  const known = [...profile.affinity.keys()];
  const results = [];
  const used = new Set(known);

  if (viewer && known.length) {
    const top = [...profile.affinity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic]) => topic);
    const peerLikes = await Like.find({ topic: { $in: top }, user: { $ne: viewer._id } })
      .sort({ createdAt: -1 }).limit(1000).select('user').lean();
    const peers = [...new Set(peerLikes.map((l) => id(l.user)))].slice(0, 200);
    if (peers.length) {
      const theirLikes = await Like.find({ user: { $in: peers }, topic: { $nin: known } })
        .sort({ createdAt: -1 }).limit(2000).select('topic user').lean();
      const counts = new Map();
      const seenPair = new Set();
      for (const like of theirLikes) {
        const pair = `${id(like.user)}:${id(like.topic)}`;
        if (seenPair.has(pair)) continue; // count each peer once per topic
        seenPair.add(pair);
        counts.set(id(like.topic), (counts.get(id(like.topic)) || 0) + 1);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
      const topics = await Topic.find({ _id: { $in: ranked.map(([t]) => t) }, postCount: { $gt: 0 } }).lean();
      const byId = new Map(topics.map((t) => [id(t), t]));
      for (const [topicId] of ranked) {
        const topic = byId.get(topicId);
        if (!topic) continue;
        results.push({ ...publicTopic(topic), reason: 'Learners with your interests like this' });
        used.add(topicId);
      }
    }
  }

  if (results.length < limit) {
    const fresh = await Topic.find({ postCount: { $gt: 0 }, _id: { $nin: [...used] } })
      .sort({ lastPostedAt: -1 })
      .limit(limit - results.length)
      .lean();
    for (const topic of fresh) results.push({ ...publicTopic(topic), reason: 'Fresh posts' });
  }
  return results.slice(0, limit);
}
