/**
 * SMS Platform - Client Routes
 * CRUD operations for clients
 */

import express, { Router, Request, Response } from 'express';
import { clients as db } from '../db/database.js';
import { authenticate } from '../middleware/index.js';
import type { CreateClientInput, ApiResponse } from '../types/index.js';
import { normalizeToE164 } from '../utils/index.js';
import { buildAudienceWhere } from '../utils/audience.js';
import { parseCsvReport } from '../utils/csv.js';
import { AudienceType } from '@prisma/client';
import prisma from '../prisma/client.js';

const router = Router();

// ALL client operations require authentication
router.use(authenticate);

// Helper to extract single string from query params (Express 5 compatible)
function getQueryString(req: Request, key: string): string | undefined {
  const val = req.query[key];
  if (!val) return undefined;
  if (Array.isArray(val)) return String(val[0]);
  if (typeof val === 'object') return undefined;
  return val;
}

/**
 * GET /clients
 * List all clients with pagination and filtering
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(getQueryString(req, 'page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(getQueryString(req, 'limit') || '50', 10)));
    const skip = (page - 1) * limit;
    const search = getQueryString(req, 'search');
    const optedOutParam = getQueryString(req, 'optedOut');

    // Parse optedOut: if param is 'true' show opted-out, if 'false' show opted-in, if undefined show all
    let optedOut: boolean | undefined = undefined;
    if (optedOutParam === 'true') optedOut = true;
    if (optedOutParam === 'false') optedOut = false;

    const result = await db.findMany({ skip, take: limit, search, optedOut });

    res.json({
      success: true,
      data: {
        clients: result.clients,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ success: false, error: 'Failed to list clients' } as ApiResponse);
  }
});

/**
 * POST /clients
 * Create a new client
 * Requires authentication
 */
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const input: CreateClientInput = req.body;

    if (!input.firstName || !input.phone) {
      res.status(400).json({ success: false, error: 'First name and phone are required' } as ApiResponse);
      return;
    }

    let phone: string;
    try {
      phone = normalizeToE164(input.phone);
      if (!phone) throw new Error('Invalid phone number');
    } catch {
      res.status(400).json({ success: false, error: 'Invalid phone number format' } as ApiResponse);
      return;
    }

    const existing = await db.findByPhone(phone);
    if (existing) {
      res.status(409).json({ success: false, error: 'A client with this phone number already exists' } as ApiResponse);
      return;
    }

    const client = await db.create({
      firstName: input.firstName,
      lastName: input.lastName || '',
      phone,
      email: input.email || null,
      birthday: input.birthday || null,
      notes: input.notes,
    });

    res.status(201).json({ success: true, data: client } as ApiResponse);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, error: 'Failed to create client' } as ApiResponse);
  }
});

/**
 * GET /clients/count?audience=ALL|PREV_YEAR_ACTIVE
 * Returns the count of opted-in clients targeted by the given audience.
 * Used by the campaign form to preview audience size before sending.
 * MANUAL is not supported here — the form composes MANUAL counts locally from
 * the picked recipient IDs (which already require a separate client fetch).
 */
router.get('/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const audienceParam = (getQueryString(req, 'audience') ?? 'ALL') as AudienceType;
    if (audienceParam !== 'ALL' && audienceParam !== 'PREV_YEAR_ACTIVE') {
      res.status(400).json({
        success: false,
        error: 'audience must be one of: ALL, PREV_YEAR_ACTIVE',
      } as ApiResponse);
      return;
    }
    const where = buildAudienceWhere(audienceParam);
    const count = await prisma.client.count({ where });
    res.json({ success: true, data: { count, audience: audienceParam } } as ApiResponse);
  } catch (error) {
    console.error('Count clients error:', error);
    res.status(500).json({ success: false, error: 'Failed to count clients' } as ApiResponse);
  }
});

/**
 * POST /clients/import
 * Bulk-import clients from a periodic tax-season CSV report (see utils/csv.ts
 * for the expected envelope + column mapping). The same file shape is uploaded
 * repeatedly throughout a season, so the route is idempotent on phone:
 *
 *   - New phone  → create the client (identity + tax fields).
 *   - Known phone → refresh ONLY the tax-season fields (taxFiledDate,
 *                  taxReturnType, taxpayerStatus, inactive, clientLY,
 *                  clientNew). Identity (name/phone/email/birthday/notes) and
 *                  the legal optedOut flag are never overwritten by an import.
 *   - Malformed/identity-missing rows from the parser → reported in `skipped`
 *                  with a reason; they never reach the DB.
 *
 * Body is the raw CSV text (Content-Type: text/csv or text/plain). We use a
 * route-scoped express.text() parser — the global json() body parser next()s
 * past non-JSON payloads and leaves the stream untouched. No multipart/file
 * upload handling (no multer dep); the frontend reads the File via file.text().
 *
 * Mounted BEFORE the /:id routes so "/import" isn't captured by "/:id".
 */
