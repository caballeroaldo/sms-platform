/**
 * SMS Platform - Campaign Routes
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { CreateCampaignInput, UpdateCampaignInput, ApiResponse } from '../types/index.js';
import { AudienceType } from '@prisma/client';
import {
  resolveAudienceClientIds,
  emptyAudienceReason,
} from '../utils/audience.js';
import { queueMessage } from '../workers/messageWorker.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../utils/validateRequest.js';
import { formatResponse } from '../utils/formatResponse.js';
import { schemas } from '../utils/validateRequest.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | string[] | undefined>;
  const page = Math.max(1, parseInt(String(query.page || '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit || '20'), 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  const status = query.status;
  if (status && !Array.isArray(status)) where.status = status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { template: { select: { id: true, name: true, category: true } } },
    }),
    prisma.campaign.count({ where }),
  ]);

  return formatResponse.success(res, {
    campaigns,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}));

router.post(
  '/',
  authenticate,
  validateRequest(schemas.createCampaign),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateCampaignInput;

    // Additional validation that cannot be expressed in the schema (conditional)
    const audience: AudienceType = input.audience ?? 'ALL';
    if (audience === 'MANUAL') {
      const manualIds = input.manualRecipientIds ?? [];
      if (!Array.isArray(manualIds) || manualIds.length === 0) {
        return formatResponse.error(res, 'Manual audience requires at least one recipient', 400);
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description,
        templateId: input.templateId,
        scheduleTime: input.scheduleTime,
        recurrence: input.recurrence,
        audience,
        manualRecipientIds: audience === 'MANUAL' ? input.manualRecipientIds! : [],
        status: input.scheduleTime ? 'SCHEDULED' : 'DRAFT',
      },
      include: { template: true },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_created', details: JSON.stringify({ campaignId: campaign.id, audience }), ipAddress: req.ip } });
    return formatResponse.success(res, campaign, 201);
  })
);

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = (req.params as Record<string, string>).id;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { template: true, messages: { take: 50, orderBy: { createdAt: 'desc' }, include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } } } },
  });
  if (!campaign) {
    return formatResponse.notFound(res, 'Campaign not found');
  }
  const stats = await prisma.message.groupBy({ by: ['status'], where: { campaignId: id }, _count: { id: true } });
  const statsMap: Record<string, number> = {};
  for (const s of stats) statsMap[s.status] = s._count.id || 0;
  return formatResponse.success(res, { ...campaign, stats: statsMap });
}));

router.put(
  '/:id',
  authenticate,
  validateRequest(schemas.updateCampaign),
  asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;
    const input = req.body as UpdateCampaignInput;

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return formatResponse.notFound(res, 'Campaign not found');
    }
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      return formatResponse.error(res, 'Cannot update a running or completed campaign', 400);
    }
    // Additional validation that cannot be expressed in the schema (conditional)
    const nextAudience: AudienceType = input.audience ?? existing.audience;
    if (nextAudience === 'MANUAL') {
      const manualIds = input.manualRecipientIds ?? existing.manualRecipientIds;
      if (!Array.isArray(manualIds) || manualIds.length === 0) {
        return formatResponse.error(res, 'Manual audience requires at least one recipient', 400);
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        templateId: input.templateId ?? existing.templateId,
        scheduleTime: input.scheduleTime ?? existing.scheduleTime,
        recurrence: input.recurrence ?? existing.recurrence,
        status: input.status ?? existing.status,
        audience: nextAudience,
        manualRecipientIds: input.manualRecipientIds ?? existing.manualRecipientIds ?? [],
      },
      include: { template: true },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_updated', details: JSON.stringify({ campaignId: id, changes: input }), ipAddress: req.ip } });
    return formatResponse.success(res, campaign);
  })
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return formatResponse.notFound(res, 'Campaign not found');
    }
    if (campaign.status === 'RUNNING') {
      return formatResponse.error(res, 'Cancel the campaign first', 400);
    }
    await prisma.message.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_deleted', details: JSON.stringify({ campaignId: id }), ipAddress: req.ip } });
    return formatResponse.success(res, { message: 'Campaign deleted' });
  })
);

router.post(
  '/:id/send',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;
    const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
    if (!campaign) {
      return formatResponse.notFound(res, 'Campaign not found');
    }
    if (!campaign.template) {
      return formatResponse.error(res, 'Campaign has no template', 400);
    }
    if (campaign.status === 'RUNNING') {
      return formatResponse.error(res, 'Campaign is already running', 400);
    }

    const clients = await resolveAudienceClientIds(campaign);
    if (clients.length === 0) {
      return formatResponse.error(res, emptyAudienceReason(campaign.audience), 400);
    }

    const templateContent = campaign.template.content;
    // Messages are created as QUEUED (not PENDING) because this route enqueues
    // them directly for dispatch below. The scheduled-message poller only sweeps
    // PENDING rows, so creating them QUEUED prevents the poller from double-
    // dispatching. scheduledAt mirrors scheduleTime: NULL for an immediate
    // (unscheduled/DRAFT) send, a future timestamp for a SCHEDULED send.
    const created = await prisma.message.createManyAndReturn({
      data: clients.map((c) => ({
        clientId: c.id,
        campaignId: campaign.id,
        content: templateContent,
        status: 'QUEUED' as const,
        scheduledAt: campaign.scheduleTime ?? null,
      })),
    });

    // Enqueue each message for delivery. scheduledFor is set only for a future
    // SCHEDULED send; omitting it tells BullMQ to process immediately.
    const phoneById = new Map(clients.map((c) => [c.id, c.phone]));
    const scheduledFor = campaign.scheduleTime ? new Date(campaign.scheduleTime) : undefined;
    await Promise.all(
      created.map((m) =>
        queueMessage(m.id, m.clientId, phoneById.get(m.clientId)!, m.content, campaign.id, scheduledFor)
      )
    );

    await prisma.campaign.update({ where: { id }, data: { status: 'RUNNING' } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_sent', details: JSON.stringify({ campaignId: id, recipientCount: clients.length, queued: created.length, audience: campaign.audience }), ipAddress: req.ip } });

    return formatResponse.success(res, { campaignId: id, recipientCount: clients.length, queued: created.length });
  })
);

export default router;