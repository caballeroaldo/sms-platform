/**
 * SMS Platform - API Client
 * Supports both real API and mock data for development
 */

import type {
  Client,
  ClientListResponse,
  CreateClientInput,
  Template,
  CreateTemplateInput,
  Campaign,
  CampaignListResponse,
  CreateCampaignInput,
  Message,
  ConversationMessage,
  ConversationListItem,
  ConversationsResponse,
  DashboardStats,
  LoginInput,
  RegisterInput,
  AuthResponse,
  SendMessageInput,
  SendMessageResult,
  SendCampaignResult,
  CountAudienceMode,
  ClientCountResult,
  ImportClientsResult,
  ApiResponse,
} from '@/lib/types';

import {
  mockClients,
  mockTemplates,
  mockCampaigns,
  mockMessages,
  mockDashboardStats,
  simulateDelay,
  filterClients,
  filterCampaigns,
  filterTemplates,
} from './mockData';

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Use mock data when API is not available
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !process.env.NEXT_PUBLIC_API_URL;

// Token storage (simple implementation)
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    // Always read fresh from localStorage to avoid stale state
    return localStorage.getItem('auth_token');
  }
  return null;
};

// ===========================================
// API Fetch Helper
// ===========================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ===========================================
// Mock API Handlers
// ===========================================

let mockState = {
  clients: [...mockClients],
  templates: [...mockTemplates],
  campaigns: [...mockCampaigns],
  messages: [...mockMessages],
};

