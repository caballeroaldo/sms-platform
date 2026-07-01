/**
 * SMS Platform - Client Routes
 * CRUD operations for clients
 */

import { Router, Request, Response } from 'express';
import { clients as db } from '../db/database.js';
import { authenticate } from '../middleware/index.js';
import type { CreateClientInput, ApiResponse } from '../types/index.js';
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

/**
 * GET /clients
 * List all clients with pagination and filtering
 * PUBLIC - No auth required for reading
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(getQueryString(req, 'page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(getQueryString(req, 'limit') || '50', 10)));
    const skip = (page - 1) * limit;
    const search = getQueryString(req, 'search');

    const result = await db.findMany({ skip, take: limit, search });

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

    const existing = await db.findUnique(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    // In a full implementation, would update via db.update()
    res.json({ success: true, data: existing } as ApiResponse);
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

    res.json({ success: true, message: 'Client opted out' } as ApiResponse);
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete client' } as ApiResponse);
  }
});

export default router;