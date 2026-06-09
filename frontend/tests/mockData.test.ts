/**
 * Mock Data Tests
 */

import {
  mockClients,
  mockTemplates,
  mockCampaigns,
  mockMessages,
  mockDashboardStats,
  filterClients,
  filterCampaigns,
  filterTemplates,
} from '@/lib/mockData';

describe('Mock Data', () => {
  describe('mockClients', () => {
    it('should have expected number of clients', () => {
      expect(mockClients.length).toBe(6);
    });

    it('should have clients with required fields', () => {
      mockClients.forEach((client) => {
        expect(client).toHaveProperty('id');
        expect(client).toHaveProperty('firstName');
        expect(client).toHaveProperty('lastName');
        expect(client).toHaveProperty('phone');
        expect(client).toHaveProperty('optedOut');
        expect(typeof client.optedOut).toBe('boolean');
      });
    });

    it('should have mixed opted in/out clients', () => {
      const optedIn = mockClients.filter((c) => !c.optedOut);
      const optedOut = mockClients.filter((c) => c.optedOut);
      expect(optedIn.length).toBeGreaterThan(0);
      expect(optedOut.length).toBeGreaterThan(0);
    });
  });

  describe('mockTemplates', () => {
    it('should have expected number of templates', () => {
      expect(mockTemplates.length).toBe(6);
    });

    it('should have templates with variables extracted', () => {
      const welcomeTemplate = mockTemplates.find((t) => t.name === 'Welcome Message');
      expect(welcomeTemplate?.variables).toContain('firstName');
    });

    it('should have templates in all categories', () => {
      const categories = new Set(mockTemplates.map((t) => t.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });

  describe('mockCampaigns', () => {
    it('should have expected number of campaigns', () => {
      expect(mockCampaigns.length).toBe(4);
    });

    it('should have campaigns with different statuses', () => {
      const statuses = new Set(mockCampaigns.map((c) => c.status));
      expect(statuses.size).toBeGreaterThan(1);
    });

    it('should have some completed/completed campaigns', () => {
      const completedCampaigns = mockCampaigns.filter(
        (c) => c.status === 'COMPLETED' || c.status === 'RUNNING'
      );
      expect(completedCampaigns.length).toBeGreaterThan(0);
    });
  });

  describe('mockMessages', () => {
    it('should have messages with status info', () => {
      mockMessages.forEach((msg) => {
        expect(msg).toHaveProperty('status');
        expect(msg).toHaveProperty('content');
        expect(msg).toHaveProperty('clientId');
      });
    });

    it('should have messages of different statuses', () => {
      const statuses = new Set(mockMessages.map((m) => m.status));
      expect(statuses.size).toBeGreaterThan(1);
    });
  });

  describe('mockDashboardStats', () => {
    it('should have valid positive numbers', () => {
      expect(mockDashboardStats.totalClients).toBeGreaterThan(0);
      expect(mockDashboardStats.totalMessages).toBeGreaterThan(0);
      expect(mockDashboardStats.totalCampaigns).toBeGreaterThan(0);
    });

    it('should have consistent message counts', () => {
      expect(mockDashboardStats.sentMessages).toBeGreaterThanOrEqual(
        mockDashboardStats.deliveredMessages
      );
      expect(mockDashboardStats.sentMessages).toBeGreaterThanOrEqual(
        mockDashboardStats.failedMessages
      );
    });
  });
});

describe('Filter Functions', () => {
  describe('filterClients', () => {
    it('should filter by optedOut status', () => {
      const optedIn = filterClients(mockClients, { optedOut: false });
      const optedOut = filterClients(mockClients, { optedOut: true });
      expect(optedIn.every((c) => !c.optedOut)).toBe(true);
      expect(optedOut.every((c) => c.optedOut)).toBe(true);
    });

    it('should filter by search term', () => {
      const result = filterClients(mockClients, { search: 'john' });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) =>
        c.firstName.toLowerCase().includes('john') ||
        c.lastName.toLowerCase().includes('john')
      )).toBe(true);
    });

    it('should filter by hasBirthday', () => {
      const withBirthday = filterClients(mockClients, { hasBirthday: true });
      const withoutBirthday = filterClients(mockClients, { hasBirthday: false });
      expect(withBirthday.every((c) => c.birthday !== null)).toBe(true);
      expect(withoutBirthday.every((c) => c.birthday === null)).toBe(true);
    });
  });

  describe('filterCampaigns', () => {
    it('should filter by status', () => {
      const draft = filterCampaigns(mockCampaigns, { status: 'DRAFT' });
      const running = filterCampaigns(mockCampaigns, { status: 'RUNNING' });
      expect(draft.every((c) => c.status === 'DRAFT')).toBe(true);
      expect(running.every((c) => c.status === 'RUNNING')).toBe(true);
    });

    it('should return all when no filter', () => {
      const all = filterCampaigns(mockCampaigns, {});
      expect(all.length).toBe(mockCampaigns.length);
    });
  });

  describe('filterTemplates', () => {
    it('should filter by category', () => {
      const marketing = filterTemplates(mockTemplates, { category: 'MARKETING' });
      const notification = filterTemplates(mockTemplates, { category: 'NOTIFICATION' });
      expect(marketing.every((t) => t.category === 'MARKETING')).toBe(true);
      expect(notification.every((t) => t.category === 'NOTIFICATION')).toBe(true);
    });
  });
});