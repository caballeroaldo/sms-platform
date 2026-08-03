/**
 * Integration tests for POST /api/clients
 *
 * Drives the real Express app via supertest against the developer's local DB
 * (NO worker, NO Twilio — create never enqueues or sends). Fixtures created
 * directly via Prisma use E.164 phones (bypassing normalizeToE164, like the
 * seed); API sends use the bare 10-digit form to exercise the route's
 * normalization. afterAll hard-deletes the whole test phone block.
 *
 * Phone block: NPA 312 (+1312999 00NN, NXX 999). Valid (312 ∈ NPA_VALUES —
 * normalizeToE164 rejects reserved NPA 555), and disjoint from the seed
 * (+15551001001..6), the import suite (+14089990001), the CRUD suite
 * (+1415999*), and the count suite (+1212999*).
 *
 * POST /clients writes NO audit row (the route only calls db.findByPhone +
 * db.create), so the phone-block sweep in afterAll is the complete cleanup.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';

const PHONE_PREFIX = '+1312999';

/** Mint an E.164 phone in the test block from its last-two line digits. */
function phoneFor(lineNN: number): string {
  return `${PHONE_PREFIX}00${String(lineNN).padStart(2, '0')}`;
}

/** Bare 10-digit form of phoneFor(NN) — the shape a client of the API sends. */
function bareFor(lineNN: number): string {
  const full = phoneFor(lineNN); // +131299900NN
  return full.slice(2); // strip the leading '+1' → 31299900NN
}

afterAll(async () => {
  // Hard-delete every row in the test block. POST /clients creates opted-IN
  // rows only (the route has no path to optedOut), and the duplicate-test
  // fixtures (incl. the opted-out one) live here too; deleteMany ignores the
  // optedOut flag, so all are swept.
  await prisma.client.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.$disconnect();
});

