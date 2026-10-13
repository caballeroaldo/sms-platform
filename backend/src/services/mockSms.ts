/**
 * SMS Platform - Mock SMS Service
 * Provides a mock SMS implementation for testing
 */

import { SendSMSResult } from '../types/index.js';

/**
 * Send a mock SMS message (always succeeds, no external calls)
 */
export async function sendMockSMS(
  _to: string,
  _body: string
): Promise<SendSMSResult> {
  return {
    success: true,
    sid: `MOCK_${Date.now()}`,
    status: 'queued',
    mockMode: true,
  };
}