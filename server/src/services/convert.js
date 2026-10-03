import { convertLocally } from './convert-local.js';
import { convertWithOpenAI } from './convert-openai.js';
import { truncate } from './text.js';

/**
 * Converts source text to ordered posts. Uses OpenAI when a key is configured
 * and its output validates; otherwise the deterministic local converter.
 * The local converter throws a 400 when the text is too thin for a lesson.
 */
export async function convertToPosts({ text, topicName, openai, limits }) {
  if (openai.apiKey) {
    const posts = await convertWithOpenAI({
      text: truncate(text, limits.modelInputChars),
      topicName,
      apiKey: openai.apiKey,
      model: openai.model,
      timeoutMs: limits.openaiTimeoutMs,
    });
    if (posts) return { posts, converter: 'openai' };
  }
  return { posts: convertLocally(text, topicName), converter: 'local' };
}
