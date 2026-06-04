/**
 * SMS Platform - Workers Index
 * Entry point for background workers
 */

import messageWorker from './messageWorker.js';

// Keep workers running
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await messageWorker.close();
  process.exit(0);
});

console.log('All workers initialized');