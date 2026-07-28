/**
 * SMS Platform - Mock Data
 * Used for development and testing without backend
 */

import type {
  Client,
  Template,
  Campaign,
  Message,
  DashboardStats,
  TemplateCategory,
  CampaignStatus,
} from '@/lib/types';

// ===========================================
// Mock Clients
// ===========================================

export const mockClients: Client[] = [
  {
    id: 'cl-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+15551001001',
    email: 'john.doe@example.com',
    birthday: '1990-05-15',
    taxFiledDate: '2025-04-08',
    notes: 'VIP customer - prefers morning appointments',
    optedOut: false,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-06-01T14:22:00Z',
    _count: { outboundMessages: 45, inboundMessages: 12 },
  },
  {
    id: 'cl-2',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+15551001002',
    email: 'jane.smith@example.com',
    birthday: '1985-08-22',
    taxFiledDate: '2025-03-15',
    notes: '',
    optedOut: false,
    createdAt: '2024-02-20T09:15:00Z',
    updatedAt: '2024-06-05T11:45:00Z',
    _count: { outboundMessages: 23, inboundMessages: 8 },
  },
  {
    id: 'cl-3',
    firstName: 'Bob',
    lastName: 'Johnson',
    phone: '+15551001003',
    email: 'bob.johnson@example.com',
    birthday: null,
    taxFiledDate: null,
    notes: 'New customer - follow up next week',
    optedOut: false,
    createdAt: '2024-05-10T16:00:00Z',
    updatedAt: '2024-05-10T16:00:00Z',
    _count: { outboundMessages: 5, inboundMessages: 2 },
  },
  {
    id: 'cl-4',
    firstName: 'Alice',
    lastName: 'Williams',
    phone: '+15551001004',
    email: 'alice.w@example.com',
    birthday: '1988-03-10',
    taxFiledDate: '2025-02-28',
    notes: 'Prefers text reminders only',
    optedOut: false,
    createdAt: '2024-03-01T08:45:00Z',
    updatedAt: '2024-06-08T09:30:00Z',
    _count: { outboundMessages: 67, inboundMessages: 34 },
  },
  {
    id: 'cl-5',
    firstName: 'Charlie',
    lastName: 'Brown',
    phone: '+15551001005',
    email: 'charlie.b@example.com',
    birthday: '1992-11-30',
    taxFiledDate: null,
    notes: 'Opted out on 2024-01-15',
    optedOut: true,
    createdAt: '2023-06-15T12:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    _count: { outboundMessages: 102, inboundMessages: 45 },
  },
  {
    id: 'cl-6',
    firstName: 'Diana',
    lastName: 'Ross',
    phone: '+15551001006',
    email: 'diana.ross@example.com',
    birthday: '1995-07-04',
    taxFiledDate: null,
    notes: 'Subscribed to promotional offers',
    optedOut: false,
    createdAt: '2024-04-22T14:30:00Z',
    updatedAt: '2024-06-07T16:15:00Z',
    _count: { outboundMessages: 15, inboundMessages: 6 },
  },
];

// ===========================================
// Mock Templates
// ===========================================