router.post(
  '/import',
  authenticate,
  express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'string' || body.trim() === '') {
        res.status(400).json({ success: false, error: 'Request body must be a non-empty CSV string' } as ApiResponse);
        return;
      }

      const parsed = parseCsvReport(body);

      let created = 0;
      let existing = 0;
      const errors: { lineNumber: number; reason: string; phone?: string }[] = [];

      for (const row of parsed.rows) {
        try {
          const found = await prisma.client.findUnique({ where: { phone: row.phone } });
          if (found) {
            // Refresh only the tax-season fields. Identity + optedOut are
            // owned by the operator, not by the periodic tax report.
            await prisma.client.update({
              where: { id: found.id },
              data: {
                taxFiledDate: row.taxFiledDate,
                taxReturnType: row.taxReturnType,
                taxpayerStatus: row.taxpayerStatus,
                inactive: row.inactive,
                clientLY: row.clientLY,
                clientNew: row.clientNew,
              },
            });
            existing++;
          } else {
            await prisma.client.create({
              data: {
                firstName: row.firstName,
                lastName: row.lastName,
                phone: row.phone,
                birthday: row.birthday,
                taxFiledDate: row.taxFiledDate,
                taxReturnType: row.taxReturnType,
                taxpayerStatus: row.taxpayerStatus,
                inactive: row.inactive,
                clientLY: row.clientLY,
                clientNew: row.clientNew,
              },
            });
            created++;
          }
        } catch (err) {
          // P2002 = unique-constraint violation. The CSV could carry a
          // duplicate phone within the same file (two rows, same number) — the
          // first creates, the second loses the findUnique race and throws
          // P2002. Treat as "already known" rather than an error.
          if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
            existing++;
            continue;
          }
          errors.push({
            lineNumber: row.lineNumber,
            reason: err instanceof Error ? err.message : 'Failed to upsert row',
            phone: row.phone,
          });
        }
      }

      // Surface parser-level skips too, so the operator sees every dropped row.
      const skipped = parsed.skipped.map((s) => ({
        lineNumber: s.lineNumber,
        reason: s.reason,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone,
      }));

      // Pass details as a plain object (NOT JSON.stringify) so Postgres stores
      // a proper jsonb object — else the value is a double-encoded jsonb string
      // and `details->>'created'` returns NULL. (Some older routes stringify;
      // new code passes the object directly, matching the seed.)
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actor: req.user!.email,
          action: 'clients_imported',
          details: {
            created,
            existing,
            skipped: skipped.length,
            errors: errors.length,
            totalRows: parsed.totalDataRows,
            asOf: parsed.asOf,
          },
          ipAddress: req.ip,
        },
      });

      res.json({
        success: true,
        data: {
          created,
          existing,
          skipped,
          errors,
          totalRows: parsed.totalDataRows,
          asOf: parsed.asOf,
        },
      } as ApiResponse);
    } catch (error) {
      console.error('Import clients error:', error);
      res.status(500).json({ success: false, error: 'Failed to import clients' } as ApiResponse);
    }
  },
);

/**
 * GET /clients/:id
 * Get client by ID
 * PUBLIC - No auth required
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const client = await db.findUnique(id);

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: client } as ApiResponse);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ success: false, error: 'Failed to get client' } as ApiResponse);
  }
});

/**
 * PUT /clients/:id
 * Update client - Requires authentication
 */
router.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const input = req.body;

    const existing = await db.findUnique(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    // If phone is being updated, validate and check for duplicates
    if (input.phone && input.phone !== existing.phone) {
      let phone: string;
      try {
        phone = normalizeToE164(input.phone);
        if (!phone) throw new Error('Invalid phone number');
      } catch {
        res.status(400).json({ success: false, error: 'Invalid phone number format' } as ApiResponse);
        return;
      }
      input.phone = phone;

      const existingPhone = await db.findByPhone(phone);
      if (existingPhone && existingPhone.id !== id) {
        res.status(409).json({ success: false, error: 'A client with this phone number already exists' } as ApiResponse);
        return;
      }
    }

    const updated = await db.update(id, {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      birthday: input.birthday,
      notes: input.notes,
    });

    res.json({ success: true, data: updated } as ApiResponse);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, error: 'Failed to update client' } as ApiResponse);
  }
});

/**
 * DELETE /clients/:id
 * Soft delete (opt-out for compliance) - Requires authentication
 */
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const client = await db.findUnique(id);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    if (client.optedOut) {
      res.status(400).json({ success: false, error: 'Client is already opted out' } as ApiResponse);
      return;
    }

    const deleted = await db.delete(id);
    res.json({ success: true, data: deleted, message: 'Client opted out successfully' } as ApiResponse);
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, error: 'Failed to opt out client' } as ApiResponse);
  }
});

export default router;