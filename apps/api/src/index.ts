import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './db/mongoose.js';

const app = createApp();

await connectMongo();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    console.log('HTTP server closed');
    await disconnectMongo();
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10 s
  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
