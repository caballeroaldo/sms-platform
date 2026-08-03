/**
 * SMS Platform - Configuration
 * Centralizes environment variables with validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// `StringValue` (branded template-literal union from `ms`) is what
// @types/jsonwebtoken@9 narrows SignOptions.expiresIn to. Importing it
// type-only lets us type Config.jwtExpiresIn precisely; `ms` + `@types/ms`
// ship transitively with jsonwebtoken, so this adds no runtime/bundle cost.
import type { StringValue } from 'ms';

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
  // ms-format duration string (e.g. "604800", "7d", "1h"). Typed as ms'
  // branded StringValue so `jwt.sign(..., { expiresIn })` satisfies the
  // @types/jsonwebtoken@9 overload (TS2769 at auth.ts:87/132/178/213).
  jwtExpiresIn: StringValue;

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
  // JWT expiration as an ms-format duration string (e.g., "604800" seconds =
  // 7 days, or "7d", "1h"). Cast to StringValue: the env value is always an
  // ms-duration by convention, and a malformed value is jsonwebtoken@9's job
  // to reject at the first jwt.sign (fail-fast) — matches the strictness the
  // @types/jsonwebtoken@9 overload encodes.
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '604800') as StringValue,

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