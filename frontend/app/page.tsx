'use client';

/**
 * Dashboard Page
 * Main overview of SMS platform metrics
 */

import { useState } from 'react';
import { useDashboardStats, useMessages, useCampaigns } from '@/lib/hooks/useApi';
import { StatCard, LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import Link from 'next/link';

export default function DashboardPage() {
  // Protect this route - redirect to login if not authenticated
  useRequireAuth();

  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: messagesData, isLoading: messagesLoading } = useMessages({ limit: 5 });
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ status: 'RUNNING' });

  // Log errors for debugging
  if (statsError) {
    console.error('Dashboard stats error:', statsError);
  }

  // Calculate delivery rate
  const deliveryRate = stats?.sentMessages && stats.sentMessages > 0
    ? Math.round((stats.deliveredMessages / stats.sentMessages) * 100)
    : 0;

  // Show loading state if any data is loading
  if (statsLoading) {
    return (
      <div className="p-8">
        <LoadingScreen message="Loading dashboard..." />
      </div>
    );
  }

  // Use API data only - no mock fallback
  const recentMessages = messagesData?.messages || [];
  const activeCampaigns = campaignsData?.campaigns || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your SMS platform metrics</p>
      </div>

      {/* Error State */}
      {statsError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
          <p className="font-semibold">Failed to load dashboard data</p>
          <p className="text-sm mt-1">{String(statsError)}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Click to reload
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Clients"
          value={stats?.totalClients || 0}
          subtitle={`${stats?.optedInClients || 0} opted in`}
          icon="👥"
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Messages Sent"
          value={stats?.sentMessages || 0}
          subtitle={`${deliveryRate}% delivery rate`}
          icon="📨"
          color="purple"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Active Campaigns"
          value={stats?.activeCampaigns || 0}
          subtitle={`${stats?.totalCampaigns || 0} total`}
          icon="🚀"
          color="orange"
        />
        <StatCard
          title="Templates"
          value={stats?.templatesCount || 0}
          subtitle="Message templates"
          icon="📝"
          color="green"
        />
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent Messages</h2>
              <Link href="/messages" className="text-sm text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {recentMessages.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No messages yet</div>
            ) : (
              recentMessages.map((msg) => (
                <div key={msg.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {msg.client?.firstName} {msg.client?.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{msg.content}</p>
                  </div>
                  <StatusBadge status={msg.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Active Campaigns</h2>
              <Link href="/campaigns" className="text-sm text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {activeCampaigns.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No active campaigns</div>
            ) : (
              activeCampaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {campaign.template?.name || 'No template'}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delivery Rate */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivery Performance</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Delivered</span>
                <span className="font-medium">{deliveryRate}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Failed</span>
                <span className="font-medium">
                  {stats?.sentMessages && stats.sentMessages > 0
                    ? Math.round((stats.failedMessages / stats.sentMessages) * 100)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{
                    width: `${stats?.sentMessages && stats.sentMessages > 0
                      ? Math.round((stats.failedMessages / stats.sentMessages) * 100)
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/clients"
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="text-2xl">👥</span>
              <span className="text-sm font-medium text-slate-700">Add Client</span>
            </Link>
            <Link
              href="/campaigns"
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="text-2xl">📨</span>
              <span className="text-sm font-medium text-slate-700">New Campaign</span>
            </Link>
            <Link
              href="/templates"
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="text-2xl">📝</span>
              <span className="text-sm font-medium text-slate-700">Create Template</span>
            </Link>
            <Link
              href="/messages"
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="text-2xl">💬</span>
              <span className="text-sm font-medium text-slate-700">Send Message</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}