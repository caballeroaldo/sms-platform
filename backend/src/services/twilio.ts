/**
 * SMS Platform - Twilio Service
 * Handles SMS sending and validation
 */

import twilio from 'twilio';
import config from '../config/index.js';

const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

export interface SendSMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  status?: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSMS(to: string, body: string): Promise<SendSMSResult> {
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