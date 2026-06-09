/**
 * SMS Platform - Database Seed Script
 * Run with: npx tsx prisma/seed.ts
 * Or: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ===========================================
  // Create Test Admin User
  // ===========================================
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });
  console.log('✅ Created admin user: admin@example.com / admin123');

  // Regular test user
  const testUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('user123', 10),
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
    },
  });
  console.log('✅ Created test user: user@example.com / user123');

  // ===========================================
  // Create Message Templates
  // ===========================================
  const templates = await Promise.all([
    prisma.template.upsert({
      where: { name: 'Welcome Message' },
      update: {},
      create: {
        name: 'Welcome Message',
        category: 'ONBOARDING',
        content: 'Hi {{firstName}}! Welcome to our service. Reply STOP to unsubscribe.',
      },
    }),
    prisma.template.upsert({
      where: { name: 'Appointment Reminder' },
      update: {},
      create: {
        name: 'Appointment Reminder',
        category: 'NOTIFICATION',
        content: 'Reminder: You have an appointment on {{date}} at {{time}}. Reply C to confirm, R to reschedule.',
      },
    }),
    prisma.template.upsert({
      where: { name: 'Promotional Offer' },
      update: {},
      create: {
        name: 'Promotional Offer',
        category: 'MARKETING',
        content: '{{firstName}}, exclusive offer just for you! Use code {{code}} for {{discount}}% off. Valid until {{expiry}}.',
      },
    }),
    prisma.template.upsert({
      where: { name: 'Birthday Greeting' },
      update: {},
      create: {
        name: 'Birthday Greeting',
        category: 'NOTIFICATION',
        content: 'Happy Birthday, {{firstName}}! 🎂 We hope you have an amazing day. Here\'s a special gift for you!',
      },
    }),
    prisma.template.upsert({
      where: { name: 'Shipping Update' },
      update: {},
      create: {
        name: 'Shipping Update',
        category: 'TRANSACTIONAL',
        content: 'Hi {{firstName}}, your order #{{orderId}} has shipped! Track at: {{trackingUrl}}',
      },
    }),
  ]);
  console.log(`✅ Created ${templates.length} message templates`);

  // ===========================================
  // Create Test Clients
  // ===========================================
  const clients = await Promise.all([
    prisma.client.upsert({
      where: { phone: '+15551001001' },
      update: {},
      create: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551001001',
        email: 'john.doe@example.com',
        birthday: new Date('1990-05-15'),
        notes: 'VIP customer',
      },
    }),
    prisma.client.upsert({
      where: { phone: '+15551001002' },
      update: {},
      create: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+15551001002',
        email: 'jane.smith@example.com',
        birthday: new Date('1985-08-22'),
      },
    }),
    prisma.client.upsert({
      where: { phone: '+15551001003' },
      update: {},
      create: {
        firstName: 'Bob',
        lastName: 'Johnson',
        phone: '+15551001003',
        email: 'bob.j@example.com',
      },
    }),
    prisma.client.upsert({
      where: { phone: '+15551001004' },
      update: {},
      create: {
        firstName: 'Alice',
        lastName: 'Williams',
        phone: '+15551001004',
        email: 'alice.w@example.com',
        notes: 'Prefers appointment reminders',
      },
    }),
    prisma.client.upsert({
      where: { phone: '+15551001005' },
      update: {},
      create: {
        firstName: 'Charlie',
        lastName: 'Brown',
        phone: '+15551001005',
        optedOut: true,
        notes: 'Opted out on 2024-01-15',
      },
    }),
  ]);
  console.log(`✅ Created ${clients.length} test clients`);

  // ===========================================
  // Create Test Campaigns
  // ===========================================
  const welcomeTemplate = templates[0];

  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { id: 'seed-campaign-1' },
      update: {},
      create: {
        id: 'seed-campaign-1',
        name: 'Summer Welcome Series',
        description: 'Onboarding campaign for new summer customers',
        templateId: welcomeTemplate.id,
        status: 'COMPLETED',
        scheduleTime: new Date('2024-06-01T09:00:00Z'),
      },
    }),
    prisma.campaign.upsert({
      where: { id: 'seed-campaign-2' },
      update: {},
      create: {
        id: 'seed-campaign-2',
        name: 'July Promo',
        description: 'Monthly promotional offer for July',
        templateId: templates[2].id,
        status: 'SCHEDULED',
        scheduleTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      },
    }),
    prisma.campaign.upsert({
      where: { id: 'seed-campaign-3' },
      update: {},
      create: {
        id: 'seed-campaign-3',
        name: 'Birthday Messages',
        description: 'Automated birthday greetings - scheduled daily at 9am',
        templateId: templates[3].id,
        status: 'DRAFT',
        recurrence: 'DAILY',
      },
    }),
  ]);
  console.log(`✅ Created ${campaigns.length} test campaigns`);

  // ===========================================
  // Create Sample Messages
  // ===========================================
  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    for (const client of clients.slice(0, 3)) {
      await prisma.message.createMany({
        data: [
          {
            clientId: client.id,
            campaignId: campaigns[0].id,
            content: `Hi ${client.firstName}! Welcome to our service. Reply STOP to unsubscribe.`,
            status: 'DELIVERED',
            twilioSid: `SM_TEST_${Date.now()}_1`,
            sentAt: new Date('2024-06-01T09:05:00Z'),
          },
          {
            clientId: client.id,
            campaignId: campaigns[0].id,
            content: `Follow-up message sent 3 days after welcome.`,
            status: 'SENT',
            twilioSid: `SM_TEST_${Date.now()}_2`,
            sentAt: new Date('2024-06-04T09:00:00Z'),
          },
        ],
      });
    }
    console.log('✅ Created sample messages');
  }

  // ===========================================
  // Create Audit Logs
  // ===========================================
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        actor: admin.email,
        action: 'user_login',
        details: { ipAddress: '127.0.0.1' },
      },
      {
        userId: admin.id,
        actor: admin.email,
        action: 'campaign_created',
        details: { campaignId: campaigns[0].id },
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Created sample audit logs');

  console.log('\n🎉 Database seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Test Credentials:');
  console.log('   Admin: admin@example.com / admin123');
  console.log('   User:  user@example.com / user123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });