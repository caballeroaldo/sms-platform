/**
 * Integration tests for POST /api/campaigns (create)
 *
 * Drives the real Express app via supertest against the developer's local DB
 * (NO worker, NO Twilio — create never enqueues or sends). Locks the create
 * route's validation surface: name presence, scheduleTime-future, MANUAL≥1
 * recipient guard, and the clean-default contracts (audience ALL, status DRAFT
 * vs SCHEDULED, manualRecipientIds coerced to [] for non-MANUAL).
 *
 * Isolation: campaigns are keyed by CUID ids (no phone analog), so campaigns
 * are scoped by a NAME sentinel — every test campaign name startsWith
 * `__campaignsTest__`, which won't collide with seed/real campaigns
 * ("Summer Welcome Series", "July Promo", "Birthday Messages"). afterAll
 * sweeps test campaigns + any test-audience-related messages (create makes
 * none) + the `campaign_created` audit rows the route writes.
 *
 * Note on the audit cleanup: campaigns.ts writes audit `details` via
 * `JSON.stringify({ campaignId, audience })` into a Json column, so it lands
 * as a jsonb STRING value (double-encoded — see Recent Fixes #18). Prisma's
 * path-based Json filters operate on jsonb objects, not a bare string scalar,
 * so the robust scoped match is a raw-SQL `details::text LIKE '%<id>%'` per
 * tracked campaign id. CUIDs are unique, so this never touches another suite's
 * or the live app's audit rows.
 *
 * The `/campaigns/:id/send` route is NOT covered here — it enqueues to BullMQ
 * and calls sendSMS. In the current local env the app is in REAL Twilio mode
 * (TWILIO_ACCOUNT_SID set → isMockMode=false; a truthy 2-char TWILIO_AUTH_TOKEN
 * still satisfies the twilio.ts construction gate → a real client is built),
 * so a send-suite test would fire real (401) Twilio calls via the in-test
 * worker. Suite B is deferred until that's settled. See docs/PROGRESS.md.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';

const SENTINEL = '__campaignsTest__';

/** Unique campaign name per test — keeps the sentinel-prefix sweep complete. */
function nameFor(label: string): string {
  return `${SENTINEL}-${label}`;
}

afterAll(async () => {
  // Collect the campaign ids we created (by sentinel name) BEFORE deleting, so
  // we can scope the audit-row cleanup to exactly those rows.
  const testCampaigns = await prisma.campaign.findMany({
    where: { name: { startsWith: SENTINEL } },
    select: { id: true },
  });
  const testIds = testCampaigns.map((c) => c.id);

  // 1. Delete any messages tied to test campaigns (create makes none, but the
  //    relation filter keeps this cleanup generalizable to later suites). Done
  //    while the campaigns still exist (Message.campaign is onDelete: SetNull;
  //    we want the rows gone, not orphaned).
  await prisma.message.deleteMany({
    where: { campaign: { name: { startsWith: SENTINEL } } },
  });

  // 2. Delete the `campaign_created` audit rows whose details mention a test
  //    campaign id. details is a jsonb string of `JSON.stringify({...})`, so
  //    match via a text cast. Parameterized to avoid injection (ids are CUIDs
  //    anyway).
  const escapedIds = testIds.map((id) => id.replace(/[\\%_]/g, '\\$&'));
  for (const esc of escapedIds) {
    await prisma.$executeRaw`DELETE FROM audit_logs WHERE action = 'campaign_created' AND details::text LIKE ${'%' + esc + '%'} ESCAPE '\\'`;
  }

  // 3. Delete the campaigns themselves by sentinel name.
  await prisma.campaign.deleteMany({
    where: { name: { startsWith: SENTINEL } },
  });

  await prisma.$disconnect();
});

