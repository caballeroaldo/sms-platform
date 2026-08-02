import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests drive the Express app via supertest — no DOM, no
    // browser env. Node is the right environment.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Loads .env (via config) and exports shared helpers (authHeader, app).
    setupFiles: ['./tests/setup.ts'],
    // These hit the real dev DB + routes; give them room over CI boxes.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
