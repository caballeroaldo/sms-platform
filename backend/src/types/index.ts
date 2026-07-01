/**
 * SMS Platform - Type Definitions
 * Shared TypeScript interfaces
 */

import { UserRole, ConsentType, TemplateCategory, CampaignStatus, RecurrenceType, MessageStatus } from '@prisma/client';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ===========================================
// Auth Types
// ===========================================

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// ===========================================
// Client Types
// ===========================================

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthday?: string;  // ISO date string from JSON body
  notes?: string;
  optedOut?: boolean;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}

// Phone number in E.164 format
export type E164Phone = string;

// ===========================================
// Template Types
// ===========================================

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  content: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {}

export interface RenderTemplateInput {
  template: string;
  variables: Record<string, string | Date | number>;
}

// ===========================================
// Campaign Types
// ===========================================

export interface CreateCampaignInput {
  name: string;
  description?: string;
  templateId?: string;
  scheduleTime?: Date;
  recurrence?: RecurrenceType;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: CampaignStatus;
}

// ===========================================
// Message Types
// ===========================================

export interface SendMessageInput {
  clientId: string;
  content: string;
  campaignId?: string;
  scheduledAt?: Date;
}

export interface SendBulkMessageInput {
  clientIds: string[];
  content: string;
  campaignId?: string;
  scheduledAt?: Date;
}

export interface ScheduleMessageInput {
  clientId: string;
  campaignId?: string;
  templateId: string;
  scheduledAt: Date;
  variables?: Record<string, string>;
}

// ===========================================
// Export all enums for external use
// ===========================================

export { UserRole, ConsentType, TemplateCategory, CampaignStatus, RecurrenceType, MessageStatus };