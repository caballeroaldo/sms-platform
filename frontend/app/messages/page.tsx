'use client';

/**
 * Messages Page
 * View message history and send new messages
 */

import { useState } from 'react';
import { useMessages, useSendMessage, useClients } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import type { Message } from '@/lib/types';

export default function MessagesPage() {
  // Protect this route - redirect to login if not authenticated
  useRequireAuth();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useMessages({
    status: statusFilter || undefined,
  });

  // For client selection in compose
  const { data: clientsData } = useClients({ limit: 100, optedOut: false });

  // Send message mutation
  const sendMessage = useSendMessage({
    onSuccess: () => {
      setShowComposeModal(false);
      setSelectedClients([]);
      setMessageContent('');
    },
  });

  // Only use API data - no mock fallback
  const messages: Message[] = data?.messages || [];

  // Log error for debugging
  if (error) {
    console.error('Messages fetch error:', error);
  }

  const handleSendMessage = () => {
    if (selectedClients.length === 0 || !messageContent.trim()) return;

    sendMessage.mutate({
      clientIds: selectedClients,
      content: messageContent,
    });
  };

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'SENT', label: 'Sent' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'FAILED', label: 'Failed' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-slate-600 mt-1">
            View and send SMS messages
          </p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>✏️</span> Compose
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      {isLoading && <LoadingScreen message="Loading messages..." />}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Failed to load messages</p>
          <p className="text-sm mt-1">{String(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Click to reload
          </button>
        </div>
      )}

      {/* Messages Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No messages found
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">
                        {msg.client?.firstName} {msg.client?.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {msg.client?.phone}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-[300px] truncate">
                        {msg.content}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={msg.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {msg.sentAt
                        ? new Date(msg.sentAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {data?.pagination && (
            <div className="px-6 py-4 border-t border-slate-200 text-sm text-slate-600 flex justify-between">
              <span>Showing {messages.length} messages</span>
              <span>Total: {data.pagination.total}</span>
            </div>
          )}
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Compose Message</h2>
            </div>
            <div className="p-6 space-y-4">
              {clientsData?.clients && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Recipients
                  </label>
                  <div className="max-h-40 overflow-auto border border-slate-300 rounded-lg p-2 space-y-1">
                    {clientsData.clients
                      .filter((c) => !c.optedOut)
                      .map((client) => (
                        <label
                          key={client.id}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClients([...selectedClients, client.id]);
                              } else {
                                setSelectedClients(selectedClients.filter((id) => id !== client.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">
                            {client.firstName} {client.lastName} - {client.phone}
                          </span>
                        </label>
                      ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedClients.length} recipient(s) selected
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Message Content
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {messageContent.length} characters
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={
                  selectedClients.length === 0 ||
                  !messageContent.trim() ||
                  sendMessage.isPending
                }
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendMessage.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}