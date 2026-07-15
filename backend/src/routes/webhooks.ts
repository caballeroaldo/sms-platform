/**
 * SMS Platform - Twilio Webhook Routes
 * POST /webhooks/twilio/inbound  - Incoming SMS
 * POST /webhooks/twilio/status    - Delivery status updates
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma/client.js';
import { config } from '../config/index.js';
import { ApiResponse } from '../types/index.js';
import { sha256 } from '../utils/index.js';

const router = Router();

/**
 * Twilio webhook signature validation
 */
function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!config.twilioWebhookAuthToken) {
    console.warn('TWILIO_WEBHOOK_AUTH_TOKEN not configured, skipping validation');
    return true; // Skip validation if not configured (dev mode)
  }

  // Build the data to sign: URL + sorted params
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');

  const data = url + sortedParams;
  const expectedSignature = crypto
    .createHmac('sha1', config.twilioWebhookAuthToken)
    .update(data)
    .digest('base64');

  return signature === expectedSignature;
}

/**
 * POST /webhooks/twilio/inbound
 * Handle incoming SMS messages (replies)
 */
router.post('/inbound', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      From: fromNumber,
      To: toNumber,
      Body: body,
      MessageSid: twilioSid,
      MessageStatus: status,
    } = req.body;

    console.log('Inbound SMS:', { fromNumber, toNumber, twilioSid });

    // Validate webhook signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${config.twilioPhoneNumber}/webhooks/twilio/inbound`;

    if (signature && !validateTwilioSignature(signature, url, req.body)) {
      console.warn('Invalid Twilio webhook signature');
      res.status(403).send('Invalid signature');
      return;
    }

    // Check for duplicate (idempotency)
    if (twilioSid) {
      const existing = await prisma.inboundMessage.findUnique({
        where: { twilioSid },
      });

      if (existing) {
        console.log('Duplicate inbound message:', twilioSid);
        res.sendStatus(200);
        return;
      }
    }

    // Store webhook event for audit
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        eventType: 'inbound_sms',
        payloadHash: sha256(JSON.stringify(req.body)),
        rawPayload: req.body,
        processed: false,
      },
    });

    // Find client by phone number
    const client = await prisma.client.findUnique({
      where: { phone: fromNumber },
      select: { id: true, optedOut: true },
    });

    // Handle STOP messages
    const upperBody = (body || '').toUpperCase().trim();
    if (upperBody === 'STOP' || upperBody === 'UNSUBSCRIBE' || upperBody === 'STOPALL') {
      if (client) {
        await prisma.client.update({
          where: { id: client.id },
          data: { optedOut: true },
        });

        await prisma.consent.create({
          data: {
            clientId: client.id,
            consentType: 'SMS',
            source: 'sms_stop',
          },
        });

        console.log('Client opted out via STOP keyword:', client.id);
      }

      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      res.sendStatus(200);
      return;
    }

    // Handle HELP messages
    if (upperBody === 'HELP' || upperBody === 'INFO') {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });
      res.set('Content-Type', 'text/xml');
      res.send(`
        <Response>
          <Message>This SMS service is powered by ${config.twilioPhoneNumber}. For help, contact support.</Message>
        </Response>
      `);
      return;
    }

    // Handle START/RESUME
    if (upperBody === 'START' || upperBody === 'UNSTOP' || upperBody === 'YES') {
      if (client) {
        await prisma.client.update({
          where: { id: client.id },
          data: { optedOut: false },
        });

        await prisma.consent.create({
          data: {
            clientId: client.id,
            consentType: 'SMS',
            source: 'sms_start',
          },
        });
      }
    }

    // Store the inbound message (only if we have a client)
    if (twilioSid && client?.id) {
      await prisma.inboundMessage.create({
        data: {
          clientId: client.id,
          twilioSid,
          body: body || '',
          receivedAt: new Date(),
        },
      });
    }

    // Acknowledge and mark event processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Inbound webhook error:', error);
    // Always return 200 to Twilio to prevent retries
    res.sendStatus(200);
  }
});

/**
 * POST /webhooks/twilio/status
 * Handle message delivery status updates
 */
router.post('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      MessageSid: twilioSid,
      MessageStatus: status,
      To: toNumber,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
    } = req.body;

    console.log('Status callback:', { twilioSid, status, errorCode });

    // Validate webhook signature
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${config.twilioPhoneNumber}/webhooks/twilio/status`;

    if (signature && !validateTwilioSignature(signature, url, req.body)) {
      console.warn('Invalid Twilio webhook signature');
      res.status(403).send('Invalid signature');
      return;
    }

    // Store webhook event for audit
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        eventType: 'status_callback',
        payloadHash: sha256(JSON.stringify(req.body)),
        rawPayload: req.body,
        processed: false,
      },
    });

    // Find message by Twilio SID
    if (twilioSid) {
      const message = await prisma.message.findFirst({
        where: { twilioSid },
      });

      if (message) {
        // Map Twilio status to our status
        let newStatus: 'SENT' | 'DELIVERED' | 'FAILED' | null = null;
        let deliveredAt: Date | null = null;

        switch (status) {
          case 'sent':
          case 'queued':
          case 'sending':
            newStatus = 'SENT';
            break;
          case 'delivered':
            newStatus = 'DELIVERED';
            deliveredAt = new Date();
            break;
          case 'undelivered':
          case 'failed':
            newStatus = 'FAILED';
            break;
        }

        if (newStatus) {
          await prisma.message.update({
            where: { id: message.id },
            data: {
              status: newStatus,
              deliveredAt: deliveredAt || message.deliveredAt,
              errorMessage: errorMessage || null,
            },
          });
        }
      }
    }

    // Mark event as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Status webhook error:', error);
    res.sendStatus(200);
  }
});

export default router;