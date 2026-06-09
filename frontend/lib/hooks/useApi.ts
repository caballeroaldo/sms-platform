'use client';

/**
 * React Query Hooks for SMS Platform
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateClientInput,
  CreateTemplateInput,
  CreateCampaignInput,
  SendMessageInput,
  Client,
  Template,
  Campaign,
  Message,
  DashboardStats,
} from '@/lib/types';

// ===========================================
// Dashboard Hooks
// ===========================================

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.getDashboardStats();
      if (!response.success) throw new Error(response.error);
      return response.data as DashboardStats;
    },
  });
}

// ===========================================
// Client Hooks
// ===========================================

interface UseClientsParams {
  page?: number;
  limit?: number;
  search?: string;
  optedOut?: boolean;
}

export function useClients(params?: UseClientsParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const response = await api.getClients(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const response = await api.getClient(id);
      if (!response.success) throw new Error(response.error);
      return response.data as Client;
    },
    enabled: !!id,
  });
}

interface UseCreateClientOptions {
  onSuccess?: () => void;
}

export function useCreateClient(options?: UseCreateClientOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      const response = await api.createClient(input);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      options?.onSuccess?.();
    },
  });
}

interface UseUpdateClientOptions {
  onSuccess?: () => void;
}

export function useUpdateClient(options?: UseUpdateClientOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const response = await api.updateClient(id, data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', id] });
      options?.onSuccess?.();
    },
  });
}

// ===========================================
// Template Hooks
// ===========================================

interface UseTemplatesParams {
  category?: string;
}

export function useTemplates(params?: UseTemplatesParams) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: async () => {
      const response = await api.getTemplates(params);
      if (!response.success) throw new Error(response.error);
      return response.data as Template[];
    },
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: async () => {
      const response = await api.getTemplate(id);
      if (!response.success) throw new Error(response.error);
      return response.data as Template;
    },
    enabled: !!id,
  });
}

interface UseCreateTemplateOptions {
  onSuccess?: () => void;
}

export function useCreateTemplate(options?: UseCreateTemplateOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const response = await api.createTemplate(input);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      options?.onSuccess?.();
    },
  });
}

// ===========================================
// Campaign Hooks
// ===========================================

interface UseCampaignsParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function useCampaigns(params?: UseCampaignsParams) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const response = await api.getCampaigns(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const response = await api.getCampaign(id);
      if (!response.success) throw new Error(response.error);
      return response.data as Campaign;
    },
    enabled: !!id,
  });
}

interface UseCreateCampaignOptions {
  onSuccess?: () => void;
}

export function useCreateCampaign(options?: UseCreateCampaignOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const response = await api.createCampaign(input);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      options?.onSuccess?.();
    },
  });
}

// ===========================================
// Message Hooks
// ===========================================

interface UseMessagesParams {
  page?: number;
  limit?: number;
  status?: string;
  campaignId?: string;
  clientId?: string;
}

export function useMessages(params?: UseMessagesParams) {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: async () => {
      const response = await api.getMessages(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
  });
}

interface UseSendMessageOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useSendMessage(options?: UseSendMessageOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const response = await api.sendMessage(input);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}