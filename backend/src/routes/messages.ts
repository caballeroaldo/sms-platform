/**
 * SMS Platform - Message Routes
 * POST /messages/send-now
 * POST /messages/schedule
 * GET /messages
 * GET /messages/:id
 */

import { Router, Request, Response } from 'express';
import { clients as dbClients, messages as dbMessages } from '../db/database.js';
import { authenticate } from '../middleware/index.js';
import { SendBulkMessageInput, ApiResponse } from '../types/index.js';
import { sendSMS } from '../services/twilio.js';

const router = Router();

router.use(authenticate);

/**
 * POST /messages/send-now
 * Send an SMS immediately to one or more clients
 */
router.post('/send-now', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: SendBulkMessageInput = req.body;

    if (!input.clientIds || input.clientIds.length === 0) {
      res.status(400).json({ success: false, error: 'At least one client ID is required' } as ApiResponse);
      return;
    }

    if (!input.content?.trim()) {
      res.status(400).json({ success: false, error: 'Message content is required' } as ApiResponse);
      return;
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    // Process each client
    for (const clientId of input.clientIds) {
      try {
        const client = await dbClients.findUnique(clientId);
        if (!client) {
          results.failed++;
          results.errors.push(`Client ${clientId}: not found`);
          continue;
        }

        if (client.optedOut) {
          results.failed++;
          results.errors.push(`${client.firstName}: opted out`);
          continue;
        }

        // Send via Twilio (or mock if no credentials)
        const result = await sendSMS(client.phone, input.content);

        // Create message record
        const message = await dbMessages.create({
          clientId,
          content: input.content,
          status: result.success ? 'DELIVERED' : 'FAILED',
          campaignId: input.campaignId,
        });

        // Update with Twilio SID if successful
        if (result.success) {
          await dbMessages.update(message.id, {
            status: 'DELIVERED',
            twilioSid: result.sid || `mock-${Date.now()}`,
            sentAt: new Date(),
          });
          results.sent++;
        } else {
          await dbMessages.update(message.id, {
            status: 'FAILED',
            errorMessage: result.error || 'Unknown error',
          });
          results.failed++;
          results.errors.push(`${client.firstName}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${clientId}: ${(error as Error).message}`);
      }
    }

    res.json({
      success: true,
      data: { ...results, errors: results.errors.length > 0 ? results.errors : undefined }
    } as ApiResponse);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' } as ApiResponse);
  }
});

/**
 * POST /messages/schedule
 * Schedule a message for future delivery
 */
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, content, campaignId, scheduledAt } = req.body;

    if (!clientId) {
      res.status(400).json({ success: false, error: 'Client ID is required' } as ApiResponse);
      return;
    }

    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      res.status(400).json({ success: false, error: 'Scheduled time must be in the future' } as ApiResponse);
      return;
    }

    const client = await dbClients.findUnique(clientId);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    if (client.optedOut) {
      res.status(400).json({ success: false, error: 'Cannot schedule message for opted-out client' } as ApiResponse);
      return;
    }

    const message = await dbMessages.create({
      clientId,
      content,
      status: 'PENDING',
      campaignId,
    });

    res.status(201).json({ success: true, data: message } as ApiResponse);
  } catch (error) {
    console.error('Schedule message error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule message' } as ApiResponse);
  }
});

/**
 * GET /messages
 * List messages with pagination and filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as Record<string, string | string[] | undefined>;
    const page = Math.max(1, parseInt(String(query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const clientId = query.clientId as string | undefined;
    const status = query.status as string | undefined;

    // Get messages for a specific client if provided
    if (clientId) {
      const messages = await dbMessages.findByClient(clientId);
      res.json({
        success: true,
        data: {
          messages: messages.slice(skip, skip + limit),
          pagination: {
            page,
            limit,
            total: messages.length,
            pages: Math.ceil(messages.length / limit),
          },
        },
      } as ApiResponse);
      return;
    }

    // For mock mode, return all messages
    const { mockDb } = await import('../db/mockDatabase.js');
    const allMessages = Array.from(mockDb.messages.values()).map(m => ({
      id: m.id,
      clientId: m.clientId,
      content: m.content,
      status: m.status,
      sentAt: m.sentAt?.toISOString() || null,
      createdAt: m.createdAt.toISOString(),
      client: () => {
        const client = mockDb.clients.get(m.clientId);
        return client ? { id: client.id, firstName: client.firstName, lastName: client.lastName, phone: client.phone } : undefined;
      },
    }));

    res.json({
      success: true,
      data: {
        messages: allMessages.slice(skip, skip + limit),
        pagination: {
          page,
          limit,
          total: allMessages.length,
          pages: Math.ceil(allMessages.length / limit),
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to list messages' } as ApiResponse);
  }
});

/**
 * GET /messages/:id
 * Get a specific message
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { mockDb } = await import('../db/mockDatabase.js');
    const message = mockDb.messages.get(id);

    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' } as ApiResponse);
      return;
    }

    const client = mockDb.clients.get(message.clientId);
    res.json({
      success: true,
      data: {
        id: message.id,
        clientId: message.clientId,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        client: client ? { id: client.id, firstName: client.firstName, lastName: client.lastName, phone: client.phone } : undefined,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ success: false, error: 'Failed to get message' } as ApiResponse);
  }
});

export default router;