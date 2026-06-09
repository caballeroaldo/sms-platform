'use client';

/**
 * Clients Page
 * List and manage SMS clients
 */

import { useState } from 'react';
import { useClients, useCreateClient } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { mockClients } from '@/lib/mockData';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [showOptedOut, setShowOptedOut] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Get data from query
  const { data, isLoading, error } = useClients({
    search: search || undefined,
    optedOut: showOptedOut ? undefined : false,
  });

  // For mock data display
  const clients = data?.clients || mockClients.filter(c => {
    if (!showOptedOut && c.optedOut) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        c.firstName.toLowerCase().includes(s) ||
        c.lastName.toLowerCase().includes(s) ||
        c.phone.includes(s) ||
        (c.email?.toLowerCase().includes(s) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-600 mt-1">
            Manage your SMS recipients and contacts
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOptedOut}
              onChange={(e) => setShowOptedOut(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Show opted-out</span>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingScreen message="Loading clients..." />}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          Failed to load clients. Please try again.
        </div>
      )}

      {/* Clients Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Messages
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No clients found
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-medium">
                          {client.firstName[0]}{client.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {client.firstName} {client.lastName}
                          </p>
                          {client.notes && (
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                              {client.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{client.phone}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {client.email || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={client.optedOut ? 'FAILED' : 'DELIVERED'}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {client._count?.outboundMessages || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination info */}
          {data?.pagination && (
            <div className="px-6 py-4 border-t border-slate-200 text-sm text-slate-600">
              Showing {clients.length} of {data.pagination.total} clients
            </div>
          )}
        </div>
      )}
    </div>
  );
}