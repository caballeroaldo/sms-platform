/**
 * Integration tests for GET /api/messages/conversations
 *
 * Drives the real Express app via supertest against the developer's local DB.
 * The conversations route is READ-ONLY — Prisma reads only (groupBy + distinct
 * findMany + count), no enqueue, no sendSMS — so it is safe to test in the
 * current real-Twilio mode (unlike /campaigns/:id/send or /messages/send-now,
 * which would fire live SMS).
 *
 * Route-ordering sentinel: `GET /messages/conversations` MUST be declared
 * before `GET /:id` in routes/messages.ts; if it were placed after, Express
 * would silently match it as `:id='conversations'` → 404 "Message not found".
 * The authed-200 test below fails loudly if that regression ever lands (a 404
 * is not 200), so it doubles as a guard on the route ordering.
 *
 * Isolation: the route lists ALL clients (with-message first, then
 * zero-message), so seed clients + any other suite's leftover rows would make
 * plain count/order assertions non-deterministic. Each test therefore creates
 * its own fixtures under a unique `search` token baked into the clients'
 * lastName and requests `?search=<token>` — scoping the universe to exactly
 * that test's clients. The token is unique per test, so leftovers from earlier
 * tests (deleted only in afterAll) never leak in.
 *
 * Phone block: NPA 503 (a real area code, not the reserved 555 the normalizer
 * rejects), NXX 999, line 00NN → prefix `+1503999`. Disjoint from every other
 * suite (seed +15551…, clients/campaigns tests +1415999, import +14089990001,
 * count +1212999, create +1312999). afterAll hard-deletes every row in the
 * block; Client→Message and Client→InboundMessage are both onDelete: Cascade,
 * so client deletion sweeps their messages too.
 *
 * Timestamps are passed explicitly (overriding the @default(now())) so ordering
 * is deterministic regardless of test-run wall-clock interleaving.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';

const PHONE_PREFIX = '+1503999';

function phoneFor(lineNN: number): string {
  return `${PHONE_PREFIX}00${String(lineNN).padStart(2, '0')}`;
}

/** Unique-per-test search token baked into lastName so `?search=<token>` scopes
 *  the universe to exactly this test's fixtures. */
function tok(label: string): string {
  return `Zcb${label}`;
}

async function mkClient(phone: string, lastName: string, firstName = 'Conv', createdAt?: Date) {
  return prisma.client.create({
    data: { firstName, lastName, phone, ...(createdAt ? { createdAt } : {}) },
  });
}

async function mkOutbound(clientId: string, content: string, createdAt: Date) {
  return prisma.message.create({
    data: { clientId, content, status: 'DELIVERED', sentAt: createdAt, createdAt },
  });
}

async function mkInbound(clientId: string, body: string, receivedAt: Date) {
  // twilioSid nullable; Postgres unique allows multiple NULLs, so leave it null.
  return prisma.inboundMessage.create({ data: { clientId, body, receivedAt } });
}

/** GET /conversations with auth + optional query params. */
async function getConversations(query: Record<string, string | number> = {}) {
  return request(app).get('/api/messages/conversations').set(await authHeader()).query(query);
}

function indexOfClient(convs: { client: { id: string } }[], id: string): number {
  return convs.findIndex((c) => c.client.id === id);
}

afterAll(async () => {
  // Cascade deletes sweep the Message + InboundMessage rows for these clients.
  await prisma.client.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await prisma.$disconnect();
});

