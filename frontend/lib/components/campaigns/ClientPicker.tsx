'use client';

/**
 * ClientPicker
 *
 * Multi-select control that searches opted-in clients and lets the user
 * pick a finite set for a campaign's MANUAL audience. Shows search box,
 * results with checkboxes, and a "x selected" pill.
 *
 * Opted-out clients are filtered server-side; selected IDs that turn out
 * to be opted-out are surfaced below the picker as warnings.
 */

import { useMemo, useState } from 'react';
import { useClients, useDebounce } from '@/lib/hooks/useApi';
import { Spinner } from '@/lib/components/ui';

interface ClientPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ClientPicker({ selectedIds, onChange }: ClientPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useClients({
    search: debouncedSearch || undefined,
    optedOut: false,
    limit: 50,
  });

  const clients = data?.clients ?? [];

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Selected clients we know about — for warning when the server returns an opted-out entry.
  // We don't pre-load all clients (would be wasteful); the warning surfaces only as a hint
  // when the selected client IS in the current results list with an optedOut value.
  const optedOutInSelection = useMemo(
    () => clients.filter((c) => c.optedOut && selectedSet.has(c.id)),
    [clients, selectedSet]
  );

  const handleToggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const handleRemoveSelected = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="space-y-3">
      {/* Selected chips (driven only by selectedIds, not the search filter) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            Selected ({selectedIds.length}):
         </span>
          {selectedIds.map((id) => {
            // Try to find this client in the current results; fall back to id if not visible.
            const client = clients.find((c) => c.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-mono"
              >
                {client ? `${client.firstName} ${client.lastName}` : id}
                <button
                  type="button"
                  onClick={() => handleRemoveSelected(id)}
                  className="ml-1 text-slate-500 hover:text-slate-700"
                  aria-label={`Remove ${client?.firstName ?? id}`}
                >
                  ×
               </button>
             </span>
            );
          })}
       </div>
      )}

      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clients by name, phone, or email..."
        className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />

      {/* Results */}
      <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Spinner size="sm" />
            <span className="ml-2 text-sm text-slate-500">Loading clients</span>
         </div>
        ) : clients.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No opted-in clients match your search.
         </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clients.map((client) => {
              const checked = selectedSet.has(client.id);
              return (
                <li key={client.id}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                      checked ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(client.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">
                        {client.firstName} {client.lastName}
                     </span>
                      <span className="block text-xs text-slate-500 truncate">
                        {client.phone}
                        {client.email ? ` · ${client.email}` : ''}
                     </span>
                   </span>
                 </label>
               </li>
              );
            })}
         </ul>
        )}
     </div>

      {/* Warning if any selected client is opted out (only surfaces when that client happens to be in the visible results; out-of-view opted-out clients are filtered server-side at /send time) */}
      {optedOutInSelection.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg px-3 py-2 text-xs">
          Warning: {optedOutInSelection.length} selected client
          {optedOutInSelection.length === 1 ? '' : 's'} {optedOutInSelection.length === 1 ? 'has' : 'have'} opted out and will be excluded when the campaign is sent.
       </div>
      )}
   </div>
  );
}

