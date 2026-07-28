'use client';

/**
 * Templates Page
 * List and manage message templates
 */

import { useState, useMemo } from 'react';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { useRequireAuth } from '@/lib/components/ProtectedRoute';
import { Modal } from '@/lib/components/Modal';
import { TemplateForm } from '@/lib/components/TemplateForm';
import { ConfirmDialog } from '@/lib/components/ConfirmDialog';
import type { Template, CreateTemplateInput } from '@/lib/types';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'ALERT', label: 'Alert' },
];

interface UsedInCampaign {
  id: string;
  name: string;
}

/**
 * Parse {{var}} placeholders out of content into segments for safe rendering
 * (every char is rendered as React children — no dangerouslySetInnerHTML).
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

/**
 * Format camelCase variable name to a human-readable label.
 * firstName -> "First Name", appointmentTime -> "Appointment Time".
 */
function camelToLabel(s: string): string {
  if (!s) return s;
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

export default function TemplatesPage() {
  useRequireAuth();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Modal + selection state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [usedInCampaigns, setUsedInCampaigns] = useState<UsedInCampaign[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const { data, isLoading, error } = useTemplates({
    category: categoryFilter || undefined,
  });
  const templates = data || [];

  // Mutations
  const createTemplate = useCreateTemplate({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err) => setErrorMessage(err || 'Failed to create template'),
  });

  const updateTemplate = useUpdateTemplate({
    onSuccess: () => {
      setIsEditModalOpen(false);
      setSelectedTemplate(null);
      setErrorMessage(null);
    },
    onError: (err) => setErrorMessage(err || 'Failed to update template'),
  });

  const deleteTemplate = useDeleteTemplate({
    onSuccess: () => {
      setDeleteTemplateId(null);
      setErrorMessage(null);
    },
    onError: (message, usedIn) => {
      // Close the dialog regardless — the page-level banner tells the user why.
      setDeleteTemplateId(null);
      if (usedIn && usedIn.length > 0) {
        setUsedInCampaigns(usedIn);
        setErrorMessage(null);
      } else {
        setErrorMessage(message || 'Failed to delete template');
        setUsedInCampaigns(null);
      }
    },
  });

  // Handlers
  const handleAddClick = () => {
    setIsAddModalOpen(true);
    setErrorMessage(null);
    setUsedInCampaigns(null);
  };

  const handleEditClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsEditModalOpen(true);
    setErrorMessage(null);
  };

  const handlePreviewClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsPreviewModalOpen(true);
  };

  const handleDeleteClick = (template: Template) => {
    setUsedInCampaigns(null);
    setErrorMessage(null);
    setDeleteTemplateId(template.id);
  };

  const handleAddSubmit = (input: CreateTemplateInput) => {
    createTemplate.mutate(input);
  };

  const handleEditSubmit = (input: CreateTemplateInput) => {
    if (selectedTemplate) {
      updateTemplate.mutate({ id: selectedTemplate.id, data: input });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTemplateId) {
      deleteTemplate.mutate(deleteTemplateId);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTemplateId(null);
    setUsedInCampaigns(null);
  };

  if (error) {
    console.error('Templates fetch error:', error);
  }

  // Preview parsing (memoized on the selected template's content)
  const previewContent = selectedTemplate?.content ?? '';
  const previewSegments = useMemo(
    () => parsePlaceholders(previewContent),
    [previewContent]
  );
  const previewPlaceholders = useMemo(
    () =>
      Array.from(
        new Set(
          (previewContent.match(/\{\{(\w+)\}\}/g) || []).map((m) =>
            m.replace(/[{}]/g, '')
          )
        )
      ),
    [previewContent]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header - Dark theme matching navigation */}
      <div className="mb-6 pb-6 border-b border-slate-600 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-slate-300 mt-1">Message templates with variable support</p>
       </div>
        <button
          onClick={handleAddClick}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <span>+</span> New Template
       </button>
     </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="text-sm mt-1">{errorMessage}</p>
           </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800 text-xl leading-none"
              aria-label="Dismiss"
            >
              ×
           </button>
         </div>
       </div>
      )}

      {/* usedIn Banner (delete-server returned 409) */}
      {usedInCampaigns && usedInCampaigns.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-semibold">
                Template is used in {usedInCampaigns.length} campaign
                {usedInCampaigns.length === 1 ? '' : 's'}
             </p>
              <ul className="text-sm mt-1 list-disc list-inside">
                {usedInCampaigns.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
             </ul>
              <p className="text-xs mt-2 text-yellow-700">
                Remove this template from those campaigns first, or delete the campaigns themselves.
             </p>
           </div>
            <button
              onClick={() => setUsedInCampaigns(null)}
              className="text-yellow-700 hover:text-yellow-900 text-xl leading-none"
              aria-label="Dismiss"
            >
              ×
           </button>
         </div>
       </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
             </option>
            ))}
         </select>
       </div>
     </div>

      {/* Loading State */}
      {isLoading && <LoadingScreen message="Loading templates..." />}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">Failed to load templates</p>
          <p className="text-sm mt-1">{String(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Click to reload
         </button>
       </div>
      )}

      {/* Templates Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No templates found</p>
           </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {template.name}
                     </h3>
                      <StatusBadge status={template.category} size="sm" />
                   </div>
                 </div>
                  <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">
                    {template.content.length > 150
                      ? template.content.substring(0, 150) + '...'
                      : template.content}
                 </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-mono"
                        >
                          {`{{${variable}}}`}
                       </span>
                      ))}
                   </div>
                  )}
               </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                 </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditClick(template)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Edit
                   </button>
                    <button
                      onClick={() => handlePreviewClick(template)}
                      className="text-xs text-slate-600 hover:text-slate-700 font-medium"
                    >
                      Preview
                   </button>
                    <button
                      onClick={() => handleDeleteClick(template)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete
                   </button>
                 </div>
               </div>
             </div>
            ))
          )}
       </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="New Template"
        size="lg"
      >
        <TemplateForm
          onSubmit={handleAddSubmit}
          onCancel={() => setIsAddModalOpen(false)}
          isLoading={createTemplate.isPending}
        />
     </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedTemplate ? `Edit Template: ${selectedTemplate.name}` : 'Edit Template'}
        size="lg"
      >
        {selectedTemplate && (
          <TemplateForm
            template={selectedTemplate}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setIsEditModalOpen(false);
              setSelectedTemplate(null);
            }}
            isLoading={updateTemplate.isPending}
          />
        )}
     </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setSelectedTemplate(null);
        }}
        title={selectedTemplate ? `Preview: ${selectedTemplate.name}` : 'Preview'}
        size="lg"
      >
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedTemplate.category} size="sm" />
           </div>
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
            {previewPlaceholders.length > 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-900">Variables referenced</p>
                <p className="text-xs text-blue-800 mt-1 font-mono">
                  {previewPlaceholders.join(', ')}
               </p>
             </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  No variables — this template will send verbatim.
               </p>
             </div>
            )}
         </div>
        )}
     </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTemplateId}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete Template"
        message="Are you sure you want to delete this template? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={deleteTemplate.isPending}
      />
   </div>
  );
}
