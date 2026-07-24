'use client';

/**
 * Client Conversation Page
 * Shows message history with a specific client in a chat-style interface
 */

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useClient, useMessages, useSendMessage } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import type { Message } from '@/lib/types';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: ConversationPageProps) {
  // Protect this route - redirect to login if not authenticated
  useRequireAuth();

  const resolvedParams = use(params);
  const clientId = resolvedParams.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Force fresh data when clientId changes (for navigation between clients)
  useEffect(() => {
    // Invalidate and refetch when clientId changes
    queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }, [clientId, queryClient]);

  // Fetch client details
  const { data: clientData, isLoading: clientLoading, error: clientError } = useClient(clientId);

  // Fetch messages for this client
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useMessages({
    clientId,
    limit: 100,
  });

  // Send message mutation
  const sendMessage = useSendMessage({
    onSuccess: () => {
      setMessageText('');
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    },
  });

  // Local state
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Client from API only - no mock fallback (real CUIDs won't match mock IDs)
  const client = clientData;

  // Log errors for debugging
  if (clientError) {
    console.error('Client fetch error:', clientError);
  }
  if (messagesError) {
    console.error('Messages fetch error:', messagesError);
  }

  // Filter messages for this client - always use API data from mockState
  const allMessages = messagesData?.messages || [];

  // Sort messages chronologically (oldest first for chat display)
  const messages = [...allMessages].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!messageText.trim() || !client) return;

    sendMessage.mutate({
      clientIds: [client.id],
      content: messageText.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine message direction (for styling)
  const getMessageType = (msg: Message): 'outbound' | 'inbound' => {
    // If type is explicitly set, use it
    if (msg.type) return msg.type;
    // Otherwise, default to outbound (platform to client)
    return 'outbound';
  };

  // Format timestamp
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (clientLoading || messagesLoading) {
    return <LoadingScreen message="Loading conversation..." />;
  }

  if (!client) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Client not found.</p>
          <p className="text-sm mt-1">Client ID: {clientId}</p>
          {clientError && (
            <p className="text-sm mt-2 text-red-600">Error: {String(clientError)}</p>
          )}
        </div>
        <button
          onClick={() => router.push('/clients')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Clients
        </button>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-white border-b border-slate-200 shadow-sm">
        <button
          onClick={() => router.push('/clients')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Back to clients"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold">
            {client.firstName[0]}{client.lastName[0]}
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-sm text-slate-500">{client.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            status={client.optedOut ? 'FAILED' : 'DELIVERED'}
            size="sm"
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <div className="text-4xl mb-2">💬</div>
              <p>No messages yet</p>
              <p className="text-sm mt-1">Start the conversation by sending a message below</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messageGroups.map((group) => (
              <div key={group.date}>
                {/* Date Separator */}
                <div className="flex justify-center my-4">
                  <span className="bg-slate-200/80 text-slate-600 text-xs px-3 py-1 rounded-full">
                    {formatDateHeader(group.date)}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-2">
                  {group.messages.map((msg) => {
                    const isOutbound = getMessageType(msg) === 'outbound';
                    const showAvatar = !isOutbound;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${isOutbound ? 'flex-row-reverse' : ''}`}>
                          {/* Avatar for inbound messages */}
                          <div className="flex-shrink-0">
                            {showAvatar && (
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {client.firstName[0]}{client.lastName[0]}
                              </div>
                            )}
                          </div>

                          {/* Message Bubble */}
                          <div className="flex flex-col gap-0.5">
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isOutbound
                                  ? 'bg-blue-500 text-white rounded-br-md'
                                  : msg.status === 'FAILED'
                                  ? 'bg-red-100 text-red-800 rounded-bl-md border border-red-200'
                                  : 'bg-white text-slate-800 rounded-bl-md border border-slate-200'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>

                            {/* Message meta */}
                            <div className={`flex items-center gap-2 text-xs text-slate-400 ${isOutbound ? 'justify-end' : ''}`}>
                              <span>{formatTime(msg.createdAt)}</span>
                              {isOutbound && (
                                <span className="flex items-center">
                                  {msg.status === 'PENDING' && '○'}
                                  {msg.status === 'QUEUED' && '◐'}
                                  {msg.status === 'SENT' && '●'}
                                  {msg.status === 'DELIVERED' && '✓'}
                                  {msg.status === 'DELIVERED' && <span className="ml-0.5 text-blue-600">✓</span>}
                                  {msg.status === 'FAILED' && <span className="text-red-500">!</span>}
                                </span>
                              )}
                              {!isOutbound && msg.status === 'FAILED' && (
                                <span className="text-red-500">Failed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 border border-slate-300 rounded-2xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending || client.optedOut}
            className={`p-3 rounded-full transition-colors ${
              client.optedOut
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : messageText.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-200 text-slate-400'
            }`}
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        {/* Opted out notice */}
        {client.optedOut && (
          <p className="text-xs text-red-500 mt-2 text-center">
            This client has opted out and cannot receive messages.
          </p>
        )}

        {/* Character count */}
        <p className="text-xs text-slate-400 mt-2 text-center">
          {messageText.length} / 160 characters
        </p>
      </div>
    </div>
  );
}