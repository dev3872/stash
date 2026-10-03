/**
 * Optional converter that asks OpenAI for strict JSON. Any failure (network,
 * HTTP error, refusal, invalid JSON, or posts that fail validation) returns
 * null so the caller can fall back to the local converter.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'body', 'example'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          example: { type: ['string', 'null'] },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You turn a source document into a short lesson for a curious beginner.
Rules:
- Return 4 to 8 posts in the order a learner should read them.
- Each post: a short title (2-8 words), a body of 2-4 short sentences in plain language, and an example.
- The example is one concrete example or analogy, but only when the source supports it. Otherwise use null.
- Explain more simply than the source. Avoid jargon, or define it in a few words.
- Use only facts from the source. Do not add citations, references, URLs, author names or quotes.
- If the source does not contain enough substance for a lesson, return {"posts": []}.`;

function splitSentences(text) {
  return text.match(/[^.!?]+(?:[.!?]+["”’)]?|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

function cleanString(value) {
  return typeof value === 'string'
    ? value.replace(/\[(\d+|citation needed)\]/gi, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim()
    : '';
}

/** Validates and normalizes model output. Returns posts or null. */
export function validateModelPosts(data) {
  if (!data || !Array.isArray(data.posts)) return null;
  if (data.posts.length < 4 || data.posts.length > 8) return null;

  const posts = [];
  for (const raw of data.posts) {
    if (!raw || typeof raw !== 'object') return null;
    const title = cleanString(raw.title).replace(/[.:]$/, '');
    let body = cleanString(raw.body);
    const example = raw.example == null ? null : cleanString(raw.example);

    if (title.length < 2 || title.length > 80) return null;
    const sentences = splitSentences(body);
    if (sentences.length < 2) return null;
    if (sentences.length > 4) body = sentences.slice(0, 4).join(' ');
    if (body.length < 40 || body.length > 900) return null;
    if (example !== null && (example.length > 500 || (example.length > 0 && example.length < 8))) return null;

    posts.push({ title, body, example: example || null });
  }
  return posts;
}

export async function convertWithOpenAI({ text, topicName, apiKey, model, timeoutMs }) {
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema: SCHEMA } },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Topic: ${topicName}\n\nSource text:\n"""\n${text}\n"""` },
        ],
      }),
    });
  } catch (err) {
    console.warn(`[convert] OpenAI request failed: ${err?.name || err}`);
    return null;
  }

  if (!res.ok) {
    console.warn(`[convert] OpenAI responded ${res.status}; using the local converter.`);
    return null;
  }

  try {
    const payload = await res.json();
    const message = payload?.choices?.[0]?.message;
    if (!message?.content || message.refusal) return null;
    const posts = validateModelPosts(JSON.parse(message.content));
    if (!posts) console.warn('[convert] OpenAI JSON failed validation; using the local converter.');
    return posts;
  } catch {
    console.warn('[convert] OpenAI returned invalid JSON; using the local converter.');
    return null;
  }
}
