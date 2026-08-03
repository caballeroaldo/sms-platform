/**
 * Integration tests for GET /api/clients/count
 *
 * The endpoint powers the campaign-form "Will target N opted-in clients"
 * preview, so its count MUST match the audience POST /campaigns/:id/send would
 * actually target — i.e. it must use the same `buildAudienceWhere` helper as the
 * send route. These tests lock that contract (parity) and the predicate
 * semantics (which fixtures qualify).
 *
 * Drives the real Express app via supertest against the developer's local DB.
 * Fixtures are created directly via Prisma under a shared phone block and
 * hard-deleted in afterAll. Phone block: NPA 212 (+1212999 00NN, valid),
 * disjoint from the seed (+1555), the import suite (+14089990001), and the CRUD
 * suite (+1415999*).
 *
 * Concurrency note: this suite asserts on AGGREGATE counts, which plain parity
 * would race against the other test suites (import / CRUD) running in parallel
 * against the same dev DB. So each parity check is "bracketed" — a direct count
 * is taken immediately before AND after the endpoint read, and the endpoint
 * value must lie within [min(before, after), max(before, after)]. A single
 * concurrent insert/delete by another suite between the three reads keeps the
 * endpoint value inside the bracket; only an opposite-direction burst within
 * the ~ms window could push it out, which is negligible for these bounded
 * suites. The predicate tests are scoped to OUR phone prefix, so other suites'
 * rows cannot perturb them at all.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';
import { buildAudienceWhere } from '../src/utils/audience.js';
import type { AudienceType } from '@prisma/client';

const PHONE_PREFIX = '+1212999';

/** Build an E.164 phone in the test block from its last-two line digits. */
function phoneFor(lineNN: number): string {
  return `${PHONE_PREFIX}00${String(lineNN).padStart(2, '0')}`;
}

/** The prior calendar year's mid-point, computed like buildAudienceWhere (UTC). */
function priorYearMid(): Date {
  const year = new Date().getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 5, 15)); // June 15, safely mid-window
}

const VALID_AUDIENCES = ['ALL', 'PREV_YEAR_ACTIVE'] as const;
type EndpointAudience = (typeof VALID_AUDIENCES)[number];

// Module-scoped auth header (token is stable for days), minted once in beforeAll
// so the suite doesn't log in ~9 times.
let headers: Record<string, string>;

/**
 * Bracketed parity: the endpoint count must lie within [min, max] of two direct
 * counts taken immediately before and after the endpoint read. Proves the
 * endpoint uses buildAudienceWhere (no extra filter, no drift) while tolerating a
 * single concurrent insert/delete by another test suite.
 */
async function expectParity(audience: EndpointAudience): Promise<void> {
  const where = buildAudienceWhere(audience as AudienceType);
  const before = await prisma.client.count({ where });
  const res = await request(app)
    .get(`/api/clients/count?audience=${audience}`)
    .set(headers);
  const after = await prisma.client.count({ where });

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data.audience).toBe(audience);
  expect(res.body.data.count).toBeGreaterThanOrEqual(Math.min(before, after));
  expect(res.body.data.count).toBeLessThanOrEqual(Math.max(before, after));
}

beforeAll(async () => {
  headers = await authHeader();

  const mid = priorYearMid();
  const thisYear = new Date().getUTCFullYear();

  // 4 fixtures covering the audience-predicate matrix:
  //   qualifying   — opted-in, filed mid prior year   → ALL + PREV_YEAR_ACTIVE
  //   outsideYear  — opted-in, filed THIS year        → ALL only
  //   nullFiled    — opted-in, never filed (no Date Changed row) → ALL only
  //   optedOut     — opted-out, DID file prior year   → neither
  // Created directly via Prisma (bypasses normalizeToE164, like the seed), so any
  // valid unique string works; 212 keeps the established valid-NPA convention.
  await prisma.client.create({
    data: { firstName: 'Cnt', lastName: 'Qual', phone: phoneFor(11), optedOut: false, taxFiledDate: mid },
  });
  await prisma.client.create({
    data: { firstName: 'Cnt', lastName: 'Outside', phone: phoneFor(22), optedOut: false, taxFiledDate: new Date(Date.UTC(thisYear, 1, 1)) },
  });
  await prisma.client.create({
    data: { firstName: 'Cnt', lastName: 'Null', phone: phoneFor(33), optedOut: false, taxFiledDate: null },
  });
  await prisma.client.create({
    data: { firstName: 'Cnt', lastName: 'OptOut', phone: phoneFor(44), optedOut: true, taxFiledDate: mid },
  });
});

afterAll(async () => {
  // Hard-delete every row in the test block (the optedOut flag is irrelevant to
  // deleteMany). These count tests write no audit rows — nothing else to clean.
  await prisma.client.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.$disconnect();
});

describe('GET /api/clients/count', () => {
  it('returns the opted-in count for ALL and matches a direct count (parity)', async () => {
    await expectParity('ALL');
  });

  it('returns the prior-year-active count and matches a direct count (parity)', async () => {
    await expectParity('PREV_YEAR_ACTIVE');
  });

  it('ALL counts the opted-in fixtures and excludes opted-out (prefix-scoped)', async () => {
    // Scoped to OUR phone block so other suites' rows cannot perturb this. The
    // ALL predicate is { optedOut: false }: the three opted-in fixtures count;
    // the opted-out one (even though it filed in the prior year) does not.
    const count = await prisma.client.count({
      where: { ...buildAudienceWhere('ALL'), phone: { startsWith: PHONE_PREFIX } },
    });
    expect(count).toBe(3); // qualifying + outsideYear + nullFiled
  });

  it('PREV_YEAR_ACTIVE counts ONLY opted-in clients who filed in the prior calendar year', async () => {
    // Scoped to OUR block. The PREV_YEAR_ACTIVE predicate is
    // { optedOut: false, taxFiledDate within [priorYearStart, priorYearEnd] }.
    // Excluded: outsideYear (wrong year), nullFiled (NULL fails the range),
    // and optedOut (excluded despite filing in the prior year — consent wins).
    const count = await prisma.client.count({
      where: { ...buildAudienceWhere('PREV_YEAR_ACTIVE'), phone: { startsWith: PHONE_PREFIX } },
    });
    expect(count).toBe(1); // only the qualifying prior-year filer
  });

  it('rejects MANUAL with 400 (a GET cannot carry a recipient-id list)', async () => {
    const res = await request(app).get('/api/clients/count?audience=MANUAL').set(headers);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid audience value with 400', async () => {
    const res = await request(app).get('/api/clients/count?audience=BOGUS').set(headers);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('defaults to ALL when no audience param is supplied', async () => {
    const where = buildAudienceWhere('ALL');
    const before = await prisma.client.count({ where });
    const res = await request(app).get('/api/clients/count').set(headers); // no param
    const after = await prisma.client.count({ where });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.audience).toBe('ALL');
    // Bracketed: the default-route count must match the ALL predicate.
    expect(res.body.data.count).toBeGreaterThanOrEqual(Math.min(before, after));
    expect(res.body.data.count).toBeLessThanOrEqual(Math.max(before, after));
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/clients/count?audience=ALL');

    expect(res.status).toBe(401);
  });
});
