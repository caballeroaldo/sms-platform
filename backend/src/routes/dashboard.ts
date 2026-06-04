/**
 * SMS Platform - Dashboard Routes
 * GET /dashboard/stats
 * GET /dashboard/activity
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { authenticate } from '../middleware/index.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

router.use(authenticate);

/**
 * GET /dashboard/stats
 * Get dashboard statistics for overview
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      optedInClients,
      optedOutClients,
      sentThisMonth,
      deliveredThisMonth,
      failedThisMonth,
      pendingMessages,
      activeCampaigns,
      templatesCount,
    ] = await Promise.all([
      // Client counts
      prisma.client.count(),
      prisma.client.count({ where: { optedOut: false } }),
      prisma.client.count({ where: { optedOut: true } }),

      // Message stats this month
      prisma.message.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ['SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED'] },
        },
      }),
      prisma.message.count({
        where: { createdAt: { gte: thirtyDaysAgo }, status: 'DELIVERED' },
      }),
      prisma.message.count({
        where: { createdAt: { gte: thirtyDaysAgo }, status: { in: ['FAILED', 'UNDELIVERED'] } },
      }),

      // Pending messages
      prisma.message.count({ where: { status: 'PENDING' } }),

      // Campaigns
      prisma.campaign.count({ where: { status: 'RUNNING' } }),

      // Templates
      prisma.template.count(),
    ]);

    const deliveryRate = sentThisMonth > 0 ? (deliveredThisMonth / sentThisMonth) * 100 : 0;

    res.json({
      success: true,
      data: {
        clients: {
          total: totalClients,
          optedIn: optedInClients,
          optedOut: optedOutClients,
        },
        messages: {
          sentThisMonth,
          deliveredThisMonth,
          failedThisMonth,
          pending: pendingMessages,
          deliveryRate: Math.round(deliveryRate * 10) / 10,
        },
        campaigns: {
          active: activeCampaigns,
        },
        templates: {
          total: templatesCount,
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard stats',
    } as ApiResponse);
  }
});

/**
 * GET /dashboard/activity
 * Get recent activity for the activity feed
 */
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    // Get recent messages
    const recentMessages = await prisma.message.findMany({
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    // Get recent audit logs
    const recentAudit = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      where: {
        action: {
          in: ['client_created', 'client_deleted', 'campaign_sent', 'bulk_sms_sent', 'client_opted_out'],
        },
      },
    });

    // Combine and sort by time
    const messages = recentMessages.map((m) => ({
      type: 'message' as const,
      id: m.id,
      action: m.status === 'SENT' || m.status === 'DELIVERED' ? 'message_sent' : 'message_failed',
      client: m.client,
      message: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : ''),
      status: m.status,
      timestamp: m.createdAt,
    }));

    const audits = recentAudit.map((a) => ({
      type: 'audit' as const,
      id: a.id,
      action: a.action,
      actor: a.actor,
      details: a.details,
      timestamp: a.timestamp,
    }));

    const combined = [...messages, ...audits].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({
      success: true,
      data: {
        activities: combined.slice(0, limit),
        page,
        limit,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity',
    } as ApiResponse);
  }
});

/**
 * GET /dashboard/upcoming
 * Get upcoming scheduled messages and campaigns
 */
router.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();

    // Get scheduled messages
    const scheduledMessages = await prisma.message.findMany({
      where: {
        scheduledAt: { gte: now },
        status: 'PENDING',
      },
      take: 10,
      orderBy: { scheduledAt: 'asc' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    // Get upcoming birthday messages
    const today = new Date();
    const upcomingBirthdays = await prisma.client.findMany({
      where: {
        birthday: { not: null },
        optedOut: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthday: true,
        phone: true,
      },
    });

    // Filter birthdays in the next 7 days
    const next7Days = upcomingBirthdays
      .map((client) => {
        const birthday = new Date(client.birthday!);
        birthday.setFullYear(today.getFullYear());
        if (birthday < now) birthday.setFullYear(today.getFullYear() + 1);
        return { ...client, upcomingDate: birthday };
      })
      .filter((c) => {
        const diff = c.upcomingDate.getTime() - now.getTime();
        return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => a.upcomingDate.getTime() - b.upcomingDate.getTime());

    res.json({
      success: true,
      data: {
        scheduledMessages,
        upcomingBirthdays: next7Days,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Dashboard upcoming error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upcoming',
    } as ApiResponse);
  }
});

export default router;