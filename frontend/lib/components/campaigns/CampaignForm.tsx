'use client';

/**
 * CampaignForm
 *
 * Add/Edit campaign form. Sections:
 *   1. Basics      — name, description
 *   2. Template    — pick from existing templates (optional)
 *   3. Schedule    — scheduleTime, recurrence (both optional)
 *   4. Audience    — All clients / Previous tax year active / Manual selection
 *
 * Audience is required: defaults to ALL on add. Switching to MANUAL without any
 * picked recipients is a validation error; switching audience modes doesn't
 * wipe previously picked recipients (MANUAL ids persist in form state).
 */

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, CreateCampaignInput, AudienceType } from '@/lib/types';
import { useTemplates, useClientCount } from '@/lib/hooks/useApi';
import { ClientPicker } from './ClientPicker';

interface CampaignFormProps {
  campaign?: Campaign | null;
  onSubmit: (data: CreateCampaignInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const RECURRENCE_OPTIONS: { value: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const AUDIENCE_OPTIONS: { value: AudienceType; title: string; description: string }[] = [
  {
    value: 'ALL',
    title: 'All clients',
    description: 'Send to every client who has not opted out.',
  },
  {
    value: 'PREV_YEAR_ACTIVE',
    title: 'Previous tax year active',
    description: 'Send to clients whose taxFiledDate falls in the prior calendar year. (Requires the CSV import to be run to populate taxFiledDate.)',
  },
  {
    value: 'MANUAL',
    title: 'Manual selection',
    description: 'Pick specific clients below. Opted-out selections are filtered at send time.',
  },
];

/** Returns the prior calendar year as the bracketed window the backend uses. */
function priorTaxYearWindow(): string {
  const now = new Date();
  const y = now.getFullYear() - 1;
  return `Jan 1, ${y} – Dec 31, ${y}`;
}

export function CampaignForm({ campaign, onSubmit, onCancel, isLoading }: CampaignFormProps) {
  const [formData, setFormData] = useState<CreateCampaignInput>({
    name: '',
    description: '',
    templateId: '',
    scheduleTime: '',
    recurrence: 'NONE',
    audience: 'ALL',
    manualRecipientIds: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load templates for the picker dropdown.
  const { data: templates, isLoading: isLoadingTemplates } = useTemplates();
  const templateOptions = templates ?? [];

  useEffect(() => {
    if (campaign) {
      // Backend stores scheduleTime as ISO; the input element wants yyyy-MM-ddTHH:mm.
      const scheduleLocal = campaign.scheduleTime
        ? toDatetimeLocalValue(campaign.scheduleTime)
        : '';
      // YEARLY is in the form's select — preserve whatever the campaign had.
      const recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' =
        campaign.recurrence === 'DAILY' || campaign.recurrence === 'WEEKLY' || campaign.recurrence === 'MONTHLY' || campaign.recurrence === 'NONE' || campaign.recurrence === 'YEARLY'
          ? campaign.recurrence
          : 'NONE';
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        templateId: campaign.templateId || '',
        scheduleTime: scheduleLocal,
        recurrence,
        audience: campaign.audience || 'ALL',
        manualRecipientIds: campaign.manualRecipientIds ?? [],
      });
    } else {
      setFormData({
        name: '',
        description: '',
        templateId: '',
        scheduleTime: '',
        recurrence: 'NONE',
        audience: 'ALL',
        manualRecipientIds: [],
      });
    }
    setErrors({});
  }, [campaign]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const out = { ...prev };
        delete out[name];
        return out;
      });
    }
  };

  const handleAudienceChange = (next: AudienceType) => {
    setFormData((prev) => ({ ...prev, audience: next }));
    setErrors((prev) => {
      const out = { ...prev };
      delete out.audience;
      delete out.manualRecipientIds;
      return out;
    });
  };