describe('POST /api/clients', () => {
  it('creates a client (201), normalizes a bare 10-digit phone to E.164, and starts tax fields at clean defaults', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'Post', phone: bareFor(11) }); // bare 3129990011

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.firstName).toBe('Post');
    expect(res.body.data.phone).toBe(phoneFor(11)); // normalized → +13129990011

    // POST owns identity only; the tax-season fields an import owns must start
    // neutral so a later import's "new → create" path isn't polluted. Lock the
    // full clean-slate contract via a direct DB read.
    const row = await prisma.client.findUnique({ where: { phone: phoneFor(11) } });
    expect(row).not.toBeNull();
    expect(row!.optedOut).toBe(false); // new clients are opted-in
    expect(row!.lastName).toBe(''); // route defaults missing lastName to ''
    expect(row!.email).toBeNull();
    expect(row!.birthday).toBeNull();
    expect(row!.notes).toBeNull();
    expect(row!.taxFiledDate).toBeNull();
    expect(row!.taxReturnType).toBeNull();
    expect(row!.taxpayerStatus).toBeNull();
    expect(row!.inactive).toBe(false);
    expect(row!.clientLY).toBe(false);
    expect(row!.clientNew).toBe(false);
  });

  it('rejects a missing firstName → 400 "First name and phone are required"', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ phone: bareFor(21) }); // no firstName

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/First name and phone are required/);

    // 400 returns before db.create — no row at the would-be normalized phone.
    const row = await prisma.client.findUnique({ where: { phone: phoneFor(21) } });
    expect(row).toBeNull();
  });

  it('rejects a missing phone → 400 "First name and phone are required"', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'NoPhone' }); // no phone

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/First name and phone are required/);
  });

  it('rejects an invalid phone format (reserved NPA 555) → 400, creating no row', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'Bad', phone: '5550000000' }); // NPA 555 ∉ NPA_VALUES

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid phone number format/);

    // normalizeToE164 threw before the DB was touched — no row at the would-be
    // normalized phone (+15550000000). (Bare 555 never reaches E.164.)
    const row = await prisma.client.findUnique({ where: { phone: '+15550000000' } });
    expect(row).toBeNull();
  });

  it('rejects a duplicate phone (active client) → 409, creating no second row', async () => {
    // Fixture created directly via Prisma (raw E.164, bypasses normalize).
    await prisma.client.create({
      data: { firstName: 'Existing', lastName: 'Active', phone: phoneFor(41) },
    });

    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'Dup', phone: bareFor(41) }); // same phone, bare

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/);

    // Exactly one row at that phone — the fixture, not a second creation.
    const count = await prisma.client.count({ where: { phone: phoneFor(41) } });
    expect(count).toBe(1);
  });

  it('rejects a duplicate phone of an opted-out (soft-deleted) client → 409 (a soft-deleted phone is NOT reusable via POST)', async () => {
    // Soft-deleted fixture: optedOut=true. db.findByPhone (Prisma findUnique by
    // phone) finds it regardless of optedOut, so POST cannot "re-create" the
    // number as a fresh opted-in client. Locks the contract that a soft-deleted
    // phone stays reserved until the row is hard-deleted (or edited via PUT).
    await prisma.client.create({
      data: { firstName: 'Ghost', lastName: 'OptedOut', phone: phoneFor(51), optedOut: true },
    });

    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'Reuse', phone: bareFor(51) });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/);

    // The original opted-out row survives, un-recreated: still exactly one row,
    // and it is STILL opted out (POST did not resurrect it as opted-in).
    const count = await prisma.client.count({ where: { phone: phoneFor(51) } });
    expect(count).toBe(1);
    const row = await prisma.client.findUnique({ where: { phone: phoneFor(51) } });
    expect(row!.optedOut).toBe(true);
    expect(row!.firstName).toBe('Ghost'); // unchanged, not overwritten by the rejected POST
  });

  it('persists optional fields (lastName, email, birthday, notes) and defaults optedOut=false', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({
        firstName: 'Full',
        lastName: 'Payload',
        phone: bareFor(61),
        email: 'full.payload@example.com',
        // Full ISO-8601 DateTime. Both this shape and the date-only "YYYY-MM-DD"
        // form (what <input type=date> sends) are now coerced by db.create real-
        // mode; the date-only case is covered by its own regression test below.
        birthday: '1990-05-15T00:00:00.000Z',
        notes: 'Prefers morning appointments',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lastName).toBe('Payload');
    expect(res.body.data.email).toBe('full.payload@example.com');
    expect(res.body.data.notes).toBe('Prefers morning appointments');
    expect(res.body.data.optedOut).toBe(false);

    // Birthday: the route passes the ISO date string; Prisma stores a DateTime
    // and serializes it back to an ISO timestamp. Verify it landed (UTC date).
    const row = await prisma.client.findUnique({ where: { phone: phoneFor(61) } });
    expect(row).not.toBeNull();
    expect(row!.birthday).not.toBeNull();
    expect(row!.birthday!.toISOString()).toMatch(/^1990-05-15/);
    expect(row!.email).toBe('full.payload@example.com');
    expect(row!.notes).toBe('Prefers morning appointments');
    expect(row!.optedOut).toBe(false);
  });

  // Regression for the db.create real-mode birthday-coercion gap (fixed in
  // database.ts): db.create now coerces `birthday: data.birthday ? new
  // Date(data.birthday) : null`, matching db.update + the mock branch. The Add
  // Client / Edit Client form renders birthday as <input type=date>, whose
  // value is a date-only "YYYY-MM-DD" string; Prisma's DateTime scalar rejects a
  // bare date-only string ("premature end of input") → the route used to throw
  // → 500. Sends exactly the date-only shape the form produces and expects 201.
  it('accepts a date-only YYYY-MM-DD birthday (what <input type=date> sends) and stores it as a parsed DateTime', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set(await authHeader())
      .send({ firstName: 'DateOnly', phone: bareFor(81), birthday: '1990-05-15' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.birthday).toBe('1990-05-15T00:00:00.000Z'); // serialized Date

    // Direct DB — new Date('1990-05-15') is UTC midnight (ISO date-only → UTC);
    // Prisma stores + round-trips it. Locks the coercion the old raw-string
    // pass-through broke.
    const row = await prisma.client.findUnique({ where: { phone: phoneFor(81) } });
    expect(row).not.toBeNull();
    expect(row!.birthday).not.toBeNull();
    expect(row!.birthday!.toISOString()).toBe('1990-05-15T00:00:00.000Z');
  });


  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'NoAuth', phone: bareFor(71) });

    expect(res.status).toBe(401);
  });
});
