/**
 * UI Components Tests
 */

import { StatusBadge } from '@/lib/components/ui/StatusBadge';
import { StatCard } from '@/lib/components/ui/StatCard';
import { render, screen } from '@testing-library/react';

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('StatusBadge', () => {
  it('should render campaign status', () => {
    render(<StatusBadge status="RUNNING" />);
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('should render message status', () => {
    render(<StatusBadge status="DELIVERED" />);
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
  });

  it('should render template category', () => {
    render(<StatusBadge status="MARKETING" />);
    expect(screen.getByText('MARKETING')).toBeInTheDocument();
  });

  it('should support small size', () => {
    render(<StatusBadge status="DRAFT" size="sm" />);
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('should render failed status with red background', () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByText('FAILED');
    expect(badge).toHaveClass('text-red-700');
  });

  it('should render delivered status with green background', () => {
    render(<StatusBadge status="DELIVERED" />);
    const badge = screen.getByText('DELIVERED');
    expect(badge).toHaveClass('text-emerald-700');
  });
});

describe('StatCard', () => {
  it('should render title and value', () => {
    render(<StatCard title="Total Clients" value={100} icon="👥" />);
    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    render(
      <StatCard
        title="Messages"
        value={500}
        subtitle="Sent this month"
        icon="📨"
      />
    );
    expect(screen.getByText('Sent this month')).toBeInTheDocument();
  });

  it('should render trend indicator', () => {
    render(
      <StatCard
        title="Clients"
        value={150}
        icon="👥"
        trend={{ value: 12, isPositive: true }}
      />
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });

  it('should render negative trend', () => {
    render(
      <StatCard
        title="Messages"
        value={80}
        icon="📨"
        trend={{ value: 5, isPositive: false }}
      />
    );
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it('should render icon', () => {
    render(<StatCard title="Test" value={10} icon="🎯" />);
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });
});