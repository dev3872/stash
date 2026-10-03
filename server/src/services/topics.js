import { Topic } from '../models/index.js';
import { badRequest } from '../lib/errors.js';

export function normalizeTopicName(raw) {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 2) throw badRequest('Enter a topic name (at least 2 characters).');
  if (name.length > 80) throw badRequest('Topic names must be 80 characters or fewer.');
  return name;
}

export function topicKey(name) {
  return name.toLocaleLowerCase('en');
}

export function slugify(name) {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'topic';
}

/** Finds a topic by case-insensitive name, or creates it with a unique slug. */
export async function findOrCreateTopic(rawName) {
  const name = normalizeTopicName(rawName);
  const nameKey = topicKey(name);

  const existing = await Topic.findOne({ nameKey });
  if (existing) return existing;

  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return await Topic.create({ name, nameKey, slug });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Same name created concurrently: use it. Otherwise the slug collided; try the next one.
      const raced = await Topic.findOne({ nameKey });
      if (raced) return raced;
    }
  }
  throw new Error(`Could not allocate a slug for topic "${name}"`);
}

export function publicTopic(topic) {
  if (!topic) return null;
  return { id: String(topic._id), name: topic.name, slug: topic.slug, postCount: topic.postCount ?? 0 };
}
