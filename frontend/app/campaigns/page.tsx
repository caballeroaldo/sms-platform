'use client';

/**
 * Campaigns Page
 *
 * CRUD for SMS campaigns. Backend already exposes
 *   POST   /campaigns
 *   GET    /campaigns/:id
 *   PUT    /campaigns/:id
 *   DELETE /campaigns/:id
 * (plus /:id/send, not wired in this view).
 *
 * Per backend contract:
 *   - Editing is rejected on RUNNING / COMPLETED campaigns ("Cannot update…")
 *   - Deletion is rejected on RUNNING campaigns ("Cancel the campaign first")
 *   - MANUAL audience must include at least one recipient id
 */

import { useState } from 'react';
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useSendCampaign,
} from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import { Modal } from '@/lib/components/Modal';
import { CampaignForm } from '@/lib/components/campaigns/CampaignForm';
import { SendCampaignModal } from '@/lib/components/campaigns/SendCampaignModal';
import { ConfirmDialog } from '@/lib/components/ConfirmDialog';
import type { Campaign, CreateCampaignInput, AudienceType } from '@/lib/types';

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  ALL: 'All opted-in clients',
  PREV_YEAR_ACTIVE: 'Previous tax year active',
  MANUAL: 'Manual selection',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
];

const AUDIENCE_FILTER_OPTIONS = [
  { value: '', label: 'All Audiences' },
  ...(Object.entries(AUDIENCE_LABELS) as [AudienceType, string][]).map(([value, label]) => ({ value, label })),
];

