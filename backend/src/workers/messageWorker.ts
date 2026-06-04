/**
 * SMS Platform - Message Worker
 * BullMQ worker for processing scheduled and queued messages
 */

import { Worker, Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../prisma/client.js';
import { sendSMS } from '../services/twilio.js';
import config from '../config/index.js';

// Redis connection for BullMQ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Redis = (IORedis as any).default || IORedis;
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue and Worker names
const QUEUE_NAME = 'message-queue';
const WORKER_NAME = 'message-worker';

// ===========================================
// JOB TYPES
// ===========================================

interface SendMessageJob {
  messageId: string;
  clientId: string;
  phone: string;
  content: string;
  campaignId?: string;
  retryCount?: number;
}

// ===========================================
// CREATE QUEUE (for adding jobs)
// ===========================================

export const messageQueue = new Queue<SendMessageJob>(QUEUE_NAME, { connection });

// ===========================================
// CREATE WORKER (for processing jobs)
// ===========================================

const messageWorker = new Worker<SendMessageJob>(
  WORKER_NAME,
  async (job: Job<SendMessageJob>) => {
    const { messageId, clientId, phone, content, retryCount = 0 } = job.data;

    console.log(`Processing message ${messageId} (retry: ${retryCount})`);

    // Verify message still exists and hasn't been sent
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        client: { select: { optedOut: true } },
      },
    });

    if (!message) {
      console.log(`Message ${messageId} not found, skipping`);
      return { status: 'skipped', reason: 'not_found' };
    }

    if (message.status === 'SENT' || message.status === 'DELIVERED') {
      console.log(`Message ${messageId} already sent, skipping`);
      return { status: 'skipped', reason: 'already_sent' };
    }

    if (message.client.optedOut) {
      console.log(`Client ${clientId} opted out, skipping message ${messageId}`);
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'FAILED', errorMessage: 'Client opted out' },
      });
      return { status: 'skipped', reason: 'opted_out' };
    }

    // Send the message
    const result = await sendSMS(phone, content);

    if (result.success) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          twilioSid: result.sid,
          sentAt: new Date(),
        },
      });
      console.log(`Message ${messageId} sent successfully`);
      return { status: 'sent', sid: result.sid };
    } else {
      // Check if we should retry
      if (retryCount < 3) {
        console.log(`Message ${messageId} failed, will retry: ${result.error}`);
        throw new Error(result.error);
      }

      // Max retries reached, mark as failed
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          retryCount,
          errorMessage: result.error,
        },
      });
      console.log(`Message ${messageId} failed after ${retryCount + 1} attempts`);
      return { status: 'failed', error: result.error };
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10, // Max 10 messages per second
      duration: 1000,
    },
  }
);

// ===========================================
// EVENT HANDLERS
// ===========================================

messageWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

messageWorker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);

  const attempts = job?.opts.attempts ?? 3;
  if (job && job.attemptsMade < attempts) {
    console.log(`Re-queueing job ${job.id} (attempt ${job.attemptsMade + 1})`);
    // The job will auto-retry based on BullMQ settings
  }
});

messageWorker.on('error', (error) => {
  console.error('Worker error:', error);
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Queue a message for processing
 */
export async function queueMessage(
  messageId: string,
  clientId: string,
  phone: string,
  content: string,
  campaignId?: string,
  scheduledFor?: Date
): Promise<void> {
  const jobName = `message-${messageId}`;

  const jobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  };

  if (scheduledFor && scheduledFor > new Date()) {
    // Schedule for future delivery
    const delay = scheduledFor.getTime() - Date.now();

    await messageQueue.add(jobName, {
      messageId,
      clientId,
      phone,
      content,
      campaignId,
    }, {
      ...jobOptions,
      delay,
    });

    console.log(`Message ${messageId} scheduled for ${scheduledFor.toISOString()}`);
  } else {
    // Process immediately
    await messageQueue.add(jobName, {
      messageId,
      clientId,
      phone,
      content,
      campaignId,
    }, jobOptions);

    console.log(`Message ${messageId} queued for immediate delivery`);
  }
}

/**
 * Process all pending scheduled messages
 * This runs periodically to pick up any messages that need to be sent
 */
export async function processScheduledMessages(): Promise<void> {
  const now = new Date();

  const pendingMessages = await prisma.message.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: {
        lte: now,
      },
    },
    include: {
      client: {
        select: { id: true, phone: true, optedOut: true },
      },
    },
    take: 100,
  });

  console.log(`Found ${pendingMessages.length} messages to process`);

  for (const message of pendingMessages) {
    if (message.client.optedOut) {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', errorMessage: 'Client opted out' },
      });
      continue;
    }

    await queueMessage(
      message.id,
      message.client.id,
      message.client.phone,
      message.content,
      message.campaignId || undefined
    );

    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'QUEUED' },
    });
  }
}

// ===========================================
// START SCHEDULED PROCESSOR
// ===========================================

// Run every minute to pick up scheduled messages
setInterval(() => {
  processScheduledMessages().catch(console.error);
}, 60 * 1000);

// Initial run
processScheduledMessages().catch(console.error);

console.log('Message worker started');

export default messageWorker;