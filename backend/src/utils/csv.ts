/**
 * SMS Platform - CSV Import Parser
 *
 * Parses the periodic tax-season client-list report export ("Sample CSV Report
 * for SMS Platform.csv" shape) into normalized Client import payloads.
 *
 * The report is NOT a flat client table — it carries an envelope:
 *
 *   line 1   SMS Platform Client List,,,,,,,,,
 *   line 2   As of 08-01-2026,,,,,,,,,
 *   line 3   <header row>  (column names — mapped by NAME, not position)
 *   …        one row per client
 *   last     Totals (208),,,,,,,50,189,19
 *
 * Column → Client field mapping (confirmed with the business owner):
 *   Taxpayer First Name  → firstName            (required)
 *   Taxpayer Last Name   → lastName             ('' if blank)
 *   Phone Number         → phone                (normalized to E.164)
 *   Taxpayer Date of Birth → birthday           (MM/DD/YYYY → DateTime, nullable)
 *   Date Changed         → taxFiledDate         (literal filed date; null when blank)
 *   Return Type          → taxReturnType        (1040 | 1040SR | 1120S | 1065 | …)
 *   Taxpayer Status      → taxpayerStatus       (EF Accepted | In Progress | Updated From 2024 | …)
 *   Client Inactive      → inactive            (Yes/No). NOT optedOut — inactive means
 *                                             carried over / not seen this season.
 *   Client LY            → clientLY            (Yes/No) — seen prior year
 *   Client New           → clientNew           (Yes/No) — new this year
 *
 * Rows missing firstName or phone are returned as `skipped` (invalid), not
 * thrown — the import route surfaces them in a summary. Phone validation
 * (area-code + length) is delegated to normalizeToE164.
 */

import { normalizeToE164 } from './index.js';

// ===========================================
// TYPES
// ===========================================

/** A single row normalized into the shape the import route writes to Prisma. */
export interface ClientCsvRow {
  firstName: string;
  lastName: string;
  phone: string;
  birthday: Date | null;
  taxFiledDate: Date | null;
  taxReturnType: string | null;
  taxpayerStatus: string | null;
  inactive: boolean;
  clientLY: boolean;
  clientNew: boolean;
  /** 1-based line in the file — for error messages only. */
  lineNumber: number;
}

/** Rows dropped before DB writes (missing identity or invalid phone). */
export interface SkippedRow {
  lineNumber: number;
  reason: string;
  /** Raw cell values, kept short for diagnostics. */
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ParsedCsv {
  rows: ClientCsvRow[];
  skipped: SkippedRow[];
  /** Count of data rows the parser looked at (excludes envelope/totals). */
  totalDataRows: number;
  /** The "As of" date string if found in the envelope, else null. */
  asOf: string | null;
}

// ===========================================
// LOW-LEVEL HELPERS
// ===========================================

/**
 * Parse "MM/DD/YYYY" into a UTC-midnight Date. Returns null for blank or
 * unparseable input. UTC keeps it day-stable regardless of server tz, matching
 * the seed's plain `new Date('2025-04-08')` shape.
 */
export function parseUSDate(value: string): Date | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  // Accept M/D/YYYY or MM/DD/YYYY; reject anything that isn't digits+slashes.
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  return new Date(Date.UTC(+yr, +mo - 1, +da, 0, 0, 0, 0));
}

/** "Yes"/"No" (case-insensitive) → boolean; anything else → false. */
export function yesNoToBool(value: string): boolean {
  return (value ?? '').trim().toLowerCase() === 'yes';
}

/**
 * Minimal RFC-4180-ish CSV field splitter. Handles quoted fields, embedded
 * commas, doubled-quote escapes (""). Good enough for the report format, which
 * doesn't contain embedded newlines in fields; if that ever shows up, swap in
 * a real parser (papaparse). Each returned line is an array of field strings
 * with surrounding whitespace preserved (trimmed later by rowToClientPayload
 * per-field, so empty trailing commas map to '' not undefined).
 */
export function splitCsv(text: string): string[][] {
  const lines: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Doubled quote = literal " inside a quoted field.
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') { continue; }
    if (ch === '\n') { row.push(field); lines.push(row); field = ''; row = []; continue; }
    field += ch;
  }
  // Flush trailing field/row if the file didn't end on a newline.
  if (field !== '' || row.length > 0) { row.push(field); lines.push(row); }

  return lines;
}

// ===========================================
// HEADER DETECTION + ENVELOPE STRIPPING
// ===========================================

const HEADER_ALIASES: Record<string, string> = {
  'taxpayer first name': 'firstName',
  'taxpayer last name': 'lastName',
  'phone number': 'phone',
  'taxpayer date of birth': 'birthday',
  'date changed': 'taxFiledDate',
  'return type': 'taxReturnType',
  'taxpayer status': 'taxpayerStatus',
  'client inactive': 'inactive',
  'client ly': 'clientLY',
  'client new': 'clientNew',
};

interface HeaderIndex { [canonical: string]: number }