export default function CampaignsPage() {
  useRequireAuth();

  // Status filter (backend)
  const [statusFilter, setStatusFilter] = useState<string>('');
  // Audience filter (client-side — keeping it local to the page for now)
  const [audienceFilter, setAudienceFilter] = useState<string>('');

  // Modal / selection state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [sendCampaign, setSendCampaign] = useState<Campaign | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data
  const { data, isLoading, error } = useCampaigns({
    status: statusFilter || undefined,
  });
  const allCampaigns = (data?.campaigns ?? []) as Campaign[];
  const campaigns = audienceFilter
    ? allCampaigns.filter((c) => c.audience === audienceFilter)
    : allCampaigns;

  // Mutations
  const createCampaign = useCreateCampaign({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err) => setErrorMessage(err || 'Failed to create campaign'),
  });

  const updateCampaign = useUpdateCampaign({
    onSuccess: () => {
      setIsEditModalOpen(false);
      setSelectedCampaign(null);
      setErrorMessage(null);
    },
    onError: (err) => setErrorMessage(err || 'Failed to update campaign'),
  });

  const deleteCampaign = useDeleteCampaign({
    onSuccess: () => {
      setDeleteCampaignId(null);
      setErrorMessage(null);
    },
    onError: (err) => setErrorMessage(err || 'Failed to delete campaign'),
  });

  const sendCampaignMutation = useSendCampaign({
    onSuccess: (result) => {
      setSendCampaign(null);
      setErrorMessage(null);
      setSuccessMessage(
        `Sent ${result.recipientCount.toLocaleString()} message${result.recipientCount === 1 ? '' : 's'} for "${sendCampaign?.name ?? 'campaign'}".`
      );
    },
    onError: (err) => {
      // Modal closes; the page-level banner surfaces the backend's specific 400
      // (e.g. "No opted-in clients filed taxes in the prior calendar year").
      setSendCampaign(null);
      setErrorMessage(err || 'Failed to send campaign');
    },
  });

  // Handlers
  const handleAddClick = () => {
    setIsAddModalOpen(true);
    setErrorMessage(null);
  };

  const handleEditClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsEditModalOpen(true);
    setErrorMessage(null);
  };

  const handleDeleteClick = (campaign: Campaign) => {
    setDeleteCampaignId(campaign.id);
    setErrorMessage(null);
  };

  const handleAddSubmit = (input: CreateCampaignInput) => {
    createCampaign.mutate(input);
  };

  const handleEditSubmit = (input: CreateCampaignInput) => {
    if (selectedCampaign) {
      updateCampaign.mutate({ id: selectedCampaign.id, data: input });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteCampaignId) {
      deleteCampaign.mutate(deleteCampaignId);
    }
  };

  const handleSendClick = (campaign: Campaign) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSendCampaign(campaign);
  };

  const handleSendConfirm = () => {
    if (sendCampaign) {
      sendCampaignMutation.mutate(sendCampaign.id);
    }
  };

  const handleSendCancel = () => {
    setSendCampaign(null);
  };

  if (error) {
    console.error('Campaigns fetch error:', error);
  }

  // Per-status gating helpers
  const canEdit = (c: Campaign) => c.status === 'DRAFT' || c.status === 'SCHEDULED';
  const canDelete = (c: Campaign) => c.status !== 'RUNNING';
  // Sending is allowed whenever the campaign is not already running. COMPLETED
  // / CANCELLED re-sends are permitted by /:id/send (only RUNNING is rejected).
  const canSend = (c: Campaign) => c.status !== 'RUNNING';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 pb-6 border-b border-slate-600 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-300 mt-1">Manage your SMS marketing campaigns</p>
      </div>
        <button
          onClick={handleAddClick}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <span>+</span> New Campaign
      </button>
    </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="text-sm mt-1">{errorMessage}</p>
          </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800 text-xl leading-none"
              aria-label="Dismiss"
            >
              ×
          </button>
        </div>
      </div>
      )}

      {/* Success Banner (after send) */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-semibold">Campaign sent</p>
              <p className="text-sm mt-1">{successMessage}</p>
           </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-700 hover:text-green-900 text-xl leading-none"
              aria-label="Dismiss"
            >
              ×
           </button>
         </div>
       </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
            ))}
        </select>
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
          >
            {AUDIENCE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
            ))}
        </select>
      </div>
    </div>

      {/* Loading */}
      {isLoading && <LoadingScreen message="Loading campaigns..." />}

      {/* Fetch Error */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Failed to load campaigns</p>
          <p className="text-sm mt-1">{String(error)}</p>
      </div>
      )}

      {/* Campaign Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No campaigns found</p>
          </div>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {campaign.name}
                  </h3>
                    <StatusBadge status={campaign.status} />
                </div>
                  {campaign.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {campaign.description}
                </p>
                  )}
                  <div className="space-y-2">
                    {campaign.template && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>📝</span>
                        <span>{campaign.template.name}</span>
                    </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>👥</span>
                      <span>{AUDIENCE_LABELS[campaign.audience]}</span>
                      {campaign.audience === 'MANUAL' && (
                        <span className="text-xs text-slate-400">
                          ({campaign.manualRecipientIds.length} selected)
                      </span>
                      )}
                  </div>
                    {campaign.scheduleTime && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>📅</span>
                        <span>
                          {new Date(campaign.scheduleTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </span>
                    </div>
                    )}
                    {campaign.recurrence && campaign.recurrence !== 'NONE' && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>🔄</span>
                        <span>{campaign.recurrence}</span>
                    </div>
                    )}
                </div>
              </div>

                {/* Stats / Actions footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  {campaign.stats ? (
                    <div className="flex gap-4 text-sm">
                      <span className="text-emerald-600">
                        ✓ {campaign.stats.DELIVERED || 0}
                     </span>
                      <span className="text-purple-600">
                        → {(campaign.stats.SENT || 0) - (campaign.stats.DELIVERED || 0)}
                     </span>
                      <span className="text-red-500">
                        ✗ {campaign.stats.FAILED || 0}
                     </span>
                   </div>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSendClick(campaign)}
                      disabled={!canSend(campaign)}
                      title={canSend(campaign) ? 'Send campaign' : 'Campaign is already running'}
                      className="text-xs text-green-700 hover:text-green-800 font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      Send
                </button>
                    <button
                      onClick={() => handleEditClick(campaign)}
                      disabled={!canEdit(campaign)}
                      title={canEdit(campaign) ? 'Edit campaign' : 'Cannot edit a running or completed campaign'}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      Edit
                  </button>
                    <button
                      onClick={() => handleDeleteClick(campaign)}
                      disabled={!canDelete(campaign)}
                      title={canDelete(campaign) ? 'Delete campaign' : 'Cancel the campaign first'}
                      className="text-xs text-red-600 hover:text-red-700 font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      Delete
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
      </div>
      )}

      {/* Pagination (status filter only; no client-side pagination for audience filter) */}
      {!isLoading && !error && data?.pagination && data.pagination.pages > 1 && !audienceFilter && (
        <div className="mt-6 flex justify-center">
          <div className="text-sm text-slate-600">
            Page {data.pagination.page} of {data.pagination.pages}
        </div>
      </div>
      )}

      {/* Add Campaign Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="New Campaign"
        size="lg"
      >
        <CampaignForm
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddModalOpen(false)}
          isLoading={createCampaign.isPending}
        />
    </Modal>

      {/* Edit Campaign Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCampaign(null);
        }}
        title={selectedCampaign ? `Edit Campaign: ${selectedCampaign.name}` : 'Edit Campaign'}
        size="lg"
      >
        {selectedCampaign && (
          <CampaignForm
            campaign={selectedCampaign}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setIsEditModalOpen(false);
              setSelectedCampaign(null);
            }}
            isLoading={updateCampaign.isPending}
          />
        )}
    </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCampaignId}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteCampaignId(null)}
        title="Delete Campaign"
        message={
          selectedCampaign && deleteCampaignId === selectedCampaign.id
            ? `Are you sure you want to delete "${selectedCampaign.name}"? This will also delete its messages and cannot be undone.`
            : 'Are you sure you want to delete this campaign? This cannot be undone.'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteCampaign.isPending}
      />
      {/* Send Confirmation */}
      <SendCampaignModal
        campaign={sendCampaign}
        isOpen={!!sendCampaign}
        onConfirm={handleSendConfirm}
        onCancel={handleSendCancel}
        isLoading={sendCampaignMutation.isPending}
      />      
  </div>
  );
}