export const mockTemplates: Template[] = [
  {
    id: 'tpl-1',
    name: 'Welcome Message',
    category: 'ONBOARDING',
    content: 'Hi {{firstName}}! Welcome to our service. We\'re excited to have you on board. Reply STOP to unsubscribe.',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    variables: ['firstName'],
  },
  {
    id: 'tpl-2',
    name: 'Appointment Reminder',
    category: 'NOTIFICATION',
    content: 'Reminder: Hi {{firstName}}, you have an appointment on {{date}} at {{time}}. Reply C to confirm, R to reschedule.',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-03-10T00:00:00Z',
    variables: ['firstName', 'date', 'time'],
  },
  {
    id: 'tpl-3',
    name: 'Special Offer',
    category: 'MARKETING',
    content: '{{firstName}}, exclusive offer just for you! Use code {{code}} for {{discount}}% off. Valid until {{expiry}}.',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-05-20T00:00:00Z',
    variables: ['firstName', 'code', 'discount', 'expiry'],
  },
  {
    id: 'tpl-4',
    name: 'Birthday Greeting',
    category: 'NOTIFICATION',
    content: 'Happy Birthday, {{firstName}}! 🎂 We hope you have an amazing day. Here\'s a special gift just for you!',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    variables: ['firstName'],
  },
  {
    id: 'tpl-5',
    name: 'Shipping Update',
    category: 'TRANSACTIONAL',
    content: 'Hi {{firstName}}, your order #{{orderId}} has shipped! Track your package at: {{trackingUrl}}',
    createdAt: '2024-03-05T00:00:00Z',
    updatedAt: '2024-03-05T00:00:00Z',
    variables: ['firstName', 'orderId', 'trackingUrl'],
  },
  {
    id: 'tpl-6',
    name: 'Low Stock Alert',
    category: 'ALERT',
    content: '⚠️ Alert: {{product}} is running low (only {{count}} left). Order now to avoid stockouts!',
    createdAt: '2024-04-12T00:00:00Z',
    updatedAt: '2024-04-12T00:00:00Z',
    variables: ['product', 'count'],
  },
];

// ===========================================
// Mock Campaigns
// ===========================================

