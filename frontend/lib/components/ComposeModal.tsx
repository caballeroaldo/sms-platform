'use client';

/**
 * ComposeModal — multi-recipient bulk SMS composer (extracted from the old flat
 * Messages page). Preserved as a header button in the inbox.
 *
 * Data: useClients({limit:100, optedOut:false}) for the recipient checkbox list
 * and useSendMessage to fire POST /messages/send-now. On success the shared
 * useSendMessage.onSuccess invalidates ['conversations'] + ['conversation'] +
 * ['messages'], so newly-sent-to clients bubble to the top of the inbox left
 * column and their threads refresh.
 *
 * Safety: send hits POST /messages/send-now, which in the current env fires real
 * (401) Twilio calls — a pre-existing app hazard, surfaced here via onError
 * (the mutation's error state disables the button + shows "Sending...").
 */

import { useState } from 'react';
import { useClients, useSendMessage } from '@/lib/hooks/useApi';

interface ComposeModalProps {
  onClose: () => void;
}

export function ComposeModal({ onClose }: ComposeModalProps) {
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');

  // Opted-in clients only (optedOut:false). limit:100 covers the book so far;
  // the old page used the same bound.
  const { data: clientsData } = useClients({ limit: 100, optedOut: false });

  const sendMessage = useSendMessage({
    onSuccess: () => {
      onClose();
      setSelectedClients([]);
      setMessageContent('');
    },
    onError: (error) => {
      // The form stays mounted on error so the user sees the failure state and
      // can retry / adjust. Surface the server error via the button label.
      console.error('Compose send failed:', error);
    },
  });

  const handleSend = () => {
    if (selectedClients.length === 0 || !messageContent.trim()) return;
    sendMessage.mutate({ clientIds: selectedClients, content: messageContent });
  };

  return (
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
              <div className="max-h-40 overflow-auto border border-slate-300 rounded-lg p-2 space-y-1 text-slate-700 placeholder:text-slate-400">
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {messageContent.length} characters
            </p>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
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
  );
}
