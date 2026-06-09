/**
 * SMS Platform - Twilio Service
 * Handles SMS sending and validation
 * Supports mock mode when credentials are not configured
 */

import twilio from 'twilio';
import { isMockMode, config } from '../config/index.js';

let client: ReturnType<typeof twilio> | null = null;

// Initialize Twilio client only if credentials are available
if (!isMockMode && config.twilioAccountSid && config.twilioAuthToken) {
  client = twilio(config.twilioAccountSid, config.twilioAuthToken);
  console.log('📱 Twilio client initialized');
} else {
  console.log('📱 Twilio running in MOCK MODE (no credentials configured)');
}

export interface SendSMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  status?: string;
  mockMode?: boolean;
}

/**
 * Send an SMS message via Twilio (or mock if credentials not set)
 */
export async function sendSMS(to: string, body: string): Promise<SendSMSResult> {
  // Mock mode - simulate successful send
  if (!client) {
    const mockSid = `SM_MOCK_${Date.now()}`;
    console.log(`📱 [MOCK] SMS to ${to}: "${body.substring(0, 50)}..." → ${mockSid}`);
    return {
      success: true,
      sid: mockSid,
      status: 'queued',
      mockMode: true,
    };
  }

  try {
    const message = await client.messages.create({
      to,
      from: config.twilioPhoneNumber,
      body,
      // Use Messaging Service if configured
      ...(config.twilioMessagingServiceSid && {
        messagingServiceSid: config.twilioMessagingServiceSid,
      }),
    });

    return {
      success: true,
      sid: message.sid,
      status: message.status,
    };
  } catch (error) {
    const twilioError = error as { message?: string; code?: number };
    console.error('Twilio send error:', twilioError);

    return {
      success: false,
      error: twilioError.message || 'Failed to send SMS',
    };
  }
}

/**
 * Validate a Twilio webhook signature
 */
export function validateWebhookSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // In mock mode, skip validation
  if (!client) {
    console.log('🔐 [MOCK] Webhook validation skipped');
    return true;
  }

  return twilio.validateRequest(
    config.twilioAuthToken,
    signature,
    url,
    params
  );
}

/**
 * Get message status from Twilio
 */
export async function getMessageStatus(sid: string): Promise<string | null> {
  // Mock mode - return simulated status
  if (!client) {
    return 'delivered';
  }

  try {
    const message = await client.messages(sid).fetch();
    return message.status;
  } catch {
    return null;
  }
}

export default {
  sendSMS,
  validateWebhookSignature,
  getMessageStatus,
};