function detectHeader(cells: string[]): HeaderIndex | null {
  const normalized = cells.map((c) => c.trim().toLowerCase());
  const found: HeaderIndex = {};
  for (let i = 0; i < normalized.length; i++) {
    const canon = HEADER_ALIASES[normalized[i]];
    if (canon && found[canon] === undefined) found[canon] = i; // first occurrence wins
  }
  // A header must at least identify name + phone to be usable.
  if (found.firstName === undefined || found.phone === undefined) return null;
  return found;
}

function looksLikeTotals(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim().toLowerCase();
  return first.startsWith('totals');
}

function looksLikeEnvelopeTitle(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim().toLowerCase();
  return first.startsWith('sms platform client list');
}

function looksLikeEnvelopeAsOf(cells: string[]): string | null {
  const first = (cells[0] ?? '').trim();
  const m = first.match(/^As of\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ===========================================
// ROW → PAYLOAD
// ===========================================

/** Pull + trim a field by its canonical-name index, falling back to ''. */
function field(cells: string[], idx: number): string {
  if (idx === undefined) return '';
  return (cells[idx] ?? '').trim();
}

/** Build the normalized import payload for one CSV row. Throws on invalid phone. */
function rowToClientPayload(cells: string[], hdr: HeaderIndex, lineNumber: number): ClientCsvRow {
  const firstName = field(cells, hdr.firstName);
  const lastName = field(cells, hdr.lastName);
  const phoneRaw = field(cells, hdr.phone);

  // normalizeToE164 throws on a bad US area code and returns '' on other
  // unparseable shapes; rethrow here so the route can record it per-row.
  let phone: string;
  try {
    phone = normalizeToE164(phoneRaw);
    if (!phone) throw new Error('Unrecognized phone number');
  } catch (err) {
    // Rethrow as a plain Error message the route can stash in SkippedRow.
    throw new Error(err instanceof Error ? err.message : 'Invalid phone number');
  }

  const birthdayRaw = field(cells, hdr.birthday);
  const dateChangedRaw = field(cells, hdr.taxFiledDate);
  const taxReturnType = field(cells, hdr.taxReturnType) || null;
  // Keep the source casing for the status — it's free-text context, not an enum.
  const taxpayerStatus = field(cells, hdr.taxpayerStatus) || null;

  return {
    firstName,
    lastName,
    phone,
    birthday: parseUSDate(birthdayRaw),
    taxFiledDate: parseUSDate(dateChangedRaw),
    taxReturnType,
    taxpayerStatus,
    inactive: yesNoToBool(field(cells, hdr.inactive)),
    clientLY: yesNoToBool(field(cells, hdr.clientLY)),
    clientNew: yesNoToBool(field(cells, hdr.clientNew)),
    lineNumber,
  };
}

// ===========================================
// TOP-LEVEL PARSE
// ===========================================

/**
 * Parse a CSV report string into import-ready rows + a skipped list. Detects
 * the envelope (title / "As of" / Totals) by content rather than by hardcoded
 * line numbers, so regenerated reports with different dates/counts import fine.
 *
 * The parser does not touch the database — that's the route's job. It only
 * classifies rows: usable rows go in `rows`, identity-missing or invalid-phone
 * rows go in `skipped` with a reason.
 */
export function parseCsvReport(text: string): ParsedCsv {
  const lines = splitCsv(text);

  const rows: ClientCsvRow[] = [];
  const skipped: SkippedRow[] = [];
  let asOf: string | null = null;
  let header: HeaderIndex | null = null;
  let totalDataRows = 0;

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i];

    // Skip fully blank lines everywhere.
    if (cells.length === 0 || (cells.length === 1 && cells[0].trim() === '')) continue;

    // Envelope title line — capture + skip.
    if (looksLikeEnvelopeTitle(cells)) continue;

    // Envelope "As of …" line — capture the date + skip.
    const asOfMatch = looksLikeEnvelopeAsOf(cells);
    if (asOfMatch) { asOf = asOfMatch; continue; }

    // Totals row — appears once at the very end; skip.
    if (looksLikeTotals(cells)) continue;

    // First non-envelope, non-totals row is treated as the header.
    if (!header) {
      header = detectHeader(cells);
      if (header) continue;
      // Not a recognizable header and not an envelope/totals row: skip with a
      // note rather than abort, so a malformed top-of-file doesn't kill the lot.
      skipped.push({ lineNumber: i + 1, reason: 'Unrecognized row before any header' });
      continue;
    }

    // Data row. Count it even if we skip it, so totals reconcile.
    totalDataRows++;
    try {
      rows.push(rowToClientPayload(cells, header, i + 1));
    } catch (err) {
      skipped.push({
        lineNumber: i + 1,
        reason: err instanceof Error ? err.message : 'Invalid row',
        firstName: field(cells, header.firstName),
        lastName: field(cells, header.lastName),
        phone: field(cells, header.phone),
      });
    }
  }

  return { rows, skipped, totalDataRows, asOf };
}
