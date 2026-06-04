/**
 * SMS Platform - Client Routes
 * CRUD operations for clients
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { CreateClientInput, UpdateClientInput, ApiResponse } from '../types/index.js';
import { normalizeToE164 } from '../utils/index.js';

const router = Router();

// Helper to extract single string from query params (Express 5 compatible)
function getQueryString(req: Request, key: string): string | undefined {
  const val = req.query[key];
  if (!val) return undefined;
  if (Array.isArray(val)) return String(val[0]);
  if (typeof val === 'object') return undefined;
  return val;
}

// All routes require authentication
router.use(authenticate);

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
    const optedOut = getQueryString(req, 'optedOut');
    const hasBirthday = getQueryString(req, 'hasBirthday');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (optedOut !== undefined) {
      where.optedOut = optedOut === 'true';
    }

    if (hasBirthday === 'true') {
      where.birthday = { not: null };
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              outboundMessages: true,
              inboundMessages: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
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
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
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

    const existing = await prisma.client.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ success: false, error: 'A client with this phone number already exists' } as ApiResponse);
      return;
    }

    const client = await prisma.client.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName || '',
        phone,
        email: input.email || null,
        birthday: input.birthday,
        notes: input.notes,
        optedOut: input.optedOut ?? false,
        consents: {
          create: { consentType: 'SMS', source: 'manual_entry' },
        },
      },
      include: { consents: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        clientId: client.id,
        actor: req.user!.email,
        action: 'client_created',
        details: { clientId: client.id },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ success: true, data: client } as ApiResponse);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, error: 'Failed to create client' } as ApiResponse);
  }
});

/**
 * GET /clients/:id
 * Get client by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        consents: { orderBy: { timestamp: 'desc' } },
        outboundMessages: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { id: true, content: true, status: true, sentAt: true, createdAt: true },
        },
        inboundMessages: { take: 10, orderBy: { receivedAt: 'desc' } },
      },
    });

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
 * Update client
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const input: UpdateClientInput = req.body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    let phone = existing.phone;
    if (input.phone && input.phone !== existing.phone) {
      try {
        phone = normalizeToE164(input.phone);
        if (!phone) throw new Error('Invalid phone');
        const duplicate = await prisma.client.findUnique({ where: { phone } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, error: 'A client with this phone number already exists' } as ApiResponse);
          return;
        }
      } catch {
        res.status(400).json({ success: false, error: 'Invalid phone number format' } as ApiResponse);
        return;
      }
    }

    if (input.optedOut !== undefined && input.optedOut !== existing.optedOut) {
      await prisma.consent.create({
        data: { clientId: id, consentType: 'SMS', source: input.optedOut ? 'opt_out' : 'opt_in' },
      });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName ?? existing.lastName,
        phone,
        email: input.email ?? existing.email,
        birthday: input.birthday !== undefined ? input.birthday : existing.birthday,
        notes: input.notes ?? existing.notes,
        optedOut: input.optedOut ?? existing.optedOut,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        clientId: id,
        actor: req.user!.email,
        action: input.optedOut ? 'client_opted_out' : 'client_updated',
        details: { changes: input },
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, data: client } as ApiResponse);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, error: 'Failed to update client' } as ApiResponse);
  }
});

/**
 * DELETE /clients/:id
 * Soft delete (opt-out for compliance)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    await prisma.client.update({
      where: { id },
      data: {
        optedOut: true,
        notes: `[Deleted by ${req.user!.email} on ${new Date().toISOString()}] ${client.notes || ''}`,
      },
    });

    await prisma.consent.create({
      data: { clientId: id, consentType: 'SMS', source: 'deleted' },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        clientId: id,
        actor: req.user!.email,
        action: 'client_deleted',
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: 'Client deleted (opted out for compliance)' } as ApiResponse);
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete client' } as ApiResponse);
  }
});

export default router;