/**
 * Integration tests for PUT / DELETE /api/clients/:id
 *
 * Drives the real Express app via supertest against the developer's local DB
 * (NO worker, NO Twilio — neither route enqueues or sends). Each test mints its
 * own fixture row directly via Prisma under a shared phone block; afterAll
 * hard-deletes every row in that block (including soft-opted-out ones). These
 * routes write no audit rows, so there is nothing else to clean.
 *
 * Phone block: NPA 415 (valid — normalizeToE164 rejects reserved NPA 555),
 * NXX 999, line 00NN, all sharing the '+1415999' prefix. Disjoint from the
 * seed (+15551001001..6) and the import suite (+14089990001). The bare
 * 10-digit form is used where a route normalizes; the E.164 form is used for
 * direct Prisma fixture creation and the afterAll sweep.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';

const PHONE_PREFIX = '+1415999';

/** Mint an E.164 phone in the test block from its last-two line digits (11→+14159990011). */
function phoneFor(lineNN: number): string {
  return `${PHONE_PREFIX}00${String(lineNN).padStart(2, '0')}`;
}

// cuids are 24+ lowercase hex; this string will never match a real id, so
// db.findUnique returns null → 404. Typed as string to match the route param.
const UNKNOWN_ID = 'nonexistent-client-id-00000000';

/** Create a minimal valid client fixture directly via Prisma. */
async function createFixture(phone: string, extra: Record<string, unknown> = {}) {
  return prisma.client.create({
    data: {
      firstName: 'Crud',
      lastName: 'Test',
      phone,
      ...extra,
    },
  });
}

afterAll(async () => {
  // Hard-delete every row in the test phone block — catches soft-opted-out rows
  // too (optedOut stays true on those, but deleteMany ignores that flag).
  await prisma.client.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.$disconnect();
});

describe('PUT /api/clients/:id', () => {
  it('updates identity/notes fields and returns 200, leaving tax fields untouched', async () => {
    const created = await createFixture(phoneFor(11), { taxReturnType: '1040' });

    const res = await request(app)
      .put(`/api/clients/${created.id}`)
      .set(await authHeader())
      .send({ firstName: 'Updated', notes: 'Now managing digitally' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.firstName).toBe('Updated');
    expect(res.body.data.notes).toBe('Now managing digitally');
    // We sent only firstName + notes; lastName stays as the fixture default.
    expect(res.body.data.lastName).toBe('Test');

    // PUT only touches identity/notes — the tax-only fields an import owns
    // must survive an operator edit (symmetric to the import-preservation rule).
    const row = await prisma.client.findUnique({ where: { id: created.id } });
    expect(row!.taxReturnType).toBe('1040');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .put(`/api/clients/${UNKNOWN_ID}`)
      .set(await authHeader())
      .send({ firstName: 'Nope' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('normalizes a changed phone to E.164 (bare 415 10-digit → +1415…)', async () => {
    const created = await createFixture(phoneFor(21));

    const res = await request(app)
      .put(`/api/clients/${created.id}`)
      .set(await authHeader())
      .send({ phone: '4159990022' }); // bare 10-digit, valid NPA 415

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe(phoneFor(22)); // +14159990022

    const row = await prisma.client.findUnique({ where: { id: created.id } });
    expect(row!.phone).toBe(phoneFor(22));
  });

  it('rejects a changed phone with a reserved NPA (555) → 400, leaving the row unchanged', async () => {
    const created = await createFixture(phoneFor(31));

    const res = await request(app)
      .put(`/api/clients/${created.id}`)
      .set(await authHeader())
      .send({ phone: '5550000000' }); // NPA 555 is reserved → normalizeToE164 rejects

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid phone number format/);

    // 400 returns before db.update, so the row is untouched.
    const row = await prisma.client.findUnique({ where: { id: created.id } });
    expect(row!.phone).toBe(phoneFor(31));
  });

  it('returns 409 when changing phone to one owned by another client', async () => {
    const a = await createFixture(phoneFor(41));
    const b = await createFixture(phoneFor(42));

    const res = await request(app)
      .put(`/api/clients/${a.id}`)
      .set(await authHeader())
      .send({ phone: '4159990042' }); // b's phone, bare 10-digit

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/);

    // a is untouched (409 returns before db.update).
    const row = await prisma.client.findUnique({ where: { id: a.id } });
    expect(row!.phone).toBe(phoneFor(41));
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app)
      .put(`/api/clients/${UNKNOWN_ID}`)
      .send({ firstName: 'Nope' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/clients/:id', () => {
  it('soft-opts-out the client (sets optedOut=true) while keeping the row', async () => {
    const created = await createFixture(phoneFor(51));

    const res = await request(app)
      .delete(`/api/clients/${created.id}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/opted out/i);
    expect(res.body.data.optedOut).toBe(true);

    // Soft delete for compliance — the row survives so history is retained.
    const row = await prisma.client.findUnique({ where: { id: created.id } });
    expect(row).not.toBeNull();
    expect(row!.phone).toBe(phoneFor(51));
    expect(row!.optedOut).toBe(true);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app)
      .delete(`/api/clients/${UNKNOWN_ID}`)
      .set(await authHeader());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 "already opted out" for a client already opted out', async () => {
    const created = await createFixture(phoneFor(61), { optedOut: true });

    const res = await request(app)
      .delete(`/api/clients/${created.id}`)
      .set(await authHeader());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already opted out/i);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).delete(`/api/clients/${UNKNOWN_ID}`);

    expect(res.status).toBe(401);
  });
});