  const handleManualIdsChange = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, manualRecipientIds: ids }));
    if (errors.manualRecipientIds) {
      setErrors((prev) => {
        const out = { ...prev };
        delete out.manualRecipientIds;
        return out;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) {
      next.name = 'Campaign name is required';
    } else if (formData.name.trim().length > 100) {
      next.name = 'Name must be at most 100 characters';
    }
    if (formData.description && formData.description.length > 500) {
      next.description = 'Description must be at most 500 characters';
    }
    if (formData.scheduleTime) {
      const chosen = new Date(formData.scheduleTime);
      if (Number.isNaN(chosen.getTime())) {
        next.scheduleTime = 'Invalid date';
      } else if (chosen.getTime() <= Date.now()) {
        next.scheduleTime = 'Schedule time must be in the future';
      }
    }
    if (formData.audience === 'MANUAL' && (formData.manualRecipientIds ?? []).length === 0) {
      next.manualRecipientIds = 'Select at least one client';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const submitData: CreateCampaignInput = {
      name: formData.name.trim(),
      ...(formData.description?.trim() && { description: formData.description.trim() }),
      ...(formData.templateId && { templateId: formData.templateId }),
      ...(formData.scheduleTime && { scheduleTime: formData.scheduleTime }),
      ...(formData.recurrence && formData.recurrence !== 'NONE' && { recurrence: formData.recurrence }),
      audience: formData.audience ?? 'ALL',
      ...(formData.audience === 'MANUAL' && { manualRecipientIds: formData.manualRecipientIds ?? [] }),
    };
    onSubmit(submitData);
  };

  const isEditMode = !!campaign;
  const priorYearLabel = useMemo(() => priorTaxYearWindow(), []);

  // Live audience-resolved count: server returns opted-in counts for ALL /
  // PREV_YEAR_ACTIVE. The hook is disabled when audience is MANUAL because
  // the picked ids live in local form state and the picker can give an
  // instant count on its own.
  const serverAudience = formData.audience === 'ALL' || formData.audience === 'PREV_YEAR_ACTIVE'
    ? formData.audience
    : undefined;
  const { data: serverCount, isFetching: isFetchingCount } = useClientCount({
    audience: serverAudience,
  });

  const manualPickedCount = (formData.manualRecipientIds ?? []).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basics */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Campaign Name <span className="text-red-500">*</span>
      </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          maxLength={100}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors ${
            errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="Spring Promo 2026"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
    </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
          Description
      </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          rows={2}
          maxLength={500}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors resize-none ${
            errors.description ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="Optional notes for the team"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
        )}
    </div>

      {/* Template */}
      <div>
        <label htmlFor="templateId" className="block text-sm font-medium text-slate-700 mb-1">
          Template
      </label>
        <select
          id="templateId"
          name="templateId"
          value={formData.templateId || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors"
          disabled={isLoadingTemplates}
        >
          <option value="">— None —</option>
          {templateOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.category.toLowerCase()})
          </option>
          ))}
       </select>
        <p className="mt-1 text-xs text-slate-500">
          The campaign can be saved without a template, but it can't be sent until one is assigned.
      </p>
    </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="scheduleTime" className="block text-sm font-medium text-slate-700 mb-1">
            Schedule Time
        </label>
          <input
            type="datetime-local"
            id="scheduleTime"
            name="scheduleTime"
            value={formData.scheduleTime || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors ${
              errors.scheduleTime ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
          />
          {errors.scheduleTime && (
            <p className="mt-1 text-sm text-red-600">{errors.scheduleTime}</p>
          )}
      </div>

        <div>
          <label htmlFor="recurrence" className="block text-sm font-medium text-slate-700 mb-1">
            Recurrence
        </label>
          <select
            id="recurrence"
            name="recurrence"
            value={formData.recurrence || 'NONE'}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors"
          >
            {RECURRENCE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
            </option>
            ))}
         </select>
      </div>
     </div>

      {/* Audience */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Audience
      </label>
        <div className="space-y-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const checked = formData.audience === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  checked ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={checked}
                  onChange={() => handleAudienceChange(opt.value)}
                  className="mt-0.5 w-4 h-4 border-slate-300 text-slate-700 placeholder:text-slate-400 focus:ring-blue-500"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-900">{opt.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {opt.value === 'PREV_YEAR_ACTIVE' ? `${opt.description} (${priorYearLabel})` : opt.description}
                 </span>
               </span>
             </label>
            );
          })}
       </div>

        {/* Manual picker (only when selected) */}
        {formData.audience !== 'MANUAL' && (
          <p className="mt-3 pl-7 text-xs text-slate-600" data-testid="audience-count">
            {formData.audience === 'PREV_YEAR_ACTIVE' && isFetchingCount ? (
              <span className="text-slate-400">Counting opted-in clients from {priorYearLabel}…</span>
            ) : formData.audience === 'PREV_YEAR_ACTIVE' && serverCount ? (
              <>
                Will target{' '}
                <strong className="text-slate-900">
                  {serverCount.count.toLocaleString()}
               </strong>{' '}
                opted-in client{serverCount.count === 1 ? '' : 's'} from {priorYearLabel}.
                {serverCount.count === 0 && (
                  <span className="block mt-1 text-amber-700">
                    (audience will be empty — CSV import hasn&apos;t populated taxFiledDate yet.)
                 </span>
                )}
             </>
            ) : formData.audience === 'ALL' && serverCount ? (
              <>
                Will target{' '}
                <strong className="text-slate-900">
                  {serverCount.count.toLocaleString()}
               </strong>{' '}
                opted-in client{serverCount.count === 1 ? '' : 's'}.
                {serverCount.count === 0 && (
                  <span className="block mt-1 text-amber-700">
                    (no opted-in clients exist yet.)
                 </span>
                )}
             </>
            ) : (
              <span className="text-slate-400">Counting opted-in clients…</span>
            )}
        </p>
        )}
        {formData.audience === 'MANUAL' && (
          <p className="mt-3 pl-7 text-xs text-slate-600">
            Will target{' '}
            <strong className="text-slate-900">
              {manualPickedCount.toLocaleString()}
           </strong>{' '}
            client{manualPickedCount === 1 ? '' : 's'} from your manual selection.
            Opted-out picks are filtered at send time.
        </p>
        )}

        {/* Manual picker (only when selected) */}
        {formData.audience === 'MANUAL' && (
          <div className="mt-3 pl-7">
            <ClientPicker
              selectedIds={formData.manualRecipientIds ?? []}
              onChange={handleManualIdsChange}
            />
            {errors.manualRecipientIds && (
              <p className="mt-1 text-sm text-red-600">{errors.manualRecipientIds}</p>
            )}
         </div>
        )}
     </div>

      {/* Hint */}
      <p className="text-xs text-slate-500">
        Campaigns in DRAFT or SCHEDULED can be edited; RUNNING and COMPLETED campaigns are
        locked because their recipient list has already been resolved.
    </p>

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
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          )}
          {isEditMode ? 'Update Campaign' : 'Create Campaign'}
      </button>
    </div>
  </form>
  );
}

/**
 * Convert an ISO timestamp (from the API) to the value expected by an
 * <input type="datetime-local">: yyyy-MM-ddTHH:mm (local-tz-naive).
 */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
