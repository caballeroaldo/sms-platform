'use client';

/**
 * Messages → Inbox
 *
 * Desktop split-pane conversation inbox:
 *   - Left pane (<aside w-[340px]>): every client, with-message ones first by
 *     most-recent message (desc), zero-message ones after (createdAt desc) so a
 *     new chat can be started with anyone. Search + Compose in the header,
 *     pagination in the footer.
 *   - Right pane (<section flex-1>): the selected client's thread via
 *     <ConversationThread>, or an empty-state prompt when none is selected.
 *
 * Selection lives in the URL (`?client=<id>`) via router.replace so it survives
 * refresh and can be shared — `useSearchParams` reads it.
 *
 * Next 16: `useSearchParams()` must be used inside a <Suspense> boundary or the
 * build fails prerendering. The default export wraps <InboxInner> in <Suspense>;
 * <InboxInner> owns the hook and all the inbox logic.
 *
 * Mobile responsive collapse is DEFERRED this session (desktop-width only).
 *
 * Read path is safe in real-Twilio mode (Prisma reads only). Compose fires
 * POST /messages/send-now → pre-existing real-Twilio hazard, surfaced via
 * onError inside <ComposeModal>.
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConversations, useDebounce } from '@/lib/hooks/useApi';
import { LoadingScreen } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import { ConversationThread } from '@/lib/components/ConversationThread';
import { ComposeModal } from '@/lib/components/ComposeModal';
import type { ConversationListItem } from '@/lib/types';

// Relative-time formatter (module-level so it's reused across renders).
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelative(dateStr: string): string {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  if (absSec < 45) return rtf.format(Math.round(diffMs / 1000) || 0, 'second');
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
  const diffWk = Math.round(diffDay / 7);
  if (Math.abs(diffWk) < 5) return rtf.format(diffWk, 'week');
  const diffMo = Math.round(diffDay / 30);
  if (Math.abs(diffMo) < 12) return rtf.format(diffMo, 'month');
  return rtf.format(Math.round(diffDay / 365), 'year');
}

function ConversationListRow({
  item,
  selected,
  onSelect,
}: {
  item: ConversationListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { client, lastMessage, outboundCount, inboundCount } = item;
  const displayName = `${client.firstName} ${client.lastName}`;

  return (
    <button
      onClick={() => onSelect(client.id)}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
        selected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium truncate ${client.optedOut ? 'text-slate-400' : 'text-slate-900'}`}>
          {displayName}
          {client.optedOut && <span className="ml-2 text-xs text-red-400">opted out</span>}
        </span>
        {lastMessage && (
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {formatRelative(lastMessage.timestamp)}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 truncate">{client.phone}</div>
      <div className="flex items-center gap-2 mt-1">
        {lastMessage ? (
          <>
            <span className="text-xs text-slate-400">{lastMessage.direction === 'inbound' ? '↙' : '↗'}</span>
            <span className="text-sm text-slate-600 truncate flex-1">{lastMessage.content.slice(0, 60)}</span>
          </>
        ) : (
          <span className="text-sm text-slate-400 italic">Start a new chat</span>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          out:{outboundCount} / in:{inboundCount}
        </span>
      </div>
    </button>
  );
}

function InboxInner() {
  useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('client') ?? '';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const limit = 50;

  const { data, isLoading, error } = useConversations({
    page,
    limit,
    search: debouncedSearch || undefined,
  });

  const conversations = data?.conversations ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const total = pagination?.total ?? 0;

  const selectClient = (id: string) => {
    router.replace(`/messages?client=${encodeURIComponent(id)}`, { scroll: false });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100">
      {/* Left pane — conversation list */}
      <aside className="w-[340px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
              <p className="text-xs text-slate-500">{total} clients</p>
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
            >
              <span>✏️</span> Compose
            </button>
          </div>
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">Loading conversations...</div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-500">
              Failed to load conversations.
              <button
                onClick={() => window.location.reload()}
                className="block mx-auto mt-2 text-blue-600 hover:text-blue-800"
              >
                Reload
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              {search ? 'No clients match your search.' : 'No clients yet.'}
            </div>
          ) : (
            conversations.map((item) => (
              <ConversationListRow
                key={item.client.id}
                item={item}
                selected={item.client.id === selectedId}
                onSelect={selectClient}
              />
            ))
          )}
        </div>

        {/* Footer — pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </aside>

      {/* Right pane — active thread */}
      <section className="flex-1 min-w-0 flex flex-col">
        {selectedId ? (
          <ConversationThread clientId={selectedId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="text-4xl mb-2">💬</div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a client from the list to view their messages</p>
            </div>
          </div>
        )}
      </section>

      {/* Compose modal */}
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading inbox..." />}>
      <InboxInner />
    </Suspense>
  );
}
