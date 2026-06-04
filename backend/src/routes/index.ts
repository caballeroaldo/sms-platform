/**
 * SMS Platform - Routes Index
 * Aggregates all route modules
 */

import { Router } from 'express';
import authRoutes from './auth.js';
import clientRoutes from './clients.js';
import templateRoutes from './templates.js';
import campaignRoutes from './campaigns.js';
import messageRoutes from './messages.js';
import webhookRoutes from './webhooks.js';
import dashboardRoutes from './dashboard.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/templates', templateRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/messages', messageRoutes);
router.use('/webhooks/twilio', webhookRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;