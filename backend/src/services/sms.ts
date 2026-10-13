/**
 * SMS Platform - SMS Provider Abstraction Layer
 * Selects the appropriate SMS provider based on configuration
 */

import { SendSMSResult } from '../types/index.js';
import { sendSinchSMS } from './sinch.js';
import { sendSMS as sendTwilioSMS } from './twilio.js';
import { sendMockSMS } from './mockSms.js';
import { config } from '../config/index.js';

/**
 * Send an SMS message using the configured provider
 *
 * Provider selection:
 * - 'sinch': Use Sinch API
 * - 'mock': Use explicit mock (always succeeds)
 * - 'twilio' (default): Use Twilio (with its internal mock mode when credentials missing)
 */
export async function sendSMS(
  to: string,
  body: string
): Promise<SendSMSResult> {
  switch (config.smsProvider) {
    case 'sinch':
      return await sendSinchSMS(to, body);
    case 'mock':
      return await sendMockSMS(to, body);
    case 'twilio':
    default:
      // Fallback to Twilio (includes its own internal mock mode logic)
      return await sendTwilioSMS(to, body);
  }
}