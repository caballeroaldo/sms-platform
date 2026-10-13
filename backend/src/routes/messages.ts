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
import { sendSMS } from '../services/sms.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest, schemas } from '../utils/validateRequest.js';
import { formatResponse } from '../utils/formatResponse.js';
// Direct prisma client for the conversations aggregate (groupBy + distinct findMany),
// matching the groupBy precedent in routes/campaigns.ts. Read-only here.
import prisma from '../prisma/client.js';

const router = Router();

router.use(authenticate);

/**
 * POST /messages/send-now
 * Send an SMS immediately to one or more clients
 */
router.post('/send-now', authenticate, validateRequest(schemas.sendBulkMessage), asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as SendBulkMessageInput;

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

  return formatResponse.success(res, {
    ...results,
    errors: results.errors.length > 0 ? results.errors : undefined
  });
}));

/**
 * POST /messages/schedule
 * Schedule a message for future delivery
 */
router.post('/schedule', authenticate, validateRequest(schemas.scheduleMessage), asyncHandler(async (req: Request, res: Response) => {
  const { clientId, content, campaignId, scheduledAt } = req.body;

  const client = await dbClients.findUnique(clientId);
  if (!client) {
    return formatResponse.notFound(res, 'Client not found');
  }

  if (client.optedOut) {
    return formatResponse.error(res, 'Cannot schedule message for opted-out client', 400);
  }

  const message = await dbMessages.create({
    clientId,
    content,
    status: 'PENDING',
    campaignId,
  });

  return formatResponse.success(res, message, 201);
}));

/**
 * GET /messages
 * List messages with pagination and filters
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
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

  return formatResponse.success(res, {
    messages: messagesWithClients,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

/**
 * GET /messages/client/:clientId
 * Get messages for a specific client (for chat/conversation view)
 */
router.get('/client/:clientId', asyncHandler(async (req: Request, res: Response) => {
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

  return formatResponse.success(res, allMessages);
}));

/**
 * GET /messages/conversations
 * Aggregate a per-client conversation summary: ALL clients, with-message ones
 * first (ordered by most-recent outbound OR inbound message timestamp, desc),
 * zero-message clients after (ordered by createdAt desc) so new chats can be
 * started with anyone. Read-only — no enqueue, no sendSMS — safe in real-Twilio
 * mode.
 *
 * ROUTE ORDER: this route MUST precede `GET /:id` below, which is
 * a single-segment catch-all that would otherwise shadow `/conversations` as
 * `:id = 'conversations'` → 404 "Message not found".
 */
router.get('/conversations', asyncHandler(async (req: Request, res: Response) => {
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

  // STEP 1: Get the base client list (matching how clients page works)
  const [baseClients, baseTotal] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: 'desc' }, // Match clients page ordering
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        optedOut: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  if (baseClients.length === 0) {
    // No clients match the filter
    return formatResponse.success(res, {
      conversations: [],
      pagination: { page, limit, total: 0, pages: 1 },
    });
  }

  // STEP 2: Build message lookup maps from BOTH tables (outbound + inbound)
  const [outboundMsgs, inboundMsgs] = await Promise.all([
    prisma.message.findMany({
      where: { clientId: { in: baseClients.map(c => c.id) } },
      select: {
        clientId: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inboundMessage.findMany({
      where: { clientId: { in: baseClients.map(c => c.id) } },
      select: {
        clientId: true,
        body: true,
        receivedAt: true,
      },
      orderBy: { receivedAt: 'desc' },
    }),
  ]);

  // Build latest message per client (most recent across both tables)
  const latestByClient = new Map<string, { content: string; direction: 'outbound' | 'inbound'; timestamp: string }>();

  // Process outbound messages
  for (const msg of outboundMsgs) {
    const existing = latestByClient.get(msg.clientId);
    if (!existing || msg.createdAt.getTime() > new Date(existing.timestamp).getTime()) {
      latestByClient.set(msg.clientId, {
        content: msg.content,
        direction: 'outbound',
        timestamp: msg.createdAt.toISOString(),
      });
    }
  }

  // Process inbound messages (receivedAt > existing timestamp means more recent)
  for (const msg of inboundMsgs) {
    const existing = latestByClient.get(msg.clientId);
    const outAt = existing ? new Date(existing.timestamp).getTime() : -Infinity;
    const inTime = msg.receivedAt.getTime();
    // Strict `>` matches the summary tie-break (tie → outbound)
    if (inTime > outAt) {
      latestByClient.set(msg.clientId, {
        content: msg.body,
        direction: 'inbound',
        timestamp: msg.receivedAt.toISOString(),
      });
    }
  }

  // STEP 3: Split clients into with-message and zero-message
  const withMsgClients = baseClients.filter(c => latestByClient.has(c.id));
  const withoutMsgClients = baseClients.filter(c => !latestByClient.has(c.id));

  // STEP 4: Apply pagination across the with/zero boundary
  const withCount = withMsgClients.length;
  const withoutCount = withoutMsgClients.length;
  const total = withCount + withoutCount;
  const pages = Math.max(1, Math.ceil(total / limit));

  const skipWith = Math.max(0, skip - withoutCount);
  const takeWith = Math.min(limit - Math.max(0, skip - withoutCount), withCount - skipWith);
  const skipWithout = Math.max(0, skip - withCount);
  const takeWithout = Math.min(limit - takeWith, withoutCount - skipWithout);

  const pageWithClients = withMsgClients.slice(skipWith, skipWith + takeWith);
  const pageWithoutClients = withoutMsgClients.slice(skipWithout, skipWithout + takeWithout);
  const pageClients = [...pageWithClients, ...pageWithoutClients];

  // STEP 5: Build final conversation items
  const conversations = pageClients.map((c) => ({
    client: {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      optedOut: c.optedOut,
    },
    lastMessage: latestByClient.get(c.id) ?? null,
    // TODO: Fix query to get outbound and inbound message counts
    outboundCount: 0,
    inboundCount: 0,
  }));

  return formatResponse.success(res, {
    conversations,
    pagination: { page, limit, total, pages },
  });
}));

/**
 * GET /messages/:id
 * Get a specific message
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const message = await dbMessages.findById(id);

  if (!message) {
    return formatResponse.notFound(res, 'Message not found');
  }

  return formatResponse.success(res, {
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
  });
}));

export default router;