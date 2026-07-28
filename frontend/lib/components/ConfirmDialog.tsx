'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button by default for safety
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: (
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      ),
      confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      iconBg: 'bg-red-100',
    },
    warning: {
      icon: (
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      iconBg: 'bg-yellow-100',
    },
    info: {
      icon: (
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      iconBg: 'bg-blue-100',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Icon */}
          <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} mb-4`}>
            {styles.icon.props.children}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-slate-600 text-center mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.confirmButton}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}