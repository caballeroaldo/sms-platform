'use client';

/**
 * Templates Page
 * List and manage message templates
 */

import { useState } from 'react';
import { useTemplates } from '@/lib/hooks/useApi';
import { LoadingScreen, StatusBadge } from '@/lib/components/ui';
import { mockTemplates } from '@/lib/mockData';
import type { TemplateCategory } from '@/lib/types';

export default function TemplatesPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const { data, isLoading, error } = useTemplates({
    category: categoryFilter || undefined,
  });

  // Use mock data for display
  const templates = data || mockTemplates.filter(t => {
    if (!categoryFilter) return true;
    return t.category === categoryFilter;
  });

  const categoryOptions: { value: string; label: string }[] = [
    { value: '', label: 'All Categories' },
    { value: 'ONBOARDING', label: 'Onboarding' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'NOTIFICATION', label: 'Notification' },
    { value: 'TRANSACTIONAL', label: 'Transactional' },
    { value: 'ALERT', label: 'Alert' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-600 mt-1">
            Message templates with variable support
          </p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <span>+</span> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {categoryOptions.map((opt) => (
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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          Failed to load templates. Please try again.
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
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-600 hover:text-blue-700">
                      Edit
                    </button>
                    <button className="text-xs text-slate-600 hover:text-slate-700">
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}