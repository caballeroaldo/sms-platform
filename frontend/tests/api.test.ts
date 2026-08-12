/**
 * API Client Tests
 */

import { api } from '@/lib/api';

describe('API Client', () => {
  describe('Mock Mode', () => {
    it('getDashboardStats should return mock data', async () => {
      const response = await api.getDashboardStats();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.totalClients).toBeGreaterThan(0);
    });

    it('getClients should return client list', async () => {
      const response = await api.getClients();
      expect(response.success).toBe(true);
      expect(response.data?.clients).toBeDefined();
      expect(Array.isArray(response.data?.clients)).toBe(true);
    });

    it('getTemplates should return template list', async () => {
      const response = await api.getTemplates();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('getCampaigns should return campaign list', async () => {
      const response = await api.getCampaigns();
      expect(response.success).toBe(true);
      expect(response.data?.campaigns).toBeDefined();
      expect(Array.isArray(response.data?.campaigns)).toBe(true);
    });

    it('getMessages should return message list', async () => {
      const response = await api.getMessages();
      expect(response.success).toBe(true);
      expect(response.data?.messages).toBeDefined();
      expect(Array.isArray(response.data?.messages)).toBe(true);
    });
  });

  describe('Login (Mock)', () => {
    it('should authenticate with correct credentials', async () => {
      const response = await api.login({
        email: 'admin@example.com',
        password: 'admin123',
      });
      expect(response.success).toBe(true);
      expect(response.data?.token).toBeDefined();
      expect(response.data?.user.email).toBe('admin@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await api.login({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Client Operations (Mock)', () => {
    it('should get single client', async () => {
      const response = await api.getClient('cl-1');
      expect(response.success).toBe(true);
      expect(response.data?.firstName).toBe('John');
    });

    it('should return error for non-existent client', async () => {
      const response = await api.getClient('non-existent-id');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Client not found');
    });

    it('should create new client', async () => {
      const newClient = {
        firstName: 'Test',
        lastName: 'User',
        phone: '+15559999999',
        email: 'test@test.com',
      };
      const response = await api.createClient(newClient);
      expect(response.success).toBe(true);
      expect(response.data?.firstName).toBe('Test');
      expect(response.data?.id).toBeDefined();
    });
  });

  describe('Template Operations (Mock)', () => {
    it('should get single template', async () => {
      const response = await api.getTemplate('tpl-1');
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Welcome Message');
    });

    it('should create new template', async () => {
      const newTemplate = {
        name: 'Test Template',
        category: 'NOTIFICATION' as const,
        content: 'Hello {{name}}!',
      };
      const response = await api.createTemplate(newTemplate);
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test Template');
    });
  });

  describe('Campaign Operations (Mock)', () => {
    it('should get single campaign', async () => {
      const response = await api.getCampaign('camp-1');
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Summer Welcome Series');
    });

    it('should create new campaign', async () => {
      const newCampaign = {
        name: 'Test Campaign',
        templateId: 'tpl-1',
      };
      const response = await api.createCampaign(newCampaign);
      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test Campaign');
    });
  });

  describe('Send Message (Mock)', () => {
    it('should send message to selected clients', async () => {
      const response = await api.sendMessage({
        clientIds: ['cl-1', 'cl-2'],
        content: 'Test message',
      });
      expect(response.success).toBe(true);
      expect(response.data?.sent).toBe(2);
      expect(response.data?.failed).toBe(0);
    });
  });

  describe('Conversations (Mock)', () => {
    it('getConversations returns {conversations, pagination} with with-message rows before zero-message (null-lastMessage) rows', async () => {
      const response = await api.getConversations();
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data?.conversations)).toBe(true);
      expect(response.data?.pagination).toBeDefined();
      expect(response.data?.pagination).toHaveProperty('page');
      expect(response.data?.pagination).toHaveProperty('pages');

      const convs = response.data?.conversations ?? [];
      // cl-1 has messages → at least one non-null row; cl-5 has none → a null row.
      expect(convs.some((c) => c.lastMessage !== null)).toBe(true);
      expect(convs.some((c) => c.lastMessage === null)).toBe(true);

      // Every with-message row must precede every zero-message row.
      const firstNullIdx = convs.findIndex((c) => c.lastMessage === null);
      const lastNonNullIdx = convs.map((c, i) => (c.lastMessage !== null ? i : -1)).filter((i) => i >= 0).pop();
      expect(firstNullIdx).toBeGreaterThan(-1);
      expect(lastNonNullIdx).toBeDefined();
      expect(lastNonNullIdx!).toBeLessThan(firstNullIdx);
    });

    it("getClientMessages('cl-1') returns the merged thread with inbound rows tagged direction 'inbound'", async () => {
      const response = await api.getClientMessages('cl-1');
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      const msgs = response.data ?? [];
      expect(msgs.length).toBeGreaterThan(0);
      // Every row carries a direction.
      expect(msgs.every((m) => m.direction === 'outbound' || m.direction === 'inbound')).toBe(true);
      // cl-1's mock thread includes inbound replies → at least one inbound row.
      expect(msgs.some((m) => m.direction === 'inbound')).toBe(true);
    });
  });
});