/**
 * SMS Platform - Sinch Service
 * Handles SMS sending via Sinch Conversation API
 */

import { SendSMSResult } from '../types/index.js';
import { config } from '../config/index.js';

/**
 * Send an SMS message via Sinch Conversation API
 *
 * Conversation API documentation:
 * https://developers.sinch.com/docs/conversation/api-reference/conversation/
 */
export async function sendSinchSMS(to: string, body: string): Promise<SendSMSResult> {
  // Validate configuration
  if (!config.sinchProjectId || !config.sinchApiToken || !config.sinchPhoneNumber || !config.sinchServicePlanId || !config.sinchAppId) {
    return {
      success: false,
      error: 'Sinch Conversation credentials not configured',
    };
  }

  try {
    // Conversation API endpoint for sending messages - using regional endpoint
    const url = `https://${config.sinchRegion}.conversation.api.sinch.com/v1/projects/${config.sinchProjectId}/messages:send`;

    // Basic Auth credentials (servicePlanId:apiToken)
    const auth = Buffer.from(`${config.sinchServicePlanId}:${config.sinchApiToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        app_id: config.sinchAppId,
        recipient: {
          identified_by: {
            channel_identities: [
              {
                channel: "SMS",
                identity: to
              }
            ]
          }
        },
        message: {
          text_message: {
            text: body
          }
        },
        channel_properties: {
          SMS_SENDER: config.sinchPhoneNumber
        }
      }),
    });

    // Handle response
    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Sinch Conversation API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          // Extract error message from various possible structures
          if ('message' in errorData && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if ('error' in errorData && typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if ('detail' in errorData && typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        }
      } catch (e) {
        // If JSON parsing fails, use the status text
        errorMessage = `Sinch Conversation API error: ${response.status} ${response.statusText}`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // Parse successful response
    const data = await response.json();

    // Extract message ID from response for compatibility with existing code
    // The Sinch Messages API may return different structures
    const messageId = (data && typeof data === 'object' && 'id' in data) ? String(data.id) :
                     (data && typeof data === 'object' && 'messageId' in data) ? String(data.messageId) :
                     (data && typeof data === 'object' && 'conversationId' in data) ? String(data.conversationId) :
                     `msg-${Date.now()}`;

    return {
      success: true,
      sid: messageId, // Store message/conversation ID in sid field for compatibility
      status: 'queued', // Assume queued for processing
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}