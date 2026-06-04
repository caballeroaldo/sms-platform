/**
 * SMS Platform - Message Routes
 * POST /messages/send-now
 * POST /messages/schedule
 * GET /messages
 * GET /messages/:id
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
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

    const clients = await prisma.client.findMany({
      where: { id: { in: input.clientIds }, optedOut: false },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });

    if (clients.length === 0) {
      res.status(400).json({ success: false, error: 'No opted-in clients found' } as ApiResponse);
      return;
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const client of clients) {
      try {
        const message = await prisma.message.create({
          data: { clientId: client.id, campaignId: input.campaignId, content: input.content, status: 'PENDING' },
        });

        const result = await sendSMS(client.phone, input.content);

        if (result.success) {
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'SENT', twilioSid: result.sid, sentAt: new Date() },
          });
          results.sent++;
        } else {
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'FAILED', errorMessage: result.error },
          });
          results.failed++;
          results.errors.push(`${client.firstName}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${client.firstName}: ${(error as Error).message}`);
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        actor: req.user!.email,
        action: 'bulk_sms_sent',
        details: { clientCount: clients.length, sent: results.sent, failed: results.failed },
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, data: { ...results, errors: results.errors.length > 0 ? results.errors : undefined } } as ApiResponse);
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

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, optedOut: true } });
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' } as ApiResponse);
      return;
    }

    if (client.optedOut) {
      res.status(400).json({ success: false, error: 'Cannot schedule message for opted-out client' } as ApiResponse);
      return;
    }

    const message = await prisma.message.create({
      data: { clientId: client.id, campaignId, content, status: 'PENDING', scheduledAt: new Date(scheduledAt) },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        clientId: client.id,
        actor: req.user!.email,
        action: 'message_scheduled',
        details: { messageId: message.id, scheduledAt },
        ipAddress: req.ip,
      },
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

    const where: Record<string, unknown> = {};
    const status = query.status;
    if (status && !Array.isArray(status)) where.status = status;

    for (const key of ['status', 'clientId', 'campaignId'] as const) {
      const val = query[key];
      if (val && !Array.isArray(val)) {
        where[key] = val;
      }
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      success: true,
      data: { messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
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

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: message } as ApiResponse);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ success: false, error: 'Failed to get message' } as ApiResponse);
  }
});

export default router;