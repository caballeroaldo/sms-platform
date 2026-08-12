/**
 * SMS Platform - Type Definitions
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// ===========================================
// Client Types
// ===========================================

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  // Tax-season context, populated by the periodic CSV import (POST
  // /clients/import). Identity fields (name/phone/email/birthday/notes) are
  // never overwritten by an import; these tax fields refresh on every upload.
  //   taxFiledDate   — "Date Changed"; the date the client came in to file.
  //                     Drives the PREV_YEAR_ACTIVE Campaign audience.
  //   inactive       — carried over / not seen this season. NOT optedOut
  //                     (which is revoked SMS consent, a legal flag).
  taxFiledDate: string | null;
  taxReturnType: string | null;
  taxpayerStatus: string | null;
  inactive: boolean;
  clientLY: boolean;
  clientNew: boolean;
  notes: string;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    outboundMessages: number;
    inboundMessages: number;
  };
}

export interface ClientListResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthday?: string;
  notes?: string;
}

// ===========================================
// CSV Import (POST /clients/import)
// ===========================================

/**
 * Result of POST /clients/import. The route is idempotent on phone:
 * new phones create, known phones refresh ONLY the tax-season fields, and
 * rows the parser couldn't classify (missing identity / invalid phone) come
 * back in `skipped` with a reason. `errors` are rows that reached the DB
 * write but threw (e.g. a constraint violation that wasn't a P2002 dup).
 */
export interface ImportedSkippedRow {
  lineNumber: number;
  reason: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ImportedErrorRow {
  lineNumber: number;
  reason: string;
  phone?: string;
}

export interface ImportClientsResult {
  created: number;
  existing: number;
  skipped: ImportedSkippedRow[];
  errors: ImportedErrorRow[];
  totalRows: number;
  asOf: string | null;
}

// ===========================================
// Template Types
// ===========================================

export type TemplateCategory = 'ONBOARDING' | 'MARKETING' | 'NOTIFICATION' | 'TRANSACTIONAL' | 'ALERT';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
  variables?: string[];
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  content: string;
}

// ===========================================
// Campaign Types
// ===========================================

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

/**
 * Audience resolution mode for a Campaign. Stored on `Campaign.audience`;
 * resolved at send time, not at create time.
 *   ALL               → all opted-in clients
 *   PREV_YEAR_ACTIVE  → opted-in clients with taxFiledDate in the prior calendar year
 *   MANUAL            → opted-in clients from manualRecipientIds
 */
export type AudienceType = 'ALL' | 'PREV_YEAR_ACTIVE' | 'MANUAL';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  status: CampaignStatus;
  scheduleTime: string | null;
  recurrence: string | null;
  audience: AudienceType;
  manualRecipientIds: string[];
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    category: TemplateCategory;
  };
  stats?: Record<string, number>;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  templateId?: string;
  scheduleTime?: string;
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  audience?: AudienceType;
  manualRecipientIds?: string[];
}

// ===========================================
// Message Types
// ===========================================

export type MessageStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface Message {
  id: string;
  clientId: string;
  campaignId: string | null;
  content: string;
  status: MessageStatus;
  twilioSid: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  campaign?: {
    id: string;
    name: string;
  };
  /** Message direction: outbound (from platform) or inbound (from client) */
  type?: 'outbound' | 'inbound';
}

/**
 * Merged outbound+inbound thread row from GET /messages/client/:clientId.
 * The backend normalizes inbound `body` → `content` and tags each row with
 * `type` + `direction` so the conversation view renders replies on the left and
 * outbound on the right. Inbound rows carry `status: null`.
 */
export interface ConversationMessage extends Message {
  direction: 'outbound' | 'inbound';
  /** Raw inbound body, kept alongside the normalized `content`. */
  body?: string;
}

/** Per-client conversation summary row (GET /messages/conversations). */
export interface ConversationListItem {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    optedOut: boolean;
  };
  lastMessage: {
    content: string;
    direction: 'outbound' | 'inbound';
    timestamp: string;
  } | null;
  outboundCount: number;
  inboundCount: number;
}

export interface ConversationsResponse {
  conversations: ConversationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ===========================================
// Dashboard Types
// ===========================================

export interface DashboardStats {
  totalClients: number;
  optedInClients: number;
  optedOutClients: number;
  totalMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  failedMessages: number;
  activeCampaigns: number;
  totalCampaigns: number;
  templatesCount: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ===========================================
// User/Auth Types
// ===========================================

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ===========================================
// API Request/Response Types
// ===========================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface SendMessageInput {
  clientIds: string[];
  content: string;
  campaignId?: string;
}

export interface SendMessageResult {
  sent: number;
  failed: number;
  errors?: string[];
}

// ===========================================
// Campaign Send (POST /campaigns/:id/send)
// ===========================================

export interface SendCampaignResult {
  campaignId: string;
  recipientCount: number;
}

// ===========================================
// Audience Count (GET /clients/count?audience=)
// ===========================================

/**
 * Audience modes exposed by /clients/count. MANUAL is intentionally absent —
 * the form composes MANUAL counts locally from the picked recipient IDs.
 */
export type CountAudienceMode = 'ALL' | 'PREV_YEAR_ACTIVE';

export interface ClientCountResult {
  count: number;
  audience: CountAudienceMode;
}