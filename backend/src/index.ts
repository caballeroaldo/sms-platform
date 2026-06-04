/**
 * SMS Platform - Main Entry Point
 * Express server with all middleware and routes
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config/index.js';
import routes from './routes/index.js';
import { requestLogger, corsOptions } from './middleware/index.js';
import { ApiResponse } from './types/index.js';

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

// ===========================================
// START SERVER
// ===========================================

app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   SMS Platform Backend                                 ║
║   ─────────────────                                    ║
║                                                       ║
║   Server:  http://localhost:${config.port}              ║
║   Health:  http://localhost:${config.port}/api/health   ║
║   Env:     ${config.nodeEnv.padEnd(42)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;