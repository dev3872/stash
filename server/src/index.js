import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

async function main() {
  const config = loadConfig();

  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await mongoose.connection.syncIndexes();
  } catch (err) {
    // Keep running; queries still work without an index, just slower.
    console.warn(`[db] some indexes could not be built: ${err.message}`);
  }
  console.log(`[db] connected to ${mongoose.connection.name}`);

  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] CORS origin(s): ${config.clientOrigins.join(', ')}`);
    console.log(`[api] post converter: ${config.openai.apiKey ? `OpenAI (${config.openai.model}) with local fallback` : 'local (no OPENAI_API_KEY set)'}`);
  });
  // Conversion runs inside the request, so allow slow uploads and model calls.
  server.requestTimeout = 180_000;

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[startup] ${err.message}`);
  process.exit(1);
});
