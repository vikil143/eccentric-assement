import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/error.js';
import healthRouter from './routes/health.js';
import assetsRouter from './routes/assets.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(requestId);
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json());

  app.use(healthRouter);
  app.use('/api/assets', assetsRouter);

  app.use(errorHandler);

  return app;
}
