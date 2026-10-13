/**
 * SMS Platform - API Client
 * Connects to real backend API
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

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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
        // Preserve data field for validation errors and other detailed error info
        ...(data.data !== undefined ? { data: data.data as T } : {}),
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
// Export API object (always uses real API)
// ===========================================

export const api = {
  // Auth
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

  // Client operations - all use real API to eliminate mock data as requested
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

  // Note: SMS operations use real API for persistence but actual SMS sending
  // is handled by backend configuration (Twilio/Sinch/mock provider)
  async getClientMessages(clientId: string) {
    return apiFetch<ConversationMessage[]>(`/messages/client/${encodeURIComponent(clientId)}`);
  },

  async sendMessage(input: SendMessageInput) {
    return apiFetch<SendMessageResult>('/messages/send-now', { method: 'POST', body: JSON.stringify(input) });
  },

  // Campaign operations
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

  // Template operations - all use real API
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

  // Message operations
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

  // Dashboard
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


};

export default api;