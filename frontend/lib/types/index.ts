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

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  status: CampaignStatus;
  scheduleTime: string | null;
  recurrence: string | null;
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
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
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