'use client';

/**
 * Campaigns Page
 * List and manage SMS campaigns
 */

import { useState } from 'react';
import { useCampaigns } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';

export default function CampaignsPage() {
  // Protect this route - redirect to login if not authenticated
  useRequireAuth();

  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useCampaigns({
    status: statusFilter || undefined,
  });

  // Only use API data - no mock fallback
  const campaigns = data?.campaigns || [];

  // Log error for debugging
  if (error) {
    console.error('Campaigns fetch error:', error);
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'RUNNING', label: 'Running' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header - Dark theme matching navigation */}
      <div className="mb-6 pb-6 border-b border-slate-600 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-300 mt-1">Manage your SMS marketing campaigns</p>
        </div>
        <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
          <span>+</span> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingScreen message="Loading campaigns..." />}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Failed to load campaigns</p>
          <p className="text-sm mt-1">{String(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Click to reload
          </button>
        </div>
      )}

      {/* Campaigns Grid */}
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
                    {campaign.recurrence && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>🔄</span>
                        <span>{campaign.recurrence}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Stats Bar */}
                {campaign.stats && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex gap-4 text-sm">
                      <span className="text-emerald-600">
                        ✓ {campaign.stats.DELIVERED || 0}
                      </span>
                      <span className="text-purple-600">
                        → {campaign.stats.SENT - (campaign.stats.DELIVERED || 0)}
                      </span>
                      <span className="text-red-500">
                        ✗ {campaign.stats.FAILED || 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div className="mt-6 flex justify-center">
          <div className="text-sm text-slate-600">
            Page {data.pagination.page} of {data.pagination.pages}
          </div>
        </div>
      )}
    </div>
  );
}