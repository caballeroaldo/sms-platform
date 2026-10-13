// Fixed Maximum update depth exceeded error by:
// 1. Moving validation function and default values outside component
// 2. Removing circular dependency in useForm's resetOnChange callback
// 3. Using separate useEffect to handle client prop changes
// 4. Fixing FormEvent deprecation warning
'use client';

import { useEffect } from 'react';
import { useForm } from '@/lib/hooks/useForm';
import type { Client, CreateClientInput } from '@/lib/types';

interface ClientFormProps {
  client?: Client | null;
  onSubmit: (data: CreateClientInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Form validation function - moved outside to prevent recreation on every render
const validateClientForm = (values: CreateClientInput) => {
  const errors: Record<string, string> = {};

  if (!values.firstName || !values.firstName.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!values.lastName || !values.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }

  if (!values.phone || !values.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^\+?[\d\s\-()]+$/.test(values.phone)) {
    errors.phone = 'Invalid phone number format';
  }

  if (values.email && (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) {
    errors.email = 'Invalid email format';
  }

  return errors;
};

// Default values for the client form - moved outside to prevent recreating on every render
const DEFAULT_CLIENT_VALUES: CreateClientInput = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthday: '',
  notes: '',
};

export function ClientForm({ client, onSubmit, onCancel, isLoading }: ClientFormProps) {
  // Initialize form values from client prop or empty values
  const [formState, formHandlers] = useForm<CreateClientInput>(
    DEFAULT_CLIENT_VALUES,
    validateClientForm
  );

  // Reset form when client prop changes
  useEffect(() => {
    if (client) {
      formHandlers.setFieldValue('firstName', client.firstName || '');
      formHandlers.setFieldValue('lastName', client.lastName || '');
      formHandlers.setFieldValue('phone', client.phone || '');
      formHandlers.setFieldValue('email', client.email || '');
      formHandlers.setFieldValue('birthday', client.birthday ? client.birthday.split('T')[0] : '');
      formHandlers.setFieldValue('notes', client.notes || '');
    } else {
      // Reset to empty values
      formHandlers.reset();
    }
  }, [client]);

  const { values: formData, errors, isValid } = formState;
  const { handleChange } = formHandlers;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;

    // Clean up the data - remove empty strings where optional
    const submitData: CreateClientInput = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email?.trim() || undefined,
      birthday: formData.birthday || undefined,
      notes: formData.notes?.trim() || undefined,
    };
    onSubmit(submitData);
  };

  const isEditMode = !!client;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* First Name */}
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">
          First Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors ${
            errors.firstName ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="John"
        />
        {errors.firstName && (
          <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
        )}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">
          Last Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors"
          placeholder="Doe"
        />
        {errors.lastName && (
          <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors ${
            errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="+1 555-123-4567"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors ${
            errors.email ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="john@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* Birthday */}
      <div>
        <label htmlFor="birthday" className="block text-sm font-medium text-slate-700 mb-1">
          Birthday
        </label>
        <input
          type="date"
          id="birthday"
          name="birthday"
          value={formData.birthday}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-700 placeholder:text-slate-400 transition-colors resize-none"
          placeholder="Add any additional notes..."
        />
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
          className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {isEditMode ? 'Update Client' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}