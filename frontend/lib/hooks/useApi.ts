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
  DashboardStats,
} from '@/lib/types';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';

// ===========================================
// Utility Hooks
// ===========================================

/**
 * Debounce a value by the specified delay
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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
  const { isAuthenticated } = useAuth();

  return useQuery({
    // Use spreadable key for stable comparison
    queryKey: ['clients', params?.page ?? 1, params?.limit ?? 50, params?.search ?? '', params?.optedOut ?? 'all'],
    queryFn: async () => {
      const response = await api.getClients(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useClient(id: string) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const response = await api.getClient(id);
      if (!response.success) throw new Error(response.error);
      return response.data as Client;
    },
    enabled: !!id && !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

interface UseCreateClientOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
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
  onError?: (error: string) => void;
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

interface UseDeleteClientOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useDeleteClient(options?: UseDeleteClientOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.deleteClient(id);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
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
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['templates', params],
    queryFn: async () => {
      const response = await api.getTemplates(params);
      if (!response.success) throw new Error(response.error);
      return response.data as Template[];
    },
    enabled: !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useTemplate(id: string) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['templates', id],
    queryFn: async () => {
      const response = await api.getTemplate(id);
      if (!response.success) throw new Error(response.error);
      return response.data as Template;
    },
    enabled: !!id && !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

interface UseCreateTemplateOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
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
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

interface UseUpdateTemplateOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useUpdateTemplate(options?: UseUpdateTemplateOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTemplateInput> }) => {
      const response = await api.updateTemplate(id, data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', id] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

interface UseDeleteTemplateOptions {
  onSuccess?: () => void;
  // First arg is the error message; second is the list of campaigns the template is used in (when server returns 409).
  onError?: (error: string, usedIn?: { id: string; name: string }[]) => void;
}

export function useDeleteTemplate(options?: UseDeleteTemplateOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.deleteTemplate(id);
      if (!response.success) {
        // Server returns 409 with { data: { usedIn: [...] } } when template is referenced by a campaign.
        const usedIn = (response.data as { usedIn?: { id: string; name: string }[] } | undefined)?.usedIn;
        const err = new Error(response.error || 'Failed to delete template') as Error & {
          usedIn?: { id: string; name: string }[];
        };
        if (usedIn && usedIn.length > 0) err.usedIn = usedIn;
        throw err;
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      const usedIn = (error as Error & { usedIn?: { id: string; name: string }[] }).usedIn;
      options?.onError?.(error.message, usedIn);
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
  onError?: (error: string) => void;
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
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

interface UseUpdateCampaignOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useUpdateCampaign(options?: UseUpdateCampaignOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCampaignInput> & { status?: Campaign['status'] } }) => {
      const response = await api.updateCampaign(id, data);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', id] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

interface UseDeleteCampaignOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useDeleteCampaign(options?: UseDeleteCampaignOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.deleteCampaign(id);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
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
  search?: string;
  direction?: string;
}

export function useMessages(params?: UseMessagesParams) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    // Use spreadable key for stable comparison
    queryKey: ['messages', params?.page ?? 1, params?.limit ?? 50, params?.status ?? '', params?.clientId ?? '', params?.campaignId ?? '', params?.search ?? '', params?.direction ?? ''],
    queryFn: async () => {
      const response = await api.getMessages(params);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    // Only run when authenticated
    enabled: !!isAuthenticated,
    // Don't cache - always fetch fresh data
    staleTime: 0,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Refetch on mount to pick up filter changes
    refetchOnMount: 'always',
    // Retry less since 401s shouldn't be retried
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
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