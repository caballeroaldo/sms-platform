/**
 * SMS Platform - In-Memory Mock Database
 * Used for development/testing without PostgreSQL
 * Run with: ENABLE_MOCK_DB=1 npm run dev
 */

import bcrypt from 'bcrypt';

// In-memory data stores
const users = new Map<string, User>();
const clients = new Map<string, Client>();
const templates = new Map<string, Template>();
const campaigns = new Map<string, Campaign>();
const messages = new Map<string, Message>();
const consents = new Map<string, Consent[]>();
const auditLogs: AuditLog[] = [];

// Entity types
interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  updatedAt: Date;
}

// Exported (matches the `export interface Message` precedent below) so its name
// is available to the declaration emitted for db/database.ts's `clients` export,
// which returns this shape from the mock `findByPhone` branch. Without the
// export, tsc's declaration-emit phase errors TS4023/TS4082 ("cannot be named"
// / "private name 'Client'") under tsconfig `declaration: true`.
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthday: Date | null;
  notes: string;
  optedOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Template {
  id: string;
  name: string;
  category: 'ONBOARDING' | 'MARKETING' | 'NOTIFICATION' | 'TRANSACTIONAL' | 'ALERT';
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  scheduleTime: Date | null;
  recurrence: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  clientId: string;
  campaignId: string | null;
  content: string;
  status: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  twilioSid: string | null;
  errorMessage: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Consent {
  id: string;
  clientId: string;
  consentType: string;
  source: string;
  timestamp: Date;
}

interface AuditLog {
  id: string;
  userId: string;
  clientId: string | null;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}

// Seed demo data
async function seedDemoData() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Users
  users.set('user-1', {
    id: 'user-1',
    email: 'admin@example.com',
    passwordHash,
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  users.set('user-2', {
    id: 'user-2',
    email: 'user@example.com',
    passwordHash: await bcrypt.hash('user123', 10),
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Templates
  templates.set('tpl-1', {
    id: 'tpl-1',
    name: 'Welcome Message',
    category: 'ONBOARDING',
    content: 'Hi {{firstName}}! Welcome to our service.',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  templates.set('tpl-2', {
    id: 'tpl-2',
    name: 'Appointment Reminder',
    category: 'NOTIFICATION',
    content: 'Reminder: Appointment on {{date}} at {{time}}.',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  templates.set('tpl-3', {
    id: 'tpl-3',
    name: 'Special Offer',
    category: 'MARKETING',
    content: '{{firstName}}, use code {{code}} for {{discount}}% off!',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Clients
  clients.set('cl-1', {
    id: 'cl-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+15551001001',
    email: 'john@example.com',
    birthday: new Date('1990-05-15'),
    notes: 'VIP customer',
    optedOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  clients.set('cl-2', {
    id: 'cl-2',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+15551001002',
    email: 'jane@example.com',
    birthday: new Date('1985-08-22'),
    notes: '',
    optedOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  clients.set('cl-3', {
    id: 'cl-3',
    firstName: 'Bob',
    lastName: 'Johnson',
    phone: '+15551001003',
    email: 'bob@example.com',
    birthday: null,
    notes: '',
    optedOut: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Campaigns
  campaigns.set('camp-1', {
    id: 'camp-1',
    name: 'Summer Welcome Series',
    description: 'Onboarding campaign',
    templateId: 'tpl-1',
    status: 'COMPLETED',
    scheduleTime: new Date('2024-06-01'),
    recurrence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  campaigns.set('camp-2', {
    id: 'camp-2',
    name: 'July Special Offer',
    description: 'Monthly promo',
    templateId: 'tpl-3',
    status: 'DRAFT',
    scheduleTime: null,
    recurrence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Messages
  messages.set('msg-1', {
    id: 'msg-1',
    clientId: 'cl-1',
    campaignId: 'camp-1',
    content: 'Hi John! Welcome to our service.',
    status: 'DELIVERED',
    twilioSid: 'SM_MOCK_001',
    errorMessage: null,
    scheduledAt: new Date('2024-06-01'),
    sentAt: new Date('2024-06-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  messages.set('msg-2', {
    id: 'msg-2',
    clientId: 'cl-2',
    campaignId: 'camp-1',
    content: 'Hi Jane! Welcome to our service.',
    status: 'SENT',
    twilioSid: 'SM_MOCK_002',
    errorMessage: null,
    scheduledAt: new Date('2024-06-01'),
    sentAt: new Date('2024-06-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('✅ Mock database seeded with demo data');
}

// Export mock database interface
export const mockDb = {
  users,
  clients,
  templates,
  campaigns,
  messages,
  consents,
  auditLogs,
  seedDemoData,

  // Helper to generate IDs
  generateId: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};

// Initialize seed
seedDemoData();

export default mockDb;