export const mockCampaigns: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Summer Welcome Series',
    description: 'Onboarding campaign for new summer customers',
    templateId: 'tpl-1',
    status: 'COMPLETED',
    scheduleTime: '2024-06-01T09:00:00Z',
    recurrence: null,
    audience: 'ALL',
    manualRecipientIds: [],
    createdAt: '2024-05-25T10:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    template: { id: 'tpl-1', name: 'Welcome Message', category: 'ONBOARDING' },
    stats: { PENDING: 0, QUEUED: 0, SENT: 45, DELIVERED: 42, FAILED: 3 },
  },
  {
    id: 'camp-2',
    name: 'July Promo',
    description: 'Monthly promotional offer for July',
    templateId: 'tpl-3',
    status: 'RUNNING',
    scheduleTime: '2024-07-01T10:00:00Z',
    recurrence: null,
    audience: 'ALL',
    manualRecipientIds: [],
    createdAt: '2024-06-20T14:00:00Z',
    updatedAt: '2024-07-01T10:05:00Z',
    template: { id: 'tpl-3', name: 'Special Offer', category: 'MARKETING' },
    stats: { PENDING: 0, QUEUED: 0, SENT: 128, DELIVERED: 95, FAILED: 2 },
  },
  {
    id: 'camp-3',
    name: 'Birthday Messages',
    description: 'Automated birthday greetings',
    templateId: 'tpl-4',
    status: 'SCHEDULED',
    scheduleTime: '2024-07-15T09:00:00Z',
    recurrence: 'MONTHLY',
    audience: 'PREV_YEAR_ACTIVE',
    manualRecipientIds: [],
    createdAt: '2024-06-15T11:30:00Z',
    updatedAt: '2024-06-15T11:30:00Z',
    template: { id: 'tpl-4', name: 'Birthday Greeting', category: 'NOTIFICATION' },
    stats: { PENDING: 8, QUEUED: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
  },
  {
    id: 'camp-4',
    name: 'Abandoned Cart Reminder',
    description: 'Reminder for customers with items in cart',
    templateId: 'tpl-2',
    status: 'DRAFT',
    scheduleTime: null,
    recurrence: null,
    audience: 'ALL',
    manualRecipientIds: [],
    createdAt: '2024-07-05T09:00:00Z',
    updatedAt: '2024-07-05T09:00:00Z',
    template: { id: 'tpl-2', name: 'Appointment Reminder', category: 'NOTIFICATION' },
    stats: { PENDING: 0, QUEUED: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
  },
];

// ===========================================
// Mock Messages (Outbound)
// ===========================================

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    clientId: 'cl-1',
    campaignId: 'camp-1',
    content: 'Hi John! Welcome to our service. We\'re excited to have you on board. Reply STOP to unsubscribe.',
    status: 'DELIVERED',
    twilioSid: 'SM_TEST_001',
    errorMessage: null,
    scheduledAt: '2024-06-01T09:00:00Z',
    sentAt: '2024-06-01T09:01:23Z',
    createdAt: '2024-06-01T09:00:00Z',
    client: { id: 'cl-1', firstName: 'John', lastName: 'Doe', phone: '+15551001001' },
    campaign: { id: 'camp-1', name: 'Summer Welcome Series' },
  },
  {
    id: 'msg-inbound-1',
    clientId: 'cl-1',
    campaignId: null,
    content: 'Thanks! Glad to be here. Can you remind me when my next appointment is?',
    status: 'DELIVERED',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: null,
    sentAt: '2024-06-02T14:30:00Z',
    createdAt: '2024-06-02T14:30:00Z',
    client: { id: 'cl-1', firstName: 'John', lastName: 'Doe', phone: '+15551001001' },
    type: 'inbound' as const,
    campaign: undefined,
  },
  {
    id: 'msg-2',
    clientId: 'cl-1',
    campaignId: null,
    content: 'Your appointment is scheduled for June 15th at 2:00 PM. Is that still good for you?',
    status: 'DELIVERED',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: null,
    sentAt: '2024-06-02T14:45:00Z',
    createdAt: '2024-06-02T14:45:00Z',
    client: { id: 'cl-1', firstName: 'John', lastName: 'Doe', phone: '+15551001001' },
    type: 'outbound' as const,
    campaign: undefined,
  },
  {
    id: 'msg-inbound-2',
    clientId: 'cl-1',
    campaignId: null,
    content: 'Yes, that works perfectly! See you then.',
    status: 'DELIVERED',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: null,
    sentAt: '2024-06-02T14:50:00Z',
    createdAt: '2024-06-02T14:50:00Z',
    client: { id: 'cl-1', firstName: 'John', lastName: 'Doe', phone: '+15551001001' },
    type: 'inbound' as const,
    campaign: undefined,
  },
  {
    id: 'msg-3',
    clientId: 'cl-2',
    campaignId: 'camp-1',
    content: 'Hi Jane! Welcome to our service. We\'re excited to have you on board. Reply STOP to unsubscribe.',
    status: 'DELIVERED',
    twilioSid: 'SM_TEST_002',
    errorMessage: null,
    scheduledAt: '2024-06-01T09:00:00Z',
    sentAt: '2024-06-01T09:02:15Z',
    createdAt: '2024-06-01T09:00:00Z',
    client: { id: 'cl-2', firstName: 'Jane', lastName: 'Smith', phone: '+15551001002' },
    campaign: { id: 'camp-1', name: 'Summer Welcome Series' },
  },
  {
    id: 'msg-inbound-3',
    clientId: 'cl-2',
    campaignId: null,
    content: 'Hi! Thanks for the welcome. Quick question - do you offer weekend appointments?',
    status: 'DELIVERED',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: null,
    sentAt: '2024-06-03T10:15:00Z',
    createdAt: '2024-06-03T10:15:00Z',
    client: { id: 'cl-2', firstName: 'Jane', lastName: 'Smith', phone: '+15551001002' },
    type: 'inbound' as const,
    campaign: undefined,
  },
  {
    id: 'msg-4',
    clientId: 'cl-4',
    campaignId: 'camp-2',
    content: 'Alice, exclusive offer just for you! Use code SUMMER24 for 25% off. Valid until July 31st.',
    status: 'DELIVERED',
    twilioSid: 'SM_TEST_003',
    errorMessage: null,
    scheduledAt: '2024-07-01T10:00:00Z',
    sentAt: '2024-07-01T10:01:45Z',
    createdAt: '2024-07-01T10:00:00Z',
    client: { id: 'cl-4', firstName: 'Alice', lastName: 'Williams', phone: '+15551001004' },
    campaign: { id: 'camp-2', name: 'July Promo' },
  },
  {
    id: 'msg-inbound-4',
    clientId: 'cl-4',
    campaignId: null,
    content: 'Wow, 25% off is amazing! I\'ll definitely use that code. Thanks for thinking of me!',
    status: 'DELIVERED',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: null,
    sentAt: '2024-07-01T10:30:00Z',
    createdAt: '2024-07-01T10:30:00Z',
    client: { id: 'cl-4', firstName: 'Alice', lastName: 'Williams', phone: '+15551001004' },
    type: 'inbound' as const,
    campaign: undefined,
  },
  {
    id: 'msg-5',
    clientId: 'cl-3',
    campaignId: 'camp-2',
    content: 'Bob, exclusive offer just for you! Use code SUMMER24 for 25% off.',
    status: 'FAILED',
    twilioSid: null,
    errorMessage: 'Invalid phone number',
    scheduledAt: '2024-07-01T10:00:00Z',
    sentAt: null,
    createdAt: '2024-07-01T10:00:00Z',
    client: { id: 'cl-3', firstName: 'Bob', lastName: 'Johnson', phone: '+15551001003' },
    campaign: { id: 'camp-2', name: 'July Promo' },
  },
  {
    id: 'msg-6',
    clientId: 'cl-6',
    campaignId: null,
    content: 'Testing direct message functionality',
    status: 'PENDING',
    twilioSid: null,
    errorMessage: null,
    scheduledAt: '2024-07-10T14:00:00Z',
    sentAt: null,
    createdAt: '2024-07-10T13:30:00Z',
    client: { id: 'cl-6', firstName: 'Diana', lastName: 'Ross', phone: '+15551001006' },
    campaign: undefined,
  },
];

