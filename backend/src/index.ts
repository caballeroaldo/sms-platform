/**
 * SMS Platform - Main Entry Point
 *
 * Imports the app factory (src/app.ts) and adds the runtime lifecycle that
 * tests should NOT spin up: the BullMQ worker + scheduled-message poller, the
 * startup banner, and app.listen. Integration tests import src/app.ts directly
 * so they can drive the routes via supertest without binding a port or racing
 * the worker.
 */

import config, { isMockMode } from './config/index.js';
import app from './app.js';
// Start the BullMQ worker + the scheduled-message poller. Required for SMS
// dispatch: POST /campaigns/:id/send enqueues jobs here, and the poller sweeps
// any PENDING messages left by other paths. Needs Redis (see docs/PROGRESS.md).
import './workers/index.js';

// Track if database is configured
const hasDatabase = !!config.databaseUrl;

// ===========================================
// START SERVER
// ===========================================

const modeIndicator = isMockMode ? '⚠️  MOCK MODE' : '✅ Production Ready';
const dbIndicator = hasDatabase ? '🗄️   Database: connected' : '🗄️   Database: mock (run prisma migrate + seed first)';

console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   SMS Platform Backend                                 ║
║   ─────────────────                                    ║
║                                                        ║
║   Server:  http://localhost:${config.port.toString().padStart(26)}║
║   Health:  http://localhost:${config.port}/api/health     ║
║   Detailed: http://localhost:${config.port}/api/health/detailed║
║                                                        ║
║   Mode:      ${modeIndicator.padEnd(42)}║
║   ${dbIndicator.padEnd(56)}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);

app.listen(config.port, () => {
  // Server started successfully
});

export default app;
