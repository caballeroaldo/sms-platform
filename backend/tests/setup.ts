/**
 * SMS Platform - Integration test setup
 *
 * Loaded as a Vitest setupFiles entry (see vitest.config.ts). Builds the
 * Express app from src/app.ts (NO worker, NO listen — see the app factory
 * comment) and exposes a login helper so each test can mint a Bearer token.
 *
 * Tests run against the developer's local dev DB (the same .env the server
 * uses), so test files MUST clean up every row they create — they own their
 * isolation. Convention: test phones use a distinctive, won't-collide-with-seed
 * number and a distinctive CSV "As of" marker so audit rows are easy to remove.
 */

import 'dotenv/config';
import request from 'supertest';
import app from '../src/app.js';

/**
 * POST /api/auth/login as the seeded admin, returning the Authorization
 * header to attach to subsequent requests. Throws (failing the suite) on a
 * non-200 so a broken login surfaces immediately rather than as confusing 401s.
 */
export async function authHeader(): Promise<Record<string, string>> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'admin123' });

  if (res.status !== 200 || !res.body?.data?.token) {
    throw new Error(
      `Test login failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  return { Authorization: `Bearer ${res.body.data.token}` };
}

export { request, app };