describe('GET /api/messages/conversations', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  it('returns 200 success:true for an authed request (guards route ordering — /:id would 404)', async () => {
    // /conversations must match its own route, not GET /:id. A 404 here means
    // `:id='conversations'` shadowed it. Don't assert a total — the route lists
    // every client in the DB, so the count is environment-dependent.
    const res = await getConversations();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.conversations)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('orders with-message clients by most-recent outbound message (desc): newer B before older A, lastMessage.direction outbound', async () => {
    const label = 'order-out';
    const older = new Date('2025-05-01T10:00:00Z');
    const newer = new Date('2025-05-01T12:00:00Z');

    const a = await mkClient(phoneFor(10), `${tok(label)} A`, 'Ann');
    const b = await mkClient(phoneFor(11), `${tok(label)} B`, 'Ben');
    await mkOutbound(a.id, 'older outbound', older);
    await mkOutbound(b.id, 'newer outbound', newer);

    const res = await getConversations({ search: tok(label), limit: 50 });
    expect(res.status).toBe(200);

    const convs = res.body.data.conversations;
    const idxA = indexOfClient(convs, a.id);
    const idxB = indexOfClient(convs, b.id);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    // B (newer) appears before A (older).
    expect(idxB).toBeLessThan(idxA);

    const bRow = convs[idxB];
    expect(bRow.lastMessage.direction).toBe('outbound');
    expect(bRow.lastMessage.content).toBe('newer outbound');
    expect(bRow.lastMessage.timestamp).toBe(newer.toISOString());
    expect(bRow.outboundCount).toBe(1);
    expect(bRow.inboundCount).toBe(0);
  });

  it('lets an inbound reply beat an older outbound (lastMessage.direction inbound, content from body, inboundCount 1)', async () => {
    const label = 'order-in';
    const oldOut = new Date('2025-05-01T10:00:00Z');
    const newIn = new Date('2025-05-01T12:00:00Z');

    const c = await mkClient(phoneFor(12), tok(label), 'Cara');
    await mkOutbound(c.id, 'older outbound', oldOut);
    await mkInbound(c.id, 'client reply', newIn);

    const res = await getConversations({ search: tok(label), limit: 50 });
    expect(res.status).toBe(200);

    const convs = res.body.data.conversations;
    expect(convs.length).toBe(1);
    const row = convs[0];
    expect(row.client.id).toBe(c.id);
    expect(row.lastMessage.direction).toBe('inbound');
    expect(row.lastMessage.content).toBe('client reply'); // normalized body→content
    expect(row.lastMessage.timestamp).toBe(newIn.toISOString());
    expect(row.outboundCount).toBe(1);
    expect(row.inboundCount).toBe(1);
  });

  it('places zero-message clients after all with-message clients (lastMessage null)', async () => {
    const label = 'order-zero';
    const withTs = new Date('2025-05-01T12:00:00Z');

    const withClient = await mkClient(phoneFor(13), `${tok(label)} E`, 'Eli');
    const zeroClient = await mkClient(phoneFor(14), `${tok(label)} D`, 'Dana');
    await mkOutbound(withClient.id, 'hello', withTs);

    const res = await getConversations({ search: tok(label), limit: 50 });
    expect(res.status).toBe(200);

    const convs = res.body.data.conversations;
    const idxWith = indexOfClient(convs, withClient.id);
    const idxZero = indexOfClient(convs, zeroClient.id);
    expect(idxWith).toBeGreaterThan(-1);
    expect(idxZero).toBeGreaterThan(-1);
    // With-message row precedes the zero-message row.
    expect(idxWith).toBeLessThan(idxZero);

    const zeroRow = convs[idxZero];
    expect(zeroRow.lastMessage).toBeNull();
    expect(zeroRow.outboundCount).toBe(0);
    expect(zeroRow.inboundCount).toBe(0);
  });

  it('paginates across the with/zero boundary: 3 with + 3 zero, limit=2 → p1=2 with, p2=1 with+1 zero, p3=2 zero; total=6 pages=3', async () => {
    const label = 'page';
    // Three with-message clients at 10:00 / 11:00 / 12:00 → desc order W3,W2,W1.
    const w1 = await mkClient(phoneFor(20), `${tok(label)} W1`, 'W1', new Date('2025-05-01T07:00:00Z'));
    const w2 = await mkClient(phoneFor(21), `${tok(label)} W2`, 'W2', new Date('2025-05-01T08:00:00Z'));
    const w3 = await mkClient(phoneFor(22), `${tok(label)} W3`, 'W3', new Date('2025-05-01T09:00:00Z'));
    await mkOutbound(w1.id, 'w1', new Date('2025-05-01T10:00:00Z'));
    await mkOutbound(w2.id, 'w2', new Date('2025-05-01T11:00:00Z'));
    await mkOutbound(w3.id, 'w3', new Date('2025-05-01T12:00:00Z'));
    // Three zero-message clients with createdAt 09:00 / 08:00 / 07:00 → desc Z1,Z2,Z3.
    const z1 = await mkClient(phoneFor(23), `${tok(label)} Z1`, 'Z1', new Date('2025-05-01T09:00:00Z'));
    const z2 = await mkClient(phoneFor(24), `${tok(label)} Z2`, 'Z2', new Date('2025-05-01T08:00:00Z'));
    const z3 = await mkClient(phoneFor(25), `${tok(label)} Z3`, 'Z3', new Date('2025-05-01T07:00:00Z'));

    // Full expected order: W3, W2, W1, Z1, Z2, Z3.
    const p1 = await getConversations({ search: tok(label), page: 1, limit: 2 });
    expect(p1.body.data.pagination).toMatchObject({ total: 6, pages: 3, page: 1 });
    expect(p1.body.data.conversations.map((c: any) => c.client.id)).toEqual([w3.id, w2.id]);

    const p2 = await getConversations({ search: tok(label), page: 2, limit: 2 });
    expect(p2.body.data.conversations.map((c: any) => c.client.id)).toEqual([w1.id, z1.id]);

    const p3 = await getConversations({ search: tok(label), page: 3, limit: 2 });
    expect(p3.body.data.conversations.map((c: any) => c.client.id)).toEqual([z2.id, z3.id]);
  });

  it('filters by client search (?search returns only matches, scoping both with- and zero-message counts)', async () => {
    const label = 'q';
    const hay = await mkClient(phoneFor(30), `${tok(label)} Haystack`, 'Hay');
    const needle = await mkClient(phoneFor(31), `${tok(label)} Needle`, 'Needle');
    await mkOutbound(hay.id, 'hay msg', new Date('2025-05-01T10:00:00Z'));

    // Whole-token search returns both.
    const both = await getConversations({ search: tok(label), limit: 50 });
    expect(both.status).toBe(200);
    expect(both.body.data.conversations.length).toBe(2);
    expect(both.body.data.pagination.total).toBe(2);

    // Substring search returns only the needle.
    const only = await getConversations({ search: 'Needle', limit: 50 });
    expect(only.body.data.conversations.length).toBe(1);
    expect(only.body.data.conversations[0].client.id).toBe(needle.id);
    expect(only.body.data.pagination.total).toBe(1);
  });
});
