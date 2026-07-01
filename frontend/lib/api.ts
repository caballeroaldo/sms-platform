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
  DashboardStats,
  LoginInput,
  RegisterInput,
  AuthResponse,
  SendMessageInput,
  SendMessageResult,
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
  if (typeof window !== 'undefined' && !authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
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
    const template = input.templateId ? mockState.templates.find(t => t.id === input.templateId) : undefined;
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: input.name,
      description: input.description || null,
      templateId: input.templateId || null,
      status: input.scheduleTime ? 'SCHEDULED' : 'DRAFT',
      scheduleTime: input.scheduleTime || null,
      recurrence: input.recurrence || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      template: template ? { id: template.id, name: template.name, category: template.category } : undefined,
      stats: { PENDING: 0, QUEUED: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
    };
    mockState.campaigns.unshift(newCampaign);
    return { success: true, data: newCampaign };
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

  async getMessages(params?: { page?: number; limit?: number; status?: string; campaignId?: string; clientId?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.campaignId) query.set('campaignId', params.campaignId);
    if (params?.clientId) query.set('clientId', params.clientId);
    return apiFetch<{ messages: Message[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/messages?${query}`);
  },

  async sendMessage(input: SendMessageInput) {
    return apiFetch<SendMessageResult>('/messages/send-now', { method: 'POST', body: JSON.stringify(input) });
  },

  async getDashboardStats() {
    return apiFetch<DashboardStats>('/dashboard/stats');
  },
};

export default api;