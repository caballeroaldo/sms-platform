/**
 * SMS Platform - Database Abstraction Layer
 * Provides a unified interface for both real (Prisma) and mock databases
 */

import prisma from '../prisma/client.js';
import { mockDb } from './mockDatabase.js';
import { isMockMode } from '../config/index.js';

// Re-export mockDb for convenience
export { mockDb };

// Client operations
export const clients = {
  findMany: async (params?: { skip?: number; take?: number; search?: string; optedOut?: boolean }) => {
    if (isMockMode) {
      const clients = Array.from(mockDb.clients.values());
      const skip = params?.skip || 0;
      const take = params?.take || 50;

      let filtered = clients;

      // Apply search filter
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(c =>
          c.firstName.toLowerCase().includes(s) ||
          c.lastName.toLowerCase().includes(s) ||
          c.phone.includes(s) ||
          (c.email?.toLowerCase().includes(s) ?? false)
        );
      }

      // Apply optedOut filter
      if (params?.optedOut !== undefined) {
        filtered = filtered.filter(c => c.optedOut === params.optedOut);
      }

      const total = filtered.length;

      return {
        clients: filtered.slice(skip, skip + take).map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email,
          birthday: c.birthday?.toISOString() || null,
          notes: c.notes,
          optedOut: c.optedOut,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          _count: { outboundMessages: 0, inboundMessages: 0 }
        })),
        total,
      };
    }

    // Build Prisma where clause for search
    const where: any = {};
    if (params?.search) {
      const s = params.search;
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (params?.optedOut !== undefined) {
      where.optedOut = params.optedOut;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { outboundMessages: true, inboundMessages: true } } },
      }),
      prisma.client.count({ where }),
    ]);
    return { clients, total };
  },

  findUnique: async (id: string) => {
    if (isMockMode) {
      const client = mockDb.clients.get(id);
      if (!client) return null;
      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        birthday: client.birthday?.toISOString() || null,
        notes: client.notes,
        optedOut: client.optedOut,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        _count: { outboundMessages: 0, inboundMessages: 0 }
      };
    }
    return prisma.client.findUnique({ where: { id } });
  },

  findByPhone: async (phone: string) => {
    if (isMockMode) {
      return Array.from(mockDb.clients.values()).find(c => c.phone === phone) || null;
    }
    return prisma.client.findUnique({ where: { phone } });
  },

  create: async (data: { firstName: string; lastName: string; phone: string; email?: string | null; birthday?: string | null; notes?: string }) => {
    if (isMockMode) {
      const id = mockDb.generateId();
      const client = {
        id,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email || null,
        birthday: data.birthday ? new Date(data.birthday) : null,
        notes: data.notes || '',
        optedOut: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.clients.set(id, client);
      // Return with ISO string dates for API consistency
      return {
        ...client,
        birthday: client.birthday?.toISOString() || null,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
      };
    }
    // Coerce birthday via `new Date()` so a date-only "YYYY-MM-DD" (what
    // <input type=date> sends — ClientForm.tsx) lands as a valid Prisma DateTime,
    // matching db.update (below) and the mock branch. Prisma's DateTime scalar
    // rejects a bare date-only string ("premature end of input") → 500, which mock
    // mode masked (the mock coerces). See clients.create.test.ts + Known Issues.
    return prisma.client.create({
      data: { ...data, birthday: data.birthday ? new Date(data.birthday) : null },
    });
  },

  update: async (id: string, data: { firstName?: string; lastName?: string; phone?: string; email?: string | null; birthday?: string | null; notes?: string }) => {
    if (isMockMode) {
      const client = mockDb.clients.get(id);
      if (!client) return null;

      // Merge update data
      const updatedClient = {
        ...client,
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.birthday !== undefined && { birthday: data.birthday ? new Date(data.birthday) : null }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      };

      mockDb.clients.set(id, updatedClient);
      return {
        id: updatedClient.id,
        firstName: updatedClient.firstName,
        lastName: updatedClient.lastName,
        phone: updatedClient.phone,
        email: updatedClient.email,
        birthday: updatedClient.birthday?.toISOString() || null,
        notes: updatedClient.notes,
        optedOut: updatedClient.optedOut,
        createdAt: updatedClient.createdAt.toISOString(),
        updatedAt: updatedClient.updatedAt.toISOString(),
      };
    }
    return prisma.client.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.birthday !== undefined && { birthday: data.birthday ? new Date(data.birthday) : null }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  },

  delete: async (id: string) => {
    if (isMockMode) {
      const client = mockDb.clients.get(id);
      if (!client) return null;

      // Soft delete - set optedOut to true for compliance
      const updatedClient = {
        ...client,
        optedOut: true,
        updatedAt: new Date(),
      };

      mockDb.clients.set(id, updatedClient);
      return {
        id: updatedClient.id,
        firstName: updatedClient.firstName,
        lastName: updatedClient.lastName,
        phone: updatedClient.phone,
        email: updatedClient.email,
        birthday: updatedClient.birthday?.toISOString() || null,
        notes: updatedClient.notes,
        optedOut: updatedClient.optedOut,
        createdAt: updatedClient.createdAt.toISOString(),
        updatedAt: updatedClient.updatedAt.toISOString(),
      };
    }
    // Soft delete - for compliance, opt out the client instead of hard delete
    return prisma.client.update({
      where: { id },
      data: {
        optedOut: true,
      },
    });
  },
};

