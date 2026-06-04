/**
 * SMS Platform - Configuration
 * Centralizes environment variables with validation
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

interface Config {
  nodeEnv: string;
  port: number;
  frontendUrl: string;

  // Database
  databaseUrl: string;

  // Redis
  redisUrl: string;

  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;

  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioApiKeySid: string;
  twilioApiKeySecret: string;
  twilioMessagingServiceSid: string;
  twilioPhoneNumber: string;
  twilioWebhookAuthToken: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '4000'), 10),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:3000'),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  jwtSecret: required('JWT_SECRET'),
  // JWT expiration in seconds (e.g., 604800 = 7 days)
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '604800'),

  twilioAccountSid: required('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: required('TWILIO_AUTH_TOKEN'),
  twilioApiKeySid: required('TWILIO_API_KEY_SID'),
  twilioApiKeySecret: required('TWILIO_API_KEY_SECRET'),
  twilioMessagingServiceSid: optional('TWILIO_MESSAGING_SERVICE_SID', ''),
  twilioPhoneNumber: required('TWILIO_PHONE_NUMBER'),
  twilioWebhookAuthToken: optional('TWILIO_WEBHOOK_AUTH_TOKEN', ''),
};

export default config;