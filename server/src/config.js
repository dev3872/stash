import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = path.resolve(here, '..', 'uploads');

// Hard limits that keep a single request from stalling the process.
export const LIMITS = {
  pdfBytes: 15 * 1024 * 1024,
  pdfMaxPages: 60,
  extractChars: 120_000, // stop reading a source after this many characters
  storedTextChars: 50_000, // what we keep on the Source document
  modelInputChars: 24_000, // what we send to OpenAI
  htmlBytes: 3 * 1024 * 1024,
  fetchTimeoutMs: 12_000,
  pdfTimeoutMs: 30_000,
  openaiTimeoutMs: 60_000,
  minWords: 120,
};

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function loadConfig(env = process.env) {
  const required = ['MONGODB_URI', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'CLIENT_ORIGIN'];
  const missing = required.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy server/.env.example to server/.env and fill them in.`
    );
  }

  const domain = normalizeDomain(env.AUTH0_DOMAIN);

  return {
    port: Number(env.PORT) || 4000,
    mongodbUri: env.MONGODB_URI,
    clientOrigins: env.CLIENT_ORIGIN.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    auth: {
      audience: env.AUTH0_AUDIENCE.trim(),
      issuerBaseURL: `https://${domain}/`,
      userinfoUrl: `https://${domain}/userinfo`,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY?.trim() || '',
      model: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    },
  };
}
