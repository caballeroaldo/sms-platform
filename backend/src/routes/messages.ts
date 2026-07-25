/**
 * SMS Platform - Message Routes
 * POST /messages/send-now
 * POST /messages/schedule
 * GET /messages
 * GET /messages/:id
 * GET /messages/client/:clientId  - Get messages for a specific client
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
    const clientName = query.search as string | undefined;
    const direction = query.direction as string | undefined; // 'inbound' or 'outbound'

    // Build filter params
    const filters: any = {};
    if (clientId) filters.clientId = clientId;
    if (status) filters.status = status;
    if (clientName) filters.clientName = clientName;
    if (direction) filters.direction = direction;

    // Use Prisma for real database
    const [messages, total] = await Promise.all([
      dbMessages.findAll({ skip, take: limit, orderBy: 'desc', where: filters }),
      dbMessages.count(filters),
    ]);

    // Fetch client data for each message
    const messagesWithClients = await Promise.all(
      messages.map(async (m) => {
        const client = await dbClients.findUnique(m.clientId);
        return {
          id: m.id,
          clientId: m.clientId,
          campaignId: m.campaignId,
          content: m.content,
          status: m.status,
          sentAt: m.sentAt,
          deliveredAt: m.deliveredAt,
          createdAt: m.createdAt,
          client: client ? {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            phone: client.phone,
          } : null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        messages: messagesWithClients,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to list messages' } as ApiResponse);
  }
});

/**
 * GET /messages/client/:clientId
 * Get messages for a specific client (for chat/conversation view)
 */
router.get('/client/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = String(req.params.clientId);

    const outbound = await dbMessages.findByClient(clientId);

    // Also get inbound messages for this client
    const inbound = await dbMessages.findByClientInbound(clientId);

    // Combine and sort by date (inbound uses receivedAt, outbound uses createdAt)
    const outboundWithDate = outbound.map((m: any) => ({
      ...m,
      direction: 'outbound' as const,
      createdAt: m.createdAt
    }));
    const inboundWithDate = inbound.map((m: any) => ({
      ...m,
      direction: 'inbound' as const,
      createdAt: m.receivedAt
    }));

    const allMessages = [...outboundWithDate, ...inboundWithDate].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json({
      success: true,
      data: allMessages,
    } as ApiResponse);
  } catch (error) {
    console.error('Get client messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get client messages' } as ApiResponse);
  }
});

/**
 * GET /messages/:id
 * Get a specific message
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const message = await dbMessages.findById(id);

    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        id: message.id,
        clientId: message.clientId,
        campaignId: message.campaignId,
        content: message.content,
        status: message.status,
        twilioSid: message.twilioSid,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        errorMessage: message.errorMessage,
        createdAt: message.createdAt,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ success: false, error: 'Failed to get message' } as ApiResponse);
  }
});

export default router;