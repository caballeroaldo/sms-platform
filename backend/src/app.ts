/**
 * SMS Platform - Express App Factory
 *
 * Builds and exports the Express application WITHOUT starting the server
 * (no app.listen) and WITHOUT importing the BullMQ worker. This separation
 * lets the integration tests drive the app over HTTP via supertest without
 * binding a port or spawning the worker/poller (which need Redis + would
 * race the assertions).
 *
 * Runtime startup (worker import, banner, listen) lives in src/index.ts.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config, { isMockMode } from './config/index.js';
import routes from './routes/index.js';
import { requestLogger, corsOptions } from './middleware/index.js';
import { ApiResponse } from './types/index.js';

// Track if database is configured
const hasDatabase = !!config.databaseUrl;

// Initialize Express app
const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

// Parse JSON bodies (with size limit for webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS (allow frontend origin)
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// ===========================================
// API ROUTES
// ===========================================

app.use('/api', routes);

// ===========================================
// HEALTH CHECK ENHANCEMENT
// ===========================================

app.use('/api/health', (req, res, next) => {
  if (req.path === '/detailed') {
    // Detailed health check
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: hasDatabase ? 'configured' : 'mock',
          twilio: config.twilioAccountSid ? 'configured' : 'mock',
          redis: config.redisUrl ? 'configured' : 'mock',
        },
        mode: isMockMode ? 'development (mock services)' : 'production-ready',
      },
    });
  } else {
    next();
  }
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  } as ApiResponse);
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  } as ApiResponse);
});

export default app;
