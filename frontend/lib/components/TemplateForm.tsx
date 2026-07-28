'use client';

import { useState, useEffect } from 'react';
import type { Template, CreateTemplateInput, TemplateCategory } from '@/lib/types';

interface TemplateFormProps {
  template?: Template | null;
  onSubmit: (data: CreateTemplateInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'ALERT', label: 'Alert' },
];

export function TemplateForm({ template, onSubmit, onCancel, isLoading }: TemplateFormProps) {
  const [formData, setFormData] = useState<CreateTemplateInput>({
    name: '',
    category: 'NOTIFICATION',
    content: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        category: template.category || 'NOTIFICATION',
        content: template.content || '',
      });
    } else {
      setFormData({
        name: '',
        category: 'NOTIFICATION',
        content: '',
      });
    }
    setErrors({});
  }, [template]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be at most 100 characters';
    }
    if (!formData.content.trim()) {
      newErrors.content = 'Template content is required';
    } else if (formData.content.length > 1000) {
      newErrors.content = 'Content must be at most 1000 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        name: formData.name.trim(),
        category: formData.category,
        content: formData.content.trim(),
      });
    }
  };

  const isEditMode = !!template;
  const placeholders = Array.from(
    new Set(
      Array.from(formData.content.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1])
    )
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Template Name <span className="text-red-500">*</span>
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
          placeholder="Appointment Reminder"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
     </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">
          Category <span className="text-red-500">*</span>
       </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors"
        >
          {TEMPLATE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
           </option>
          ))}
       </select>
     </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-1">
          Content <span className="text-red-500">*</span>
       </label>
        <textarea
          id="content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          rows={6}
          maxLength={1000}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors resize-none font-mono text-sm ${
            errors.content ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="Hi {{firstName}}, your appointment is on {{date}}."
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-600">{errors.content}</p>
        )}
        {placeholders.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Detected variables</span>
            {placeholders.map((p) => (
              <span
                key={p}
                className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-700 text-xs rounded font-mono"
              >
                {`{{${p}}}`}
             </span>
            ))}
         </div>
        )}
     </div>

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
          {isEditMode ? 'Update Template' : 'Add Template'}
       </button>
     </div>
   </form>
  );
}
