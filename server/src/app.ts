import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { config } from './config/env.js';

export const createApp = (): Express => {
  const app = express();

  // Security & standard middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API base route
  app.use('/api', apiRouter);

  // Fallback 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