// ===========================================
// Mock Dashboard Stats
// ===========================================

export const mockDashboardStats: DashboardStats = {
  totalClients: 156,
  optedInClients: 142,
  optedOutClients: 14,
  totalMessages: 2847,
  sentMessages: 2756,
  deliveredMessages: 2689,
  failedMessages: 67,
  activeCampaigns: 3,
  totalCampaigns: 12,
  templatesCount: 8,
};

// ===========================================
// Helper to simulate API delay
// ===========================================

export const simulateDelay = (ms: number = 300) =>
  new Promise(resolve => setTimeout(resolve, ms));

// ===========================================
// Filter mock data by various criteria
// ===========================================

export const filterClients = (
  clients: Client[],
  filters: {
    search?: string;
    optedOut?: boolean;
    hasBirthday?: boolean;
  }
): Client[] => {
  return clients.filter(client => {
    if (filters.optedOut !== undefined && client.optedOut !== filters.optedOut) {
      return false;
    }
    if (filters.hasBirthday === true && !client.birthday) {
      return false;
    }
    if (filters.hasBirthday === false && client.birthday) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        client.firstName.toLowerCase().includes(searchLower) ||
        client.lastName.toLowerCase().includes(searchLower) ||
        client.phone.includes(searchLower) ||
        (client.email?.toLowerCase().includes(searchLower) ?? false)
      );
    }
    return true;
  });
};

export const filterCampaigns = (
  campaigns: Campaign[],
  filters: {
    status?: CampaignStatus;
  }
): Campaign[] => {
  if (filters.status) {
    return campaigns.filter(c => c.status === filters.status);
  }
  return campaigns;
};

export const filterTemplates = (
  templates: Template[],
  filters: {
    category?: TemplateCategory;
  }
): Template[] => {
  if (filters.category) {
    return templates.filter(t => t.category === filters.category);
  }
  return templates;
};