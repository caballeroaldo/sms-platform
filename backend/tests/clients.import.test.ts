/**
 * Integration tests for POST /api/clients/import
 *
 * Drives the real Express app via supertest against the developer's local DB
 * (no worker, no Twilio, no real SMS — imports never enqueue messages). Tests
 * are ordered: the first creates the test client, subsequent ones exercise the
 * re-import / refresh paths on the same phone, and afterAll removes every row
 * the suite touched (client + the 'clients_imported' audit rows).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { request, app, authHeader } from './setup.js';
import prisma from '../src/prisma/client.js';

// Distinctive test constants: the phone won't collide with the seeded clients
// (seed uses +15551001001..6) and uses a REAL US area code — normalizeToE164
// validates the NPA and rejects reserved ranges like 555 (the seed bypasses
// normalization by inserting raw E.164). 408 is a valid NPA. The asOf marker
// makes audit-row cleanup a single targeted delete.
const TEST_PHONE = '+14089990001';
const TEST_AOF = 'TEST-ASOF-CSV';
const HEADER =
  'Taxpayer First Name,Taxpayer Last Name,Phone Number,Taxpayer Date of Birth,Date Changed,Return Type,Taxpayer Status,Client Inactive,Client LY,Client New';

/** Build a report-shaped CSV (envelope + header + rows) around raw data rows. */
function wrapCsv(rows: string[], asOf: string = TEST_AOF): string {
  return ['SMS Platform Client List,,,,,,,,,', `As of ${asOf},,,,,,,,,`, HEADER, ...rows].join(
    '\n',
  );
}

afterAll(async () => {
  // Leave the dev DB exactly as we found it.
  await prisma.client.deleteMany({ where: { phone: TEST_PHONE } });
  await prisma.auditLog.deleteMany({
    where: { action: 'clients_imported', details: { path: ['asOf'], equals: TEST_AOF } },
  });
  await prisma.$disconnect();
});

describe('POST /api/clients/import', () => {
  it('creates a new client, reports skipped rows, and captures the report asOf', async () => {
    const csv = wrapCsv([
      'Import,Tester,4089990001,03/15/1990,01/10/2026,1040,EF Accepted,No,Yes,No', // valid
      ',,,,,,,,,', // blank -> skipped (identity missing)
    ]);

    const res = await request(app)
      .post('/api/clients/import')
      .set(await authHeader())
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.errors).toHaveLength(0);
    expect(res.body.data.totalRows).toBe(2);
    expect(res.body.data.asOf).toBe(TEST_AOF);
  });

  it('is idempotent — re-importing the same phone does not create a duplicate', async () => {
    const csv = wrapCsv(['Import,Tester,4089990001,03/15/1990,01/10/2026,1040,EF Accepted,No,Yes,No']);

    const res = await request(app)
      .post('/api/clients/import')
      .set(await authHeader())
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.existing).toBe(1);
  });

  it('refreshes ONLY tax fields — identity (name) is never clobbered by an import', async () => {
    // Same phone, CHANGED first name + refreshed tax-season fields.
    const csv = wrapCsv([
      'CHANGED-NAME,Fake,4089990001,03/15/1990,02/20/2026,1040SR,EF Ext Accepted,No,Yes,No',
    ]);

    const res = await request(app)
      .post('/api/clients/import')
      .set(await authHeader())
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.existing).toBe(1);

    // Direct DB check — the contract: name preserved, tax fields refreshed.
    const row = await prisma.client.findUnique({ where: { phone: TEST_PHONE } });
    expect(row).not.toBeNull();
    expect(row!.firstName).toBe('Import'); // NOT "CHANGED-NAME"
    expect(row!.taxFiledDate).not.toBeNull();
    expect(row!.taxFiledDate!.getUTCMonth()).toBe(1); // Feb (0-indexed) — refreshed from Jan
    expect(row!.taxReturnType).toBe('1040SR'); // refreshed (was 1040)
    expect(row!.taxpayerStatus).toBe('EF Ext Accepted'); // refreshed
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(app)
      .post('/api/clients/import')
      .set(await authHeader())
      .set('Content-Type', 'text/csv')
      .send('');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const csv = wrapCsv([
      'Import,Tester,4089990001,03/15/1990,01/10/2026,1040,EF Accepted,No,Yes,No',
    ]);

    const res = await request(app)
      .post('/api/clients/import')
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(401);
  });
});