describe('POST /api/campaigns', () => {
  it('creates a campaign from a minimal payload (201) with clean defaults: audience ALL, status DRAFT, empty manualRecipientIds, recurrence NONE, templateId null', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ name: nameFor('minimal') });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(nameFor('minimal'));
    expect(res.body.data.audience).toBe('ALL');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.manualRecipientIds).toEqual([]);
    expect(res.body.data.templateId).toBeNull();

    // Direct DB — lock the full clean-slate contract (mirrors clients.create's
    // tax-field default check): POST owns identity + status selection, and the
    // import/route-owned fields start neutral. The DB defaults (audience ALL,
    // recurrence NONE, manualRecipientIds []) must hold regardless of what the
    // client omitted.
    const row = await prisma.campaign.findUnique({
      where: { id: res.body.data.id },
    });
    expect(row).not.toBeNull();
    expect(row!.audience).toBe('ALL');
    expect(row!.status).toBe('DRAFT');
    expect(row!.manualRecipientIds).toEqual([]);
    expect(row!.recurrence).toBe('NONE');
    expect(row!.templateId).toBeNull();
    expect(row!.scheduleTime).toBeNull();
  });

  it('sets status SCHEDULED (not DRAFT) when a future scheduleTime is provided', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ name: nameFor('scheduled'), scheduleTime: future });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SCHEDULED');
    expect(res.body.data.audience).toBe('ALL'); // default still applies

    const row = await prisma.campaign.findUnique({
      where: { id: res.body.data.id },
      select: { status: true, scheduleTime: true },
    });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('SCHEDULED');
    expect(row!.scheduleTime).not.toBeNull();
    expect(row!.scheduleTime!.toISOString()).toMatch(/T\d{2}:\d{2}:\d{2}/);
  });

  it('persists audience MANUAL + manualRecipientIds when ≥1 id is provided (create does not validate id existence)', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({
        name: nameFor('manual-happy'),
        audience: 'MANUAL',
        manualRecipientIds: ['mf-fixture-001'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.audience).toBe('MANUAL');
    expect(res.body.data.manualRecipientIds).toEqual(['mf-fixture-001']);

    const row = await prisma.campaign.findUnique({
      where: { id: res.body.data.id },
      select: { audience: true, manualRecipientIds: true },
    });
    expect(row).not.toBeNull();
    expect(row!.audience).toBe('MANUAL');
    expect(row!.manualRecipientIds).toEqual(['mf-fixture-001']);
  });

  it('discards manualRecipientIds for a non-MANUAL audience (route forces []) even when junk ids are sent', async () => {
    // campaigns.ts:65 — manualRecipientIds: audience === 'MANUAL' ? ... : []
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({
        name: nameFor('all-discard'),
        audience: 'ALL',
        manualRecipientIds: ['junk-1', 'junk-2'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.audience).toBe('ALL');

    // The HTTP response shape AND the DB row must both have the ids dropped —
    // a later /send resolving this campaign's audience via buildAudienceWhere
    // would otherwise misinterpret the stored ids.
    expect(res.body.data.manualRecipientIds).toEqual([]);
    const row = await prisma.campaign.findUnique({
      where: { id: res.body.data.id },
      select: { audience: true, manualRecipientIds: true },
    });
    expect(row).not.toBeNull();
    expect(row!.manualRecipientIds).toEqual([]);
  });

  it('rejects a missing name → 400 "Campaign name is required", creating no campaign', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ audience: 'ALL' }); // no name

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Campaign name is required/);

    // 400 returns before prisma.campaign.create, so no row is written. There's
    // no name in the payload, so we can't anchor a findFirst absence-check by a
    // unique would-be name like the 400 tests below do; the 400 + error-message
    // assertions prove the guard fired before create, and the no-row-on-reject
    // contract is covered by tests 6–8 (past-schedule / MANUAL-omitted /
    // MANUAL-empty), each of which DOES send a unique name and asserts absence.
  });

  it('rejects a past scheduleTime → 400 "Schedule time must be in the future", creating no campaign', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // -1h
    const wouldBeName = nameFor('past-schedule');
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ name: wouldBeName, scheduleTime: past });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Schedule time must be in the future/);

    // The would-be campaign name is absent — the 400 returned before create.
    const row = await prisma.campaign.findFirst({
      where: { name: wouldBeName },
    });
    expect(row).toBeNull();
  });

  it('rejects MANUAL with no manualRecipientIds → 400 "Manual audience requires at least one recipient"', async () => {
    const wouldBeName = nameFor('manual-missing-ids');
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ name: wouldBeName, audience: 'MANUAL' }); // ids omitted

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Manual audience requires at least one recipient/);

    const row = await prisma.campaign.findFirst({ where: { name: wouldBeName } });
    expect(row).toBeNull();
  });

  it('rejects MANUAL with an empty manualRecipientIds array → 400 (same guard: !Array.isArray || length===0)', async () => {
    const wouldBeName = nameFor('manual-empty-array');
    const res = await request(app)
      .post('/api/campaigns')
      .set(await authHeader())
      .send({ name: wouldBeName, audience: 'MANUAL', manualRecipientIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Manual audience requires at least one recipient/);

    const row = await prisma.campaign.findFirst({ where: { name: wouldBeName } });
    expect(row).toBeNull();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: nameFor('unauth') }); // no Authorization header

    expect(res.status).toBe(401);
  });
});
