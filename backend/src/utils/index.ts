/**
 * SMS Platform - Utility Functions
 */

// ===========================================
// Express Request Utilities
// ===========================================

import { Request } from 'express';

// Express 5 query param type
// req.query[key] is string | ParsedQs | string[] where ParsedQs is an object for nested params
type QueryValue = string | Record<string, unknown> | string[] | undefined;

/**
 * Safely extract query parameter as string
 */
export function queryString(value: QueryValue): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return undefined; // ParsedQs object
  return value;
}

/**
 * Safely extract query parameter as number
 */
export function queryInt(value: QueryValue, defaultValue?: number): number | undefined {
  const str = queryString(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

// ===========================================
// Phone Number Utilities
// ===========================================

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const US_PHONE_REGEX = /^[2-9]\d{9}$/;
const NPA_VALUES = [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 212, 213, 214, 215, 216, 217, 218, 219, 220, 224, 225, 226, 228, 229, 231, 234, 239, 240, 248, 251, 252, 253, 254, 256, 260, 262, 267, 269, 270, 272, 274, 276, 281, 301, 302, 303, 304, 305, 307, 308, 309, 310, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 323, 334, 339, 346, 347, 351, 352, 360, 361, 369, 380, 385, 386, 401, 402, 404, 405, 406, 407, 408, 409, 410, 412, 413, 414, 415, 417, 419, 423, 424, 425, 430, 431, 434, 435, 440, 442, 443, 469, 470, 475, 478, 479, 480, 484, 501, 502, 503, 504, 505, 507, 508, 509, 510, 512, 513, 515, 516, 518, 520, 530, 540, 541, 551, 557, 559, 561, 562, 563, 564, 567, 570, 571, 573, 575, 580, 585, 601, 602, 603, 605, 606, 607, 608, 609, 610, 612, 614, 615, 617, 618, 619, 620, 623, 626, 628, 630, 631, 636, 639, 641, 646, 650, 658, 660, 661, 662, 667, 669, 678, 682, 689, 701, 702, 703, 704, 706, 707, 708, 712, 713, 714, 715, 716, 717, 718, 719, 720, 724, 725, 727, 731, 732, 734, 737, 740, 742, 747, 754, 757, 758, 760, 762, 763, 765, 769, 770, 772, 773, 774, 775, 779, 781, 785, 786, 801, 802, 803, 804, 805, 806, 808, 810, 812, 813, 814, 815, 816, 817, 818, 828, 830, 831, 832, 835, 843, 845, 847, 848, 850, 854, 856, 857, 858, 859, 860, 862, 863, 864, 865, 870, 872, 878, 901, 903, 904, 906, 907, 908, 909, 910, 912, 913, 914, 915, 916, 917, 918, 919, 920, 925, 928, 931, 935, 936, 937, 939, 940, 941, 947, 949, 952, 954, 956, 959, 970, 971, 972, 973, 978, 979, 980, 984, 985, 989];

/**
 * Validates if a phone number is in E.164 format
 */
export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

/**
 * Normalizes a US phone number to E.164 format
 * Accepts: 1234567890, +11234567890, (123) 456-7890, 123-456-7890
 */
export function normalizeToE164(phone: string, defaultCountryCode = '+1'): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Already E.164
  if (phone.startsWith('+')) {
    return phone.length >= 10 && phone.length <= 15 ? phone : '';
  }

  // Add country code if 10 digits (US)
  if (digits.length === 10) {
    // Validate NPA (first 3 digits)
    const npa = parseInt(digits.substring(0, 3), 10);
    if (!NPA_VALUES.includes(npa)) {
      throw new Error(`Invalid US area code: ${digits.substring(0, 3)}`);
    }
    return `${defaultCountryCode}${digits}`;
  }

  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return '';
}

/**
 * Formats E.164 number for display
 */
export function formatPhoneForDisplay(e164: string): string {
  if (!e164.startsWith('+')) return e164;

  const digits = e164.replace('+', '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

// ===========================================
// Date Utilities
// ===========================================

/**
 * Checks if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Checks if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Gets start of day in UTC
 */
export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Gets end of day in UTC
 */
export function endOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
}

// ===========================================
// String Utilities
// ===========================================

/**
 * Masks a phone number for display: +1234567890 -> +1******7890
 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return '****';
  const visible = phone.slice(-4);
  const masked = '*'.repeat(phone.length - 4 - 4);
  const countryCode = phone.startsWith('+') ? '+' : '';
  return `${countryCode}${masked}${visible}`;
}

/**
 * Truncates string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ===========================================
// Crypto Utilities
// ===========================================

import crypto from 'crypto';

/**
 * Creates a SHA-256 hash of the input
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generates a random verification code
 */
export function generateCode(length = 6): string {
  return crypto.randomInt(0, Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}