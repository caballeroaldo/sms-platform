/**
 * SMS Platform - Campaign Routes
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { CreateCampaignInput, UpdateCampaignInput, ApiResponse } from '../types/index.js';
import { CampaignStatus } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
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

    res.json({ success: true, data: { campaigns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } } as ApiResponse);
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ success: false, error: 'Failed to list campaigns' } as ApiResponse);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: CreateCampaignInput = req.body;
    if (!input.name) { res.status(400).json({ success: false, error: 'Campaign name is required' } as ApiResponse); return; }
    if (input.scheduleTime && new Date(input.scheduleTime) < new Date()) { res.status(400).json({ success: false, error: 'Schedule time must be in the future' } as ApiResponse); return; }

    const campaign = await prisma.campaign.create({
      data: { name: input.name, description: input.description, templateId: input.templateId, scheduleTime: input.scheduleTime, recurrence: input.recurrence, status: input.scheduleTime ? 'SCHEDULED' : 'DRAFT' },
      include: { template: true },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_created', details: JSON.stringify({ campaignId: campaign.id }), ipAddress: req.ip } });
    res.status(201).json({ success: true, data: campaign } as ApiResponse);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to create campaign' } as ApiResponse);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = (req.params as Record<string, string>).id;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { template: true, messages: { take: 50, orderBy: { createdAt: 'desc' }, include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } } } },
    });
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse); return; }
    const stats = await prisma.message.groupBy({ by: ['status'], where: { campaignId: id }, _count: { id: true } });
    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[s.status] = s._count.id || 0;
    res.json({ success: true, data: { ...campaign, stats: statsMap } } as ApiResponse);
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to get campaign' } as ApiResponse);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = (req.params as Record<string, string>).id;
    const input: UpdateCampaignInput = req.body;
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse); return; }
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) { res.status(400).json({ success: false, error: 'Cannot update a running or completed campaign' } as ApiResponse); return; }
    if (input.scheduleTime && new Date(input.scheduleTime) < new Date()) { res.status(400).json({ success: false, error: 'Schedule time must be in the future' } as ApiResponse); return; }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { name: input.name ?? existing.name, description: input.description ?? existing.description, templateId: input.templateId ?? existing.templateId, scheduleTime: input.scheduleTime ?? existing.scheduleTime, recurrence: input.recurrence ?? existing.recurrence, status: input.status ?? existing.status },
      include: { template: true },
    });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_updated', details: JSON.stringify({ campaignId: id, changes: input }), ipAddress: req.ip } });
    res.json({ success: true, data: campaign } as ApiResponse);
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to update campaign' } as ApiResponse);
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = (req.params as Record<string, string>).id;
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse); return; }
    if (campaign.status === 'RUNNING') { res.status(400).json({ success: false, error: 'Cancel the campaign first' } as ApiResponse); return; }
    await prisma.message.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_deleted', details: JSON.stringify({ campaignId: id }), ipAddress: req.ip } });
    res.json({ success: true, message: 'Campaign deleted' } as ApiResponse);
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete campaign' } as ApiResponse);
  }
});

router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const id = (req.params as Record<string, string>).id;
    const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse); return; }
    if (!campaign.template) { res.status(400).json({ success: false, error: 'Campaign has no template' } as ApiResponse); return; }
    if (campaign.status === 'RUNNING') { res.status(400).json({ success: false, error: 'Campaign is already running' } as ApiResponse); return; }

    const clients = await prisma.client.findMany({ where: { optedOut: false }, select: { id: true } });
    if (clients.length === 0) { res.status(400).json({ success: false, error: 'No opted-in clients found' } as ApiResponse); return; }

    const templateContent = campaign.template.content;
    await prisma.message.createMany({ data: clients.map((c) => ({ clientId: c.id, campaignId: campaign.id, content: templateContent, status: 'PENDING' as const, scheduledAt: campaign.scheduleTime })) });
    await prisma.campaign.update({ where: { id }, data: { status: 'RUNNING' } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, actor: req.user!.email, action: 'campaign_sent', details: JSON.stringify({ campaignId: id, recipientCount: clients.length }), ipAddress: req.ip } });

    res.json({ success: true, data: { campaignId: id, recipientCount: clients.length } } as ApiResponse);
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({ success: false, error: 'Failed to send campaign' } as ApiResponse);
  }
});

export default router;