// Message operations
export const messages = {
  findByClient: async (clientId: string) => {
    if (isMockMode) {
      return Array.from(mockDb.messages.values())
        .filter(m => m.clientId === clientId)
        .map(m => ({
          id: m.id,
          clientId: m.clientId,
          campaignId: m.campaignId,
          content: m.content,
          status: m.status,
          twilioSid: m.twilioSid,
          errorMessage: m.errorMessage,
          scheduledAt: m.scheduledAt?.toString() || null,
          sentAt: m.sentAt?.toString() || null,
          createdAt: m.createdAt.toString(),
          type: 'outbound' as const,
        }));
    }
    return prisma.message.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  },

  create: async (data: { clientId: string; content: string; status: string; campaignId?: string | null }) => {
    if (isMockMode) {
      const id = mockDb.generateId();
      const message = {
        id,
        clientId: data.clientId,
        campaignId: data.campaignId || null,
        content: data.content,
        status: data.status as 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED',
        twilioSid: null,
        errorMessage: null,
        scheduledAt: null,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.messages.set(id, message);
      return message;
    }
    // For Prisma, cast status to the enum
    return prisma.message.create({
      data: {
        clientId: data.clientId,
        content: data.content,
        status: data.status as 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED',
        campaignId: data.campaignId,
      }
    });
  },

  update: async (id: string, data: { status?: string; twilioSid?: string; sentAt?: Date; errorMessage?: string }) => {
    if (isMockMode) {
      const msg = mockDb.messages.get(id);
      if (!msg) return null;
      Object.assign(msg, data, { updatedAt: new Date() });
      return msg;
    }
    // For Prisma, cast status to the enum
    return prisma.message.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status as 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' }),
        ...(data.twilioSid && { twilioSid: data.twilioSid }),
        ...(data.sentAt && { sentAt: data.sentAt }),
        ...(data.errorMessage && { errorMessage: data.errorMessage }),
      }
    });
  },

  findAll: async (params?: {
    skip?: number;
    take?: number;
    orderBy?: 'asc' | 'desc';
    where?: {
      clientId?: string;
      status?: string;
      clientName?: string;
      direction?: string;
    };
  }) => {
    if (isMockMode) {
      let messages = Array.from(mockDb.messages.values());

      // Fetch clients for filtering
      const clients = Array.from(mockDb.clients.values());

      // Apply filters
      if (params?.where?.clientId) {
        messages = messages.filter(m => m.clientId === params.where?.clientId);
      }
      if (params?.where?.status) {
        messages = messages.filter(m => m.status === params.where?.status);
      }
      // Note: direction filtering not available in mock mode - all mock messages are outbound
      if (params?.where?.clientName) {
        const nameLower = params.where.clientName.toLowerCase();
        const matchingClientIds = clients
          .filter(c =>
            c.firstName.toLowerCase().includes(nameLower) ||
            c.lastName.toLowerCase().includes(nameLower)
          )
          .map(c => c.id);
        messages = messages.filter(m => matchingClientIds.includes(m.clientId));
      }

      // Sort
      if (params?.orderBy === 'desc') {
        messages.reverse();
      }

      // Apply pagination
      const skip = params?.skip || 0;
      const take = params?.take || undefined;

      return messages.slice(skip, take ? skip + take : undefined).map(m => ({
        id: m.id,
        clientId: m.clientId,
        campaignId: m.campaignId,
        content: m.content,
        status: m.status,
        twilioSid: m.twilioSid,
        errorMessage: m.errorMessage,
        scheduledAt: m.scheduledAt?.toString() || null,
        sentAt: m.sentAt?.toString() || null,
        deliveredAt: null,
        createdAt: m.createdAt.toISOString(),
      }));
    }

    // Build Prisma where clause
    const where: any = {};
    if (params?.where?.clientId) where.clientId = params.where.clientId;
    if (params?.where?.status) where.status = params.where.status as any;

    // For real database with client name search
    if (params?.where?.clientName) {
      where.client = {
        OR: [
          { firstName: { contains: params.where.clientName, mode: 'insensitive' } },
          { lastName: { contains: params.where.clientName, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.message.findMany({
      skip: params?.skip,
      take: params?.take,
      orderBy: { createdAt: params?.orderBy || 'asc' },
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
  },

  count: async (where?: any) => {
    if (isMockMode) {
      let messages = Array.from(mockDb.messages.values());
      const clients = Array.from(mockDb.clients.values());

      if (!where) return messages.length;

      if (where.clientId) {
        messages = messages.filter(m => m.clientId === where.clientId);
      }
      if (where.status) {
        messages = messages.filter(m => m.status === where.status);
      }
      // Note: direction filtering not available in mock mode - all mock messages are outbound
      if (where.clientName) {
        const nameLower = where.clientName.toLowerCase();
        const matchingClientIds = clients
          .filter(c =>
            c.firstName.toLowerCase().includes(nameLower) ||
            c.lastName.toLowerCase().includes(nameLower)
          )
          .map(c => c.id);
        messages = messages.filter(m => matchingClientIds.includes(m.clientId));
      }

      return messages.length;
    }

    // Build Prisma where clause
    const prismaWhere: any = {};
    if (where?.clientId) prismaWhere.clientId = where.clientId;
    if (where?.status) prismaWhere.status = where.status;
    if (where?.clientName) {
      prismaWhere.client = {
        OR: [
          { firstName: { contains: where.clientName, mode: 'insensitive' } },
          { lastName: { contains: where.clientName, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.message.count({ where: prismaWhere });
  },

  findById: async (id: string) => {
    if (isMockMode) {
      const msg = mockDb.messages.get(id);
      if (!msg) return null;
      return {
        id: msg.id,
        clientId: msg.clientId,
        campaignId: msg.campaignId,
        content: msg.content,
        status: msg.status,
        twilioSid: msg.twilioSid,
        errorMessage: msg.errorMessage,
        scheduledAt: msg.scheduledAt?.toString() || null,
        sentAt: msg.sentAt?.toString() || null,
        deliveredAt: (msg as any).deliveredAt?.toString() || null,
        createdAt: msg.createdAt.toISOString(),
      };
    }
    return prisma.message.findUnique({ where: { id } });
  },

  findByClientInbound: async (clientId: string) => {
    if (isMockMode) {
      return [];
    }
    return prisma.inboundMessage.findMany({
      where: { clientId },
      orderBy: { receivedAt: 'asc' },
      select: {
        id: true,
        clientId: true,
        twilioSid: true,
        body: true,
        receivedAt: true,
      },
    });
  },
};

export default { clients, messages };