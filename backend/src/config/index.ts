/**
 * SMS Platform - Configuration
 * Centralizes environment variables with validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Database - use empty string if not provided (enables mock mode for testing)
  databaseUrl: optional('DATABASE_URL', ''),
  redisUrl: optional('REDIS_URL', ''),

  jwtSecret: optional('JWT_SECRET', 'dev-secret-do-not-use-in-prod'),
  // JWT expiration in seconds (e.g., 604800 = 7 days)
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '604800'),

  // Twilio - use empty strings if not provided (enables mock mode for testing)
  twilioAccountSid: optional('TWILIO_ACCOUNT_SID', ''),
  twilioAuthToken: optional('TWILIO_AUTH_TOKEN', ''),
  twilioApiKeySid: optional('TWILIO_API_KEY_SID', ''),
  twilioApiKeySecret: optional('TWILIO_API_KEY_SECRET', ''),
  twilioMessagingServiceSid: optional('TWILIO_MESSAGING_SERVICE_SID', ''),
  twilioPhoneNumber: optional('TWILIO_PHONE_NUMBER', '+15551234567'),
  twilioWebhookAuthToken: optional('TWILIO_WEBHOOK_AUTH_TOKEN', ''),
};

// Check if we have required external services
export const isMockMode = !config.databaseUrl || !config.twilioAccountSid;

export default config;