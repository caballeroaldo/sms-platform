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
  SendCampaignResult,
  ClientCountResult,
  CountAudienceMode,
  ImportClientsResult,
  ConversationsResponse,
  ConversationMessage,
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

interface UseImportClientsOptions {
  onSuccess?: (result: ImportClientsResult) => void;
  onError?: (error: string) => void;
}

/**
 * POST /clients/import — bulk-import a periodic tax-season CSV report. The
 * mutationFn reads the File to text (file.text()) and posts the raw CSV string
 * with Content-Type text/csv. On success it invalidates the clients list AND
 * the dashboard (import changes client counts / audience sizes), then hands
 * the summary {created, existing, skipped, errors, ...} to onSuccess so the
 * page can surface a result banner.
 */
export function useImportClients(options?: UseImportClientsOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const csvText = await file.text();
      const response = await api.importClients(csvText);
      if (!response.success) throw new Error(response.error || 'Failed to import CSV');
      return response.data as ImportClientsResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      options?.onSuccess?.(result);
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

interface UseSendCampaignOptions {
  onSuccess?: (result: SendCampaignResult) => void;
  onError?: (error: string) => void;
}

/**
 * POST /campaigns/:id/send — resolves the audience, creates PENDING messages,
 * flips the campaign to RUNNING. The page surfaces the backend's specific 400
 * (e.g. "No opted-in clients filed taxes in the prior calendar year") through
 * onError so the user gets a context-aware empty-audience message.
 */
export function useSendCampaign(options?: UseSendCampaignOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.sendCampaign(id);
      if (!response.success) throw new Error(response.error || 'Failed to send campaign');
      return response.data as SendCampaignResult;
    },
    onSuccess: (result, id) => {
      // Invalidate campaign(s) — the flipped-to-RUNNING status + new stats
      // need to show up, and we also need the messages list to reflect the
      // newly created PENDING rows.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', id] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Campaign send created outbound messages → inbox left-column recency +
      // counts are now stale. Prefix-match refreshes every ['conversations',…]
      // and the active ['conversation', clientId] thread subscribers.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      options?.onSuccess?.(result);
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

// ===========================================
// Client Count (preview audience size)
// ===========================================

interface UseClientCountParams {
  /**
   * Accepts the full {ALL, PREV_YEAR_ACTIVE, MANUAL} vocabulary so the form
   * can pass its current audience without filtering first. The hook itself
   * only queries the server for ALL/PREV_YEAR_ACTIVE — MANUAL is gated off
   * via `params?.audience !== 'MANUAL'` below.
   */
  audience?: CountAudienceMode | 'MANUAL';
}

/**
 * GET /clients/count?audience=ALL|PREV_YEAR_ACTIVE
 * Used by the campaign form and the send-confirmation modal to show how many
 * opted-in clients the chosen audience would resolve to before sending.
 *
 * MANUAL is intentionally handled by the component (the form holds the picked
 * ids in local state, so `enabled: audience !== 'MANUAL'`).
 */
export function useClientCount(params?: UseClientCountParams) {
  const { isAuthenticated } = useAuth();

  // Strip MANUAL before forwarding — the server only handles ALL /
  // PREV_YEAR_ACTIVE, and `enabled` below prevents this queryFn from
  // running when the caller passed MANUAL anyway.
  const apiParams: { audience?: CountAudienceMode } | undefined =
    params && params.audience !== 'MANUAL' ? { audience: params.audience } : undefined;

  return useQuery({
    queryKey: ['clients', 'count', params?.audience ?? 'ALL'],
    queryFn: async () => {
      const response = await api.getClientCount(apiParams);
      if (!response.success) throw new Error(response.error);
      return response.data as ClientCountResult;
    },
    enabled: !!isAuthenticated && params?.audience !== 'MANUAL',
    // Counts change only when a client is added/opted-out/refiled — a longer
    // staleTime avoids re-fetching every focus event.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
      // A sent message changes recency + outbound counts in the inbox list and
      // the active thread. Prefix-match refreshes all ['conversations',…] and
      // ['conversation', clientId] subscribers.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      options?.onError?.(error.message);
    },
  });
}

// ===========================================
// Conversation Hooks (inbox)
// ===========================================

interface UseConversationsParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * GET /messages/conversations — the inbox left-column aggregate: every client
 * (with-message ones first by most-recent message, zero-message after) with a
 * preview of the last message + outbound/inbound counts. Read-only, safe in
 * real-Twilio mode.
 *
 * Polls every 12s so new inbound replies bubble to the top while the inbox is
 * open (no WebSockets). Mirrors useMessages' retry policy (skip 401s).
 */
export function useConversations(params?: UseConversationsParams) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['conversations', params?.page ?? 1, params?.limit ?? 50, params?.search ?? ''],
    queryFn: async () => {
      const response = await api.getConversations(params);
      if (!response.success) throw new Error(response.error);
      return response.data as ConversationsResponse;
    },
    enabled: !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 12_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * GET /messages/client/:clientId — the merged outbound+inbound thread for one
 * client (the right pane of the inbox). Inbound rows are normalized to
 * `content` + `type:'inbound'` by the backend so replies render as left bubbles.
 *
 * Polls every 12s so inbound replies appear without a manual refresh.
 */
export function useConversation(clientId: string) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['conversation', clientId],
    queryFn: async () => {
      const response = await api.getClientMessages(clientId);
      if (!response.success) throw new Error(response.error);
      return response.data as ConversationMessage[];
    },
    enabled: !!clientId && !!isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 12_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}