'use client';

/**
 * Status Badge Component
 */

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  // Campaign status
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700' },
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RUNNING: { bg: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },

  // Message status
  PENDING: { bg: 'bg-slate-100', text: 'text-slate-700' },
  QUEUED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SENT: { bg: 'bg-purple-100', text: 'text-purple-700' },
  DELIVERED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700' },

  // Template category
  ONBOARDING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  MARKETING: { bg: 'bg-pink-100', text: 'text-pink-700' },
  NOTIFICATION: { bg: 'bg-purple-100', text: 'text-purple-700' },
  TRANSACTIONAL: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ALERT: { bg: 'bg-red-100', text: 'text-red-700' },

  // Default
  default: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

export function StatusBadge({ status, size = 'md' }: BadgeProps) {
  const style = statusStyles[status] || statusStyles.default;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style.bg} ${style.text} ${sizeClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default StatusBadge;