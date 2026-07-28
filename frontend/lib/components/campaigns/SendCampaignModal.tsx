'use client';

/**
 * SendCampaignModal
 *
 * Confirmation/preview modal for POST /campaigns/:id/send. Three sections:
 *   1. Overview       — campaign name, audience summary, recipient count
 *   2. Message preview — template content with {{var}} placeholders rendered
 *                       as human-readable labels (mirrors the templates preview)
 *   3. Confirmation   — explicit checkbox required to enable the Send CTA,
 *                       labeled with the resolved recipient count
 *
 * The recipient count comes from useClientCount for ALL and PREV_YEAR_ACTIVE
 * audiences. For MANUAL the count is computed locally from the campaign's
 * manualRecipientIds intersected with the opted-out list (the form already
 * warns about opted-out picks).
 */

import { useMemo, useState, useEffect } from 'react';
import { Modal } from '@/lib/components/Modal';
import { useClientCount } from '@/lib/hooks/useApi';
import type { Campaign, AudienceType } from '@/lib/types';

interface SendCampaignModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Count of currently opted-out clients among the picked MANUAL recipients.
  // Page passes this in; the modal doesn't fetch clients itself.
  manualOptedOutCount?: number;
}

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  ALL: 'All opted-in clients',
  PREV_YEAR_ACTIVE: 'Previous tax year active',
  MANUAL: 'Manual selection',
};

/**
 * Parse {{var}} placeholders out of content into segments for safe rendering.
 * Borrowed from Templates page to keep the preview look consistent.
 */
function parsePlaceholders(content: string): Array<{ kind: 'text' | 'placeholder'; value: string }> {
  const segments: Array<{ kind: 'text' | 'placeholder'; value: string }> = [];
  const regex = /\{\{(\w+)\}\}/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ kind: 'text', value: content.slice(lastIdx, match.index) });
    }
    segments.push({ kind: 'placeholder', value: match[1] });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < content.length) {
    segments.push({ kind: 'text', value: content.slice(lastIdx) });
  }
  return segments;
}

function camelToLabel(s: string): string {
  if (!s) return s;
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function SendCampaignModal({
  campaign,
  isOpen,
  onConfirm,
  onCancel,
  isLoading,
  manualOptedOutCount = 0,
}: SendCampaignModalProps) {
  // Confirmation checkbox resets each time the modal target changes.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!isOpen) setConfirmed(false);
  }, [isOpen, campaign?.id]);

  // For ALL and PREV_YEAR_ACTIVE, ask the server how many opted-in clients
  // would be targeted. MANUAL is computed locally because the picked
  // recipient ids live on the campaign itself.
  const countAudience = campaign?.audience === 'PREV_YEAR_ACTIVE' ? 'PREV_YEAR_ACTIVE' : 'ALL';
  const { data: serverCount, isFetching: isFetchingCount } = useClientCount({
    audience: countAudience,
  });

  const manualPickedCount = campaign?.audience === 'MANUAL' ? (campaign.manualRecipientIds ?? []).length : 0;
  const manualEligibleCount = Math.max(0, manualPickedCount - manualOptedOutCount);

  const previewContent = campaign?.template?.name
    ? (campaign.template as { content?: string }).content ?? ''
    : '';
  // The campaign list response doesn't include template.content; fall back to
  // the templateId reference so the user sees an explicit "content unavailable"
  // placeholder rather than a silent empty preview.
  const hasTemplateContent = !!previewContent;
  const previewSegments = useMemo(
    () => (hasTemplateContent ? parsePlaceholders(previewContent) : []),
    [previewContent, hasTemplateContent]
  );

  const recipientCount: number | null =
    campaign?.audience === 'MANUAL'
      ? manualEligibleCount
      : serverCount?.count ?? null;

  const noTemplate = !!campaign && !campaign.templateId;
  const sendEnabled = !!campaign && !noTemplate && confirmed && (recipientCount ?? 0) > 0 && !isLoading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={campaign ? `Send Campaign: ${campaign.name}` : 'Send Campaign'}
      size="lg"
    >
      {!campaign ? (
        <p className="text-sm text-slate-500">No campaign selected</p>
      ) : (
        <div className="space-y-5">
          {/* Section 1: Overview */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Overview</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Audience</dt>
                <dd className="text-slate-900 font-medium">{AUDIENCE_LABELS[campaign.audience]}</dd>
             </div>
              <div>
                <dt className="text-slate-500">Recipients</dt>
                <dd className="text-slate-900 font-medium">
                  {recipientCount === null ? (
                    <span className="text-slate-400">
                      {isFetchingCount ? 'Counting…' : '—'}
                   </span>
                  ) : (
                    <>
                      {recipientCount.toLocaleString()}{' '}
                      <span className="text-xs text-slate-500 font-normal">opted-in</span>
                      {campaign.audience === 'MANUAL' &&
                        manualOptedOutCount > 0 && (
                          <span className="text-xs text-amber-700 font-normal ml-1">
                            ({manualOptedOutCount} of {manualPickedCount} picked are opted out)
                         </span>
                        )}
                    </>
                  )}
               </dd>
             </div>
              {campaign.scheduleTime && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Schedule</dt>
                  <dd className="text-slate-900 font-medium">
                    {new Date(campaign.scheduleTime).toLocaleString()}
                    <span className="text-xs text-slate-500 font-normal ml-2">
                      (delivered when the worker pulls the row)
                   </span>
                 </dd>
               </div>
              )}
           </dl>
         </section>

          {/* Section 2: Message preview */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Message Preview
              {campaign.template && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  using template &ldquo;{campaign.template.name}&rdquo;
               </span>
              )}
           </h3>
            {noTemplate ? (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                This campaign has no template assigned. Edit the campaign and pick one
                before sending.
             </div>
            ) : !hasTemplateContent && campaign.templateId ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                Template content isn&apos;t loaded on this campaign card. The full
                content is available on the templates page; the send will use the
                stored template.
             </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                {previewSegments.length === 0 ? (
                  <span className="text-slate-400 font-sans">(empty template)</span>
                ) : (
                  previewSegments.map((seg, i) =>
                    seg.kind === 'text' ? (
                      <span key={i}>{seg.value}</span>
                    ) : (
                      <span
                        key={i}
                        className="inline-block mx-0.5 bg-cyan-50 border border-cyan-200 text-cyan-800 px-1.5 py-0.5 rounded text-xs font-medium"
                      >
                        {camelToLabel(seg.value)}
                     </span>
                    )
                  )
                )}
             </div>
            )}
         </section>

          {/* Section 3: Confirmation */}
          {!noTemplate && recipientCount !== null && recipientCount === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm">
              Resolved audience is empty — sending would be a no-op. Edit the
              campaign to broaden the audience or pick different recipients.
           </div>
          )}
          {!noTemplate && (
            <label className="flex items-start gap-2 select-none text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={!!noTemplate || (recipientCount ?? 0) === 0}
                className="mt-0.5 w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                I understand this will create{' '}
                <strong>{recipientCount === null ? '…' : recipientCount.toLocaleString()}</strong>{' '}
                outgoing message
                {recipientCount === 1 ? '' : 's'} for clients who have not opted out.
                Sending is the point of no return — the messages hit Twilio immediately.
             </span>
           </label>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
           </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!sendEnabled}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
               </svg>
              )}
              Send Campaign
           </button>
         </div>
       </div>
      )}
   </Modal>
  );
}
