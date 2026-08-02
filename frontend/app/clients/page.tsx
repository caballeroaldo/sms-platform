'use client';

/**
 * Clients Page
 * List and manage SMS clients
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useClients, useDebounce, useCreateClient, useUpdateClient, useDeleteClient, useImportClients } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import { Modal } from '@/lib/components/Modal';
import { ClientForm } from '@/lib/components/ClientForm';
import { ConfirmDialog } from '@/lib/components/ConfirmDialog';
import type { Client, CreateClientInput, ImportClientsResult } from '@/lib/types';

export default function ClientsPage() {
  // Protect this route - redirect to login if not authenticated
  useRequireAuth();

  const [search, setSearch] = useState('');
  const [showOptedOut, setShowOptedOut] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteClientName, setDeleteClientName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportClientsResult | null>(null);

  // Hidden file input — the "Import CSV" button proxies the click so we don't
  // need a styled native file picker in the header.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search to avoid excessive API calls (300ms delay)
  const debouncedSearch = useDebounce(search, 300);

  // Get data from query
  const { data, isLoading, error, refetch } = useClients({
    search: debouncedSearch || undefined,
    optedOut: showOptedOut ? undefined : false,
  });

  // Mutations
  const createClient = useCreateClient({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error || 'Failed to create client');
    },
  });

  const updateClient = useUpdateClient({
    onSuccess: () => {
      setIsEditModalOpen(false);
      setSelectedClient(null);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error || 'Failed to update client');
    },
  });

  const deleteClient = useDeleteClient({
    onSuccess: () => {
      setDeleteClientId(null);
      setDeleteClientName('');
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error || 'Failed to delete client');
    },
  });

  const importClients = useImportClients({
    onSuccess: (result) => {
      setImportResult(result);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error || 'Failed to import CSV');
    },
  });

  // Only use API data - no mock fallback
  const clients = data?.clients || [];

  // Handlers
  const handleAddClick = () => {
    setIsAddModalOpen(true);
    setErrorMessage(null);
  };

  const handleEditClick = (client: Client) => {
    setSelectedClient(client);
    setIsEditModalOpen(true);
    setErrorMessage(null);
  };

  const handleDeleteClick = (client: Client) => {
    setDeleteClientId(client.id);
    setDeleteClientName(`${client.firstName} ${client.lastName}`.trim() || 'this client');
    setErrorMessage(null);
  };

  const handleAddSubmit = (input: CreateClientInput) => {
    createClient.mutate(input);
  };

  const handleEditSubmit = (input: CreateClientInput) => {
    if (selectedClient) {
      updateClient.mutate({ id: selectedClient.id, data: input });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteClientId) {
      deleteClient.mutate(deleteClientId);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteClientId(null);
    setDeleteClientName('');
  };

  const handleImportClick = () => {
    setImportResult(null);
    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input value so selecting the SAME file twice fires onChange
    // again (otherwise the second pick is a no-op).
    e.target.value = '';
    if (!file) return;
    importClients.mutate(file);
  };

  // Log error for debugging
  if (error) {
    console.error('Clients fetch error:', error);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header - Dark theme matching navigation */}
      <div className="mb-6 pb-6 border-b border-slate-600 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-300 mt-1">Manage your SMS recipients and contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelected}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            onClick={handleImportClick}
            disabled={importClients.isPending}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Import clients from a CSV report"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {importClients.isPending ? 'Importing…' : 'Import CSV'}
          </button>
          <button
            onClick={handleAddClick}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <p className="text-sm">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="text-sm space-y-1 flex-1">
              <p className="font-semibold">
                Import complete{importResult.asOf ? ` (report as of ${importResult.asOf})` : ''}
              </p>
              <p>
                Created <span className="font-medium">{importResult.created}</span>
                {' · '}
                Updated <span className="font-medium">{importResult.existing}</span>
                {' · '}
                Skipped <span className="font-medium">{importResult.skipped.length}</span>
                {importResult.errors.length > 0 && (
                  <>
                    {' · '}
                    Errors <span className="font-medium text-red-700">{importResult.errors.length}</span>
                  </>
                )}
                {' · '}
                {importResult.totalRows} rows read
              </p>
              {importResult.skipped.length > 0 && (
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer hover:text-slate-800">
                    View {importResult.skipped.length} skipped row{importResult.skipped.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-1 space-y-0.5 ml-2">
                    {importResult.skipped.slice(0, 50).map((s) => (
                      <li key={s.lineNumber}>
                        Line {s.lineNumber}
                        {s.firstName || s.lastName || s.phone ? ` — ${[s.firstName, s.lastName].filter(Boolean).join(' ')}${s.phone ? ` (${s.phone})` : ''}` : ''}
                        : {s.reason}
                      </li>
                    ))}
                    {importResult.skipped.length > 50 && (
                      <li className="italic">…and {importResult.skipped.length - 50} more</li>
                    )}
                  </ul>
                </details>
              )}
              {importResult.errors.length > 0 && (
                <details className="text-xs text-red-700">
                  <summary className="cursor-pointer hover:text-red-900">
                    View {importResult.errors.length} error{importResult.errors.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-1 space-y-0.5 ml-2">
                    {importResult.errors.map((e) => (
                      <li key={e.lineNumber}>
                        Line {e.lineNumber}{e.phone ? ` (${e.phone})` : ''}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-green-700 hover:text-green-900 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOptedOut}
              onChange={(e) => setShowOptedOut(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-600">Show opted-out</span>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingScreen message="Loading clients..." />}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Failed to load clients</p>
          <p className="text-sm mt-1">{String(error)}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-cyan-600 hover:text-cyan-800"
          >
            Click to reload
          </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No clients found
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-medium">
                          {client.firstName?.[0]}{client.lastName?.[0]}
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
                      {client._count?.outboundMessages || 0} messages
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/clients/${client.id}/conversation`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          View Chat
                        </Link>
                        <button
                          onClick={() => handleEditClick(client)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(client)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
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

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Client"
        size="md"
      >
        <ClientForm
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddModalOpen(false)}
          isLoading={createClient.isPending}
        />
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedClient(null);
        }}
        title="Edit Client"
        size="md"
      >
        <ClientForm
          client={selectedClient}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setIsEditModalOpen(false);
            setSelectedClient(null);
          }}
          isLoading={updateClient.isPending}
        />
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteClientId}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete Client"
        message={`Are you sure you want to opt-out ${deleteClientName}? They will no longer receive SMS messages.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteClient.isPending}
      />
    </div>
  );
}