/**
 * SMS Platform - Message Routes
 * POST /messages/send-now
 * POST /messages/schedule
 * GET /messages
 * GET /messages/conversations  - Aggregate per-client conversation summaries
 * GET /messages/:id
 * GET /messages/client/:clientId  - Get messages for a specific client
 */

import { Router, Request, Response } from 'express';
import { clients as dbClients, messages as dbMessages } from '../db/database.js';
import { authenticate } from '../middleware/index.js';
import { SendBulkMessageInput, ApiResponse } from '../types/index.js';
import { sendSMS } from '../services/twilio.js';
// Direct prisma client for the conversations aggregate (groupBy + distinct findMany),
// matching the groupBy precedent in routes/campaigns.ts. Read-only here.
import prisma from '../prisma/client.js';

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
      content: m.content,
      type: 'outbound' as const,
      direction: 'outbound' as const,
      createdAt: m.createdAt
    }));
    const inboundWithDate = inbound.map((m: any) => ({
      ...m,
      // InboundMessage keeps its text in `body`, not `content`; normalize so the
      // frontend's Message.content renders the bubble text (previously `...m`
      // spread `body` alongside an undefined `content` → empty inbound bubbles).
      // Set type so getMessageType routes inbound to the left bubble; carry the
      // Message-shape fields (status/campaignId) the frontend type expects.
      content: m.body,
      type: 'inbound' as const,
      direction: 'inbound' as const,
      status: null,
      campaignId: null,
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
 * GET /messages/conversations
 * Aggregate a per-client conversation summary: ALL clients, with-message ones
 * first (ordered by most-recent outbound OR inbound message timestamp, desc),
 * zero-message clients after (ordered by createdAt desc) so new chats can be
 * started with anyone. Read-only — no enqueue, no sendSMS — safe in real-Twilio
 * mode.
 *
 * ROUTE ORDER: this route MUST precede `GET /:id` below, which is a
 * single-segment catch-all that would otherwise shadow `/conversations` as
 * `:id = 'conversations'` → 404 "Message not found".
 */
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as Record<string, string | string[] | undefined>;
    const page = Math.max(1, parseInt(String(query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '50'), 10)));
    const search = (query.search as string | undefined)?.trim() || undefined;
    const skip = (page - 1) * limit;

    // Optional client search — mirrors the clients.findMany Prisma `where` in
    // db/database.ts (name/phone/email, insensitive contains).
    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Step 1 — per-client "most-recent message" across BOTH tables (one row per
    // distinct clientId via groupBy; bounded by client count, not message count).
    const [outboundAgg, inboundAgg] = await Promise.all([
      prisma.message.groupBy({ by: ['clientId'], _max: { createdAt: true } }),
      prisma.inboundMessage.groupBy({ by: ['clientId'], _max: { receivedAt: true } }),
    ]);

    // summary: clientId -> lastAt (max of the two tables). createdAt/receivedAt
    // are @default(now()), so every client with a message has a real Date.
    const summary = new Map<string, Date>();
    for (const r of outboundAgg) {
      if (r._max.createdAt) summary.set(r.clientId, r._max.createdAt);
    }
    for (const r of inboundAgg) {
      const inAt = r._max.receivedAt;
      if (!inAt) continue;
      const existing = summary.get(r.clientId);
      // Strict `>`: a tie leaves outbound as the "last" direction (consistent
      // with the latest-message merge below).
      if (!existing || inAt.getTime() > existing.getTime()) summary.set(r.clientId, inAt);
    }
    const msgIds = Array.from(summary.keys()); // clients that have ≥1 message

    // Step 2 — counts (with-message + zero-message), honoring the search filter.
    const matchedWithRows = await prisma.client.findMany({
      where: { ...where, id: { in: msgIds } },
      select: { id: true },
    });
    const matchedWithIds = matchedWithRows.map((c) => c.id);
    matchedWithIds.sort((a, b) => {
      const ta = summary.get(a)?.getTime() ?? 0;
      const tb = summary.get(b)?.getTime() ?? 0;
      return tb - ta; // most-recent first
    });
    const withCount = matchedWithIds.length;

    const withoutCount = await prisma.client.count({
      where: { ...where, id: { notIn: msgIds } },
    });
    const total = withCount + withoutCount;
    const pages = Math.max(1, Math.ceil(total / limit));

    // Step 3 — slice the page across the with/zero boundary: with-message clients
    // fill the page first (still sorted by lastAt desc), then backfill with
    // zero-message clients (createdAt desc) if the page extends past them.
    const pageWithIds: string[] = [];
    const pageZeroIds: string[] = [];

    if (skip < withCount) {
      const takeWith = Math.min(limit, withCount - skip);
      pageWithIds.push(...matchedWithIds.slice(skip, skip + takeWith));
      const remaining = limit - takeWith;
      if (remaining > 0) {
        const zeroRows = await prisma.client.findMany({
          where: { ...where, id: { notIn: msgIds } },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: remaining,
          select: { id: true },
        });
        pageZeroIds.push(...zeroRows.map((c) => c.id));
      }
    } else {
      const zeroSkip = skip - withCount;
      const zeroRows = await prisma.client.findMany({
        where: { ...where, id: { notIn: msgIds } },
        orderBy: { createdAt: 'desc' },
        skip: zeroSkip,
        take: limit,
        select: { id: true },
      });
      pageZeroIds.push(...zeroRows.map((c) => c.id));
    }

    // Step 4 — fetch full client rows for the page, then re-sort to our id order
    // (findMany doesn't preserve the arbitrary `in` order).
    const pageIds = [...pageWithIds, ...pageZeroIds];
    const pageClients = pageIds.length
      ? await prisma.client.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true, firstName: true, lastName: true, phone: true, optedOut: true,
            _count: { select: { outboundMessages: true, inboundMessages: true } },
          },
        })
      : [];
    const order = new Map(pageIds.map((id, i) => [id, i]));
    pageClients.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    // Step 5 — single latest message per with-message page client: `distinct` +
    // `orderBy: desc` yields the top row per group, two queries (one per table).
    const idsWithMsg = pageClients.filter((c) => summary.has(c.id)).map((c) => c.id);
    const latestByClient = new Map<string, { content: string; direction: 'outbound' | 'inbound'; timestamp: string }>();
    if (idsWithMsg.length) {
      const [latestOut, latestIn] = await Promise.all([
        prisma.message.findMany({
          where: { clientId: { in: idsWithMsg } },
          distinct: ['clientId'],
          orderBy: { createdAt: 'desc' },
          select: { clientId: true, content: true, createdAt: true },
        }),
        prisma.inboundMessage.findMany({
          where: { clientId: { in: idsWithMsg } },
          distinct: ['clientId'],
          orderBy: { receivedAt: 'desc' },
          select: { clientId: true, body: true, receivedAt: true },
        }),
      ]);
      for (const m of latestOut) {
        latestByClient.set(m.clientId, {
          content: m.content,
          direction: 'outbound',
          timestamp: m.createdAt.toISOString(),
        });
      }
      for (const m of latestIn) {
        const existing = latestByClient.get(m.clientId);
        const outAt = existing ? new Date(existing.timestamp).getTime() : -Infinity;
        const inTime = m.receivedAt.getTime();
        // Strict `>` matches the summary tie-break (tie → outbound).
        if (inTime > outAt) {
          latestByClient.set(m.clientId, {
            content: m.body,
            direction: 'inbound',
            timestamp: m.receivedAt.toISOString(),
          });
        }
      }
    }

    const conversations = pageClients.map((c) => ({
      client: {
        id: c.id, firstName: c.firstName, lastName: c.lastName,
        phone: c.phone, optedOut: c.optedOut,
      },
      lastMessage: summary.has(c.id) ? (latestByClient.get(c.id) ?? null) : null,
      outboundCount: c._count.outboundMessages,
      inboundCount: c._count.inboundMessages,
    }));

    res.json({
      success: true,
      data: {
        conversations,
        pagination: { page, limit, total, pages },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversations' } as ApiResponse);
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