const mockApi = {
  // Auth
  async login(input: LoginInput): Promise<ApiResponse<AuthResponse>> {
    await simulateDelay();
    if (input.email === 'admin@example.com' && input.password === 'admin123') {
      return {
        success: true,
        data: {
          token: 'mock-jwt-token-12345',
          user: { id: 'user-1', email: 'admin@example.com', role: 'ADMIN' },
        },
      };
    }
    return { success: false, error: 'Invalid credentials' };
  },

  async register(input: RegisterInput): Promise<ApiResponse<AuthResponse>> {
    await simulateDelay();
    if (!input.email || !input.password) {
      return { success: false, error: 'Email and password are required' };
    }
    if (input.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      return { success: false, error: 'Invalid email format' };
    }
    // Mock registration - in real app would check for existing user
    return {
      success: true,
      data: {
        token: `mock-jwt-token-${Date.now()}`,
        user: {
          id: `user-${Date.now()}`,
          email: input.email,
          role: 'USER' as const,
        },
      },
    };
  },

  // Clients
  async getClients(params?: {
    page?: number;
    limit?: number;
    search?: string;
    optedOut?: boolean;
  }): Promise<ApiResponse<ClientListResponse>> {
    await simulateDelay();
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const filtered = filterClients(mockState.clients, {
      search: params?.search,
      optedOut: params?.optedOut,
    });
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return {
      success: true,
      data: {
        clients: items,
        pagination: {
          page,
          limit,
          total: filtered.length,
          pages: Math.ceil(filtered.length / limit),
        },
      },
    };
  },

  async getClient(id: string): Promise<ApiResponse<Client>> {
    await simulateDelay();
    const client = mockState.clients.find(c => c.id === id);
    if (!client) return { success: false, error: 'Client not found' };
    return { success: true, data: client };
  },

  async createClient(input: CreateClientInput): Promise<ApiResponse<Client>> {
    await simulateDelay();
    const newClient: Client = {
      id: `cl-${Date.now()}`,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email || null,
      birthday: input.birthday || null,
      taxFiledDate: null,
      taxReturnType: null,
      taxpayerStatus: null,
      inactive: false,
      clientLY: false,
      clientNew: false,
      notes: input.notes || '',
      optedOut: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { outboundMessages: 0, inboundMessages: 0 },
    };
    mockState.clients.unshift(newClient);
    return { success: true, data: newClient };
  },

  async updateClient(id: string, data: Partial<Client>): Promise<ApiResponse<Client>> {
    await simulateDelay();
    const index = mockState.clients.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Client not found' };
    mockState.clients[index] = { ...mockState.clients[index], ...data, updatedAt: new Date().toISOString() };
    return { success: true, data: mockState.clients[index] };
  },

  async deleteClient(id: string): Promise<ApiResponse<Client>> {
    await simulateDelay();
    const index = mockState.clients.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Client not found' };
    // Soft delete - set optedOut to true for compliance
    mockState.clients[index] = {
      ...mockState.clients[index],
      optedOut: true,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: mockState.clients[index], message: 'Client opted out successfully' };
  },

  // Mock CSV import: don't parse the text — just report a plausible no-op
  // summary so the UI flow can be exercised without a backend. Every row is
  // treated as "existing" so mock imports never silently mutate the list.
  async importClients(_csvText: string): Promise<ApiResponse<ImportClientsResult>> {
    await simulateDelay();
    return {
      success: true,
      data: {
        created: 0,
        existing: 0,
        skipped: [],
        errors: [],
        totalRows: 0,
        asOf: null,
      },
    };
  },

  // Templates
  async getTemplates(params?: { category?: string }): Promise<ApiResponse<Template[]>> {
    await simulateDelay();
    const filtered = filterTemplates(mockState.templates, {
      category: params?.category as Template['category'],
    });
    return { success: true, data: filtered };
  },

  async getTemplate(id: string): Promise<ApiResponse<Template>> {
    await simulateDelay();
    const template = mockState.templates.find(t => t.id === id);
    if (!template) return { success: false, error: 'Template not found' };
    return { success: true, data: template };
  },

  async createTemplate(input: CreateTemplateInput): Promise<ApiResponse<Template>> {
    await simulateDelay();
    const newTemplate: Template = {
      id: `tpl-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.templates.push(newTemplate);
    return { success: true, data: newTemplate };
  },

  async updateTemplate(id: string, data: Partial<CreateTemplateInput>): Promise<ApiResponse<Template>> {
    await simulateDelay();
    const index = mockState.templates.findIndex(t => t.id === id);
    if (index === -1) return { success: false, error: 'Template not found' };
    if (data.name) {
      const conflict = mockState.templates.find(
        (t) => t.name === data.name && t.id !== id
      );
      if (conflict) return { success: false, error: 'Template name already exists' };
    }
    const updated: Template = {
      ...mockState.templates[index],
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.content !== undefined && { content: data.content }),
      updatedAt: new Date().toISOString(),
    };
    mockState.templates[index] = updated;
    return { success: true, data: updated };
  },

  async deleteTemplate(id: string): Promise<ApiResponse<Template | { usedIn: { id: string; name: string }[] }>> {
    await simulateDelay();
    const index = mockState.templates.findIndex(t => t.id === id);
    if (index === -1) return { success: false, error: 'Template not found' };
    const usedIn = (mockState as any).campaigns
      ? (mockState as any).campaigns
          .filter((c: any) => c.templateId === id)
          .map((c: any) => ({ id: c.id, name: c.name }))
      : [];
    if (usedIn.length > 0) {
      return { success: false, error: 'Template is used in campaigns', data: { usedIn } };
    }
    mockState.templates.splice(index, 1);
    return { success: true, message: 'Template deleted' };
  },

  // Campaigns
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<CampaignListResponse>> {
    await simulateDelay();
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const filtered = filterCampaigns(mockState.campaigns, {
      status: params?.status as Campaign['status'],
    });
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return {
      success: true,
      data: {
        campaigns: items,
        pagination: {
          page,
          limit,
          total: filtered.length,
          pages: Math.ceil(filtered.length / limit),
        },
      },
    };
  },

  async getCampaign(id: string): Promise<ApiResponse<Campaign>> {
    await simulateDelay();
    const campaign = mockState.campaigns.find(c => c.id === id);
    if (!campaign) return { success: false, error: 'Campaign not found' };
    return { success: true, data: campaign };
  },

  async createCampaign(input: CreateCampaignInput): Promise<ApiResponse<Campaign>> {
    await simulateDelay();
    if (!input.name) return { success: false, error: 'Campaign name is required' };
    const audience = input.audience ?? 'ALL';
    const manualIds = audience === 'MANUAL' ? (input.manualRecipientIds ?? []) : [];
    if (audience === 'MANUAL' && manualIds.length === 0) {
      return { success: false, error: 'Manual audience requires at least one recipient' };
    }
    const template = input.templateId ? mockState.templates.find(t => t.id === input.templateId) : undefined;
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: input.name,
      description: input.description || null,
      templateId: input.templateId || null,
      status: input.scheduleTime ? 'SCHEDULED' : 'DRAFT',
      scheduleTime: input.scheduleTime || null,
      recurrence: input.recurrence || null,
      audience,
      manualRecipientIds: manualIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      template: template ? { id: template.id, name: template.name, category: template.category } : undefined,
      stats: { PENDING: 0, QUEUED: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
    };
    mockState.campaigns.unshift(newCampaign);
    return { success: true, data: newCampaign };
  },

  async updateCampaign(id: string, data: Partial<CreateCampaignInput> & { status?: Campaign['status'] }): Promise<ApiResponse<Campaign>> {
    await simulateDelay();
    const index = mockState.campaigns.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Campaign not found' };
    const existing = mockState.campaigns[index];
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      return { success: false, error: 'Cannot update a running or completed campaign' };
    }
    const nextAudience = (data.audience ?? existing.audience) as Campaign['audience'];
    const nextManualIds = data.manualRecipientIds ?? existing.manualRecipientIds;
    if (nextAudience === 'MANUAL' && nextManualIds.length === 0) {
      return { success: false, error: 'Manual audience requires at least one recipient' };
    }
    let template = existing.template;
    if (data.templateId !== undefined && data.templateId !== existing.templateId) {
      const tpl = data.templateId ? mockState.templates.find(t => t.id === data.templateId) : undefined;
      template = tpl ? { id: tpl.id, name: tpl.name, category: tpl.category } : undefined;
    }
    const updated: Campaign = {
      ...existing,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.templateId !== undefined && { templateId: data.templateId || null }),
      ...(data.scheduleTime !== undefined && { scheduleTime: data.scheduleTime || null }),
      ...(data.recurrence !== undefined && { recurrence: data.recurrence || null }),
      ...(data.status !== undefined ? { status: data.status } : (data.scheduleTime !== undefined ? { status: 'SCHEDULED' as const } : {})),
      audience: nextAudience,
      manualRecipientIds: data.manualRecipientIds ?? existing.manualRecipientIds ?? [],
      template,
      updatedAt: new Date().toISOString(),
    };
    mockState.campaigns[index] = updated;
    return { success: true, data: updated };
  },

  async deleteCampaign(id: string): Promise<ApiResponse<Campaign>> {
    await simulateDelay();
    const index = mockState.campaigns.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Campaign not found' };
    if (mockState.campaigns[index].status === 'RUNNING') {
      return { success: false, error: 'Cancel the campaign first' };
    }
    const [removed] = mockState.campaigns.splice(index, 1);
    return { success: true, data: removed, message: 'Campaign deleted' };
  },

  async sendCampaign(id: string): Promise<ApiResponse<SendCampaignResult>> {
    await simulateDelay();
    const index = mockState.campaigns.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Campaign not found' };
    const campaign = mockState.campaigns[index];
    if (campaign.status === 'RUNNING') {
      return { success: false, error: 'Campaign is already running' };
    }
    if (!campaign.templateId) {
      return { success: false, error: 'Campaign has no template' };
    }
    const template = mockState.templates.find(t => t.id === campaign.templateId);
    if (!template) return { success: false, error: 'Campaign has no template' };
    // Mirror backend's resolveAudienceClientIds: exclude opted-out, intersect MANUAL
    // by manualRecipientIds, and require at least one resolved recipient.
    let resolved: Client[] = mockState.clients.filter((c) => !c.optedOut);
    if (campaign.audience === 'MANUAL') {
      const ids = campaign.manualRecipientIds ?? [];
      if (ids.length === 0) {
        return { success: false, error: 'Manual audience requires at least one recipient' };
      }
      const allowed = new Set(ids);
      resolved = resolved.filter((c) => allowed.has(c.id));
    } else if (campaign.audience === 'PREV_YEAR_ACTIVE') {
      const now = new Date();
      const priorYear = now.getUTCFullYear() - 1;
      const priorStart = new Date(Date.UTC(priorYear, 0, 1, 0, 0, 0));
      const priorEnd = new Date(Date.UTC(priorYear, 11, 31, 23, 59, 59, 999));
      resolved = resolved.filter((c) => {
        if (!c.taxFiledDate) return false;
        const d = new Date(c.taxFiledDate);
        return d >= priorStart && d <= priorEnd;
      });
    }
    if (resolved.length === 0) {
      const empty =
        campaign.audience === 'MANUAL'
          ? 'No recipients remain after filtering opted-out clients from the manual list'
          : campaign.audience === 'PREV_YEAR_ACTIVE'
            ? 'No opted-in clients filed taxes in the prior calendar year'
            : 'No opted-in clients found';
      return { success: false, error: empty };
    }
    // Stamp PENDING messages, mirroring backend: createMany + status flip
    const now = new Date().toISOString();
    const newMessages: Message[] = resolved.map((c) => ({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      clientId: c.id,
      campaignId: campaign.id,
      content: template.content,
      status: 'PENDING' as const,
      twilioSid: null,
      errorMessage: null,
      scheduledAt: campaign.scheduleTime || null,
      sentAt: null,
      createdAt: now,
      type: 'outbound' as const,
      client: { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone },
    }));
    mockState.messages.push(...newMessages);
    mockState.campaigns[index] = { ...campaign, status: 'RUNNING', updatedAt: now };
    return {
      success: true,
      data: { campaignId: id, recipientCount: resolved.length },
    };
  },

  async getClientCount(params?: {
    audience?: CountAudienceMode;
  }): Promise<ApiResponse<ClientCountResult>> {
    await simulateDelay();
    const audience = params?.audience ?? 'ALL';
    const priorYear = new Date().getUTCFullYear() - 1;
    const priorStart = new Date(Date.UTC(priorYear, 0, 1, 0, 0, 0));
    const priorEnd = new Date(Date.UTC(priorYear, 11, 31, 23, 59, 59, 999));
    let count = mockState.clients.filter((c) => !c.optedOut).length;
    if (audience === 'PREV_YEAR_ACTIVE') {
      count = mockState.clients.filter((c) => {
        if (c.optedOut) return false;
        if (!c.taxFiledDate) return false;
        const d = new Date(c.taxFiledDate);
        return d >= priorStart && d <= priorEnd;
      }).length;
    }
    return { success: true, data: { count, audience } };
  },

  // Messages
  async getMessages(params?: {
    page?: number;
    limit?: number;
    status?: string;
    campaignId?: string;
    clientId?: string;
  }): Promise<ApiResponse<{ messages: Message[]; pagination: { page: number; limit: number; total: number; pages: number } }>> {
    await simulateDelay();
    let filtered = [...mockState.messages];
    if (params?.status) filtered = filtered.filter(m => m.status === params.status);
    if (params?.campaignId) filtered = filtered.filter(m => m.campaignId === params.campaignId);
    if (params?.clientId) filtered = filtered.filter(m => m.clientId === params.clientId);

    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      success: true,
      data: {
        messages: items,
        pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
      },
    };
  },

  // Conversations (inbox left-column aggregate). mockMessages is a single array
  // mixing outbound + inbound rows distinguished by `type` ('inbound' vs
  // undefined/'outbound') — mirrors the backend's two-table merge.
  async getConversations(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<ConversationsResponse>> {
    await simulateDelay();
    const page = params?.page || 1;
    const limit = params?.limit || 50;

    const dirOf = (m: Message): 'outbound' | 'inbound' => (m.type === 'inbound' ? 'inbound' : 'outbound');

    const clients = filterClients(mockState.clients, { search: params?.search });

    const lastByClient = new Map<string, { content: string; direction: 'outbound' | 'inbound'; timestamp: string }>();
    const outCountByClient = new Map<string, number>();
    const inCountByClient = new Map<string, number>();
    for (const m of mockState.messages) {
      const dir = dirOf(m);
      if (dir === 'inbound') {
        inCountByClient.set(m.clientId, (inCountByClient.get(m.clientId) ?? 0) + 1);
      } else {
        outCountByClient.set(m.clientId, (outCountByClient.get(m.clientId) ?? 0) + 1);
      }
      const prev = lastByClient.get(m.clientId);
      if (!prev || new Date(m.createdAt).getTime() > new Date(prev.timestamp).getTime()) {
        lastByClient.set(m.clientId, { content: m.content, direction: dir, timestamp: m.createdAt });
      }
    }

    // With-message clients first (lastAt desc), zero-message after (createdAt desc).
    const withMsg = clients
      .filter((c) => lastByClient.has(c.id))
      .sort((a, b) => new Date(lastByClient.get(b.id)!.timestamp).getTime() - new Date(lastByClient.get(a.id)!.timestamp).getTime());
    const withoutMsg = clients
      .filter((c) => !lastByClient.has(c.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = withMsg.length + withoutMsg.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;

    // Page-slice across the with/zero boundary (mirrors the backend route).
    const takeWith = Math.min(limit, Math.max(0, withMsg.length - skip));
    let items = withMsg.slice(skip, skip + takeWith);
    if (items.length < limit) {
      const zeroSkip = items.length > 0 ? 0 : Math.max(0, skip - withMsg.length);
      const remaining = limit - items.length;
      items = items.concat(withoutMsg.slice(zeroSkip, zeroSkip + remaining));
    }

    const conversations: ConversationListItem[] = items.map((c) => {
      const last = lastByClient.get(c.id);
      return {
        client: { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, optedOut: c.optedOut },
        lastMessage: last ? { content: last.content, direction: last.direction, timestamp: last.timestamp } : null,
        outboundCount: outCountByClient.get(c.id) ?? 0,
        inboundCount: inCountByClient.get(c.id) ?? 0,
      };
    });

    return {
      success: true,
      data: { conversations, pagination: { page, limit, total, pages } },
    };
  },

  // Per-client merged thread (GET /messages/client/:clientId). mockMessages
  // already mixes outbound + inbound (tagged via `type`); surface each row's
  // direction so the inbox renders inbound replies as left bubbles.
  async getClientMessages(clientId: string): Promise<ApiResponse<ConversationMessage[]>> {
    await simulateDelay();
    const msgs = mockState.messages
      .filter((m) => m.clientId === clientId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m) => {
        const direction = (m.type === 'inbound' ? 'inbound' : 'outbound') as 'outbound' | 'inbound';
        return { ...m, direction, type: direction };
      });
    return { success: true, data: msgs };
  },

  async sendMessage(input: SendMessageInput): Promise<ApiResponse<SendMessageResult>> {
    await simulateDelay(800);

    // Add new messages to mock state for this client
    const newMessages = input.clientIds.map((clientId) => {
      const newMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        clientId,
        campaignId: input.campaignId || null,
        content: input.content,
        status: 'DELIVERED',
        twilioSid: `SM_MOCK_${Date.now()}`,
        errorMessage: null,
        scheduledAt: null,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        // Get client info from existing mock state
        client: mockState.clients.find(c => c.id === clientId)
          ? {
              id: mockState.clients.find(c => c.id === clientId)!.id,
              firstName: mockState.clients.find(c => c.id === clientId)!.firstName,
              lastName: mockState.clients.find(c => c.id === clientId)!.lastName,
              phone: mockState.clients.find(c => c.id === clientId)!.phone,
            }
          : undefined,
        type: 'outbound',
      };
      return newMsg;
    });

    // Add to mock state
    mockState.messages.push(...newMessages);

    return {
      success: true,
      data: { sent: newMessages.length, failed: 0 },
    };
  },

  // Dashboard
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    await simulateDelay();
    return { success: true, data: mockDashboardStats };
  },
};

// ===========================================
// Export API object (switches between real/mock)
// ===========================================

export const api = USE_MOCK ? mockApi : {
  async login(input: LoginInput) {
    return apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async register(input: RegisterInput) {
    return apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getClients(params?: { page?: number; limit?: number; search?: string; optedOut?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.optedOut !== undefined) query.set('optedOut', String(params.optedOut));
    return apiFetch<ClientListResponse>(`/clients?${query}`);
  },

  async getClient(id: string) {
    return apiFetch<Client>(`/clients/${id}`);
  },

  async createClient(input: CreateClientInput) {
    return apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(input) });
  },

  async updateClient(id: string, data: Partial<Client>) {
    return apiFetch<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteClient(id: string) {
    return apiFetch<Client>(`/clients/${id}`, { method: 'DELETE' });
  },

  // CSV import. Body is raw CSV text (Content-Type: text/csv), NOT JSON —
  // so this can't use the JSON-defaulting apiFetch helper. Always returns JSON.
  async importClients(csvText: string) {
    return apiFetch<ImportClientsResult>('/clients/import', {
      method: 'POST',
      body: csvText,
      headers: { 'Content-Type': 'text/csv' },
    });
  },

  async getTemplates(params?: { category?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    return apiFetch<Template[]>(`/templates?${query}`);
  },

  async getTemplate(id: string) {
    return apiFetch<Template>(`/templates/${id}`);
  },

  async createTemplate(input: CreateTemplateInput) {
    return apiFetch<Template>('/templates', { method: 'POST', body: JSON.stringify(input) });
  },

  async updateTemplate(id: string, data: Partial<CreateTemplateInput>) {
    return apiFetch<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteTemplate(id: string) {
    return apiFetch<Template | { usedIn?: { id: string; name: string }[] }>(`/templates/${id}`, { method: 'DELETE' });
  },

  async getCampaigns(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    return apiFetch<CampaignListResponse>(`/campaigns?${query}`);
  },

  async getCampaign(id: string) {
    return apiFetch<Campaign>(`/campaigns/${id}`);
  },

  async createCampaign(input: CreateCampaignInput) {
    return apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(input) });
  },

  async updateCampaign(id: string, data: Partial<CreateCampaignInput> & { status?: Campaign['status'] }) {
    return apiFetch<Campaign>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteCampaign(id: string) {
    return apiFetch<Campaign>(`/campaigns/${id}`, { method: 'DELETE' });
  },

  async sendCampaign(id: string) {
    return apiFetch<SendCampaignResult>(`/campaigns/${id}/send`, { method: 'POST' });
  },

  async getClientCount(params?: { audience?: CountAudienceMode }) {
    const query = new URLSearchParams();
    if (params?.audience) query.set('audience', params.audience);
    const qs = query.toString();
    return apiFetch<ClientCountResult>(`/clients/count${qs ? `?${qs}` : ''}`);
  },

  async getMessages(params?: { page?: number; limit?: number; status?: string; campaignId?: string; clientId?: string; search?: string; direction?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.campaignId) query.set('campaignId', params.campaignId);
    if (params?.clientId) query.set('clientId', params.clientId);
    if (params?.search) query.set('search', params.search);
    if (params?.direction) query.set('direction', params.direction);
    return apiFetch<{ messages: Message[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/messages?${query}`);
  },

  async sendMessage(input: SendMessageInput) {
    return apiFetch<SendMessageResult>('/messages/send-now', { method: 'POST', body: JSON.stringify(input) });
  },

  async getDashboardStats() {
    return apiFetch<DashboardStats>('/dashboard/stats');
  },

  // Inbox left-column aggregate (GET /messages/conversations) — read-only.
  async getConversations(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    return apiFetch<ConversationsResponse>(`/messages/conversations?${query}`);
  },

  // Merged outbound+inbound thread for one client (GET /messages/client/:clientId).
  async getClientMessages(clientId: string) {
    return apiFetch<ConversationMessage[]>(`/messages/client/${encodeURIComponent(clientId)}`);
  },
};

export default api;